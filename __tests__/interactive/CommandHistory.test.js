import { describe, it, expect, beforeEach } from '@jest/globals';
import { CommandHistory } from '../../src/interactive/CommandHistory.js';

describe('CommandHistory', () => {
  let commandHistory;

  beforeEach(() => {
    commandHistory = new CommandHistory();
  });

  describe('constructor', () => {
    it('should initialize with empty history', () => {
      expect(commandHistory.history).toEqual([]);
      expect(commandHistory.maxSize).toBe(100);
    });

    it('should accept custom max size', () => {
      const customHistory = new CommandHistory(50);
      expect(customHistory.maxSize).toBe(50);
    });
  });

  describe('add', () => {
    it('should add command to history', () => {
      commandHistory.add('command1');
      commandHistory.add('command2');
      
      expect(commandHistory.history).toEqual(['command1', 'command2']);
    });

    it('should not add empty commands', () => {
      commandHistory.add('');
      commandHistory.add('   ');
      commandHistory.add(null);
      commandHistory.add(undefined);
      
      expect(commandHistory.history).toEqual([]);
    });

    it('should trim whitespace', () => {
      commandHistory.add('  command  ');
      expect(commandHistory.history).toEqual(['  command  ']);
    });

    it('should maintain max size limit', () => {
      const smallHistory = new CommandHistory(3);
      smallHistory.add('command1');
      smallHistory.add('command2');
      smallHistory.add('command3');
      smallHistory.add('command4');
      
      expect(smallHistory.history).toEqual(['command2', 'command3', 'command4']);
    });

    it('should remove oldest when exceeding max size', () => {
      const tinyHistory = new CommandHistory(2);
      tinyHistory.add('old');
      tinyHistory.add('middle');
      tinyHistory.add('new');
      
      expect(tinyHistory.history).toEqual(['middle', 'new']);
      expect(tinyHistory.history[0]).toBe('middle');
    });
  });

  describe('getAll', () => {
    it('should return all history', () => {
      commandHistory.add('command1');
      commandHistory.add('command2');
      commandHistory.add('command3');
      
      const all = commandHistory.getAll();
      expect(all).toEqual(['command1', 'command2', 'command3']);
    });

    it('should return a copy not reference', () => {
      commandHistory.add('command1');
      
      const all = commandHistory.getAll();
      all.push('extra');
      
      expect(commandHistory.history).toEqual(['command1']);
    });

    it('should return empty array when no history', () => {
      expect(commandHistory.getAll()).toEqual([]);
    });
  });

  describe('getRecent', () => {
    it('should get recent commands', () => {
      for (let i = 1; i <= 20; i++) {
        commandHistory.add(`command${i}`);
      }
      
      const recent = commandHistory.getRecent(5);
      expect(recent).toEqual(['command16', 'command17', 'command18', 'command19', 'command20']);
    });

    it('should return all if count exceeds history', () => {
      commandHistory.add('command1');
      commandHistory.add('command2');
      
      const recent = commandHistory.getRecent(10);
      expect(recent).toEqual(['command1', 'command2']);
    });

    it('should default to 10 items', () => {
      for (let i = 1; i <= 15; i++) {
        commandHistory.add(`command${i}`);
      }
      
      const recent = commandHistory.getRecent();
      expect(recent).toHaveLength(10);
      expect(recent[0]).toBe('command6');
      expect(recent[9]).toBe('command15');
    });

    it('should handle empty history', () => {
      expect(commandHistory.getRecent()).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear history', () => {
      commandHistory.add('command1');
      commandHistory.add('command2');
      commandHistory.add('command3');
      
      commandHistory.clear();
      
      expect(commandHistory.history).toEqual([]);
      expect(commandHistory.getAll()).toEqual([]);
    });

    it('should work when already empty', () => {
      commandHistory.clear();
      expect(commandHistory.history).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      commandHistory.add('calculator.add --a 5 --b 3');
      commandHistory.add('file.read --path test.txt');
      commandHistory.add('calculator.subtract --a 10 --b 4');
      commandHistory.add('http.get --url https://example.com');
    });

    it('should search history by keyword', () => {
      const results = commandHistory.search('calculator');
      expect(results).toHaveLength(2);
      expect(results).toContain('calculator.add --a 5 --b 3');
      expect(results).toContain('calculator.subtract --a 10 --b 4');
    });

    it('should be case insensitive', () => {
      const results = commandHistory.search('CALCULATOR');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      const results = commandHistory.search('nonexistent');
      expect(results).toEqual([]);
    });

    it('should handle empty search term', () => {
      const results = commandHistory.search('');
      expect(results).toEqual([]);
    });

    it('should handle undefined search term', () => {
      const results = commandHistory.search();
      expect(results).toEqual([]);
    });
  });
});