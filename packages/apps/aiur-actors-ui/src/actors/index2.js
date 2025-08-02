/**
 * Actor exports
 * 
 * Provides both base classes and ready-to-use actor implementations
 */

// Base class for all actors
export { BaseActor } from './BaseActor.js';

// Original actors (will be deprecated)
export { ClientCommandActor } from './ClientCommandActor.js';
export { UIUpdateActor } from './UIUpdateActor.js';

// New actors that inherit from BaseActor
export { ClientCommandActor as ClientCommandActor2 } from './ClientCommandActor2.js';
export { UIUpdateActor as UIUpdateActor2 } from './UIUpdateActor2.js';

// Simple actors for specific purposes
export { 
  ToolsActor, 
  TerminalActor, 
  SessionActor, 
  VariablesActor,
  createSimpleActor 
} from './SimpleActors.js';

// Re-export other existing actors
export { ActorMessage } from './ActorMessage.js';
export { AiurBridgeActor } from './AiurBridgeActor.js';
export { ClientActorSpace } from './ClientActorSpace.js';
export { ClientChannel } from './ClientChannel.js';
export { SessionManagerActor } from './SessionManagerActor.js';