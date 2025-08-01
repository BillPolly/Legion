/**
 * SessionPanelView - View for session panel component
 */
import { ExtendedBaseView } from '../base/ExtendedBaseView.js';

export class SessionPanelView extends ExtendedBaseView {
  constructor(parentElement) {
    super(parentElement);
    
    this.parentElement = parentElement; // Store reference for compatibility
    this.onSessionClick = null;
    this.onSessionRightClick = null;
    this.onSearchInput = null;
    this.onSearchClear = null;
    this.onNewSession = null;
    this.onCreateSession = null;
    this.onNavigate = null;
    this.onSessionSelect = null;
    
    this.highlightedSessionId = null;
    this.currentSessions = [];
  }

  /**
   * Render the session panel
   * @param {Object} options - Render options
   */
  render(options = {}) {
    this.sessionPanel = this.createElement('div', ['session-panel']);
    
    // Apply theme if provided
    if (options.theme) {
      this.sessionPanel.classList.add(`session-panel-theme-${options.theme}`);
    }
    
    // Header
    this.renderHeader();
    
    // Search
    this.renderSearch();
    
    // Actions
    this.renderActions();
    
    // Sessions list
    this.renderSessionsList();
    
    // Dialogs
    this.renderDialogs();
    
    // Add to parent
    this.parentElement.appendChild(this.sessionPanel);
    
    // Bind events
    this.bindEvents();
  }

  /**
   * Render header section
   */
  renderHeader() {
    this.header = this.createElement('div', ['session-header']);
    
    const title = this.createElement('h3', ['session-title']);
    title.textContent = 'Sessions';
    
    this.header.appendChild(title);
    this.sessionPanel.appendChild(this.header);
  }

  /**
   * Render search section
   */
  renderSearch() {
    this.searchContainer = this.createElement('div', ['session-search']);
    
    this.searchInput = this.createElement('input', [], {
      type: 'text',
      placeholder: 'Search sessions...'
    });
    
    this.clearButton = this.createElement('button', ['search-clear'], {
      type: 'button',
      'aria-label': 'Clear search'
    });
    this.clearButton.textContent = '✕';
    this.clearButton.style.display = 'none';
    
    this.searchContainer.appendChild(this.searchInput);
    this.searchContainer.appendChild(this.clearButton);
    this.sessionPanel.appendChild(this.searchContainer);
    
    // Search results count
    this.searchResults = this.createElement('div', ['search-results-count']);
    this.searchResults.style.display = 'none';
    this.sessionPanel.appendChild(this.searchResults);
  }

  /**
   * Render actions section
   */
  renderActions() {
    this.actionsContainer = this.createElement('div', ['session-actions']);
    
    this.newSessionButton = this.createElement('button', ['new-session-button']);
    this.newSessionButton.textContent = '+ New Session';
    
    this.actionsContainer.appendChild(this.newSessionButton);
    this.sessionPanel.appendChild(this.actionsContainer);
  }

  /**
   * Render sessions list section
   */
  renderSessionsList() {
    this.sessionsList = this.createElement('div', ['session-list'], {
      tabindex: '0'
    });
    
    this.sessionPanel.appendChild(this.sessionsList);
    
    // Initially show empty state
    this.showEmptyState();
  }

  /**
   * Render dialogs
   */
  renderDialogs() {
    this.renderNewSessionDialog();
    this.renderContextMenu();
    this.renderDeleteConfirmation();
  }

