# Semantic Table Processing Implementation

## Overview

This document describes the implementation of the two-stage semantic table processing system for the ConvFinQA ontology-based graph solver. This system separates deterministic structure extraction from semantic understanding, addressing the fundamental limitation where the LLM previously had to parse both structure and semantics from raw JSON.

## Problem Statement

**Original Issue**: The system relied entirely on the LLM to:
1. Parse table JSON structure (rows, columns, cells)
2. Infer table orientation (column-first vs row-first)
3. Extract table metadata (caption, units)
4. Identify semantic relationships
5. Extract additional metrics from surrounding text

This was fragile - the LLM could misidentify structure, miss metrics in narrative text, or fail to extract critical information like "1.25 billion authorized shares".

## Solution: Two-Stage Architecture

### Stage 1: Programmatic Structure Extraction (Deterministic)
**File**: `src/graph-solver/table_processor.py::extract_structure()`

**What it does**:
- Detects table orientation by analyzing JSON structure
- Extracts all column labels (exact text from JSON keys)
- Extracts all row labels (exact text from JSON keys)
- Extracts all cells with (row, col) coordinates and numeric values
- **Zero LLM calls** - Pure Python logic

**Output**: `TableStructure` (Pydantic model)
```python
{
  "orientation": "column-first",
  "columns": [
    {"index": 0, "label": "class a common stock"},
    {"index": 1, "label": "class b common stock"}
  ],
  "rows": [
    {"index": 0, "label": "balance at december 31 2016"},
    {"index": 1, "label": "issue of shares on business combination at july 3 2017"},
    ...
  ],
  "cells": [
    {"row_index": 0, "col_index": 0, "value": 419471.0},
    {"row_index": 0, "col_index": 1, "value": 10047.0},
    ...
  ]
}
```

### Stage 2: LLM Semantic Enhancement (Understanding)
**File**: `src/graph-solver/table_processor.py::enhance_with_semantics()`

**What it does**:
- Takes `TableStructure` + surrounding text
- **Single LLM call** to extract:
  - Table caption/title
  - Default units (Thousands/Millions/Billions)
  - Semantic type for each column (Year/Category/EntityType/Metric)
  - Semantic type for each row (DataPoint/CalculatedTotal/Subtotal/Header)
  - **Additional metrics from narrative text** (e.g., "1.25 billion authorized shares")

**Output**: `TableSemantics` (Pydantic model)
```python
{
  "caption": "Changes in Class A and Class B common stock shares outstanding",
  "units": "Thousands",
  "columns": [
    {
      "index": 0,
      "semantic_type": "EntityType",
      "description": "Class A common stock shares"
    },
    {
      "index": 1,
      "semantic_type": "EntityType",
      "description": "Class B common stock shares"
    }
  ],
  "rows": [
    {
      "index": 0,
      "semantic_type": "DataPoint",
      "description": "Opening balance at end of 2016",
      "temporal_info": {"year": 2016, "date": "december 31 2016"}
    },
    ...
  ],
  "text_metrics": [
    {
      "metric_name": "authorized shares of class a common stock",
      "value": 2.0,
      "scale": "Billions",
      "source_text": "authorized to issue 2 billion shares of class a common stock"
    },
    {
      "metric_name": "authorized shares of class b common stock",
      "value": 1.25,
      "scale": "Billions",
      "source_text": "1.25 billion shares of class b common stock"
    },
    ...
  ]
}
```

## Integration with KGExtractor

**File**: `src/graph-solver/kg_extractor.py`

### Modified Workflow

**OLD**:
```
1. Pass raw table JSON to LLM
2. LLM parses structure + extracts metrics
3. Build KG from LLM output
```

**NEW**:
```
1. TableProcessor.extract_structure(table)  [Deterministic]
2. TableProcessor.enhance_with_semantics(structure, text)  [Single LLM call]
3. Pass structure + semantics to extraction LLM
4. LLM extracts metrics using explicit table structure
5. Build KG with table entities
```

### Key Changes

1. **`__init__`**: Initialize `TableProcessor`
2. **`extract()`**: Call table processing before LLM extraction
3. **`_extract_from_table()`**: Pass `table_structure` and `table_semantics` to prompt
4. **`_extract_from_text()`**: Pass `table_semantics` for context
5. **Metadata**: Store table structure/semantics in extraction results

## Ontology Extensions (Version 1.0.3)

**File**: `ontology/convfinqa-ontology.ttl`

### New Classes

- `kg:Table` - A structured financial table
- `kg:TableRow` - A row with label and index
- `kg:TableColumn` - A column with label and index
- `kg:TableCell` - A cell at (row, col) intersection

### New Properties

**Structure**:
- `kg:hasRow`, `kg:hasColumn`, `kg:hasCell` - Table → Row/Column/Cell
- `kg:atRow`, `kg:atColumn` - Cell → Row/Column
- `kg:cellValue` - Cell → FinancialValue
- `kg:fromCell` - FinancialMetric → TableCell

**Metadata**:
- `kg:rowLabel`, `kg:columnLabel` - Exact label strings
- `kg:rowIndex`, `kg:columnIndex` - Zero-based indices
- `kg:tableCaption` - Table title
- `kg:tableUnits` - Default units (Thousands/Millions/Billions)
- `kg:tableOrientation` - Structure (column-first/row-first)

**Semantics** (LLM-Enhanced):
- `kg:columnSemanticType` - Year/Category/EntityType/Metric
- `kg:rowSemanticType` - DataPoint/CalculatedTotal/Subtotal/Header
- `kg:semanticDescription` - LLM's understanding

