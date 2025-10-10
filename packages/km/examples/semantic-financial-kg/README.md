# Semantic Financial Knowledge Graph

**A proper RDF semantic knowledge graph implementation demonstrating entity modeling, relationship reification, and ontology-driven information extraction.**

## Overview

This package demonstrates how to build a **true semantic knowledge graph** where:

- ✅ **A, R, B are all entities** - subjects, predicates, and objects are queryable resources
- ✅ **Relationships have properties** - using RDF reification for provenance tracking
- ✅ **Ontology-driven extraction** - facts matched to ontology classes and properties
- ✅ **Semantic queries** - query by entity type, not string matching
- ✅ **Reasoning support** - leverage rdfs:subClassOf and rdfs:subPropertyOf hierarchies

## Why This Package?

The `convfinqa-agent` package creates a flat key-value store with RDF syntax, not a proper semantic graph. This package shows the **correct way** to:

1. Model financial entities as proper RDF resources
2. Create semantic relationships using ontology properties
3. Reify statements to add metadata to relationships
4. Enable semantic queries that understand entity types
5. Support reasoning over class and property hierarchies

## Key Differences from `convfinqa-agent`

| convfinqa-agent (Wrong) | semantic-financial-kg (Correct) |
|-------------------------|----------------------------------|
| `kg:text_litigation_reserves_2012_0` | `kg:LitigationReserve_JPM_2012` |
| `kg:value` (metadata) | `kg:amount` (ontology property) |
| No relationships | `kg:hasFinancialObligation` |
| No reification | `rdf:Statement` with provenance |
| Single isolated fact | Multiple connected entities |
| String matching queries | Semantic type-based queries |

## Quick Example

### Wrong Approach (Current)
```turtle
kg:text_litigation_reserves_2012_0 rdf:type kg:Asset .
kg:text_litigation_reserves_2012_0 kg:value 3.7 .
kg:text_litigation_reserves_2012_0 kg:label "litigation reserves" .
```

### Correct Approach (This Package)
```turtle
# Proper entity with type
kg:LitReserve_2012_JPM rdf:type kg:LitigationReserve .
kg:LitReserve_2012_JPM kg:amount 3.7 .
kg:LitReserve_2012_JPM kg:unit kg:Billion .

# Semantic relationship
kg:JPMorgan kg:hasFinancialObligation kg:LitReserve_2012_JPM .

# Reified statement with provenance
_:stmt1 rdf:type rdf:Statement .
_:stmt1 rdf:subject kg:JPMorgan .
_:stmt1 rdf:predicate kg:hasFinancialObligation .
_:stmt1 rdf:object kg:LitReserve_2012_JPM .
_:stmt1 kg:confidence 0.95 .
_:stmt1 kg:sourceText "...additional litigation reserves..." .
```

**Now you can query:**
```sparql
# Find ALL litigation reserves (semantic query!)
SELECT ?reserve ?amount WHERE {
  ?reserve rdf:type kg:LitigationReserve .
  ?reserve kg:amount ?amount .
}

# Find high-confidence extractions
SELECT ?s ?p ?o WHERE {
  ?stmt rdf:subject ?s .
  ?stmt rdf:predicate ?p .
  ?stmt rdf:object ?o .
  ?stmt kg:confidence ?conf .
  FILTER (?conf > 0.9)
}
```

## Documentation

📖 **[Complete Design Document](./docs/DESIGN.md)** - Comprehensive explanation of:
- Why current approach is fundamentally flawed
- RDF and semantic web fundamentals
- Proper entity modeling with A, R, B as entities
- RDF reification for relationship metadata
- Architecture and component design
- Concrete before/after examples
- MVP scope and success criteria
- MongoDB schema design

## Project Status

🚧 **In Development** - Design phase complete, implementation in progress.

## Structure

```
semantic-financial-kg/
├── docs/
│   └── DESIGN.md           # Comprehensive design document
├── src/
│   ├── extraction/         # Entity and relationship extraction
│   ├── modeling/           # Entity factory and reification
│   ├── query/              # Semantic query engine
│   └── examples/           # Example usage scripts
└── __tests__/             # Test suite
```

## License

MIT
