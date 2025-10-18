/**
 * ScopePlan - Quantifier scope structure (DSL)
 */
export class ScopePlan {
  /**
   * @param {string[]} boxes - ["S0", "S1", ...]
   * @param {ScopeOp[]} ops - Scope operators
   * @param {object} assign - { events: {e1: "S1"}, entities: {x1: "S1", x2: "S1"} }
   */
  constructor(boxes, ops, assign) {
    this.boxes = boxes;
    this.ops = ops;
    this.assign = assign;
  }
}

/**
 * ScopeOp types:
 * - { kind: "Every", var: "x1", over: "S1" }
 * - { kind: "Some", var: "x2", in: "S1" }
 * - { kind: "Not", box: "S1" }
 * - { kind: "If", cond: "S1", then: "S2" }
 * - { kind: "Or", left: "S1", right: "S2" }
 */
