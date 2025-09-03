/**
 * ProtocolMockGenerator
 * Automatically generates mock actors from protocol definitions
 */

import { ProtocolActor } from '../ProtocolActor.js';

export class ProtocolMockGenerator {
  /**
   * Generate mock actor from protocol definition
   * @param {object} protocol - Protocol definition
   * @param {object} options - Configuration options
   * @returns {class} MockActor class
   */
  static generateMockActor(protocol, options = {}) {
    // Validate protocol first
    const validation = ProtocolActor.validateProtocol(protocol);
    if (!validation.valid) {
      throw new Error(`Invalid protocol for mock generation: ${validation.errors.join(', ')}`);
    }
    
    return class MockActor extends ProtocolActor {
      constructor() {
        super();
        this.receivedMessages = [];
        this.sentMessages = [];
        this.responseHandlers = new Map();
        this.options = options;
        
        // Configure response delays
        this.responseDelay = options.responseDelay || 10;
        this.errorRate = options.errorRate || 0;
        
        // Auto-response configuration
        this.autoRespond = options.autoRespond !== false;
        this.customResponses = options.customResponses || {};
      }
      
      getProtocol() {
        return protocol;
      }
      
      handleMessage(messageType, data) {
        this.receivedMessages.push({ 
          messageType, 
          data, 
          timestamp: Date.now(),
          state: { ...this.state }
        });
        
        // Update state based on message postconditions
        this.updateStateFromMessage(messageType, data);
        
        // Auto-respond based on protocol triggers
        if (this.autoRespond) {
          const messageSpec = this.protocol.messages.receives[messageType];
          if (messageSpec?.triggers) {
            setTimeout(() => {
              this.sendTriggeredResponse(messageSpec.triggers, messageType, data);
            }, this.responseDelay);
          }
        }
      }
      
      /**
       * Update state based on message postconditions
       */
      updateStateFromMessage(messageType, data) {
        const messageSpec = this.protocol.messages.receives[messageType];
        if (messageSpec?.postconditions) {
          for (const condition of messageSpec.postconditions) {
            this.applyStateChange(condition, data);
          }
        }
      }
      
      /**
       * Apply state changes from conditions
       */
      applyStateChange(condition, data) {
        try {
          // Simple state updates based on condition patterns
          if (condition.includes('===')) {
            const [left, right] = condition.split('===').map(s => s.trim());
            if (left.startsWith('state.')) {
              const stateKey = left.replace('state.', '');
              if (right === 'true') {
                this.state[stateKey] = true;
              } else if (right === 'false') {
                this.state[stateKey] = false;
              } else if (right === 'null') {
                this.state[stateKey] = null;
              }
            }
          } else if (condition.includes('!==')) {
            const [left, right] = condition.split('!==').map(s => s.trim());
            if (left.startsWith('state.') && right === 'null') {
              const stateKey = left.replace('state.', '');
              // Set to some non-null value - use data if available
              this.state[stateKey] = data || { mockValue: true };
            }
          }
        } catch (error) {
          console.warn(`Failed to apply state change for condition: ${condition}`, error);
        }
      }
      
      /**
       * Send triggered response based on protocol
       */
      sendTriggeredResponse(triggers, originalMessageType, originalData) {
        const triggerList = Array.isArray(triggers) ? triggers : [triggers];
        
        // Determine which response to send
        let responseType;
        
        // Check for custom response configuration
        if (this.customResponses[originalMessageType]) {
          const customResponse = this.customResponses[originalMessageType];
          if (typeof customResponse === 'string') {
            responseType = customResponse;
          } else if (customResponse.type) {
            responseType = customResponse.type;
          }
        }
        
        // Default behavior - send success response or first trigger
        if (!responseType) {
          // Prefer success/complete messages over error messages
          const successTriggers = triggerList.filter(t => 
            t.includes('complete') || t.includes('success') || !t.includes('error')
          );
          responseType = successTriggers.length > 0 ? successTriggers[0] : triggerList[0];
          
          // Simulate random errors if errorRate is set
          if (this.errorRate > 0 && Math.random() < this.errorRate) {
            const errorTriggers = triggerList.filter(t => t.includes('error'));
            if (errorTriggers.length > 0) {
              responseType = errorTriggers[0];
            }
          }
        }
        
        // Generate response data
        const responseData = this.generateResponseData(responseType, originalMessageType, originalData);
        
        // Send response through registered handlers
        if (this.responseHandlers.has(responseType)) {
          const handler = this.responseHandlers.get(responseType);
          handler(responseData);
        } else if (this.responseHandlers.has('*')) {
          const handler = this.responseHandlers.get('*');
          handler(responseType, responseData);
        }
      }
      
      /**
       * Generate appropriate mock response data
       */
      generateResponseData(responseType, originalMessageType, originalData) {
        // Check for custom response data
        if (this.customResponses[originalMessageType]?.data) {
          return this.customResponses[originalMessageType].data;
        }
        
        // Generate appropriate mock responses based on message type
        switch (responseType) {
          case 'informalPlanComplete':
            return {
              result: {
                hierarchy: {
                  id: 'mock-root',
                  name: originalData?.goal || 'Mock Goal',
                  type: 'GOAL',
                  complexity: 'MODERATE',
                  children: [
                    {
                      id: 'task1',
                      name: 'Initialize environment',
                      type: 'TASK',
                      complexity: 'SIMPLE',
                      children: []
                    }
                  ]
                },
                statistics: {
                  totalTasks: 2,
                  depth: 2,
                  complexity: 'MODERATE'
                }
              },
              goal: originalData?.goal || 'Mock Goal'
            };
            
          case 'toolsDiscoveryComplete':
            return {
              tools: [
                { name: 'writeFile', description: 'Write content to a file', moduleName: 'fs-tools' },
                { name: 'readFile', description: 'Read content from a file', moduleName: 'fs-tools' },
                { name: 'executeCommand', description: 'Execute shell command', moduleName: 'shell-tools' }
              ],
              mappings: {
                'task1': ['writeFile', 'executeCommand']
              }
            };
            
          case 'formalPlanComplete':
            return {
              behaviorTrees: [
                {
                  id: 'bt1',
                  name: 'Main Behavior Tree',
                  type: 'sequence',
                  children: [
                    {
                      type: 'action',
                      tool: 'writeFile',
                      inputs: { path: 'test.txt', content: 'Hello World' }
                    }
                  ]
                }
              ],
              validation: {
                valid: true,
                errors: []
              }
            };
            
          case 'toolsSearchTextComplete':
          case 'toolsSearchSemanticComplete':
            return {
              results: [
                { name: 'mockTool1', description: 'First mock tool', relevance: 0.9 },
                { name: 'mockTool2', description: 'Second mock tool', relevance: 0.8 }
              ]
            };
            
          case 'step-response':
            return {
              data: {
                state: {
                  currentNode: 'mock-node-1',
                  status: 'success',
                  variables: { result: 'mock-result' }
                }
              }
            };
            
          case 'ready':
            return {
              timestamp: new Date().toISOString()
            };
            
          // Error responses
          case 'informalPlanError':
          case 'toolsDiscoveryError':
          case 'formalPlanError':
            return {
              error: `Mock error for ${originalMessageType}`
            };
            
          // Progress responses
          case 'informalPlanProgress':
          case 'toolsDiscoveryProgress':
          case 'formalPlanProgress':
            return {
              message: `Mock progress for ${originalMessageType}`,
              percentage: Math.floor(Math.random() * 100)
            };
            
          default:
            return {};
        }
      }
      
      doSend(messageType, data) {
        this.sentMessages.push({ 
          messageType, 
          data, 
          timestamp: Date.now(),
          state: { ...this.state }
        });
        return Promise.resolve();
      }
      
      /**
       * Register handler for specific message types
       */
      onMessage(messageType, handler) {
        this.responseHandlers.set(messageType, handler);
      }
      
      /**
       * Register handler for all messages
       */
      onAnyMessage(handler) {
        this.responseHandlers.set('*', handler);
      }
      
      /**
       * Simulate receiving a message
       */
      simulateReceive(messageType, data) {
        return this.receive(messageType, data);
      }
      
      /**
       * Configure custom response for a message type
       */
      setCustomResponse(messageType, response) {
        this.customResponses[messageType] = response;
      }
      
      /**
       * Test utilities
       */
      getReceivedMessages(messageType = null) {
        if (messageType) {
          return this.receivedMessages.filter(m => m.messageType === messageType);
        }
        return this.receivedMessages;
      }
      
      getSentMessages(messageType = null) {
        if (messageType) {
          return this.sentMessages.filter(m => m.messageType === messageType);
        }
        return this.sentMessages;
      }
      
      getLastReceivedMessage() {
        return this.receivedMessages[this.receivedMessages.length - 1];
      }
      
      getLastSentMessage() {
        return this.sentMessages[this.sentMessages.length - 1];
      }
      
      reset() {
        this.receivedMessages = [];
        this.sentMessages = [];
        this.state = { ...this.protocol.state.initial };
        this.responseHandlers.clear();
      }
      
      /**
       * Get mock statistics
       */
      getStats() {
        return {
          messagesReceived: this.receivedMessages.length,
          messagesSent: this.sentMessages.length,
          currentState: { ...this.state },
          protocol: {
            name: this.protocol.name,
            version: this.protocol.version
          }
        };
      }
    };
  }
  
