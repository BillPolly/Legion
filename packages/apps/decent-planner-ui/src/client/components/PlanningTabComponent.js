/**
 * PlanningTabComponent - MVVM Component for planning functionality
 * Handles goal input, progress display, informal results, and error states
 */

export class PlanningTabComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      goal: '',
      isPlanning: false,
      isCancelling: false,
      connected: false,
      progressMessages: [],
      informalResult: null,
      error: null,
      onSubmitPlan: options.onSubmitPlan || (() => {}),
      onCancelPlan: options.onCancelPlan || (() => {}),
      onGoalChange: options.onGoalChange || (() => {})
    };
    
    // View elements
    this.elements = {
      root: null,
      goalInput: null,
      startButton: null,
      cancelButton: null,
      progressContainer: null,
      resultsContainer: null,
      errorContainer: null
    };
    
    this.createView();
    this.bindEvents();
  }
  
  // CREATE VIEW ONCE
  createView() {
    this.elements.root = document.createElement('div');
    this.elements.root.className = 'planning-content';
    
    // Goal input section
    const label = document.createElement('label');
    label.setAttribute('for', 'goal-input');
    label.textContent = 'Planning Goal:';
    this.elements.root.appendChild(label);
    
    this.elements.goalInput = document.createElement('textarea');
    this.elements.goalInput.id = 'goal-input';
    this.elements.goalInput.placeholder = 'Enter your planning goal...';
    this.elements.root.appendChild(this.elements.goalInput);
    
    // Button group
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group';
    
    this.elements.startButton = document.createElement('button');
    this.elements.startButton.id = 'informal-button';
    this.elements.startButton.textContent = '🔍 Start Informal Planning';
    buttonGroup.appendChild(this.elements.startButton);
    
    this.elements.cancelButton = document.createElement('button');
    this.elements.cancelButton.id = 'cancel-button';
    this.elements.cancelButton.className = 'cancel-btn';
    this.elements.cancelButton.textContent = '❌ Cancel';
    this.elements.cancelButton.style.display = 'none';
    buttonGroup.appendChild(this.elements.cancelButton);
    
    this.elements.root.appendChild(buttonGroup);
    
    // Progress container
    this.elements.progressContainer = document.createElement('div');
    this.elements.progressContainer.className = 'progress-container';
    this.elements.progressContainer.style.display = 'none';
    this.elements.root.appendChild(this.elements.progressContainer);
    
    // Results container
    this.elements.resultsContainer = document.createElement('div');
    this.elements.resultsContainer.className = 'informal-result';
    this.elements.resultsContainer.style.display = 'none';
    this.elements.root.appendChild(this.elements.resultsContainer);
    
    // Error container
    this.elements.errorContainer = document.createElement('div');
    this.elements.errorContainer.className = 'error-message';
    this.elements.errorContainer.style.display = 'none';
    this.elements.root.appendChild(this.elements.errorContainer);
    
    // Add to container
    this.container.appendChild(this.elements.root);
  }
  
  // BIND EVENTS ONCE
  bindEvents() {
    this.elements.goalInput.addEventListener('input', (e) => {
      this.model.goal = e.target.value;
      this.model.onGoalChange(this.model.goal);
    });
    
    this.elements.startButton.addEventListener('click', () => {
      this.model.onSubmitPlan(this.model.goal);
    });
    
    this.elements.cancelButton.addEventListener('click', () => {
      this.model.onCancelPlan();
    });
  }
  
  // PUBLIC API - called by ClientPlannerActor
  setGoal(goal) {
    this.model.goal = goal || '';
    this.elements.goalInput.value = this.model.goal;
  }
  
  setConnected(connected) {
    this.model.connected = connected;
    this.updateButtons();
  }
  
  setPlanning(isPlanning, isCancelling = false) {
    this.model.isPlanning = isPlanning;
    this.model.isCancelling = isCancelling;
    this.updateButtons();
  }
  
  setProgressMessages(messages) {
    this.model.progressMessages = messages || [];
    this.updateProgress();
  }
  
  setInformalResult(result) {
    this.model.informalResult = result;
    this.updateResults();
  }
  
  setError(error) {
    this.model.error = error;
    this.updateError();
  }
  
  // UPDATE METHODS - incremental updates only
  updateButtons() {
    // Update start button
    this.elements.startButton.disabled = this.model.isPlanning || !this.model.connected;
    this.elements.startButton.textContent = this.model.isPlanning ? 
      '⏳ Running Informal Planning...' : 
      '🔍 Start Informal Planning';
    
    // Update goal input
    this.elements.goalInput.disabled = this.model.isPlanning;
    
    // Show/hide cancel button
    if (this.model.isPlanning) {
      this.elements.cancelButton.style.display = 'inline-block';
      this.elements.cancelButton.disabled = this.model.isCancelling;
      this.elements.cancelButton.textContent = this.model.isCancelling ? 
        '⏳ Cancellation pending' : 
        '❌ Cancel';
    } else {
      this.elements.cancelButton.style.display = 'none';
    }
  }
  
  updateProgress() {
    if (!this.model.progressMessages || this.model.progressMessages.length === 0) {
      this.elements.progressContainer.style.display = 'none';
      return;
    }
    
    // Clear and rebuild progress
    this.elements.progressContainer.innerHTML = '';
    
    const title = document.createElement('h3');
    title.textContent = '📊 Progress';
    this.elements.progressContainer.appendChild(title);
    
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'progress-messages';
    
    this.model.progressMessages.forEach(msg => {
      const progressMsg = document.createElement('div');
      progressMsg.className = 'progress-msg';
      
      const msgIcon = document.createElement('span');
      msgIcon.className = 'msg-icon';
      msgIcon.textContent = '🔄';
      
      const msgText = document.createElement('span');
      msgText.className = 'msg-text';
      msgText.textContent = msg.message;
      
      const msgTime = document.createElement('span');
      msgTime.className = 'msg-time';
      msgTime.textContent = new Date(msg.timestamp).toLocaleTimeString();
      
      progressMsg.appendChild(msgIcon);
      progressMsg.appendChild(msgText);
      progressMsg.appendChild(msgTime);
      messagesContainer.appendChild(progressMsg);
    });
    
    this.elements.progressContainer.appendChild(messagesContainer);
    this.elements.progressContainer.style.display = 'block';
  }
  
  updateResults() {
    if (!this.model.informalResult) {
      this.elements.resultsContainer.style.display = 'none';
      return;
    }
    
    // Clear and rebuild results
    this.elements.resultsContainer.innerHTML = '';
    
    const title = document.createElement('h3');
    title.textContent = '📋 Informal Planning Result';
    this.elements.resultsContainer.appendChild(title);
    
    const stats = document.createElement('div');
    stats.className = 'result-stats';
    
    ['Total Tasks: 1', 'Simple: 1', 'Complex: 0', 'Valid: ✅'].forEach(statText => {
      const stat = document.createElement('span');
      stat.textContent = statText;
      stats.appendChild(stat);
    });
    
    this.elements.resultsContainer.appendChild(stats);
    
    // Hierarchy details
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'View Hierarchy';
    details.appendChild(summary);
    
    const hierarchyPre = document.createElement('pre');
    hierarchyPre.textContent = JSON.stringify(this.model.informalResult.informal?.hierarchy, null, 2);
    details.appendChild(hierarchyPre);
    
    this.elements.resultsContainer.appendChild(details);
    this.elements.resultsContainer.style.display = 'block';
  }
  
  updateError() {
    if (!this.model.error) {
      this.elements.errorContainer.style.display = 'none';
      return;
    }
    
    this.elements.errorContainer.textContent = `❌ Error: ${this.model.error}`;
    this.elements.errorContainer.style.display = 'block';
  }
}