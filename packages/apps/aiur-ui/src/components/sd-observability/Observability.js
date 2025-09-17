/**
 * Observability - Main ROMA execution observability component
 * Provides comprehensive real-time monitoring of ROMA agent execution
 */

import { ObservabilityViewModel } from './viewmodel/ObservabilityViewModel.js';

export class Observability {
  constructor(container) {
    this.container = container;
    this.viewModel = null;
    this.isInitialized = false;
  }
  
  /**
   * Initialize the observability component
   */
  async initialize() {
    try {
      console.log('📊 [Observability] Initializing observability component...');
      
      // Create the view model which will create model and view
      this.viewModel = new ObservabilityViewModel(this.container);
      
      this.isInitialized = true;
      console.log('✅ [Observability] Observability component initialized');
      
      return true;
    } catch (error) {
      console.error('❌ [Observability] Failed to initialize:', error);
      return false;
    }
  }
  
  /**
   * Connect to ROMA server actor for event streaming
   */
  connectToROMAServerActor(serverActor) {
    if (!this.isInitialized) {
      console.warn('⚠️ [Observability] Component not initialized, cannot connect to server actor');
      return;
    }
    
    console.log('📊 [Observability] Connecting to ROMA server actor...');
    
    // Store reference to server actor
    this.serverActor = serverActor;
    
    // Hook into server actor's remote actor to capture all events
    if (serverActor.remoteActor) {
      this.interceptServerActorEvents(serverActor.remoteActor);
    }
  }
  
  /**
   * Intercept events from ROMA server actor's remote actor
   */
  interceptServerActorEvents(remoteActor) {
    // Store original receive method
    const originalReceive = remoteActor.receive.bind(remoteActor);
    
    // Override receive method to capture events
    remoteActor.receive = (eventType, data) => {
      // Forward to observability
      this.handleROMAEvent(eventType, data);
      
      // Call original receive method
      return originalReceive(eventType, data);
    };
    
    console.log('✅ [Observability] Successfully intercepting ROMA server events');
  }
  
  /**
   * Handle ROMA events and forward to view model
   */
  handleROMAEvent(eventType, eventData) {
    if (!this.viewModel) return;
    
    console.log('📊 [Observability] Received ROMA event:', eventType);
    
    // Process different event types
    switch (eventType) {
      case 'ready':
        this.viewModel.processROMAEvent('system_ready', eventData);
        break;
        
      case 'execution_started':
        this.viewModel.handleExecutionStarted(eventData);
        break;
        
      case 'execution_complete':
        this.viewModel.handleExecutionComplete(eventData);
        break;
        
      case 'execution_error':
        this.viewModel.handleExecutionError(eventData);
        break;
        
      case 'task_progress':
        this.viewModel.handleTaskProgress(eventData);
        break;
        
      default:
        // Generic event processing
        this.viewModel.processROMAEvent(eventType, eventData);
    }
  }
  
  /**
   * Add event directly (for testing or external integration)
   */
  addEvent(event) {
    if (this.viewModel) {
      this.viewModel.addEvent(event);
    }
  }
  
  /**
   * Get current statistics
   */
  getStatistics() {
    return this.viewModel?.getStatistics() || {};
  }
  
  /**
   * Get active executions
   */
  getActiveExecutions() {
    return this.viewModel?.getActiveExecutions() || [];
  }
  
  /**
   * Clear all events and reset
   */
  clear() {
    if (this.viewModel) {
      this.viewModel.handleClearEvents();
    }
  }
  
  /**
   * Export events for debugging
   */
  exportEvents() {
    if (this.viewModel) {
      this.viewModel.exportEvents();
    }
  }
  
  /**
   * Show/hide the observability component
   */
  show() {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }
  
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
  
  /**
   * Check if component is visible
   */
  isVisible() {
    return this.container && this.container.style.display !== 'none';
  }
  
  /**
   * Destroy the component and clean up resources
   */
  destroy() {
    console.log('📊 [Observability] Destroying observability component...');
    
    if (this.viewModel) {
      this.viewModel.destroy();
      this.viewModel = null;
    }
    
    this.serverActor = null;
    this.isInitialized = false;
    
    console.log('✅ [Observability] Observability component destroyed');
  }
}

/**
 * Factory function to create observability component
 */
export function createObservability(container) {
  return new Observability(container);
}