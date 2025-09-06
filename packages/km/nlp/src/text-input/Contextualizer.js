/**
 * Contextualizer - Builds rich context for text segments to improve extraction quality
 * 
 * Responsibilities:
 * - Document Context: Overall document purpose and domain
 * - Segment Context: Local context for each processing chunk
 * - Entity Context: Previously identified entities and their attributes
 * - Relationship Context: Known relationships that might inform new extractions
 */
export class Contextualizer {
  constructor(options = {}) {
    this.options = {
      includeStructural: true,
      includeSemantic: true,
      includeOntological: true,
      maxContextLength: 1000,
      entityPatterns: [
        /([A-Z][a-zA-Z]*)\s+([A-Z]\d+)/g, // Equipment patterns like "Pump P101"
        /([A-Z][a-zA-Z]+\s+(?:Inc|Corp|Ltd|Company))/gi, // Company names
        /(System\s+[A-Z]\d+)/gi, // System patterns like "System S300"
      ],
      ...options
    };
  }

  /**
   * Build comprehensive context for document and its segments
   * @param {Object} document - Document with content and metadata
   * @param {Array} segments - Array of document segments
   * @returns {Object} - Context information for document and segments
   */
  buildContext(document, segments) {
    if (!document) {
      return {
        documentContext: {},
        segmentContexts: []
      };
    }

    // Build document-level context
    const documentContext = this.buildDocumentContext(document);

    // Build context for each segment
    const segmentContexts = segments.map((segment, index) => {
      return this.buildSegmentContext(document, segment, documentContext, segments);
    });

    return {
      documentContext,
      segmentContexts
    };
  }

  /**
   * Build document-level context
   * @param {Object} document - Document with content and metadata
   * @returns {Object} - Document context
   */
  buildDocumentContext(document) {
    const metadata = document.metadata || {};
    const structure = this.analyzeDocumentStructure(document.content);

    return {
      title: metadata.title || '',
      domain: metadata.domain || 'general',
      type: metadata.type || 'document',
      length: document.content ? document.content.length : 0,
      structure
    };
  }

  /**
   * Build context for a specific segment
   * @param {Object} document - Full document
   * @param {Object} segment - Segment to build context for
   * @param {Object} documentContext - Document-level context
   * @param {Array} allSegments - All segments for cross-reference
   * @returns {Object} - Segment context
   */
  buildSegmentContext(document, segment, documentContext, allSegments) {
    const context = {
      segmentIndex: segment.segmentIndex || 0,
      content: segment.content || ''
    };

    // Add structural context
    if (this.options.includeStructural) {
      context.structural = this.extractStructuralContext(document, segment);
    }

    // Add semantic context
    if (this.options.includeSemantic) {
      context.semantic = this.extractSemanticContext(segment, documentContext);
    }

    // Add ontological context
    if (this.options.includeOntological && context.semantic) {
      context.ontological = this.buildOntologicalContext(
        context.semantic.entities || [], 
        documentContext.domain
      );
    }

    return context;
  }

