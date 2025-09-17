/**
 * ObservabilityView - UI rendering for ROMA execution observability
 * Displays execution progress, events, and detailed analysis
 */

export class ObservabilityView {
  constructor(container) {
    this.container = container;
    
    // DOM elements
    this.elements = {
      main: null,
      header: null,
      filterBar: null,
      content: null,
      executionsPanel: null,
      eventsPanel: null,
      detailsPanel: null
    };
    
    // State
    this.state = {
      filteredEvents: [],
      activeExecutions: [],
      selectedExecution: null,
      statistics: {}
    };
    
    this.createDOM();
    this.bindEvents();
  }
  
  /**
   * Create DOM structure
   */
  createDOM() {
    // Clear container
    this.container.innerHTML = '';
    
    // Main container
    this.elements.main = document.createElement('div');
    this.elements.main.className = 'observability-main';
    
    // Header with statistics
    this.elements.header = document.createElement('div');
    this.elements.header.className = 'observability-header';
    
    // Filter bar
    this.elements.filterBar = document.createElement('div');
    this.elements.filterBar.className = 'observability-filter-bar';
    
    // Content area
    this.elements.content = document.createElement('div');
    this.elements.content.className = 'observability-content';
    
    // Left panel - Active executions
    this.elements.executionsPanel = document.createElement('div');
    this.elements.executionsPanel.className = 'observability-executions-panel';
    
    // Center panel - Events list
    this.elements.eventsPanel = document.createElement('div');
    this.elements.eventsPanel.className = 'observability-events-panel';
    
    // Right panel - Event details
    this.elements.detailsPanel = document.createElement('div');
    this.elements.detailsPanel.className = 'observability-details-panel';
    
    // Assemble structure
    this.elements.content.appendChild(this.elements.executionsPanel);
    this.elements.content.appendChild(this.elements.eventsPanel);
    this.elements.content.appendChild(this.elements.detailsPanel);
    
    this.elements.main.appendChild(this.elements.header);
    this.elements.main.appendChild(this.elements.filterBar);
    this.elements.main.appendChild(this.elements.content);
    
    this.container.appendChild(this.elements.main);
    
    // Apply styles
    this.applyStyles();
    
    // Create initial content
    this.renderHeader();
    this.renderFilterBar();
    this.renderExecutionsPanel();
    this.renderEventsPanel();
    this.renderDetailsPanel();
  }
  
  /**
   * Apply CSS styles
   */
  applyStyles() {
    // Main container
    Object.assign(this.elements.main.style, {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: '13px'
    });
    
    // Header
    Object.assign(this.elements.header.style, {
      flex: '0 0 auto',
      padding: '10px',
      backgroundColor: '#252525',
      borderBottom: '1px solid #444'
    });
    
    // Filter bar
    Object.assign(this.elements.filterBar.style, {
      flex: '0 0 auto',
      padding: '8px',
      backgroundColor: '#2a2a2a',
      borderBottom: '1px solid #444',
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    });
    
    // Content area
    Object.assign(this.elements.content.style, {
      flex: '1 1 auto',
      display: 'flex',
      minHeight: '0'
    });
    
    // Executions panel
    Object.assign(this.elements.executionsPanel.style, {
      flex: '0 0 250px',
      borderRight: '1px solid #444',
      overflowY: 'auto',
      backgroundColor: '#1e1e1e'
    });
    
    // Events panel
    Object.assign(this.elements.eventsPanel.style, {
      flex: '1 1 auto',
      overflowY: 'auto',
      backgroundColor: '#1a1a1a'
    });
    
    // Details panel
    Object.assign(this.elements.detailsPanel.style, {
      flex: '0 0 300px',
      borderLeft: '1px solid #444',
      overflowY: 'auto',
      backgroundColor: '#1e1e1e'
    });
  }
  
