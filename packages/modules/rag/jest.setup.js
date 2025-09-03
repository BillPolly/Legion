// Global test setup for semantic search module
import { jest } from '@jest/globals';

// Increase timeout for all tests to handle LLM integration
jest.setTimeout(60000);

// Set max listeners to avoid warnings
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 20;

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Suppress console warnings for cleaner test output
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  
  // Suppress known warnings
  if (message.includes('MaxListenersExceededWarning') ||
      message.includes('ExperimentalWarning') ||
      message.includes('Failed to load tool for')) {
    return;
  }
  
  originalWarn.apply(console, args);
};