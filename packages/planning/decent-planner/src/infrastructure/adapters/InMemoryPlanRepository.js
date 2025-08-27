/**
 * InMemoryPlanRepository - Infrastructure adapter for in-memory plan storage
 * Implements the PlanRepository port
 */

import { PlanRepository } from '../../application/ports/PlanRepository.js';
import { Plan } from '../../domain/entities/Plan.js';

export class InMemoryPlanRepository extends PlanRepository {
  constructor() {
    super();
    this.plans = new Map();
  }

  async save(plan) {
    if (!(plan instanceof Plan)) {
      throw new Error('Must provide a Plan instance');
    }
    
    const planCopy = Plan.fromJSON(plan.toJSON());
    this.plans.set(plan.id.toString(), planCopy);
    return planCopy;
  }

  async findById(planId) {
    const plan = this.plans.get(planId.toString());
    return plan ? Plan.fromJSON(plan.toJSON()) : null;
  }

  async findByStatus(status) {
    const results = [];
    
    for (const plan of this.plans.values()) {
      if (plan.status.equals(status)) {
        results.push(Plan.fromJSON(plan.toJSON()));
      }
    }
    
    return results;
  }

  async update(plan) {
    if (!(plan instanceof Plan)) {
      throw new Error('Must provide a Plan instance');
    }
    
    if (!this.plans.has(plan.id.toString())) {
      throw new Error(`Plan with id ${plan.id} not found`);
    }
    
    const planCopy = Plan.fromJSON(plan.toJSON());
    this.plans.set(plan.id.toString(), planCopy);
    return planCopy;
  }

  async delete(planId) {
    return this.plans.delete(planId.toString());
  }

  async findAll(options = {}) {
    const { limit = 100, offset = 0 } = options;
    const allPlans = Array.from(this.plans.values());
    
    return allPlans
      .slice(offset, offset + limit)
      .map(plan => Plan.fromJSON(plan.toJSON()));
  }

  // Helper method for testing
  clear() {
    this.plans.clear();
  }

  // Helper method for testing
  size() {
    return this.plans.size;
  }
}