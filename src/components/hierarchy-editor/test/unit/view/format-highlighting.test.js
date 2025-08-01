/**
 * Format-Specific Highlighting Tests - Integration tests for highlighting different formats
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('Format-Specific Highlighting', () => {
  let container;
  let SourceView, SyntaxHighlighter;

  beforeEach(async () => {
    container = createTestContainer();
    
    // Import components
    const sourceViewModule = await import('../../../view/SourceView.js');
    const highlighterModule = await import('../../../view/SyntaxHighlighter.js');
    
    SourceView = sourceViewModule.SourceView;
    SyntaxHighlighter = highlighterModule.SyntaxHighlighter;
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('JSON Format Highlighting Integration', () => {
    test('should highlight JSON with proper token classification', () => {
      const content = `{
  "name": "John Doe",
  "age": 30,
  "active": true,
  "score": 95.5,
  "address": null,
  "hobbies": ["reading", "coding"],
  "settings": {
    "theme": "dark",
    "notifications": false
  }
}`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'json'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Check string highlighting
      expect(highlightedContent).toContain('json-string');
      
      // Check number highlighting
      expect(highlightedContent).toContain('json-number');
      
      // Check boolean highlighting
      expect(highlightedContent).toContain('json-boolean');
      
      // Check null highlighting
      expect(highlightedContent).toContain('json-null');
      
      // Check structure highlighting
      expect(highlightedContent).toContain('json-brace');
      expect(highlightedContent).toContain('json-bracket');
    });

    test('should handle JSON with complex nested structures', () => {
      const content = `{
  "users": [
    {
      "id": 1,
      "profile": {
        "name": "John",
        "contacts": {
          "email": "john@example.com",
          "phones": ["+1234567890", "+0987654321"]
        }
      }
    }
  ]
}`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'json'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Should handle deeply nested structures
      expect(highlightedContent).toContain('json-string');
      expect(highlightedContent).toContain('json-number');
      expect(highlightedContent).toContain('json-brace');
      expect(highlightedContent).toContain('json-bracket');
    });

    test('should highlight JSON with special characters', () => {
      const content = `{
  "escaped": "Line 1\\nLine 2\\tTabbed",
  "unicode": "Unicode: \\u0041\\u0042\\u0043",
  "quotes": "He said \\"Hello\\" to me",
  "backslashes": "Path: C:\\\\Users\\\\John"
}`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'json'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Should properly highlight escaped characters
      expect(highlightedContent).toContain('json-string');
      // Should not break on escape sequences
      expect(highlightedContent).not.toContain('undefined');
    });
  });

  describe('XML Format Highlighting Integration', () => {
    test('should highlight XML with tags, attributes, and content', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<root xmlns:ns="http://example.com">
  <!-- User configuration -->
  <user id="123" active="true">
    <name>John Doe</name>
    <email>john@example.com</email>
    <settings>
      <theme>dark</theme>
      <ns:preference value="enabled" />
    </settings>
    <![CDATA[
      Some raw content here
    ]]>
  </user>
</root>`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'xml'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Check XML declaration
      expect(highlightedContent).toContain('xml-declaration');
      
      // Check tag highlighting
      expect(highlightedContent).toContain('xml-tag');
      
      // Check attribute highlighting
      expect(highlightedContent).toContain('xml-attribute');
      expect(highlightedContent).toContain('xml-attribute-value');
      
      // Check text content
      expect(highlightedContent).toContain('xml-text');
      
      // Check comment highlighting
      expect(highlightedContent).toContain('xml-comment');
      
      // Check CDATA highlighting
      expect(highlightedContent).toContain('xml-cdata');
    });

    test('should handle XML namespaces correctly', () => {
      const content = `<root xmlns="http://default.com" xmlns:app="http://app.com">
  <app:user app:id="123">
    <app:name>John</app:name>
    <default-element>content</default-element>
  </app:user>
</root>`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'xml'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Should highlight namespaced elements
      expect(highlightedContent).toContain('xml-tag');
      expect(highlightedContent).toContain('xml-namespace');
      expect(highlightedContent).toContain('xml-attribute');
    });

    test('should handle self-closing XML tags', () => {
      const content = `<config>
  <setting name="debug" value="true" />
  <setting name="port" value="8080" />
  <empty-element/>
</config>`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'xml'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Should handle self-closing tags properly
      expect(highlightedContent).toContain('xml-tag');
      expect(highlightedContent).toContain('xml-self-closing');
    });
  });

  describe('YAML Format Highlighting Integration', () => {
    test('should highlight YAML with keys, values, and structures', () => {
      const content = `# Application Configuration
---
app:
  name: "My Application"
  version: 1.2.3
  debug: true
  features:
    - authentication
    - logging
    - monitoring

database:
  host: localhost
  port: 5432
  credentials:
    username: admin
    password: secret123

# Multi-document separator
---
other_config:
  setting: value
...`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'yaml'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Check comment highlighting
      expect(highlightedContent).toContain('yaml-comment');
      
      // Check document markers
      expect(highlightedContent).toContain('yaml-document-marker');
      
      // Check key highlighting
      expect(highlightedContent).toContain('yaml-key');
      
      // Check string highlighting
      expect(highlightedContent).toContain('yaml-string');
      
      // Check number highlighting
      expect(highlightedContent).toContain('yaml-number');
      
      // Check boolean highlighting
      expect(highlightedContent).toContain('yaml-boolean');
      
      // Check list highlighting
      expect(highlightedContent).toContain('yaml-list-marker');
    });

    test('should handle YAML with complex data types', () => {
      const content = `complex_data:
  timestamp: 2023-01-01T12:00:00Z
  null_value: null
  empty_string: ""
  multi_line: |
    This is a multi-line
    string with literal
    line breaks preserved
  folded_string: >
    This is a folded
    string where line
    breaks become spaces
  quoted_strings:
    single: 'Single quoted'
    double: "Double quoted"
    special: "String with \\"quotes\\" and \\n escapes"`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'yaml'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Should handle different string types
      expect(highlightedContent).toContain('yaml-string');
      expect(highlightedContent).toContain('yaml-literal');
      expect(highlightedContent).toContain('yaml-folded');
      
      // Should handle null values
      expect(highlightedContent).toContain('yaml-null');
      
      // Should handle timestamps and special formats
      expect(highlightedContent).toContain('yaml-timestamp');
    });

    test('should handle nested YAML structures', () => {
      const content = `services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:pass@db:5432/app
    volumes:
      - ./config:/etc/nginx/conf.d
      - web_data:/var/www/html
  
  database:
    image: postgres:13
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'yaml'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Should handle nested structures properly
      expect(highlightedContent).toContain('yaml-key');
      expect(highlightedContent).toContain('yaml-string');
      expect(highlightedContent).toContain('yaml-list-marker');
      expect(highlightedContent).toContain('yaml-number');
    });
  });

  describe('Markdown Format Highlighting Integration', () => {
    test('should highlight Markdown with all major features', () => {
      const content = `# Main Title

This is a paragraph with **bold text**, *italic text*, and \`inline code\`.

## Section Header

Here's a list:
- Item 1
- Item 2 with [a link](https://example.com)
- Item 3

### Subsection

> This is a blockquote
> with multiple lines

Here's a code block:

\`\`\`javascript
function example() {
  console.log("Hello, world!");
  return true;
}
\`\`\`

#### Table Example

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| More     | Data     | Here     |

---

![Image](image.jpg "Alt text")

- [ ] Todo item
- [x] Completed item`;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'markdown'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Check heading highlighting
      expect(highlightedContent).toContain('md-heading');
      expect(highlightedContent).toContain('md-h1');
      expect(highlightedContent).toContain('md-h2');
      expect(highlightedContent).toContain('md-h3');
      
      // Check emphasis highlighting
      expect(highlightedContent).toContain('md-bold');
      expect(highlightedContent).toContain('md-italic');
      
      // Check code highlighting
      expect(highlightedContent).toContain('md-inline-code');
      expect(highlightedContent).toContain('md-code-block');
      
      // Check list highlighting
      expect(highlightedContent).toContain('md-list-marker');
      
      // Check link highlighting
      expect(highlightedContent).toContain('md-link');
      
      // Check blockquote highlighting
      expect(highlightedContent).toContain('md-blockquote');
      
      // Check table highlighting
      expect(highlightedContent).toContain('md-table');
      
      // Check horizontal rule
      expect(highlightedContent).toContain('md-hr');
      
      // Check image highlighting
      expect(highlightedContent).toContain('md-image');
      
      // Check task list highlighting
      expect(highlightedContent).toContain('md-task-list');
    });

    test('should handle Markdown with embedded code languages', () => {
      const content = `# Code Examples

JavaScript:
\`\`\`javascript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

Python:
\`\`\`python
def greet():
    print("Hello, world!")
    return True
\`\`\`

JSON:
\`\`\`json
{
  "name": "example",
  "version": "1.0.0",
  "active": true
}
\`\`\`

XML:
\`\`\`xml
<config>
  <setting name="debug">true</setting>
</config>
\`\`\``;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'markdown'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Should detect code block languages
      expect(highlightedContent).toContain('md-code-block');
      expect(highlightedContent).toContain('language-javascript');
      expect(highlightedContent).toContain('language-python');
      expect(highlightedContent).toContain('language-json');
      expect(highlightedContent).toContain('language-xml');
    });

    test('should handle complex Markdown structures', () => {
      const content = `# Document

## Lists and Nesting

1. First item
   - Nested bullet
   - Another nested item
     1. Deeply nested number
     2. Another deep item
2. Second main item

## Links and References

This is [an example](http://example.com "Title") inline link.

[This link](http://example.net/) has no title attribute.

This is [an example][id] reference-style link.

[id]: http://example.com/ "Optional Title Here"

## Complex Formatting

Text with **bold _and italic_ text** combined.

Here's a \`complex code example\` with **bold**.

> Blockquote with **bold** and *italic*
> 
> - List in blockquote
> - Another item
>
> \`\`\`
> Code in blockquote
> \`\`\``;

      const sourceView = new SourceView(container, {
        content: content,
        format: 'markdown'
      });
      
      sourceView.render();
      
      const highlightedContent = container.innerHTML;
      
      // Should handle nested formatting
      expect(highlightedContent).toContain('md-heading');
      expect(highlightedContent).toContain('md-list-marker');
      expect(highlightedContent).toContain('md-link');
      expect(highlightedContent).toContain('md-bold');
      expect(highlightedContent).toContain('md-italic');
      expect(highlightedContent).toContain('md-blockquote');
      expect(highlightedContent).toContain('md-inline-code');
    });
  });

  describe('Cross-Format Highlighting Consistency', () => {
    test('should maintain consistent highlighting themes across formats', () => {
      const testCases = [
        { format: 'json', content: '{"test": true}' },
        { format: 'xml', content: '<test>true</test>' },
        { format: 'yaml', content: 'test: true' },
        { format: 'markdown', content: '# Test\n\nTrue.' }
      ];

      const sourceViews = testCases.map(({ format, content }) => {
        const view = new SourceView(createTestContainer(), {
          content: content,
          format: format,
          theme: 'dark'
        });
        view.render();
        return view;
      });

      // All should have theme class
      sourceViews.forEach((view, index) => {
        const container = view.dom;
        expect(container.querySelector('.theme-dark')).toBeTruthy();
        expect(container.querySelector(`.format-${testCases[index].format}`)).toBeTruthy();
      });

      // Clean up
      sourceViews.forEach(view => view.destroy());
    });

    test('should provide consistent API across all format highlighters', () => {
      const formats = ['json', 'xml', 'yaml', 'markdown'];
      
      formats.forEach(format => {
        const highlighter = new SyntaxHighlighter(format);
        
        // All should implement required methods
        expect(typeof highlighter.highlight).toBe('function');
        expect(typeof highlighter.isSupported).toBe('function');
        expect(highlighter.format).toBe(format);
        
        // All should handle empty content
        expect(highlighter.highlight('')).toBe('');
        
        // All should return boolean for isSupported
        expect(typeof highlighter.isSupported(format)).toBe('boolean');
      });
    });

    test('should handle format detection integration', () => {
      const testContent = [
        { content: '{"json": true}', expectedFormat: 'json' },
        { content: '<xml>true</xml>', expectedFormat: 'xml' },
        { content: 'yaml: true', expectedFormat: 'yaml' },
        { content: '# Markdown\n\nContent.', expectedFormat: 'markdown' }
      ];

      testContent.forEach(({ content, expectedFormat }) => {
        const sourceView = new SourceView(createTestContainer(), {
          content: content,
          format: 'auto' // Auto-detect format
        });
        
        sourceView.render();
        
        // Should detect and apply correct format
        expect(sourceView.dom.querySelector(`.format-${expectedFormat}`)).toBeTruthy();
        
        sourceView.destroy();
      });
    });
  });
});