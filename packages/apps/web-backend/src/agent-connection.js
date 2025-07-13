/**
 * Simple agent interaction manager for WebSocket connections
 * Each connection gets its own agent instance
 */
export class AgentConnection {
    constructor(connectionId) {
        this.connectionId = connectionId;
        this.conversationHistory = [];
        this.createdAt = new Date();
        
        console.log(`🤖 Agent connection created: ${connectionId}`);
    }
    
    /**
     * Process user message and generate response
     */
    async processMessage(content) {
        console.log(`📝 Processing message for ${this.connectionId}: "${content}"`);
        
        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: content,
            timestamp: new Date().toISOString()
        });
        
        // Simulate thinking time
        await this.simulateThinking();
        
        // Generate response based on content
        const response = this.generateResponse(content);
        
        // Add agent response to history
        this.conversationHistory.push({
            role: 'agent',
            content: response,
            timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Generated response for ${this.connectionId}: "${response}"`);
        return response;
    }
    
    /**
     * Generate contextual response
     */
    generateResponse(userMessage) {
        const lowerMessage = userMessage.toLowerCase();
        
        // Greeting responses
        if (lowerMessage.match(/^(hi|hello|hey|greetings)/)) {
            return this.getRandomResponse([
                "Hello! I'm jsEnvoy Assistant. How can I help you today?",
                "Hi there! What would you like to chat about?",
                "Hey! I'm here and ready to assist you.",
                "Greetings! How may I be of service?"
            ]);
        }
        
        // Name/identity questions
        if (lowerMessage.includes('your name') || lowerMessage.includes('who are you')) {
            return "I'm jsEnvoy Assistant, an AI agent designed to help with various tasks. I can chat, answer questions, and assist with different topics.";
        }
        
        // Capability questions
        if (lowerMessage.includes('what can you do') || lowerMessage.includes('help me with')) {
            return "I can assist you with various tasks such as answering questions, having conversations, providing explanations, helping with problem-solving, and much more. What would you like to explore?";
        }
        
        // Math operations
        if (lowerMessage.match(/(\d+\s*[\+\-\*\/]\s*\d+)/)) {
            return this.handleMathOperation(userMessage);
        }
        
        // Time/date questions
        if (lowerMessage.includes('time') || lowerMessage.includes('date')) {
            const now = new Date();
            return `The current time is ${now.toLocaleTimeString()} and today's date is ${now.toLocaleDateString()}.`;
        }
        
        // Weather (simulated)
        if (lowerMessage.includes('weather')) {
            return this.getRandomResponse([
                "I don't have access to real-time weather data, but I hope it's nice where you are!",
                "Weather looks great for a chat! ☀️ (I don't actually have weather data, but I'm optimistic!)",
                "I wish I could check the weather for you, but I'm not connected to weather services right now."
            ]);
        }
        
        // Jokes
        if (lowerMessage.includes('joke') || lowerMessage.includes('funny')) {
            return this.getRandomResponse([
                "Why don't scientists trust atoms? Because they make up everything! 😄",
                "I told my computer a joke about UDP... I'm not sure if it got it. 🤓",
                "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
                "What's the best thing about Switzerland? I don't know, but the flag is a big plus! ➕"
            ]);
        }
        
        // Goodbyes
        if (lowerMessage.match(/^(bye|goodbye|see you|farewell)/)) {
            return this.getRandomResponse([
                "Goodbye! It was great chatting with you. Come back anytime!",
                "See you later! Have a wonderful day!",
                "Farewell! Thanks for the conversation!",
                "Bye! Feel free to return whenever you'd like to chat."
            ]);
        }
        
        // Context-aware responses based on conversation history
        if (this.conversationHistory.length > 2) {
            const recentUserMessages = this.conversationHistory
                .filter(msg => msg.role === 'user')
                .slice(-3)
                .map(msg => msg.content);
            
            if (recentUserMessages.some(msg => msg.toLowerCase().includes('thank'))) {
                return "You're very welcome! Is there anything else I can help you with?";
            }
        }
        
        // Default responses for general conversation
        return this.getRandomResponse([
            "That's interesting! Can you tell me more about that?",
            "I see what you mean. What are your thoughts on this?",
            "That's a great point. How did you come to that conclusion?",
            "Thanks for sharing that with me. What would you like to explore next?",
            "I appreciate you bringing that up. How can I help you with this topic?",
            "That's worth considering. What aspects interest you most?",
            "I understand. What other questions do you have?",
            "That makes sense. Is there a particular angle you'd like to discuss?"
        ]);
    }
    
    /**
     * Handle basic math operations
     */
    handleMathOperation(message) {
        try {
            // Extract math expression (simple approach for demo)
            const match = message.match(/(\d+\s*[\+\-\*\/]\s*\d+)/);
            if (match) {
                const expression = match[1];
                // Simple evaluation (in real app, use a proper math parser)
                const result = eval(expression.replace(/[^0-9+\-*/\s]/g, ''));
                return `The answer to ${expression} is ${result}.`;
            }
        } catch (error) {
            return "I noticed you mentioned some numbers, but I couldn't calculate that. Could you try asking again?";
        }
        
        return "I see some math in your message, but I'm not sure how to calculate it. Can you rephrase?";
    }
    
    /**
     * Get random response from array
     */
    getRandomResponse(responses) {
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    /**
     * Simulate thinking/processing time
     */
    async simulateThinking() {
        const delay = 500 + Math.random() * 1500; // 0.5-2 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
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