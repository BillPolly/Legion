/**
 * ERExporter
 * 
 * Export ER diagrams to various standard formats
 * Supports SQL DDL, JSON Schema, XML, GraphQL, and more
 */

export class ERExporter {
  constructor(config = {}) {
    this.config = {
      // Export options
      includeComments: config.includeComments !== false,
      includeConstraints: config.includeConstraints !== false,
      includeIndexes: config.includeIndexes !== false,
      
      // SQL options
      sqlDialect: config.sqlDialect || 'standard', // standard, mysql, postgresql, sqlite, oracle
      tablePrefix: config.tablePrefix || '',
      useUnderscoreNaming: config.useUnderscoreNaming !== false,
      
      // JSON Schema options
      jsonSchemaVersion: config.jsonSchemaVersion || 'http://json-schema.org/draft-07/schema#',
      includeExamples: config.includeExamples === true,
      
      // XML options
      xmlNamespace: config.xmlNamespace || 'http://example.com/er',
      useAttributes: config.useAttributes === true,
      
      // GraphQL options
      includeResolvers: config.includeResolvers === true,
      useInterfaces: config.useInterfaces === true,
      
      // Formatting
      indentSize: config.indentSize || 2,
      useSpaces: config.useSpaces !== false,
      
      ...config
    };
    
    this.exportFormats = new Map();
    this.initializeExportFormats();
  }
  
  /**
   * Initialize available export formats
   * @private
   */
  initializeExportFormats() {
    this.exportFormats.set('sql-ddl', {
      name: 'SQL DDL',
      description: 'SQL Data Definition Language',
      extension: '.sql',
      mimeType: 'text/sql',
      exporter: this._exportSQLDDL.bind(this)
    });
    
    this.exportFormats.set('json-schema', {
      name: 'JSON Schema',
      description: 'JSON Schema specification',
      extension: '.json',
      mimeType: 'application/schema+json',
      exporter: this._exportJSONSchema.bind(this)
    });
    
    this.exportFormats.set('xml-schema', {
      name: 'XML Schema',
      description: 'XML Schema Definition',
      extension: '.xsd',
      mimeType: 'application/xml',
      exporter: this._exportXMLSchema.bind(this)
    });
    
    this.exportFormats.set('graphql', {
      name: 'GraphQL Schema',
      description: 'GraphQL Schema Definition Language',
      extension: '.graphql',
      mimeType: 'application/graphql',
      exporter: this._exportGraphQL.bind(this)
    });
    
    this.exportFormats.set('dbml', {
      name: 'DBML',
      description: 'Database Markup Language',
      extension: '.dbml',
      mimeType: 'text/dbml',
      exporter: this._exportDBML.bind(this)
    });
    
    this.exportFormats.set('plantuml', {
      name: 'PlantUML',
      description: 'PlantUML ER diagram',
      extension: '.puml',
      mimeType: 'text/plantuml',
      exporter: this._exportPlantUML.bind(this)
    });
    
    this.exportFormats.set('mermaid', {
      name: 'Mermaid',
      description: 'Mermaid ER diagram',
      extension: '.mmd',
      mimeType: 'text/mermaid',
      exporter: this._exportMermaid.bind(this)
    });
    
    this.exportFormats.set('er-json', {
      name: 'ER JSON',
      description: 'Native ER JSON format',
      extension: '.er.json',
      mimeType: 'application/json',
      exporter: this._exportERJSON.bind(this)
    });
  }
  
