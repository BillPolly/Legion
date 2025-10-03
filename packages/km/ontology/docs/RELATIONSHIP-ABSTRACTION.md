# Relationship Abstraction Feature

## Overview

The ontology system now supports **dynamic relationship abstraction**, automatically creating intermediate parent relationships to organize semantically similar object properties into hierarchies - just like it does for classes.

**Key Capabilities:**
- ✅ Automatically groups relationships by semantic similarity
- ✅ Creates multiple distinct abstraction hierarchies (e.g., "performs" for worker actions, "conveys" for flow)
- ✅ Uses mathematical subsumption constraints to ensure correctness
- ✅ LLM makes final abstraction decisions from valid options
- ✅ Supports nested abstractions (e.g., qualityControl → performs → relatesTo)

**Demo:** Run the enhanced plumbing demonstration to see relationship abstraction in action:
```bash
NODE_OPTIONS='--experimental-vm-modules' node __tests__/tmp/demo-plumbing-walkthrough.js
```

The demo builds an ontology from 10 sentences and creates 2 relationship abstraction layers with 7 relationships organized under semantic supertypes.

## How It Works

### Two-Phase Approach

1. **Phase 1: Mathematical Filter**
   - Filters relationships for subsumption compatibility using domain hierarchy matching
   - Ensures any proposed parent satisfies: `domain_child ⊆ domain_parent`
   - Uses relaxed compatibility (domain-only) to allow grouping relationships with sibling ranges

2. **Phase 2: LLM Decision**
   - LLM analyzes compatible relationships and chooses abstraction strategy:
     - `USE_EXISTING`: Use an existing parent relationship
     - `CREATE_PARENT`: Create a new intermediate parent relationship
   - LLM recognizes semantic patterns (worker actions, spatial relations, tool usage, etc.)

### Lowest Common Ancestor (LCA)

When creating a parent relationship, the system calculates the **Lowest Common Ancestor** of all child ranges to determine the parent's broadened range. This ensures the parent can accommodate all its children.

**Example:**
- `repairs (Plumber → Faucet)` and `installs (Plumber → Pipe)` can share a parent
- LCA of Faucet and Pipe = PlumbingComponent
- Parent created: `performs (Plumber → PlumbingComponent)`

## Example: Plumbing Domain

The plumbing demo demonstrates relationship abstraction in action:

### Sentence 4: "The plumber repairs the leaking bathroom faucet"
```
🔍 Found 1 compatible relationships for repairs (Plumber → Faucet):
    installs (kg:Plumber → kg:Pipe)

🔨 Creating intermediate relationship parent: performs
✅ Created: kg:performs → kg:relatesTo (kg:Plumber → owl:Thing)
```

### Sentence 5: "The apprentice plumber clears the clogged kitchen drain"
```
🔍 Found 3 compatible relationships for clears (Plumber → Drain):
    installs (kg:Plumber → kg:Pipe)
    performs (kg:Plumber → owl:Thing)
    repairs (kg:Plumber → kg:Faucet)

✅ Using existing parent: kg:performs
```

### Final Relationship Hierarchy (Enhanced Demo with 10 Sentences)
```
kg:relatesTo (domain: owl:Thing, range: owl:Thing)
├─ installs (kg:Plumber → kg:Pipe)
├─ installedIn (kg:Pipe → kg:Wall)
├─ connectsTo (kg:PEXPipe → kg:GasWaterHeater)
├─ performs (kg:Plumber → owl:Thing)          ← Abstraction #1: Worker Actions
│  ├─ repairs (kg:Plumber → kg:Faucet)
│  ├─ clears (kg:Plumber → kg:KitchenDrain)
│  ├─ usesTool (kg:Plumber → kg:DrainSnake)
│  ├─ inspects (kg:Plumber → kg:Installation)
│  └─ maintains (kg:Plumber → kg:WaterHeater)
├─ conveys (kg:Pipe → owl:Thing)              ← Abstraction #2: Flow/Transport
│  ├─ deliversTo (kg:Pipe → kg:Fixture)
│  ├─ transports (kg:Pipe → kg:Fluid)
│  └─ channelsTo (kg:Pipe → kg:SewerSystem)
├─ locatedIn (kg:Faucet → kg:Bathroom)
├─ tightens (kg:PipeWrench → kg:PipeConnection)
└─ hasConnection (kg:ThreadedPipe → kg:PipeConnection)
```

**Statistics:**
- Total relationships: 16
- Direct children of kg:relatesTo: 9
- Grouped under abstractions: 7
- Abstraction layers created: 2

