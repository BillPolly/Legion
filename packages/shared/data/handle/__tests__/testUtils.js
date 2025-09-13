/**
 * Test utilities for Handle package tests
 * Provides mock helpers that work with or without Jest globals
 */

/**
 * Create a mock function that works with or without Jest
 */
export function createMockFunction(returnValue = undefined) {
  let implementation = null;
  
  const mockFn = function(...args) {
    mockFn.calls.push(args);
    
    // If there's a custom implementation, use it
    if (implementation) {
      return implementation(...args);
    }
    
    // Otherwise use the return value
    if (mockFn._returnValue !== undefined) {
      return mockFn._returnValue;
    }
    return returnValue;
  };
  
  mockFn.calls = [];
  mockFn._returnValue = returnValue;
  
  mockFn.mockReturnValue = function(value) {
    mockFn._returnValue = value;
    return mockFn;
  };
  
  mockFn.mockImplementation = function(impl) {
    implementation = impl;
    return mockFn;
  };
  
  // Add Jest compatibility matchers
  mockFn.mock = {
    calls: mockFn.calls
  };
  
  return mockFn;
}

/**
 * Custom matcher to check if mock was called with specific arguments
 * Add this to expect extend or use directly
 */
export function toHaveBeenCalledWith(mockFn, ...expectedArgs) {
  if (!mockFn.calls) {
    throw new Error('Not a mock function');
  }
  
  const hasMatchingCall = mockFn.calls.some(callArgs => {
    if (callArgs.length !== expectedArgs.length) return false;
    
    return expectedArgs.every((expected, index) => {
      const actual = callArgs[index];
      
      // Handle expect.any(Function) type matchers
      if (expected && typeof expected === 'object' && expected.asymmetricMatch) {
        return expected.asymmetricMatch(actual);
      }
      
      // Deep equality check for objects
      if (typeof expected === 'object' && expected !== null) {
        return JSON.stringify(expected) === JSON.stringify(actual);
      }
      
      return expected === actual;
    });
  });
  
  return {
    pass: hasMatchingCall,
    message: () => hasMatchingCall 
      ? `Expected mock not to have been called with ${JSON.stringify(expectedArgs)}`
      : `Expected mock to have been called with ${JSON.stringify(expectedArgs)}, but was called with ${JSON.stringify(mockFn.calls)}`
  };
}

/**
 * Create a mock ResourceManager for testing
 */
export function createMockResourceManager() {
  let subscriptionCounter = 0;
  
  const subscribeFn = createMockFunction();
  subscribeFn.mockImplementation(() => {
    subscriptionCounter++;
    return {
      id: `sub-${Date.now()}-${subscriptionCounter}`,
      unsubscribe: createMockFunction()
    };
  });
  
  return {
    query: createMockFunction([]),
    subscribe: subscribeFn,
    getSchema: createMockFunction(null),
    update: createMockFunction(true)
  };
}