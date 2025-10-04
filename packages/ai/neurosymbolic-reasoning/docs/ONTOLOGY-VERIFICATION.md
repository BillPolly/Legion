# Ontology Verification with Z3 Theorem Proving

## Overview

The Legion neurosymbolic-reasoning package now includes **formal ontology verification** using the Z3 theorem prover. This provides mathematical guarantees that ontologies built incrementally by the OntologyBuilder are logically consistent.

## What It Does

The OntologyVerifier formally verifies:

1. **Logical Consistency** - The ontology has no contradictions
2. **Disjointness Constraints** - Classes declared disjoint have no overlapping instances
3. **Subsumption Hierarchy** - Class hierarchies are properly structured
4. **Domain/Range Constraints** - Properties respect their domain and range restrictions
5. **Incremental Extensions** - New additions don't violate existing axioms

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    OntologyBuilder                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │         OntologyVerificationService                │    │
│  │  - verifyBootstrap()                               │    │
│  │  - verifyBeforeExtension()                         │    │
│  │  - verifyAfterExtension()                          │    │
│  │  - retryWithFeedback()                             │    │
│  └─────────────────┬──────────────────────────────────┘    │
└────────────────────┼──────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              OntologyVerifier                               │
│  - verifyConsistency(triples)                               │
│  - checkAddition(existing, new)                             │
│  - verifyDisjoint(classA, classB, instances)                │
│  - verifyDomainRange(property, domain, range, instances)    │
│  - getProof(triples)                                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         Z3DescriptionLogicSolver                            │
│  - Uninterpreted sorts for entity domains                   │
│  - Uninterpreted functions for concepts/relationships       │
│  - Quantifiers (∀ ForAll, ∃ Exists)                         │
│  - Boolean constraints                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              OWLAxiomEncoder                                │
│  Encodes OWL/RDF axioms to Z3 constraints:                  │
│  - owl:disjointWith → ∀x. ¬(A(x) ∧ B(x))                   │
│  - rdfs:subClassOf → ∀x. A(x) → B(x)                       │
│  - rdfs:domain → ∀x,y. P(x,y) → Domain(x)                  │
│  - rdfs:range → ∀x,y. P(x,y) → Range(y)                    │
└─────────────────────────────────────────────────────────────┘
```

### Verification Checkpoints

The OntologyBuilder has 3 verification checkpoints:

1. **Bootstrap Verification** (`verifyBootstrap()`)
   - Runs after loading upper-level ontology
   - Verifies foundational axioms are consistent
   - Ensures base categories (Continuant/Occurrent) are properly defined

2. **Pre-Extension Verification** (`verifyBeforeExtension()`)
   - Runs before adding LLM-generated extensions
   - Checks if new triples would violate existing axioms
   - Prevents inconsistent additions

3. **Post-Extension Verification** (`verifyAfterExtension()`)
   - Runs after successfully adding extensions
   - Confirms ontology remains consistent
   - Detects any unexpected interactions

## How It Works

### 1. Description Logic Encoding

OWL axioms are encoded as first-order logic constraints in Z3:

**Disjointness**: Classes A and B are disjoint if no entity can be both
```
∀x. ¬(A(x) ∧ B(x))
```

**Subsumption**: A is a subclass of B if all instances of A are instances of B
```
∀x. A(x) → B(x)
```

**Domain Constraint**: Property P has domain D if all subjects are in D
```
∀x,y. P(x,y) → D(x)
```

**Range Constraint**: Property P has range R if all objects are in R
```
∀x,y. P(x,y) → R(y)
```

### 2. Z3 Verification Process

```javascript
// 1. Initialize solver and encoder
const verifier = new OntologyVerifier();
await verifier.initialize();

// 2. Encode triples to Z3 constraints
const axioms = encoder.encodeTriples([
  ['kg:PhysicalEntity', 'owl:disjointWith', 'kg:State'],
  ['kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity'],
  // ... more triples
]);

// 3. Add constraints to Z3 solver
const z3Solver = solver.createSolver();
for (const axiom of axioms) {
  z3Solver.add(axiom);
}