  /**
   * Render header with statistics
   */
  renderHeader() {
    const stats = this.state.statistics;
    this.elements.header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; color: #fff;">ROMA Execution Observability</h3>
        <div style="display: flex; gap: 20px; font-size: 12px;">
          <span>Executions: <strong>${stats.totalExecutions || 0}</strong></span>
          <span>Events: <strong>${stats.totalEvents || 0}</strong></span>
          <span>Errors: <strong style="color: #ff6b6b;">${stats.totalErrors || 0}</strong></span>
          <span>Avg Time: <strong>${stats.avgExecutionTime ? Math.round(stats.avgExecutionTime) + 'ms' : 'N/A'}</strong></span>
        </div>
      </div>
    `;
  }
  
  /**
   * Render filter bar
   */
  renderFilterBar() {
    this.elements.filterBar.innerHTML = `
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" id="filter-llm" checked>
        <span>LLM Events</span>
      </label>
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" id="filter-tools" checked>
        <span>Tool Events</span>
      </label>
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" id="filter-system" checked>
        <span>System Events</span>
      </label>
      <label style="display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" id="filter-errors" checked>
        <span>Error Events</span>
      </label>
      <input type="text" id="search-events" placeholder="Search events..." 
             style="padding: 4px 8px; background: #333; border: 1px solid #555; color: #e0e0e0; border-radius: 3px; margin-left: 10px;">
      <button id="clear-events" style="padding: 4px 8px; background: #444; border: 1px solid #666; color: #e0e0e0; border-radius: 3px; cursor: pointer; margin-left: 10px;">
        Clear All
      </button>
    `;
  }
  
  /**
   * Render executions panel
   */
  renderExecutionsPanel() {
    const executions = this.state.activeExecutions;
    
    let html = '<div style="padding: 10px; border-bottom: 1px solid #444;"><strong>Active Executions</strong></div>';
    
    if (executions.length === 0) {
      html += '<div style="padding: 10px; color: #888; font-style: italic;">No active executions</div>';
    } else {
      executions.forEach(execution => {
        const isSelected = this.state.selectedExecution === execution.id;
        const statusColor = execution.status === 'completed' ? '#4caf50' : 
                           execution.status === 'failed' ? '#f44336' : '#2196f3';
        
        html += `
          <div class="execution-item" data-execution-id="${execution.id}" 
               style="padding: 8px; border-bottom: 1px solid #333; cursor: pointer; 
                      background: ${isSelected ? '#333' : 'transparent'};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-weight: bold; color: ${statusColor};">${execution.id}</div>
              <div style="font-size: 11px; color: #888;">${execution.status}</div>
            </div>
            <div style="font-size: 11px; color: #ccc; margin-top: 2px;">
              ${execution.task?.description || 'No description'}
            </div>
            <div style="font-size: 10px; color: #888; margin-top: 4px;">
              LLM: ${execution.llmRequests}, Tools: ${execution.toolExecutions}, Events: ${execution.events?.length || 0}
            </div>
            ${execution.duration ? 
              `<div style="font-size: 10px; color: #888;">Duration: ${Math.round(execution.duration)}ms</div>` : 
              ''}
          </div>
        `;
      });
    }
    
    this.elements.executionsPanel.innerHTML = html;
  }
  
  /**
   * Render events panel
   */
  renderEventsPanel() {
    const events = this.state.filteredEvents;
    
    let html = '<div style="padding: 10px; border-bottom: 1px solid #444;"><strong>Events Log</strong></div>';
    
    if (events.length === 0) {
      html += '<div style="padding: 10px; color: #888; font-style: italic;">No events to display</div>';
    } else {
      events.reverse().forEach(event => { // Show newest first
        const eventColor = this.getEventColor(event.type);
        const timestamp = new Date(event.timestamp).toLocaleTimeString();
        
        html += `
          <div class="event-item" data-event-id="${event.id}"
               style="padding: 8px; border-bottom: 1px solid #2a2a2a; cursor: pointer;">
            <div style="display: flex; justify-content: between; align-items: center;">
              <div style="color: ${eventColor}; font-weight: bold;">${event.type}</div>
              <div style="font-size: 10px; color: #888; margin-left: auto;">${timestamp}</div>
            </div>
            <div style="font-size: 11px; color: #ccc; margin-top: 2px;">
              ${this.getEventSummary(event)}
            </div>
          </div>
        `;
      });
    }
    
    this.elements.eventsPanel.innerHTML = html;
  }
  
  /**
   * Render details panel
   */
  renderDetailsPanel() {
    let html = '<div style="padding: 10px; border-bottom: 1px solid #444;"><strong>Event Details</strong></div>';
    
    if (this.selectedEvent) {
      html += `
        <div style="padding: 10px;">
          <div style="margin-bottom: 10px;">
            <strong style="color: ${this.getEventColor(this.selectedEvent.type)};">${this.selectedEvent.type}</strong>
          </div>
          <div style="font-size: 11px; margin-bottom: 10px;">
            <strong>Timestamp:</strong> ${new Date(this.selectedEvent.timestamp).toLocaleString()}
          </div>
          <div style="font-size: 11px; margin-bottom: 10px;">
            <strong>Raw Data:</strong>
          </div>
          <pre style="background: #0d1117; padding: 8px; border-radius: 3px; overflow-x: auto; font-size: 10px; line-height: 1.4;">
${JSON.stringify(this.selectedEvent.data || this.selectedEvent, null, 2)}
          </pre>
        </div>
      `;
    } else {
      html += '<div style="padding: 10px; color: #888; font-style: italic;">Select an event to view details</div>';
    }
    
    this.elements.detailsPanel.innerHTML = html;
  }
  
  /**
   * Get color for event type
   */
  getEventColor(eventType) {
    if (eventType.includes('error') || eventType.includes('failed')) {
      return '#f44336';
    } else if (eventType.includes('llm') || eventType.includes('prompt')) {
      return '#9c27b0';
    } else if (eventType.includes('tool')) {
      return '#ff9800';
    } else if (eventType.includes('complete') || eventType.includes('success')) {
      return '#4caf50';
    } else if (eventType.includes('start')) {
      return '#2196f3';
    } else {
      return '#607d8b';
    }
  }
  
  /**
   * Get event summary text
   */
  getEventSummary(event) {
    switch (event.type) {
      case 'llm_request':
        return `Model: ${event.data?.model || 'unknown'}, Purpose: ${event.data?.purpose || 'unknown'}`;
      case 'tool_execution_start':
        return `Tool: ${event.data?.tool || 'unknown'}, Params: ${Object.keys(event.data?.params || {}).length} fields`;
      case 'tool_execution_complete':
        return `Result: ${event.data?.result?.success ? 'Success' : 'Failed'}`;
      case 'strategy_selection':
        return `Strategy: ${event.data?.strategy || 'unknown'}`;
      case 'task_analysis':
        return `Analysis: ${event.data?.analysis?.substring(0, 50) || 'No details'}...`;
      case 'execution_started':
        return `Task: ${event.data?.task?.description || 'No description'}`;
      case 'execution_complete':
        return `Success: ${event.data?.result?.success || false}`;
      case 'execution_error':
        return `Error: ${event.data?.error || 'Unknown error'}`;
      default:
        return event.data?.message || event.data?.content || 'No details';
    }
  }
  
  /**
   * Bind event handlers
   */
  bindEvents() {
    // Filter checkbox changes
    this.elements.filterBar.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        const filterType = e.target.id.replace('filter-', '');
        const checked = e.target.checked;
        this.onFilterChange?.(filterType, checked);
      }
    });
    
    // Search input
    const searchInput = this.elements.filterBar.querySelector('#search-events');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.onSearchChange?.(e.target.value);
      });
    }
    
    // Clear button
    const clearButton = this.elements.filterBar.querySelector('#clear-events');
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        this.onClearEvents?.();
      });
    }
    
    // Execution selection
    this.elements.executionsPanel.addEventListener('click', (e) => {
      const executionItem = e.target.closest('.execution-item');
      if (executionItem) {
        const executionId = executionItem.dataset.executionId;
        this.onExecutionSelect?.(executionId);
      }
    });
    
    // Event selection
    this.elements.eventsPanel.addEventListener('click', (e) => {
      const eventItem = e.target.closest('.event-item');
      if (eventItem) {
        const eventId = eventItem.dataset.eventId;
        this.onEventSelect?.(eventId);
      }
    });
  }
  
  /**
   * Update state and re-render
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }
  
  /**
   * Set selected event for details panel
   */
  setSelectedEvent(event) {
    this.selectedEvent = event;
    this.renderDetailsPanel();
  }
  
  /**
   * Re-render all panels
   */
  render() {
    this.renderHeader();
    this.renderExecutionsPanel();
    this.renderEventsPanel();
    this.renderDetailsPanel();
  }
  
  /**
   * Destroy component
   */
  destroy() {
    this.container.innerHTML = '';
  }
}