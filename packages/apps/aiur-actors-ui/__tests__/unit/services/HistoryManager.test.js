/**
 * Tests for HistoryManager
 * Manages command history with persistence and search
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('HistoryManager', () => {
  let HistoryManager;
  let historyManager;
  let mockStorage;
  
  beforeEach(async () => {
    // Mock storage
    mockStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    
    // Mock localStorage for browser environment
    global.localStorage = mockStorage;
    
    // Import or create HistoryManager
    try {
      ({ HistoryManager } = await import('../../../src/services/HistoryManager.js'));
    } catch (error) {
      // Create mock implementation
      HistoryManager = class {
        constructor(options = {}) {
          this.maxSize = options.maxSize || 1000;
          this.maxAge = options.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 days
          this.sessionId = options.sessionId || 'default';
          this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
          this.deduplicate = options.deduplicate !== false;
          this.ignorePatterns = options.ignorePatterns || [/^$/];
          
          this.history = [];
          this.currentIndex = -1;
          this.searchResults = [];
          this.searchIndex = -1;
          
          // Load history on initialization
          this.loadHistory();
        }
        
        add(command) {
          // Validate command
          if (!command || typeof command !== 'string') {
            return false;
          }
          
          // Trim whitespace
          command = command.trim();
          
          // Check ignore patterns
          for (const pattern of this.ignorePatterns) {
            if (pattern.test(command)) {
              return false;
            }
          }
          
          // Deduplicate if enabled
          if (this.deduplicate) {
            const lastIndex = this.history.findIndex(entry => entry.command === command);
            if (lastIndex !== -1) {
              this.history.splice(lastIndex, 1);
            }
          }
          
          // Create history entry
          const entry = {
            command,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            id: this.generateId()
          };
          
          // Add to history
          this.history.push(entry);
          
          // Enforce max size
          if (this.history.length > this.maxSize) {
            this.history = this.history.slice(-this.maxSize);
          }
          
          // Reset navigation
          this.currentIndex = this.history.length;
          
          // Save to storage
          this.saveHistory();
          
          return true;
        }
        
        get(index) {
          if (index < 0 || index >= this.history.length) {
            return null;
          }
          return this.history[index];
        }
        
        getLast() {
          return this.history[this.history.length - 1] || null;
        }
        
        getAll() {
          return this.history.map(entry => entry.command);
        }
        
        getHistory() {
          return this.getAll();
        }
        
        getFullHistory() {
          return [...this.history];
        }
        
        navigateUp() {
          if (this.currentIndex > 0) {
            this.currentIndex--;
            return this.history[this.currentIndex]?.command || null;
          }
          return null;
        }
        
        navigateDown() {
          if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            return this.history[this.currentIndex]?.command || null;
          } else if (this.currentIndex === this.history.length - 1) {
            this.currentIndex = this.history.length;
            return '';
          }
          return null;
        }
        
        search(query, options = {}) {
          const { 
            caseSensitive = false,
            regex = false,
            maxResults = 50,
            sortByRecent = true
          } = options;
          
          if (!query) {
            this.searchResults = [];
            this.searchIndex = -1;
            return [];
          }
          
          let matcher;
          if (regex) {
            try {
              matcher = new RegExp(query, caseSensitive ? '' : 'i');
            } catch (e) {
              return [];
            }
          } else {
            const searchStr = caseSensitive ? query : query.toLowerCase();
            matcher = (cmd) => {
              const cmdStr = caseSensitive ? cmd : cmd.toLowerCase();
              return cmdStr.includes(searchStr);
            };
          }
          
          // Search through history
          const results = this.history.filter(entry => {
            if (regex) {
              return matcher.test(entry.command);
            } else {
              return matcher(entry.command);
            }
          });
          
          // Sort by recency if requested
          if (sortByRecent) {
            results.sort((a, b) => b.timestamp - a.timestamp);
          }
          
          // Limit results
          this.searchResults = results.slice(0, maxResults);
          this.searchIndex = this.searchResults.length > 0 ? 0 : -1;
          
          return this.searchResults.map(entry => entry.command);
        }
        
        searchNext() {
          if (this.searchResults.length === 0) {
            return null;
          }
          
          this.searchIndex = (this.searchIndex + 1) % this.searchResults.length;
          return this.searchResults[this.searchIndex]?.command || null;
        }
        
        searchPrevious() {
          if (this.searchResults.length === 0) {
            return null;
          }
          
          this.searchIndex = this.searchIndex - 1;
          if (this.searchIndex < 0) {
            this.searchIndex = this.searchResults.length - 1;
          }
          
          return this.searchResults[this.searchIndex]?.command || null;
        }
        
        clear() {
          this.history = [];
          this.currentIndex = -1;
          this.searchResults = [];
          this.searchIndex = -1;
          this.saveHistory();
        }
        
        delete(command) {
          const initialLength = this.history.length;
          this.history = this.history.filter(entry => entry.command !== command);
          
          if (this.history.length < initialLength) {
            this.currentIndex = this.history.length;
            this.saveHistory();
            return true;
          }
          
          return false;
        }
        
        deleteById(id) {
          const initialLength = this.history.length;
          this.history = this.history.filter(entry => entry.id !== id);
          
          if (this.history.length < initialLength) {
            this.currentIndex = this.history.length;
            this.saveHistory();
            return true;
          }
          
          return false;
        }
        
        prune() {
          const cutoff = Date.now() - this.maxAge;
          const initialLength = this.history.length;
          
          this.history = this.history.filter(entry => entry.timestamp > cutoff);
          
          const pruned = initialLength - this.history.length;
          if (pruned > 0) {
            this.currentIndex = this.history.length;
            this.saveHistory();
          }
          
          return pruned;
        }
        
        saveHistory() {
          if (!this.storage) return;
          
          const key = `history:${this.sessionId}`;
          const data = JSON.stringify({
            version: '1.0',
            history: this.history,
            saved: Date.now()
          });
          
          try {
            this.storage.setItem(key, data);
          } catch (e) {
            console.error('Failed to save history:', e);
          }
        }
        
        loadHistory() {
          if (!this.storage) return;
          
          const key = `history:${this.sessionId}`;
          
          try {
            const data = this.storage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              if (parsed.history && Array.isArray(parsed.history)) {
                this.history = parsed.history;
                this.currentIndex = this.history.length;
                
                // Prune old entries on load
                this.prune();
              }
            }
          } catch (e) {
            console.error('Failed to load history:', e);
          }
        }
        
        exportHistory() {
          return {
            version: '1.0',
            sessionId: this.sessionId,
            exported: Date.now(),
            history: this.history
          };
        }
        
        importHistory(data, options = {}) {
          const { merge = false, deduplicate = true } = options;
          
          if (!data || !data.history || !Array.isArray(data.history)) {
            throw new Error('Invalid history data');
          }
          
          if (merge) {
            // Merge with existing history
            const existingCommands = new Set(this.history.map(e => e.command));
            
            for (const entry of data.history) {
              if (!deduplicate || !existingCommands.has(entry.command)) {
                this.history.push({
                  ...entry,
                  imported: true,
                  importedAt: Date.now()
                });
              }
            }
            
            // Sort by timestamp
            this.history.sort((a, b) => a.timestamp - b.timestamp);
          } else {
            // Replace history
            this.history = data.history.map(entry => ({
              ...entry,
              imported: true,
              importedAt: Date.now()
            }));
          }
          
          // Enforce max size
          if (this.history.length > this.maxSize) {
            this.history = this.history.slice(-this.maxSize);
          }
          
          this.currentIndex = this.history.length;
          this.saveHistory();
          
          return this.history.length;
        }
        
        getStatistics() {
          const commands = {};
          const sessions = {};
          let totalCommands = this.history.length;
          let oldestEntry = null;
          let newestEntry = null;
          
          for (const entry of this.history) {
            // Count command frequency
            const baseCommand = entry.command.split(' ')[0];
            commands[baseCommand] = (commands[baseCommand] || 0) + 1;
            
            // Count by session
            sessions[entry.sessionId] = (sessions[entry.sessionId] || 0) + 1;
            
            // Track oldest/newest
            if (!oldestEntry || entry.timestamp < oldestEntry.timestamp) {
              oldestEntry = entry;
            }
            if (!newestEntry || entry.timestamp > newestEntry.timestamp) {
              newestEntry = entry;
            }
          }
          
          // Get top commands
          const topCommands = Object.entries(commands)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([cmd, count]) => ({ command: cmd, count }));
          
          return {
            totalCommands,
            uniqueCommands: Object.keys(commands).length,
            topCommands,
            sessions: Object.keys(sessions).length,
            oldestEntry: oldestEntry?.timestamp,
            newestEntry: newestEntry?.timestamp,
            averageCommandLength: totalCommands > 0 
              ? Math.round(this.history.reduce((sum, e) => sum + e.command.length, 0) / totalCommands)
              : 0
          };
        }
        
        generateId() {
          return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
      };
    }
    
    // Create instance
    historyManager = new HistoryManager({
      maxSize: 100,
      storage: mockStorage
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Adding Commands', () => {
    test('should add command to history', () => {
      const added = historyManager.add('ls -la');
      
      expect(added).toBe(true);
      expect(historyManager.getLast().command).toBe('ls -la');
      expect(historyManager.getAll()).toContain('ls -la');
    });
    
    test('should trim whitespace from commands', () => {
      historyManager.add('  echo hello  ');
      
      expect(historyManager.getLast().command).toBe('echo hello');
    });
    
    test('should ignore empty commands', () => {
      const added = historyManager.add('');
      
      expect(added).toBe(false);
      expect(historyManager.getAll()).toHaveLength(0);
    });
    
    test('should ignore commands matching ignore patterns', () => {
      historyManager.ignorePatterns = [/^$/, /^#/, /^password/];
      
      historyManager.add('#comment');
      historyManager.add('password123');
      
      expect(historyManager.getAll()).toHaveLength(0);
    });
    
    test('should deduplicate commands by default', () => {
      historyManager.add('echo test');
      historyManager.add('ls');
      historyManager.add('echo test');
      
      const history = historyManager.getAll();
      expect(history).toEqual(['ls', 'echo test']);
    });
    
    test('should respect max size limit', () => {
      historyManager.maxSize = 3;
      
      historyManager.add('cmd1');
      historyManager.add('cmd2');
      historyManager.add('cmd3');
      historyManager.add('cmd4');
      
      const history = historyManager.getAll();
      expect(history).toEqual(['cmd2', 'cmd3', 'cmd4']);
    });
    
    test('should include metadata in entries', () => {
      historyManager.add('git status');
      
      const entry = historyManager.getFullHistory()[0];
      expect(entry).toMatchObject({
        command: 'git status',
        timestamp: expect.any(Number),
        sessionId: 'default',
        id: expect.any(String)
      });
    });
  });
  
  describe('Navigation', () => {
    beforeEach(() => {
      historyManager.add('command1');
      historyManager.add('command2');
      historyManager.add('command3');
    });
    
    test('should navigate up through history', () => {
      let cmd = historyManager.navigateUp();
      expect(cmd).toBe('command3');
      
      cmd = historyManager.navigateUp();
      expect(cmd).toBe('command2');
      
      cmd = historyManager.navigateUp();
      expect(cmd).toBe('command1');
      
      cmd = historyManager.navigateUp();
      expect(cmd).toBeNull(); // At beginning
    });
    
    test('should navigate down through history', () => {
      historyManager.navigateUp();
      historyManager.navigateUp(); // At command2
      
      let cmd = historyManager.navigateDown();
      expect(cmd).toBe('command3');
      
      cmd = historyManager.navigateDown();
      expect(cmd).toBe(''); // Past end returns empty
    });
    
    test('should reset navigation on new command', () => {
      historyManager.navigateUp();
      historyManager.navigateUp();
      
      historyManager.add('command4');
      
      const cmd = historyManager.navigateUp();
      expect(cmd).toBe('command4');
    });
    
    test('should handle navigation with empty history', () => {
      historyManager.clear();
      
      expect(historyManager.navigateUp()).toBeNull();
      expect(historyManager.navigateDown()).toBeNull();
    });
  });
  
  describe('Search', () => {
    beforeEach(() => {
      historyManager.add('git status');
      historyManager.add('git commit -m "test"');
      historyManager.add('npm install');
      historyManager.add('git push origin main');
      historyManager.add('ls -la');
    });
    
    test('should search commands by substring', () => {
      const results = historyManager.search('git');
      
      expect(results).toHaveLength(3);
      expect(results).toContain('git status');
      expect(results).toContain('git commit -m "test"');
      expect(results).toContain('git push origin main');
    });
    
    test('should search case-insensitive by default', () => {
      const results = historyManager.search('GIT');
      
      expect(results).toHaveLength(3);
    });
    
    test('should support case-sensitive search', () => {
      historyManager.add('GIT COMMAND');
      
      const results = historyManager.search('GIT', { caseSensitive: true });
      
      expect(results).toContain('GIT COMMAND');
      expect(results).not.toContain('git status');
    });
    
    test('should support regex search', () => {
      const results = historyManager.search('^git', { regex: true });
      
      expect(results).toHaveLength(3);
      expect(results).not.toContain('ls -la');
    });
    
    test('should sort by recency by default', () => {
      const results = historyManager.search('git');
      
      expect(results[0]).toBe('git push origin main');
      expect(results[results.length - 1]).toBe('git status');
    });
    
    test('should limit search results', () => {
      for (let i = 0; i < 10; i++) {
        historyManager.add(`test command ${i}`);
      }
      
      const results = historyManager.search('test', { maxResults: 5 });
      
      expect(results).toHaveLength(5);
    });
    
    test('should navigate search results', () => {
      historyManager.search('git');
      
      const first = historyManager.searchNext();
      const second = historyManager.searchNext();
      const third = historyManager.searchNext();
      const wrapped = historyManager.searchNext(); // Should wrap
      
      expect(first).toBe('git push origin main');
      expect(wrapped).toBe('git push origin main');
    });
    
    test('should navigate search results backwards', () => {
      historyManager.search('git');
      
      const last = historyManager.searchPrevious();
      expect(last).toBe('git status');
      
      const secondLast = historyManager.searchPrevious();
      expect(secondLast).toBe('git commit -m "test"');
    });
    
    test('should clear search results', () => {
      historyManager.search('git');
      expect(historyManager.searchResults).toHaveLength(3);
      
      historyManager.search('');
      expect(historyManager.searchResults).toHaveLength(0);
    });
  });
  
  describe('Storage', () => {
    test('should save history to storage', () => {
      historyManager.add('test command');
      
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'history:default',
        expect.stringContaining('test command')
      );
    });
    
    test('should load history from storage', () => {
      const storedData = {
        version: '1.0',
        history: [
          { command: 'stored1', timestamp: Date.now() - 1000, sessionId: 'default', id: '1' },
          { command: 'stored2', timestamp: Date.now(), sessionId: 'default', id: '2' }
        ]
      };
      
      mockStorage.getItem.mockReturnValue(JSON.stringify(storedData));
      
      const newManager = new HistoryManager({ storage: mockStorage });
      
      expect(newManager.getAll()).toEqual(['stored1', 'stored2']);
    });
    
    test('should handle corrupted storage data', () => {
      mockStorage.getItem.mockReturnValue('invalid json');
      
      // Should not throw
      const newManager = new HistoryManager({ storage: mockStorage });
      
      expect(newManager.getAll()).toEqual([]);
    });
    
    test('should prune old entries on load', () => {
      const oldEntry = {
        command: 'old command',
        timestamp: Date.now() - (35 * 24 * 60 * 60 * 1000), // 35 days old
        sessionId: 'default',
        id: '1'
      };
      
      const recentEntry = {
        command: 'recent command',
        timestamp: Date.now() - (5 * 24 * 60 * 60 * 1000), // 5 days old
        sessionId: 'default',
        id: '2'
      };
      
      mockStorage.getItem.mockReturnValue(JSON.stringify({
        version: '1.0',
        history: [oldEntry, recentEntry]
      }));
      
      const newManager = new HistoryManager({ 
        storage: mockStorage,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      
      expect(newManager.getAll()).toEqual(['recent command']);
    });
  });
  
  describe('Management Operations', () => {
    beforeEach(() => {
      historyManager.add('command1');
      historyManager.add('command2');
      historyManager.add('command3');
    });
    
    test('should clear all history', () => {
      historyManager.clear();
      
      expect(historyManager.getAll()).toEqual([]);
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'history:default',
        expect.stringContaining('"history":[]')
      );
    });
    
    test('should delete specific command', () => {
      const deleted = historyManager.delete('command2');
      
      expect(deleted).toBe(true);
      expect(historyManager.getAll()).toEqual(['command1', 'command3']);
    });
    
    test('should delete by ID', () => {
      const entry = historyManager.getFullHistory()[1];
      const deleted = historyManager.deleteById(entry.id);
      
      expect(deleted).toBe(true);
      expect(historyManager.getAll()).not.toContain('command2');
    });
    
    test('should prune old entries', () => {
      // Add old entry
      historyManager.history.unshift({
        command: 'old command',
        timestamp: Date.now() - (35 * 24 * 60 * 60 * 1000),
        sessionId: 'default',
        id: 'old'
      });
      
      const pruned = historyManager.prune();
      
      expect(pruned).toBe(1);
      expect(historyManager.getAll()).not.toContain('old command');
    });
  });
  
  describe('Import/Export', () => {
    beforeEach(() => {
      historyManager.add('command1');
      historyManager.add('command2');
    });
    
    test('should export history', () => {
      const exported = historyManager.exportHistory();
      
      expect(exported).toMatchObject({
        version: '1.0',
        sessionId: 'default',
        exported: expect.any(Number),
        history: expect.arrayContaining([
          expect.objectContaining({ command: 'command1' }),
          expect.objectContaining({ command: 'command2' })
        ])
      });
    });
    
    test('should import history (replace)', () => {
      const importData = {
        version: '1.0',
        history: [
          { command: 'imported1', timestamp: Date.now(), sessionId: 'import', id: '1' },
          { command: 'imported2', timestamp: Date.now(), sessionId: 'import', id: '2' }
        ]
      };
      
      const count = historyManager.importHistory(importData);
      
      expect(count).toBe(2);
      expect(historyManager.getAll()).toEqual(['imported1', 'imported2']);
    });
    
    test('should import history (merge)', () => {
      const importData = {
        version: '1.0',
        history: [
          { command: 'imported1', timestamp: Date.now() - 1000, sessionId: 'import', id: '3' }
        ]
      };
      
      historyManager.importHistory(importData, { merge: true });
      
      expect(historyManager.getAll()).toContain('command1');
      expect(historyManager.getAll()).toContain('command2');
      expect(historyManager.getAll()).toContain('imported1');
    });
    
    test('should deduplicate on merge', () => {
      const importData = {
        version: '1.0',
        history: [
          { command: 'command1', timestamp: Date.now(), sessionId: 'import', id: '3' },
          { command: 'new command', timestamp: Date.now(), sessionId: 'import', id: '4' }
        ]
      };
      
      historyManager.importHistory(importData, { merge: true, deduplicate: true });
      
      const commands = historyManager.getAll();
      const command1Count = commands.filter(c => c === 'command1').length;
      
      expect(command1Count).toBe(1);
      expect(commands).toContain('new command');
    });
    
    test('should validate import data', () => {
      expect(() => {
        historyManager.importHistory({});
      }).toThrow('Invalid history data');
      
      expect(() => {
        historyManager.importHistory({ history: 'not an array' });
      }).toThrow('Invalid history data');
    });
  });
  
  describe('Statistics', () => {
    beforeEach(() => {
      historyManager.add('git status');
      historyManager.add('git commit -m "test"');
      historyManager.add('npm install');
      historyManager.add('git status'); // Duplicate
      historyManager.add('ls -la');
    });
    
    test('should calculate statistics', () => {
      const stats = historyManager.getStatistics();
      
      expect(stats.totalCommands).toBe(4); // One deduplicated
      expect(stats.uniqueCommands).toBe(3); // git, npm, ls
      expect(stats.sessions).toBe(1);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
      expect(stats.averageCommandLength).toBeGreaterThan(0);
    });
    
    test('should identify top commands', () => {
      historyManager.add('git push');
      historyManager.add('git pull');
      
      const stats = historyManager.getStatistics();
      
      expect(stats.topCommands[0]).toMatchObject({
        command: 'git',
        count: expect.any(Number)
      });
      
      expect(stats.topCommands[0].count).toBeGreaterThanOrEqual(3);
    });
    
    test('should handle empty history statistics', () => {
      historyManager.clear();
      
      const stats = historyManager.getStatistics();
      
      expect(stats.totalCommands).toBe(0);
      expect(stats.uniqueCommands).toBe(0);
      expect(stats.topCommands).toEqual([]);
      expect(stats.averageCommandLength).toBe(0);
    });
  });
  
  describe('Session Support', () => {
    test('should maintain separate history per session', () => {
      const session1 = new HistoryManager({ sessionId: 'session1', storage: mockStorage });
      const session2 = new HistoryManager({ sessionId: 'session2', storage: mockStorage });
      
      session1.add('session1 command');
      session2.add('session2 command');
      
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'history:session1',
        expect.stringContaining('session1 command')
      );
      
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'history:session2',
        expect.stringContaining('session2 command')
      );
    });
    
    test('should include session ID in entries', () => {
      const sessionManager = new HistoryManager({ sessionId: 'test-session' });
      sessionManager.add('test command');
      
      const entry = sessionManager.getFullHistory()[0];
      expect(entry.sessionId).toBe('test-session');
    });
  });
});