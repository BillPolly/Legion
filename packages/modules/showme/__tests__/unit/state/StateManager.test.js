/**
 * Unit Tests for StateManager
 * 
 * Tests the undo/redo system with command pattern for diagram operations
 * NO MOCKS - Tests real state management functionality
 * 
 * @jest-environment jsdom
 */

import { StateManager } from '../../../src/state/StateManager.js';
import { Command } from '../../../src/state/Command.js';

describe('StateManager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe('constructor', () => {
    test('should initialize with empty history', () => {
      expect(stateManager.canUndo()).toBe(false);
      expect(stateManager.canRedo()).toBe(false);
      expect(stateManager.getHistorySize()).toBe(0);
    });

    test('should initialize with default configuration', () => {
      const config = stateManager.getConfiguration();
      expect(config.maxHistorySize).toBe(100);
      expect(config.enableCompression).toBe(true);
      expect(config.autoSaveInterval).toBe(30000); // 30 seconds
    });

    test('should accept custom configuration', () => {
      const customManager = new StateManager({
        maxHistorySize: 50,
        enableCompression: false,
        autoSaveInterval: 60000
      });
      
      const config = customManager.getConfiguration();
      expect(config.maxHistorySize).toBe(50);
      expect(config.enableCompression).toBe(false);
      expect(config.autoSaveInterval).toBe(60000);
    });
  });

  describe('command execution', () => {
    class TestCommand extends Command {
      constructor(value) {
        super();
        this.value = value;
        this.previousValue = null;
      }

      execute(context) {
        this.previousValue = context.value;
        context.value = this.value;
        return { success: true, value: this.value };
      }

      undo(context) {
        context.value = this.previousValue;
        return { success: true, value: this.previousValue };
      }

      getDescription() {
        return `Set value to ${this.value}`;
      }
    }

    test('should execute command and add to history', () => {
      const context = { value: 0 };
      const command = new TestCommand(5);
      
      const result = stateManager.execute(command, context);
      
      expect(result.success).toBe(true);
      expect(context.value).toBe(5);
      expect(stateManager.canUndo()).toBe(true);
      expect(stateManager.getHistorySize()).toBe(1);
    });

    test('should support undo operation', () => {
      const context = { value: 0 };
      const command = new TestCommand(5);
      
      stateManager.execute(command, context);
      expect(context.value).toBe(5);
      
      const undoResult = stateManager.undo(context);
      expect(undoResult.success).toBe(true);
      expect(context.value).toBe(0);
      expect(stateManager.canUndo()).toBe(false);
      expect(stateManager.canRedo()).toBe(true);
    });

    test('should support redo operation', () => {
      const context = { value: 0 };
      const command = new TestCommand(5);
      
      stateManager.execute(command, context);
      stateManager.undo(context);
      
      const redoResult = stateManager.redo(context);
      expect(redoResult.success).toBe(true);
      expect(context.value).toBe(5);
      expect(stateManager.canUndo()).toBe(true);
      expect(stateManager.canRedo()).toBe(false);
    });

    test('should clear redo stack on new command', () => {
      const context = { value: 0 };
      
      stateManager.execute(new TestCommand(5), context);
      stateManager.execute(new TestCommand(10), context);
      stateManager.undo(context);
      
      expect(stateManager.canRedo()).toBe(true);
      
      stateManager.execute(new TestCommand(15), context);
      
      expect(stateManager.canRedo()).toBe(false);
      expect(context.value).toBe(15);
    });

    test('should respect max history size', () => {
      const smallManager = new StateManager({ maxHistorySize: 3 });
      const context = { value: 0 };
      
      // Execute 5 commands
      for (let i = 1; i <= 5; i++) {
        smallManager.execute(new TestCommand(i), context);
      }
      
      expect(smallManager.getHistorySize()).toBe(3);
      expect(context.value).toBe(5);
      
      // Should only be able to undo 3 times
      smallManager.undo(context);
      smallManager.undo(context);
      smallManager.undo(context);
      
      expect(smallManager.canUndo()).toBe(false);
      expect(context.value).toBe(2); // Oldest commands were dropped
    });
  });

  describe('state snapshots', () => {
    test('should create state snapshot', () => {
      const state = {
        nodes: [{ id: 1, label: 'Node 1' }],
        edges: [{ id: 1, source: 1, target: 2 }],
        viewport: { x: 0, y: 0, zoom: 1 }
      };
      
      const snapshot = stateManager.createSnapshot(state);
      
      expect(snapshot).toHaveProperty('id');
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('state');
      expect(snapshot.state).toEqual(state);
    });

    test('should restore from snapshot', () => {
      const originalState = {
        nodes: [{ id: 1, label: 'Node 1' }],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      };
      
      const snapshot = stateManager.createSnapshot(originalState);
      
      // Modify the state
      const currentState = {
        nodes: [{ id: 1, label: 'Modified' }, { id: 2, label: 'Node 2' }],
        edges: [{ id: 1, source: 1, target: 2 }],
        viewport: { x: 100, y: 100, zoom: 2 }
      };
      
      const restoredState = stateManager.restoreSnapshot(snapshot);
      
      expect(restoredState).toEqual(originalState);
      expect(restoredState).not.toBe(originalState); // Should be a copy
    });

    test('should maintain snapshot history', () => {
      const state1 = { value: 1 };
      const state2 = { value: 2 };
      const state3 = { value: 3 };
      
      const snap1 = stateManager.createSnapshot(state1);
      const snap2 = stateManager.createSnapshot(state2);
      const snap3 = stateManager.createSnapshot(state3);
      
      const snapshots = stateManager.getSnapshots();
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].id).toBe(snap1.id);
      expect(snapshots[2].id).toBe(snap3.id);
    });

    test('should get snapshot by ID', () => {
      const state = { value: 42 };
      const snapshot = stateManager.createSnapshot(state);
      
      const retrieved = stateManager.getSnapshot(snapshot.id);
      expect(retrieved).toEqual(snapshot);
      
      const nonExistent = stateManager.getSnapshot('non-existent');
      expect(nonExistent).toBeNull();
    });

    test('should delete snapshot by ID', () => {
      const snap1 = stateManager.createSnapshot({ value: 1 });
      const snap2 = stateManager.createSnapshot({ value: 2 });
      
      expect(stateManager.getSnapshots()).toHaveLength(2);
      
      const deleted = stateManager.deleteSnapshot(snap1.id);
      expect(deleted).toBe(true);
      expect(stateManager.getSnapshots()).toHaveLength(1);
      expect(stateManager.getSnapshot(snap1.id)).toBeNull();
      expect(stateManager.getSnapshot(snap2.id)).toBeTruthy();
    });
  });

  describe('dirty state tracking', () => {
    test('should track dirty state', () => {
      expect(stateManager.isDirty()).toBe(false);
      
      const context = { value: 0 };
      const command = new (class extends Command {
        execute(ctx) { ctx.value = 5; return { success: true }; }
        undo(ctx) { ctx.value = 0; return { success: true }; }
      })();
      
      stateManager.execute(command, context);
      expect(stateManager.isDirty()).toBe(true);
    });

    test('should reset dirty state on save', () => {
      const context = { value: 0 };
      const command = new (class extends Command {
        execute(ctx) { ctx.value = 5; return { success: true }; }
        undo(ctx) { ctx.value = 0; return { success: true }; }
      })();
      
      stateManager.execute(command, context);
      expect(stateManager.isDirty()).toBe(true);
      
      stateManager.markClean();
      expect(stateManager.isDirty()).toBe(false);
    });

    test('should track dirty state through undo/redo', () => {
      const context = { value: 0 };
      const command = new (class extends Command {
        execute(ctx) { ctx.value = 5; return { success: true }; }
        undo(ctx) { ctx.value = 0; return { success: true }; }
      })();
      
      stateManager.execute(command, context);
      stateManager.markClean();
      
      stateManager.undo(context);
      expect(stateManager.isDirty()).toBe(true);
      
      stateManager.redo(context);
      expect(stateManager.isDirty()).toBe(false); // Back to saved state
    });
  });

  describe('auto-save functionality', () => {
    test('should trigger auto-save at intervals', (done) => {
      let callCount = 0;
      const saveCallback = (state) => {
        callCount++;
        expect(state.isDirty).toBe(true);
        expect(state.historySize).toBe(1);
        expect(state.canUndo).toBe(true);
        expect(state.canRedo).toBe(false);
        manager.destroy();
        done();
      };
      
      const manager = new StateManager({
        autoSaveInterval: 100, // Very short for testing
        onAutoSave: saveCallback
      });
      
      manager.enableAutoSave(true);
      
      const context = { value: 0 };
      const command = new (class extends Command {
        execute(ctx) { ctx.value = 5; return { success: true }; }
        undo(ctx) { ctx.value = 0; return { success: true }; }
      })();
      
      manager.execute(command, context);
      
      // Should trigger after interval
      setTimeout(() => {
        if (callCount === 0) {
          manager.destroy();
          done(new Error('Auto-save was not triggered'));
        }
      }, 200);
    });

    test('should not auto-save when disabled', (done) => {
      const saveCallback = () => {
        done(new Error('Auto-save should not have been called'));
      };
      
      const manager = new StateManager({
        autoSaveInterval: 50,
        onAutoSave: saveCallback
      });
      
      manager.enableAutoSave(false);
      
      const context = { value: 0 };
      const command = new (class extends Command {
        execute(ctx) { ctx.value = 5; return { success: true }; }
        undo(ctx) { ctx.value = 0; return { success: true }; }
      })();
      
      manager.execute(command, context);
      
      // Wait to ensure auto-save is not triggered
      setTimeout(() => {
        manager.destroy();
        done();
      }, 100);
    });

    test('should not auto-save when not dirty', (done) => {
      const saveCallback = () => {
        done(new Error('Auto-save should not have been called for clean state'));
      };
      
      const manager = new StateManager({
        autoSaveInterval: 50,
        onAutoSave: saveCallback
      });
      
      manager.enableAutoSave(true);
      manager.markClean();
      
      // Wait to ensure auto-save is not triggered
      setTimeout(() => {
        manager.destroy();
        done();
      }, 100);
    });
  });

  describe('state compression', () => {
    test('should compress state when enabled', () => {
      const manager = new StateManager({ enableCompression: true });
      
      const largeState = {
        nodes: Array(100).fill(null).map((_, i) => ({
          id: i,
          label: `Node ${i}`,
          x: Math.random() * 1000,
          y: Math.random() * 1000,
          data: { value: Math.random() }
        }))
      };
      
      const snapshot = manager.createSnapshot(largeState);
      
      // Compressed snapshot should have compressed property
      expect(snapshot).toHaveProperty('compressed');
      expect(snapshot.compressed).toBe(true);
      
      // Should be able to restore
      const restored = manager.restoreSnapshot(snapshot);
      expect(restored).toEqual(largeState);
    });

    test('should not compress when disabled', () => {
      const manager = new StateManager({ enableCompression: false });
      
      const state = { value: 42 };
      const snapshot = manager.createSnapshot(state);
      
      expect(snapshot.compressed).toBe(false);
      expect(snapshot.state).toEqual(state);
    });
  });

  describe('clear operations', () => {
    test('should clear all history', () => {
      const context = { value: 0 };
      
      for (let i = 1; i <= 5; i++) {
        const command = new (class extends Command {
          execute(ctx) { ctx.value = i; return { success: true }; }
          undo(ctx) { ctx.value = i - 1; return { success: true }; }
        })();
        stateManager.execute(command, context);
      }
      
      expect(stateManager.getHistorySize()).toBe(5);
      
      stateManager.clearHistory();
      
      expect(stateManager.getHistorySize()).toBe(0);
      expect(stateManager.canUndo()).toBe(false);
      expect(stateManager.canRedo()).toBe(false);
    });

    test('should clear all snapshots', () => {
      stateManager.createSnapshot({ value: 1 });
      stateManager.createSnapshot({ value: 2 });
      stateManager.createSnapshot({ value: 3 });
      
      expect(stateManager.getSnapshots()).toHaveLength(3);
      
      stateManager.clearSnapshots();
      
      expect(stateManager.getSnapshots()).toHaveLength(0);
    });
  });

  describe('history information', () => {
    test('should get command descriptions', () => {
      const context = {};
      
      const commands = [
        { desc: 'Add node', execute: () => ({ success: true }), undo: () => ({ success: true }), getDescription: () => 'Add node' },
        { desc: 'Delete edge', execute: () => ({ success: true }), undo: () => ({ success: true }), getDescription: () => 'Delete edge' },
        { desc: 'Move node', execute: () => ({ success: true }), undo: () => ({ success: true }), getDescription: () => 'Move node' }
      ];
      
      commands.forEach(cmd => stateManager.execute(cmd, context));
      
      const history = stateManager.getCommandHistory();
      expect(history).toHaveLength(3);
      expect(history[0]).toBe('Add node');
      expect(history[1]).toBe('Delete edge');
      expect(history[2]).toBe('Move node');
    });

    test('should get current position in history', () => {
      const context = { value: 0 };
      
      for (let i = 1; i <= 3; i++) {
        const command = new (class extends Command {
          execute(ctx) { ctx.value = i; return { success: true }; }
          undo(ctx) { ctx.value = i - 1; return { success: true }; }
        })();
        stateManager.execute(command, context);
      }
      
      expect(stateManager.getCurrentPosition()).toBe(3);
      
      stateManager.undo(context);
      expect(stateManager.getCurrentPosition()).toBe(2);
      
      stateManager.undo(context);
      expect(stateManager.getCurrentPosition()).toBe(1);
      
      stateManager.redo(context);
      expect(stateManager.getCurrentPosition()).toBe(2);
    });
  });
});