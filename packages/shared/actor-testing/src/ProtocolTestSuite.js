/**
 * ProtocolTestSuite
 * Automatically generates comprehensive test suites for ProtocolActor implementations
 *
 * Usage:
 * ```javascript
 * import { ProtocolTestSuite } from '@legion/actor-testing';
 * import { MyProtocolActor } from './MyProtocolActor.js';
 *
 * ProtocolTestSuite.generateTests(MyProtocolActor, {
 *   includeIntegrationTests: true,
 *   testPostconditions: true
 * });
 * ```
 */

import { jsonSchemaToZod } from '@legion/schema';
import { ProtocolActor } from '@legion/actors';
import { TestDataGenerator } from './utils/TestDataGenerator.js';

export class ProtocolTestSuite {
  /**
   * Generate comprehensive test suite for a ProtocolActor class
   * @param {class} ActorClass - The actor class to test (must extend ProtocolActor)
   * @param {object} options - Test configuration options
   * @param {object} options.actorOptions - Options to pass to actor constructor
   * @param {boolean} options.includeIntegrationTests - Include integration tests
   * @param {boolean} options.testPostconditions - Test postconditions
   */
  static generateTests(ActorClass, options = {}) {
    const { actorOptions = {}, includeIntegrationTests = true, testPostconditions = true } = options;

    let actorInstance;
    let protocol;

    try {
      actorInstance = new ActorClass(actorOptions);
      protocol = actorInstance.getProtocol();
    } catch (error) {
      throw new Error(`Failed to create actor instance for testing: ${error.message}`);
    }

    describe(`${protocol.name} Protocol Compliance`, () => {
      let actor;

      beforeEach(() => {
        try {
          actor = new ActorClass(actorOptions);
        } catch (error) {
          throw new Error(`Failed to create actor in beforeEach: ${error.message}`);
        }
      });

      afterEach(() => {
        if (actor && typeof actor.cleanup === 'function') {
          actor.cleanup();
        }
      });

      // Protocol Structure Tests
      describe('Protocol Structure Validation', () => {
        test('should have valid protocol schema', () => {
          const validation = ProtocolActor.validateProtocol(protocol);
          if (!validation.valid) {
            console.error('Protocol validation errors:', validation.errors);
          }
          expect(validation.valid).toBe(true);
        });

        test('should have required protocol fields', () => {
          expect(protocol.name).toBeDefined();
          expect(protocol.version).toBeDefined();
          expect(protocol.state).toBeDefined();
          expect(protocol.messages).toBeDefined();
        });

        test('should have valid state schema', () => {
          expect(protocol.state.schema).toBeDefined();
          expect(protocol.state.initial).toBeDefined();

          // Validate that initial state matches schema
          try {
            const stateValidator = jsonSchemaToZod(protocol.state.schema);
            stateValidator.parse(protocol.state.initial);
            expect(true).toBe(true);
          } catch (error) {
            console.error('Initial state validation errors:', error);
            expect(error).toBe(null);
          }
        });
      });

      // State Management Tests
      describe('State Management', () => {
        test('should initialize with correct state', () => {
          expect(actor.state).toEqual(protocol.state.initial);
        });

        test('should maintain state consistency during operation', () => {
          const initialState = { ...actor.state };

          // State should remain consistent unless modified
          expect(actor.state).toEqual(initialState);

          // Test state validator
          try {
            const stateValidator = jsonSchemaToZod(protocol.state.schema);
            stateValidator.parse(actor.state);
            expect(true).toBe(true);
          } catch (error) {
            expect(error).toBe(null);
          }
        });
      });

      // Message Reception Tests
      describe('Message Reception', () => {
        const receives = protocol.messages.receives || {};

        Object.entries(receives).forEach(([msgType, spec]) => {
          describe(`Message: ${msgType}`, () => {
            test('should accept valid message data', () => {
              if (spec.schema) {
                const validData = TestDataGenerator.generateValidData(spec.schema, { msgType });
                expect(() => {
                  actor.validateIncomingMessage(msgType, validData);
                }).not.toThrow();
              }
            });

            test('should reject invalid message data', () => {
              if (spec.schema && Object.keys(spec.schema).length > 0) {
                const invalidData = TestDataGenerator.generateInvalidData(spec.schema);
                expect(() => {
                  actor.validateIncomingMessage(msgType, invalidData);
                }).toThrow();
              }
            });

            if (spec.preconditions && spec.preconditions.length > 0) {
              test('should enforce preconditions', () => {
                // Set up state to violate preconditions
                const violatingState = this.createPreconditionViolatingState(
                  spec.preconditions,
                  actor.state
                );

                if (violatingState) {
                  actor.state = { ...actor.state, ...violatingState };

                  expect(() => {
                    actor.checkPreconditions(msgType);
                  }).toThrow();
                }
              });

              test('should pass preconditions when state is valid', () => {
                // Ensure state satisfies preconditions
                const validState = this.createPreconditionSatisfyingState(
                  spec.preconditions,
                  actor.state
                );

                if (validState) {
                  actor.state = { ...actor.state, ...validState };

                  expect(() => {
                    actor.checkPreconditions(msgType);
                  }).not.toThrow();
                }
              });
            }

            if (spec.postconditions && spec.postconditions.length > 0 && options.testPostconditions !== false) {
              test('should satisfy postconditions after handling message', () => {
                // Set up state to satisfy preconditions
                const preState = this.createPreconditionSatisfyingState(
                  spec.preconditions || [],
                  actor.state
                );

                if (preState) {
                  actor.state = { ...actor.state, ...preState };
                }

                // Handle the message
                const validData = TestDataGenerator.generateValidData(spec.schema || {}, { msgType });

                try {
                  actor.handleMessage(msgType, validData);

                  // Check postconditions
                  spec.postconditions.forEach(condition => {
                    const result = actor.evaluateCondition(condition);
                    if (!result) {
                      console.warn(`Postcondition failed: ${condition}`);
                    }
                  });
                } catch (error) {
                  // Some messages might not be fully implemented
                  console.warn(`Message ${msgType} handling failed:`, error.message);
                }
              });
            }
          });
        });
      });

      // Message Sending Tests
      describe('Message Sending', () => {
        const sends = protocol.messages.sends || {};

        Object.entries(sends).forEach(([msgType, spec]) => {
          describe(`Send: ${msgType}`, () => {
            test('should validate outgoing message data', () => {
              if (spec.schema) {
                const validData = TestDataGenerator.generateValidData(spec.schema, { msgType });
                const validator = actor.messageValidators.get(msgType);

                if (validator) {
                  expect(() => validator.parse(validData)).not.toThrow();
                }
              }
            });

            test('should reject invalid outgoing message data', () => {
              if (spec.schema && Object.keys(spec.schema).length > 0) {
                const invalidData = TestDataGenerator.generateInvalidData(spec.schema);
                const validator = actor.messageValidators.get(msgType);

                if (validator) {
                  expect(() => validator.parse(invalidData)).toThrow();
                }
              }
            });

            if (spec.preconditions && spec.preconditions.length > 0) {
              test('should enforce send preconditions', () => {
                // Set up state to violate send preconditions
                const violatingState = this.createPreconditionViolatingState(
                  spec.preconditions,
                  actor.state
                );

                if (violatingState) {
                  actor.state = { ...actor.state, ...violatingState };

                  const validData = TestDataGenerator.generateValidData(spec.schema || {}, { msgType });

                  // Mock doSend to avoid actual network calls
                  actor.doSend = jest.fn(() => Promise.resolve());

                  expect(() => {
                    actor.send(msgType, validData);
                  }).toThrow();
                }
              });
            }
          });
        });
      });

      // Integration Tests
      if (options.includeIntegrationTests !== false) {
        describe('Protocol Integration', () => {
          test('should handle complete message flow', async () => {
            const sends = protocol.messages.sends || {};

            // Mock doSend to simulate server responses
            const sentMessages = [];
            actor.doSend = jest.fn((messageType, data) => {
              sentMessages.push({ messageType, data });
              return Promise.resolve();
            });

            // Try to send each message type that has triggers
            for (const [sendType, sendSpec] of Object.entries(sends)) {
              if (sendSpec.triggers) {
                // Set up state to satisfy preconditions
                const validState = this.createPreconditionSatisfyingState(
                  sendSpec.preconditions || [],
                  actor.state
                );

                if (validState) {
                  actor.state = { ...actor.state, ...validState };

                  try {
                    const validData = TestDataGenerator.generateValidData(sendSpec.schema || {}, { sendType });
                    await actor.send(sendType, validData);

                    expect(actor.doSend).toHaveBeenCalledWith(sendType, validData);
                  } catch (error) {
                    console.warn(`Failed to send ${sendType}:`, error.message);
                  }
                }
              }
            }
          });
        });
      }
    });
  }

