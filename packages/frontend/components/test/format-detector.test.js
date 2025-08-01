import { describe, test, expect, beforeEach } from '@jest/globals';
import { FormatDetector } from '../src/components/tree-scribe/features/parsing/FormatDetector.js';

describe('FormatDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new FormatDetector();
  });

  describe('YAML detection', () => {
    test('detects valid YAML with high confidence', () => {
      const yamlContent = `title: Test Document
content: |
  This is a multi-line
  content block
children:
  - title: Child 1
    content: Test
  - title: Child 2`;

      const result = detector.detect(yamlContent);
      expect(result.format).toBe('yaml');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.source).toBe('content');
    });

    test('detects YAML with document separator', () => {
      const content = `---
title: Document
---
more content`;

      const result = detector.detect(content);
      expect(result.format).toBe('yaml');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('uses filename hint for YAML', () => {
      const content = 'some: content';
      const result = detector.detect(content, { filename: 'test.yaml' });
      expect(result.format).toBe('yaml');
      expect(result.source).toBe('filename');
    });
  });

  describe('JSON detection', () => {
    test('detects valid JSON object', () => {
      const jsonContent = '{"title": "Test", "value": 42, "nested": {"key": "value"}}';
      const result = detector.detect(jsonContent);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('detects JSON array', () => {
      const jsonContent = '[1, 2, 3, {"name": "test"}]';
      const result = detector.detect(jsonContent);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('uses MIME type hint for JSON', () => {
      const content = '{"test": true}';
      const result = detector.detect(content, { mimeType: 'application/json' });
      expect(result.format).toBe('json');
      expect(result.source).toBe('mimeType');
    });

    test('rejects invalid JSON', () => {
      const content = '{invalid json}';
      const result = detector.detect(content);
      expect(result.format).not.toBe('json');
    });
  });

  describe('Markdown detection', () => {
    test('detects markdown with headers', () => {
      const mdContent = `# Title

Some content with **bold** text.

## Section

- List item`;

      const result = detector.detect(mdContent);
      expect(result.format).toBe('markdown');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('detects markdown with frontmatter', () => {
      const content = `---
title: Test
---

# Content`;

      const result = detector.detect(content);
      expect(result.format).toBe('markdown');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('uses filename hint for Markdown', () => {
      const content = 'Some text content';
      const result = detector.detect(content, { filename: 'README.md' });
      expect(result.format).toBe('markdown');
      expect(result.source).toBe('filename');
    });

    test('detects markdown formatting', () => {
      const content = `This has **bold** and *italic* text.
      
\`\`\`javascript
code block
\`\`\`

[Link](https://example.com)`;

      const result = detector.detect(content);
      expect(result.format).toBe('markdown');
    });
  });

  describe('Plain text detection', () => {
    test('falls back to plain text', () => {
      const content = 'Just some plain text without any special formatting.';
      const result = detector.detect(content);
      expect(result.format).toBe('plain');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('analyzeContent', () => {
    test('provides detailed analysis', () => {
      const yamlContent = `title: Test
children:
  - item1
  - item2`;

      const analysis = detector.analyzeContent(yamlContent);
      expect(analysis).toHaveProperty('format', 'yaml');
      expect(analysis).toHaveProperty('confidence');
      expect(analysis).toHaveProperty('alternatives');
      expect(analysis).toHaveProperty('features');
      expect(analysis.features).toHaveProperty('yamlIndicators');
      expect(analysis.features.yamlIndicators).toBeGreaterThan(0);
    });

    test('includes alternatives in analysis', () => {
      const ambiguousContent = `title: Document
## Section`;

      const analysis = detector.analyzeContent(ambiguousContent);
      expect(analysis.alternatives).toBeInstanceOf(Array);
      expect(analysis.alternatives.length).toBeGreaterThan(0);
      
      const formats = analysis.alternatives.map(alt => alt.format);
      expect(formats).toContain('yaml');
      expect(formats).toContain('markdown');
    });

    test('respects hints in analysis', () => {
      const content = 'test: value';
      const analysis = detector.analyzeContent(content, { format: 'yaml' });
      expect(analysis.format).toBe('yaml');
      expect(analysis.source).toBe('hint');
    });
  });

  describe('edge cases', () => {
    test('handles empty content', () => {
      const result = detector.detect('');
      expect(result.format).toBe('plain');
      expect(result.confidence).toBeLessThan(0.5);
    });

    test('handles whitespace-only content', () => {
      const result = detector.detect('   \n\t  \n   ');
      expect(result.format).toBe('plain');
    });

    test('handles mixed format indicators', () => {
      const content = `---
title: YAML-like
---

# But also Markdown

{ "and": "json-like" }`;

      const result = detector.detect(content);
      // Should detect primary format
      expect(['yaml', 'markdown']).toContain(result.format);
      expect(result.alternatives).toBeDefined();
    });

    test('prioritizes explicit format hint', () => {
      const content = '# Markdown content';
      const result = detector.detect(content, { format: 'yaml' });
      expect(result.format).toBe('yaml');
      expect(result.source).toBe('hint');
    });

    test('handles very large content', () => {
      const largeContent = '# Title\n\n' + 'Some content. '.repeat(10000);
      const result = detector.detect(largeContent);
      expect(result.format).toBe('markdown');
    });
  });

  describe('confidence scoring', () => {
    test('gives high confidence for clear formats', () => {
      const clearJson = '{"valid": "json", "array": [1, 2, 3]}';
      const jsonResult = detector.detect(clearJson);
      expect(jsonResult.confidence).toBeGreaterThan(0.9);

      const clearYaml = `---
document: yaml
items:
  - one
  - two`;
      const yamlResult = detector.detect(clearYaml);
      expect(yamlResult.confidence).toBeGreaterThan(0.9);
    });

    test('gives lower confidence for ambiguous content', () => {
      const ambiguous = 'key: value';
      const result = detector.detect(ambiguous);
      expect(result.confidence).toBeLessThan(0.7);
    });
  });
});