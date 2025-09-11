import RetryHelper from '../RetryHelper.js';

describe('RetryHelper', () => {
  let retryHelper;

  beforeEach(() => {
    retryHelper = new RetryHelper(3, 100);
  });

  test('should succeed on first attempt', async () => {
    let callCount = 0;
    const operation = async () => {
      callCount++;
      return 'success';
    };
    const result = await retryHelper.retry(operation);
    expect(result).toBe('success');
    expect(callCount).toBe(1);
  });

  test('should retry on failure and eventually succeed', async () => {
    let callCount = 0;
    const operation = async () => {
      callCount++;
      if (callCount === 1) throw new Error('Attempt 1');
      if (callCount === 2) throw new Error('Attempt 2');
      return 'success';
    };

    const result = await retryHelper.retry(operation);
    expect(result).toBe('success');
    expect(callCount).toBe(3);
  });

  test('should throw after max attempts', async () => {
    let callCount = 0;
    const operation = async () => {
      callCount++;
      throw new Error('Always fails');
    };
    
    await expect(retryHelper.retry(operation))
      .rejects
      .toThrow('Always fails');
    expect(callCount).toBe(3);
  });
});
