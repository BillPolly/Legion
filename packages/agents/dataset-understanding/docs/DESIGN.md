# Dataset Understanding Agent - Design Document

## Purpose

The Dataset Understanding Agent examines a JSON dataset and produces a comprehensive understanding of its structure, domain, and content **without building an ontology**. This understanding becomes input for downstream processes like ontology building and knowledge graph ingestion.

## Separation of Concerns

This agent is **ONLY** responsible for understanding what exists in the data. It does NOT:
- Build ontologies
- Create knowledge graphs
- Store data in databases

It ONLY outputs a structured description of what it foun/Users/williampearson/Legion/packages/agentsd.

## Input

- **File path** to a JSON dataset
- **Sample size** (optional, default: 3) - How many examples to examine

## Output

A structured JSON document containing:

```json
{
  "datasetInfo": {
    "filePath": "/path/to/dataset.json",
    "fileSize": 1234567,
    "samplesExamined": 3,
    "totalRecords": 1500,
    "analysisTimestamp": "2025-10-13T14:30:00Z"
  },

  "structure": {
    "format": "JSON",
    "topLevelStructure": "object with train/dev/test arrays",
    "recordSchema": {
      "id": "string - unique identifier",
      "doc": {
        "pre_text": "string - narrative context before table",
        "post_text": "string - narrative context after table",
        "table": "object - structured data with year/period as keys, metrics as nested objects"
      },
      "dialogue": {
        "conv_questions": "array - conversational questions",
        "conv_answers": "array - expected answers",
        "turn_program": "array - computational formulas",
        "executed_answers": "array - computed numerical results"
      },
      "features": {
        "num_dialogue_turns": "number",
        "has_type2_question": "boolean",
        "has_duplicate_columns": "boolean",
        "has_non_numeric_values": "boolean"
      }
    }
  },

  "domain": {
    "primaryDomain": "Corporate Finance",
    "subDomains": ["Financial Reporting", "Cash Flow Analysis", "Year-over-Year Comparisons"],
    "confidence": 0.95,
    "evidence": [
      "Table contains fiscal year data (2007, 2008, 2009)",
      "Metrics include: net income, cash flow, revenue",
      "Questions involve financial calculations (percentages, differences)",
      "Context mentions annual reports, financial statements"
    ]
  },

  "keyConcepts": [
    {
      "concept": "Company",
      "occurrences": 1500,
      "examples": ["JKHY", "RSG", "AAPL"],
      "extractionPattern": "id field contains company ticker"
    },
    {
      "concept": "FiscalYear",
      "occurrences": 4500,
      "examples": ["2007", "2008", "2009", "Year ended June 30, 2009"],
      "extractionPattern": "table keys contain year information"
    },
    {
      "concept": "FinancialMetric",
      "occurrences": 12000,
      "examples": [
        "net income",
        "cash from operating activities",
        "revenue",
        "gross margin"
      ],
      "extractionPattern": "nested keys within table year objects"
    },
    {
      "concept": "MetricValue",
      "occurrences": 12000,
      "examples": [103102.0, 206588.0, 9362.2],
      "extractionPattern": "numeric values in table, typically float or integer"
    },
    {
      "concept": "ComputationalFormula",
      "occurrences": 6000,
      "examples": [
        "subtract(206588, 181001)",
        "divide(#0, 181001)",
        "subtract(9362.2, 9244.9), divide(#0, 9244.9)"
      ],
      "extractionPattern": "turn_program array contains formula strings"
    }
  ],

  "extractionSchema": {
    "description": "Instructions for how to navigate and extract data from this JSON format",
    "steps": [
      {
        "step": 1,
        "description": "Access dataset root object",
        "path": "/"
      },
      {
        "step": 2,
        "description": "Select subset to process (train, dev, or test)",
        "path": "/train",
        "note": "train array contains 1500 examples"
      },
      {
        "step": 3,
        "description": "For each record, extract company identifier",
        "path": "/train[i]/id",
        "extraction": "Parse company ticker from id (e.g., 'Single_JKHY/2009/page_28.pdf-3' → 'JKHY')"
      },
      {
        "step": 4,
        "description": "Extract narrative context",
        "paths": [
          "/train[i]/doc/pre_text",
          "/train[i]/doc/post_text"
        ]
      },
      {
        "step": 5,
        "description": "Extract table data",
        "path": "/train[i]/doc/table",
        "structure": "Object where keys are time periods (e.g., '2009', 'Year ended June 30, 2009')",
        "note": "Each period key contains an object with metric names as keys and numeric values"
      },
      {
        "step": 6,
        "description": "Extract Q&A pairs",
        "paths": [
          "/train[i]/dialogue/conv_questions[j]",
          "/train[i]/dialogue/conv_answers[j]"
        ],
        "note": "Arrays are parallel - index j corresponds to same Q&A"
      },
      {
        "step": 7,
        "description": "Extract computational formulas",
        "path": "/train[i]/dialogue/turn_program[j]",
        "note": "Formulas use notation like subtract(), divide(), #0 for references"
      }
    ],

    "navigationPatterns": {
      "timePeriods": {
        "location": "doc.table keys",
        "variability": "HIGH - formats vary (plain year '2009' vs descriptive 'Year ended June 30, 2009')",
        "canonicalization": "Required - extract year number, determine fiscal period"
      },
      "metrics": {
        "location": "doc.table[period] keys",
        "variability": "HIGH - same metric expressed differently ('net income' vs 'income from continuing operations')",
        "canonicalization": "Required - normalize metric names"
      },
      "values": {
        "location": "doc.table[period][metric]",
        "type": "number (float or int)",
        "units": "Not explicitly specified - inferred from context (likely thousands or millions)"
      }
    }
  },

  "dataQuality": {
    "completeness": {
      "missingFields": [],
      "nullValues": "Rare - most records complete"
    },
    "consistency": {
      "issues": [
        "Time period labels are inconsistent across records",
        "Metric names vary for similar concepts",
        "Units not explicitly specified"
      ]
    },
    "anomalies": [
      "Some gross margin percentage values are negative (e.g., -28.0, -23.0) - likely data entry errors or special semantics"
    ]
  },

  "recommendations": {
    "ontologyBuilding": [
      "Create Company class with properties: ticker, fiscalYearEnd",
      "Create FiscalPeriod class with properties: year, startDate, endDate, periodType",
      "Create FinancialMetric class hierarchy (CashFlowMetric, RevenueMetric, etc.)",
      "Create MetricObservation class linking Company + FiscalPeriod + FinancialMetric + value",
      "Create ComputationalRelationship class for formulas"
    ],
    "normalization": [
      "Build canonical label service for time periods",
      "Build canonical label service for metric names",
      "Determine unit inference rules (context-based)"
    ],
    "ingestion": [
      "Process train/dev/test sets separately or combine",
      "Use sample-based approach - process incrementally to handle large dataset",
      "Consider extracting dialogue Q&A as separate fact layer"
    ]
  }
}
```

