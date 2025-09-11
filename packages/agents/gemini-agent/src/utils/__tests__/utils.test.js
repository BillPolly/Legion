import { DateFormatter } from '../DateFormatter';
import { TypeChecker } from '../TypeChecker';

describe('Utility Functions Tests', () => {

  describe('DateFormatter', () => {
    test('formats ISO with timezone', () => {
      const date = new Date('2025-09-10T12:00:00Z');
      expect(DateFormatter.toISOWithZone(date)).toBe('2025-09-10T12:00:00.000Z');
    });

    test('calculates time difference', () => {
      const start = new Date('2025-09-10T12:00:00Z');
      const end = new Date('2025-09-10T12:01:00Z');
      expect(DateFormatter.getDifference(start, end)).toBe(60000); // 1 minute in ms
    });
  });

  describe('TypeChecker', () => {
    test('identifies plain objects', () => {
      expect(TypeChecker.isPlainObject({})).toBe(true);
      expect(TypeChecker.isPlainObject(null)).toBe(false);
      expect(TypeChecker.isPlainObject([])).toBe(false);
    });

    test('identifies arrays', () => {
      expect(TypeChecker.isArray([])).toBe(true);
      expect(TypeChecker.isArray({})).toBe(false);
    });

    test('identifies functions', () => {
      expect(TypeChecker.isFunction(() => {})).toBe(true);
      expect(TypeChecker.isFunction({})).toBe(false);
    });
  });
});
