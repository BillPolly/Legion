# Goal Planner Design Document (MVP)

## 1. Overview

The **Goal Planner** is a planning component that converts high-level goals into executable subgoal decompositions. It intelligently combines SOP-based planning (retrieval and adaptation) with vanilla task decomposition, selecting the best approach based on applicability.

The planner acts as a **stateless service** that agents call to expand composite goals into actionable subgoals. It integrates with SOPRegistry for procedural knowledge retrieval and DecentPlanner for general-purpose decomposition.

**Key Capabilities:**
- Query SOP Registry for relevant procedures
- Judge SOP applicability using LLM-based assessment
- Adapt SOP steps into goal decompositions with tool suggestions
- Fall back to vanilla decomposition when no SOP fits
- Provide provenance tracking (which SOP/step generated each subgoal)
- Return structured plans ready for execution

## 2. Core Data Models

### 2.1 Goal Structure

Input to the planner (from agent):

```javascript
{
  gloss: string,                    // "Find train to Paris"
  pred?: Predicate,                 // Optional machine-readable intent
  evidence: Record<string, any>,    // Data already gathered
  context?: Record<string, any>     // Additional context hints
}
```

### 2.2 Subgoal Structure

Output from the planner (to agent):

```javascript
{
  gloss: string,                    // "Search for available trains"
  pred?: Predicate,                 // { name: 'use_tool', args: { tool: 'train-search-api' } }
  doneWhen: Condition[],            // [{ kind: 'hasEvidence', key: 'trainList' }]
  provenance?: {                    // Where this subgoal came from
    sopId: string,
    sopTitle: string,
    stepIndex: number,
    suggestedTool?: string
  }
}
```

### 2.3 Plan Structure

Complete plan returned to agent:

```javascript
{
  subgoals: Subgoal[],              // Ordered array of subgoals
  decomp: 'AND' | 'OR',             // Decomposition type
  source: 'sop' | 'vanilla',        // How plan was generated
  confidence: number,               // 0-1 confidence score
  metadata: {
    sopUsed?: string,               // SOP title if source='sop'
    applicabilityScore?: number,    // Judge's assessment
    planningTime: number,           // Milliseconds
    timestamp: Date
  }
}
```

### 2.4 Predicate Structure

Machine-readable goal intent:

```javascript
{
  name: string,                     // 'use_tool', 'gather_info', 'confirm', etc.
  args: Record<string, any>         // Predicate-specific arguments
}
```

### 2.5 Condition Structure

Completion criteria:

```javascript
// Evidence-based completion
{ 
  kind: 'hasEvidence', 
  key: string                       // 'trainList', 'userConfirmation', etc.
}

// Predicate-based completion
{ 
  kind: 'predicateTrue', 
  pred: Predicate 
}
```

## 3. Architecture Components

### 3.1 GoalPlanner (Main Class)

Entry point and orchestrator:

```javascript
class GoalPlanner {
  static _instance = null;
  static async getInstance()
  
  constructor({ resourceManager })
  async initialize()
  
  // Main API
  async planGoal(goal, context)     // Returns Plan
  
  // Component access
  async _retrieveSOPCandidates(goal)
  async _judgeApplicability(candidates, goal, context)
  async _adaptSOPToPlan(sop, goal)
  async _vanillaPlanning(goal)
}
```

**Responsibilities:**
- Orchestrate SOP vs vanilla planning decision
- Delegate to SOPAdapter or VanillaAdapter
- Aggregate results into Plan structure
- Singleton pattern with ResourceManager integration

### 3.2 SOPAdapter

Converts SOP into goal decomposition:

```javascript
class SOPAdapter {
  constructor({ resourceManager })
  
  async adaptSOPToSubgoals(sop, goal)
  
  // Internal
  _mapStepToSubgoal(step, sop, stepIndex)
  _createPredicate(step)
  _createDoneWhen(step)
  _extractParameters(sop, goal)
  _createGatherSubgoals(missingParams)
}
```