## Agent Architecture

### ConfigurableAgent Setup

The agent uses ConfigurableAgent with the following configuration:

```json
{
  "agent": {
    "id": "dataset-understanding-agent",
    "name": "Dataset Understanding Agent",
    "type": "task",
    "version": "1.0.0",
    "capabilities": [
      {
        "module": "file",
        "tools": ["file_read", "file_stat"]
      },
      {
        "module": "json",
        "tools": ["json_parse", "json_query", "json_sample"]
      }
    ],
    "llm": {
      "provider": "anthropic",
      "model": "claude-sonnet-4",
      "temperature": 0.0,
      "maxTokens": 8000
    },
    "state": {
      "maxHistorySize": 10,
      "contextVariables": {
        "filePath": {"type": "string", "persistent": true},
        "sampleSize": {"type": "number", "persistent": true},
        "samples": {"type": "array", "persistent": true},
        "structure": {"type": "object", "persistent": true},
        "domain": {"type": "object", "persistent": true},
        "concepts": {"type": "array", "persistent": true},
        "extractionSchema": {"type": "object", "persistent": true}
      }
    }
  }
}
```

### Behavior Tree

Sequential workflow:

1. **Load Dataset** - Read file, validate JSON
2. **Sample Records** - Extract N examples from dataset
3. **Analyze Structure** - Detect schema, field types, nesting
4. **Identify Domain** - Use LLM to classify domain based on samples
5. **Extract Concepts** - Identify key entities and relationships
6. **Design Extraction Schema** - Create navigation instructions
7. **Assess Quality** - Check completeness, consistency
8. **Generate Recommendations** - Suggest next steps

### Tools

#### 1. `load_dataset`
- Reads JSON file
- Validates format
- Extracts metadata (size, record count)

#### 2. `sample_records`
- Extracts N random samples
- Ensures samples are representative

#### 3. `analyze_structure`
- Introspects JSON schema
- Identifies field types, nesting depth
- Detects patterns

#### 4. `identify_domain`
- **Uses LLM with frontier model world knowledge**
- Analyzes samples to determine domain
- Provides confidence score and evidence

