# CSQA Benchmark Example

This example demonstrates running the Legion query understanding system on the **CSQA (Complex Sequential Question Answering)** benchmark dataset.

## What is CSQA?

CSQA is a conversational question answering benchmark with **200K dialogs** and **1.6M turns** over Wikidata. It tests systems on:

- **Coreference resolution** - "What is that person a screenwriter of?"
- **Implicit references** - "What is a component of that nutrient?"
- **Clarification** - Disambiguating among multiple entities
- **Multi-hop reasoning** - Complex logical and comparative questions

**Paper**: "Complex Sequential Question Answering: Towards Learning to Converse Over Linked Question Answer Pairs with a Knowledge Graph" (Saha et al., 2018)

## Dataset Structure

```
examples/csqa-benchmark/
├── README.md                    # This file
├── data/                        # Sample conversations
│   ├── QA_100/                 # Coreference: "that person"
│   ├── QA_396/                 # Implicit reference: "that nutrient"
│   └── QA_157/                 # Direct follow-ups
├── extract-sample-entities.js   # Extract entities from conversations
├── sample-entities.json         # Extracted entities (1,062 total)
└── run-sample.js               # Run benchmark on 3 sample conversations (TODO)
```

## Quick Start

### Step 1: Extract Entities

First, identify which Wikidata entities are needed for our sample conversations:

```bash
node extract-sample-entities.js
```

**Output**: `sample-entities.json` with 1,062 unique entities and 16 relations

### Step 2: Load Wikidata Subset (TODO)

The full Wikidata files are in `/private/tmp/convquestions/wikidata_proc_json\ 2/`:
- `items_wikidata_n.json` - Entity labels (614MB)
- `filtered_property_wikidata4.json` - Property labels (18KB)
- `comp_wikidata_rev.json` - Complete Wikidata facts (591MB)

We need to create a loader that:
1. Reads `items_wikidata_n.json` to get entity labels for our 1,062 entities
2. Reads `filtered_property_wikidata4.json` to get relation labels for our 16 properties
3. Reads `comp_wikidata_rev.json` to get facts about our entities
4. Creates an in-memory WikidataDataSource

### Step 3: Run Benchmark

```bash
node run-sample.js
```

This will:
1. Load the 3 sample conversations
2. Create a MultiTurnPipeline with WikidataDataSource
3. Run each conversation turn-by-turn
4. Compare generated answers with ground truth
5. Report accuracy metrics

## Sample Conversations

### Conversation 1: QA_100 (Coreference)

```
Turn 1: "What is the job of Börje Larsson?"
        → "director" (Q3455803)

Turn 2: "What is Börje Larsson a director of?"
        → "Taxi 13" (Q10691559)

Turn 3: "What is THAT PERSON a screenwriter of?"  ← Coreference!
        ^^^^^^^^^^^ refers to Börje Larsson
        → "Taxi 13" (Q10691559)
```

**Challenge**: Resolve "that person" to Börje Larsson (Q5479433) using graph context

### Conversation 2: QA_396 (Implicit Reference)

```
Turn 1: "Which process is Glutathione S-transferase A2 involved in?"
        → "metabolic process" (Q1057)

Turn 2: "What is a component of THAT NUTRIENT?"  ← Implicit!
        ^^^^^^^^^^^^^ refers to Glutathione S-transferase A2
```

**Challenge**: Resolve "that nutrient" to Q21119019 even though the previous answer was "metabolic process"

### Conversation 3: QA_157 (Direct Follow-ups)

```
Turn 1: "What is the sex of Molly Sims?"
        → "female" (Q6581072)

Turn 2: "Which works of art do Molly Sims star in?"
        → [List of movies/shows]
```

**Challenge**: Maintain context about Molly Sims across multiple related questions

## Data Format

Each conversation file (e.g., `QA_100/QA_0.json`) contains a JSON array with USER/SYSTEM turns:

```json
[
  {
    "speaker": "USER",
    "utterance": "What is the job of Börje Larsson?",
    "entities_in_utterance": ["Q5479433"],
    "relations": ["P106"],
    "type_list": ["Q12737077"]
  },
  {
    "speaker": "SYSTEM",
    "utterance": "director",
    "entities_in_utterance": ["Q3455803"],
    "all_entities": ["Q3455803"],
    "active_set": ["(Q5479433,P106,c(Q12737077))"]
  },
  ...
]
```

## Metrics to Compute

1. **Entity Accuracy** - Correct entity Q-number returned
2. **Label Match** - Human-readable label matches ground truth
3. **Turn Success Rate** - Percentage of turns answered correctly
4. **Conversation Success Rate** - Percentage of full conversations correct
5. **Coreference Resolution Accuracy** - Subset of turns with pronouns/references
6. **Latency** - Time per turn (with real LLM calls)

## Next Steps

1. ✅ Extract entities from sample conversations (1,062 entities, 16 relations)
2. ⏳ Create Wikidata loader for subset
3. ⏳ Create WikidataDataSource adapter
4. ⏳ Implement run-sample.js benchmark runner
5. ⏳ Run on 3 conversations and report metrics
6. ⏳ Scale to 10, 50, 100 conversations

## Full CSQA Dataset

The complete dataset is available at:
- **Dialogs**: https://zenodo.org/record/3268649 (628MB, 200K dialogs)
- **Wikidata**: https://zenodo.org/record/4052427 (900MB preprocessed)

Currently stored in `/private/tmp/convquestions/` for development.

Once we validate on 3 conversations, we can scale up to the full benchmark.
