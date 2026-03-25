import { EventEmitter } from 'events';

// Define all platform events
export interface PlatformEvents {
  'surrogate.created': { surrogateId: string; orgSlug: string; userId: string };
  'surrogate.updated': { surrogateId: string; orgSlug: string; userId: string };
  'sop.created': { sopId: string; surrogateId: string; orgSlug: string };
  'sop.certified': { sopId: string; surrogateId: string; orgSlug: string };
  'session.started': { sessionId: string; surrogateId: string; orgSlug: string };
  'session.completed': { sessionId: string; surrogateId: string; orgSlug: string };
  'debrief.generated': {
    debriefId: string;
    sessionId: string;
    surrogateId: string;
    orgSlug: string;
  };
  'proposal.created': { proposalId: string; sopId: string; orgSlug: string };
  'proposal.approved': { proposalId: string; sopId: string; orgSlug: string };
  'execution.started': { executionId: string; surrogateId: string; orgSlug: string };
  'execution.completed': { executionId: string; surrogateId: string; orgSlug: string };
  'compliance.checked': {
    surrogateId: string;
    frameworkId: string;
    passed: boolean;
    orgSlug: string;
  };
  'handoff.initiated': { handoffId: string; sourceSurrogateId: string; orgSlug: string };
  'bias.checked': { checkId: string; surrogateId: string | null; orgSlug: string };
  'chat.message': { conversationId: string; surrogateId: string; orgSlug: string };
}

export type EventName = keyof PlatformEvents;

class TypedEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<E extends EventName>(event: E, data: PlatformEvents[E]): void {
    this.emitter.emit(event, data);
  }

  on<E extends EventName>(event: E, handler: (data: PlatformEvents[E]) => void): void {
    this.emitter.on(event, handler);
  }

  off<E extends EventName>(event: E, handler: (data: PlatformEvents[E]) => void): void {
    this.emitter.off(event, handler);
  }

  once<E extends EventName>(event: E, handler: (data: PlatformEvents[E]) => void): void {
    this.emitter.once(event, handler);
  }

  listenerCount(event: EventName): number {
    return this.emitter.listenerCount(event);
  }
}

// Singleton
export const eventBus = new TypedEventBus();
