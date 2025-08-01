/**
 * MarkdownRenderer Tests
 * 
 * Testing MarkdownRenderer class with markdown-it integration, syntax highlighting, and interactive features
 */

import { MarkdownRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/renderers/MarkdownRenderer.js';

describe('MarkdownRenderer', () => {
  let renderer;
  let container;

  beforeEach(() => {
    renderer = new MarkdownRenderer();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Content Type Detection', () => {
    test('should identify markdown content correctly', () => {
      expect(renderer.canRender('markdown')).toBe(true);
      expect(renderer.canRender('md')).toBe(true);
      expect(renderer.canRender('text/markdown')).toBe(true);
    });

    test('should reject non-markdown content types', () => {
      expect(renderer.canRender('plaintext')).toBe(false);
      expect(renderer.canRender('html')).toBe(false);
      expect(renderer.canRender('yaml')).toBe(false);
      expect(renderer.canRender('json')).toBe(false);
    });

    test('should be case insensitive for content types', () => {
      expect(renderer.canRender('MARKDOWN')).toBe(true);
      expect(renderer.canRender('Markdown')).toBe(true);
      expect(renderer.canRender('MD')).toBe(true);
    });

    test('should handle null and undefined content types', () => {
      expect(renderer.canRender(null)).toBe(false);
      expect(renderer.canRender(undefined)).toBe(false);
      expect(renderer.canRender('')).toBe(false);
    });
  });

  describe('Markdown Parsing', () => {
    test('should render basic markdown elements', () => {
      const content = `# Header 1
## Header 2
**Bold text**
*Italic text*
~~Strikethrough~~

A paragraph with some text.`;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv).toBeDefined();
      expect(contentDiv.innerHTML).toContain('<h1>Header 1</h1>');
      expect(contentDiv.innerHTML).toContain('<h2>Header 2</h2>');
      expect(contentDiv.innerHTML).toContain('<strong>Bold text</strong>');
      expect(contentDiv.innerHTML).toContain('<em>Italic text</em>');
      expect(contentDiv.innerHTML).toContain('<s>Strikethrough</s>');
      expect(contentDiv.innerHTML).toContain('<p>A paragraph with some text.</p>');
    });

    test('should render lists correctly', () => {
      const content = `## Unordered List
- Item 1
- Item 2
  - Nested item 1
  - Nested item 2
- Item 3

## Ordered List
1. First item
2. Second item
3. Third item`;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).toContain('<ul>');
      expect(contentDiv.innerHTML).toContain('<ol>');
      expect(contentDiv.innerHTML).toContain('<li>Item 1</li>');
      expect(contentDiv.innerHTML).toContain('<li>First item</li>');
    });

    test('should render links correctly', () => {
      const content = `[External Link](https://example.com)
[Internal Link](#section1)
<https://autolink.com>`;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).toContain('href="https://example.com"');
      expect(contentDiv.innerHTML).toContain('href="#section1"');
      expect(contentDiv.innerHTML).toContain('href="https://autolink.com"');
    });

    test('should render blockquotes correctly', () => {
      const content = `> This is a blockquote
> 
> With multiple lines
> 
> > And nested quotes`;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).toContain('<blockquote>');
      expect(contentDiv.innerHTML).toContain('This is a blockquote');
    });

    test('should render tables correctly', () => {
      const content = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).toContain('<table>');
      expect(contentDiv.innerHTML).toContain('<thead>');
      expect(contentDiv.innerHTML).toContain('<tbody>');
      expect(contentDiv.innerHTML).toContain('<th>Header 1</th>');
      expect(contentDiv.innerHTML).toContain('<td>Cell 1</td>');
    });
  });

  describe('Code Syntax Highlighting', () => {
    test('should render inline code correctly', () => {
      const content = 'Here is some `inline code` in the text.';
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).toContain('<code>inline code</code>');
    });

    test('should render code blocks with syntax highlighting', () => {
      const content = `\`\`\`javascript
function hello() {
  console.log("Hello, world!");
  return 42;
}
\`\`\``;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      const codeBlock = contentDiv.querySelector('pre code');
      expect(codeBlock).toBeDefined();
      expect(codeBlock.classList.contains('language-javascript')).toBe(true);
      expect(codeBlock.innerHTML).toContain('function');
      // The syntax highlighting wraps console.log in spans, so we check for the highlighted version
      expect(codeBlock.innerHTML).toContain('console</span>.<span class="hljs-title function_">log</span>');
    });

    test('should handle code blocks without language specification', () => {
      const content = `\`\`\`
function generic() {
  return "no language specified";
}
\`\`\``;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      const codeBlock = contentDiv.querySelector('pre code');
      expect(codeBlock).toBeDefined();
      expect(codeBlock.textContent).toContain('function generic()');
    });

    test('should support multiple programming languages', () => {
      const content = `\`\`\`python
def hello():
    print("Hello from Python!")
\`\`\`

\`\`\`java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}
\`\`\`

\`\`\`css
.example {
    color: #ff0000;
    background: #ffffff;
}
\`\`\``;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      const codeBlocks = contentDiv.querySelectorAll('pre code');
      expect(codeBlocks.length).toBe(3);
      expect(codeBlocks[0].classList.contains('language-python')).toBe(true);
      expect(codeBlocks[1].classList.contains('language-java')).toBe(true);
      expect(codeBlocks[2].classList.contains('language-css')).toBe(true);
    });
  });

  describe('Interactive Elements', () => {
    test('should add copy buttons to code blocks', () => {
      const content = `\`\`\`javascript
console.log("Copy me!");
\`\`\``;
      
      renderer.render(content, container);
      
      const copyButton = container.querySelector('.copy-button');
      expect(copyButton).not.toBeNull();
      expect(copyButton.textContent).toBe('Copy');
      expect(copyButton.getAttribute('data-clipboard-text')).toBeTruthy();
    });

    test('should handle copy button clicks', () => {
      const content = `\`\`\`javascript
console.log("Test code");
\`\`\``;
      
      renderer.render(content, container);
      
      const copyButton = container.querySelector('.copy-button');
      expect(copyButton).toBeDefined();
      
      // Mock clipboard API
      let clipboardText = null;
      const mockWriteText = (text) => {
        clipboardText = text;
        return Promise.resolve();
      };
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText
        }
      });
      
      copyButton.click();
      
      // The copy button data includes the trailing newline from the markdown code block
      expect(clipboardText).toBe('console.log("Test code");\n');
    });

    test('should handle internal links differently from external links', () => {
      const content = `[Internal](#section1)
[External](https://example.com)
[Mailto](mailto:test@example.com)`;
      
      renderer.render(content, container);
      
      const links = container.querySelectorAll('a');
      expect(links.length).toBe(3);
      
      const internalLink = Array.from(links).find(link => link.href.includes('#section1'));
      const externalLink = Array.from(links).find(link => link.href.includes('example.com'));
      
      expect(internalLink.classList.contains('internal-link')).toBe(true);
      expect(externalLink.classList.contains('external-link')).toBe(true);
      expect(externalLink.getAttribute('target')).toBe('_blank');
      expect(externalLink.getAttribute('rel')).toBe('noopener noreferrer');
    });

    test('should add line numbers to code blocks when enabled', () => {
      const rendererWithLineNumbers = new MarkdownRenderer({ showLineNumbers: true });
      const content = `\`\`\`javascript
function test() {
  console.log("line 2");
  return true;
}
\`\`\``;
      
      rendererWithLineNumbers.render(content, container);
      
      const codeContainer = container.querySelector('.code-container');
      expect(codeContainer).toBeDefined();
      expect(codeContainer.classList.contains('line-numbers')).toBe(true);
      
      const lineNumbers = container.querySelectorAll('.line-number');
      expect(lineNumbers.length).toBeGreaterThan(0);
    });
  });

  describe('Security & Sanitization', () => {
    test('should sanitize dangerous HTML', () => {
      const content = `# Safe Header
<script>alert('xss')</script>
<iframe src="javascript:alert('xss')"></iframe>
<img src="x" onerror="alert('xss')">`;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).toContain('<h1>Safe Header</h1>');
      expect(contentDiv.innerHTML).not.toContain('<script>');
      expect(contentDiv.innerHTML).not.toContain('<iframe>');
      expect(contentDiv.innerHTML).not.toContain('onerror=');
    });

    test('should allow safe HTML elements', () => {
      const content = `# Header
<em>Emphasis</em>
<strong>Strong</strong>
<code>Code</code>
<br>
<hr>`;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).toContain('<em>Emphasis</em>');
      expect(contentDiv.innerHTML).toContain('<strong>Strong</strong>');
      expect(contentDiv.innerHTML).toContain('<code>Code</code>');
      expect(contentDiv.innerHTML).toContain('<br>');
      expect(contentDiv.innerHTML).toContain('<hr>');
    });

    test('should sanitize dangerous attributes', () => {
      const content = `<a href="javascript:alert('xss')" onclick="alert('xss')">Link</a>
<div style="background: url('http://evil.com/steal')" class="safe">Content</div>`;
      
      renderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).not.toContain('javascript:');
      expect(contentDiv.innerHTML).not.toContain('onclick=');
      expect(contentDiv.innerHTML).not.toContain('background: url');
      expect(contentDiv.innerHTML).toContain('class="safe"'); // Safe attributes should remain
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed markdown gracefully', () => {
      const content = `# Unclosed [link
**Unclosed bold
> Unclosed blockquote

\`\`\`
Unclosed code block`;
      
      expect(() => {
        renderer.render(content, container);
      }).not.toThrow();
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv).toBeDefined();
      expect(contentDiv.innerHTML.length).toBeGreaterThan(0);
    });

    test('should handle empty content gracefully', () => {
      renderer.render('', container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv).toBeDefined();
      expect(contentDiv.innerHTML).toBe('<p><em>No content</em></p>');
    });

    test('should handle null content gracefully', () => {
      renderer.render(null, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv).toBeDefined();
      expect(contentDiv.innerHTML).toBe('<p><em>No content</em></p>');
    });

    test('should handle rendering errors gracefully', () => {
      // Mock markdown-it to throw an error
      const originalRender = renderer.md.render;
      renderer.md.render = () => {
        throw new Error('Markdown parsing error');
      };
      
      expect(() => {
        renderer.render('# Test', container);
      }).toThrow('Failed to render markdown content');
      
      // Restore original method
      renderer.md.render = originalRender;
    });

    test('should handle container validation errors', () => {
      expect(() => {
        renderer.render('# Test', null);
      }).toThrow('Container is required for rendering');
      
      expect(() => {
        renderer.render('# Test', 'not-a-dom-element');
      }).toThrow('Container must be a DOM element');
    });
  });

  describe('Configuration Options', () => {
    test('should support custom configuration', () => {
      const customRenderer = new MarkdownRenderer({
        html: false,
        linkify: false,
        typographer: false,
        showLineNumbers: true,
        theme: 'dark'
      });
      
      expect(customRenderer.options.html).toBe(false);
      expect(customRenderer.options.linkify).toBe(false);
      expect(customRenderer.options.typographer).toBe(false);
      expect(customRenderer.options.showLineNumbers).toBe(true);
      expect(customRenderer.options.theme).toBe('dark');
    });

    test('should disable HTML when configured', () => {
      const noHtmlRenderer = new MarkdownRenderer({ html: false });
      const content = '# Header\n<em>HTML</em>';
      
      noHtmlRenderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).toContain('<h1>Header</h1>');
      expect(contentDiv.innerHTML).not.toContain('<em>HTML</em>');
      expect(contentDiv.textContent).toContain('<em>HTML</em>'); // Should be escaped as text
    });

    test('should disable automatic link detection when configured', () => {
      const noLinkifyRenderer = new MarkdownRenderer({ linkify: false });
      const content = 'Visit https://example.com for more info.';
      
      noLinkifyRenderer.render(content, container);
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv.innerHTML).not.toContain('<a href="https://example.com"');
      expect(contentDiv.textContent).toContain('https://example.com');
    });
  });

  describe('Renderer Information', () => {
    test('should provide correct renderer name', () => {
      expect(renderer.getName()).toBe('MarkdownRenderer');
    });

    test('should provide renderer version', () => {
      expect(renderer.getVersion()).toBeDefined();
      expect(typeof renderer.getVersion()).toBe('string');
    });

    test('should provide supported content types', () => {
      const supportedTypes = renderer.getSupportedTypes();
      
      expect(Array.isArray(supportedTypes)).toBe(true);
      expect(supportedTypes).toContain('markdown');
      expect(supportedTypes).toContain('md');
      expect(supportedTypes).toContain('text/markdown');
    });

    test('should provide renderer description', () => {
      const description = renderer.getDescription();
      
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description).toContain('markdown');
    });
  });

  describe('Performance', () => {
    test('should render large markdown documents efficiently', () => {
      const largeContent = `# Large Document\n\n` + 
        Array.from({ length: 100 }, (_, i) => 
          `## Section ${i + 1}\n\nParagraph content for section ${i + 1}.\n\n\`\`\`javascript\nfunction section${i + 1}() {\n  return ${i + 1};\n}\n\`\`\`\n\n`
        ).join('');
      
      const startTime = Date.now();
      renderer.render(largeContent, container);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should render in less than 1 second
      
      const contentDiv = container.querySelector('.markdown-content');
      expect(contentDiv).toBeDefined();
      expect(contentDiv.querySelectorAll('h2').length).toBe(100);
      expect(contentDiv.querySelectorAll('pre code').length).toBe(100);
    });

    test('should not leak memory with repeated renders', () => {
      const content = '# Test\n\nSome content.';
      
      for (let i = 0; i < 50; i++) {
        renderer.render(content, container);
      }
      
      // Should only have one content div (previous ones cleaned up)
      const contentDivs = container.querySelectorAll('.markdown-content');
      expect(contentDivs.length).toBe(1);
    });
  });
});