  /**
   * Export ER diagram to specified format
   */
  export(diagram, format, options = {}) {
    const formatConfig = this.exportFormats.get(format);
    if (!formatConfig) {
      throw new Error(`Unsupported export format: ${format}`);
    }
    
    // Parse diagram structure
    const erModel = this._parseERDiagram(diagram);
    
    // Apply export-specific options
    const exportOptions = { ...this.config, ...options };
    
    try {
      // Execute format-specific exporter
      const result = formatConfig.exporter(erModel, exportOptions);
      
      return {
        success: true,
        format,
        content: result.content,
        metadata: {
          ...formatConfig,
          ...result.metadata,
          exportedAt: new Date().toISOString(),
          options: exportOptions
        }
      };
    } catch (error) {
      return {
        success: false,
        format,
        error: error.message,
        metadata: formatConfig
      };
    }
  }
  
  /**
   * Parse ER diagram into standardized model
   * @private
   */
  _parseERDiagram(diagram) {
    const entities = this._extractEntities(diagram);
    const relationships = this._extractRelationships(diagram);
    const attributes = this._extractAttributes(diagram);
    const inheritances = this._extractInheritances(diagram);
    
    // Build entity-attribute mappings
    const entityAttributes = new Map();
    for (const entity of entities) {
      const entityAttrs = attributes.filter(attr => attr.entityId === entity.id);
      entityAttributes.set(entity.id, entityAttrs);
    }
    
    // Build relationship mappings
    const entityRelationships = new Map();
    for (const entity of entities) {
      const entityRels = relationships.filter(rel => 
        rel.entities && rel.entities.includes(entity.id)
      );
      entityRelationships.set(entity.id, entityRels);
    }
    
    return {
      entities,
      relationships,
      attributes,
      inheritances,
      entityAttributes,
      entityRelationships,
      metadata: {
        name: diagram.name || 'ER Diagram',
        description: diagram.description,
        version: diagram.version || '1.0',
        createdAt: diagram.createdAt,
        modifiedAt: diagram.modifiedAt
      }
    };
  }
  
