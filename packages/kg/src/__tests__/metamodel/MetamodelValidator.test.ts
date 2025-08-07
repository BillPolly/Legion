/**
 * Tests for the comprehensive MetamodelValidator
 */

import { MetamodelValidator, MetamodelEntity } from '../../metamodel/MetamodelValidator';

describe('MetamodelValidator', () => {
  let validator: MetamodelValidator;

  beforeEach(() => {
    validator = new MetamodelValidator();
  });

  describe('Basic Structure Validation', () => {
    it('should validate a minimal valid metamodel', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'String',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            range: 'String',
            cardinality: '1',
            'is-dependent': true
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing thing entity', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'SomeEntity',
          subtypeOf: 'Thing',
          attributes: []
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'MISSING_ROOT')).toBe(true);
    });

    it('should detect duplicate entity IDs', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'DUPLICATE_ID')).toBe(true);
    });

    it('should detect invalid ID format', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: '123Invalid',
          subtypeOf: 'Thing',
          attributes: []
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'INVALID_ID_FORMAT')).toBe(true);
    });
  });

  describe('Reference Validation', () => {
    it('should detect undefined subtypeOf reference', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Entity',
          subtypeOf: 'UndefinedParent',
          attributes: []
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'UNDEFINED_REFERENCE')).toBe(true);
    });

    it('should detect undefined domain reference in attributes', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'UndefinedEntity',
            range: 'string',
            cardinality: '1',
            'is-dependent': true
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'UNDEFINED_DOMAIN')).toBe(true);
    });

    it('should detect undefined range reference in attributes', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            range: 'undefinedtype',
            cardinality: '1',
            'is-dependent': true
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'UNDEFINED_RANGE')).toBe(true);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect circular inheritance dependencies', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'A',
          subtypeOf: 'B',
          attributes: []
        },
        {
          _id: 'B',
          subtypeOf: 'C',
          attributes: []
        },
        {
          _id: 'C',
          subtypeOf: 'A',
          attributes: []
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'CIRCULAR_DEPENDENCY')).toBe(true);
    });

    it('should allow thing -> thing self-reference', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Attribute Definition Validation', () => {
    it('should detect missing required fields in attribute definitions', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            // Missing range, cardinality, is-dependent
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'MISSING_RANGE')).toBe(true);
      expect(result.errors.some((e: any) => e.code === 'MISSING_CARDINALITY')).toBe(true);
      expect(result.errors.some((e: any) => e.code === 'MISSING_DEPENDENT')).toBe(true);
    });

    it('should validate cardinality formats', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'String',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            range: 'String',
            cardinality: 'invalid-cardinality',
            'is-dependent': true
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'INVALID_CARDINALITY')).toBe(true);
    });

    it('should accept valid cardinality formats', () => {
      const validCardinalities = ['1', '0..1', '0..*', '1..*', '2..5', '*'];
      
      for (const cardinality of validCardinalities) {
        const metamodel: MetamodelEntity[] = [
          {
            _id: 'Thing',
            subtypeOf: 'Thing',
            attributes: []
          },
          {
            _id: 'Attribute',
            subtypeOf: 'Thing',
            attributes: []
          },
          {
            _id: 'String',
            subtypeOf: 'Thing',
            attributes: []
          },
          {
            _id: 'test-attr',
            subtypeOf: 'Attribute',
            attributes: {
              domain: 'Thing',
              range: 'String',
              cardinality: cardinality,
              'is-dependent': true
            }
          }
        ];

        const result = validator.validateMetamodel(metamodel);
        expect(result.errors.some((e: any) => e.code === 'INVALID_CARDINALITY')).toBe(false);
      }
    });
  });

  describe('Relationship Validation', () => {
    it('should validate relationship definitions', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Relationship',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'String',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            range: 'String',
            cardinality: '1',
            'is-dependent': true
          }
        },
        {
          _id: 'named-thing',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'String',
            range: 'Thing',
            cardinality: '0..*',
            'is-dependent': false
          }
        },
        {
          _id: 'NamingRelationship',
          subtypeOf: 'Relationship',
          attributes: {
            'dependent-end': 'name',
            'independent-end': 'named-thing'
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(true);
    });

    it('should detect missing relationship ends', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Relationship',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'BadRelationship',
          subtypeOf: 'Relationship',
          attributes: {
            // Missing dependent-end and independent-end
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'MISSING_DEPENDENT_END')).toBe(true);
      expect(result.errors.some((e: any) => e.code === 'MISSING_INDEPENDENT_END')).toBe(true);
    });
  });

  describe('Constraint Validation', () => {
    it('should detect unknown constraints', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'String',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            range: 'String',
            cardinality: '1',
            'is-dependent': true,
            constraints: ['unknown-constraint']
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'UNKNOWN_CONSTRAINT')).toBe(true);
    });

    it('should accept known constraints', () => {
      const knownConstraints = ['non-empty', 'positive', 'non-negative', 'unique'];
      
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'String',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            range: 'String',
            cardinality: '1',
            'is-dependent': true,
            constraints: knownConstraints
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.errors.some((e: any) => e.code === 'UNKNOWN_CONSTRAINT')).toBe(false);
    });
  });

  describe('Default Value Validation', () => {
    it('should validate default values against their types', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Number',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'age',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            range: 'Number',
            cardinality: '1',
            'is-dependent': true,
            'default-value': 'not-a-number'
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'INCOMPATIBLE_DEFAULT_VALUE')).toBe(true);
    });
  });

  describe('Case Sensitivity Handling', () => {
    it('should enforce exact case matching for entity references', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'thing', // lowercase reference to Thing - should fail
            range: 'string', // primitive type - should pass
            cardinality: '1',
            'is-dependent': true
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.code === 'UNDEFINED_DOMAIN')).toBe(true);
      expect(result.errors.some((e: any) => e.message.includes('thing'))).toBe(true);
    });

    it('should allow case-insensitive primitive type references', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'name',
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing', // correct case for entity
            range: 'STRING', // uppercase primitive - should pass
            cardinality: '1',
            'is-dependent': true
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Validation Summary', () => {
    it('should provide comprehensive validation summary', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Relationship',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Kind',
          subtypeOf: 'Thing',
          attributes: []
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      
      // Build dictionaries to get summary
      const dictionaries = (validator as any).buildDictionaries(metamodel, { build: () => ({ isValid: true, errors: [] }) });
      const summary = validator.getValidationSummary(dictionaries);

      expect(summary.totalEntities).toBe(4);
      expect(summary.coreEntitiesPresent).toContain('Thing');
      expect(summary.coreEntitiesPresent).toContain('Attribute');
      expect(summary.coreEntitiesPresent).toContain('Relationship');
      expect(summary.coreEntitiesPresent).toContain('Kind');
    });
  });

  describe('Naming Convention Validation', () => {
    it('should enforce kebab-case for attribute subtypes', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'input-state', // kebab-case - correct for attribute subtype
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            range: 'string',
            cardinality: '1',
            'is-dependent': true
          }
        },
        {
          _id: 'InputState', // PascalCase - incorrect for attribute subtype
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Thing',
            range: 'string',
            cardinality: '1',
            'is-dependent': true
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => 
        e.code === 'INVALID_NAMING_CONVENTION' && 
        e.message.includes('InputState') &&
        e.message.includes('kebab-case')
      )).toBe(true);
    });

    it('should enforce PascalCase for non-attribute entities', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Process', // PascalCase - correct for non-attribute entity
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'compound-thing', // kebab-case - incorrect for non-attribute entity
          subtypeOf: 'Thing',
          attributes: []
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => 
        e.code === 'INVALID_NAMING_CONVENTION' && 
        e.message.includes('compound-thing') &&
        e.message.includes('PascalCase')
      )).toBe(true);
    });

    it('should accept correct naming conventions', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Process', // PascalCase - correct for non-attribute entity
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'input-state', // kebab-case - correct for attribute subtype
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Process',
            range: 'string',
            cardinality: '1',
            'is-dependent': true
          }
        },
        {
          _id: 'output-state', // kebab-case - correct for attribute subtype
          subtypeOf: 'Attribute',
          attributes: {
            domain: 'Process',
            range: 'string',
            cardinality: '1',
            'is-dependent': true
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(true);
      expect(result.errors.filter((e: any) => e.code === 'INVALID_NAMING_CONVENTION')).toHaveLength(0);
    });

    it('should handle inheritance chains for naming validation', () => {
      const metamodel: MetamodelEntity[] = [
        {
          _id: 'Thing',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'Attribute',
          subtypeOf: 'Thing',
          attributes: []
        },
        {
          _id: 'SpecialAttribute', // PascalCase - incorrect for attribute subtype
          subtypeOf: 'Attribute',
          attributes: []
        },
        {
          _id: 'my-special-attr', // kebab-case - correct for subtype of attribute
          subtypeOf: 'SpecialAttribute',
          attributes: {
            domain: 'Thing',
            range: 'string',
            cardinality: '1',
            'is-dependent': true
          }
        }
      ];

      const result = validator.validateMetamodel(metamodel);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => 
        e.code === 'INVALID_NAMING_CONVENTION' && 
        e.message.includes('SpecialAttribute')
      )).toBe(true);
    });
  });
});
