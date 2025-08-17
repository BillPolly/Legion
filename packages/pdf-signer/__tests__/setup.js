// Test setup file for pdf-signer
import { jest } from '@jest/globals';

// Set up global test utilities
global.testTimeout = 10000;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  // Keep log and info for debugging
  log: console.log,
  info: console.info
};

// Add custom matchers if needed
expect.extend({
  toBeValidPDF(received) {
    const pass = received && 
                 received instanceof Uint8Array && 
                 received.length > 0 &&
                 received[0] === 0x25 && // %
                 received[1] === 0x50 && // P
                 received[2] === 0x44 && // D
                 received[3] === 0x46;   // F
    
    return {
      pass,
      message: () => pass 
        ? `expected ${received} not to be a valid PDF`
        : `expected ${received} to be a valid PDF (should start with %PDF)`
    };
  },
  
  toBeValidBase64Image(received) {
    const pass = typeof received === 'string' &&
                 received.startsWith('data:image/') &&
                 received.includes('base64,');
    
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid base64 image`
        : `expected ${received} to be a valid base64 image`
    };
  }
});

// Setup for handling async errors
process.on('unhandledRejection', (err) => {
  throw err;
});