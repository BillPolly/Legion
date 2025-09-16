/**
 * ROMAClientActor - minimal client used exclusively for automated tests.
 * Handles WebSocket communication, UI updates, and progress rendering.
 */

import WebSocket from 'ws';

export class ROMAClientActor {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.connectionId = null;
    this.connectionPromise = null;
    this.connectionResolved = false;
    this.taskGraph = null;
    this.taskInputForms = null;
    this.progressDisplay = null;
    this.taskGraphViz = null;
  }

  async initialize(url) {
    this.setupUI();

    if (this.socket) {
      await this.cleanup();
    }

    this.connectionResolved = false;
    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = new WebSocket(url);

      this.socket.on('open', () => {
        this.connectionId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        this.socket.send(JSON.stringify({
          type: 'connection_opened',
          connectionId: this.connectionId
        }));
      });

      this.socket.on('message', (event) => {
        this.handleSocketMessage(event.toString(), resolve);
      });

      this.socket.on('error', (error) => {
        reject(error);
      });

      this.socket.on('close', () => {
        this.connected = false;
      });
    });

    return this.connectionPromise;
  }

  setupUI() {
    const container = document.getElementById('app');
    if (!container) {
      throw new Error('ROMAClientActor requires an element with id "app"');
    }

    container.innerHTML = `
      <div class="roma-client">
        <div class="task-input">
          <textarea class="task-input-textarea" placeholder="Describe your task"></textarea>
          <button class="btn-submit-task" disabled>Run Task</button>
        </div>
        <div class="status-panel">
          <div>Status: <span class="status-value">Idle</span></div>
          <div>Progress: <span class="progress-status">Idle</span></div>
          <div>Duration: <span class="duration-value">0 ms</span></div>
          <div>Tokens: <span class="tokens-value">0</span></div>
        </div>
        <div class="output">
          <pre class="output-result"></pre>
          <pre class="output-error" style="display: none"></pre>
        </div>
      </div>
    `;

    const textarea = container.querySelector('.task-input-textarea');
    const submitButton = container.querySelector('.btn-submit-task');

    textarea.addEventListener('input', () => {
      submitButton.disabled = textarea.value.trim().length === 0;
    });

    submitButton.addEventListener('click', () => {
      if (!submitButton.disabled) {
        this.executeTask(textarea.value, {});
      }
    });

    this.taskInputForms = {
      container,
      textarea,
      submitButton
    };

    this.progressDisplay = {
      isActive: false,
      setStatus: (status) => {
        const statusNode = container.querySelector('.progress-status');
        statusNode.textContent = status;
      }
    };

    this.taskGraphViz = {
      render: (graph) => {
        this.taskGraph = graph;
      }
    };
  }

  handleSocketMessage(rawMessage, resolveConnection) {
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch (error) {
      console.error('Invalid message received:', rawMessage);
      return;
    }

    switch (message.type) {
      case 'connected':
        this.connected = true;
        this.connectionId = message.connectionId;
        if (!this.connectionResolved && resolveConnection) {
          this.connectionResolved = true;
          resolveConnection();
        }
        break;
      case 'task_progress':
        this.handleTaskProgress(message.data);
        break;
      case 'task_completed':
        this.handleTaskCompleted(message.data);
        break;
      case 'error':
        this.handleError(message.data);
        break;
      default:
        break;
    }
  }

  executeTask(userRequest, options = {}) {
    if (!this.connected || !this.socket) {
      throw new Error('Client is not connected');
    }

    const trimmedRequest = typeof userRequest === 'string' ? userRequest.trim() : userRequest;

    this.taskInputForms.submitButton.disabled = true;
    this.showResult(null);
    this.showError(null);
    this.updateStatus('Running', 'Running');
    this.progressDisplay.isActive = true;

    this.socket.send(JSON.stringify({
      type: 'execute_task',
      userRequest: trimmedRequest,
      sessionId: this.connectionId,
      options
    }));
  }

  handleTaskProgress(data = {}) {
    const status = this.friendlyStatus(data.status || 'in_progress');
    this.progressDisplay.setStatus(status);
    this.progressDisplay.isActive = !['completed', 'failed'].includes((data.status || '').toLowerCase());

    if (data.status && data.status.toLowerCase() !== 'completed') {
      this.updateStatus('In Progress', status);
    }

    if (data.taskGraph) {
      this.taskGraphViz.render(data.taskGraph);
    }
  }

  handleTaskCompleted(data = {}) {
    const success = data.success !== false;
    const statusText = success ? 'Completed' : 'Failed';
    this.updateStatus(statusText, 'Completed');
    this.progressDisplay.isActive = false;

    const duration = data.duration ?? data.result?.metadata?.duration ?? 0;
    const tokens = data.tokens ?? 0;

    this.updateDuration(duration);
    this.updateTokens(tokens);

    if (success) {
      this.showResult(data.result);
      this.showError(null);
    } else {
      this.showResult(null);
      this.showError(data.error || 'Task failed');
    }

    this.taskInputForms.submitButton.disabled = false;
  }

  handleError(data = {}) {
    this.updateStatus('Error', 'Failed');
    this.progressDisplay.isActive = false;
    this.showError(data.error || 'Unknown error');
    this.showResult(null);
    this.taskInputForms.submitButton.disabled = false;
  }

  updateStatus(statusValue, progressValue) {
    const container = this.taskInputForms.container;
    container.querySelector('.status-value').textContent = statusValue;
    container.querySelector('.progress-status').textContent = progressValue;
  }

  updateDuration(duration) {
    const container = this.taskInputForms.container;
    container.querySelector('.duration-value').textContent = `${duration} ms`;
  }

  updateTokens(tokens) {
    const container = this.taskInputForms.container;
    container.querySelector('.tokens-value').textContent = `${tokens}`;
  }

  showResult(result) {
    const node = this.taskInputForms.container.querySelector('.output-result');
    if (!result) {
      node.textContent = '';
      return;
    }

    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    node.textContent = text;
  }

  showError(message) {
    const node = this.taskInputForms.container.querySelector('.output-error');
    if (!message) {
      node.style.display = 'none';
      node.textContent = '';
      return;
    }

    node.style.display = 'block';
    node.textContent = message;
  }

  friendlyStatus(status) {
    const normalized = status.toLowerCase();
    switch (normalized) {
      case 'started':
        return 'Started';
      case 'decomposing':
        return 'Decomposing';
      case 'executing':
        return 'Executing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  }

  async cleanup() {
    if (this.socket) {
      await new Promise((resolve) => {
        this.socket.close();
        this.socket.once('close', resolve);
      });
    }

    this.socket = null;
    this.connected = false;
    this.connectionResolved = false;
  }
}
