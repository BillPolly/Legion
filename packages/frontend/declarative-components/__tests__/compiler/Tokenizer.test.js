/**
 * Tests for the Tokenizer
 */

import { jest } from '@jest/globals';
import { Tokenizer } from '../../src/compiler/Tokenizer.js';

describe('Tokenizer', () => {
  describe('Basic tokens', () => {
    test('should tokenize component declaration', () => {
      const input = 'UserCard :: data => div { }';
      const tokenizer = new Tokenizer(input);
      const tokens = tokenizer.tokenize();
      
      expect(tokens).toEqual([
        { type: 'IDENTIFIER', value: 'UserCard', line: 1, column: 1 },
        { type: 'DOUBLE_COLON', value: '::', line: 1, column: 10 },
        { type: 'IDENTIFIER', value: 'data', line: 1, column: 13 },
        { type: 'ARROW', value: '=>', line: 1, column: 18 },
        { type: 'IDENTIFIER', value: 'div', line: 1, column: 21 },
        { type: 'LBRACE', value: '{', line: 1, column: 25 },
        { type: 'RBRACE', value: '}', line: 1, column: 27 },
        { type: 'EOF', value: '', line: 1, column: 28 }
      ]);
    });

    test('should tokenize string literals', () => {
      const input = '"Hello World"';
      const tokenizer = new Tokenizer(input);
      const tokens = tokenizer.tokenize();
      
      expect(tokens[0]).toEqual({ 
        type: 'STRING', 
        value: 'Hello World', 
        line: 1, 
        column: 1 
      });
    });

    test('should tokenize numbers', () => {
      const input = '42 3.14';
      const tokenizer = new Tokenizer(input);
      const tokens = tokenizer.tokenize();
      
      expect(tokens[0]).toEqual({ 
        type: 'NUMBER', 
        value: 42, 
        line: 1, 
        column: 1 
      });
      expect(tokens[1]).toEqual({ 
        type: 'NUMBER', 
        value: 3.14, 
        line: 1, 
        column: 4 
      });
    });

    test('should tokenize @ directives', () => {
      const input = '@click="handleClick"';
      const tokenizer = new Tokenizer(input);
      const tokens = tokenizer.tokenize();
      
      expect(tokens).toEqual([
        { type: 'AT', value: '@', line: 1, column: 1 },
        { type: 'IDENTIFIER', value: 'click', line: 1, column: 2 },
        { type: 'EQUALS', value: '=', line: 1, column: 7 },
        { type: 'STRING', value: 'handleClick', line: 1, column: 8 },
        { type: 'EOF', value: '', line: 1, column: 21 }
      ]);
    });

    test('should tokenize classes and IDs', () => {
      const input = 'div.container#main';
      const tokenizer = new Tokenizer(input);
      const tokens = tokenizer.tokenize();
      
      expect(tokens).toEqual([
        { type: 'IDENTIFIER', value: 'div', line: 1, column: 1 },
        { type: 'DOT', value: '.', line: 1, column: 4 },
        { type: 'IDENTIFIER', value: 'container', line: 1, column: 5 },
        { type: 'HASH', value: '#', line: 1, column: 14 },
        { type: 'IDENTIFIER', value: 'main', line: 1, column: 15 },
        { type: 'EOF', value: '', line: 1, column: 19 }
      ]);
    });
  });

  describe('Complex expressions', () => {
    test('should tokenize string concatenation', () => {
      const input = '"Hello " + data.name';
      const tokenizer = new Tokenizer(input);
      const tokens = tokenizer.tokenize();
      
      expect(tokens).toEqual([
        { type: 'STRING', value: 'Hello ', line: 1, column: 1 },
        { type: 'PLUS', value: '+', line: 1, column: 10 },
        { type: 'IDENTIFIER', value: 'data', line: 1, column: 12 },
        { type: 'DOT', value: '.', line: 1, column: 16 },
        { type: 'IDENTIFIER', value: 'name', line: 1, column: 17 },
        { type: 'EOF', value: '', line: 1, column: 21 }
      ]);
    });

    test('should tokenize ternary expressions', () => {
      const input = 'data.active ? "Yes" : "No"';
      const tokenizer = new Tokenizer(input);
      const tokens = tokenizer.tokenize();
      
      expect(tokens).toEqual([
        { type: 'IDENTIFIER', value: 'data', line: 1, column: 1 },
        { type: 'DOT', value: '.', line: 1, column: 5 },
        { type: 'IDENTIFIER', value: 'active', line: 1, column: 6 },
        { type: 'QUESTION', value: '?', line: 1, column: 13 },
        { type: 'STRING', value: 'Yes', line: 1, column: 15 },
        { type: 'COLON', value: ':', line: 1, column: 21 },
        { type: 'STRING', value: 'No', line: 1, column: 23 },
        { type: 'EOF', value: '', line: 1, column: 27 }
      ]);
    });
  });

  describe('Keywords', () => {
    test('should tokenize if statements', () => {
      const input = 'if (data.show) [ ]';
      const tokenizer = new Tokenizer(input);
      const tokens = tokenizer.tokenize();
      
      expect(tokens[0]).toEqual({ 
        type: 'IF', 
        value: 'if', 
        line: 1, 
        column: 1 
      });
    });

    test('should tokenize for loops', () => {
      const input = 'for item in data.items [ ]';
      const tokenizer = new Tokenizer(input);
      const tokens = tokenizer.tokenize();
      
      expect(tokens[0]).toEqual({ 
        type: 'FOR', 
        value: 'for', 
        line: 1, 
        column: 1 
      });
      expect(tokens[2]).toEqual({ 
        type: 'IN', 
        value: 'in', 
        line: 1, 
        column: 10 
      });
    });
  });

  describe('Error handling', () => {
    test('should throw on unterminated string', () => {
      const input = '"unterminated';
      const tokenizer = new Tokenizer(input);
      
      expect(() => tokenizer.tokenize()).toThrow('Unterminated string');
    });
  });
});