/**
 * ROMAClientActor - Client-side actor for ROMA task execution and visualization
 * Provides rich interface for task management, real-time progress, and dependency visualization
 */

import { ProtocolActor } from '../../../../../apps/decent-planner-ui/src/shared/ProtocolActor.js';

export default class ROMAClientActor extends ProtocolActor {
  constructor() {
    super();
    this.remoteActor = null;
    this.requestCounter = 0;
    this.pendingRequests = new Map();
    this.activeExecutions = new Map();
    
    // Merge state with ProtocolActor
    Object.assign(this.state, {
      connected: false,
      agentReady: false,
      statistics: null,
      executions: []
    });
    
    console.log('🎭 ROMAClientActor created');
    
    // Initialize interface immediately
    this.initializeInterface();
  }

  getProtocol() {
    return {
      name: "ROMAClientActor",
      version: "1.0.0",
      
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          agentReady: { type: 'boolean', required: true },
          statistics: { type: 'object' },
          executions: { type: 'array', required: true }
        },
        initial: {
          connected: false,
          agentReady: false,
          statistics: null,
          executions: []
        }
      },
      
      messages: {
        receives: {
          'ready': {
            schema: {
              timestamp: { type: 'string' },
              agentStatus: { type: 'object' },
              statistics: { type: 'object' }
            },
            postconditions: ['connected is true', 'agentReady is true']
          },
          'execution_started': {
            schema: {
              executionId: { type: 'string' },
              task: { type: 'object' }
            }
          },
          'task_progress': {
            schema: {
              executionId: { type: 'string' },
              progress: { type: 'object' }
            }
          },
          'execution_complete': {
            schema: {
              executionId: { type: 'string' },
              result: { type: 'object' }
            }
          }
        },
        sends: {
          'execute_task': {
            schema: {
              executionId: { type: 'string' },
              task: { type: 'object' }
            }
          },
          'get_status': {
            schema: {
              requestId: { type: 'string' }
            }
          }
        }
      }
    };
  }

  /**
   * Set remote actor reference (called by framework)
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 [ROMA CLIENT] Remote server actor set - ready to communicate');
  }

  /**
   * Set channel reference (needed for Legion actor framework)
   */
  setChannel(channel) {
    this.channel = channel;
    console.log('🔗 [ROMA CLIENT] Channel set for communication');
  }

  /**
   * Initialize the rich ROMA interface
   */
  initializeInterface() {
    console.log('🎨 [ROMA CLIENT] Creating ROMA interface...');
    
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = `
        <div style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 28px;">🧠 ROMA Agent Control Center</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Recursive Open Meta-Agents - Task Decomposition & Execution</p>
            <div id="connectionStatus" style="position: absolute; top: 20px; right: 20px; padding: 8px 16px; background: rgba(255,255,255,0.2); border-radius: 20px; font-size: 14px;">
              🔄 Connecting...
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h3 style="margin: 0 0 15px 0; color: #333;">📋 Execute Task</h3>
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Task Description:</label>
                <textarea id="taskDescription" placeholder="Describe the task you want ROMA to execute..." style="width: 100%; height: 80px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; resize: vertical;"></textarea>
              </div>
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Tool (optional):</label>
                <input type="text" id="taskTool" placeholder="e.g., calculator, file_writer" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
              </div>
              <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Parameters (JSON):</label>
                <textarea id="taskParams" placeholder='{"param1": "value1"}' style="width: 100%; height: 60px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-family: monospace;"></textarea>
              </div>
              <button id="executeBtn" disabled style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
                🚀 Execute Task
              </button>
            </div>

            <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h3 style="margin: 0 0 15px 0; color: #333;">📊 Agent Statistics</h3>
              <div id="statisticsDisplay" style="color: #666; font-style: italic;">Waiting for agent connection...</div>
            </div>
          </div>

          <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; color: #333;">⚡ Active Executions</h3>
            <div id="activeExecutions" style="min-height: 100px;">
              <div style="color: #666; font-style: italic; text-align: center; padding: 40px;">No active executions</div>
            </div>
          </div>

          <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 15px 0; color: #333;">📚 Execution History</h3>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
              <button id="refreshHistoryBtn" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 5px; cursor: pointer;">🔄 Refresh</button>
              <button id="clearHistoryBtn" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 5px; cursor: pointer;">🗑️ Clear View</button>
            </div>
            <div id="executionHistory" style="max-height: 300px; overflow-y: auto;">
              <div style="color: #666; font-style: italic; text-align: center; padding: 40px;">No execution history available</div>
            </div>
          </div>
        </div>
      `;
      
      // Get element references
      this.connectionStatus = document.getElementById('connectionStatus');
      this.taskDescription = document.getElementById('taskDescription');
      this.taskTool = document.getElementById('taskTool');
      this.taskParams = document.getElementById('taskParams');
      this.executeBtn = document.getElementById('executeBtn');
      this.statisticsDisplay = document.getElementById('statisticsDisplay');
      this.activeExecutions = document.getElementById('activeExecutions');
      this.executionHistory = document.getElementById('executionHistory');
      this.refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
      this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
      
      console.log('✅ [ROMA CLIENT] Interface elements created and ready');
    } else {
      console.error('❌ [ROMA CLIENT] No #app container found - interface cannot be created');
    }
  }

  /**
   * Receive messages from server actor
   */
  receive(messageType, data) {
    console.log('📨 [ROMA CLIENT] Received:', messageType);
    
    switch (messageType) {
      case 'ready':
        this._handleReady(data);
        break;
        
      case 'execution_started':
        this._handleExecutionStarted(data);
        break;
        
      case 'task_progress':
        this._handleTaskProgress(data);
        break;
        
      case 'execution_complete':
        this._handleExecutionComplete(data);
        break;
        
      case 'execution_error':
        this._handleExecutionError(data);
        break;
        
      case 'status_response':
      case 'statistics_response':
      case 'history_response':
        this._handleResponse(messageType, data);
        break;
        
      default:
        console.log('⚠️ [ROMA CLIENT] Unknown message type:', messageType);
    }
  }

  /**
   * Handle ready signal from server
   */
  _handleReady(data) {
    console.log('🎉 [ROMA CLIENT] ROMA Agent ready!');
    
    this.state.connected = true;
    this.state.agentReady = true;
    this.state.statistics = data.statistics;
    
    // Update connection status
    if (this.connectionStatus) {
      this.connectionStatus.innerHTML = '✅ Connected & Ready';
      this.connectionStatus.style.background = 'rgba(16, 185, 129, 0.3)';
    }
    
    // Enable execute button
    if (this.executeBtn) {
      this.executeBtn.disabled = false;
      this.executeBtn.style.background = '#667eea';
    }
    
    // Update statistics display
    this._updateStatisticsDisplay(data.statistics);
    
    // Bind events
    this._bindEvents();
    
    console.log('🎯 [ROMA CLIENT] Interface fully activated!');
  }

  /**
   * Handle execution started event
   */
  _handleExecutionStarted(data) {
    console.log('🚀 [ROMA CLIENT] Execution started:', data.executionId);
    
    const execution = {
      id: data.executionId,
      task: data.task,
      status: 'running',
      startTime: new Date(data.timestamp),
      progress: []
    };
    
    this.activeExecutions.set(data.executionId, execution);
    this._updateActiveExecutionsDisplay();
  }

  /**
   * Handle task progress updates
   */
  _handleTaskProgress(data) {
    console.log('📊 [ROMA CLIENT] Progress update:', data.executionId);
    
    const execution = this.activeExecutions.get(data.executionId);
    if (execution) {
      execution.progress.push({
        timestamp: new Date(data.timestamp),
        ...data
      });
      this._updateActiveExecutionsDisplay();
    }
  }

  /**
   * Handle execution completion
   */
  _handleExecutionComplete(data) {
    console.log('✅ [ROMA CLIENT] Execution completed:', data.executionId);
    
    const execution = this.activeExecutions.get(data.executionId);
    if (execution) {
      execution.status = 'completed';
      execution.result = data.result;
      execution.endTime = new Date(data.timestamp);
      execution.duration = execution.endTime - execution.startTime;
      
      // Move to history after a short delay
      setTimeout(() => {
        this.activeExecutions.delete(data.executionId);
        this._updateActiveExecutionsDisplay();
        this._addToHistory(execution);
      }, 2000);
    }
    
    // Update statistics
    this.state.statistics = data.statistics;
    this._updateStatisticsDisplay(data.statistics);
  }

  /**
   * Handle execution error
   */
  _handleExecutionError(data) {
    console.log('❌ [ROMA CLIENT] Execution error:', data.executionId);
    
    const execution = this.activeExecutions.get(data.executionId);
    if (execution) {
      execution.status = 'error';
      execution.error = data.error;
      execution.endTime = new Date(data.timestamp);
      execution.duration = execution.endTime - execution.startTime;
      
      // Move to history after a short delay
      setTimeout(() => {
        this.activeExecutions.delete(data.executionId);
        this._updateActiveExecutionsDisplay();
        this._addToHistory(execution);
      }, 3000);
    }
  }

  /**
   * Handle responses to requests
   */
  _handleResponse(messageType, data) {
    const request = this.pendingRequests.get(data.requestId);
    if (request) {
      request.resolve(data);
      this.pendingRequests.delete(data.requestId);
    }
  }

  /**
   * Bind event listeners
   */
  _bindEvents() {
    if (this.executeBtn) {
      this.executeBtn.onclick = () => this._executeTask();
    }
    
    if (this.refreshHistoryBtn) {
      this.refreshHistoryBtn.onclick = () => this._refreshHistory();
    }
    
    if (this.clearHistoryBtn) {
      this.clearHistoryBtn.onclick = () => this._clearHistoryView();
    }
  }

  /**
   * Execute a task
   */
  _executeTask() {
    const description = this.taskDescription.value.trim();
    if (!description || !this.remoteActor || !this.state.agentReady) return;
    
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task = {
      id: `task_${Date.now()}`,
      description: description
    };
    
    // Add tool if specified
    const tool = this.taskTool.value.trim();
    if (tool) {
      task.tool = tool;
    }
    
    // Add parameters if specified
    const paramsText = this.taskParams.value.trim();
    if (paramsText) {
      try {
        task.params = JSON.parse(paramsText);
      } catch (e) {
        alert('Invalid JSON in parameters field');
        return;
      }
    }
    
    console.log('📤 [ROMA CLIENT] Executing task:', task);
    
    // Clear form
    this.taskDescription.value = '';
    this.taskTool.value = '';
    this.taskParams.value = '';
    
    // Send to server
    this.remoteActor.receive('execute_task', {
      executionId,
      task
    });
  }

  /**
   * Update statistics display
   */
  _updateStatisticsDisplay(statistics) {
    if (!this.statisticsDisplay || !statistics) return;
    
    this.statisticsDisplay.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <div style="font-weight: 500; color: #333;">Total Executions</div>
          <div style="font-size: 24px; color: #667eea;">${statistics.totalExecutions || 0}</div>
        </div>
        <div>
          <div style="font-weight: 500; color: #333;">Success Rate</div>
          <div style="font-size: 24px; color: #10b981;">${Math.round((statistics.successRate || 0) * 100)}%</div>
        </div>
        <div>
          <div style="font-weight: 500; color: #333;">Successful</div>
          <div style="font-size: 18px; color: #10b981;">${statistics.successful || 0}</div>
        </div>
        <div>
          <div style="font-weight: 500; color: #333;">Failed</div>
          <div style="font-size: 18px; color: #ef4444;">${statistics.failed || 0}</div>
        </div>
      </div>
    `;
  }

  /**
   * Update active executions display
   */
  _updateActiveExecutionsDisplay() {
    if (!this.activeExecutions) return;
    
    const executions = Array.from(this.activeExecutions.values());
    
    if (executions.length === 0) {
      this.activeExecutions.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; padding: 40px;">No active executions</div>';
      return;
    }
    
    const html = executions.map(execution => {
      const statusColor = execution.status === 'running' ? '#667eea' : 
                         execution.status === 'completed' ? '#10b981' : '#ef4444';
      
      const progressText = execution.progress.length > 0 ? 
        execution.progress[execution.progress.length - 1].message || 'In progress...' : 
        'Starting...';
      
      return `
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 10px;">
            <div style="font-weight: 500; color: #333;">${execution.task.description}</div>
            <div style="color: ${statusColor}; font-weight: 500;">${execution.status.toUpperCase()}</div>
          </div>
          <div style="color: #666; font-size: 14px; margin-bottom: 8px;">${progressText}</div>
          <div style="background: #f3f4f6; height: 4px; border-radius: 2px; overflow: hidden;">
            <div style="background: ${statusColor}; height: 100%; width: ${execution.status === 'running' ? '60' : '100'}%; transition: width 0.3s;"></div>
          </div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 5px;">ID: ${execution.id}</div>
        </div>
      `;
    }).join('');
    
    this.activeExecutions.innerHTML = html;
  }

  /**
   * Add execution to history
   */
  _addToHistory(execution) {
    this.state.executions.unshift({
      ...execution,
      id: execution.id,
      timestamp: execution.endTime || execution.startTime
    });
    
    // Keep only last 20 executions
    if (this.state.executions.length > 20) {
      this.state.executions = this.state.executions.slice(0, 20);
    }
    
    this._updateHistoryDisplay();
  }

  /**
   * Refresh execution history
   */
  _refreshHistory() {
    if (!this.remoteActor) return;
    
    const requestId = `req_${Date.now()}`;
    this.remoteActor.receive('get_execution_history', { requestId });
  }

  /**
   * Clear history view
   */
  _clearHistoryView() {
    this.state.executions = [];
    this._updateHistoryDisplay();
  }

  /**
   * Update execution history display
   */
  _updateHistoryDisplay() {
    if (!this.executionHistory) return;
    
    if (this.state.executions.length === 0) {
      this.executionHistory.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; padding: 40px;">No execution history available</div>';
      return;
    }
    
    const html = this.state.executions.map(execution => {
      const statusColor = execution.status === 'completed' ? '#10b981' : '#ef4444';
      const icon = execution.status === 'completed' ? '✅' : '❌';
      
      return `
        <div style="border-bottom: 1px solid #e5e7eb; padding: 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 500; color: #333;">${icon} ${execution.task.description}</div>
              <div style="font-size: 12px; color: #9ca3af;">
                ${execution.timestamp ? new Date(execution.timestamp).toLocaleString() : 'Unknown time'}
                ${execution.duration ? ` • ${execution.duration}ms` : ''}
              </div>
            </div>
            <div style="color: ${statusColor}; font-weight: 500; font-size: 12px;">${execution.status.toUpperCase()}</div>
          </div>
        </div>
      `;
    }).join('');
    
    this.executionHistory.innerHTML = html;
  }
}