  /**
   * Analyze document structure
   * @param {string} content - Document content
   * @returns {Object} - Structure analysis
   */
  analyzeDocumentStructure(content) {
    if (!content) {
      return {
        hasHeaders: false,
        headerLevels: [],
        sections: [],
        totalSections: 0
      };
    }

    const headerMatches = content.match(/^\s*(#{1,6})\s+(.+)$/gm) || [];
    const headerLevels = headerMatches.map(match => {
      const levelMatch = match.match(/^\s*(#{1,6})/);
      return levelMatch ? levelMatch[1].length : 0;
    });

    const sections = headerMatches.map((match, index) => {
      const levelMatch = match.match(/^\s*(#{1,6})\s+(.+)$/);
      return {
        level: levelMatch ? levelMatch[1].length : 0,
        title: levelMatch ? levelMatch[2].trim() : '',
        index
      };
    });

    return {
      hasHeaders: headerMatches.length > 0,
      headerLevels: [...new Set(headerLevels)].sort(),
      sections,
      totalSections: sections.length
    };
  }

  /**
   * Extract structural context for a segment
   * @param {Object} document - Full document
   * @param {Object} segment - Segment to analyze
   * @returns {Object} - Structural context
   */
  extractStructuralContext(document, segment) {
    const content = document.content || '';
    const segmentStart = segment.startPosition || 0;
    const segmentEnd = segment.endPosition || segmentStart + (segment.content || '').length;

    // Find nearby headers
    const nearbyHeaders = this.findNearbyHeaders(content, segmentStart, segmentEnd);
    
    // Determine section level and parent section
    const { sectionLevel, parentSection } = this.determineSectionHierarchy(
      content, 
      segmentStart, 
      nearbyHeaders
    );

    return {
      nearbyHeaders,
      sectionLevel,
      parentSection,
      documentStructure: this.analyzeDocumentStructure(content)
    };
  }

  /**
   * Find headers near the segment
   * @param {string} content - Document content
   * @param {number} segmentStart - Segment start position
   * @param {number} segmentEnd - Segment end position
   * @returns {Array} - Nearby headers
   */
  findNearbyHeaders(content, segmentStart, segmentEnd) {
    const lines = content.split('\n');
    const headers = [];
    let currentPosition = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^\s*(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        const headerStart = currentPosition;
        const headerEnd = currentPosition + line.length;
        
        // Include headers within reasonable distance of segment
        const distance = Math.min(
          Math.abs(headerStart - segmentStart),
          Math.abs(headerEnd - segmentEnd)
        );
        
        if (distance <= 500) { // Within 500 characters
          headers.push({
            level: headerMatch[1].length,
            title: headerMatch[2].trim(),
            position: headerStart,
            distance
          });
        }
      }
      
      currentPosition += line.length + 1; // +1 for newline
    }

    return headers.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Determine section hierarchy for segment
   * @param {string} content - Document content
   * @param {number} segmentStart - Segment start position
   * @param {Array} nearbyHeaders - Nearby headers
   * @returns {Object} - Section hierarchy info
   */
  determineSectionHierarchy(content, segmentStart, nearbyHeaders) {
    if (nearbyHeaders.length === 0) {
      return {
        sectionLevel: 0,
        parentSection: ''
      };
    }

    // Find the most recent header before the segment
    const precedingHeaders = nearbyHeaders.filter(h => h.position < segmentStart);
    
    if (precedingHeaders.length === 0) {
      return {
        sectionLevel: 0,
        parentSection: ''
      };
    }

    // Sort by position to get the most recent header (closest to segment)
    precedingHeaders.sort((a, b) => b.position - a.position);
    const parentHeader = precedingHeaders[0];
    
    return {
      sectionLevel: parentHeader.level,
      parentSection: parentHeader.title
    };
  }

  /**
   * Extract semantic context for a segment
   * @param {Object} segment - Segment to analyze
   * @param {Object} documentContext - Document context
   * @returns {Object} - Semantic context
   */
  extractSemanticContext(segment, documentContext) {
    const content = segment.content || '';
    const domain = documentContext.domain || 'general';

    // Extract entities using patterns
    const entities = this.extractEntities(content);
    
    // Extract domain-specific terminology
    const terminology = this.extractTerminology(content, domain);

    return {
      entities,
      terminology,
      domain,
      contentLength: content.length,
      wordCount: content.split(/\s+/).filter(w => w.length > 0).length
    };
  }

  /**
   * Extract entities from content using patterns
   * @param {string} content - Content to analyze
   * @returns {Array} - Extracted entities
   */
  extractEntities(content) {
    const entities = [];
    
    for (const pattern of this.options.entityPatterns) {
      pattern.lastIndex = 0; // Reset regex
      const matches = [...content.matchAll(pattern)];
      
      for (const match of matches) {
        const entity = {
          text: match[0].trim(),
          type: this.classifyEntity(match[0].trim()),
          position: match.index,
          confidence: 0.8 // Basic confidence score
        };
        
        // Avoid duplicates
        if (!entities.some(e => e.text === entity.text)) {
          entities.push(entity);
        }
      }
    }

    return entities;
  }

  /**
   * Classify entity type based on patterns
   * @param {string} entityText - Entity text
   * @returns {string} - Entity type
   */
  classifyEntity(entityText) {
    if (/^Pump\s+/i.test(entityText)) return 'Pump';
    if (/^Tank\s+/i.test(entityText)) return 'Tank';
    if (/^System\s+/i.test(entityText)) return 'System';
    if (/^Pipeline\s+/i.test(entityText)) return 'Pipeline';
    if (/\s+(Inc|Corp|Ltd|Company)$/i.test(entityText)) return 'Company';
    
    // Default classification based on pattern
    if (/^[A-Z][a-zA-Z]*\s+[A-Z]\d+$/.test(entityText)) {
      const prefix = entityText.split(' ')[0];
      return prefix;
    }
    
    return 'Entity';
  }

  /**
   * Extract domain-specific terminology
   * @param {string} content - Content to analyze
   * @param {string} domain - Domain context
   * @returns {Array} - Domain terminology
   */
  extractTerminology(content, domain) {
    const terminology = [];
    
    // Domain-specific term patterns
    const domainPatterns = {
      industrial: [
        /\b(pump|tank|valve|pipe|system|pressure|flow|temperature|efficiency)\b/gi,
        /\b(centrifugal|hydraulic|pneumatic|mechanical|electrical)\b/gi,
        /\b(PSI|GPM|RPM|kW|HP|°F|°C)\b/g
      ],
      medical: [
        /\b(patient|symptom|diagnosis|treatment|medication|therapy)\b/gi,
        /\b(hypertension|diabetes|infection|surgery|prescription)\b/gi
      ],
      technical: [
        /\b(software|hardware|system|network|database|server)\b/gi,
        /\b(algorithm|protocol|interface|framework|architecture)\b/gi
      ],
      business: [
        /\b(revenue|profit|customer|market|strategy|analysis)\b/gi,
        /\b(management|operations|finance|sales|marketing)\b/gi
      ]
    };

    const patterns = domainPatterns[domain] || domainPatterns.technical;
    
    for (const pattern of patterns) {
      pattern.lastIndex = 0; // Reset regex
      const matches = [...content.matchAll(pattern)];
      
      for (const match of matches) {
        const term = match[0].toLowerCase();
        if (!terminology.includes(term)) {
          terminology.push(term);
        }
      }
    }

    return terminology;
  }

  /**
   * Build ontological context based on entities and domain
   * @param {Array} entities - Extracted entities
   * @param {string} domain - Domain context
   * @returns {Object} - Ontological context
   */
  buildOntologicalContext(entities, domain) {
    // Extract relevant classes from entities
    const relevantClasses = [...new Set(entities.map(e => e.type))];
    
    // Build relevant properties for each class
    const relevantProperties = this.getRelevantProperties(relevantClasses, domain);
    
    // Build relevant relationships
    const relevantRelationships = this.getRelevantRelationships(relevantClasses, domain);

    return {
      domain,
      relevantClasses,
      relevantProperties,
      relevantRelationships,
      entityCount: entities.length
    };
  }

  /**
   * Get relevant properties for entity classes
   * @param {Array} classes - Entity classes
   * @param {string} domain - Domain context
   * @returns {Array} - Relevant properties
   */
  getRelevantProperties(classes, domain) {
    const properties = [];
    
    // Hardcoded property mappings for POC
    const classProperties = {
      'Pump': [
        { name: 'identifier', type: 'string', class: 'Pump' },
        { name: 'flowRate', type: 'number', class: 'Pump' },
        { name: 'pressure', type: 'number', class: 'Pump' },
        { name: 'efficiency', type: 'number', class: 'Pump' }
      ],
      'Tank': [
        { name: 'identifier', type: 'string', class: 'Tank' },
        { name: 'capacity', type: 'number', class: 'Tank' },
        { name: 'material', type: 'string', class: 'Tank' },
        { name: 'contents', type: 'string', class: 'Tank' }
      ],
      'System': [
        { name: 'identifier', type: 'string', class: 'System' },
        { name: 'type', type: 'string', class: 'System' },
        { name: 'status', type: 'string', class: 'System' }
      ]
    };

    for (const className of classes) {
      if (classProperties[className]) {
        properties.push(...classProperties[className]);
      }
    }

    return properties;
  }

  /**
   * Get relevant relationships for entity classes
   * @param {Array} classes - Entity classes
   * @param {string} domain - Domain context
   * @returns {Array} - Relevant relationships
   */
  getRelevantRelationships(classes, domain) {
    const relationships = [];
    
    // Hardcoded relationship mappings for POC
    const domainRelationships = {
      industrial: [
        { name: 'is_part_of', domain: 'Equipment', range: 'System' },
        { name: 'connects_to', domain: 'Equipment', range: 'Equipment' },
        { name: 'contains', domain: 'Tank', range: 'Substance' },
        { name: 'operates_at', domain: 'Equipment', range: 'Condition' }
      ],
      technical: [
        { name: 'implements', domain: 'Software', range: 'Interface' },
        { name: 'depends_on', domain: 'Component', range: 'Component' },
        { name: 'communicates_with', domain: 'System', range: 'System' }
      ]
    };

    const domainRels = domainRelationships[domain] || domainRelationships.industrial;
    
    // Filter relationships relevant to the classes we have
    for (const rel of domainRels) {
      if (classes.some(c => rel.domain.includes(c) || rel.range.includes(c))) {
        relationships.push(rel);
      }
    }

    return relationships;
  }
}
