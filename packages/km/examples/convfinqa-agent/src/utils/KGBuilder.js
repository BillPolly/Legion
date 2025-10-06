/**
 * KGBuilder - Builds instance-level knowledge graph from tables and text
 *
 * Takes ConvFinQA table data and text and creates ABox triples using the pre-built ontology.
 */

import { TableParser } from './TableParser.js';
import { TextProcessor } from './TextProcessor.js';

export class KGBuilder {
  constructor(kgStore, ontologyStore, llmClient = null) {
    this.kgStore = kgStore;
    this.ontologyStore = ontologyStore;
    this.tableParser = new TableParser(llmClient);
    this.textProcessor = llmClient ? new TextProcessor(llmClient) : null;
  }

  /**
   * Build KG instances from table data
   *
   * @param {Array<Array<string>>} table - Table data (2D array) - use table_ori for clean structure
   * @param {Array<string>} text - Text data for context
   * @returns {Promise<Object>} Stats about created KG
   */
  async buildFromTable(table, text) {
    // Step 1: Parse table structure using specialized TableParser
    const parsedTable = await this.tableParser.parse(table, text);

    console.log(`  Parsed ${parsedTable.yearColumns.length} year columns: ${parsedTable.yearColumns.map(yc => yc.year).join(', ')}`);

    // Step 2: Detect entity type from ontology using table and text
    const entityType = await this._detectEntityType(text, parsedTable.dataRows);

    if (!entityType) {
      throw new Error('Could not detect entity type from table and text');
    }

    console.log(`  Detected entity type: ${entityType}`);

    // Step 3: Build property map from data rows
    const propertyMap = await this._buildPropertyMap(parsedTable.dataRows, entityType);

    console.log(`  Mapped ${Object.keys(propertyMap).length} properties`);

    // Step 4: Create instances for each year column
    const stats = {
      instances: 0,
      triples: 0,
      entityType,
      textFacts: 0
    };

    for (const { year, colIdx } of parsedTable.yearColumns) {
      const instanceUri = `kg:${entityType.split(':')[1]}_${year}`;

      // Create instance type triple
      await this.kgStore.addTriple(instanceUri, 'rdf:type', entityType);
      stats.instances++;
      stats.triples++;

      // Add year property
      await this.kgStore.addTriple(instanceUri, 'kg:year', year);
      stats.triples++;

      // Create property triples for each data row
      for (const dataRow of parsedTable.dataRows) {
        const rowLabel = dataRow[0];
        const cellValue = dataRow[colIdx + 1]; // +1 because col 0 is label

        if (!cellValue || String(cellValue).trim() === '') {
          continue;
        }

        const propertyUri = propertyMap[rowLabel.toLowerCase()];
        if (!propertyUri) {
          console.warn(`    No property mapping for: ${rowLabel}`);
          continue;
        }

        // Parse value
        const parsedValue = this._parseValue(cellValue);

        await this.kgStore.addTriple(instanceUri, propertyUri, parsedValue);
        stats.triples++;
      }
    }

    // Step 5: Extract facts from text and add to KG
    if (this.textProcessor && text && text.length > 0) {
      try {
        const years = parsedTable.yearColumns.map(yc => yc.year);
        const tableContext = {
          years,
          currentYear: years[years.length - 1],
          priorYear: years[years.length - 2],
          twoYearsAgo: years[years.length - 3],
          entityType: entityType.split(':')[1]
        };

        const facts = await this.textProcessor.extractFacts(text, tableContext);

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
   * Build property map from data row labels and ontology properties
   * Uses semantic matching with altLabels and definitions
   */
  async _buildPropertyMap(dataRows, entityType) {
    const propertyMap = {};

    // Get all properties that have this entity as domain
    const properties = await this.ontologyStore.query(null, 'rdfs:domain', entityType);

    // Build property metadata for semantic matching
    const propertyMetadata = [];
    for (const [propUri] of properties) {
      const labels = await this.ontologyStore.query(propUri, 'rdfs:label', null);
      const altLabels = await this.ontologyStore.query(propUri, 'skos:altLabel', null);
      const definitions = await this.ontologyStore.query(propUri, 'skos:definition', null);

      const propName = propUri.split(':')[1]?.toLowerCase() || '';
      const label = labels.length > 0 ? labels[0][2].replace(/"/g, '').toLowerCase() : propName;
      const altLabel = altLabels.length > 0 ? altLabels[0][2].replace(/"/g, '').toLowerCase() : '';
      const definition = definitions.length > 0 ? definitions[0][2].replace(/"/g, '').toLowerCase() : '';

      propertyMetadata.push({
        uri: propUri,
        name: propName,
        label,
        altLabel,
        definition
      });
    }

    // Map table row labels to properties using semantic matching
    for (const dataRow of dataRows) {
      const rowLabel = String(dataRow[0]).trim();
      const rowLabelLower = rowLabel.toLowerCase();

      let bestMatch = null;
      let bestScore = 0;

      // Score each property based on semantic similarity
      for (const prop of propertyMetadata) {
        let score = 0;

        // Exact matches (highest priority)
        if (rowLabelLower === prop.label) score += 20;
        if (rowLabelLower === prop.name) score += 20;
        if (rowLabelLower === prop.altLabel) score += 20;

        // Alt-label contains row label (very high priority)
        if (prop.altLabel && prop.altLabel.includes(rowLabelLower)) {
          score += 15;
        }

        // Row label contains alt-label
        if (prop.altLabel && rowLabelLower.includes(prop.altLabel)) {
          score += 12;
        }

        // Definition contains row label
        if (prop.definition && prop.definition.includes(rowLabelLower)) {
          score += 10;
        }

        // Label partial match
        if (prop.label && (rowLabelLower.includes(prop.label) || prop.label.includes(rowLabelLower))) {
          score += 8;
        }

        // Name partial match
        if (prop.name && (rowLabelLower.includes(prop.name) || prop.name.includes(rowLabelLower))) {
          score += 6;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = prop.uri;
        }
      }

      // Use best match if score is good enough (threshold = 8)
      if (bestMatch && bestScore >= 8) {
        propertyMap[rowLabelLower] = bestMatch;
        continue;
      }

      // No good match - FAIL FAST (do NOT modify ontology!)
      throw new Error(
        `No property in ontology matches table row "${rowLabel}" for entity type ${entityType}.\n` +
        `Available properties: ${propertyMetadata.map(p => p.uri).join(', ')}\n` +
        `The ontology must be built from training examples that include these table concepts!`
      );
    }

    return propertyMap;
  }

  /**
   * Parse cell value (handle currency, percentages, etc.)
   */
  _parseValue(value) {
    if (!value) return value;

    const str = String(value).trim();

    // Remove common formatting
    const cleaned = str
      .replace(/\$/g, '')
      .replace(/%/g, '')
      .replace(/,/g, '')
      .replace(/\(/g, '')
      .replace(/\)/g, '');

    // Try to parse as number
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return num;
    }

    // Return as string
    return str;
  }
}