  /**
   * Render new session dialog
   */
  renderNewSessionDialog() {
    this.newSessionDialog = this.createElement('div', ['new-session-dialog']);
    this.newSessionDialog.style.display = 'none';
    
    const dialogContent = this.createElement('div', ['dialog-content']);
    
    const title = this.createElement('h3', ['dialog-title']);
    title.textContent = 'Create New Session';
    
    this.newSessionForm = this.createElement('form', ['new-session-form']);
    
    // Name input
    const nameGroup = this.createElement('div', ['form-group']);
    const nameLabel = this.createElement('label');
    nameLabel.textContent = 'Session Name';
    const nameInput = this.createElement('input', [], {
      type: 'text',
      name: 'name',
      required: 'true'
    });
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    
    // Type select
    const typeGroup = this.createElement('div', ['form-group']);
    const typeLabel = this.createElement('label');
    typeLabel.textContent = 'Session Type';
    const typeSelect = this.createElement('select', [], { name: 'type', required: 'true' });
    
    // Add default option
    const defaultOption = this.createElement('option', [], { value: '' });
    defaultOption.textContent = 'Select type...';
    typeSelect.appendChild(defaultOption);
    
    // Add session type options
    ['chat', 'code', 'debug', 'research', 'meeting'].forEach(type => {
      const option = this.createElement('option', [], { value: type });
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      typeSelect.appendChild(option);
    });
    
    typeGroup.appendChild(typeLabel);
    typeGroup.appendChild(typeSelect);
    
    // Description textarea
    const descGroup = this.createElement('div', ['form-group']);
    const descLabel = this.createElement('label');
    descLabel.textContent = 'Description (optional)';
    const descTextarea = this.createElement('textarea', [], {
      name: 'description',
      rows: '3'
    });
    descGroup.appendChild(descLabel);
    descGroup.appendChild(descTextarea);
    
    // Buttons
    const buttonsGroup = this.createElement('div', ['form-buttons']);
    const cancelButton = this.createElement('button', ['cancel-button'], { type: 'button' });
    cancelButton.textContent = 'Cancel';
    const createButton = this.createElement('button', ['create-button'], { type: 'submit' });
    createButton.textContent = 'Create Session';
    
    buttonsGroup.appendChild(cancelButton);
    buttonsGroup.appendChild(createButton);
    
    this.newSessionForm.appendChild(nameGroup);
    this.newSessionForm.appendChild(typeGroup);
    this.newSessionForm.appendChild(descGroup);
    this.newSessionForm.appendChild(buttonsGroup);
    
    dialogContent.appendChild(title);
    dialogContent.appendChild(this.newSessionForm);
    this.newSessionDialog.appendChild(dialogContent);
    
    this.sessionPanel.appendChild(this.newSessionDialog);
  }

  /**
   * Render context menu
   */
  renderContextMenu() {
    this.contextMenu = this.createElement('div', ['session-context-menu']);
    this.contextMenu.style.display = 'none';
    
    const duplicateOption = this.createElement('div', ['context-option', 'duplicate-option']);
    duplicateOption.textContent = 'Duplicate';
    
    const exportOption = this.createElement('div', ['context-option', 'export-option']);
    exportOption.textContent = 'Export';
    
    const deleteOption = this.createElement('div', ['context-option', 'delete-option']);
    deleteOption.textContent = 'Delete';
    
    this.contextMenu.appendChild(duplicateOption);
    this.contextMenu.appendChild(exportOption);
    this.contextMenu.appendChild(deleteOption);
    
    this.sessionPanel.appendChild(this.contextMenu);
  }

  /**
   * Render delete confirmation dialog
   */
  renderDeleteConfirmation() {
    this.deleteConfirmation = this.createElement('div', ['delete-confirmation']);
    this.deleteConfirmation.style.display = 'none';
    
    const message = this.createElement('div', ['confirmation-message']);
    
    const buttonsGroup = this.createElement('div', ['confirmation-buttons']);
    const cancelButton = this.createElement('button', ['cancel-delete']);
    cancelButton.textContent = 'Cancel';
    const confirmButton = this.createElement('button', ['confirm-delete']);
    confirmButton.textContent = 'Delete';
    
    buttonsGroup.appendChild(cancelButton);
    buttonsGroup.appendChild(confirmButton);
    
    this.deleteConfirmation.appendChild(message);
    this.deleteConfirmation.appendChild(buttonsGroup);
    
    this.sessionPanel.appendChild(this.deleteConfirmation);
  }

