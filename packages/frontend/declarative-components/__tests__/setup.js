/**
 * Jest setup file - runs before all tests
 */

import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

// Make Jest globals available
global.jest = jest;

// Polyfill TextEncoder/TextDecoder for jsdom
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill setImmediate for jsdom environment
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (fn) => setTimeout(fn, 0);
}

// Polyfill clearImmediate
if (typeof clearImmediate === 'undefined') {
  global.clearImmediate = (id) => clearTimeout(id);
}