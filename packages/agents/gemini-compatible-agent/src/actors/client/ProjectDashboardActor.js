/**
 * ProjectDashboardActor - Floating window actor for project management
 * Receives direct updates from ProjectManagerAgent via actor framework
 */

export default class ProjectDashboardActor {
  constructor() {
    this.remoteActor = null; // Reference to server actor
    this.projectData = {};
    this.deliverables = [];
    this.windowElement = null;
    
    console.log('🎯 [ProjectDashboardActor] Created as proper actor');
  }

  /**
   * Set remote actor connection (Legion actor framework pattern)
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎯 [ProjectDashboardActor] Connected to server actor');
    
    // Request current project data
    this.requestProjectData();
  }

  /**
   * Initialize floating window
   */
  initializeWindow() {
    console.log('🎯 [ProjectDashboardActor] Initializing floating window');
    
    // Create floating window
    this.windowElement = document.createElement('div');
    this.windowElement.className = 'project-dashboard-window';
    this.windowElement.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      width: 400px;
      height: 500px;
      background: white;
      border: 2px solid #2196f3;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      font-family: Arial, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    // Add header
    const header = document.createElement('div');
    header.style.cssText = `
      background: #2196f3;
      color: white;
      padding: 10px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span>🎯 Project Dashboard</span>
      <button onclick="this.parentElement.parentElement.style.display='none'" style="
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
      ">×</button>
    `;

    // Add content area
    const content = document.createElement('div');
    content.id = 'dashboard-content';
    content.style.cssText = `
      flex: 1;
      padding: 15px;
      overflow-y: auto;
    `;

    this.windowElement.appendChild(header);
    this.windowElement.appendChild(content);
    document.body.appendChild(this.windowElement);

    console.log('🎯 [ProjectDashboardActor] Floating window created and added to page');
  }

  /**
   * Receive messages from server actor
   */
  receive(messageType, data) {
    console.log('📨 [ProjectDashboardActor] Received:', messageType);
    
    switch (messageType) {
      case 'project_data_update':
        this.updateProjectData(data);
        break;
        
      case 'deliverable_completed':
        this.updateDeliverableStatus(data.deliverableId, 'completed', 100);
        this.showCompletionNotification(data);
        break;
        
      case 'deliverable_progress':
        this.updateDeliverableStatus(data.deliverableId, data.status, data.completion);
        break;
        
      case 'project_work_started':
        this.showWorkStartedNotification(data);
        break;
        
      default:
        console.log('⚠️ [ProjectDashboardActor] Unknown message:', messageType);
    }
  }

  /**
   * Request project data from server
   */
  requestProjectData() {
    if (this.remoteActor) {
      this.remoteActor.receive('get_dashboard_project_data', {
        timestamp: new Date().toISOString()
      });
      console.log('📊 [ProjectDashboardActor] Requested project data from server');
    }
  }

  /**
   * Update project data display
   */
  updateProjectData(data) {
    this.projectData = data;
    this.deliverables = data.deliverables || [];
    this.renderDashboard();
    
    console.log(`🎯 [ProjectDashboardActor] Updated project data: ${data.projectName}`);
  }

  /**
   * Update specific deliverable status
   */
  updateDeliverableStatus(deliverableId, status, completion) {
    const deliverable = this.deliverables.find(d => d.id === deliverableId);
    if (deliverable) {
      deliverable.status = status;
      deliverable.completion = completion;
      this.renderDashboard();
      
      console.log(`📊 [ProjectDashboardActor] Updated deliverable ${deliverableId}: ${status} ${completion}%`);
    }
  }

  /**
   * Render the complete dashboard
   */
  renderDashboard() {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    const completedCount = this.deliverables.filter(d => d.status === 'completed').length;
    const totalCount = this.deliverables.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    content.innerHTML = `
      <div style="margin-bottom: 15px;">
        <h3 style="margin: 0 0 10px 0; color: #333;">
          ${this.projectData.projectName || 'No Project'}
        </h3>
        <div style="font-size: 14px; color: #666;">
          Phase: ${this.projectData.currentPhase || 'Unknown'} | Progress: ${progress}%
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0;">Deliverables (${completedCount}/${totalCount})</h4>
        ${this.deliverables.map(deliverable => {
          const statusIcon = deliverable.status === 'completed' ? '✅' : 
                            deliverable.status === 'in_progress' ? '🔄' : 
                            deliverable.status === 'blocked' ? '🚫' : '⏳';
          
          return `
            <div onclick="this.style.background='#e3f2fd'" style="
              padding: 8px;
              margin: 5px 0;
              background: #f8f9fa;
              border-radius: 4px;
              cursor: pointer;
              border: 1px solid #e9ecef;
            ">
              ${statusIcon} <strong>${deliverable.name}</strong>
              <div style="font-size: 12px; color: #666;">
                ${deliverable.completion}% complete
                ${deliverable.assignedAgent ? `| Agent: ${deliverable.assignedAgent}` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="display: flex; gap: 5px; font-size: 12px;">
        <div style="flex: 1; text-align: center; padding: 8px; background: #4caf50; color: white; border-radius: 4px;">
          ✅ ${this.deliverables.filter(d => d.status === 'completed').length}
        </div>
        <div style="flex: 1; text-align: center; padding: 8px; background: #ff9800; color: white; border-radius: 4px;">
          🔄 ${this.deliverables.filter(d => d.status === 'in_progress').length}
        </div>
        <div style="flex: 1; text-align: center; padding: 8px; background: #f44336; color: white; border-radius: 4px;">
          🚫 ${this.deliverables.filter(d => d.status === 'blocked').length}
        </div>
      </div>
    `;

    console.log(`🎨 [ProjectDashboardActor] Rendered dashboard: ${completedCount}/${totalCount} deliverables`);
  }

  /**
   * Show completion notification
   */
  showCompletionNotification(data) {
    console.log(`✅ [ProjectDashboardActor] Showing completion: ${data.deliverableName}`);
    
    // Could add a toast notification here
    const content = document.getElementById('dashboard-content');
    if (content) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #4caf50;
        color: white;
        padding: 8px;
        border-radius: 4px;
        font-size: 12px;
        animation: fadeIn 0.3s ease;
      `;
      notification.textContent = `✅ ${data.deliverableName} completed!`;
      content.appendChild(notification);
      
      // Remove after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    }
  }

  /**
   * Show work started notification
   */
  showWorkStartedNotification(data) {
    console.log(`🚀 [ProjectDashboardActor] Work started on: ${data.projectName}`);
  }
}