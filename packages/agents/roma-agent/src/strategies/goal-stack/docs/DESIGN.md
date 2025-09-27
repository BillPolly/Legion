# Goal-Stack Strategy Design Document (MVP)

## 1. Overview

The **Goal-Stack Strategy** is a ROMA agent strategy that implements explicit goal management through a goal stack with hierarchical decomposition. Unlike reactive strategies, it maintains an explicit representation of active goals, expands them using the GoalPlanner (with SOP-based and vanilla planning), executes primitive actions, and tracks completion through evidence accumulation.

This strategy integrates with:
- GoalPlanner for goal → subgoal decomposition
- SOPRegistry for procedural knowledge retrieval
- ToolRegistry for tool execution
- Task framework for context and artifact management

**Key Capabilities:**
- Maintain LIFO goal stack with depth-first execution
- Interpret user messages into goals using LLM
- Expand composite goals via GoalPlanner (SOP-based or vanilla)
- Execute primitive goals (gather_info, use_tool, confirm, present_info)
- Track completion via doneWhen conditions
- Accumulate evidence in task artifacts
- Hierarchical goal relationships with parent tracking

## 2. Core Data Models

### 2.1 Goal Structure

```javascript
{
  id: string,                       // Unique identifier
  gloss: string,                    // "Book train to Paris"
  pred: Predicate,                  // { name: 'composite' } or { name: 'use_tool', args: {...} }
  parent: string | null,            // Parent goal ID
  decomp: {                         // For composite goals
    kind: 'AND' | 'OR',
    children: string[]              // Child goal IDs
  } | null,
  status: 'pending' | 'active' | 'achieved' | 'abandoned' | 'blocked',
  doneWhen: Condition[],            // Completion conditions
  evidence: Record<string, any>,    // Accumulated data
  provenance: {                     // Where this goal came from
    sopId?: string,
    sopTitle?: string,
    stepIndex?: number,
    suggestedTool?: string
  } | null,
  createdAt: number,
  updatedAt: number
}
```

### 2.2 Predicate Types

```javascript
// Composite goal (needs expansion)
{ name: 'composite', args: {} }

// Tool invocation
{ name: 'use_tool', args: { tool: 'train-search-api' } }

// Information gathering
{ name: 'gather_info', args: { key: 'travelDate', prompt: 'When are you traveling?' } }

// Confirmation
{ name: 'confirm', args: { question: 'Is this correct?' } }

// Information presentation
{ name: 'present_info', args: { data: {...} } }

// Generic execution
{ name: 'execute', args: {} }
```

### 2.3 Condition Types

```javascript
// Evidence-based
{ kind: 'hasEvidence', key: 'trainList' }

// Predicate-based
{ kind: 'predicateTrue', pred: { name: 'verify_payment', args: {} } }
```

**Note:** `js` condition type is NOT implemented for MVP (security concern).

### 2.4 Interpreter Result

```javascript
{
  action: 'new_goal' | 'add_evidence' | 'abandon_goal' | 'continue',
  goal?: {                          // If action='new_goal'
    gloss: string,
    context?: Record<string, any>
  },
  evidence?: {                      // If action='add_evidence'
    key: string,
    value: any
  },
  reasoning: string
}
```

## 3. Goal Stack Operations

### 3.1 Stack Structure

In-memory array stored in task state:

```javascript
class GoalStack {
  constructor() {
    this.goals = new Map();         // goalId → Goal
    this.stack = [];                // Array of goalIds (LIFO)
  }
  
  push(goal)                        // Add to top
  pop()                             // Remove from top
  peek()                            // View top without removing
  find(goalId)                      // Retrieve by ID
  updateStatus(goalId, status)      // Change goal status
  addEvidence(goalId, key, value)   // Add evidence to goal
}
```

### 3.2 Stack Operations

**Push:**
```javascript
push(goal) {
  this.goals.set(goal.id, goal);
  this.stack.push(goal.id);
  goal.status = 'pending';
}
```

**Pop:**
```javascript
pop() {
  const goalId = this.stack.pop();
  const goal = this.goals.get(goalId);
  return goal;
}
```

