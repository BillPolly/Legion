/**
 * PlanExecutorModule - Legion module wrapper for plan execution
 */

import { PlanExecutorTool } from './tools/PlanExecutorTool.js';
import { PlanExecutor } from './core/PlanExecutor.js';

// TODO: Temporarily not extending Module for MVP testing
export class PlanExecutorModule {
  static dependencies = ['resourceManager', 'moduleFactory'];
  
  constructor(resourceManager, moduleFactory) {
    this.resourceManager = resourceManager;
    this.moduleFactory = moduleFactory;
    
    // Create executor instance
    this.executor = new PlanExecutor({
      moduleFactory: this.moduleFactory,
      resourceManager: this.resourceManager
    });
    
    // Create tool instance
    this.tool = new PlanExecutorTool(this.executor);
    
    // TODO: Forward events from executor to module listeners (requires EventEmitter)
    // this.executor.on('plan:start', (event) => this.emit('plan:start', event));
    // this.executor.on('plan:complete', (event) => this.emit('plan:complete', event));
    // this.executor.on('step:start', (event) => this.emit('step:start', event));
    // this.executor.on('step:complete', (event) => this.emit('step:complete', event));
    // this.executor.on('step:error', (event) => this.emit('step:error', event));
    // this.executor.on('progress', (event) => this.emit('progress', event));
  }
  
  getTools() {
    return [this.tool];
  }
}