/**
 * TableProcessor - Converts structured tables to KG instances (ABox)
 *
 * Takes tabular data and generates RDF triples for instances of ontology classes.
 * Supports Z3 verification of instances against the ontology schema.
 */

export class TableProcessor {
  /**
   * @param {Object} tripleStore - Triple store for querying ontology schema
   * @param {Object} verification - Optional Z3 verification service
   */
  constructor(tripleStore, verification = null) {
    if (!tripleStore) {
      throw new Error('TableProcessor requires a triple store');
    }

    this.tripleStore = tripleStore;
    this.verification = verification;
  }

  /**
   * Process financial table and generate KG instances
   *
   * @param {Array<Array<string>>} tableData - 2D array [rows][columns]
   * @param {Object} metadata - Configuration for instance generation
   * @param {string} metadata.entityClass - OWL class for instances (e.g., "kg:StockOption")
   * @param {string} metadata.entityPrefix - Prefix for instance URIs (e.g., "MRO_StockOption")
   * @param {number} metadata.headerRow - Row index containing column headers (default: 0)
   * @param {Array<number>} metadata.instanceColumns - Column indices that define instances (e.g., [1, 2, 3] for years)
   * @param {Object} metadata.propertyMap - Map row labels to OWL properties
   *
   * @returns {Object} Statistics about created instances
   */
  async processFinancialTable(tableData, metadata) {
    const {
      entityClass,
      entityPrefix,
      headerRow = 0,
      instanceColumns,
      propertyMap = {}
    } = metadata;

    // Validate inputs
    if (!tableData || tableData.length === 0) {
      throw new Error('TableProcessor: tableData cannot be empty');
    }

    if (!entityClass || !entityClass.startsWith('kg:')) {
      throw new Error(`TableProcessor: entityClass must start with 'kg:', got: ${entityClass}`);
    }

    if (!entityPrefix) {
      throw new Error('TableProcessor: entityPrefix is required');
    }

    if (!instanceColumns || instanceColumns.length === 0) {
      throw new Error('TableProcessor: instanceColumns is required');
    }

    // Verify entity class exists in ontology
    const classExists = await this.tripleStore.query(entityClass, 'rdf:type', 'owl:Class');
    if (classExists.length === 0) {
      throw new Error(`TableProcessor: Entity class ${entityClass} does not exist in ontology`);
    }

    const stats = {
      instancesCreated: 0,
      propertiesAsserted: 0,
      verificationsRun: 0,
      violationsDetected: 0
    };

    // Extract header row
    const headers = tableData[headerRow];
    const instanceHeaders = instanceColumns.map(col => headers[col]);

    console.log(`\n📊 Processing table: ${instanceHeaders.join(', ')}`);

    // Collect all triples before adding (for verification)
    const allTriples = [];

    // Process data rows (skip header)
    for (let rowIdx = headerRow + 1; rowIdx < tableData.length; rowIdx++) {
      const row = tableData[rowIdx];
      const rowLabel = row[0]; // First column is row label

      if (!rowLabel || rowLabel.trim() === '') {
        continue; // Skip empty rows
      }

      // Determine property URI from row label
      const propertyUri = this._getPropertyUri(rowLabel, propertyMap);

      if (!propertyUri) {
        console.warn(`  ⚠️  No property mapping for row: "${rowLabel}"`);
        continue;
      }

      // Create property assertions for each instance column
      for (const colIdx of instanceColumns) {
        const columnHeader = headers[colIdx];
        const cellValue = row[colIdx];

        if (!cellValue || cellValue.trim() === '') {
          continue; // Skip empty cells
        }

        // Generate instance URI
        const instanceUri = `kg:${entityPrefix}_${columnHeader}`;

        // Parse value (handle currency, percentages, etc.)
        const parsedValue = this._parseValue(cellValue);

        // Create triples for this cell
        const triples = [
          // Instance declaration
          [instanceUri, 'rdf:type', entityClass],
          // Property assertion
          [instanceUri, propertyUri, parsedValue]
        ];

        allTriples.push(...triples);
      }
    }

    // Pre-verification: Check all triples before adding
    if (this.verification && this.verification.config.enabled) {
      console.log(`\n🔐 Verifying ${allTriples.length} instance triples with Z3...`);

      const existingTriples = await this._getExistingTriples();
      const verifyResult = await this.verification.verifier.checkAddition(existingTriples, allTriples);

      stats.verificationsRun++;

      if (!verifyResult.consistent) {
        stats.violationsDetected++;
        console.warn('⚠️  Instance data would violate ontology axioms!');
        console.warn('Violations:', verifyResult.violations);

        if (this.verification.config.failOnViolation) {
          throw new Error(`Z3 verification failed: ${verifyResult.violations.join(', ')}`);
        }

        return {
          success: false,
          violations: verifyResult.violations,
          ...stats
        };
      }

      console.log('✅ All instances are consistent with ontology schema');
    }

    // Add all triples to triple store
    for (const [subject, predicate, object] of allTriples) {
      await this.tripleStore.add(subject, predicate, object);

      // Track stats
      if (predicate === 'rdf:type') {
        stats.instancesCreated++;
      } else {
        stats.propertiesAsserted++;
      }
    }

    console.log(`\n✅ Created ${stats.instancesCreated} instances with ${stats.propertiesAsserted} properties`);

    return {
      success: true,
      ...stats
    };
  }

