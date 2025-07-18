/**
 * Event System Type Definitions
 * 
 * This file defines TypeScript types for the jsEnvoy event system.
 * Events flow from Tools → Modules → Agents → WebSocket clients.
 */

/**
 * Supported event types in the system
 */
export type EventType = 'progress' | 'info' | 'warning' | 'error';

/**
 * Event priority levels
 */
export type EventLevel = 'low' | 'medium' | 'high';

/**
 * Base event structure emitted by modules and tools
 */
export interface BaseEvent {
  /** Event type */
  type: EventType;
  
  /** Source module name */
  module: string;
  
  /** Source tool name (optional) */
  tool?: string;
  
  /** Human-readable message */
  message: string;
  
  /** Optional event-specific data */
  data?: Record<string, any>;
  
  /** ISO timestamp */
  timestamp: string;
  
  /** Event priority level */
  level: EventLevel;
}

/**
 * Progress event data structure
 */
export interface ProgressEventData {
  /** Current progress value */
  current?: number;
  
  /** Total value for percentage calculation */
  total?: number;
  
  /** Progress percentage (0-100) */
  percentage?: number;
  
  /** Current operation being performed */
  operation?: string;
  
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
}

/**
 * Error event data structure
 */
export interface ErrorEventData {
  /** Error code */
  code?: string;
  
  /** Stack trace */
  stack?: string;
  
  /** Original error object */
  error?: Error | any;
  
  /** Context where error occurred */
  context?: Record<string, any>;
}

/**
 * Warning event data structure
 */
export interface WarningEventData {
  /** Warning code */
  code?: string;
  
  /** Suggested action to resolve warning */
  suggestedAction?: string;
  
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Info event data structure
 */
export interface InfoEventData {
  /** Category of information */
  category?: string;
  
  /** Additional details */
  details?: Record<string, any>;
}

/**
 * Event enriched with agent context
 */
export interface AgentEvent extends BaseEvent {
  /** Agent identifier */
  agentId: string;
  
  /** Agent name */
  agentName: string;
}

/**
 * WebSocket event message structure
 */
export interface WebSocketEventMessage {
  /** Message type */
  type: 'event';
  
  /** Event data */
  event: AgentEvent;
  
  /** WebSocket message ID */
  id?: string;
}

/**
 * Event subscription request
 */
export interface EventSubscription {
  /** Subscription ID */
  id: string;
  
  /** Request type */
  type: 'subscribe-events';
  
  /** Optional event filter */
  filter?: EventFilter;
}

/**
 * Event filter for subscriptions
 */
export interface EventFilter {
  /** Filter by event types */
  types?: EventType[];
  
  /** Filter by module names */
  modules?: string[];
  
  /** Filter by event levels */
  levels?: EventLevel[];
}

/**
 * Event emitter methods interface
 */
export interface EventEmitterMethods {
  /**
   * Emit a progress event
   * @param message - Progress message
   * @param data - Optional progress data
   * @param level - Event priority level
   */
  emitProgress(message: string, data?: ProgressEventData, level?: EventLevel): void;
  
  /**
   * Emit an info event
   * @param message - Information message
   * @param data - Optional info data
   * @param level - Event priority level
   */
  emitInfo(message: string, data?: InfoEventData, level?: EventLevel): void;
  
  /**
   * Emit a warning event
   * @param message - Warning message
   * @param data - Optional warning data
   * @param level - Event priority level
   */
  emitWarning(message: string, data?: WarningEventData, level?: EventLevel): void;
  
  /**
   * Emit an error event
   * @param message - Error message
   * @param data - Optional error data
   * @param level - Event priority level
   */
  emitError(message: string, data?: ErrorEventData, level?: EventLevel): void;
}

/**
 * Event listener callback
 */
export type EventListener = (event: BaseEvent | AgentEvent) => void;

/**
 * Module event emitter interface
 */
export interface ModuleEventEmitter extends EventEmitterMethods {
  /** Module name for event context */
  name: string;
  
  /**
   * Add event listener
   * @param eventName - Event name to listen for
   * @param listener - Callback function
   */
  on(eventName: 'event' | EventType, listener: EventListener): this;
  
  /**
   * Remove event listener
   * @param eventName - Event name
   * @param listener - Callback function to remove
   */
  off(eventName: 'event' | EventType, listener: EventListener): this;
  
  /**
   * Emit a generic event
   * @param eventName - Event name
   * @param event - Event data
   */
  emit(eventName: string, event: BaseEvent): boolean;
}

/**
 * Tool event emitter interface
 */
export interface ToolEventEmitter extends EventEmitterMethods {
  /** Tool name for event context */
  name: string;
  
  /** Parent module reference */
  module?: ModuleEventEmitter;
}

/**
 * Agent event emitter interface
 */
export interface AgentEventEmitter {
  /** Agent ID */
  id: string;
  
  /** Agent name */
  name: string;
  
  /**
   * Listen to module events
   * @param eventName - Event name ('module-event')
   * @param listener - Callback function
   */
  on(eventName: 'module-event', listener: (event: AgentEvent) => void): this;
  
  /**
   * Register a module for event relay
   * @param module - Module to register
   */
  registerModule(module: ModuleEventEmitter): void;
}

export default {
  EventType,
  EventLevel,
  BaseEvent,
  AgentEvent,
  WebSocketEventMessage,
  EventSubscription,
  EventFilter,
  EventEmitterMethods,
  ModuleEventEmitter,
  ToolEventEmitter,
  AgentEventEmitter
};