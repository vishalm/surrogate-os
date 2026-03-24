import Anthropic from '@anthropic-ai/sdk';
import { InternalError } from './errors.js';
import { config } from '../config/index.js';
import type { OrgService } from '../modules/orgs/orgs.service.js';

// ── Supported LLM Providers ──────────────────────────────────────────
export type LLMProvider = 'anthropic' | 'openai' | 'azure-openai' | 'ollama';

export const LLM_PROVIDERS: {
  id: LLMProvider;
  label: string;
  models: string[];
  requiresKey: boolean;
  fields: { key: string; label: string; placeholder: string; required: boolean }[];
}[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250414'],
    requiresKey: true,
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-ant-api03-...', required: true },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT)',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
    requiresKey: true,
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', required: true },
    ],
  },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    models: ['gpt-4o', 'gpt-4', 'gpt-35-turbo'],
    requiresKey: true,
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your Azure API key', required: true },
      { key: 'endpoint', label: 'Endpoint URL', placeholder: 'https://your-resource.openai.azure.com', required: true },
      { key: 'apiVersion', label: 'API Version', placeholder: '2024-02-01', required: false },
      { key: 'deploymentName', label: 'Deployment Name', placeholder: 'gpt-4o', required: true },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    models: ['llama3', 'llama3.1', 'llama3.2', 'gemma3', 'qwen2.5', 'deepseek-r1', 'mistral', 'codellama', 'llama2'],
    requiresKey: false,
    fields: [
      { key: 'endpoint', label: 'Ollama URL', placeholder: 'http://host.docker.internal:11434 (use this in Docker)', required: true },
    ],
  },
];

// ── LLM Settings stored in org.settings ──────────────────────────────
export interface LLMSettings {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
  deploymentName?: string;
  maxTokens?: number;
  temperature?: number;
}

// ── Resolve LLM settings from org ────────────────────────────────────
export async function getLLMSettings(orgService: OrgService, orgId: string): Promise<LLMSettings> {
  const settings = await orgService.getRawSettings(orgId);

  const provider = (settings.llmProvider as LLMProvider) ?? 'anthropic';
  const model = (settings.llmModel as string) || config.ANTHROPIC_MODEL;
  const apiKey = (settings.llmApiKey as string) || config.ANTHROPIC_API_KEY;
  const endpoint = settings.llmEndpoint as string | undefined;
  const apiVersion = settings.llmApiVersion as string | undefined;
  const deploymentName = settings.llmDeploymentName as string | undefined;
  const maxTokens = settings.llmMaxTokens as number | undefined;
  const temperature = settings.llmTemperature as number | undefined;

  // Validate key requirement
  const providerDef = LLM_PROVIDERS.find((p) => p.id === provider);
  if (providerDef?.requiresKey && !apiKey) {
    throw new InternalError(
      `LLM service is not configured. Set your ${providerDef.label} API key in Settings → API Keys.`,
    );
  }

  if (provider === 'ollama' && !endpoint) {
    throw new InternalError('Ollama requires an endpoint URL. Configure it in Settings → API Keys.');
  }

  if (provider === 'azure-openai' && (!endpoint || !deploymentName)) {
    throw new InternalError('Azure OpenAI requires endpoint and deployment name. Configure in Settings → API Keys.');
  }

  return { provider, model, apiKey, endpoint, apiVersion, deploymentName, maxTokens, temperature };
}

// ── Provider-specific call implementations ───────────────────────────

async function callAnthropicProvider<T>(
  settings: LLMSettings,
  systemPrompt: string,
  userPrompt: string,
  tool: Anthropic.Tool,
): Promise<T> {
  const client = new Anthropic({ apiKey: settings.apiKey });
  const response = await client.messages.create({
    model: settings.model,
    max_tokens: settings.maxTokens ?? 4096,
    system: systemPrompt,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: userPrompt }],
  });

  const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new InternalError('Anthropic did not return a tool use response');
  }

  return toolUseBlock.input as T;
}

async function callOpenAICompatibleProvider<T>(
  settings: LLMSettings,
  systemPrompt: string,
  userPrompt: string,
  tool: Anthropic.Tool,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const isOllama = settings.provider === 'ollama';

  if (isOllama) {
    const jsonSchemaPrompt = `${systemPrompt}\n\nIMPORTANT: You MUST respond with ONLY valid JSON (no markdown, no explanation before/after). Use this exact schema:\n${JSON.stringify(tool.input_schema, null, 2)}`;

    const body = {
      model: settings.model,
      messages: [
        { role: 'system', content: jsonSchemaPrompt },
        { role: 'user', content: userPrompt },
      ],
      format: 'json',
      stream: false,
      options: { num_predict: settings.maxTokens ?? 4096, temperature: settings.temperature ?? 0.7 },
    };

    const ollamaURL = `${settings.endpoint ?? 'http://host.docker.internal:11434'}/api/chat`;
    const response = await fetch(ollamaURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalError(`Ollama API error (${response.status}): ${errorText.substring(0, 300)}`);
    }

    const json = await response.json() as { message?: { content: string } };
    const content = json.message?.content;
    if (!content) throw new InternalError('Ollama returned empty response');

    try {
      return JSON.parse(content);
    } catch {
      throw new InternalError(`Ollama returned invalid JSON: ${content.substring(0, 200)}`);
    }
  }

  // OpenAI / Azure OpenAI — use tool_use
  let baseURL: string;
  if (settings.provider === 'azure-openai') {
    const apiVersion = settings.apiVersion ?? '2024-02-01';
    baseURL = `${settings.endpoint}/openai/deployments/${settings.deploymentName}/chat/completions?api-version=${apiVersion}`;
    headers['api-key'] = settings.apiKey!;
  } else {
    baseURL = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  const openaiTool = {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.input_schema,
    },
  };

  const body = {
    model: settings.model,
    max_tokens: settings.maxTokens ?? 4096,
    temperature: settings.temperature ?? 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    tools: [openaiTool],
    tool_choice: { type: 'function', function: { name: tool.name } },
  };

  const response = await fetch(baseURL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new InternalError(`${settings.provider} API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const json = await response.json() as {
    choices: { message: { tool_calls?: { function: { arguments: string } }[] } }[];
  };

  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new InternalError(`${settings.provider} did not return a tool call response`);
  }

  return JSON.parse(toolCall.function.arguments);
}

// ── Main callLLM dispatch ────────────────────────────────────────────
export async function callLLM<T>(
  settings: LLMSettings,
  systemPrompt: string,
  userPrompt: string,
  tool: Anthropic.Tool,
): Promise<T> {
  try {
    if (settings.provider === 'anthropic') {
      return await callAnthropicProvider<T>(settings, systemPrompt, userPrompt, tool);
    } else {
      return await callOpenAICompatibleProvider<T>(settings, systemPrompt, userPrompt, tool);
    }
  } catch (error) {
    if (error instanceof InternalError) throw error;
    const errMsg = error instanceof Error ? error.message : 'Unknown LLM error';
    throw new InternalError(`LLM call failed (${settings.provider}): ${errMsg}`);
  }
}
