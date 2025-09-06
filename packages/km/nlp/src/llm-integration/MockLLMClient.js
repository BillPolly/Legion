import { LLMClient } from './LLMClient.js';

/**
 * MockLLMClient - Mock implementation for testing and development
 * 
 * Provides realistic mock responses for all LLM operations without
 * requiring actual LLM API calls. Useful for testing and development.
 */
export class MockLLMClient extends LLMClient {
  constructor(options = {}) {
    super(options);
    this.options = {
      responseDelay: 10, // Simulate processing delay
      confidenceRange: [0.5, 1.0], // Range for confidence scores
      entityDetectionRate: 0.8, // Probability of detecting entities
      relationshipDetectionRate: 0.6, // Probability of detecting relationships
      ...this.options,
      ...options
    };
  }

  /**
   * Simulate processing delay
   * @param {number} delay - Delay in milliseconds
   */
  async simulateDelay(delay = this.options.responseDelay) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Generate random confidence score within range
   * @returns {number} - Confidence score between 0 and 1
   */
  generateConfidence() {
    const [min, max] = this.options.confidenceRange;
    return min + Math.random() * (max - min);
  }

  /**
   * Extract entities from text patterns
   * @param {string} text - Input text
   * @returns {Array} - Detected entity patterns
   */
  detectEntityPatterns(text) {
    const patterns = [
      // Technical equipment patterns
      { regex: /([A-Z][a-zA-Z]*)\s+([A-Z]\d+)/g, type: 'Equipment' },
      // System patterns
      { regex: /(System|Tank|Pipe|Valve)\s+([A-Z]\d+)/gi, type: 'Component' },
      // Person names
      { regex: /([A-Z][a-z]+)\s+([A-Z][a-z]+)/g, type: 'Person' },
      // Companies/Organizations
      { regex: /([A-Z][a-zA-Z]+\s+(?:Inc|Corp|Ltd|Company))/gi, type: 'Organization' },
      // Measurements
      { regex: /(\d+(?:\.\d+)?)\s*(psi|bar|°C|°F|kg|lb|ft|m|mm|cm)/gi, type: 'Measurement' }
    ];

    const entities = [];
    let entityId = 1;

    for (const pattern of patterns) {
      let match;
      pattern.regex.lastIndex = 0; // Reset regex
      
      while ((match = pattern.regex.exec(text)) !== null) {
        if (Math.random() < this.options.entityDetectionRate) {
          const entityText = match[0];
          const start = match.index;
          const end = start + entityText.length;
          
          entities.push({
            id: `entity_${entityId++}`,
            text: entityText,
            type: pattern.type,
            confidence: this.generateConfidence(),
            textSpan: { start, end },
            properties: this.generateEntityProperties(entityText, pattern.type)
          });
        }
      }
    }

    return entities;
  }