**Responsibilities:**
- Map SOP steps to subgoal objects
- Convert suggestedTools to use_tool predicates
- Create doneWhen conditions from step completion criteria
- Add provenance metadata
- Generate gather subgoals for missing parameters

### 3.3 ApplicabilityJudge

LLM-based SOP suitability assessment using TemplatedPrompt:

```javascript
class ApplicabilityJudge {
  constructor({ resourceManager })
  
  async judge(sop, goal, context)
  
  // Uses TemplatedPrompt with schema:
  {
    type: 'object',
    properties: {
      suitable: { type: 'boolean' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      reasoning: { type: 'string' },
      missingPrerequisites: { type: 'array', items: { type: 'string' } },
      missingParameters: { type: 'array', items: { type: 'string' } }
    },
    required: ['suitable', 'confidence', 'reasoning', 'missingPrerequisites', 'missingParameters']
  }
}
```

**Responsibilities:**
- Create TemplatedPrompt with judgment schema
- Assess if SOP matches goal intent
- Check if prerequisites are satisfied (from context/evidence)
- Evaluate parameter availability
- Automatic validation and retry via TemplatedPrompt

### 3.4 VanillaAdapter

Simple LLM-based fallback decomposition using TemplatedPrompt:

```javascript
class VanillaAdapter {
  constructor({ resourceManager })
  
  async decomposeGoal(goal)
  
  // Uses TemplatedPrompt with schema:
  {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 5
      }
    },
    required: ['steps']
  }
}
```

**Responsibilities:**
- Create TemplatedPrompt with step array schema
- Simple LLM-based decomposition into steps
- Automatic parsing and validation via TemplatedPrompt
- Convert steps to subgoals with execute predicates
- Generate evidence keys from step descriptions
- No provenance (no SOP source)

### 3.5 VerbMapper

Deterministic verb → predicate mapping:

```javascript
class VerbMapper {
  static VERB_MAPPINGS = {
    'search': { pred: 'use_tool', doneWhen: 'hasEvidence' },
    'retrieve': { pred: 'use_tool', doneWhen: 'hasEvidence' },
    'gather': { pred: 'gather_info', doneWhen: 'hasEvidence' },
    'confirm': { pred: 'confirm', doneWhen: 'hasEvidence' },
    'validate': { pred: 'use_tool', doneWhen: 'predicateTrue' },
    'present': { pred: 'present_info', doneWhen: 'hasEvidence' },
    // ... extensible
  }
  
  static mapVerb(stepGloss)
  static extractVerb(stepGloss)
  static createPredicate(verb, suggestedTools)
  static createDoneWhen(verb, stepGloss)
}
```

**Responsibilities:**
- Map action verbs to predicates deterministically
- Extract verb from natural language step
- Create appropriate doneWhen conditions based on verb semantics
- Provide fallback for unmapped verbs

## 4. Planning Flow

### 4.1 Main Flow

```
Agent calls: planner.planGoal(goal, context)
  ↓
1. Retrieve SOP candidates
   - sopRegistry.searchSOPs(goal.gloss)
   - Get top 3 candidates
   ↓
2. Judge applicability for each
   - Check prerequisites vs context
   - Assess parameter availability
   - Score intent match
   ↓
3. Select best candidate
   - If confidence ≥ 0.7 → use SOP
   - Else → use vanilla
   ↓
4a. SOP Path:
   - Adapt SOP to subgoals
   - Add gather subgoals for missing params
   - Map steps using VerbMapper
   - Attach provenance
   ↓
4b. Vanilla Path:
   - Call DecentPlanner.plan(goal.gloss)
   - Convert hierarchy to subgoals
   - Create predicates from tools
   ↓
5. Return Plan
   - subgoals array
   - decomp type (AND/OR)
   - source + metadata
```

### 4.2 SOP Adaptation Flow

