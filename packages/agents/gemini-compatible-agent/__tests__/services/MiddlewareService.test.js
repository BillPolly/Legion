import { MiddlewareService } from '../../src/services/MiddlewareService';

describe('MiddlewareService', () => {
  let middlewareService;

  beforeEach(() => {
    middlewareService = new MiddlewareService();
  });

  test('should register middleware correctly', () => {
    const mockMiddleware = () => 'test';
    middlewareService.registerMiddleware('test', mockMiddleware);
    expect(middlewareService.getMiddleware('test')).toBe(mockMiddleware);
  });

  test('should throw error for invalid middleware', () => {
    expect(() => {
      middlewareService.registerMiddleware('test', 'not a function');
    }).toThrow('Middleware must be a function');
  });

  test('should throw error when getting non-existent middleware', () => {
    expect(() => {
      middlewareService.getMiddleware('nonexistent');
    }).toThrow("Middleware 'nonexistent' not found");
  });
});
