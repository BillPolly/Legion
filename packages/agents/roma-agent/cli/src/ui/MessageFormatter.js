/**
 * MessageFormatter - Formats various types of messages for terminal display
 * Handles status displays, execution results, history tables, and other CLI output
 */

import chalk from 'chalk';
import Table from 'cli-table3';

export class MessageFormatter {
  constructor(options = {}) {
    this.colors = options.colors !== false;
    this.unicode = options.unicode !== false;
    this.compact = options.compact || false;
  }

  /**
   * Format agent status for display
   * @param {Object} status - Agent status data
   * @returns {string} Formatted status
   */
  formatStatus(status) {
    const lines = [];
    
    lines.push(chalk.blue.bold('📊 ROMA Agent Status'));
    lines.push('');
    
    // Agent info
    if (status.agent) {
      lines.push(chalk.cyan('🧠 Agent:'));
      lines.push(`  Initialized: ${this._formatBoolean(status.agent.isInitialized)}`);
      lines.push(`  Active Executions: ${chalk.yellow(status.agent.activeExecutions || 0)}`);
      
      if (status.agent.statistics) {
        lines.push('');
        lines.push(chalk.cyan('📈 Statistics:'));
        const stats = status.agent.statistics;
        lines.push(`  Total Executions: ${chalk.blue(stats.totalExecutions || 0)}`);
        lines.push(`  Successful: ${chalk.green(stats.successful || 0)}`);
        lines.push(`  Failed: ${chalk.red(stats.failed || 0)}`);
        if (stats.totalExecutions > 0) {
          const rate = ((stats.successful / stats.totalExecutions) * 100).toFixed(1);
          lines.push(`  Success Rate: ${chalk.yellow(rate + '%')}`);
        }
      }
    }
    
    // Active executions
    if (status.activeExecutions && status.activeExecutions.length > 0) {
      lines.push('');
      lines.push(chalk.cyan('🔄 Active Executions:'));
      status.activeExecutions.forEach(exec => {
        const duration = exec.startTime ? this._formatDuration(Date.now() - new Date(exec.startTime).getTime()) : 'unknown';
        lines.push(`  ${exec.executionId}: ${chalk.yellow(exec.status)} (${duration})`);
      });
    }
    
    lines.push('');
    lines.push(chalk.gray(`Updated: ${new Date().toLocaleTimeString()}`));
    
    return lines.join('\n');
  }

  /**
   * Format execution statistics
   * @param {Object} statistics - Statistics data
   * @returns {string} Formatted statistics
   */
  formatStatistics(statistics) {
    const table = new Table({
      head: ['Metric', 'Value'],
      style: { head: ['cyan'] }
    });

    table.push(
      ['Total Executions', chalk.blue(statistics.totalExecutions || 0)],
      ['Successful', chalk.green(statistics.successful || 0)],
      ['Failed', chalk.red(statistics.failed || 0)],
      ['Active', chalk.yellow(statistics.activeExecutions || 0)]
    );

    if (statistics.totalExecutions > 0) {
      const rate = ((statistics.successful / statistics.totalExecutions) * 100).toFixed(1);
      table.push(['Success Rate', chalk.yellow(rate + '%')]);
    }

    return table.toString();
  }

  /**
   * Format execution history
   * @param {Array} history - Execution history
   * @param {Object} options - Formatting options
   * @returns {string} Formatted history
   */
  formatHistory(history, options = {}) {
    if (!history || history.length === 0) {
      return chalk.gray('📚 No execution history available');
    }

    const table = new Table({
      head: ['ID', 'Task', 'Status', 'Duration', 'Started'],
      style: { head: ['cyan'] },
      colWidths: [15, 40, 12, 12, 20]
    });

    history.slice(0, options.limit || 10).forEach(exec => {
      const shortId = exec.executionId?.slice(-8) || 'unknown';
      const task = (exec.task?.description || 'Unknown task').slice(0, 35) + 
                   (exec.task?.description?.length > 35 ? '...' : '');
      const status = this._formatStatus(exec.status);
      const duration = exec.duration ? this._formatDuration(exec.duration) : '-';
      const started = exec.startTime ? 
        new Date(exec.startTime).toLocaleString() : '-';
      
      table.push([shortId, task, status, duration, started]);
    });

    return `${chalk.blue.bold('📚 Execution History')}\n\n${table.toString()}`;
  }

