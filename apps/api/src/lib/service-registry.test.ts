import { describe, it, expect, beforeEach } from 'vitest';
import {
  ServiceRegistry,
  createRegistry,
  getRegistry,
  resetRegistry,
} from './service-registry.js';

// Minimal stubs — we only need the shape, not real implementations.
const fakePrisma = {} as any;
const fakeTenantManager = {} as any;

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry(fakePrisma, fakeTenantManager);
  });

  it('stores prisma and tenantManager as public readonly properties', () => {
    expect(registry.prisma).toBe(fakePrisma);
    expect(registry.tenantManager).toBe(fakeTenantManager);
  });

  // ── register + resolve ──────────────────────────────────────────────

  it('registers and resolves a service by name', () => {
    const service = { doWork: () => 'done' };
    registry.register('MyService', service);
    expect(registry.resolve<typeof service>('MyService')).toBe(service);
  });

  it('resolves to the exact same instance (singleton behavior)', () => {
    const service = { id: 42 };
    registry.register('Singleton', service);
    const a = registry.resolve('Singleton');
    const b = registry.resolve('Singleton');
    expect(a).toBe(b);
  });

  // ── resolve unregistered ────────────────────────────────────────────

  it('throws when resolving a service that was never registered', () => {
    expect(() => registry.resolve('NonExistent')).toThrowError(
      "Service 'NonExistent' not registered. Register it during app startup.",
    );
  });

  // ── has() ───────────────────────────────────────────────────────────

  it('returns true for registered services', () => {
    registry.register('Foo', {});
    expect(registry.has('Foo')).toBe(true);
  });

  it('returns false for unregistered services', () => {
    expect(registry.has('Bar')).toBe(false);
  });

  // ── overwrite on re-register ────────────────────────────────────────

  it('overwrites a service when registered again with the same name', () => {
    const v1 = { version: 1 };
    const v2 = { version: 2 };
    registry.register('Versioned', v1);
    registry.register('Versioned', v2);
    expect(registry.resolve('Versioned')).toBe(v2);
  });

  // ── different types ─────────────────────────────────────────────────

  it('supports registering services of different types under different names', () => {
    const strService = 'hello';
    const numService = 123;
    const objService = { key: 'value' };

    registry.register('StringService', strService);
    registry.register('NumberService', numService);
    registry.register('ObjectService', objService);

    expect(registry.resolve<string>('StringService')).toBe('hello');
    expect(registry.resolve<number>('NumberService')).toBe(123);
    expect(registry.resolve<{ key: string }>('ObjectService')).toEqual({ key: 'value' });
  });

  // ── clear() ─────────────────────────────────────────────────────────

  it('removes all services on clear()', () => {
    registry.register('A', {});
    registry.register('B', {});
    registry.clear();
    expect(registry.has('A')).toBe(false);
    expect(registry.has('B')).toBe(false);
  });
});

// ── Module-level singleton helpers ──────────────────────────────────────

describe('createRegistry / getRegistry / resetRegistry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('createRegistry returns a ServiceRegistry and makes it the singleton', () => {
    const reg = createRegistry(fakePrisma, fakeTenantManager);
    expect(reg).toBeInstanceOf(ServiceRegistry);
    expect(getRegistry()).toBe(reg);
  });

  it('getRegistry throws before createRegistry is called', () => {
    expect(() => getRegistry()).toThrowError(
      'ServiceRegistry not initialized. Call createRegistry() first.',
    );
  });

  it('createRegistry replaces the previous singleton', () => {
    const reg1 = createRegistry(fakePrisma, fakeTenantManager);
    const reg2 = createRegistry(fakePrisma, fakeTenantManager);
    expect(reg1).not.toBe(reg2);
    expect(getRegistry()).toBe(reg2);
  });

  it('resetRegistry clears the singleton so getRegistry throws again', () => {
    createRegistry(fakePrisma, fakeTenantManager);
    resetRegistry();
    expect(() => getRegistry()).toThrowError();
  });
});
