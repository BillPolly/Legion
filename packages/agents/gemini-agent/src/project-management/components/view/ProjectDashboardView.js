/**
 * ProjectDashboardView - View layer for project dashboard component
 * Handles DOM rendering, visual updates, and user interactions following MVVM View pattern
 */

export class ProjectDashboardView {
  constructor(element, config = {}) {
    this.element = element;
    this.config = {
      theme: 'light',
      ...config
    };
    this.rendered = false;

    // DOM references for efficient updates
    this.projectHeaderElement = null;
    this.phaseProgressElement = null;
    this.deliverablesElement = null;
    this.statsElement = null;

    // Event handlers storage for cleanup
    this.eventHandlers = new Map();

    console.log('🎨 [ProjectDashboardView] Initialized MVVM view layer');
  }

  /**
   * Render complete dashboard
   * @param {Object} projectData - Project data to render
   * @param {Array} deliverables - Deliverables array
   * @param {Array} phases - Phases array
   */
  render(projectData, deliverables, phases) {
    // Clear existing content
    this.element.innerHTML = '';

    // Generate complete dashboard HTML
    const dashboardHTML = `
      <div class="project-dashboard" style="padding: 15px; font-family: Arial, sans-serif; height: 100%; overflow-y: auto;">
        ${this.renderProjectHeader(projectData)}
        ${this.renderPhaseProgress(phases, projectData.phase)}
        ${this.renderDeliverables(deliverables)}
        ${this.renderStats(deliverables)}
      </div>
    `;

    this.element.innerHTML = dashboardHTML;

    // Cache DOM references for efficient updates
    this.projectHeaderElement = this.element.querySelector('.project-header');
    this.phaseProgressElement = this.element.querySelector('.phase-progress');
    this.deliverablesElement = this.element.querySelector('.deliverables-section');
    this.statsElement = this.element.querySelector('.stats-section');

    this.rendered = true;
    console.log('🎨 [ProjectDashboardView] Rendered dashboard for project:', projectData.name || 'Unknown');
  }