  /**
   * Export to SQL DDL
   * @private
   */
  _exportSQLDDL(erModel, options) {
    const lines = [];
    const indent = ' '.repeat(options.indentSize);
    
    // Header comment
    if (options.includeComments) {
      lines.push(`-- Generated SQL DDL from ER Diagram`);
      lines.push(`-- Generated at: ${new Date().toISOString()}`);
      lines.push(`-- Dialect: ${options.sqlDialect}`);
      lines.push('');
    }
    
    // Create tables for entities
    for (const entity of erModel.entities) {
      if (entity.type === 'weak-entity') continue; // Handle weak entities after strong ones
      
      const tableName = this._toSQLIdentifier(entity.name || entity.id, options);
      const attributes = erModel.entityAttributes.get(entity.id) || [];
      
      lines.push(`CREATE TABLE ${options.tablePrefix}${tableName} (`);
      
      const columns = [];
      
      // Add attributes as columns
      for (const attr of attributes) {
        const column = this._generateSQLColumn(attr, options);
        if (column) columns.push(column);
      }
      
      // Add primary key constraint
      const keyAttrs = attributes.filter(attr => attr.type === 'key' || attr.isKey);
      if (keyAttrs.length > 0) {
        const keyColumns = keyAttrs.map(attr => 
          this._toSQLIdentifier(attr.name || attr.id, options)
        ).join(', ');
        columns.push(`${indent}PRIMARY KEY (${keyColumns})`);
      }
      
      lines.push(columns.map(col => `${indent}${col}`).join(',\n'));
      lines.push(');');
      lines.push('');
    }
    
    // Handle weak entities
    for (const entity of erModel.entities) {
      if (entity.type !== 'weak-entity') continue;
      
      const tableName = this._toSQLIdentifier(entity.name || entity.id, options);
      const attributes = erModel.entityAttributes.get(entity.id) || [];
      
      lines.push(`CREATE TABLE ${options.tablePrefix}${tableName} (`);
      
      const columns = [];
      
      // Add attributes as columns
      for (const attr of attributes) {
        const column = this._generateSQLColumn(attr, options);
        if (column) columns.push(column);
      }
      
      // Add foreign key for identifying relationship
      const identifyingRel = erModel.relationships.find(rel => 
        rel.identifying && rel.entities && rel.entities.includes(entity.id)
      );
      
      if (identifyingRel) {
        const strongEntityId = identifyingRel.entities.find(id => id !== entity.id);
        const strongEntity = erModel.entities.find(e => e.id === strongEntityId);
        if (strongEntity) {
          const strongTableName = this._toSQLIdentifier(strongEntity.name || strongEntity.id, options);
          const strongKeyAttrs = (erModel.entityAttributes.get(strongEntity.id) || [])
            .filter(attr => attr.type === 'key' || attr.isKey);
          
          for (const keyAttr of strongKeyAttrs) {
            const fkColumn = `${strongTableName}_${this._toSQLIdentifier(keyAttr.name || keyAttr.id, options)}`;
            columns.push(`${fkColumn} ${this._getSQLDataType(keyAttr, options)} NOT NULL`);
          }
        }
      }
      
      // Add composite primary key
      const partialKeys = attributes.filter(attr => attr.type === 'partial-key');
      const allKeyColumns = [];
      
      // Add partial key columns
      allKeyColumns.push(...partialKeys.map(attr => 
        this._toSQLIdentifier(attr.name || attr.id, options)
      ));
      
      // Add foreign key columns
      if (identifyingRel) {
        const strongEntityId = identifyingRel.entities.find(id => id !== entity.id);
        const strongEntity = erModel.entities.find(e => e.id === strongEntityId);
        if (strongEntity) {
          const strongTableName = this._toSQLIdentifier(strongEntity.name || strongEntity.id, options);
          const strongKeyAttrs = (erModel.entityAttributes.get(strongEntity.id) || [])
            .filter(attr => attr.type === 'key' || attr.isKey);
          
          allKeyColumns.push(...strongKeyAttrs.map(attr => 
            `${strongTableName}_${this._toSQLIdentifier(attr.name || attr.id, options)}`
          ));
        }
      }
      
      if (allKeyColumns.length > 0) {
        columns.push(`${indent}PRIMARY KEY (${allKeyColumns.join(', ')})`);
      }
      
      lines.push(columns.map(col => `${indent}${col}`).join(',\n'));
      lines.push(');');
      lines.push('');
    }
    
    // Create junction tables for many-to-many relationships
    for (const rel of erModel.relationships) {
      if (this._isManyToManyRelationship(rel, erModel)) {
        const junctionTable = this._generateJunctionTable(rel, erModel, options);
        if (junctionTable) {
          lines.push(...junctionTable);
          lines.push('');
        }
      }
    }
    
    // Add foreign key constraints
    if (options.includeConstraints) {
      lines.push('-- Foreign Key Constraints');
      for (const rel of erModel.relationships) {
        const constraints = this._generateForeignKeyConstraints(rel, erModel, options);
        lines.push(...constraints);
      }
      lines.push('');
    }
    
    // Add indexes
    if (options.includeIndexes) {
      lines.push('-- Indexes');
      for (const entity of erModel.entities) {
        const indexes = this._generateIndexes(entity, erModel, options);
        lines.push(...indexes);
      }
      lines.push('');
    }
    
    return {
      content: lines.join('\n'),
      metadata: {
        tableCount: erModel.entities.length,
        relationshipCount: erModel.relationships.length,
        constraintCount: erModel.relationships.length
      }
    };
  }
  
