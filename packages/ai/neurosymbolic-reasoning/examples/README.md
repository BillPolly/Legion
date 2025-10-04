# ProofOfThought Examples

This directory contains examples demonstrating how to use the neurosymbolic reasoning system for various use cases.

## Overview

ProofOfThought combines Large Language Models (LLMs) with formal theorem proving (Z3) to provide:
- **Verifiable reasoning** with formal proofs
- **Logical consistency** through constraint satisfaction
- **Explainable decisions** with step-by-step proof chains
- **Safety guarantees** for critical applications

## Examples

### 01 - Simple Usage
**File:** `01-simple-usage.js`
**Purpose:** Basic introduction to ProofOfThought API
**Demonstrates:**
- Initializing ProofOfThought with ResourceManager
- Asking natural language questions
- Getting answers with formal proofs
- Understanding result structure

**Run:**
```bash
cd packages/ai/neurosymbolic-reasoning
node examples/01-simple-usage.js
```

**Key Concepts:**
- LLM generates Z3 program from question
- Z3 solver finds satisfying assignment
- Proof extractor creates human-readable explanation

---

### 02 - Constraint Verification
**File:** `02-constraint-verification.js`
**Purpose:** Verify claims against facts and constraints
**Demonstrates:**
- Deployment safety checks
- Transaction validation
- Constraint violation detection
- Using `verify()` method

**Run:**
```bash
node examples/02-constraint-verification.js
```

**Use Cases:**
- Pre-deployment validation
- Financial transaction approval
- Security policy enforcement
- Regulatory compliance checking

---

### 03 - Decision Making Actor
**File:** `03-decision-making.js`
**Purpose:** Actor-based decision making with safety constraints
**Demonstrates:**
- DecisionMakingActor pattern
- Safety constraint enforcement
- Risk assessment
- Actor integration with ProofOfThought

**Run:**
```bash
node examples/03-decision-making.js
```

**Key Features:**
- Formal proof-based decisions
- Safety constraint validation
- Risk scoring (low/medium/high)
- Explainable decision chains

---

### 04 - StrategyQA Questions
**File:** `04-strategyqa-questions.js`
**Purpose:** Complex multi-step reasoning questions
**Demonstrates:**
- Handling world knowledge questions
- Multi-step logical inference
- Boolean yes/no reasoning with proof
- StrategyQA benchmark questions

**Run:**
```bash
node examples/04-strategyqa-questions.js
```

**Sample Questions:**
- "Are more people today related to Genghis Khan than Julius Caesar?"
- "Could the members of The Police perform lawful arrests?"
- "Would a dog respond to bell before Grey seal?"

**Evaluation:**
- Accuracy tracking
- Confidence scores
- Performance timing
- Proof validation

---

### 05 - Batch Evaluation
**File:** `05-batch-evaluation.js`
**Purpose:** Process multiple questions and compute metrics
**Demonstrates:**
- Batch question processing
- Accuracy, precision, recall, F1 metrics
- Error handling for failed queries
- Performance benchmarking

**Run:**
```bash
node examples/05-batch-evaluation.js
```

**Metrics Calculated:**
- Accuracy: % correct answers
- Precision: True positive rate
- Recall: Coverage of positive cases
- F1 Score: Harmonic mean of precision/recall
- Average processing time

---

### 06 - CLI Integration
**File:** `06-cli-integration.js`
**Purpose:** Using ProofOfThought from Legion CLI
**Demonstrates:**
- `/reason` CLI command usage
- Passing facts via `--fact` flags
- Passing constraints via `--constraint` flags
- Formatted CLI output

**Run:**
```bash
node examples/06-cli-integration.js
```

**CLI Commands:**
```bash
# Simple query
legion /reason "Is there a number greater than 5?"

# With constraints
legion /reason "Should we deploy?" \
  --constraint "tests_passing == true" \
  --constraint "coverage > 80"

# With facts
legion /reason "Is deployment safe?" \
  --fact "tests_passing = true" \
  --fact "coverage = 85"

# Combined
legion /reason "Can we proceed?" \
  --fact "status = ready" \
  --constraint "status == ready"
```

---

### DecisionMakingActor
**File:** `DecisionMakingActor.js`
**Purpose:** Example actor for safety-critical decisions
**Demonstrates:**
- Actor pattern with ProofOfThought
- Safety constraint definition
- Risk evaluation methods
- Decision explanation generation

**Usage:**
```javascript
import { DecisionMakingActor } from './examples/DecisionMakingActor.js';

const actor = new DecisionMakingActor(resourceManager);

// Make a decision
const result = await actor.decide('deploy', {
  facts: ['tests_passing = true', 'coverage = 95']
});

console.log(result.allowed);    // true/false
console.log(result.explanation); // Human-readable reason

// Evaluate risk
const risk = await actor.evaluateRisk(['tests_passing = false']);
console.log(risk.level); // 'low', 'medium', 'high'
console.log(risk.score); // 0-1
```

