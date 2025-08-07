/**
 * ChatBTAgent - Behavior Tree-based Chat Agent
 * 
 * A next-generation chat agent built on the BT framework, providing
 * configurable, composable, and extensible conversation handling.
 */

import { BTAgentBase } from '../core/BTAgentBase.js';
import { ArtifactManager } from '../../agents/artifacts/ArtifactManager.js';
import { TaskOrchestrator } from '../../agents/task-orchestrator/TaskOrchestrator.js';

export class ChatBTAgent extends BTAgentBase {
  constructor(config = {}) {
    super({
      ...config,
      agentType: 'chat',
      configPath: config.configPath || 'chat-agent.json'
    });
    
    // Chat-specific components
    this.conversationHistory = [];
    this.isProcessing = false;
    
    // LLM configuration 
    this.llmConfig = {
      provider: config.provider || 'anthropic',
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxRetries: config.maxRetries || 3,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000
    };
    
    // Initialize systems that ChatAgent needs
    this.artifactManager = new ArtifactManager({ sessionId: this.sessionId });
    this.taskOrchestrator = null; // Will be initialized later
    this.artifactActor = null; // Will be set by ServerActorSpace
    
    // Voice configuration
    this.voiceEnabled = false;
    this.voicePreferences = {
      enabled: false,
      voice: 'nova',
      autoPlay: false
    };
    
    // System prompt for the assistant
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
    
    console.log(`ChatBTAgent ${this.agentId} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Agent-specific initialization
   */
  async initializeAgent() {
    // Initialize LLM client
    await this.initializeLLMClient();
    
    // Load common modules
    await this.loadCommonModules();
    
    // Initialize artifact actor if available
    if (this.artifactActor) {
      await this.artifactActor.initialize();
    }
    
    // Initialize task orchestrator
    this.taskOrchestrator = new TaskOrchestrator({
      sessionId: this.sessionId,
      chatAgent: this,
      resourceManager: this.resourceManager,
      moduleLoader: this.moduleLoader,
      artifactManager: this.artifactManager
    });
    await this.taskOrchestrator.initialize();
    this.taskOrchestrator.setChatAgent(this);
    
    // Load voice module if available
    await this.loadVoiceModule();
    
    console.log(`ChatBTAgent ${this.agentId} fully initialized`);
  }
  
  /**
   * Initialize LLM client
   */
  async initializeLLMClient() {
    try {
      if (!this.resourceManager) {
        console.error('ChatBTAgent: No ResourceManager provided, cannot create LLMClient');
        return;
      }
      
      this.llmClient = await this.resourceManager.createLLMClient({
        provider: this.llmConfig.provider,
        model: this.llmConfig.model,
        maxRetries: this.llmConfig.maxRetries
      });
      
      console.log(`ChatBTAgent: LLM client initialized (${this.llmConfig.provider})`);
      
    } catch (error) {
      console.error('ChatBTAgent: Failed to initialize LLM client:', error);
    }
  }
  
  /**
   * Load common development modules
   */
  async loadCommonModules() {
    if (!this.moduleLoader) return;
    
    try {
      await this.moduleLoader.loadModuleByName('ai-generation');
      await this.moduleLoader.loadModuleByName('file-analysis');
      
      // Preload development modules
      const devModules = ['file', 'command-executor', 'node-runner', 'jester', 'js-generator', 'code-analysis'];
      for (const moduleName of devModules) {
        try {
          await this.moduleLoader.loadModuleByName(moduleName);
        } catch (error) {
          console.warn(`ChatBTAgent: Failed to load ${moduleName}:`, error.message);
        }
      }
      
      console.log('ChatBTAgent: Common modules loaded');
      
    } catch (error) {
      console.warn('ChatBTAgent: Error loading common modules:', error);
    }
  }
  
  /**
   * Load voice module
   */
  async loadVoiceModule() {
    try {
      const VoiceModule = (await import('../../../voice/src/VoiceModule.js')).default;
      const voiceModule = await VoiceModule.create(this.resourceManager);
      
      // Register with module loader
      this.moduleLoader.loadedModules.set('voice', voiceModule);
      
      // Register voice tools
      const voiceTools = voiceModule.getTools();
      for (const tool of voiceTools) {
        if (tool && tool.name) {
          this.moduleLoader.toolRegistry.set(tool.name, tool);
        }
      }
      
      this.voiceEnabled = true;
      console.log('ChatBTAgent: Voice module loaded successfully');
      
    } catch (error) {
      console.warn('ChatBTAgent: Voice module failed to load:', error.message);
      this.voiceEnabled = false;
    }
  }
  
  /**
   * Get agent-specific context for BT execution
   */
  getAgentSpecificContext(payload) {
    return {
      // Conversation state
      conversationHistory: this.conversationHistory,
      isProcessing: this.isProcessing,
      
      // LLM client and configuration
      llmClient: this.llmClient,
      llmConfig: this.llmConfig,
      systemPrompt: this.systemPrompt,
      
      // Artifact system
      artifactManager: this.artifactManager,
      artifactActor: this.artifactActor,
      
      // Task orchestration
      taskOrchestrator: this.taskOrchestrator,
      orchestratorActive: this.orchestratorActive || false,
      
      // Voice system
      voiceEnabled: this.voiceEnabled,
      voicePreferences: this.voicePreferences,
      
      // Helper functions
      emit: this.emit.bind(this),
      sendToRemote: this.sendToRemote.bind(this),
      
      // Agent metadata
      agentType: 'chat'
    };
  }
  
  /**
   * Process agent execution result
   */
  async processAgentResult(result, originalMessage) {
    // Update processing state
    this.isProcessing = false;
    
    // Send processing complete event
    this.emit('processing_complete', {
      type: 'chat_complete',
      sessionId: this.sessionId
    });
    
    // Handle conversation history updates
    if (result.context && result.context.conversationHistory) {
      this.conversationHistory = result.context.conversationHistory;
    }
  }
  
  /**
   * Process agent execution error
   */
  async processAgentError(error, originalMessage) {
    this.isProcessing = false;
    
    console.error('ChatBTAgent: Execution error:', error);
    
    // Send error to remote actor (already handled by base class)
    // Just update internal state here
  }
  
  /**
   * Emit function that sends messages through the remote actor
   */
  emit(eventName, data) {
    if (this.remoteActor) {
      this.remoteActor.receive({
        ...data,
        eventName: eventName
      });
    } else {
      console.warn(`ChatBTAgent: No remote actor to send ${eventName} event to`);
    }
  }
  
  /**
   * Set the ArtifactActor for artifact processing
   */
  setArtifactActor(artifactActor) {
    this.artifactActor = artifactActor;
    if (this.artifactActor && this.artifactManager) {
      this.artifactActor.artifactManager = this.artifactManager;
    }
  }
  
  /**
   * Handle voice preferences update
   */
  updateVoicePreferences(preferences) {
    this.voicePreferences = {
      enabled: preferences.enabled || false,
      voice: preferences.voice || 'nova',
      autoPlay: preferences.autoPlay || false
    };
    
    console.log('ChatBTAgent: Updated voice preferences:', this.voicePreferences);
  }
  
  /**
   * Get default configuration for chat agent
   */
  getDefaultConfiguration() {
    return {
      type: 'message_handler',
      name: 'ChatBTAgent_Workflow',
      debugMode: this.debugMode,
      routes: {
        // Main chat message handling
        'chat_message': {
          type: 'sequence',
          name: 'process_chat_message',
          children: [
            {
              type: 'conversation_manager',
              action: 'add_user_message'
            },
            {
              type: 'selector',
              name: 'response_strategy',
              children: [
                {
                  type: 'sequence',
                  name: 'complex_task_handling',
                  condition: 'requiresComplexHandling(message.content)',
                  children: [
                    {
                      type: 'tool_execution',
                      tool: 'handle_complex_task',
                      params: {
                        task_description: '{{message.content}}'
                      }
                    },
                    {
                      type: 'response_sender',
                      type: 'chat_response',
                      content: 'Task delegated to orchestrator'
                    }
                  ]
                },
                {
                  type: 'sequence',
                  name: 'standard_llm_interaction',
                  children: [
                    {
                      type: 'llm_interaction',
                      streaming: true,
                      tools: true,
                      temperature: this.llmConfig.temperature,
                      maxTokens: this.llmConfig.maxTokens
                    },
                    {
                      type: 'conversation_manager',
                      action: 'add_assistant_message'
                    },
                    {
                      type: 'response_sender',
                      type: 'chat_response'
                    }
                  ]
                }
              ]
            }
          ]
        },
        
        // History management
        'clear_history': {
          type: 'sequence',
          children: [
            {
              type: 'conversation_manager',
              action: 'clear_history'
            },
            {
              type: 'response_sender',
              type: 'chat_response',
              content: 'Conversation history cleared'
            }
          ]
        },
        
        'get_history': {
          type: 'sequence',
          children: [
            {
              type: 'conversation_manager',
              action: 'get_history',
              sendToRemote: true
            }
          ]
        },
        
        // Voice handling
        'voice_input': {
          type: 'sequence',
          name: 'process_voice_input',
          children: [
            {
              type: 'voice_integration',
              action: 'transcribe',
              params: {
                audio: '{{message.audio}}',
                format: '{{message.format}}'
              }
            },
            {
              type: 'message_handler',
              routes: {
                'transcription_success': {
                  type: 'process_chat_message' // Reuse chat processing
                }
              }
            }
          ]
        },
        
        'generate_speech': {
          type: 'voice_integration',
          action: 'synthesize',
          params: {
            text: '{{message.text}}',
            voice: '{{message.voice}}',
            messageId: '{{message.messageId}}'
          }
        },
        
        'voice_preferences': {
          type: 'sequence',
          children: [
            {
              type: 'update_voice_preferences'
            },
            {
              type: 'response_sender',
              type: 'status',
              content: 'Voice preferences updated'
            }
          ]
        }
      },
      
      // Default route for unrecognized messages
      defaultRoute: {
        type: 'sequence',
        children: [
          {
            type: 'error_handler',
            strategy: 'report'
          },
          {
            type: 'response_sender',
            type: 'error',
            content: 'Unknown message type: {{messageType}}'
          }
        ]
      },
      
      // Configuration options
      fallbackBehavior: 'error',
      logUnroutedMessages: true
    };
  }
  
  /**
   * Get default system prompt
   */
  getDefaultSystemPrompt() {
    return `You are a helpful AI assistant integrated into the Aiur development environment.

You can:
1. Have conversations and answer questions
2. Use tools when needed to perform actions like reading/writing files, running commands, etc.
3. Handle complex tasks that require multiple steps or planning

When the user asks you to perform an action (like writing a file, reading data, etc.), you should use the appropriate tool.
When the user just wants to chat or ask questions, respond conversationally.

IMPORTANT: Complex Task Detection
If the user asks for something complex that would require many steps or planning (examples: "build me a web app", "create a complete system", "implement a feature with tests", "design and implement a database schema", etc.), you should:
1. Recognize this is a complex task
2. Use the 'handle_complex_task' tool
3. Let the system handle the planning and step-by-step execution

IMPORTANT: When you need to use tools to fulfill a request:
- ALWAYS include a brief, conversational message to the user in your response
- This message should acknowledge their request and explain what you're about to do
- For example: "I'll help you read that file" or "Let me analyze that code for you"
- Include both your message AND the tool calls in the same response

You will automatically choose whether to use tools or just respond based on what the user needs.
Be concise but thorough in your responses. Use markdown formatting when appropriate.`;
  }
  
  /**
   * Get current agent status
   */
  getStatus() {
    const baseStatus = super.getStatus();
    
    return {
      ...baseStatus,
      conversationLength: this.conversationHistory.length,
      isProcessing: this.isProcessing,
      llmClientAvailable: !!this.llmClient,
      voiceEnabled: this.voiceEnabled,
      artifactManagerReady: !!this.artifactManager,
      taskOrchestratorReady: !!this.taskOrchestrator
    };
  }
  
  /**
   * Clean up resources
   */
  async destroy() {
    // Cleanup chat-specific resources
    this.conversationHistory = [];
    this.llmClient = null;
    
    // Cleanup artifact system
    if (this.artifactManager) {
      this.artifactManager.destroy();
      this.artifactManager = null;
    }
    
    if (this.artifactActor) {
      this.artifactActor.destroy();
      this.artifactActor = null;
    }
    
    // Cleanup task orchestrator
    if (this.taskOrchestrator) {
      this.taskOrchestrator.destroy();
      this.taskOrchestrator = null;
    }
    
    // Call parent cleanup
    await super.destroy();
    
    console.log(`ChatBTAgent ${this.agentId} destroyed`);
  }
}