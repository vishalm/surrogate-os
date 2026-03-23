// Initialize observability BEFORE any other imports
import {
  initTracer,
  initMetrics,
  createLogger,
  observabilityPlugin,
} from '@surrogate-os/observability';
import { config } from './config/index.js';

const SERVICE_NAME = 'surrogate-os-api';

// Init tracing and metrics early
initTracer(SERVICE_NAME, `${config.OTEL_ENDPOINT}/v1/traces`);
initMetrics(SERVICE_NAME, `${config.OTEL_ENDPOINT}/v1/metrics`);

const logger = createLogger(SERVICE_NAME, { level: config.LOG_LEVEL });

// Now import everything else
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './lib/errors.js';
import { authPlugin } from './middleware/auth.js';
import { TenantManager } from './tenancy/tenant-manager.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { orgRoutes } from './modules/orgs/orgs.routes.js';
import { surrogateRoutes } from './modules/surrogates/surrogates.routes.js';
import { sopRoutes } from './modules/sops/sops.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { statsRoutes } from './modules/stats/stats.routes.js';
import { llmRoutes } from './modules/llm/llm.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const prisma = new PrismaClient({
    datasourceUrl: config.DATABASE_URL,
  });

  const tenantManager = new TenantManager(prisma);

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Set custom error handler
  app.setErrorHandler(errorHandler);

  // Register core plugins
  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Surrogate OS API',
        description: 'API for Surrogate OS — professional surrogate management platform',
        version: '0.1.0',
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Register observability middleware
  await app.register(observabilityPlugin, {
    serviceName: SERVICE_NAME,
    logLevel: config.LOG_LEVEL as 'info' | 'debug' | 'warn' | 'error' | 'fatal' | 'trace' | 'silent',
  });

  // Register auth plugin (decorates requests)
  await app.register(authPlugin, { prisma });

  // Decorate request with tenant (default null)
  if (!app.hasRequestDecorator('tenant')) {
    app.decorateRequest('tenant', null);
  }

  // Health check route
  app.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Register route modules under /api/v1
  await app.register(
    async (apiV1) => {
      await apiV1.register(authRoutes, {
        prefix: '/auth',
        prisma,
        tenantManager,
      });
      await apiV1.register(orgRoutes, {
        prefix: '/orgs',
        prisma,
      });
      await apiV1.register(surrogateRoutes, {
        prefix: '/surrogates',
        prisma,
        tenantManager,
      });
      await apiV1.register(sopRoutes, {
        prefix: '/sops',
        prisma,
        tenantManager,
      });
      await apiV1.register(auditRoutes, {
        prefix: '/audit',
        prisma,
        tenantManager,
      });
      await apiV1.register(statsRoutes, {
        prefix: '/stats',
        prisma,
        tenantManager,
      });
      await apiV1.register(llmRoutes, {
        prefix: '/llm',
        prisma,
        tenantManager,
      });
    },
    { prefix: '/api/v1' },
  );

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, closing gracefully...');
    try {
      await app.close();
      await prisma.$disconnect();
      logger.info('Server shut down gracefully');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return app;
}

// Start the server if this file is run directly
async function main() {
  try {
    const app = await buildApp();
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(
      { port: config.PORT, host: config.HOST },
      `Surrogate OS API server listening on ${config.HOST}:${config.PORT}`,
    );
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

main();