**Peek:**
```javascript
peek() {
  if (this.stack.length === 0) return null;
  const goalId = this.stack[this.stack.length - 1];
  return this.goals.get(goalId);
}
```

## 4. Strategy Lifecycle

### 4.1 Initialization

```javascript
export const createGoalStackStrategy = createTypedStrategy(
  'goal-stack',
  [],  // No direct tools (uses ToolRegistry dynamically)
  {
    interpretMessage: 'interpret-message',
    executeGather: 'execute-gather',
    checkCompletion: 'check-completion'
  },
  {
    maxDepth: 10,
    evidenceStoreKey: 'goalEvidence'
  }
);
```

### 4.2 Main Execution Loop (doWork)

```javascript
createGoalStackStrategy.doWork = async function() {
  // 1. Initialize goal stack (first time)
  if (!this.goalStack) {
    this.goalStack = new GoalStack();
  }
  
  // 2. Get user message from task description or conversation
  const userMessage = this.getUserMessage();
  
  // 3. Interpret message
  const interpretation = await this.interpretMessage(userMessage);
  
  // 4. Handle interpretation
  if (interpretation.action === 'new_goal') {
    const goal = this.createGoal(interpretation.goal);
    this.goalStack.push(goal);
  } else if (interpretation.action === 'add_evidence') {
    const currentGoal = this.goalStack.peek();
    this.goalStack.addEvidence(currentGoal.id, interpretation.evidence.key, interpretation.evidence.value);
  }
  
  // 5. Process goal stack
  await this.processGoalStack();
  
  // 6. Return result
  const topGoal = this.goalStack.peek();
  if (!topGoal) {
    this.completeWithArtifacts({ goalStack: this.serializeStack() }, { success: true, message: 'All goals achieved' });
  } else {
    // More work to do - return current state
    this.addConversationEntry('assistant', this.generateResponse(topGoal));
  }
};
```

### 4.3 Goal Processing

```javascript
async processGoalStack() {
  while (this.goalStack.peek()) {
    const currentGoal = this.goalStack.peek();
    
    // Skip if not active
    if (currentGoal.status !== 'active' && currentGoal.status !== 'pending') {
      this.goalStack.pop();
      continue;
    }
    
    // Activate if pending
    if (currentGoal.status === 'pending') {
      currentGoal.status = 'active';
    }
    
    // Check if already complete
    if (await this.checkGoalComplete(currentGoal)) {
      currentGoal.status = 'achieved';
      this.goalStack.pop();
      this.propagateCompletion(currentGoal);
      continue;
    }
    
    // Expand if composite
    if (currentGoal.pred.name === 'composite') {
      await this.expandGoal(currentGoal);
      continue;
    }
    
    // Execute if primitive
    await this.executeGoal(currentGoal);
    break; // Wait for user input or tool result
  }
}
```

## 5. Core Operations

### 5.1 Message Interpretation

Uses TemplatedPrompt to convert user message to intent:

**Prompt Template:** (`prompts/strategies/goal-stack/interpret-message.md`)

```markdown
---
name: interpret-message
description: Interpret user message into goal stack action
variables:
  - userMessage
  - currentGoal
  - evidence
responseSchema:
  type: object
  properties:
    action:
      type: string
      enum: [new_goal, add_evidence, abandon_goal, continue]
    goal:
      type: object
      properties:
        gloss: { type: string }
        context: { type: object }
    evidence:
      type: object
      properties:
        key: { type: string }
        value: { type: any }
    reasoning: { type: string }
  required: [action, reasoning]
---

Interpret this user message in the context of the current goal.

User message: {{userMessage}}

Current goal: {{currentGoal}}
Evidence collected: {{evidence}}

Determine if the user is:
1. Starting a new goal (action: new_goal)
2. Providing information for current goal (action: add_evidence)
3. Abandoning the current goal (action: abandon_goal)
4. Just conversing (action: continue)

{{outputPrompt}}
```

### 5.2 Goal Expansion

Call GoalPlanner to decompose composite goals:

