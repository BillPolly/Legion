/**
 * Simple Table Processor
 *
 * Three-step process:
 * 1. Analyze table structure and add concepts to ontology
 * 2. Create KG instances using those concepts
 * 3. Extract facts from text and add to KG
 */

import { TextProcessor } from './TextProcessor.js';

export class SimpleTableProcessor {
  constructor(ontologyStore, kgStore, llmClient, ontologyIndexer = null) {
    this.ontologyStore = ontologyStore;
    this.kgStore = kgStore;
    this.llmClient = llmClient;
    this.ontologyIndexer = ontologyIndexer;
    this.textProcessor = llmClient ? new TextProcessor(llmClient) : null;
  }

  /**
   * Process table: analyze structure, update ontology, create instances, extract text facts
   */
  async processTable(table, context = []) {
    if (!table || table.length < 2) {
      throw new Error('Table must have at least 2 rows');
    }

    // Step 1: Understand table structure
    const structure = await this._analyzeTableStructure(table, context);

    // Step 2: Ensure ontology has required concepts
    await this._ensureOntologyConcepts(structure);

    // Step 3: Extract and store table metadata
    await this._storeTableMetadata(table, structure);

    // Step 4: Create KG instances from table
    await this._createInstances(table, structure);

    // Calculate instances created
    let instancesCreated = 0;
    if (structure.tableType === 'time-series' && structure.yearColumns && structure.yearColumns.length > 0) {
      instancesCreated = structure.dataRows.length * structure.yearColumns.length;
    } else if (structure.tableType === 'categorical' && structure.categoryColumns && structure.categoryColumns.length > 0) {
      instancesCreated = structure.dataRows.length * structure.categoryColumns.length;
    }

    // Step 4: Extract facts from text and add to KG
    let textFacts = 0;
    if (this.textProcessor && context && context.length > 0) {
      try {
        // Build table context for text processor
        const years = structure.yearColumns
          ? structure.yearColumns.map(yc => yc.year)
          : [];

        const tableContext = {
          years,
          currentYear: years[years.length - 1],
          priorYear: years[years.length - 2],
          twoYearsAgo: years[years.length - 3],
          entityType: structure.entityType
        };

        // Extract facts from text
        const facts = await this.textProcessor.extractFacts(context, tableContext);

        if (facts.length > 0) {
          // Convert facts to triples and add to KG
          const entityClass = `kg:${structure.entityType}`;
          const triples = this.textProcessor.factsToTriples(facts, entityClass);

          for (const triple of triples) {
            await this.kgStore.addTriple(triple.subject, triple.predicate, triple.object);
          }

          textFacts = facts.length;
          console.log(`  ✓ Added ${facts.length} text-derived facts to KG`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to process text: ${error.message}`);
      }
    }

    return {
      success: true,
      structure,
      instancesCreated,
      textFacts
    };
  }

  /**
   * Step 1: Analyze table structure and semantics using LLM
   */
  async _analyzeTableStructure(table, context) {
    // Pass ALL context, not just first 5 sentences
    const contextText = context.join('\n');

    const prompt = `Analyze this financial table and provide a COMPLETE semantic understanding.

FULL CONTEXT (pre and post text):
${contextText}

TABLE DATA:
${table.map((row, i) => `Row ${i}: ${JSON.stringify(row)}`).join('\n')}

CRITICAL INSTRUCTIONS:

1. **Identify Table Type**:
   - Is this a TIME-SERIES table with year/period columns? (e.g., columns like "2004", "2005", or "year ended december 31 2008")
   - OR is this a CATEGORICAL table? (e.g., columns like "less than 1 year", "1-3 years", "total")

2. **Entity Type**: What does each row represent? (e.g., "PerformanceIndex", "CashFlowMetric", "BalanceSheetItem")

3. **Table Structure**:
   - Header Row: Which row has column headers (usually 0)?
   - **Year Columns** (ONLY if time-series table):
     * Extract ACTUAL YEAR VALUES from complex headers like "year ended december 31 2008 (unaudited)" → "2008"
     * List column indices and CLEAN year values (just the number, e.g., "2008" not the full header text)
     * If NOT a time-series table, set yearColumns to null or empty array
   - Data Rows: Which rows have actual data (not headers)?
   - Row Label Column: Which column has row labels (usually 0)?

4. **Value Semantics** (CRITICAL):
   - What do the numerical values represent?
   - Are they absolute values, percentages, index values, or something else?
   - If they're index values, what is the baseline? (e.g., "All values start from $100 in 2004")
   - How should these values be interpreted to answer percentage/ratio questions?
   - Should values be converted before storing? (e.g., "Convert index values to percentage returns: (value - 100)")

5. **Calculation Context**:
   - If someone asks for "percentage return" or "percentage change", what calculation should be done?
   - Is there a baseline year or value to compare against?

RESPONSE FORMAT:

For TIME-SERIES tables:
{
  "tableType": "time-series",
  "entityType": "PerformanceIndex",
  "headerRow": 0,
  "yearColumns": [{"index": 1, "year": "2004"}, {"index": 2, "year": "2005"}],
  "dataRows": [1, 2, 3],
  "rowLabelColumn": 0,
  "valueSemantics": {
    "type": "indexed_cumulative_return",
    "description": "Values are cumulative returns indexed to $100 in 2004.",
    "baselineYear": "2004",
    "baselineValue": 100,
    "conversionFormula": "(value - 100) represents percentage return from baseline"
  }
}

For CATEGORICAL tables (NO year columns):
{
  "tableType": "categorical",
  "entityType": "ContractualObligations",
  "headerRow": 0,
  "yearColumns": null,
  "dataRows": [1, 2, 3],
  "rowLabelColumn": 0,
  "categoryColumns": [{"index": 1, "category": "less than 1 year"}, {"index": 2, "category": "1-3 years"}],
  "valueSemantics": {
    "type": "absolute_values",
    "description": "Values are absolute dollar amounts for different time periods"
  }
}`;

    const response = await this.llmClient.request({
      prompt,
      maxTokens: 1500,
      temperature: 0
    });

    return this._parseJSON(response.content);
  }

  /**
   * Step 2: Ensure ontology has the entity type and properties
   */
  async _ensureOntologyConcepts(structure) {
    const entityClass = `kg:${structure.entityType}`;

    // Check if class exists
    const classExists = await this.ontologyStore.query(entityClass, 'rdf:type', 'owl:Class');

    if (classExists.length === 0) {
      // Add entity class
      await this.ontologyStore.addTriple(entityClass, 'rdf:type', 'owl:Class');
      await this.ontologyStore.addTriple(entityClass, 'rdfs:label', `"${structure.entityType}"`);

      // Add description for semantic indexing
      if (structure.tableType && structure.valueSemantics) {
        const description = `${structure.entityType} from ${structure.tableType} table. ${structure.valueSemantics.description || ''}`;
        await this.ontologyStore.addTriple(entityClass, 'skos:definition', `"${description}"`);
      }

      console.log(`  ✓ Added class: ${entityClass}`);

      // Index in semantic search
      if (this.ontologyIndexer) {
        await this.ontologyIndexer.indexClass(entityClass, structure.entityType);
        console.log(`  ✓ Indexed class: ${entityClass}`);
      }
    }

    // Ensure standard properties exist
    const standardProps = [
      { uri: 'kg:value', label: 'value', range: 'xsd:decimal' },
      { uri: 'kg:year', label: 'year', range: 'xsd:string' },
      { uri: 'kg:label', label: 'label', range: 'xsd:string' },
      { uri: 'kg:category', label: 'category', range: 'xsd:string' },
      { uri: 'kg:valueType', label: 'valueType', range: 'xsd:string' },
      { uri: 'kg:valueDescription', label: 'valueDescription', range: 'xsd:string' }
    ];

    for (const prop of standardProps) {
      const propExists = await this.ontologyStore.query(prop.uri, 'rdf:type', 'owl:DatatypeProperty');

      if (propExists.length === 0) {
        await this.ontologyStore.addTriple(prop.uri, 'rdf:type', 'owl:DatatypeProperty');
        await this.ontologyStore.addTriple(prop.uri, 'rdfs:label', `"${prop.label}"`);
        await this.ontologyStore.addTriple(prop.uri, 'rdfs:range', prop.range);
        console.log(`  ✓ Added property: ${prop.uri}`);
      }
    }
  }

  /**
   * Step 3: Create KG instances from table data
   */
  async _createInstances(table, structure) {
    const entityClass = `kg:${structure.entityType}`;

    // Handle time-series tables
    if (structure.tableType === 'time-series' && structure.yearColumns && structure.yearColumns.length > 0) {
      await this._createTimeSeriesInstances(table, structure, entityClass);
    }
    // Handle categorical tables
    else if (structure.tableType === 'categorical' && structure.categoryColumns && structure.categoryColumns.length > 0) {
      await this._createCategoricalInstances(table, structure, entityClass);
    }
    // Fallback: try to process as time-series if yearColumns exist
    else if (structure.yearColumns && structure.yearColumns.length > 0) {
      await this._createTimeSeriesInstances(table, structure, entityClass);
    }
  }

  /**
   * Create instances for time-series tables (year-based columns)
   */
  async _createTimeSeriesInstances(table, structure, entityClass) {
    for (const rowIdx of structure.dataRows) {
      if (rowIdx >= table.length) continue;

      const row = table[rowIdx];
      const rowLabel = row[structure.rowLabelColumn]?.trim();

      if (!rowLabel) continue;

      // Normalize label for instance ID
      const normalizedLabel = rowLabel
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');

      // Create instance for each year column
      for (const yearCol of structure.yearColumns) {
        const cellValue = row[yearCol.index];
        if (!cellValue) continue;

        const parsedValue = this._parseValue(cellValue);

        // Apply value conversion if needed based on semantics
        // Returns { raw, canonical, unit, formatted }
        const valueInfo = this._convertValue(parsedValue, structure.valueSemantics, yearCol.year, String(cellValue));

        const instanceId = `kg:instance_${normalizedLabel}_${yearCol.year}`;

        // Add instance triples
        await this.kgStore.addTriple(instanceId, 'rdf:type', entityClass);
        await this.kgStore.addTriple(instanceId, 'kg:label', `"${rowLabel}"`);

        // Store BOTH raw and canonical values
        await this.kgStore.addTriple(instanceId, 'kg:rawValue', valueInfo.raw); // Original numeric value
        await this.kgStore.addTriple(instanceId, 'kg:value', valueInfo.canonical); // Canonical for calculations
        await this.kgStore.addTriple(instanceId, 'kg:rawValueString', `"${valueInfo.formatted}"`); // Original formatted string
        if (valueInfo.unit) {
          await this.kgStore.addTriple(instanceId, 'kg:unit', `"${valueInfo.unit}"`);
        }

        await this.kgStore.addTriple(instanceId, 'kg:year', `"${yearCol.year}"`);

        // Store semantic context as metadata if available
        if (structure.valueSemantics) {
          await this.kgStore.addTriple(instanceId, 'kg:valueType', `"${structure.valueSemantics.type || 'raw'}"`);
          if (structure.valueSemantics.description) {
            await this.kgStore.addTriple(instanceId, 'kg:valueDescription', `"${structure.valueSemantics.description}"`);
          }
        }
      }
    }
  }

  /**
   * Create instances for categorical tables (category-based columns)
   */
  async _createCategoricalInstances(table, structure, entityClass) {
    for (const rowIdx of structure.dataRows) {
      if (rowIdx >= table.length) continue;

      const row = table[rowIdx];
      const rowLabel = row[structure.rowLabelColumn]?.trim();

      if (!rowLabel) continue;

      // Normalize label for instance ID
      const normalizedLabel = rowLabel
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');

      // Create instance for each category column
      for (const catCol of structure.categoryColumns) {
        const cellValue = row[catCol.index];
        if (!cellValue) continue;

        const parsedValue = this._parseValue(cellValue);

        // Apply value conversion if needed based on semantics
        // Returns { raw, canonical, unit, formatted }
        const valueInfo = this._convertValue(parsedValue, structure.valueSemantics, null, String(cellValue));

        const normalizedCategory = catCol.category
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_');

        const instanceId = `kg:instance_${normalizedLabel}_${normalizedCategory}`;

        // Add instance triples
        await this.kgStore.addTriple(instanceId, 'rdf:type', entityClass);
        await this.kgStore.addTriple(instanceId, 'kg:label', `"${rowLabel}"`);

        // Store BOTH raw and canonical values
        await this.kgStore.addTriple(instanceId, 'kg:rawValue', valueInfo.raw);
        await this.kgStore.addTriple(instanceId, 'kg:value', valueInfo.canonical);
        await this.kgStore.addTriple(instanceId, 'kg:rawValueString', `"${valueInfo.formatted}"`);
        if (valueInfo.unit) {
          await this.kgStore.addTriple(instanceId, 'kg:unit', `"${valueInfo.unit}"`);
        }

        await this.kgStore.addTriple(instanceId, 'kg:category', `"${catCol.category}"`);

        // Store semantic context as metadata if available
        if (structure.valueSemantics) {
          await this.kgStore.addTriple(instanceId, 'kg:valueType', `"${structure.valueSemantics.type || 'raw'}"`);
          if (structure.valueSemantics.description) {
            await this.kgStore.addTriple(instanceId, 'kg:valueDescription', `"${structure.valueSemantics.description}"`);
          }
        }
      }
    }
  }

  /**
   * Convert value based on semantic understanding
   * Returns object with both raw and canonical values
   *
   * @param {number} value - Parsed numeric value
   * @param {Object} valueSemantics - Semantic information about values
   * @param {string} year - Year (for time-series data)
   * @param {string} formattedString - Original formatted string from table
   * @returns {Object} { raw, canonical, unit, formatted }
   */
  _convertValue(value, valueSemantics, year, formattedString) {
    if (value === null) {
      return { raw: null, canonical: null, unit: null, formatted: formattedString || '' };
    }

    // Determine unit from formatted string
    let unit = null;
    if (formattedString) {
      if (formattedString.includes('$')) unit = 'dollars';
      else if (formattedString.includes('%')) unit = 'percent';
      else if (formattedString.toLowerCase().includes('billion')) unit = 'billion';
      else if (formattedString.toLowerCase().includes('million')) unit = 'million';
    }

    // Check if this is an indexed value that should be converted to percentage
    if (valueSemantics && (valueSemantics.type === 'indexed_cumulative_return' ||
                           valueSemantics.type === 'index_value')) {

      const baseline = valueSemantics.baselineValue || 100;
      const baselineYear = valueSemantics.baselineYear;

      // Baseline year: raw value, canonical = 0%
      if (year === baselineYear) {
        console.log(`  ✓ Baseline year ${year}: raw=${value}, canonical=0% (baseline)`);
        return {
          raw: value,
          canonical: 0,
          unit: unit || 'percent',
          formatted: formattedString || String(value)
        };
      }

      // Convert: (value - baseline) = percentage return
      const percentageReturn = value - baseline;

      console.log(`  ✓ Converted index: raw=${value}, canonical=${percentageReturn}% (return from baseline)`);
      return {
        raw: value,
        canonical: percentageReturn,
        unit: unit || 'percent',
        formatted: formattedString || String(value)
      };
    }

    // For non-indexed values, raw and canonical are the same
    return {
      raw: value,
      canonical: value,
      unit: unit,
      formatted: formattedString || String(value)
    };
  }

  /**
   * Parse cell value (handle currency, percentages, parentheses)
   */
  _parseValue(value) {
    if (!value) return null;

    let str = String(value).trim();

    // Handle parentheses as negative
    const isNegative = str.includes('(') && str.includes(')');
    if (isNegative) {
      str = str.replace(/[()]/g, '').trim();
    }

    // Remove currency symbols and commas
    str = str.replace(/[$,]/g, '');

    // Parse number
    const num = parseFloat(str);

    if (isNaN(num)) return null;

    return isNegative ? -num : num;
  }

  /**
   * Parse JSON from LLM response
   */
  _parseJSON(responseText) {
    try {
      // Try code block first
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1]);
      }

      // Extract first complete JSON object by balancing braces
      const startIdx = responseText.indexOf('{');
      if (startIdx === -1) {
        throw new Error('No JSON object found');
      }

      let braceCount = 0;
      let endIdx = startIdx;

      for (let i = startIdx; i < responseText.length; i++) {
        if (responseText[i] === '{') braceCount++;
        if (responseText[i] === '}') braceCount--;

        if (braceCount === 0) {
          endIdx = i;
          break;
        }
      }

      const jsonText = responseText.substring(startIdx, endIdx + 1);
      return JSON.parse(jsonText);

    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}\nResponse: ${responseText}`);
    }
  }

  /**
   * Extract and store table-level metadata
   * This captures format conventions that should influence output formatting
   */
  async _storeTableMetadata(table, structure) {
    const metadataId = 'kg:tableMetadata';

    // Analyze percentage formatting in table
    const percentageInfo = this._analyzePercentageFormatting(table);

    // Analyze scaling (millions, billions, etc.)
    const scalingInfo = this._analyzeScaling(table);

    // Store metadata as triples
    await this.kgStore.addTriple(metadataId, 'rdf:type', 'kg:TableMetadata');
    await this.kgStore.addTriple(metadataId, 'kg:tableType', `"${structure.tableType}"`);

    if (percentageInfo.containsPercentages) {
      await this.kgStore.addTriple(metadataId, 'kg:containsPercentages', 'true');
      await this.kgStore.addTriple(metadataId, 'kg:percentagePrecision', percentageInfo.precision);
      await this.kgStore.addTriple(metadataId, 'kg:percentageExamples', `"${percentageInfo.examples.join(', ')}"`);
    } else {
      await this.kgStore.addTriple(metadataId, 'kg:containsPercentages', 'false');
    }

    if (scalingInfo.scalingFactor) {
      await this.kgStore.addTriple(metadataId, 'kg:scalingFactor', `"${scalingInfo.scalingFactor}"`);
    }

    console.log(`  ✓ Stored table metadata: ${percentageInfo.containsPercentages ? `percentages (${percentageInfo.precision} decimals)` : 'no percentages'}, scaling: ${scalingInfo.scalingFactor || 'none'}`);
  }

  /**
   * Analyze percentage formatting conventions in the table
   */
  _analyzePercentageFormatting(table) {
    const percentages = [];

    // Scan all cells for percentages
    for (const row of table) {
      for (const cell of row) {
        const cellStr = String(cell);
        // Match patterns like "28%", "23.5%", "0.123%"
        const percentMatch = cellStr.match(/(\d+(?:\.\d+)?)%/g);
        if (percentMatch) {
          percentages.push(...percentMatch);
        }
      }
    }

    if (percentages.length === 0) {
      return { containsPercentages: false, precision: null, examples: [] };
    }

    // Determine precision by looking at decimal places
    const precisions = percentages.map(p => {
      const numStr = p.replace('%', '');
      const decimalIndex = numStr.indexOf('.');
      if (decimalIndex === -1) return 0;
      return numStr.length - decimalIndex - 1;
    });

    // Use the most common precision
    const precisionCounts = {};
    for (const prec of precisions) {
      precisionCounts[prec] = (precisionCounts[prec] || 0) + 1;
    }

    const mostCommonPrecision = Object.keys(precisionCounts).reduce((a, b) =>
      precisionCounts[a] > precisionCounts[b] ? a : b
    );

    return {
      containsPercentages: true,
      precision: parseInt(mostCommonPrecision),
      examples: percentages.slice(0, 5) // Store first 5 examples
    };
  }

  /**
   * Analyze scaling factors in the table (millions, billions, etc.)
   */
  _analyzeScaling(table) {
    // Check header rows and first few rows for scaling indicators
    const firstRows = table.slice(0, 3).flat();
    const textContent = firstRows.join(' ').toLowerCase();

    if (textContent.includes('in millions') || textContent.includes('(in millions)')) {
      return { scalingFactor: 'millions' };
    }
    if (textContent.includes('in billions') || textContent.includes('(in billions)')) {
      return { scalingFactor: 'billions' };
    }
    if (textContent.includes('in thousands') || textContent.includes('(in thousands)')) {
      return { scalingFactor: 'thousands' };
    }

    return { scalingFactor: null };
  }
}