```
Input: SOP + Goal

1. Check parameters
   - Extract sop.inputs
   - Check against goal.evidence
   - Identify missing params
   ↓
2. Create gather subgoals
   For each missing param:
   {
     gloss: "Gather {paramName}",
     pred: { name: 'gather_info', args: { key: paramName } },
     doneWhen: [{ kind: 'hasEvidence', key: paramName }]
   }
   ↓
3. Map SOP steps
   For each step:
   - Extract verb from step.gloss
   - Map to predicate via VerbMapper
   - Use suggestedTools if present
   - Create doneWhen condition
   - Attach provenance
   ↓
4. Combine
   subgoals = [...gatherSubgoals, ...stepSubgoals]
   ↓
5. Return Plan
   - decomp: 'AND' (sequential)
   - source: 'sop'
   - metadata with SOP reference
```

## 5. Applicability Judgment

### 5.1 Judgment Criteria

The ApplicabilityJudge evaluates:

1. **Intent Match**: Does SOP intent align with goal?
2. **Prerequisites**: Are SOP prerequisites satisfied?
3. **Parameters**: Are required inputs available or gatherable?
4. **Toolability**: Are suggested tools available in ToolRegistry?

### 5.2 Judgment Prompt Template

Using TemplatedPrompt with schema:

```javascript
const promptTemplate = `Assess if this SOP is suitable for the given goal.

Goal: {{goalGloss}}
Available Evidence: {{evidenceKeys}}
Context: {{context}}

SOP:
- Title: {{sopTitle}}
- Intent: {{sopIntent}}
- Prerequisites: {{prerequisites}}
- Required Inputs: {{requiredInputs}}
- Tools Used: {{toolsMentioned}}

Evaluate:
1. Does the SOP intent match the goal?
2. Are prerequisites satisfied? List any missing.
3. Are required inputs available? List missing.
4. Confidence this SOP will work (0-1 score)

{{outputPrompt}}`;

const responseSchema = {
  type: 'object',
  properties: {
    suitable: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
    missingPrerequisites: { type: 'array', items: { type: 'string' } },
    missingParameters: { type: 'array', items: { type: 'string' } }
  },
  required: ['suitable', 'confidence', 'reasoning', 'missingPrerequisites', 'missingParameters']
};

const templatedPrompt = new TemplatedPrompt({
  prompt: promptTemplate,
  responseSchema,
  llmClient,
  maxRetries: 3
});

const result = await templatedPrompt.execute(placeholderValues);
// result.data automatically parsed and validated
```

### 5.3 Decision Threshold

- If `confidence ≥ 0.7` AND `missingPrerequisites.length === 0` → Use SOP
- Else → Use vanilla planning

## 6. Verb → Predicate Mapping

### 6.1 Standard Mappings

```javascript
VERB_MAPPINGS = {
  // Information gathering
  'gather': { 
    pred: 'gather_info', 
    doneWhen: 'hasEvidence'
  },
  'collect': { 
    pred: 'gather_info', 
    doneWhen: 'hasEvidence'
  },
  'ask': { 
    pred: 'gather_info', 
    doneWhen: 'hasEvidence'
  },
  
  // Tool invocation
  'search': { 
    pred: 'use_tool', 
    doneWhen: 'hasEvidence' 
  },
  'retrieve': { 
    pred: 'use_tool', 
    doneWhen: 'hasEvidence' 
  },
  'call': { 
    pred: 'use_tool', 
    doneWhen: 'hasEvidence' 
  },
  'execute': { 
    pred: 'use_tool', 
    doneWhen: 'hasEvidence' 
  },
  
  // User interaction
  'present': { 
    pred: 'present_info', 
    doneWhen: 'hasEvidence' 
  },
  'show': { 
    pred: 'present_info', 
    doneWhen: 'hasEvidence' 
  },
  'display': { 
    pred: 'present_info', 
    doneWhen: 'hasEvidence' 
  },
  
  // Confirmation
  'confirm': { 
    pred: 'confirm', 
    doneWhen: 'hasEvidence' 
  },
  'verify': { 
    pred: 'confirm', 
    doneWhen: 'predicateTrue' 
  },
  'validate': { 
    pred: 'confirm', 
    doneWhen: 'predicateTrue' 
  }
}
```

### 6.2 Verb Extraction