```javascript
async expandGoal(goal) {
  const goalPlannerInput = {
    gloss: goal.gloss,
    evidence: goal.evidence,
    context: goal.context
  };
  
  const plan = await this.goalPlanner.planGoal(goalPlannerInput);
  
  // Create subgoals from plan
  const childGoalIds = [];
  for (const subgoal of plan.subgoals) {
    const childGoal = this.createGoal({
      gloss: subgoal.gloss,
      pred: subgoal.pred,
      doneWhen: subgoal.doneWhen,
      parent: goal.id,
      provenance: subgoal.provenance
    });
    
    this.goalStack.goals.set(childGoal.id, childGoal);
    childGoalIds.push(childGoal.id);
  }
  
  // Update parent goal
  goal.decomp = {
    kind: plan.decomp,
    children: childGoalIds
  };
  
  // Push children in reverse order (so first child is on top)
  for (let i = childGoalIds.length - 1; i >= 0; i--) {
    this.goalStack.push(this.goalStack.goals.get(childGoalIds[i]));
  }
  
  // Mark parent as expanded
  goal.status = 'blocked'; // Blocked until children complete
}
```

### 5.3 Primitive Execution

Execute based on predicate type:

```javascript
async executeGoal(goal) {
  const pred = goal.pred;
  
  switch (pred.name) {
    case 'use_tool':
      await this.executeTool(goal, pred.args.tool);
      break;
      
    case 'gather_info':
      await this.gatherInfo(goal, pred.args);
      break;
      
    case 'confirm':
      await this.confirmWithUser(goal, pred.args);
      break;
      
    case 'present_info':
      await this.presentInfo(goal, pred.args);
      break;
      
    case 'execute':
      // Generic execute - mark as complete
      goal.status = 'achieved';
      break;
      
    default:
      goal.status = 'abandoned';
      break;
  }
}
```

**Execute Tool:**
```javascript
async executeTool(goal, toolName) {
  const tool = await this.config.toolRegistry.getTool(toolName);
  
  if (!tool) {
    goal.status = 'blocked';
    this.addConversationEntry('assistant', `Tool ${toolName} not found`);
    return;
  }
  
  // Extract args from goal evidence
  const toolArgs = this.extractToolArgs(goal, tool);
  
  // Execute tool
  const result = await tool.execute(toolArgs);
  
  // Store result as evidence
  const evidenceKey = this.getEvidenceKeyForGoal(goal);
  goal.evidence[evidenceKey] = result;
  
  // Store as task artifact
  this.storeArtifact(evidenceKey, result, `Result from ${toolName}`);
  
  // Check completion
  if (await this.checkGoalComplete(goal)) {
    goal.status = 'achieved';
  }
}
```

**Gather Info:**
```javascript
async gatherInfo(goal, args) {
  // Use TemplatedPrompt to generate question
  const gatherPrompt = this.getPrompt('executeGather');
  const result = await gatherPrompt.execute({
    paramName: args.key,
    paramPrompt: args.prompt || `Please provide ${args.key}`,
    context: JSON.stringify(goal.evidence)
  });
  
  if (result.success) {
    // Present question to user
    this.addConversationEntry('assistant', result.data.question);
    
    // Goal stays active, waiting for user response
    // Next user message will be interpreted as evidence
  }
}
```

### 5.4 Completion Checking

Uses TemplatedPrompt to evaluate doneWhen conditions:

```javascript
async checkGoalComplete(goal) {
  for (const condition of goal.doneWhen) {
    if (condition.kind === 'hasEvidence') {
      if (!(condition.key in goal.evidence)) {
        return false;
      }
    } else if (condition.kind === 'predicateTrue') {
      // Use LLM to check if condition is satisfied
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
}
```

## 6. Integration with GoalPlanner

### 6.1 Initialization

```javascript
async initializeForTask(task) {
  await StandardTaskStrategy.initializeForTask.call(this, task);
  
  // Get GoalPlanner singleton
  const { default: GoalPlanner } = await import('@legion/goal-planner');
  this.goalPlanner = await GoalPlanner.getInstance();
  
  // Initialize goal stack
  this.goalStack = new GoalStack();
}
```

