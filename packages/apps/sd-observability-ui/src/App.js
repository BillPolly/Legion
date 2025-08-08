/**
 * SD Observability UI - Main Application
 * 
 * Initializes the UI components and manages WebSocket connection
 */

import { SDObservabilityActor } from './actors/SDObservabilityActor.js';
import { SDChatViewModel } from './components/chat/viewmodel/SDChatViewModel.js';
import { SDChatView } from './components/chat/view/SDChatView.js';
import { ActorSpace } from '/shared/actors/src/ActorSpace.js';
import { Channel } from '/shared/actors/src/Channel.js';
import { config } from './config.js';

class SDObservabilityApp {
  constructor() {
    this.actorSpace = null;
    this.actor = null;
    this.channel = null;
    this.ws = null;
    this.views = new Map();
    this.currentView = 'chat';
    
    // DOM elements
    this.elements = {
      connectionDot: document.getElementById('connection-dot'),
      connectionText: document.getElementById('connection-text'),
      projectSelector: document.getElementById('project-selector'),
      errorBanner: document.getElementById('error-banner'),
      errorMessage: document.getElementById('error-message'),
      loading: document.getElementById('loading')
    };
    
    this.initialize();
  }
  
  async initialize() {
    console.log('[SDObservabilityApp] Initializing...');
    
    // Setup navigation
    this.setupNavigation();
    
    // Setup tabs
    this.setupTabs();
    
    // Initialize WebSocket connection
    await this.connectWebSocket();
    
    // Initialize views
    this.initializeViews();
    
    // Load initial data
    await this.loadInitialData();
  }
  
