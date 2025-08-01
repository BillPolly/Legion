/**
 * Markdown Serialization Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('Markdown Serialization', () => {
  let MarkdownHandler;
  let markdownHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/MarkdownHandler.js');
    MarkdownHandler = module.MarkdownHandler;
    markdownHandler = new MarkdownHandler();
  });

  describe('Heading Serialization', () => {
    test('should serialize heading hierarchy', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Main Title',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: 'Content under main title.'
              },
              {
                type: 'heading',
                name: 'Section 1',
                metadata: { level: 2 },
                children: [
                  {
                    type: 'content',
                    name: 'content-2',
                    value: 'Section 1 content.'
                  }
                ]
              },
              {
                type: 'heading',
                name: 'Section 2',
                metadata: { level: 2 },
                children: [
                  {
                    type: 'content',
                    name: 'content-3',
                    value: 'Section 2 content.'
                  }
                ]
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# Main Title');
      expect(markdown).toContain('Content under main title.');
      expect(markdown).toContain('## Section 1');
      expect(markdown).toContain('Section 1 content.');
      expect(markdown).toContain('## Section 2');
      expect(markdown).toContain('Section 2 content.');
    });

    test('should serialize all heading levels', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'H1 Heading',
            metadata: { level: 1 },
            children: [
              {
                type: 'heading',
                name: 'H2 Heading',
                metadata: { level: 2 },
                children: [
                  {
                    type: 'heading',
                    name: 'H3 Heading',
                    metadata: { level: 3 },
                    children: [
                      {
                        type: 'heading',
                        name: 'H4 Heading',
                        metadata: { level: 4 },
                        children: [
                          {
                            type: 'heading',
                            name: 'H5 Heading',
                            metadata: { level: 5 },
                            children: [
                              {
                                type: 'heading',
                                name: 'H6 Heading',
                                metadata: { level: 6 },
                                children: []
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# H1 Heading');
      expect(markdown).toContain('## H2 Heading');
      expect(markdown).toContain('### H3 Heading');
      expect(markdown).toContain('#### H4 Heading');
      expect(markdown).toContain('##### H5 Heading');
      expect(markdown).toContain('###### H6 Heading');
    });

    test('should serialize multiple top-level headings', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Chapter 1',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: 'Chapter 1 content.'
              }
            ]
          },
          {
            type: 'heading',
            name: 'Chapter 2',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-2',
                value: 'Chapter 2 content.'
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# Chapter 1');
      expect(markdown).toContain('Chapter 1 content.');
      expect(markdown).toContain('# Chapter 2');
      expect(markdown).toContain('Chapter 2 content.');
    });
  });

  describe('Content Serialization', () => {
    test('should serialize plain text content', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Section',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: 'This is a paragraph of text.\n\nThis is another paragraph.'
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# Section');
      expect(markdown).toContain('This is a paragraph of text.');
      expect(markdown).toContain('This is another paragraph.');
    });

    test('should serialize list content', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Lists',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: '- Item 1\n- Item 2\n- Item 3',
                metadata: { type: 'list' }
              },
              {
                type: 'content',
                name: 'content-2',
                value: '1. First\n2. Second\n3. Third',
                metadata: { type: 'list' }
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# Lists');
      expect(markdown).toContain('- Item 1');
      expect(markdown).toContain('- Item 2');
      expect(markdown).toContain('- Item 3');
      expect(markdown).toContain('1. First');
      expect(markdown).toContain('2. Second');
      expect(markdown).toContain('3. Third');
    });

    test('should serialize code blocks', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Code Example',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: 'function hello() {\n  console.log("Hello, world!");\n}',
                metadata: { type: 'code', language: 'javascript' }
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# Code Example');
      expect(markdown).toContain('```javascript');
      expect(markdown).toContain('function hello() {');
      expect(markdown).toContain('console.log("Hello, world!");');
      expect(markdown).toContain('```');
    });

    test('should serialize blockquotes', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Quotes',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: 'This is a blockquote.\nIt spans multiple lines.',
                metadata: { type: 'blockquote' }
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# Quotes');
      expect(markdown).toContain('> This is a blockquote.');
      expect(markdown).toContain('> It spans multiple lines.');
    });
  });

  describe('Document Structure Serialization', () => {
    test('should serialize complex document structure', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'API Documentation',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: 'This API provides access to user data.'
              },
              {
                type: 'heading',
                name: 'Authentication',
                metadata: { level: 2 },
                children: [
                  {
                    type: 'content',
                    name: 'content-2',
                    value: 'All requests require an API key.'
                  },
                  {
                    type: 'heading',
                    name: 'Getting an API key',
                    metadata: { level: 3 },
                    children: [
                      {
                        type: 'content',
                        name: 'content-3',
                        value: '1. Register for an account\n2. Go to your dashboard\n3. Generate a new key'
                      }
                    ]
                  }
                ]
              },
              {
                type: 'heading',
                name: 'Endpoints',
                metadata: { level: 2 },
                children: [
                  {
                    type: 'heading',
                    name: 'Users',
                    metadata: { level: 3 },
                    children: [
                      {
                        type: 'heading',
                        name: 'GET /users',
                        metadata: { level: 4 },
                        children: [
                          {
                            type: 'content',
                            name: 'content-4',
                            value: 'Returns a list of users.'
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# API Documentation');
      expect(markdown).toContain('This API provides access to user data.');
      expect(markdown).toContain('## Authentication');
      expect(markdown).toContain('All requests require an API key.');
      expect(markdown).toContain('### Getting an API key');
      expect(markdown).toContain('1. Register for an account');
      expect(markdown).toContain('## Endpoints');
      expect(markdown).toContain('### Users');
      expect(markdown).toContain('#### GET /users');
      expect(markdown).toContain('Returns a list of users.');
    });

    test('should serialize mixed content types', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Mixed Content',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: 'Regular paragraph text.'
              },
              {
                type: 'content',
                name: 'content-2',
                value: '- List item 1\n- List item 2',
                metadata: { type: 'list' }
              },
              {
                type: 'content',
                name: 'content-3',
                value: 'console.log("code");',
                metadata: { type: 'code', language: 'javascript' }
              },
              {
                type: 'content',
                name: 'content-4',
                value: 'This is quoted text.',
                metadata: { type: 'blockquote' }
              },
              {
                type: 'heading',
                name: 'Subsection',
                metadata: { level: 2 },
                children: [
                  {
                    type: 'content',
                    name: 'content-5',
                    value: 'Subsection content.'
                  }
                ]
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# Mixed Content');
      expect(markdown).toContain('Regular paragraph text.');
      expect(markdown).toContain('- List item 1');
      expect(markdown).toContain('```javascript');
      expect(markdown).toContain('console.log("code");');
      expect(markdown).toContain('> This is quoted text.');
      expect(markdown).toContain('## Subsection');
      expect(markdown).toContain('Subsection content.');
    });
  });

  describe('Special Characters and Formatting', () => {
    test('should handle headings with special characters', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Special Characters: *bold* and _italic_',
            metadata: { level: 1 },
            children: []
          },
          {
            type: 'heading',
            name: 'Section with "quotes" and \'apostrophes\'',
            metadata: { level: 2 },
            children: []
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# Special Characters: *bold* and _italic_');
      expect(markdown).toContain('## Section with "quotes" and \'apostrophes\'');
    });

    test('should preserve markdown formatting in content', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Formatted Content',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: 'This text has **bold** and *italic* formatting.\n\nAlso some `inline code` and [links](http://example.com).'
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('**bold**');
      expect(markdown).toContain('*italic*');
      expect(markdown).toContain('`inline code`');
      expect(markdown).toContain('[links](http://example.com)');
    });

    test('should handle empty headings and content', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'Empty Section',
            metadata: { level: 1 },
            children: []
          },
          {
            type: 'heading',
            name: 'Section with Empty Content',
            metadata: { level: 1 },
            children: [
              {
                type: 'content',
                name: 'content-1',
                value: ''
              }
            ]
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      expect(markdown).toContain('# Empty Section');
      expect(markdown).toContain('# Section with Empty Content');
    });
  });

  describe('Round-trip Serialization', () => {
    test('should maintain structure through parse-serialize cycle', () => {
      const originalMarkdown = `
# Main Document

This is the introduction.

## First Section

Content for the first section.

### Subsection A

- Item 1
- Item 2
- Item 3

### Subsection B

Here's some code:

\`\`\`javascript
function example() {
  return "Hello, world!";
}
\`\`\`

## Second Section

> This is a blockquote
> with multiple lines.

Final paragraph.
      `.trim();
      
      const parsed = markdownHandler.parse(originalMarkdown);
      const serialized = markdownHandler.serialize(parsed);
      const reparsed = markdownHandler.parse(serialized);
      
      expect(reparsed.type).toBe('document');
      expect(reparsed.children).toHaveLength(1);
      
      const mainDoc = reparsed.children[0];
      expect(mainDoc.name).toBe('Main Document');
      expect(mainDoc.metadata.level).toBe(1);
      
      const firstSection = mainDoc.children.find(child => child.name === 'First Section');
      expect(firstSection).toBeDefined();
      expect(firstSection.metadata.level).toBe(2);
      
      const subsectionA = firstSection.children.find(child => child.name === 'Subsection A');
      expect(subsectionA).toBeDefined();
      expect(subsectionA.metadata.level).toBe(3);
      
      const secondSection = mainDoc.children.find(child => child.name === 'Second Section');
      expect(secondSection).toBeDefined();
      expect(secondSection.metadata.level).toBe(2);
    });

    test('should preserve content formatting through round-trip', () => {
      const originalMarkdown = `
# Code and Quotes

Here's a list:
- First item
- Second item

And a code block:

\`\`\`python
def hello():
    print("Hello!")
\`\`\`

> Quote: "The best code is no code."

Regular paragraph at the end.
      `.trim();
      
      const parsed = markdownHandler.parse(originalMarkdown);
      const serialized = markdownHandler.serialize(parsed);
      
      expect(serialized).toContain('# Code and Quotes');
      expect(serialized).toContain('- First item');
      expect(serialized).toContain('- Second item');
      expect(serialized).toContain('```python');
      expect(serialized).toContain('def hello():');
      expect(serialized).toContain('print("Hello!")');
      expect(serialized).toContain('> Quote: "The best code is no code."');
      expect(serialized).toContain('Regular paragraph at the end.');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid node structure', () => {
      const invalidNode = {
        type: 'unknown',
        children: []
      };
      
      expect(() => markdownHandler.serialize(invalidNode)).toThrow();
    });

    test('should handle missing metadata', () => {
      const node = {
        type: 'document',
        children: [
          {
            type: 'heading',
            name: 'No Metadata',
            children: []
            // Missing metadata with level
          }
        ]
      };
      
      const markdown = markdownHandler.serialize(node);
      
      // Should default to level 1
      expect(markdown).toContain('# No Metadata');
    });

    test('should handle circular references', () => {
      const parent = {
        type: 'document',
        children: []
      };
      
      const child = {
        type: 'heading',
        name: 'Child',
        metadata: { level: 1 },
        children: [parent] // Circular reference
      };
      
      parent.children = [child];
      
      expect(() => markdownHandler.serialize(parent)).toThrow();
    });
  });
});