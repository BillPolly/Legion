/**
 * WaitForResponseNode - Waits for and captures responses from agents under test
 * 
 * Testing node that waits for specific response types or patterns from agents,
 * with configurable timeouts and filtering.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class WaitForResponseNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'wait_for_response';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.sourceAgent = config.sourceAgent; // Agent to listen to
    this.responseType = config.responseType; // Specific response type to wait for
    this.responsePattern = config.responsePattern; // Regex pattern to match
    this.timeout = config.timeout || 10000;
    this.storeResponse = config.storeResponse !== false;
    this.responseKey = config.responseKey || 'capturedResponse';
    
    // Filtering options
    this.filterCriteria = config.filterCriteria || {};
    this.maxResponses = config.maxResponses || 1;
    this.collectAll = config.collectAll || false; // Collect all matching responses
    
    // Validation options
    this.validateResponse = config.validateResponse !== false;
    this.requiredFields = config.requiredFields || [];
    this.expectedValues = config.expectedValues || {};
  }

  async executeNode(context) {
    try {
      // Get source agent to listen to
      const sourceAgent = this.resolveSourceAgent(context);
      if (!sourceAgent) {
        return {
          status: NodeStatus.FAILURE,
          data: { error: `Source agent not found: ${this.sourceAgent}` }
        };
      }

      if (context.debugMode) {
        console.log(`WaitForResponseNode: Waiting for response from ${this.sourceAgent}`, {
          responseType: this.responseType,
          timeout: this.timeout
        });
      }

      // Set up response collection
      const collectedResponses = [];
      let responsePromise;

      // Create promise to wait for responses
      responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Response timeout after ${this.timeout}ms`));
        }, this.timeout);

        const responseHandler = (response, envelope) => {
          try {
            // Apply filters
            if (this.matchesFilter(response, envelope)) {
              collectedResponses.push({
                response,
                envelope,
                timestamp: new Date().toISOString()
              });

              if (context.debugMode) {
                console.log(`WaitForResponseNode: Collected response ${collectedResponses.length}:`, response);
              }

              // Check if we have enough responses
              if (collectedResponses.length >= this.maxResponses) {
                clearTimeout(timeout);
                resolve(collectedResponses);
              }
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        // Set up listener on source agent
        this.setupResponseListener(sourceAgent, responseHandler, context);
      });

      // Wait for responses
      const responses = await responsePromise;

      // Validate responses if requested
      if (this.validateResponse) {
        for (const responseData of responses) {
          const validation = this.validateResponseData(responseData.response);
          if (!validation.valid) {
            return {
              status: NodeStatus.FAILURE,
              data: {
                error: 'Response validation failed',
                validationErrors: validation.errors,
                response: responseData.response
              }
            };
          }
        }
      }

      // Store responses in context
      if (this.storeResponse) {
        context[this.responseKey] = this.collectAll ? responses : responses[0];
      }

      // Track received responses for test reporting
      if (!context.receivedResponses) {
        context.receivedResponses = [];
      }
      context.receivedResponses.push(...responses.map(r => ({
        sourceAgent: this.sourceAgent,
        responseType: r.response.type,
        ...r
      })));

      return {
        status: NodeStatus.SUCCESS,
        data: {
          responsesCaptured: responses.length,
          sourceAgent: this.sourceAgent,
          responses: this.collectAll ? responses : responses[0],
          validationPassed: this.validateResponse
        }
      };

    } catch (error) {
      if (error.message.includes('timeout')) {
        console.warn(`WaitForResponseNode: Timeout waiting for response from ${this.sourceAgent}`);
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: 'Response timeout',
            sourceAgent: this.sourceAgent,
            timeout: this.timeout,
            expectedType: this.responseType
          }
        };
      }

      console.error(`WaitForResponseNode: Error waiting for response:`, error);
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          stackTrace: error.stack,
          sourceAgent: this.sourceAgent
        }
      };
    }
  }

  /**
   * Resolve source agent from context
   */
  resolveSourceAgent(context) {
    if (!this.sourceAgent) {
      return null;
    }

    if (context.testAgents && context.testAgents.has(this.sourceAgent)) {
      return context.testAgents.get(this.sourceAgent);
    }

    return null;
  }

  /**
   * Set up response listener on the source agent
   */
  setupResponseListener(sourceAgent, handler, context) {
    // Try different listener patterns based on agent implementation
    
    if (sourceAgent.on && typeof sourceAgent.on === 'function') {
      // EventEmitter pattern
      sourceAgent.on('response', handler);
    } else if (sourceAgent.addResponseListener && typeof sourceAgent.addResponseListener === 'function') {
      // Custom response listener pattern
      sourceAgent.addResponseListener(handler);
    } else {
      // Fallback: patch the agent's receive method to intercept responses
      this.patchAgentForResponseCapture(sourceAgent, handler, context);
    }
  }

  /**
   * Patch agent to capture responses (fallback method)
   */
  patchAgentForResponseCapture(agent, handler, context) {
    // Store original receive method
    if (!agent._originalReceive) {
      agent._originalReceive = agent.receive.bind(agent);
      
      // Replace with patched version
      agent.receive = async (payload, envelope) => {
        // Call original method
        const result = await agent._originalReceive(payload, envelope);
        
        // Capture response if it matches our criteria
        if (result && this.matchesFilter(result, envelope)) {
          handler(result, envelope);
        }
        
        return result;
      };
    }
  }

  /**
   * Check if response matches filter criteria
   */
  matchesFilter(response, envelope) {
    // Check response type
    if (this.responseType && response.type !== this.responseType) {
      return false;
    }

    // Check response pattern
    if (this.responsePattern) {
      const pattern = new RegExp(this.responsePattern);
      const responseText = JSON.stringify(response);
      if (!pattern.test(responseText)) {
        return false;
      }
    }

    // Check filter criteria
    for (const [field, expectedValue] of Object.entries(this.filterCriteria)) {
      const actualValue = this.getNestedValue(response, field);
      if (actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate response data structure
   */
  validateResponseData(response) {
    const errors = [];

    // Check required fields
    for (const field of this.requiredFields) {
      const value = this.getNestedValue(response, field);
      if (value === undefined || value === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check expected values
    for (const [field, expectedValue] of Object.entries(this.expectedValues)) {
      const actualValue = this.getNestedValue(response, field);
      if (actualValue !== expectedValue) {
        errors.push(`Field ${field}: expected ${expectedValue}, got ${actualValue}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key];
    }, obj);
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'wait_for_response',
      purpose: 'Wait for and capture responses from agents under test',
      sourceAgent: this.sourceAgent,
      responseType: this.responseType,
      timeout: this.timeout,
      maxResponses: this.maxResponses,
      capabilities: [
        'response_filtering',
        'pattern_matching',
        'response_validation',
        'timeout_handling',
        'multi_response_collection'
      ]
    };
  }
}