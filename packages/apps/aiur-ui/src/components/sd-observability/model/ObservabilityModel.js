/**
 * ObservabilityModel - State management for ROMA execution observability
 * Manages execution events, progress tracking, and event history
 */

export class ObservabilityModel {
  constructor() {
    this.state = {
      activeExecutions: new Map(), // executionId -> execution data
      eventHistory: [], // Array of all events
      filteredEvents: [], // Currently visible events
      filters: {
        showLLMEvents: true,
        showToolEvents: true,
        showSystemEvents: true,
        showErrorEvents: true,
        searchText: '',
        executionId: null // Filter by specific execution
      },
      statistics: {
        totalExecutions: 0,
        totalEvents: 0,
        totalErrors: 0,
        avgExecutionTime: 0
      }
    };
    
    // Event listeners
    this.onStateChange = null;
    this.onExecutionUpdate = null;
    this.onNewEvent = null;
  }
  
  /**
   * Add a new event to the model
   */
  addEvent(event) {
    const timestamp = Date.now();
    const processedEvent = {
      id: `event_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      originalTimestamp: event.timestamp || timestamp,
      ...event
    };
    
    // Add to event history
    this.state.eventHistory.push(processedEvent);
    this.state.statistics.totalEvents++;
    
    // Process event by type
    this.processEventByType(processedEvent);
    
    // Update filtered events
    this.updateFilteredEvents();
    
    // Notify listeners
    if (this.onNewEvent) {
      this.onNewEvent(processedEvent);
    }
    
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }
  
  /**
   * Process event based on its type to update execution tracking
   */
  processEventByType(event) {
    const { type, data } = event;
    
    switch (type) {
      case 'execution_started':
        this.handleExecutionStarted(event);
        break;
        
      case 'execution_complete':
      case 'execution_error':
        this.handleExecutionComplete(event);
        break;
        
      case 'llm_request':
        this.handleLLMRequest(event);
        break;
        
      case 'tool_execution_start':
        this.handleToolExecutionStart(event);
        break;
        
      case 'tool_execution_complete':
        this.handleToolExecutionComplete(event);
        break;
        
      case 'task_analysis':
      case 'strategy_selection':
        this.handleAnalysisEvent(event);
        break;
        
      default:
        // Generic event processing
        this.handleGenericEvent(event);
    }
  }
  
  /**
   * Handle execution started events
   */
  handleExecutionStarted(event) {
    const { data } = event;
    const executionId = data.executionId;
    
    if (executionId) {
      this.state.activeExecutions.set(executionId, {
        id: executionId,
        task: data.task,
        startTime: event.timestamp,
        status: 'running',
        events: [event],
        llmRequests: 0,
        toolExecutions: 0,
        errors: 0
      });
      
      this.state.statistics.totalExecutions++;
    }
  }
  
  /**
   * Handle execution completion events
   */
  handleExecutionComplete(event) {
    const { data } = event;
    const executionId = data.executionId;
    
    if (executionId && this.state.activeExecutions.has(executionId)) {
      const execution = this.state.activeExecutions.get(executionId);
      execution.endTime = event.timestamp;
      execution.duration = execution.endTime - execution.startTime;
      execution.status = event.type === 'execution_error' ? 'failed' : 'completed';
      execution.result = data.result || data.error;
      execution.events.push(event);
      
      if (event.type === 'execution_error') {
        execution.errors++;
        this.state.statistics.totalErrors++;
      }
      
      // Update average execution time
      this.updateAverageExecutionTime();
    }
  }
  
  /**
   * Handle LLM request events
   */
  handleLLMRequest(event) {
    const executionId = this.extractExecutionId(event);
    if (executionId && this.state.activeExecutions.has(executionId)) {
      const execution = this.state.activeExecutions.get(executionId);
      execution.llmRequests++;
      execution.events.push(event);
    }
  }
  
  /**
   * Handle tool execution events
   */
  handleToolExecutionStart(event) {
    const executionId = this.extractExecutionId(event);
    if (executionId && this.state.activeExecutions.has(executionId)) {
      const execution = this.state.activeExecutions.get(executionId);
      execution.toolExecutions++;
      execution.events.push(event);
    }
  }
  
  /**
   * Handle tool execution complete events
   */
  handleToolExecutionComplete(event) {
    const executionId = this.extractExecutionId(event);
    if (executionId && this.state.activeExecutions.has(executionId)) {
      const execution = this.state.activeExecutions.get(executionId);
      execution.events.push(event);
    }
  }
  
  /**
   * Handle analysis and strategy events
   */
  handleAnalysisEvent(event) {
    const executionId = this.extractExecutionId(event);
    if (executionId && this.state.activeExecutions.has(executionId)) {
      const execution = this.state.activeExecutions.get(executionId);
      execution.events.push(event);
    }
  }
  
  /**
   * Handle generic events
   */
  handleGenericEvent(event) {
    const executionId = this.extractExecutionId(event);
    if (executionId && this.state.activeExecutions.has(executionId)) {
      const execution = this.state.activeExecutions.get(executionId);
      execution.events.push(event);
    }
  }
  
  /**
   * Extract execution ID from event data
   */
  extractExecutionId(event) {
    return event.data?.executionId || 
           event.data?.id || 
           event.executionId ||
           null;
  }
  
  /**
   * Update filtered events based on current filters
   */
  updateFilteredEvents() {
    const { filters } = this.state;
    
    this.state.filteredEvents = this.state.eventHistory.filter(event => {
      // Filter by execution ID
      if (filters.executionId) {
        const eventExecutionId = this.extractExecutionId(event);
        if (eventExecutionId !== filters.executionId) {
          return false;
        }
      }
      
      // Filter by event type
      if (!filters.showLLMEvents && this.isLLMEvent(event)) {
        return false;
      }
      
      if (!filters.showToolEvents && this.isToolEvent(event)) {
        return false;
      }
      
      if (!filters.showSystemEvents && this.isSystemEvent(event)) {
        return false;
      }
      
      if (!filters.showErrorEvents && this.isErrorEvent(event)) {
        return false;
      }
      
      // Filter by search text
      if (filters.searchText) {
        const searchText = filters.searchText.toLowerCase();
        const eventText = JSON.stringify(event).toLowerCase();
        if (!eventText.includes(searchText)) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Check if event is LLM-related
   */
  isLLMEvent(event) {
    return event.type.includes('llm') || 
           event.type.includes('prompt') ||
           event.type.includes('model');
  }
  
  /**
   * Check if event is tool-related
   */
  isToolEvent(event) {
    return event.type.includes('tool') ||
           event.type.includes('execution');
  }
  
  /**
   * Check if event is system-related
   */
  isSystemEvent(event) {
    return event.type.includes('strategy') ||
           event.type.includes('analysis') ||
           event.type === 'ready' ||
           event.type === 'execution_started';
  }
  
  /**
   * Check if event is error-related
   */
  isErrorEvent(event) {
    return event.type.includes('error') ||
           event.type.includes('failed');
  }
  
  /**
   * Update filters and refresh filtered events
   */
  updateFilters(newFilters) {
    this.state.filters = { ...this.state.filters, ...newFilters };
    this.updateFilteredEvents();
    
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }
  
  /**
   * Clear all events and executions
   */
  clear() {
    this.state.eventHistory = [];
    this.state.filteredEvents = [];
    this.state.activeExecutions.clear();
    this.state.statistics = {
      totalExecutions: 0,
      totalEvents: 0,
      totalErrors: 0,
      avgExecutionTime: 0
    };
    
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }
  
  /**
   * Get execution by ID
   */
  getExecution(executionId) {
    return this.state.activeExecutions.get(executionId);
  }
  
  /**
   * Get all active executions
   */
  getActiveExecutions() {
    return Array.from(this.state.activeExecutions.values());
  }
  
  /**
   * Update average execution time
   */
  updateAverageExecutionTime() {
    const completedExecutions = Array.from(this.state.activeExecutions.values())
      .filter(exec => exec.duration !== undefined);
    
    if (completedExecutions.length > 0) {
      const totalTime = completedExecutions.reduce((sum, exec) => sum + exec.duration, 0);
      this.state.statistics.avgExecutionTime = totalTime / completedExecutions.length;
    }
  }
  
  /**
   * Get state
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.state.statistics };
  }
}