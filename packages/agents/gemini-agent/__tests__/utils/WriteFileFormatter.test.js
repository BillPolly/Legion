/**
 * Write File Formatter Test
 * Tests write_file formatting with real tool result data
 */

import { SmartToolResultFormatter } from '../../src/utils/SmartToolResultFormatter.js';

describe('Write File Formatter Test', () => {
  it('should format successful write_file result beautifully', () => {
    const writeFileResult = {
      success: true,
      data: {
        path: '/Users/test/hello.js',
        bytesWritten: 61
      }
    };

    const formatted = SmartToolResultFormatter.format('write_file', writeFileResult);
    
    console.log('Write file formatting:', formatted);
    
    expect(formatted).toContain('✅ File Written');
    expect(formatted).toContain('**File:** `/Users/test/hello.js`');
    expect(formatted).toContain('**Size:** 61 bytes');
    expect(formatted).toContain('successfully created and written');
  });

  it('should format write_file error', () => {
    const errorResult = {
      success: false,
      error: 'Failed to create directory: /invalid/path'
    };

    const formatted = SmartToolResultFormatter.format('write_file', errorResult);
    
    console.log('Write file error formatting:', formatted);
    
    expect(formatted).toContain('⚠️ **Tool Error (write_file):**');
    expect(formatted).toContain('Failed to create directory');
    expect(formatted).toContain('could not complete');
  });

  it('should handle different file sizes correctly', () => {
    const largeFileResult = {
      success: true,
      data: {
        path: '/test/large-file.txt',
        bytesWritten: 2048
      }
    };

    const formatted = SmartToolResultFormatter.format('write_file', largeFileResult);
    
    expect(formatted).toContain('**Size:** 2 KB');
    expect(formatted).toContain('large-file.txt');
    
    console.log('Large file formatting:', formatted);
  });
});