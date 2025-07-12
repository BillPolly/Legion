import { 
  PACKAGE_NAME, 
  PACKAGE_VERSION, 
  getPackageInfo,
  LLMClient,
  MaxRetriesExceededError,
  ValidationError
} from '../src/index';

describe('LLM Package', () => {
  it('should export package name correctly', () => {
    expect(PACKAGE_NAME).toBe('llm');
  });

  it('should return package info', () => {
    const info = getPackageInfo();
    expect(info.name).toBe('llm');
    expect(info.version).toBe('1.0.0');
    expect(info.ready).toBe(true);
    expect(info.description).toContain('LLM client');
  });

  it('should export main classes', () => {
    expect(LLMClient).toBeDefined();
    expect(MaxRetriesExceededError).toBeDefined();
    expect(ValidationError).toBeDefined();
  });

  it('should create error instances', () => {
    const maxRetriesError = new MaxRetriesExceededError('Test error');
    expect(maxRetriesError.name).toBe('MaxRetriesExceededError');
    expect(maxRetriesError.message).toBe('Test error');

    const validationError = new ValidationError('Validation failed');
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.message).toBe('Validation failed');
  });
});
