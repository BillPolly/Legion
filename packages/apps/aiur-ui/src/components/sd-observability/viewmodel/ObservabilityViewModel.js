/**
 * ObservabilityViewModel - MVVM controller for ROMA execution observability
 * Connects ObservabilityModel with ObservabilityView and handles user interactions
 */

import { ObservabilityModel } from '../model/ObservabilityModel.js';
import { ObservabilityView } from '../view/ObservabilityView.js';

export class ObservabilityViewModel {
  constructor(container) {
    this.container = container;
    
    // Create model and view
    this.model = new ObservabilityModel();
    this.view = new ObservabilityView(container);
    
    // Bind model events
    this.setupModelBindings();
    
    // Bind view events
    this.setupViewBindings();
    
    // Initialize view with current model state
    this.updateView();
  }
  
  /**
   * Setup model event bindings
   */
  setupModelBindings() {
    this.model.onStateChange = (state) => {
      this.updateView();
    };
    
    this.model.onNewEvent = (event) => {
      this.handleNewEvent(event);
    };
    
    this.model.onExecutionUpdate = (execution) => {
      this.handleExecutionUpdate(execution);
    };
  }
  
  /**
   * Setup view event bindings
   */
  setupViewBindings() {
    // Filter changes
    this.view.onFilterChange = (filterType, checked) => {
      this.handleFilterChange(filterType, checked);
    };
    
    // Search changes
    this.view.onSearchChange = (searchText) => {
      this.handleSearchChange(searchText);
    };
    
    // Clear events
    this.view.onClearEvents = () => {
      this.handleClearEvents();
    };
    
    // Execution selection
    this.view.onExecutionSelect = (executionId) => {
      this.handleExecutionSelect(executionId);
    };
    
    // Event selection
    this.view.onEventSelect = (eventId) => {
      this.handleEventSelect(eventId);
    };
  }
  
  /**
   * Handle new event from model
   */
  handleNewEvent(event) {
    // Auto-scroll to newest events in view if user isn't actively browsing
    // This could be enhanced with user preferences
    console.log('📊 [Observability] New event:', event.type);
  }
  
  /**
   * Handle execution update from model
   */
  handleExecutionUpdate(execution) {
    console.log('📊 [Observability] Execution update:', execution.id, execution.status);
  }
  
  /**
   * Handle filter changes from view
   */
  handleFilterChange(filterType, checked) {
    const filterMap = {
      'llm': 'showLLMEvents',
      'tools': 'showToolEvents', 
      'system': 'showSystemEvents',
      'errors': 'showErrorEvents'
    };
    
    const filterKey = filterMap[filterType];
    if (filterKey) {
      this.model.updateFilters({ [filterKey]: checked });
    }
  }
  
  /**
   * Handle search changes from view
   */
  handleSearchChange(searchText) {
    // Debounce search to avoid excessive filtering
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.model.updateFilters({ searchText });
    }, 300);
  }
  
  /**
   * Handle clear events from view
   */
  handleClearEvents() {
    if (confirm('Clear all events and execution history?')) {
      this.model.clear();
    }
  }
  
  /**
   * Handle execution selection from view
   */
  handleExecutionSelect(executionId) {
    // Filter events to show only events from this execution
    this.model.updateFilters({ executionId });
    
    // Update view to show selection
    this.view.setState({
      selectedExecution: executionId
    });
  }
  
  /**
   * Handle event selection from view
   */
  handleEventSelect(eventId) {
    // Find the event in the model
    const event = this.model.state.eventHistory.find(e => e.id === eventId);
    if (event) {
      this.view.setSelectedEvent(event);
    }
  }
  
  /**
   * Update view with current model state
   */
  updateView() {
    const state = this.model.getState();
    
    this.view.setState({
      filteredEvents: state.filteredEvents,
      activeExecutions: Array.from(state.activeExecutions.values()),
      statistics: state.statistics
    });
  }
  
  /**
   * Add event to model (called by external components like ROMAServerActor)
   */
  addEvent(event) {
    this.model.addEvent(event);
  }
  
  /**
   * Process ROMA server actor events
   */
  processROMAEvent(eventType, eventData) {
    // Transform ROMA server events into observability events
    const observabilityEvent = {
      type: eventType,
      data: eventData,
      timestamp: eventData.timestamp || Date.now()
    };
    
    this.addEvent(observabilityEvent);
  }
  
  /**
   * Handle specific ROMA execution events
   */
  handleExecutionStarted(data) {
    this.processROMAEvent('execution_started', data);
  }
  
  handleExecutionComplete(data) {
    this.processROMAEvent('execution_complete', data);
  }
  
  handleExecutionError(data) {
    this.processROMAEvent('execution_error', data);
  }
  
  handleTaskProgress(data) {
    // Task progress can contain multiple event types
    const { executionId, ...progressData } = data;
    
    // Determine event type from progress data
    let eventType = 'task_progress';
    
    if (progressData.type) {
      eventType = progressData.type;
    } else if (progressData.tool) {
      eventType = 'tool_execution_start';
    } else if (progressData.model) {
      eventType = 'llm_request';
    } else if (progressData.strategy) {
      eventType = 'strategy_selection';
    } else if (progressData.analysis) {
      eventType = 'task_analysis';
    }
    
    this.processROMAEvent(eventType, {
      executionId,
      ...progressData
    });
  }
  
  /**
   * Get current statistics
   */
  getStatistics() {
    return this.model.getStatistics();
  }
  
  /**
   * Get active executions
   */
  getActiveExecutions() {
    return this.model.getActiveExecutions();
  }
  
  /**
   * Get execution by ID
   */
  getExecution(executionId) {
    return this.model.getExecution(executionId);
  }
  
  /**
   * Export events as JSON for debugging
   */
  exportEvents() {
    const state = this.model.getState();
    const exportData = {
      timestamp: new Date().toISOString(),
      statistics: state.statistics,
      executions: Array.from(state.activeExecutions.values()),
      events: state.eventHistory
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `roma-observability-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  /**
   * Import events from JSON for debugging
   */
  importEvents(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Clear current events
        this.model.clear();
        
        // Import events
        if (data.events) {
          data.events.forEach(event => {
            this.model.addEvent(event);
          });
        }
        
        console.log('📊 [Observability] Imported', data.events?.length || 0, 'events');
      } catch (error) {
        console.error('📊 [Observability] Import failed:', error);
        alert('Failed to import events: ' + error.message);
      }
    };
    
    reader.readAsText(file);
  }
  
  /**
   * Reset filters to show all events
   */
  resetFilters() {
    this.model.updateFilters({
      showLLMEvents: true,
      showToolEvents: true,
      showSystemEvents: true,
      showErrorEvents: true,
      searchText: '',
      executionId: null
    });
    
    // Reset view filter UI
    const checkboxes = this.view.elements.filterBar.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    
    const searchInput = this.view.elements.filterBar.querySelector('#search-events');
    if (searchInput) {
      searchInput.value = '';
    }
  }
  
  /**
   * Destroy component
   */
  destroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    if (this.view) {
      this.view.destroy();
    }
    
    // Clear model references
    this.model = null;
    this.view = null;
  }
}