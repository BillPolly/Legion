/**
 * Test to debug what the base Tool class does with error codes
 */

import { Tool } from '@legion/tools-registry';

class TestTool extends Tool {
  constructor() {
    super({
      name: 'test_tool',
      description: 'Test tool for debugging',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} }
    });
  }

  async _execute(params) {
    if (params.shouldFail) {
      const error = new Error('Test error message');
      error.code = 'TEST_ERROR_CODE';
      error.field = 'test_field';
      throw error;
    }
    
    return { result: 'success', data: params };
  }
}

describe('Tool Base Class Error Handling Debug', () => {
  test('Check what base Tool class does with error codes', async () => {
    const tool = new TestTool();
    
    console.log('🧪 Testing successful execution...');
    const successResult = await tool.execute({ shouldFail: false });
    console.log('✅ Success result:', JSON.stringify(successResult, null, 2));
    
    console.log('\n🧪 Testing error with code...');
    const errorResult = await tool.execute({ shouldFail: true });
    console.log('❌ Error result:', JSON.stringify(errorResult, null, 2));
    console.log('❌ Error.code:', errorResult.error?.code);
    console.log('❌ Error.message:', errorResult.error?.message);
    
    expect(errorResult.success).toBe(false);
    expect(errorResult.error.code).toBe('TEST_ERROR_CODE');
  });
});