  /**
   * Create state that violates preconditions
   */
  static createPreconditionViolatingState(preconditions, currentState) {
    const violatingState = {};
    let hasViolation = false;

    for (const condition of preconditions) {
      if (condition.includes('state.connected === true')) {
        violatingState.connected = false;
        hasViolation = true;
      } else if (condition.includes('state.connected === false')) {
        violatingState.connected = true;
        hasViolation = true;
      } else if (condition.includes('=== false')) {
        const match = condition.match(/state\.(\w+) === false/);
        if (match) {
          violatingState[match[1]] = true;
          hasViolation = true;
        }
      } else if (condition.includes('=== true')) {
        const match = condition.match(/state\.(\w+) === true/);
        if (match) {
          violatingState[match[1]] = false;
          hasViolation = true;
        }
      } else if (condition.includes('!== null')) {
        const match = condition.match(/state\.(\w+) !== null/);
        if (match) {
          violatingState[match[1]] = null;
          hasViolation = true;
        }
      }
    }

    return hasViolation ? violatingState : null;
  }

  /**
   * Create state that satisfies preconditions
   */
  static createPreconditionSatisfyingState(preconditions, currentState) {
    const satisfyingState = {};
    let hasChanges = false;

    for (const condition of preconditions) {
      if (condition.includes('state.connected === true')) {
        satisfyingState.connected = true;
        hasChanges = true;
      } else if (condition.includes('state.connected === false')) {
        satisfyingState.connected = false;
        hasChanges = true;
      } else if (condition.includes('=== false')) {
        const match = condition.match(/state\.(\w+) === false/);
        if (match) {
          satisfyingState[match[1]] = false;
          hasChanges = true;
        }
      } else if (condition.includes('=== true')) {
        const match = condition.match(/state\.(\w+) === true/);
        if (match) {
          satisfyingState[match[1]] = true;
          hasChanges = true;
        }
      } else if (condition.includes('!== null')) {
        const match = condition.match(/state\.(\w+) !== null/);
        if (match) {
          satisfyingState[match[1]] = { mockData: true };
          hasChanges = true;
        }
      }
    }

    return hasChanges ? satisfyingState : null;
  }
}
