/**
 * MarkdownReporter - Generate formatted markdown reports from MongoDB
 *
 * Reads both ontology schema (RDF triples) and entity instances from MongoDB
 * and produces comprehensive, well-formatted markdown documentation.
 */

export class MarkdownReporter {
  constructor(tripleStore, knowledgeGraphStore, hierarchyTraversal) {
    if (!tripleStore) {
      throw new Error('TripleStore is required');
    }
    if (!knowledgeGraphStore) {
      throw new Error('KnowledgeGraphStore is required');
    }
    if (!hierarchyTraversal) {
      throw new Error('HierarchyTraversal is required');
    }

    this.tripleStore = tripleStore;
    this.knowledgeGraphStore = knowledgeGraphStore;
    this.hierarchyTraversal = hierarchyTraversal;
  }

  /**
   * Generate comprehensive markdown report
   *
   * @param {Object} options - Report options
   * @param {string} options.title - Report title
   * @param {string} options.domain - Domain name
   * @param {string} options.sourceText - Source text used to build the knowledge graph (optional)
   * @param {boolean} options.includeBootstrap - Include bootstrap ontology details (default: false)
   * @param {boolean} options.includeInstances - Include entity instances (default: true)
   * @param {boolean} options.includeProcessDetails - Include process preconditions/postconditions (default: true)
   * @returns {Promise<string>} - Markdown document
   */
  async generateReport(options = {}) {
    const {
      title = 'Knowledge Graph Report',
      domain = 'General',
      sourceText = null,
      includeBootstrap = false,
      includeInstances = true,
      includeProcessDetails = true
    } = options;

    const sections = [];

    // Title and metadata
    sections.push(this._generateHeader(title, domain, sourceText));

    // Overview statistics
    sections.push(await this._generateOverview());

    // Upper-level ontology structure
    sections.push(await this._generateUpperLevelOntology(includeBootstrap));

    // Domain ontology by category
    sections.push(await this._generateDomainOntology());

    // Properties and relationships
    sections.push(await this._generatePropertiesAndRelationships());

    // Entity instances
    if (includeInstances) {
      sections.push(await this._generateEntityInstances(includeProcessDetails));
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Generate header section
   * @private
   */
  _generateHeader(title, domain, sourceText) {
    const timestamp = new Date().toISOString();
    let header = `# ${title}

**Domain:** ${domain}
**Generated:** ${timestamp}
**Generator:** Legion Knowledge Graph System`;

    if (sourceText) {
      header += `

## 📝 Source Text

The knowledge graph was built from the following input:

\`\`\`
${sourceText.trim()}
\`\`\``;
    }

    return header;
  }

  /**
   * Generate overview statistics
   * @private
   */
  async _generateOverview() {
    const tripleStats = await this.tripleStore.getStatistics();
    const kgStats = await this.knowledgeGraphStore.getStatistics();

    return `## 📊 Overview

### Ontology Schema (RDF Triples)

| Metric | Count |
|--------|-------|
| Total Triples | ${tripleStats.totalTriples} |
| Classes | ${tripleStats.classes} |
| Datatype Properties | ${tripleStats.datatypeProperties} |
| Object Properties | ${tripleStats.objectProperties} |

### Entity Instances (Knowledge Graph)

| Metric | Count |
|--------|-------|
| Total Items | ${kgStats.total} |
| Entities | ${kgStats.totalEntities} |
| Relationships | ${kgStats.totalRelationships} |

### Instance Breakdown by Type

${Object.entries(kgStats.byType || {})
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join('\n') || '_No instances yet_'}`;
  }

  /**
   * Generate upper-level ontology structure
   * @private
   */
  async _generateUpperLevelOntology(includeBootstrap) {
    const output = ['## 🏗️  Upper-Level Ontology'];

    if (includeBootstrap) {
      output.push(`
### Bootstrap Categories

The knowledge graph uses a BFO-inspired upper-level ontology that categorizes all entities into fundamental types.

\`\`\`
owl:Thing
├── kg:Continuant (things that persist through time)
│   ├── kg:PhysicalEntity (material objects)
│   └── kg:State (conditions, configurations)
└── kg:Occurrent (things that happen)
    ├── kg:Process (natural/industrial transformations)
    └── kg:Task (planned, goal-directed activities)
\`\`\``);

      // Process-State relationships
      const processRelationships = [
        'kg:requiresPrecondition',
        'kg:producesPostcondition',
        'kg:transforms',
        'kg:hasParticipant'
      ];

      const relDetails = [];
      for (const relURI of processRelationships) {
        const labels = await this.tripleStore.query(relURI, 'rdfs:label', null);
        const domains = await this.tripleStore.query(relURI, 'rdfs:domain', null);
        const ranges = await this.tripleStore.query(relURI, 'rdfs:range', null);

        if (labels.length > 0) {
          const label = labels[0][2].replace(/"/g, '');
          const domain = domains[0]?.[2] || 'any';
          const range = ranges[0]?.[2] || 'any';
          relDetails.push(`- **${label}** (${relURI}): ${domain} → ${range}`);
        }
      }

      output.push(`
### Process-State Relationships

${relDetails.join('\n')}`);
    } else {
      output.push('_Upper-level ontology (Continuant/Occurrent) automatically loaded_');
    }

    return output.join('\n\n');
  }

  /**
   * Generate domain ontology categorized by upper-level types
   * @private
   */
  async _generateDomainOntology() {
    const output = ['## 🎯 Domain Ontology'];

    const allClasses = await this.tripleStore.query(null, 'rdf:type', 'owl:Class');

    // Filter to domain classes (exclude bootstrap)
    const bootstrapClasses = new Set([
      'kg:Continuant',
      'kg:Occurrent',
      'kg:PhysicalEntity',
      'kg:State',
      'kg:Process',
      'kg:Task'
    ]);

    const categorized = {
      PhysicalEntity: [],
      State: [],
      Process: [],
      Task: [],
      Other: []
    };

    for (const [classURI] of allClasses) {
      if (!classURI.startsWith('kg:') || bootstrapClasses.has(classURI)) {
        continue;
      }

      const ancestors = await this.hierarchyTraversal.getAncestors(classURI);
      const labels = await this.tripleStore.query(classURI, 'rdfs:label', null);
      const definitions = await this.tripleStore.query(classURI, 'skos:definition', null);
      const comments = await this.tripleStore.query(classURI, 'rdfs:comment', null);

      const classInfo = {
        uri: classURI,
        label: labels[0]?.[2]?.replace(/"/g, '') || classURI,
        definition: definitions[0]?.[2]?.replace(/"/g, ''),
        comment: comments[0]?.[2]?.replace(/"/g, ''),
        parent: ancestors[0] || 'owl:Thing'
      };

      if (ancestors.includes('kg:PhysicalEntity')) {
        categorized.PhysicalEntity.push(classInfo);
      } else if (ancestors.includes('kg:State')) {
        categorized.State.push(classInfo);
      } else if (ancestors.includes('kg:Process')) {
        categorized.Process.push(classInfo);
      } else if (ancestors.includes('kg:Task')) {
        categorized.Task.push(classInfo);
      } else {
        categorized.Other.push(classInfo);
      }
    }

    // Physical Entities
    if (categorized.PhysicalEntity.length > 0) {
      output.push('### 🔧 Physical Entities\n');
      output.push('_Material objects that have physical presence_\n');
      output.push(this._formatClassList(categorized.PhysicalEntity));
    }

    // States
    if (categorized.State.length > 0) {
      output.push('### 📊 States\n');
      output.push('_Conditions, configurations, or situations_\n');
      output.push(this._formatClassList(categorized.State));
    }

    // Processes
    if (categorized.Process.length > 0) {
      output.push('### ⚙️  Processes\n');
      output.push('_Natural or industrial transformations_\n');
      output.push(this._formatClassList(categorized.Process));
    }

    // Tasks
    if (categorized.Task.length > 0) {
      output.push('### ✅ Tasks\n');
      output.push('_Planned, goal-directed activities_\n');
      output.push(this._formatClassList(categorized.Task));
    }

    // Other
    if (categorized.Other.length > 0) {
      output.push('### ❓ Other Classes\n');
      output.push(this._formatClassList(categorized.Other));
    }

    if (allClasses.length === 0 || Object.values(categorized).every(arr => arr.length === 0)) {
      output.push('_No domain classes defined yet_');
    }

    return output.join('\n');
  }

  /**
   * Format class list with details
   * @private
   */
  _formatClassList(classes) {
    return classes.map(cls => {
      const parts = [`#### ${cls.label}`];
      parts.push(`**URI:** \`${cls.uri}\`  `);
      parts.push(`**Parent:** \`${cls.parent}\``);

      if (cls.definition) {
        parts.push(`\n**Definition:** ${cls.definition}`);
      }

      if (cls.comment) {
        parts.push(`\n**Description:** ${cls.comment}`);
      }

      return parts.join('\n');
    }).join('\n\n');
  }

  /**
   * Generate properties and relationships section
   * @private
   */
  async _generatePropertiesAndRelationships() {
    const output = ['## 🔗 Properties & Relationships'];

    // Datatype Properties
    const datatypeProps = await this.tripleStore.query(null, 'rdf:type', 'owl:DatatypeProperty');
    if (datatypeProps.length > 0) {
      output.push('### 📝 Datatype Properties\n');

      const propDetails = [];
      for (const [propURI] of datatypeProps) {
        if (!propURI.startsWith('kg:')) continue;

        const labels = await this.tripleStore.query(propURI, 'rdfs:label', null);
        const domains = await this.tripleStore.query(propURI, 'rdfs:domain', null);
        const ranges = await this.tripleStore.query(propURI, 'rdfs:range', null);

        const label = labels[0]?.[2]?.replace(/"/g, '') || propURI;
        const domain = domains[0]?.[2] || 'any';
        const range = ranges[0]?.[2] || 'any';

        propDetails.push(`- **${label}** (\`${propURI}\`)
  - Domain: \`${domain}\`
  - Range: \`${range}\``);
      }

      output.push(propDetails.join('\n'));
    }

    // Object Properties
    const objectProps = await this.tripleStore.query(null, 'rdf:type', 'owl:ObjectProperty');
    if (objectProps.length > 0) {
      output.push('\n### 🔀 Object Properties (Relationships)\n');

      const relDetails = [];
      for (const [propURI] of objectProps) {
        if (!propURI.startsWith('kg:')) continue;

        const labels = await this.tripleStore.query(propURI, 'rdfs:label', null);
        const domains = await this.tripleStore.query(propURI, 'rdfs:domain', null);
        const ranges = await this.tripleStore.query(propURI, 'rdfs:range', null);
        const parents = await this.tripleStore.query(propURI, 'rdfs:subPropertyOf', null);

        const label = labels[0]?.[2]?.replace(/"/g, '') || propURI;
        const domain = domains[0]?.[2] || 'any';
        const range = ranges[0]?.[2] || 'any';
        const parent = parents[0]?.[2];

        let detail = `- **${label}** (\`${propURI}\`)
  - Domain: \`${domain}\`
  - Range: \`${range}\``;

        if (parent) {
          detail += `\n  - Parent: \`${parent}\``;
        }

        relDetails.push(detail);
      }

      output.push(relDetails.join('\n'));
    }

    if (datatypeProps.length === 0 && objectProps.length === 0) {
      output.push('_No properties or relationships defined yet_');
    }

    return output.join('\n');
  }

  /**
   * Generate entity instances section
   * @private
   */
  async _generateEntityInstances(includeProcessDetails) {
    const output = ['## 💾 Entity Instances'];

    const stats = await this.knowledgeGraphStore.getStatistics();

    if (stats.total === 0) {
      output.push('_No entity instances created yet_');
      return output.join('\n');
    }

    // Get entities by category
    const physicalEntities = await this.knowledgeGraphStore.findPhysicalEntities();
    const states = await this.knowledgeGraphStore.findStates();
    const processes = await this.knowledgeGraphStore.findProcesses();
    const tasks = await this.knowledgeGraphStore.findTasks();

    // Physical Entities
    if (physicalEntities.length > 0) {
      output.push('### 🔧 Physical Entity Instances\n');
      output.push(this._formatEntityList(physicalEntities));
    }

    // States
    if (states.length > 0) {
      output.push('\n### 📊 State Instances\n');
      output.push(this._formatEntityList(states));
    }

    // Processes
    if (processes.length > 0) {
      output.push('\n### ⚙️  Process Instances\n');
      output.push(this._formatEntityList(processes));

      // Include process preconditions/postconditions
      if (includeProcessDetails) {
        for (const process of processes) {
          const preconditions = await this.knowledgeGraphStore.findProcessPreconditions(process._id);
          const postconditions = await this.knowledgeGraphStore.findProcessPostconditions(process._id);
          const transforms = await this.knowledgeGraphStore.findProcessTransforms(process._id);

          if (preconditions.length > 0 || postconditions.length > 0 || transforms.length > 0) {
            output.push(`\n#### Process Details: ${process.label}\n`);

            if (preconditions.length > 0) {
              output.push('**Preconditions:**');
              preconditions.forEach(p => {
                output.push(`- ${p.label} (${JSON.stringify(p.attributes)})`);
              });
            }

            if (postconditions.length > 0) {
              output.push('\n**Postconditions:**');
              postconditions.forEach(p => {
                output.push(`- ${p.label} (${JSON.stringify(p.attributes)})`);
              });
            }

            if (transforms.length > 0) {
              output.push('\n**Transforms:**');
              transforms.forEach(t => {
                output.push(`- ${t.label}`);
              });
            }
          }
        }
      }
    }

    // Tasks
    if (tasks.length > 0) {
      output.push('\n### ✅ Task Instances\n');
      output.push(this._formatEntityList(tasks));
    }

    // Relationships
    const allRelationships = await this.knowledgeGraphStore.findRelationships({});
    if (allRelationships.length > 0) {
      output.push('\n### 🔀 Relationship Instances\n');
      output.push(await this._formatRelationshipList(allRelationships));
    }

    return output.join('\n');
  }

  /**
   * Format entity list
   * @private
   */
  _formatEntityList(entities) {
    return entities.map(entity => {
      const parts = [`- **${entity.label}**`];
      parts.push(`  - Type: \`${entity.ontologyType}\``);
      parts.push(`  - ID: \`${entity._id}\``);

      if (entity.attributes && Object.keys(entity.attributes).length > 0) {
        parts.push(`  - Attributes: ${JSON.stringify(entity.attributes)}`);
      }

      if (entity.provenance?.mentionedIn) {
        parts.push(`  - Sources: ${entity.provenance.mentionedIn.join(', ')}`);
      }

      if (entity.provenance?.confidence) {
        parts.push(`  - Confidence: ${(entity.provenance.confidence * 100).toFixed(0)}%`);
      }

      return parts.join('\n');
    }).join('\n');
  }

  /**
   * Format relationship list
   * @private
   */
  async _formatRelationshipList(relationships) {
    const formatted = [];

    for (const rel of relationships) {
      // Get source and target entities
      const fromEntity = await this.knowledgeGraphStore.findEntityById(rel.from);
      const toEntity = await this.knowledgeGraphStore.findEntityById(rel.to);

      if (!fromEntity || !toEntity) continue;

      const parts = [`- **${rel.label}**`];
      parts.push(`  - Type: \`${rel.ontologyType}\``);
      parts.push(`  - From: ${fromEntity.label} (\`${fromEntity.ontologyType}\`)`);
      parts.push(`  - To: ${toEntity.label} (\`${toEntity.ontologyType}\`)`);

      if (rel.attributes && Object.keys(rel.attributes).length > 0) {
        parts.push(`  - Attributes: ${JSON.stringify(rel.attributes)}`);
      }

      if (rel.provenance?.confidence) {
        parts.push(`  - Confidence: ${(rel.provenance.confidence * 100).toFixed(0)}%`);
      }

      formatted.push(parts.join('\n'));
    }

    return formatted.join('\n');
  }

  /**
   * Generate summary statistics section (can be used separately)
   *
   * @returns {Promise<string>} - Summary markdown
   */
  async generateSummary() {
    const tripleStats = await this.tripleStore.getStatistics();
    const kgStats = await this.knowledgeGraphStore.getStatistics();

    return `## Summary

- **Ontology Classes:** ${tripleStats.classes}
- **Ontology Relationships:** ${tripleStats.objectProperties}
- **Entity Instances:** ${kgStats.totalEntities}
- **Relationship Instances:** ${kgStats.totalRelationships}
- **Total RDF Triples:** ${tripleStats.totalTriples}`;
  }
}
