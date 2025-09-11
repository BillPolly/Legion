/**
 * Authentication Service for Gemini Compatible Agent
 */
export class AuthenticationService {
  constructor() {
    this.tokens = new Map();
  }

  async validateToken(token) {
    return this.tokens.has(token);
  }

  async generateToken(userId) {
    const token = crypto.randomUUID();
    this.tokens.set(token, userId);
    return token;
  }

  async revokeToken(token) {
    return this.tokens.delete(token);
  }
}
