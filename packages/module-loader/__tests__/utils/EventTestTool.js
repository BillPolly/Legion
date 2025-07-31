/**
 * EventTestTool - A comprehensive tool for testing event emission
 * 
 * This tool demonstrates all 4 event types (progress, info, warning, error)
 * and simulates real-world scenarios with realistic timing and rich metadata.
 */

import Tool from '../../src/tool/Tool.js';
import { z } from 'zod';

export class EventTestTool extends Tool {
  constructor() {
    super({
      name: 'event_test',
      description: 'Comprehensive event testing tool that emits all event types with realistic scenarios',
      inputSchema: z.object({
        scenario: z.enum(['data_processing', 'file_operations', 'api_calls', 'computation'])
          .default('data_processing')
          .describe('The test scenario to execute'),
        itemCount: z.number().min(1).max(100).default(10)
          .describe('Number of items to process (affects progress events)'),
        includeWarnings: z.boolean().default(true)
          .describe('Whether to emit warning events during processing'),
        includeErrors: z.boolean().default(false)
          .describe('Whether to emit error events (recoverable errors)'),
        delayMs: z.number().min(0).max(1000).default(100)
          .describe('Delay between operations in milliseconds')
      })
    });
  }

  async execute(params) {
    const { scenario, itemCount, includeWarnings, includeErrors, delayMs } = params;
    
    this.info('Starting event test execution', {
      scenario,
      itemCount,
      includeWarnings,
      includeErrors,
      timestamp: new Date().toISOString()
    });

    const results = {
      scenario,
      itemsProcessed: 0,
      warningsGenerated: 0,
      errorsGenerated: 0,
      events: [],
      startTime: Date.now()
    };

    try {
      // Execute the selected scenario
      switch (scenario) {
        case 'data_processing':
          await this._executeDataProcessingScenario(itemCount, includeWarnings, includeErrors, delayMs, results);
          break;
        case 'file_operations':
          await this._executeFileOperationsScenario(itemCount, includeWarnings, includeErrors, delayMs, results);
          break;
        case 'api_calls':
          await this._executeApiCallsScenario(itemCount, includeWarnings, includeErrors, delayMs, results);
          break;
        case 'computation':
          await this._executeComputationScenario(itemCount, includeWarnings, includeErrors, delayMs, results);
          break;
      }

      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;

      this.info('Event test execution completed successfully', {
        totalDuration: results.duration,
        itemsProcessed: results.itemsProcessed,
        warningsGenerated: results.warningsGenerated,
        errorsGenerated: results.errorsGenerated,
        eventsPerSecond: Math.round((results.itemsProcessed * 4) / (results.duration / 1000))
      });

      return results;

    } catch (error) {
      this.error('Event test execution failed', {
        error: error.message,
        scenario,
        itemsProcessed: results.itemsProcessed
      });
      throw error;
    }
  }

  async _executeDataProcessingScenario(itemCount, includeWarnings, includeErrors, delayMs, results) {
    this.progress('Initializing data processing pipeline', 0, {
      stage: 'initialization',
      pipeline: 'data_processing'
    });

    for (let i = 0; i < itemCount; i++) {
      const percentage = Math.round(((i + 1) / itemCount) * 100);
      
      // Emit progress event
      this.progress(`Processing data item ${i + 1}/${itemCount}`, percentage, {
        stage: 'processing',
        itemId: `item_${i + 1}`,
        batchSize: Math.min(5, itemCount - i),
        memoryUsage: Math.random() * 100
      });

      // Simulate processing delay
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      // Emit info event for significant milestones
      if ((i + 1) % Math.max(1, Math.floor(itemCount / 4)) === 0) {
        this.info(`Milestone reached: ${i + 1} items processed`, {
          milestone: `${Math.round(((i + 1) / itemCount) * 100)}%`,
          throughput: Math.round((i + 1) / ((Date.now() - results.startTime) / 1000)),
          estimatedCompletion: new Date(Date.now() + ((itemCount - i - 1) * delayMs)).toISOString()
        });
      }

      // Emit warning events occasionally
      if (includeWarnings && Math.random() < 0.3) {
        this.warning(`Data quality issue detected in item ${i + 1}`, {
          itemId: `item_${i + 1}`,
          issue: 'missing_optional_field',
          severity: 'low',
          corrective_action: 'using_default_value'
        });
        results.warningsGenerated++;
      }

      // Emit error events occasionally (but continue processing)
      if (includeErrors && Math.random() < 0.1) {
        this.error(`Recoverable error processing item ${i + 1}`, {
          itemId: `item_${i + 1}`,
          errorType: 'validation_error',
          recovery: 'skipped_invalid_field',
          impact: 'minimal'
        });
        results.errorsGenerated++;
      }

      results.itemsProcessed++;
    }

    this.progress('Data processing pipeline completed', 100, {
      stage: 'completion',
      finalCount: results.itemsProcessed
    });
  }

