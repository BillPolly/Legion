/**
 * Stage5_DRSBuilder - Deterministic DRS Builder
 *
 * This stage:
 * 1. Collects referents from entities and events
 * 2. Adds type predicates for entities
 * 3. Adds attribute predicates from unaryFacts
 * 4. Adds event predicates
 * 5. Adds role relations from event roles
 * 6. Adds binary relations from binaryFacts
 * 7. Translates scope operators to DRS conditions
 *
 * NO LLM - Pure deterministic translation
 */

import { ClausalDRS } from '../types/ClausalDRS.js';

export class Stage5_DRSBuilder {
  /**
   * Build DRS from discourse memory and scope plan
   * @param {DiscourseMemory} memory - Input discourse memory
   * @param {ScopePlan} scopePlan - Input scope plan
   * @returns {ClausalDRS} - Clausal DRS with referents and conditions
   */
  process(memory, scopePlan) {
    const referents = [];
    const conditions = [];

    // 1. Collect all referents
    for (const entity of memory.entities) {
      referents.push(entity.id);
    }
    for (const event of memory.events) {
      referents.push(event.id);
    }

    // 2. Add type predicates for entities
    for (const entity of memory.entities) {
      conditions.push({
        pred: entity.type,
        args: [entity.id]
      });
    }

    // 3. Add attribute predicates from unaryFacts
    for (const fact of memory.unaryFacts) {
      conditions.push({
        pred: fact.pred,
        args: fact.args
      });
    }

    // 4. Add event predicates
    for (const event of memory.events) {
      conditions.push({
        pred: event.lemma,
        args: [event.id]
      });
    }

    // 5. Add role relations from event roles
    for (const event of memory.events) {
      for (const [role, target] of Object.entries(event.roles)) {
        conditions.push({
          rel: role,
          args: [event.id, target]
        });
      }
    }

    // 6. Add binary relations from binaryFacts
    for (const fact of memory.binaryFacts) {
      conditions.push({
        rel: fact.pred,
        args: fact.args
      });
    }

    // 7. Translate scope operators to DRS conditions
    for (const op of scopePlan.ops) {
      if (op.kind === 'Some') {
        conditions.push({
          rel: 'Some',
          args: [op.var]
        });
      } else if (op.kind === 'Every') {
        conditions.push({
          rel: 'Every',
          args: [op.var]
        });
      } else if (op.kind === 'Not') {
        conditions.push({
          rel: 'Not',
          args: [op.box]
        });
      } else if (op.kind === 'If') {
        conditions.push({
          rel: 'Imp',
          args: [op.cond, op.then]
        });
      } else if (op.kind === 'Or') {
        conditions.push({
          rel: 'Or',
          args: [op.left, op.right]
        });
      }
    }

    return new ClausalDRS(referents, conditions);
  }
}
