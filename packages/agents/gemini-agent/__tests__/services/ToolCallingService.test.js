import ToolCallingService from '../../src/services/ToolCallingService';

describe('ToolCallingService', () => {
  let service;

  beforeEach(() => {
    service = new ToolCallingService();
  });

  test('should register a tool', () => {
    const handler = (() => 'mock');
    service.registerTool('testTool', handler);
    expect(service.registeredTools.has('testTool')).toBeTruthy();
  });

  test('should execute registered tool', async () => {
    let handlerCalled = false;
    let handlerArgs = null;
    const handler = (args) => {
      handlerCalled = true;
      handlerArgs = args;
      return Promise.resolve('result');
    };
    service.registerTool('testTool', handler);
    
    const result = await service.executeTool('testTool', { param: 'value' });
    
    expect(handlerCalled).toBe(true);
    expect(handlerArgs).toEqual({ param: 'value' });
    expect(result).toBe('result');
  });

  test('should throw error for unregistered tool', async () => {
    await expect(service.executeTool('nonexistent', {})).rejects
      .toThrow('Tool nonexistent not found');
  });
});