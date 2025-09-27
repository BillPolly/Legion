import { GoalStack } from '../../GoalStack.js';

describe('GoalStack', () => {
  let goalStack;
  
  beforeEach(() => {
    goalStack = new GoalStack();
  });
  
  describe('goal creation', () => {
    test('creates goal with required fields', () => {
      const goal = goalStack.createGoal({
        gloss: 'Test goal',
        pred: { name: 'composite', args: {} }
      });
      
      expect(goal.id).toBeDefined();
      expect(goal.gloss).toBe('Test goal');
      expect(goal.pred.name).toBe('composite');
      expect(goal.status).toBe('pending');
      expect(goal.evidence).toEqual({});
      expect(goal.doneWhen).toEqual([]);
      expect(goal.createdAt).toBeDefined();
    });
    
    test('generates unique IDs', () => {
      const goal1 = goalStack.createGoal({ gloss: 'Goal 1', pred: { name: 'execute', args: {} } });
      const goal2 = goalStack.createGoal({ gloss: 'Goal 2', pred: { name: 'execute', args: {} } });
      
      expect(goal1.id).not.toBe(goal2.id);
    });
    
    test('sets parent relationship', () => {
      const parent = goalStack.createGoal({ gloss: 'Parent', pred: { name: 'composite', args: {} } });
      const child = goalStack.createGoal({ gloss: 'Child', pred: { name: 'execute', args: {} }, parent: parent.id });
      
      expect(child.parent).toBe(parent.id);
    });
  });
  
  describe('push/pop/peek operations', () => {
    test('push adds goal to stack', () => {
      const goal = goalStack.createGoal({ gloss: 'Test', pred: { name: 'execute', args: {} } });
      goalStack.push(goal);
      
      expect(goalStack.stack.length).toBe(1);
      expect(goalStack.peek()).toBe(goal);
    });
    
    test('pop removes from top', () => {
      const goal1 = goalStack.createGoal({ gloss: 'First', pred: { name: 'execute', args: {} } });
      const goal2 = goalStack.createGoal({ gloss: 'Second', pred: { name: 'execute', args: {} } });
      
      goalStack.push(goal1);
      goalStack.push(goal2);
      
      const popped = goalStack.pop();
      
      expect(popped).toBe(goal2);
      expect(goalStack.stack.length).toBe(1);
      expect(goalStack.peek()).toBe(goal1);
    });
    
    test('peek returns top without removing', () => {
      const goal = goalStack.createGoal({ gloss: 'Test', pred: { name: 'execute', args: {} } });
      goalStack.push(goal);
      
      const peeked1 = goalStack.peek();
      const peeked2 = goalStack.peek();
      
      expect(peeked1).toBe(goal);
      expect(peeked2).toBe(goal);
      expect(goalStack.stack.length).toBe(1);
    });
    
    test('LIFO ordering', () => {
      const goals = [
        goalStack.createGoal({ gloss: 'First', pred: { name: 'execute', args: {} } }),
        goalStack.createGoal({ gloss: 'Second', pred: { name: 'execute', args: {} } }),
        goalStack.createGoal({ gloss: 'Third', pred: { name: 'execute', args: {} } })
      ];
      
      goals.forEach(g => goalStack.push(g));
      
      expect(goalStack.pop()).toBe(goals[2]);
      expect(goalStack.pop()).toBe(goals[1]);
      expect(goalStack.pop()).toBe(goals[0]);
    });
  });
  
  describe('find goal by ID', () => {
    test('finds existing goal', () => {
      const goal = goalStack.createGoal({ gloss: 'Test', pred: { name: 'execute', args: {} } });
      goalStack.push(goal);
      
      const found = goalStack.find(goal.id);
      
      expect(found).toBe(goal);
    });
    
    test('returns null for nonexistent ID', () => {
      const found = goalStack.find('nonexistent-id');
      
      expect(found).toBeNull();
    });
  });
  
  describe('update goal status', () => {
    test('updates status', () => {
      const goal = goalStack.createGoal({ gloss: 'Test', pred: { name: 'execute', args: {} } });
      goalStack.push(goal);
      
      goalStack.updateStatus(goal.id, 'active');
      
      expect(goal.status).toBe('active');
    });
    
    test('updates timestamp', async () => {
      const goal = goalStack.createGoal({ gloss: 'Test', pred: { name: 'execute', args: {} } });
      const originalTime = goal.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 5));
      
      goalStack.updateStatus(goal.id, 'achieved');
      
      expect(goal.updatedAt).toBeGreaterThan(originalTime);
    });
  });
  
  describe('add evidence', () => {
    test('adds evidence to goal', () => {
      const goal = goalStack.createGoal({ gloss: 'Test', pred: { name: 'execute', args: {} } });
      goalStack.push(goal);
      
      goalStack.addEvidence(goal.id, 'result', 'test value');
      
      expect(goal.evidence.result).toBe('test value');
    });
    
    test('multiple evidence entries', () => {
      const goal = goalStack.createGoal({ gloss: 'Test', pred: { name: 'execute', args: {} } });
      goalStack.push(goal);
      
      goalStack.addEvidence(goal.id, 'key1', 'value1');
      goalStack.addEvidence(goal.id, 'key2', 'value2');
      
      expect(goal.evidence.key1).toBe('value1');
      expect(goal.evidence.key2).toBe('value2');
    });
  });
  
  describe('empty stack handling', () => {
    test('peek returns null on empty stack', () => {
      expect(goalStack.peek()).toBeNull();
    });
    
    test('pop returns null on empty stack', () => {
      expect(goalStack.pop()).toBeNull();
    });
  });
  
  describe('parent-child relationships', () => {
    test('tracks decomposition', () => {
      const parent = goalStack.createGoal({ gloss: 'Parent', pred: { name: 'composite', args: {} } });
      const child1 = goalStack.createGoal({ gloss: 'Child 1', pred: { name: 'execute', args: {} }, parent: parent.id });
      const child2 = goalStack.createGoal({ gloss: 'Child 2', pred: { name: 'execute', args: {} }, parent: parent.id });
      
      parent.decomp = {
        kind: 'AND',
        children: [child1.id, child2.id]
      };
      
      expect(parent.decomp.kind).toBe('AND');
      expect(parent.decomp.children).toHaveLength(2);
      expect(child1.parent).toBe(parent.id);
      expect(child2.parent).toBe(parent.id);
    });
  });
});