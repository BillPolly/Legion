/**
 * TableProvenanceBuilder - Create Table and Cell entities for provenance tracking
 *
 * Maintains full traceability from source document → table → cell → observation → value
 */
export class TableProvenanceBuilder {
  constructor({ valueExtractor }) {
    if (!valueExtractor) {
      throw new Error('TableProvenanceBuilder requires valueExtractor');
    }
    this.valueExtractor = valueExtractor;
  }

  /**
   * Build complete table entity with metadata
   * @param {Object} tableData - Table data with headers and rows
   * @param {Object} metadata - Source document metadata
   * @returns {Object} Table entity
   */
  buildTableEntity(tableData, metadata = {}) {
    const tableUri = this.createTableUri(metadata);

    // Determine table structure
    let headers, rows, caption;

    if (Array.isArray(tableData.headers)) {
      // Format: {headers: [...], rows: [[...]]}
      headers = tableData.headers;
      rows = tableData.rows || [];
      caption = metadata.caption || '';
    } else if (typeof tableData === 'object') {
      // ConvFinQA format: {"2009": {...}, "2008": {...}}
      headers = Object.keys(tableData);

      // Get row labels from first column
      const firstCol = tableData[headers[0]];
      const rowLabels = Object.keys(firstCol);

      rows = rowLabels.map(rowLabel => {
        return headers.map(header => tableData[header][rowLabel]);
      });

      caption = metadata.caption || '';
    } else {
      throw new Error('Unsupported table format');
    }

    return {
      uri: tableUri,
      type: 'kg:Table',
      label: caption || `Table from ${metadata.sourceDocument || 'unknown'}`,
      properties: {
        ...(metadata.sourceDocument && { 'kg:sourceDocument': metadata.sourceDocument }),
        ...(metadata.documentId && { 'kg:documentId': metadata.documentId }),
        ...(caption && { 'kg:caption': caption }),
        'kg:rowCount': rows.length.toString(),
        'kg:columnCount': headers.length.toString(),
        'kg:columnHeaders': JSON.stringify(headers),
        ...(metadata.scale && { 'kg:defaultScale': metadata.scale }),
        ...(metadata.currency && { 'kg:defaultCurrency': metadata.currency })
      }
    };
  }