Simple heuristic:
```javascript
extractVerb(stepGloss) {
  const words = stepGloss.toLowerCase().split(/\s+/);
  const firstWord = words[0];
  
  // Check if first word is in mapping table
  if (VERB_MAPPINGS[firstWord]) {
    return firstWord;
  }
  
  // Check second word (for phrases like "Go search...")
  if (words.length > 1 && VERB_MAPPINGS[words[1]]) {
    return words[1];
  }
  
  // Default: 'execute'
  return 'execute';
}
```

### 6.3 Predicate Creation

```javascript
createPredicate(verb, suggestedTools, stepGloss) {
  const mapping = VERB_MAPPINGS[verb] || { pred: 'use_tool' };
  
  const pred = { name: mapping.pred, args: {} };
  
  // If use_tool, add tool reference
  if (pred.name === 'use_tool' && suggestedTools?.length > 0) {
    pred.args.tool = suggestedTools[0];  // Use first suggested tool
  }
  
  // If gather_info, extract parameter name
  if (pred.name === 'gather_info') {
    const paramMatch = stepGloss.match(/gather\s+(\w+)/i);
    if (paramMatch) {
      pred.args.key = paramMatch[1];
    }
  }
  
  return pred;
}
```

## 7. Integration Points

### 7.1 SOP Registry Integration

```javascript
// Retrieve candidates
const candidates = await sopRegistry.searchSOPs(goal.gloss, { 
  topK: 3,
  hybridWeight: 0.6 
});

// Each candidate includes:
{
  sop: { title, intent, steps, prerequisites, inputs, outputs, toolsMentioned },
  score: number,
  matchedPerspectives: Array
}
```

### 7.2 Simple LLM Decomposition

```javascript
// Fallback decomposition
const prompt = `Break down this goal into 3-5 simple, actionable steps:

Goal: ${goal.gloss}

Return a JSON array of steps:
["step 1", "step 2", "step 3"]`;

const response = await llmClient.complete(prompt, 500);
const steps = parseSteps(response);

const subgoals = steps.map(step => ({
  gloss: step,
  pred: { name: 'execute', args: {} },
  doneWhen: [{ kind: 'hasEvidence', key: generateEvidenceKey(step) }]
}));
```

### 7.3 Tool Registry Integration

During SOP judgment, verify tools exist:

```javascript
// Check if suggested tools are available
const toolNames = sop.toolsMentioned;
const availableTools = await Promise.all(
  toolNames.map(name => toolRegistry.getTool(name))
);

const missingTools = toolNames.filter((name, i) => !availableTools[i]);
```

### 7.4 Resource Manager Integration

All dependencies via ResourceManager:

```javascript
async initialize() {
  const resourceManager = await ResourceManager.getResourceManager();
  
  this.sopRegistry = await SOPRegistry.getInstance();
  this.decentPlanner = await DecentPlanner.create(resourceManager);
  
  const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
  this.llmClient = new LLMClient({
    provider: 'anthropic',
    apiKey: anthropicKey,
    model: 'claude-3-5-sonnet-20241022'
  });
  
  this.toolRegistry = await ToolRegistry.getInstance();
}
```

## 8. SOP Adaptation Algorithms

### 8.1 Parameter Analysis

```javascript
async _extractParameters(sop, goal) {
  const required = Object.entries(sop.inputs || {})
    .filter(([k, v]) => v.required)
    .map(([k]) => k);
  
  const available = Object.keys(goal.evidence || {});
  
  const missing = required.filter(p => !available.includes(p));
  
  return { required, available, missing };
}
```

### 8.2 Gather Subgoal Generation

```javascript
_createGatherSubgoals(missingParams, sop) {
  return missingParams.map(param => ({
    gloss: `Gather ${param}`,
    pred: {
      name: 'gather_info',
      args: { 
        key: param,
        prompt: sop.inputs[param]?.description || `Please provide ${param}`
      }
    },
    doneWhen: [{ kind: 'hasEvidence', key: param }],
    provenance: {
      sopId: sop._id.toString(),
      sopTitle: sop.title,
      stepIndex: -1,  // Synthesized, not from actual step
      reason: 'parameter_gathering'
    }
  }));
}
```

