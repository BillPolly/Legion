import { describe, test, expect, beforeEach } from '@jest/globals';
import { HtmlParser } from '../src/components/tree-scribe/features/parsing/parsers/HtmlParser.js';
import { JavaScriptParser } from '../src/components/tree-scribe/features/parsing/parsers/JavaScriptParser.js';
import { XmlParser } from '../src/components/tree-scribe/features/parsing/parsers/XmlParser.js';

describe('HtmlParser', () => {
  let parser;

  beforeEach(() => {
    parser = new HtmlParser();
  });

  test('follows BaseParser interface', () => {
    expect(parser.getName()).toBe('HtmlParser');
    expect(parser.getSupportedFormats()).toEqual(['html', 'htm', 'xhtml']);
  });

  test('detects HTML content with high confidence', () => {
    const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Hello</h1></body>
</html>`;
    
    expect(parser.canParse(html)).toBeGreaterThan(0.9);
  });

  test('parses HTML with heading hierarchy', () => {
    const html = `<html>
<body>
  <h1>Main Title</h1>
  <p>Introduction</p>
  <h2>Section 1</h2>
  <p>Content 1</p>
  <h3>Subsection 1.1</h3>
  <p>Details</p>
  <h2>Section 2</h2>
  <p>Content 2</p>
</body>
</html>`;

    const result = parser.parse(html);
    expect(result.title).toBe('Main Title');
    expect(result.children).toHaveLength(2);
    expect(result.children[0].title).toBe('Section 1');
    expect(result.children[0].children).toHaveLength(1);
    expect(result.children[0].children[0].title).toBe('Subsection 1.1');
  });

  test('extracts semantic HTML5 elements', () => {
    const html = `<html>
<body>
  <header>Site Header</header>
  <nav>Navigation</nav>
  <main>
    <section>
      <h2>Content Section</h2>
    </section>
  </main>
  <footer>Site Footer</footer>
</body>
</html>`;

    const result = parser.parse(html);
    expect(result.children.some(c => c.title === 'Header')).toBe(true);
    expect(result.children.some(c => c.title === 'Nav')).toBe(true);
    expect(result.children.some(c => c.title === 'Main')).toBe(true);
    expect(result.children.some(c => c.title === 'Footer')).toBe(true);
  });

  test('handles self-closing tags', () => {
    const html = '<div><img src="test.jpg" /><br /><hr /></div>';
    const result = parser.parse(html);
    expect(result).toBeDefined();
    expect(result.sourceFormat).toBe('html');
  });

  test('extracts text content properly', () => {
    const html = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
    const result = parser.parse(html);
    expect(result.content).toContain('This is bold and italic text');
  });

  test('provides parser capabilities', () => {
    const capabilities = parser.getCapabilities();
    expect(capabilities.features).toContain('dom-tree');
    expect(capabilities.features).toContain('semantic-structure');
    expect(capabilities.supportsPartialParse).toBe(true);
  });
});

describe('JavaScriptParser', () => {
  let parser;

  beforeEach(() => {
    parser = new JavaScriptParser();
  });

  test('follows BaseParser interface', () => {
    expect(parser.getName()).toBe('JavaScriptParser');
    expect(parser.getSupportedFormats()).toContain('javascript');
    expect(parser.getSupportedFormats()).toContain('typescript');
  });

  test('detects JavaScript with high confidence', () => {
    const js = `import { Component } from './component';

export class MyClass {
  constructor() {
    this.value = 42;
  }
  
  async getData() {
    return await fetch('/api/data');
  }
}`;

    expect(parser.canParse(js)).toBeGreaterThan(0.8);
  });

  test('parses ES6 imports', () => {
    const js = `import React from 'react';
import { useState, useEffect } from 'react';
import * as utils from './utils';`;

    const result = parser.parse(js);
    const imports = result.children.find(c => c.title === 'Imports');
    expect(imports).toBeDefined();
    expect(imports.children).toHaveLength(3);
  });

  test('extracts classes with methods', () => {
    const js = `class Calculator {
  constructor() {
    this.result = 0;
  }
  
  add(a, b) {
    return a + b;
  }
  
  subtract(a, b) {
    return a - b;
  }
}`;

    const result = parser.parse(js);
    const classNode = result.children.find(c => c.title === 'class Calculator');
    expect(classNode).toBeDefined();
    expect(classNode.children.some(c => c.title === 'add')).toBe(true);
    expect(classNode.children.some(c => c.title === 'subtract')).toBe(true);
  });

  test('extracts functions', () => {
    const js = `function greet(name) {
  return \`Hello, \${name}!\`;
}

const calculate = (a, b) => a + b;

export async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}`;

    const result = parser.parse(js);
    const functions = result.children.filter(c => 
      c.title.includes('function') || c.title.includes('(arrow)')
    );
    expect(functions.length).toBeGreaterThanOrEqual(3);
  });

  test('detects TypeScript features', () => {
    const ts = `interface User {
  id: number;
  name: string;
  email?: string;
}

type Status = 'active' | 'inactive' | 'pending';

enum Role {
  Admin = 'ADMIN',
  User = 'USER'
}`;

    const result = parser.parse(ts, { format: 'typescript' });
    expect(result.metadata.language).toBe('typescript');
    expect(result.children.some(c => c.title.startsWith('interface'))).toBe(true);
    expect(result.children.some(c => c.title.startsWith('type'))).toBe(true);
    expect(result.children.some(c => c.title.startsWith('enum'))).toBe(true);
  });

  test('extracts JSDoc comments', () => {
    const js = `/**
 * Calculate the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The sum
 */
function add(a, b) {
  return a + b;
}`;

    const result = parser.parse(js);
    const func = result.children.find(c => c.title === 'function add');
    expect(func.content).toContain('Calculate the sum');
  });

  test('provides parser capabilities', () => {
    const capabilities = parser.getCapabilities();
    expect(capabilities.features).toContain('ast-like-extraction');
    expect(capabilities.features).toContain('typescript-support');
  });
});

describe('XmlParser', () => {
  let parser;

  beforeEach(() => {
    parser = new XmlParser();
  });

  test('follows BaseParser interface', () => {
    expect(parser.getName()).toBe('XmlParser');
    expect(parser.getSupportedFormats()).toContain('xml');
    expect(parser.getSupportedFormats()).toContain('svg');
  });

  test('detects XML with high confidence', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <item id="1">Content</item>
</root>`;
    
    expect(parser.canParse(xml)).toBeGreaterThan(0.9);
  });

  test('parses XML structure', () => {
    const xml = `<?xml version="1.0"?>
<catalog>
  <book id="1">
    <title>XML Guide</title>
    <author>John Doe</author>
    <price>29.99</price>
  </book>
  <book id="2">
    <title>Advanced XML</title>
    <author>Jane Smith</author>
    <price>39.99</price>
  </book>
</catalog>`;

    const result = parser.parse(xml);
    expect(result.title).toContain('catalog');
    expect(result.children).toHaveLength(2);
    expect(result.children[0].title).toContain('book');
    expect(result.children[0].children.some(c => c.title === 'title')).toBe(true);
  });

  test('handles XML namespaces', () => {
    const xml = `<?xml version="1.0"?>
<root xmlns="http://example.com/ns" xmlns:custom="http://example.com/custom">
  <item>Default namespace</item>
  <custom:item>Custom namespace</custom:item>
</root>`;

    const result = parser.parse(xml);
    expect(result.metadata.namespaces).toBeDefined();
    expect(result.metadata.namespaces.default).toBe('http://example.com/ns');
    expect(result.metadata.namespaces.custom).toBe('http://example.com/custom');
  });

  test('extracts attributes', () => {
    const xml = `<element id="123" class="test" enabled="true">Content</element>`;
    
    const result = parser.parse(xml);
    expect(result.children[0].metadata.attributes).toEqual({
      id: '123',
      class: 'test',
      enabled: 'true'
    });
  });

  test('handles self-closing elements', () => {
    const xml = `<root>
  <item />
  <data value="test" />
</root>`;

    const result = parser.parse(xml);
    expect(result.children).toHaveLength(2);
  });

  test('provides parser capabilities', () => {
    const capabilities = parser.getCapabilities();
    expect(capabilities.features).toContain('namespace-support');
    expect(capabilities.features).toContain('attribute-extraction');
  });
});

describe('Parser Error Handling', () => {
  test('HTML parser handles malformed content', () => {
    const parser = new HtmlParser();
    const malformed = '<div><span>Unclosed tag</div>';
    
    const result = parser.parse(malformed);
    expect(result).toBeDefined();
    expect(result.sourceFormat).toBe('html');
  });

  test('JavaScript parser handles syntax errors gracefully', () => {
    const parser = new JavaScriptParser();
    const invalid = 'function { invalid syntax }';
    
    const result = parser.parse(invalid);
    expect(result).toBeDefined();
    expect(result.title).toContain('Module');
  });

  test('XML parser handles invalid XML', () => {
    const parser = new XmlParser();
    const invalid = '<root><unclosed></root>';
    
    const result = parser.parse(invalid);
    expect(result).toBeDefined();
    expect(result.sourceFormat).toBe('xml');
  });
});