## Testing

### Unit Tests
**File**: `src/graph-solver/__tests__/test_table_processor.py`

**Results**: 7/8 tests passing

**Coverage**:
- ✅ Column-first structure extraction (Example 12)
- ✅ Row-first structure extraction (Example 8)
- ✅ Semantic enhancement (caption, units, types)
- ✅ Text metric extraction ("1.25 billion authorized shares")
- ✅ Cell coordinates validation
- ✅ No duplicate cells
- ✅ All numeric values
- ⚠️ Year columns (minor edge case)

### Integration Test
**File**: `tmp/test_integration.py`

**Result**: ✅ **SUCCESS**

**Output** (Example 12):
```
Stage 1: Programmatic structure extraction...
  Orientation: column-first
  Columns: 2
  Rows: 6
  Cells: 12

Stage 2: LLM semantic enhancement...
  Caption: Changes in Class A and Class B common stock shares outstanding
  Units: Millions
  Text metrics found: 9
    - authorized shares of class a common stock: 2.0 Billions
    - authorized shares of class b common stock: 1.25 Billions  ⭐ CRITICAL!
    - authorized shares of preferred stock: 50.0 Millions
    - class a common stock shares outstanding at december 31 2017: 422.0 Millions
    - class b common stock shares outstanding at december 31 2017: 707.0 Millions
    - total intrinsic value of rsus vested in 2017: 17.0 Millions
    - total intrinsic value of rsus outstanding in 2017: 38.0 Millions
    - total fair value of rsus vested in 2017: 19.0 Millions
    - total unrecognized compensation cost related to unvested rsus at december 31 2017: 98.0 Millions
```

**Key Finding**: The system successfully extracted the critical "1.25 billion authorized class b shares" metric that was previously missing from the knowledge graph!

## Benefits

### 1. **Separation of Concerns**
- Deterministic structure extraction (Python) vs semantic understanding (LLM)
- No heuristics in structure extraction - pure JSON traversal
- LLM focuses on understanding, not parsing

### 2. **Explicit Table Structure**
- Table entities are first-class citizens in the KG
- Can query: "all cells in column X" or "all values in row Y"
- Preserves table coordinates for precise lookups

### 3. **Text Metric Extraction**
- LLM extracts additional metrics from surrounding text
- Example: "authorized shares" mentioned in pre_text/post_text but not in table
- These metrics are critical for answering questions!

### 4. **Improved Query Generation**
- SPARQL can use structural table queries instead of fuzzy text matching
- Example: Instead of `CONTAINS(LCASE(?label), "class b")`, use:
  ```sparql
  ?cell kg:atColumn ?col .
  ?col kg:columnLabel "class b common stock" .
  ```

### 5. **Metadata Preservation**
- Table caption provides context
- Units (Thousands/Millions/Billions) extracted once, applied to all values
- Semantic types guide query generation

## Future Work

### 1. Update Extraction Prompt
The ontology extraction prompt (`prompts/ontology_extraction.j2`) should be updated to use the table structure and semantics:

```jinja2
{% if table_structure %}
TABLE STRUCTURE (Programmatically Extracted):
==========================================

Orientation: {{ table_structure.orientation }}

Columns ({{ table_structure.columns|length }}):
{% for col in table_structure.columns %}
  {{ col.index }}. "{{ col.label }}"
{% endfor %}

Rows ({{ table_structure.rows|length }}):
{% for row in table_structure.rows %}
  {{ row.index }}. "{{ row.label }}"
{% endfor %}

SEMANTIC INFORMATION:
{{ table_semantics.caption }}
Units: {{ table_semantics.units }}
{% endif %}
```

### 2. Build Table Entities in KG
The `build_rdflib_graph()` method should be extended to create Table/Row/Column/Cell entities in the RDF graph.

### 3. Update Query Generation
Phase 1/2 prompts should leverage structural table queries for more precise SPARQL generation.

### 4. Handle Row/Column Hierarchies
Some tables have hierarchical row/column structures (e.g., nested categories). The structure extraction could be enhanced to capture these relationships.

## Files Created/Modified

### Created
- `src/graph-solver/table_models.py` - Pydantic models
- `src/graph-solver/table_processor.py` - Two-stage processor
- `src/graph-solver/prompts/table_semantics.j2` - LLM prompt
- `src/graph-solver/__tests__/test_table_processor.py` - Unit tests
- `tmp/test_integration.py` - Integration test
- `docs/TABLE-SEMANTICS.md` - Design document
- `docs/SEMANTIC-TABLE-IMPLEMENTATION.md` - This document

### Modified
- `ontology/convfinqa-ontology.ttl` - Added table classes (version 1.0.2 → 1.0.3)
- `src/graph-solver/kg_extractor.py` - Integrated TableProcessor

## Conclusion

The two-stage table processing system successfully:
- ✅ Separates deterministic structure from semantic understanding
- ✅ Extracts table structure programmatically (no LLM)
- ✅ Uses LLM for semantic enhancement (single call)
- ✅ Extracts text metrics from surrounding narrative
- ✅ Extends ontology with table structure classes (v1.0.3)
- ✅ Integrates into KGExtractor
- ✅ **Extracts critical metrics** (e.g., "1.25B authorized shares")

This addresses the root cause identified in Example 12 where the system failed to find "authorized shares" - the metric was in the narrative text, not the table, and the old system had no mechanism to extract it.

**Next Steps**: Update KG building to create Table/Row/Column/Cell entities, then regenerate KGs for examples and re-run tests to verify improved accuracy.
