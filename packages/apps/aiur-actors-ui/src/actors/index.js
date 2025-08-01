/**
 * Actor system exports
 */
import { ClientActorSpace } from './ClientActorSpace.js';
import { ClientChannel } from './ClientChannel.js';
import { ClientCommandActor } from './ClientCommandActor.js';
import { UIUpdateActor } from './UIUpdateActor.js';

// Initialize ClientChannel reference to avoid circular dependency
ClientActorSpace.prototype._ClientChannel = ClientChannel;

export {
  ClientActorSpace,
  ClientChannel,
  ClientCommandActor,
  UIUpdateActor
};