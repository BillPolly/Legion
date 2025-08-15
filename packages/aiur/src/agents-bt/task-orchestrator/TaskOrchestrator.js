import { Actor } from '../../../../shared/actors/src/Actor.js';
import { UserInteractionHandler } from './UserInteractionHandler.js';
import { BehaviorTreeExecutor } from '../../../../shared/actor-BT/src/core/BehaviorTreeExecutor.js';

/**
 * TaskOrchestrator - Backend agent that handles complex, multi-step tasks
 * 
 * This is an internal actor that works exclusively with ChatAgent to handle
 * complex tasks that require planning and orchestration. It does not have
 * a frontend counterpart - all UI communication goes through ChatAgent.
 * 
 * Architecture:
 * - UserInteractionHandler: Manages all user interactions and controls execution
 * - BehaviorTreeExecutor: Directly executes behavior tree plans
 */
export class TaskOrchestrator extends Actor {
  constructor(config = {}) {
    super();
    
    // Agent identification
    this.id = `task-orchestrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId;
    
    // Reference to ChatAgent for sending updates
    this.chatAgent = config.chatAgent || null;
    
    // Tool access
    this.toolRegistry = config.toolRegistry || null;
    this.artifactManager = config.artifactManager || null;
    
    // LLM access (will come from ChatAgent)
    this.llmClient = null;
    
    // Internal components
    this.interactionHandler = new UserInteractionHandler(this);
    this.behaviorTreeExecutor = null; // Created lazily when needed
    
    // Task state
    this.currentTask = null;
    this.executionState = 'idle'; // 'idle', 'executing', 'paused', 'complete', 'failed'
    
    console.log(`TaskOrchestrator ${this.id} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Initialize the orchestrator
   */
  async initialize() {
    console.log('TaskOrchestrator: Initialized with ToolRegistry');
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
    if (this.executionState !== 'idle') {
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
    
    // Use proper profile planning and execution
    await this.createAndExecutePlan(this.currentTask.description);
  }
  
  /**
   * Execute a validated plan
   */
  async executePlan(payload) {
    if (this.executionState !== 'idle') {
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
          currentState: this.executionState
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
    
    // Execute the plan directly with BehaviorTreeExecutor
    await this.executeBehaviorTree(plan, options);
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
          this.executionState = 'idle';
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
      const isActive = this.executionState !== 'idle';
      
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
        this.executionState = 'idle';
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
   * Create and execute a plan using ProfilePlanner and BehaviorTreeExecutor
   */
  async createAndExecutePlan(description) {
    try {
      this.executionState = 'executing';
      
      this.sendToChatAgent({
        type: 'orchestrator_status',
        message: `🧠 Analyzing task and creating plan...\n\n📋 Task: ${description}\n\nDetermining best approach...`,
        progress: 5
      });

      // Import new clean Planner  
      const { Planner } = await import('../../../../planning/planner/src/core/Planner.js');
      const { ResourceManager } = await import('@legion/tools-registry');
      const { Anthropic } = await import('@anthropic-ai/sdk');
      
      // Initialize ResourceManager to get API key
      const resourceManager = new ResourceManager();
      await resourceManager.initialize();
      const apiKey = resourceManager.get('ANTHROPIC_API_KEY');
      
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not found for planning');
      }
      
      // Create LLM client for planner
      const anthropic = new Anthropic({ apiKey });
      const llmClient = {
        complete: async (prompt, options = {}) => {
          const response = await anthropic.messages.create({
            model: options.model || 'claude-3-5-sonnet-20241022',
            max_tokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.2,
            system: options.system || '',
            messages: [{ role: 'user', content: prompt }]
          });
          return response.content[0].text;
        }
      };
      
      // Create planner instance with LLM client - it will get tools as needed
      const planner = new Planner({ llmClient });
      
      this.sendToChatAgent({
        type: 'orchestrator_update', 
        message: 'Using clean planner with available tool registry...',
        progress: 15
      });
      
      // Create plan using simple API
      const planResult = await planner.makePlan(description);
      
      if (!planResult.success) {
        throw new Error(`Planning failed: ${planResult.error}`);
      }
      
      this.sendToChatAgent({
        type: 'orchestrator_update',
        message: `✅ Plan created successfully!\n\n📊 Plan Details:\n• ${planResult.data.nodeCount} total nodes\n• ${planResult.data.attempts} attempt(s)\n• Ready for execution...`,
        progress: 25
      });
      
      // Execute the behavior tree directly
      await this.executeBehaviorTree(planResult.data.plan, {
        workspaceDir: process.cwd(),
        sessionId: this.sessionId
      });
      
    } catch (error) {
      console.error('TaskOrchestrator: Planning/execution error:', error);
      this.executionState = 'failed';
      this.sendToChatAgent({
        type: 'orchestrator_error',
        message: `Failed to create or execute plan: ${error.message}`
      });
      this.executionState = 'idle';
    }
  }
  
  /**
   * Execute a behavior tree using BehaviorTreeExecutor
   */
  async executeBehaviorTree(behaviorTreeData, options = {}) {
    try {
      this.executionState = 'executing';
      
      this.sendToChatAgent({
        type: 'orchestrator_update',
        message: `🤖 Creating behavior tree executor with ${behaviorTreeData.children?.length || 0} nodes...`,
        progress: 30
      });
      
      // Create BehaviorTreeExecutor if not already created
      if (!this.behaviorTreeExecutor) {
        this.behaviorTreeExecutor = new BehaviorTreeExecutor(this.toolRegistry);
      }
      
      // Set up event listeners for progress tracking
      this.setupBTEventListeners();
      
      this.sendToChatAgent({
        type: 'orchestrator_update',
        message: `⚡ Starting behavior tree execution...`,
        progress: 50
      });
      
      // Execute the behavior tree with context
      const result = await this.behaviorTreeExecutor.executeTree(behaviorTreeData, {
        workspaceDir: options.workspaceDir || process.cwd(),
        sessionId: this.sessionId,
        artifactActor: this.agentContext?.artifactActor,
        ...options
      });
      
      // Handle completion
      if (result.success) {
        this.executionState = 'complete';
        this.sendToChatAgent({
          type: 'orchestrator_complete',
          message: `✅ Task completed successfully!\n\nBehavior tree executed:\n• Status: ${result.status}\n• Execution time: ${Math.round(result.executionTime / 1000)}s\n• Total nodes: ${Object.keys(result.nodeResults).length}`,
          success: true,
          wasActive: true,
          taskSummary: {
            success: result.success,
            status: result.status,
            executionTime: result.executionTime,
            nodeCount: Object.keys(result.nodeResults).length
          }
        });
      } else {
        this.executionState = 'failed';
        this.sendToChatAgent({
          type: 'orchestrator_complete',
          message: `❌ Task failed:\n\nBehavior tree execution:\n• Status: ${result.status}\n• Error: ${result.error}\n• Execution time: ${Math.round(result.executionTime / 1000)}s`,
          success: false,
          wasActive: true,
          taskSummary: {
            success: result.success,
            status: result.status,
            executionTime: result.executionTime,
            error: result.error
          }
        });
      }
      
      this.executionState = 'idle';
      
    } catch (error) {
      console.error('TaskOrchestrator: BT execution error:', error);
      this.executionState = 'failed';
      this.sendToChatAgent({
        type: 'orchestrator_error',
        message: `Behavior tree execution failed: ${error.message}`
      });
      this.executionState = 'idle';
    }
  }
  
  /**
   * Set up event listeners for BehaviorTreeExecutor
   */
  setupBTEventListeners() {
    if (!this.behaviorTreeExecutor) return;
    
    // Remove any existing listeners to avoid duplicates
    this.behaviorTreeExecutor.removeAllListeners('tree:start');
    this.behaviorTreeExecutor.removeAllListeners('tree:complete');
    this.behaviorTreeExecutor.removeAllListeners('tree:error');
    
    this.behaviorTreeExecutor.on('tree:start', (data) => {
      this.sendToChatAgent({
        type: 'orchestrator_update',
        message: `🚀 Executing behavior tree: ${data.treeName}\n• Total nodes: ${data.nodeCount}\n• Starting execution...`,
        progress: 40
      });
    });
    
    this.behaviorTreeExecutor.on('tree:complete', (data) => {
      // Note: Final completion message is sent by executeBehaviorTree method
      this.sendThoughtToUser(`✅ Behavior tree execution completed: ${data.success ? 'SUCCESS' : 'FAILED'}`);
    });
    
    this.behaviorTreeExecutor.on('tree:error', (data) => {
      this.sendThoughtToUser(`❌ Behavior tree execution error: ${data.error}`);
    });
  }
  
  /**
   * Get current execution status
   */
  getStatus() {
    switch (this.executionState) {
      case 'idle':
        return 'Ready to execute tasks';
      case 'executing':
        return 'Executing behavior tree...';
      case 'paused':
        return 'Execution paused';
      case 'complete':
        return 'Last execution completed successfully';
      case 'failed':
        return 'Last execution failed';
      default:
        return `Unknown state: ${this.executionState}`;
    }
  }
  
  /**
   * Pause execution (if possible)
   */
  pause() {
    if (this.executionState === 'executing') {
      this.executionState = 'paused';
      this.sendToChatAgent({
        type: 'orchestrator_status',
        message: 'Execution pause requested (will pause after current step completes)'
      });
    }
  }
  
  /**
   * Resume execution
   */
  resume() {
    if (this.executionState === 'paused') {
      this.executionState = 'executing';
      this.sendToChatAgent({
        type: 'orchestrator_status',
        message: 'Resuming execution...'
      });
    }
  }
  
  /**
   * Cancel execution
   */
  cancel() {
    if (this.executionState === 'executing' || this.executionState === 'paused') {
      this.executionState = 'idle';
      this.currentTask = null;
      
      this.sendToChatAgent({
        type: 'orchestrator_status',
        message: 'Task execution cancelled'
      });
    }
  }


  /**
   * Clean up resources
   */
  async destroy() {
    if (this.behaviorTreeExecutor) {
      await this.behaviorTreeExecutor.shutdown();
      this.behaviorTreeExecutor = null;
    }
    this.currentTask = null;
    this.chatAgent = null;
    this.executionState = 'idle';
    console.log(`TaskOrchestrator ${this.id} destroyed`);
  }
}