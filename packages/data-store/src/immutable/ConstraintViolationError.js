/**
 * ConstraintViolationError - Custom error for constraint validation failures
 * Per implementation plan Phase 3 Step 3.5
 * 
 * Provides comprehensive error reporting with context, debugging information,
 * and recovery suggestions for constraint violations in ImmutableDataStore.
 */

export class ConstraintViolationError extends Error {
  constructor(operation, violations, context = {}) {
    super('Constraint validation failed');
    
    this.name = 'ConstraintViolationError';
    this.operation = operation;
    this.violations = violations;
    this.timestamp = Date.now();
    
    // Core context
    this.edge = context.edge;
    this.storeState = context.storeState;
    this.storeFingerprint = context.storeFingerprint;
    this.operationContext = context.operationContext;
    
    // Batch operation context
    this.batchOperations = context.batchOperations;
    
    // Error chaining
    this.nestedError = context.nestedError;
    this.cause = context.cause;
    this.callStack = context.callStack || [];
    
    // Performance metrics
    this.performanceMetrics = context.performanceMetrics;
    
    // Validation path for debugging
    this.validationPath = context.validationPath || [];
    
    // Recovery information
    this.retryable = this._determineRetryability();
    this.retryInstructions = this._generateRetryInstructions();
    this.suggestions = this._generateSuggestions();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConstraintViolationError);
    }
  }
  
  /**
   * Determine if the operation is retryable after making changes
   */
  _determineRetryability() {
    // Constraint violations are generally retryable after addressing the violation
    if (this.violations && this.violations.length > 0) {
      return true;
    }
    
    // System errors or malformed operations may not be retryable
    return false;
  }
  
  /**
   * Generate specific retry instructions based on violation types
   */
  _generateRetryInstructions() {
    const instructions = {
      canRetryAfter: [],
      cannotRetryWith: ['same parameters without changes']
    };
    
    for (const violation of this.violations || []) {
      if (violation.constraintId) {
        // Constraint-specific retry options
        const message = violation.message || '';
        if (message.includes('cardinality')) {
          instructions.canRetryAfter.push('removeEdge', 'removeConstraint');
        }
        if (message.includes('entity type')) {
          instructions.canRetryAfter.push('changeEntityType', 'removeConstraint');
        }
      }
    }
    
    // Remove duplicates
    instructions.canRetryAfter = [...new Set(instructions.canRetryAfter)];
    
    return instructions;
  }
  
  /**
   * Generate helpful suggestions for resolving the constraint violation
   */
  _generateSuggestions() {
    const suggestions = [];
    
    for (const violation of this.violations || []) {
      const message = violation.message || '';
      if (message.includes('maximum cardinality')) {
        suggestions.push('Remove existing edge before adding new one');
        suggestions.push('Increase cardinality limit');
        suggestions.push(`Remove constraint ${violation.constraintId}`);
      }
      
      if (message.includes('minimum cardinality')) {
        suggestions.push('Add more edges to meet minimum requirement');
        suggestions.push('Decrease cardinality minimum');
        suggestions.push(`Remove constraint ${violation.constraintId}`);
      }
      
      if (message.includes('entity type')) {
        suggestions.push('Change entity type to match constraint requirements');
        suggestions.push('Modify constraint to allow current entity types');
        suggestions.push(`Remove constraint ${violation.constraintId}`);
      }
      
      if (message.includes('custom')) {
        suggestions.push('Review custom constraint logic');
        suggestions.push('Modify data to satisfy custom constraint');
        suggestions.push(`Remove constraint ${violation.constraintId}`);
      }
    }
    
    // Remove duplicates and return
    return [...new Set(suggestions)];
  }
  
  /**
   * Add validation step to the path for debugging
   */
  addValidationStep(step) {
    this.validationPath.push(step);
  }
  
  /**
   * Add call to the call stack for nested operations
   */
  addCallStackEntry(entry) {
    this.callStack.push(entry);
  }
  
  /**
   * Create a new error with additional context for nested operations
   */
  withNestedContext(nestedError, callStackEntry) {
    const newError = new ConstraintViolationError(
      this.operation,
      this.violations,
      {
        ...this._getContext(),
        nestedError,
        callStack: [...this.callStack, callStackEntry]
      }
    );
    
    return newError;
  }
  
  /**
   * Create a new error with a cause for error chaining
   */
  withCause(cause) {
    const newError = new ConstraintViolationError(
      this.operation,
      this.violations,
      {
        ...this._getContext(),
        cause
      }
    );
    
    return newError;
  }
  
  /**
   * Get all context for error creation
   */
  _getContext() {
    return {
      edge: this.edge,
      storeState: this.storeState,
      storeFingerprint: this.storeFingerprint,
      operationContext: this.operationContext,
      batchOperations: this.batchOperations,
      nestedError: this.nestedError,
      cause: this.cause,
      callStack: this.callStack,
      performanceMetrics: this.performanceMetrics,
      validationPath: this.validationPath
    };
  }
  
  /**
   * Convert error to JSON for logging and serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      operation: this.operation,
      violations: this.violations?.map(v => ({
        constraintId: v.constraintId,
        message: v.message,
        context: v.context,
        edge: v.edge ? {
          relationshipType: v.edge.relationshipType,
          src: v.edge.src,
          dest: v.edge.dest
        } : undefined
      })),
      operationContext: this.operationContext,
      storeFingerprint: this.storeFingerprint,
      timestamp: this.timestamp,
      suggestions: this.suggestions,
      retryable: this.retryable,
      retryInstructions: this.retryInstructions,
      validationPath: this.validationPath,
      callStack: this.callStack,
      performanceMetrics: this.performanceMetrics,
      batchOperations: this.batchOperations?.map(op => ({
        operation: op.operation,
        parameters: op.parameters ? {
          relationshipType: op.parameters.relationshipType,
          src: op.parameters.src,
          dest: op.parameters.dest
        } : op.parameters
      })),
      nestedError: this.nestedError?.toJSON?.() || this.nestedError?.message,
      cause: this.cause?.message
    };
  }
  
  /**
   * Create a ConstraintViolationError from operation context
   */
  static fromValidationFailure(operation, violations, store, edge, additionalContext = {}) {
    const context = {
      edge,
      storeState: store,
      storeFingerprint: store.getStateFingerprint?.(),
      operationContext: {
        operation,
        parameters: edge,
        timestamp: Date.now(),
        storeVersion: store.getStateMetadata?.()?.version
      },
      validationPath: ['ImmutableDataStore.' + operation],
      ...additionalContext
    };
    
    return new ConstraintViolationError(operation, violations, context);
  }
  
  /**
   * Create a ConstraintViolationError for batch operations
   */
  static fromBatchFailure(violations, batchOperations, store, additionalContext = {}) {
    const context = {
      storeState: store,
      storeFingerprint: store.getStateFingerprint?.(),
      operationContext: {
        operation: 'batch',
        parameters: batchOperations,
        timestamp: Date.now(),
        storeVersion: store.getStateMetadata?.()?.version
      },
      batchOperations,
      validationPath: ['ImmutableDataStore.batch'],
      ...additionalContext
    };
    
    return new ConstraintViolationError('batch', violations, context);
  }
  
  /**
   * Create error for parameter validation failures
   */
  static fromParameterValidation(operation, message, parameter) {
    const error = new Error(message);
    error.name = 'ParameterValidationError';
    error.operation = operation;
    error.parameter = parameter;
    return error;
  }
}

// Export for use in other modules
export default ConstraintViolationError;