### 8.3 Step Mapping

```javascript
_mapStepToSubgoal(step, sop, stepIndex) {
  const verb = VerbMapper.extractVerb(step.gloss);
  const pred = VerbMapper.createPredicate(verb, step.suggestedTools, step.gloss);
  const doneWhen = VerbMapper.createDoneWhen(verb, step.doneWhen);
  
  return {
    gloss: step.gloss,
    pred,
    doneWhen,
    provenance: {
      sopId: sop._id.toString(),
      sopTitle: sop.title,
      stepIndex,
      suggestedTool: step.suggestedTools?.[0]
    }
  };
}
```

## 9. Vanilla Planning - Simple LLM Decomposition

### 9.1 Decomposition with TemplatedPrompt

```javascript
const promptTemplate = `Break down this goal into 3-5 simple, actionable steps.

Goal: {{goalGloss}}
{{#if domain}}Domain: {{domain}}{{/if}}

Each step should be:
- Clear and actionable
- A single focused task
- Executable by a tool or simple action

{{outputPrompt}}`;

const responseSchema = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 5,
      description: 'Array of step descriptions'
    }
  },
  required: ['steps']
};

const templatedPrompt = new TemplatedPrompt({
  prompt: promptTemplate,
  responseSchema,
  llmClient,
  maxRetries: 3
});

const result = await templatedPrompt.execute({
  goalGloss: goal.gloss,
  domain: goal.context?.domain
});

// result.data.steps is automatically parsed and validated
```

### 9.2 Subgoal Generation

```javascript
async decomposeGoal(goal) {
  const templatedPrompt = new TemplatedPrompt({
    prompt: this.promptTemplate,
    responseSchema: this.responseSchema,
    llmClient: this.llmClient,
    maxRetries: 3
  });
  
  const result = await templatedPrompt.execute({
    goalGloss: goal.gloss,
    domain: goal.context?.domain
  });
  
  if (!result.success) {
    throw new VanillaPlanningError('Failed to decompose goal', goal, new Error(result.errors.join(', ')));
  }
  
  const subgoals = result.data.steps.map(step => ({
    gloss: step,
    pred: { name: 'execute', args: {} },
    doneWhen: [{ kind: 'hasEvidence', key: this._generateEvidenceKey(step) }]
  }));
  
  return {
    subgoals,
    decomp: 'AND',
    confidence: 0.6
  };
}
```

## 10. Usage Examples

### 10.1 SOP-Based Planning

```javascript
import GoalPlanner from '@legion/goal-planner';

const goalPlanner = await GoalPlanner.getInstance();

const goal = {
  gloss: "Find me a train to Paris",
  evidence: {
    destination: "Paris"
  }
};

const plan = await goalPlanner.planGoal(goal);

// Result (SOP-based):
{
  subgoals: [
    {
      gloss: "Gather travel date",
      pred: { name: 'gather_info', args: { key: 'travelDate' } },
      doneWhen: [{ kind: 'hasEvidence', key: 'travelDate' }]
    },
    {
      gloss: "Search for available trains",
      pred: { name: 'use_tool', args: { tool: 'train-search-api' } },
      doneWhen: [{ kind: 'hasEvidence', key: 'trainList' }],
      provenance: { sopTitle: 'Book a train ticket', stepIndex: 1, ... }
    },
    // ... more steps
  ],
  decomp: 'AND',
  source: 'sop',
  confidence: 0.92,
  metadata: {
    sopUsed: 'Book a train ticket',
    applicabilityScore: 0.92
  }
}
```

### 10.2 Vanilla Planning

```javascript
const goal = {
  gloss: "Implement a caching layer for the API"
};

const plan = await goalPlanner.planGoal(goal);

// Result (vanilla):
{
  subgoals: [
    {
      gloss: "Design cache data structure",
      pred: { name: 'execute', args: {} },
      doneWhen: [{ kind: 'hasEvidence', key: 'designCacheDataStructure' }]
    },
    {
      gloss: "Implement cache storage mechanism",
      pred: { name: 'execute', args: {} },
      doneWhen: [{ kind: 'hasEvidence', key: 'implementCacheStorageMechanism' }]
    },
    {
      gloss: "Add cache retrieval logic",
      pred: { name: 'execute', args: {} },
      doneWhen: [{ kind: 'hasEvidence', key: 'addCacheRetrievalLogic' }]
    },
    {
      gloss: "Test caching functionality",
      pred: { name: 'execute', args: {} },
      doneWhen: [{ kind: 'hasEvidence', key: 'testCachingFunctionality' }]
    }
  ],
  decomp: 'AND',
  source: 'vanilla',
  confidence: 0.6
}
```

## 11. Component Interfaces

### 11.1 GoalPlanner Public API

```javascript
class GoalPlanner {
  // Singleton access
  static async getInstance(): Promise<GoalPlanner>
  static reset(): void  // Test only
  
  // Main planning method
  async planGoal(goal: Goal, context?: Context): Promise<Plan>
  
  // Utility methods
  async getStatistics(): Promise<Statistics>
  async healthCheck(): Promise<HealthStatus>
  async cleanup(): Promise<void>
}
```

### 11.2 SOPAdapter Interface

```javascript
class SOPAdapter {
  constructor({ resourceManager })
  
  async adaptSOPToSubgoals(
    sop: SOP, 
    goal: Goal
  ): Promise<{
    subgoals: Subgoal[],
    decomp: 'AND' | 'OR',
    confidence: number
  }>
}
```

### 11.3 ApplicabilityJudge Interface

```javascript
class ApplicabilityJudge {
  constructor({ resourceManager })
  
  async judge(
    sop: SOP,
    goal: Goal,
    context: Context
  ): Promise<{
    suitable: boolean,
    confidence: number,
    reasoning: string,
    missingPrerequisites: string[],
    missingParameters: string[]
  }>
}
```

### 11.4 VanillaAdapter Interface

```javascript
class VanillaAdapter {
  constructor({ resourceManager })
  
  async decomposeGoal(
    goal: Goal
  ): Promise<{
    subgoals: Subgoal[],
    decomp: 'AND' | 'OR',
    confidence: number
  }>
}
```

## 12. Error Handling

### 12.1 Error Classes

```javascript
class GoalPlannerError extends Error
class SOPAdaptationError extends GoalPlannerError
class ApplicabilityJudgmentError extends GoalPlannerError  
class VanillaPlanningError extends GoalPlannerError
```

### 12.2 Fail-Fast Policy

- Missing ANTHROPIC_API_KEY → Throw immediately
- SOPRegistry unavailable → Throw immediately
- DecentPlanner fails → Throw immediately (no fallback)
- LLM call fails → Throw immediately
- Invalid goal structure → Throw immediately

### 12.3 No Fallbacks

- If SOP adaptation fails → Don't silently fall back to vanilla
- If vanilla fails → Don't return empty plan
- Fail fast and let caller handle retry logic

## 13. File Organization

```
packages/planning/goal-planner/
├── package.json
├── jest.config.js
├── README.md
│
├── docs/
│   └── DESIGN.md                    (this document)
│
├── src/
│   ├── index.js                     // Export GoalPlanner singleton
│   ├── GoalPlanner.js               // Main orchestrator
│   ├── SOPAdapter.js                // SOP → subgoals converter
│   ├── ApplicabilityJudge.js        // LLM-based suitability check
│   ├── VanillaAdapter.js            // Fallback decomposition
│   ├── VerbMapper.js                // Verb → predicate mapping
│   └── errors/
│       └── index.js                 // Error classes
│
├── __tests__/
│   ├── unit/
│   │   ├── GoalPlanner.test.js
│   │   ├── SOPAdapter.test.js
│   │   ├── ApplicabilityJudge.test.js
│   │   ├── VanillaAdapter.test.js
│   │   └── VerbMapper.test.js
│   └── integration/
│       ├── SOPBasedPlanning.test.js
│       ├── VanillaPlanning.test.js
│       └── FullPipeline.test.js
│
└── examples/
    ├── sop-based-example.js
    └── vanilla-example.js
```

## 14. Dependencies

```json
{
  "dependencies": {
    "@legion/resource-manager": "workspace:*",
    "@legion/sop-registry": "workspace:*",
    "@legion/tools-registry": "workspace:*",
    "@legion/llm-client": "workspace:*",
    "@legion/prompt-manager": "workspace:*"
  }
}
```

**Note:** 
- ToolRegistry used for optional tool verification during SOP judgment
- PromptManager provides TemplatedPrompt for automatic schema validation
- No DecentPlanner dependency - vanilla planning uses simple LLM decomposition

## 15. Testing Strategy

### 15.1 Unit Tests

**VerbMapper.test.js** (Pure, no dependencies):
- Verb extraction from various phrasings
- Predicate creation for each verb type
- DoneWhen condition generation
- Edge cases (unknown verbs, empty strings)

**SOPAdapter.test.js** (Real SOPRegistry):
- Parameter extraction
- Gather subgoal generation
- Step mapping with provenance
- Complete SOP adaptation

**ApplicabilityJudge.test.js** (Real LLM):
- Intent matching assessment
- Prerequisite checking
- Parameter availability evaluation
- Confidence scoring

**VanillaAdapter.test.js** (Real DecentPlanner):
- Hierarchy to subgoals conversion
- Tool predicate creation
- Evidence key generation

**GoalPlanner.test.js** (All components):
- SOP candidate retrieval
- Applicability judgment integration
- SOP vs vanilla decision logic
- Plan structure validation

### 15.2 Integration Tests

**SOPBasedPlanning.test.js**:
- End-to-end with real SOP retrieval
- Load SOP, judge, adapt, verify
- Check provenance metadata
- Verify tool suggestions preserved

**VanillaPlanning.test.js**:
- End-to-end with DecentPlanner
- No SOP match scenario
- Verify subgoal quality

**FullPipeline.test.js**:
- Both SOP and vanilla paths
- Multiple goals
- Statistics verification

### 15.3 Test Requirements

- Real MongoDB (SOPRegistry needs it)
- Real LLM (ApplicabilityJudge needs it)
- Real Nomic (SOP search needs embeddings)
- Real DecentPlanner (no mocks)
- NO MOCKS in implementation
- NO FALLBACKS
- All tests must pass

## 16. Scope Boundaries

### In Scope (MVP)

**Core Functionality:**
- Goal → Plan conversion
- SOP retrieval via SOPRegistry semantic search
- LLM-based applicability judgment
- SOP step → subgoal adaptation with provenance
- Verb → predicate mapping (deterministic table)
- Gather subgoal generation for missing parameters
- Vanilla planning fallback via DecentPlanner
- Plan structure with metadata
- Singleton pattern with ResourceManager

**Testing:**
- Unit tests for all components
- Integration tests for both planning paths
- Real dependencies (MongoDB, LLM, DecentPlanner)

### Out of Scope (Not MVP)

**Features:**
- Multi-SOP composition (combining multiple SOPs)
- Plan caching or memoization
- User choice between competing SOPs
- Hybrid plans (mix SOP + vanilla)
- Plan modification or refinement
- Execution feedback loop
- Learning from failures
- SOP authoring or editing

**Advanced Judgment:**
- Tool availability scoring beyond binary check
- Cost estimation for plan execution
- Risk assessment
- Alternative plan generation

**Non-Functional:**
- Performance optimization
- Caching strategies
- Security hardening
- Deployment configuration
- Monitoring and observability

**State Management:**
- Stateful planner with preferences
- Session caching
- Port overrides (LLM/retriever swapping)

## 17. Design Principles

Following Legion patterns:

1. **Singleton Pattern**: GoalPlanner is singleton like SOPRegistry, ToolRegistry
2. **ResourceManager Integration**: All dependencies via ResourceManager
3. **Fail-Fast**: NO fallbacks, NO silent failures
4. **Clean Separation**: Each component has single responsibility
5. **Stateless Service**: No session state, pure function from goal → plan
6. **Real Dependencies**: Use actual SOPRegistry, DecentPlanner, LLM
7. **Provenance Tracking**: Always know where subgoals came from
8. **ES6 Modules**: Modern JavaScript throughout
9. **TDD**: Tests drive implementation
10. **No Backwards Compatibility**: One way of doing things

## 18. Key Design Decisions

### 18.1 Stateless vs Stateful

**Decision**: Stateless service (no caching, no preferences)

**Rationale**:
- Simpler MVP implementation
- Easier to test (no state cleanup)
- Can add state layer later if needed
- Agent can cache at its level

### 18.2 SOP vs Vanilla Decision

**Decision**: Simple threshold-based (confidence ≥ 0.7)

**Rationale**:
- Clear, deterministic decision boundary
- Easy to test and debug
- Can refine later with more sophisticated selection

### 18.3 Parameter Gathering

**Decision**: Generate explicit gather subgoals

**Rationale**:
- Makes parameter dependencies explicit
- Agent can handle gathering uniformly
- Clear execution order (gather first, then execute steps)

### 18.4 Verb Mapping

**Decision**: Deterministic table lookup, no LLM fallback

**Rationale**:
- Fast and predictable
- Easy to extend with new verbs
- Avoids LLM calls for simple mapping
- Unknown verbs default to 'execute' (safe fallback)

### 18.5 Tool Selection

**Decision**: Use first suggestedTool from SOP step

**Rationale**:
- SOP author prioritizes tools in order
- Simple and deterministic
- Can enhance with scoring later

## 19. Statistics and Monitoring

### 19.1 Planning Statistics

```javascript
await goalPlanner.getStatistics();

// Returns:
{
  totalPlans: number,
  sopBased: number,
  vanillaBased: number,
  avgConfidence: number,
  avgSubgoalsPerPlan: number,
  avgPlanningTime: number,
  sopUsageByTitle: Record<string, number>
}
```

### 19.2 Health Check

```javascript
await goalPlanner.healthCheck();

// Returns:
{
  healthy: boolean,
  sopRegistry: { available: boolean, sopsLoaded: number },
  decentPlanner: { available: boolean },
  llmClient: { available: boolean },
  toolRegistry: { available: boolean, toolsLoaded: number }
}
```

## 20. Example Scenarios

### 20.1 Perfect SOP Match

**Input**: "Book a train to London"

**Flow**:
1. Search SOPs → finds "Book a train ticket" (score: 0.95)
2. Judge applicability → confidence: 0.92, suitable: true
3. Adapt SOP steps → 5 subgoals with provenance
4. Return plan with source='sop'

**Output**: Sequential AND plan with train-search-api and booking-api tools suggested

### 20.2 Partial Match (Missing Prerequisites)

**Input**: "Book a train to London"
**Context**: No payment method configured

**Flow**:
1. Search SOPs → finds "Book a train ticket"
2. Judge applicability → missingPrerequisites: ["payment method configured"]
3. Confidence: 0.45 (below threshold)
4. Fall back to vanilla planning

**Output**: DecentPlanner generates general decomposition

### 20.3 No SOP Match

**Input**: "Implement a Redis caching layer"

**Flow**:
1. Search SOPs → no relevant results above threshold
2. Skip judgment (no candidates)
3. Use vanilla planning immediately
4. DecentPlanner decomposes into design + implementation + testing

**Output**: Vanilla plan from task decomposition

### 20.4 Parameter Gathering

**Input**: "Book a train to Paris"
**Evidence**: {} (empty)

**Flow**:
1. Find SOP "Book a train ticket"
2. Judge → suitable, but missing: origin, destination, travelDate
3. Adapt SOP
4. Prepend gather subgoals:
   - Gather origin
   - Gather destination  
   - Gather travelDate
5. Then SOP steps

**Output**: Plan starts with 3 gather subgoals, then 5 SOP step subgoals

---

**End of Design Document**

Please review this design document: `/packages/planning/goal-planner/docs/DESIGN.md`