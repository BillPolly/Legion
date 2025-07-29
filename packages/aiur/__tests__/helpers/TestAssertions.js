/**
 * TestAssertions - Common test assertions for Aiur testing
 * 
 * Provides reusable assertion functions with clear error messages.
 */

export class TestAssertions {
  /**
   * Assert that a welcome message contains schemas
   */
  static assertWelcomeMessage(message) {
    expect(message).toBeDefined();
    expect(message.type).toBe('welcome');
    expect(message.clientId).toBeDefined();
    expect(message.serverVersion).toBeDefined();
    expect(message.capabilities).toBeInstanceOf(Array);
    
    // Verify schema definitions are included
    expect(message.schemas).toBeDefined();
    expect(typeof message.schemas).toBe('object');
    expect(message.messageTypes).toBeDefined();
    expect(Array.isArray(message.messageTypes)).toBe(true);
    
    console.log(`✓ Welcome message valid with ${Object.keys(message.schemas).length} schemas`);
  }

  /**
   * Assert that a session was created successfully
   */
  static assertSessionCreated(response) {
    expect(response).toBeDefined();
    expect(response.type).toBe('session_created');
    expect(response.success).toBe(true);
    expect(response.sessionId).toBeDefined();
    expect(typeof response.sessionId).toBe('string');
    expect(response.codecEnabled).toBeDefined();
    
    console.log(`✓ Session created: ${response.sessionId}`);
  }

  /**
   * Assert that a tool response is valid
   */
  static assertToolResponse(response, expectSuccess = true) {
    expect(response).toBeDefined();
    expect(response.type).toBe('tool_response');
    expect(response.requestId).toBeDefined();
    
    if (expectSuccess) {
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      console.log('✓ Tool response successful');
    } else {
      expect(response.error).toBeDefined();
      expect(response.error.message).toBeDefined();
      console.log(`✓ Tool response failed as expected: ${response.error.message}`);
    }
  }

  /**
   * Assert that a module was loaded successfully
   */
  static assertModuleLoaded(response, moduleName) {
    this.assertToolResponse(response, true);
    
    const result = response.result;
    expect(result).toBeDefined();
    
    // Check if it's a successful module load
    if (result.success !== undefined) {
      expect(result.success).toBe(true);
    }
    
    console.log(`✓ Module loaded: ${moduleName}`);
  }

  /**
   * Assert that tools list contains expected tools
   */
  static assertToolsList(response, expectedTools = []) {
    this.assertToolResponse(response, true);
    
    const result = response.result;
    expect(result).toBeDefined();
    expect(result.tools).toBeDefined();
    expect(Array.isArray(result.tools)).toBe(true);
    
    // Check for expected tools
    expectedTools.forEach(toolName => {
      const tool = result.tools.find(t => t.name === toolName);
      expect(tool).toBeDefined();
      expect(tool.description).toBeDefined();
    });
    
    console.log(`✓ Tools list contains ${result.tools.length} tools`);
  }

  /**
   * Assert that a calculation result is correct
   */
  static assertCalculationResult(response, expected) {
    this.assertToolResponse(response, true);
    
    const result = response.result;
    expect(result).toBeDefined();
    
    // Handle different result formats
    const actualResult = result.result !== undefined ? result.result : result.data?.result;
    expect(actualResult).toBeDefined();
    expect(actualResult).toBe(expected);
    
    console.log(`✓ Calculation result: ${actualResult}`);
  }

  /**
   * Assert that file operations work correctly
   */
  static assertFileOperation(response, expectSuccess = true) {
    this.assertToolResponse(response, expectSuccess);
    
    if (expectSuccess) {
      const result = response.result;
      expect(result).toBeDefined();
      expect(result.success !== false).toBe(true); // Allow success to be true or undefined
      console.log('✓ File operation successful');
    }
  }

  /**
   * Assert that an error response has expected format
   */
  static assertErrorResponse(response, expectedMessagePattern) {
    expect(response).toBeDefined();
    expect(response.type).toBe('error');
    expect(response.error).toBeDefined();
    expect(response.error.message).toBeDefined();
    
    if (expectedMessagePattern) {
      expect(response.error.message).toMatch(expectedMessagePattern);
    }
    
    console.log(`✓ Error response: ${response.error.message}`);
  }

  /**
   * Assert that message has codec validation
   */
  static assertCodecValidation(message) {
    expect(message).toBeDefined();
    expect(message.type).toBeDefined();
    expect(typeof message.type).toBe('string');
    
    // Basic structure validation
    expect(message.messageId || message.requestId).toBeDefined();
    expect(message.timestamp || message.requestId).toBeDefined(); // Some form of ID/timestamp
    
    console.log(`✓ Message has codec structure: ${message.type}`);
  }

  /**
   * Generic assertion helper
   */
  static assert(condition, message) {
    expect(condition).toBe(true);
    if (message) {
      console.log(`✓ ${message}`);
    }
  }

  /**
   * Assert object has expected properties
   */
  static assertHasProperties(obj, properties) {
    expect(obj).toBeDefined();
    expect(typeof obj).toBe('object');
    
    properties.forEach(prop => {
      expect(obj[prop]).toBeDefined();
    });
    
    console.log(`✓ Object has properties: ${properties.join(', ')}`);
  }
}