  /**
   * Render list of sessions
   * @param {Array} sessions - Array of sessions to render
   */
  renderSessions(sessions) {
    this.currentSessions = sessions || [];
    this.sessionsList.innerHTML = '';
    
    if (this.currentSessions.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.currentSessions.forEach(session => {
      const sessionItem = this.createSessionItem(session);
      this.sessionsList.appendChild(sessionItem);
    });
  }

  /**
   * Render sessions grouped by type
   * @param {Object} sessionsByType - Sessions grouped by type
   */
  renderSessionsByType(sessionsByType) {
    this.sessionsList.innerHTML = '';
    this.currentSessions = [];
    
    const types = Object.keys(sessionsByType);
    if (types.length === 0) {
      this.showEmptyState();
      return;
    }
    
    types.forEach(typeName => {
      const sessions = sessionsByType[typeName];
      this.currentSessions.push(...sessions);
      
      const categoryContainer = this.createElement('div', ['session-category']);
      
      const categoryHeader = this.createElement('div', ['category-header']);
      categoryHeader.textContent = typeName.charAt(0).toUpperCase() + typeName.slice(1);
      categoryContainer.appendChild(categoryHeader);
      
      sessions.forEach(session => {
        const sessionItem = this.createSessionItem(session);
        categoryContainer.appendChild(sessionItem);
      });
      
      this.sessionsList.appendChild(categoryContainer);
    });
  }

  /**
   * Create a session item element
   * @param {Object} session - Session object
   * @returns {HTMLElement} Session item element
   */
  createSessionItem(session) {
    const sessionItem = this.createElement('div', ['session-item'], {
      'data-session-id': session.id
    });
    
    const sessionHeader = this.createElement('div', ['session-header']);
    
    const sessionName = this.createElement('div', ['session-name']);
    sessionName.textContent = session.name;
    
    const sessionType = this.createElement('div', ['session-type']);
    sessionType.textContent = session.type || 'unknown';
    
    const sessionTime = this.createElement('div', ['session-time']);
    if (session.lastModified) {
      sessionTime.textContent = this.formatRelativeTime(session.lastModified);
    }
    
    sessionHeader.appendChild(sessionName);
    sessionHeader.appendChild(sessionType);
    sessionHeader.appendChild(sessionTime);
    
    const sessionDescription = this.createElement('div', ['session-description']);
    sessionDescription.textContent = session.description || '';
    
    sessionItem.appendChild(sessionHeader);
    sessionItem.appendChild(sessionDescription);
    
    // Add click handler
    sessionItem.addEventListener('click', (e) => {
      if (sessionItem.classList.contains('disabled')) {
        return;
      }
      if (this.onSessionClick) {
        this.onSessionClick(session);
      }
    });
    
    // Add right-click handler for context menu
    sessionItem.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.onSessionRightClick) {
        this.onSessionRightClick(session, { x: e.clientX, y: e.clientY });
      }
    });
    
    // Add hover handlers
    sessionItem.addEventListener('mouseenter', () => {
      sessionItem.classList.add('hover');
    });
    
    sessionItem.addEventListener('mouseleave', () => {
      sessionItem.classList.remove('hover');
    });
    
    return sessionItem;
  }

  /**
   * Format relative time
   * @param {number} timestamp - Timestamp
   * @returns {string} Formatted relative time
   */
  formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    const emptyState = this.createElement('div', ['sessions-empty']);
    emptyState.textContent = 'No sessions available';
    this.sessionsList.appendChild(emptyState);
  }

  /**
   * Set selected session
   * @param {string|null} sessionId - Session ID to select
   */
  setSelectedSession(sessionId) {
    // Clear previous selection
    const previousSelected = this.sessionsList.querySelector('.session-item.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }
    
    // Select new session
    if (sessionId) {
      const sessionItem = this.sessionsList.querySelector(`[data-session-id="${sessionId}"]`);
      if (sessionItem) {
        sessionItem.classList.add('selected');
      }
    }
  }

  /**
   * Set highlighted session (for keyboard navigation)
   * @param {string|null} sessionId - Session ID to highlight
   */
  setHighlightedSession(sessionId) {
    // Clear previous highlight
    const previousHighlighted = this.sessionsList.querySelector('.session-item.highlighted');
    if (previousHighlighted) {
      previousHighlighted.classList.remove('highlighted');
    }
    
    this.highlightedSessionId = sessionId;
    
    // Highlight new session
    if (sessionId) {
      const sessionItem = this.sessionsList.querySelector(`[data-session-id="${sessionId}"]`);
      if (sessionItem) {
        sessionItem.classList.add('highlighted');
        // Scroll into view if needed
        if (sessionItem.scrollIntoView) {
          sessionItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }

  /**
   * Set session loading state
   * @param {string} sessionId - Session ID
   * @param {boolean} loading - Whether session is loading
   */
  setSessionLoading(sessionId, loading) {
    const sessionItem = this.sessionsList.querySelector(`[data-session-id="${sessionId}"]`);
    if (!sessionItem) {
      return;
    }
    
    if (loading) {
      sessionItem.classList.add('loading', 'disabled');
      
      // Add spinner
      const spinner = this.createElement('div', ['session-spinner']);
      spinner.innerHTML = '⟳';
      sessionItem.appendChild(spinner);
    } else {
      sessionItem.classList.remove('loading', 'disabled');
      
      // Remove spinner
      const spinner = sessionItem.querySelector('.session-spinner');
      if (spinner) {
        spinner.remove();
      }
    }
  }

  /**
   * Set loading state for entire panel
   * @param {boolean} loading - Whether panel is loading
   */
  setLoading(loading) {
    if (loading) {
      this.sessionPanel.classList.add('loading');
      
      // Add loading overlay
      if (!this.loadingOverlay) {
        this.loadingOverlay = this.createElement('div', ['sessions-loading']);
        this.loadingOverlay.textContent = 'Loading sessions...';
        this.sessionPanel.appendChild(this.loadingOverlay);
      }
    } else {
      this.sessionPanel.classList.remove('loading');
      
      // Remove loading overlay
      if (this.loadingOverlay) {
        this.loadingOverlay.remove();
        this.loadingOverlay = null;
      }
    }
  }

  /**
   * Set search query in input
   * @param {string} query - Search query
   */
  setSearchQuery(query) {
    this.searchInput.value = query || '';
    this.clearButton.style.display = query ? 'block' : 'none';
  }

  /**
   * Show search results count
   * @param {number} count - Number of results
   * @param {number} total - Total number of sessions
   */
  showSearchResults(count, total) {
    this.searchResults.textContent = `${count} of ${total} sessions`;
    this.searchResults.style.display = 'block';
  }

  /**
   * Show no results message
   * @param {string} query - Search query
   */
  showNoResults(query) {
    const noResults = this.createElement('div', ['sessions-no-results']);
    noResults.textContent = `No sessions found for "${query}"`;
    this.sessionsList.appendChild(noResults);
  }

  /**
   * Show new session dialog
   */
  showNewSessionDialog() {
    this.newSessionDialog.style.display = 'block';
    
    // Focus name input
    const nameInput = this.newSessionDialog.querySelector('input[name="name"]');
    nameInput.focus();
  }

  /**
   * Hide new session dialog
   */
  hideNewSessionDialog() {
    this.newSessionDialog.style.display = 'none';
    
    // Clear form
    const form = this.newSessionDialog.querySelector('.new-session-form');
    form.reset();
  }

  /**
   * Show session context menu
   * @param {string} sessionId - Session ID
   * @param {Object} position - Menu position {x, y}
   */
  showSessionContextMenu(sessionId, position) {
    this.contextMenu.style.display = 'block';
    this.contextMenu.style.left = `${position.x}px`;
    this.contextMenu.style.top = `${position.y}px`;
    this.contextMenu.dataset.sessionId = sessionId;
  }

  /**
   * Hide session context menu
   */
  hideSessionContextMenu() {
    this.contextMenu.style.display = 'none';
    delete this.contextMenu.dataset.sessionId;
  }

  /**
   * Show delete confirmation
   * @param {Object} session - Session to delete
   */
  showDeleteConfirmation(session) {
    const message = this.deleteConfirmation.querySelector('.confirmation-message');
    message.textContent = `Are you sure you want to delete "${session.name}"?`;
    
    this.deleteConfirmation.style.display = 'block';
    this.deleteConfirmation.dataset.sessionId = session.id;
  }

  /**
   * Hide delete confirmation
   */
  hideDeleteConfirmation() {
    this.deleteConfirmation.style.display = 'none';
    delete this.deleteConfirmation.dataset.sessionId;
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.clearError();
    
    this.errorMessage = this.createElement('div', ['sessions-error']);
    this.errorMessage.textContent = message;
    
    // Add retry button
    const retryButton = this.createElement('button', ['retry-button']);
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', () => {
      if (this.onRetry) {
        this.onRetry();
      }
    });
    
    this.errorMessage.appendChild(retryButton);
    this.sessionPanel.appendChild(this.errorMessage);
  }

  /**
   * Clear error message
   */
  clearError() {
    if (this.errorMessage) {
      this.errorMessage.remove();
      this.errorMessage = null;
    }
  }

  /**
   * Focus search input
   */
  focusSearch() {
    this.searchInput.focus();
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Search input
    this.searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      this.clearButton.style.display = query ? 'block' : 'none';
      
      if (this.onSearchInput) {
        this.onSearchInput(query);
      }
    });
    
    // Clear search button
    this.clearButton.addEventListener('click', () => {
      this.searchInput.value = '';
      this.clearButton.style.display = 'none';
      
      if (this.onSearchClear) {
        this.onSearchClear();
      }
    });
    
    // New session button
    this.newSessionButton.addEventListener('click', () => {
      if (this.onNewSession) {
        this.onNewSession();
      }
    });
    
    // New session form
    this.newSessionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const sessionData = {
        name: formData.get('name'),
        type: formData.get('type'),
        description: formData.get('description')
      };
      
      if (this.onCreateSession) {
        this.onCreateSession(sessionData);
      }
    });
    
    // Dialog cancel button
    const cancelButton = this.newSessionDialog.querySelector('.cancel-button');
    cancelButton.addEventListener('click', () => {
      this.hideNewSessionDialog();
    });
    
    // Context menu options
    const duplicateOption = this.contextMenu.querySelector('.duplicate-option');
    duplicateOption.addEventListener('click', () => {
      const sessionId = this.contextMenu.dataset.sessionId;
      if (sessionId && this.onSessionDuplicate) {
        this.onSessionDuplicate(sessionId);
      }
      this.hideSessionContextMenu();
    });
    
    const exportOption = this.contextMenu.querySelector('.export-option');
    exportOption.addEventListener('click', () => {
      const sessionId = this.contextMenu.dataset.sessionId;
      if (sessionId && this.onSessionExport) {
        this.onSessionExport(sessionId);
      }
      this.hideSessionContextMenu();
    });
    
    const deleteOption = this.contextMenu.querySelector('.delete-option');
    deleteOption.addEventListener('click', () => {
      const sessionId = this.contextMenu.dataset.sessionId;
      if (sessionId && this.onSessionDelete) {
        this.onSessionDelete(sessionId);
      }
      this.hideSessionContextMenu();
    });
    
    // Delete confirmation buttons
    const cancelDeleteButton = this.deleteConfirmation.querySelector('.cancel-delete');
    cancelDeleteButton.addEventListener('click', () => {
      this.hideDeleteConfirmation();
    });
    
    const confirmDeleteButton = this.deleteConfirmation.querySelector('.confirm-delete');
    confirmDeleteButton.addEventListener('click', () => {
      const sessionId = this.deleteConfirmation.dataset.sessionId;
      if (sessionId && this.onConfirmDelete) {
        this.onConfirmDelete(sessionId);
      }
      this.hideDeleteConfirmation();
    });
    
    // Keyboard navigation
    this.sessionsList.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (this.onNavigate) {
            this.onNavigate('down');
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (this.onNavigate) {
            this.onNavigate('up');
          }
          break;
          
        case 'Enter':
          e.preventDefault();
          if (this.highlightedSessionId && this.onSessionSelect) {
            const session = this.currentSessions.find(s => s.id === this.highlightedSessionId);
            if (session) {
              this.onSessionSelect(session);
            }
          }
          break;
      }
    });
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Focus search unless already in an input
        if (document.activeElement.tagName !== 'INPUT' && 
            document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.focusSearch();
        }
      }
    });
    
    // Click outside to close menus
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideSessionContextMenu();
      }
    });
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.sessionPanel && this.sessionPanel.parentNode) {
      this.sessionPanel.parentNode.removeChild(this.sessionPanel);
    }
    
    // Clear references
    this.onSessionClick = null;
    this.onSessionRightClick = null;
    this.onSearchInput = null;
    this.onSearchClear = null;
    this.onNewSession = null;
    this.onCreateSession = null;
    this.onNavigate = null;
    this.onSessionSelect = null;
    
    super.destroy();
  }
}