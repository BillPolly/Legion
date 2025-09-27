import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';
import { GoalStack } from './GoalStack.js';

export const createGoalStackStrategy = createTypedStrategy(
  'goal-stack',
  [],
  {
    interpretMessage: 'interpret-message',
    executeGather: 'execute-gather',
    checkCompletion: 'check-completion'
  },
  {
    maxDepth: 10,
    maxGoalsPerStack: 50
  }
);

export default createGoalStackStrategy;

createGoalStackStrategy.doWork = async function() {
  if (!this.goalStack) {
    this.goalStack = new GoalStack();
  }
  
  const userMessage = this.description;
  
  const interpretation = await this.interpretMessage(userMessage);
  
  if (interpretation.action === 'new_goal') {
    const goal = this.goalStack.createGoal({
      gloss: interpretation.goal.gloss,
      pred: { name: 'composite', args: {} },
      context: interpretation.goal.context
    });
    this.goalStack.push(goal);
  } else if (interpretation.action === 'add_evidence') {
    const currentGoal = this.goalStack.peek();
    if (currentGoal) {
      this.goalStack.addEvidence(currentGoal.id, interpretation.evidence.key, interpretation.evidence.value);
    }
  }
  
  await this.processGoalStack();
  
  const topGoal = this.goalStack.peek();
  if (!topGoal) {
    this.completeWithArtifacts({ goalStack: this.serializeStack() }, { 
      success: true, 
      message: 'All goals achieved' 
    });
  }
};

createGoalStackStrategy.interpretMessage = async function(userMessage) {
  const interpretPrompt = this.getPrompt('interpretMessage');
  const currentGoal = this.goalStack.peek();
  
  const result = await interpretPrompt.execute({
    userMessage,
    currentGoal: currentGoal ? currentGoal.gloss : null,
    evidence: currentGoal ? JSON.stringify(currentGoal.evidence) : '{}'
  });
  
  if (!result.success) {
    throw new Error(`Failed to interpret message: ${result.errors?.join(', ')}`);
  }
  
  return result.data;
};

createGoalStackStrategy.expandGoal = async function(goal) {
  const { default: GoalPlanner } = await import('@legion/goal-planner');
  const goalPlanner = await GoalPlanner.getInstance();
  
  const plan = await goalPlanner.planGoal({
    gloss: goal.gloss,
    evidence: goal.evidence,
    context: goal.context
  });
  
  const childGoalIds = [];
  for (const subgoal of plan.subgoals) {
    const childGoal = this.goalStack.createGoal({
      gloss: subgoal.gloss,
      pred: subgoal.pred,
      doneWhen: subgoal.doneWhen,
      parent: goal.id,
      provenance: subgoal.provenance,
      evidence: {}
    });
    
    childGoalIds.push(childGoal.id);
  }
  
  goal.decomp = {
    kind: plan.decomp,
    children: childGoalIds
  };
  
  for (let i = childGoalIds.length - 1; i >= 0; i--) {
    const childGoal = this.goalStack.find(childGoalIds[i]);
    this.goalStack.push(childGoal);
  }
  
  goal.status = 'blocked';
};

createGoalStackStrategy.processGoalStack = async function() {
  const currentGoal = this.goalStack.peek();
  
  if (!currentGoal) return;
  
  if (currentGoal.status === 'pending') {
    currentGoal.status = 'active';
  }
  
  if (await this.checkGoalComplete(currentGoal)) {
    currentGoal.status = 'achieved';
    this.goalStack.pop();
    await this.propagateCompletion(currentGoal);
    return;
  }
  
  if (currentGoal.pred.name === 'composite') {
    await this.expandGoal(currentGoal);
    return;
  }
  
  await this.executeGoal(currentGoal);
};

createGoalStackStrategy.executeGoal = async function(goal) {
  const pred = goal.pred;
  
  switch (pred.name) {
    case 'use_tool':
      await this.executeTool(goal, pred.args.tool);
      break;
    case 'gather_info':
      await this.gatherInfo(goal, pred.args);
      break;
    case 'execute':
      goal.status = 'achieved';
      break;
    default:
      goal.status = 'abandoned';
      break;
  }
};

createGoalStackStrategy.executeTool = async function(goal, toolName) {
  const tool = await this.config.toolRegistry.getTool(toolName);
  
  if (!tool) {
    goal.status = 'blocked';
    this.addConversationEntry('assistant', `Tool ${toolName} not found`);
    return;
  }
  
  const args = {};
  const result = await tool.execute(args);
  
  const evidenceKey = toolName.replace(/-/g, '_') + '_result';
  goal.evidence[evidenceKey] = result;
  this.storeArtifact(evidenceKey, result, `Result from ${toolName}`);
  
  if (await this.checkGoalComplete(goal)) {
    goal.status = 'achieved';
  }
};

createGoalStackStrategy.gatherInfo = async function(goal, args) {
  const gatherPrompt = this.getPrompt('executeGather');
  const result = await gatherPrompt.execute({
    paramName: args.key,
    paramPrompt: args.prompt || `Please provide ${args.key}`,
    context: JSON.stringify(goal.evidence)
  });
  
  if (result.success) {
    this.addConversationEntry('assistant', result.data.question);
  }
};

createGoalStackStrategy.checkGoalComplete = async function(goal) {
  if (!goal.doneWhen || goal.doneWhen.length === 0) {
    return false;
  }
  
  for (const condition of goal.doneWhen) {
    if (condition.kind === 'hasEvidence') {
      if (!(condition.key in goal.evidence)) {
        return false;
      }
    } else if (condition.kind === 'predicateTrue') {
      const checkPrompt = this.getPrompt('checkCompletion');
      const result = await checkPrompt.execute({
        predicate: JSON.stringify(condition.pred),
        evidence: JSON.stringify(goal.evidence),
        context: JSON.stringify(goal.context || {})
      });
      
      if (!result.success || !result.data.satisfied) {
        return false;
      }
    }
  }
  
  return true;
};

createGoalStackStrategy.propagateCompletion = async function(goal) {
  if (!goal.parent) return;
  
  const parentGoal = this.goalStack.find(goal.parent);
  if (!parentGoal || !parentGoal.decomp) return;
  
  const allChildren = parentGoal.decomp.children.map(id => this.goalStack.find(id));
  
  if (parentGoal.decomp.kind === 'AND') {
    if (allChildren.every(c => c.status === 'achieved')) {
      parentGoal.status = 'achieved';
      await this.propagateCompletion(parentGoal);
    }
  } else if (parentGoal.decomp.kind === 'OR') {
    if (allChildren.some(c => c.status === 'achieved')) {
      parentGoal.status = 'achieved';
      await this.propagateCompletion(parentGoal);
    }
  }
};

createGoalStackStrategy.serializeStack = function() {
  return {
    goals: this.goalStack.getAllGoals(),
    stack: this.goalStack.stack,
    timestamp: Date.now()
  }
};