  /**
   * Format execution result
   * @param {Object} result - Execution result
   * @returns {string} Formatted result
   */
  formatExecutionResult(result) {
    const lines = [];
    
    // Handle different response types from ChatAgent
    const responseType = result.responseType || (result.result && result.result.type) || 'unknown';
    const message = result.result?.message || result.message || '';
    
    switch (responseType) {
      case 'chat':
        // Chat response - conversational
        lines.push(chalk.blue.bold('💬 ROMA:'));
        lines.push('');
        lines.push(message || 'No response');
        break;
        
      case 'clarification_request':
        // Needs more information
        lines.push(chalk.yellow.bold('🤔 ROMA needs clarification:'));
        lines.push('');
        lines.push(message || 'Could you provide more details?');
        break;
        
      case 'query':
        // Information query response
        lines.push(chalk.cyan.bold('ℹ️  Information:'));
        lines.push('');
        lines.push(message);
        if (result.result?.data) {
          lines.push('');
          lines.push(this._formatObject(result.result.data, 2));
        }
        break;
        
      case 'task_execution':
        // Full task execution with decomposition
        lines.push(chalk.green.bold('✅ Task Execution Complete'));
        lines.push('');
        if (result.executionId) {
          lines.push(`${chalk.cyan('Execution ID:')} ${result.executionId}`);
        }
        lines.push('');
        lines.push(message || 'Task completed successfully');
        break;
        
      default:
        // Unknown or error response
        if (result.success || (!result.error && !result.result?.error)) {
          lines.push(chalk.green.bold('✅ Task Completed Successfully'));
        } else {
          lines.push(chalk.red.bold('❌ Task Failed'));
        }
        
        lines.push('');
        
        // Execution info
        if (result.executionId) {
          lines.push(`${chalk.cyan('Execution ID:')} ${result.executionId}`);
        }
        
        if (result.result) {
          if (typeof result.result === 'object' && result.result.message) {
            lines.push(result.result.message);
          } else if (typeof result.result === 'string') {
            lines.push(result.result);
          } else {
            lines.push(`${chalk.cyan('Result:')}`);
            lines.push(this._formatObject(result.result, 2));
          }
        }
        
        if (result.error || result.result?.error) {
          lines.push(`${chalk.red('Error:')} ${result.error || result.result.error}`);
        }
    }
    
    // Artifacts
    if (result.artifacts && result.artifacts.length > 0) {
      lines.push('');
      lines.push(chalk.cyan('📦 Generated Artifacts:'));
      result.artifacts.forEach(artifact => {
        lines.push(`  ${this._formatArtifact(artifact)}`);
      });
    }
    
    // Statistics
    if (result.statistics) {
      lines.push('');
      lines.push(chalk.cyan('📊 Updated Statistics:'));
      lines.push(`  Total: ${result.statistics.totalExecutions || 0}`);
      lines.push(`  Success Rate: ${((result.statistics.successful / result.statistics.totalExecutions) * 100).toFixed(1)}%`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format task decomposition tree
   * @param {Object} decomposition - Task decomposition data
   * @returns {string} Formatted tree
   */
  formatDecomposition(decomposition) {
    const lines = [];
    
    lines.push(chalk.blue.bold('🌳 Task Decomposition'));
    lines.push('');
    
    if (decomposition.classification) {
      lines.push(`${chalk.cyan('Classification:')} ${decomposition.classification.type.toUpperCase()}`);
      if (decomposition.classification.confidence) {
        lines.push(`${chalk.cyan('Confidence:')} ${(decomposition.classification.confidence * 100).toFixed(1)}%`);
      }
      lines.push('');
    }
    
    if (decomposition.subtasks) {
      lines.push(chalk.cyan('Subtasks:'));
      decomposition.subtasks.forEach((subtask, index) => {
        const prefix = index === decomposition.subtasks.length - 1 ? '└─' : '├─';
        lines.push(`  ${prefix} ${subtask.description || subtask}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Format error message
   * @param {Error|string} error - Error to format
   * @returns {string} Formatted error
   */
  formatError(error) {
    const message = error instanceof Error ? error.message : error;
    return `${chalk.red.bold('❌ Error:')} ${message}`;
  }

  /**
   * Format connection status
   * @param {Object} status - Connection status
   * @returns {string} Formatted status
   */
  formatConnectionStatus(status) {
    const lines = [];
    
    lines.push(chalk.blue.bold('🔗 Connection Status'));
    lines.push('');
    
    lines.push(`Connected: ${this._formatBoolean(status.isConnected)}`);
    lines.push(`Ready: ${this._formatBoolean(status.isReady)}`);
    
    if (status.clientStatus) {
      lines.push(`Reconnect Attempts: ${status.clientStatus.reconnectAttempts || 0}`);
      lines.push(`Queued Messages: ${status.clientStatus.queuedMessages || 0}`);
      lines.push(`Pending Requests: ${status.clientStatus.pendingRequests || 0}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format JSON output
   * @param {Object} data - Data to format as JSON
   * @returns {string} Formatted JSON
   */
  formatJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Format help text
   * @returns {string} Help text
   */
  formatHelp() {
    const lines = [];
    
    lines.push(chalk.blue.bold('🧠 ROMA CLI - Interactive Chat Mode'));
    lines.push('');
    lines.push(chalk.cyan('💬 Chat with ROMA:'));
    lines.push('  Just type your task naturally and press Enter');
    lines.push(`  Example: ${chalk.gray('Create a simple calculator app')}`);
    lines.push(`  Example: ${chalk.gray('Write a function that adds two numbers')}`);
    lines.push('');
    lines.push(chalk.cyan('📋 Slash Commands:'));
    lines.push('');
    lines.push(`  ${chalk.yellow('/status')} or ${chalk.yellow('/s')}`);
    lines.push('    Show current agent status and statistics');
    lines.push('');
    lines.push(`  ${chalk.yellow('/history [limit]')} or ${chalk.yellow('/h')}`);
    lines.push('    Show execution history');
    lines.push(`    Example: ${chalk.gray('/history 5')}`);
    lines.push('');
    lines.push(`  ${chalk.yellow('/watch <id>')} or ${chalk.yellow('/w <id>')}`);
    lines.push('    Watch a specific execution in real-time');
    lines.push(`    Example: ${chalk.gray('/watch exec_1234567890')}`);
    lines.push('');
    lines.push(`  ${chalk.yellow('/clear')}`);
    lines.push('    Clear the terminal screen');
    lines.push('');
    lines.push(`  ${chalk.yellow('/help')}`);
    lines.push('    Show this help message');
    lines.push('');
    lines.push(`  ${chalk.yellow('/exit')} or ${chalk.yellow('/quit')} or ${chalk.yellow('/q')}`);
    lines.push('    Exit the CLI');
    
    return lines.join('\n');
  }

  /**
   * Format boolean value with colors
   * @private
   */
  _formatBoolean(value) {
    return value ? chalk.green('✓') : chalk.red('✗');
  }

  /**
   * Format status with colors
   * @private
   */
  _formatStatus(status) {
    switch (status) {
      case 'completed':
      case 'success':
        return chalk.green('✓ Complete');
      case 'running':
      case 'in_progress':
        return chalk.yellow('⏳ Running');
      case 'failed':
      case 'error':
        return chalk.red('✗ Failed');
      case 'cancelled':
        return chalk.gray('⏹ Cancelled');
      default:
        return chalk.gray(status || 'Unknown');
    }
  }

  /**
   * Format duration
   * @private
   */
  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Format object with indentation
   * @private
   */
  _formatObject(obj, indent = 0) {
    const spaces = ' '.repeat(indent);
    const lines = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        lines.push(`${spaces}${key}:`);
        lines.push(this._formatObject(value, indent + 2));
      } else {
        lines.push(`${spaces}${key}: ${value}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format artifact info
   * @private
   */
  _formatArtifact(artifact) {
    if (typeof artifact === 'string') {
      return artifact;
    }
    
    const type = artifact.type || 'unknown';
    const name = artifact.name || artifact.path || 'unnamed';
    return `${chalk.blue(type)}: ${name}`;
  }
}