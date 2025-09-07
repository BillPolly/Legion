/**
 * SelectorNode - Tries children until one succeeds (fallback behavior)
 * 
 * Control flow:
 * - Execute children sequentially until one succeeds
 * - Return SUCCESS as soon as any child succeeds
 * - Return FAILURE only if ALL children fail
 * - Supports priority-based execution and dynamic child selection
 */

import { BehaviorTreeNode, NodeStatus } from '../core/BehaviorTreeNode.js';

export class SelectorNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'selector';
  }

  async executeNode(context) {
    const results = [];
    const selectorData = {
      totalOptions: this.children.length,
      attemptedOptions: 0,
      optionResults: [],
      successfulOption: null
    };

    // Determine execution order
    const executionOrder = this.getExecutionOrder(context);
    
    if (this.config && this.config.debugMode) {
      console.log(`[SelectorNode:${this.id}] Trying ${this.children.length} options in order:`, executionOrder);
    }

    // Try each child until one succeeds
    for (let i = 0; i < executionOrder.length; i++) {
      const childIndex = executionOrder[i];
      const child = this.children[childIndex];
      
      try {
        if (this.config && this.config.debugMode) {
          console.log(`[SelectorNode:${this.id}] Trying option ${i + 1}/${executionOrder.length} (child ${childIndex})`);
        }

        // Check if this option should be skipped
        if (this.shouldSkipOption(context, childIndex)) {
          if (this.config && this.config.debugMode) {
            console.log(`[SelectorNode:${this.id}] Skipping option ${childIndex} due to conditions`);
          }
          continue;
        }

        // Execute child with potentially modified context
        const childContext = this.prepareChildContext(context, childIndex);
        const result = await child.execute(childContext);
        
        results.push({ childIndex, result });
        selectorData.attemptedOptions = i + 1;
        selectorData.optionResults.push({
          optionIndex: i,
          childIndex: childIndex,
          childId: child.id,
          status: result.status,
          data: result.data
        });

        // Handle child result
        if (result.status === NodeStatus.SUCCESS) {
          // Success! Return immediately
          selectorData.successfulOption = childIndex;
          
          // Notify parent of successful selection
          this.sendToParent({
            type: 'SELECTOR_SUCCESS',
            selectedOption: childIndex,
            attemptedOptions: i + 1,
            totalOptions: this.children.length,
            result: result
          });

          return {
            status: NodeStatus.SUCCESS,
            data: {
              ...selectorData,
              selectedResult: result.data,
              results
            },
            nodeResults: context.nodeResults  // Pass accumulated nodeResults
          };
        } else if (result.status === NodeStatus.RUNNING) {
          // Child is still running, selector is running
          return {
            status: NodeStatus.RUNNING,
            data: {
              ...selectorData,
              currentOption: childIndex,
              results
            },
            nodeResults: context.nodeResults  // Pass accumulated nodeResults
          };
        } else if (result.status === NodeStatus.FAILURE) {
          // Child failed, try next option
          if (this.config && this.config.debugMode) {
            console.log(`[SelectorNode:${this.id}] Option ${childIndex} failed, trying next`);
          }
          
          // Report option failure to parent if configured
          if (this.config.reportFailures) {
            this.sendToParent({
              type: 'SELECTOR_OPTION_FAILED',
              failedOption: childIndex,
              attemptedOptions: i + 1,
              totalOptions: this.children.length,
              error: result.error
            });
          }
          
          // Check if we should stop trying based on failure type
          if (this.shouldStopOnFailure(result, childIndex, context)) {
            break;
          }
        }
      } catch (error) {
        // Execution error, log and try next option
        console.warn(`[SelectorNode:${this.id}] Option ${childIndex} threw error:`, error.message);
        
        results.push({
          childIndex,
          result: {
            status: NodeStatus.FAILURE,
            error: error.message,
            data: { errorMessage: error.message, stackTrace: error.stack }
          }
        });

        if (this.shouldStopOnError(error, childIndex, context)) {
          break;
        }
      }
    }

    // All options failed
    return {
      status: NodeStatus.FAILURE,
      data: {
        ...selectorData,
        allOptionsFailed: true,
        failureReason: 'All selector options failed',
        results
      },
      nodeResults: context.nodeResults  // Pass accumulated nodeResults
    };
  }

  /**
   * Determine the order in which to execute children
   * @param {Object} context - Execution context
   * @returns {Array<number>} Array of child indices in execution order
   */
  getExecutionOrder(context) {
    const childCount = this.children.length;
    let order = Array.from({ length: childCount }, (_, i) => i);

    // Apply execution strategy
    const strategy = this.config.executionStrategy || 'sequential';
    
    switch (strategy) {
      case 'sequential':
        // Default order - no change
        break;
        
      case 'reverse':
        // Reverse order
        order = order.reverse();
        break;
        
      case 'priority':
        // Sort by priority (higher priority first)
        order = order.sort((a, b) => {
          const priorityA = this.config.priorities?.[a] || 0;
          const priorityB = this.config.priorities?.[b] || 0;
          return priorityB - priorityA;
        });
        break;
        
      case 'random':
        // Randomize order
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        break;
        
      case 'contextual':
        // Order based on context evaluation
        order = this.getContextualOrder(context);
        break;
        
      case 'adaptive':
        // Order based on historical success rates
        order = this.getAdaptiveOrder(context);
        break;
    }

    return order;
  }

  /**
   * Get contextual execution order based on current context
   * @param {Object} context - Execution context
   * @returns {Array<number>} Ordered child indices
   */
  getContextualOrder(context) {
    const scores = this.children.map((child, index) => ({
      index,
      score: this.calculateContextScore(child, context, index)
    }));

    // Sort by score (higher first)
    scores.sort((a, b) => b.score - a.score);
    
    return scores.map(item => item.index);
  }

  /**
   * Calculate context-based score for child selection
   * @param {BehaviorTreeNode} child - Child node
   * @param {Object} context - Execution context
   * @param {number} index - Child index
   * @returns {number} Context score
   */
  calculateContextScore(child, context, index) {
    let score = 0;

    // Base priority
    score += this.config.priorities?.[index] || 0;

    // Context-based scoring
    if (this.config.contextScoring) {
      for (const [condition, points] of Object.entries(this.config.contextScoring)) {
        if (this.evaluateCondition(condition, context)) {
          score += points;
        }
      }
    }

    // Historical success rate
    const successRate = this.getChildSuccessRate(index);
    score += successRate * 10; // Weight success rate

    return score;
  }

  /**
   * Get adaptive execution order based on historical performance
   * @param {Object} context - Execution context
   * @returns {Array<number>} Ordered child indices
   */
  getAdaptiveOrder(context) {
    // This would integrate with performance tracking
    // For now, fallback to priority-based ordering
    return this.getExecutionOrder({ ...context, executionStrategy: 'priority' });
  }

  /**
   * Check if option should be skipped based on conditions
   * @param {Object} context - Execution context
   * @param {number} childIndex - Child index
   * @returns {boolean} True if should skip
   */
  shouldSkipOption(context, childIndex) {
    // Check skip conditions
    if (this.config.skipConditions) {
      const skipCondition = this.config.skipConditions[childIndex];
      if (skipCondition && this.evaluateCondition(skipCondition, context)) {
        return true;
      }
    }

    // Check availability conditions
    if (this.config.availabilityChecks) {
      const availabilityCheck = this.config.availabilityChecks[childIndex];
      if (availabilityCheck && !this.evaluateCondition(availabilityCheck, context)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if selector should stop trying options after a failure
   * @param {Object} result - Child execution result
   * @param {number} childIndex - Child index
   * @param {Object} context - Execution context
   * @returns {boolean} True if should stop
   */
  shouldStopOnFailure(result, childIndex, context) {
    // Stop on critical failures
    if (result.data?.critical || result.data?.stopSelector) {
      return true;
    }

    // Stop based on error codes
    if (this.config.stopOnErrorCodes) {
      const errorCode = result.data?.code || result.data?.errorCode;
      if (errorCode && this.config.stopOnErrorCodes.includes(errorCode)) {
        return true;
      }
    }

    // Context-based stop conditions
    if (context.stopSelectorOnFailure) {
      return true;
    }

    return false;
  }

  /**
   * Check if selector should stop on execution error
   * @param {Error} error - Execution error
   * @param {number} childIndex - Child index
   * @param {Object} context - Execution context
   * @returns {boolean} True if should stop
   */
  shouldStopOnError(error, childIndex, context) {
    // Stop on specific error types
    if (this.config.stopOnErrorTypes) {
      if (this.config.stopOnErrorTypes.includes(error.constructor.name)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Prepare execution context for child node
   * @param {Object} parentContext - Parent execution context
   * @param {number} childIndex - Child index
   * @returns {Object} Modified context for child
   */
  prepareChildContext(parentContext, childIndex) {
    const childContext = { ...parentContext };

    // Add selector-specific context
    childContext.selectorInfo = {
      optionIndex: childIndex,
      totalOptions: this.children.length,
      isFirstOption: childIndex === 0,
      isLastOption: childIndex === this.children.length - 1,
      previousAttempts: childContext.selectorInfo?.previousAttempts || 0
    };

    // Apply option-specific context modifications
    if (this.config.optionContexts && this.config.optionContexts[childIndex]) {
      Object.assign(childContext, this.config.optionContexts[childIndex]);
    }

    return childContext;
  }

  /**
   * Simple condition evaluation (shared with SequenceNode)
   * @param {string} condition - Condition expression
   * @param {Object} context - Execution context
   * @returns {boolean} Condition result
   */
  evaluateCondition(condition, context) {
    try {
      const resolved = this.substitutePlaceholders(condition, context);
      
      // Basic comparisons (same as SequenceNode)
      if (resolved.includes('===')) {
        const [left, right] = resolved.split('===').map(s => s.trim());
        return left === right;
      }
      if (resolved.includes('!==')) {
        const [left, right] = resolved.split('!==').map(s => s.trim());
        return left !== right;
      }
      if (resolved.includes('>=')) {
        const [left, right] = resolved.split('>=').map(s => s.trim());
        return Number(left) >= Number(right);
      }
      if (resolved.includes('<=')) {
        const [left, right] = resolved.split('<=').map(s => s.trim());
        return Number(left) <= Number(right);
      }

      return Boolean(resolved);
    } catch (error) {
      console.warn(`[SelectorNode] Condition evaluation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get historical success rate for child (stub for future implementation)
   * @param {number} childIndex - Child index
   * @returns {number} Success rate between 0 and 1
   */
  getChildSuccessRate(childIndex) {
    // This would integrate with performance tracking system
    return 0.5; // Default neutral score
  }

  /**
   * Handle messages from children
   * @param {BehaviorTreeNode} child - Child sender
   * @param {Object} message - Message payload
   */
  handleChildMessage(child, message) {
    super.handleChildMessage(child, message);

    const childIndex = this.children.indexOf(child);

    switch (message.type) {
      case 'OPTION_CONFIDENCE':
        // Child reports confidence in success
        this.sendToParent({
          type: 'SELECTOR_OPTION_CONFIDENCE',
          optionIndex: childIndex,
          confidence: message.confidence,
          reason: message.reason
        });
        break;

      case 'REQUEST_SKIP_REMAINING':
        // Child succeeded and requests skipping remaining options
        this.context.skipRemaining = true;
        break;

      case 'SUGGEST_ALTERNATIVE':
        // Child suggests alternative approach
        this.sendToParent({
          type: 'SELECTOR_ALTERNATIVE_SUGGESTED',
          failedOption: childIndex,
          alternative: message.alternative
        });
        break;
    }
  }

  /**
   * Handle messages from parent
   * @param {Object} message - Message from parent
   */
  handleParentMessage(message) {
    super.handleParentMessage(message);

    switch (message.type) {
      case 'SET_PRIORITIES':
        // Update option priorities
        if (message.priorities) {
          this.config.priorities = { ...this.config.priorities, ...message.priorities };
        }
        break;

      case 'EXCLUDE_OPTIONS':
        // Exclude specific options from execution
        this.context.excludedOptions = message.options || [];
        break;

      case 'RESET_STATISTICS':
        // Reset performance statistics
        this.resetPerformanceStats();
        break;
    }
  }

  /**
   * Reset performance statistics (stub)
   */
  resetPerformanceStats() {
    // Would reset historical performance data
  }

  /**
   * Get selector-specific metadata
   * @returns {Object} Extended metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'selector',
      fallbackBehavior: true,
      executionStrategy: this.config.executionStrategy || 'sequential',
      totalOptions: this.children.length,
      priorities: this.config.priorities || {},
      supportsAdaptiveOrdering: !!this.config.executionStrategy?.includes('adaptive'),
      supportsConditionalSkipping: !!this.config.skipConditions
    };
  }
}