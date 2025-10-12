import { createValidator } from '@legion/schema';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema
const schemaPath = join(__dirname, '../../schemas/AmbiguityReport.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

describe('AmbiguityReport Schema Validation', () => {
  let validator;

  beforeEach(() => {
    validator = createValidator(schema);
  });

  describe('Valid inputs', () => {
    test('should validate minimal report with no ambiguities', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(true);
    });

    test('should validate report with unmapped tokens', () => {
      const report = {
        unmapped_tokens: ['the', 'of', 'in'],
        multi_sense: [],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(true);
    });

    test('should validate report with multi_sense ambiguities', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [
          {
            token: 'bank',
            candidates: [
              { iri: ':FinancialInstitution', score: 0.89 },
              { iri: ':RiverBank', score: 0.82 }
            ]
          }
        ],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(true);
    });

    test('should validate multi_sense with chosen and reason', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [
          {
            token: 'bank',
            candidates: [
              {
                iri: ':FinancialInstitution',
                score: 0.89,
                type: 'class',
                domain: 'finance'
              },
              {
                iri: ':RiverBank',
                score: 0.82,
                type: 'class',
                domain: 'geography'
              }
            ],
            chosen: ':FinancialInstitution',
            reason: 'Context suggests financial domain'
          }
        ],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(true);
    });

    test('should validate report with role_conflicts', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: [
          {
            prep: 'in',
            options: [
              { role: ':year', type: 'temporal', score: 0.91 },
              { role: ':inPlace', type: 'spatial', score: 0.73 }
            ]
          }
        ],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(true);
    });

    test('should validate all role types', () => {
      const roleTypes = ['temporal', 'spatial', 'instrumental', 'manner', 'purpose'];

      roleTypes.forEach(roleType => {
        const report = {
          unmapped_tokens: [],
          multi_sense: [],
          role_conflicts: [
            {
              prep: 'with',
              options: [
                { role: ':role1', type: roleType, score: 0.8 },
                { role: ':role2', type: 'temporal', score: 0.6 }
              ]
            }
          ],
          comparator_missing: false
        };

        const result = validator.validate(report);
        expect(result.valid).toBe(true);
      });
    });

    test('should validate role_conflict with chosen and reason', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: [
          {
            prep: 'in',
            options: [
              { role: ':year', type: 'temporal', score: 0.91 },
              { role: ':inPlace', type: 'spatial', score: 0.73 }
            ],
            chosen: ':year',
            reason: 'Date context detected'
          }
        ],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(true);
    });

    test('should validate comparator_missing true', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: [],
        comparator_missing: true
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(true);
    });

    test('should validate report with notes', () => {
      const report = {
        unmapped_tokens: ['the'],
        multi_sense: [],
        role_conflicts: [],
        comparator_missing: false,
        notes: [
          'Multiple interpretations possible',
          'Used default temporal interpretation'
        ]
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(true);
    });

    test('should validate complex report with all fields', () => {
      const report = {
        unmapped_tokens: ['the', 'of'],
        multi_sense: [
          {
            token: 'bank',
            candidates: [
              { iri: ':FinancialInstitution', score: 0.89, type: 'class', domain: 'finance' },
              { iri: ':RiverBank', score: 0.82, type: 'class', domain: 'geography' }
            ],
            chosen: ':FinancialInstitution',
            reason: 'Financial context detected'
          }
        ],
        role_conflicts: [
          {
            prep: 'in',
            options: [
              { role: ':year', type: 'temporal', score: 0.91 },
              { role: ':inPlace', type: 'spatial', score: 0.73 }
            ],
            chosen: ':year',
            reason: 'Date value provided'
          }
        ],
        comparator_missing: false,
        notes: ['Context-based disambiguation applied']
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid inputs', () => {
    test('should reject report without unmapped_tokens', () => {
      const report = {
        multi_sense: [],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject report without multi_sense', () => {
      const report = {
        unmapped_tokens: [],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject report without role_conflicts', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject report without comparator_missing', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: []
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject multi_sense without token', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [
          {
            candidates: [
              { iri: ':Class1', score: 0.8 },
              { iri: ':Class2', score: 0.7 }
            ]
          }
        ],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject multi_sense without candidates', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [
          {
            token: 'bank'
          }
        ],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject multi_sense with only one candidate', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [
          {
            token: 'bank',
            candidates: [
              { iri: ':Bank', score: 0.9 }
            ]  // Should have at least 2
          }
        ],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject candidate without IRI prefix', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [
          {
            token: 'bank',
            candidates: [
              { iri: 'NoColonPrefix', score: 0.8 },
              { iri: ':Valid', score: 0.7 }
            ]
          }
        ],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject candidate with score > 1', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [
          {
            token: 'bank',
            candidates: [
              { iri: ':Bank1', score: 1.5 },
              { iri: ':Bank2', score: 0.7 }
            ]
          }
        ],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject candidate with score < 0', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [
          {
            token: 'bank',
            candidates: [
              { iri: ':Bank1', score: -0.5 },
              { iri: ':Bank2', score: 0.7 }
            ]
          }
        ],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject role_conflict without prep', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: [
          {
            options: [
              { role: ':role1', type: 'temporal', score: 0.8 },
              { role: ':role2', type: 'spatial', score: 0.7 }
            ]
          }
        ],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject role_conflict without options', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: [
          {
            prep: 'in'
          }
        ],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject role_conflict with only one option', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: [
          {
            prep: 'in',
            options: [
              { role: ':year', type: 'temporal', score: 0.9 }
            ]  // Should have at least 2
          }
        ],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject invalid role type', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: [
          {
            prep: 'in',
            options: [
              { role: ':role1', type: 'invalid', score: 0.8 },
              { role: ':role2', type: 'temporal', score: 0.7 }
            ]
          }
        ],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject role option without IRI prefix', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [],
        role_conflicts: [
          {
            prep: 'in',
            options: [
              { role: 'NoPrefix', type: 'temporal', score: 0.8 },
              { role: ':Valid', type: 'spatial', score: 0.7 }
            ]
          }
        ],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });

    test('should reject chosen without IRI prefix', () => {
      const report = {
        unmapped_tokens: [],
        multi_sense: [
          {
            token: 'bank',
            candidates: [
              { iri: ':Bank1', score: 0.8 },
              { iri: ':Bank2', score: 0.7 }
            ],
            chosen: 'NoPrefix'
          }
        ],
        role_conflicts: [],
        comparator_missing: false
      };

      const result = validator.validate(report);
      expect(result.valid).toBe(false);
    });
  });

  describe('FAIL FAST behavior', () => {
    test('should throw on invalid data when using parse', () => {
      const invalidReport = {
        unmapped_tokens: []
        // Missing required fields
      };

      expect(() => {
        validator.schema.parse(invalidReport);
      }).toThrow();
    });
  });
});
