import {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginCallback,
} from 'fastify';
import fp from 'fastify-plugin';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { getMetrics } from './metrics';
import { createLogger, Logger } from './logger';

declare module 'fastify' {
  interface FastifyRequest {
    traceId: string;
    spanId: string;
  }
}

interface ObservabilityPluginOptions {
  serviceName: string;
  logLevel?: string;
}

const observabilityPluginCallback: FastifyPluginCallback<
  ObservabilityPluginOptions
> = (fastify: FastifyInstance, opts, done) => {
  const logger: Logger = createLogger(opts.serviceName, {
    level: opts.logLevel,
  });

  fastify.decorateRequest('traceId', '');
  fastify.decorateRequest('spanId', '');

  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const tracer = trace.getTracer(opts.serviceName);
      const span = tracer.startSpan(`${request.method} ${request.url}`);
      const spanContext = span.spanContext();

      request.traceId = spanContext.traceId;
      request.spanId = spanContext.spanId;

      // Store span in context for downstream use
      const ctx = trace.setSpan(context.active(), span);
      // Attach context to request for retrieval in later hooks
      (request as unknown as Record<string, unknown>).__otelContext = ctx;
      (request as unknown as Record<string, unknown>).__otelSpan = span;
      (request as unknown as Record<string, unknown>).__startTime = Date.now();
    },
  );

  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = (request as unknown as Record<string, unknown>).__startTime as
        | number
        | undefined;
      const span = (request as unknown as Record<string, unknown>).__otelSpan as
        | ReturnType<typeof trace.getTracer extends (...args: unknown[]) => infer R ? R : never>
        | undefined;

      const duration = startTime ? Date.now() - startTime : 0;

      try {
        const metricsInstance = getMetrics();
        metricsInstance.apiRequestDuration.record(duration, {
          method: request.method,
          route: request.url,
          status: String(reply.statusCode),
        });
      } catch {
        // Metrics not initialized, skip recording
      }

      logger.info({
        msg: 'request completed',
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: duration,
        traceId: request.traceId,
        spanId: request.spanId,
      });

      if (span && typeof (span as Record<string, unknown>).end === 'function') {
        (span as { end: () => void }).end();
      }
    },
  );

  fastify.addHook(
    'onError',
    async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
      const span = (request as unknown as Record<string, unknown>).__otelSpan as
        | { setStatus: (status: { code: number; message: string }) => void; recordException: (err: Error) => void }
        | undefined;

      if (span) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
      }

      logger.error({
        msg: 'request error',
        method: request.method,
        url: request.url,
        error: error.message,
        stack: error.stack,
        traceId: request.traceId,
        spanId: request.spanId,
      });
    },
  );

  done();
};

export const observabilityPlugin = fp(observabilityPluginCallback, {
  name: 'observability',
  fastify: '5.x',
});
