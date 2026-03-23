import { trace, Tracer } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://localhost:4318/v1/traces';

let tracerProvider: NodeTracerProvider | null = null;

export function initTracer(
  serviceName: string,
  otlpEndpoint?: string,
): NodeTracerProvider {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  });

  const exporter = new OTLPTraceExporter({
    url: otlpEndpoint ?? DEFAULT_OTLP_TRACES_ENDPOINT,
  });

  const provider = new NodeTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });

  provider.register();
  tracerProvider = provider;

  return provider;
}

export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}
