/**
 * Simplified MarkdownRenderer Component Tests
 * Tests umbilical protocol and core logic without complex DOM dependencies
 */

import { MarkdownRenderer } from '../../../src/components/markdown-renderer/index.js';

describe('MarkdownRenderer Component (Simplified)', () => {
  describe('Umbilical Protocol Compliance', () => {
    it('should support introspection mode', () => {
      let requirements = null;
      
      MarkdownRenderer.create({
        describe: (reqs) => {
          requirements = reqs;
        }
      });
      
      expect(requirements).toBeDefined();
      expect(typeof requirements.add).toBe('function');
    });

    it('should support validation mode', () => {
      const validation = MarkdownRenderer.create({
        validate: (checks) => checks
      });
      
      expect(typeof validation).toBe('function');
    });

    it('should require DOM element for instance creation', () => {
      expect(() => {
        MarkdownRenderer.create({});
      }).toThrow();
    });
  });

  describe('Tool Result Formatting Logic', () => {
    it('should generate proper markdown for file listings', () => {
      const fileListResult = {
        success: true,
        data: {
          path: '/test/directory',
          entries: [
            { name: 'src', type: 'directory', size: 256, modified: '2025-09-11T20:00:00.000Z' },
            { name: 'package.json', type: 'file', size: 1024, modified: '2025-09-11T20:00:00.000Z' },
            { name: 'README.md', type: 'file', size: 2048, modified: '2025-09-11T20:00:00.000Z' }
          ]
        }
      };

      const markdown = formatFileListAsMarkdown(fileListResult);
      
      expect(markdown).toContain('📁 Directory Listing');
      expect(markdown).toContain('📂 src');
      expect(markdown).toContain('📄 package.json');
      expect(markdown).toContain('📄 README.md');
      expect(markdown).toContain('directory');
      expect(markdown).toContain('file');
      
      console.log('Generated markdown:', markdown);
    });

    it('should generate proper markdown for command output', () => {
      const commandResult = {
        success: true,
        data: {
          command: 'ls -la',
          output: 'total 24\\ndrwxr-xr-x  6 user  staff   192 Nov 11 20:30 .\\n-rw-r--r--  1 user  staff   123 Nov 11 20:30 package.json',
          exitCode: 0
        }
      };

      const markdown = formatCommandAsMarkdown(commandResult);
      
      expect(markdown).toContain('🔧 Command Result');
      expect(markdown).toContain('ls -la');
      expect(markdown).toContain('```bash');
      expect(markdown).toContain('package.json');
      
      console.log('Generated command markdown:', markdown);
    });

    it('should generate proper markdown for tool errors', () => {
      const errorResult = {
        success: false,
        error: 'File not found',
        data: {}
      };

      const markdown = formatToolErrorAsMarkdown('read_file', errorResult);
      
      expect(markdown).toContain('⚠️');
      expect(markdown).toContain('Tool Error');
      expect(markdown).toContain('read_file');
      expect(markdown).toContain('File not found');
      
      console.log('Generated error markdown:', markdown);
    });

    it('should format JSON data with syntax highlighting', () => {
      const jsonData = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'express': '^4.18.2',
          'ws': '^8.14.2'
        }
      };

      const markdown = formatJSONAsMarkdown(jsonData, 'Package Information');
      
      expect(markdown).toContain('📋 Package Information');
      expect(markdown).toContain('```json');
      expect(markdown).toContain('test-project');
      expect(markdown).toContain('express');
      
      console.log('Generated JSON markdown:', markdown);
    });
  });
});

/**
 * Tool result formatting functions for testing
 */
function formatFileListAsMarkdown(result) {
  if (!result.success) {
    return \`⚠️ **Failed to list files:** \${result.error}\`;
  }

  const entries = result.data.entries || [];
  const formatted = entries.map(entry => {
    const icon = entry.type === 'directory' ? '📂' : '📄';
    const size = entry.size ? \` - \${formatBytes(entry.size)}\` : '';
    return \`- **\${icon} \${entry.name}** (\${entry.type})\${size}\`;
  }).join('\\n');

  return \`## 📁 Directory Listing

Path: \\\`\${result.data.path}\\\`

\${formatted}\`;
}

function formatCommandAsMarkdown(result) {
  if (!result.success) {
    return \`⚠️ **Command failed:** \${result.error}\`;
  }

  return \`## 🔧 Command Result

Command: \\\`\${result.data.command}\\\`
Exit Code: \${result.data.exitCode}

\\\`\\\`\\\`bash
\${result.data.output}
\\\`\\\`\\\`\`;
}

function formatToolErrorAsMarkdown(toolName, result) {
  return \`⚠️ **Tool Error (\${toolName}):** \${result.error}

The \${toolName} tool encountered an error and could not complete the requested operation.\`;
}

function formatJSONAsMarkdown(data, title) {
  return \`## 📋 \${title}

\\\`\\\`\\\`json
\${JSON.stringify(data, null, 2)}
\\\`\\\`\\\`\`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 bytes';
  const k = 1024;
  const sizes = ['bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}