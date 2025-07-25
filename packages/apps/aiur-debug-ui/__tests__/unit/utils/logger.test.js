/**
 * Tests for logger utility
 */

import { jest } from '@jest/globals';

// Mock winston module
const mockCreateLogger = jest.fn();
const mockConsoleTransport = jest.fn();
const mockFileTransport = jest.fn();
const mockCombine = jest.fn();
const mockColorize = jest.fn();
const mockTimestamp = jest.fn();
const mockPrintf = jest.fn();
const mockJson = jest.fn();

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn()
};

jest.unstable_mockModule('winston', () => ({
  default: {
    createLogger: mockCreateLogger,
    transports: {
      Console: mockConsoleTransport,
      File: mockFileTransport
    },
    format: {
      combine: mockCombine,
      colorize: mockColorize,
      timestamp: mockTimestamp,
      printf: mockPrintf,
      json: mockJson
    }
  }
}));

// Import after mocking
const { createLogger, createChildLogger } = await import('../../../src/utils/logger.js');

describe('Logger Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateLogger.mockReturnValue(mockLogger);
  });

  describe('createLogger', () => {
    it('should create logger with console transport by default', () => {
      const logger = createLogger();
      
      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          transports: expect.any(Array)
        })
      );
      
      expect(mockConsoleTransport).toHaveBeenCalled();
      expect(mockFileTransport).not.toHaveBeenCalled();
    });

    it('should create logger with custom log level', () => {
      const logger = createLogger({ level: 'debug' });
      
      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });

    it('should disable console transport when console is false', () => {
      const logger = createLogger({ console: false });
      
      expect(mockConsoleTransport).not.toHaveBeenCalled();
    });

    it('should add file transport when file path is provided', () => {
      const logger = createLogger({ 
        file: '/path/to/log.txt',
        console: true
      });
      
      expect(mockConsoleTransport).toHaveBeenCalled();
      expect(mockFileTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: '/path/to/log.txt'
        })
      );
    });

    it('should configure console transport with formatting', () => {
      const logger = createLogger();
      
      expect(mockCombine).toHaveBeenCalled();
      expect(mockColorize).toHaveBeenCalled();
      expect(mockTimestamp).toHaveBeenCalled();
      expect(mockPrintf).toHaveBeenCalled();
    });

    it('should configure file transport with JSON formatting', () => {
      const logger = createLogger({ file: 'test.log' });
      
      // Check that json format was used for file transport
      expect(mockJson).toHaveBeenCalled();
    });

    it('should bind convenience methods', () => {
      const testMockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      
      mockCreateLogger.mockReturnValueOnce(testMockLogger);
      
      const logger = createLogger();
      
      // Test that methods are bound
      const { debug, info, warn, error } = logger;
      
      debug('test');
      info('test');
      warn('test');
      error('test');
      
      expect(testMockLogger.debug).toHaveBeenCalledWith('test');
      expect(testMockLogger.info).toHaveBeenCalledWith('test');
      expect(testMockLogger.warn).toHaveBeenCalledWith('test');
      expect(testMockLogger.error).toHaveBeenCalledWith('test');
    });
  });

  describe('createChildLogger', () => {
    it('should create child logger with default metadata', () => {
      const mockParentLogger = {
        child: jest.fn(() => ({ isChild: true }))
      };
      
      const metadata = { component: 'test', requestId: '123' };
      const childLogger = createChildLogger(mockParentLogger, metadata);
      
      expect(mockParentLogger.child).toHaveBeenCalledWith(metadata);
      expect(childLogger).toEqual({ isChild: true });
    });

    it('should handle empty metadata', () => {
      const mockParentLogger = {
        child: jest.fn(() => ({ isChild: true }))
      };
      
      const childLogger = createChildLogger(mockParentLogger, {});
      
      expect(mockParentLogger.child).toHaveBeenCalledWith({});
    });
  });
});