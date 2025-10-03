/**
 * OntologyExtractor - Dynamically extracts relevant ontological information to guide LLM processing
 * 
 * Responsibilities:
 * - Schema extraction: Pull relevant classes, properties, and relationships from KG
 * - Domain filtering: Focus on ontological elements relevant to input text
 * - Hierarchy mapping: Extract class hierarchies and property constraints
 * - Example generation: Provide concrete examples for LLM guidance
 */
export class OntologyExtractor {
  constructor(dataSource) {
    this.dataSource = dataSource; // Using Handle-based dataSource instead of kgEngine
    this.cache = new Map(); // Cache for frequently accessed schemas
  }

  /**
   * Extract relevant ontological schema for given text
   * @param {string} text - Input text to analyze
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} - Extracted schema information
   */
  async extractRelevantSchema(text, options = {}) {
    const {
      maxClasses = 20,
      maxProperties = 50,
      maxExamples = 10,
      domainFilter = null
    } = options;

    // TODO: Replace with real dataSource queries to knowledge graph
    // For Phase 1, using hardcoded schemas to prove the pipeline works
    // Phase 2 will query actual ontologies from the triplestore via dataSource
    //
    // if (this.dataSource) {
    //   const schema = await this.queryDataSourceForSchema(text, options);
    //   return schema;
    // }
    //
    // FAIL FAST: No fallbacks! If KG integration fails, throw error
    return this.getHardcodedSchema(text, { maxClasses, maxProperties, maxExamples, domainFilter });
  }

  /**
   * Get hardcoded schema for development/testing
   * @param {string} text - Input text
   * @param {Object} options - Options
   * @returns {Object} - Schema object
   */
  getHardcodedSchema(text, options) {
    // Analyze text to determine relevant domain
    const domain = this.detectDomain(text);
    
    const schema = {
      domain,
      entityClasses: this.getEntityClasses(domain),
      relationshipTypes: this.getRelationshipTypes(domain),
      properties: this.getProperties(domain),
      constraints: this.getConstraints(domain),
      examples: this.getExamples(domain, options.maxExamples)
    };

    return schema;
  }

  /**
   * Detect domain from text content
   * @param {string} text - Input text
   * @returns {string} - Detected domain
   */
  detectDomain(text) {
    const lowerText = text.toLowerCase();
    
    // Industrial/Engineering domain indicators
    const industrialKeywords = ['pump', 'tank', 'system', 'valve', 'pipe', 'pressure', 'flow', 'equipment', 'component', 'psi', 'bar', 'temperature'];
    const industrialCount = industrialKeywords.filter(keyword => lowerText.includes(keyword)).length;
    
    // Technical documentation indicators
    const technicalKeywords = ['specification', 'manual', 'documentation', 'procedure', 'installation', 'maintenance', 'operation'];
    const technicalCount = technicalKeywords.filter(keyword => lowerText.includes(keyword)).length;
    
    // Business domain indicators - lowered threshold and added more keywords
    const businessKeywords = ['company', 'organization', 'department', 'employee', 'manager', 'project', 'contract', 'works', 'corporation', 'acme'];
    const businessCount = businessKeywords.filter(keyword => lowerText.includes(keyword)).length;

    if (industrialCount >= 2) return 'industrial';
    if (businessCount >= 1) return 'business'; // Lowered threshold for business
    if (technicalCount >= 2) return 'technical';
    
    return 'general';
  }

