export class HistoryContextProvider {
  constructor(maxEntries = 10) {
    this.name = 'history';
    this.description = 'Provides conversation history context';
    this.maxEntries = maxEntries;
  }

  async getContext(session) {
    const history = session.history.slice(-this.maxEntries);
    
    return {
      entries: history,
      count: history.length,
      totalCount: session.history.length
    };
  }
}