// 4. Check satisfiability
const result = await z3Solver.check();
// 'sat' = consistent, 'unsat' = contradictory
```

### 3. LLM Retry with Z3 Feedback

When the LLM generates an invalid extension, the verifier provides feedback:

```javascript
async retryWithFeedback(generationFn, maxRetries = 3) {
  let lastViolations = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // LLM generates extension with feedback from previous attempt
    const result = await generationFn(lastViolations);

    // Verify with Z3
    const verification = await this.verifyBeforeExtension(result.triples);

    if (verification.valid) {
      return result;  // Success!
    }

    // Prepare feedback for next attempt
    lastViolations = verification.violations;
  }

  throw new Error('Failed to generate valid extension');
}
```

## Usage

### Basic Verification

```javascript
import { OntologyVerifier } from '@legion/neurosymbolic-reasoning';

const verifier = new OntologyVerifier();
await verifier.initialize();

// Verify ontology triples
const triples = [
  ['kg:Continuant', 'rdf:type', 'owl:Class'],
  ['kg:Occurrent', 'rdf:type', 'owl:Class'],
  ['kg:Continuant', 'owl:disjointWith', 'kg:Occurrent'],
  ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant'],
  ['kg:Process', 'rdfs:subClassOf', 'kg:Occurrent']
];

const result = await verifier.verifyConsistency(triples);

if (result.consistent) {
  console.log('✅ Ontology is logically consistent');
} else {
  console.log('❌ Violations found:', result.violations);
}
```

### Check Before Adding Extensions

```javascript
const existingTriples = [/* existing ontology */];
const newTriples = [
  ['kg:Pump', 'rdf:type', 'owl:Class'],
  ['kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity']
];

const result = await verifier.checkAddition(existingTriples, newTriples);

if (result.valid) {
  // Safe to add
  await tripleStore.addAll(newTriples);
} else {
  console.warn('Cannot add - would violate:', result.violations);
}
```

### Integration with OntologyBuilder

```javascript
import { OntologyBuilder } from '@legion/ontology';

const builder = new OntologyBuilder({
  tripleStore,
  semanticSearch,
  llmClient,
  verification: {
    enabled: true,                    // Enable verification
    verifyBootstrap: true,            // Verify on bootstrap
    verifyAfterExtension: true,       // Verify after each extension
    failOnViolation: false            // Log warnings instead of failing
  }
});

// Process text with formal guarantees
const result = await builder.processText(
  'A pump is a device that moves fluids. A centrifugal pump is a type of pump.',
  { domain: 'plumbing' }
);

console.log('Verification Stats:', result.verificationStats);
// {
//   enabled: true,
//   verificationsRun: 2,
//   violationsDetected: 0,
//   violationsPrevented: 0
// }
```

## Examples

### Example 1: Detecting Disjointness Violations

```javascript
const triples = [
  ['kg:PhysicalEntity', 'rdf:type', 'owl:Class'],
  ['kg:State', 'rdf:type', 'owl:Class'],
  ['kg:PhysicalEntity', 'owl:disjointWith', 'kg:State'],

  // This violates disjointness!
  ['kg:Pump', 'rdf:type', 'kg:PhysicalEntity'],
  ['kg:Pump', 'rdf:type', 'kg:State']
];

const result = await verifier.verifyConsistency(triples);
// result.consistent = false
// result.violations = ['kg:Pump cannot be both PhysicalEntity and State (disjoint)']
```

### Example 2: Verifying Subsumption Hierarchy

```javascript
const triples = [
  ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant'],
  ['kg:Pump', 'rdfs:subClassOf', 'kg:PhysicalEntity'],
  ['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Pump'],

  // Verify transitivity: CentrifugalPump ⊆ Continuant
  ['kg:CentrifugalPump', 'rdfs:subClassOf', 'kg:Continuant']
];

const result = await verifier.verifyConsistency(triples);
// result.consistent = true (Z3 proves transitive subsumption)
```

### Example 3: Domain/Range Constraints

```javascript
const property = 'kg:moves';
const domain = 'kg:Pump';
const range = 'kg:Fluid';

const instances = [
  ['kg:Pump1', 'rdf:type', 'kg:Pump'],
  ['kg:Water', 'rdf:type', 'kg:Fluid'],
  ['kg:Pump1', 'kg:moves', 'kg:Water']  // Valid
];

