/**
 * Tests for TreeScribe Parser Infrastructure
 */

import { BaseParser } from '../src/components/tree-scribe/features/parsing/BaseParser.js';
import { ParserRegistry } from '../src/components/tree-scribe/features/parsing/ParserRegistry.js';
import { YamlParser } from '../src/components/tree-scribe/features/parsing/parsers/YamlParser.js';
import { TreeScribeModel } from '../src/components/tree-scribe/core/model/TreeScribeModel.js';

describe('BaseParser', () => {
  test('should throw errors for unimplemented methods', () => {
    const parser = new BaseParser();
    
    expect(() => parser.getName()).toThrow('getName() must be implemented');
    expect(() => parser.getSupportedFormats()).toThrow('getSupportedFormats() must be implemented');
    expect(() => parser.canParse('test')).toThrow('canParse() must be implemented');
    expect(() => parser.parse('test')).toThrow('parse() must be implemented');
  });

  test('should provide default validate implementation', () => {
    const parser = new BaseParser();
    
    // Valid string
    expect(parser.validate('test content')).toEqual({
      valid: true,
      errors: []
    });
    
    // Invalid inputs
    expect(parser.validate(null)).toEqual({
      valid: false,
      errors: ['Content must be a non-empty string']
    });
    
    expect(parser.validate('')).toEqual({
      valid: false,
      errors: ['Content must be a non-empty string']
    });
    
    expect(parser.validate(123)).toEqual({
      valid: false,
      errors: ['Content must be a non-empty string']
    });
  });

  test('should provide default capabilities', () => {
    const parser = new BaseParser();
    const capabilities = parser.getCapabilities();
    
    expect(capabilities).toEqual({
      supportsStreaming: false,
      supportsPartialParse: false,
      preservesFormatting: true,
      bidirectional: false,
      maxFileSize: null,
      requiresDOM: false,
      async: false
    });
  });

  test('should generate unique IDs', () => {
    // Create concrete parser for testing
    class TestParser extends BaseParser {
      getName() { return 'TestParser'; }
      getSupportedFormats() { return ['test']; }
      canParse() { return true; }
      parse() { return {}; }
    }
    
    const parser = new TestParser();
    const id1 = parser._generateId();
    const id2 = parser._generateId();
    
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^test_[a-z0-9]+_\d+$/);
  });

  test('should detect content types', () => {
    const parser = new BaseParser();
    
    expect(parser._detectContentType('# Heading')).toBe('markdown');
    expect(parser._detectContentType('**bold**')).toBe('markdown');
    expect(parser._detectContentType('```code```')).toBe('markdown');
    expect(parser._detectContentType('<div>HTML</div>')).toBe('html');
    expect(parser._detectContentType('function test() {}')).toBe('javascript');
    expect(parser._detectContentType('plain text')).toBe('plaintext');
  });
});

describe('ParserRegistry', () => {
  let registry;
  
  beforeEach(() => {
    registry = new ParserRegistry();
  });

  test('should register and retrieve parsers', () => {
    const yamlParser = new YamlParser();
    
    registry.registerParser(yamlParser);
    
    expect(registry.getParserByName('YamlParser')).toBe(yamlParser);
    expect(registry.getParserByFormat('yaml')).toBe(yamlParser);
    expect(registry.getParserByFormat('yml')).toBe(yamlParser);
  });

  test('should handle invalid parser registration', () => {
    expect(() => registry.registerParser(null)).toThrow('Parser must be an instance of BaseParser');
    expect(() => registry.registerParser({})).toThrow('Parser must be an instance of BaseParser');
  });

  test('should auto-detect YAML format', () => {
    const yamlParser = new YamlParser();
    registry.registerParser(yamlParser);
    
    const yamlContent = `
title: Test Document
content: |
  This is content
children:
  - title: Child
`;
    
    const parser = registry.getParser(yamlContent);
    expect(parser).toBe(yamlParser);
  });

  test('should use format hint', () => {
    const yamlParser = new YamlParser();
    registry.registerParser(yamlParser);
    
    const parser = registry.getParser('plain text', { format: 'yaml' });
    expect(parser).toBe(yamlParser);
  });

  test('should use filename hint', () => {
    const yamlParser = new YamlParser();
    registry.registerParser(yamlParser);
    
    // Use YAML-like content with filename hint
    const parser = registry.getParser('title: test\ncontent: value', { filename: 'test.yml' });
    expect(parser).toBe(yamlParser);
  });

  test('should use MIME type hint', () => {
    const yamlParser = new YamlParser();
    registry.registerParser(yamlParser);
    
    const parser = registry.getParser('some content', { mimeType: 'application/yaml' });
    expect(parser).toBe(yamlParser);
  });

  test('should return null for unsupported format', () => {
    const parser = registry.getParser('<xml>content</xml>');
    expect(parser).toBeNull();
  });

  test('should unregister parsers', () => {
    const yamlParser = new YamlParser();
    registry.registerParser(yamlParser);
    
    expect(registry.getParserByName('YamlParser')).toBe(yamlParser);
    
    registry.unregisterParser('YamlParser');
    
    expect(registry.getParserByName('YamlParser')).toBeNull();
    expect(registry.getParserByFormat('yaml')).toBeNull();
  });

  test('should get all formats', () => {
    const yamlParser = new YamlParser();
    registry.registerParser(yamlParser);
    
    const formats = registry.getFormats();
    expect(formats).toContain('yaml');
    expect(formats).toContain('yml');
  });

  test('should handle default parser', () => {
    const yamlParser = new YamlParser();
    registry.registerParser(yamlParser);
    registry.setDefaultParser('YamlParser');
    
    // Even non-YAML content should use default if it can parse
    const parser = registry.getParser('title: test');
    expect(parser).toBe(yamlParser);
  });
});