  /**
   * Export to JSON Schema
   * @private
   */
  _exportJSONSchema(erModel, options) {
    const schema = {
      $schema: options.jsonSchemaVersion,
      title: erModel.metadata.name,
      description: erModel.metadata.description,
      type: 'object',
      definitions: {},
      properties: {}
    };
    
    // Create schema definitions for each entity
    for (const entity of erModel.entities) {
      const entityName = this._toCamelCase(entity.name || entity.id);
      const attributes = erModel.entityAttributes.get(entity.id) || [];
      
      const entitySchema = {
        type: 'object',
        title: entity.name || entity.id,
        description: entity.description,
        properties: {},
        required: []
      };
      
      // Add attribute properties
      for (const attr of attributes) {
        const propName = this._toCamelCase(attr.name || attr.id);
        const propSchema = this._generateJSONSchemaProperty(attr, options);
        entitySchema.properties[propName] = propSchema;
        
        if (attr.type === 'key' || attr.isKey || attr.required) {
          entitySchema.required.push(propName);
        }
      }
      
      // Add relationship properties
      const relationships = erModel.entityRelationships.get(entity.id) || [];
      for (const rel of relationships) {
        const relProp = this._generateRelationshipProperty(rel, entity.id, erModel, options);
        if (relProp) {
          entitySchema.properties[relProp.name] = relProp.schema;
        }
      }
      
      schema.definitions[entityName] = entitySchema;
      schema.properties[entityName] = {
        type: 'array',
        items: { $ref: `#/definitions/${entityName}` }
      };
    }
    
    return {
      content: JSON.stringify(schema, null, options.indentSize),
      metadata: {
        entityCount: erModel.entities.length,
        schemaVersion: options.jsonSchemaVersion
      }
    };
  }
  
  /**
   * Export to GraphQL Schema
   * @private
   */
  _exportGraphQL(erModel, options) {
    const lines = [];
    
    // Schema description
    if (erModel.metadata.description) {
      lines.push(`"""${erModel.metadata.description}"""`);
    }
    
    // Generate types for entities
    for (const entity of erModel.entities) {
      const typeName = this._toPascalCase(entity.name || entity.id);
      const attributes = erModel.entityAttributes.get(entity.id) || [];
      
      lines.push('');
      if (entity.description) {
        lines.push(`"""${entity.description}"""`);
      }
      
      lines.push(`type ${typeName} {`);
      
      // Add attribute fields
      for (const attr of attributes) {
        const field = this._generateGraphQLField(attr, options);
        lines.push(`  ${field}`);
      }
      
      // Add relationship fields
      const relationships = erModel.entityRelationships.get(entity.id) || [];
      for (const rel of relationships) {
        const relField = this._generateGraphQLRelationshipField(rel, entity.id, erModel, options);
        if (relField) {
          lines.push(`  ${relField}`);
        }
      }
      
      lines.push('}');
    }
    
    // Generate Query type
    lines.push('');
    lines.push('type Query {');
    for (const entity of erModel.entities) {
      const typeName = this._toPascalCase(entity.name || entity.id);
      const fieldName = this._toCamelCase(entity.name || entity.id);
      lines.push(`  ${fieldName}(id: ID!): ${typeName}`);
      lines.push(`  ${fieldName}s: [${typeName}!]!`);
    }
    lines.push('}');
    
    // Generate Mutation type if requested
    if (options.includeMutations) {
      lines.push('');
      lines.push('type Mutation {');
      for (const entity of erModel.entities) {
        const typeName = this._toPascalCase(entity.name || entity.id);
        const fieldName = this._toCamelCase(entity.name || entity.id);
        lines.push(`  create${typeName}(input: ${typeName}Input!): ${typeName}!`);
        lines.push(`  update${typeName}(id: ID!, input: ${typeName}Input!): ${typeName}!`);
        lines.push(`  delete${typeName}(id: ID!): Boolean!`);
      }
      lines.push('}');
    }
    
    return {
      content: lines.join('\n'),
      metadata: {
        typeCount: erModel.entities.length,
        includesMutations: !!options.includeMutations
      }
    };
  }
  
