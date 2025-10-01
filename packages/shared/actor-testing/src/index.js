/**
 * @legion/actor-testing
 *
 * Comprehensive testing framework for Actor-based systems.
 * Provides mocks, harnesses, utilities, and protocol testing.
 */

// Mocks
export { MockWebSocket, CloseEvent } from './mocks/MockWebSocket.js';

// Harness
export { ActorTestHarness } from './harness/ActorTestHarness.js';

// Utilities
export { JSDOMEnvironment } from './utils/JSDOMEnvironment.js';
export { TestDataGenerator } from './utils/TestDataGenerator.js';

// Protocol Testing
export { ProtocolTestSuite } from './ProtocolTestSuite.js';

// Re-export for convenience
export * from './mocks/index.js';
export * from './harness/index.js';
export * from './utils/index.js';