  /**
   * Render project header section
   * @param {Object} projectData - Project data
   * @returns {string} Header HTML
   */
  renderProjectHeader(projectData) {
    const theme = this.config.theme;
    const headerBg = theme === 'dark' ? '#333' : '#f8f9fa';
    const textColor = theme === 'dark' ? '#fff' : '#333';

    return `
      <div class="project-header" style="
        background: ${headerBg};
        color: ${textColor};
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        border: 1px solid ${theme === 'dark' ? '#444' : '#e9ecef'};
      ">
        <h3 style="margin: 0 0 10px 0; font-size: 18px;">
          ${projectData.name || 'No Project Loaded'}
        </h3>
        ${projectData.id ? `
          <div style="display: flex; gap: 20px; font-size: 14px; flex-wrap: wrap;">
            <span>🔄 <strong>Phase:</strong> ${projectData.phase || 'Unknown'}</span>
            <span>📊 <strong>Progress:</strong> ${projectData.progress || 0}%</span>
            <span>📈 <strong>Status:</strong> ${projectData.status || 'Unknown'}</span>
          </div>
          <div style="font-size: 12px; color: #666; margin-top: 8px;">
            📝 <strong>ID:</strong> ${projectData.id}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render phase progress indicators
   * @param {Array} phases - Phases array
   * @param {string} currentPhase - Current project phase
   * @returns {string} Phase progress HTML
   */
  renderPhaseProgress(phases, currentPhase) {
    if (!phases || phases.length === 0) return '';

    return `
      <div class="phase-progress" style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; font-size: 16px;">Phase Progress</h4>
        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
          ${phases.map(phase => {
            const isCurrent = phase.id === currentPhase;
            const isCompleted = phase.status === 'completed';
            const isActive = phase.status === 'in_progress' || phase.status === 'active';
            
            let bgColor, textColor;
            if (isCompleted) {
              bgColor = '#4caf50';
              textColor = '#fff';
            } else if (isActive) {
              bgColor = '#ff9800';
              textColor = '#fff';
            } else {
              bgColor = '#e0e0e0';
              textColor = '#666';
            }
            
            return `
              <div 
                class="phase-indicator" 
                data-phase="${phase.id}"
                style="
                  flex: 1;
                  padding: 12px 8px;
                  text-align: center;
                  border-radius: 6px;
                  background: ${bgColor};
                  color: ${textColor};
                  font-size: 12px;
                  font-weight: bold;
                  cursor: pointer;
                  border: ${isCurrent ? '2px solid #2196f3' : '1px solid transparent'};
                  box-shadow: ${isCurrent ? '0 0 0 1px #2196f3' : 'none'};
                  transition: all 0.2s ease;
                  min-height: 50px;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                "
                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='${isCurrent ? '0 0 0 1px #2196f3' : 'none'}'"
              >
                <div>${phase.name.toUpperCase()}</div>
                <small>${phase.progress || 0}%</small>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render deliverables list
   * @param {Array} deliverables - Deliverables array
   * @returns {string} Deliverables HTML
   */
  renderDeliverables(deliverables) {
    const theme = this.config.theme;
    const sectionBg = theme === 'dark' ? '#2a2a2a' : '#fff';
    const borderColor = theme === 'dark' ? '#444' : '#ddd';
    const itemBg = theme === 'dark' ? '#333' : '#f8f9fa';

    const deliverableItems = deliverables.map(deliverable => {
      const statusIcon = this.getStatusIcon(deliverable.status);
      const completionColor = deliverable.completion === 100 ? '#4caf50' : '#666';
      
      return `
        <div 
          class="deliverable-item" 
          data-deliverable-id="${deliverable.id}"
          style="
            padding: 12px;
            margin: 6px 0;
            border-radius: 6px;
            background: ${itemBg};
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid ${borderColor};
            transition: all 0.2s ease;
          "
          onmouseover="this.style.background='${theme === 'dark' ? '#444' : '#e3f2fd'}'"
          onmouseout="this.style.background='${itemBg}'"
        >
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">
              ${statusIcon} ${deliverable.name}
            </div>
            ${deliverable.assignedAgent ? `
              <div style="font-size: 12px; color: #666;">
                👤 ${deliverable.assignedAgent}
              </div>
            ` : ''}
          </div>
          <div style="
            font-weight: bold; 
            color: ${completionColor};
            font-size: 16px;
          ">
            ${deliverable.completion}%
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="deliverables-section" style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; font-size: 16px;">
          Deliverables (${deliverables.filter(d => d.status === 'completed').length}/${deliverables.length})
        </h4>
        <div style="
          background: ${sectionBg}; 
          border: 1px solid ${borderColor}; 
          border-radius: 6px; 
          padding: 10px;
          max-height: 200px;
          overflow-y: auto;
        ">
          ${deliverableItems || '<div style="text-align: center; color: #666; padding: 20px;">No deliverables</div>'}
        </div>
      </div>
    `;
  }

  /**
   * Render summary statistics
   * @param {Array} deliverables - Deliverables for stats calculation
   * @returns {string} Stats HTML
   */
  renderStats(deliverables) {
    const completed = deliverables.filter(d => d.status === 'completed').length;
    const inProgress = deliverables.filter(d => d.status === 'in_progress').length;
    const blocked = deliverables.filter(d => d.status === 'blocked').length;

    return `
      <div class="stats-section">
        <div style="display: flex; gap: 8px; font-size: 12px;">
          <div style="
            flex: 1; 
            text-align: center; 
            padding: 10px 8px; 
            background: #4caf50; 
            color: white; 
            border-radius: 4px;
            font-weight: 600;
          ">
            ✅ ${completed} Complete
          </div>
          <div style="
            flex: 1; 
            text-align: center; 
            padding: 10px 8px; 
            background: #ff9800; 
            color: white; 
            border-radius: 4px;
            font-weight: 600;
          ">
            🔄 ${inProgress} In Progress
          </div>
          <div style="
            flex: 1; 
            text-align: center; 
            padding: 10px 8px; 
            background: #f44336; 
            color: white; 
            border-radius: 4px;
            font-weight: 600;
          ">
            🚫 ${blocked} Blocked
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get status icon for deliverable
   * @param {string} status - Deliverable status
   * @returns {string} Status icon
   */
  getStatusIcon(status) {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'blocked': return '🚫';
      case 'review': return '👁️';
      default: return '⏳';
    }
  }

  /**
   * Bind event handlers to interactive elements
   * @param {Object} callbacks - Event callbacks
   */
  bindEvents(callbacks = {}) {
    // Clear existing handlers
    this.eventHandlers.clear();

    if (callbacks.onPhaseClick) {
      const phaseElements = this.element.querySelectorAll('.phase-indicator');
      phaseElements.forEach(el => {
        const handler = () => callbacks.onPhaseClick(el.dataset.phase);
        el.addEventListener('click', handler);
        this.eventHandlers.set(`phase_${el.dataset.phase}`, handler);
      });
    }

    if (callbacks.onDeliverableClick) {
      const deliverableElements = this.element.querySelectorAll('.deliverable-item');
      deliverableElements.forEach(el => {
        const handler = () => {
          const deliverableId = el.dataset.deliverableId;
          callbacks.onDeliverableClick({ id: deliverableId });
        };
        el.addEventListener('click', handler);
        this.eventHandlers.set(`deliverable_${el.dataset.deliverableId}`, handler);
      });
    }

    console.log('🎨 [ProjectDashboardView] Bound event handlers:', this.eventHandlers.size);
  }

  /**
   * Update specific deliverable in view without full re-render
   * @param {string} deliverableId - Deliverable ID to update
   * @param {Object} updates - Updates to apply
   */
  updateDeliverable(deliverableId, updates) {
    const deliverableEl = this.element.querySelector(`[data-deliverable-id="${deliverableId}"]`);
    if (!deliverableEl) {
      console.warn(`🎨 [ProjectDashboardView] Deliverable element not found: ${deliverableId}`);
      return;
    }

    // Update completion percentage
    if (updates.completion !== undefined) {
      const completionEl = deliverableEl.querySelector('.completion-percentage');
      if (completionEl) {
        completionEl.textContent = `${updates.completion}%`;
        completionEl.style.color = updates.completion === 100 ? '#4caf50' : '#666';
      }
    }

    // Update status icon
    if (updates.status !== undefined) {
      const statusIcon = this.getStatusIcon(updates.status);
      const iconEl = deliverableEl.querySelector('.status-icon');
      if (iconEl) {
        iconEl.textContent = statusIcon;
      }
    }

    console.log(`🎨 [ProjectDashboardView] Updated deliverable ${deliverableId}:`, updates);
  }

  /**
   * Update project header information
   * @param {Object} projectData - Updated project data
   */
  updateProjectHeader(projectData) {
    if (!this.projectHeaderElement) return;

    const nameEl = this.projectHeaderElement.querySelector('.project-name');
    if (nameEl && projectData.name) {
      nameEl.textContent = projectData.name;
    }

    const phaseEl = this.projectHeaderElement.querySelector('.project-phase');
    if (phaseEl && projectData.phase) {
      phaseEl.textContent = projectData.phase;
    }

    const progressEl = this.projectHeaderElement.querySelector('.project-progress');
    if (progressEl && projectData.progress !== undefined) {
      progressEl.textContent = `${projectData.progress}%`;
    }
  }

  /**
   * Set view theme
   * @param {string} theme - Theme ('light' | 'dark')
   */
  setTheme(theme) {
    this.config.theme = theme;
    
    // Update theme-dependent styles
    if (this.rendered) {
      const dashboard = this.element.querySelector('.project-dashboard');
      if (dashboard) {
        dashboard.style.background = theme === 'dark' ? '#1e1e1e' : '#fff';
        dashboard.style.color = theme === 'dark' ? '#fff' : '#333';
      }

      // Update header background
      if (this.projectHeaderElement) {
        this.projectHeaderElement.style.background = theme === 'dark' ? '#333' : '#f8f9fa';
      }
    }

    console.log(`🎨 [ProjectDashboardView] Updated theme to: ${theme}`);
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.element.innerHTML = `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
        font-family: Arial, sans-serif;
      ">
        <div style="text-align: center;">
          <div style="font-size: 24px; margin-bottom: 10px;">🔄</div>
          <div>Loading project data...</div>
        </div>
      </div>
    `;
  }

  /**
   * Show error state
   * @param {string} error - Error message
   */
  showError(error) {
    this.element.innerHTML = `
      <div style="
        padding: 20px;
        text-align: center;
        font-family: Arial, sans-serif;
        color: #f44336;
      ">
        <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
        <div style="font-weight: 600; margin-bottom: 5px;">Error Loading Project</div>
        <div style="font-size: 14px;">${error}</div>
      </div>
    `;
  }

  /**
   * Get current DOM state (for debugging)
   * @returns {Object} DOM state
   */
  getDOMState() {
    return {
      hasContent: this.element.innerHTML.length > 0,
      rendered: this.rendered,
      phaseElements: this.element.querySelectorAll('.phase-indicator').length,
      deliverableElements: this.element.querySelectorAll('.deliverable-item').length,
      hasHeader: !!this.projectHeaderElement,
      eventHandlers: this.eventHandlers.size
    };
  }

  /**
   * Destroy view and clean up
   */
  destroy() {
    // Remove all event listeners
    this.eventHandlers.forEach((handler, key) => {
      const element = this.element.querySelector(`[data-${key.split('_')[0]}-id="${key.split('_')[1]}"]`) ||
                     this.element.querySelector(`[data-${key.split('_')[0]}="${key.split('_')[1]}"]`);
      if (element) {
        element.removeEventListener('click', handler);
      }
    });

    this.eventHandlers.clear();
    this.element.innerHTML = '';
    
    // Clear DOM references
    this.projectHeaderElement = null;
    this.phaseProgressElement = null;
    this.deliverablesElement = null;
    this.statsElement = null;
    
    this.rendered = false;
    
    console.log('🎨 [ProjectDashboardView] View destroyed and cleaned up');
  }
}