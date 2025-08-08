import { Actor } from '../../../../shared/actors/src/Actor.js';
import { UserInteractionHandler } from './UserInteractionHandler.js';
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
    
    // Tool access
    this.toolRegistry = config.toolRegistry || null;
    this.artifactManager = config.artifactManager || null;
    
    // LLM access (will come from ChatAgent)
    this.llmClient = null;
    
    // Internal components
    this.interactionHandler = new UserInteractionHandler(this);
    this.planExecutionEngine = new PlanExecutionEngine(this);
    
    // Task state
    this.currentTask = null;
    
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
    if (this.planExecutionEngine.state !== 'idle') {
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
      const isActive = this.planExecutionEngine.state !== 'idle';
      
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
   * Create and execute a plan using ProfilePlanner
   */
  async createAndExecutePlan(description) {
    try {
      this.sendToChatAgent({
        type: 'orchestrator_status',
        message: `🧠 Analyzing task and creating plan...\n\n📋 Task: ${description}\n\nDetermining best approach...`,
        progress: 5
      });

      // Import ProfilePlanner directly  
      const { ProfilePlannerTool } = await import('../../../../planning/profile-planner/src/tools/ProfilePlannerTool.js');
      
      // Create planner instance with our toolRegistry
      const planner = new ProfilePlannerTool({ toolRegistry: this.toolRegistry });
      await planner.initialize();
      
      this.sendToChatAgent({
        type: 'orchestrator_update', 
        message: 'Using javascript-development profile for planning...',
        progress: 15
      });
      
      // Create plan using javascript-development profile
      const planResult = await planner.execute({
        function: {
          name: 'plan_with_profile',
          arguments: JSON.stringify({
            profile: 'javascript-development',
            task: description
          })
        }
      });
      
      if (!planResult.success) {
        throw new Error(`Planning failed: ${planResult.error}`);
      }
      
      this.sendToChatAgent({
        type: 'orchestrator_update',
        message: `✅ Plan created successfully!\n\n📋 Profile: ${planResult.data.profile}\n• ${planResult.data.behaviorTree?.children?.length || 0} execution steps\n• Ready for execution...`,
        progress: 25
      });
      
      // Execute the BT directly using BehaviorTreeExecutor
      const behaviorTreeData = planResult.data.behaviorTree;
      
      this.sendToChatAgent({
        type: 'orchestrator_update',
        message: `🤖 Creating behavior tree executor with ${behaviorTreeData.children?.length || 0} nodes...`,
        progress: 30
      });
      
      // Import and create BehaviorTreeExecutor directly
      const { BehaviorTreeExecutor } = await import('../../../../shared/actor-BT/src/core/BehaviorTreeExecutor.js');
      
      // Use the existing toolRegistry
      const toolRegistry = this.toolRegistry;
      
      const btExecutor = new BehaviorTreeExecutor(toolRegistry);
      
      // Set up event listeners for progress tracking
      btExecutor.on('tree:start', (data) => {
        this.sendToChatAgent({
          type: 'orchestrator_update',
          message: `🚀 Executing behavior tree: ${data.treeName}\n• Total nodes: ${data.nodeCount}\n• Starting execution...`,
          progress: 40
        });
      });
      
      btExecutor.on('tree:complete', (data) => {
        this.sendToChatAgent({
          type: 'orchestrator_complete',
          message: `✅ Task completed successfully!\n\nBehavior tree executed:\n• Status: ${data.success ? 'SUCCESS' : 'FAILED'}\n• Execution time: ${Math.round(data.executionTime / 1000)}s\n• Total nodes: ${data.nodeResults ? Object.keys(data.nodeResults).length : 0}`,
          taskSummary: {
            success: data.success,
            status: data.status,
            executionTime: data.executionTime,
            nodeCount: data.nodeResults ? Object.keys(data.nodeResults).length : 0
          }
        });
      });
      
      btExecutor.on('tree:error', (data) => {
        this.sendToChatAgent({
          type: 'orchestrator_error',
          message: `❌ Behavior tree execution failed:\n${data.error}\n\nExecution time: ${Math.round(data.executionTime / 1000)}s`
        });
      });
      
      this.sendToChatAgent({
        type: 'orchestrator_update',
        message: `⚡ Starting behavior tree execution...`,
        progress: 50
      });
      
      // Execute the behavior tree with context
      const result = await btExecutor.executeTree(behaviorTreeData, {
        workspaceDir: process.cwd(),
        sessionId: this.sessionId
      });
      
    } catch (error) {
      console.error('TaskOrchestrator: Planning/execution error:', error);
      this.sendToChatAgent({
        type: 'orchestrator_error',
        message: `Failed to create or execute plan: ${error.message}`
      });
    }
  }
  
  /**
   * Convert BT format to standard plan format
   */
  convertBTToStandardPlan(behaviorTree) {
    if (!behaviorTree || !behaviorTree.nodes) {
      throw new Error('Invalid behavior tree structure');
    }
    
    const plan = {
      id: behaviorTree.id || `plan_${Date.now()}`,
      name: behaviorTree.name || 'Generated Plan',
      description: behaviorTree.description || 'Profile-generated plan',
      steps: [],
      metadata: {
        profile: 'javascript-development',
        createdAt: new Date().toISOString()
      }
    };
    
    // Convert BT nodes to plan steps
    behaviorTree.nodes.forEach((node, index) => {
      if (node.type === 'action') {
        plan.steps.push({
          id: node.id || `step_${index}`,
          name: node.name || `Step ${index + 1}`,
          actions: [{
            type: node.actionType || node.toolName,
            inputs: node.parameters || node.inputs || {}
          }]
        });
      }
    });
    
    return plan;
  }


  /**
   * Clean up resources
   */
  destroy() {
    this.planExecutionEngine.clearResources();
    this.currentTask = null;
    this.chatAgent = null;
    console.log(`TaskOrchestrator ${this.id} destroyed`);
  }
}