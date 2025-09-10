/**
 * Rate Limiting Service
 */
export class RateLimitService {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 100;
    this.requests = new Map();
  }

  async isAllowed(clientId) {
    this.cleanup();
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    
    clientRequests.push(now);
    this.requests.set(clientId, clientRequests);
    
    return clientRequests.length <= this.maxRequests;
  }

  cleanup() {
    const now = Date.now();
    for (const [clientId, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter(time => now - time < this.windowMs);
      if (valid.length === 0) {
        this.requests.delete(clientId);
      } else {
        this.requests.set(clientId, valid);
      }
    }
  }
}
