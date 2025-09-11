export class ConversationStateManager {
  constructor() {
    this.conversations = new Map();
  }

  createConversation(id, metadata = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid conversation ID');
    }
    if (this.conversations.has(id)) {
      throw new Error(`Conversation ${id} already exists`);
    }

    const conversation = {
      id,
      created: new Date().toISOString(),
      turns: [],
      messages: [],
      metadata,
      context: {
        workingDirectory: process.cwd(),
        recentFiles: [],
        environment: {}
      }
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  getConversation(id) {
    return this.conversations.get(id);
  }

  addTurn(conversationId, turn) {
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('Invalid conversationId');
    }
    if (!turn || typeof turn !== 'object') {
      throw new Error('Invalid turn object');
    }

    const conversation = this.getConversation(conversationId);
    if (!conversation) return null;

    const validatedTurn = {
      ...turn,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      validated: true
    };

    conversation.turns.push(validatedTurn);
    return conversation;
  }

  updateContext(conversationId, context) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return null;

    conversation.context = {
      ...conversation.context,
      ...context
    };
    return conversation;
  }

  getRecentContext(conversationId, turnLimit = 10) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) return null;

    return {
      recentTurns: conversation.turns.slice(-turnLimit),
      context: conversation.context
    };
  }

  addMessage(conversationId, message) {
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('Invalid conversationId');
    }
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message format');
    }

    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const validatedMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    conversation.messages.push(validatedMessage);
    return conversation;
  }

  getConversationHistory(conversationId, options = {}) {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return [];
    }

    let messages = conversation.messages;

    // Apply filters based on options
    if (options.since) {
      const sinceTime = new Date(options.since).getTime();
      messages = messages.filter(msg => new Date(msg.timestamp).getTime() > sinceTime);
    }

    if (options.limit) {
      messages = messages.slice(-options.limit);
    }

    return messages;
  }

  deleteConversation(conversationId) {
    return this.conversations.delete(conversationId);
  }
}
