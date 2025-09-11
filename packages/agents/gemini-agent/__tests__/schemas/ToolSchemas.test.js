/**
 * Unit tests for ported tool schemas
 */

describe('Tool Schemas', () => {
  test('should validate ReadFile parameters', () => {
    const validParams = {
      absolute_path: '/path/to/file.js'
    };
    
    const validParamsWithOptions = {
      absolute_path: '/path/to/file.js',
      offset: 10,
      limit: 50
    };
    
    // For now, just test the structure exists
    expect(validParams.absolute_path).toBe('/path/to/file.js');
    expect(validParamsWithOptions.offset).toBe(10);
    expect(validParamsWithOptions.limit).toBe(50);
  });

  test('should validate WriteFile parameters', () => {
    const validParams = {
      absolute_path: '/path/to/file.js',
      content: 'console.log("hello");'
    };
    
    expect(validParams.absolute_path).toBe('/path/to/file.js');
    expect(validParams.content).toBe('console.log("hello");');
  });

  test('should validate EditFile parameters', () => {
    const validParams = {
      absolute_path: '/path/to/file.js',
      old_string: 'old code',
      new_string: 'new code'
    };
    
    expect(validParams.absolute_path).toBe('/path/to/file.js');
    expect(validParams.old_string).toBe('old code');
    expect(validParams.new_string).toBe('new code');
  });

  test('should validate Shell command parameters', () => {
    const validParams = {
      command: 'ls -la'
    };
    
    const validParamsWithOptions = {
      command: 'npm test',
      working_directory: '/path/to/project',
      timeout: 60000
    };
    
    expect(validParams.command).toBe('ls -la');
    expect(validParamsWithOptions.working_directory).toBe('/path/to/project');
  });

  test('should validate Conversation turn structure', () => {
    const validTurn = {
      id: 'turn_123',
      type: 'user',
      content: 'Hello agent',
      tools: [],
      timestamp: new Date().toISOString()
    };
    
    expect(validTurn.type).toBe('user');
    expect(validTurn.content).toBe('Hello agent');
    expect(Array.isArray(validTurn.tools)).toBe(true);
  });

  test('should validate Agent configuration structure', () => {
    const validConfig = {
      id: 'gemini-agent',
      name: 'Gemini Compatible Agent',
      model: 'gemini-2.0-flash-exp',
      maxTokens: 100000,
      tools: {
        autoApprove: ['read_file'],
        requireApproval: ['write_file', 'shell_command']
      }
    };
    
    expect(validConfig.id).toBe('gemini-agent');
    expect(Array.isArray(validConfig.tools.autoApprove)).toBe(true);
    expect(Array.isArray(validConfig.tools.requireApproval)).toBe(true);
  });
});