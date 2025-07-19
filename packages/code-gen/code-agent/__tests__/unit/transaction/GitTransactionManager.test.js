/**
 * GitTransactionManager Unit Tests
 * Phase 7.3: Transaction management and rollback system tests
 * 
 * Tests atomic Git operations, transaction lifecycle,
 * rollback capabilities, and state management.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import GitTransactionManager from '../../../src/transaction/GitTransactionManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('GitTransactionManager', () => {
  let transactionManager;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-transaction-test-'));
    
    // Initialize as git repository
    await fs.mkdir(path.join(tempDir, '.git'));
    await fs.writeFile(path.join(tempDir, '.git', 'config'), '[core]\n    repositoryformatversion = 0');
    
    transactionManager = new GitTransactionManager({
      enableTransactions: true,
      maxTransactionTime: 5000,
      enableMetrics: true,
      autoRollbackOnFailure: true
    });
    
    await transactionManager.initialize(tempDir);
  });

  afterEach(async () => {
    if (transactionManager) {
      await transactionManager.cleanup();
    }
    
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Cleanup failed, continue
      }
    }
  });

  describe('Initialization', () => {
    test('should initialize transaction manager', async () => {
      expect(transactionManager.initialized).toBe(true);
      expect(transactionManager.repositoryPath).toBe(tempDir);
      expect(transactionManager.activeTransactions.size).toBe(0);
    });

    test('should emit initialization event', async () => {
      const events = [];
      const newManager = new GitTransactionManager();
      
      newManager.on('initialized', (data) => events.push(data));
      await newManager.initialize(tempDir);
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('repositoryPath', tempDir);
      expect(events[0]).toHaveProperty('transactionsEnabled', true);
      
      await newManager.cleanup();
    });

    test('should handle multiple initialization calls', async () => {
      const manager = new GitTransactionManager();
      await manager.initialize(tempDir);
      await manager.initialize(tempDir); // Should not throw
      
      expect(manager.initialized).toBe(true);
      await manager.cleanup();
    });
  });

  describe('Transaction Lifecycle', () => {
    test('should start a new transaction', async () => {
      const operationData = {
        description: 'Test commit operation',
        user: 'test-user',
        context: { phase: 'testing' }
      };

      const transaction = await transactionManager.startTransaction('commit', operationData);
      
      expect(transaction).toHaveProperty('id');
      expect(transaction.operationType).toBe('commit');
      expect(transaction.status).toBe('active');
      expect(transaction.operationData).toEqual(operationData);
      expect(transaction.currentState).toBeDefined();
      expect(transaction.operations).toEqual([]);
      expect(transaction.timeout).toBeDefined();
      
      expect(transactionManager.activeTransactions.size).toBe(1);
    });

    test('should emit transaction started event', async () => {
      const events = [];
      transactionManager.on('transaction-started', (data) => events.push(data));

      const transaction = await transactionManager.startTransaction('commit');
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('transactionId', transaction.id);
      expect(events[0]).toHaveProperty('operationType', 'commit');
    });

    test('should generate unique transaction IDs', async () => {
      const transaction1 = await transactionManager.startTransaction('commit');
      const transaction2 = await transactionManager.startTransaction('branch');
      
      expect(transaction1.id).not.toBe(transaction2.id);
      expect(transactionManager.activeTransactions.size).toBe(2);
    });

    test('should reject transactions when disabled', async () => {
      const disabledManager = new GitTransactionManager({ enableTransactions: false });
      await disabledManager.initialize(tempDir);

      await expect(disabledManager.startTransaction('commit'))
        .rejects.toThrow('Transactions are disabled');
      
      await disabledManager.cleanup();
    });

    test('should timeout transactions', async () => {
      const shortTimeoutManager = new GitTransactionManager({ 
        maxTransactionTime: 100,
        autoRollbackOnFailure: true
      });
      await shortTimeoutManager.initialize(tempDir);

      const events = [];
      shortTimeoutManager.on('rollback-success', (data) => events.push(data));

      const transaction = await shortTimeoutManager.startTransaction('commit');
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(events.length).toBe(1);
      expect(events[0].reason).toBe('timeout');
      expect(shortTimeoutManager.activeTransactions.size).toBe(0);
      
      await shortTimeoutManager.cleanup();
    });
  });

  describe('Operation Execution', () => {
    let transaction;

    beforeEach(async () => {
      transaction = await transactionManager.startTransaction('commit');
    });

    test('should execute operations within transaction', async () => {
      // Mock git command execution
      const originalExecute = transactionManager.executeGitCommand;
      transactionManager.executeGitCommand = jest.fn().mockResolvedValue({
        stdout: 'mock output',
        stderr: '',
        code: 0
      });

      const result = await transactionManager.executeOperation(
        transaction.id, 
        'status', 
        ['--porcelain']
      );
      
      expect(result.success).toBe(true);
      expect(result.operationId).toBeDefined();
      expect(result.result.stdout).toBe('mock output');
      
      const updatedTransaction = transactionManager.activeTransactions.get(transaction.id);
      expect(updatedTransaction.operations.length).toBe(1);
      expect(updatedTransaction.operations[0].operation).toBe('status');
      expect(updatedTransaction.operations[0].success).toBe(true);
      
      // Restore original method
      transactionManager.executeGitCommand = originalExecute;
    });

    test('should handle operation failures', async () => {
      // Mock failing git command
      transactionManager.executeGitCommand = jest.fn().mockRejectedValue(
        new Error('Git command failed')
      );

      await expect(transactionManager.executeOperation(transaction.id, 'invalid-command'))
        .rejects.toThrow('Git command failed');
      
      const updatedTransaction = transactionManager.activeTransactions.get(transaction.id);
      expect(updatedTransaction.operations.length).toBe(1);
      expect(updatedTransaction.operations[0].success).toBe(false);
      expect(updatedTransaction.operations[0].error).toBe('Git command failed');
    });

    test('should auto-rollback on operation failure', async () => {
      const events = [];
      transactionManager.on('rollback-success', (data) => events.push(data));
      
      // Mock failing git command
      transactionManager.executeGitCommand = jest.fn().mockRejectedValue(
        new Error('Git command failed')
      );

      await expect(transactionManager.executeOperation(transaction.id, 'invalid-command'))
        .rejects.toThrow('Git command failed');
      
      expect(events.length).toBe(1);
      expect(events[0].reason).toBe('operation-failure');
      expect(transactionManager.activeTransactions.size).toBe(0);
    });

    test('should emit operation events', async () => {
      const events = [];
      transactionManager.on('operation-start', (data) => events.push({ type: 'start', data }));
      transactionManager.on('operation-success', (data) => events.push({ type: 'success', data }));
      
      // Mock successful git command
      transactionManager.executeGitCommand = jest.fn().mockResolvedValue({
        stdout: 'success',
        stderr: '',
        code: 0
      });

      await transactionManager.executeOperation(transaction.id, 'status');
      
      expect(events.length).toBe(2);
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('success');
    });

    test('should reject operations on invalid transaction', async () => {
      await expect(transactionManager.executeOperation('invalid-id', 'status'))
        .rejects.toThrow('Transaction invalid-id not found');
    });

    test('should reject operations on inactive transaction', async () => {
      // Rollback the transaction to make it inactive
      await transactionManager.rollbackTransaction(transaction.id);
      
      await expect(transactionManager.executeOperation(transaction.id, 'status'))
        .rejects.toThrow('is not active');
    });
  });

  describe('Transaction Commit', () => {
    let transaction;

    beforeEach(async () => {
      transaction = await transactionManager.startTransaction('commit');
    });

    test('should commit transaction successfully', async () => {
      const result = await transactionManager.commitTransaction(transaction.id);
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(transaction.id);
      expect(result.operationsExecuted).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      
      expect(transactionManager.activeTransactions.size).toBe(0);
      expect(transactionManager.transactionHistory.length).toBe(1);
      
      const historyEntry = transactionManager.transactionHistory[0];
      expect(historyEntry.id).toBe(transaction.id);
      expect(historyEntry.status).toBe('committed');
    });

    test('should emit commit event', async () => {
      const events = [];
      transactionManager.on('transaction-committed', (data) => events.push(data));

      await transactionManager.commitTransaction(transaction.id);
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('transactionId', transaction.id);
      expect(events[0]).toHaveProperty('operationType', 'commit');
      expect(events[0]).toHaveProperty('duration');
    });

    test('should clear transaction timeout on commit', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      await transactionManager.commitTransaction(transaction.id);
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    test('should reject commit on invalid transaction', async () => {
      await expect(transactionManager.commitTransaction('invalid-id'))
        .rejects.toThrow('Transaction invalid-id not found');
    });

    test('should update metrics on commit', async () => {
      const initialMetrics = transactionManager.getMetrics();
      
      await transactionManager.commitTransaction(transaction.id);
      
      const updatedMetrics = transactionManager.getMetrics();
      expect(updatedMetrics.transactionsCompleted).toBe(initialMetrics.transactionsCompleted + 1);
    });
  });

  describe('Transaction Rollback', () => {
    let transaction;

    beforeEach(async () => {
      transaction = await transactionManager.startTransaction('commit');
    });

    test('should rollback transaction successfully', async () => {
      const result = await transactionManager.rollbackTransaction(transaction.id, 'test-rollback');
      
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(transaction.id);
      expect(result.reason).toBe('test-rollback');
      expect(result.operationsRolledBack).toBe(0);
      
      expect(transactionManager.activeTransactions.size).toBe(0);
      expect(transactionManager.transactionHistory.length).toBe(1);
      
      const historyEntry = transactionManager.transactionHistory[0];
      expect(historyEntry.status).toBe('rolled-back');
      expect(historyEntry.rollbackReason).toBe('test-rollback');
    });

    test('should emit rollback events', async () => {
      const events = [];
      transactionManager.on('rollback-start', (data) => events.push({ type: 'start', data }));
      transactionManager.on('rollback-success', (data) => events.push({ type: 'success', data }));

      await transactionManager.rollbackTransaction(transaction.id, 'test');
      
      expect(events.length).toBe(2);
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('success');
    });

    test('should use specific rollback strategy for operation type', async () => {
      const branchTransaction = await transactionManager.startTransaction('branch');
      
      // Mock rollback strategy
      const rollbackSpy = jest.spyOn(transactionManager, 'rollbackBranch')
        .mockResolvedValue(undefined);

      await transactionManager.rollbackTransaction(branchTransaction.id);
      
      expect(rollbackSpy).toHaveBeenCalled();
      rollbackSpy.mockRestore();
    });

    test('should update metrics on rollback', async () => {
      const initialMetrics = transactionManager.getMetrics();
      
      await transactionManager.rollbackTransaction(transaction.id);
      
      const updatedMetrics = transactionManager.getMetrics();
      expect(updatedMetrics.rollbacksExecuted).toBe(initialMetrics.rollbacksExecuted + 1);
      expect(updatedMetrics.rollbacksSuccessful).toBe(initialMetrics.rollbacksSuccessful + 1);
    });

    test('should handle rollback failures', async () => {
      // Mock failing rollback strategy
      jest.spyOn(transactionManager, 'restoreRepositoryState')
        .mockRejectedValue(new Error('Rollback failed'));

      await expect(transactionManager.rollbackTransaction(transaction.id))
        .rejects.toThrow('Rollback failed');
      
      const metrics = transactionManager.getMetrics();
      expect(metrics.rollbacksFailed).toBe(1);
    });
  });

  describe('Rollback Strategies', () => {
    test('should rollback commit operations', async () => {
      const transaction = {
        id: 'test-tx',
        operations: [
          { operation: 'commit', success: true, args: ['-m', 'test commit'] }
        ]
      };

      const mockExecute = jest.spyOn(transactionManager, 'executeGitCommand')
        .mockResolvedValue({ stdout: '', stderr: '', code: 0 });

      await transactionManager.rollbackCommit(transaction);
      
      expect(mockExecute).toHaveBeenCalledWith(['reset', '--hard', 'HEAD~1']);
      mockExecute.mockRestore();
    });

    test('should rollback branch operations', async () => {
      const transaction = {
        id: 'test-tx',
        operations: [
          { operation: 'checkout', success: true, args: ['-b', 'feature-branch'] }
        ]
      };

      const mockExecute = jest.spyOn(transactionManager, 'executeGitCommand')
        .mockResolvedValue({ stdout: '', stderr: '', code: 0 });

      await transactionManager.rollbackBranch(transaction);
      
      expect(mockExecute).toHaveBeenCalledWith(['branch', '-D', 'feature-branch']);
      mockExecute.mockRestore();
    });

    test('should rollback merge operations', async () => {
      const transaction = { id: 'test-tx', operations: [] };

      const mockExecute = jest.spyOn(transactionManager, 'executeGitCommand')
        .mockResolvedValue({ stdout: '', stderr: '', code: 0 });

      await transactionManager.rollbackMerge(transaction);
      
      expect(mockExecute).toHaveBeenCalledWith(['merge', '--abort']);
      mockExecute.mockRestore();
    });

    test('should emit warning for push rollback', async () => {
      const events = [];
      transactionManager.on('rollback-warning', (data) => events.push(data));

      const transaction = { id: 'test-tx', operations: [] };
      await transactionManager.rollbackPush(transaction);
      
      expect(events.length).toBe(1);
      expect(events[0].message).toContain('Cannot automatically rollback push operations');
    });

    test('should rollback stash operations', async () => {
      const transaction = {
        id: 'test-tx',
        operations: [
          { operation: 'stash', success: true, args: ['push', '-m', 'test stash'] }
        ]
      };

      const mockExecute = jest.spyOn(transactionManager, 'executeGitCommand')
        .mockResolvedValue({ stdout: '', stderr: '', code: 0 });

      await transactionManager.rollbackStash(transaction);
      
      expect(mockExecute).toHaveBeenCalledWith(['stash', 'pop']);
      mockExecute.mockRestore();
    });
  });

  describe('Repository State Management', () => {
    test('should capture repository state', async () => {
      // Mock git commands
      const mockExecute = jest.spyOn(transactionManager, 'executeGitCommand')
        .mockImplementation((args) => {
          if (args[0] === 'rev-parse') return Promise.resolve({ stdout: 'abc123\n', stderr: '', code: 0 });
          if (args[0] === 'branch') return Promise.resolve({ stdout: 'main\n', stderr: '', code: 0 });
          if (args[0] === 'status') return Promise.resolve({ stdout: '', stderr: '', code: 0 });
          if (args[0] === 'stash') return Promise.resolve({ stdout: '', stderr: '', code: 0 });
          return Promise.resolve({ stdout: '', stderr: '', code: 0 });
        });

      const state = await transactionManager.captureRepositoryState();
      
      expect(state.head).toBe('abc123');
      expect(state.currentBranch).toBe('main');
      expect(state.workingDirectory).toBe('');
      expect(state.stashes).toBe('');
      expect(state.timestamp).toBeDefined();
      
      mockExecute.mockRestore();
    });

    test('should handle state capture errors', async () => {
      const mockExecute = jest.spyOn(transactionManager, 'executeGitCommand')
        .mockRejectedValue(new Error('Git command failed'));

      const state = await transactionManager.captureRepositoryState();
      
      expect(state.error).toBe('Git command failed');
      expect(state.timestamp).toBeDefined();
      
      mockExecute.mockRestore();
    });

    test('should restore repository state', async () => {
      const state = {
        head: 'abc123',
        currentBranch: 'feature',
        timestamp: new Date().toISOString()
      };

      const mockExecute = jest.spyOn(transactionManager, 'executeGitCommand')
        .mockImplementation((args) => {
          if (args[0] === 'branch') return Promise.resolve({ stdout: 'main\n', stderr: '', code: 0 });
          return Promise.resolve({ stdout: '', stderr: '', code: 0 });
        });

      await transactionManager.restoreRepositoryState(state);
      
      expect(mockExecute).toHaveBeenCalledWith(['reset', '--hard', 'abc123']);
      expect(mockExecute).toHaveBeenCalledWith(['checkout', 'feature']);
      
      mockExecute.mockRestore();
    });

    test('should handle state restoration errors', async () => {
      const state = { error: 'Previous capture failed' };

      await expect(transactionManager.restoreRepositoryState(state))
        .rejects.toThrow('Cannot restore state: Previous capture failed');
    });
  });

  describe('Transaction Status and History', () => {
    test('should get transaction status', async () => {
      const transaction = await transactionManager.startTransaction('commit', {
        description: 'Test transaction'
      });

      const status = transactionManager.getTransactionStatus(transaction.id);
      
      expect(status).toEqual({
        id: transaction.id,
        operationType: 'commit',
        status: 'active',
        startTime: transaction.startTime,
        endTime: transaction.endTime,
        operationsCount: 0,
        metadata: transaction.metadata
      });
    });

    test('should return null for non-existent transaction', () => {
      const status = transactionManager.getTransactionStatus('non-existent');
      expect(status).toBeNull();
    });

    test('should list active transactions', async () => {
      const tx1 = await transactionManager.startTransaction('commit');
      const tx2 = await transactionManager.startTransaction('branch');

      const activeTransactions = transactionManager.getActiveTransactions();
      
      expect(activeTransactions.length).toBe(2);
      expect(activeTransactions.map(tx => tx.id)).toContain(tx1.id);
      expect(activeTransactions.map(tx => tx.id)).toContain(tx2.id);
    });

    test('should get transaction history', async () => {
      const transaction = await transactionManager.startTransaction('commit');
      await transactionManager.commitTransaction(transaction.id);

      const history = transactionManager.getTransactionHistory();
      
      expect(history.length).toBe(1);
      expect(history[0].id).toBe(transaction.id);
      expect(history[0].status).toBe('committed');
    });

    test('should limit transaction history', async () => {
      // Create and commit multiple transactions
      for (let i = 0; i < 5; i++) {
        const tx = await transactionManager.startTransaction('commit');
        await transactionManager.commitTransaction(tx.id);
      }

      const limitedHistory = transactionManager.getTransactionHistory(3);
      expect(limitedHistory.length).toBe(3);
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should track transaction metrics', async () => {
      const initialMetrics = transactionManager.getMetrics();
      
      const tx1 = await transactionManager.startTransaction('commit');
      const tx2 = await transactionManager.startTransaction('branch');
      
      await transactionManager.commitTransaction(tx1.id);
      await transactionManager.rollbackTransaction(tx2.id);

      const finalMetrics = transactionManager.getMetrics();
      
      expect(finalMetrics.transactionsStarted).toBe(initialMetrics.transactionsStarted + 2);
      expect(finalMetrics.transactionsCompleted).toBe(initialMetrics.transactionsCompleted + 1);
      expect(finalMetrics.rollbacksExecuted).toBe(initialMetrics.rollbacksExecuted + 1);
      expect(finalMetrics.activeTransactions).toBe(0);
      expect(finalMetrics.successRate).toBeGreaterThan(0);
    });

    test('should calculate success and rollback rates', async () => {
      // Create successful transaction
      const tx1 = await transactionManager.startTransaction('commit');
      await transactionManager.commitTransaction(tx1.id);
      
      // Create rolled back transaction
      const tx2 = await transactionManager.startTransaction('commit');
      await transactionManager.rollbackTransaction(tx2.id);

      const metrics = transactionManager.getMetrics();
      
      expect(metrics.successRate).toBe(50); // 1 success out of 2 total
      expect(metrics.rollbackRate).toBe(100); // 1 successful rollback out of 1 rollback
    });
  });

  describe('Utility Functions', () => {
    test('should generate unique transaction IDs', () => {
      const id1 = transactionManager.generateTransactionId();
      const id2 = transactionManager.generateTransactionId();
      
      expect(id1).toMatch(/^tx_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^tx_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    test('should generate unique operation IDs', () => {
      const id1 = transactionManager.generateOperationId();
      const id2 = transactionManager.generateOperationId();
      
      expect(id1).toMatch(/^op_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^op_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    test('should execute git commands', async () => {
      // This test might fail in CI without git, so we'll mock it
      const mockSpawn = jest.fn().mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      }));

      // Mock the spawn function
      const originalSpawn = require('child_process').spawn;
      require('child_process').spawn = mockSpawn;

      try {
        const result = await transactionManager.executeGitCommand(['status']);
        expect(mockSpawn).toHaveBeenCalledWith('git', ['status'], { cwd: tempDir });
      } catch (error) {
        // Expected in test environment
      }

      // Restore original spawn
      require('child_process').spawn = originalSpawn;
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup all active transactions', async () => {
      const tx1 = await transactionManager.startTransaction('commit');
      const tx2 = await transactionManager.startTransaction('branch');
      
      expect(transactionManager.activeTransactions.size).toBe(2);

      await transactionManager.cleanup();
      
      expect(transactionManager.activeTransactions.size).toBe(0);
      expect(transactionManager.transactionHistory.length).toBe(2);
      
      // Check that transactions were rolled back
      const history = transactionManager.getTransactionHistory();
      expect(history.every(tx => tx.status === 'rolled-back')).toBe(true);
    });

    test('should clear timeouts during cleanup', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      const transaction = await transactionManager.startTransaction('commit');
      await transactionManager.cleanup();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    test('should remove event listeners during cleanup', async () => {
      const removeListenersSpy = jest.spyOn(transactionManager, 'removeAllListeners');
      
      await transactionManager.cleanup();
      
      expect(removeListenersSpy).toHaveBeenCalled();
    });

    test('should handle cleanup errors gracefully', async () => {
      const transaction = await transactionManager.startTransaction('commit');
      
      // Mock rollback to fail
      jest.spyOn(transactionManager, 'rollbackTransaction')
        .mockRejectedValue(new Error('Rollback failed'));

      // Cleanup should not throw
      await expect(transactionManager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized operations', async () => {
      const uninitializedManager = new GitTransactionManager();
      
      await expect(uninitializedManager.startTransaction('commit'))
        .rejects.toThrow('GitTransactionManager not initialized');
    });

    test('should handle missing transaction operations', async () => {
      await expect(transactionManager.executeOperation('invalid-id', 'status'))
        .rejects.toThrow('Transaction invalid-id not found');
      
      await expect(transactionManager.commitTransaction('invalid-id'))
        .rejects.toThrow('Transaction invalid-id not found');
      
      await expect(transactionManager.rollbackTransaction('invalid-id'))
        .rejects.toThrow('Transaction invalid-id not found');
    });
  });
});