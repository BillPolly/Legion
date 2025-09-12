/**
 * Read File Formatter Test
 * Tests read_file formatting separately 
 */

import { SmartToolResultFormatter } from '../../src/utils/SmartToolResultFormatter.js';

describe('Read File Formatter Test', () => {
  it('should format successful read_file result beautifully', () => {
    const readFileResult = {
      success: true,
      data: {
        content: '{\n  "name": "@legion/gemini-agent",\n  "version": "1.0.0",\n  "main": "src/index.js"\n}',
        path: '/Users/test/package.json',
        lines: 5,
        truncated: false
      }
    };

    const formatted = SmartToolResultFormatter.format('read_file', readFileResult);
    
    console.log('Read file formatting:', formatted);
    
    expect(formatted).toContain('📄 File Content');
    expect(formatted).toContain('**File:** `/Users/test/package.json`');
    expect(formatted).toContain('(5 lines)');
    expect(formatted).toContain('```json');
    expect(formatted).toContain('@legion/gemini-agent');
    expect(formatted).toContain('src/index.js');
  });

  it('should format read_file error', () => {
    const errorResult = {
      success: false,
      error: 'File not found or not accessible'
    };

    const formatted = SmartToolResultFormatter.format('read_file', errorResult);
    
    console.log('Read file error formatting:', formatted);
    
    expect(formatted).toContain('⚠️ **Tool Error (read_file):**');
    expect(formatted).toContain('File not found or not accessible');
    expect(formatted).toContain('could not complete');
  });

  it('should detect language correctly for different file types', () => {
    const jsFileResult = {
      success: true,
      data: {
        content: 'function hello() {\n  return "world";\n}',
        path: '/test/hello.js',
        lines: 3
      }
    };

    const formatted = SmartToolResultFormatter.format('read_file', jsFileResult);
    
    expect(formatted).toContain('```javascript');
    expect(formatted).toContain('function hello()');
    
    console.log('JavaScript file formatting:', formatted);
  });
});