  /**
   * Export to native ER JSON format
   * @private
   */
  _exportERJSON(erModel, options) {
    const erJson = {
      metadata: erModel.metadata,
      entities: erModel.entities.map(entity => ({
        ...entity,
        attributes: erModel.entityAttributes.get(entity.id) || []
      })),
      relationships: erModel.relationships,
      inheritances: erModel.inheritances,
      exportInfo: {
        format: 'er-json',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        options
      }
    };
    
    return {
      content: JSON.stringify(erJson, null, options.indentSize),
      metadata: {
        entities: erModel.entities.length,
        relationships: erModel.relationships.length,
        inheritances: erModel.inheritances.length
      }
    };
  }
  
  /**
   * Helper methods for extraction
   * @private
   */
  _extractEntities(diagram) {
    if (diagram.entities) return diagram.entities;
    if (diagram.nodes) return diagram.nodes.filter(n => n.type && n.type.includes('entity'));
    return [];
  }
  
  _extractRelationships(diagram) {
    if (diagram.relationships) return diagram.relationships;
    if (diagram.nodes) return diagram.nodes.filter(n => n.type === 'relationship');
    return [];
  }
  
  _extractAttributes(diagram) {
    if (diagram.attributes) return diagram.attributes;
    if (diagram.nodes) return diagram.nodes.filter(n => n.type === 'attribute');
    return [];
  }
  
  _extractInheritances(diagram) {
    if (diagram.inheritances) return diagram.inheritances;
    if (diagram.edges) return diagram.edges.filter(e => e.type === 'inheritance');
    return [];
  }
  
  /**
   * Helper methods for SQL generation
   * @private
   */
  _toSQLIdentifier(name, options) {
    if (!name) return 'unnamed';
    return options.useUnderscoreNaming ? 
      name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') : 
      name;
  }
  
  _getSQLDataType(attribute, options) {
    const dataType = attribute.dataType || attribute.type;
    const sqlTypes = {
      'string': 'VARCHAR(255)',
      'text': 'TEXT',
      'integer': 'INTEGER',
      'number': 'DECIMAL(10,2)',
      'boolean': 'BOOLEAN',
      'date': 'DATE',
      'datetime': 'TIMESTAMP',
      'uuid': 'UUID'
    };
    
    return sqlTypes[dataType] || 'VARCHAR(255)';
  }
  
  _generateSQLColumn(attribute, options) {
    const name = this._toSQLIdentifier(attribute.name || attribute.id, options);
    const type = this._getSQLDataType(attribute, options);
    const nullable = attribute.required ? 'NOT NULL' : '';
    const defaultVal = attribute.defaultValue ? `DEFAULT '${attribute.defaultValue}'` : '';
    
    return `${name} ${type} ${nullable} ${defaultVal}`.trim();
  }
  
  /**
   * Helper methods for naming conventions
   * @private
   */
  _toCamelCase(str) {
    return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
  }
  
  _toPascalCase(str) {
    const camel = this._toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }
  
  /**
   * Get available export formats
   */
  getAvailableFormats() {
    return Array.from(this.exportFormats.entries()).map(([key, format]) => ({
      key,
      name: format.name,
      description: format.description,
      extension: format.extension,
      mimeType: format.mimeType
    }));
  }
  
  /**
   * Validate export format
   */
  isValidFormat(format) {
    return this.exportFormats.has(format);
  }
  
  /**
   * Get export format metadata
   */
  getFormatMetadata(format) {
    return this.exportFormats.get(format);
  }
  
  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Add custom export format
   */
  addExportFormat(key, formatConfig) {
    if (!formatConfig.exporter || typeof formatConfig.exporter !== 'function') {
      throw new Error('Export format must have an exporter function');
    }
    
    this.exportFormats.set(key, {
      name: formatConfig.name || key,
      description: formatConfig.description || '',
      extension: formatConfig.extension || '.txt',
      mimeType: formatConfig.mimeType || 'text/plain',
      exporter: formatConfig.exporter
    });
  }
  
  /**
   * Remove export format
   */
  removeExportFormat(key) {
    return this.exportFormats.delete(key);
  }
}

export default ERExporter;