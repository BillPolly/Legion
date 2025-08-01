import { describe, test, expect, beforeEach } from '@jest/globals';
import { JsonParser } from '../src/components/tree-scribe/features/parsing/parsers/JsonParser.js';
import { MarkdownParser } from '../src/components/tree-scribe/features/parsing/parsers/MarkdownParser.js';

describe('JsonParser', () => {
  let parser;

  beforeEach(() => {
    parser = new JsonParser();
  });

  test('follows BaseParser interface', () => {
    expect(parser.getName()).toBe('JsonParser');
    expect(parser.getSupportedFormats()).toEqual(['json']);
  });

  test('can parse valid JSON object', () => {
    const content = '{"title": "Test", "value": 42, "nested": {"key": "value"}}';
    expect(parser.canParse(content)).toBeGreaterThan(0.8);
    
    const result = parser.parse(content);
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('title', 'Root');
    expect(result).toHaveProperty('children');
    expect(result.children).toHaveLength(3);
  });

  test('can parse JSON array', () => {
    const content = '[1, 2, {"name": "item"}, [4, 5]]';
    expect(parser.canParse(content)).toBeGreaterThan(0.8);
    
    const result = parser.parse(content);
    expect(result.title).toBe('Array');
    expect(result.children).toHaveLength(4);
    expect(result.children[0].title).toBe('[0]');
    expect(result.children[2].title).toBe('[2]');
  });

  test('handles nested structures', () => {
    const content = JSON.stringify({
      users: [
        { name: 'Alice', roles: ['admin', 'user'] },
        { name: 'Bob', roles: ['user'] }
      ],
      settings: {
        theme: 'dark',
        features: { search: true, export: false }
      }
    });
    
    const result = parser.parse(content);
    const users = result.children.find(c => c.title === 'users');
    expect(users.children).toHaveLength(2);
    
    const settings = result.children.find(c => c.title === 'settings');
    const features = settings.children.find(c => c.title === 'features');
    expect(features.children).toHaveLength(2);
  });

  test('preserves content for leaf nodes', () => {
    const content = '{"name": "Test", "count": 42, "active": true}';
    const result = parser.parse(content);
    
    const nameNode = result.children.find(c => c.title === 'name');
    expect(nameNode.content).toBe('"Test"');
    
    const countNode = result.children.find(c => c.title === 'count');
    expect(countNode.content).toBe('42');
    
    const activeNode = result.children.find(c => c.title === 'active');
    expect(activeNode.content).toBe('true');
  });

  test('rejects invalid JSON', () => {
    expect(parser.canParse('{invalid json}')).toBeLessThan(0.5);
    expect(parser.canParse('not json at all')).toBeLessThan(0.5);
  });

  test('handles empty objects and arrays', () => {
    const emptyObj = parser.parse('{}');
    expect(emptyObj.title).toBe('Empty Object');
    expect(emptyObj.children).toHaveLength(0);
    
    const emptyArr = parser.parse('[]');
    expect(emptyArr.title).toBe('Empty Array');
    expect(emptyArr.children).toHaveLength(0);
  });

  test('respects maxDepth option', () => {
    const deepContent = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: 'too deep'
            }
          }
        }
      }
    };
    
    const result = parser.parse(JSON.stringify(deepContent), { maxDepth: 3 });
    const level1 = result.children[0];
    const level2 = level1.children[0];
    const level3 = level2.children[0];
    
    expect(level3.children).toHaveLength(0);
    expect(level3.content).toContain('level4');
  });

  test('provides parser capabilities', () => {
    const capabilities = parser.getCapabilities();
    expect(capabilities).toHaveProperty('maxDepth');
    expect(capabilities).toHaveProperty('preserveArrayIndices');
    expect(capabilities).toHaveProperty('flattenSingleProperty');
  });
});