describe('YamlParser', () => {
  let parser;
  
  beforeEach(() => {
    parser = new YamlParser();
  });

  test('should have correct metadata', () => {
    expect(parser.getName()).toBe('YamlParser');
    expect(parser.getSupportedFormats()).toEqual(['yaml', 'yml']);
    expect(parser.getSupportedMimeTypes()).toContain('application/yaml');
  });

  test('should detect YAML content', () => {
    expect(parser.canParse('---\ntitle: test')).toBe(true);
    expect(parser.canParse('title: test\ncontent: value')).toBe(true);
    expect(parser.canParse('- item1\n- item2')).toBe(true);
    expect(parser.canParse('key: |\n  multiline')).toBe(true);
    expect(parser.canParse('<xml>not yaml</xml>')).toBe(false);
  });

  test('should parse simple YAML', () => {
    const yaml = `
title: Test Document
content: This is content
`;
    
    const result = parser.parse(yaml);
    
    expect(result.title).toBe('Test Document');
    expect(result.content).toBe('This is content');
    expect(result.sourceFormat).toBe('yaml');
  });

  test('should parse YAML with children', () => {
    const yaml = `
title: Parent
children:
  - title: Child 1
    content: Content 1
  - title: Child 2
    content: Content 2
`;
    
    const result = parser.parse(yaml);
    
    expect(result.title).toBe('Parent');
    expect(result.children).toHaveLength(2);
    expect(result.children[0].title).toBe('Child 1');
    expect(result.children[1].title).toBe('Child 2');
  });

  test('should handle empty content', () => {
    const result = parser.parse('');
    
    expect(result.title).toBe('Empty Document');
    expect(result.content).toBe('');
    expect(result.children).toEqual([]);
  });

  test('should handle parse errors', () => {
    // Use actually invalid YAML syntax
    const invalidYaml = `
title: Test
[invalid syntax here
`;
    
    const result = parser.parse(invalidYaml);
    
    expect(result.title).toBe('Parse Error');
    expect(result.contentType).toBe('error');
    expect(result.metadata.error).toBe(true);
  });

  test('should detect content types', () => {
    const yaml = `
title: Test
content: |
  # Markdown Content
  This has **bold** text
type: markdown
`;
    
    const result = parser.parse(yaml);
    expect(result.contentType).toBe('markdown');
  });
});

describe('TreeScribeModel with ParserRegistry', () => {
  let model;
  
  beforeEach(() => {
    model = new TreeScribeModel();
  });

  test('should have YamlParser registered by default', () => {
    const formats = model.getSupportedFormats();
    expect(formats).toContain('yaml');
    expect(formats).toContain('yml');
  });

  test('should load YAML using new infrastructure', () => {
    const yaml = `
title: Test Document
content: Test content
children:
  - title: Child
`;
    
    const result = model.load(yaml, { format: 'yaml' });
    
    expect(result.success).toBe(true);
    expect(result.nodeCount).toBe(2);
    expect(result.format).toBe('yaml');
    expect(result.parser).toBe('YamlParser');
  });

  test('should maintain backward compatibility with loadYaml', () => {
    const yaml = `
title: Legacy Test
content: Legacy content
`;
    
    const result = model.loadYaml(yaml);
    
    expect(result.success).toBe(true);
    expect(result.nodeCount).toBe(1);
  });

  test('should auto-detect YAML format', () => {
    const yaml = `
title: Auto Detect Test
content: Should detect as YAML
`;
    
    const result = model.load(yaml); // No format specified
    
    expect(result.success).toBe(true);
    expect(result.format).toBe('yaml');
  });

  test('should detect format', () => {
    const yaml = 'title: test\ncontent: value';
    const format = model.detectFormat(yaml);
    
    expect(format).toBe('yaml');
  });

  test('should handle unsupported format', () => {
    const xmlContent = '<xml>content</xml>';
    
    expect(() => model.load(xmlContent)).toThrow('No parser found');
  });

  test('should register custom parser', () => {
    // Create mock parser
    class MockParser extends BaseParser {
      getName() { return 'MockParser'; }
      getSupportedFormats() { return ['mock']; }
      canParse(content) { return content.startsWith('MOCK:'); }
      parse(content) {
        return this._normalizeNode({
          title: 'Mock Document',
          content: content.replace('MOCK:', '')
        });
      }
    }
    
    model.registerParser(new MockParser());
    
    const formats = model.getSupportedFormats();
    expect(formats).toContain('mock');
    
    const result = model.load('MOCK:test content', { format: 'mock' });
    expect(result.success).toBe(true);
    expect(result.parser).toBe('MockParser');
  });
});