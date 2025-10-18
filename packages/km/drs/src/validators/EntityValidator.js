/**
 * EntityValidator - Validates entities with coreference clusters
 */

export class EntityValidator {
  /**
   * @param {Mention[]} mentions - Array of all mentions from DiscourseMemory
   * @param {string[]} allowedTypes - Array of allowed entity types
   */
  constructor(mentions, allowedTypes) {
    this.mentions = mentions;
    this.mentionIds = new Set(mentions.map(m => m.id));
    this.allowedTypes = allowedTypes;
  }

  /**
   * Validate an array of entities
   * @param {Entity[]} entities - Array of entities to validate
   * @returns {{isValid: boolean, errors: Array<{path: string, message: string}>}}
   */
  validate(entities) {
    const errors = [];
    const seenMentions = new Set();

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const path = `entities[${i}]`;

      // Validate mentions array
      this.validateMentions(entity, path, errors, seenMentions);

      // Validate type
      this.validateType(entity, path, errors);

      // Validate gender
      this.validateGender(entity, path, errors);

      // Validate number
      this.validateNumber(entity, path, errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate mentions array
   */
  validateMentions(entity, path, errors, seenMentions) {
    const { mentions } = entity;

    // Check at least one mention
    if (mentions.length === 0) {
      errors.push({
        path: `${path}.mentions`,
        message: 'must have at least one mention'
      });
      return;
    }

    // Check all mention IDs exist and are disjoint
    for (const mentionId of mentions) {
      // Check existence
      if (!this.mentionIds.has(mentionId)) {
        errors.push({
          path: `${path}.mentions`,
          message: `mention ${mentionId} does not exist in DiscourseMemory`
        });
      }

      // Check disjoint (no mention belongs to multiple entities)
      if (seenMentions.has(mentionId)) {
        errors.push({
          path: `${path}.mentions`,
          message: `mention ${mentionId} already belongs to another entity`
        });
      } else {
        seenMentions.add(mentionId);
      }
    }
  }

  /**
   * Validate entity type
   */
  validateType(entity, path, errors) {
    if (!this.allowedTypes.includes(entity.type)) {
      errors.push({
        path: `${path}.type`,
        message: `type "${entity.type}" not in allowed types: ${this.allowedTypes.join(', ')}`
      });
    }
  }

  /**
   * Validate gender
   */
  validateGender(entity, path, errors) {
    const validGenders = ['MASC', 'FEM', 'NEUT', 'UNKNOWN'];
    if (!validGenders.includes(entity.gender)) {
      errors.push({
        path: `${path}.gender`,
        message: `gender "${entity.gender}" must be one of: ${validGenders.join(', ')}`
      });
    }
  }

  /**
   * Validate number
   */
  validateNumber(entity, path, errors) {
    const validNumbers = ['SING', 'PLUR'];
    if (!validNumbers.includes(entity.number)) {
      errors.push({
        path: `${path}.number`,
        message: `number "${entity.number}" must be one of: ${validNumbers.join(', ')}`
      });
    }
  }
}
