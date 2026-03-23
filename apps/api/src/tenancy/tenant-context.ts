import type { FastifyRequest } from 'fastify';

export interface TenantContext {
  orgId: string;
  orgSlug: string;
  schemaName: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant: TenantContext | null;
  }
}

export function getTenantContext(request: FastifyRequest): TenantContext {
  if (!request.tenant) {
    throw new Error('Tenant context not available on this request');
  }
  return request.tenant;
}