const result = await verifier.verifyDomainRange(property, domain, range, instances);
// result.valid = true

// This would fail:
const badInstances = [
  ['kg:Valve', 'rdf:type', 'kg:Valve'],  // Not a Pump!
  ['kg:Water', 'rdf:type', 'kg:Fluid'],
  ['kg:Valve', 'kg:moves', 'kg:Water']   // Violates domain
];

const badResult = await verifier.verifyDomainRange(property, domain, range, badInstances);
// badResult.valid = false
```

## Test Coverage

### Unit Tests (23 tests)
- Basic consistency checking
- Disjoint class verification
- Subsumption hierarchy validation
- Domain/range constraints
- Empty class handling
- Proof generation

### Integration Tests (11 tests)
- Bootstrap ontology verification with real data from @legion/ontology
- Instance validation against disjointness constraints
- Incremental addition checking
- Domain/range verification with relationships
- Multi-step ontology building simulation

**Total: 34 tests, all passing** ✅

## Configuration Options

### OntologyVerificationService Config

```javascript
{
  enabled: true,                    // Enable/disable verification
  verifyBootstrap: true,            // Verify after loading bootstrap
  verifyBeforeExtension: true,      // Verify before adding extensions
  verifyAfterExtension: true,       // Verify after adding extensions
  failOnViolation: true             // Throw error on violation (vs warn)
}
```

### Statistics Tracking

The verification service tracks:
- `verificationsRun` - Total number of verifications performed
- `violationsDetected` - Total violations found
- `violationsPrevented` - Extensions blocked due to violations

## Performance Considerations

- **Z3 is fast**: Most verifications complete in < 100ms
- **Incremental verification**: Only checks new additions, not entire ontology
- **Caching**: Solver instances are reused when possible
- **Async operations**: All verification is non-blocking

## Supported OWL Axioms

Currently supported:
- ✅ `rdf:type` (class membership)
- ✅ `owl:Class` (class declaration)
- ✅ `rdfs:subClassOf` (subsumption)
- ✅ `owl:disjointWith` (disjointness)
- ✅ `rdfs:domain` (property domain)
- ✅ `rdfs:range` (property range)
- ✅ `owl:ObjectProperty` (relationships)
- ✅ `owl:DatatypeProperty` (attributes)

Future support:
- ⏳ `owl:equivalentClass`
- ⏳ `owl:inverseOf`
- ⏳ `owl:TransitiveProperty`
- ⏳ `owl:FunctionalProperty`

## Error Handling

The verifier provides detailed error messages:

```javascript
try {
  await verifier.verifyConsistency(triples);
} catch (error) {
  if (error.message.includes('disjoint')) {
    // Handle disjointness violation
  } else if (error.message.includes('domain')) {
    // Handle domain violation
  }
}
```

## Debugging

### Get Detailed Proof

```javascript
const result = await verifier.getProof(triples);

if (result.consistent) {
  console.log('Proof:', result.proof);
  // Outputs: "SAT\n(model...)"
} else {
  console.log('Counterexample:', result.proof);
  // Outputs: "UNSAT\nCore: ..."
}
```

### Violation Analysis

When verification fails, the verifier analyzes which axioms are in conflict:

```javascript
const result = await verifier.verifyConsistency(badTriples);

for (const violation of result.violations) {
  console.log('Violation:', violation);
  // "Entity X is both PhysicalEntity and State (disjoint classes)"
}
```

## Implementation Files

- `/src/solvers/Z3DescriptionLogicSolver.js` - Description logic solver
- `/src/ontology/OWLAxiomEncoder.js` - OWL to Z3 encoding
- `/src/ontology/OntologyVerifier.js` - Main verification API
- `/packages/km/ontology/src/services/OntologyVerificationService.js` - OntologyBuilder integration

## References

- [Z3 Theorem Prover](https://github.com/Z3Prover/z3)
- [Description Logic ALC](https://en.wikipedia.org/wiki/Description_logic)
- [OWL Web Ontology Language](https://www.w3.org/TR/owl2-overview/)
- [Basic Formal Ontology](https://basic-formal-ontology.org/)

## License

MIT
