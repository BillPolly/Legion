import { Actor } from '../../../shared/actors/src/Actor.js';

/**
 * TaskOrchestrator - Backend agent that handles complex, multi-step tasks
 * 
 * This is an internal actor that works exclusively with ChatAgent to handle
 * complex tasks that require planning and orchestration. It does not have
 * a frontend counterpart - all UI communication goes through ChatAgent.
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
    
    // Task state
    this.state = 'idle'; // idle, working, paused
    this.currentTask = null;
    this.progress = 0;
    this.startTime = null;
    
    // Timers for simulated work
    this.workTimers = [];
    
    console.log(`TaskOrchestrator ${this.id} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Initialize the orchestrator
   */
  async initialize() {
    // Future: Load planning modules, etc.
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
  async receive(payload, envelope) {
    console.log('TaskOrchestrator: Received message:', payload);
    
    if (payload && typeof payload === 'object') {
      switch (payload.type) {
        case 'start_task':
          await this.startTask(payload);
          break;
          
        case 'user_message':
          await this.handleUserMessage(payload);
          break;
          
        case 'pause_task':
          this.pauseTask();
          break;
          
        case 'cancel_task':
          this.cancelTask();
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
    if (this.state !== 'idle') {
      this.sendToChatAgent({
        type: 'orchestrator_error',
        message: 'I\'m already working on a task. Please wait for it to complete or cancel it first.',
        currentTask: this.currentTask?.description
      });
      return;
    }
    
    this.state = 'working';
    this.currentTask = {
      description: payload.description || 'Complex task',
      context: payload.context || {},
      conversationHistory: payload.conversationHistory || []
    };
    this.progress = 0;
    this.startTime = Date.now();
    
    // Send initial acknowledgment
    this.sendToChatAgent({
      type: 'orchestrator_status',
      message: 'I\'m analyzing your complex request and preparing a plan to tackle it. This might take a moment...',
      progress: 0
    });
    
    // Simulate planning and execution phases
    this.simulateWork();
  }
  
  /**
   * Handle user messages while working
   */
  async handleUserMessage(payload) {
    const userMessage = payload.content || '';
    
    if (this.state === 'idle') {
      this.sendToChatAgent({
        type: 'orchestrator_status',
        message: 'I\'m not currently working on any task.'
      });
      return;
    }
    
    // Check for control commands
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('cancel') || lowerMessage.includes('stop')) {
      this.cancelTask();
      return;
    }
    
    if (lowerMessage.includes('pause')) {
      this.pauseTask();
      return;
    }
    
    if (lowerMessage.includes('resume') && this.state === 'paused') {
      this.resumeTask();
      return;
    }
    
    // Status queries
    if (lowerMessage.includes('status') || lowerMessage.includes('progress') || 
        lowerMessage.includes('how') || lowerMessage.includes('what')) {
      const elapsed = Math.round((Date.now() - this.startTime) / 1000);
      this.sendToChatAgent({
        type: 'orchestrator_status',
        message: `I'm ${this.getPhaseDescription()}. Progress: ${this.progress}% complete. Time elapsed: ${elapsed} seconds.`,
        progress: this.progress
      });
      return;
    }
    
    // Default response
    this.sendToChatAgent({
      type: 'orchestrator_status',
      message: `I'm currently ${this.getPhaseDescription()}. You can ask for 'status', 'pause', or 'cancel' the task.`,
      progress: this.progress
    });
  }
  
  /**
   * Get current phase description based on progress
   */
  getPhaseDescription() {
    if (this.progress < 25) return 'analyzing the requirements';
    if (this.progress < 50) return 'planning the approach';
    if (this.progress < 75) return 'setting up the execution';
    return 'finalizing the task';
  }
  
  /**
   * Simulate work with progress updates
   */
  simulateWork() {
    // Clear any existing timers
    this.clearTimers();
    
    // Phase 1: Analysis (0-25%)
    this.workTimers.push(setTimeout(() => {
      if (this.state === 'working') {
        this.progress = 25;
        this.sendToChatAgent({
          type: 'orchestrator_update',
          message: 'I\'ve analyzed the requirements. Now planning the approach...',
          progress: 25
        });
      }
    }, 2000));
    
    // Phase 2: Planning (25-50%)
    this.workTimers.push(setTimeout(() => {
      if (this.state === 'working') {
        this.progress = 50;
        this.sendToChatAgent({
          type: 'orchestrator_update',
          message: 'Planning complete. Beginning execution setup...',
          progress: 50
        });
      }
    }, 4000));
    
    // Phase 3: Execution setup (50-75%)
    this.workTimers.push(setTimeout(() => {
      if (this.state === 'working') {
        this.progress = 75;
        this.sendToChatAgent({
          type: 'orchestrator_update',
          message: 'Execution framework ready. Finalizing the task...',
          progress: 75
        });
      }
    }, 6000));
    
    // Phase 4: Completion (75-100%)
    this.workTimers.push(setTimeout(() => {
      if (this.state === 'working') {
        this.completeTask();
      }
    }, 8000));
  }
  
  /**
   * Pause the current task
   */
  pauseTask() {
    if (this.state !== 'working') return;
    
    this.state = 'paused';
    this.clearTimers();
    
    this.sendToChatAgent({
      type: 'orchestrator_status',
      message: 'Task paused. Say "resume" to continue.',
      progress: this.progress
    });
  }
  
  /**
   * Resume a paused task
   */
  resumeTask() {
    if (this.state !== 'paused') return;
    
    this.state = 'working';
    
    this.sendToChatAgent({
      type: 'orchestrator_status',
      message: 'Resuming task...',
      progress: this.progress
    });
    
    // Continue from where we left off
    const remainingTime = 8000 - (this.progress * 80); // 8 seconds total, scale by progress
    this.workTimers.push(setTimeout(() => {
      if (this.state === 'working') {
        this.completeTask();
      }
    }, remainingTime));
  }
  
  /**
   * Cancel the current task
   */
  cancelTask() {
    if (this.state === 'idle') return;
    
    this.clearTimers();
    this.state = 'idle';
    this.currentTask = null;
    this.progress = 0;
    
    this.sendToChatAgent({
      type: 'orchestrator_complete',
      message: 'Task cancelled.',
      success: false,
      wasActive: true
    });
  }
  
  /**
   * Complete the current task
   */
  completeTask() {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    
    this.state = 'idle';
    this.progress = 100;
    
    this.sendToChatAgent({
      type: 'orchestrator_complete',
      message: `Task completed successfully! The complex task "${this.currentTask.description}" has been fully planned and prepared for execution. Total time: ${elapsed} seconds.`,
      success: true,
      wasActive: true,
      taskSummary: {
        description: this.currentTask.description,
        duration: elapsed,
        phases: ['Analysis', 'Planning', 'Execution Setup', 'Finalization']
      }
    });
    
    // Reset state
    this.currentTask = null;
    this.progress = 0;
    this.clearTimers();
  }
  
  /**
   * Send message to ChatAgent
   */
  sendToChatAgent(message) {
    if (this.chatAgent) {
      this.chatAgent.handleOrchestratorMessage({
        ...message,
        orchestratorId: this.id,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('TaskOrchestrator: No ChatAgent reference to send message');
    }
  }
  
  /**
   * Clear all work timers
   */
  clearTimers() {
    this.workTimers.forEach(timer => clearTimeout(timer));
    this.workTimers = [];
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.clearTimers();
    this.state = 'idle';
    this.currentTask = null;
    this.chatAgent = null;
    console.log(`TaskOrchestrator ${this.id} destroyed`);
  }
}