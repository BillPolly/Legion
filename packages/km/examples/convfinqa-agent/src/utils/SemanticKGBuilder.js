/**
 * Semantic Knowledge Graph Builder
 *
 * Properly parses financial tables by:
 * 1. Understanding table structure semantically
 * 2. Extracting facts (not string matching row labels!)
 * 3. Instantiating ontology concepts properly
 */

export class SemanticKGBuilder {
  constructor(kgStore, ontologyStore, llmClient) {
    this.kgStore = kgStore;
    this.ontologyStore = ontologyStore;
    this.llmClient = llmClient;
  }

  /**
   * Build KG from table by understanding it semantically
   *
   * @param {Array<Array<string>>} table - Table data
   * @param {Array<string>} context - Text context
   * @returns {Object} Stats about KG building
   */
  async buildFromTable(table, context = []) {
    if (!table || table.length < 2) {
      throw new Error('Table must have at least a header row and one data row');
    }

    // Step 1: Understand the table structure using LLM
    const tableStructure = await this._understandTableStructure(table, context);

    // Step 2: Verify ontology has the required concepts
    await this._verifyOntology(tableStructure);

    // Step 3: Extract and instantiate facts
    const facts = await this._extractFacts(table, tableStructure);

    // Step 4: Store facts in KG
    await this._storeFacts(facts);

    return {
      instances: facts.length,
      triples: facts.length * 4, // Each fact has ~4 triples
      tableStructure
    };
  }

  /**
   * Step 1: Use LLM to understand what this table represents
   */
  async _understandTableStructure(table, context) {
    const contextText = context.slice(0, 5).join(' '); // First few sentences of context

    const prompt = `Analyze this financial table structure and identify its semantic components.

Context: ${contextText}

Complete Table:
${table.map((row, i) => `Row ${i}: ${JSON.stringify(row)}`).join('\n')}

Identify:
1. **Table Type**: What kind of financial statement is this? (e.g., "Cash Flow Statement", "Income Statement", "Balance Sheet")
2. **Header Row**: Which row contains column headers (usually row 0)?
3. **Year Columns**: Which columns contain years/periods? List the column indices and year values.
4. **Metric Label Column**: Which column contains the metric names/descriptions? (usually column 0)
5. **Data Rows**: Which rows contain actual metric data (not headers)? List ALL data rows, even the last ones.

IMPORTANT: List ALL rows that contain financial metrics, including rows at the end of the table.

Respond with JSON:
{
  "tableType": "Cash Flow Statement",
  "headerRow": 0,
  "yearColumns": [
    {"index": 1, "year": "2009"},
    {"index": 2, "year": "2008"}
  ],
  "metricLabelColumn": 0,
  "dataRows": [1, 2, 3, 4, 5, 6]
}`;

    const response = await this.llmClient.request({
      prompt,
      maxTokens: 1000,
      temperature: 0
    });

    return this._parseJSON(response.content);
  }

  /**
   * Step 2: Verify ontology has required concepts
   */
  async _verifyOntology(tableStructure) {
    // Check for FinancialMetric class
    const financialMetricClass = await this.ontologyStore.query('kg:FinancialMetric', 'rdf:type', 'owl:Class');

    if (financialMetricClass.length === 0) {
      throw new Error(
        `Ontology missing required class: kg:FinancialMetric\n` +
        `The ontology must define abstract concepts for representing financial data.\n` +
        `Required classes: FinancialMetric\n` +
        `Required properties: metricType, value, year, unit`
      );
    }

    // Check for required properties
    const requiredProps = ['kg:metricType', 'kg:value', 'kg:year'];
    for (const prop of requiredProps) {
      const propExists = await this.ontologyStore.query(prop, 'rdf:type', 'owl:DatatypeProperty');
      if (propExists.length === 0) {
        throw new Error(
          `Ontology missing required property: ${prop}\n` +
          `The ontology must define properties for FinancialMetric instances.`
        );
      }
    }
  }

  /**
   * Step 3: Extract facts from table
   */
  async _extractFacts(table, tableStructure) {
    const facts = [];

    // For each data row, extract metrics for each year
    for (const rowIdx of tableStructure.dataRows) {
      if (rowIdx >= table.length) continue;

      const row = table[rowIdx];
      const metricLabel = row[tableStructure.metricLabelColumn]?.trim();

      if (!metricLabel) continue;

      // Normalize the metric label (use LLM to get canonical form)
      const normalizedMetricType = await this._normalizeMetricType(metricLabel);

      // For each year column, create a fact
      for (const yearCol of tableStructure.yearColumns) {
        const cellValue = row[yearCol.index];
        if (!cellValue) continue;

        const parsedValue = this._parseValue(cellValue);

        // Create a fact
        const fact = {
          instanceId: this._createInstanceId(normalizedMetricType, yearCol.year),
          type: 'kg:FinancialMetric',
          properties: {
            'kg:metricType': normalizedMetricType,
            'kg:value': parsedValue,
            'kg:year': yearCol.year,
            'kg:unit': 'thousands' // TODO: detect from context
          }
        };

        facts.push(fact);
      }
    }

    return facts;
  }

  /**
   * Normalize metric type to canonical form
   */
  async _normalizeMetricType(metricLabel) {
    // Simple normalization for now - lowercase, remove special chars
    return metricLabel
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Create instance ID from metric type and year
   */
  _createInstanceId(metricType, year) {
    return `metric_${metricType}_${year}`;
  }

  /**
   * Parse cell value (handle currency, percentages, parentheses for negatives)
   */
  _parseValue(value) {
    if (!value) return null;

    let str = String(value).trim();

    // Handle parentheses as negative (accounting notation)
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
   * Step 4: Store facts as RDF triples
   */
  async _storeFacts(facts) {
    for (const fact of facts) {
      const instance = `kg:${fact.instanceId}`;

      // Type triple
      await this.kgStore.addTriple(instance, 'rdf:type', fact.type);

      // Property triples
      for (const [prop, value] of Object.entries(fact.properties)) {
        if (value === null || value === undefined) continue;

        // Store as literal or string
        const literalValue = typeof value === 'number' ? value : `"${value}"`;
        await this.kgStore.addTriple(instance, prop, literalValue);
      }
    }
  }

  /**
   * Parse JSON from LLM response
   */
  _parseJSON(responseText) {
    try {
      // Remove markdown code blocks if present
      let jsonText = responseText;
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }

      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}\nResponse: ${responseText}`);
    }
  }
}
