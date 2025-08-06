/**
 * TaskOrchestratorTestActor - Standalone test harness for TaskOrchestrator
 * 
 * This actor provides a complete testing environment for TaskOrchestrator
 * without requiring the Aiur server. It provides mock implementations
 * of all required dependencies and implements the full actor protocol.
 */

import { Actor } from '../../../../../shared/actors/src/Actor.js';
import { TaskOrchestrator } from '../TaskOrchestrator.js';
import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import { EventEmitter } from 'events';

export class TaskOrchestratorTestActor extends Actor {
  constructor(options = {}) {
    super();
    this.options = options;
    this.resourceManager = null;
    this.moduleLoader = null;
    this.taskOrchestrator = null;
    this.mockChatAgent = null;
    this.messages = [];
    this.thoughts = [];
    this.artifacts = [];
    this.initialized = false;
  }
  
  /**
   * Initialize the test actor and create TaskOrchestrator
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Create ResourceManager and ModuleLoader
      await this.createResourceManager();
      await this.createModuleLoader();
      
      // Create mock chat agent
      this.mockChatAgent = this.createMockChatAgent();
      
      // Create mock artifact manager
      const mockArtifactManager = this.createMockArtifactManager();
      
      // Create TaskOrchestrator with all dependencies
      this.taskOrchestrator = new TaskOrchestrator({
        sessionId: 'test-session-001',
        chatAgent: this.mockChatAgent,
        resourceManager: this.resourceManager,
        moduleLoader: this.moduleLoader,
        artifactManager: mockArtifactManager
      });
      
      // Initialize the orchestrator
      await this.taskOrchestrator.initialize();
      
      this.initialized = true;
      console.log('TaskOrchestratorTestActor: Initialized successfully');
      
    } catch (error) {
      console.error('TaskOrchestratorTestActor: Failed to initialize:', error);
      throw error;
    }
  }
  
  /**
   * Create ResourceManager with environment variables
   */
  async createResourceManager() {
    this.resourceManager = new ResourceManager();
    await this.resourceManager.initialize();
    
    // The ResourceManager automatically loads .env file
    console.log('TaskOrchestratorTestActor: ResourceManager created');
  }
  
  /**
   * Create ModuleLoader and load essential modules
   */
  async createModuleLoader() {
    this.moduleLoader = new ModuleLoader(this.resourceManager);
    await this.moduleLoader.initialize();
    
    // Load essential modules for testing
    const registryResult = await this.moduleLoader.loadAllFromRegistry();
    console.log(`TaskOrchestratorTestActor: Loaded ${registryResult.successful.length} modules from registry`);
    
    // Load ProfilePlannerModule for plan generation
    try {
      const { ProfilePlannerModule } = await import('@legion/profile-planner');
      const profilePlannerModule = await ProfilePlannerModule.create(this.resourceManager);
      
      // Register the module and its tools directly
      this.moduleLoader.loadedModules.set('profile-planner', profilePlannerModule);
      await this.moduleLoader._registerModuleTools(profilePlannerModule, 'profile-planner');
      console.log('TaskOrchestratorTestActor: ProfilePlannerModule loaded');
    } catch (error) {
      console.warn('TaskOrchestratorTestActor: Failed to load ProfilePlannerModule:', error.message);
    }
  }
  
  /**
   * Create mock ChatAgent for testing
   */
  createMockChatAgent() {
    return {
      orchestratorActive: false,
      
      handleOrchestratorMessage: (message) => {
        this.messages.push({
          ...message,
          timestamp: new Date().toISOString(),
          source: 'orchestrator'
        });
        console.log('MockChatAgent received:', message.type, message.message);
      },
      
      sendArtifactEventToDebugActor: (eventType, data) => {
        this.artifacts.push({
          eventType,
          data,
          timestamp: new Date().toISOString()
        });
        console.log('MockChatAgent artifact event:', eventType, data);
      }
    };
  }
  
  /**
   * Create mock ArtifactManager for testing
   */
  createMockArtifactManager() {
    const artifacts = new Map();
    let artifactCounter = 0;
    
    return {
      registerArtifact: (artifact) => {
        artifactCounter++;
        const registeredArtifact = {
          ...artifact,
          id: `artifact-${artifactCounter}`,
          registeredAt: new Date().toISOString()
        };
        artifacts.set(registeredArtifact.id, registeredArtifact);
        console.log('MockArtifactManager: Registered artifact:', registeredArtifact.label);
        return registeredArtifact;
      },
      
      getArtifactsByType: (type) => {
        return Array.from(artifacts.values()).filter(a => a.type === type);
      },
      
      getArtifact: (id) => {
        return artifacts.get(id);
      },
      
      listAllArtifacts: () => {
        return Array.from(artifacts.values());
      }
    };
  }
  