  /**
   * Get entity classes for domain
   * @param {string} domain - Domain name
   * @returns {Array} - Entity class definitions
   */
  getEntityClasses(domain) {
    const baseClasses = [
      {
        name: 'Entity',
        uid: 'entity',
        description: 'Base class for all entities',
        properties: ['name', 'identifier', 'description']
      }
    ];

    const domainClasses = {
      industrial: [
        {
          name: 'Equipment',
          uid: 'equipment',
          description: 'Industrial equipment and machinery',
          properties: ['name', 'identifier', 'type', 'manufacturer', 'model', 'capacity'],
          subclasses: ['Pump', 'Tank', 'Valve', 'Pipe']
        },
        {
          name: 'Pump',
          uid: 'pump',
          description: 'Pumping equipment',
          properties: ['name', 'identifier', 'capacity', 'pressure_rating', 'flow_rate', 'manufacturer']
        },
        {
          name: 'Tank',
          uid: 'tank',
          description: 'Storage tanks and vessels',
          properties: ['name', 'identifier', 'volume', 'pressure_rating', 'material', 'contents']
        },
        {
          name: 'System',
          uid: 'system',
          description: 'Industrial systems and processes',
          properties: ['name', 'identifier', 'type', 'components', 'operating_parameters']
        },
        {
          name: 'Component',
          uid: 'component',
          description: 'System components and parts',
          properties: ['name', 'identifier', 'type', 'parent_system', 'specifications']
        }
      ],
      technical: [
        {
          name: 'Document',
          uid: 'document',
          description: 'Technical documents and manuals',
          properties: ['title', 'type', 'version', 'author', 'date']
        },
        {
          name: 'Procedure',
          uid: 'procedure',
          description: 'Technical procedures and processes',
          properties: ['name', 'steps', 'requirements', 'safety_notes']
        }
      ],
      business: [
        {
          name: 'Organization',
          uid: 'organization',
          description: 'Companies and organizations',
          properties: ['name', 'type', 'industry', 'location']
        },
        {
          name: 'Person',
          uid: 'person',
          description: 'People and employees',
          properties: ['name', 'role', 'department', 'contact_info']
        }
      ]
    };

    return [...baseClasses, ...(domainClasses[domain] || [])];
  }

  /**
   * Get relationship types for domain
   * @param {string} domain - Domain name
   * @returns {Array} - Relationship type definitions
   */
  getRelationshipTypes(domain) {
    const baseRelationships = [
      {
        name: 'is_part_of',
        uid: 'gellish:1230',
        description: 'Entity is part of another entity',
        inverse: 'consists_of',
        domain: 'Entity',
        range: 'Entity'
      },
      {
        name: 'contains',
        uid: 'gellish:1331',
        description: 'Entity contains another entity',
        inverse: 'is_contained_in',
        domain: 'Entity',
        range: 'Entity'
      }
    ];

    const domainRelationships = {
      industrial: [
        {
          name: 'connected_to',
          uid: 'gellish:1456',
          description: 'Equipment is connected to other equipment',
          inverse: 'connected_to',
          domain: 'Equipment',
          range: 'Equipment'
        },
        {
          name: 'manufactured_by',
          uid: 'manufactured_by',
          description: 'Equipment is manufactured by organization',
          inverse: 'manufactures',
          domain: 'Equipment',
          range: 'Organization'
        },
        {
          name: 'operates_at',
          uid: 'operates_at',
          description: 'Equipment operates at specific parameters',
          domain: 'Equipment',
          range: 'Parameter'
        },
        {
          name: 'located_in',
          uid: 'located_in',
          description: 'Entity is located in another entity',
          inverse: 'contains_location',
          domain: 'Entity',
          range: 'Entity'
        }
      ],
      business: [
        {
          name: 'works_for',
          uid: 'works_for',
          description: 'Person works for organization',
          inverse: 'employs',
          domain: 'Person',
          range: 'Organization'
        },
        {
          name: 'manages',
          uid: 'manages',
          description: 'Person manages another person or entity',
          inverse: 'managed_by',
          domain: 'Person',
          range: 'Entity'
        }
      ]
    };

    return [...baseRelationships, ...(domainRelationships[domain] || [])];
  }

