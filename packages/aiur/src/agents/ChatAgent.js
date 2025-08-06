import { Actor } from '../../../shared/actors/src/Actor.js';
import { ArtifactManager } from './artifacts/ArtifactManager.js';
import { TaskOrchestrator } from './task-orchestrator/TaskOrchestrator.js';

/**
 * ChatAgent - Handles chat interactions with LLM as a backend actor
 * Maintains conversation history and manages streaming responses
 */
export class ChatAgent extends Actor {
  constructor(config = {}) {
    super();
    
    // Agent identification
    this.id = `chat-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId;
    
    // Reference to the remote actor (frontend ChatActor)
    this.remoteActor = config.remoteActor || null;
    
    // Tool access - sessionManager or moduleLoader
    this.sessionManager = config.sessionManager || null;
    this.moduleLoader = config.moduleLoader || null;
    
    // ResourceManager for getting LLMClient
    this.resourceManager = config.resourceManager || null;
    
    // Conversation state
    this.conversationHistory = [];
    this.isProcessing = false;
    this.initialized = false;
    
    // LLM configuration (NO API KEY HERE!)
    this.llmConfig = {
      provider: config.provider || 'anthropic',
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxRetries: config.maxRetries || 3,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000
    };
    
    // Initialize LLM client
    this.llmClient = null;
    
    // Initialize artifact system
    this.artifactManager = new ArtifactManager({ sessionId: this.sessionId });
    this.artifactActor = null; // Will be initialized later
    
    // Initialize task orchestrator
    this.taskOrchestrator = null; // Will be initialized later
    this.orchestratorActive = false;
    
    // Agent context - all capabilities that can be delegated
    this.agentContext = null; // Will be built after initialization
    
    // Voice configuration
    this.voiceEnabled = false;
    this.voicePreferences = {
      enabled: false,
      voice: 'nova',
      autoPlay: false
    };
    
    // System prompt for the assistant
    this.systemPrompt = config.systemPrompt || `You are a helpful AI assistant integrated into the Aiur development environment.

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
    
    console.log(`ChatAgent ${this.id} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Initialize the ChatAgent (must be called after construction)
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    await this.initializeLLMClient();
    await this.moduleLoader.loadModuleByName('ai-generation');
    await this.moduleLoader.loadModuleByName('file-analysis');
    
    // Preload common development modules for TaskOrchestrator
    console.log('ChatAgent: Preloading development modules...');
    const devModules = ['file', 'command-executor', 'node-runner', 'jester', 'js-generator', 'code-analysis'];
    for (const moduleName of devModules) {
      try {
        await this.moduleLoader.loadModuleByName(moduleName);
        console.log(`ChatAgent: Loaded ${moduleName}`);
      } catch (error) {
        console.warn(`ChatAgent: Failed to load ${moduleName}:`, error.message);
      }
    }
    
    // ArtifactActor will be set by ServerActorSpace
    // Ensure it's initialized if available
    if (this.artifactActor) {
      await this.artifactActor.initialize();
    }
    
    // Initialize TaskOrchestrator
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
    try {
      // For backend code, we can use the factory pattern directly with ResourceManager
      const VoiceModule = (await import('../../../voice/src/VoiceModule.js')).default;
      const voiceModule = await VoiceModule.create(this.resourceManager);
      
      // Register the module with the module loader
      this.moduleLoader.loadedModules.set('voice', voiceModule);
      
      // Register voice tools
      const voiceTools = voiceModule.getTools();
      for (const tool of voiceTools) {
        if (tool && tool.name) {
          this.moduleLoader.toolRegistry.set(tool.name, tool);
        }
      }
      
      console.log('ChatAgent: Voice module loaded successfully with', voiceTools.length, 'tools');
      this.voiceEnabled = true;
    } catch (error) {
      console.error('ChatAgent: Voice module failed to load:', error);
      console.error('Stack trace:', error.stack);
      this.voiceEnabled = false;
    }

    // Build the agent context after all components are initialized
    this.buildAgentContext();
    
    this.initialized = true;
  }
  
  /**
   * Build the agent context with all capabilities
   */
  buildAgentContext() {
    const self = this;
    this.agentContext = {
      // Communication
      emit: this.emit.bind(this),
      
      // LLM
      llmClient: this.llmClient,
      
      // Artifacts
      artifactManager: this.artifactManager,
      
      // Conversation (reference, not copy)
      get conversationHistory() { return self.conversationHistory; },
      
      // Session
      sessionId: this.sessionId,
      
      // Resources
      resourceManager: this.resourceManager,
      
      // Module loader reference (tools can be accessed via moduleLoader)
      moduleLoader: this.moduleLoader
    };
  }
  
  /**
   * Emit function that sends messages through the remote actor
   * This replaces EventEmitter.emit() with actor protocol communication
   */
  emit(eventName, data) {
    if (this.remoteActor) {
      // Send the event as a message to the remote actor
      this.remoteActor.receive({
        ...data,
        eventName: eventName  // Include event name for compatibility
      });
    } else {
      console.warn(`ChatAgent: No remote actor to send ${eventName} event to`);
    }
  }
  
  /**
   * Initialize the LLM client using ResourceManager
   */
  async initializeLLMClient() {
    try {
      if (!this.resourceManager) {
        console.error('ChatAgent: No ResourceManager provided, cannot create LLMClient');
        return;
      }
      
      // Request LLMClient from ResourceManager with our config (NO API KEY!)
      this.llmClient = await this.resourceManager.createLLMClient({
        provider: this.llmConfig.provider,
        model: this.llmConfig.model,
        maxRetries: this.llmConfig.maxRetries
      });
      
      // Listen to LLM events for streaming
      if (this.llmClient.on) {
        this.llmClient.on('stream', (chunk) => {
          this.emit('stream', {
            type: 'chat_stream',
            content: chunk,
            sessionId: this.sessionId
          });
        });
      }
      
    } catch (error) {
      console.error('Failed to initialize LLM client:', error);
      this.emit('error', {
        type: 'initialization_error',
        message: `Failed to initialize LLM: ${error.message}`,
        sessionId: this.sessionId
      });
    }
  }
  
  /**
   * Process a chat message from the user with tool support
   */
  async processMessage(userMessage) {
    // Ensure we're initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.isProcessing) {
      this.emit('error', {
        type: 'processing_error',
        message: 'Already processing a message',
        sessionId: this.sessionId
      });
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      });
      
      // Emit processing started event
      this.emit('processing_started', {
        type: 'chat_processing',
        sessionId: this.sessionId
      });
      
      // Get available tools if we have access to them
      const tools = await this.getAvailableTools();
      
      // Build messages array for the LLM
      const messages = this.buildMessages();
      
      // Call LLM with tools if available
      let finalResponse;
      if (tools && tools.length > 0 && this.llmClient.executeWithTools) {
        finalResponse = await this.processWithTools(messages, tools);
      } else {
        // Fallback to regular completion without tools
        const prompt = this.buildPrompt(userMessage);
        finalResponse = await this.llmClient.complete(prompt, this.llmConfig.maxTokens);
      }
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalResponse,
        timestamp: new Date().toISOString()
      });
      
      // Get all artifacts from this conversation turn
      const currentArtifacts = this.artifactManager.getAllArtifacts()
        .filter(artifact => {
          // Include artifacts created in the last few seconds (during this tool execution)
          const artifactTime = new Date(artifact.createdAt).getTime();
          const now = Date.now();
          return (now - artifactTime) < 30000; // 30 seconds window
        });

      // Generate voice if enabled and auto-play is on
      let voiceData = null;
      if (this.voiceEnabled && this.voicePreferences.enabled && this.voicePreferences.autoPlay) {
        try {
          const voiceResult = await this.moduleLoader.executeTool('generate_voice', {
            text: finalResponse,
            voice: this.voicePreferences.voice,
            model: 'tts-1',  // Use standard model for lower latency
            format: 'mp3',
            speed: 1.5  // Generate at 1.5x speed for faster playback
          });
          
          if (voiceResult.success !== false && voiceResult.audio) {
            voiceData = {
              audio: voiceResult.audio,
              format: voiceResult.format || 'mp3',
              voice: voiceResult.voice || this.voicePreferences.voice
            };
          }
        } catch (voiceError) {
          console.error('ChatAgent: Failed to generate voice:', voiceError);
          // Continue without voice - text response is still valid
        }
      }

      // Send response back through the remote actor with artifacts and optional voice
      this.emit('message', {
        type: 'chat_response',
        content: finalResponse,
        isComplete: true,
        artifacts: currentArtifacts,
        voiceData: voiceData,  // Include voice data if generated
        sessionId: this.sessionId
      });
      
      // ALSO send raw LLM response as a separate debug message
      this.emit('llm_debug', {
        type: 'llm_raw_response',
        rawResponse: finalResponse,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Send error back through the remote actor
      this.emit('error', {
        type: 'chat_error',
        message: `Failed to process message: ${error.message}`,
        sessionId: this.sessionId
      });
      
    } finally {
      this.isProcessing = false;
      
      this.emit('processing_complete', {
        type: 'chat_complete',
        sessionId: this.sessionId
      });
    }
  }
  
  /**
   * Process message with tool calling support - supports multiple rounds
   */
  async processWithTools(messages, tools) {
    let currentMessages = messages;
    let iterations = 0;
    const maxIterations = 50; // Allow for complex multi-step tasks
    let finalContent = '';
    
    // Keep processing until no more tools are needed
    while (iterations < maxIterations) {
      iterations++;
      
      // Send thinking status
      this.emit('agent_thinking', {
        type: 'agent_thinking',
        iteration: iterations,
        sessionId: this.sessionId
      });
      
      // Debug log the message structure before sending
      if (process.env.DEBUG_MESSAGES === 'true') {
        console.log('\n=== DEBUG: Messages being sent to LLM ===');
        currentMessages.forEach((msg, idx) => {
          console.log(`Message ${idx} - Role: ${msg.role}`);
          if (Array.isArray(msg.content)) {
            console.log(`  Content blocks: ${msg.content.length}`);
            msg.content.forEach(block => {
              console.log(`    - Type: ${block.type}, ID: ${block.id || block.tool_use_id || 'N/A'}`);
            });
          } else {
            console.log(`  Content: ${typeof msg.content === 'string' ? msg.content.substring(0, 50) + '...' : msg.content}`);
          }
        });
        console.log('=== END DEBUG ===\n');
      }
      
      // Call LLM with tools
      const response = await this.llmClient.executeWithTools(currentMessages, tools, {
        temperature: this.llmConfig.temperature,
        maxTokens: this.llmConfig.maxTokens
      });
      
      // Send the complete LLM response for debugging
      this.emit('llm_complete_response', {
        type: 'llm_complete_response',
        response: response,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
      
      // Check if LLM wants to use tools
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Send the LLM's response to the user
        if (response.content) {
          if (iterations === 1) {
            // First iteration: send as user-facing message
            this.emit('message', {
              type: 'chat_response',
              content: response.content,
              isComplete: false,  // More to come from tool execution
              sessionId: this.sessionId
            });
          } else {
            // Subsequent iterations: send as agent thought
            this.emit('agent_thought', {
              type: 'agent_thought',
              thought: response.content,
              sessionId: this.sessionId
            });
          }
        }
        
        // Save assistant message with tool calls to history
        const assistantMessage = {
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.toolCalls,
          timestamp: new Date().toISOString()
        };
        this.conversationHistory.push(assistantMessage);
        
        // Execute the tool calls
        const toolResults = await this.executeTools(response.toolCalls);
        
        // Save all tool results as a single user message
        if (toolResults.length > 0) {
          // Create a single user message with all tool results
          this.conversationHistory.push({
            role: 'user',
            content: JSON.stringify({
              tool_results: toolResults.map(result => ({
                tool_use_id: result.tool_use_id,
                content: result.content
              }))
            }),
            tool_results: toolResults, // Store the raw results for buildMessages
            timestamp: new Date().toISOString()
          });
          
          // Send individual tool results to UI
          for (const result of toolResults) {
            this.emit('tool_result', {
              type: 'tool_result',
              toolId: result.tool_use_id,
              result: result.content,
              sessionId: this.sessionId
            });
          }
        }
        
        // Build updated messages for next iteration
        currentMessages = this.buildMessages();
        
        // Continue loop to see if more tools are needed
      } else {
        // No more tools needed, we have the final response
        finalContent = response.content || 'I completed the requested tasks.';
        
        // Send completion status
        this.emit('agent_complete', {
          type: 'agent_complete',
          iterations: iterations,
          sessionId: this.sessionId
        });
        
        break;
      }
    }
    
    if (iterations >= maxIterations) {
      console.warn('ChatAgent: Reached maximum tool iterations');
      finalContent = 'I reached the maximum number of tool operations. The task may be incomplete.';
    }
    
    return finalContent;
  }
  
  /**
   * Execute tool calls
   */
  async executeTools(toolCalls) {
    const results = [];
    const allArtifacts = [];
    
    for (const toolCall of toolCalls) {
      try {
        // Send tool execution start status
        this.emit('tool_executing', {
          type: 'tool_executing',
          toolName: toolCall.name,
          toolId: toolCall.id,
          parameters: toolCall.input,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString()
        });
        
        // Substitute artifact labels in tool parameters
        const processedInput = await this.substituteArtifactLabels(toolCall.input);
        
        // Execute tool via moduleLoader or handle special tools
        let result;
        
        // Handle special internal tools
        if (toolCall.name === 'handle_complex_task') {
          // Delegate to orchestrator
          if (this.taskOrchestrator) {
            this.orchestratorActive = true;
            await this.taskOrchestrator.receive({
              type: 'start_task',
              description: processedInput.task_description,
              agentContext: this  // Pass ChatAgent itself as the agentContext
            });
            result = {
              success: true,
              message: 'Task delegated to complex task handler'
            };
          } else {
            result = {
              success: false,
              error: 'Complex task handler not available'
            };
          }
        } else if (this.moduleLoader && this.moduleLoader.hasTool(toolCall.name)) {
          result = await this.moduleLoader.executeTool(toolCall.name, processedInput);
        } else {
          result = {
            success: false,
            error: `Tool '${toolCall.name}' not found`
          };
        }
        
        // Process artifacts through ArtifactActor
        if (result && result.success !== false && this.artifactActor) {
          try {
            const artifactResult = await this.artifactActor.processToolResult({
              toolName: toolCall.name,
              toolResult: result,
              context: {
                userMessage: this.conversationHistory.slice(-1)[0]?.content
              }
            });
            
            if (artifactResult.success && artifactResult.artifacts.length > 0) {
              allArtifacts.push(...artifactResult.artifacts);
              
              console.log(`ChatAgent: ArtifactActor processed ${artifactResult.artifactsStored} artifacts from ${toolCall.name}`);
              
              // Emit artifact detection event
              this.emit('artifacts_detected', {
                type: 'artifacts_detected',
                toolName: toolCall.name,
                toolId: toolCall.id,
                artifacts: artifactResult.artifacts,
                sessionId: this.sessionId,
                timestamp: new Date().toISOString()
              });
              
              // Also send to artifact debug actor if connected
              this.sendArtifactEventToDebugActor('artifact_created', {
                artifacts: artifactResult.artifacts,
                toolName: toolCall.name
              });
            }
          } catch (artifactError) {
            console.warn(`ChatAgent: Error processing artifacts for ${toolCall.name}:`, artifactError);
          }
        }
        
        // Filter out large data (like base64 images) from the result before sending to LLM
        let resultForLLM = result;
        
        // Special handling for image generation results
        if (toolCall.name === 'generate_image' && result.imageData) {
          // Create a sanitized version without the actual image data
          resultForLLM = {
            success: result.success,
            filename: result.filename,
            filePath: result.filePath,  // Include full path so LLM can reference it
            metadata: result.metadata,
            message: `Image generated successfully and saved as ${result.filename}`,
            // Include size info but not the actual data
            imageSizeKB: result.imageData ? Math.round(result.imageData.length / 1024) : 0
          };
        } else if (result.imageData || result.data) {
          // Generic filtering for any tool that returns large data
          const { imageData, data, ...sanitized } = result;
          resultForLLM = {
            ...sanitized,
            dataOmitted: true,
            dataType: imageData ? 'image' : 'binary',
            dataSizeKB: (imageData || data) ? Math.round((imageData || data).length / 1024) : 0
          };
        }
        
        results.push({
          tool_use_id: toolCall.id,
          content: JSON.stringify(resultForLLM)
        });
        
        // Emit tool execution event (existing functionality)
        this.emit('tool_executed', {
          type: 'tool_execution',
          tool: toolCall.name,
          success: result.success !== false,
          sessionId: this.sessionId
        });
        
      } catch (error) {
        results.push({
          tool_use_id: toolCall.id,
          content: JSON.stringify({
            success: false,
            error: error.message
          })
        });
      }
    }
    
    // If we detected any artifacts, emit a summary event
    if (allArtifacts.length > 0) {
      this.emit('tool_artifacts_summary', {
        type: 'tool_artifacts_summary',
        artifacts: allArtifacts,
        totalCount: allArtifacts.length,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
    }
    
    return results;
  }
  
  /**
   * Get available tools
   */
  async getAvailableTools() {
    const tools = [];
    
    // Add the complex task handling tool
    tools.push({
      name: 'handle_complex_task',
      description: 'Use this tool when the user asks for something complex that requires multiple steps, planning, or building something significant (like a web app, system, feature with tests, etc.)',
      input_schema: {
        type: 'object',
        properties: {
          task_description: {
            type: 'string',
            description: 'A clear description of what the user wants to build or accomplish'
          }
        },
        required: ['task_description']
      }
    });
    
    try {
      // Get tools from moduleLoader's toolRegistry directly
      // getAllTools() is broken due to module initialization issues
      if (this.moduleLoader && this.moduleLoader.toolRegistry) {
        // Use the toolRegistry Map directly which has all registered tools
        const toolsFromRegistry = Array.from(this.moduleLoader.toolRegistry.values());
        
        let toolIndex = 0;
        for (const tool of toolsFromRegistry) {
          toolIndex++;
          
          // Convert to standard format
          if (tool.toJSON) {
            const toolDef = tool.toJSON();
            
            // Validate and fix input schema
            let inputSchema = toolDef.inputSchema;
            
            // Log tools to debug schema issues
            if (toolIndex <= 10 || toolIndex === 25 || toolIndex === 26) {
              console.log(`Tool ${toolIndex}: ${toolDef.name}, schema type: ${inputSchema?.type}, schema:`, JSON.stringify(inputSchema).substring(0, 200));
            }
            
            // Clean and validate the schema for JSON Schema 2020-12 compliance
            inputSchema = this._cleanSchemaForAnthropic(inputSchema, toolDef.name, toolIndex);
            
            tools.push({
              name: toolDef.name,
              description: toolDef.description,
              input_schema: inputSchema
            });
          } else if (tool.name) {
            // Clean schema for tools without toJSON method
            const cleanedSchema = this._cleanSchemaForAnthropic(
              tool.inputSchema, 
              tool.name, 
              toolIndex
            );
            
            tools.push({
              name: tool.name,
              description: tool.description || 'No description',
              input_schema: cleanedSchema
            });
          }
        }
        
        // Log total tools count
        console.log(`ChatAgent: Loaded ${tools.length} tools for LLM`);
      }
    } catch (error) {
      console.error('Error getting tools:', error);
    }
    
    return tools;
  }
  
  /**
   * Clean schema for Anthropic's JSON Schema 2020-12 requirements
   * @private
   */
  _cleanSchemaForAnthropic(inputSchema, toolName, toolIndex) {
    // Default empty schema
    const defaultSchema = { type: 'object', properties: {}, required: [] };
    
    if (!inputSchema || typeof inputSchema !== 'object') {
      return defaultSchema;
    }
    
    // Create a clean schema with only valid JSON Schema properties
    const cleanSchema = {
      type: inputSchema.type || 'object'
    };
    
    // Only add properties if type is object
    if (cleanSchema.type === 'object') {
      cleanSchema.properties = {};
      cleanSchema.required = [];
      
      // Clean properties if they exist
      if (inputSchema.properties && typeof inputSchema.properties === 'object') {
        for (const [key, prop] of Object.entries(inputSchema.properties)) {
          // Skip invalid property definitions
          if (!prop || typeof prop !== 'object') {
            console.warn(`Tool ${toolName} (${toolIndex}): Skipping invalid property ${key}`);
            continue;
          }
          
          // Create clean property definition
          const cleanProp = {};
          
          // Only include valid JSON Schema keywords
          if (prop.type) cleanProp.type = prop.type;
          if (prop.description) cleanProp.description = prop.description;
          if (prop.enum) cleanProp.enum = prop.enum;
          if (prop.default !== undefined) cleanProp.default = prop.default;
          if (prop.minimum !== undefined) cleanProp.minimum = prop.minimum;
          if (prop.maximum !== undefined) cleanProp.maximum = prop.maximum;
          if (prop.minLength !== undefined) cleanProp.minLength = prop.minLength;
          if (prop.maxLength !== undefined) cleanProp.maxLength = prop.maxLength;
          if (prop.pattern) cleanProp.pattern = prop.pattern;
          if (prop.items) cleanProp.items = prop.items;
          
          // Handle nested properties for objects
          if (cleanProp.type === 'object' && prop.properties) {
            cleanProp.properties = {};
            for (const [nestedKey, nestedProp] of Object.entries(prop.properties)) {
              if (nestedProp && typeof nestedProp === 'object') {
                cleanProp.properties[nestedKey] = {
                  type: nestedProp.type || 'string',
                  description: nestedProp.description
                };
              }
            }
          }
          
          cleanSchema.properties[key] = cleanProp;
        }
      }
      
      // Handle required fields
      if (Array.isArray(inputSchema.required)) {
        cleanSchema.required = inputSchema.required.filter(field => 
          typeof field === 'string' && cleanSchema.properties[field]
        );
      }
      
      // Remove required array if empty
      if (cleanSchema.required.length === 0) {
        delete cleanSchema.required;
      }
    } else if (cleanSchema.type !== 'object') {
      // For non-object types, convert to object wrapper
      console.warn(`Tool ${toolName} (${toolIndex}) has non-object schema type: ${cleanSchema.type}, converting to object`);
      return defaultSchema;
    }
    
    return cleanSchema;
  }

  /**
   * Build messages array from conversation history
   */
  buildMessages() {
    const messages = [
      {
        role: 'system',
        content: this.systemPrompt
      }
    ];
    
    // Add recent conversation history with proper formatting
    const recentHistory = this.conversationHistory.slice(-20);
    
    for (const msg of recentHistory) {
      if (msg.tool_results) {
        // This is a message containing multiple tool results
        const content = msg.tool_results.map(result => ({
          type: 'tool_result',
          tool_use_id: result.tool_use_id,
          content: result.content
        }));
        
        messages.push({
          role: 'user',
          content: content
        });
      } else if (msg.tool_result) {
        // Legacy single tool result - for backwards compatibility
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_use_id,
              content: msg.content
            }
          ]
        });
      } else if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Assistant message with tool calls
        const content = [];
        
        // Add text content if present
        if (msg.content) {
          content.push({
            type: 'text',
            text: msg.content
          });
        }
        
        // Add tool use blocks
        for (const toolCall of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.input
          });
        }
        
        messages.push({
          role: 'assistant',
          content: content
        });
      } else {
        // Regular text message
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    
    // Add artifact context if artifacts exist
    const artifactContext = this.artifactManager.getArtifactContext();
    if (artifactContext) {
      messages.push({
        role: 'system',
        content: artifactContext
      });
    }
    
    return messages;
  }
  
  /**
   * Build the prompt with conversation history
   */
  buildPrompt(currentMessage) {
    const messages = [];
    
    // Add system prompt
    messages.push(`System: ${this.systemPrompt}`);
    
    // Add conversation history (limit to last 10 exchanges to manage token usage)
    const recentHistory = this.conversationHistory.slice(-20);
    
    recentHistory.forEach((msg) => {
      if (msg.role === 'user') {
        messages.push(`Human: ${msg.content}`);
      } else if (msg.role === 'assistant' && msg.content !== currentMessage) {
        messages.push(`Assistant: ${msg.content}`);
      }
    });
    
    // Add current message if not already in history
    if (!recentHistory.some(msg => msg.content === currentMessage)) {
      messages.push(`Human: ${currentMessage}`);
    }
    
    // Add assistant prompt
    messages.push('Assistant:');
    
    return messages.join('\n\n');
  }
  
  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.emit('history_cleared', {
      type: 'chat_history_cleared',
      sessionId: this.sessionId
    });
  }
  
  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }
  
  /**
   * Actor receive method - handles incoming messages from the actor system
   * This is the main entry point for actor communication
   */
  async receive(payload) {
    console.log('ChatAgent: Received message via actor system:', payload);
    
    // If payload is a message object, handle it
    if (payload && typeof payload === 'object') {
      await this.handleMessage(payload);
    } else {
      console.warn('ChatAgent: Received unknown payload type:', typeof payload);
    }
  }
  
  /**
   * Handle incoming messages from the actor system
   */
  async handleMessage(message) {
    switch (message.type) {
      case 'chat_message':
        // Check if user is responding to execute plan prompt
        if (this.taskOrchestrator && this.taskOrchestrator.lastValidatedPlan) {
          const userMessage = message.content?.toLowerCase() || '';
          
          // Check for execution confirmation
          if (userMessage.includes('yes') || userMessage.includes('execute') || 
              userMessage.includes('run') || userMessage.includes('start')) {
            
            // Execute the last validated plan
            const plan = this.taskOrchestrator.lastValidatedPlan;
            this.taskOrchestrator.lastValidatedPlan = null; // Clear it
            
            this.orchestratorActive = true; // Reactivate orchestrator
            
            await this.taskOrchestrator.receive({
              type: 'execute_plan',
              plan: plan,
              options: {},
              agentContext: this
            });
            
            return; // Don't process as normal chat
          } 
          
          // Check for rejection
          if (userMessage.includes('no') || userMessage.includes('not now') || 
              userMessage.includes('later') || userMessage.includes('cancel')) {
            
            this.taskOrchestrator.lastValidatedPlan = null; // Clear it
            
            await this.sendToRemote({
              type: 'chat_response',
              content: 'Understood. The plan has been saved and you can execute it later using the artifact label.',
              isComplete: true
            });
            
            return; // Don't process as normal chat
          }
          
          // Check for "show plan" request
          if (userMessage.includes('show') && userMessage.includes('plan')) {
            const plan = this.taskOrchestrator.lastValidatedPlan;
            
            await this.sendToRemote({
              type: 'chat_response',
              content: `Here's the plan structure:\n\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\nWould you like me to execute this plan now?`,
              isComplete: true
            });
            