  /**
   * Handle messages via actor protocol
   */
  async receive(payload) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log('TaskOrchestratorTestActor: Received message:', payload);
    
    // Create mock agent context for messages
    const mockAgentContext = this.createMockAgentContext();
    
    // Forward message to TaskOrchestrator with mock context
    const orchestratorPayload = {
      ...payload,
      agentContext: mockAgentContext
    };
    
    await this.taskOrchestrator.receive(orchestratorPayload);
  }
  
  /**
   * Create mock agent context that captures events
   */
  createMockAgentContext() {
    const eventEmitter = new EventEmitter();
    
    // Capture all events
    eventEmitter.on('message', (message) => {
      this.messages.push({
        ...message,
        source: 'agentContext'
      });
      console.log('MockAgentContext message:', message.type, message.content);
    });
    
    eventEmitter.on('agent_thought', (thought) => {
      this.thoughts.push({
        ...thought,
        source: 'agentContext'
      });
      console.log('MockAgentContext thought:', thought.thought);
    });
    
    return eventEmitter;
  }
  
  /**
   * Start a planning task via actor protocol
   */
  async startPlanningTask(taskDescription, options = {}) {
    const payload = {
      type: 'start_task',
      description: taskDescription,
      ...options
    };
    
    await this.receive(payload);
  }
  
  /**
   * Execute a plan via actor protocol
   */
  async executePlan(plan, options = {}) {
    const payload = {
      type: 'execute_plan',
      plan: plan,
      options: options
    };
    
    await this.receive(payload);
  }
  
  /**
   * Send user message via actor protocol
   */
  async sendUserMessage(content) {
    const payload = {
      type: 'user_message',
      content: content
    };
    
    await this.receive(payload);
  }
  
  /**
   * Get all captured messages
   */
  getMessages() {
    return [...this.messages];
  }
  
  /**
   * Get all captured thoughts
   */
  getThoughts() {
    return [...this.thoughts];
  }
  
  /**
   * Get all captured artifacts
   */
  getArtifacts() {
    return [...this.artifacts];
  }
  
  /**
   * Get current orchestrator state
   */
  getOrchestratorState() {
    if (!this.taskOrchestrator) return null;
    
    return {
      planningState: this.taskOrchestrator.planExecution.state,
      executionState: this.taskOrchestrator.planExecutionEngine.state,
      currentTask: this.taskOrchestrator.currentTask,
      hasValidationResult: !!this.taskOrchestrator.planExecution.validationResult
    };
  }
  
  /**
   * Wait for orchestrator to reach a specific state
   */
  async waitForState(targetState, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkState = () => {
        const state = this.getOrchestratorState();
        
        if (state && (state.planningState === targetState || state.executionState === targetState)) {
          resolve(state);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for state: ${targetState}`));
          return;
        }
        
        setTimeout(checkState, 100);
      };
      
      checkState();
    });
  }
  
  /**
   * Wait for specific message type
   */
  async waitForMessage(messageType, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const initialMessageCount = this.messages.length;
      
      const checkMessages = () => {
        const newMessages = this.messages.slice(initialMessageCount);
        const found = newMessages.find(msg => msg.type === messageType);
        
        if (found) {
          resolve(found);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for message: ${messageType}`));
          return;
        }
        
        setTimeout(checkMessages, 100);
      };
      
      checkMessages();
    });
  }
  
  /**
   * Reset test state
   */
  reset() {
    this.messages = [];
    this.thoughts = [];
    this.artifacts = [];
    
    if (this.taskOrchestrator) {
      this.taskOrchestrator.planExecution.cancel();
      this.taskOrchestrator.planExecutionEngine.cancel();
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.taskOrchestrator) {
      this.taskOrchestrator.destroy();
    }
    
    this.resourceManager = null;
    this.moduleLoader = null;
    this.taskOrchestrator = null;
    this.mockChatAgent = null;
    this.initialized = false;
    
    console.log('TaskOrchestratorTestActor: Destroyed');
  }
}