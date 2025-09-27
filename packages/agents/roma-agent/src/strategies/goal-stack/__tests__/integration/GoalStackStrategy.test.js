import { GoalStack } from '../../GoalStack.js';

describe('GoalStackStrategy Integration', () => {
  test('goal stack handles complete workflow', () => {
    const goalStack = new GoalStack();
    
    const mainGoal = goalStack.createGoal({
      gloss: 'Book train to Paris',
      pred: { name: 'composite', args: {} }
    });
    
    goalStack.push(mainGoal);
    
    const child1 = goalStack.createGoal({
      gloss: 'Gather origin',
      pred: { name: 'gather_info', args: { key: 'origin' } },
      parent: mainGoal.id,
      doneWhen: [{ kind: 'hasEvidence', key: 'origin' }]
    });
    
    const child2 = goalStack.createGoal({
      gloss: 'Search trains',
      pred: { name: 'use_tool', args: { tool: 'train-search-api' } },
      parent: mainGoal.id,
      doneWhen: [{ kind: 'hasEvidence', key: 'trainList' }],
      provenance: {
        sopTitle: 'Book a train ticket',
        stepIndex: 1,
        suggestedTool: 'train-search-api'
      }
    });
    
    mainGoal.decomp = {
      kind: 'AND',
      children: [child1.id, child2.id]
    };
    
    goalStack.push(child2);
    goalStack.push(child1);
    
    expect(goalStack.peek()).toBe(child1);
    expect(goalStack.size()).toBe(3);
    
    goalStack.addEvidence(child1.id, 'origin', 'London');
    expect(child1.evidence.origin).toBe('London');
    
    child1.status = 'achieved';
    const popped1 = goalStack.pop();
    expect(popped1).toBe(child1);
    
    expect(goalStack.peek()).toBe(child2);
    
    goalStack.addEvidence(child2.id, 'trainList', ['train1', 'train2']);
    expect(child2.evidence.trainList).toEqual(['train1', 'train2']);
    expect(child2.provenance.suggestedTool).toBe('train-search-api');
  });
  
  test('tracks evidence and provenance through goal lifecycle', () => {
    const goalStack = new GoalStack();
    
    const goal = goalStack.createGoal({
      gloss: 'Call API',
      pred: { name: 'use_tool', args: { tool: 'http-client' } },
      doneWhen: [{ kind: 'hasEvidence', key: 'apiResult' }],
      provenance: {
        sopId: 'sop-123',
        sopTitle: 'Call external API',
        stepIndex: 2,
        suggestedTool: 'http-client'
      }
    });
    
    goalStack.push(goal);
    goalStack.addEvidence(goal.id, 'apiResult', { status: 200, data: 'success' });
    
    expect(goal.evidence.apiResult.status).toBe(200);
    expect(goal.provenance.sopTitle).toBe('Call external API');
    expect(goal.provenance.suggestedTool).toBe('http-client');
    
    const hasEvidence = 'apiResult' in goal.evidence;
    expect(hasEvidence).toBe(true);
  });
  
  test('AND decomposition completion logic', () => {
    const goalStack = new GoalStack();
    
    const parent = goalStack.createGoal({
      gloss: 'Parent goal',
      pred: { name: 'composite', args: {} }
    });
    
    const child1 = goalStack.createGoal({
      gloss: 'Child 1',
      pred: { name: 'execute', args: {} },
      parent: parent.id
    });
    
    const child2 = goalStack.createGoal({
      gloss: 'Child 2',
      pred: { name: 'execute', args: {} },
      parent: parent.id
    });
    
    parent.decomp = {
      kind: 'AND',
      children: [child1.id, child2.id]
    };
    
    child1.status = 'achieved';
    
    const allAchieved = parent.decomp.children
      .map(id => goalStack.find(id))
      .every(c => c.status === 'achieved');
    
    expect(allAchieved).toBe(false);
    
    child2.status = 'achieved';
    
    const nowAllAchieved = parent.decomp.children
      .map(id => goalStack.find(id))
      .every(c => c.status === 'achieved');
    
    expect(nowAllAchieved).toBe(true);
  });
});