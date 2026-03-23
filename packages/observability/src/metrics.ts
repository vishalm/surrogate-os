import {
  metrics,
  Counter,
  Histogram,
  UpDownCounter,
} from '@opentelemetry/api';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const DEFAULT_OTLP_METRICS_ENDPOINT = 'http://localhost:4318/v1/metrics';

export interface SurrogateMetrics {
  surrogateInvocations: Counter;
  sopTraversals: Counter;
  auditEntries: Counter;
  activeTenants: UpDownCounter;
  apiRequestDuration: Histogram;
}

let metricInstruments: SurrogateMetrics | null = null;

export function initMetrics(
  serviceName: string,
  otlpEndpoint?: string,
): MeterProvider {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  });

  const exporter = new OTLPMetricExporter({
    url: otlpEndpoint ?? DEFAULT_OTLP_METRICS_ENDPOINT,
  });

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: 30_000,
      }),
    ],
  });

  metrics.setGlobalMeterProvider(meterProvider);

  const meter = metrics.getMeter(serviceName);

  metricInstruments = {
    surrogateInvocations: meter.createCounter('surrogate.invocations', {
      description: 'Total number of surrogate invocations',
    }),
    sopTraversals: meter.createCounter('sop.traversals', {
      description: 'Total number of SOP graph traversals',
    }),
    auditEntries: meter.createCounter('audit.entries', {
      description: 'Total number of audit entries created',
    }),
    activeTenants: meter.createUpDownCounter('tenants.active', {
      description: 'Number of currently active tenants',
    }),
    apiRequestDuration: meter.createHistogram('api.request.duration', {
      description: 'API request duration in milliseconds',
      unit: 'ms',
    }),
  };

  return meterProvider;
}

export function getMetrics(): SurrogateMetrics {
  if (!metricInstruments) {
    throw new Error(
      'Metrics not initialized. Call initMetrics() before getMetrics().',
    );
  }
  return metricInstruments;
}
