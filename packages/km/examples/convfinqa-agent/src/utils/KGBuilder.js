/**
 * KGBuilder - Builds instance-level knowledge graph from tables and text
 *
 * Takes ConvFinQA table data and text and creates ABox triples using the pre-built ontology.
 * Uses LLM-driven metadata extraction instead of regex parsing.
 */

import { TableMetadataExtractor } from './TableMetadataExtractor.js';
import { TextProcessor } from './TextProcessor.js';
import { CanonicalLabelService } from './CanonicalLabelService.js';

export class KGBuilder {
  constructor({ instanceStore, ontologyStore, llmClient = null, metadataStore = null }) {
    this.kgStore = instanceStore;
    this.ontologyStore = ontologyStore;
    this.metadataStore = metadataStore;
    this.metadataExtractor = llmClient ? new TableMetadataExtractor({ llmClient, logger: console }) : null;
    this.textProcessor = llmClient ? new TextProcessor(llmClient) : null;
  }

  /**
   * Build KG instances from table data
   *
   * @param {Array<Array<string>>} table - Table data (2D array)
   * @param {Object} options - Options object
   * @param {Array<string>} options.context - Text data for context
   * @param {string} options.conversationId - Conversation ID for tracking
   * @returns {Promise<Object>} Stats about created KG
   */
  async buildFromTable(table, options = {}) {
    const { context = [], conversationId = null } = options;

    if (!this.metadataExtractor) {
      throw new Error('TableMetadataExtractor required - pass llmClient to constructor');
    }

    // Step 1: Extract table metadata using LLM
    const metadata = await this.metadataExtractor.getOrExtractMetadata(
      this.metadataStore,
      conversationId,
      table,
      context
    );

    console.log(`  Extracted metadata: ${metadata.tableDescription}`);
    console.log(`  Year columns: ${metadata.yearColumns.map(yc => yc.year).join(', ')}`);
    console.log(`  Row metadata: ${metadata.rowMetadata.length} rows`);

    // Step 2: Detect entity type from ontology
    const dataRows = table.slice(1); // Exclude header
    const entityType = await this._detectEntityType(context, dataRows);

    if (!entityType) {
      throw new Error('Could not detect entity type from table and text');
    }

    console.log(`  Detected entity type: ${entityType}`);

    // Step 3: Build property map using metadata
    let propertyMap;

    // For categorical tables, build property map from column headers
    if (metadata.yearColumns.length === 0) {
      propertyMap = await this._buildPropertyMapFromColumnHeaders(table[0], entityType);
    } else {
      // For time-series tables, build from row metadata
      propertyMap = await this._buildPropertyMapFromMetadata(metadata.rowMetadata, entityType);
    }

    console.log(`  Mapped ${Object.keys(propertyMap).length} properties`);

    // Step 4: Create instances for each year column OR row (categorical tables)
    const stats = {
      instances: 0,
      triples: 0,
      entityType,
      textFacts: 0
    };

    // Handle categorical tables (no year columns)
    if (metadata.yearColumns.length === 0) {
      console.log(`  ⚠️  No year columns detected - treating as categorical table`);

      // For categorical tables, create one instance per row
      // Row labels become instance identifiers
      for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
        const dataRow = dataRows[rowIdx];
        const rowLabel = String(dataRow[0]).trim();

        if (!rowLabel) continue;

        // Create instance URI from row label (use toPropertyName for URI-safe format)
        const canonicalLabel = CanonicalLabelService.canonicalize(rowLabel);
        const uriSafeLabel = CanonicalLabelService.toPropertyName(canonicalLabel);
        const instanceUri = `kg:${entityType.split(':')[1]}_${uriSafeLabel}`;

        // Create instance type triple
        await this.kgStore.addTriple(instanceUri, 'rdf:type', entityType);
        stats.instances++;
        stats.triples++;

        // Add label
        await this.kgStore.addTriple(instanceUri, 'rdfs:label', `"${rowLabel}"`);
        stats.triples++;

        // Add original_label for exact matching
        await this.kgStore.addTriple(instanceUri, 'kg:original_label', `"${rowLabel}"`);
        stats.triples++;

        // For each column (starting from column 1, since column 0 is the row label)
        for (let colIdx = 1; colIdx < table[0].length; colIdx++) {
          const columnHeader = String(table[0][colIdx]).trim();
          const cellValue = dataRow[colIdx];

          if (!cellValue || String(cellValue).trim() === '' || String(cellValue).trim() === '-') {
            continue;
          }

          // Canonicalize column header to find property
          const canonicalHeader = CanonicalLabelService.canonicalize(columnHeader);
          const propertyUri = propertyMap[canonicalHeader];

          if (!propertyUri) {
            console.warn(`    No property mapping for column: ${columnHeader}`);
            continue;
          }

          // Parse the cell value (detect numbers, percentages, etc.)
          const parsedValue = this._parseValue(cellValue);

          // Add property value triple
          await this.kgStore.addTriple(instanceUri, propertyUri, parsedValue);
          stats.triples++;

          // Add property label triple for semantic matching
          const labelPropertyUri = `${propertyUri}_label`;
          await this.kgStore.addTriple(instanceUri, labelPropertyUri, `"${canonicalHeader}"`);
          stats.triples++;

          // Store precision
          const precision = CanonicalLabelService.inferPrecision([cellValue]);
          if (precision !== undefined && precision !== null) {
            const precisionPropertyUri = `${propertyUri}_precision`;
            await this.kgStore.addTriple(instanceUri, precisionPropertyUri, precision);
            stats.triples++;
          }
        }
      }

      console.log(`  ✅ Created ${stats.instances} categorical instances`);
    }