  /**
   * Get property URI from row label using property map
   *
   * @param {string} rowLabel - Row label from table
   * @param {Object} propertyMap - Map of labels to property URIs
   * @returns {string|null} Property URI or null if not found
   */
  _getPropertyUri(rowLabel, propertyMap) {
    const normalized = rowLabel.toLowerCase().trim();

    // Check exact match first
    if (propertyMap[normalized]) {
      return propertyMap[normalized];
    }

    // Check partial match (fuzzy matching)
    for (const [key, value] of Object.entries(propertyMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Parse cell value into appropriate RDF literal
   *
   * Handles:
   * - Currency: "$ 60.94" → "60.94"^^xsd:decimal
   * - Percentages: "27%" → "0.27"^^xsd:decimal
   * - Years: "5.0" → "5.0"^^xsd:decimal
   * - Plain numbers: "60.94" → "60.94"^^xsd:decimal
   *
   * @param {string} value - Raw cell value
   * @returns {string} RDF literal with datatype
   */
  _parseValue(value) {
    const trimmed = value.trim();

    // Currency: "$ 60.94" or "$60.94"
    if (trimmed.startsWith('$')) {
      const numeric = trimmed.replace(/[$,\s]/g, '');
      return `"${numeric}"^^xsd:decimal`;
    }

    // Percentage: "27%" or "27% ( 27 % )"
    if (trimmed.includes('%')) {
      const numeric = trimmed.match(/(\d+(\.\d+)?)/);
      if (numeric) {
        const decimal = (parseFloat(numeric[1]) / 100).toFixed(4);
        return `"${decimal}"^^xsd:decimal`;
      }
    }

    // Plain number: "5.0" or "60.94"
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return `"${trimmed}"^^xsd:decimal`;
    }

    // Default: string literal
    return `"${trimmed}"^^xsd:string`;
  }

  /**
   * Get all existing triples from triple store for verification
   *
   * @returns {Array<Array<string>>} Array of [subject, predicate, object] triples
   */
  async _getExistingTriples() {
    const predicates = [
      'rdf:type',
      'rdfs:subClassOf',
      'owl:disjointWith',
      'rdfs:domain',
      'rdfs:range',
      'owl:equivalentClass',
      'owl:inverseOf'
    ];

    const triples = [];

    for (const predicate of predicates) {
      const results = await this.tripleStore.query(null, predicate, null);
      for (const result of results) {
        if (result[0] && result[2]) {
          triples.push([result[0], predicate, result[2]]);
        }
      }
    }

    return triples;
  }
}
