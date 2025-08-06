import { Actor } from '../../../../shared/actors/src/Actor.js';
import { UserInteractionHandler } from './UserInteractionHandler.js';
import { PlanExecution } from './PlanExecution.js';
import { PlanExecutionEngine } from './PlanExecutionEngine.js';

/**
 * TaskOrchestrator - Backend agent that handles complex, multi-step tasks
 * 
 * This is an internal actor that works exclusively with ChatAgent to handle
 * complex tasks that require planning and orchestration. It does not have
 * a frontend counterpart - all UI communication goes through ChatAgent.
 * 
 * Architecture:
 * - UserInteractionHandler: Manages all user interactions and controls execution
 * - PlanExecutionEngine: Handles planning and execution (can replan during execution)
 */
export class TaskOrchestrator extends Actor {
  constructor(config = {}) {
    super();
    
    // Agent identification
    this.id = `task-orchestrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId;
    
    // Reference to ChatAgent for sending updates
    this.chatAgent = config.chatAgent || null;
    
    // Resource access
    this.resourceManager = config.resourceManager || null;
    this.moduleLoader = config.moduleLoader || null;
    this.artifactManager = config.artifactManager || null;
    
    // LLM access (will come from ChatAgent)
    this.llmClient = null;
    
    // Internal components
    this.interactionHandler = new UserInteractionHandler(this);
    this.planExecution = new PlanExecution(this);
    this.planExecutionEngine = new PlanExecutionEngine(this);
    
    // Task state
    this.currentTask = null;
    
    console.log(`TaskOrchestrator ${this.id} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Initialize the orchestrator
   */
  async initialize() {
    // Get LLM client from ResourceManager
    if (this.resourceManager) {
      try {
        this.llmClient = await this.resourceManager.createLLMClient({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          maxRetries: 3
        });
        console.log('TaskOrchestrator: LLM client initialized');
      } catch (error) {
        console.error('TaskOrchestrator: Failed to initialize LLM client:', error);
      }
    }
    
    console.log('TaskOrchestrator: Initialized');
  }
  
  /**
   * Set reference to ChatAgent for bidirectional communication
   */
  setChatAgent(chatAgent) {
    this.chatAgent = chatAgent;
  }
  
  /**
   * Receive messages from ChatAgent
   */
  async receive(payload) {
    console.log('TaskOrchestrator: Received message:', payload);
    
    if (payload && typeof payload === 'object') {
      switch (payload.type) {
        case 'start_task':
          await this.startTask(payload);
          break;
          
        case 'execute_plan':
          await this.executePlan(payload);
          break;
          
        case 'user_message':
          await this.interactionHandler.processUserInput(payload);
          break;
          
        default:
          console.warn('TaskOrchestrator: Unknown message type:', payload.type);
      }
    }
  }
  
  /**
   * Start working on a complex task
   */
  async startTask(payload) {
    if (this.planExecution.state !== 'idle') {
      // Use agentContext if available, otherwise fall back to old method
      if (payload.agentContext) {
        payload.agentContext.emit('message', {
          type: 'chat_response',
          content: 'I\'m already working on a task. Please wait for it to complete or cancel it first.',
          isComplete: true,
          sessionId: payload.agentContext.sessionId
        });
      } else {
        this.sendToChatAgent({
          type: 'orchestrator_error',
          message: 'I\'m already working on a task. Please wait for it to complete or cancel it first.',
          currentTask: this.currentTask?.description
        });
      }
      return;
    }
    
    // Store the agent context
    this.agentContext = payload.agentContext;
    
    this.currentTask = {
      description: payload.description || 'Complex task',
      context: {},
      conversationHistory: this.agentContext?.conversationHistory || []
    };
    
    // Skip the interaction handler and go straight to planning
    await this.planExecution.start(this.currentTask.description, this.currentTask.context);
  }
  
  /**
   * Execute a validated plan
   */
  async executePlan(payload) {
    if (this.planExecutionEngine.state !== 'idle') {
      // Use agentContext if available, otherwise fall back to old method
      if (payload.agentContext) {
        payload.agentContext.emit('message', {
          type: 'chat_response',
          content: 'I\'m already executing a plan. Please wait for it to complete or cancel it first.',
          isComplete: true,
          sessionId: payload.agentContext.sessionId
        });
      } else {
        this.sendToChatAgent({
          type: 'orchestrator_error',
          message: 'I\'m already executing a plan. Please wait for it to complete or cancel it first.',
          currentState: this.planExecutionEngine.state
        });
      }
      return;
    }
    
    // Store the agent context
    this.agentContext = payload.agentContext;
    
    const plan = payload.plan;
    const options = payload.options || {};
    
    if (!plan) {
      this.sendToChatAgent({
        type: 'orchestrator_error',
        message: 'No plan provided for execution'
      });
      return;
    }
    
    // Execute the plan
    await this.planExecutionEngine.executePlan(plan, options);
  }
  
  /**
   * Send message to ChatAgent
   */
  sendToChatAgent(message) {
    // Prefer agentContext if available
    if (this.agentContext) {
      // Map orchestrator message types to chat message types
      let chatMessage = {
        sessionId: this.agentContext.sessionId,
        timestamp: new Date().toISOString()
      };
      
      switch (message.type) {
        case 'orchestrator_status':
        case 'orchestrator_update':
          chatMessage = {
            ...chatMessage,
            type: 'chat_response',
            content: message.message,
            isComplete: false,
            progress: message.progress
          };
          break;
          
        case 'orchestrator_complete':
          chatMessage = {
            ...chatMessage,
            type: 'chat_response',
            content: message.message,
            isComplete: true,
            taskSummary: message.taskSummary
          };
          
          // Clear orchestrator active flag in ChatAgent
          if (this.chatAgent) {
            this.chatAgent.orchestratorActive = false;
          }
          this.currentTask = null;
          break;
          
        case 'orchestrator_error':
          chatMessage = {
            ...chatMessage,
            type: 'chat_response',
            content: message.message,
            isComplete: true,
            isError: true
          };
          break;
          
        default:
          console.warn('TaskOrchestrator: Unknown message type:', message.type);
          return;
      }
      
      this.agentContext.emit('message', chatMessage);
      
    } else if (this.chatAgent) {
      // Fallback to old method
      const isActive = this.planExecution.state !== 'idle';
      
      this.chatAgent.handleOrchestratorMessage({
        ...message,
        orchestratorId: this.id,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        isActive: isActive
      });
      
      if (message.type === 'orchestrator_complete' && message.wasActive) {
        this.chatAgent.orchestratorActive = false;
        this.currentTask = null;
      }
    } else {
      console.warn('TaskOrchestrator: No way to send message');
    }
  }
  
  /**
   * Send thought to user via ChatAgent
   */
  sendThoughtToUser(thought) {
    if (this.agentContext) {
      this.agentContext.emit('agent_thought', {
        type: 'agent_thought',
        thought: thought,
        sessionId: this.agentContext.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.planExecution.clearTimers();
    this.planExecutionEngine.clearResources();
    this.currentTask = null;
    this.chatAgent = null;
    console.log(`TaskOrchestrator ${this.id} destroyed`);
  }
}