    // Handle time-series tables (with year columns)
    for (const yearCol of metadata.yearColumns) {
      const year = yearCol.year;
      const colIdx = yearCol.colIdx;
      const instanceUri = `kg:${entityType.split(':')[1]}_${year}`;

      // Create instance type triple
      await this.kgStore.addTriple(instanceUri, 'rdf:type', entityType);
      stats.instances++;
      stats.triples++;

      // ✅ CREATE LABEL TRIPLE - This is the critical fix!
      const instanceLabel = `${metadata.tableDescription} ${year}`;
      await this.kgStore.addTriple(instanceUri, 'rdfs:label', `"${instanceLabel}"`);
      stats.triples++;

      // Add year property
      await this.kgStore.addTriple(instanceUri, 'kg:year', year);
      stats.triples++;

      // Create property triples for each data row using metadata
      for (const rowMeta of metadata.rowMetadata) {
        const rowIdx = rowMeta.rowIdx;
        const dataRow = dataRows[rowIdx];

        if (!dataRow) {
          console.warn(`    Row ${rowIdx} not found in data`);
          continue;
        }

        const cellValue = dataRow[colIdx + 1]; // +1 because col 0 is label

        if (!cellValue || String(cellValue).trim() === '') {
          continue;
        }

        const propertyUri = propertyMap[rowMeta.canonicalLabel];
        if (!propertyUri) {
          console.warn(`    No property mapping for: ${rowMeta.canonicalLabel}`);
          continue;
        }

        // Parse value using metadata
        const parsedValue = this._parseValueWithMetadata(cellValue, rowMeta);

        // Add property value triple
        await this.kgStore.addTriple(instanceUri, propertyUri, parsedValue);
        stats.triples++;

        // ✅ CREATE PROPERTY LABEL TRIPLE for semantic matching
        const labelPropertyUri = `${propertyUri}_label`;
        await this.kgStore.addTriple(instanceUri, labelPropertyUri, `"${rowMeta.canonicalLabel}"`);
        stats.triples++;

        // ✅ STORE PRECISION for answer formatting
        if (rowMeta.precision !== undefined && rowMeta.precision !== null) {
          const precisionPropertyUri = `${propertyUri}_precision`;
          await this.kgStore.addTriple(instanceUri, precisionPropertyUri, rowMeta.precision);
          stats.triples++;
        }
      }
    }

