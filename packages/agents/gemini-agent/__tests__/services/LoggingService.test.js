import { LoggingService } from '../../src/services/LoggingService.js';

describe('LoggingService', () => {
  let logger;
  const originalConsole = { ...console };
  let errorCalls = [];
  let warnCalls = [];  
  let infoCalls = [];
  let debugCalls = [];

  beforeEach(() => {
    logger = new LoggingService({ level: 'debug' });
    
    // Reset call tracking
    errorCalls = [];
    warnCalls = [];
    infoCalls = [];
    debugCalls = [];
    
    // Mock console methods
    console.error = (...args) => errorCalls.push(args);
    console.warn = (...args) => warnCalls.push(args);
    console.info = (...args) => infoCalls.push(args);
    console.debug = (...args) => debugCalls.push(args);
  });

  afterEach(() => {
    // Restore console methods
    Object.assign(console, originalConsole);
  });

  test('should log messages at different levels', () => {
    logger.error('error message');
    logger.warn('warning message');
    logger.info('info message');
    logger.debug('debug message');

    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0]).toEqual(['error message', {}]);
    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0]).toEqual(['warning message', {}]);
    expect(infoCalls).toHaveLength(1);
    expect(infoCalls[0]).toEqual(['info message', {}]);
    expect(debugCalls).toHaveLength(1);
    expect(debugCalls[0]).toEqual(['debug message', {}]);
  });

  test('should respect log level settings', () => {
    logger = new LoggingService({ level: 'warn' });
    
    logger.error('error message');
    logger.warn('warning message');
    logger.info('info message');
    logger.debug('debug message');

    expect(errorCalls).toHaveLength(1);
    expect(warnCalls).toHaveLength(1);
    expect(infoCalls).toHaveLength(0);
    expect(debugCalls).toHaveLength(0);
  });

  test('should maintain history of log entries', () => {
    logger.info('test message');
    const history = logger.getHistory();
    
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      level: 'info',
      message: 'test message'
    });
    expect(history[0].timestamp).toBeDefined();
  });
});