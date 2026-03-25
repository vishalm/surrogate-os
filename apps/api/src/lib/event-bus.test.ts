import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the class indirectly — we need fresh instances for isolation
// We test via the singleton for the export, but create isolated buses for unit tests
describe('EventBus', () => {
  // We re-import each time to get the singleton, but since we need isolation
  // we'll test the module's exported singleton and use off() for cleanup

  let eventBus: typeof import('./event-bus.js')['eventBus'];

  beforeEach(async () => {
    // Dynamic import to get the singleton; we rely on off() for cleanup
    const mod = await import('./event-bus.js');
    eventBus = mod.eventBus;
  });

  it('emits and receives typed events', () => {
    const handler = vi.fn();
    eventBus.on('surrogate.created', handler);

    const payload = { surrogateId: 's1', orgSlug: 'acme', userId: 'u1' };
    eventBus.emit('surrogate.created', payload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);

    eventBus.off('surrogate.created', handler);
  });

  it('delivers correct typed data for complex events', () => {
    const handler = vi.fn();
    eventBus.on('debrief.generated', handler);

    const payload = {
      debriefId: 'd1',
      sessionId: 'sess1',
      surrogateId: 's1',
      orgSlug: 'acme',
    };
    eventBus.emit('debrief.generated', payload);

    expect(handler).toHaveBeenCalledWith(payload);

    eventBus.off('debrief.generated', handler);
  });

  it('supports multiple listeners on the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    eventBus.on('sop.created', handler1);
    eventBus.on('sop.created', handler2);

    const payload = { sopId: 'sop1', surrogateId: 's1', orgSlug: 'acme' };
    eventBus.emit('sop.created', payload);

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();

    eventBus.off('sop.created', handler1);
    eventBus.off('sop.created', handler2);
  });

  it('once() fires only once', () => {
    const handler = vi.fn();
    eventBus.once('session.started', handler);

    const payload = { sessionId: 'sess1', surrogateId: 's1', orgSlug: 'acme' };
    eventBus.emit('session.started', payload);
    eventBus.emit('session.started', payload);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('off() removes a listener', () => {
    const handler = vi.fn();
    eventBus.on('execution.started', handler);
    eventBus.off('execution.started', handler);

    eventBus.emit('execution.started', {
      executionId: 'e1',
      surrogateId: 's1',
      orgSlug: 'acme',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('listenerCount returns the correct count', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const before = eventBus.listenerCount('proposal.created');
    eventBus.on('proposal.created', handler1);
    eventBus.on('proposal.created', handler2);

    expect(eventBus.listenerCount('proposal.created')).toBe(before + 2);

    eventBus.off('proposal.created', handler1);
    expect(eventBus.listenerCount('proposal.created')).toBe(before + 1);

    eventBus.off('proposal.created', handler2);
    expect(eventBus.listenerCount('proposal.created')).toBe(before);
  });

  it('events do not cross — emitting one event does not trigger another', () => {
    const sopHandler = vi.fn();
    const sessionHandler = vi.fn();

    eventBus.on('sop.certified', sopHandler);
    eventBus.on('session.completed', sessionHandler);

    eventBus.emit('sop.certified', { sopId: 'sop1', surrogateId: 's1', orgSlug: 'acme' });

    expect(sopHandler).toHaveBeenCalledOnce();
    expect(sessionHandler).not.toHaveBeenCalled();

    eventBus.off('sop.certified', sopHandler);
    eventBus.off('session.completed', sessionHandler);
  });

  it('handles nullable fields in event data', () => {
    const handler = vi.fn();
    eventBus.on('bias.checked', handler);

    const payload = { checkId: 'c1', surrogateId: null, orgSlug: 'acme' };
    eventBus.emit('bias.checked', payload);

    expect(handler).toHaveBeenCalledWith(payload);
    expect(handler.mock.calls[0][0].surrogateId).toBeNull();

    eventBus.off('bias.checked', handler);
  });
});