### 6.2 Expansion Flow

```
User: "Book me a train to Paris"
  ↓
Interpreter: Creates goal { gloss: "Book train to Paris", pred: { name: 'composite' } }
  ↓
Push to stack
  ↓
Process stack → goal is composite
  ↓
Call GoalPlanner.planGoal(goal)
  ↓
GoalPlanner:
  - Searches SOPRegistry
  - Finds "Book a train ticket" SOP
  - Judges applicability (high confidence)
  - Adapts SOP to subgoals
  ↓
Returns: {
  subgoals: [
    { gloss: "Gather travelDate", pred: { name: 'gather_info', args: { key: 'travelDate' } }, ... },
    { gloss: "Search trains", pred: { name: 'use_tool', args: { tool: 'train-search-api' } }, ... },
    ...
  ],
  decomp: 'AND',
  source: 'sop'
}
  ↓
Create child goals and push to stack (reverse order)
  ↓
Process top goal: "Gather travelDate"
  ↓
Execute gather_info → ask user "When are you traveling?"
  ↓
Wait for user response
```

### 6.3 Evidence Flow

Evidence flows from tool execution and user input into goal.evidence and task artifacts:

```javascript
// Tool execution stores evidence
goal.evidence['trainList'] = toolResult;
this.storeArtifact('trainList', toolResult, 'Available trains');

// User input interpreted as evidence
interpretation.action === 'add_evidence'
goal.evidence['travelDate'] = '2025-10-01';
this.storeArtifact('travelDate', '2025-10-01', 'Travel date');

// Evidence used to check doneWhen
doneWhen: [{ kind: 'hasEvidence', key: 'trainList' }]
checkGoalComplete() → true when 'trainList' in goal.evidence
```

## 7. Strategy Implementation

### 7.1 File Structure

```
packages/agents/roma-agent/src/strategies/goal-stack/
├── docs/
│   └── DESIGN.md                    (this document)
├── prompts/
│   ├── interpret-message.md
│   ├── execute-gather.md
│   └── check-completion.md
├── GoalStackStrategy.js             Main strategy
├── GoalStack.js                     Stack data structure
└── index.js                         Exports
```

### 7.2 Strategy Definition

```javascript
import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';

export const createGoalStackStrategy = createTypedStrategy(
  'goal-stack',
  [],  // No predefined tools
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

createGoalStackStrategy.doWork = async function() {
  // Main loop implementation
};
```

### 7.3 Message Handling

Uses StandardTaskStrategy's automatic message routing:

```javascript
// 'start' message → doWork()
// 'work' message → doWork()
// 'abort' message → onAbort()

// Child completion automatically handled by StandardTaskStrategy
onChildCompleted(senderTask, result) {
  // Called when a child task completes
  // Can be used for complex multi-task coordination
}
```

## 8. Execution Flow

### 8.1 Turn-Based Interaction

```
Turn 1:
User: "Find me a train to Paris"
  ↓
Interpret → new_goal
  ↓
Create goal (composite)
  ↓
Push to stack
  ↓
Expand via GoalPlanner
  ↓
Push subgoals (gather origin, gather destination, gather date, search, present, confirm, book)
  ↓
Execute top: "Gather origin"
  ↓
Response: "Where are you traveling from?"

Turn 2:
User: "London"
  ↓
Interpret → add_evidence (key: origin, value: London)
  ↓
Update current goal evidence
  ↓
Check completion → hasEvidence('origin') → true
  ↓
Mark goal achieved, pop
  ↓
Execute next: "Gather destination"
  ↓
Response: "Where are you traveling to?"

Turn 3:
User: "Paris"
  ↓
... continue until all goals achieved
```

### 8.2 Depth-First Execution

```
Goal Stack (top → bottom):
[Search trains]       ← Active (execute now)
[Gather date]
[Gather destination] 
[Gather origin]
[Book train] (parent, blocked)

After "Search trains" completes:
[Gather date]        ← Now active
[Gather destination]
[Gather origin]
[Book train]
```