  /**
   * Get properties for domain
   * @param {string} domain - Domain name
   * @returns {Array} - Property definitions
   */
  getProperties(domain) {
    const baseProperties = [
      { name: 'name', type: 'string', required: true },
      { name: 'identifier', type: 'string', required: false },
      { name: 'description', type: 'string', required: false }
    ];

    const domainProperties = {
      industrial: [
        { name: 'manufacturer', type: 'string', required: false },
        { name: 'model', type: 'string', required: false },
        { name: 'capacity', type: 'number', unit: 'various', required: false },
        { name: 'pressure_rating', type: 'number', unit: 'psi', required: false },
        { name: 'flow_rate', type: 'number', unit: 'gpm', required: false },
        { name: 'temperature', type: 'number', unit: '°F', required: false },
        { name: 'material', type: 'string', required: false },
        { name: 'volume', type: 'number', unit: 'gallons', required: false }
      ],
      business: [
        { name: 'role', type: 'string', required: false },
        { name: 'department', type: 'string', required: false },
        { name: 'location', type: 'string', required: false },
        { name: 'contact_info', type: 'string', required: false }
      ]
    };

    return [...baseProperties, ...(domainProperties[domain] || [])];
  }

  /**
   * Get constraints for domain
   * @param {string} domain - Domain name
   * @returns {Array} - Constraint definitions
   */
  getConstraints(domain) {
    return [
      {
        type: 'required_property',
        description: 'All entities must have a name',
        applies_to: 'Entity',
        property: 'name'
      },
      {
        type: 'unique_identifier',
        description: 'Entity identifiers should be unique within their class',
        applies_to: 'Entity',
        property: 'identifier'
      },
      {
        type: 'valid_relationship',
        description: 'Relationships must connect valid entity types',
        applies_to: 'Relationship'
      }
    ];
  }

  /**
   * Get examples for domain
   * @param {string} domain - Domain name
   * @param {number} maxExamples - Maximum number of examples
   * @returns {Array} - Example entities and relationships
   */
  getExamples(domain, maxExamples = 10) {
    const domainExamples = {
      industrial: [
        {
          type: 'entity',
          class: 'Pump',
          example: {
            name: 'Pump P101',
            identifier: 'P101',
            manufacturer: 'Siemens',
            capacity: '100 gpm',
            pressure_rating: '150 psi'
          }
        },
        {
          type: 'entity',
          class: 'Tank',
          example: {
            name: 'Storage Tank T200',
            identifier: 'T200',
            volume: '1000 gallons',
            material: 'stainless steel'
          }
        },
        {
          type: 'entity',
          class: 'System',
          example: {
            name: 'Cooling System S300',
            identifier: 'S300',
            type: 'cooling'
          }
        },
        {
          type: 'relationship',
          predicate: 'is_part_of',
          example: {
            subject: 'Pump P101',
            object: 'System S300',
            description: 'Pump P101 is part of System S300'
          }
        },
        {
          type: 'relationship',
          predicate: 'manufactured_by',
          example: {
            subject: 'Pump P101',
            object: 'Siemens',
            description: 'Pump P101 is manufactured by Siemens'
          }
        }
      ],
      business: [
        {
          type: 'entity',
          class: 'Person',
          example: {
            name: 'John Smith',
            role: 'Engineer',
            department: 'Manufacturing'
          }
        },
        {
          type: 'entity',
          class: 'Organization',
          example: {
            name: 'Acme Corporation',
            type: 'Manufacturing Company',
            location: 'Detroit, MI'
          }
        }
      ]
    };

    const examples = domainExamples[domain] || [];
    return examples.slice(0, maxExamples);
  }

  /**
   * Generate JSON schema for LLM consumption
   * @param {Object} schema - Ontological schema
   * @returns {Object} - JSON schema for LLM
   */
  generateLLMSchema(schema) {
    return {
      entityTypes: schema.entityClasses.map(cls => ({
        name: cls.name,
        description: cls.description,
        properties: cls.properties,
        examples: schema.examples
          .filter(ex => ex.type === 'entity' && ex.class === cls.name)
          .map(ex => ex.example)
      })),
      relationshipTypes: schema.relationshipTypes.map(rel => ({
        name: rel.name,
        description: rel.description,
        domain: rel.domain,
        range: rel.range,
        examples: schema.examples
          .filter(ex => ex.type === 'relationship' && ex.predicate === rel.name)
          .map(ex => ex.example)
      })),
      constraints: schema.constraints,
      domain: schema.domain
    };
  }

  /**
   * Clear schema cache
   */
  clearCache() {
    this.cache.clear();
  }
}
