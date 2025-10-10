# Phase 7: Provenance & Structured Value Objects

## Goal
Add table provenance and structured financial value objects for proper question answering

## Why This Phase Is Critical

**Current Problem**: We're creating bare string values like `"103102"` with no context:
- No units (USD? EUR? Count?)
- No scale (thousands? millions?)
- No source traceability (which table? which cell?)
- **Cannot answer ConvFinQA questions** like "What percentage change from 2008 to 2009?"

**What We Need**: Structured FinancialValue objects with complete metadata

## Architecture

### 1. FinancialValue Entity Schema

```javascript
{
  "uri": "data:FinVal_103102_USD_thousands",
  "type": "kg:FinancialValue",
  "properties": {
    "kg:numericValue": "103102.0",           // Raw number as appears
    "kg:currency": "USD",                     // Currency code
    "kg:scale": "thousands",                  // Scale factor
    "kg:actualAmount": "103102000.0",         // Normalized value
    "kg:unit": "currency",                    // Unit type (currency/percentage/count)
    "kg:displayFormat": "$103,102 (thousands)", // How to display
    "kg:originalText": "103102",              // As it appeared in source
    "kg:dataType": "xsd:decimal"
  }
}
```

### 2. Table Entity Schema

```javascript
{
  "uri": "data:Table_JKHY_2009_Page28",
  "type": "kg:Table",
  "properties": {
    "kg:sourceDocument": "JKHY/2009/page_28.pdf",
    "kg:documentId": "Single_JKHY/2009/page_28.pdf-3",
    "kg:caption": "Year ended June 30",
    "kg:rowCount": "6",
    "kg:columnCount": "3",
    "kg:hasColumnHeader": ["2009", "2008", "2007"],
    "kg:hasRowHeader": ["net income", "non-cash expenses", "change in receivables", ...]
  }
}
```

### 3. Cell Provenance

```javascript
{
  "uri": "data:Cell_Table_JKHY_R1C1",
  "type": "kg:TableCell",
  "properties": {
    "kg:row": "1",
    "kg:column": "1",
    "kg:rowLabel": "net income",
    "kg:columnLabel": "2009",
    "kg:cellValue": "data:FinVal_103102_USD_thousands"
  }
}
```

### 4. Full Linkage Chain

```
Document → Table → Cell → Observation → FinancialValue
```

```javascript
// Observation links to everything
{
  "uri": "data:Obs_JKHY_NetIncome_2009",
  "type": "kg:Observation",
  "relationships": [
    {"predicate": "kg:hasFinancialValue", "object": "data:FinVal_103102"},
    {"predicate": "kg:sourceTable", "object": "data:Table_JKHY_2009_Page28"},
    {"predicate": "kg:sourceCell", "object": "data:Cell_Table_JKHY_R1C1"},
    {"predicate": "kg:forOrganization", "object": "data:JKHY"},
    {"predicate": "kg:hasMetric", "object": "data:NetIncome"},
    {"predicate": "kg:forPeriod", "object": "data:Year_2009"}
  ]
}
```

## Components to Build

### 1. ValueExtractor Class

**Purpose**: Parse financial values from text and detect units/scale

```javascript
class ValueExtractor {
  extractValue(text) {
    // "$1M" → {value: 1.0, currency: "USD", scale: "millions", actual: 1000000}
    // "103,102 (thousands)" → {value: 103102, currency: "USD", scale: "thousands", actual: 103102000}
    // "14.1%" → {value: 14.1, unit: "percentage"}
  }

  normalizeValue(financialValue) {
    // Convert all to same scale for computation
  }
}
```

### 2. TableProvenanceBuilder Class

**Purpose**: Create Table and Cell entities with metadata

```javascript
class TableProvenanceBuilder {
  buildTableEntity(tableData, sourceDoc) {
    // Create Table entity with all metadata
  }

  buildCellEntities(table) {
    // Create Cell entity for each table cell
  }

  linkCellToValue(cellUri, valueUri) {
    // Link cell to its FinancialValue
  }
}
```

### 3. Update TableInstanceCreator

**Changes**:
- Parse table values to extract units/scale
- Create FinancialValue entities for each numeric cell
- Create Table and Cell entities for provenance
- Link everything together

### 4. Update TextInstanceCreator

**Changes**:
- Use ValueExtractor to parse values from text
- Create FinancialValue entities instead of bare strings
- Preserve originalText for traceability

## Testing Strategy

### Unit Tests

1. **ValueExtractor Tests**:
   - Extract "$1M" → structured value
   - Extract "103,102 (thousands)" → structured value
   - Extract "14.1%" → percentage value
   - Extract "(123.45)" → negative value
   - Handle malformed values gracefully

2. **TableProvenanceBuilder Tests**:
   - Create Table entity with correct metadata
   - Create Cell entities for all cells
   - Link cells to table correctly

### Integration Tests

1. **Table with Structured Values**:
   - Process ConvFinQA table
   - Verify FinancialValue entities created
   - Verify provenance chain complete
   - Verify can normalize values

2. **Text with Structured Values**:
   - Process "$1 million revenue"
   - Verify FinancialValue created
   - Verify units/scale correct

3. **End-to-End ConvFinQA**:
   - Process full ConvFinQA document
   - Query "net income 2009"
   - Verify returns normalized value with units
   - Trace back to source table/cell

4. **Question Answering**:
   - Query two values
   - Normalize to same scale
   - Compute percentage change
   - Verify calculation correct

## Implementation Steps

- [ ] Design and document FinancialValue schema
- [ ] Design and document Table/Cell schema
- [ ] Create ValueExtractor class
- [ ] Write ValueExtractor tests (5 tests)
- [ ] Create TableProvenanceBuilder class
- [ ] Write TableProvenanceBuilder tests (3 tests)
- [ ] Update TableInstanceCreator to use ValueExtractor
- [ ] Update TableInstanceCreator to create provenance
- [ ] Write integration test: table with structured values
- [ ] Update TextInstanceCreator to use ValueExtractor
- [ ] Write integration test: text with structured values
- [ ] Write integration test: full ConvFinQA with provenance
- [ ] Write integration test: query and normalize values
- [ ] Write integration test: trace value to source
- [ ] All Phase 7 tests pass (minimum 15 tests)

## Success Criteria

✅ All numeric values are FinancialValue objects with units/scale/currency
✅ Every table value has full provenance chain to source document/cell
✅ Can normalize values from different scales (thousands → actual amount)
✅ Can trace any fact back to exact source table and cell
✅ Can regenerate table structure from KG entities
✅ Ready for ConvFinQA question answering with proper value handling

## Impact on Question Answering

**Question**: "What is the percentage change in net income from 2008 to 2009?"

**Before Phase 7**:
```javascript
// Would fail - bare strings, no units
value2009 = "103102"  // What unit??
value2008 = "104222"  // Cannot compute!
```

**After Phase 7**:
```javascript
// Query KG
value2009 = {
  numericValue: 103102,
  currency: "USD",
  scale: "thousands",
  actualAmount: 103102000
}

value2008 = {
  numericValue: 104222,
  currency: "USD",
  scale: "thousands",
  actualAmount: 104222000
}

// Compute
change = (103102000 - 104222000) / 104222000
result = "-1.07%"

// Provide provenance
"Net income decreased by 1.07% from 2008 to 2009"
+ "Source: JKHY 2009 Annual Report, page 28, Table: Cash Flow Statement"
```

This is what makes the system actually useful for ConvFinQA!
