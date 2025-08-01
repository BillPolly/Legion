/**
 * Tests for test utility helpers
 */
import { describe, test, expect } from '@jest/globals';

describe('Test Helpers', () => {
  test('should create mock ActorSpace', async () => {
    const { createMockActorSpace } = await import('../../utils/testHelpers.js');
    const mockSpace = createMockActorSpace();
    
    expect(mockSpace).toBeDefined();
    expect(mockSpace.spaceId).toBeDefined();
    expect(typeof mockSpace.register).toBe('function');
    expect(typeof mockSpace.addChannel).toBe('function');
  });

  test('should create mock Actor', async () => {
    const { createMockActor } = await import('../../utils/testHelpers.js');
    const mockActor = createMockActor();
    
    expect(mockActor).toBeActor();
    expect(mockActor.receivedMessages).toBeDefined();
    expect(Array.isArray(mockActor.receivedMessages)).toBe(true);
  });

  test('should create mock Umbilical', async () => {
    const { createMockUmbilical } = await import('../../utils/testHelpers.js');
    const mockUmbilical = createMockUmbilical({
      dom: document.createElement('div'),
      theme: 'dark'
    });
    
    expect(mockUmbilical).toBeDefined();
    expect(mockUmbilical.dom).toBeDefined();
    expect(mockUmbilical.theme).toBe('dark');
  });

  test('should wait for condition', async () => {
    const { waitFor } = await import('../../utils/testHelpers.js');
    let value = false;
    
    setTimeout(() => { value = true; }, 50);
    
    await waitFor(() => value === true);
    expect(value).toBe(true);
  });

  test('should timeout if condition not met', async () => {
    const { waitFor } = await import('../../utils/testHelpers.js');
    let value = false;
    
    await expect(
      waitFor(() => value === true, { timeout: 100 })
    ).rejects.toThrow('Timeout waiting for condition');
  });
});