### 8.3 Completion Propagation

```javascript
propagateCompletion(goal) {
  if (!goal.parent) return;
  
  const parentGoal = this.goalStack.find(goal.parent);
  if (!parentGoal || !parentGoal.decomp) return;
  
  const allChildren = parentGoal.decomp.children.map(id => 
    this.goalStack.find(id)
  );
  
  if (parentGoal.decomp.kind === 'AND') {
    // All children must be achieved
    if (allChildren.every(c => c.status === 'achieved')) {
      parentGoal.status = 'achieved';
      this.propagateCompletion(parentGoal);
    }
  } else if (parentGoal.decomp.kind === 'OR') {
    // Any child achieved is sufficient
    if (allChildren.some(c => c.status === 'achieved')) {
      parentGoal.status = 'achieved';
      this.propagateCompletion(parentGoal);
    }
  }
}
```

## 9. Prompt Specifications

### 9.1 Interpret Message Prompt

**File:** `prompts/strategies/goal-stack/interpret-message.md`

Schema:
```yaml
responseSchema:
  type: object
  properties:
    action:
      type: string
      enum: [new_goal, add_evidence, abandon_goal, continue]
    goal:
      type: object
      properties:
        gloss: { type: string }
        context: { type: object }
    evidence:
      type: object
      properties:
        key: { type: string }
        value: { type: any }
    reasoning: { type: string }
  required: [action, reasoning]
```

### 9.2 Execute Gather Prompt

**File:** `prompts/strategies/goal-stack/execute-gather.md`

Schema:
```yaml
responseSchema:
  type: object
  properties:
    question: { type: string }
    suggestions: 
      type: array
      items: { type: string }
  required: [question]
```

### 9.3 Check Completion Prompt

**File:** `prompts/strategies/goal-stack/check-completion.md`

Schema:
```yaml
responseSchema:
  type: object
  properties:
    satisfied: { type: boolean }
    reasoning: { type: string }
  required: [satisfied, reasoning]
```

## 10. State Management

### 10.1 Persistence in Task Artifacts

```javascript
// Serialize goal stack to task artifacts
serializeStack() {
  return {
    goals: Array.from(this.goalStack.goals.values()),
    stack: this.goalStack.stack,
    timestamp: Date.now()
  };
}

// Restore from artifacts (for session continuation)
deserializeStack(data) {
  this.goalStack = new GoalStack();
  data.goals.forEach(g => this.goalStack.goals.set(g.id, g));
  this.goalStack.stack = data.stack;
}
```

### 10.2 Evidence in Task Context

Evidence is stored both in goal objects and task artifacts:

```javascript
// Goal-specific evidence
goal.evidence['travelDate'] = '2025-10-01';

// Also stored as task artifact for persistence
this.storeArtifact('travelDate', '2025-10-01', 'Travel date from user');

// Accessible to all subgoals via task context
const date = this.getArtifact('travelDate');
```

## 11. Tool Integration

### 11.1 Tool Selection

From GoalPlanner's SOP adaptation:
```javascript
// SOP step: "Search trains" with suggestedTools: ['train-search-api']
// →
subgoal: {
  gloss: "Search for available trains",
  pred: { name: 'use_tool', args: { tool: 'train-search-api' } },
  provenance: { suggestedTool: 'train-search-api' }
}
```

### 11.2 Tool Execution

```javascript
async executeTool(goal, toolName) {
  const toolRegistry = this.config.toolRegistry;
  const tool = await toolRegistry.getTool(toolName);
  
  if (!tool) {
    goal.status = 'blocked';
    this.addConversationEntry('assistant', `I need the ${toolName} tool but it's not available.`);
    return;
  }
  
  // Build args from evidence
  const args = {};
  if (tool.inputSchema?.properties) {
    for (const param of Object.keys(tool.inputSchema.properties)) {
      if (param in goal.evidence) {
        args[param] = goal.evidence[param];
      }
    }
  }
  
  // Execute
  const result = await tool.execute(args);
  
  // Store evidence
  const evidenceKey = this.getEvidenceKeyForGoal(goal);
  goal.evidence[evidenceKey] = result;
  this.storeArtifact(evidenceKey, result, `Result from ${toolName}`);
}
```

## 12. ROMA Agent Integration

### 12.1 Usage in SimpleROMAAgent

```javascript
import { createGoalStackStrategy } from './strategies/goal-stack/GoalStackStrategy.js';

