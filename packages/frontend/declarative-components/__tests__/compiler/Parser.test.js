/**
 * Tests for the Parser
 */

import { jest } from '@jest/globals';
import { Parser } from '../../src/compiler/Parser.js';

describe('Parser', () => {
  describe('Component parsing', () => {
    test('should parse simple component', () => {
      const input = 'UserCard :: data => div { "Hello" }';
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast).toEqual({
        type: 'Component',
        name: 'UserCard',
        entityParam: 'data',
        body: {
          type: 'Element',
          tagName: 'div',
          classes: [],
          id: null,
          attributes: {},
          events: [],
          content: {
            type: 'Literal',
            value: 'Hello'
          }
        }
      });
    });

    test('should parse component with classes and ID', () => {
      const input = 'Card :: data => div.container#main { }';
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body).toEqual({
        type: 'Element',
        tagName: 'div',
        classes: ['container'],
        id: 'main',
        attributes: {},
        events: [],
        content: null
      });
    });
  });

  describe('Element parsing', () => {
    test('should parse element with attributes', () => {
      const input = 'Form :: data => input type="text" placeholder="Name" { }';
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.attributes).toEqual({
        type: 'text',
        placeholder: 'Name'
      });
    });

    test('should parse element with @ directives', () => {
      const input = 'Button :: data => button @click="handleClick" { "Click me" }';
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.events).toEqual([{
        event: 'click',
        action: 'handleClick',
        modifiers: undefined
      }]);
    });

    test('should parse @bind directive', () => {
      const input = 'Input :: data => input @bind="name" { }';
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.attributes).toEqual({
        'data-bind': 'name'
      });
    });

    test('should parse event with modifiers', () => {
      const input = 'Input :: data => input @keyup.enter="submit" { }';
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.events[0]).toEqual({
        event: 'keyup',
        action: 'submit',
        modifiers: ['enter']
      });
    });
  });

  describe('Expression parsing', () => {
    test('should parse string concatenation', () => {
      const input = 'Text :: data => p { "Hello " + data.name }';
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.content).toEqual({
        type: 'ConcatenationExpression',
        parts: [
          { type: 'Literal', value: 'Hello ' },
          {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: 'data' },
            property: 'name'
          }
        ]
      });
    });

    test('should parse ternary expression', () => {
      const input = 'Status :: data => span { data.active ? "Active" : "Inactive" }';
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.content).toEqual({
        type: 'TernaryExpression',
        condition: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'data' },
          property: 'active'
        },
        trueBranch: { type: 'Literal', value: 'Active' },
        falseBranch: { type: 'Literal', value: 'Inactive' }
      });
    });

    test('should parse nested member expression', () => {
      const input = 'Value :: data => span { data.user.profile.name }';
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.content).toEqual({
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          object: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: 'data' },
            property: 'user'
          },
          property: 'profile'
        },
        property: 'name'
      });
    });
  });

  describe('Children parsing', () => {
    test('should parse element with children', () => {
      const input = `Container :: data => div [
        h1 { "Title" }
        p { "Content" }
      ]`;
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.children).toHaveLength(2);
      expect(ast.body.children[0].tagName).toBe('h1');
      expect(ast.body.children[1].tagName).toBe('p');
    });

    test('should parse nested children', () => {
      const input = `Page :: data => div [
        header [
          h1 { "Title" }
        ]
      ]`;
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.children[0].tagName).toBe('header');
      expect(ast.body.children[0].children[0].tagName).toBe('h1');
    });
  });

  describe('Control flow parsing', () => {
    test('should parse if statement', () => {
      const input = `Conditional :: data => div [
        if (data.show) [
          p { "Visible" }
        ]
      ]`;
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.children[0]).toEqual({
        type: 'IfStatement',
        condition: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'data' },
          property: 'show'
        },
        children: [{
          type: 'Element',
          tagName: 'p',
          classes: [],
          id: null,
          attributes: {},
          events: [],
          content: { type: 'Literal', value: 'Visible' }
        }]
      });
    });

    test('should parse for loop', () => {
      const input = `List :: data => ul [
        for item in data.items [
          li { item.name }
        ]
      ]`;
      const parser = new Parser(input);
      const ast = parser.parse();
      
      expect(ast.body.children[0]).toEqual({
        type: 'ForStatement',
        variable: 'item',
        iterable: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'data' },
          property: 'items'
        },
        children: [{
          type: 'Element',
          tagName: 'li',
          classes: [],
          id: null,
          attributes: {},
          events: [],
          content: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: 'item' },
            property: 'name'
          }
        }]
      });
    });
  });

  describe('Error handling', () => {
    test('should throw on missing component name', () => {
      const input = ':: data => div { }';
      const parser = new Parser(input);
      
      expect(() => parser.parse()).toThrow('Expected component name');
    });

    test('should throw on missing double colon', () => {
      const input = 'UserCard data => div { }';
      const parser = new Parser(input);
      
      expect(() => parser.parse()).toThrow('Expected ::');
    });

    test('should throw on missing arrow', () => {
      const input = 'UserCard :: data div { }';
      const parser = new Parser(input);
      
      expect(() => parser.parse()).toThrow('Expected =>');
    });

    test('should throw on unclosed bracket', () => {
      const input = 'UserCard :: data => div [';
      const parser = new Parser(input);
      
      expect(() => parser.parse()).toThrow('Expected ]');
    });
  });
});