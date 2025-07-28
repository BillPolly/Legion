/**
 * Test setup verification
 */

import { createTestSchemas, createTestData } from './utils/testUtils.js';
import { MockDataGenerator, mockData } from './utils/mockData.js';

describe('Test Setup', () => {
  test('global test utilities are available', () => {
    expect(global.expectError).toBeDefined();
    expect(global.expectSuccess).toBeDefined();
  });

  test('test utilities work correctly', () => {
    const schemas = createTestSchemas();
    expect(schemas.simpleMessage).toBeDefined();
    expect(schemas.simpleMessage.$id).toBe('simple_message');

    const data = createTestData();
    expect(data.simpleMessage).toBeDefined();
    expect(data.simpleMessage.content).toBeDefined();
  });

  test('mock data generator works', () => {
    const generator = new MockDataGenerator();
    const messageId = generator.generateMessageId();
    expect(messageId).toMatch(/^msg_\d+_\d+$/);

    const email = generator.generateRandomEmail();
    expect(email).toMatch(/^.+@.+\..+$/);
  });

  test('global expectSuccess utility works', () => {
    const successResult = { success: true, errors: [] };
    expect(() => global.expectSuccess(successResult)).not.toThrow();
  });

  test('global expectError utility works', () => {
    const errorResult = { success: false, errors: ['Test error'] };
    expect(() => global.expectError(errorResult)).not.toThrow();
    expect(() => global.expectError(errorResult, 'Test')).not.toThrow();
  });
});