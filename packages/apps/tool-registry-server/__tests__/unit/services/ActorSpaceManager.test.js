/**
 * Unit tests for ActorSpaceManager
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ActorSpaceManager } from '../../../src/services/ActorSpaceManager.js';

describe('ActorSpaceManager', () => {
  let manager;
  let mockRegistryService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRegistryService = {
      getTool: jest.fn(),
      listTools: jest.fn(),
      getRegistry: jest.fn().mockReturnValue({})
    };
    
    manager = new ActorSpaceManager(mockRegistryService);
  });
  
  describe('createActorSpace', () => {
    it('should create an actor space with three actors', async () => {
      const connectionId = 'test-connection-123';
      
      const actorSpace = await manager.createActorSpace(connectionId);
      
      // Verify ActorSpace was created
      expect(actorSpace).toBeDefined();
      expect(actorSpace.spaceId).toBe(`server-${connectionId}`);
      
      // Verify actors were registered (no database actor)
      expect(actorSpace.guidToObject.size).toBe(2);
      expect(actorSpace.guidToObject.has(`server-${connectionId}-registry`)).toBe(true);
      expect(actorSpace.guidToObject.has(`server-${connectionId}-search`)).toBe(true);
      
      // Verify actor count
      expect(manager.actorCount).toBe(2);
    });
    
    it('should store actor space with metadata', async () => {
      const connectionId = 'test-connection-456';
      
      await manager.createActorSpace(connectionId);
      
      const spaceInfo = manager.actorSpaces.get(connectionId);
      expect(spaceInfo).toBeDefined();
      expect(spaceInfo.space).toBeDefined();
      expect(spaceInfo.actors).toHaveProperty('registry');
      expect(spaceInfo.actors).toHaveProperty('search');
      // NOTE: database actor removed
      expect(spaceInfo.createdAt).toBeInstanceOf(Date);
    });
  });
  
  describe('setupRemoteActors', () => {
    it('should setup remote actors for client connections', async () => {
      const connectionId = 'test-connection-789';
      const mockChannel = {
        makeRemote: jest.fn().mockImplementation((guid) => ({ 
          guid,
          receive: jest.fn() 
        }))
      };
      const clientActors = {
        registry: 'client-registry-guid',
        search: 'client-search-guid'
      };
      
      // First create the actor space
      await manager.createActorSpace(connectionId);
      const spaceInfo = manager.actorSpaces.get(connectionId);
      
      // Setup remote actors
      const remoteActors = manager.setupRemoteActors(connectionId, mockChannel, clientActors);
      
      expect(mockChannel.makeRemote).toHaveBeenCalledTimes(2);
      expect(mockChannel.makeRemote).toHaveBeenCalledWith('client-registry-guid');
      expect(mockChannel.makeRemote).toHaveBeenCalledWith('client-search-guid');
      
      // Verify actors have setRemoteActor method called
      expect(spaceInfo.actors.registry.remoteActor).toBeDefined();
      expect(spaceInfo.actors.search.remoteActor).toBeDefined();
      // NOTE: database actor removed
    });
    
    it('should throw error if actor space not found', () => {
      const mockChannel = { makeRemote: jest.fn() };
      
      expect(() => {
        manager.setupRemoteActors('unknown-connection', mockChannel, {});
      }).toThrow('No actor space found for unknown-connection');
    });
  });
  
  describe('getActorSpace', () => {
    it('should return actor space for connection', async () => {
      const connectionId = 'test-connection-get';
      await manager.createActorSpace(connectionId);
      
      const space = manager.getActorSpace(connectionId);
      
      expect(space).toBeDefined();
      expect(space.spaceId).toBe(`server-${connectionId}`);
    });
    
    it('should return null for unknown connection', () => {
      const space = manager.getActorSpace('unknown');
      
      expect(space).toBeNull();
    });
  });
  
  describe('getActorGuids', () => {
    it('should return actor GUIDs for connection', async () => {
      const connectionId = 'test-connection-guids';
      
      await manager.createActorSpace(connectionId);
      
      const guids = manager.getActorGuids(connectionId);
      
      expect(guids).toEqual({
        registry: `server-${connectionId}-registry`,
        search: `server-${connectionId}-search`
      });
    });
    
    it('should return empty object for unknown connection', () => {
      const guids = manager.getActorGuids('unknown');
      
      expect(guids).toEqual({});
    });
  });
  
  describe('cleanupActorSpace', () => {
    it('should cleanup actor space and actors', async () => {
      const connectionId = 'test-connection-cleanup';
      
      await manager.createActorSpace(connectionId);
      expect(manager.actorCount).toBe(2);
      
      await manager.cleanupActorSpace(connectionId);
      
      expect(manager.actorSpaces.has(connectionId)).toBe(false);
      expect(manager.actorCount).toBe(0);
    });
    
    it('should handle missing actor space gracefully', async () => {
      await manager.cleanupActorSpace('unknown');
      // Should not throw
    });
  });
  
  describe('getStats', () => {
    it('should return statistics about actor spaces', async () => {
      await manager.createActorSpace('conn-1');
      await manager.createActorSpace('conn-2');
      
      const stats = manager.getStats();
      
      expect(stats.totalSpaces).toBe(2);
      expect(stats.totalActors).toBe(4);
      expect(stats.spaces).toHaveLength(2);
      expect(stats.spaces[0]).toHaveProperty('createdAt');
      expect(stats.spaces[0]).toHaveProperty('duration');
      expect(stats.spaces[0].actors).toEqual(['registry', 'search']);
    });
  });
  
  describe('cleanup', () => {
    it('should cleanup all actor spaces', async () => {
      await manager.createActorSpace('conn-1');
      await manager.createActorSpace('conn-2');
      await manager.createActorSpace('conn-3');
      
      expect(manager.actorCount).toBe(6);
      
      await manager.cleanup();
      
      expect(manager.actorSpaces.size).toBe(0);
      expect(manager.actorCount).toBe(0);
    });
  });
});