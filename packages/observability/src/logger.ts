import pino from 'pino';
import { trace, context } from '@opentelemetry/api';

export type Logger = pino.Logger;

export function createLogger(
  serviceName: string,
  options?: { level?: string },
): Logger {
  return pino({
    name: serviceName,
    level: options?.level ?? 'info',
    formatters: {
      level(label: string) {
        return { level: label };
      },
      log(object: Record<string, unknown>) {
        const span = trace.getSpan(context.active());
        if (span) {
          const spanContext = span.spanContext();
          return {
            ...object,
            traceId: spanContext.traceId,
            spanId: spanContext.spanId,
          };
        }
        return object;
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
