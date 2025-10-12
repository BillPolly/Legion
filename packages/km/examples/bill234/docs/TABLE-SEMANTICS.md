# Semantic Table Representation

## Problem

Currently, we rely on LLMs to parse table structure from JSON and extract:
- Table rows and columns
- Cell values and their coordinates
- Table metadata (units, captions)
- Relationships between cells

**This is fragile!** The LLM must infer structure from unstructured JSON.

## Solution: Programmatic Table Processing

Build a **TableProcessor** that creates explicit semantic table entities:

### Table Ontology Additions

```turtle
# Table Structure Classes
kg:Table a owl:Class ;
    rdfs:label "Table" ;
    rdfs:comment "A structured financial table from a document" .

kg:TableRow a owl:Class ;
    rdfs:label "Table Row" ;
    rdfs:comment "A row in a financial table" .

kg:TableColumn a owl:Class ;
    rdfs:label "Table Column" ;
    rdfs:comment "A column in a financial table" .

kg:TableCell a owl:Class ;
    rdfs:label "Table Cell" ;
    rdfs:comment "A cell in a table at the intersection of a row and column" .

# Table Properties
kg:hasRow a owl:ObjectProperty ;
    rdfs:domain kg:Table ;
    rdfs:range kg:TableRow .

kg:hasColumn a owl:ObjectProperty ;
    rdfs:domain kg:Table ;
    rdfs:range kg:TableColumn .

kg:hasCell a owl:ObjectProperty ;
    rdfs:domain kg:Table ;
    rdfs:range kg:TableCell .

kg:atRow a owl:ObjectProperty ;
    rdfs:domain kg:TableCell ;
    rdfs:range kg:TableRow .

kg:atColumn a owl:ObjectProperty ;
    rdfs:domain kg:TableCell ;
    rdfs:range kg:TableColumn .

kg:cellValue a owl:ObjectProperty ;
    rdfs:domain kg:TableCell ;
    rdfs:range kg:FinancialValue .

kg:rowLabel a owl:DatatypeProperty ;
    rdfs:domain kg:TableRow ;
    rdfs:range xsd:string .

kg:columnLabel a owl:DatatypeProperty ;
    rdfs:domain kg:TableColumn ;
    rdfs:range xsd:string .

kg:rowIndex a owl:DatatypeProperty ;
    rdfs:domain kg:TableRow ;
    rdfs:range xsd:integer .

kg:columnIndex a owl:DatatypeProperty ;
    rdfs:domain kg:TableColumn ;
    rdfs:range xsd:integer .

kg:tableCaption a owl:DatatypeProperty ;
    rdfs:domain kg:Table ;
    rdfs:range xsd:string .

kg:tableUnits a owl:DatatypeProperty ;
    rdfs:domain kg:Table ;
    rdfs:range xsd:string ;
    rdfs:comment "Units specified in table caption (e.g., 'in thousands', 'in millions')" .
```

### Example KG Structure

For Example 12's table:

```turtle
# Table entity
entity:Table_12 a kg:Table ;
    kg:tableCaption "Changes in common stock shares" ;
    kg:tableUnits "in thousands" .

# Columns
entity:Column_ClassACommonStock a kg:TableColumn ;
    kg:columnLabel "class a common stock" ;
    kg:columnIndex 0 .

entity:Column_ClassBCommonStock a kg:TableColumn ;
    kg:columnLabel "class b common stock" ;
    kg:columnIndex 1 .

# Rows
entity:Row_BalanceDec31_2016 a kg:TableRow ;
    kg:rowLabel "balance at december 31 2016" ;
    kg:rowIndex 0 .

entity:Row_IssueSharesBusinessCombination a kg:TableRow ;
    kg:rowLabel "issue of shares on business combination at july 3 2017" ;
    kg:rowIndex 1 .

entity:Row_IssueSharesRSUs a kg:TableRow ;
    kg:rowLabel "issue of shares upon vesting of restricted stock units ( 1 )" ;
    kg:rowIndex 2 .

# Cells
entity:Cell_ClassB_IssueShares_BusinessCombination a kg:TableCell ;
    kg:atRow entity:Row_IssueSharesBusinessCombination ;
    kg:atColumn entity:Column_ClassBCommonStock ;
    kg:cellValue value:ClassBCommonStock_IssueShares_BusinessCombination_July3_2017 .

# The value entity (as before, but now linked from cell)
value:ClassBCommonStock_IssueShares_BusinessCombination_July3_2017 a kg:MonetaryValue ;
    kg:numericValue 717111.0 ;
    kg:hasScale kg:Thousands ;  # From table caption!
    kg:displayValue "717111.0" .

# Metric entity still links to value
entity:Metric_ClassBCommonStock_IssueShares_BusinessCombination_July3_2017 a kg:FinancialMetric ;
    kg:label "class b common stock - issue of shares on business combination at july 3 2017" ;
    kg:fromCell entity:Cell_ClassB_IssueShares_BusinessCombination ;
    kg:hasValue value:ClassBCommonStock_IssueShares_BusinessCombination_July3_2017 .
```

### Benefits

1. **Explicit Table Structure**: Rows, columns, and cells are first-class entities
2. **Metadata Preservation**: Table caption and units are preserved
3. **Queryable Structure**: Can query "all cells in column X" or "all values in row Y"
4. **Semantic Relationships**: Clear row/column relationships for SPARQL
5. **Type Safety**: LLM can't misidentify row vs column

### Implementation Plan

1. **TableProcessor class** (`src/graph-solver/table_processor.py`):
   - Detects table format (row-first vs column-first)
   - Extracts table metadata from captions
   - Creates Table, TableRow, TableColumn, TableCell entities
   - Links cells to FinancialValue entities

2. **Update OntologyExtractor**:
   - Call TableProcessor BEFORE LLM extraction
   - Pass structured table entities to LLM
   - LLM only needs to create FinancialMetric entities that reference table cells

3. **Update extraction_models.py**:
   - Add Table, TableRow, TableColumn, TableCell Pydantic models
   - Add to ExtractionResult

4. **Update ontology**:
   - Add table structure classes and properties
   - Document table semantics

### Query Improvement

With semantic tables, SPARQL queries become more precise:

```sparql
# OLD: String matching on label
SELECT ?value WHERE {
  ?metric kg:label ?label .
  FILTER(CONTAINS(LCASE(?label), "class b") && CONTAINS(LCASE(?label), "issued"))
  ?metric kg:hasValue ?valueEntity .
  ?valueEntity kg:numericValue ?value .
}

# NEW: Structural table queries
SELECT ?value WHERE {
  ?cell kg:atColumn ?col .
  ?col kg:columnLabel "class b common stock" .
  ?cell kg:atRow ?row .
  ?row kg:rowLabel ?rowLabel .
  FILTER(CONTAINS(LCASE(?rowLabel), "issue of shares"))
  ?cell kg:cellValue ?valueEntity .
  ?valueEntity kg:numericValue ?value .
}
```

This eliminates ambiguity - we're querying **table structure**, not fuzzy text matching!
