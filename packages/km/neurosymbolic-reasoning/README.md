# @legion/neurosymbolic-reasoning

Neurosymbolic reasoning for Legion - combining neural (LLM) and symbolic (Z3 theorem proving) approaches for verified AI reasoning.

## Features

### 1. ProofOfThought: LLM + Z3 Integration

Natural language reasoning verified with formal logic:

```javascript
import { ProofOfThought } from '@legion/neurosymbolic-reasoning';

const pot = new ProofOfThought({ llmClient });
await pot.initialize();

const result = await pot.verify(
  'If it rains, the ground gets wet. It is raining. Is the ground wet?',
  ['It is raining', 'If it rains, the ground gets wet'],
  []
);

console.log(result.valid);  // true
console.log(result.proof);  // "Given: It is raining\nGiven: If it rains..."
```

### 2. Ontology Verification with Z3

Formal verification of OWL/RDF ontologies:

```javascript
import { OntologyVerifier } from '@legion/neurosymbolic-reasoning';

const verifier = new OntologyVerifier();
await verifier.initialize();

const triples = [
  ['kg:PhysicalEntity', 'owl:disjointWith', 'kg:State'],
  ['kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity']
];

const result = await verifier.verifyConsistency(triples);

if (result.consistent) {
  console.log('✅ Ontology is logically consistent');
} else {
  console.log('❌ Violations:', result.violations);
}
```

**Key Capabilities:**
- ✅ Disjointness constraint verification
- ✅ Subsumption hierarchy validation
- ✅ Domain/range constraint checking
- ✅ Incremental extension verification
- ✅ Proof generation and violation analysis

[📚 Full Ontology Verification Documentation](./docs/ONTOLOGY-VERIFICATION.md)

### 3. Z3 Theorem Proving

Low-level access to Z3 solver:

```javascript
import { Z3Solver, Z3DescriptionLogicSolver } from '@legion/neurosymbolic-reasoning';

// Basic constraints
const solver = new Z3Solver();
await solver.initialize();

const x = solver.Int('x');
const y = solver.Int('y');
solver.assert(solver.Gt(x, 0));
solver.assert(solver.Lt(y, 10));
solver.assert(solver.Eq(solver.Add(x, y), 15));

const result = await solver.solve();
console.log(result.satisfiable);  // true
console.log(result.model);        // { x: 6, y: 9 }

// Description logic (for ontologies)
const dlSolver = new Z3DescriptionLogicSolver();
await dlSolver.initialize();

const entitySort = dlSolver.declareSort('Entity');
const Pump = dlSolver.declareConcept('Pump', entitySort);
const PhysicalEntity = dlSolver.declareConcept('PhysicalEntity', entitySort);

// ∀x. Pump(x) → PhysicalEntity(x)
const x = dlSolver.createConst('x', entitySort);
const axiom = dlSolver.forall([x],
  dlSolver.Or(dlSolver.Not(Pump(x)), PhysicalEntity(x))
);

const z3Solver = dlSolver.createSolver();
z3Solver.add(axiom);

const result = await z3Solver.check();  // 'sat'
```

## Installation

```bash
npm install @legion/neurosymbolic-reasoning
```

## Quick Start

### ProofOfThought for Natural Language Reasoning

```javascript
import { ProofOfThought } from '@legion/neurosymbolic-reasoning';
import { ResourceManager } from '@legion/resource-manager';

const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('llmClient');

const pot = new ProofOfThought({ llmClient });
await pot.initialize();

// Verify a claim
const result = await pot.verify(
  'Socrates is mortal',
  ['Socrates is a man', 'All men are mortal'],
  []
);

console.log(result.valid);  // true
console.log(result.proof);  // Natural language + Z3 proof
```

### Ontology Verification in OntologyBuilder

