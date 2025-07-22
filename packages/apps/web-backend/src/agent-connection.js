/**
 * Agent connection manager for WebSocket connections
 * Each connection gets its own @legion/agent instance
 */
import { Agent } from '@legion/agent';

export class AgentConnection {
    constructor(connectionId, resourceManager, moduleFactory) {
        this.connectionId = connectionId;
        this.resourceManager = resourceManager;
        this.moduleFactory = moduleFactory;
        this.conversationHistory = [];
        this.createdAt = new Date();
        this.agent = null;
        
        console.log(`🤖 Agent connection created: ${connectionId}`);
    }
    
    /**
     * Initialize the agent with tools
     */
    async initializeAgent() {
        if (this.agent) return; // Already initialized
        
        try {
            // Load tools from @legion/tools package
            const tools = [];
            try {
                const toolsPackage = await import('@legion/tools');
                
                // Get all module classes (they end with 'Module')
                const moduleClasses = Object.values(toolsPackage).filter(
                    exportedItem => typeof exportedItem === 'function' && 
                                  exportedItem.name && 
                                  exportedItem.name.endsWith('Module')
                );
                
                console.log(`Loading ${moduleClasses.length} modules for connection ${this.connectionId}`);
                
                // Instantiate each module
                for (const ModuleClass of moduleClasses) {
                    const moduleName = ModuleClass.name.replace('Module', '').toLowerCase();
                    const moduleInstance = this.moduleFactory.createModule(ModuleClass);
                    
                    // Get tools from module
                    if (moduleInstance.tools && Array.isArray(moduleInstance.tools)) {
                        moduleInstance.tools.forEach(tool => {
                            // Convert tool to agent format
                            const agentTool = this.convertToolToAgentFormat(tool, moduleName);
                            tools.push(agentTool);
                        });
                    }
                }
            } catch (error) {
                console.error('Error loading tools:', error);
                // Continue without tools if loading fails
            }
            
            // Create agent configuration
            const agentConfig = {
                name: `chat_agent_${this.connectionId}`,
                bio: "I am a helpful AI assistant powered by jsEnvoy. I can help with various tasks including calculations, file operations, and web searches.",
                steps: ["Understand the user's request", "Use available tools if needed", "Provide a helpful response"],
                modelConfig: {
                    provider: this.resourceManager.has('env.MODEL_PROVIDER') ? this.resourceManager.get('env.MODEL_PROVIDER') : 'OPEN_AI',
                    apiKey: this.resourceManager.get('env.OPENAI_API_KEY'),
                    model: this.resourceManager.has('env.MODEL_NAME') ? this.resourceManager.get('env.MODEL_NAME') : 'gpt-4'
                },
                tools: tools,
                showToolUsage: true,
                responseStructure: null // Use default string response
            };
            
            // Create the agent
            this.agent = new Agent(agentConfig);
            console.log(`✅ Agent initialized for connection ${this.connectionId} with ${tools.length} tools`);
            
        } catch (error) {
            console.error(`Error initializing agent for ${this.connectionId}:`, error);
            throw error;
        }
    }
    
    /**
     * Convert jsEnvoy tool to agent format
     */
    convertToolToAgentFormat(tool, moduleName) {
        const identifier = `${moduleName}_${tool.name}`;
        const abilities = [tool.description];
        const instructions = [`Use this tool to ${tool.description}`];
        
        // Get functions from tool
        let functions = [];
        if (typeof tool.getAllToolDescriptions === 'function') {
            const toolDescs = tool.getAllToolDescriptions();
            functions = toolDescs.map(desc => ({
                name: desc.function.name,
                purpose: desc.function.description,
                arguments: Object.keys(desc.function.parameters.properties || {}),
                response: 'object'
            }));
        } else if (typeof tool.getToolDescription === 'function') {
            const toolDesc = tool.getToolDescription();
            functions = [{
                name: toolDesc.function.name,
                purpose: toolDesc.function.description,
                arguments: Object.keys(toolDesc.function.parameters.properties || {}),
                response: 'object'
            }];
        }
        
        // Create agent-compatible tool
        return {
            name: tool.name,
            identifier,
            abilities,
            instructions,
            functions,
            // Keep reference to original tool for execution
            invoke: tool.invoke?.bind(tool),
            safeInvoke: tool.safeInvoke?.bind(tool),
            setExecutingAgent: () => {} // Required by Agent
        };
    }
    
    /**
     * Process user message and generate response using the real agent
     */
    async processMessage(content) {
        console.log(`📝 Processing message for ${this.connectionId}: "${content}"`);
        
        // Initialize agent on first message
        if (!this.agent) {
            await this.initializeAgent();
        }
        
        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: content,
            timestamp: new Date().toISOString()
        });
        
        try {
            // Use the agent to process the message
            const response = await this.agent.run(content);
            
            // Extract the message from the response
            let responseMessage;
            if (typeof response === 'string') {
                responseMessage = response;
            } else if (response && response.message) {
                responseMessage = response.message;
            } else {
                responseMessage = JSON.stringify(response);
            }
            
            // Add agent response to history
            this.conversationHistory.push({
                role: 'agent',
                content: responseMessage,
                timestamp: new Date().toISOString()
            });
            
            console.log(`✅ Generated response for ${this.connectionId}: "${responseMessage}"`);
            return responseMessage;
            
        } catch (error) {
            console.error(`Error processing message for ${this.connectionId}:`, error);
            
            // Fallback to a simple response if agent fails
            const errorMessage = `I apologize, but I encountered an error while processing your request: ${error.message}. Please try again.`;
            
            this.conversationHistory.push({
                role: 'agent',
                content: errorMessage,
                timestamp: new Date().toISOString()
            });
            
            return errorMessage;
        }
    }
    
    /**
     * Get conversation summary
     */
    getConversationSummary() {
        return {
            connectionId: this.connectionId,
            messageCount: this.conversationHistory.length,
            createdAt: this.createdAt,
            lastActivity: this.conversationHistory.length > 0 
                ? this.conversationHistory[this.conversationHistory.length - 1].timestamp 
                : this.createdAt
        };
    }
    
    /**
     * Cleanup when connection closes
     */
    destroy() {
        console.log(`🗑️  Agent connection destroyed: ${this.connectionId} (${this.conversationHistory.length} messages)`);
        this.conversationHistory = [];
    }
}