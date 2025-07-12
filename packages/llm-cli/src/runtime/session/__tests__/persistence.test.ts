import { InMemoryPersistence } from '../persistence/InMemoryPersistence';
import { FilePersistence } from '../persistence/FilePersistence';
import { SessionState } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');

describe('State Persistence', () => {
  const createMockState = (id: string): SessionState => ({
    sessionId: id,
    state: new Map([['key', 'value']]),
    history: [{
      id: 'h1',
      timestamp: new Date('2024-01-01'),
      input: 'test'
    }],
    contextProviders: [],
    startTime: new Date('2024-01-01'),
    lastActivityTime: new Date('2024-01-01')
  });

  describe('InMemoryPersistence', () => {
    let persistence: InMemoryPersistence;

    beforeEach(() => {
      persistence = new InMemoryPersistence();
    });

    it('should save and load state', async () => {
      const state = createMockState('test-session');
      
      await persistence.saveState('test-session', state);
      const loaded = await persistence.loadState('test-session');
      
      expect(loaded).toEqual(state);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await persistence.loadState('non-existent');
      expect(loaded).toBeNull();
    });

    it('should delete state', async () => {
      const state = createMockState('test-session');
      
      await persistence.saveState('test-session', state);
      await persistence.deleteState('test-session');
      
      const loaded = await persistence.loadState('test-session');
      expect(loaded).toBeNull();
    });

    it('should list sessions', async () => {
      await persistence.saveState('session1', createMockState('session1'));
      await persistence.saveState('session2', createMockState('session2'));
      
      const sessions = await persistence.listSessions();
      expect(sessions).toEqual(['session1', 'session2']);
    });

    it('should clear all sessions', async () => {
      await persistence.saveState('session1', createMockState('session1'));
      await persistence.saveState('session2', createMockState('session2'));
      
      persistence.clear();
      
      const sessions = await persistence.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('FilePersistence', () => {
    let persistence: FilePersistence;
    const testDir = '/tmp/test-sessions';
    const mockFs = fs as jest.Mocked<typeof fs>;

    beforeEach(() => {
      jest.clearAllMocks();
      mockFs.mkdir.mockResolvedValue(undefined);
      persistence = new FilePersistence(testDir);
    });

    it('should create directory on initialization', async () => {
      expect(mockFs.mkdir).toHaveBeenCalledWith(testDir, { recursive: true });
    });

    it('should save state to file', async () => {
      const state = createMockState('test-session');
      mockFs.writeFile.mockResolvedValue(undefined);
      
      await persistence.saveState('test-session', state);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testDir, 'test-session.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should load state from file', async () => {
      const state = createMockState('test-session');
      const serialized = JSON.stringify(
        state,
        (key, value) => value instanceof Map ? Array.from(value.entries()) : value
      );
      
      mockFs.readFile.mockResolvedValue(serialized);
      
      const loaded = await persistence.loadState('test-session');
      expect(loaded?.sessionId).toBe('test-session');
      expect(loaded?.state.get('key')).toBe('value');
    });

    it('should return null for missing file', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
      
      const loaded = await persistence.loadState('non-existent');
      expect(loaded).toBeNull();
    });

    it('should delete state file', async () => {
      mockFs.unlink.mockResolvedValue(undefined);
      
      await persistence.deleteState('test-session');
      
      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join(testDir, 'test-session.json')
      );
    });

    it('should list session files', async () => {
      mockFs.readdir.mockResolvedValue([
        'session1.json',
        'session2.json',
        'other.txt' // Should be ignored
      ] as any);
      
      const sessions = await persistence.listSessions();
      expect(sessions).toEqual(['session1', 'session2']);
    });

    it('should handle empty directory', async () => {
      mockFs.readdir.mockResolvedValue([] as any);
      
      const sessions = await persistence.listSessions();
      expect(sessions).toEqual([]);
    });
  });
});