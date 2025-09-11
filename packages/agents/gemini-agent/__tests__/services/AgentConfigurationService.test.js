import { AgentConfigurationService } from '../../src/services/AgentConfigurationService.js';

describe('AgentConfigurationService', () => {
  let configService;

  beforeEach(() => {
    configService = new AgentConfigurationService();
  });

  test('should set and get configuration values', () => {
    configService.setConfig('apiKey', 'test-key');
    expect(configService.getConfig('apiKey')).toBe('test-key');
  });

  test('should load multiple configuration values', () => {
    const testConfig = {
      apiKey: 'test-key',
      baseUrl: 'http://test.com',
      timeout: 5000
    };
    configService.loadConfiguration(testConfig);
    expect(configService.getConfig('apiKey')).toBe('test-key');
    expect(configService.getConfig('baseUrl')).toBe('http://test.com');
    expect(configService.getConfig('timeout')).toBe(5000);
  });

  test('should return all configuration as object', () => {
    const testConfig = {
      apiKey: 'test-key',
      baseUrl: 'http://test.com'
    };
    configService.loadConfiguration(testConfig);
    const allConfig = configService.getAllConfig();
    expect(allConfig).toEqual(testConfig);
  });
});