            return; // Don't process as normal chat
          }
        }
        
        // If orchestrator is active, forward the message
        if (this.orchestratorActive && this.taskOrchestrator) {
          await this.taskOrchestrator.receive({
            type: 'user_message',
            content: message.content,
            timestamp: message.timestamp
          });
        } else {
          await this.processMessage(message.content);
        }
        break;
        
      case 'clear_history':
        this.clearHistory();
        break;
        
      case 'get_history':
        // Send response back through the remote actor
        this.emit('history', {
          type: 'chat_history',
          history: this.getHistory(),
          sessionId: this.sessionId
        });
        break;
        
      case 'voice_input':
        await this.handleVoiceInput(message);
        break;
        
      case 'generate_speech':
        await this.handleGenerateSpeech(message);
        break;
        
      case 'voice_preferences':
        this.handleVoicePreferences(message);
        break;
        
      default:
        console.log(`ChatAgent: Unknown message type ${message.type}`);
    }
  }
  
  /**
   * Set the ArtifactAgent for internal communication
   */
  setArtifactAgent(artifactAgent) {
    this.artifactAgent = artifactAgent;
  }
  
  /**
   * Set the ArtifactActor for artifact processing
   */
  setArtifactActor(artifactActor) {
    this.artifactActor = artifactActor;
    // Share the same ArtifactManager
    if (this.artifactActor && this.artifactManager) {
      this.artifactActor.artifactManager = this.artifactManager;
    }
  }
  
  /**
   * Send artifact event to the artifact agent
   * @param {string} eventType - Type of artifact event
   * @param {Object} data - Event data
   */
  sendArtifactEventToDebugActor(eventType, data) {
    console.log(`ChatAgent: sendArtifactEventToDebugActor called with type: ${eventType}`);
    console.log(`ChatAgent: artifactAgent exists?`, !!this.artifactAgent);
    
    // Send to artifact agent internally (not through actor protocol)
    if (this.artifactAgent) {
      console.log(`ChatAgent: Sending ${eventType} to artifactAgent`);
      this.artifactAgent.receive({
        type: eventType,
        eventName: eventType, // For compatibility
        ...data,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
      console.log(`ChatAgent: Sent ${eventType} event to artifact agent`);
    } else {
      console.log(`ChatAgent: No artifactAgent reference, cannot send ${eventType}`);
    }
  }
  
  /**
   * Substitute artifact labels in tool parameters
   * @param {Object} params - Tool parameters that may contain artifact labels
   * @returns {Promise<Object>} Parameters with labels replaced by actual values
   */
  async substituteArtifactLabels(params) {
    if (!params || typeof params !== 'object') {
      return params;
    }
    
    const processed = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('@')) {
        // This looks like an artifact label
        const artifact = this.artifactManager.getArtifactByLabel(value);
        
        if (artifact) {
          // Determine what to substitute based on the parameter name
          if (key.toLowerCase().includes('path') || key.toLowerCase().includes('file')) {
            // For file-related parameters, use the path if available
            if (artifact.path) {
              processed[key] = artifact.path;
            } else if (artifact.content) {
              // For artifacts with content but no path
              if (artifact.type === 'image' && artifact.content.startsWith('http')) {
                // URL-based image
                processed[key] = artifact.content;
                console.log(`ChatAgent: Using URL for artifact ${value}`);
              } else if (artifact.type === 'image' && artifact.content.startsWith('data:')) {
                // Base64 image - we might need to save it to a temp file
                // For now, return the path if it was saved, or error
                throw new Error(`Artifact ${value} has base64 content but no file path. This shouldn't happen if saved properly.`);
              } else {
                // Other content types might work as-is
                processed[key] = artifact.content;
              }
            } else {
              // No path or content available
              throw new Error(`Artifact ${value} does not have a file path or accessible content`);
            }
          } else if (key.toLowerCase().includes('content')) {
            // For content parameters, use the actual content
            processed[key] = artifact.content || '';
          } else {
            // Default: try path first, then content
            processed[key] = artifact.path || artifact.content || value;
          }
          
          console.log(`ChatAgent: Substituted artifact ${value} with ${typeof processed[key] === 'string' ? processed[key].substring(0, 50) + '...' : processed[key]}`);
        } else {
          // Artifact not found, keep original value
          console.warn(`ChatAgent: Artifact label ${value} not found`);
          processed[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively process nested objects
        processed[key] = await this.substituteArtifactLabels(value);
      } else {
        // Keep original value
        processed[key] = value;
      }
    }
    
    return processed;
  }

  /**
   * Handle voice input (speech-to-text)
   */
  async handleVoiceInput(message) {
    if (!this.voiceEnabled) {
      this.emit('voice_error', {
        type: 'voice_error',
        message: 'Voice module not available',
        sessionId: this.sessionId
      });
      return;
    }
    
    try {
      // Use the voice module to transcribe
      const result = await this.moduleLoader.executeTool('transcribe_audio', {
        audio: message.audio,
        format: message.format,
        language: message.language
      });
      
      if (result.success !== false && result.text) {
        // Send transcription result
        this.emit('voice_transcription', {
          type: 'voice_transcription',
          text: result.text,
          language: result.language || 'auto-detected',
          sessionId: this.sessionId
        });
        
        // Automatically process the transcribed text as a chat message
        await this.processMessage(result.text);
      } else {
        throw new Error(result.error || 'Transcription failed');
      }
      
    } catch (error) {
      console.error('ChatAgent: Voice transcription error:', error);
      this.emit('voice_error', {
        type: 'voice_error',
        message: `Transcription failed: ${error.message}`,
        details: error,
        sessionId: this.sessionId
      });
    }
  }
  
  /**
   * Handle speech generation (text-to-speech)
   */
  async handleGenerateSpeech(message) {
    if (!this.voiceEnabled) {
      this.emit('voice_error', {
        type: 'voice_error',
        message: 'Voice module not available',
        messageId: message.messageId,
        sessionId: this.sessionId
      });
      return;
    }
    
    try {
      // Use the voice module to generate speech
      const result = await this.moduleLoader.executeTool('generate_voice', {
        text: message.text,
        voice: message.voice || this.voicePreferences.voice,
        model: 'tts-1',  // Use standard model for lower latency
        format: 'mp3',
        speed: 1.5  // Generate at 1.5x speed for faster playback
      });
      
      if (result.success !== false && result.audio) {
        // Send audio data back
        this.emit('voice_audio', {
          type: 'voice_audio',
          audio: result.audio,
          format: result.format || 'mp3',
          messageId: message.messageId,
          voice: message.voice || this.voicePreferences.voice,
          sessionId: this.sessionId
        });
      } else {
        throw new Error(result.error || 'Speech generation failed');
      }
      
    } catch (error) {
      console.error('ChatAgent: Voice generation error:', error);
      this.emit('voice_error', {
        type: 'voice_error',
        message: `Speech generation failed: ${error.message}`,
        messageId: message.messageId,
        details: error,
        sessionId: this.sessionId
      });
    }
  }
  
  /**
   * Handle voice preferences update
   */
  handleVoicePreferences(message) {
    this.voicePreferences = {
      enabled: message.enabled || false,
      voice: message.voice || 'nova',
      autoPlay: message.autoPlay || false
    };
    
    console.log('ChatAgent: Updated voice preferences:', this.voicePreferences);
  }
  
  /**
   * Override processMessage to optionally generate voice for responses
   */
  async processMessageWithVoice(userMessage) {
    const response = await this.processMessage(userMessage);
    
    // If voice auto-play is enabled, generate speech for the response
    if (this.voicePreferences.enabled && this.voicePreferences.autoPlay && response) {
      // Get the last assistant message
      const lastMessage = this.conversationHistory.slice(-1)[0];
      if (lastMessage && lastMessage.role === 'assistant') {
        // Generate speech in background (don't wait)
        this.handleGenerateSpeech({
          text: lastMessage.content,
          messageId: `msg_${Date.now()}`,
          voice: this.voicePreferences.voice
        }).catch(err => {
          console.error('ChatAgent: Auto-play voice generation failed:', err);
        });
      }
    }
    
    return response;
  }
  
  /**
   * Handle messages from TaskOrchestrator
   */
  handleOrchestratorMessage(message) {
    console.log('ChatAgent: Received message from TaskOrchestrator:', message);
    
    switch (message.type) {
      case 'orchestrator_status':
      case 'orchestrator_update':
        // Send status updates as chat responses
        this.emit('message', {
          type: 'chat_response',
          content: message.message,
          isComplete: false,
          isOrchestrator: true,
          progress: message.progress,
          sessionId: this.sessionId
        });
        break;
        
      case 'orchestrator_complete':
        // Send completion message first
        this.emit('message', {
          type: 'chat_response',
          content: message.message,
          isComplete: true,
          isOrchestrator: true,
          taskSummary: message.taskSummary,
          sessionId: this.sessionId
        });
        
        // Add to history
        if (message.wasActive) {
          this.conversationHistory.push({
            role: 'assistant',
            content: message.message,
            timestamp: new Date().toISOString()
          });
        }
        
        // Clear active flag AFTER sending the message
        this.orchestratorActive = false;
        break;
        
      case 'orchestrator_error':
        // Send error as chat response
        this.emit('message', {
          type: 'chat_response',
          content: message.message,
          isComplete: true,
          isError: true,
          sessionId: this.sessionId
        });
        break;
        
      default:
        console.warn('ChatAgent: Unknown orchestrator message type:', message.type);
    }
  }
  
  /**
   * Prepare for tool usage (future enhancement)
   */
  async executeWithTools(userMessage) {
    // This will be implemented when tool usage is added
    // For now, just process as a regular message
    return this.processMessage(userMessage);
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this.conversationHistory = [];
    this.llmClient = null;
    this.remoteActor = null;
    
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
    
    console.log(`ChatAgent ${this.id} destroyed`);
  }
}