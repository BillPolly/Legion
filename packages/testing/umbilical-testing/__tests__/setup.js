/**
 * Jest setup file for JSDOM environment
 */
import { jest } from '@jest/globals';

// Mock DOM methods that might not exist in JSDOM
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: jest.fn(),
  writable: true
});

// Mock getBoundingClientRect
Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
  value: jest.fn(() => ({
    width: 100,
    height: 100,
    top: 0,
    left: 0,
    bottom: 100,
    right: 100
  })),
  writable: true
});

// Global test utilities
global.createMockComponent = function(description) {
  return {
    describe: (descriptor) => {
      if (description.dependencies) {
        description.dependencies.forEach(dep => {
          if (dep.required) {
            descriptor.requires(dep.name, dep.type, dep.options);
          } else {
            descriptor.optional(dep.name, dep.type, dep.options);
          }
        });
      }
      
      if (description.domStructure) {
        description.domStructure.forEach(dom => {
          if (dom.type === 'creates') {
            descriptor.creates(dom.selector, dom.options);
          } else {
            descriptor.contains(dom.selector, dom.options);
          }
        });
      }
      
      if (description.events) {
        description.events.forEach(event => {
          if (event.type === 'emits') {
            descriptor.emits(event.name, event.payloadType, event.options);
          } else {
            descriptor.listens(event.name, event.payloadType, event.options);
          }
        });
      }
    }
  };
};