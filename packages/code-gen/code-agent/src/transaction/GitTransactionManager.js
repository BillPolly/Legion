/**
 * GitTransactionManager - Atomic Git operation management with rollback
 * 
 * Manages Git operations as atomic transactions with automatic rollback
 * capabilities, state tracking, and recovery mechanisms.
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';

class GitTransactionManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableTransactions: config.enableTransactions !== false,
      maxTransactionTime: config.maxTransactionTime || 300000, // 5 minutes
      enableStateTracking: config.enableStateTracking !== false,
      enableMetrics: config.enableMetrics !== false,
      autoRollbackOnFailure: config.autoRollbackOnFailure !== false,
      ...config
    };
    
    this.repositoryPath = null;
    this.activeTransactions = new Map();
    this.transactionHistory = [];
    
    // Transaction operation types
    this.operationTypes = {
      COMMIT: 'commit',
      BRANCH: 'branch',
      MERGE: 'merge',
      PUSH: 'push',
      PULL: 'pull',
      REBASE: 'rebase',
      RESET: 'reset',
      STASH: 'stash'
    };
    
    // Rollback strategies for each operation type
    this.rollbackStrategies = {
      [this.operationTypes.COMMIT]: this.rollbackCommit.bind(this),
      [this.operationTypes.BRANCH]: this.rollbackBranch.bind(this),
      [this.operationTypes.MERGE]: this.rollbackMerge.bind(this),
      [this.operationTypes.PUSH]: this.rollbackPush.bind(this),
      [this.operationTypes.PULL]: this.rollbackPull.bind(this),
      [this.operationTypes.REBASE]: this.rollbackRebase.bind(this),
      [this.operationTypes.RESET]: this.rollbackReset.bind(this),
      [this.operationTypes.STASH]: this.rollbackStash.bind(this)
    };
    
    // Metrics
    this.metrics = {
      transactionsStarted: 0,
      transactionsCompleted: 0,
      transactionsFailed: 0,
      rollbacksExecuted: 0,
      rollbacksSuccessful: 0,
      rollbacksFailed: 0
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize the transaction manager
   */
  async initialize(repositoryPath) {
    if (this.initialized) {
      return;
    }
    
    this.repositoryPath = repositoryPath;
    this.initialized = true;
    
    this.emit('initialized', {
      repositoryPath,
      transactionsEnabled: this.config.enableTransactions,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Start a new Git transaction
   * @param {string} operationType - Type of operation
   * @param {Object} operationData - Data for the operation
   * @returns {Object} Transaction object
   */
  async startTransaction(operationType, operationData = {}) {
    if (!this.initialized) {
      throw new Error('GitTransactionManager not initialized');
    }
    
    if (!this.config.enableTransactions) {
      throw new Error('Transactions are disabled');
    }
    
    const transactionId = this.generateTransactionId();
    const startTime = new Date();
    
    // Capture current repository state
    const currentState = await this.captureRepositoryState();
    
    const transaction = {
      id: transactionId,
      operationType,
      operationData,
      startTime,
      status: 'active',
      currentState,
      rollbackData: null,
      operations: [],
      metadata: {
        user: operationData.user || 'system',
        description: operationData.description || `${operationType} operation`,
        context: operationData.context || {}
      }
    };
    
    this.activeTransactions.set(transactionId, transaction);
    this.metrics.transactionsStarted++;
    
    // Set timeout for transaction
    const timeout = setTimeout(async () => {
      if (this.activeTransactions.has(transactionId)) {
        await this.rollbackTransaction(transactionId, 'timeout');
      }
    }, this.config.maxTransactionTime);
    
    transaction.timeout = timeout;
    
    this.emit('transaction-started', {
      transactionId,
      operationType,
      metadata: transaction.metadata,
      timestamp: startTime.toISOString()
    });
    
    return transaction;
  }
  
  /**
   * Execute an operation within a transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} operation - Git operation to execute
   * @param {Array} args - Command arguments
   * @returns {Object} Operation result
   */
  async executeOperation(transactionId, operation, args = []) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }
    
    const operationId = this.generateOperationId();
    const startTime = new Date();
    
    try {
      this.emit('operation-start', {
        transactionId,
        operationId,
        operation,
        args,
        timestamp: startTime.toISOString()
      });
      
      // Execute the git command
      const result = await this.executeGitCommand([operation, ...args]);
      
      // Record the operation
      const operationRecord = {
        id: operationId,
        operation,
        args,
        result,
        startTime,
        endTime: new Date(),
        success: true
      };
      
      transaction.operations.push(operationRecord);
      
      this.emit('operation-success', {
        transactionId,
        operationId,
        operation,
        result,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        operationId,
        result
      };
      
    } catch (error) {
      const operationRecord = {
        id: operationId,
        operation,
        args,
        error: error.message,
        startTime,
        endTime: new Date(),
        success: false
      };
      
      transaction.operations.push(operationRecord);
      
      this.emit('operation-failed', {
        transactionId,
        operationId,
        operation,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Auto-rollback if configured
      if (this.config.autoRollbackOnFailure) {
        await this.rollbackTransaction(transactionId, 'operation-failure');
      }
      
      throw error;
    }
  }
  
  /**
   * Commit a transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Object} Commit result
   */
  async commitTransaction(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    try {
      // Clear timeout
      if (transaction.timeout) {
        clearTimeout(transaction.timeout);
      }
      
      // Update transaction status
      transaction.status = 'committed';
      transaction.endTime = new Date();
      
      // Move to history
      this.transactionHistory.push(transaction);
      this.activeTransactions.delete(transactionId);
      
      this.metrics.transactionsCompleted++;
      
      this.emit('transaction-committed', {
        transactionId,
        operationType: transaction.operationType,
        operationsCount: transaction.operations.length,
        duration: transaction.endTime - transaction.startTime,
        timestamp: transaction.endTime.toISOString()
      });
      
      return {
        success: true,
        transactionId,
        operationsExecuted: transaction.operations.length,
        duration: transaction.endTime - transaction.startTime
      };
      
    } catch (error) {
      this.emit('transaction-commit-failed', {
        transactionId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }
  
  /**
   * Rollback a transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} reason - Reason for rollback
   * @returns {Object} Rollback result
   */
  async rollbackTransaction(transactionId, reason = 'manual') {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    try {
      this.emit('rollback-start', {
        transactionId,
        reason,
        operationsToRollback: transaction.operations.length,
        timestamp: new Date().toISOString()
      });
      
      // Clear timeout
      if (transaction.timeout) {
        clearTimeout(transaction.timeout);
      }
      
      this.metrics.rollbacksExecuted++;
      
      // Execute rollback strategy
      const rollbackStrategy = this.rollbackStrategies[transaction.operationType];
      if (rollbackStrategy) {
        await rollbackStrategy(transaction);
      } else {
        // Generic rollback - restore to original state
        await this.restoreRepositoryState(transaction.currentState);
      }
      
      // Update transaction status
      transaction.status = 'rolled-back';
      transaction.endTime = new Date();
      transaction.rollbackReason = reason;
      
      // Move to history
      this.transactionHistory.push(transaction);
      this.activeTransactions.delete(transactionId);
      
      this.metrics.rollbacksSuccessful++;
      
      this.emit('rollback-success', {
        transactionId,
        reason,
        operationsRolledBack: transaction.operations.length,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        transactionId,
        operationsRolledBack: transaction.operations.length,
        reason
      };
      
    } catch (error) {
      this.metrics.rollbacksFailed++;
      
      this.emit('rollback-failed', {
        transactionId,
        reason,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }
  
  /**
   * Get transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {Object} Transaction status
   */
  getTransactionStatus(transactionId) {
    const transaction = this.activeTransactions.get(transactionId) ||
                      this.transactionHistory.find(t => t.id === transactionId);
    
    if (!transaction) {
      return null;
    }
    
    return {
      id: transaction.id,
      operationType: transaction.operationType,
      status: transaction.status,
      startTime: transaction.startTime,
      endTime: transaction.endTime,
      operationsCount: transaction.operations.length,
      metadata: transaction.metadata
    };
  }
  
  /**
   * List active transactions
   * @returns {Array} Active transactions
   */
  getActiveTransactions() {
    return Array.from(this.activeTransactions.values()).map(transaction => ({
      id: transaction.id,
      operationType: transaction.operationType,
      status: transaction.status,
      startTime: transaction.startTime,
      operationsCount: transaction.operations.length,
      metadata: transaction.metadata
    }));
  }
  
  /**
   * Get transaction history
   * @param {number} limit - Maximum number of transactions to return
   * @returns {Array} Transaction history
   */
  getTransactionHistory(limit = 50) {
    return this.transactionHistory
      .slice(-limit)
      .map(transaction => ({
        id: transaction.id,
        operationType: transaction.operationType,
        status: transaction.status,
        startTime: transaction.startTime,
        endTime: transaction.endTime,
        operationsCount: transaction.operations.length,
        rollbackReason: transaction.rollbackReason,
        metadata: transaction.metadata
      }));
  }
  
  // Rollback strategy implementations
  
  async rollbackCommit(transaction) {
    // For commit operations, reset to previous HEAD
    const operations = transaction.operations.filter(op => op.success);
    
    for (const operation of operations.reverse()) {
      if (operation.operation === 'commit') {
        await this.executeGitCommand(['reset', '--hard', 'HEAD~1']);
      }
    }
  }
  
  async rollbackBranch(transaction) {
    // For branch operations, delete created branches or restore deleted ones
    const operations = transaction.operations.filter(op => op.success);
    
    for (const operation of operations.reverse()) {
      if (operation.operation === 'checkout' && operation.args.includes('-b')) {
        // Delete created branch
        const branchName = operation.args[operation.args.indexOf('-b') + 1];
        await this.executeGitCommand(['branch', '-D', branchName]);
      }
    }
  }
  
  async rollbackMerge(transaction) {
    // For merge operations, abort merge or reset to pre-merge state
    try {
      await this.executeGitCommand(['merge', '--abort']);
    } catch (error) {
      // If abort fails, try reset to original state
      await this.restoreRepositoryState(transaction.currentState);
    }
  }
  
  async rollbackPush(transaction) {
    // For push operations, we cannot automatically rollback remote changes
    // This would require force push which is dangerous
    this.emit('rollback-warning', {
      transactionId: transaction.id,
      message: 'Cannot automatically rollback push operations',
      recommendation: 'Manual intervention required for remote rollback'
    });
  }
  
  async rollbackPull(transaction) {
    // For pull operations, reset to pre-pull state
    await this.restoreRepositoryState(transaction.currentState);
  }
  
  async rollbackRebase(transaction) {
    // For rebase operations, abort rebase
    try {
      await this.executeGitCommand(['rebase', '--abort']);
    } catch (error) {
      await this.restoreRepositoryState(transaction.currentState);
    }
  }
  
  async rollbackReset(transaction) {
    // For reset operations, restore to original state
    await this.restoreRepositoryState(transaction.currentState);
  }
  
  async rollbackStash(transaction) {
    // For stash operations, apply the stash back
    const operations = transaction.operations.filter(op => op.success);
    
    for (const operation of operations.reverse()) {
      if (operation.operation === 'stash' && operation.args.includes('push')) {
        await this.executeGitCommand(['stash', 'pop']);
      }
    }
  }
  
  // Utility methods
  
  async captureRepositoryState() {
    try {
      const headResult = await this.executeGitCommand(['rev-parse', 'HEAD']);
      const branchResult = await this.executeGitCommand(['branch', '--show-current']);
      const statusResult = await this.executeGitCommand(['status', '--porcelain']);
      const stashResult = await this.executeGitCommand(['stash', 'list']);
      
      return {
        head: headResult.stdout.trim(),
        currentBranch: branchResult.stdout.trim(),
        workingDirectory: statusResult.stdout,
        stashes: stashResult.stdout,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  async restoreRepositoryState(state) {
    if (state.error) {
      throw new Error(`Cannot restore state: ${state.error}`);
    }
    
    try {
      // Restore HEAD position
      if (state.head) {
        await this.executeGitCommand(['reset', '--hard', state.head]);
      }
      
      // Restore branch if different
      if (state.currentBranch) {
        const currentBranch = await this.executeGitCommand(['branch', '--show-current']);
        if (currentBranch.stdout.trim() !== state.currentBranch) {
          await this.executeGitCommand(['checkout', state.currentBranch]);
        }
      }
    } catch (error) {
      throw new Error(`Failed to restore repository state: ${error.message}`);
    }
  }
  
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async executeGitCommand(args) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd: this.repositoryPath });
      let stdout = '';
      let stderr = '';
      
      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });
    });
  }
  
  /**
   * Get transaction metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeTransactions: this.activeTransactions.size,
      transactionHistory: this.transactionHistory.length,
      successRate: this.metrics.transactionsStarted > 0 
        ? (this.metrics.transactionsCompleted / this.metrics.transactionsStarted) * 100 
        : 0,
      rollbackRate: this.metrics.rollbacksExecuted > 0
        ? (this.metrics.rollbacksSuccessful / this.metrics.rollbacksExecuted) * 100
        : 0
    };
  }
  
  /**
   * Cleanup all active transactions and resources
   */
  async cleanup() {
    // Rollback all active transactions
    const activeTransactionIds = Array.from(this.activeTransactions.keys());
    
    for (const transactionId of activeTransactionIds) {
      try {
        await this.rollbackTransaction(transactionId, 'cleanup');
      } catch (error) {
        console.warn(`Failed to rollback transaction ${transactionId} during cleanup:`, error.message);
      }
    }
    
    // Clear all timers
    for (const transaction of this.activeTransactions.values()) {
      if (transaction.timeout) {
        clearTimeout(transaction.timeout);
      }
    }
    
    this.activeTransactions.clear();
    this.removeAllListeners();
  }
}

export default GitTransactionManager;