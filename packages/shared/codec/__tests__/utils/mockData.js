/**
 * Mock data generators for testing various scenarios
 */

/**
 * Generate random test data for performance and stress testing
 */
export class MockDataGenerator {
  constructor() {
    this.messageIdCounter = 0;
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Generate a random string of specified length
   */
  generateRandomString(length = 10) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a random email address
   */
  generateRandomEmail() {
    const username = this.generateRandomString(8);
    const domain = this.generateRandomString(6);
    return `${username}@${domain}.com`;
  }

  /**
   * Generate random message data for a given schema
   */
  generateMessageData(schemaId) {
    switch (schemaId) {
      case 'simple_message':
        return {
          content: this.generateRandomString(50)
        };

      case 'complex_message':
        return {
          user: {
            id: this.generateRandomString(12),
            username: this.generateRandomString(15),
            email: this.generateRandomEmail()
          },
          items: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => ({
            name: this.generateRandomString(10),
            value: Math.floor(Math.random() * 1000)
          }))
        };

      default:
        throw new Error(`Unknown schema ID: ${schemaId}`);
    }
  }

  /**
   * Generate a batch of test messages
   */
  generateMessageBatch(schemaId, count = 10) {
    return Array.from({ length: count }, () => this.generateMessageData(schemaId));
  }

  /**
   * Generate edge case test data
   */
  generateEdgeCases() {
    return {
      emptyString: '',
      veryLongString: this.generateRandomString(10000),
      specialCharacters: 'äöüß€@#$%^&*()[]{}|\\:";\'<>?,./`~',
      unicodeString: '🚀 Unicode test: αβγδε 中文 русский',
      nullValue: null,
      undefinedValue: undefined,
      emptyArray: [],
      emptyObject: {},
      nestedEmpty: { user: {}, items: [] }
    };
  }
}

/**
 * Pre-generated mock data for consistent testing
 */
export const mockData = {
  validUsers: [
    { id: 'user1', username: 'alice', email: 'alice@example.com' },
    { id: 'user2', username: 'bob', email: 'bob@example.com' },
    { id: 'user3', username: 'charlie', email: 'charlie@example.com' }
  ],

  validItems: [
    { name: 'item1', value: 100 },
    { name: 'item2', value: 200 },
    { name: 'item3', value: 300 }
  ],

  invalidEmails: [
    'not-an-email',
    '@example.com',
    'user@',
    'user.example.com',
    ''
  ],

  validTimestamps: [
    '2025-07-28T16:30:00.000Z',
    '2024-01-01T00:00:00.000Z',
    '2025-12-31T23:59:59.999Z'
  ],

  invalidTimestamps: [
    '2025-07-28',
    '16:30:00',
    'invalid-date',
    '2025-13-01T00:00:00.000Z', // Invalid month
    '2025-07-32T00:00:00.000Z', // Invalid day
    ''
  ]
};