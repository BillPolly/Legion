/**
 * Standard Component API Interface Specification
 * Defines the standardized API pattern for all planning components
 */

/**
 * Base Component API Interface
 * All planning components should implement this interface consistently
 */
export class BaseComponentAPI {
  /**
   * Component Lifecycle Methods
   * These methods should be present in all component APIs
   */
  
  // Core lifecycle
  static getRequiredMethods() {
    return [
      'isReady',
      'getState', 
      'setState',
      'reset',
      'destroy'
    ];
  }

  // Data methods pattern
  static getDataMethodPatterns() {
    return {
      // Getters should be named: get[Property]()
      getters: /^get[A-Z][a-zA-Z]*$/,
      
      // Setters should be named: set[Property](value)
      setters: /^set[A-Z][a-zA-Z]*$/,
      
      // Boolean checks should be named: is[Property]() or has[Property]()
      checks: /^(is|has)[A-Z][a-zA-Z]*$/,
      
      // Actions should be named: [verb][Object]()
      actions: /^(create|update|delete|add|remove|clear|start|stop|pause|resume)[A-Z][a-zA-Z]*$/
    };
  }

  // Event handling pattern
  static getEventMethodPatterns() {
    return {
      // Event handlers should be named: handle[Event]()
      handlers: /^handle[A-Z][a-zA-Z]*$/,
      
      // Event emitters should be named: on[Event]()
      emitters: /^on[A-Z][a-zA-Z]*$/
    };
  }

  // Standard error handling
  static getErrorHandlingMethods() {
    return [
      'getLastError',
      'clearError',
      'hasError'
    ];
  }

  // Standard validation methods
  static getValidationMethods() {
    return [
      'validate',
      'isValid',
      'getValidationErrors'
    ];
  }
}

/**
 * Standard API Method Categories
 * Components should organize their API methods into these categories
 */
export const API_CATEGORIES = {
  // Core component lifecycle
  LIFECYCLE: 'lifecycle',
  
  // Data management (CRUD operations)
  DATA: 'data',
  
  // UI state and interactions
  UI: 'ui',
  
  // Event handling
  EVENTS: 'events',
  
  // Validation and error handling
  VALIDATION: 'validation',
  
  // Import/export functionality
  IO: 'io'
};

/**
 * Standard API Response Format
 * All API methods should return responses in this format for consistency
 */
export class APIResponse {
  constructor(success, data = null, error = null, metadata = {}) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.timestamp = new Date().toISOString();
    this.metadata = metadata;
  }

  static success(data, metadata = {}) {
    return new APIResponse(true, data, null, metadata);
  }

  static error(error, metadata = {}) {
    return new APIResponse(false, null, error, metadata);
  }
}

/**
 * Standard Component API Template
 * Template for implementing standardized APIs
 */
export const STANDARD_API_TEMPLATE = {
  // === LIFECYCLE METHODS ===
  isReady: () => Boolean,
  getState: (key) => any,
  setState: (key, value) => APIResponse,
  reset: () => APIResponse,
  destroy: () => APIResponse,

  // === ERROR HANDLING ===
  getLastError: () => Error | null,
  clearError: () => APIResponse,
  hasError: () => Boolean,

  // === VALIDATION ===
  validate: () => APIResponse,
  isValid: () => Boolean,
  getValidationErrors: () => Array,

  // === COMMON DATA METHODS ===
  // Should be implemented based on component needs:
  // - get[Property]()
  // - set[Property](value)
  // - is[Property]()
  // - has[Property]()

  // === COMMON ACTION METHODS ===
  // Should be implemented based on component needs:
  // - create[Object](data)
  // - update[Object](id, data)
  // - delete[Object](id)
  // - clear[Objects]()
};

/**
 * API Method Naming Conventions
 */
export const NAMING_CONVENTIONS = {
  // Method names should be camelCase
  casing: 'camelCase',
  
  // Async methods should be marked clearly
  async: {
    suffix: 'Async',
    example: 'loadDataAsync()'
  },
  
  // Event handlers
  eventHandlers: {
    prefix: 'handle',
    example: 'handleNodeClick()'
  },
  
  // Boolean returns
  booleans: {
    prefixes: ['is', 'has', 'can', 'should'],
    examples: ['isReady()', 'hasError()', 'canExecute()']
  },
  
  // Getters/Setters
  getters: {
    prefix: 'get',
    example: 'getCurrentPlan()'
  },
  setters: {
    prefix: 'set', 
    example: 'setCurrentPlan(plan)'
  },
  
  // Actions
  actions: {
    verbs: ['create', 'update', 'delete', 'add', 'remove', 'clear', 'start', 'stop', 'pause', 'resume'],
    examples: ['createPlan()', 'startExecution()', 'clearCache()']
  }
};

/**
 * Component API Documentation Template
 */
export const API_DOCUMENTATION_TEMPLATE = {
  componentName: 'string',
  version: 'string',
  description: 'string',
  
  methods: {
    lifecycle: [],
    data: [],
    ui: [],
    events: [],
    validation: [],
    io: []
  },
  
  events: {
    emitted: [],
    subscribed: []
  },
  
  dependencies: [],
  examples: []
};