const agent = new SimpleROMAAgent({
  taskStrategy: createGoalStackStrategy
});

await agent.initialize();

const result = await agent.execute({
  description: 'Book me a train to Paris tomorrow'
});
```

### 12.2 Task Context Integration

The strategy leverages Task framework:

```javascript
// From Task
this.description          // User's goal
this.conversation         // Conversation history
this.artifacts           // Evidence storage
this.context             // ExecutionContext with services

// From ExecutionContext
this.context.getService('llmClient')
this.context.getService('toolRegistry')
this.context.getService('goalPlanner')  // We'll add this
```

### 12.3 Service Registration

GoalPlanner added to GlobalContext:

```javascript
// In GlobalContext initialization
const goalPlanner = await GoalPlanner.getInstance();
this.registerService('goalPlanner', goalPlanner);
```

## 13. Example Scenarios

### 13.1 SOP-Based Execution

**Input:** "Book me a train to Paris"

**Flow:**
1. Interpret → new_goal("Book train to Paris")
2. Push goal (composite) to stack
3. Expand via GoalPlanner → finds "Book a train ticket" SOP
4. Creates 5 subgoals from SOP steps
5. Execute gather_info for travelDate
6. User provides date
7. Execute use_tool('train-search-api')
8. Present results
9. User confirms
10. Execute use_tool('train-booking-api')
11. All goals achieved

**Evidence Accumulated:**
```javascript
{
  origin: 'London',
  destination: 'Paris',
  travelDate: '2025-10-01',
  trainList: [...],
  selectedTrain: {...},
  confirmation: true,
  booking: {...}
}
```

### 13.2 Vanilla Execution

**Input:** "Create a caching layer"

**Flow:**
1. Interpret → new_goal("Create caching layer")
2. Push goal (composite)
3. Expand via GoalPlanner → no SOP match → vanilla decomposition
4. Creates 4 subgoals via LLM
5. Execute each with execute predicate
6. All goals achieved

## 14. State Serialization

For debugging and session continuation:

```javascript
getState() {
  return {
    goalStack: this.goalStack.serializeStack(),
    currentGoalId: this.goalStack.peek()?.id,
    evidenceKeys: Object.keys(this.getAllEvidence()),
    completedGoals: Array.from(this.goalStack.goals.values())
      .filter(g => g.status === 'achieved')
      .length
  };
}
```

## 15. Error Handling

Following Legion fail-fast pattern:

```javascript
// No silent failures
try {
  const plan = await this.goalPlanner.planGoal(goal);
} catch (error) {
  goal.status = 'abandoned';
  this.failWithError(error, `Failed to plan goal: ${goal.gloss}`);
  return;
}

