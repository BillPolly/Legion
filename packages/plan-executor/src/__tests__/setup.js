/**
 * Jest setup for ES modules
 */

// Create mock function factory
function createMockFn() {
  const mockFn = (...args) => {
    mockFn.mock.calls.push(args);
    
    // Use mockImplementation if available
    if (mockFn._mockImplementation) {
      return mockFn._mockImplementation(...args);
    }
    
    if (mockFn._mockResolvedValue !== undefined) {
      return Promise.resolve(mockFn._mockResolvedValue);
    }
    if (mockFn._mockRejectedValue !== undefined) {
      return Promise.reject(mockFn._mockRejectedValue);
    }
    return mockFn._mockReturnValue;
  };
  
  mockFn.mock = {
    calls: [],
    results: []
  };
  
  mockFn._mockReturnValue = undefined;
  mockFn._mockResolvedValue = undefined;
  mockFn._mockRejectedValue = undefined;
  
  mockFn.mockResolvedValue = (value) => {
    mockFn._mockResolvedValue = value;
    return mockFn;
  };
  
  mockFn.mockRejectedValue = (value) => {
    mockFn._mockRejectedValue = value;
    return mockFn;
  };
  
  mockFn.mockReturnValue = (value) => {
    mockFn._mockReturnValue = value;
    return mockFn;
  };
  
  mockFn.mockImplementation = (fn) => {
    mockFn._mockImplementation = fn;
    return mockFn;
  };
  
  return mockFn;
}

// Set global jest object
global.jest = {
  fn: createMockFn
};