---

## Common Patterns

### Basic Query
```javascript
import { ProofOfThought } from '@legion/neurosymbolic-reasoning';
import { ResourceManager } from '@legion/resource-manager';

const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('llmClient');
const pot = new ProofOfThought(llmClient);

const result = await pot.query("Your question here");
console.log(result.answer);  // Yes/No or value
console.log(result.proof);   // Proof chain
```

### Verification
```javascript
const result = await pot.verify(
  "Claim to verify",
  ["fact1 = value1", "fact2 = value2"],
  ["constraint1 > 10", "constraint2 == true"]
);

if (!result.valid) {
  console.log("Violations:", result.violations);
}
```

### Constraint Solving
```javascript
const result = await pot.solve(
  "Find valid meeting time",
  ["time >= 9", "time <= 17"],
  ["person_a_available(14) = true"]
);

console.log(result.solution); // { time: 14 }
console.log(result.satisfiable); // true/false
```

---

## Running Examples

### Prerequisites
- ResourceManager configured with LLM client
- Z3 solver installed (via `z3-solver` npm package)
- All dependencies installed: `npm install`

### Run Individual Example
```bash
cd packages/ai/neurosymbolic-reasoning
node examples/01-simple-usage.js
node examples/02-constraint-verification.js
# etc.
```

### Run All Examples
```bash
npm run examples
```

---

## Understanding Results

### Result Structure
All query/verify/solve methods return structured results:

```javascript
{
  answer: 'Yes' | 'No' | <value>,
  proof: [
    { step: 1, description: "x > 5 (given)", satisfied: true },
    { step: 2, description: "x < 10 (given)", satisfied: true },
    { step: 3, description: "x ∈ {6,7,8,9} satisfies all constraints" }
  ],
  confidence: 0.95,          // 0-1
  explanation: "...",        // Human-readable
  model: { x: 7, y: true },  // Variable assignments
  satisfiable: true,         // For solve()
  valid: true,               // For verify()
  violations: []             // For verify()
}
```

### Confidence Scores
- **0.95**: High confidence (SAT result)
- **0.90**: Medium confidence (UNSAT result)
- **< 0.90**: Lower confidence (may need more attempts)

### Proof Chain
Each proof step contains:
- `step`: Sequential number
- `type`: 'fact' | 'rule' | 'constraint' | 'conclusion'
- `description`: Human-readable explanation
- `satisfied`: true/false (for constraints)

---

## Troubleshooting

### Common Errors

**"LLM client is required"**
- Ensure ResourceManager is initialized
- Check LLM client configuration

**"Failed to generate program"**
- LLM may have produced invalid Z3 JSON
- Check question clarity
- Review error feedback in logs

**"Z3 solving failed"**
- Constraints may be unsatisfiable
- Check constraint syntax
- Verify variable types (Int/Bool/Real)

### Performance Tips

1. **Batch Processing**: Use batch evaluation for multiple questions
2. **Caching**: Consider caching generated programs (future feature)
3. **Timeout**: Adjust `timeout` option for complex queries
4. **Retries**: Use `maxRetries` option for LLM generation

### Debugging

Enable verbose logging:
```javascript
const pot = new ProofOfThought(llmClient, {
  maxRetries: 5,
  timeout: 60000,
  verbose: true  // If implemented
});
```

---

## Integration Patterns

### With Legion Actors
```javascript
class MyActor extends BaseActor {
  async initialize() {
    const llmClient = await this.resourceManager.get('llmClient');
    this.pot = new ProofOfThought(llmClient);
  }

  async decide(action, context) {
    return await this.pot.verify(
      `Action ${action} is safe`,
      context.facts,
      this.constraints
    );
  }
}
```

### With Legion Tools
```javascript
class ReasoningTool extends BaseTool {
  async execute({ question, facts, constraints }) {
    const llmClient = await this.resourceManager.get('llmClient');
    const pot = new ProofOfThought(llmClient);
    return await pot.query(question, { facts, constraints });
  }
}
```

### With CLI Commands
See `06-cli-integration.js` for complete CLI integration example.

---

## Next Steps

1. **Read DESIGN.md**: Understand the architecture
2. **Run Examples**: Try all examples in order
3. **Modify Examples**: Experiment with your own questions
4. **Integrate**: Add ProofOfThought to your actors/tools
5. **Test**: Write tests for your use cases

---

## Additional Resources

- **Design Document**: `../docs/DESIGN.md`
- **API Documentation**: `../README.md`
- **Implementation Plan**: `../docs/IMPLEMENTATION-PLAN.md`
- **Test Suite**: `../__tests__/`

---

## Questions?

For issues or questions:
1. Check the test suite for additional examples
2. Review DESIGN.md for architectural details
3. Examine implementation code in `../src/`
4. Run examples with debug logging

---

**Original ProofOfThought**: https://github.com/DebarghaG/proofofthought
**Legion Framework**: https://github.com/yourusername/legion