  /**
   * Build cell entities for all table cells
   * @param {Object} tableData - Table data
   * @param {string} tableUri - URI of the table entity
   * @param {Object} metadata - Table metadata
   * @returns {Array} Cell entities
   */
  buildCellEntities(tableData, tableUri, metadata = {}) {
    const cells = [];

    let headers, rows;

    if (Array.isArray(tableData.headers)) {
      headers = tableData.headers;
      rows = tableData.rows || [];
    } else if (typeof tableData === 'object') {
      // ConvFinQA format
      headers = Object.keys(tableData);
      const firstCol = tableData[headers[0]];
      const rowLabels = Object.keys(firstCol);

      rows = rowLabels.map((rowLabel, rowIdx) => {
        return headers.map((header, colIdx) => ({
          value: tableData[header][rowLabel],
          rowLabel,
          colLabel: header
        }));
      });
    }

    // Create cell entity for each cell
    rows.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        const cellValue = typeof cell === 'object' ? cell.value : cell;
        const rowLabel = typeof cell === 'object' ? cell.rowLabel : headers[colIdx];
        const colLabel = typeof cell === 'object' ? cell.colLabel : headers[colIdx];

        // Extract structured value
        const context = {
          scale: metadata.scale,
          currency: metadata.currency
        };
        const extractedValue = this.valueExtractor.extractValue(cellValue, context);

        if (extractedValue) {
          const cellUri = `${tableUri}_Cell_R${rowIdx}C${colIdx}`;
          const valueEntity = this.valueExtractor.createFinancialValueEntity(extractedValue);

          const cellEntity = {
            uri: cellUri,
            type: 'kg:TableCell',
            label: `Cell[${rowIdx},${colIdx}]: ${cellValue}`,
            properties: {
              'kg:row': rowIdx.toString(),
              'kg:column': colIdx.toString(),
              'kg:rowLabel': rowLabel || '',
              'kg:columnLabel': colLabel || '',
              'kg:rawValue': String(cellValue)
            }
          };

          cells.push({
            cellEntity,
            valueEntity,
            cellUri,
            valueUri: valueEntity.uri,
            rowIdx,
            colIdx,
            rowLabel,
            colLabel
          });
        }
      });
    });

    return cells;
  }

  /**
   * Create observation entities with full provenance
   * @param {Array} cells - Cell data from buildCellEntities
   * @param {string} tableUri - Table entity URI
   * @param {Object} context - Additional context (organization, etc.)
   * @returns {Object} Observations with entities and relationships
   */
  createObservationsWithProvenance(cells, tableUri, context = {}) {
    const entities = [];
    const relationships = [];

    cells.forEach(cell => {
      // Add cell and value entities
      entities.push(cell.cellEntity);
      entities.push(cell.valueEntity);

      // Create observation
      const obsUri = `data:Obs_${cell.rowLabel}_${cell.colLabel}`.replace(/[^a-zA-Z0-9_]/g, '_');

      const observation = {
        uri: obsUri,
        type: 'kg:Observation',
        label: `${cell.rowLabel} for ${cell.colLabel}`,
        properties: {}
      };

      entities.push(observation);

      // Link observation to value
      relationships.push({
        subject: obsUri,
        predicate: 'kg:hasFinancialValue',
        object: cell.valueUri
      });

      // Link observation to cell (provenance)
      relationships.push({
        subject: obsUri,
        predicate: 'kg:sourceCell',
        object: cell.cellUri
      });

      // Link observation to table (provenance)
      relationships.push({
        subject: obsUri,
        predicate: 'kg:sourceTable',
        object: tableUri
      });

      // Link cell to table
      relationships.push({
        subject: cell.cellUri,
        predicate: 'kg:inTable',
        object: tableUri
      });

      // Link to organization if provided
      if (context.organizationUri) {
        relationships.push({
          subject: obsUri,
          predicate: 'kg:forOrganization',
          object: context.organizationUri
        });
      }

      // Link to metric (use row label as metric)
      const metricUri = `data:Metric_${cell.rowLabel}`.replace(/[^a-zA-Z0-9_]/g, '_');
      entities.push({
        uri: metricUri,
        type: 'kg:FinancialMetric',
        label: cell.rowLabel,
        properties: {}
      });

      relationships.push({
        subject: obsUri,
        predicate: 'kg:hasMetric',
        object: metricUri
      });

      // Link to period (use column label as period)
      const periodUri = `data:Period_${cell.colLabel}`.replace(/[^a-zA-Z0-9_]/g, '_');
      entities.push({
        uri: periodUri,
        type: 'kg:TimePeriod',
        label: cell.colLabel,
        properties: {}
      });

      relationships.push({
        subject: obsUri,
        predicate: 'kg:forPeriod',
        object: periodUri
      });
    });

    return { entities, relationships };
  }

  /**
   * Create URI for table entity
   */
  createTableUri(metadata) {
    if (metadata.documentId) {
      return `data:Table_${metadata.documentId}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    if (metadata.sourceDocument) {
      return `data:Table_${metadata.sourceDocument}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    return `data:Table_${Date.now()}`;
  }

  /**
   * Build complete table knowledge graph with provenance
   * @param {Object} tableData - Table data
   * @param {Object} metadata - Metadata (sourceDocument, scale, currency, etc.)
   * @returns {Object} Complete KG with entities and relationships
   */
  buildTableKnowledgeGraph(tableData, metadata = {}) {
    // Create table entity
    const tableEntity = this.buildTableEntity(tableData, metadata);

    // Create cell entities with values
    const cells = this.buildCellEntities(tableData, tableEntity.uri, metadata);

    // Create observations with provenance
    const { entities, relationships } = this.createObservationsWithProvenance(
      cells,
      tableEntity.uri,
      metadata
    );

    // Add table entity
    entities.unshift(tableEntity);

    return {
      entities,
      relationships,
      tableEntity,
      cellCount: cells.length
    };
  }
}
