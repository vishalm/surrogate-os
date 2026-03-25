import type { PrismaClient } from '@prisma/client';
import type { TenantManager } from '../tenancy/tenant-manager.js';

/**
 * Lightweight service registry — pure TypeScript dependency injection container.
 *
 * Services are registered by name and resolved by name + type parameter.
 * No magic, no decorators, no external deps. Just a typed Map.
 *
 * Usage:
 *   const registry = createRegistry(prisma, tenantManager);
 *   registry.register('OrgService', new OrgService(prisma));
 *   const orgService = registry.resolve<OrgService>('OrgService');
 */
export class ServiceRegistry {
  private readonly instances = new Map<string, unknown>();

  constructor(
    public readonly prisma: PrismaClient,
    public readonly tenantManager: TenantManager,
  ) {}

  /** Register a service instance by name. Overwrites if already registered. */
  register<T>(name: string, instance: T): void {
    this.instances.set(name, instance);
  }

  /** Resolve a service by name. Throws if not registered. */
  resolve<T>(name: string): T {
    const instance = this.instances.get(name);
    if (!instance) {
      throw new Error(`Service '${name}' not registered. Register it during app startup.`);
    }
    return instance as T;
  }

  /** Check whether a service is registered. */
  has(name: string): boolean {
    return this.instances.has(name);
  }

  /** Remove all registered services (useful for tests). */
  clear(): void {
    this.instances.clear();
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton for convenient access from anywhere in the app.
// ---------------------------------------------------------------------------

let _registry: ServiceRegistry | null = null;

/** Create the singleton registry. Call once during app startup. */
export function createRegistry(prisma: PrismaClient, tenantManager: TenantManager): ServiceRegistry {
  _registry = new ServiceRegistry(prisma, tenantManager);
  return _registry;
}

/** Retrieve the singleton registry. Throws if not yet created. */
export function getRegistry(): ServiceRegistry {
  if (!_registry) {
    throw new Error('ServiceRegistry not initialized. Call createRegistry() first.');
  }
  return _registry;
}

/** Reset the singleton (for tests only). */
export function resetRegistry(): void {
  _registry = null;
}
