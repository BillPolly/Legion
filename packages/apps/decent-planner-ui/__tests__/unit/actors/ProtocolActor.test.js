/**
 * Unit tests for ProtocolActor base class
 */

import { jest } from '@jest/globals';
import { ProtocolActor } from '../../../src/actors/ProtocolActor.js';

// Mock Legion schema package  
const mockCreateValidatorFunction = jest.fn();
jest.mock('@legion/schema', () => ({
  createValidatorFunction: mockCreateValidatorFunction
}));

describe('ProtocolActor', () => {
  let mockValidator;
  
  beforeEach(() => {
    mockValidator = jest.fn(() => ({ valid: true, errors: [] }));
    mockCreateValidatorFunction.mockReturnValue(mockValidator);
    jest.clearAllMocks();
  });
  
  describe('Static Methods', () => {
    test('should cache protocol schema validator', () => {
      // Mock getProtocolSchema
      ProtocolActor.getProtocolSchema = jest.fn(() => ({ type: 'object' }));
      
      // Clear any cached validator
      ProtocolActor._validator = null;
      
      const validator1 = ProtocolActor.getValidator();
      const validator2 = ProtocolActor.getValidator();
      
      expect(validator1).toBe(validator2);
      expect(mockCreateValidatorFunction).toHaveBeenCalledTimes(1);
    });
    
    test('should validate protocol structure', () => {
      const mockProtocol = {
        name: 'TestActor',
        version: '1.0.0',
        state: {
          schema: { connected: { type: 'boolean', required: true } },
          initial: { connected: false }
        },
        messages: {
          receives: {},
          sends: {}
        }
      };
      
      // Mock getProtocolSchema to return the schema
      ProtocolActor.getProtocolSchema = jest.fn(() => ({ type: 'object' }));
      ProtocolActor._validator = null; // Reset cache
      
      mockValidator.mockReturnValue({ valid: true, errors: [] });
      
      const result = ProtocolActor.validateProtocol(mockProtocol);
      
      expect(result.valid).toBe(true);
      expect(mockValidator).toHaveBeenCalledWith(mockProtocol);
    });
    
    test('should return validation errors for invalid protocol', () => {
      const invalidProtocol = { invalid: true };
      
      // Mock getProtocolSchema to return the schema
      ProtocolActor.getProtocolSchema = jest.fn(() => ({ type: 'object' }));
      ProtocolActor._validator = null; // Reset cache
      
      mockValidator.mockReturnValue({ 
        valid: false, 
        errors: ['name is required', 'version is required'] 
      });
      
      const result = ProtocolActor.validateProtocol(invalidProtocol);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });
  
  describe('Constructor', () => {
    class TestProtocolActor extends ProtocolActor {
      getProtocol() {
        return {
          name: 'TestActor',
          version: '1.0.0',
          state: {
            schema: { 
              connected: { type: 'boolean', required: true },
              value: { type: 'string', required: true }
            },
            initial: { connected: false, value: 'test' }
          },
          messages: {
            receives: {
              'test-message': {
                schema: { data: { type: 'string', required: true } }
              }
            },
            sends: {}
          }
        };
      }
      
      handleMessage(messageType, data) {
        return `handled: ${messageType}`;
      }
      
      doSend(messageType, data) {
        return Promise.resolve(`sent: ${messageType}`);
      }
    }
    
    test('should initialize with protocol validation', () => {
      mockValidator.mockReturnValue({ valid: true, errors: [] });
      
      const actor = new TestProtocolActor();
      
      expect(actor.protocol).toBeDefined();
      expect(actor.state).toEqual({ connected: false, value: 'test' });
      expect(actor.messageValidators).toBeInstanceOf(Map);
    });
    
    test('should throw error for invalid protocol', () => {
      mockValidator.mockReturnValue({ 
        valid: false, 
        errors: ['Invalid protocol structure'] 
      });
      
      expect(() => {
        new TestProtocolActor();
      }).toThrow('Invalid protocol for TestProtocolActor: Invalid protocol structure');
    });
    
    test('should setup message validators', () => {
      mockValidator.mockReturnValue({ valid: true, errors: [] });
      
      const actor = new TestProtocolActor();
      
      expect(actor.messageValidators.has('test-message')).toBe(true);
      expect(mockCreateValidatorFunction).toHaveBeenCalledWith({ data: { type: 'string', required: true } });
    });
  });
  
  describe('Message Validation', () => {
    let actor;
    
    beforeEach(() => {
      mockValidator.mockReturnValue({ valid: true, errors: [] });
      
      class TestActor extends ProtocolActor {
        getProtocol() {
          return {
            name: 'TestActor',
            version: '1.0.0',
            state: {
              schema: { connected: { type: 'boolean', required: true } },
              initial: { connected: false }
            },
            messages: {
              receives: {
                'valid-message': {
                  schema: { name: { type: 'string', required: true } },
                  preconditions: ['state.connected === true'],
                  postconditions: ['state.connected === true']
                }
              },
              sends: {}
            }
          };
        }
        
        handleMessage(messageType, data) {
          return data;
        }
        
        doSend(messageType, data) {
          return Promise.resolve(data);
        }
      }
      
      actor = new TestActor();
    });
    
    test('should validate incoming messages', () => {
      const messageValidator = jest.fn(() => ({ valid: true, errors: [] }));
      actor.messageValidators.set('valid-message', messageValidator);
      
      const data = { name: 'test' };
      
      expect(() => {
        actor.validateIncomingMessage('valid-message', data);
      }).not.toThrow();
      
      expect(messageValidator).toHaveBeenCalledWith(data);
    });
    
    test('should reject invalid incoming messages', () => {
      const messageValidator = jest.fn(() => ({ 
        valid: false, 
        errors: ['name is required'] 
      }));
      actor.messageValidators.set('valid-message', messageValidator);
      
      expect(() => {
        actor.validateIncomingMessage('valid-message', {});
      }).toThrow('Invalid message data for valid-message: name is required');
    });
    
    test('should check preconditions', () => {
      // Set state to violate preconditions
      actor.state.connected = false;
      
      expect(() => {
        actor.checkPreconditions('valid-message');
      }).toThrow('Precondition failed for valid-message: state.connected === true');
    });
    
    test('should pass when preconditions are satisfied', () => {
      // Set state to satisfy preconditions
      actor.state.connected = true;
      
      expect(() => {
        actor.checkPreconditions('valid-message');
      }).not.toThrow();
    });
    
    test('should validate postconditions', () => {
      // Mock console.warn to check for warnings
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Set state to violate postconditions
      actor.state.connected = false;
      
      actor.validatePostconditions('valid-message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Postcondition failed for valid-message: state.connected === true'
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Condition Evaluation', () => {
    let actor;
    
    beforeEach(() => {
      mockValidator.mockReturnValue({ valid: true, errors: [] });
      
      class TestActor extends ProtocolActor {
        getProtocol() {
          return {
            name: 'TestActor',
            version: '1.0.0',
            state: {
              schema: { connected: { type: 'boolean', required: true } },
              initial: { connected: false }
            },
            messages: { receives: {}, sends: {} }
          };
        }
        
        handleMessage(messageType, data) {
          return data;
        }
        
        doSend(messageType, data) {
          return Promise.resolve(data);
        }
      }
      
      actor = new TestActor();
    });
    
    test('should evaluate simple boolean conditions', () => {
      actor.state.connected = true;
      
      expect(actor.evaluateCondition('state.connected === true')).toBe(true);
      expect(actor.evaluateCondition('state.connected === false')).toBe(false);
    });
    
    test('should evaluate null conditions', () => {
      actor.state.result = null;
      
      expect(actor.evaluateCondition('state.result === null')).toBe(true);
      expect(actor.evaluateCondition('state.result !== null')).toBe(false);
      
      actor.state.result = { data: 'test' };
      
      expect(actor.evaluateCondition('state.result === null')).toBe(false);
      expect(actor.evaluateCondition('state.result !== null')).toBe(true);
    });
    
    test('should handle evaluation errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = actor.evaluateCondition('invalid.condition.syntax');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Message Sending', () => {
    let actor;
    
    beforeEach(() => {
      mockValidator.mockReturnValue({ valid: true, errors: [] });
      
      class TestActor extends ProtocolActor {
        getProtocol() {
          return {
            name: 'TestActor',
            version: '1.0.0',
            state: {
              schema: { connected: { type: 'boolean', required: true } },
              initial: { connected: true }
            },
            messages: {
              receives: {},
              sends: {
                'test-send': {
                  schema: { message: { type: 'string', required: true } },
                  preconditions: ['state.connected === true']
                }
              }
            }
          };
        }
        
        handleMessage(messageType, data) {
          return data;
        }
        
        doSend(messageType, data) {
          this.lastSent = { messageType, data };
          return Promise.resolve(data);
        }
      }
      
      actor = new TestActor();
    });
    
    test('should validate outgoing messages', async () => {
      const messageValidator = jest.fn(() => ({ valid: true, errors: [] }));
      actor.messageValidators.set('test-send', messageValidator);
      
      const data = { message: 'test' };
      
      await actor.send('test-send', data);
      
      expect(messageValidator).toHaveBeenCalledWith(data);
      expect(actor.lastSent).toEqual({ messageType: 'test-send', data });
    });
    
    test('should reject invalid outgoing messages', () => {
      const messageValidator = jest.fn(() => ({ 
        valid: false, 
        errors: ['message is required'] 
      }));
      actor.messageValidators.set('test-send', messageValidator);
      
      expect(async () => {
        await actor.send('test-send', {});
      }).rejects.toThrow('Invalid outgoing message data for test-send: message is required');
    });
    
    test('should check send preconditions', () => {
      actor.state.connected = false;
      
      expect(async () => {
        await actor.send('test-send', { message: 'test' });
      }).rejects.toThrow('Send precondition failed for test-send: state.connected === true');
    });
  });
  
  describe('Abstract Methods', () => {
    test('should require getProtocol implementation', () => {
      expect(() => {
        new ProtocolActor();
      }).toThrow('getProtocol() must be implemented by subclass');
    });
    
    test('should require handleMessage implementation', () => {
      class IncompleteActor extends ProtocolActor {
        getProtocol() {
          return {
            name: 'IncompleteActor',
            version: '1.0.0',
            state: { schema: {}, initial: {} },
            messages: { receives: {}, sends: {} }
          };
        }
        
        doSend(messageType, data) {
          return Promise.resolve();
        }
      }
      
      mockValidator.mockReturnValue({ valid: true, errors: [] });
      const actor = new IncompleteActor();
      
      expect(() => {
        actor.handleMessage('test', {});
      }).toThrow('handleMessage must be implemented by subclass');
    });
    
    test('should require doSend implementation', () => {
      class IncompleteActor extends ProtocolActor {
        getProtocol() {
          return {
            name: 'IncompleteActor',
            version: '1.0.0',
            state: { schema: {}, initial: {} },
            messages: { receives: {}, sends: {} }
          };
        }
        
        handleMessage(messageType, data) {
          return data;
        }
      }
      
      mockValidator.mockReturnValue({ valid: true, errors: [] });
      const actor = new IncompleteActor();
      
      expect(() => {
        actor.doSend('test', {});
      }).toThrow('doSend must be implemented by subclass');
    });
  });
});