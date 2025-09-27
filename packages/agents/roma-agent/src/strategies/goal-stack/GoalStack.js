import { v4 as uuidv4 } from 'uuid';

export class GoalStack {
  constructor() {
    this.goals = new Map();
    this.stack = [];
  }
  
  createGoal({ gloss, pred, parent = null, doneWhen = [], evidence = {}, provenance = null, context = null }) {
    const goal = {
      id: uuidv4(),
      gloss,
      pred,
      parent,
      decomp: null,
      status: 'pending',
      doneWhen,
      evidence: { ...evidence },
      provenance,
      context,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.goals.set(goal.id, goal);
    
    return goal;
  }
  
  push(goal) {
    this.stack.push(goal.id);
    goal.status = 'pending';
    goal.updatedAt = Date.now();
  }
  
  pop() {
    if (this.stack.length === 0) {
      return null;
    }
    
    const goalId = this.stack.pop();
    return this.goals.get(goalId);
  }
  
  peek() {
    if (this.stack.length === 0) {
      return null;
    }
    
    const goalId = this.stack[this.stack.length - 1];
    return this.goals.get(goalId);
  }
  
  find(goalId) {
    return this.goals.get(goalId) || null;
  }
  
  updateStatus(goalId, status) {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.status = status;
      goal.updatedAt = Date.now();
    }
  }
  
  addEvidence(goalId, key, value) {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.evidence[key] = value;
      goal.updatedAt = Date.now();
    }
  }
  
  size() {
    return this.stack.length;
  }
  
  isEmpty() {
    return this.stack.length === 0;
  }
  
  getAllGoals() {
    return Array.from(this.goals.values());
  }
  
  clear() {
    this.goals.clear();
    this.stack = [];
  }
}