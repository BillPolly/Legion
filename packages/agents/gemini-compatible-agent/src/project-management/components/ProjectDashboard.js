/**
 * ProjectDashboard Component - MVVM Umbilical
 * 
 * Creates a floating project management dashboard using the MVVM umbilical protocol
 * Integrates with existing Window component for floating window functionality
 */

import { UmbilicalUtils, UmbilicalError } from '/legion/components/src/umbilical/index.js';
import { Window } from '/legion/components/src/components/window/index.js';
import { ProjectDashboardModel } from './model/ProjectDashboardModel.js';

export const ProjectDashboard = {
  /**
   * Create ProjectDashboard instance following umbilical protocol
   */
  create(umbilical) {
    // Introspection mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Parent DOM element for dashboard window');
      requirements.add('projectManager', 'object', 'ProjectManagerAgent instance for data access');
      requirements.add('projectId', 'string', 'Project ID to display (optional, uses current project)');
      requirements.add('theme', 'string', 'Visual theme: "light" or "dark" (optional, defaults to "light")');
      requirements.add('position', 'object', 'Initial window position {x, y} (optional)');
      requirements.add('size', 'object', 'Initial window size {width, height} (optional)');
      requirements.add('onProjectChange', 'function', 'Callback when project data changes (optional)');
      requirements.add('onDeliverableClick', 'function', 'Callback when deliverable is clicked (optional)');
      requirements.add('onPhaseClick', 'function', 'Callback when phase is clicked (optional)');
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasProjectManager: umbilical.projectManager && typeof umbilical.projectManager === 'object',
        hasValidTheme: !umbilical.theme || ['light', 'dark'].includes(umbilical.theme)
      });
    }

    // Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom', 'projectManager'], 'ProjectDashboard');

    // Create model layer
    const model = new ProjectDashboardModel({
      projectManager: umbilical.projectManager,
      observabilityService: umbilical.observabilityService
    });

    // Create floating window using existing Window component
    const windowInstance = Window.create({
      dom: umbilical.dom,
      title: '🎯 Project Dashboard',
      width: umbilical.size?.width || 600,
      height: umbilical.size?.height || 500,
      position: umbilical.position || { x: 50, y: 50 },
      theme: umbilical.theme || 'light',
      resizable: true,
      draggable: true,
      onClose: () => {
        if (umbilical.onClose) {
          umbilical.onClose(instance);
        }
      }
    });

    // Create dashboard content
    let contentContainer = null;

    const renderDashboard = () => {
      const phaseStatus = model.getPhaseStatus();
      const deliverablesSummary = model.getDeliverablesSummary();

      const content = `
        <div style="padding: 15px; font-family: Arial, sans-serif;">
          <!-- Project Header -->
          <div style="background: ${umbilical.theme === 'dark' ? '#333' : '#f8f9fa'}; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="margin: 0 0 10px 0; color: ${umbilical.theme === 'dark' ? '#fff' : '#333'};">
              ${model.projectData.name || 'No Project Loaded'}
            </h3>
            <div style="display: flex; gap: 20px; font-size: 14px;">
              <span>🔄 <strong>Phase:</strong> ${model.projectData.phase || 'Unknown'}</span>
              <span>📊 <strong>Progress:</strong> ${model.projectData.progress || 0}%</span>
              <span>📈 <strong>Status:</strong> ${model.projectData.status || 'Unknown'}</span>
            </div>
          </div>

          <!-- Phase Progress -->
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0;">Phase Progress</h4>
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
              ${model.phases.map(phase => {
                const isCurrent = phase.id === model.projectData.phase;
                const isCompleted = phase.status === 'completed';
                const isActive = phase.status === 'in_progress' || phase.status === 'active';
                
                const bgColor = isCompleted ? '#4caf50' : isActive ? '#ff9800' : '#e0e0e0';
                const textColor = isCompleted || isActive ? '#fff' : '#666';
                
                return `
                  <div class="phase-indicator" data-phase="${phase.id}" style="
                    flex: 1;
                    padding: 8px;
                    text-align: center;
                    border-radius: 4px;
                    background: ${bgColor};
                    color: ${textColor};
                    font-size: 12px;
                    font-weight: bold;
                    cursor: pointer;
                    border: ${isCurrent ? '2px solid #2196f3' : '1px solid transparent'};
                  ">
                    ${phase.name.toUpperCase()}
                    <br><small>${phase.progress}%</small>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Deliverables Status -->
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0;">
              Deliverables (${deliverablesSummary.completed}/${deliverablesSummary.total})
            </h4>
            <div style="background: ${umbilical.theme === 'dark' ? '#2a2a2a' : '#fff'}; border: 1px solid ${umbilical.theme === 'dark' ? '#444' : '#ddd'}; border-radius: 6px; padding: 10px;">
              ${model.deliverables.map(deliverable => {
                const statusIcon = deliverable.status === 'completed' ? '✅' :
                                  deliverable.status === 'in_progress' ? '🔄' :
                                  deliverable.status === 'blocked' ? '🚫' : '⏳';
                
                return `
                  <div class="deliverable-item" data-deliverable-id="${deliverable.id}" style="
                    padding: 8px;
                    margin: 4px 0;
                    border-radius: 4px;
                    background: ${umbilical.theme === 'dark' ? '#333' : '#f8f9fa'};
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  ">
                    <div>
                      ${statusIcon} <strong>${deliverable.name}</strong>
                      ${deliverable.assignedAgent ? `<br><small>👤 ${deliverable.assignedAgent}</small>` : ''}
                    </div>
                    <div style="font-weight: bold; color: ${deliverable.completion === 100 ? '#4caf50' : '#666'};">
                      ${deliverable.completion}%
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Summary Stats -->
          <div style="display: flex; gap: 10px; font-size: 12px;">
            <div style="flex: 1; text-align: center; padding: 8px; background: #4caf50; color: white; border-radius: 4px;">
              ✅ ${deliverablesSummary.completed} Complete
            </div>
            <div style="flex: 1; text-align: center; padding: 8px; background: #ff9800; color: white; border-radius: 4px;">
              🔄 ${deliverablesSummary.inProgress} In Progress
            </div>
            <div style="flex: 1; text-align: center; padding: 8px; background: #f44336; color: white; border-radius: 4px;">
              🚫 ${deliverablesSummary.blocked} Blocked
            </div>
          </div>
        </div>
      `;

      windowInstance.setContent(content);

      // Add click event listeners
      if (contentContainer) {
        // Phase click handlers
        contentContainer.querySelectorAll('.phase-indicator').forEach(el => {
          el.onclick = () => {
            const phase = el.dataset.phase;
            if (umbilical.onPhaseClick) {
              umbilical.onPhaseClick(phase, instance);
            }
          };
        });

        // Deliverable click handlers
        contentContainer.querySelectorAll('.deliverable-item').forEach(el => {
          el.onclick = () => {
            const deliverableId = el.dataset.deliverableId;
            const deliverable = model.deliverables.find(d => d.id === deliverableId);
            if (umbilical.onDeliverableClick && deliverable) {
              umbilical.onDeliverableClick(deliverable, instance);
            }
          };
        });
      }
    };

    // Get content container reference
    contentContainer = windowInstance.contentElement;

    // Model change listener for reactive updates
    model.addChangeListener((changeData) => {
      console.log('🎯 [ProjectDashboard] Model changed:', changeData.type);
      renderDashboard();
      
      if (umbilical.onProjectChange) {
        umbilical.onProjectChange(changeData, instance);
      }
    });

    // Create instance interface
    const instance = {
      // Window access
      get window() {
        return windowInstance.window;
      },

      get windowInstance() {
        return windowInstance;
      },

      // Model access
      get model() {
        return model;
      },

      // Dashboard operations
      async loadProject(projectId) {
        const result = await model.loadProject(projectId);
        if (result.success) {
          windowInstance.setTitle(`🎯 Project: ${model.projectData.name}`);
          renderDashboard();
        }
        return result;
      },

      async refreshData() {
        return await model.refreshData();
      },

      startAutoRefresh(intervalMs) {
        return model.startAutoRefresh(intervalMs);
      },

      stopAutoRefresh() {
        return model.stopAutoRefresh();
      },

      // Window control
      show() {
        windowInstance.show();
      },

      hide() {
        windowInstance.hide();
      },

      close() {
        windowInstance.close();
      },

      bringToFront() {
        windowInstance.bringToFront();
      },

      // State access
      getProjectData() {
        return model.projectData;
      },

      getDeliverables() {
        return model.deliverables;
      },

      getPhases() {
        return model.phases;
      },

      // Cleanup
      destroy() {
        model.destroy();
        windowInstance.destroy();
        
        if (umbilical.onDestroy) {
          umbilical.onDestroy(instance);
        }
      }
    };

    // Initial render
    renderDashboard();

    // Lifecycle callback
    if (umbilical.onMount) {
      umbilical.onMount(instance);
    }

    return instance;
  }
};