/**
 * ProgressOverlayPanel Component
 * Overlays progress indicators on plan visualization during execution
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

/**
 * Model - Manages progress overlay state
 */
class ProgressOverlayModel {
  constructor() {
    this.state = {
      executionId: null,
      executionStatus: 'idle', // idle, running, paused, completed, error
      taskProgress: {}, // taskId -> { status, progress, startTime, endTime, error }
      currentTask: null,
      timeline: [], // execution events timeline
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        avgTaskDuration: 0,
        estimatedCompletion: null
      },
      overlaySettings: {
        showProgress: true,
        showTimeline: true,
        showMetrics: true,
        animateProgress: true,
        pulseCurrentTask: true
      }
    };
    
    this.listeners = new Set();
  }

  getState(key) {
    return key ? this.state[key] : { ...this.state };
  }

  updateState(key, value) {
    this.state[key] = value;
    this.notifyListeners({ [key]: value });
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  notifyListeners(changes) {
    this.listeners.forEach(listener => listener(changes));
  }

  updateTaskProgress(taskId, progress) {
    this.state.taskProgress[taskId] = {
      ...this.state.taskProgress[taskId],
      ...progress
    };
    this.updateMetrics();
    this.notifyListeners({ taskProgress: this.state.taskProgress });
  }

  addTimelineEvent(event) {
    this.state.timeline.push({
      ...event,
      timestamp: new Date().toISOString()
    });
    this.notifyListeners({ timeline: this.state.timeline });
  }

  updateMetrics() {
    const tasks = Object.values(this.state.taskProgress);
    const completed = tasks.filter(t => t.status === 'completed');
    const failed = tasks.filter(t => t.status === 'failed');
    
    let avgDuration = 0;
    if (completed.length > 0) {
      const totalDuration = completed.reduce((sum, task) => {
        if (task.startTime && task.endTime) {
          return sum + (new Date(task.endTime) - new Date(task.startTime));
        }
        return sum;
      }, 0);
      avgDuration = totalDuration / completed.length;
    }

    this.state.metrics = {
      totalTasks: tasks.length,
      completedTasks: completed.length,
      failedTasks: failed.length,
      avgTaskDuration: avgDuration,
      estimatedCompletion: this.calculateEstimatedCompletion(tasks, avgDuration)
    };
  }

  calculateEstimatedCompletion(tasks, avgDuration) {
    const remaining = tasks.filter(t => t.status === 'pending' || t.status === 'running');
    if (remaining.length === 0 || avgDuration === 0) return null;
    
    return new Date(Date.now() + (remaining.length * avgDuration));
  }

  reset() {
    this.state = {
      executionId: null,
      executionStatus: 'idle',
      taskProgress: {},
      currentTask: null,
      timeline: [],
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        avgTaskDuration: 0,
        estimatedCompletion: null
      },
      overlaySettings: {
        showProgress: true,
        showTimeline: true,
        showMetrics: true,
        animateProgress: true,
        pulseCurrentTask: true
      }
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders progress overlays and handles DOM updates
 */
class ProgressOverlayView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.progressOverlay = null;
    this.metricsPanel = null;
    this.timelinePanel = null;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="progress-overlay-panel">
        <!-- Progress Overlay Canvas -->
        <div class="progress-overlay-container">
          <svg class="progress-overlay-canvas" width="100%" height="100%">
            <g class="progress-indicators"></g>
            <g class="progress-animations"></g>
            <g class="task-status-indicators"></g>
          </svg>
        </div>

        <!-- Control Panel -->
        <div class="progress-controls">
          <div class="overlay-toggles">
            <label>
              <input type="checkbox" class="show-progress-toggle" checked>
              Show Progress
            </label>
            <label>
              <input type="checkbox" class="show-timeline-toggle" checked>
              Show Timeline
            </label>
            <label>
              <input type="checkbox" class="show-metrics-toggle" checked>
              Show Metrics
            </label>
            <label>
              <input type="checkbox" class="animate-progress-toggle" checked>
              Animate
            </label>
          </div>
          
          <div class="progress-actions">
            <button class="clear-progress-button">Clear Progress</button>
            <button class="export-progress-button">Export Progress</button>
          </div>
        </div>

        <!-- Metrics Panel -->
        <div class="metrics-panel">
          <h4>Execution Metrics</h4>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Total Tasks:</span>
              <span class="metric-value total-tasks">0</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Completed:</span>
              <span class="metric-value completed-tasks">0</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Failed:</span>
              <span class="metric-value failed-tasks">0</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Avg Duration:</span>
              <span class="metric-value avg-duration">--</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Est. Completion:</span>
              <span class="metric-value est-completion">--</span>
            </div>
          </div>
          
          <div class="progress-bar-container">
            <div class="progress-bar">
              <div class="progress-fill"></div>
              <div class="progress-text">0%</div>
            </div>
          </div>
        </div>

        <!-- Timeline Panel -->
        <div class="timeline-panel">
          <h4>Execution Timeline</h4>
          <div class="timeline-container">
            <div class="timeline-events"></div>
          </div>
        </div>

        <!-- Current Task Indicator -->
        <div class="current-task-indicator" style="display: none;">
          <div class="task-info">
            <span class="task-name"></span>
            <span class="task-status"></span>
            <div class="task-progress">
              <div class="task-progress-bar">
                <div class="task-progress-fill"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.progressOverlay = this.container.querySelector('.progress-overlay-canvas');
    this.metricsPanel = this.container.querySelector('.metrics-panel');
    this.timelinePanel = this.container.querySelector('.timeline-panel');
    
    this.bindEvents();
  }

  bindEvents() {
    // Toggle controls
    const showProgressToggle = this.container.querySelector('.show-progress-toggle');
    showProgressToggle.addEventListener('change', (e) => {
      this.viewModel.updateOverlaySetting('showProgress', e.target.checked);
    });

    const showTimelineToggle = this.container.querySelector('.show-timeline-toggle');
    showTimelineToggle.addEventListener('change', (e) => {
      this.viewModel.updateOverlaySetting('showTimeline', e.target.checked);
      this.timelinePanel.style.display = e.target.checked ? 'block' : 'none';
    });

    const showMetricsToggle = this.container.querySelector('.show-metrics-toggle');
    showMetricsToggle.addEventListener('change', (e) => {
      this.viewModel.updateOverlaySetting('showMetrics', e.target.checked);
      this.metricsPanel.style.display = e.target.checked ? 'block' : 'none';
    });

    const animateToggle = this.container.querySelector('.animate-progress-toggle');
    animateToggle.addEventListener('change', (e) => {
      this.viewModel.updateOverlaySetting('animateProgress', e.target.checked);
    });

    // Action buttons
    const clearButton = this.container.querySelector('.clear-progress-button');
    clearButton.addEventListener('click', () => {
      this.viewModel.clearProgress();
    });

    const exportButton = this.container.querySelector('.export-progress-button');
    exportButton.addEventListener('click', () => {
      this.viewModel.exportProgress();
    });
  }

  updateProgressOverlay(taskProgress, nodePositions, settings) {
    if (!settings.showProgress) {
      this.hideProgressOverlay();
      return;
    }

    this.showProgressOverlay();
    
    const progressGroup = this.progressOverlay.querySelector('.progress-indicators');
    const animationGroup = this.progressOverlay.querySelector('.progress-animations');
    const statusGroup = this.progressOverlay.querySelector('.task-status-indicators');
    
    // Clear existing indicators
    progressGroup.innerHTML = '';
    animationGroup.innerHTML = '';
    statusGroup.innerHTML = '';
    
    // Add progress indicators for each task
    Object.entries(taskProgress).forEach(([taskId, progress]) => {
      const position = nodePositions[taskId];
      if (!position) return;
      
      this.addTaskProgressIndicator(taskId, progress, position, progressGroup);
      
      if (settings.animateProgress && progress.status === 'running') {
        this.addProgressAnimation(taskId, position, animationGroup);
      }
      
      this.addStatusIndicator(taskId, progress, position, statusGroup);
    });
  }

  addTaskProgressIndicator(taskId, progress, position, container) {
    const indicatorG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    indicatorG.classList.add('task-progress-indicator');
    indicatorG.setAttribute('data-task-id', taskId);
    indicatorG.setAttribute('transform', `translate(${position.x}, ${position.y})`);
    
    // Progress ring
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('r', '25');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#e0e0e0');
    ring.setAttribute('stroke-width', '3');
    indicatorG.appendChild(ring);
    
    // Progress arc
    const progressArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressArc.setAttribute('r', '25');
    progressArc.setAttribute('fill', 'none');
    progressArc.setAttribute('stroke', this.getStatusColor(progress.status));
    progressArc.setAttribute('stroke-width', '3');
    progressArc.setAttribute('stroke-linecap', 'round');
    
    const circumference = 2 * Math.PI * 25;
    const progressPercent = progress.progress || 0;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;
    
    progressArc.setAttribute('stroke-dasharray', strokeDasharray);
    progressArc.setAttribute('stroke-dashoffset', strokeDashoffset);
    progressArc.setAttribute('transform', 'rotate(-90)');
    indicatorG.appendChild(progressArc);
    
    // Progress text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dy', '5');
    text.setAttribute('font-size', '12');
    text.setAttribute('fill', '#333');
    text.textContent = `${Math.round(progressPercent)}%`;
    indicatorG.appendChild(text);
    
    container.appendChild(indicatorG);
  }

  addProgressAnimation(taskId, position, container) {
    const animationG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    animationG.classList.add('progress-animation');
    animationG.setAttribute('data-task-id', taskId);
    animationG.setAttribute('transform', `translate(${position.x}, ${position.y})`);
    
    // Pulsing ring
    const pulseRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pulseRing.setAttribute('r', '30');
    pulseRing.setAttribute('fill', 'none');
    pulseRing.setAttribute('stroke', '#2196F3');
    pulseRing.setAttribute('stroke-width', '2');
    pulseRing.setAttribute('opacity', '0.6');
    
    // Add pulse animation
    const animateOpacity = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animateOpacity.setAttribute('attributeName', 'opacity');
    animateOpacity.setAttribute('values', '0.6;0.1;0.6');
    animateOpacity.setAttribute('dur', '2s');
    animateOpacity.setAttribute('repeatCount', 'indefinite');
    pulseRing.appendChild(animateOpacity);
    
    const animateRadius = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animateRadius.setAttribute('attributeName', 'r');
    animateRadius.setAttribute('values', '30;35;30');
    animateRadius.setAttribute('dur', '2s');
    animateRadius.setAttribute('repeatCount', 'indefinite');
    pulseRing.appendChild(animateRadius);
    
    animationG.appendChild(pulseRing);
    container.appendChild(animationG);
  }

  addStatusIndicator(taskId, progress, position, container) {
    const statusG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    statusG.classList.add('status-indicator');
    statusG.setAttribute('data-task-id', taskId);
    statusG.setAttribute('transform', `translate(${position.x + 30}, ${position.y - 30})`);
    
    // Status icon background
    const iconBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    iconBg.setAttribute('r', '10');
    iconBg.setAttribute('fill', this.getStatusColor(progress.status));
    iconBg.setAttribute('stroke', '#fff');
    iconBg.setAttribute('stroke-width', '2');
    statusG.appendChild(iconBg);
    
    // Status icon
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    icon.setAttribute('text-anchor', 'middle');
    icon.setAttribute('dy', '4');
    icon.setAttribute('font-size', '10');
    icon.setAttribute('fill', '#fff');
    icon.textContent = this.getStatusIcon(progress.status);
    statusG.appendChild(icon);
    
    container.appendChild(statusG);
  }

  getStatusColor(status) {
    const colors = {
      pending: '#9e9e9e',
      running: '#2196F3',
      completed: '#4CAF50',
      failed: '#f44336',
      paused: '#FF9800'
    };
    return colors[status] || '#9e9e9e';
  }

  getStatusIcon(status) {
    const icons = {
      pending: '⏳',
      running: '▶',
      completed: '✓',
      failed: '✗',
      paused: '⏸'
    };
    return icons[status] || '?';
  }

  showProgressOverlay() {
    this.progressOverlay.style.display = 'block';
  }

  hideProgressOverlay() {
    this.progressOverlay.style.display = 'none';
  }

  updateMetrics(metrics) {
    this.container.querySelector('.total-tasks').textContent = metrics.totalTasks;
    this.container.querySelector('.completed-tasks').textContent = metrics.completedTasks;
    this.container.querySelector('.failed-tasks').textContent = metrics.failedTasks;
    
    const avgDuration = metrics.avgTaskDuration;
    this.container.querySelector('.avg-duration').textContent = 
      avgDuration > 0 ? `${Math.round(avgDuration / 1000)}s` : '--';
    
    const estCompletion = metrics.estimatedCompletion;
    this.container.querySelector('.est-completion').textContent = 
      estCompletion ? new Date(estCompletion).toLocaleTimeString() : '--';
    
    // Update progress bar
    const progressPercent = metrics.totalTasks > 0 
      ? (metrics.completedTasks / metrics.totalTasks) * 100 
      : 0;
    
    const progressFill = this.container.querySelector('.progress-fill');
    const progressText = this.container.querySelector('.progress-text');
    
    progressFill.style.width = `${progressPercent}%`;
    progressText.textContent = `${Math.round(progressPercent)}%`;
  }

  updateTimeline(timeline) {
    const container = this.container.querySelector('.timeline-events');
    
    container.innerHTML = timeline.slice(-10).map(event => `
      <div class="timeline-event ${event.type}">
        <div class="event-timestamp">${new Date(event.timestamp).toLocaleTimeString()}</div>
        <div class="event-message">${event.message}</div>
        ${event.taskId ? `<div class="event-task">Task: ${event.taskId}</div>` : ''}
      </div>
    `).join('');
    
    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  updateCurrentTask(task) {
    const indicator = this.container.querySelector('.current-task-indicator');
    
    if (!task) {
      indicator.style.display = 'none';
      return;
    }
    
    indicator.style.display = 'block';
    indicator.querySelector('.task-name').textContent = task.name || task.id;
    indicator.querySelector('.task-status').textContent = task.status;
    
    const progressFill = indicator.querySelector('.task-progress-fill');
    progressFill.style.width = `${task.progress || 0}%`;
  }

  formatDuration(ms) {
    if (!ms) return '--';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class ProgressOverlayViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Expose API
    this.exposeAPI();
  }

  exposeAPI() {
    const api = {
      startExecution: this.startExecution.bind(this),
      stopExecution: this.stopExecution.bind(this),
      updateTaskProgress: this.updateTaskProgress.bind(this),
      setCurrentTask: this.setCurrentTask.bind(this),
      addTimelineEvent: this.addTimelineEvent.bind(this),
      getExecutionMetrics: () => this.model.getState('metrics'),
      getTaskProgress: () => this.model.getState('taskProgress'),
      clearProgress: this.clearProgress.bind(this),
      exportProgress: this.exportProgress.bind(this),
      updateOverlaySetting: this.updateOverlaySetting.bind(this),
      setNodePositions: this.setNodePositions.bind(this)
    };
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(api);
    }
    
    this.api = api;
  }

  onModelChange(changes) {
    if ('taskProgress' in changes && this.nodePositions) {
      this.view.updateProgressOverlay(
        changes.taskProgress,
        this.nodePositions,
        this.model.getState('overlaySettings')
      );
    }
    
    if ('metrics' in changes) {
      this.view.updateMetrics(changes.metrics);
    }
    
    if ('timeline' in changes) {
      this.view.updateTimeline(changes.timeline);
    }
    
    if ('currentTask' in changes) {
      this.view.updateCurrentTask(changes.currentTask);
    }
    
    if ('overlaySettings' in changes && this.nodePositions) {
      this.view.updateProgressOverlay(
        this.model.getState('taskProgress'),
        this.nodePositions,
        changes.overlaySettings
      );
    }
  }

  startExecution(executionId, tasks) {
    this.model.updateState('executionId', executionId);
    this.model.updateState('executionStatus', 'running');
    
    // Initialize task progress
    const taskProgress = {};
    tasks.forEach(task => {
      taskProgress[task.id] = {
        status: 'pending',
        progress: 0,
        startTime: null,
        endTime: null,
        error: null
      };
    });
    
    this.model.updateState('taskProgress', taskProgress);
    this.addTimelineEvent({
      type: 'execution',
      message: `Execution started: ${executionId}`,
      executionId
    });
    
    if (this.umbilical.onExecutionStart) {
      this.umbilical.onExecutionStart(executionId);
    }
  }

  stopExecution() {
    const executionId = this.model.getState('executionId');
    this.model.updateState('executionStatus', 'completed');
    this.model.updateState('currentTask', null);
    
    this.addTimelineEvent({
      type: 'execution',
      message: `Execution completed: ${executionId}`,
      executionId
    });
    
    if (this.umbilical.onExecutionComplete) {
      this.umbilical.onExecutionComplete(executionId);
    }
  }

  updateTaskProgress(taskId, progress) {
    this.model.updateTaskProgress(taskId, progress);
    
    // Update current task if this is a running task
    if (progress.status === 'running') {
      this.model.updateState('currentTask', { id: taskId, ...progress });
    }
    
    this.addTimelineEvent({
      type: 'task',
      message: `Task ${progress.status}: ${taskId}`,
      taskId,
      status: progress.status
    });
    
    if (this.umbilical.onTaskProgress) {
      this.umbilical.onTaskProgress(taskId, progress);
    }
  }

  setCurrentTask(task) {
    this.model.updateState('currentTask', task);
  }

  addTimelineEvent(event) {
    this.model.addTimelineEvent(event);
  }

  clearProgress() {
    this.model.reset();
    if (this.umbilical.onProgressCleared) {
      this.umbilical.onProgressCleared();
    }
  }

  exportProgress() {
    const data = {
      executionId: this.model.getState('executionId'),
      metrics: this.model.getState('metrics'),
      taskProgress: this.model.getState('taskProgress'),
      timeline: this.model.getState('timeline'),
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `execution-progress-${data.executionId || 'unknown'}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  updateOverlaySetting(key, value) {
    const settings = this.model.getState('overlaySettings');
    settings[key] = value;
    this.model.updateState('overlaySettings', settings);
  }

  setNodePositions(positions) {
    this.nodePositions = positions;
    // Trigger update if we have task progress
    const taskProgress = this.model.getState('taskProgress');
    if (Object.keys(taskProgress).length > 0) {
      this.view.updateProgressOverlay(
        taskProgress,
        positions,
        this.model.getState('overlaySettings')
      );
    }
  }

  destroy() {
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    this.view.container.innerHTML = '';
  }
}

/**
 * ProgressOverlayPanel - Main component class
 */
export class ProgressOverlayPanel {
  static async create(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ProgressOverlayPanel');
    
    // Create MVVM components
    const model = new ProgressOverlayModel();
    const view = new ProgressOverlayView(umbilical.dom, null);
    const viewModel = new ProgressOverlayViewModel(model, view, umbilical);
    
    // Set view's reference to viewModel
    view.viewModel = viewModel;
    
    return viewModel;
  }
}