    // Step 5: Extract facts from text and add to KG
    if (this.textProcessor && context && context.length > 0) {
      try {
        const years = metadata.yearColumns.map(yc => yc.year);
        const tableContext = {
          years,
          currentYear: years[years.length - 1],
          priorYear: years[years.length - 2],
          twoYearsAgo: years[years.length - 3],
          entityType: entityType.split(':')[1]
        };

        const facts = await this.textProcessor.extractFacts(context, tableContext);

        if (facts.length > 0) {
          const triples = this.textProcessor.factsToTriples(facts, entityType);

          for (const triple of triples) {
            await this.kgStore.addTriple(triple.subject, triple.predicate, triple.object);
            stats.triples++;
          }

          stats.textFacts = facts.length;
          console.log(`  ✓ Added ${facts.length} text-derived facts to KG`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to process text: ${error.message}`);
      }
    }

    return stats;
  }

  /**
   * Detect entity type from table and text using ontology definitions
   */
  async _detectEntityType(text, table) {
    // Get all classes from ontology
    const classes = await this.ontologyStore.query(null, 'rdf:type', 'owl:Class');

    // Filter to domain classes (kg:*), excluding upper-level ontology
    const domainClasses = classes
      .map(([uri]) => uri)
      .filter(uri => uri.startsWith('kg:'))
      .filter(uri => !uri.match(/Continuant|Occurrent|PhysicalEntity|State|Process|Task$/));

    if (domainClasses.length === 0) {
      return null;
    }

    // Get table row labels (these contain the property/concept names)
    const tableRowLabels = table && table.length > 1
      ? table.slice(1).map(row => String(row[0]).toLowerCase())
      : [];

    // Combine text and table labels for matching
    const textLower = Array.isArray(text) ? text.join(' ').toLowerCase() : String(text).toLowerCase();
    const allText = [textLower, ...tableRowLabels].join(' ');

    // Score each class based on how well it matches the table/text content
    const scores = [];

    for (const classUri of domainClasses) {
      let score = 0;

      // Get class metadata
      const labels = await this.ontologyStore.query(classUri, 'rdfs:label', null);
      const definitions = await this.ontologyStore.query(classUri, 'skos:definition', null);
      const altLabels = await this.ontologyStore.query(classUri, 'skos:altLabel', null);

      const className = classUri.split(':')[1]?.toLowerCase() || '';
      const label = labels.length > 0 ? labels[0][2].replace(/"/g, '').toLowerCase() : className;
      const definition = definitions.length > 0 ? definitions[0][2].replace(/"/g, '').toLowerCase() : '';
      const altLabel = altLabels.length > 0 ? altLabels[0][2].replace(/"/g, '').toLowerCase() : '';

      // HIGHEST PRIORITY: Check if this class has properties matching table row labels
      const properties = await this.ontologyStore.query(null, 'rdfs:domain', classUri);
      let propertyMatches = 0;

      for (const [propUri] of properties) {
        const propLabels = await this.ontologyStore.query(propUri, 'rdfs:label', null);
        const propAltLabels = await this.ontologyStore.query(propUri, 'skos:altLabel', null);

        const propLabel = propLabels.length > 0 ? propLabels[0][2].replace(/"/g, '').toLowerCase() : '';
        const propAltLabel = propAltLabels.length > 0 ? propAltLabels[0][2].replace(/"/g, '').toLowerCase() : '';

        // Check if any table row label matches this property
        for (const rowLabel of tableRowLabels) {
          if (propLabel === rowLabel || propAltLabel === rowLabel) {
            propertyMatches++;
            break;
          }
        }
      }

      // Score heavily based on property matches (100 points per match!)
      score += propertyMatches * 100;

      // Score based on table row label matches in class metadata (lower priority)
      for (const rowLabel of tableRowLabels) {
        // Check if altLabel contains the row label
        if (altLabel && altLabel.includes(rowLabel)) {
          score += 10;
        }
        // Check if definition contains the row label
        if (definition && definition.includes(rowLabel)) {
          score += 8;
        }
        // Check if class name matches
        if (className.includes(rowLabel.replace(/\s+/g, '')) || rowLabel.includes(className)) {
          score += 5;
        }
      }

      // Score based on class name appearing in text
      if (allText.includes(className)) {
        score += 3;
      }

      // Score based on label appearing in text
      if (allText.includes(label)) {
        score += 2;
      }

      scores.push({
        classUri,
        score,
        propertyMatches,
        className,
        definition: definition.slice(0, 100)
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return highest scoring class (or first domain class if all scores are 0)
    return scores[0].score > 0 ? scores[0].classUri : domainClasses[0];
  }

  /**
   * Build property map from metadata using exact canonical label matching
   *
   * Since both ontology and instance KG use the same deterministic canonicalization,
   * we can use exact string matching - no fuzzy logic needed!
   */
  /**
   * Build property map from column headers (for categorical tables)
   * @private
   */
  async _buildPropertyMapFromColumnHeaders(headerRow, entityType) {
    const propertyMap = {};

    // Get all properties that have this entity as domain
    const properties = await this.ontologyStore.query(null, 'rdfs:domain', entityType);

    // Build lookup map: canonical label → property URI
    const labelToProperty = new Map();
    for (const [propUri] of properties) {
      const labels = await this.ontologyStore.query(propUri, 'rdfs:label', null);
      if (labels.length > 0) {
        const label = labels[0][2].replace(/"/g, '');  // Remove quotes
        labelToProperty.set(label, propUri);
      }
    }

    // Map each column header (skipping first column which is row labels)
    for (let colIdx = 1; colIdx < headerRow.length; colIdx++) {
      const columnHeader = String(headerRow[colIdx]).trim();
      if (!columnHeader) continue;

      const canonicalHeader = CanonicalLabelService.canonicalize(columnHeader);

      // Try exact match first
      let propertyUri = labelToProperty.get(canonicalHeader);

      if (!propertyUri) {
        // If no exact match, create a dynamic property
        console.warn(`    No property found for "${columnHeader}", using dynamic property`);
        const propertyName = CanonicalLabelService.toPropertyName(canonicalHeader);
        propertyUri = `kg:${propertyName}`;
      }

      propertyMap[canonicalHeader] = propertyUri;
    }

    return propertyMap;
  }

  async _buildPropertyMapFromMetadata(rowMetadata, entityType) {
    const propertyMap = {};

    // Get all properties that have this entity as domain
    const properties = await this.ontologyStore.query(null, 'rdfs:domain', entityType);

    // Build lookup map: canonical label → property URI
    const labelToProperty = new Map();
    for (const [propUri] of properties) {
      const labels = await this.ontologyStore.query(propUri, 'rdfs:label', null);
      if (labels.length > 0) {
        const label = labels[0][2].replace(/"/g, '');  // Remove quotes
        labelToProperty.set(label, propUri);
      }
    }

    // Map each row's canonical label to property URI using EXACT match
    for (const rowMeta of rowMetadata) {
      const canonicalLabel = rowMeta.canonicalLabel;

      // Try exact string match first
      let propertyUri = labelToProperty.get(canonicalLabel);

      if (!propertyUri) {
        // If no exact match, create a dynamic property (same as categorical tables)
        console.warn(`    No property found for "${canonicalLabel}", using dynamic property`);
        const propertyName = CanonicalLabelService.toPropertyName(canonicalLabel);
        propertyUri = `kg:${propertyName}`;
      }

      propertyMap[canonicalLabel] = propertyUri;
    }

    return propertyMap;
  }

  /**
   * Parse cell value using metadata for canonicalization
   */
  /**
   * Parse cell value without metadata (for categorical tables)
   * @private
   */
  _parseValue(value) {
    if (!value) return value;

    const str = String(value).trim();

    // Remove common formatting
    const cleaned = str
      .replace(/\$/g, '')
      .replace(/%/g, '')
      .replace(/,/g, '')
      .replace(/\(/g, '-')  // Handle parentheses as negative
      .replace(/\)/g, '');

    // Try to parse as number
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return num;
    }

    // Return as string
    return str;
  }

  _parseValueWithMetadata(value, rowMetadata) {
    if (!value) return value;

    const str = String(value).trim();

    // Remove common formatting
    const cleaned = str
      .replace(/\$/g, '')
      .replace(/%/g, '')
      .replace(/,/g, '')
      .replace(/\(/g, '-')  // Handle parentheses as negative
      .replace(/\)/g, '');

    // Try to parse as number
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      // Apply unit scaling if metadata specifies
      if (rowMetadata.unit) {
        const unit = rowMetadata.unit.toLowerCase();
        if (unit.includes('thousand')) {
          return num * 1000;
        } else if (unit.includes('million')) {
          return num * 1000000;
        } else if (unit.includes('billion')) {
          return num * 1000000000;
        }
      }

      return num;
    }

    // Return as string
    return str;
  }

}