  async connectWebSocket() {
    const wsUrl = config.backendUrl;
    
    console.log('[SDObservabilityApp] Connecting to backend WebSocket:', wsUrl);
    this.showLoading(true);
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[SDObservabilityApp] WebSocket connected');
        this.updateConnectionStatus('connected');
        
        // Initialize actor system
        this.initializeActorSystem();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'connection_established') {
            console.log('[SDObservabilityApp] Connection established:', message.clientId);
          } else if (message.type === 'actor_handshake_ack') {
            this.handleHandshakeAck(message);
          } else if (this.channel) {
            // Let the channel handle actor messages
            this.channel.handleMessage({ data: event.data });
          }
        } catch (error) {
          console.error('[SDObservabilityApp] Error processing message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('[SDObservabilityApp] WebSocket disconnected');
        this.updateConnectionStatus('disconnected');
        
        // Attempt reconnect after delay
        setTimeout(() => this.connectWebSocket(), 3000);
      };
      
      this.ws.onerror = (error) => {
        console.error('[SDObservabilityApp] WebSocket error:', error);
        this.showError('WebSocket connection error');
      };
      
    } catch (error) {
      console.error('[SDObservabilityApp] Failed to connect:', error);
      this.showError('Failed to connect to server');
      this.updateConnectionStatus('disconnected');
    } finally {
      this.showLoading(false);
    }
  }
  
  initializeActorSystem() {
    // Create actor space
    this.actorSpace = new ActorSpace(`frontend-${Date.now()}`);
    
    // Create and register SD observability actor
    this.actor = new SDObservabilityActor();
    const actorGuid = `${this.actorSpace.spaceId}-observability`;
    this.actorSpace.register(this.actor, actorGuid);
    
    // Send handshake
    this.ws.send(JSON.stringify({
      type: 'actor_handshake',
      clientActors: {
        observability: actorGuid
      }
    }));
  }
  
  handleHandshakeAck(message) {
    console.log('[SDObservabilityApp] Handshake acknowledged:', message.serverActors);
    
    // Create channel for the WebSocket
    this.channel = this.actorSpace.addChannel(this.ws);
    
    // Create remote actor reference
    const remoteActor = this.channel.makeRemote(message.serverActors.observability);
    
    // Connect actor to remote
    this.actor.setRemoteAgent(remoteActor);
    
    // Update connection status
    this.updateConnectionStatus('connected');
    
    // Notify views that connection is ready
    this.onConnectionReady();
  }
  
  initializeViews() {
    // Initialize chat view
    const chatContainer = document.getElementById('chat-view');
    const chatViewModel = new SDChatViewModel(this.actor);
    const chatView = new SDChatView(chatViewModel, chatContainer);
    
    this.views.set('chat', {
      viewModel: chatViewModel,
      view: chatView
    });
    
    // Initialize other views (placeholder for now)
    this.initializePlaceholderViews();
  }
  
  initializePlaceholderViews() {
    const viewIds = ['agents', 'artifacts', 'diagrams', 'validation', 'metrics', 'timeline'];
    
    for (const viewId of viewIds) {
      const container = document.getElementById(`${viewId}-view`);
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #969696;">
          <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">🚧</div>
            <h2 style="margin-bottom: 8px;">${viewId.charAt(0).toUpperCase() + viewId.slice(1)} View</h2>
            <p>Coming soon...</p>
          </div>
        </div>
      `;
    }
  }
  
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewName = item.dataset.view;
        this.switchView(viewName);
        
        // Update active state
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
      });
    });
  }
  
  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update active state
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Handle tab switch (placeholder for now)
        console.log('[SDObservabilityApp] Tab switched to:', tabName);
      });
    });
  }
  
  switchView(viewName) {
    console.log('[SDObservabilityApp] Switching to view:', viewName);
    
    // Hide all views
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    
    // Show selected view
    const viewPanel = document.getElementById(`${viewName}-view`);
    if (viewPanel) {
      viewPanel.classList.add('active');
    }
    
    this.currentView = viewName;
  }
  
  async loadInitialData() {
    // Load projects (placeholder for now)
    this.loadProjects();
    
    // Subscribe to project updates
    if (this.actor) {
      this.actor.on('project_changed', (data) => {
        this.updateProjectInfo(data);
      });
    }
  }
  
  loadProjects() {
    // Placeholder projects
    const projects = [
      { id: 'task-mgmt-app', name: 'Task Management App' },
      { id: 'e-commerce-platform', name: 'E-Commerce Platform' },
      { id: 'blog-engine', name: 'Blog Engine' }
    ];
    
    this.elements.projectSelector.innerHTML = '<option value="">No project selected</option>';
    
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      this.elements.projectSelector.appendChild(option);
    });
    
    // Handle project selection
    this.elements.projectSelector.addEventListener('change', (e) => {
      const projectId = e.target.value;
      if (projectId && this.actor) {
        this.actor.subscribeToProject({ projectId });
      }
    });
  }
  
  updateProjectInfo(data) {
    if (data.projectId) {
      this.elements.projectSelector.value = data.projectId;
    }
  }
  
  updateConnectionStatus(status) {
    const dot = this.elements.connectionDot;
    const text = this.elements.connectionText;
    
    dot.classList.remove('connected', 'disconnected');
    
    switch(status) {
      case 'connected':
        dot.classList.add('connected');
        text.textContent = 'Connected';
        break;
      case 'disconnected':
        dot.classList.add('disconnected');
        text.textContent = 'Disconnected';
        break;
      default:
        text.textContent = 'Connecting...';
    }
  }
  
  onConnectionReady() {
    console.log('[SDObservabilityApp] Connection ready, initializing views');
    
    // Notify views that connection is established
    for (const [name, viewInfo] of this.views) {
      if (viewInfo.viewModel.onConnectionReady) {
        viewInfo.viewModel.onConnectionReady();
      }
    }
  }
  
  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.elements.errorBanner.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.elements.errorBanner.classList.remove('show');
    }, 5000);
  }
  
  showLoading(show) {
    if (show) {
      this.elements.loading.classList.add('show');
    } else {
      this.elements.loading.classList.remove('show');
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.sdApp = new SDObservabilityApp();
  });
} else {
  window.sdApp = new SDObservabilityApp();
}

export { SDObservabilityApp };