**Key Achievement:** The system automatically recognized two distinct semantic patterns:
1. **Worker Actions** - All relationships with domain `Plumber` grouped under `performs`
2. **Flow/Transport** - All relationships with domain `Pipe` describing flow grouped under `conveys`

### How Multiple Abstractions Are Created

The enhanced demo (10 sentences) shows how the system creates multiple relationship abstraction layers:

**Round 2 - Worker Actions Pattern:**
- Sentence 4: `repairs (Plumber → Faucet)` - First worker action
- Sentence 5: `clears (Plumber → Drain)` - Triggers `performs` abstraction
- Sentences 6-8: `usesTool`, `inspects`, `maintains` - All grouped under `performs`

**Round 3 - Flow/Transport Pattern:**
- Sentence 9: `deliversTo (Pipe → Fixture)` - First flow relationship
- Sentence 10: `channelsTo (Pipe → SewerSystem)` - Triggers `conveys` abstraction
- Additional: `transports (Pipe → Fluid)` - Grouped under `conveys`

**Why Two Separate Abstractions?**
- Different domains: `Plumber` vs `Pipe`
- Different semantics: Actions performed by workers vs flow through conduits
- LLM recognizes distinct patterns and creates appropriate supertypes

**Domain-Based Grouping:**
```
Domain: Plumber → Abstraction: performs
  ├─ All worker actions grouped together
  └─ Semantic pattern: "actions performed by workers"

Domain: Pipe → Abstraction: conveys
  ├─ All flow relationships grouped together
  └─ Semantic pattern: "transport/delivery through pipes"
```

## Implementation Details

### Key Files Modified

1. **OntologyExtensionService.js** (`src/services/`)
   - Added `findCompatibleRelationships()` - filters relationships by domain compatibility
   - Added `determineParentRelationship()` - orchestrates two-phase abstraction
   - Added `findLowestCommonAncestor()` - calculates LCA for parent range
   - Updated `extendFromGaps()` - uses dynamic parents instead of hardcoded `kg:relatesTo`

2. **determine-parent-relationship-with-abstraction.hbs** (`src/prompts/`)
   - LLM prompt for relationship abstraction decisions
   - Emphasizes subsumption compatibility and semantic patterns
   - Provides examples for different abstraction scenarios

3. **GapAnalysisService.js** (`src/services/`)
   - Updated schema to require `description` field for relationships
   - Enables LLM to make semantic abstraction decisions

4. **extract-implied-types.hbs** (`src/prompts/`)
   - Updated to include relationship descriptions in extraction

### Test Coverage

Created comprehensive test suite: `OntologyExtensionService.relationship-abstraction.test.js`

**Tests:**
1. ✅ First relationship uses kg:relatesTo
2. ✅ Second compatible relationship triggers parent creation
3. ✅ Third relationship uses existing parent
4. ✅ Incompatible domain/range creates separate hierarchy
5. ✅ E2E multi-level hierarchy building

All tests pass with real LLM integration (no mocks).

## Mathematical Foundation

### Subsumption Rule 2

For relationship `A R B` to be a subtype of `C S D`:
```
A ⊆ C  AND  B ⊆ D  ⟹  R ⊆ S
```

### Relaxed Compatibility

The system uses **domain-only compatibility** to allow semantic grouping of relationships with sibling ranges:

```
A ⊆ C  ⟹  Compatible for abstraction
```

Then calculates `LCA(B, D, ...)` for the parent's range, ensuring:
```
B ⊆ LCA  AND  D ⊆ LCA  ⟹  Subsumption satisfied
```

## Benefits

1. **Semantic Organization**: Relationships are grouped by meaning (worker actions, flow/transport, spatial relations, etc.)
2. **Multiple Abstraction Layers**: System creates distinct hierarchies for different semantic categories automatically
3. **Reusable Abstractions**: Common patterns are identified and reused across sentences
4. **Query Efficiency**: Hierarchies enable subsumption reasoning and inheritance queries
5. **Domain Knowledge**: Captures implicit relationships between similar actions/concepts
6. **Consistency**: Same mathematical approach for both classes and relationships
7. **Scalability**: As ontology grows, relationships organize themselves into meaningful hierarchies

## Configuration

Relationship abstraction is **always active** and requires no configuration. The system:
- Automatically bootstraps `kg:relatesTo` as the root relationship
- Uses hierarchyTraversal service for subsumption checking
- Creates abstractions on-demand based on semantic patterns
- Falls back to `kg:relatesTo` for incompatible relationships

## Future Enhancements

Potential improvements:
- Multi-dimensional abstraction (domain + range + semantics)
- Property path patterns for complex relationships
- Role hierarchies for domain-specific abstractions
- Cross-domain relationship bridging