  async _executeFileOperationsScenario(itemCount, includeWarnings, includeErrors, delayMs, results) {
    this.progress('Starting file operations batch', 0, {
      stage: 'initialization',
      operation: 'file_batch'
    });

    for (let i = 0; i < itemCount; i++) {
      const percentage = Math.round(((i + 1) / itemCount) * 100);
      const fileName = `file_${String(i + 1).padStart(3, '0')}.txt`;
      
      this.progress(`Processing file ${i + 1}/${itemCount}: ${fileName}`, percentage, {
        stage: 'file_processing',
        fileName,
        fileSize: Math.floor(Math.random() * 10000),
        operation: i % 2 === 0 ? 'read' : 'write'
      });

      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      if (includeWarnings && Math.random() < 0.2) {
        this.warning(`File permission warning for ${fileName}`, {
          fileName,
          permission: 'read_only',
          workaround: 'copied_to_temp'
        });
        results.warningsGenerated++;
      }

      if (includeErrors && Math.random() < 0.05) {
        this.error(`File access error for ${fileName}`, {
          fileName,
          errorCode: 'EACCES',
          retry: 'successful'
        });
        results.errorsGenerated++;
      }

      results.itemsProcessed++;
    }
  }

  async _executeApiCallsScenario(itemCount, includeWarnings, includeErrors, delayMs, results) {
    this.progress('Initiating API call sequence', 0, {
      stage: 'initialization',
      endpoint: 'https://api.example.com/v1/data'
    });

    for (let i = 0; i < itemCount; i++) {
      const percentage = Math.round(((i + 1) / itemCount) * 100);
      const requestId = `req_${Date.now()}_${i}`;
      
      this.progress(`API call ${i + 1}/${itemCount}`, percentage, {
        stage: 'api_request',
        requestId,
        method: i % 3 === 0 ? 'POST' : 'GET',
        responseTime: Math.floor(Math.random() * 500) + 50
      });

      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      if (includeWarnings && Math.random() < 0.25) {
        this.warning(`API rate limit approaching`, {
          requestId,
          remainingRequests: Math.floor(Math.random() * 100),
          resetTime: new Date(Date.now() + 60000).toISOString()
        });
        results.warningsGenerated++;
      }

      if (includeErrors && Math.random() < 0.08) {
        this.error(`API request timeout, retrying`, {
          requestId,
          errorCode: 'TIMEOUT',
          retryAttempt: 1,
          maxRetries: 3
        });
        results.errorsGenerated++;
      }

      results.itemsProcessed++;
    }
  }

  async _executeComputationScenario(itemCount, includeWarnings, includeErrors, delayMs, results) {
    this.progress('Starting mathematical computation batch', 0, {
      stage: 'initialization',
      algorithm: 'matrix_multiplication'
    });

    for (let i = 0; i < itemCount; i++) {
      const percentage = Math.round(((i + 1) / itemCount) * 100);
      const computationId = `comp_${i + 1}`;
      
      this.progress(`Computing ${i + 1}/${itemCount}`, percentage, {
        stage: 'computation',
        computationId,
        complexity: Math.floor(Math.random() * 1000),
        cpuUsage: Math.random() * 100
      });

      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      if (includeWarnings && Math.random() < 0.15) {
        this.warning(`Precision loss detected in computation ${i + 1}`, {
          computationId,
          precision: 'double',
          recommendation: 'use_arbitrary_precision'
        });
        results.warningsGenerated++;
      }

      if (includeErrors && Math.random() < 0.03) {
        this.error(`Numerical instability in computation ${i + 1}`, {
          computationId,
          condition: 'near_singular_matrix',
          recovery: 'regularization_applied'
        });
        results.errorsGenerated++;
      }

      results.itemsProcessed++;
    }
  }
}