describe('MarkdownParser', () => {
  let parser;

  beforeEach(() => {
    parser = new MarkdownParser();
  });

  test('follows BaseParser interface', () => {
    expect(parser.getName()).toBe('MarkdownParser');
    expect(parser.getSupportedFormats()).toEqual(['markdown', 'md', 'mdown', 'mkd']);
  });

  test('can parse markdown with headers', () => {
    const content = `# Main Title

Some content here.

## Section 1

Content for section 1.

### Subsection 1.1

Details here.

## Section 2

Content for section 2.`;

    expect(parser.canParse(content)).toBeGreaterThan(0.8);
    
    const result = parser.parse(content);
    expect(result.title).toBe('Main Title');
    expect(result.content).toContain('Some content here.');
    expect(result.children).toHaveLength(2);
    
    const section1 = result.children[0];
    expect(section1.title).toBe('Section 1');
    expect(section1.children).toHaveLength(1);
    expect(section1.children[0].title).toBe('Subsection 1.1');
  });

  test('handles different header levels', () => {
    const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

    const result = parser.parse(content);
    expect(result.title).toBe('H1');
    expect(result.children[0].title).toBe('H2');
    expect(result.children[0].children[0].title).toBe('H3');
  });

  test('preserves markdown formatting in content', () => {
    const content = `# Title

This has **bold** and *italic* text.

- List item 1
- List item 2

\`\`\`javascript
const code = "example";
\`\`\``;

    const result = parser.parse(content);
    expect(result.content).toContain('**bold**');
    expect(result.content).toContain('*italic*');
    expect(result.content).toContain('- List item 1');
    expect(result.content).toContain('```javascript');
  });

  test('handles YAML frontmatter', () => {
    const content = `---
title: Document Title
author: Test Author
tags: [test, demo]
---

# Main Content

This is the document body.`;

    const result = parser.parse(content);
    expect(result.metadata).toEqual({
      title: 'Document Title',
      author: 'Test Author',
      tags: ['test', 'demo']
    });
    expect(result.title).toBe('Main Content');
  });

  test('creates document node when no headers exist', () => {
    const content = `Just some plain text content
without any headers.`;

    const result = parser.parse(content);
    expect(result.title).toBe('Document');
    expect(result.content).toContain('Just some plain text');
    expect(result.children).toHaveLength(0);
  });

  test('handles empty content between headers', () => {
    const content = `# Title 1
## Empty Section
## Section with Content
Some content here.`;

    const result = parser.parse(content);
    const emptySection = result.children[0];
    expect(emptySection.title).toBe('Empty Section');
    expect(emptySection.content).toBe('');
  });

  test('rejects non-markdown content', () => {
    expect(parser.canParse('{"json": true}')).toBeLessThan(0.5);
    expect(parser.canParse('<html><body></body></html>')).toBeLessThan(0.5);
  });

  test('handles code blocks with headers', () => {
    const content = `# Title

\`\`\`markdown
# This is inside a code block
## Should not be parsed as headers
\`\`\`

## Real Section`;

    const result = parser.parse(content);
    expect(result.children).toHaveLength(1);
    expect(result.children[0].title).toBe('Real Section');
    expect(result.content).toContain('# This is inside a code block');
  });

  test('provides parser capabilities', () => {
    const capabilities = parser.getCapabilities();
    expect(capabilities).toHaveProperty('extractFrontmatter');
    expect(capabilities).toHaveProperty('preserveFormatting');
    expect(capabilities).toHaveProperty('headerLevels');
  });

  test('handles mixed header levels correctly', () => {
    const content = `# Level 1
### Level 3 (skipped 2)
## Level 2
#### Level 4 under 2`;

    const result = parser.parse(content);
    expect(result.children).toHaveLength(2);
    expect(result.children[0].title).toBe('Level 3 (skipped 2)');
    expect(result.children[1].title).toBe('Level 2');
    expect(result.children[1].children[0].title).toBe('Level 4 under 2');
  });
});