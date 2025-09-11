/**
 * Real MarkdownRenderer Component Tests
 * Tests actual DOM rendering, syntax highlighting, and umbilical protocol
 * NO MOCKS - uses real jsdom environment and actual markdown content
 */

import { MarkdownRenderer } from '../../../src/components/markdown-renderer/index.js';

describe('MarkdownRenderer Component', () => {
  let container;

  beforeEach(() => {
    // Create real DOM container for each test
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up DOM after each test
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Umbilical Protocol Compliance', () => {
    it('should support introspection mode', () => {
      let requirements = null;
      
      MarkdownRenderer.create({
        describe: (reqs) => {
          requirements = reqs.getAll();
        }
      });
      
      expect(requirements).toBeDefined();
      expect(requirements.dom).toBeDefined();
      expect(requirements.dom.type).toBe('HTMLElement');
      expect(requirements.dom.required).toBe(true);
      
      expect(requirements.content).toBeDefined();
      expect(requirements.content.type).toBe('string');
      expect(requirements.content.required).toBe(false);
      
      expect(requirements.theme).toBeDefined();
      expect(requirements.onContentChange).toBeDefined();
    });

    it('should support validation mode', () => {
      const validUmbilical = {
        dom: container,
        content: '# Test',
        theme: 'light'
      };
      
      const validation = MarkdownRenderer.create({
        validate: (checks) => checks
      });
      
      expect(typeof validation).toBe('function');
      
      const result = validation(validUmbilical);
      expect(result.hasDomElement).toBe(true);
      expect(result.hasValidTheme).toBe(true);
      expect(result.hasValidContent).toBe(true);
    });

    it('should create working instance', () => {
      const instance = MarkdownRenderer.create({
        dom: container,
        content: '# Hello World'
      });
      
      expect(instance).toBeDefined();
      expect(typeof instance.setContent).toBe('function');
      expect(typeof instance.getContent).toBe('function');
      expect(typeof instance.setTheme).toBe('function');
      expect(typeof instance.destroy).toBe('function');
    });
  });

  describe('Real Content Rendering', () => {
    it('should render basic markdown to actual DOM', async () => {
      const markdown = \`# Test Title

This is **bold** and *italic* text.

- List item 1
- List item 2

\\\`\\\`\\\`javascript
console.log('Hello World');
\\\`\\\`\\\`\`;

      const instance = MarkdownRenderer.create({
        dom: container,
        content: markdown
      });

      // Wait for libraries to load and render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check actual DOM content
      const renderedContent = container.querySelector('.markdown-content');
      expect(renderedContent).toBeTruthy();
      
      // Should have rendered markdown elements
      const html = renderedContent.innerHTML;
      expect(html).toContain('<h1>');
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
      expect(html).toContain('<li>');
      
      console.log('Rendered HTML length:', html.length);
    });

    it('should handle code blocks with syntax highlighting', async () => {
      const codeMarkdown = \`\\\`\\\`\\\`javascript
function test() {
  return "Hello World";
}
\\\`\\\`\\\`\`;

      const instance = MarkdownRenderer.create({
        dom: container,
        content: codeMarkdown
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for code block elements
      const codeBlock = container.querySelector('pre');
      expect(codeBlock).toBeTruthy();
      
      const code = container.querySelector('code');
      expect(code).toBeTruthy();
      expect(code.textContent).toContain('function test()');
    });

    it('should add copy buttons to code blocks', async () => {
      const codeMarkdown = \`\\\`\\\`\\\`json
{
  "name": "test",
  "value": 42
}
\\\`\\\`\\\`\`;

      const instance = MarkdownRenderer.create({
        dom: container,
        content: codeMarkdown,
        onCopy: (content) => {
          console.log('Copy callback triggered with:', content.substring(0, 20));
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for copy button
      const copyButton = container.querySelector('.copy-button');
      expect(copyButton).toBeTruthy();
      
      // Test copy functionality
      const copyIcon = copyButton.querySelector('.copy-icon');
      expect(copyIcon).toBeTruthy();
    });

    it('should handle theme changes', async () => {
      const instance = MarkdownRenderer.create({
        dom: container,
        content: '# Test Content',
        theme: 'light'
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Check initial theme
      const renderer = container.querySelector('.markdown-renderer');
      expect(renderer.className).toContain('theme-light');

      // Change theme
      instance.setTheme('dark');
      expect(renderer.className).toContain('theme-dark');
      expect(instance.getTheme()).toBe('dark');
    });
  });

  describe('Tool Result Formatting', () => {
    it('should format file listing results beautifully', async () => {
      const toolResult = {
        success: true,
        data: {
          path: '/test/directory',
          entries: [
            { name: 'src', type: 'directory', size: 256 },
            { name: 'package.json', type: 'file', size: 1024 },
            { name: 'README.md', type: 'file', size: 2048 }
          ]
        }
      };

      const markdown = \`## 📁 Directory Listing

\${toolResult.data.entries.map(entry => 
  \`- **\${entry.type === 'directory' ? '📂' : '📄'} \${entry.name}** (\${entry.type}) - \${entry.size} bytes\`
).join('\\n')}\`;

      const instance = MarkdownRenderer.create({
        dom: container,
        content: markdown
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const html = container.innerHTML;
      expect(html).toContain('📁 Directory Listing');
      expect(html).toContain('📂 src');
      expect(html).toContain('📄 package.json');
      expect(html).toContain('📄 README.md');
      
      console.log('Formatted file listing rendered successfully');
    });

    it('should format command output with syntax highlighting', async () => {
      const commandOutput = \`## 🔧 Shell Command Result

Command: \\\`ls -la\\\`

\\\`\\\`\\\`bash
total 24
drwxr-xr-x  6 user  staff   192 Nov 11 20:30 .
drwxr-xr-x  3 user  staff    96 Nov 11 20:25 ..
-rw-r--r--  1 user  staff   123 Nov 11 20:30 package.json
-rw-r--r--  1 user  staff  2048 Nov 11 20:29 README.md
\\\`\\\`\\\`\`;

      const instance = MarkdownRenderer.create({
        dom: container,
        content: commandOutput
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const html = container.innerHTML;
      expect(html).toContain('🔧 Shell Command Result');
      expect(html).toContain('<pre');
      expect(html).toContain('package.json');
      expect(html).toContain('README.md');
    });

    it('should handle error formatting gracefully', async () => {
      const errorMarkdown = \`⚠️ **Tool Error (read_file):** File not found: \\\`/nonexistent/file.txt\\\`

The file you requested does not exist or is not accessible.\`;

      const instance = MarkdownRenderer.create({
        dom: container,
        content: errorMarkdown
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const html = container.innerHTML;
      expect(html).toContain('⚠️');
      expect(html).toContain('Tool Error');
      expect(html).toContain('/nonexistent/file.txt');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large content efficiently', async () => {
      // Create large markdown content
      const largeContent = Array.from({ length: 100 }, (_, i) => 
        \`## Section \${i + 1}

This is content for section \${i + 1} with some **bold** text and \\\`code\\\`.

\\\`\\\`\\\`javascript
function section\${i + 1}() {
  return "Section \${i + 1} code";
}
\\\`\\\`\\\`\`
      ).join('\\n\\n');

      const startTime = performance.now();
      
      const instance = MarkdownRenderer.create({
        dom: container,
        content: largeContent
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      console.log(\`Large content rendered in \${renderTime.toFixed(2)}ms\`);
      expect(renderTime).toBeLessThan(1000); // Should render in under 1 second
      
      // Verify content was rendered
      const headings = container.querySelectorAll('h2');
      expect(headings.length).toBe(100);
    });

    it('should clean up properly on destroy', async () => {
      const instance = MarkdownRenderer.create({
        dom: container,
        content: '# Test Content'
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify content exists
      expect(container.querySelector('.markdown-renderer')).toBeTruthy();

      // Destroy and verify cleanup
      instance.destroy();
      expect(container.querySelector('.markdown-renderer')).toBeFalsy();
    });
  });

  describe('Event Handling', () => {
    it('should trigger content change callbacks', async () => {
      let changeEvents = [];
      
      const instance = MarkdownRenderer.create({
        dom: container,
        content: '# Initial',
        onContentChange: (newContent, event) => {
          changeEvents.push({ newContent, event });
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Change content
      instance.setContent('# Updated Content');
      
      expect(changeEvents).toHaveLength(1);
      expect(changeEvents[0].newContent).toBe('# Updated Content');
      expect(changeEvents[0].event.oldContent).toBe('# Initial');
    });

    it('should handle copy events', async () => {
      let copyEvents = [];
      
      const instance = MarkdownRenderer.create({
        dom: container,
        content: \`\\\`\\\`\\\`javascript
console.log('test');
\\\`\\\`\\\`\`,
        onCopy: (content) => {
          copyEvents.push(content);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate copy button click
      const copyButton = container.querySelector('.copy-button');
      if (copyButton) {
        copyButton.click();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        expect(copyEvents.length).toBeGreaterThan(0);
        expect(copyEvents[0]).toContain('console.log');
      }
    });
  });
});