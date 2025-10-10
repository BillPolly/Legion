import { jest } from '@jest/globals';
import { ValueExtractor } from '../../src/kg/ValueExtractor.js';

/**
 * Phase 7: ValueExtractor Tests
 *
 * Tests extraction of structured financial values from text with
 * units, scale, currency, and normalization capabilities.
 */

describe('ValueExtractor (Phase 7)', () => {
  let extractor;

  beforeAll(() => {
    extractor = new ValueExtractor();
  });

  describe('Unit Tests: Basic value extraction', () => {
    test('should extract simple numeric value', () => {
      const result = extractor.extractValue('123.45');

      expect(result).toBeTruthy();
      expect(result.numericValue).toBe(123.45);
      expect(result.actualAmount).toBe(123.45);
      expect(result.unit).toBe('count');

      console.log('✅ Extracted simple numeric value');
    });

    test('should extract value with commas', () => {
      const result = extractor.extractValue('1,234.56');

      expect(result.numericValue).toBe(1234.56);
      expect(result.actualAmount).toBe(1234.56);

      console.log('✅ Extracted value with commas');
    });

    test('should extract negative value in parentheses', () => {
      const result = extractor.extractValue('(123.45)');

      expect(result.numericValue).toBe(-123.45);
      expect(result.actualAmount).toBe(-123.45);

      console.log('✅ Extracted negative value');
    });
  });

  describe('Unit Tests: Currency extraction', () => {
    test('should extract USD from dollar sign', () => {
      const result = extractor.extractValue('$1,234.56');

      expect(result.currency).toBe('USD');
      expect(result.numericValue).toBe(1234.56);
      expect(result.unit).toBe('currency');

      console.log('✅ Extracted USD currency');
    });

    test('should extract EUR from euro sign', () => {
      const result = extractor.extractValue('€500.00');

      expect(result.currency).toBe('EUR');
      expect(result.numericValue).toBe(500);

      console.log('✅ Extracted EUR currency');
    });

    test('should default to USD for financial values', () => {
      const result = extractor.extractValue('1,234,567.89');

      expect(result.currency).toBe('USD');
      expect(result.unit).toBe('currency');

      console.log('✅ Defaulted to USD for large value');
    });
  });

  describe('Unit Tests: Scale extraction', () => {
    test('should extract "$1M" as millions', () => {
      const result = extractor.extractValue('$1M');

      console.log('\n📊 Extracted $1M:', result);

      expect(result.numericValue).toBe(1);
      expect(result.currency).toBe('USD');
      expect(result.scale).toBe('m');
      expect(result.actualAmount).toBe(1000000);

      console.log('✅ Extracted $1M correctly');
    });

    test('should extract "$1 million" as millions', () => {
      const result = extractor.extractValue('$1 million');

      expect(result.numericValue).toBe(1);
      expect(result.scale).toBe('million');
      expect(result.actualAmount).toBe(1000000);

      console.log('✅ Extracted $1 million correctly');
    });

    test('should extract "103,102 (thousands)" correctly', () => {
      const result = extractor.extractValue('103,102 (thousands)');

      console.log('\n📊 Extracted 103,102 (thousands):', result);

      expect(result.numericValue).toBe(103102);
      expect(result.scale).toBe('thousands');
      expect(result.actualAmount).toBe(103102000);
      expect(result.currency).toBe('USD');

      console.log('✅ Extracted value with scale in parentheses');
    });

    test('should extract "$2.5B" as billions', () => {
      const result = extractor.extractValue('$2.5B');

      expect(result.numericValue).toBe(2.5);
      expect(result.scale).toBe('b');
      expect(result.actualAmount).toBe(2500000000);

      console.log('✅ Extracted billions correctly');
    });
  });

  describe('Unit Tests: Percentage extraction', () => {
    test('should extract "14.1%" as percentage', () => {
      const result = extractor.extractValue('14.1%');

      console.log('\n📊 Extracted 14.1%:', result);

      expect(result.numericValue).toBe(14.1);
      expect(result.unit).toBe('percentage');
      expect(result.actualAmount).toBe(0.141);
      expect(result.originalText).toBe('14.1%');

      console.log('✅ Extracted percentage correctly');
    });

    test('should extract negative percentage', () => {
      const result = extractor.extractValue('-5.2%');

      expect(result.numericValue).toBe(-5.2);
      expect(result.unit).toBe('percentage');
      expect(result.actualAmount).toBeCloseTo(-0.052, 10);

      console.log('✅ Extracted negative percentage');
    });
  });

  describe('Unit Tests: FinancialValue entity creation', () => {
    test('should create FinancialValue entity', () => {
      const extracted = extractor.extractValue('$1M');
      const entity = extractor.createFinancialValueEntity(extracted);

      console.log('\n📊 FinancialValue entity:', JSON.stringify(entity, null, 2));

      expect(entity).toHaveProperty('uri');
      expect(entity.uri).toContain('FinVal');
      expect(entity.type).toBe('kg:FinancialValue');
      expect(entity.properties['kg:numericValue']).toBe('1');
      expect(entity.properties['kg:currency']).toBe('USD');
      expect(entity.properties['kg:scale']).toBe('m');
      expect(entity.properties['kg:actualAmount']).toBe('1000000');

      console.log('✅ Created FinancialValue entity correctly');
    });

    test('should create unique URIs for different values', () => {
      const val1 = extractor.extractValue('$1M');
      const val2 = extractor.extractValue('$2M');
      const val3 = extractor.extractValue('14.1%');

      const uri1 = extractor.createValueUri(val1);
      const uri2 = extractor.createValueUri(val2);
      const uri3 = extractor.createValueUri(val3);

      expect(uri1).not.toBe(uri2);
      expect(uri1).not.toBe(uri3);
      expect(uri2).not.toBe(uri3);

      console.log('✅ Created unique URIs');
    });
  });

  describe('Unit Tests: Value normalization', () => {
    test('should normalize values to same scale', () => {
      const val1 = extractor.extractValue('$1M');
      const val2 = extractor.extractValue('$500,000');

      const normalized = extractor.normalizeValues(val1, val2);

      console.log('\n📊 Normalized values:', normalized);

      expect(normalized.value1).toBe(1000000);
      expect(normalized.value2).toBe(500000);
      expect(normalized.unit).toBe('USD');
      expect(normalized.comparable).toBe(true);

      console.log('✅ Normalized values correctly');
    });

    test('should detect incomparable values', () => {
      const val1 = extractor.extractValue('$1M');
      const val2 = extractor.extractValue('14.1%');

      const normalized = extractor.normalizeValues(val1, val2);

      expect(normalized.comparable).toBe(false);

      console.log('✅ Detected incomparable values');
    });
  });

  describe('Integration Tests: Real ConvFinQA values', () => {
    test('should extract ConvFinQA net income value', () => {
      const result = extractor.extractValue('103102.0');

      // ConvFinQA tables are in thousands (from table metadata)
      const context = { scale: 'thousands', currency: 'USD' };
      const resultWithContext = extractor.extractValue('103102.0', context);

      console.log('\n📊 ConvFinQA value with context:', resultWithContext);

      expect(resultWithContext.numericValue).toBe(103102);
      expect(resultWithContext.scale).toBe('thousands');
      expect(resultWithContext.actualAmount).toBe(103102000);

      console.log('✅ Extracted ConvFinQA value correctly');
    });

    test('should handle various ConvFinQA formats', () => {
      const testCases = [
        { text: '103102', expected: 103102 },
        { text: '104222.0', expected: 104222 },
        { text: '-2913.0', expected: -2913 },  // Negative change
        { text: '9362.2', expected: 9362.2 }
      ];

      testCases.forEach(({ text, expected }) => {
        const result = extractor.extractValue(text, { scale: 'thousands', currency: 'USD' });
        expect(result.numericValue).toBe(expected);
        expect(result.actualAmount).toBe(expected * 1000);
      });

      console.log('✅ Handled all ConvFinQA formats');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined/empty', () => {
      expect(extractor.extractValue(null)).toBeNull();
      expect(extractor.extractValue(undefined)).toBeNull();
      expect(extractor.extractValue('')).toBeNull();

      console.log('✅ Handled null/empty values');
    });

    test('should handle non-numeric text', () => {
      expect(extractor.extractValue('N/A')).toBeNull();
      expect(extractor.extractValue('Not applicable')).toBeNull();

      console.log('✅ Handled non-numeric text');
    });

    test('should handle mixed text and numbers', () => {
      const result = extractor.extractValue('Revenue of $1.5M for Q1');

      expect(result.numericValue).toBe(1.5);
      expect(result.scale).toBe('m');
      expect(result.actualAmount).toBe(1500000);

      console.log('✅ Extracted value from mixed text');
    });
  });
});
