/**
 * Test Tool Registry Pattern Compatibility
 */

import { describe, test, expect } from '@jest/globals';
import { GenerateEventHandlerTool } from '../src/tools/GenerateEventHandlerTool.js';

describe('Tool Registry Pattern Compatibility', () => {
  let tool;

  beforeEach(() => {
    tool = new GenerateEventHandlerTool();
  });

  test('should test current Tool base class behavior', async () => {
    const args = {
      event: 'click',
      action: 'console.log("test");'
    };

    // Call execute() - the base class method
    const result = await tool.execute(args);
    
    console.log('Execute result structure:', Object.keys(result));
    console.log('Result success:', result.success);
    console.log('Result data keys:', result.data ? Object.keys(result.data) : 'no data property');
    
    // Test the actual structure we get
    if (result.success !== undefined) {
      // New Tool base class format: {success, data}
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('code');
    } else {
      // Old direct format: {code, handlerName, ...}
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('handlerName');
    }
  });

  test('should check if _execute method exists', () => {
    const hasNewMethod = typeof tool._execute === 'function';
    const hasOldMethod = typeof tool.execute === 'function';
    
    console.log('Has _execute method:', hasNewMethod);
    console.log('Has execute method:', hasOldMethod);
    
    expect(hasOldMethod).toBe(true); // Should always have execute (base class)
    
    if (hasNewMethod) {
      console.log('Tool is using new pattern (_execute)');
    } else {
      console.log('Tool is using old pattern (execute override)');
    }
  });

  test('should check Tool base class inheritance', () => {
    expect(tool.schema).toBeDefined();
    expect(tool.name).toBe('generate_event_handler');
    expect(tool.description).toBeDefined();
  });
});