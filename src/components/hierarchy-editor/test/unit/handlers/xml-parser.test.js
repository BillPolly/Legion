/**
 * XML Parser Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('XML Parser', () => {
  let XmlHandler;
  let xmlHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/XmlHandler.js');
    XmlHandler = module.XmlHandler;
    xmlHandler = new XmlHandler();
  });

  describe('Basic XML Parsing', () => {
    test('should parse simple XML element', () => {
      const xml = '<root>content</root>';
      const result = xmlHandler.parse(xml);
      
      expect(result).toBeDefined();
      expect(result.type).toBe('element');
      expect(result.name).toBe('root');
      expect(result.children).toHaveLength(1);
      expect(result.children[0].type).toBe('text');
      expect(result.children[0].value).toBe('content');
    });

    test('should parse XML with attributes', () => {
      const xml = '<user id="123" name="John">Active</user>';
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('user');
      expect(result.attributes).toBeDefined();
      expect(result.attributes.id).toBe('123');
      expect(result.attributes.name).toBe('John');
      expect(result.children).toHaveLength(1);
      expect(result.children[0].value).toBe('Active');
    });

    test('should parse nested XML elements', () => {
      const xml = `
        <book>
          <title>Test Book</title>
          <author>Test Author</author>
          <pages>200</pages>
        </book>
      `;
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('book');
      // Should have 3 element children plus whitespace text nodes
      expect(result.children.length).toBeGreaterThanOrEqual(3);
      
      const title = result.children.find(child => child.name === 'title');
      expect(title).toBeDefined();
      expect(title.children[0].value).toBe('Test Book');
      
      const author = result.children.find(child => child.name === 'author');
      expect(author).toBeDefined();
      expect(author.children[0].value).toBe('Test Author');
      
      const pages = result.children.find(child => child.name === 'pages');
      expect(pages).toBeDefined();
      expect(pages.children[0].value).toBe('200');
    });

    test('should parse self-closing XML elements', () => {
      const xml = '<config><setting name="debug" value="true" /><setting name="port" value="8080" /></config>';
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('config');
      expect(result.children).toHaveLength(2);
      
      const debugSetting = result.children[0];
      expect(debugSetting.type).toBe('element');
      expect(debugSetting.name).toBe('setting');
      expect(debugSetting.attributes.name).toBe('debug');
      expect(debugSetting.attributes.value).toBe('true');
      expect(debugSetting.children).toHaveLength(0);
    });

    test('should handle XML with mixed content', () => {
      const xml = '<p>This is <strong>bold</strong> text.</p>';
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('p');
      expect(result.children).toHaveLength(3);
      
      expect(result.children[0].type).toBe('text');
      expect(result.children[0].value).toBe('This is ');
      
      expect(result.children[1].type).toBe('element');
      expect(result.children[1].name).toBe('strong');
      expect(result.children[1].children[0].value).toBe('bold');
      
      expect(result.children[2].type).toBe('text');
      expect(result.children[2].value).toBe(' text.');
    });
  });

  describe('XML with Namespaces', () => {
    test('should parse XML with namespaces', () => {
      const xml = '<root xmlns:ns="http://example.com"><ns:element>content</ns:element></root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('root');
      expect(result.attributes['xmlns:ns']).toBe('http://example.com');
      
      const nsElement = result.children[0];
      expect(nsElement.type).toBe('element');
      expect(nsElement.name).toBe('ns:element');
      expect(nsElement.children[0].value).toBe('content');
    });

    test('should parse XML with default namespace', () => {
      const xml = '<root xmlns="http://example.com"><element>content</element></root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('root');
      expect(result.attributes.xmlns).toBe('http://example.com');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed XML gracefully', () => {
      const malformedXml = '<root><unclosed>content</root>';
      
      expect(() => {
        xmlHandler.parse(malformedXml);
      }).toThrow();
    });

    test('should handle empty XML', () => {
      const emptyXml = '';
      
      expect(() => {
        xmlHandler.parse(emptyXml);
      }).toThrow();
    });

    test('should handle non-XML content', () => {
      const nonXml = 'This is not XML';
      
      expect(() => {
        xmlHandler.parse(nonXml);
      }).toThrow();
    });
  });

  describe('XML Declaration and Processing Instructions', () => {
    test('should handle XML declaration', () => {
      const xml = '<?xml version="1.0" encoding="UTF-8"?><root>content</root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('root');
      expect(result.children[0].value).toBe('content');
    });

    test('should handle processing instructions', () => {
      const xml = '<?xml-stylesheet type="text/xsl" href="style.xsl"?><root>content</root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('root');
    });
  });

  describe('CDATA Sections', () => {
    test('should handle CDATA sections', () => {
      const xml = '<script><![CDATA[function test() { return x < y; }]]></script>';
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('script');
      expect(result.children).toHaveLength(1);
      expect(result.children[0].type).toBe('cdata');
      expect(result.children[0].value).toBe('function test() { return x < y; }');
    });
  });

  describe('Comments', () => {
    test('should handle XML comments', () => {
      const xml = '<root><!-- This is a comment --><element>content</element></root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.type).toBe('element');
      expect(result.name).toBe('root');
      expect(result.children).toHaveLength(2);
      
      expect(result.children[0].type).toBe('comment');
      expect(result.children[0].value).toBe(' This is a comment ');
      
      expect(result.children[1].type).toBe('element');
      expect(result.children[1].name).toBe('element');
    });
  });

  describe('White Space Handling', () => {
    test('should preserve significant whitespace', () => {
      const xml = '<pre>  formatted   text  </pre>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].value).toBe('  formatted   text  ');
    });

    test('should handle whitespace-only text nodes', () => {
      const xml = '<root>\n  <child>content</child>\n</root>';
      const result = xmlHandler.parse(xml);
      
      // Should include whitespace text nodes
      expect(result.children.length).toBeGreaterThan(1);
      
      const childElement = result.children.find(child => child.type === 'element');
      expect(childElement.name).toBe('child');
    });
  });
});