/**
 * Error Entity
 * 
 * Represents errors and issues encountered during development.
 * Used by error analysis and debugging prompts for failure recovery.
 */

import { BaseEntity } from './BaseEntity.js';

export class ErrorEntity extends BaseEntity {
  constructor(data = {}) {
    super(data);
  }

  static getEntityType() {
    return 'error';
  }

  static getSchema() {
    return {
      ':error/message': { type: 'string', cardinality: 'one' },
      ':error/stack': { type: 'string', cardinality: 'one' },
      ':error/file': { type: 'ref', cardinality: 'one' },
      ':error/line': { type: 'long', cardinality: 'one' },
      ':error/column': { type: 'long', cardinality: 'one' },
      ':error/timestamp': { type: 'instant', cardinality: 'one' },
      ':error/resolved': { type: 'boolean', cardinality: 'one' },
      ':error/resolution': { type: 'string', cardinality: 'one' },
      ':error/project': { type: 'ref', cardinality: 'one' },
      ':error/severity': { type: 'string', cardinality: 'one' }, // fatal, error, warning, info
    };
  }

  static getRequiredFields() {
    return [':error/message', ':error/project'];
  }

  // Getters and setters
  get message() {
    return this.getField('message');
  }

  set message(value) {
    this.setField('message', value);
  }

  get stack() {
    return this.getField('stack');
  }

  set stack(value) {
    this.setField('stack', value);
  }

  get fileId() {
    return this.getField('file');
  }

  set fileId(value) {
    this.setField('file', value);
  }

  get line() {
    return this.getField('line');
  }

  set line(value) {
    this.setField('line', parseInt(value) || 0);
  }

  get column() {
    return this.getField('column');
  }

  set column(value) {
    this.setField('column', parseInt(value) || 0);
  }

  get timestamp() {
    return this.getField('timestamp');
  }

  set timestamp(value) {
    this.setField('timestamp', value instanceof Date ? value : new Date(value));
  }

  get isResolved() {
    return this.getField('resolved') || false;
  }

  set isResolved(value) {
    this.setField('resolved', Boolean(value));
  }

  get resolution() {
    return this.getField('resolution');
  }

  set resolution(value) {
    this.setField('resolution', value);
    if (value) {
      this.isResolved = true;
    }
  }

  get projectId() {
    return this.getField('project');
  }

  set projectId(value) {
    this.setField('project', value);
  }

  get severity() {
    return this.getField('severity') || 'error';
  }

  set severity(value) {
    if (!['fatal', 'error', 'warning', 'info'].includes(value)) {
      throw new Error(`Invalid severity: ${value}`);
    }
    this.setField('severity', value);
  }

  // Helper methods for error types
  isFatal() {
    return this.severity === 'fatal';
  }

  isError() {
    return this.severity === 'error';
  }

  isWarning() {
    return this.severity === 'warning';
  }

  isInfo() {
    return this.severity === 'info';
  }

  // Error type detection from message/stack
  getErrorType() {
    const message = this.message.toLowerCase();
    const stack = (this.stack || '').toLowerCase();
    
    if (message.includes('cannot read properties') || message.includes('cannot read property')) {
      return 'TypeError';
    }
    if (message.includes('is not defined') || message.includes('is not a function')) {
      return 'ReferenceError';
    }
    if (message.includes('unexpected token') || message.includes('syntax error')) {
      return 'SyntaxError';
    }
    if (message.includes('maximum call stack') || message.includes('too much recursion')) {
      return 'RangeError';
    }
    if (message.includes('cannot find module') || message.includes('module not found')) {
      return 'ModuleNotFoundError';
    }
    if (stack.includes('unhandledpromiserejection')) {
      return 'UnhandledPromiseRejectionWarning';
    }
    
    // Try to extract from stack trace
    const typeMatch = stack.match(/^(\w+error)/i);
    if (typeMatch) {
      return typeMatch[1];
    }
    
    return 'Error';
  }

  // Extract function name from stack trace
  getFunctionName() {
    if (!this.stack) return null;
    
    const functionMatch = this.stack.match(/at (\w+) \(/);
    return functionMatch ? functionMatch[1] : null;
  }

  // Extract file name from stack trace
  getFileName() {
    if (!this.stack) return null;
    
    const fileMatch = this.stack.match(/\(([^)]+):(\d+):(\d+)\)/);
    return fileMatch ? fileMatch[1] : null;
  }

  // Mark as resolved with a solution
  resolve(solution) {
    this.resolution = solution;
    this.isResolved = true;
    return this;
  }

  // Factory methods
  static create(message, projectId, severity = 'error') {
    return new ErrorEntity({
      ':error/message': message,
      ':error/project': projectId,
      ':error/severity': severity,
      ':error/timestamp': new Date(),
      ':error/resolved': false
    });
  }

  static fromException(error, projectId, fileId = null) {
    const entity = new ErrorEntity({
      ':error/message': error.message,
      ':error/stack': error.stack,
      ':error/project': projectId,
      ':error/severity': 'error',
      ':error/timestamp': new Date(),
      ':error/resolved': false
    });

    if (fileId) {
      entity.fileId = fileId;
    }

    // Try to extract line/column from stack
    if (error.stack) {
      const match = error.stack.match(/:(\d+):(\d+)\)/);
      if (match) {
        entity.line = parseInt(match[1]);
        entity.column = parseInt(match[2]);
      }
    }

    return entity;
  }

  // Create from prompt analysis
  static fromAnalysis(analysisResult, originalError, projectId) {
    const entity = ErrorEntity.fromException(originalError, projectId);
    
    // Add analysis results
    if (analysisResult.rootCause) {
      entity.message = `${entity.message} (Root cause: ${analysisResult.rootCause})`;
    }
    
    if (analysisResult.suggestedFix) {
      entity.resolution = analysisResult.suggestedFix;
    }
    
    if (analysisResult.location) {
      entity.line = analysisResult.location.line;
      if (analysisResult.location.function) {
        entity.setField('function', analysisResult.location.function);
      }
    }
    
    return entity;
  }

  // Convert to format for error analysis prompts
  toPromptFormat() {
    return {
      errorMessage: this.message,
      stackTrace: this.stack || '',
      codeContext: '', // Would be populated by looking up the file
      location: {
        file: this.getFileName() || '',
        line: this.line,
        function: this.getFunctionName() || ''
      }
    };
  }

  // Validation specific to errors
  validate() {
    const baseValid = super.validate();
    
    if (!this.message || this.message.trim().length === 0) {
      this._errors.push('Error message cannot be empty');
    }
    
    if (!this.timestamp) {
      this._errors.push('Timestamp is required');
    }
    
    return this._errors.length === 0 && baseValid;
  }
}