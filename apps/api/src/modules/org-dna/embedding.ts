import { InternalError } from '../../lib/errors.js';

export interface EmbeddingSettings {
  provider: string;
  model: string;
  apiKey: string;
  endpoint?: string;
}

/**
 * Split text into chunks of ~chunkSize tokens (approximate: 4 chars per token).
 * Each chunk overlaps by `overlap` tokens with the previous.
 * Does not split mid-word.
 */
export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 50,
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunkChars = chunkSize * 4;
  const overlapChars = overlap * 4;
  const stepChars = chunkChars - overlapChars;

  if (text.length <= chunkChars) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkChars, text.length);

    // Don't split mid-word: walk back to the last space
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start) {
        end = lastSpace;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move forward by step, but also snap to a word boundary
    let nextStart = start + stepChars;
    if (nextStart < text.length && nextStart > 0) {
      const nextSpace = text.indexOf(' ', nextStart);
      if (nextSpace !== -1 && nextSpace < nextStart + overlapChars) {
        nextStart = nextSpace + 1;
      }
    }

    // Avoid infinite loop if no progress
    if (nextStart <= start) {
      nextStart = end;
    }

    start = nextStart;
  }

  return chunks;
}

/**
 * Generate an embedding vector for the given text using the configured provider.
 */
export async function generateEmbedding(
  settings: EmbeddingSettings,
  text: string,
): Promise<number[]> {
  try {
    switch (settings.provider) {
      case 'openai':
        return await generateOpenAIEmbedding(settings, text);
      case 'azure-openai':
        return await generateAzureOpenAIEmbedding(settings, text);
      case 'ollama':
        return await generateOllamaEmbedding(settings, text);
      default:
        throw new InternalError(`Unsupported embedding provider: ${settings.provider}`);
    }
  } catch (error) {
    if (error instanceof InternalError) throw error;
    throw new InternalError(`Embedding generation failed: ${(error as Error).message}`);
  }
}

async function generateOpenAIEmbedding(
  settings: EmbeddingSettings,
  text: string,
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      input: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new InternalError(`OpenAI embedding request failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return json.data[0].embedding;
}

async function generateAzureOpenAIEmbedding(
  settings: EmbeddingSettings,
  text: string,
): Promise<number[]> {
  const endpoint = settings.endpoint;
  if (!endpoint) {
    throw new InternalError('Azure OpenAI endpoint is required');
  }

  const url = `${endpoint}/openai/deployments/${settings.model}/embeddings?api-version=2024-02-01`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': settings.apiKey,
    },
    body: JSON.stringify({
      input: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new InternalError(`Azure OpenAI embedding request failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return json.data[0].embedding;
}

async function generateOllamaEmbedding(
  settings: EmbeddingSettings,
  text: string,
): Promise<number[]> {
  const endpoint = settings.endpoint ?? 'http://localhost:11434';

  const response = await fetch(`${endpoint}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      prompt: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new InternalError(`Ollama embedding request failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return json.embedding;
}