```javascript
import { OntologyBuilder } from '@legion/ontology';

const builder = new OntologyBuilder({
  tripleStore,
  semanticSearch,
  llmClient,
  verification: {
    enabled: true,
    verifyBootstrap: true,
    verifyAfterExtension: true
  }
});

const result = await builder.processText(
  'A pump is a device that moves fluids.',
  { domain: 'plumbing' }
);

console.log(result.verificationStats);
// {
//   verificationsRun: 2,
//   violationsDetected: 0,
//   violationsPrevented: 0
// }
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  ProofOfThought                             │
│  - Natural language to Z3 constraint translation (via LLM)  │
│  - Formal verification of reasoning                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              OntologyVerifier                               │
│  - OWL/RDF axiom verification                               │
│  - Consistency checking                                     │
│  - Incremental extension validation                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         Z3DescriptionLogicSolver                            │
│  - Uninterpreted sorts & functions                          │
│  - Quantifiers (∀, ∃)                                       │
│  - Boolean constraints                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Z3Solver                                  │
│  - Low-level Z3 API wrapper                                 │
│  - Integer, boolean, real constraints                       │
└─────────────────────────────────────────────────────────────┘
```

## Use Cases

### 1. Verified AI Reasoning
Combine LLM flexibility with formal guarantees:
- ✅ Fact-checking with proof generation
- ✅ Logical consistency verification
- ✅ Constraint satisfaction problems

### 2. Knowledge Graph Validation
Ensure ontologies are logically sound:
- ✅ Prevent contradictory axioms
- ✅ Validate class hierarchies
- ✅ Check property constraints

### 3. Planning and Decision Making
Formal verification of agent decisions:
- ✅ Constraint-based planning
- ✅ Invariant checking
- ✅ Safety verification

## Examples

See the `/examples` directory for complete examples:

- `01-simple-usage.js` - Basic ProofOfThought usage
- `02-constraint-verification.js` - Constraint solving
- `03-decision-making.js` - Agent decision verification
- `04-strategyqa-questions.js` - Multi-step reasoning
- `05-batch-evaluation.js` - Batch verification
- `06-cli-integration.js` - CLI tool integration
- `ontology-validation/01-bootstrap-validation.js` - Ontology verification with ProofOfThought
- `ontology-validation/02-z3-dl-encoding.js` - Direct Z3 encoding without LLM
- `ontology-validation/03-integration-with-ontology-builder.js` - Full OntologyBuilder integration

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

**Test Coverage:**
- 286 unit tests (all passing)
- 11 integration tests with real Z3 and RDF data
- 6 OntologyBuilder integration tests

## API Reference

### ProofOfThought

```javascript
const pot = new ProofOfThought({ llmClient });
await pot.initialize();

// Verify a claim
await pot.verify(claim, facts, constraints);

// Query for answer
await pot.query(question, context);

// Solve with constraints
await pot.solve(goal, constraints);
```

### OntologyVerifier

```javascript
const verifier = new OntologyVerifier();
await verifier.initialize();

// Check consistency
await verifier.verifyConsistency(triples);

// Check before adding
await verifier.checkAddition(existingTriples, newTriples);

// Verify disjointness
await verifier.verifyDisjoint(classA, classB, instances);

// Verify domain/range
await verifier.verifyDomainRange(property, domain, range, instances);

// Get detailed proof
await verifier.getProof(triples);
```

### Z3Solver

```javascript
const solver = new Z3Solver();
await solver.initialize();

// Create variables
const x = solver.Int('x');
const y = solver.Bool('y');

// Add constraints
solver.assert(solver.Gt(x, 0));
solver.assert(y);

// Solve
const result = await solver.solve();
```

### Z3DescriptionLogicSolver

```javascript
const dlSolver = new Z3DescriptionLogicSolver();
await dlSolver.initialize();

// Declare sorts
const entitySort = dlSolver.declareSort('Entity');

// Declare concepts (unary predicates)
const Pump = dlSolver.declareConcept('Pump', entitySort);

// Declare relations (binary predicates)
const moves = dlSolver.declareRelation('moves', entitySort, entitySort);

// Use quantifiers
const x = dlSolver.createConst('x', entitySort);
const axiom = dlSolver.forall([x], ...);
```

## Performance

- **Z3 is fast**: Most verifications < 100ms
- **Async by default**: Non-blocking operations
- **Reusable solvers**: Solver instances are cached
- **Incremental verification**: Only checks deltas, not full ontology

## Dependencies

- `z3-solver` - Z3 theorem prover bindings for Node.js
- `@legion/resource-manager` - Configuration and resource management
- `@legion/schema` - JSON schema validation

## License

MIT

## Contributing

See the main [Legion repository](https://github.com/maxximus-dev/Legion) for contribution guidelines.
