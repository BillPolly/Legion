/**
 * Markdown Parser Tests
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('Markdown Parser', () => {
  let MarkdownHandler;
  let markdownHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/MarkdownHandler.js');
    MarkdownHandler = module.MarkdownHandler;
    markdownHandler = new MarkdownHandler();
  });

  describe('Basic Markdown Parsing', () => {
    test('should parse headings hierarchy', () => {
      const markdown = `
# Main Title
Some content under main title.

## Section 1
Content for section 1.

### Subsection 1.1
Subsection content.

### Subsection 1.2
More subsection content.

## Section 2
Content for section 2.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      expect(result).toBeDefined();
      expect(result.type).toBe('document');
      expect(result.children).toHaveLength(1); // Main title
      
      const mainTitle = result.children[0];
      expect(mainTitle.type).toBe('heading');
      expect(mainTitle.name).toBe('Main Title');
      expect(mainTitle.metadata.level).toBe(1);
      expect(mainTitle.children).toHaveLength(3); // content + 2 sections
    });

    test('should parse simple document structure', () => {
      const markdown = `
# Document Title

This is a paragraph of text.

## Section Header

Another paragraph with some content.

- List item 1
- List item 2
- List item 3
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      expect(result.type).toBe('document');
      expect(result.children).toHaveLength(1);
      
      const docTitle = result.children[0];
      expect(docTitle.type).toBe('heading');
      expect(docTitle.name).toBe('Document Title');
      expect(docTitle.children.length).toBeGreaterThanOrEqual(2); // paragraph + section
    });

    test('should parse multiple top-level headings', () => {
      const markdown = `
# First Chapter
Content of first chapter.

# Second Chapter
Content of second chapter.

# Third Chapter
Content of third chapter.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      expect(result.children).toHaveLength(3);
      expect(result.children[0].name).toBe('First Chapter');
      expect(result.children[1].name).toBe('Second Chapter');
      expect(result.children[2].name).toBe('Third Chapter');
      
      result.children.forEach(chapter => {
        expect(chapter.type).toBe('heading');
        expect(chapter.metadata.level).toBe(1);
      });
    });
  });

  describe('Heading Hierarchy', () => {
    test('should create proper parent-child relationships', () => {
      const markdown = `
# Level 1
Content at level 1.

## Level 2A
Content at level 2A.

### Level 3A
Content at level 3A.

### Level 3B
Content at level 3B.

## Level 2B
Content at level 2B.

### Level 3C
Content at level 3C.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      const level1 = result.children[0];
      expect(level1.name).toBe('Level 1');
      expect(level1.children.length).toBeGreaterThanOrEqual(3); // content + 2 level2 sections
      
      const level2A = level1.children.find(child => child.name === 'Level 2A');
      expect(level2A).toBeDefined();
      expect(level2A.type).toBe('heading');
      expect(level2A.metadata.level).toBe(2);
      
      const level3A = level2A.children.find(child => child.name === 'Level 3A');
      expect(level3A).toBeDefined();
      expect(level3A.metadata.level).toBe(3);
    });

    test('should handle skipped heading levels', () => {
      const markdown = `
# Level 1
Content at level 1.

### Level 3 (skipped level 2)
Content at level 3.

## Level 2 (back to level 2)
Content at level 2.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      const level1 = result.children[0];
      expect(level1.children.length).toBeGreaterThanOrEqual(2);
      
      const level3 = level1.children.find(child => child.name === 'Level 3 (skipped level 2)');
      expect(level3).toBeDefined();
      expect(level3.metadata.level).toBe(3);
      
      const level2 = level1.children.find(child => child.name === 'Level 2 (back to level 2)');
      expect(level2).toBeDefined();
      expect(level2.metadata.level).toBe(2);
    });

    test('should handle alternate heading syntax', () => {
      const markdown = `
Main Title
==========

Subtitle
--------

# Regular H1

## Regular H2
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      expect(result.children).toHaveLength(2); // Main Title + Regular H1
      
      const mainTitle = result.children[0];
      expect(mainTitle.name).toBe('Main Title');
      expect(mainTitle.metadata.level).toBe(1);
      
      const subtitle = mainTitle.children.find(child => child.name === 'Subtitle');
      expect(subtitle).toBeDefined();
      expect(subtitle.metadata.level).toBe(2);
    });
  });

  describe('Content Parsing', () => {
    test('should parse paragraphs as content', () => {
      const markdown = `
# Heading
This is a paragraph of text.

This is another paragraph.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      const heading = result.children[0];
      const contentNodes = heading.children.filter(child => child.type === 'content');
      expect(contentNodes.length).toBeGreaterThanOrEqual(1);
      
      const firstContent = contentNodes[0];
      expect(firstContent.value).toContain('This is a paragraph of text.');
    });

    test('should parse lists as content', () => {
      const markdown = `
# Shopping List

- Apples
- Bananas
- Oranges

1. First item
2. Second item
3. Third item
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      const heading = result.children[0];
      const contentNodes = heading.children.filter(child => child.type === 'content');
      expect(contentNodes.length).toBeGreaterThanOrEqual(1);
      
      const content = contentNodes.find(node => node.value.includes('- Apples'));
      expect(content).toBeDefined();
    });

    test('should parse code blocks as content', () => {
      const markdown = `
# Code Example

Here's some JavaScript:

\`\`\`javascript
function hello() {
  console.log('Hello, world!');
}
\`\`\`

And some inline \`code\` too.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      const heading = result.children[0];
      const contentNodes = heading.children.filter(child => child.type === 'content');
      
      const codeBlock = contentNodes.find(node => node.value.includes('function hello()'));
      expect(codeBlock).toBeDefined();
      expect(codeBlock.metadata.type).toBe('code');
    });

    test('should parse blockquotes as content', () => {
      const markdown = `
# Quotes

> This is a blockquote.
> It can span multiple lines.

Regular paragraph after quote.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      const heading = result.children[0];
      const contentNodes = heading.children.filter(child => child.type === 'content');
      
      const quote = contentNodes.find(node => node.value.includes('> This is a blockquote'));
      expect(quote).toBeDefined();
      expect(quote.metadata.type).toBe('blockquote');
    });
  });

  describe('Complex Document Structure', () => {
    test('should parse real-world documentation', () => {
      const markdown = `
# API Documentation

## Overview
This API provides access to user data.

## Authentication
All requests require an API key.

### Getting an API key
1. Register for an account
2. Go to your dashboard
3. Generate a new key

### Using the API key
Include it in the \`Authorization\` header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Endpoints

### Users

#### GET /users
Returns a list of users.

**Parameters:**
- \`limit\`: Maximum number of results
- \`offset\`: Starting position

#### POST /users
Creates a new user.

### Posts

#### GET /posts
Returns a list of posts.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      expect(result.type).toBe('document');
      expect(result.children).toHaveLength(1);
      
      const apiDoc = result.children[0];
      expect(apiDoc.name).toBe('API Documentation');
      expect(apiDoc.children.length).toBeGreaterThanOrEqual(3); // Overview, Authentication, Endpoints
      
      const overview = apiDoc.children.find(child => child.name === 'Overview');
      expect(overview).toBeDefined();
      expect(overview.metadata.level).toBe(2);
      
      const auth = apiDoc.children.find(child => child.name === 'Authentication');
      expect(auth).toBeDefined();
      
      const gettingKey = auth.children.find(child => child.name === 'Getting an API key');
      expect(gettingKey).toBeDefined();
      expect(gettingKey.metadata.level).toBe(3);
      
      const endpoints = apiDoc.children.find(child => child.name === 'Endpoints');
      expect(endpoints).toBeDefined();
      
      const users = endpoints.children.find(child => child.name === 'Users');
      expect(users).toBeDefined();
      expect(users.metadata.level).toBe(3);
    });

    test('should handle mixed content between headings', () => {
      const markdown = `
# Introduction
Welcome to our guide.

Here's what we'll cover:
- Getting started
- Advanced topics
- Best practices

## Getting Started
First, install the software.

Run this command:
\`\`\`bash
npm install awesome-lib
\`\`\`

> **Note:** Make sure you have Node.js installed.

### Prerequisites
You'll need:
1. Node.js 14+
2. npm or yarn
3. A text editor

Now you're ready to begin!

## Advanced Topics
This section covers advanced usage.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      const intro = result.children[0];
      expect(intro.name).toBe('Introduction');
      
      // Should have content nodes and heading children
      const contentNodes = intro.children.filter(child => child.type === 'content');
      const headingNodes = intro.children.filter(child => child.type === 'heading');
      
      expect(contentNodes.length).toBeGreaterThan(0);
      expect(headingNodes.length).toBeGreaterThan(0);
      
      const gettingStarted = headingNodes.find(child => child.name === 'Getting Started');
      expect(gettingStarted).toBeDefined();
      
      const prerequisites = gettingStarted.children.find(child => child.name === 'Prerequisites');
      expect(prerequisites).toBeDefined();
      expect(prerequisites.metadata.level).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    test('should handle document without headings', () => {
      const markdown = `
This is a document with just paragraphs.

And another paragraph.

- Some list items
- More items

> A blockquote too.
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      expect(result.type).toBe('document');
      expect(result.children).toHaveLength(1);
      
      const implicitSection = result.children[0];
      expect(implicitSection.type).toBe('content');
      expect(implicitSection.value).toContain('This is a document');
    });

    test('should handle empty document', () => {
      const markdown = '';
      
      const result = markdownHandler.parse(markdown);
      
      expect(result).toBeNull();
    });

    test('should handle document with only whitespace', () => {
      const markdown = '   \n\n  \t  \n   ';
      
      const result = markdownHandler.parse(markdown);
      
      expect(result).toBeNull();
    });

    test('should handle headings with special characters', () => {
      const markdown = `
# Special Characters: *bold* and _italic_

## Section with "quotes" and 'apostrophes'

### Section with <tags> and &entities;

#### Numbers 123 and symbols @#$%
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      const mainHeading = result.children[0];
      expect(mainHeading.name).toBe('Special Characters: *bold* and _italic_');
      
      const quotesSection = mainHeading.children.find(child => 
        child.name === 'Section with "quotes" and \'apostrophes\''
      );
      expect(quotesSection).toBeDefined();
    });

    test('should handle consecutive headings', () => {
      const markdown = `
# First Heading
## Second Heading
### Third Heading
#### Fourth Heading
##### Fifth Heading
###### Sixth Heading
      `.trim();
      
      const result = markdownHandler.parse(markdown);
      
      const first = result.children[0];
      expect(first.name).toBe('First Heading');
      expect(first.metadata.level).toBe(1);
      
      let current = first;
      for (let level = 2; level <= 6; level++) {
        const nextHeading = current.children.find(child => child.type === 'heading');
        expect(nextHeading).toBeDefined();
        expect(nextHeading.metadata.level).toBe(level);
        current = nextHeading;
      }
    });
  });
});