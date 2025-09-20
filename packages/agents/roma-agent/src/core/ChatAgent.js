/**
 * ChatAgent - Primary conversational interface that orchestrates different task types
 * Uses LLM to understand intent and delegates to appropriate task executors
 */

import { ResourceManager } from '@legion/resource-manager';
import TaskTypeRegistry from './TaskTypeRegistry.js';
import SimpleROMAAgent from './SimpleROMAAgent.js';

export default class ChatAgent {
  constructor(options = {}) {
    this.resourceManager = null;
    this.llmClient = null;
    this.taskTypeRegistry = null;
    this.romaAgent = null;
    this.conversationHistory = [];
    this.activeExecutions = new Map();
    this.maxHistoryLength = options.maxHistoryLength || 10;
  }

  async initialize() {
    this.resourceManager = await ResourceManager.getInstance();
    this.llmClient = await this.resourceManager.get('llmClient');
    
    // Initialize task type registry
    this.taskTypeRegistry = new TaskTypeRegistry();
    await this.taskTypeRegistry.initialize();
    
    // Initialize ROMA agent for task execution
    this.romaAgent = new SimpleROMAAgent();
    await this.romaAgent.initialize();
    
    console.log('✅ ChatAgent initialized with task type registry');
  }

  /**
   * Process user input - the main entry point
   */
  async processInput(input, context = {}) {
    console.log('💬 ChatAgent processing:', input);
    
    // Add to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Step 1: Classify the intent
      const classification = await this.classifyIntent(input);
      console.log('🎯 Intent classification:', classification);
      
      // Step 2: Route to appropriate handler
      let response;
      switch (classification.intent) {
        case 'chat':
          response = await this.handleChat(input, classification);
          break;
          
        case 'task':
          response = await this.handleTask(input, classification);
          break;
          
        case 'query':
          response = await this.handleQuery(input, classification);
          break;
          
        case 'clarification':
          response = await this.handleClarification(input, classification);
          break;
          
        default:
          response = await this.handleDefault(input);
      }
      
      // Add response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.message || response,
        timestamp: new Date().toISOString(),
        metadata: response.metadata
      });
      
      // Trim history if too long
      if (this.conversationHistory.length > this.maxHistoryLength * 2) {
        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ ChatAgent error:', error);
      return {
        message: `I encountered an error: ${error.message}. Let me try a different approach.`,
        error: true
      };
    }
  }

  /**
   * Classify user intent using LLM
   */
  async classifyIntent(input) {
    const classificationPrompt = `
You are a conversation classifier for an AI assistant that can both chat and execute tasks.

Classify the following user input into one of these categories:
- "chat": General conversation, greetings, casual talk
- "task": Request to create, build, generate, or execute something
- "query": Questions about status, history, or system information  
- "clarification": User is clarifying or providing more info about a previous request

Also determine if the user is asking about:
- A previous task or execution (reference_previous: true/false)
- Needs more information before proceeding (needs_clarification: true/false)

Recent context:
${this.getRecentContext()}

User input: "${input}"

Respond in JSON format:
{
  "intent": "chat|task|query|clarification",
  "confidence": 0.0-1.0,
  "task_type": "roma_execution|code_generation|analysis|null",
  "reference_previous": true/false,
  "needs_clarification": true/false,
  "reasoning": "brief explanation"
}`;

    const response = await this.llmClient.sendMessage(classificationPrompt, {
      temperature: 0.3,
      responseFormat: 'json'
    });
    
    try {
      return JSON.parse(response);
    } catch (error) {
      // Fallback classification
      return {
        intent: input.includes('?') ? 'query' : 'task',
        confidence: 0.5,
        task_type: 'roma_execution',
        reference_previous: false,
        needs_clarification: false,
        reasoning: 'Fallback classification'
      };
    }
  }

  /**
   * Handle chat interactions
   */
  async handleChat(input, classification) {
    const chatTask = await this.taskTypeRegistry.executeWithType('chat', input, {
      history: this.getRecentContext()
    });
    
    return {
      message: chatTask,
      type: 'chat',
      metadata: classification
    };
  }

  /**
   * Handle task execution requests
   */
  async handleTask(input, classification) {
    // Check if we need clarification
    if (classification.needs_clarification) {
      return await this.requestClarification(input, classification);
    }
    
    // Determine task type
    const taskType = classification.task_type || 'roma_execution';
    
    // Generate execution ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store execution reference
    this.activeExecutions.set(executionId, {
      input,
      taskType,
      status: 'starting',
      startTime: new Date().toISOString()
    });
    
    // Execute based on task type
    let result;
    if (taskType === 'roma_execution') {
      // Use ROMA for complex task decomposition
      result = await this.executeWithROMA(input, executionId);
    } else {
      // Use specialized task type
      result = await this.taskTypeRegistry.executeWithType(taskType, input, {
        executionId,
        history: this.getRecentContext()
      });
    }
    
    // Update execution status
    this.activeExecutions.get(executionId).status = 'completed';
    this.activeExecutions.get(executionId).result = result;
    
    return {
      message: this.formatTaskResult(result, taskType),
      type: 'task_execution',
      executionId,
      metadata: classification
    };
  }

  /**
   * Execute task with ROMA agent
   */
  async executeWithROMA(input, executionId) {
    console.log('🚀 Delegating to ROMA for task execution:', executionId);
    
    try {
      // Create task object
      const task = {
        id: executionId,
        description: input
      };
      
      // Execute with ROMA
      const result = await this.romaAgent.execute(task);
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('❌ ROMA execution failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle queries about system state
   */
  async handleQuery(input, classification) {
    // Check if asking about executions
    if (input.toLowerCase().includes('status') || input.toLowerCase().includes('execution')) {
      const status = this.getExecutionStatus();
      return {
        message: this.formatStatus(status),
        type: 'query',
        data: status
      };
    }
    
    // Check if asking about capabilities
    if (input.toLowerCase().includes('can you') || input.toLowerCase().includes('what')) {
      const capabilities = this.getCapabilities();
      return {
        message: this.formatCapabilities(capabilities),
        type: 'query',
        data: capabilities
      };
    }
    
    // Default query handling
    return await this.handleChat(input, classification);
  }

  /**
   * Handle clarification requests
   */
  async handleClarification(input, classification) {
    // Get the last task context
    const lastTask = Array.from(this.activeExecutions.values()).pop();
    
    if (!lastTask) {
      return {
        message: "I don't have a recent task to clarify. Could you tell me what you'd like to do?",
        type: 'clarification'
      };
    }
    
    // Enhance the task with clarification
    const enhancedInput = `${lastTask.input}. Additional context: ${input}`;
    
    // Re-process as a task
    return await this.handleTask(enhancedInput, {
      ...classification,
      needs_clarification: false
    });
  }

  /**
   * Handle default/unknown inputs
   */
  async handleDefault(input) {
    return {
      message: "I'm not sure how to interpret that. Could you rephrase or tell me what you'd like to accomplish?",
      type: 'unknown'
    };
  }

  /**
   * Request clarification from user
   */
  async requestClarification(input, classification) {
    const clarificationPrompt = `
The user requested: "${input}"

This seems incomplete or ambiguous. Generate a helpful clarification request.

Recent context:
${this.getRecentContext()}

Generate a natural response asking for the specific information needed.`;

    const response = await this.llmClient.sendMessage(clarificationPrompt, {
      temperature: 0.7
    });
    
    return {
      message: response,
      type: 'clarification_request',
      metadata: classification
    };
  }

  /**
   * Get recent conversation context
   */
  getRecentContext(limit = 3) {
    return this.conversationHistory
      .slice(-limit * 2)
      .map(h => `${h.role}: ${h.content}`)
      .join('\n');
  }

  /**
   * Get execution status
   */
  getExecutionStatus() {
    const executions = Array.from(this.activeExecutions.entries()).map(([id, exec]) => ({
      id,
      ...exec
    }));
    
    return {
      active: executions.filter(e => e.status === 'running').length,
      completed: executions.filter(e => e.status === 'completed').length,
      failed: executions.filter(e => e.status === 'failed').length,
      recent: executions.slice(-5)
    };
  }

  /**
   * Get system capabilities
   */
  getCapabilities() {
    const taskTypes = this.taskTypeRegistry.getAllTaskTypes();
    
    return {
      taskTypes: taskTypes.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description
      })),
      features: [
        'Natural conversation',
        'Task decomposition and execution',
        'Code generation',
        'Analysis and insights',
        'Context-aware responses'
      ]
    };
  }

  /**
   * Format task result for display
   */
  formatTaskResult(result, taskType) {
    if (result.error) {
      return `I encountered an issue: ${result.error}. Would you like me to try a different approach?`;
    }
    
    if (taskType === 'roma_execution') {
      return `✅ Task completed successfully!\n\n${result.summary || 'Task has been executed.'}`;
    }
    
    if (taskType === 'code_generation' && result.code) {
      return `Here's the code I generated:\n\n\`\`\`${result.language || ''}\n${result.code}\n\`\`\`\n\n${result.explanation || ''}`;
    }
    
    if (taskType === 'analysis' && result.findings) {
      return `Analysis complete:\n\n${result.summary}\n\nKey findings:\n${result.findings.map(f => `• ${f}`).join('\n')}`;
    }
    
    return JSON.stringify(result, null, 2);
  }

  /**
   * Format status for display
   */
  formatStatus(status) {
    return `Current Status:
• Active tasks: ${status.active}
• Completed: ${status.completed}
• Failed: ${status.failed}

Recent executions:
${status.recent.map(e => `• ${e.id}: ${e.status}`).join('\n')}`;
  }

  /**
   * Format capabilities for display
   */
  formatCapabilities(capabilities) {
    return `I can help you with:
${capabilities.features.map(f => `• ${f}`).join('\n')}

Available task types:
${capabilities.taskTypes.map(t => `• ${t.name}: ${t.description}`).join('\n')}

Just describe what you need, and I'll determine the best approach!`;
  }
}