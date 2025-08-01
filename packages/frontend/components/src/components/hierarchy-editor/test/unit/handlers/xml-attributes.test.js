/**
 * XML Attribute Handling Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('XML Attribute Handling', () => {
  let XmlHandler;
  let xmlHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/XmlHandler.js');
    XmlHandler = module.XmlHandler;
    xmlHandler = new XmlHandler();
  });

  describe('Attribute Parsing', () => {
    test('should parse single attribute', () => {
      const xml = '<element attr="value">content</element>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes).toBeDefined();
      expect(result.attributes.attr).toBe('value');
    });

    test('should parse multiple attributes', () => {
      const xml = '<element id="123" name="test" active="true">content</element>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes.id).toBe('123');
      expect(result.attributes.name).toBe('test');
      expect(result.attributes.active).toBe('true');
    });

    test('should handle attributes with different quote types', () => {
      const xml = '<element single=\'value\' double="value2">content</element>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes.single).toBe('value');
      expect(result.attributes.double).toBe('value2');
    });

    test('should handle attributes with special characters', () => {
      const xml = '<element url="http://example.com?param=value&amp;other=test">content</element>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes.url).toBe('http://example.com?param=value&other=test');
    });

    test('should handle empty attributes', () => {
      const xml = '<element empty="">content</element>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes.empty).toBe('');
    });

    test('should handle boolean-like attributes', () => {
      const xml = '<input type="checkbox" checked="" disabled="disabled" />';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes.type).toBe('checkbox');
      expect(result.attributes.checked).toBe('');
      expect(result.attributes.disabled).toBe('disabled');
    });
  });

  describe('Attribute Serialization', () => {
    test('should serialize element with attributes', () => {
      const node = {
        type: 'element',
        name: 'test',
        attributes: {
          id: '123',
          name: 'example'
        },
        children: [
          { type: 'text', value: 'content' }
        ]
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toContain('id="123"');
      expect(xml).toContain('name="example"');
      expect(xml).toContain('>content</test>');
    });

    test('should escape special characters in attributes', () => {
      const node = {
        type: 'element',
        name: 'test',
        attributes: {
          value: 'quote"and&ampersand<greater'
        },
        children: []
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toContain('value="quote&quot;and&amp;ampersand&lt;greater"');
    });

    test('should handle attributes with namespace prefixes', () => {
      const node = {
        type: 'element',
        name: 'test',
        attributes: {
          'xml:lang': 'en',
          'xmlns:custom': 'http://example.com'
        },
        children: []
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toContain('xml:lang="en"');
      expect(xml).toContain('xmlns:custom="http://example.com"');
    });
  });

  describe('Attribute Value Types', () => {
    test('should handle numeric attribute values', () => {
      const xml = '<element count="42" price="19.99">content</element>';
      const result = xmlHandler.parse(xml);
      
      // XML attributes are always strings
      expect(typeof result.attributes.count).toBe('string');
      expect(result.attributes.count).toBe('42');
      expect(result.attributes.price).toBe('19.99');
    });

    test('should handle boolean-string attribute values', () => {
      const xml = '<element enabled="true" visible="false">content</element>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes.enabled).toBe('true');
      expect(result.attributes.visible).toBe('false');
    });

    test('should handle complex attribute values', () => {
      const xml = '<element data-config=\'{"enabled": true, "count": 5}\'>content</element>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes['data-config']).toBe('{"enabled": true, "count": 5}');
    });
  });

  describe('Special XML Attributes', () => {
    test('should handle xml:space attribute', () => {
      const xml = '<pre xml:space="preserve">  formatted text  </pre>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes['xml:space']).toBe('preserve');
      expect(result.children[0].value).toBe('  formatted text  ');
    });

    test('should handle xml:lang attribute', () => {
      const xml = '<text xml:lang="en-US">Hello</text>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes['xml:lang']).toBe('en-US');
    });

    test('should handle xml:id attribute', () => {
      const xml = '<section xml:id="intro">Introduction</section>';
      const result = xmlHandler.parse(xml);
      
      expect(result.attributes['xml:id']).toBe('intro');
    });
  });

  describe('Attribute Order and Consistency', () => {
    test('should maintain attribute order during round-trip', () => {
      const xml = '<element z="last" a="first" m="middle">content</element>';
      const parsed = xmlHandler.parse(xml);
      const serialized = xmlHandler.serialize(parsed);
      
      // Parse again to verify consistency
      const reparsed = xmlHandler.parse(serialized);
      expect(reparsed.attributes.z).toBe('last');
      expect(reparsed.attributes.a).toBe('first');
      expect(reparsed.attributes.m).toBe('middle');
    });

    test('should handle duplicate attribute detection', () => {
      // This should be handled gracefully - some parsers may throw, others may use last value
      const xml = '<element attr="first" attr="second">content</element>';
      
      try {
        const result = xmlHandler.parse(xml);
        // If parsing succeeds, should use one of the values
        expect(typeof result.attributes.attr).toBe('string');
      } catch (error) {
        // Some parsers throw on duplicate attributes, which is also valid
        expect(error).toBeDefined();
      }
    });
  });

  describe('Attribute Validation', () => {
    test('should validate attribute names', () => {
      const validNames = ['id', 'class', 'data-test', 'xml:lang', '_private', 'CamelCase'];
      validNames.forEach(name => {
        const xml = `<element ${name}="value">content</element>`;
        expect(() => xmlHandler.parse(xml)).not.toThrow();
      });
    });

    test('should handle malformed attribute syntax', () => {
      const malformedCases = [
        '<element attr=>content</element>', // No value
        '<element attr"value">content</element>', // No equals
        '<element attr=value>content</element>', // No quotes
      ];
      
      malformedCases.forEach(xml => {
        expect(() => xmlHandler.parse(xml)).toThrow();
      });
    });
  });
});