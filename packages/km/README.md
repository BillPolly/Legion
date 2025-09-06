# Knowledge Management (KM) System

A comprehensive knowledge management system consisting of three integrated packages that work together to extract, store, and reason about knowledge.

## 📦 Packages

### [@legion/kg](./kg) - Knowledge Graph
The core knowledge graph system providing:
- Perfect isomorphism between JavaScript objects and graph entities
- 7 storage backends (Memory, File, GitHub, SQL, MongoDB, GraphDB, Remote)
- RDF/JSON-LD compatibility
- Query and reasoning capabilities
- Self-describing schema

### [@legion/nlp](./nlp) - Natural Language Processing
Text-to-knowledge extraction system featuring:
- Ontology-guided entity extraction
- Relationship detection
- Domain classification
- Triple generation from natural text
- LLM integration ready (currently using mock)

### [@legion/wordnet](./wordnet) - WordNet Ontology
Foundational semantic layer providing:
- 100,000+ concept definitions from WordNet
- Semantic hierarchy (IS-A, PART-OF relationships)
- Polysemy and synonymy handling
- Two-tier architecture (concepts vs. words)
- MongoDB-backed persistence

## 🏗️ Architecture

```
km/
├── kg/        # Core knowledge graph engine
├── nlp/       # Natural language processing
└── wordnet/   # Semantic foundation
```

## 🔗 Integration

The packages are designed to work together:

1. **WordNet** loads foundational semantic knowledge into **KG**
2. **NLP** extracts entities and relationships from text
3. **KG** stores and enables querying of all knowledge
4. Together they form a complete knowledge pipeline: Text → Understanding → Storage → Reasoning

## 🚀 Quick Start

```javascript
// 1. Load WordNet foundation (one-time setup)
import { WordNetFoundationalLoader } from './wordnet';
const loader = new WordNetFoundationalLoader();
await loader.loadFoundationalOntology();

// 2. Initialize KG for storage
import { KGEngine } from './kg';
const kg = new KGEngine();

// 3. Process text with NLP
import { NLPSystem } from './nlp';
const nlp = new NLPSystem({ kgEngine: kg });
const result = await nlp.processText("John works at Acme Corp");

// 4. Store in knowledge graph
for (const triple of result.triples.triples) {
  await kg.addTriple(triple[0], triple[1], triple[2]);
}
```

## 📚 Documentation

- [KG Documentation](./kg/README.md)
- [NLP Documentation](./nlp/README.md)
- [WordNet Documentation](./wordnet/README.md)

## 🧪 Testing

Each package can be tested independently:

```bash
# Test KG
cd kg && node demo/basic-kg-demo.js

# Test NLP
cd nlp && node test-integration-demo.js

# Test WordNet (requires KG)
cd wordnet && node test-wordnet-basic.js
```

## 📄 License

MIT