/**
 * Edit File Formatter Test
 */

import { SmartToolResultFormatter } from '../../src/utils/SmartToolResultFormatter.js';

describe('Edit File Formatter Test', () => {
  it('should format successful edit_file result', () => {
    const editResult = {
      success: true,
      data: {
        path: '/Users/test/hello.js',
        replacements: 3,
        backup_path: '/Users/test/hello.js.backup.123456789'
      }
    };

    const formatted = SmartToolResultFormatter.format('edit_file', editResult);
    
    console.log('Edit file formatting:', formatted);
    
    expect(formatted).toContain('✏️ File Edited');
    expect(formatted).toContain('**File:** `/Users/test/hello.js`');
    expect(formatted).toContain('**Replacements:** 3');
    expect(formatted).toContain('*Backup created at:* `hello.js.backup.123456789`');
    expect(formatted).toContain('successfully modified');
  });

  it('should format edit with no backup', () => {
    const editResult = {
      success: true,
      data: {
        path: '/test/file.txt',
        replacements: 1
        // no backup_path
      }
    };

    const formatted = SmartToolResultFormatter.format('edit_file', editResult);
    
    expect(formatted).toContain('✏️ File Edited');
    expect(formatted).toContain('**Replacements:** 1');
    expect(formatted).not.toContain('Backup created');
    
    console.log('Edit without backup formatting:', formatted);
  });
});