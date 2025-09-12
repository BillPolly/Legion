/**
 * List Files Formatter Test with Real Data
 */

import { SmartToolResultFormatter } from '../../src/utils/SmartToolResultFormatter.js';

describe('List Files Formatter Test', () => {
  it('should format real list_files result beautifully', () => {
    // Use actual data structure from list_files tool
    const realListResult = {
      success: true,
      data: {
        path: '/Users/test/project',
        entries: [
          { name: '__tests__', type: 'directory', size: 384, modified: '2025-09-11T20:00:00.000Z' },
          { name: 'src', type: 'directory', size: 256, modified: '2025-09-11T20:00:00.000Z' },
          { name: 'package.json', type: 'file', size: 1093, modified: '2025-09-11T20:00:00.000Z' },
          { name: 'jest.config.js', type: 'file', size: 324, modified: '2025-09-11T20:00:00.000Z' }
        ]
      }
    };

    const formatted = SmartToolResultFormatter.format('list_files', realListResult);
    
    console.log('List files formatting:', formatted);
    
    expect(formatted).toContain('📁 Directory Listing');
    expect(formatted).toContain('📂 __tests__');
    expect(formatted).toContain('📂 src');
    expect(formatted).toContain('📄 package.json');
    expect(formatted).toContain('📄 jest.config.js');
    expect(formatted).toContain('384 bytes');
    expect(formatted).toContain('1 KB');
    expect(formatted).toContain('324 bytes');
  });

  it('should format empty directory', () => {
    const emptyResult = {
      success: true,
      data: {
        path: '/empty/dir',
        entries: []
      }
    };

    const formatted = SmartToolResultFormatter.format('list_files', emptyResult);
    
    expect(formatted).toContain('📁 Directory Listing');
    expect(formatted).toContain('*Directory is empty*');
    
    console.log('Empty directory formatting:', formatted);
  });
});