  /**
   * Generate properties for detected entities
   * @param {string} text - Entity text
   * @param {string} type - Entity type
   * @returns {Object} - Entity properties
   */
  generateEntityProperties(text, type) {
    const properties = {};

    switch (type) {
      case 'Equipment':
      case 'Component':
        const match = text.match(/([A-Z][a-zA-Z]*)\s+([A-Z]\d+)/);
        if (match) {
          properties.name = text;
          properties.identifier = match[2];
          properties.category = match[1];
        }
        break;
      case 'Person':
        properties.name = text;
        break;
      case 'Organization':
        properties.name = text;
        break;
      case 'Measurement':
        const measureMatch = text.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z°]+)/);
        if (measureMatch) {
          properties.value = parseFloat(measureMatch[1]);
          properties.unit = measureMatch[2];
        }
        break;
    }

    return properties;
  }

  /**
   * Detect relationships between entities
   * @param {string} text - Input text
   * @param {Array} entities - Detected entities
   * @returns {Array} - Detected relationships
   */
  detectRelationshipPatterns(text, entities) {
    if (entities.length < 2) return [];

    const relationshipPatterns = [
      { phrases: ['is part of', 'belongs to', 'is component of'], predicate: 'is_part_of' },
      { phrases: ['contains', 'includes', 'has'], predicate: 'contains' },
      { phrases: ['is connected to', 'connects to', 'linked to'], predicate: 'connected_to' },
      { phrases: ['is manufactured by', 'made by', 'produced by'], predicate: 'manufactured_by' },
      { phrases: ['operates at', 'runs at', 'works at'], predicate: 'operates_at' },
      { phrases: ['is located in', 'is in', 'positioned in'], predicate: 'located_in' }
    ];

    const relationships = [];
    let relationshipId = 1;

    // Check for explicit relationship phrases
    for (const pattern of relationshipPatterns) {
      for (const phrase of pattern.phrases) {
        const phraseIndex = text.toLowerCase().indexOf(phrase);
        if (phraseIndex !== -1 && Math.random() < this.options.relationshipDetectionRate) {
          // Find entities before and after the phrase
          const beforeEntities = entities.filter(e => e.textSpan && e.textSpan.end < phraseIndex);
          const afterEntities = entities.filter(e => e.textSpan && e.textSpan.start > phraseIndex + phrase.length);

          if (beforeEntities.length > 0 && afterEntities.length > 0) {
            const subject = beforeEntities[beforeEntities.length - 1]; // Closest before
            const object = afterEntities[0]; // Closest after

            relationships.push({
              id: `relationship_${relationshipId++}`,
              subject: subject.id,
              predicate: pattern.predicate,
              object: object.id,
              confidence: this.generateConfidence(),
              evidence: text.substring(
                Math.max(0, subject.textSpan.start - 10),
                Math.min(text.length, object.textSpan.end + 10)
              ).trim(),
              textSpan: {
                start: subject.textSpan.start,
                end: object.textSpan.end
              },
              relationshipType: 'explicit'
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Extract entities from text with schema guidance
   */
  async extractEntities(text, schema, context) {
    await this.simulateDelay();
    this.validateInput(text, 'extractEntities');

    if (!text.trim()) {
      return { entities: [] };
    }

    const entities = this.detectEntityPatterns(text);

    return {
      entities,
      metadata: {
        processingTime: this.options.responseDelay,
        schema: schema,
        context: context,
        detectionRate: this.options.entityDetectionRate
      }
    };
  }

  /**
   * Extract relationships between entities
   */
  async extractRelationships(text, entities, relationshipTypes) {
    await this.simulateDelay();
    this.validateInput(text, 'extractRelationships');

    if (!entities || entities.length < 2) {
      return { relationships: [] };
    }

    const relationships = this.detectRelationshipPatterns(text, entities);

    return {
      relationships,
      metadata: {
        processingTime: this.options.responseDelay,
        entityCount: entities.length,
        relationshipTypes: relationshipTypes,
        detectionRate: this.options.relationshipDetectionRate
      }
    };
  }

  /**
   * Assess quality of extraction results
   */
  async assessQuality(original, extracted, paraphrase) {
    await this.simulateDelay();

    const completeness = Math.min(1.0, extracted.length / Math.max(1, original.split(' ').length * 0.1));
    const accuracy = 0.8 + Math.random() * 0.2; // Mock accuracy between 0.8-1.0
    const consistency = paraphrase && original ? 
      Math.max(0.6, 1.0 - Math.abs(original.length - paraphrase.length) / Math.max(original.length, paraphrase.length)) :
      0.5;

    const overallScore = (completeness + accuracy + consistency) / 3;

    const issues = [];
    if (completeness < 0.7) {
      issues.push({
        type: 'completeness',
        severity: 'medium',
        description: 'Some information may be missing from extraction'
      });
    }
    if (consistency < 0.8) {
      issues.push({
        type: 'consistency',
        severity: 'low',
        description: 'Minor differences between original and paraphrase'
      });
    }

    return {
      overallScore,
      metrics: {
        completeness,
        accuracy,
        consistency
      },
      issues,
      metadata: {
        processingTime: this.options.responseDelay,
        originalLength: original.length,
        extractedTriples: extracted.length,
        paraphraseLength: paraphrase ? paraphrase.length : 0
      }
    };
  }

  /**
   * Compare semantic similarity between texts
   */
  async compareSemantics(text1, text2) {
    await this.simulateDelay();

    if (!text1 && !text2) {
      return {
        similarityScore: 1.0,
        confidence: 1.0,
        analysis: { commonConcepts: [], differences: [] }
      };
    }

    if (!text1 || !text2) {
      return {
        similarityScore: 0.0,
        confidence: 1.0,
        analysis: { commonConcepts: [], differences: ['One text is empty'] }
      };
    }

    // Simple similarity based on common words
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    let similarityScore = commonWords.length / totalWords;
    
    // Boost similarity for identical texts
    if (text1 === text2) {
      similarityScore = 1.0;
    }

    // Add some randomness for realism
    similarityScore = Math.min(1.0, similarityScore + (Math.random() - 0.5) * 0.1);

    return {
      similarityScore,
      confidence: this.generateConfidence(),
      analysis: {
        commonConcepts: commonWords.slice(0, 5), // Top 5 common words
        differences: words1.filter(word => !words2.includes(word)).slice(0, 3)
      },
      metadata: {
        processingTime: this.options.responseDelay,
        text1Length: text1.length,
        text2Length: text2.length
      }
    };
  }

  /**
   * Disambiguate entity references
   */
  async disambiguate(entity, context, candidates) {
    await this.simulateDelay();

    if (!candidates || candidates.length === 0) {
      return {
        selectedCandidate: null,
        confidence: 0,
        reasoning: 'No candidates provided',
        alternativeCandidates: []
      };
    }

    if (candidates.length === 1) {
      return {
        selectedCandidate: candidates[0],
        confidence: 0.9,
        reasoning: 'Only one candidate available',
        alternativeCandidates: []
      };
    }

    // Simple disambiguation based on type matching and context
    let bestCandidate = candidates[0];
    let bestScore = 0.5;

    for (const candidate of candidates) {
      let score = 0.5;

      // Boost score if entity text matches candidate name
      if (candidate.name && candidate.name.toLowerCase().includes(entity.toLowerCase())) {
        score += 0.3;
      }

      // Boost score based on context domain matching
      if (context.domain && candidate.type) {
        const domainTypeMap = {
          'industrial': ['Pump', 'System', 'Tank', 'Valve'],
          'technical': ['Equipment', 'Component', 'Device']
        };
        
        if (domainTypeMap[context.domain]?.includes(candidate.type)) {
          score += 0.2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    const alternativeCandidates = candidates
      .filter(c => c !== bestCandidate)
      .slice(0, 3); // Top 3 alternatives

    return {
      selectedCandidate: bestCandidate,
      confidence: bestScore,
      reasoning: `Selected based on name matching and context relevance`,
      alternativeCandidates,
      metadata: {
        processingTime: this.options.responseDelay,
        candidateCount: candidates.length,
        context: context
      }
    };
  }
}
