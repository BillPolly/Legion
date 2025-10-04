/**
 * ComponentHandle - Handle for component definitions
 * Phase 1.3
 *
 * Provides structured access to component data and operations
 */

import { Handle } from '@legion/handle';
import { ComponentSchema } from '../schemas/ComponentSchema.js';
import { ComponentDataModelHandle } from './ComponentDataModelHandle.js';

export class ComponentHandle extends Handle {
  constructor(dataSource, componentId) {
    super(dataSource);
    this.componentId = componentId;
  }

  /**
   * REQUIRED: Get current value
   * Returns the component data for this handle's componentId
   * CRITICAL: Must be synchronous - no await!
   */
  value() {
    this._validateNotDestroyed();

    // Query data source for component with this ID using simple query format
    const data = this.dataSource.query({
      id: this.componentId
    });

    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }

    return null;
  }

  /**
   * REQUIRED: Execute query with this handle as context
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    this._validateNotDestroyed();
    return this.dataSource.query(querySpec);
  }

  /**
   * Convert to DSL format
   */
  toDSL() {
    const data = this.value();
    return data ? data.dsl : null;
  }

  /**
   * Convert to CNL format
   */
  toCNL() {
    const data = this.value();
    return data ? data.cnl : null;
  }

  /**
   * Convert to JSON format
   */
  toJSON() {
    const data = this.value();
    return data ? data.json : null;
  }

  /**
   * Validate component data
   */
  validate() {
    const data = this.value();
    if (!data) {
      return {
        isValid: false,
        errors: ['Component not found']
      };
    }

    return ComponentSchema.validate(data);
  }

  /**
   * Get data model as a Handle
   */
  dataModel() {
    const data = this.value();
    if (!data || !data.dataModel) {
      return null;
    }

    return new ComponentDataModelHandle(data.dataModel);
  }

  /**
   * Get component metadata
   */
  metadata() {
    const data = this.value();
    if (!data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      author: data.author,
      tags: data.tags,
      created: data.created,
      modified: data.modified,
      version: data.version
    };
  }
}