  /**
   * Create a connected pair of mock actors
   * @param {object} clientProtocol - Client actor protocol
   * @param {object} serverProtocol - Server actor protocol
   * @param {object} options - Configuration options
   * @returns {object} { client, server } actor instances
   */
  static createConnectedPair(clientProtocol, serverProtocol, options = {}) {
    const MockClient = this.generateMockActor(clientProtocol, options.client);
    const MockServer = this.generateMockActor(serverProtocol, options.server);
    
    const client = new MockClient();
    const server = new MockServer();
    
    // Connect them bidirectionally
    client.onAnyMessage((messageType, data) => {
      server.receive(messageType, data);
    });
    
    server.onAnyMessage((messageType, data) => {
      client.receive(messageType, data);
    });
    
    return { client, server };
  }
  
  /**
   * Create a mock actor that follows a specific scenario
   * @param {object} protocol - Actor protocol
   * @param {Array} scenario - Array of {trigger, response} pairs
   * @returns {class} MockActor class
   */
  static createScenarioActor(protocol, scenario) {
    const MockActor = this.generateMockActor(protocol, { autoRespond: false });
    
    return class ScenarioActor extends MockActor {
      constructor() {
        super();
        this.scenario = scenario;
        this.scenarioIndex = 0;
      }
      
      handleMessage(messageType, data) {
        super.handleMessage(messageType, data);
        
        // Follow scenario script
        if (this.scenarioIndex < this.scenario.length) {
          const step = this.scenario[this.scenarioIndex];
          if (step.trigger === messageType) {
            setTimeout(() => {
              if (step.response) {
                const handler = this.responseHandlers.get(step.response.type) || 
                               this.responseHandlers.get('*');
                if (handler) {
                  handler(step.response.type, step.response.data || {});
                }
              }
              this.scenarioIndex++;
            }, step.delay || 10);
          }
        }
      }
    };
  }
}