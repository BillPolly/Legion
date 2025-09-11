/**
 * Real ToolResultFormatter Tests
 * Tests actual markdown generation for tool results
 * NO MOCKS - tests real formatting with actual tool data
 */

import { ToolResultFormatter } from '../../src/utils/ToolResultFormatter.js';

describe('ToolResultFormatter Real Integration', () => {
  describe('File Operations Formatting', () => {
    it('should format file listing with beautiful markdown', () => {
      const fileListResult = {
        success: true,
        data: {
          path: '/Users/test/project',
          entries: [
            { name: 'src', type: 'directory', size: 256, modified: '2025-09-11T20:00:00.000Z' },
            { name: 'package.json', type: 'file', size: 1024, modified: '2025-09-11T20:00:00.000Z' },
            { name: 'README.md', type: 'file', size: 2048, modified: '2025-09-11T20:00:00.000Z' },
            { name: '__tests__', type: 'directory', size: 384, modified: '2025-09-11T20:00:00.000Z' }
          ]
        }
      };

      const markdown = ToolResultFormatter.format('list_files', fileListResult);
      
      console.log('File List Markdown:');
      console.log(markdown);
      
      expect(markdown).toContain('📁 Directory Listing');
      expect(markdown).toContain('📂 src');
      expect(markdown).toContain('📄 package.json');
      expect(markdown).toContain('📄 README.md');
      expect(markdown).toContain('1 KB');
      expect(markdown).toContain('2 KB');
      expect(markdown).toContain('/Users/test/project');
    });

    it('should format file content with syntax highlighting', () => {
      const fileContentResult = {
        success: true,
        data: {
          content: `{
  "name": "@legion/gemini-agent",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/server.js"
  }
}`,
          path: '/test/package.json',
          lines: 7
        }
      };

      const markdown = ToolResultFormatter.format('read_file', fileContentResult);
      
      console.log('File Content Markdown:');
      console.log(markdown);
      
      expect(markdown).toContain('📄 File Content');
      expect(markdown).toContain('package.json');
      expect(markdown).toContain('7 lines');
      expect(markdown).toContain('```json');
      expect(markdown).toContain('@legion/gemini-agent');
      expect(markdown).toContain('node src/server.js');
    });

    it('should format command output nicely', () => {
      const commandResult = {
        success: true,
        data: {
          command: 'npm test',
          output: 'PASS __tests__/integration/LiveLLMIntegration.test.js\\n  ✓ should handle basic conversation\\n\\nTest Suites: 1 passed, 1 total\\nTests: 5 passed, 5 total',
          exitCode: 0
        }
      };

      const markdown = ToolResultFormatter.format('shell_command', commandResult);
      
      console.log('Command Output Markdown:');
      console.log(markdown);
      
      expect(markdown).toContain('🔧 Command Result');
      expect(markdown).toContain('npm test');
      expect(markdown).toContain('**Exit Code:** 0');
      expect(markdown).toContain('```bash');
      expect(markdown).toContain('Test Suites: 1 passed');
    });
  });

  describe('Error Formatting', () => {
    it('should format tool errors beautifully', () => {
      const errorResult = {
        success: false,
        error: 'File not found or not accessible',
        data: {}
      };

      const markdown = ToolResultFormatter.format('read_file', errorResult);
      
      console.log('Error Markdown:');
      console.log(markdown);
      
      expect(markdown).toContain('⚠️');
      expect(markdown).toContain('Tool Error (read_file)');
      expect(markdown).toContain('File not found or not accessible');
      expect(markdown).toContain('could not complete');
    });

    it('should format search results', () => {
      const searchResult = {
        success: true,
        data: {
          pattern: 'function.*test',
          matches: [
            { file: 'src/utils.js', line: 15, content: 'function testHelper() {' },
            { file: 'test/unit.test.js', line: 23, content: 'function testFunction() {' },
            { file: 'src/main.js', line: 8, content: 'function testMain() {' }
          ]
        }
      };

      const markdown = ToolResultFormatter.format('grep_search', searchResult);
      
      console.log('Search Results Markdown:');
      console.log(markdown);
      
      expect(markdown).toContain('🔍 Search Results');
      expect(markdown).toContain('function.*test');
      expect(markdown).toContain('**Matches:** 3');
      expect(markdown).toContain('src/utils.js:15');
      expect(markdown).toContain('testHelper()');
    });
  });

  describe('Memory and Special Tools', () => {
    it('should format memory save confirmation', () => {
      const memoryResult = {
        success: true,
        data: { stored: true }
      };

      const markdown = ToolResultFormatter.format('save_memory', memoryResult);
      
      console.log('Memory Save Markdown:');
      console.log(markdown);
      
      expect(markdown).toContain('💾 Memory Updated');
      expect(markdown).toContain('saved to long-term memory');
    });

    it('should handle unknown tools gracefully', () => {
      const unknownResult = {
        success: true,
        data: { someData: 'test value', count: 42 }
      };

      const markdown = ToolResultFormatter.format('unknown_tool', unknownResult);
      
      console.log('Unknown Tool Markdown:');
      console.log(markdown);
      
      expect(markdown).toContain('🔧 Tool Result (unknown_tool)');
      expect(markdown).toContain('```json');
      expect(markdown).toContain('test value');
      expect(markdown).toContain('42');
    });
  });

  describe('Utility Functions', () => {
    it('should format bytes correctly', () => {
      expect(ToolResultFormatter.formatBytes(0)).toBe('0 bytes');
      expect(ToolResultFormatter.formatBytes(1024)).toBe('1 KB');
      expect(ToolResultFormatter.formatBytes(1536)).toBe('1.5 KB');
      expect(ToolResultFormatter.formatBytes(1048576)).toBe('1 MB');
      expect(ToolResultFormatter.formatBytes(2097152)).toBe('2 MB');
    });

    it('should detect programming languages correctly', () => {
      expect(ToolResultFormatter.detectLanguage('js', 'function test() {}')).toBe('javascript');
      expect(ToolResultFormatter.detectLanguage('py', 'def test():')).toBe('python');
      expect(ToolResultFormatter.detectLanguage('json', '{"test": true}')).toBe('json');
      expect(ToolResultFormatter.detectLanguage('md', '# Title')).toBe('markdown');
      expect(ToolResultFormatter.detectLanguage('unknown', 'plain text')).toBe('plaintext');
      
      // Content-based detection
      expect(ToolResultFormatter.detectLanguage('', 'const x = () => {}')).toBe('javascript');
      expect(ToolResultFormatter.detectLanguage('', 'def main():')).toBe('python');
      expect(ToolResultFormatter.detectLanguage('', '{"name": "test"}')).toBe('json');
    });
  });
});