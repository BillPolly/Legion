/**
 * ScopeValidator - Validates scope plans
 */

export class ScopeValidator {
  /**
   * @param {string[]} entityIds - Array of entity IDs
   * @param {string[]} eventIds - Array of event IDs
   */
  constructor(entityIds, eventIds) {
    this.entityIds = new Set(entityIds);
    this.eventIds = new Set(eventIds);
    this.allReferents = new Set([...entityIds, ...eventIds]);
  }

  /**
   * Validate a scope plan
   * @param {ScopePlan} scopePlan - Scope plan to validate
   * @returns {{isValid: boolean, errors: Array<{path: string, message: string}>}}
   */
  validate(scopePlan) {
    const errors = [];
    const boxSet = new Set(scopePlan.boxes);

    // Validate operators
    this.validateOperators(scopePlan.ops, boxSet, errors);

    // Validate assignments
    this.validateAssignments(scopePlan.assign, boxSet, errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate operators
   */
  validateOperators(ops, boxSet, errors) {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const path = `ops[${i}]`;

      switch (op.kind) {
        case 'Some':
        case 'Every':
          this.validateQuantifierOp(op, path, boxSet, errors);
          break;
        case 'Not':
          this.validateNotOp(op, path, boxSet, errors);
          break;
        case 'If':
          this.validateIfOp(op, path, boxSet, errors);
          break;
        case 'Or':
          this.validateOrOp(op, path, boxSet, errors);
          break;
      }
    }
  }

  /**
   * Validate Some/Every operator
   */
  validateQuantifierOp(op, path, boxSet, errors) {
    // Check variable is a known entity or event
    if (!this.allReferents.has(op.var)) {
      errors.push({
        path: `${path}.var`,
        message: `variable ${op.var} is not a known entity or event ID`
      });
    }

    // Check box exists
    const box = op.kind === 'Some' ? op.in : op.over;
    if (!boxSet.has(box)) {
      errors.push({
        path: path,
        message: `box ${box} does not exist in scope plan`
      });
    }
  }

  /**
   * Validate Not operator
   */
  validateNotOp(op, path, boxSet, errors) {
    if (!boxSet.has(op.box)) {
      errors.push({
        path: path,
        message: `box ${op.box} does not exist in scope plan`
      });
    }
  }

  /**
   * Validate If operator
   */
  validateIfOp(op, path, boxSet, errors) {
    if (!boxSet.has(op.cond)) {
      errors.push({
        path: path,
        message: `box ${op.cond} does not exist in scope plan`
      });
    }
    if (!boxSet.has(op.then)) {
      errors.push({
        path: path,
        message: `box ${op.then} does not exist in scope plan`
      });
    }
  }

  /**
   * Validate Or operator
   */
  validateOrOp(op, path, boxSet, errors) {
    if (!boxSet.has(op.left)) {
      errors.push({
        path: path,
        message: `box ${op.left} does not exist in scope plan`
      });
    }
    if (!boxSet.has(op.right)) {
      errors.push({
        path: path,
        message: `box ${op.right} does not exist in scope plan`
      });
    }
  }

  /**
   * Validate assignments
   */
  validateAssignments(assign, boxSet, errors) {
    // Check all events are assigned
    for (const eventId of this.eventIds) {
      if (!assign.events[eventId]) {
        errors.push({
          path: 'assign.events',
          message: `event ${eventId} not assigned to any box`
        });
      } else if (!boxSet.has(assign.events[eventId])) {
        errors.push({
          path: `assign.events.${eventId}`,
          message: `box ${assign.events[eventId]} does not exist in scope plan`
        });
      }
    }

    // Check all entities are assigned
    for (const entityId of this.entityIds) {
      if (!assign.entities[entityId]) {
        errors.push({
          path: 'assign.entities',
          message: `entity ${entityId} not assigned to any box`
        });
      } else if (!boxSet.has(assign.entities[entityId])) {
        errors.push({
          path: `assign.entities.${entityId}`,
          message: `box ${assign.entities[entityId]} does not exist in scope plan`
        });
      }
    }

    // Check no invalid entities in assignment
    for (const entityId of Object.keys(assign.entities)) {
      if (!this.entityIds.has(entityId)) {
        errors.push({
          path: 'assign.entities',
          message: `${entityId} is not a known entity ID`
        });
      }
    }

    // Check no invalid events in assignment
    for (const eventId of Object.keys(assign.events)) {
      if (!this.eventIds.has(eventId)) {
        errors.push({
          path: 'assign.events',
          message: `${eventId} is not a known event ID`
        });
      }
    }
  }
}
