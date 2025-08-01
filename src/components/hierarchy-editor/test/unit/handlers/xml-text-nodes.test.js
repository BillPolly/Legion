/**
 * XML Text Node Handling Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('XML Text Node Handling', () => {
  let XmlHandler;
  let xmlHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/XmlHandler.js');
    XmlHandler = module.XmlHandler;
    xmlHandler = new XmlHandler();
  });

  describe('Basic Text Node Parsing', () => {
    test('should parse simple text content', () => {
      const xml = '<root>Simple text content</root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children).toHaveLength(1);
      expect(result.children[0].type).toBe('text');
      expect(result.children[0].value).toBe('Simple text content');
    });

    test('should parse empty text content', () => {
      const xml = '<root></root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children).toHaveLength(0);
    });

    test('should parse text with whitespace', () => {
      const xml = '<root>  Text with spaces  </root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].type).toBe('text');
      expect(result.children[0].value).toBe('  Text with spaces  ');
    });

    test('should parse multiline text', () => {
      const xml = `<root>
        Line 1
        Line 2
        Line 3
      </root>`;
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].type).toBe('text');
      expect(result.children[0].value).toContain('Line 1');
      expect(result.children[0].value).toContain('Line 2');
      expect(result.children[0].value).toContain('Line 3');
    });
  });

  describe('Mixed Content', () => {
    test('should handle text mixed with elements', () => {
      const xml = '<p>This is <em>emphasized</em> text.</p>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children).toHaveLength(3);
      
      expect(result.children[0].type).toBe('text');
      expect(result.children[0].value).toBe('This is ');
      
      expect(result.children[1].type).toBe('element');
      expect(result.children[1].name).toBe('em');
      expect(result.children[1].children[0].value).toBe('emphasized');
      
      expect(result.children[2].type).toBe('text');
      expect(result.children[2].value).toBe(' text.');
    });

    test('should handle complex mixed content', () => {
      const xml = '<div>Start <span>middle <strong>inner</strong> more</span> end</div>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children).toHaveLength(3);
      expect(result.children[0].type).toBe('text');
      expect(result.children[0].value).toBe('Start ');
      
      const spanElement = result.children[1];
      expect(spanElement.type).toBe('element');
      expect(spanElement.name).toBe('span');
      expect(spanElement.children).toHaveLength(3);
      
      expect(result.children[2].type).toBe('text');
      expect(result.children[2].value).toBe(' end');
    });
  });

  describe('Special Characters and Entities', () => {
    test('should parse XML entities in text', () => {
      const xml = '<root>Entities: &lt; &gt; &amp; &quot; &apos;</root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].value).toBe('Entities: < > & " \'');
    });

    test('should parse numeric character references', () => {
      const xml = '<root>Copyright &#169; 2024</root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].value).toBe('Copyright © 2024');
    });

    test('should parse hexadecimal character references', () => {
      const xml = '<root>Unicode: &#x1F600;</root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].value).toBe('Unicode: 😀');
    });

    test('should handle custom entities', () => {
      const xml = '<!DOCTYPE root [<!ENTITY custom "Custom Value">]><root>Text with &custom;</root>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].value).toBe('Text with Custom Value');
    });
  });

  describe('CDATA Sections', () => {
    test('should parse CDATA sections', () => {
      const xml = '<script><![CDATA[function test() { return x < y && a > b; }]]></script>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children).toHaveLength(1);
      expect(result.children[0].type).toBe('cdata');
      expect(result.children[0].value).toBe('function test() { return x < y && a > b; }');
    });

    test('should handle CDATA with XML-like content', () => {
      const xml = '<data><![CDATA[<xml>This looks like XML but is text</xml>]]></data>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].type).toBe('cdata');
      expect(result.children[0].value).toBe('<xml>This looks like XML but is text</xml>');
    });

    test('should handle empty CDATA sections', () => {
      const xml = '<data><![CDATA[]]></data>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].type).toBe('cdata');
      expect(result.children[0].value).toBe('');
    });

    test('should handle CDATA with special characters', () => {
      const xml = '<code><![CDATA[if (x < 5 && y > "test") { alert("Hello & Goodbye"); }]]></code>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].value).toBe('if (x < 5 && y > "test") { alert("Hello & Goodbye"); }');
    });
  });

  describe('Text Node Serialization', () => {
    test('should serialize text nodes correctly', () => {
      const node = {
        type: 'text',
        value: 'Simple text'
      };
      
      const xml = xmlHandler.serializeTextNode(node);
      expect(xml).toBe('Simple text');
    });

    test('should escape special characters in text', () => {
      const node = {
        type: 'text',
        value: 'Text with < > & " \' characters'
      };
      
      const xml = xmlHandler.serializeTextNode(node);
      expect(xml).toBe('Text with &lt; &gt; &amp; " \' characters');
    });

    test('should serialize CDATA sections', () => {
      const node = {
        type: 'cdata',
        value: 'function test() { return x < y; }'
      };
      
      const xml = xmlHandler.serializeTextNode(node);
      expect(xml).toBe('<![CDATA[function test() { return x < y; }]]>');
    });

    test('should handle text with newlines', () => {
      const node = {
        type: 'text',
        value: 'Line 1\nLine 2\nLine 3'
      };
      
      const xml = xmlHandler.serializeTextNode(node);
      expect(xml).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('Whitespace Handling', () => {
    test('should preserve significant whitespace', () => {
      const xml = '<pre>  Formatted    text  </pre>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].value).toBe('  Formatted    text  ');
    });

    test('should handle whitespace-only text nodes', () => {
      const xml = '<root>\n  <child>content</child>\n  <child>more</child>\n</root>';
      const result = xmlHandler.parse(xml);
      
      // Should include whitespace text nodes between elements
      const textNodes = result.children.filter(child => child.type === 'text');
      expect(textNodes.length).toBeGreaterThan(0);
    });

    test('should handle xml:space="preserve"', () => {
      const xml = '<text xml:space="preserve">  Preserve   all   spaces  </text>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].value).toBe('  Preserve   all   spaces  ');
    });

    test('should handle tabs and other whitespace characters', () => {
      const xml = '<data>\t\n\tTab and newline characters\t\n</data>';
      const result = xmlHandler.parse(xml);
      
      expect(result.children[0].value).toContain('\t');
      expect(result.children[0].value).toContain('\n');
      expect(result.children[0].value).toContain('Tab and newline characters');
    });
  });

  describe('Round-trip Text Handling', () => {
    test('should maintain text content through parse-serialize cycle', () => {
      const originalXml = '<root>This is <em>mixed</em> content with entities: &lt; &amp; &gt;</root>';
      const parsed = xmlHandler.parse(originalXml);
      const serialized = xmlHandler.serialize(parsed, { compact: true });
      const reparsed = xmlHandler.parse(serialized);
      
      const textNodes = reparsed.children.filter(child => child.type === 'text');
      const elementNodes = reparsed.children.filter(child => child.type === 'element');
      
      expect(textNodes.length).toBeGreaterThanOrEqual(2);
      expect(elementNodes).toHaveLength(1);
      expect(elementNodes[0].name).toBe('em');
      expect(elementNodes[0].children[0].value).toBe('mixed');
      
      // Check that entities are properly decoded
      const fullText = textNodes.map(n => n.value).join('');
      expect(fullText).toContain('< & >');
    });

    test('should maintain CDATA content through round-trip', () => {
      const originalXml = '<script><![CDATA[if (x < y) { alert("test"); }]]></script>';
      const parsed = xmlHandler.parse(originalXml);
      const serialized = xmlHandler.serialize(parsed);
      const reparsed = xmlHandler.parse(serialized);
      
      expect(reparsed.children[0].type).toBe('cdata');
      expect(reparsed.children[0].value).toBe('if (x < y) { alert("test"); }');
    });
  });
});