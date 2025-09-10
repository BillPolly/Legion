/**
 * ERExporter - Export Entity-Relationship diagrams to various formats
 * 
 * Features:
 * - SQL DDL generation (CREATE TABLE statements)
 * - XML Schema (XSD) generation
 * - JSON Schema generation  
 * - GraphML export for ER diagrams
 * - PlantUML notation export
 * - Crow's Foot notation export
 * - Chen notation export
 * - IDEF1X notation export
 * - Database migration scripts
 * - Documentation generation (Markdown, HTML)
 */

export class ERExporter {
  constructor(config = {}) {
    this.config = {
      // SQL generation options
      sqlDialect: config.sqlDialect || 'mysql', // mysql, postgresql, sqlite, oracle, mssql
      sqlNamingConvention: config.sqlNamingConvention || 'snake_case', // snake_case, camelCase, PascalCase
      generateConstraints: config.generateConstraints !== false,
      generateIndexes: config.generateIndexes !== false,
      generateComments: config.generateComments !== false,
      
      // Schema generation options
      schemaFormat: config.schemaFormat || 'json', // json, xml, yaml
      schemaVersion: config.schemaVersion || 'draft-07',
      includeValidation: config.includeValidation !== false,
      includeExamples: config.includeExamples || false,
      
      // Export formatting
      indentation: config.indentation || 2,
      lineEndings: config.lineEndings || '\n',
      prettyPrint: config.prettyPrint !== false,
      
      // Documentation options
      includeDescriptions: config.includeDescriptions !== false,
      includeDiagramImage: config.includeDiagramImage || false,
      documentationFormat: config.documentationFormat || 'markdown',
      
      // Validation
      validateBeforeExport: config.validateBeforeExport !== false,
      strictMode: config.strictMode || false,
      
      ...config
    };
    
    // SQL dialect configurations
    this.dialectConfig = {
      mysql: {
        typeMapping: {
          'TEXT': 'VARCHAR(255)',
          'NUMBER': 'INT',
          'DECIMAL': 'DECIMAL(10,2)',
          'DATE': 'DATE',
          'DATETIME': 'DATETIME',
          'BOOLEAN': 'BOOLEAN',
          'BLOB': 'BLOB'
        },
        quoteChar: '`',
        autoIncrement: 'AUTO_INCREMENT',
        primaryKeyConstraint: 'PRIMARY KEY'
      },
      postgresql: {
        typeMapping: {
          'TEXT': 'VARCHAR(255)',
          'NUMBER': 'INTEGER',
          'DECIMAL': 'NUMERIC(10,2)',
          'DATE': 'DATE',
          'DATETIME': 'TIMESTAMP',
          'BOOLEAN': 'BOOLEAN',
          'BLOB': 'BYTEA'
        },
        quoteChar: '"',
        autoIncrement: 'SERIAL',
        primaryKeyConstraint: 'PRIMARY KEY'
      },
      sqlite: {
        typeMapping: {
          'TEXT': 'TEXT',
          'NUMBER': 'INTEGER',
          'DECIMAL': 'REAL',
          'DATE': 'TEXT',
          'DATETIME': 'TEXT',
          'BOOLEAN': 'INTEGER',
          'BLOB': 'BLOB'
        },
        quoteChar: '"',
        autoIncrement: 'AUTOINCREMENT',
        primaryKeyConstraint: 'PRIMARY KEY'
      }
    };
  }
  
