/**
 * SessionPanelModel - Model for session panel component
 */
import { ExtendedBaseModel } from '../base/ExtendedBaseModel.js';

export class SessionPanelModel extends ExtendedBaseModel {
  constructor() {
    super();
    
    this.sessions = [];
    this.currentSessionId = null;
    this.searchQuery = '';
    this.loadingSessions = new Set();
    this.pendingSession = null;
  }

  /**
   * Set the sessions list
   * @param {Array} sessions - Array of session objects
   */
  setSessions(sessions) {
    this.sessions = (sessions || []).sort((a, b) => {
      // Sort by lastModified descending (most recent first)
      return (b.lastModified || 0) - (a.lastModified || 0);
    });
    this.notify('sessionsChanged', { sessions: this.sessions });
  }

  /**
   * Get all sessions
   * @returns {Array} Array of sessions
   */
  getSessions() {
    return this.sessions;
  }

  /**
   * Select a session by ID
   * @param {string|null} sessionId - Session ID to select, or null to deselect
   */
  selectSession(sessionId) {
    if (sessionId && !this.getSessionById(sessionId)) {
      return; // Session doesn't exist
    }
    
    if (this.currentSessionId === sessionId) {
      return; // Already selected
    }
    
    this.currentSessionId = sessionId;
    const session = sessionId ? this.getSessionById(sessionId) : null;
    
    this.notify('sessionSelected', { sessionId, session });
  }

  /**
   * Get the currently selected session
   * @returns {Object|null} Selected session object or null
   */
  getCurrentSession() {
    return this.currentSessionId ? this.getSessionById(this.currentSessionId) : null;
  }

  /**
   * Create a new session
   * @param {Object} sessionData - Session data
   */
  createSession(sessionData) {
    if (!sessionData.name || !sessionData.name.trim()) {
      throw new Error('Session name is required');
    }
    
    if (!sessionData.type) {
      throw new Error('Session type is required');
    }
    
    const now = Date.now();
    this.pendingSession = {
      id: `session-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name: sessionData.name.trim(),
      type: sessionData.type,
      description: sessionData.description || '',
      created: now,
      lastModified: now,
      ...sessionData
    };
    
    this.notify('sessionCreated', { session: this.pendingSession });
  }

  /**
   * Update session details
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Properties to update
   */
  updateSession(sessionId, updates) {
    const session = this.getSessionById(sessionId);
    if (!session) {
      return;
    }
    
    Object.assign(session, updates, { lastModified: Date.now() });
    
    // Re-sort sessions since lastModified changed
    this.sessions.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    
    this.notify('sessionUpdated', { sessionId, updates });
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID
   */
  deleteSession(sessionId) {
    const index = this.sessions.findIndex(session => session.id === sessionId);
    if (index === -1) {
      return;
    }
    
    this.sessions.splice(index, 1);
    
    // Deselect if selected
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
    
    // Remove from loading set
    this.loadingSessions.delete(sessionId);
    
    this.notify('sessionDeleted', { sessionId });
  }

  /**
   * Set the search query
   * @param {string} query - Search query
   */
  setSearchQuery(query) {
    const trimmedQuery = (query || '').trim();
    if (this.searchQuery === trimmedQuery) {
      return;
    }
    
    this.searchQuery = trimmedQuery;
    this.notify('searchQueryChanged', { query: this.searchQuery });
  }

  /**
   * Get filtered sessions based on search query
   * @returns {Array} Filtered sessions
   */
  getFilteredSessions() {
    if (!this.searchQuery) {
      return this.sessions;
    }
    
    const query = this.searchQuery.toLowerCase();
    
    return this.sessions.filter(session => {
      const name = (session.name || '').toLowerCase();
      const description = (session.description || '').toLowerCase();
      const type = (session.type || '').toLowerCase();
      return name.includes(query) || description.includes(query) || type.includes(query);
    });
  }

  /**
   * Group sessions by type
   * @returns {Object} Sessions grouped by type
   */
  getSessionsByType() {
    const grouped = {};
    
    this.sessions.forEach(session => {
      const type = session.type || 'Unknown';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(session);
    });
    
    return grouped;
  }

  /**
   * Get available session types
   * @returns {Array} Array of session types
   */
  getSessionTypes() {
    const types = new Set();
    this.sessions.forEach(session => {
      if (session.type) {
        types.add(session.type);
      }
    });
    return Array.from(types).sort();
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session object or null
   */
  getSessionById(sessionId) {
    return this.sessions.find(session => session.id === sessionId) || null;
  }

  /**
   * Get recent sessions
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Array} Recent sessions
   */
  getRecentSessions(limit = 10) {
    return this.sessions.slice(0, limit);
  }

  /**
   * Set session loading state
   * @param {string} sessionId - Session ID
   * @param {boolean} loading - Whether session is loading
   */
  setSessionLoading(sessionId, loading) {
    if (!this.getSessionById(sessionId)) {
      return;
    }
    
    if (loading) {
      this.loadingSessions.add(sessionId);
    } else {
      this.loadingSessions.delete(sessionId);
    }
    
    this.notify('sessionLoadingStateChanged', { sessionId, loading });
  }

  /**
   * Check if session is loading
   * @param {string} sessionId - Session ID
   * @returns {boolean} Whether session is loading
   */
  isSessionLoading(sessionId) {
    return this.loadingSessions.has(sessionId);
  }

  /**
   * Clear all data
   */
  destroy() {
    this.sessions = [];
    this.currentSessionId = null;
    this.searchQuery = '';
    this.loadingSessions.clear();
    this.pendingSession = null;
    super.destroy();
  }
}