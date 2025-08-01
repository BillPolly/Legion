/**
 * XML Serialization Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('XML Serialization', () => {
  let XmlHandler;
  let xmlHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/XmlHandler.js');
    XmlHandler = module.XmlHandler;
    xmlHandler = new XmlHandler();
  });

  describe('Basic Element Serialization', () => {
    test('should serialize simple element', () => {
      const node = {
        type: 'element',
        name: 'root',
        attributes: {},
        children: [
          { type: 'text', value: 'content' }
        ]
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toBe('<root>content</root>');
    });

    test('should serialize self-closing element', () => {
      const node = {
        type: 'element',
        name: 'br',
        attributes: {},
        children: []
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toBe('<br />');
    });

    test('should serialize element with attributes', () => {
      const node = {
        type: 'element',
        name: 'input',
        attributes: {
          type: 'text',
          id: 'username',
          required: 'true'
        },
        children: []
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toContain('<input');
      expect(xml).toContain('type="text"');
      expect(xml).toContain('id="username"');
      expect(xml).toContain('required="true"');
      expect(xml).toContain(' />');
    });

    test('should serialize nested elements', () => {
      const node = {
        type: 'element',
        name: 'div',
        attributes: { class: 'container' },
        children: [
          {
            type: 'element',
            name: 'h1',
            attributes: {},
            children: [{ type: 'text', value: 'Title' }]
          },
          {
            type: 'element',
            name: 'p',
            attributes: {},
            children: [{ type: 'text', value: 'Paragraph' }]
          }
        ]
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toContain('<div class="container">');
      expect(xml).toContain('<h1>Title</h1>');
      expect(xml).toContain('<p>Paragraph</p>');
      expect(xml).toContain('</div>');
    });
  });

  describe('Text Content Serialization', () => {
    test('should serialize text nodes', () => {
      const node = {
        type: 'text',
        value: 'Simple text content'
      };
      
      const xml = xmlHandler.serializeTextNode(node);
      expect(xml).toBe('Simple text content');
    });

    test('should escape special characters in text', () => {
      const node = {
        type: 'text',
        value: 'Text with <tags> & "quotes"'
      };
      
      const xml = xmlHandler.serializeTextNode(node);
      expect(xml).toBe('Text with &lt;tags&gt; &amp; "quotes"');
    });

    test('should serialize CDATA sections', () => {
      const node = {
        type: 'cdata',
        value: 'Raw content with <tags> & special chars'
      };
      
      const xml = xmlHandler.serializeTextNode(node);
      expect(xml).toBe('<![CDATA[Raw content with <tags> & special chars]]>');
    });

    test('should serialize mixed content', () => {
      const node = {
        type: 'element',
        name: 'p',
        attributes: {},
        children: [
          { type: 'text', value: 'This is ' },
          {
            type: 'element',
            name: 'strong',
            attributes: {},
            children: [{ type: 'text', value: 'bold' }]
          },
          { type: 'text', value: ' text.' }
        ]
      };
      
      const xml = xmlHandler.serialize(node, { compact: true });
      expect(xml).toBe('<p>This is <strong>bold</strong> text.</p>');
    });
  });

  describe('Attribute Serialization', () => {
    test('should serialize attributes with proper escaping', () => {
      const node = {
        type: 'element',
        name: 'link',
        attributes: {
          href: 'http://example.com?param=value&other=test',
          title: 'Title with "quotes" & ampersands'
        },
        children: []
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toContain('href="http://example.com?param=value&amp;other=test"');
      expect(xml).toContain('title="Title with &quot;quotes&quot; &amp; ampersands"');
    });

    test('should handle empty attributes', () => {
      const node = {
        type: 'element',
        name: 'input',
        attributes: {
          type: 'checkbox',
          checked: '',
          disabled: 'disabled'
        },
        children: []
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toContain('checked=""');
      expect(xml).toContain('disabled="disabled"');
    });

    test('should serialize namespace attributes', () => {
      const node = {
        type: 'element',
        name: 'root',
        attributes: {
          'xmlns': 'http://example.com',
          'xmlns:custom': 'http://custom.com',
          'xml:lang': 'en'
        },
        children: []
      };
      
      const xml = xmlHandler.serialize(node);
      expect(xml).toContain('xmlns="http://example.com"');
      expect(xml).toContain('xmlns:custom="http://custom.com"');
      expect(xml).toContain('xml:lang="en"');
    });
  });

  describe('Comment and Processing Instruction Serialization', () => {
    test('should serialize XML comments', () => {
      const node = {
        type: 'comment',
        value: ' This is a comment '
      };
      
      const xml = xmlHandler.serializeComment(node);
      expect(xml).toBe('<!-- This is a comment -->');
    });

    test('should serialize processing instructions', () => {
      const node = {
        type: 'processingInstruction',
        name: 'xml-stylesheet',
        value: 'type="text/xsl" href="style.xsl"'
      };
      
      const xml = xmlHandler.serializeProcessingInstruction(node);
      expect(xml).toBe('<?xml-stylesheet type="text/xsl" href="style.xsl"?>');
    });

    test('should serialize XML declaration', () => {
      const node = {
        type: 'processingInstruction',
        name: 'xml',
        value: 'version="1.0" encoding="UTF-8"'
      };
      
      const xml = xmlHandler.serializeProcessingInstruction(node);
      expect(xml).toBe('<?xml version="1.0" encoding="UTF-8"?>');
    });
  });

  describe('Formatting and Indentation', () => {
    test('should serialize with proper indentation', () => {
      const node = {
        type: 'element',
        name: 'root',
        attributes: {},
        children: [
          {
            type: 'element',
            name: 'child1',
            attributes: {},
            children: [{ type: 'text', value: 'content1' }]
          },
          {
            type: 'element',
            name: 'child2',
            attributes: {},
            children: [
              {
                type: 'element',
                name: 'nested',
                attributes: {},
                children: [{ type: 'text', value: 'nested content' }]
              }
            ]
          }
        ]
      };
      
      const xml = xmlHandler.serialize(node, { indent: '  ' });
      expect(xml).toContain('  <child1>');
      expect(xml).toContain('    <nested>');
      expect(xml).toContain('  </child2>');
    });

    test('should serialize compact without indentation', () => {
      const node = {
        type: 'element',
        name: 'root',
        attributes: {},
        children: [
          {
            type: 'element',
            name: 'child',
            attributes: {},
            children: [{ type: 'text', value: 'content' }]
          }
        ]
      };
      
      const xml = xmlHandler.serialize(node, { compact: true });
      expect(xml).toBe('<root><child>content</child></root>');
    });
  });

  describe('Round-trip Serialization', () => {
    test('should maintain structure through parse-serialize cycle', () => {
      const originalXml = '<root id="test"><child attr="value">content</child></root>';
      const parsed = xmlHandler.parse(originalXml);
      const serialized = xmlHandler.serialize(parsed, { compact: true });
      const reparsed = xmlHandler.parse(serialized);
      
      expect(reparsed.name).toBe('root');
      expect(reparsed.attributes.id).toBe('test');
      
      const childElement = reparsed.children.find(child => child.type === 'element');
      expect(childElement.name).toBe('child');
      expect(childElement.attributes.attr).toBe('value');
      expect(childElement.children[0].value).toBe('content');
    });

    test('should maintain complex structure with mixed content', () => {
      const originalXml = `
        <article>
          <title>Article Title</title>
          <p>This is <em>emphasized</em> text with <a href="http://example.com">links</a>.</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </article>
      `;
      
      const parsed = xmlHandler.parse(originalXml);
      const serialized = xmlHandler.serialize(parsed);
      const reparsed = xmlHandler.parse(serialized);
      
      expect(reparsed.name).toBe('article');
      
      const title = reparsed.children.find(child => child.name === 'title');
      expect(title).toBeDefined();
      expect(title.children[0].value).toBe('Article Title');
      
      const ul = reparsed.children.find(child => child.name === 'ul');
      expect(ul).toBeDefined();
      expect(ul.children.filter(child => child.name === 'li')).toHaveLength(2);
    });

    test('should maintain CDATA and comments through round-trip', () => {
      const originalXml = `
        <root>
          <!-- This is a comment -->
          <script><![CDATA[
            function test() {
              return x < y && a > b;
            }
          ]]></script>
        </root>
      `;
      
      const parsed = xmlHandler.parse(originalXml);
      const serialized = xmlHandler.serialize(parsed);
      const reparsed = xmlHandler.parse(serialized);
      
      const comment = reparsed.children.find(child => child.type === 'comment');
      expect(comment).toBeDefined();
      
      const script = reparsed.children.find(child => child.name === 'script');
      expect(script).toBeDefined();
      const cdata = script.children.find(child => child.type === 'cdata');
      expect(cdata).toBeDefined();
      expect(cdata.value).toContain('function test()');
    });
  });

  describe('Error Handling in Serialization', () => {
    test('should handle missing node type', () => {
      const node = {
        name: 'test',
        children: []
      };
      
      expect(() => xmlHandler.serialize(node)).toThrow();
    });

    test('should handle invalid element names', () => {
      const node = {
        type: 'element',
        name: '123invalid',
        attributes: {},
        children: []
      };
      
      expect(() => xmlHandler.serialize(node)).toThrow();
    });

    test('should handle circular references', () => {
      const parent = {
        type: 'element',
        name: 'parent',
        attributes: {},
        children: []
      };
      
      const child = {
        type: 'element',
        name: 'child',
        attributes: {},
        children: [parent] // Circular reference
      };
      
      parent.children = [child];
      
      expect(() => xmlHandler.serialize(parent)).toThrow();
    });
  });
});