/**
 * Unit tests for ConfigurableActorSpace
 */

import { jest } from '@jest/globals';
import { ConfigurableActorSpace } from '../src/ConfigurableActorSpace.js';
import { Actor } from '../src/Actor.js';

describe('ConfigurableActorSpace', () => {
  let actorSpace;
  const mockConfig = {
    actorPairs: [
      { name: 'chat', frontend: 'ChatActor', backend: 'ChatAgent' },
      { name: 'terminal', frontend: 'TerminalActor', backend: 'TerminalAgent' },
      { name: 'debug', frontend: 'DebugActor', backend: 'ChatAgent' }
    ]
  };

  class TestActorSpace extends ConfigurableActorSpace {
    async createActor(className, name) {
      // Create mock actors
      const actor = new Actor();
      actor.className = className;
      actor.name = name;
      actor.setRemoteAgent = jest.fn();
      actor.setRemoteActor = jest.fn();
      return actor;
    }
  }

  beforeEach(() => {
    actorSpace = new TestActorSpace('test-space', mockConfig, {
      sessionManager: 'mock-session-manager',
      moduleLoader: 'mock-module-loader'
    });
  });

  describe('constructor', () => {
    test('initializes with correct properties', () => {
      expect(actorSpace.spaceId).toBe('test-space');
      expect(actorSpace.actorConfig).toBe(mockConfig);
      expect(actorSpace.dependencies).toEqual({
        sessionManager: 'mock-session-manager',
        moduleLoader: 'mock-module-loader'
      });
      expect(actorSpace.actors).toBeInstanceOf(Map);
      expect(actorSpace.actorGuids).toBeInstanceOf(Map);
    });

    test('throws error if config is missing actorPairs', async () => {
      const badSpace = new TestActorSpace('bad', {}, {});
      await expect(badSpace.setupActors('frontend')).rejects.toThrow(
        'Invalid actor configuration: missing actorPairs'
      );
    });
  });

  describe('setupActors', () => {
    test('creates frontend actors correctly', async () => {
      await actorSpace.setupActors('frontend');

      // Check that frontend actors were created
      expect(actorSpace.actors.size).toBe(3);
      expect(actorSpace.getActor('chat')).toBeDefined();
      expect(actorSpace.getActor('chat').className).toBe('ChatActor');
      expect(actorSpace.getActor('terminal').className).toBe('TerminalActor');
      expect(actorSpace.getActor('debug').className).toBe('DebugActor');
    });

    test('creates backend actors correctly', async () => {
      await actorSpace.setupActors('backend');

      // Check that backend actors were created
      expect(actorSpace.actors.size).toBe(3);
      expect(actorSpace.getActor('chat').className).toBe('ChatAgent');
      expect(actorSpace.getActor('terminal').className).toBe('TerminalAgent');
      expect(actorSpace.getActor('debug').className).toBe('ChatAgent');
    });

    test('generates consistent GUIDs', async () => {
      await actorSpace.setupActors('frontend');

      expect(actorSpace.actorGuids.get('chat')).toBe('test-space-chat');
      expect(actorSpace.actorGuids.get('terminal')).toBe('test-space-terminal');
      expect(actorSpace.actorGuids.get('debug')).toBe('test-space-debug');
    });

    test('continues setup even if one actor fails', async () => {
      // Override createActor to fail for terminal
      actorSpace.createActor = async (className, name) => {
        if (name === 'terminal') {
          throw new Error('Terminal creation failed');
        }
        const actor = new Actor();
        actor.className = className;
        return actor;
      };

      await actorSpace.setupActors('frontend');

      // Should have created the other actors
      expect(actorSpace.actors.size).toBe(2);
      expect(actorSpace.getActor('chat')).toBeDefined();
      expect(actorSpace.getActor('terminal')).toBeNull();
      expect(actorSpace.getActor('debug')).toBeDefined();
    });
  });

  describe('getHandshakeData', () => {
    test('returns correct handshake data', async () => {
      await actorSpace.setupActors('frontend');
      const handshake = actorSpace.getHandshakeData();

      expect(handshake).toEqual({
        chat: 'test-space-chat',
        terminal: 'test-space-terminal',
        debug: 'test-space-debug'
      });
    });

    test('returns empty object when no actors', () => {
      const handshake = actorSpace.getHandshakeData();
      expect(handshake).toEqual({});
    });
  });

  describe('wireActors', () => {
    let mockChannel;
    let remoteGuids;

    beforeEach(async () => {
      await actorSpace.setupActors('frontend');
      
      mockChannel = {
        makeRemote: jest.fn((guid) => ({
          guid,
          receive: jest.fn()
        }))
      };

      remoteGuids = {
        chat: 'remote-chat',
        terminal: 'remote-terminal',
        debug: 'remote-debug'
      };
    });

    test('creates remote actors for all remote GUIDs', () => {
      actorSpace.wireActors(mockChannel, remoteGuids);

      expect(mockChannel.makeRemote).toHaveBeenCalledTimes(3);
      expect(mockChannel.makeRemote).toHaveBeenCalledWith('remote-chat');
      expect(mockChannel.makeRemote).toHaveBeenCalledWith('remote-terminal');
      expect(mockChannel.makeRemote).toHaveBeenCalledWith('remote-debug');
    });

    test('wires actors using setRemoteAgent when available', () => {
      actorSpace.wireActors(mockChannel, remoteGuids);

      const chatActor = actorSpace.getActor('chat');
      expect(chatActor.setRemoteAgent).toHaveBeenCalledWith(
        expect.objectContaining({ guid: 'remote-chat' })
      );
    });

    test('wires actors using setRemoteActor as fallback', () => {
      // Remove setRemoteAgent from actors
      actorSpace.actors.forEach(actor => {
        delete actor.setRemoteAgent;
      });

      actorSpace.wireActors(mockChannel, remoteGuids);

      const chatActor = actorSpace.getActor('chat');
      expect(chatActor.setRemoteActor).toHaveBeenCalledWith(
        expect.objectContaining({ guid: 'remote-chat' })
      );
    });

    test('sets remoteActor property as last resort', () => {
      // Remove both methods
      actorSpace.actors.forEach(actor => {
        delete actor.setRemoteAgent;
        delete actor.setRemoteActor;
      });

      actorSpace.wireActors(mockChannel, remoteGuids);

      const chatActor = actorSpace.getActor('chat');
      expect(chatActor.remoteActor).toBeDefined();
      expect(chatActor.remoteActor.guid).toBe('remote-chat');
    });

    test('provides remoteActors map to all actors', () => {
      actorSpace.wireActors(mockChannel, remoteGuids);

      actorSpace.actors.forEach(actor => {
        expect(actor.remoteActors).toBeInstanceOf(Map);
        expect(actor.remoteActors.size).toBe(3);
        expect(actor.remoteActors.get('chat').guid).toBe('remote-chat');
      });
    });

    test('handles missing remote actors gracefully', () => {
      const partialRemoteGuids = {
        chat: 'remote-chat'
        // terminal and debug are missing
      };

      actorSpace.wireActors(mockChannel, partialRemoteGuids);

      // Should only create one remote actor
      expect(mockChannel.makeRemote).toHaveBeenCalledTimes(1);
      
      // Chat should be wired
      const chatActor = actorSpace.getActor('chat');
      expect(chatActor.setRemoteAgent).toHaveBeenCalled();
      
      // Others should not
      const terminalActor = actorSpace.getActor('terminal');
      expect(terminalActor.setRemoteAgent).not.toHaveBeenCalled();
    });
  });

  describe('getActor', () => {
    beforeEach(async () => {
      await actorSpace.setupActors('frontend');
    });

    test('returns actor by name', () => {
      const chat = actorSpace.getActor('chat');
      expect(chat).toBeDefined();
      expect(chat.className).toBe('ChatActor');
    });

    test('returns null for non-existent actor', () => {
      const notFound = actorSpace.getActor('nonexistent');
      expect(notFound).toBeNull();
    });
  });

  describe('destroy', () => {
    beforeEach(async () => {
      await actorSpace.setupActors('frontend');
      
      // Add destroy method to actors
      actorSpace.actors.forEach(actor => {
        actor.destroy = jest.fn();
      });
    });

    test('calls destroy on all actors', () => {
      const actors = Array.from(actorSpace.actors.values());
      
      actorSpace.destroy();

      actors.forEach(actor => {
        expect(actor.destroy).toHaveBeenCalled();
      });
    });

    test('clears all collections', () => {
      actorSpace.destroy();

      expect(actorSpace.actors.size).toBe(0);
      expect(actorSpace.actorGuids.size).toBe(0);
    });

    test('handles actors without destroy method', () => {
      // Remove destroy from one actor
      const chatActor = actorSpace.getActor('chat');
      delete chatActor.destroy;

      // Should not throw
      expect(() => actorSpace.destroy()).not.toThrow();
    });

    test('continues destroying even if one fails', () => {
      const chatActor = actorSpace.getActor('chat');
      chatActor.destroy = jest.fn(() => {
        throw new Error('Destroy failed');
      });

      const terminalActor = actorSpace.getActor('terminal');

      // Should not throw and should destroy other actors
      expect(() => actorSpace.destroy()).not.toThrow();
      expect(terminalActor.destroy).toHaveBeenCalled();
    });
  });

  describe('createActor', () => {
    test('throws error in base class', async () => {
      const baseSpace = new ConfigurableActorSpace('base', mockConfig);
      
      await expect(baseSpace.createActor('TestActor', 'test'))
        .rejects.toThrow('Subclass must implement createActor for TestActor');
    });
  });
});