/**
 * Schema definition for unified knowledge graph collection
 * Supports both entities and relationships with shared attribute system
 */

export const knowledgeGraphSchema = {
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      description: 'MongoDB ObjectId as canonical identifier'
    },
    graphType: {
      type: 'string',
      enum: ['entity', 'relationship'],
      description: 'Discriminator: entity or relationship'
    },
    ontologyType: {
      type: 'string',
      pattern: '^kg:',
      description: 'Reference to ontology type (e.g., kg:CentrifugalPump, kg:connectsTo)'
    },
    label: {
      type: 'string',
      description: 'Human-readable label'
    },
    from: {
      type: ['string', 'null'],
      description: 'Subject entity ObjectId (null for entities, required for relationships)'
    },
    to: {
      type: ['string', 'null'],
      description: 'Object entity ObjectId (null for entities, required for relationships)'
    },
    attributes: {
      type: 'object',
      description: 'Domain-specific properties (extensible)',
      additionalProperties: true
    },
    provenance: {
      type: 'object',
      properties: {
        mentionedIn: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sentence IDs that mentioned this item'
        },
        extractedFrom: {
          type: 'array',
          items: { type: 'string' },
          description: 'Document IDs this was extracted from'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Extraction confidence score'
        },
        extractionMethod: {
          type: 'string',
          enum: ['llm', 'rule-based', 'manual', 'merged'],
          description: 'How this item was extracted'
        }
      },
      required: ['mentionedIn', 'confidence']
    },
    temporal: {
      type: 'object',
      properties: {
        validFrom: {
          type: 'string',
          format: 'date-time',
          description: 'When this item became valid'
        },
        validTo: {
          type: ['string', 'null'],
          format: 'date-time',
          description: 'When this item stopped being valid (null = still valid)'
        }
      }
    },
    createdAt: {
      type: 'string',
      format: 'date-time'
    },
    updatedAt: {
      type: 'string',
      format: 'date-time'
    },
    deletedAt: {
      type: ['string', 'null'],
      format: 'date-time',
      description: 'Soft delete timestamp'
    },
    mergedInto: {
      type: ['string', 'null'],
      description: 'If merged, the ObjectId of the target entity'
    }
  },
  required: ['graphType', 'ontologyType', 'label', 'provenance']
};

/**
 * Validation rules for entities
 */
export function validateEntity(item) {
  if (item.graphType !== 'entity') {
    throw new Error('Item must have graphType "entity"');
  }
  if (item.from !== null && item.from !== undefined) {
    throw new Error('Entities must have from = null');
  }
  if (item.to !== null && item.to !== undefined) {
    throw new Error('Entities must have to = null');
  }
  return true;
}

/**
 * Validation rules for relationships
 */
export function validateRelationship(item) {
  if (item.graphType !== 'relationship') {
    throw new Error('Item must have graphType "relationship"');
  }
  if (!item.from) {
    throw new Error('Relationships must have from (subject entity ID)');
  }
  if (!item.to) {
    throw new Error('Relationships must have to (object entity ID)');
  }
  return true;
}

/**
 * MongoDB indexes for knowledge_graph collection
 */
export const knowledgeGraphIndexes = [
  // Composite index for type queries
  { key: { graphType: 1, ontologyType: 1 }, name: 'graphType_ontologyType' },

  // Relationship queries
  { key: { graphType: 1, from: 1, to: 1 }, name: 'relationship_edges' },
  { key: { from: 1 }, name: 'from_index' },
  { key: { to: 1 }, name: 'to_index' },

  // Provenance queries
  { key: { 'provenance.mentionedIn': 1 }, name: 'mentioned_in' },
  { key: { 'provenance.extractedFrom': 1 }, name: 'extracted_from' },

  // Text search on labels
  { key: { label: 'text' }, name: 'label_text_search' },

  // Soft deletes
  { key: { deletedAt: 1 }, name: 'deleted_at' },

  // Timestamps
  { key: { createdAt: -1 }, name: 'created_at_desc' }
];
