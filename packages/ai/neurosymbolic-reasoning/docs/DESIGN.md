# Neurosymbolic Reasoning - Design Document

## Overview

This package provides neurosymbolic reasoning capabilities for Legion by combining Large Language Models (LLMs) with formal logic theorem proving using Z3. It is a Node.js port of the [ProofOfThought](https://github.com/DebarghaG/proofofthought) Python library, adapted for the Legion framework.

### What is Neurosymbolic Reasoning?

Neurosymbolic reasoning combines two complementary AI paradigms:

1. **Neural (LLMs)**: Creative, flexible, handles natural language, generalizes well
2. **Symbolic (Z3 Theorem Prover)**: Precise, verifiable, handles formal logic, mathematically sound

By combining both, we get AI systems that can:
- Reason about complex questions in natural language
- Provide formal proofs for their conclusions
- Verify outputs for logical consistency
- Explain reasoning chains transparently
- Avoid hallucinations through formal verification

### Core Value Proposition

**Problem**: LLMs are powerful but unreliable - they hallucinate, can't verify their outputs, and provide no guarantee of logical consistency.

**Solution**: Use LLMs to understand questions and propose reasoning steps, then use Z3 to formally verify those steps and prove conclusions.

**Result**: Verifiable AI reasoning with formal proofs, explainable decision chains, and guaranteed logical consistency.

## Core Concepts

### The Reasoning Pipeline

```
Natural Language Question
         ↓
    LLM generates Z3 program (JSON)
         ↓
    Z3 solves constraints
         ↓
    Verifier checks solution
         ↓
    Answer + Proof Chain
```

### Two-Layer Architecture

Following the original ProofOfThought design:

**Layer 1: Z3 DSL (Domain-Specific Language)**
- JSON-based interface to Z3 theorem prover
- Language-agnostic (same format in Python and Node.js)
- Defines variables, constraints, assertions, queries

**Layer 2: Reasoning Engine**
- High-level JavaScript API
- LLM integration for program generation
- Verification and proof extraction
- Natural language interfacing

### Key Components

1. **ProofOfThought**: Main reasoning interface
2. **Z3ProgramGenerator**: LLM-based program synthesis
3. **Z3Solver**: Wrapper around z3-solver npm package
4. **Verifier**: Solution verification and proof extraction
5. **PromptTemplate**: LLM prompt engineering for program generation

## Architecture

### Package Structure

```
packages/ai/neurosymbolic-reasoning/
├── src/
│   ├── index.js                    # Main exports
│   ├── core/
│   │   └── ProofOfThought.js      # Main reasoning class
│   ├── solvers/
│   │   ├── Z3Solver.js            # Z3 wrapper
│   │   └── AbstractSolver.js      # Solver interface
│   ├── reasoning/
│   │   ├── ProgramGenerator.js    # LLM → Z3 program
│   │   ├── Verifier.js            # Solution verification
│   │   └── PromptTemplate.js      # LLM prompts
│   ├── dsl/
│   │   ├── Expressions.js         # Z3 expression handling
│   │   └── Sorts.js               # Z3 type system
│   ├── utils/
│   │   └── evaluation-metrics.js  # Accuracy, precision, recall
│   └── schemas/
│       └── z3-program-schema.js   # JSON schema validation
├── __tests__/
│   ├── unit/
│   └── integration/
├── docs/
│   └── DESIGN.md
└── package.json
```

### Component Interaction Flow

```
User Query
    ↓
ProofOfThought.query()
    ↓
ProgramGenerator.generate()
    ↓ (calls LLM with prompt)
Z3 Program (JSON)
    ↓
Z3Solver.solve()
    ↓ (executes Z3)
Solution
    ↓
Verifier.verify()
    ↓ (checks proof)
Result + Proof Chain
```

## Component Design

### ProofOfThought (Main API)

**Purpose**: High-level interface for neurosymbolic reasoning

**Responsibilities**:
- Accept natural language questions
- Coordinate program generation, solving, verification
- Return answers with proofs
- Handle errors and retries

**Interface**:
```javascript
class ProofOfThought {
  constructor(llmClient, options = {})

  async query(question, context = {})
  // Returns: { answer, proof, confidence, explanation }

  async verify(claim, facts = [], constraints = [])
  // Returns: { valid, proof, violations }

  async solve(goal, constraints = [], facts = [])
  // Returns: { solution, satisfiable, model }
}
```

**Key Design Decisions**:
- All methods async (Z3 WASM and LLM calls)
- Accepts ResourceManager-provided LLM client
- Returns structured results with proofs
- No caching in MVP (add later if needed)

### Z3ProgramGenerator

**Purpose**: Convert natural language questions to Z3 programs using LLM

**Responsibilities**:
- Generate prompts for LLM
- Parse LLM output to extract Z3 program JSON
- Validate generated programs
- Handle LLM errors and retries

**Interface**:
```javascript
class Z3ProgramGenerator {
  constructor(llmClient, promptTemplate)

  async generate(question, context = {})
  // Returns: { program: {...}, raw: "..." }

  async regenerate(question, context, error)
  // Retry with error feedback
}
```

**Z3 Program JSON Format**:
```json
{
  "variables": [
    { "name": "x", "sort": "Int" },
    { "name": "y", "sort": "Bool" }
  ],
  "constraints": [
    { "type": "ge", "args": ["x", 0] },
    { "type": "and", "args": [...] }
  ],
  "assertions": [
    { "expression": {...} }
  ],
  "query": {
    "type": "check-sat",
    "goal": "..."
  }
}
```

### Z3Solver

**Purpose**: Execute Z3 programs and extract results

**Responsibilities**:
- Initialize z3-solver WASM
- Execute Z3 programs (JSON → Z3 API)
- Extract models and proofs
- Handle Z3 errors

**Interface**:
```javascript
class Z3Solver {
  async initialize()
  // Sets up z3-solver Context

  async solve(program)
  // Returns: { result: 'sat'|'unsat', model: {...}, proof: [...] }

  async checkSat(constraints)
  // Quick satisfiability check

  async getModel()
  // Extract variable assignments

  async getProof()
  // Extract proof chain
}
```

**Implementation Notes**:
- Uses z3-solver npm package (v4.15.3+)
- High-level Context API (not low-level C API)
- Maintains single Context per solver instance
- All methods async (WASM threading)

### Verifier

**Purpose**: Verify solutions and extract human-readable proofs

**Responsibilities**:
- Check solution validity
- Extract proof steps
- Convert proofs to natural language
- Identify verification failures

**Interface**:
```javascript
class Verifier {
  constructor(solver)

  async verify(solution, constraints)
  // Returns: { valid, violations: [], proof: [...] }

  async extractProof()
  // Returns: [{ step: 1, rule: "...", conclusion: "..." }]

  async explainProof(proof)
  // Returns: "Step 1: ...\nStep 2: ..."
}
```

### PromptTemplate

**Purpose**: Manage LLM prompts for Z3 program generation

**Responsibilities**:
- Store prompt templates
- Fill templates with context
- Include examples (few-shot prompting)
- Handle different question types

**Interface**:
```javascript
class PromptTemplate {
  constructor(template, examples = [])

  render(question, context = {})
  // Returns: "You are a reasoning assistant..."

  addExample(question, program)
  // Add few-shot example
}
```

**Default Template Structure**:
```
You are an expert at formal reasoning. Given a natural language question,
generate a Z3 theorem prover program in JSON format.

Examples:
Q: "Is x greater than 5 and less than 10?"
Program: { variables: [{ name: "x", sort: "Int" }], ... }

Q: "{{question}}"
Context: {{context}}

Generate the Z3 program:
```

## API Design

### Main Entry Point

```javascript
import { ProofOfThought } from '@legion/neurosymbolic-reasoning';
import { ResourceManager } from '@legion/resource-manager';

const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('llmClient');

const pot = new ProofOfThought(llmClient);
```

### Basic Query

```javascript
const result = await pot.query(
  "Would a Democrat politician publicly denounce abortion?"
);

console.log(result);
// {
//   answer: "No",
//   confidence: 0.92,
//   proof: [
//     { step: 1, fact: "Democrat party supports abortion rights" },
//     { step: 2, rule: "Politicians align with party positions" },
//     { step: 3, conclusion: "Democrat unlikely to denounce abortion" }
//   ],
//   explanation: "Based on Democratic party platform supporting reproductive rights..."
// }
```

### Query with Constraints

```javascript
const result = await pot.query(
  "Should we deploy to production?",
  {
    facts: [
      "all_tests_passing = true",
      "code_coverage = 76%",
      "no_critical_vulnerabilities = true"
    ],
    constraints: [
      "all_tests_passing == true",
      "code_coverage > 80%",
      "no_critical_vulnerabilities == true"
    ]
  }
);

// {
//   answer: "No",
//   confidence: 1.0,
//   proof: [
//     { step: 1, check: "all_tests_passing == true", result: "satisfied" },
//     { step: 2, check: "code_coverage > 80%", result: "violated (76% < 80%)" },
//     { step: 3, check: "no_critical_vulnerabilities == true", result: "satisfied" },
//     { conclusion: "Constraint 2 violated - deployment blocked" }
//   ],
//   explanation: "Deployment blocked: code coverage (76%) below required threshold (80%)"
// }
```

### Verify a Claim

```javascript
const result = await pot.verify(
  "This transaction is safe",
  [
    "transaction.amount = 1000",
    "user.balance = 500",
    "transaction.verified = true"
  ],
  [
    "transaction.amount <= user.balance",
    "transaction.verified == true"
  ]
);

// {
//   valid: false,
//   violations: [
//     { constraint: "transaction.amount <= user.balance",
//       reason: "1000 > 500" }
//   ],
//   proof: [...]
// }
```

### Solve Constraint Problem

```javascript
const result = await pot.solve(
  "Find valid meeting time",
  [
    "time >= 9",
    "time <= 17",
    "time != 12",
    "person_a_available(time) == true",
    "person_b_available(time) == true"
  ],
  [
    "person_a_available(10) = true",
    "person_a_available(14) = true",
    "person_b_available(14) = true"
  ]
);

// {
//   satisfiable: true,
//   solution: { time: 14 },
//   model: {
//     time: 14,
//     person_a_available: [10, 14],
//     person_b_available: [14]
//   },
//   proof: [...]
// }
```

## Integration with Legion

### As a Tool

```javascript
// packages/tools/reasoning-tools/src/VerifiedReasoningTool.js
import { ProofOfThought } from '@legion/neurosymbolic-reasoning';
import { BaseTool } from '@legion/tool-core';

export class VerifiedReasoningTool extends BaseTool {
  async initialize() {
    const llmClient = await this.resourceManager.get('llmClient');
    this.pot = new ProofOfThought(llmClient);
  }

  async execute({ question, facts = [], constraints = [] }) {
    return await this.pot.query(question, { facts, constraints });
  }

  getSchema() {
    return {
      name: 'verified-reasoning',
      description: 'Perform neurosymbolic reasoning with formal proofs',
      parameters: {
        question: { type: 'string', required: true },
        facts: { type: 'array', items: { type: 'string' } },
        constraints: { type: 'array', items: { type: 'string' } }
      }
    };
  }
}
```

### CLI Command

```javascript
// packages/cli/src/commands/ReasonCommand.js
export class ReasonCommand {
  async execute(args) {
    const pot = new ProofOfThought(this.llmClient);

    const result = await pot.query(args.question, {
      facts: args.facts || [],
      constraints: args.constraints || []
    });

    this.output.write(`Answer: ${result.answer}\n`);
    this.output.write(`Confidence: ${result.confidence}\n\n`);
    this.output.write('Proof:\n');
    result.proof.forEach((step, i) => {
      this.output.write(`  ${i + 1}. ${step.conclusion}\n`);
    });
  }
}
```

Usage:
```bash
legion reason "Should we deploy?" \
  --constraint "tests_passing == true" \
  --constraint "coverage > 80%" \
  --prove
```

### Actor Integration

```javascript
// In any Legion actor
import { ProofOfThought } from '@legion/neurosymbolic-reasoning';

class DecisionMakingActor extends BaseActor {
  async decide(action, context) {
    const result = await this.pot.verify(
      `Action '${action}' is safe`,
      context.facts,
      this.safetyConstraints
    );

    if (!result.valid) {
      throw new Error(`Unsafe action: ${result.violations[0].reason}`);
    }

    return this.execute(action);
  }
}
```

## Technical Implementation Details

### Python to Node.js Conversion Strategy

#### 1. Z3 API Mapping

**Python**:
```python
from z3 import *
x = Int('x')
solver = Solver()
solver.add(x >= 0, x <= 10)
result = solver.check()
```

**Node.js**:
```javascript
const { init } = require('z3-solver');
const { Context } = await init();
const { Solver, Int, And } = new Context('main');
const x = Int.const('x');
const solver = new Solver();
solver.add(And(x.ge(0), x.le(10)));
const result = await solver.check();
```

**Key Differences**:
- Async initialization: `await init()`
- Method chaining: `x.ge(0)` instead of `x >= 0`
- Explicit `And()`: Can't use multiple args to `add()`
- All operations return Promises

#### 2. LLM Client Integration

**Python (OpenAI)**:
```python
client = OpenAI(api_key="...")
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}]
)
```

**Node.js (Legion)**:
```javascript
const llmClient = await resourceManager.get('llmClient');
const response = await llmClient.chat([
  { role: 'user', content: prompt }
]);
```

**Strategy**: Abstract LLM client behind interface, use ResourceManager-provided client

#### 3. Evaluation Metrics

**Python (scikit-learn)**:
```python
from sklearn.metrics import accuracy_score, precision_score
accuracy = accuracy_score(y_true, y_pred)
```

**Node.js (Custom)**:
```javascript
import { accuracyScore, precisionScore } from './utils/evaluation-metrics.js';
const accuracy = accuracyScore(yTrue, yPred);
```

**Strategy**: Implement simple metrics ourselves (50 lines of code)

#### 4. JSON Schema Validation

**Python (Pydantic)**:
```python
from pydantic import BaseModel
class Z3Program(BaseModel):
    variables: List[Variable]
    constraints: List[Constraint]
```

**Node.js (Legion Schema)**:
```javascript
import { Schema } from '@legion/schema';
const z3ProgramSchema = Schema.object({
  variables: Schema.array(variableSchema),
  constraints: Schema.array(constraintSchema)
});
```

**Strategy**: Use `@legion/schema` package (wraps Zod)

### Error Handling

All components must fail fast with clear errors:

```javascript
class ProofOfThought {
  async query(question, context) {
    if (!question || typeof question !== 'string') {
      throw new Error('Question must be a non-empty string');
    }

    let program;
    try {
      program = await this.generator.generate(question, context);
    } catch (error) {
      throw new Error(`Program generation failed: ${error.message}`);
    }

    let solution;
    try {
      solution = await this.solver.solve(program);
    } catch (error) {
      throw new Error(`Z3 solving failed: ${error.message}`);
    }

    // No fallbacks - fail fast!
    return solution;
  }
}
```

### ResourceManager Integration

**All configuration from ResourceManager**:

```javascript
class ProofOfThought {
  constructor(llmClient, options = {}) {
    this.llmClient = llmClient;  // From ResourceManager

    // Optional overrides (for testing)
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000;
  }
}

// Usage
const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('llmClient');
const pot = new ProofOfThought(llmClient);
```

**No process.env, no dotenv - everything through ResourceManager!**

### Testing Strategy

**Unit Tests**:
- Each component tested in isolation
- Mock LLM responses
- Mock Z3 solver for program generator tests
- Real Z3 for solver tests

**Integration Tests**:
- Full pipeline: question → answer + proof
- Real LLM client (from ResourceManager)
- Real Z3 solver
- Real-world reasoning examples
- No mocks except for external APIs

**Example Integration Test**:
```javascript
test('should solve simple constraint problem', async () => {
  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');
  const pot = new ProofOfThought(llmClient);

  const result = await pot.query(
    'Is there a number greater than 5 and less than 10?',
    {
      constraints: ['x > 5', 'x < 10'],
      variables: [{ name: 'x', type: 'Int' }]
    }
  );

  expect(result.answer).toBe('Yes');
  expect(result.proof).toBeTruthy();
  expect(result.proof.length).toBeGreaterThan(0);
});
```

## Data Structures

### Z3 Program

```javascript
{
  variables: [
    { name: 'x', sort: 'Int' },
    { name: 'active', sort: 'Bool' },
    { name: 'price', sort: 'Real' }
  ],

  constraints: [
    { type: 'ge', args: ['x', 0] },
    { type: 'le', args: ['x', 100] },
    { type: 'and', args: [
      { type: 'eq', args: ['active', true] },
      { type: 'gt', args: ['price', 0] }
    ]}
  ],

  assertions: [
    { expression: { type: 'implies', args: [...] } }
  ],

  query: {
    type: 'check-sat',
    goal: 'find value of x'
  }
}
```

### Result Structure

```javascript
{
  answer: 'Yes' | 'No' | <value>,

  confidence: 0.95,  // 0-1

  satisfiable: true | false,

  solution: { x: 42, active: true },

  proof: [
    {
      step: 1,
      type: 'fact' | 'rule' | 'constraint' | 'conclusion',
      description: 'x > 5 (given)',
      satisfied: true
    },
    {
      step: 2,
      type: 'constraint',
      description: 'x < 10 (given)',
      satisfied: true
    },
    {
      step: 3,
      type: 'conclusion',
      description: 'x ∈ {6, 7, 8, 9} satisfies all constraints'
    }
  ],

  explanation: 'There exists a number between 5 and 10...',

  violations: [
    { constraint: 'x < 5', reason: 'x = 7 violates x < 5' }
  ]
}
```

### Prompt Context

```javascript
{
  question: 'Should we deploy?',

  facts: [
    'tests_passing = true',
    'coverage = 85',
    'last_deploy = 2_hours_ago'
  ],

  constraints: [
    'tests_passing == true',
    'coverage >= 80',
    'last_deploy > 1_hour_ago'
  ],

  examples: [
    { question: '...', program: {...} }
  ],

  schema: z3ProgramSchema
}
```

## Dependencies

### Required

- `z3-solver` (^4.15.3) - Z3 theorem prover WASM bindings
- `@legion/resource-manager` - Configuration and LLM client
- `@legion/schema` - JSON schema validation

### Optional

- `@legion/tool-core` - For creating tools
- `@legion/prompt-manager` - For LLM prompts

### Dev Dependencies

- `jest` - Testing
- `@types/node` - TypeScript types

## Constraints and Limitations

### Z3 Solver Limitations

1. **WASM Threading**: Requires SharedArrayBuffer support (Node 16+)
2. **Array Expressions**: Limited array operation support in JS bindings
3. **Proof Generation**: Some Z3 features not exposed in WASM API
4. **Performance**: WASM slower than native Z3 (~2-3x)

### LLM Limitations

1. **Program Quality**: LLM may generate invalid Z3 programs
2. **Retry Logic**: Need multiple attempts for complex questions
3. **Token Limits**: Large constraint sets may exceed context window
4. **Cost**: Each query requires LLM API call

### MVP Scope

**Included**:
- Basic constraint solving (Int, Bool, Real)
- Simple logical operations (and, or, not, implies)
- Proof extraction and verification
- Natural language query interface

**Not Included** (future):
- Complex array operations
- Quantifiers (forall, exists)
- Uninterpreted functions
- Optimization (maximize, minimize)
- Incremental solving
- Proof caching

## Success Criteria

### Functional

1. **Solve simple constraint problems**: x > 5 and x < 10
2. **Verify logical claims**: Transaction amount <= user balance
3. **Extract proof chains**: Step-by-step reasoning
4. **Handle errors gracefully**: Invalid programs, unsatisfiable constraints
5. **Integrate with Legion**: Work with ResourceManager, ToolRegistry

### Quality

1. **Test Coverage**: 100% unit tests passing, integration tests with real LLM/Z3
2. **Error Messages**: Clear, actionable error messages
3. **API Consistency**: Follows Legion patterns (async, ResourceManager, fail-fast)
4. **Documentation**: API docs, examples, integration guide

### Performance

1. **Simple Queries**: < 5 seconds (LLM + Z3)
2. **Complex Queries**: < 30 seconds
3. **Memory**: < 100MB for typical usage

---

**Document Version**: 1.0
**Last Updated**: 2025-10-04
**Status**: Draft - Ready for Review
