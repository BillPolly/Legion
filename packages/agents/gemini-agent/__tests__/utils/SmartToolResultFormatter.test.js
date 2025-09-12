/**
 * Smart Tool Result Formatter Tests
 * Tests formatter completely separately from LLM and ConversationManager
 * Just gives it tool results and checks formatting
 */

import { SmartToolResultFormatter } from '../../src/utils/SmartToolResultFormatter.js';

describe('SmartToolResultFormatter Standalone Tests', () => {
  describe('Error Handling (All Tools)', () => {
    it('should format tool errors consistently', () => {
      const errorResult = {
        success: false,
        error: 'File not found'
      };

      const formatted = SmartToolResultFormatter.format('read_file', errorResult);
      
      expect(formatted).toContain('⚠️ **Tool Error (read_file):**');
      expect(formatted).toContain('File not found');
      expect(formatted).toContain('could not complete');
      
      console.log('Error formatting:', formatted);
    });

    it('should format command failures (exit code != 0)', () => {
      const commandFailureResult = {
        success: true,
        data: {
          command: 'cat /nonexistent/file.txt',
          stdout: '',
          stderr: 'cat: /nonexistent/file.txt: No such file or directory',
          exit_code: 1
        }
      };

      const formatted = SmartToolResultFormatter.format('shell_command', commandFailureResult);
      
      expect(formatted).toContain('❌ **Command Failed');
      expect(formatted).toContain('**Exit Code:** 1');
      expect(formatted).toContain('No such file or directory');
      
      console.log('Command failure formatting:', formatted);
    });
  });

  describe('Shell Command Formatting', () => {
    it('should format successful ls command beautifully', () => {
      const lsResult = {
        success: true,
        data: {
          command: 'ls -la',
          stdout: 'total 32\\ndrwxr-xr-x@ 12 williampearson staff 384 Nov 11 23:11 __tests__\\ndrwxr-xr-x@ 13 williampearson staff 416 Nov 11 22:26 .\\n-rw-r--r--@ 1 williampearson staff 1093 Nov 11 22:25 package.json',
          stderr: '',
          exit_code: 0
        }
      };

      const formatted = SmartToolResultFormatter.format('shell_command', lsResult);
      
      console.log('Shell command formatting:', formatted);
      
      expect(formatted).toContain('🔧 Shell Command Result');
      expect(formatted).toContain('**Command:** `ls -la`');
      expect(formatted).toContain('**Exit Code:** 0');
      expect(formatted).toContain('```bash');
      expect(formatted).toContain('total 32');
      expect(formatted).toContain('package.json');
      expect(formatted).toContain('__tests__');
    });

    it('should format echo command output', () => {
      const echoResult = {
        success: true,
        data: {
          command: 'echo "Hello World"',
          stdout: 'Hello World',
          stderr: '',
          exit_code: 0
        }
      };

      const formatted = SmartToolResultFormatter.format('shell_command', echoResult);
      
      expect(formatted).toContain('🔧 Shell Command Result');
      expect(formatted).toContain('echo "Hello World"');
      expect(formatted).toContain('Hello World');
      expect(formatted).toContain('**Exit Code:** 0');
      
      console.log('Echo formatting:', formatted);
    });

    it('should format complex command with multiple lines', () => {
      const complexResult = {
        success: true,
        data: {
          command: 'npm test',
          stdout: 'PASS __tests__/test.js\\n  ✓ should work\\n\\nTest Suites: 1 passed, 1 total\\nTests: 5 passed, 5 total',
          stderr: '',
          exit_code: 0
        }
      };

      const formatted = SmartToolResultFormatter.format('shell_command', complexResult);
      
      expect(formatted).toContain('npm test');
      expect(formatted).toContain('PASS __tests__');
      expect(formatted).toContain('Test Suites: 1 passed');
      
      console.log('Complex command formatting:', formatted);
    });
  });

  describe('File Operations Formatting', () => {
    it('should format file listings with icons and sizes', () => {
      const fileListResult = {
        success: true,
        data: {
          path: '/Users/test/project',
          entries: [
            { name: 'src', type: 'directory', size: 256, modified: '2025-09-11T20:00:00.000Z' },
            { name: 'package.json', type: 'file', size: 1024, modified: '2025-09-11T20:00:00.000Z' },
            { name: 'README.md', type: 'file', size: 2048, modified: '2025-09-11T20:00:00.000Z' }
          ]
        }
      };

      const formatted = SmartToolResultFormatter.format('list_files', fileListResult);
      
      expect(formatted).toContain('📁 Directory Listing');
      expect(formatted).toContain('📂 src');
      expect(formatted).toContain('📄 package.json');
      expect(formatted).toContain('256 bytes');
      expect(formatted).toContain('1 KB');
      
      console.log('File list formatting:', formatted);
    });
  });

  describe('Default Formatting', () => {
    it('should format unknown tools with JSON fallback', () => {
      const unknownResult = {
        success: true,
        data: {
          customField: 'test value',
          count: 42,
          items: ['a', 'b', 'c']
        }
      };

      const formatted = SmartToolResultFormatter.format('unknown_tool', unknownResult);
      
      expect(formatted).toContain('🔧 Tool Result (unknown_tool)');
      expect(formatted).toContain('```json');
      expect(formatted).toContain('test value');
      expect(formatted).toContain('42');
      
      console.log('Default formatting:', formatted);
    });
  });

  describe('Utility Functions', () => {
    it('should format bytes correctly', () => {
      expect(SmartToolResultFormatter.formatBytes(0)).toBe('0 bytes');
      expect(SmartToolResultFormatter.formatBytes(1024)).toBe('1 KB');
      expect(SmartToolResultFormatter.formatBytes(1536)).toBe('1.5 KB');
      expect(SmartToolResultFormatter.formatBytes(1048576)).toBe('1 MB');
      
      console.log('Byte formatting tests passed');
    });

    it('should detect languages correctly', () => {
      expect(SmartToolResultFormatter.detectLanguage('js', 'function test() {}')).toBe('javascript');
      expect(SmartToolResultFormatter.detectLanguage('py', 'def main():')).toBe('python');
      expect(SmartToolResultFormatter.detectLanguage('json', '{"test": true}')).toBe('json');
      
      console.log('Language detection tests passed');
    });
  });
});