#### 5. `extract_concepts`
- **Uses LLM to identify key concepts**
- Counts occurrences
- Provides examples

#### 6. `design_extraction_schema`
- **Uses LLM to create navigation instructions**
- Documents JSON paths
- Notes variability and canonicalization needs

#### 7. `assess_quality`
- Checks for missing fields, nulls
- Identifies inconsistencies
- Flags anomalies

#### 8. `generate_recommendations`
- Suggests ontology structure
- Recommends normalization strategies
- Provides ingestion guidance

## Prompt Templates

### `identify_domain.j2`

```jinja2
You are analyzing a dataset to determine its domain.

**Dataset Samples:**
{% for sample in samples %}
---
Sample {{ loop.index }}:
{{ sample | tojson(indent=2) }}
{% endfor %}

**Task:**
Based on these samples, identify:
1. The PRIMARY DOMAIN (e.g., Corporate Finance, Healthcare, E-commerce)
2. SUB-DOMAINS (more specific areas)
3. CONFIDENCE (0.0 to 1.0)
4. EVIDENCE (specific observations that support your classification)

Use your world knowledge about different domains to make this determination.

Output as JSON:
{
  "primaryDomain": "...",
  "subDomains": ["...", "..."],
  "confidence": 0.95,
  "evidence": ["...", "..."]
}
```

### `extract_concepts.j2`

```jinja2
You are analyzing dataset samples to identify key concepts.

**Domain Context:** {{ domain.primaryDomain }}

**Dataset Samples:**
{% for sample in samples %}
---
Sample {{ loop.index }}:
{{ sample | tojson(indent=2) }}
{% endfor %}

**Task:**
Identify the KEY CONCEPTS that appear in this data. For each concept:
1. NAME - What is it called?
2. DESCRIPTION - What does it represent?
3. EXAMPLES - Provide 3-5 concrete examples from the data
4. EXTRACTION PATTERN - How would you find/extract this from the JSON?

Focus on domain entities (nouns) and relationships (verbs).

Output as JSON array:
[
  {
    "concept": "Company",
    "description": "A business entity being reported on",
    "examples": ["JKHY", "RSG", "AAPL"],
    "extractionPattern": "..."
  },
  ...
]
```

### `design_extraction_schema.j2`

```jinja2
You are creating navigation instructions for extracting data from a JSON dataset.

**Dataset Structure:**
{{ structure | tojson(indent=2) }}

**Key Concepts:**
{% for concept in concepts %}
- {{ concept.concept }}: {{ concept.description }}
{% endfor %}

**Task:**
Create a STEP-BY-STEP extraction schema that explains:
1. How to navigate the JSON structure
2. What paths to follow
3. What variability exists
4. What canonicalization is needed

Be SPECIFIC about JSON paths (e.g., `/train[i]/doc/table`).
Note where formats vary and normalization is required.

Output as JSON:
{
  "steps": [
    {
      "step": 1,
      "description": "...",
      "path": "...",
      "note": "..."
    }
  ],
  "navigationPatterns": {
    "...": { "location": "...", "variability": "...", "canonicalization": "..." }
  }
}
```

## Testing

Test with ConvFinQA dataset:

```javascript
import { DatasetUnderstandingAgent } from './src/DatasetUnderstandingAgent.js';

test('should understand ConvFinQA dataset', async () => {
  const agent = new DatasetUnderstandingAgent(resourceManager);
  await agent.initialize();

  const result = await agent.receive({
    type: 'understand_dataset',
    filePath: '/path/to/convfinqa_dataset.json',
    sampleSize: 3
  });

  expect(result.success).toBe(true);
  expect(result.output.domain.primaryDomain).toBe('Corporate Finance');
  expect(result.output.keyConcepts).toHaveLength(5); // Company, FiscalYear, etc.
  expect(result.output.extractionSchema.steps).toHaveLength(7);
});
```

## Implementation Notes

1. **LLM-Driven**: This agent heavily relies on frontier LLM world knowledge to:
   - Identify domains without predefined categories
   - Extract concepts without predetermined schema
   - Design extraction patterns intelligently

2. **No Ontology Building**: This agent does NOT create OWL/RDF ontologies. It only describes what exists. Ontology building is a separate downstream process.

3. **Incremental**: Process samples incrementally (not all at once) to handle large datasets and avoid token limits.

4. **Stateful**: Maintain state across steps using ConfigurableAgent's state management.

5. **Output Format**: Always output structured JSON for downstream consumption.
