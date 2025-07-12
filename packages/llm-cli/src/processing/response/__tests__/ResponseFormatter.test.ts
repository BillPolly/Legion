import { ResponseFormatter } from '../formatter/ResponseFormatter';
import { DefaultResponseFormatter } from '../formatter/DefaultResponseFormatter';
import { GeneratedResponse } from '../types';

describe('ResponseFormatter', () => {
  let formatter: ResponseFormatter;

  beforeEach(() => {
    formatter = new DefaultResponseFormatter();
  });

  describe('formatResponse', () => {
    it('should format successful response', () => {
      const response: GeneratedResponse = {
        success: true,
        message: 'Command completed successfully',
        executionId: 'exec_123',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'search'
      };

      const formatted = formatter.formatResponse(response);
      
      expect(formatted).toContain('Command completed successfully');
      expect(formatted).toContain('✓');
    });

    it('should format failed response', () => {
      const response: GeneratedResponse = {
        success: false,
        message: 'Command failed: Invalid parameters',
        executionId: 'exec_456',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'search'
      };

      const formatted = formatter.formatResponse(response);
      
      expect(formatted).toContain('Command failed: Invalid parameters');
      expect(formatted).toContain('✗');
    });

    it('should include data when present', () => {
      const response: GeneratedResponse = {
        success: true,
        message: 'Found 5 documents',
        executionId: 'exec_789',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'search',
        data: {
          results: ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'],
          totalCount: 5
        }
      };

      const formatted = formatter.formatResponse(response);
      
      expect(formatted).toContain('Found 5 documents');
      expect(formatted).toContain('doc1');
      expect(formatted).toContain('totalCount');
    });

    it('should include suggestions when present', () => {
      const response: GeneratedResponse = {
        success: true,
        message: 'Search completed',
        executionId: 'exec_101',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'search',
        suggestions: ['Try refining your search', 'Use more specific terms']
      };

      const formatted = formatter.formatResponse(response);
      
      expect(formatted).toContain('Search completed');
      expect(formatted).toContain('Try refining your search');
      expect(formatted).toContain('Use more specific terms');
    });

    it('should include metadata when present', () => {
      const response: GeneratedResponse = {
        success: true,
        message: 'Query executed',
        executionId: 'exec_202',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'search',
        metadata: {
          queryTime: '125ms',
          source: 'database'
        }
      };

      const formatted = formatter.formatResponse(response);
      
      expect(formatted).toContain('Query executed');
      expect(formatted).toContain('125ms');
      expect(formatted).toContain('database');
    });

    it('should handle empty response gracefully', () => {
      const response: GeneratedResponse = {
        success: true,
        message: '',
        executionId: 'exec_303',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'search'
      };

      const formatted = formatter.formatResponse(response);
      
      expect(formatted).toContain('✓');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('formatSuccessResponse', () => {
    it('should format basic success response', () => {
      const response: GeneratedResponse = {
        success: true,
        message: 'Task completed',
        executionId: 'exec_404',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'test'
      };

      const formatted = formatter.formatSuccessResponse(response);
      
      expect(formatted).toContain('✓');
      expect(formatted).toContain('Task completed');
    });

    it('should include timestamp for success', () => {
      const timestamp = new Date('2023-01-01T10:00:00Z');
      const response: GeneratedResponse = {
        success: true,
        message: 'Operation successful',
        executionId: 'exec_505',
        timestamp,
        command: 'test'
      };

      const formatted = formatter.formatSuccessResponse(response);
      
      expect(formatted).toContain('Operation successful');
      expect(formatted).toContain(timestamp.toLocaleTimeString());
    });

    it('should format success with data', () => {
      const response: GeneratedResponse = {
        success: true,
        message: 'Results found',
        executionId: 'exec_606',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'search',
        data: { count: 10, items: ['a', 'b', 'c'] }
      };

      const formatted = formatter.formatSuccessResponse(response);
      
      expect(formatted).toContain('Results found');
      expect(formatted).toContain('count');
      expect(formatted).toContain('10');
    });
  });

  describe('formatErrorResponse', () => {
    it('should format basic error response', () => {
      const response: GeneratedResponse = {
        success: false,
        message: 'Operation failed',
        executionId: 'exec_707',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'test'
      };

      const formatted = formatter.formatErrorResponse(response);
      
      expect(formatted).toContain('✗');
      expect(formatted).toContain('Operation failed');
    });

    it('should include timestamp for error', () => {
      const timestamp = new Date('2023-01-01T10:00:00Z');
      const response: GeneratedResponse = {
        success: false,
        message: 'Command failed',
        executionId: 'exec_808',
        timestamp,
        command: 'test'
      };

      const formatted = formatter.formatErrorResponse(response);
      
      expect(formatted).toContain('Command failed');
      expect(formatted).toContain(timestamp.toLocaleTimeString());
    });

    it('should format error with suggestions', () => {
      const response: GeneratedResponse = {
        success: false,
        message: 'Invalid input',
        executionId: 'exec_909',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        command: 'test',
        suggestions: ['Check your input format', 'Try a different approach']
      };

      const formatted = formatter.formatErrorResponse(response);
      
      expect(formatted).toContain('Invalid input');
      expect(formatted).toContain('Check your input format');
      expect(formatted).toContain('Try a different approach');
    });
  });

  describe('formatData', () => {
    it('should format simple object data', () => {
      const data = { name: 'test', value: 42 };
      const formatted = formatter.formatData(data);
      
      expect(formatted).toContain('name');
      expect(formatted).toContain('test');
      expect(formatted).toContain('value');
      expect(formatted).toContain('42');
    });

    it('should format array data', () => {
      const data = ['item1', 'item2', 'item3'];
      const formatted = formatter.formatData(data);
      
      expect(formatted).toContain('item1');
      expect(formatted).toContain('item2');
      expect(formatted).toContain('item3');
    });

    it('should handle nested objects', () => {
      const data = {
        user: { name: 'Alice', age: 30 },
        settings: { theme: 'dark', notifications: true }
      };
      const formatted = formatter.formatData(data);
      
      expect(formatted).toContain('Alice');
      expect(formatted).toContain('30');
      expect(formatted).toContain('dark');
      expect(formatted).toContain('true');
    });

    it('should handle large arrays gracefully', () => {
      const data = Array.from({ length: 100 }, (_, i) => `item_${i}`);
      const formatted = formatter.formatData(data);
      
      expect(formatted).toContain('item_0');
      expect(formatted).toContain('...');
      expect(formatted.length).toBeLessThan(5000); // Reasonable limit
    });

    it('should handle null and undefined', () => {
      expect(formatter.formatData(null)).toBe('');
      expect(formatter.formatData(undefined)).toBe('');
    });
  });

  describe('formatSuggestions', () => {
    it('should format multiple suggestions', () => {
      const suggestions = ['Suggestion 1', 'Suggestion 2', 'Suggestion 3'];
      const formatted = formatter.formatSuggestions(suggestions);
      
      expect(formatted).toContain('Suggestion 1');
      expect(formatted).toContain('Suggestion 2');
      expect(formatted).toContain('Suggestion 3');
      expect(formatted).toContain('💡');
    });

    it('should format single suggestion', () => {
      const suggestions = ['Try again'];
      const formatted = formatter.formatSuggestions(suggestions);
      
      expect(formatted).toContain('Try again');
      expect(formatted).toContain('💡');
    });

    it('should handle empty suggestions', () => {
      const formatted = formatter.formatSuggestions([]);
      expect(formatted).toBe('');
    });

    it('should handle undefined suggestions', () => {
      const formatted = formatter.formatSuggestions(undefined);
      expect(formatted).toBe('');
    });
  });

  describe('formatMetadata', () => {
    it('should format metadata object', () => {
      const metadata = {
        executionTime: '250ms',
        source: 'cache',
        confidence: 0.95
      };
      const formatted = formatter.formatMetadata(metadata);
      
      expect(formatted).toContain('250ms');
      expect(formatted).toContain('cache');
      expect(formatted).toContain('0.95');
    });

    it('should handle empty metadata', () => {
      const formatted = formatter.formatMetadata({});
      expect(formatted).toBe('');
    });

    it('should handle null metadata', () => {
      const formatted = formatter.formatMetadata(null);
      expect(formatted).toBe('');
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp in readable format', () => {
      const timestamp = new Date('2023-01-01T10:30:45Z');
      const formatted = formatter.formatTimestamp(timestamp);
      
      expect(formatted).toContain('10:30:45');
    });

    it('should handle different timezones', () => {
      const timestamp = new Date('2023-01-01T10:30:45Z');
      const formatted = formatter.formatTimestamp(timestamp);
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('colorize', () => {
    it('should apply success color', () => {
      const text = 'Success message';
      const colored = formatter.colorize(text, 'success');
      
      expect(colored).toContain(text);
      expect(colored.length).toBeGreaterThan(text.length);
    });

    it('should apply error color', () => {
      const text = 'Error message';
      const colored = formatter.colorize(text, 'error');
      
      expect(colored).toContain(text);
      expect(colored.length).toBeGreaterThan(text.length);
    });

    it('should apply info color', () => {
      const text = 'Info message';
      const colored = formatter.colorize(text, 'info');
      
      expect(colored).toContain(text);
      expect(colored.length).toBeGreaterThan(text.length);
    });

    it('should apply warning color', () => {
      const text = 'Warning message';
      const colored = formatter.colorize(text, 'warning');
      
      expect(colored).toContain(text);
      expect(colored.length).toBeGreaterThan(text.length);
    });

    it('should return original text for unknown color', () => {
      const text = 'Plain text';
      const colored = formatter.colorize(text, 'unknown' as any);
      
      expect(colored).toBe(text);
    });
  });

  describe('truncateData', () => {
    it('should truncate long strings', () => {
      const longText = 'a'.repeat(1000);
      const truncated = formatter.truncateData(longText, 100);
      
      expect(truncated.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(truncated).toContain('...');
    });

    it('should not truncate short strings', () => {
      const shortText = 'Hello world';
      const truncated = formatter.truncateData(shortText, 100);
      
      expect(truncated).toBe(shortText);
    });

    it('should handle objects by stringifying', () => {
      const obj = { name: 'test', value: 42 };
      const truncated = formatter.truncateData(obj, 50);
      
      expect(typeof truncated).toBe('string');
      expect(truncated).toContain('test');
    });
  });
});