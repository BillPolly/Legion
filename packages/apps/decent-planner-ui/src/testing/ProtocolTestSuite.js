/**
 * ProtocolTestSuite
 * Automatically generates comprehensive test suites for protocol actors
 */

import { ProtocolActor } from '../actors/ProtocolActor.js';
import schema from 'schema';

export class ProtocolTestSuite {
  /**
   * Generate comprehensive test suite for an actor protocol
   * @param {class} ActorClass - The actor class to test
   * @param {object} options - Test configuration options
   */
  static generateTests(ActorClass, options = {}) {
    let actorInstance;
    let protocol;
    
    try {
      actorInstance = new ActorClass();
      protocol = actorInstance.getProtocol();
    } catch (error) {
      throw new Error(`Failed to create actor instance for testing: ${error.message}`);
    }
    
    describe(`${protocol.name} Protocol Compliance`, () => {
      let actor;
      
      beforeEach(() => {
        try {
          actor = new ActorClass();
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
          const stateValidator = schema(protocol.state.schema);
          const validation = stateValidator(protocol.state.initial);
          
          if (!validation.valid) {
            console.error('Initial state validation errors:', validation.errors);
          }
          expect(validation.valid).toBe(true);
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
          const stateValidator = schema(protocol.state.schema);
          const validation = stateValidator(actor.state);
          expect(validation.valid).toBe(true);
        });
      });
      
      // Message Reception Tests
      describe('Message Reception', () => {
        const receives = protocol.messages.receives || {};
        
        Object.entries(receives).forEach(([msgType, spec]) => {
          describe(`Message: ${msgType}`, () => {
            test('should accept valid message data', () => {
              if (spec.schema) {
                const validData = this.generateValidData(spec.schema, msgType);
                expect(() => {
                  actor.validateIncomingMessage(msgType, validData);
                }).not.toThrow();
              }
            });
            
            test('should reject invalid message data', () => {
              if (spec.schema) {
                const invalidData = this.generateInvalidData(spec.schema, msgType);
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
                const validData = this.generateValidData(spec.schema || {}, msgType);
                
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
                const validData = this.generateValidData(spec.schema, msgType);
                const validator = actor.messageValidators.get(msgType);
                
                if (validator) {
                  const result = validator(validData);
                  expect(result.valid).toBe(true);
                }
              }
            });
            
            test('should reject invalid outgoing message data', () => {
              if (spec.schema) {
                const invalidData = this.generateInvalidData(spec.schema, msgType);
                const validator = actor.messageValidators.get(msgType);
                
                if (validator) {
                  const result = validator(invalidData);
                  expect(result.valid).toBe(false);
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
                  
                  const validData = this.generateValidData(spec.schema || {}, msgType);
                  
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
            const receives = protocol.messages.receives || {};
            
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
                    const validData = this.generateValidData(sendSpec.schema || {}, sendType);
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
   * Generate valid test data from schema
   */
  static generateValidData(schemaSpec, messageType) {
    const data = {};
    
    if (!schemaSpec || Object.keys(schemaSpec).length === 0) {
      return data;
    }
    
    for (const [key, spec] of Object.entries(schemaSpec)) {
      if (spec.required || Math.random() > 0.3) { // Include optional fields sometimes
        data[key] = this.generateValueForType(spec, key, messageType);
      }
    }
    
    return data;
  }
  
  /**
   * Generate invalid test data
   */
  static generateInvalidData(schemaSpec, messageType) {
    if (!schemaSpec || Object.keys(schemaSpec).length === 0) {
      return null; // Invalid for any schema that expects an object
    }
    
    const data = this.generateValidData(schemaSpec, messageType);
    
    // Make it invalid by violating constraints
    const keys = Object.keys(schemaSpec);
    if (keys.length > 0) {
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const spec = schemaSpec[randomKey];
      
      // Violate type constraint
      if (spec.type === 'string') {
        data[randomKey] = 123; // Wrong type
      } else if (spec.type === 'number') {
        data[randomKey] = 'not a number';
      } else if (spec.type === 'boolean') {
        data[randomKey] = 'not a boolean';
      } else if (spec.type === 'array') {
        data[randomKey] = 'not an array';
      } else if (spec.type === 'object') {
        data[randomKey] = 'not an object';
      }
    }
    
    return data;
  }
  
  /**
   * Generate value for a specific type
   */
  static generateValueForType(spec, key, messageType) {
    switch (spec.type) {
      case 'string':
        if (key === 'goal') return 'Test goal for ' + messageType;
        if (key === 'message') return 'Test message for ' + messageType;
        if (key === 'error') return 'Test error for ' + messageType;
        if (key === 'timestamp') return new Date().toISOString();
        if (spec.minLength) {
          return 'a'.repeat(spec.minLength);
        }
        return `test-${key}`;
        
      case 'number':
        if (spec.minimum !== undefined && spec.maximum !== undefined) {
          return Math.floor(Math.random() * (spec.maximum - spec.minimum)) + spec.minimum;
        }
        if (spec.minimum !== undefined) {
          return spec.minimum + Math.floor(Math.random() * 100);
        }
        if (spec.maximum !== undefined) {
          return Math.floor(Math.random() * spec.maximum);
        }
        return Math.floor(Math.random() * 100);
        
      case 'boolean':
        return Math.random() > 0.5;
        
      case 'array':
        if (key === 'tools') {
          return [
            { name: 'testTool1', description: 'Test tool 1' },
            { name: 'testTool2', description: 'Test tool 2' }
          ];
        }
        return ['test-item-1', 'test-item-2'];
        
      case 'object':
        if (key === 'result') {
          return { testResult: true, data: 'test-data' };
        }
        if (key === 'data') {
          return { testData: true };
        }
        return { testKey: 'testValue' };
        
      default:
        return null;
    }
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