/**
 * KGBuilder - Builds instance-level knowledge graph from tables and text
 *
 * Takes ConvFinQA table data and text and creates ABox triples using the pre-built ontology.
 * Uses LLM-driven metadata extraction instead of regex parsing.
 */

import { TableMetadataExtractor } from './TableMetadataExtractor.js';
import { TextProcessor } from './TextProcessor.js';

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
    const propertyMap = await this._buildPropertyMapFromMetadata(metadata.rowMetadata, entityType);

    console.log(`  Mapped ${Object.keys(propertyMap).length} properties`);

    // Step 4: Create instances for each year column
    const stats = {
      instances: 0,
      triples: 0,
      entityType,
      textFacts: 0
    };

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

      // Exact string match (deterministic canonicalization ensures this works)
      const propertyUri = labelToProperty.get(canonicalLabel);

      if (!propertyUri) {
        throw new Error(
          `No exact match for canonical label "${canonicalLabel}" in entity type ${entityType}.\n` +
          `Available properties: ${Array.from(labelToProperty.keys()).join(', ')}\n` +
          `This indicates the ontology was not built from training data including this table.`
        );
      }

      propertyMap[canonicalLabel] = propertyUri;
    }

    return propertyMap;
  }

  /**
   * Parse cell value using metadata for canonicalization
   */
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