// No fallbacks
if (!tool) {
  // Don't substitute or skip - mark as blocked
  goal.status = 'blocked';
  throw new Error(`Required tool ${toolName} not available`);
}
```

## 16. Scope Boundaries

### In Scope (MVP)

**Core Functionality:**
- Goal stack with push/pop/peek operations
- Message interpretation via TemplatedPrompt
- Goal expansion via GoalPlanner (SOP + vanilla)
- Primitive execution (use_tool, gather_info, confirm, present_info)
- Completion checking (hasEvidence, predicateTrue)
- Evidence accumulation in task artifacts
- Depth-first execution
- Parent-child goal relationships
- Completion propagation (AND/OR)

**Integration:**
- ROMA agent Task framework
- StandardTaskStrategy base class
- GoalPlanner for decomposition
- SOPRegistry via GoalPlanner
- ToolRegistry for tool execution
- TemplatedPrompt for all LLM interactions

**Testing:**
- Unit tests for GoalStack
- Integration tests with real GoalPlanner
- End-to-end with real SOPs and tools

### Out of Scope (Not MVP)

**Features:**
- Concurrent goal execution
- Goal prioritization beyond stack order
- Complex error recovery (beyond abandon)
- Goal modification after creation
- Alternative plan selection (user choice)
- Session persistence across restarts
- Multi-agent collaboration
- Goal debugging UI

**Advanced Conditions:**
- `js` condition type (security risk)
- Time-based conditions
- Event-based conditions

**Non-Functional:**
- Performance optimization
- Security hardening
- Deployment configuration

## 17. Testing Strategy

### 17.1 Unit Tests

**GoalStack.test.js:**
- Push/pop/peek operations
- Goal status updates
- Evidence accumulation
- Parent-child relationships
- AND/OR completion logic

**GoalStackStrategy.test.js:**
- Message interpretation with real LLM
- Goal expansion with real GoalPlanner
- Primitive execution
- Completion checking
- Evidence flow

### 17.2 Integration Tests

**WithRealGoalPlanner.test.js:**
- Complete workflow with SOP-based planning
- Complete workflow with vanilla planning
- Tool execution via ToolRegistry
- Evidence accumulation
- Multi-turn conversation

### 17.3 End-to-End Tests

**TrainBooking.test.js:**
- Full train booking scenario
- Uses real SOPRegistry
- Uses real GoalPlanner
- Uses real tools (mocked tool implementations for test)
- Verifies all steps complete
- Verifies evidence collected

## 18. Key Design Decisions

### 18.1 Why ROMA Strategy Pattern?

**Decision:** Implement as ROMA strategy, not standalone agent

**Rationale:**
- Reuses Task framework (context, artifacts, conversation)
- Reuses StandardTaskStrategy (message handling, error handling)
- Reuses GlobalContext (service registry)
- Pluggable into existing ROMA infrastructure
- Can be combined with other strategies

### 18.2 Goal Stack Location

**Decision:** In-memory within strategy instance

**Rationale:**
- Simple MVP implementation
- No database dependency
- Fast access
- Can serialize to task artifacts for debugging
- Persistence can be added later via task context

### 18.3 Evidence Storage

**Decision:** Both in goal.evidence AND task artifacts

**Rationale:**
- Goal.evidence for immediate access during execution
- Task artifacts for persistence and child task access
- Dual storage ensures evidence available everywhere

### 18.4 Interpreter Implementation

**Decision:** TemplatedPrompt with LLM, not rule-based

**Rationale:**
- Handles natural language variations
- Can infer intent from context
- Consistent with ROMA patterns
- Easy to test with real LLM

### 18.5 No js Conditions

**Decision:** Skip `js` condition type for MVP

**Rationale:**
- Security risk (code execution)
- hasEvidence + predicateTrue cover 95% of cases
- Can add later with sandboxing

## 19. Dependencies

```json
{
  "dependencies": {
    "@legion/tasks": "workspace:*",
    "@legion/goal-planner": "workspace:*",
    "@legion/tools-registry": "workspace:*",
    "@legion/prompt-manager": "workspace:*",
    "@legion/llm-client": "workspace:*",
    "uuid": "^9.0.0"
  }
}
```

All already available in roma-agent package.

## 20. Integration Points Summary

### With GoalPlanner
- Call `goalPlanner.planGoal(goal)` for expansion
- Receive structured subgoals with predicates
- Use provenance for debugging

### With SOPRegistry (via GoalPlanner)
- Automatic SOP retrieval via semantic search
- Applicability judgment
- Tool suggestions preserved

### With ToolRegistry
- Dynamic tool lookup by name
- Tool execution with args from evidence
- Result storage as evidence

### With Task Framework
- Evidence stored as artifacts
- Conversation for user interaction
- Context for service access
- Parent-child for complex decomposition

### With TemplatedPrompt
- Message interpretation
- Gather info question generation
- Completion checking for predicateTrue

---

**End of Design Document**

Please review this design document: `/packages/agents/roma-agent/src/strategies/goal-stack/docs/DESIGN.md`