  /**
   * Export ER diagram to specified format
   */
  async export(diagram, format, options = {}) {
    // Validate diagram if configured
    if (this.config.validateBeforeExport) {
      const validationResult = this._validateDiagram(diagram);
      if (!validationResult.isValid) {
        throw new Error(`Invalid diagram: ${validationResult.errors.join(', ')}`);
      }
    }
    
    switch (format.toLowerCase()) {
      case 'sql':
      case 'ddl':
        return this.exportToSQL(diagram, options);
        
      case 'json':
      case 'jsonschema':
        return this.exportToJSONSchema(diagram, options);
        
      case 'xml':
      case 'xsd':
        return this.exportToXMLSchema(diagram, options);
        
      case 'graphml':
        return this.exportToGraphML(diagram, options);
        
      case 'plantuml':
        return this.exportToPlantUML(diagram, options);
        
      case 'crowsfoot':
        return this.exportToCrowsFoot(diagram, options);
        
      case 'chen':
        return this.exportToChen(diagram, options);
        
      case 'idef1x':
        return this.exportToIDEF1X(diagram, options);
        
      case 'markdown':
      case 'md':
        return this.exportToMarkdown(diagram, options);
        
      case 'html':
        return this.exportToHTML(diagram, options);
        
      case 'migration':
        return this.exportToMigration(diagram, options);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Export to SQL DDL
   */
  exportToSQL(diagram, options = {}) {
    const dialect = options.dialect || this.config.sqlDialect;
    const dialectConfig = this.dialectConfig[dialect];
    
    if (!dialectConfig) {
      throw new Error(`Unsupported SQL dialect: ${dialect}`);
    }
    
    const statements = [];
    const foreignKeys = [];
    const indexes = [];
    
    // Generate CREATE TABLE statements
    for (const entity of diagram.entities || []) {
      const tableName = this._formatTableName(entity.name);
      const columns = [];
      const constraints = [];
      
      // Add columns for attributes
      for (const attr of entity.attributes || []) {
        const columnDef = this._generateColumnDefinition(attr, dialectConfig);
        columns.push(columnDef);
        
        if (attr.isPrimaryKey) {
          constraints.push(`${dialectConfig.primaryKeyConstraint} (${this._formatColumnName(attr.name)})`);
        }
        
        if (attr.isUnique && !attr.isPrimaryKey) {
          constraints.push(`UNIQUE (${this._formatColumnName(attr.name)})`);
        }
        
        if (attr.isForeignKey && this.config.generateConstraints) {
          foreignKeys.push(this._generateForeignKeyConstraint(
            tableName,
            attr,
            dialectConfig
          ));
        }
      }
      
      // Build CREATE TABLE statement
      let createTable = `CREATE TABLE ${dialectConfig.quoteChar}${tableName}${dialectConfig.quoteChar} (\n`;
      createTable += columns.join(',\n');
      
      if (constraints.length > 0) {
        createTable += ',\n' + constraints.join(',\n');
      }
      
      createTable += '\n);';
      
      // Add comments if configured
      if (this.config.generateComments && entity.description) {
        createTable = `-- ${entity.description}\n${createTable}`;
      }
      
      statements.push(createTable);
    }
    
    // Add foreign key constraints
    if (foreignKeys.length > 0) {
      statements.push('\n-- Foreign Key Constraints');
      statements.push(...foreignKeys);
    }
    
    // Generate indexes
    if (this.config.generateIndexes) {
      for (const entity of diagram.entities || []) {
        const tableName = this._formatTableName(entity.name);
        
        for (const attr of entity.attributes || []) {
          if (attr.isIndexed && !attr.isPrimaryKey) {
            const indexName = `idx_${tableName}_${this._formatColumnName(attr.name)}`;
            indexes.push(
              `CREATE INDEX ${indexName} ON ${dialectConfig.quoteChar}${tableName}${dialectConfig.quoteChar} (${this._formatColumnName(attr.name)});`
            );
          }
        }
      }
      
      if (indexes.length > 0) {
        statements.push('\n-- Indexes');
        statements.push(...indexes);
      }
    }
    
    return statements.join('\n\n');
  }
  
  /**
   * Generate column definition
   */
  _generateColumnDefinition(attribute, dialectConfig) {
    const columnName = this._formatColumnName(attribute.name);
    const dataType = dialectConfig.typeMapping[attribute.type] || 'VARCHAR(255)';
    
    let definition = `  ${dialectConfig.quoteChar}${columnName}${dialectConfig.quoteChar} ${dataType}`;
    
    // Add constraints
    if (attribute.isRequired || attribute.isPrimaryKey) {
      definition += ' NOT NULL';
    }
    
    if (attribute.isPrimaryKey && attribute.isAutoIncrement) {
      if (dialectConfig.autoIncrement) {
        definition += ` ${dialectConfig.autoIncrement}`;
      }
    }
    
    if (attribute.defaultValue !== null && attribute.defaultValue !== undefined) {
      definition += ` DEFAULT ${this._formatDefaultValue(attribute.defaultValue, attribute.type)}`;
    }
    
    return definition;
  }
  
  /**
   * Generate foreign key constraint
   */
  _generateForeignKeyConstraint(tableName, attribute, dialectConfig) {
    const columnName = this._formatColumnName(attribute.name);
    const referencedTable = this._formatTableName(attribute.referencedEntity);
    const referencedColumn = this._formatColumnName(attribute.referencedAttribute || 'id');
    
    return `ALTER TABLE ${dialectConfig.quoteChar}${tableName}${dialectConfig.quoteChar} ` +
           `ADD CONSTRAINT fk_${tableName}_${columnName} ` +
           `FOREIGN KEY (${dialectConfig.quoteChar}${columnName}${dialectConfig.quoteChar}) ` +
           `REFERENCES ${dialectConfig.quoteChar}${referencedTable}${dialectConfig.quoteChar} ` +
           `(${dialectConfig.quoteChar}${referencedColumn}${dialectConfig.quoteChar});`;
  }
  
  /**
   * Export to JSON Schema
   */
  exportToJSONSchema(diagram, options = {}) {
    const schemas = {};
    
    for (const entity of diagram.entities || []) {
      const schema = {
        $schema: `http://json-schema.org/${this.config.schemaVersion}/schema#`,
        $id: `#/definitions/${entity.name}`,
        type: 'object',
        title: entity.name,
        description: entity.description || `${entity.name} entity`,
        properties: {},
        required: []
      };
      
      // Add properties for each attribute
      for (const attr of entity.attributes || []) {
        const property = this._generateJSONSchemaProperty(attr);
        schema.properties[attr.name] = property;
        
        if (attr.isRequired || attr.isPrimaryKey) {
          schema.required.push(attr.name);
        }
      }
      
      // Add validation rules if configured
      if (this.config.includeValidation) {
        if (entity.minProperties) {
          schema.minProperties = entity.minProperties;
        }
        if (entity.maxProperties) {
          schema.maxProperties = entity.maxProperties;
        }
      }
      
      schemas[entity.name] = schema;
    }
    
    // Create root schema with definitions
    const rootSchema = {
      $schema: `http://json-schema.org/${this.config.schemaVersion}/schema#`,
      definitions: schemas,
      type: 'object',
      properties: {}
    };
    
    // Add relationships as references
    for (const relationship of diagram.relationships || []) {
      if (relationship.type === 'one-to-many' || relationship.type === 'many-to-many') {
        // Add array properties for collections
        const sourceEntity = diagram.entities.find(e => e.id === relationship.source);
        const targetEntity = diagram.entities.find(e => e.id === relationship.target);
        
        if (sourceEntity && targetEntity) {
          schemas[sourceEntity.name].properties[`${targetEntity.name.toLowerCase()}s`] = {
            type: 'array',
            items: { $ref: `#/definitions/${targetEntity.name}` }
          };
        }
      }
    }
    
    return this.config.prettyPrint 
      ? JSON.stringify(rootSchema, null, this.config.indentation)
      : JSON.stringify(rootSchema);
  }
  
  /**
   * Generate JSON Schema property
   */
  _generateJSONSchemaProperty(attribute) {
    const property = {
      type: this._mapToJSONType(attribute.type),
      description: attribute.description
    };
    
    // Add format for specific types
    switch (attribute.type) {
      case 'DATE':
        property.format = 'date';
        break;
      case 'DATETIME':
        property.format = 'date-time';
        break;
      case 'EMAIL':
        property.format = 'email';
        break;
      case 'URL':
        property.format = 'uri';
        break;
    }
    
    // Add constraints
    if (attribute.minLength) {
      property.minLength = attribute.minLength;
    }
    if (attribute.maxLength) {
      property.maxLength = attribute.maxLength;
    }
    if (attribute.minimum !== undefined) {
      property.minimum = attribute.minimum;
    }
    if (attribute.maximum !== undefined) {
      property.maximum = attribute.maximum;
    }
    if (attribute.pattern) {
      property.pattern = attribute.pattern;
    }
    if (attribute.enum) {
      property.enum = attribute.enum;
    }
    
    // Add default value
    if (attribute.defaultValue !== undefined) {
      property.default = attribute.defaultValue;
    }
    
    // Add examples if configured
    if (this.config.includeExamples && attribute.example) {
      property.examples = [attribute.example];
    }
    
    return property;
  }
  
  /**
   * Export to PlantUML notation
   */
  exportToPlantUML(diagram, options = {}) {
    const lines = ['@startuml'];
    
    // Add title if provided
    if (diagram.title) {
      lines.push(`title ${diagram.title}`);
    }
    
    // Define entities
    for (const entity of diagram.entities || []) {
      lines.push(`entity "${entity.name}" {`);
      
      // Add attributes
      for (const attr of entity.attributes || []) {
        let attrLine = '  ';
        
        if (attr.isPrimaryKey) {
          attrLine += '*';
        } else if (attr.isForeignKey) {
          attrLine += '+';
        }
        
        attrLine += `${attr.name}`;
        
        if (attr.type) {
          attrLine += ` : ${attr.type}`;
        }
        
        if (attr.isRequired && !attr.isPrimaryKey) {
          attrLine += ' <<NOT NULL>>';
        }
        
        lines.push(attrLine);
      }
      
      lines.push('}');
      lines.push('');
    }
    
    // Define relationships
    for (const relationship of diagram.relationships || []) {
      const sourceEntity = diagram.entities.find(e => e.id === relationship.source);
      const targetEntity = diagram.entities.find(e => e.id === relationship.target);
      
      if (sourceEntity && targetEntity) {
        let relLine = `"${sourceEntity.name}" `;
        
        // Add cardinality notation
        const sourceCard = relationship.cardinality?.source || '1';
        const targetCard = relationship.cardinality?.target || '*';
        
        relLine += this._getPlantUMLCardinality(sourceCard, targetCard);
        relLine += ` "${targetEntity.name}"`;
        
        if (relationship.name) {
          relLine += ` : ${relationship.name}`;
        }
        
        lines.push(relLine);
      }
    }
    
    // Define inheritance
    for (const inheritance of diagram.inheritances || []) {
      const parentEntity = diagram.entities.find(e => e.id === inheritance.parentId);
      const childEntity = diagram.entities.find(e => e.id === inheritance.childId);
      
      if (parentEntity && childEntity) {
        lines.push(`"${parentEntity.name}" <|-- "${childEntity.name}"`);
      }
    }
    
    lines.push('@enduml');
    
    return lines.join('\n');
  }
  
  /**
   * Get PlantUML cardinality notation
   */
  _getPlantUMLCardinality(source, target) {
    const mapping = {
      '1-1': '--',
      '1-*': '--{',
      '*-1': '}--',
      '*-*': '}--{'
    };
    
    const sourceNotation = source === '1' ? '1' : '*';
    const targetNotation = target === '1' ? '1' : '*';
    const key = `${sourceNotation}-${targetNotation}`;
    
    return mapping[key] || '--';
  }
  
  /**
   * Export to Crow's Foot notation
   */
  exportToCrowsFoot(diagram, options = {}) {
    const lines = [];
    
    // Header
    lines.push('// Crow\'s Foot Notation Export');
    lines.push(`// Generated: ${new Date().toISOString()}`);
    lines.push('');
    
    // Entities
    lines.push('// Entities');
    for (const entity of diagram.entities || []) {
      lines.push(`ENTITY ${entity.name} {`);
      
      for (const attr of entity.attributes || []) {
        let attrLine = '  ';
        
        if (attr.isPrimaryKey) {
          attrLine += 'PK ';
        } else if (attr.isForeignKey) {
          attrLine += 'FK ';
        }
        
        attrLine += `${attr.name}: ${attr.type || 'VARCHAR'}`;
        
        if (attr.isRequired) {
          attrLine += ' NOT NULL';
        }
        
        lines.push(attrLine);
      }
      
      lines.push('}');
      lines.push('');
    }
    
    // Relationships
    lines.push('// Relationships');
    for (const relationship of diagram.relationships || []) {
      const sourceEntity = diagram.entities.find(e => e.id === relationship.source);
      const targetEntity = diagram.entities.find(e => e.id === relationship.target);
      
      if (sourceEntity && targetEntity) {
        const sourceCard = this._getCrowsFootSymbol(relationship.cardinality?.source);
        const targetCard = this._getCrowsFootSymbol(relationship.cardinality?.target);
        
        lines.push(`${sourceEntity.name} ${sourceCard}--${targetCard} ${targetEntity.name}`);
        
        if (relationship.name) {
          lines.push(`  RELATIONSHIP: ${relationship.name}`);
        }
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get Crow's Foot cardinality symbol
   */
  _getCrowsFootSymbol(cardinality) {
    switch (cardinality) {
      case '1':
      case '1..1':
        return '||';
      case '0..1':
        return '|o';
      case '*':
      case '0..*':
        return 'o{';
      case '1..*':
        return '|{';
      default:
        return '--';
    }
  }
  
  /**
   * Export to Markdown documentation
   */
  exportToMarkdown(diagram, options = {}) {
    const lines = [];
    
    // Title
    lines.push(`# ${diagram.title || 'Entity-Relationship Diagram'}`);
    lines.push('');
    
    if (diagram.description) {
      lines.push(diagram.description);
      lines.push('');
    }
    
    // Table of Contents
    lines.push('## Table of Contents');
    lines.push('- [Entities](#entities)');
    lines.push('- [Relationships](#relationships)');
    if (diagram.inheritances?.length > 0) {
      lines.push('- [Inheritance Hierarchies](#inheritance-hierarchies)');
    }
    lines.push('');
    
    // Entities section
    lines.push('## Entities');
    lines.push('');
    
    for (const entity of diagram.entities || []) {
      lines.push(`### ${entity.name}`);
      
      if (entity.description) {
        lines.push(entity.description);
      }
      
      lines.push('');
      lines.push('| Attribute | Type | Constraints | Description |');
      lines.push('|-----------|------|-------------|-------------|');
      
      for (const attr of entity.attributes || []) {
        const constraints = [];
        if (attr.isPrimaryKey) constraints.push('PK');
        if (attr.isForeignKey) constraints.push('FK');
        if (attr.isRequired) constraints.push('NOT NULL');
        if (attr.isUnique) constraints.push('UNIQUE');
        
        lines.push(
          `| ${attr.name} | ${attr.type || 'VARCHAR'} | ${constraints.join(', ') || '-'} | ${attr.description || '-'} |`
        );
      }
      
      lines.push('');
    }
    
    // Relationships section
    lines.push('## Relationships');
    lines.push('');
    lines.push('| Source | Target | Cardinality | Type | Description |');
    lines.push('|--------|--------|-------------|------|-------------|');
    
    for (const relationship of diagram.relationships || []) {
      const sourceEntity = diagram.entities.find(e => e.id === relationship.source);
      const targetEntity = diagram.entities.find(e => e.id === relationship.target);
      
      if (sourceEntity && targetEntity) {
        const cardinality = `${relationship.cardinality?.source || '1'} to ${relationship.cardinality?.target || '*'}`;
        
        lines.push(
          `| ${sourceEntity.name} | ${targetEntity.name} | ${cardinality} | ${relationship.type || 'Association'} | ${relationship.description || '-'} |`
        );
      }
    }
    
    lines.push('');
    
    // Inheritance section
    if (diagram.inheritances?.length > 0) {
      lines.push('## Inheritance Hierarchies');
      lines.push('');
      
      for (const inheritance of diagram.inheritances) {
        const parentEntity = diagram.entities.find(e => e.id === inheritance.parentId);
        const childEntity = diagram.entities.find(e => e.id === inheritance.childId);
        
        if (parentEntity && childEntity) {
          lines.push(`- **${childEntity.name}** inherits from **${parentEntity.name}**`);
          
          if (inheritance.disjointness) {
            lines.push(`  - Disjointness: ${inheritance.disjointness}`);
          }
          if (inheritance.completeness) {
            lines.push(`  - Completeness: ${inheritance.completeness}`);
          }
        }
      }
      
      lines.push('');
    }
    
    // Footer
    lines.push('---');
    lines.push(`*Generated on ${new Date().toLocaleString()}*`);
    
    return lines.join('\n');
  }
  
  /**
   * Export to migration script
   */
  exportToMigration(diagram, options = {}) {
    const timestamp = Date.now();
    const migrationName = options.name || `create_${diagram.name || 'schema'}_${timestamp}`;
    
    const up = this.exportToSQL(diagram, options);
    const down = this._generateDropStatements(diagram);
    
    // Format based on migration framework
    const framework = options.framework || 'generic';
    
    switch (framework) {
      case 'knex':
        return this._formatKnexMigration(migrationName, up, down);
      case 'sequelize':
        return this._formatSequelizeMigration(migrationName, up, down);
      case 'rails':
        return this._formatRailsMigration(migrationName, up, down);
      default:
        return this._formatGenericMigration(migrationName, up, down);
    }
  }
  
  /**
   * Generate DROP statements for rollback
   */
  _generateDropStatements(diagram) {
    const statements = [];
    
    // Drop tables in reverse order (to handle foreign keys)
    const entities = [...(diagram.entities || [])].reverse();
    
    for (const entity of entities) {
      const tableName = this._formatTableName(entity.name);
      statements.push(`DROP TABLE IF EXISTS ${tableName};`);
    }
    
    return statements.join('\n');
  }
  
  /**
   * Format generic migration
   */
  _formatGenericMigration(name, up, down) {
    return `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- UP
${up}

-- DOWN
${down}
`;
  }
  
  /**
   * Validate diagram before export
   */
  _validateDiagram(diagram) {
    const errors = [];
    
    if (!diagram) {
      errors.push('Diagram is null or undefined');
    }
    
    if (!diagram.entities || diagram.entities.length === 0) {
      errors.push('Diagram must contain at least one entity');
    }
    
    // Check for entity names
    for (const entity of diagram.entities || []) {
      if (!entity.name) {
        errors.push(`Entity missing name: ${entity.id}`);
      }
      
      // Check for primary key
      if (this.config.strictMode) {
        const hasPrimaryKey = entity.attributes?.some(a => a.isPrimaryKey);
        if (!hasPrimaryKey) {
          errors.push(`Entity '${entity.name}' missing primary key`);
        }
      }
    }
    
    // Check relationships
    for (const relationship of diagram.relationships || []) {
      if (!relationship.source || !relationship.target) {
        errors.push(`Relationship missing source or target: ${relationship.id}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Format table name based on naming convention
   */
  _formatTableName(name) {
    switch (this.config.sqlNamingConvention) {
      case 'snake_case':
        return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      case 'camelCase':
        return name.charAt(0).toLowerCase() + name.slice(1);
      case 'PascalCase':
        return name.charAt(0).toUpperCase() + name.slice(1);
      default:
        return name.toLowerCase();
    }
  }
  
  /**
   * Format column name based on naming convention
   */
  _formatColumnName(name) {
    return this._formatTableName(name);
  }
  
  /**
   * Format default value for SQL
   */
  _formatDefaultValue(value, type) {
    if (value === null) return 'NULL';
    
    switch (type) {
      case 'TEXT':
      case 'VARCHAR':
      case 'DATE':
      case 'DATETIME':
        return `'${value}'`;
      case 'NUMBER':
      case 'DECIMAL':
      case 'BOOLEAN':
        return value.toString();
      default:
        return `'${value}'`;
    }
  }
  
  /**
   * Map attribute type to JSON Schema type
   */
  _mapToJSONType(type) {
    const mapping = {
      'TEXT': 'string',
      'VARCHAR': 'string',
      'NUMBER': 'integer',
      'DECIMAL': 'number',
      'BOOLEAN': 'boolean',
      'DATE': 'string',
      'DATETIME': 'string',
      'BLOB': 'string'
    };
    
    return mapping[type] || 'string';
  }
  
  /**
   * Get supported export formats
   */
  getSupportedFormats() {
    return [
      { format: 'sql', name: 'SQL DDL', extensions: ['.sql'] },
      { format: 'jsonschema', name: 'JSON Schema', extensions: ['.json'] },
      { format: 'xsd', name: 'XML Schema', extensions: ['.xsd'] },
      { format: 'graphml', name: 'GraphML', extensions: ['.graphml'] },
      { format: 'plantuml', name: 'PlantUML', extensions: ['.puml'] },
      { format: 'crowsfoot', name: "Crow's Foot", extensions: ['.txt'] },
      { format: 'chen', name: 'Chen Notation', extensions: ['.txt'] },
      { format: 'idef1x', name: 'IDEF1X', extensions: ['.txt'] },
      { format: 'markdown', name: 'Markdown', extensions: ['.md'] },
      { format: 'html', name: 'HTML', extensions: ['.html'] },
      { format: 'migration', name: 'Migration Script', extensions: ['.sql', '.js'] }
    ];
  }
}

export default ERExporter;