/**
 * TestAssertions - Common assertions for WebSocket integration tests
 */

// Import jest globals
import { expect } from '@jest/globals';

// Define fail function for assertions
const fail = (message) => {
  throw new Error(message);
};

export class TestAssertions {
  /**
   * Assert that a response indicates success
   */
  static assertSuccess(response) {
    expect(response).toBeDefined();
    if (response.result) {
      // Error should be null, undefined, or a falsy value for success
      expect(response.result.error).toBeFalsy();
      if (response.result.success !== undefined) {
        expect(response.result.success).toBe(true);
      }
    } else if (response.success !== undefined) {
      expect(response.success).toBe(true);
    }
  }

  /**
   * Assert that a response indicates failure
   */
  static assertError(response, errorPattern) {
    expect(response).toBeDefined();
    if (response.error) {
      // Direct error in response
      const errorMsg = response.error.message || response.error;
      expect(errorMsg).toBeDefined();
      if (errorPattern) {
        expect(errorMsg).toMatch(errorPattern);
      }
    } else if (response.result) {
      // Error in result object
      if (response.result.error) {
        const errorMsg = response.result.error.message || response.result.error;
        expect(errorMsg).toBeDefined();
        if (errorPattern) {
          expect(errorMsg).toMatch(errorPattern);
        }
      } else if (response.result.success === false) {
        // Success is false, check for error message in data or other fields
        const errorMsg = response.result.message || response.result.data?.error || 'Operation failed';
        if (errorPattern) {
          expect(errorMsg).toMatch(errorPattern);
        }
      } else {
        fail('Response does not contain error information');
      }
    } else {
      fail('Response does not contain error information');
    }
  }

  /**
   * Assert module loaded successfully
   */
  static assertModuleLoaded(response, moduleName) {
    this.assertSuccess(response);
    const result = response.result || response;
    expect(result.module).toBe(moduleName);
    expect(result.toolsLoaded).toBeDefined();
    expect(Array.isArray(result.toolsLoaded)).toBe(true);
    expect(result.toolsLoaded.length).toBeGreaterThan(0);
  }

  /**
   * Assert tool list contains expected tools
   */
  static assertToolsInclude(response, expectedTools) {
    expect(response.result).toBeDefined();
    expect(response.result.tools).toBeDefined();
    expect(Array.isArray(response.result.tools)).toBe(true);
    
    const toolNames = response.result.tools.map(t => t.name);
    expectedTools.forEach(toolName => {
      expect(toolNames).toContain(toolName);
    });
  }

  /**
   * Assert file operation success
   */
  static assertFileOperation(response) {
    this.assertSuccess(response);
    const result = response.result || response;
    expect(result.success).toBe(true);
  }

  /**
   * Assert search results
   */
  static assertSearchResults(response) {
    this.assertSuccess(response);
    const result = response.result || response;
    
    // Handle different search result formats
    if (result.data) {
      expect(result.data).toBeDefined();
      // Could have organic, results, or other fields
      expect(
        result.data.organic || 
        result.data.results || 
        result.data.items
      ).toBeDefined();
    } else if (result.organic || result.results) {
      expect(result.organic || result.results).toBeDefined();
    }
  }

  /**
   * Assert calculation result
   */
  static assertCalculation(response, expectedResult) {
    this.assertSuccess(response);
    const result = response.result || response;
    
    if (result.data && result.data.result !== undefined) {
      expect(result.data.result).toBe(expectedResult);
    } else if (result.result !== undefined) {
      expect(result.result).toBe(expectedResult);
    } else if (result.value !== undefined) {
      expect(result.value).toBe(expectedResult);
    } else {
      fail('No calculation result found in response');
    }
  }

  /**
   * Assert event format
   */
  static assertEventFormat(event) {
    expect(event).toBeDefined();
    expect(event.type).toBeDefined();
    expect(event.timestamp).toBeDefined();
    
    if (event.type === 'progress') {
      expect(event.data).toBeDefined();
      expect(event.data.percentage).toBeDefined();
      expect(typeof event.data.percentage).toBe('number');
    }
  }

  /**
   * Assert GitHub operation result
   */
  static assertGitHubOperation(response) {
    this.assertSuccess(response);
    const result = response.result || response;
    
    // GitHub operations return various formats
    if (result.success !== undefined) {
      expect(result.success).toBe(true);
    }
    
    // Check for common GitHub response fields
    if (result.data) {
      expect(result.data).toBeDefined();
    }
  }

  /**
   * Assert LLM response
   */
  static assertLLMResponse(response) {
    this.assertSuccess(response);
    const result = response.result || response;
    
    // LLM responses can have various formats
    expect(
      result.content || 
      result.response || 
      result.text ||
      result.message
    ).toBeDefined();
  }

  /**
   * Assert JSON operation
   */
  static assertJSONOperation(response, expectedKeys = []) {
    this.assertSuccess(response);
    const result = response.result || response;
    
    if (expectedKeys.length > 0) {
      expectedKeys.forEach(key => {
        expect(result).toHaveProperty(key);
      });
    }
  }

  /**
   * Assert progress events were received
   */
  static assertProgressEvents(events) {
    expect(events.length).toBeGreaterThan(0);
    
    const progressEvents = events.filter(e => e.type === 'progress');
    expect(progressEvents.length).toBeGreaterThan(0);
    
    // Check progress sequence
    progressEvents.forEach(event => {
      this.assertEventFormat(event);
      expect(event.data.percentage).toBeGreaterThanOrEqual(0);
      expect(event.data.percentage).toBeLessThanOrEqual(100);
    });
  }
}