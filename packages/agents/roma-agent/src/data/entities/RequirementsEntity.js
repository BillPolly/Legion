/**
 * Requirements Entity
 * 
 * Represents project requirements that need to be analyzed and implemented.
 * Used by requirement analysis prompts and project planning strategies.
 */

import { BaseEntity } from './BaseEntity.js';

export class RequirementsEntity extends BaseEntity {
  constructor(data = {}) {
    super(data);
  }

  static getEntityType() {
    return 'requirement';
  }

  static getSchema() {
    return {
      ':requirement/description': { type: 'string', cardinality: 'one' },
      ':requirement/type': { type: 'string', cardinality: 'one' }, // functional, nonfunctional, constraint
      ':requirement/priority': { type: 'string', cardinality: 'one' }, // critical, high, medium, low
      ':requirement/status': { type: 'string', cardinality: 'one' }, // pending, implemented, tested, accepted
      ':requirement/project': { type: 'ref', cardinality: 'one' },
      ':requirement/acceptanceCriteria': { type: 'string', cardinality: 'many' },
    };
  }

  static getRequiredFields() {
    return [':requirement/description', ':requirement/type', ':requirement/project'];
  }

  /**
   * Get JSON Schema for validation
   */
  static getJSONSchema() {
    return {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          minLength: 10,
          maxLength: 1000
        },
        type: {
          type: 'string',
          enum: ['functional', 'nonfunctional', 'constraint']
        },
        priority: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low']
        },
        status: {
          type: 'string',
          enum: ['pending', 'implemented', 'tested', 'accepted']
        },
        project: {
          type: 'string'
        },
        acceptanceCriteria: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 5
          },
          minItems: 0
        }
      },
      required: ['description', 'type', 'project'],
      additionalProperties: false
    };
  }

  // Getters and setters for main properties
  get description() {
    return this.getField('description');
  }

  set description(value) {
    this.setField('description', value);
  }

  get type() {
    return this.getField('type');
  }

  set type(value) {
    if (!['functional', 'nonfunctional', 'constraint'].includes(value)) {
      throw new Error(`Invalid requirement type: ${value}`);
    }
    this.setField('type', value);
  }

  get priority() {
    return this.getField('priority');
  }

  set priority(value) {
    if (!['critical', 'high', 'medium', 'low'].includes(value)) {
      throw new Error(`Invalid priority: ${value}`);
    }
    this.setField('priority', value);
  }

  get status() {
    return this.getField('status');
  }

  set status(value) {
    if (!['pending', 'implemented', 'tested', 'accepted'].includes(value)) {
      throw new Error(`Invalid status: ${value}`);
    }
    this.setField('status', value);
  }

  get projectId() {
    return this.getField('project');
  }

  set projectId(value) {
    this.setField('project', value);
  }

  get acceptanceCriteria() {
    return this.getField('acceptanceCriteria') || [];
  }

  set acceptanceCriteria(criteria) {
    this.setField('acceptanceCriteria', Array.isArray(criteria) ? criteria : [criteria]);
  }

  // Helper methods
  addAcceptanceCriteria(criteria) {
    const existing = this.acceptanceCriteria;
    this.acceptanceCriteria = [...existing, criteria];
  }

  removeAcceptanceCriteria(criteria) {
    const existing = this.acceptanceCriteria;
    this.acceptanceCriteria = existing.filter(c => c !== criteria);
  }

  isCritical() {
    return this.priority === 'critical';
  }

  isImplemented() {
    return ['implemented', 'tested', 'accepted'].includes(this.status);
  }

  isAccepted() {
    return this.status === 'accepted';
  }

  // Factory methods
  static createFunctional(description, projectId, priority = 'medium') {
    return new RequirementsEntity({
      ':requirement/description': description,
      ':requirement/type': 'functional',
      ':requirement/priority': priority,
      ':requirement/status': 'pending',
      ':requirement/project': projectId,
      ':requirement/acceptanceCriteria': []
    });
  }

  static createConstraint(description, projectId, priority = 'high') {
    return new RequirementsEntity({
      ':requirement/description': description,
      ':requirement/type': 'constraint',
      ':requirement/priority': priority,
      ':requirement/status': 'pending',
      ':requirement/project': projectId,
      ':requirement/acceptanceCriteria': []
    });
  }

  static createNonFunctional(description, projectId, priority = 'medium') {
    return new RequirementsEntity({
      ':requirement/description': description,
      ':requirement/type': 'nonfunctional',
      ':requirement/priority': priority,
      ':requirement/status': 'pending',
      ':requirement/project': projectId,
      ':requirement/acceptanceCriteria': []
    });
  }

  // Validation specific to requirements
  validate() {
    const baseValid = super.validate();
    
    if (this.description && this.description.trim().length < 10) {
      this._errors.push('Description must be at least 10 characters long');
    }
    
    if (this.acceptanceCriteria && this.acceptanceCriteria.length === 0) {
      this._errors.push('At least one acceptance criteria should be defined');
    }
    
    return this._errors.length === 0 && baseValid;
  }
}