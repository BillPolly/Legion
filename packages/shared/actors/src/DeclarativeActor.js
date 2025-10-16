/**
 * DeclarativeActor - Protocol-based actors for frontend and backend
 *
 * Actors defined via JSON configuration instead of classes.
 * Works on both frontend (UI state) and backend (services).
 */

import { Actor } from './Actor.js';

export class DeclarativeActor extends Actor {
  constructor(protocol) {
    super();
    this.protocol = protocol;
    this.state = this._initializeState(protocol.state || {});
  }

  _initializeState(stateConfig) {
    const state = {};
    for (const [key, config] of Object.entries(stateConfig.schema || {})) {
      state[key] = config.default !== undefined ? config.default : null;
    }
    return state;
  }

  async receive(messageType, data) {
    const messageSpec = this.protocol.messages?.receives?.[messageType];
    if (!messageSpec) {
      throw new Error(`Unknown message type: ${messageType}`);
    }

    // Execute action if specified
    if (messageSpec.action) {
      await this._executeAction(messageSpec.action, data);
    }

    // Return result if specified
    if (messageSpec.returns) {
      return this._evaluateExpression(messageSpec.returns, data);
    }
  }

  _executeAction(actionString, data) {
    const fn = new Function('state', 'data', actionString);
    return fn(this.state, data);
  }

  _evaluateExpression(expression, data) {
    const fn = new Function('state', 'data', `return ${expression}`);
    return fn(this.state, data);
  }

  getProtocol() {
    return this.protocol;
  }
}
