/**
 * ROMAServerActor - Server-side actor wrapping ROMAAgent functionality
 * Provides real-time task execution with progress tracking and visualization
 */

import { ROMAAgent } from '../../ROMAAgent.js';
import { ResourceManager } from '@legion/resource-manager';

/**
 * Server actor for ROMA agent with real-time communication
 */
export default class ROMAServerActor {
  constructor(services = {}) {
    this.services = services;
    this.remoteActor = null;
    this.romaAgent = null;
    this.isReady = false;
    this.activeExecutions = new Map();
    
    // Initialize ResourceManager from services or create one
    this.resourceManager = services.resourceManager || this._createResourceManager();
    
    console.log('🎭 ROMAServerActor created with services:', Object.keys(services));
  }

  /**
   * Create ResourceManager if not provided in services
   */
  async _createResourceManager() {
    const { ResourceManager } = await import('@legion/resource-manager');
    return await ResourceManager.getInstance();
  }

  /**
   * Set remote actor connection (Legion actor framework pattern)
   * @param {Object} remoteActor - Remote actor reference
   */
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 ROMA server actor connected to client');
    
    try {
      // Ensure ResourceManager is ready
      if (!this.resourceManager.getInstance) {
        this.resourceManager = await this._createResourceManager();
      }
      
      console.log('🎭 Creating ROMAAgent with ResourceManager...');
      
      // Initialize ROMA agent with enhanced configuration for frontend
      this.romaAgent = new ROMAAgent({
        maxConcurrency: 3,
        defaultTimeout: 30000,
        enableSemanticAnalysis: true,
        maxExecutionDepth: 5
      });
      
      // Initialize the agent
      await this.romaAgent.initialize();
      
      console.log('✅ ROMAAgent wrapped in server actor and ready');
      
      // Wait for client to be fully ready before sending ready signal
      setTimeout(() => {
        console.log('📤 [ROMA SERVER] Sending ready signal to client...');
        this.remoteActor.receive('ready', {
          timestamp: new Date().toISOString(),
          agentStatus: {
            isInitialized: this.romaAgent.isInitialized,
            activeExecutions: this.romaAgent.getActiveExecutions().length
          },
          statistics: this.romaAgent.getStatistics()
        });
        console.log('✅ [ROMA SERVER] Ready signal sent!');
      }, 1000);
      
      this.isReady = true;
      
    } catch (error) {
      console.error('❌ ROMA actor initialization failed:', error.message);
      console.error('❌ Full error stack:', error.stack);
      
      this.remoteActor.receive('error', {
        message: error.message,
        component: 'ROMAServerActor'
      });
    }
  }

  /**
   * Receive messages from client actor (Legion actor framework pattern)
   * @param {string} messageType - Type of message
   * @param {Object} data - Message data
   */
  async receive(messageType, data) {
    if (!this.isReady) {
      console.warn('⚠️ ROMA Actor not ready, ignoring message:', messageType);
      return;
    }

    try {
      switch (messageType) {
        case 'execute_task':
          await this._handleExecuteTask(data);
          break;
          
        case 'get_status':
          await this._handleGetStatus(data);
          break;
          
        case 'get_statistics':
          await this._handleGetStatistics(data);
          break;
          
        case 'get_execution_history':
          await this._handleGetExecutionHistory(data);
          break;
          
        case 'cancel_execution':
          await this._handleCancelExecution(data);
          break;
          
        default:
          console.warn('⚠️ Unknown message type:', messageType);
      }
    } catch (error) {
      console.error('❌ ROMA Actor message handling failed:', error.message);
      
      this.remoteActor.receive('error', {
        message: error.message,
        messageType,
        component: 'message_handling'
      });
    }
  }

  /**
   * Handle task execution request with real-time progress
   * @param {Object} data - Task execution data
   */
  async _handleExecuteTask(data) {
    const { executionId, task } = data;
    console.log('🚀 [ROMA ACTOR] Starting task execution:', executionId);
    
    try {
      // Store execution reference
      this.activeExecutions.set(executionId, {
        startTime: Date.now(),
        status: 'running'
      });
      
      // Send execution started event
      this.remoteActor.receive('execution_started', {
        executionId,
        task,
        timestamp: new Date().toISOString()
      });
      
      // Execute task with progress callback
      const result = await this.romaAgent.execute(task, {
        onProgress: (progressEvent) => {
          console.log('📊 [ROMA ACTOR] Progress update:', progressEvent);
          
          // Forward progress to client
          this.remoteActor.receive('task_progress', {
            executionId,
            ...progressEvent,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      // Update execution status
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = result.success ? 'completed' : 'failed';
        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
      }
      
      console.log('✅ [ROMA ACTOR] Task execution completed:', result.success);
      
      if (result.success) {
        // Send completion event for successful execution
        this.remoteActor.receive('execution_complete', {
          executionId,
          result,
          statistics: this.romaAgent.getStatistics(),
          timestamp: new Date().toISOString()
        });
      } else {
        // Send error event for failed execution
        this.remoteActor.receive('execution_error', {
          executionId,
          error: result.error || 'Task execution failed',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('❌ [ROMA ACTOR] Task execution failed:', error.message);
      
      // Update execution status
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'error';
        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
        execution.error = error.message;
      }
      
      // Send error event
      this.remoteActor.receive('execution_error', {
        executionId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      // Clean up after some time
      setTimeout(() => {
        this.activeExecutions.delete(executionId);
      }, 300000); // 5 minutes
    }
  }

  /**
   * Handle status request
   * @param {Object} data - Request data
   */
  async _handleGetStatus(data) {
    console.log('📊 [ROMA ACTOR] Getting agent status');
    
    const status = {
      agent: {
        isInitialized: this.romaAgent.isInitialized,
        activeExecutions: this.romaAgent.getActiveExecutions().length,
        statistics: this.romaAgent.getStatistics()
      },
      activeExecutions: Array.from(this.activeExecutions.entries()).map(([id, execution]) => ({
        executionId: id,
        ...execution
      })),
      timestamp: new Date().toISOString()
    };
    
    this.remoteActor.receive('status_response', {
      requestId: data.requestId,
      status
    });
  }

  /**
   * Handle statistics request
   * @param {Object} data - Request data
   */
  async _handleGetStatistics(data) {
    console.log('📈 [ROMA ACTOR] Getting agent statistics');
    
    const statistics = this.romaAgent.getStatistics();
    
    this.remoteActor.receive('statistics_response', {
      requestId: data.requestId,
      statistics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle execution history request
   * @param {Object} data - Request data
   */
  async _handleGetExecutionHistory(data) {
    console.log('📚 [ROMA ACTOR] Getting execution history');
    
    const history = this.romaAgent.getExecutionHistory();
    
    this.remoteActor.receive('history_response', {
      requestId: data.requestId,
      history,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle execution cancellation
   * @param {Object} data - Cancellation data
   */
  async _handleCancelExecution(data) {
    const { executionId } = data;
    console.log('🛑 [ROMA ACTOR] Cancelling execution:', executionId);
    
    // Update execution status
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.status = 'cancelled';
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
    }
    
    // Send cancellation acknowledgment
    this.remoteActor.receive('execution_cancelled', {
      executionId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get actor status for debugging
   * @returns {Object} Actor status
   */
  getStatus() {
    return {
      isReady: this.isReady,
      romaAgentReady: !!this.romaAgent && this.romaAgent.isInitialized,
      activeExecutionsCount: this.romaAgent?.getActiveExecutions().length || 0,
      agentStatistics: this.romaAgent?.getStatistics() || null
    };
  }

  /**
   * Shutdown the actor and clean up resources
   */
  async shutdown() {
    console.log('🛑 [ROMA ACTOR] Shutting down...');
    
    if (this.romaAgent && this.romaAgent.isInitialized) {
      await this.romaAgent.shutdown();
    }
    
    this.activeExecutions.clear();
    this.isReady = false;
    
    console.log('✅ [ROMA ACTOR] Shutdown complete');
  }
}