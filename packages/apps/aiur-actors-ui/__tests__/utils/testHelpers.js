/**
 * Test utility helpers for Aiur Actors UI
 */
import { jest } from '@jest/globals';

/**
 * Create a mock ActorSpace for testing
 * @param {string} spaceId - Optional space ID
 * @returns {Object} Mock ActorSpace
 */
export function createMockActorSpace(spaceId = 'TestSpace') {
  const actors = new Map();
  const channels = new Map();
  
  return {
    spaceId,
    isActorSpace: true,
    actors,
    channels,
    
    register(actor, key) {
      actors.set(key, actor);
      actor._space = this;
    },
    
    getActor(key) {
      return actors.get(key);
    },
    
    addChannel(websocket) {
      const channel = {
        websocket,
        send: jest.fn(),
        close: jest.fn()
      };
      channels.set(websocket, channel);
      return channel;
    },
    
    encode: jest.fn((obj) => JSON.stringify(obj)),
    decode: jest.fn((str) => JSON.parse(str))
  };
}

/**
 * Create a mock Actor for testing
 * @param {Object} options - Actor options
 * @returns {Object} Mock Actor
 */
export function createMockActor(options = {}) {
  const receivedMessages = [];
  
  return {
    isActor: true,
    receivedMessages,
    
    receive(message) {
      receivedMessages.push(message);
      if (options.onReceive) {
        options.onReceive(message);
      }
    },
    
    reply: jest.fn(),
    forward: jest.fn()
  };
}

/**
 * Create a mock Umbilical for component testing
 * @param {Object} props - Umbilical properties
 * @returns {Object} Mock Umbilical
 */
export function createMockUmbilical(props = {}) {
  return {
    dom: props.dom || document.createElement('div'),
    theme: props.theme || 'light',
    onMount: props.onMount || jest.fn(),
    onDestroy: props.onDestroy || jest.fn(),
    onError: props.onError || jest.fn(),
    ...props
  };
}

/**
 * Wait for a condition to be true
 * @param {Function} condition - Function that returns boolean
 * @param {Object} options - Wait options
 * @returns {Promise} Resolves when condition is true
 */
export async function waitFor(condition, options = {}) {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 50;
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const checkCondition = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(checkCondition, interval);
      }
    };
    
    checkCondition();
  });
}

/**
 * Simulate WebSocket message
 * @param {WebSocket} ws - WebSocket instance
 * @param {*} data - Message data
 */
export function simulateWebSocketMessage(ws, data) {
  if (ws.simulateMessage) {
    ws.simulateMessage(data);
  } else if (ws.onmessage) {
    ws.onmessage({ type: 'message', data });
  }
}

/**
 * Create a mock component for testing
 * @param {string} name - Component name
 * @returns {Object} Mock component
 */
export function createMockComponent(name) {
  return {
    name,
    destroyed: false,
    
    create(umbilical) {
      if (umbilical.describe) {
        umbilical.describe({
          getAll: () => ({ dom: { type: 'HTMLElement' } })
        });
        return;
      }
      
      if (umbilical.validate) {
        return umbilical.validate({ hasDom: !!umbilical.dom });
      }
      
      return {
        destroy: jest.fn(() => { this.destroyed = true; }),
        render: jest.fn(),
        updateConfig: jest.fn()
      };
    }
  };
}

/**
 * Flush promises in tests
 * @returns {Promise} Resolves after next tick
 */
export function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}