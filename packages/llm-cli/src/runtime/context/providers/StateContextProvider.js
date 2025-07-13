export class StateContextProvider {
  constructor(keys = []) {
    this.name = 'state';
    this.description = 'Provides session state context';
    this.keys = keys;
  }

  async getContext(session) {
    const context = {};
    
    if (this.keys.length === 0) {
      // Return all state
      for (const [key, value] of session.state) {
        context[key] = value;
      }
    } else {
      // Return only specified keys
      for (const key of this.keys) {
        if (session.state.has(key)) {
          context[key] = session.state.get(key);
        }
      }
    }
    
    return context;
  }
}