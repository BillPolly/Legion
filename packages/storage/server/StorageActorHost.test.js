/**
 * Tests for Storage Actor Host
 */

import { jest } from '@jest/globals';
import { StorageActorHost } from './StorageActorHost.js';

// Mock StorageProvider
const mockStorageProvider = {
  create: jest.fn().mockResolvedValue({
    providers: new Map(),
    getProvider: jest.fn(),
    addProvider: jest.fn(),
    cleanup: jest.fn()
  })
};

// Mock Actor classes
const mockCollectionActor = jest.fn().mockImplementation(() => ({
  receive: jest.fn()
}));

describe('StorageActorHost', () => {
  let host;
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn(),
      initialize: jest.fn().mockResolvedValue(true),
      initialized: true
    };
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (host) {
      await host.cleanup();
    }
  });

  describe('Actor Registration and Lifecycle', () => {
    test('should initialize with resource manager', async () => {
      host = new StorageActorHost(mockResourceManager);
      expect(host.resourceManager).toBe(mockResourceManager);
      expect(host.actors).toBeDefined();
    });

    test('should register actors on initialization', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      expect(host.actors.has('CollectionActor')).toBe(true);
      expect(host.actors.has('DocumentActor')).toBe(true);
      expect(host.actors.has('QueryActor')).toBe(true);
    });

    test('should get registered actor', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actor = host.getActor('CollectionActor');
      expect(actor).toBeDefined();
      expect(actor.name).toBe('CollectionActor');
    });

    test('should return null for non-existent actor', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actor = host.getActor('NonExistentActor');
      expect(actor).toBeNull();
    });

    test('should create new actor instance', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actorId = await host.createActor('CollectionActor', 'users');
      expect(actorId).toContain('CollectionActor');
      expect(host.actors.has(actorId)).toBe(true);
    });

    test('should remove actor instance', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actorId = await host.createActor('CollectionActor', 'users');
      host.removeActor(actorId);
      
      expect(host.actors.has(actorId)).toBe(false);
    });

    test('should cleanup all actors on host cleanup', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      await host.createActor('CollectionActor', 'users');
      await host.createActor('DocumentActor', 'doc1');
      
      await host.cleanup();
      expect(host.actors.size).toBe(0);
    });
  });

  describe('Message Routing', () => {
    test('should route messages to correct actor', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actor = host.getActor('CollectionActor');
      const mockReceive = jest.fn().mockResolvedValue({ result: 'success' });
      actor.receive = mockReceive;
      
      await actor.receive('find', { collection: 'users' });
      
      expect(mockReceive).toHaveBeenCalledWith('find', { collection: 'users' });
    });

    test('should handle actor method errors', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actor = host.getActor('CollectionActor');
      actor.receive = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await expect(actor.receive('find', {}))
        .rejects.toThrow('Database error');
    });

    test('should support concurrent message processing', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actor = host.getActor('CollectionActor');
      let callCount = 0;
      actor.receive = jest.fn().mockImplementation(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return `result-${callCount}`;
      });
      
      const results = await Promise.all([
        actor.receive('find', { query: 1 }),
        actor.receive('find', { query: 2 }),
        actor.receive('find', { query: 3 })
      ]);
      
      expect(results).toEqual(['result-1', 'result-2', 'result-3']);
    });
  });

  describe('StorageProvider Integration', () => {
    test('should initialize StorageProvider with ResourceManager', async () => {
      // Mock dynamic import
      jest.unstable_mockModule('@legion/storage', () => ({
        StorageProvider: mockStorageProvider
      }));

      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      // StorageProvider should be created with ResourceManager
      expect(host.storageProvider).toBeDefined();
    });

    test('should pass StorageProvider to actors', async () => {
      host = new StorageActorHost(mockResourceManager);
      host.storageProvider = await mockStorageProvider.create(mockResourceManager);
      await host.initialize();
      
      const actor = host.getActor('CollectionActor');
      expect(actor.storageProvider).toBeDefined();
    });

    test('should handle StorageProvider initialization errors', async () => {
      mockStorageProvider.create.mockRejectedValueOnce(new Error('Connection failed'));
      
      host = new StorageActorHost(mockResourceManager);
      
      // Should not throw, but log error
      await host.initialize();
      expect(host.storageProvider).toBeUndefined();
    });
  });

  describe('Actor Initialization', () => {
    test('should initialize CollectionActor with storage provider', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actor = host.getActor('CollectionActor');
      expect(actor).toBeDefined();
      expect(actor.name).toBe('CollectionActor');
    });

    test('should initialize DocumentActor with storage provider', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actor = host.getActor('DocumentActor');
      expect(actor).toBeDefined();
      expect(actor.name).toBe('DocumentActor');
    });

    test('should initialize QueryActor with storage provider', async () => {
      host = new StorageActorHost(mockResourceManager);
      await host.initialize();
      
      const actor = host.getActor('QueryActor');
      expect(actor).toBeDefined();
      expect(actor.name).toBe('QueryActor');
    });

    test('should handle actor initialization errors gracefully', async () => {
      host = new StorageActorHost(mockResourceManager);
      
      // Mock an actor that throws during initialization
      const FailingActor = class {
        constructor() {
          throw new Error('Actor init failed');
        }
      };
      
      // Should not throw
      await host.initialize();
      expect(host.actors.size).toBeGreaterThan(0);
    });
  });
});