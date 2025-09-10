import EventEmitterService from './EventEmitterService.js';

class TokenManagementService {
  constructor() {
    this.eventEmitter = new EventEmitterService();
    this.tokenUsage = new Map();
  }

  trackTokenUsage(conversationId, tokens) {
    const current = this.tokenUsage.get(conversationId) || 0;
    this.tokenUsage.set(conversationId, current + tokens);
    this.eventEmitter.emit('tokenUpdate', { conversationId, tokens: current + tokens });
  }

  getTokenUsage(conversationId) {
    return this.tokenUsage.get(conversationId) || 0;
  }

  resetTokens(conversationId) {
    this.tokenUsage.delete(conversationId);
    this.eventEmitter.emit('tokenReset', { conversationId });
  }
}

export default TokenManagementService;
