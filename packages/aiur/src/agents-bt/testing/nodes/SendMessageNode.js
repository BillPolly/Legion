/**
 * SendMessageNode - Sends messages to agents under test
 * 
 * Core testing node for initiating communication with BT agents through
 * their Actor interface.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class SendMessageNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'send_message';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.targetAgent = config.targetAgent; // ID of agent to send to
    this.messageType = config.messageType || 'test_message';
    this.messageContent = config.messageContent || config.content;
    this.messageData = config.messageData || config.data || {};
    
    // Template support for dynamic content
    this.useTemplating = config.useTemplating !== false;
    
    // Response handling
    this.waitForResponse = config.waitForResponse !== false;
    this.responseTimeout = config.responseTimeout || 5000;
    this.storeResponse = config.storeResponse !== false;
    this.responseKey = config.responseKey || 'lastResponse';
  }

  async executeNode(context) {
    try {
      // Get target agent
      const targetAgent = this.resolveTargetAgent(context);
      if (!targetAgent) {
        return {
          status: NodeStatus.FAILURE,
          data: { error: `Target agent not found: ${this.targetAgent}` }
        };
      }

      // Build message payload
      const message = await this.buildMessage(context);
      
      // Create envelope for Actor protocol
      const envelope = {
        sender: 'TestingBT',
        timestamp: new Date().toISOString(),
        testId: context.testId,
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      if (context.debugMode) {
        console.log(`SendMessageNode: Sending message to ${this.targetAgent}:`, message);
      }

      // Send message
      let response = null;
      if (this.waitForResponse && typeof targetAgent.receive === 'function') {
        // Set up response timeout
        const responsePromise = this.sendAndWaitForResponse(targetAgent, message, envelope, context);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Response timeout')), this.responseTimeout)
        );

        try {
          response = await Promise.race([responsePromise, timeoutPromise]);
        } catch (error) {
          if (error.message === 'Response timeout') {
            console.warn(`SendMessageNode: Response timeout for ${this.targetAgent}`);
            return {
              status: NodeStatus.FAILURE,
              data: { 
                error: 'Response timeout',
                sentMessage: message,
                timeout: this.responseTimeout
              }
            };
          }
          throw error;
        }
      } else if (typeof targetAgent.receive === 'function') {
        // Fire and forget
        await targetAgent.receive(message, envelope);
      } else {
        return {
          status: NodeStatus.FAILURE,
          data: { error: `Target agent ${this.targetAgent} does not implement receive() method` }
        };
      }

      // Store response in context if requested
      if (this.storeResponse && response) {
        context[this.responseKey] = response;
      }

      // Track sent messages for test reporting
      if (!context.sentMessages) {
        context.sentMessages = [];
      }
      context.sentMessages.push({
        targetAgent: this.targetAgent,
        message: message,
        envelope: envelope,
        response: response,
        timestamp: envelope.timestamp
      });

      return {
        status: NodeStatus.SUCCESS,
        data: {
          messageSent: true,
          targetAgent: this.targetAgent,
          messageType: message.type,
          responseReceived: !!response,
          response: response
        }
      };

    } catch (error) {
      console.error(`SendMessageNode: Error sending message to ${this.targetAgent}:`, error);
      
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          stackTrace: error.stack,
          targetAgent: this.targetAgent
        }
      };
    }
  }

  /**
   * Resolve target agent from context
   */
  resolveTargetAgent(context) {
    if (!this.targetAgent) {
      return null;
    }

    // Check test agents registry
    if (context.testAgents && context.testAgents.has(this.targetAgent)) {
      return context.testAgents.get(this.targetAgent);
    }

    // Check if it's a template reference
    if (this.useTemplating && this.targetAgent.includes('{{')) {
      const resolvedAgentId = this.resolveTemplate(this.targetAgent, context);
      if (context.testAgents && context.testAgents.has(resolvedAgentId)) {
        return context.testAgents.get(resolvedAgentId);
      }
    }

    return null;
  }

  /**
   * Build message payload with template resolution
   */
  async buildMessage(context) {
    let messageContent = this.messageContent;
    let messageData = { ...this.messageData };

    // Resolve templates if enabled
    if (this.useTemplating) {
      messageContent = this.resolveTemplate(messageContent, context);
      messageData = this.resolveTemplateInObject(messageData, context);
    }

    // Build final message
    const message = {
      type: this.messageType,
      content: messageContent,
      ...messageData,
      // Add test metadata
      _testMetadata: {
        testId: context.testId,
        nodeType: 'send_message',
        timestamp: new Date().toISOString()
      }
    };

    return message;
  }

  /**
   * Send message and wait for response
   */
  async sendAndWaitForResponse(targetAgent, message, envelope, context) {
    return new Promise((resolve, reject) => {
      // Set up response listener
      const responseListener = (response) => {
        resolve(response);
      };

      // Add temporary response handling to agent if possible
      if (targetAgent.once && typeof targetAgent.once === 'function') {
        targetAgent.once('response', responseListener);
      }

      // Send the message
      targetAgent.receive(message, envelope)
        .then(directResponse => {
          // If receive() returns a response directly, use that
          if (directResponse) {
            resolve(directResponse);
          }
          // Otherwise the response listener will handle it
        })
        .catch(reject);
    });
  }

  /**
   * Resolve template strings like {{variable}} in content
   */
  resolveTemplate(template, context) {
    if (typeof template !== 'string') {
      return template;
    }

    return template.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const value = this.getNestedValue(context, variableName.trim());
      return value !== undefined ? value : match;
    });
  }

  /**
   * Resolve templates in object recursively
   */
  resolveTemplateInObject(obj, context) {
    if (typeof obj === 'string') {
      return this.resolveTemplate(obj, context);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.resolveTemplateInObject(item, context));
    } else if (obj && typeof obj === 'object') {
      const resolved = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveTemplateInObject(value, context);
      }
      return resolved;
    }
    return obj;
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
      nodeType: 'send_message',
      purpose: 'Send messages to agents under test',
      targetAgent: this.targetAgent,
      messageType: this.messageType,
      waitForResponse: this.waitForResponse,
      responseTimeout: this.responseTimeout,
      capabilities: [
        'template_resolution',
        'response_waiting',
        'message_tracking',
        'timeout_handling'
      ]
    };
  }
}