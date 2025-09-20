/**
 * ProgressRenderer - Terminal-based progress visualization
 * Provides real-time progress updates with spinners, progress bars, and status indicators
 */

import ora from 'ora';
import chalk from 'chalk';

export class ProgressRenderer {
  constructor(options = {}) {
    this.spinner = null;
    this.currentTask = null;
    this.isActive = false;
    this.startTime = null;
    
    // Progress tracking
    this.totalSteps = 0;
    this.completedSteps = 0;
    this.currentStep = null;
    this.stepHistory = [];
    
    // Options
    this.showElapsed = options.showElapsed !== false;
    this.showSteps = options.showSteps !== false;
    this.verboseMode = options.verbose || false;
  }

  /**
   * Start progress tracking for a task
   * @param {string} taskDescription - Description of the task
   */
  start(taskDescription) {
    if (this.isActive) {
      this.stop();
    }

    this.currentTask = taskDescription;
    this.startTime = Date.now();
    this.isActive = true;
    this.totalSteps = 0;
    this.completedSteps = 0;
    this.stepHistory = [];

    // Start spinner
    this.spinner = ora({
      text: chalk.blue(`🚀 ${taskDescription}`),
      spinner: 'dots',
      color: 'blue'
    }).start();
  }

  /**
   * Update progress with new information
   * @param {Object} progressData - Progress update data
   */
  update(progressData) {
    if (!this.isActive || !this.spinner) {
      return;
    }

    const {
      step,
      totalSteps,
      completedSteps,
      currentOperation,
      classification,
      decomposition,
      toolExecution,
      artifact
    } = progressData;

    // Update step counts
    if (typeof totalSteps === 'number') {
      this.totalSteps = totalSteps;
    }
    if (typeof completedSteps === 'number') {
      this.completedSteps = completedSteps;
    }

    // Handle different types of progress updates
    if (classification) {
      this._updateForClassification(classification);
    } else if (decomposition) {
      this._updateForDecomposition(decomposition);
    } else if (toolExecution) {
      this._updateForToolExecution(toolExecution);
    } else if (step) {
      this._updateForStep(step);
    } else if (currentOperation) {
      this._updateForOperation(currentOperation);
    }

    // Update spinner text
    this._updateSpinnerText();
  }

  /**
   * Mark progress as complete
   * @param {Object} result - Final result
   */
  complete(result = {}) {
    if (!this.isActive || !this.spinner) {
      return;
    }

    const elapsed = this._getElapsedTime();
    
    if (result.success !== false) {
      this.spinner.succeed(chalk.green(`✅ ${this.currentTask} completed${elapsed}`));
    } else {
      this.spinner.fail(chalk.red(`❌ ${this.currentTask} failed${elapsed}`));
    }

    this._cleanup();
  }

  /**
   * Mark progress as failed
   * @param {string|Error} error - Error information
   */
  fail(error) {
    if (!this.isActive || !this.spinner) {
      return;
    }

    const elapsed = this._getElapsedTime();
    const errorMsg = error instanceof Error ? error.message : error;
    
    this.spinner.fail(chalk.red(`❌ ${this.currentTask} failed${elapsed}`));
    
    if (errorMsg && this.verboseMode) {
      console.log(chalk.red(`   Error: ${errorMsg}`));
    }

    this._cleanup();
  }

  /**
   * Stop progress tracking
   */
  stop() {
    if (!this.isActive || !this.spinner) {
      return;
    }

    const elapsed = this._getElapsedTime();
    this.spinner.stop();
    console.log(chalk.yellow(`⏹️  ${this.currentTask} stopped${elapsed}`));

    this._cleanup();
  }

  /**
   * Update for task classification
   * @private
   */
  _updateForClassification(classification) {
    const { type, confidence } = classification;
    this.currentStep = `Classifying task as ${type.toUpperCase()}`;
    
    if (this.verboseMode && confidence) {
      this.currentStep += ` (${(confidence * 100).toFixed(1)}% confidence)`;
    }
  }

  /**
   * Update for task decomposition
   * @private
   */
  _updateForDecomposition(decomposition) {
    const { subtasks, currentSubtask } = decomposition;
    
    if (subtasks && subtasks.length > 0) {
      this.totalSteps = subtasks.length;
      this.currentStep = `Decomposing into ${subtasks.length} subtasks`;
      
      if (this.verboseMode) {
        console.log(chalk.gray('   Subtasks:'));
        subtasks.slice(0, 3).forEach((subtask, i) => {
          console.log(chalk.gray(`     ${i + 1}. ${subtask.description || subtask}`));
        });
        if (subtasks.length > 3) {
          console.log(chalk.gray(`     ... and ${subtasks.length - 3} more`));
        }
      }
    } else if (currentSubtask) {
      this.currentStep = `Executing: ${currentSubtask.description || currentSubtask}`;
    }
  }

  /**
   * Update for tool execution
   * @private
   */
  _updateForToolExecution(toolExecution) {
    const { tool, operation, parameters } = toolExecution;
    
    if (tool && operation) {
      this.currentStep = `Using ${tool} for ${operation}`;
    } else if (tool) {
      this.currentStep = `Executing tool: ${tool}`;
    }
    
    if (this.verboseMode && parameters) {
      console.log(chalk.gray(`   Parameters: ${JSON.stringify(parameters).slice(0, 100)}...`));
    }
  }

  /**
   * Update for step progress
   * @private
   */
  _updateForStep(step) {
    const { description, status, index } = step;
    
    if (description) {
      this.currentStep = description;
    }
    
    if (typeof index === 'number') {
      this.completedSteps = index;
    }
    
    if (status === 'completed') {
      this.stepHistory.push({
        description: description || this.currentStep,
        completedAt: Date.now(),
        status: 'completed'
      });
    }
  }

  /**
   * Update for general operation
   * @private
   */
  _updateForOperation(operation) {
    this.currentStep = operation;
  }

  /**
   * Update spinner text with current progress
   * @private
   */
  _updateSpinnerText() {
    if (!this.spinner) return;

    let text = chalk.blue(`🚀 ${this.currentTask}`);
    
    // Add current step
    if (this.currentStep) {
      text += chalk.gray(` - ${this.currentStep}`);
    }
    
    // Add progress indicator
    if (this.showSteps && this.totalSteps > 0) {
      const percentage = Math.round((this.completedSteps / this.totalSteps) * 100);
      const progressBar = this._generateProgressBar(percentage);
      text += chalk.gray(` ${progressBar} ${percentage}%`);
    }
    
    // Add elapsed time
    if (this.showElapsed) {
      const elapsed = this._getElapsedTime();
      text += chalk.gray(elapsed);
    }
    
    this.spinner.text = text;
  }

  /**
   * Generate ASCII progress bar
   * @private
   */
  _generateProgressBar(percentage) {
    const width = 10;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Get elapsed time string
   * @private
   */
  _getElapsedTime() {
    if (!this.startTime) return '';
    
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.round(elapsed / 1000);
    
    if (seconds < 60) {
      return ` (${seconds}s)`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return ` (${minutes}m ${remainingSeconds}s)`;
    }
  }

  /**
   * Clean up progress tracking
   * @private
   */
  _cleanup() {
    this.isActive = false;
    this.spinner = null;
    this.currentTask = null;
    this.currentStep = null;
    this.startTime = null;
  }

  /**
   * Get current progress status
   * @returns {Object} Progress status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      currentTask: this.currentTask,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      completedSteps: this.completedSteps,
      elapsedTime: this.startTime ? Date.now() - this.startTime : 0,
      stepHistory: this.stepHistory
    };
  }
}