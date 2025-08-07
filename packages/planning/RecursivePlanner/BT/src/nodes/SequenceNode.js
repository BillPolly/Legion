/**
 * SequenceNode - Executes children in order, fails fast on first failure
 * 
 * Control flow:
 * - Execute children sequentially from left to right
 * - Return SUCCESS only if ALL children succeed
 * - Return FAILURE immediately when first child fails
 * - Support for conditional execution and early termination
 */

import { BehaviorTreeNode, NodeStatus } from '../core/BehaviorTreeNode.js';

export class SequenceNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'sequence';
  }

  async executeNode(context) {
    const results = [];
    const sequenceData = {
      totalSteps: this.children.length,
      completedSteps: 0,
      stepResults: []
    };

    // Execute each child in order
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      
      try {
        if (this.config.debugMode) {
          console.log(`[SequenceNode:${this.id}] Executing step ${i + 1}/${this.children.length}`);
        }

        // Check for early termination conditions
        if (this.shouldTerminateEarly(context, i)) {
          return {
            status: NodeStatus.SUCCESS,
            data: {
              ...sequenceData,
              earlyTermination: true,
              terminatedAt: i
            }
          };
        }

        // Execute child with potentially modified context
        const childContext = this.prepareChildContext(context, i);
        const result = await child.execute(childContext);
        
        results.push(result);
        sequenceData.stepResults.push({
          stepIndex: i,
          childId: child.id,
          status: result.status,
          data: result.data
        });

        // Handle child result
        if (result.status === NodeStatus.FAILURE) {
          // Fail fast - return immediately on first failure
          return {
            status: NodeStatus.FAILURE,
            data: {
              ...sequenceData,
              completedSteps: i + 1,
              failedAt: i,
              failureReason: result.error || 'Child execution failed',
              results
            }
          };
        } else if (result.status === NodeStatus.RUNNING) {
          // If child is still running, sequence is running
          return {
            status: NodeStatus.RUNNING,
            data: {
              ...sequenceData,
              completedSteps: i,
              currentStep: i,
              results
            }
          };
        } else if (result.status === NodeStatus.SUCCESS) {
          // Child succeeded, continue to next
          sequenceData.completedSteps = i + 1;
          
          // Merge child results into context for subsequent steps
          this.mergeChildResultIntoContext(context, result, i);
          
          // Send progress update to parent if configured
          if (this.config.reportProgress) {
            this.sendToParent({
              type: 'SEQUENCE_PROGRESS',
              stepIndex: i,
              completedSteps: i + 1,
              totalSteps: this.children.length,
              stepResult: result
            });
          }
        }
      } catch (error) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            ...sequenceData,
            completedSteps: i,
            failedAt: i,
            error: error.message,
            stackTrace: error.stack,
            results
          }
        };
      }
    }

    // All children succeeded
    return {
      status: NodeStatus.SUCCESS,
      data: {
        ...sequenceData,
        completedSteps: this.children.length,
        results,
        sequenceComplete: true
      }
    };
  }

  /**
   * Check if sequence should terminate early based on conditions
   * @param {Object} context - Current execution context
   * @param {number} stepIndex - Current step index
   * @returns {boolean} True if should terminate early
   */
  shouldTerminateEarly(context, stepIndex) {
    // Check for conditional execution
    if (this.config.conditions) {
      const condition = this.config.conditions[stepIndex];
      if (condition && !this.evaluateCondition(condition, context)) {
        return true;
      }
    }

    // Check for dynamic termination signals
    if (context.terminateSequence) {
      return true;
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

    // Add sequence-specific context
    childContext.sequenceInfo = {
      stepIndex: childIndex,
      totalSteps: this.children.length,
      isFirstStep: childIndex === 0,
      isLastStep: childIndex === this.children.length - 1
    };

    // Apply step-specific context modifications
    if (this.config.stepContexts && this.config.stepContexts[childIndex]) {
      Object.assign(childContext, this.config.stepContexts[childIndex]);
    }

    return childContext;
  }

  /**
   * Merge child execution result into context for subsequent steps
   * @param {Object} context - Parent context to modify
   * @param {Object} result - Child execution result
   * @param {number} stepIndex - Step index
   */
  mergeChildResultIntoContext(context, result, stepIndex) {
    // Create step results array if not exists
    if (!context.stepResults) {
      context.stepResults = [];
    }

    // Store result by step index
    context.stepResults[stepIndex] = result;

    // Store result by step name if provided
    const stepName = this.config.stepNames?.[stepIndex];
    if (stepName && result.data) {
      context[stepName] = result.data;
    }

    // Store result by child ID if the child has one
    const child = this.children[stepIndex];
    if (child && child.id && result.data) {
      context[child.id] = result;
    }

    // Merge artifacts if present
    if (result.data && typeof result.data === 'object') {
      // Selective merging based on configuration
      if (this.config.mergeResults !== false) {
        if (result.data.artifacts) {
          context.artifacts = { ...context.artifacts, ...result.data.artifacts };
        }
        
        // Merge specific keys if configured
        if (this.config.mergeKeys) {
          for (const key of this.config.mergeKeys) {
            if (result.data[key] !== undefined) {
              context[key] = result.data[key];
            }
          }
        }
      }
    }
  }

  /**
   * Simple condition evaluation
   * @param {string} condition - Condition expression
   * @param {Object} context - Execution context
   * @returns {boolean} Condition result
   */
  evaluateCondition(condition, context) {
    try {
      // Simple template-based condition evaluation
      // In production, would use a proper expression evaluator
      const resolved = this.substitutePlaceholders(condition, context);
      
      // Basic comparisons
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

      // Treat as boolean
      return Boolean(resolved);
    } catch (error) {
      console.warn(`[SequenceNode] Condition evaluation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle messages from children during execution
   * @param {BehaviorTreeNode} child - Child sender
   * @param {Object} message - Message payload
   */
  handleChildMessage(child, message) {
    super.handleChildMessage(child, message);

    switch (message.type) {
      case 'REQUEST_TERMINATION':
        // Child requests sequence termination
        this.sendToParent({
          type: 'SEQUENCE_TERMINATION_REQUESTED',
          requestedBy: child.id,
          reason: message.reason
        });
        break;

      case 'STEP_MILESTONE':
        // Child reports milestone completion
        this.sendToParent({
          type: 'SEQUENCE_MILESTONE',
          stepIndex: this.children.indexOf(child),
          milestone: message.milestone,
          data: message.data
        });
        break;

      case 'CONTEXT_UPDATE':
        // Child wants to update sequence context
        if (message.updates) {
          Object.assign(this.context, message.updates);
        }
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
      case 'PAUSE_SEQUENCE':
        // Pause current execution
        this.sendToChildren({
          type: 'PAUSE_EXECUTION'
        });
        break;

      case 'RESUME_SEQUENCE':
        // Resume paused execution
        this.sendToChildren({
          type: 'RESUME_EXECUTION'
        });
        break;

      case 'SKIP_TO_STEP':
        // Skip to specific step
        this.context.skipToStep = message.stepIndex;
        break;
    }
  }

  /**
   * Get sequence-specific metadata
   * @returns {Object} Extended metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'sequence',
      failFast: true,
      stepNames: this.config.stepNames || [],
      totalSteps: this.children.length,
      supportsConditionalExecution: !!this.config.conditions,
      supportsProgressReporting: !!this.config.reportProgress
    };
  }
}