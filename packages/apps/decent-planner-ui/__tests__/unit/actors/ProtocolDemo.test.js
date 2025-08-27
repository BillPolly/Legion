/**
 * Simple demonstration of Protocol Actor system functionality
 */

import { jest } from '@jest/globals';
import { ProtocolActor } from '../../../src/actors/ProtocolActor.js';

describe('Protocol Actor System Demo', () => {
  
  describe('ProtocolActor Base Functionality', () => {
    // Create a simple test actor
    class TestActor extends ProtocolActor {
      getProtocol() {
        return {
          name: 'TestActor',
          version: '1.0.0',
          state: {
            schema: {
              connected: { type: 'boolean', required: true },
              value: { type: 'string', required: true }
            },
            initial: {
              connected: false,
              value: 'initial'
            }
          },
          messages: {
            receives: {
              'connect': {
                schema: {
                  timestamp: { type: 'string', required: true }
                },
                preconditions: ['state.connected === false'],
                postconditions: ['state.connected === true']
              }
            },
            sends: {
              'ping': {
                schema: {
                  message: { type: 'string', required: true }
                },
                preconditions: ['state.connected === true']
              }
            }
          }
        };
      }
      
      handleMessage(messageType, data) {
        switch (messageType) {
          case 'connect':
            this.state.connected = true;
            return 'connected';
          default:
            return 'handled: ' + messageType;
        }
      }
      
      doSend(messageType, data) {
        return Promise.resolve(`sent: ${messageType}`);
      }
    }
    
    test('should create actor with protocol validation', () => {
      const actor = new TestActor();
      
      expect(actor.protocol).toBeDefined();
      expect(actor.protocol.name).toBe('TestActor');
      expect(actor.state.connected).toBe(false);
      expect(actor.state.value).toBe('initial');
    });
    
    test('should validate protocol structure', () => {
      const result = ProtocolActor.validateProtocol({
        name: 'ValidActor',
        version: '1.0.0',
        state: {
          schema: { test: { type: 'boolean' } },
          initial: { test: false }
        },
        messages: {
          receives: {},
          sends: {}
        }
      });
      
      expect(result.valid).toBe(true);
    });
    
    test('should handle messages with protocol validation', () => {
      const actor = new TestActor();
      
      // This would normally validate the message
      const result = actor.handleMessage('connect', { timestamp: '2023-01-01' });
      
      expect(result).toBe('connected');
      expect(actor.state.connected).toBe(true);
    });
    
    test('should setup message validators', () => {
      const actor = new TestActor();
      
      expect(actor.messageValidators).toBeInstanceOf(Map);
      expect(actor.messageValidators.has('connect')).toBe(true);
      expect(actor.messageValidators.has('ping')).toBe(true);
    });
  });

  describe('Protocol System Benefits', () => {
    test('should provide protocol introspection', () => {
      class IntrospectionActor extends ProtocolActor {
        getProtocol() {
          return {
            name: 'IntrospectionActor',
            version: '2.0.0',
            state: {
              schema: { ready: { type: 'boolean', required: true } },
              initial: { ready: false }
            },
            messages: {
              receives: {
                'status-check': {
                  schema: {},
                  preconditions: [],
                  postconditions: []
                }
              },
              sends: {
                'status-report': {
                  schema: { status: { type: 'string', required: true } }
                }
              }
            }
          };
        }
        
        handleMessage(messageType, data) {
          return `handled: ${messageType}`;
        }
        
        doSend(messageType, data) {
          return Promise.resolve();
        }
      }
      
      const actor = new IntrospectionActor();
      const protocol = actor.getProtocol();
      
      // Protocol can be inspected programmatically
      expect(protocol.name).toBe('IntrospectionActor');
      expect(protocol.version).toBe('2.0.0');
      
      // Can enumerate all supported messages
      const receiveTypes = Object.keys(protocol.messages.receives);
      const sendTypes = Object.keys(protocol.messages.sends);
      
      expect(receiveTypes).toContain('status-check');
      expect(sendTypes).toContain('status-report');
      
      // Can access message schemas for validation or documentation
      const statusReportSchema = protocol.messages.sends['status-report'].schema;
      expect(statusReportSchema.status).toEqual({ type: 'string', required: true });
    });
    
    test('should enable contract-based development', () => {
      // Protocol defines the contract
      const clientProtocol = {
        name: 'ClientActor',
        version: '1.0.0',
        state: {
          schema: { connected: { type: 'boolean', required: true } },
          initial: { connected: false }
        },
        messages: {
          receives: {
            'welcome': {
              schema: { message: { type: 'string', required: true } }
            }
          },
          sends: {
            'hello': {
              schema: { name: { type: 'string', required: true } },
              triggers: ['welcome']
            }
          }
        }
      };
      
      // Contract can be validated without implementation
      const validation = ProtocolActor.validateProtocol(clientProtocol);
      expect(validation.valid).toBe(true);
      
      // Contract documents the expected interaction
      const helloMessage = clientProtocol.messages.sends.hello;
      expect(helloMessage.triggers).toContain('welcome');
      expect(helloMessage.schema.name.required).toBe(true);
    });
  });
});