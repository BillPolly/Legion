/**
 * ProjectDashboardViewModel - ViewModel layer for project dashboard component
 * Coordinates between Model and View, handles user interactions following MVVM pattern
 */

export class ProjectDashboardViewModel {
  constructor(model, view, config = {}) {
    this.model = model;
    this.view = view;
    this.config = config;
    
    // ViewModel state
    this.isInitialized = false;
    this.currentProjectId = null;
    
    // Event callbacks (set by parent component)
    this.onPhaseClick = null;
    this.onDeliverableClick = null;
    this.onProjectChange = null;

    console.log('🎛️ [ProjectDashboardViewModel] Initialized MVVM ViewModel layer');
  }

  /**
   * Initialize ViewModel and bind model changes to view updates
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      // Bind model changes to view updates
      this.modelChangeHandler = (changeData) => this.handleModelChange(changeData);
      this.model.addChangeListener(this.modelChangeHandler);

      // Bind view events to ViewModel handlers
      this.view.bindEvents({
        onPhaseClick: (phase) => this.handlePhaseClick(phase),
        onDeliverableClick: (deliverable) => this.handleDeliverableClick(deliverable)
      });

      this.isInitialized = true;
      console.log('🎛️ [ProjectDashboardViewModel] ViewModel initialized and event bindings established');

      return { success: true };

    } catch (error) {
      console.error('🎛️ [ProjectDashboardViewModel] Initialization failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load project data through Model and update View
   * @param {string} projectId - Project ID to load
   * @returns {Promise<Object>} Load result
   */
  async loadProject(projectId) {
    try {
      this.view.showLoading();
      
      const result = await this.model.loadProject(projectId);
      
      if (result.success) {
        this.currentProjectId = projectId;
        this.renderView();
        console.log(`🎛️ [ProjectDashboardViewModel] Loaded project: ${projectId}`);
      } else {
        this.view.showError(result.error);
        console.error(`🎛️ [ProjectDashboardViewModel] Load failed: ${result.error}`);
      }

      return result;

    } catch (error) {
      const errorMessage = `Failed to load project: ${error.message}`;
      this.view.showError(errorMessage);
      console.error('🎛️ [ProjectDashboardViewModel] Load error:', error.message);
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handle model change notifications and update view accordingly
   * @param {Object} changeData - Change notification from model
   */
  handleModelChange(changeData) {
    console.log('🎛️ [ProjectDashboardViewModel] Model change:', changeData.type);

    try {
      switch (changeData.type) {
        case 'project_loaded':
        case 'project_updated':
        case 'project_data_loaded':
          this.view.updateProjectHeader(changeData.current || this.model.projectData);
          this.renderView(); // Full re-render for any project data change
          break;

        case 'deliverable_updated':
          this.view.updateDeliverable(changeData.deliverableId, changeData.updates);
          break;

        default:
          console.log('🎛️ [ProjectDashboardViewModel] Unhandled model change:', changeData.type);
      }

      // Notify parent component of changes
      if (this.onProjectChange) {
        this.onProjectChange(changeData);
      }

    } catch (error) {
      console.error('🎛️ [ProjectDashboardViewModel] Error handling model change:', error.message);
    }
  }

  /**
   * Handle phase click from view
   * @param {string} phase - Clicked phase ID
   */
  handlePhaseClick(phase) {
    console.log('🎛️ [ProjectDashboardViewModel] Phase clicked:', phase);
    
    if (this.onPhaseClick) {
      this.onPhaseClick(phase);
    }
  }

  /**
   * Handle deliverable click from view
   * @param {Object} deliverable - Clicked deliverable
   */
  handleDeliverableClick(deliverable) {
    console.log('🎛️ [ProjectDashboardViewModel] Deliverable clicked:', deliverable.id);
    
    if (this.onDeliverableClick) {
      this.onDeliverableClick(deliverable);
    }
  }

  /**
   * Render view with current model data
   */
  renderView() {
    const projectData = this.model.projectData;
    const deliverables = this.model.deliverables;
    const phases = this.model.phases;

    this.view.render(projectData, deliverables, phases);
    
    console.log('🎛️ [ProjectDashboardViewModel] View rendered with current model data');
  }

  /**
   * Refresh data from model
   * @returns {Promise<Object>} Refresh result
   */
  async refreshData() {
    try {
      if (!this.currentProjectId) {
        return { success: false, error: 'No project loaded' };
      }

      await this.model.refreshData();
      this.renderView();

      return { success: true };

    } catch (error) {
      console.error('🎛️ [ProjectDashboardViewModel] Refresh failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set theme for view
   * @param {string} theme - Theme ('light' | 'dark')
   */
  setTheme(theme) {
    this.config.theme = theme;
    this.view.setTheme(theme);
    
    console.log(`🎛️ [ProjectDashboardViewModel] Theme updated to: ${theme}`);
  }

  /**
   * Update deliverable from external source (e.g., actor framework)
   * @param {string} deliverableId - Deliverable ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Update result
   */
  updateDeliverable(deliverableId, updates) {
    const result = this.model.updateDeliverable(deliverableId, updates);
    
    if (result.success) {
      // View will be updated automatically via model change listener
      console.log(`🎛️ [ProjectDashboardViewModel] Deliverable updated: ${deliverableId}`);
    }
    
    return result;
  }

  /**
   * Update project data from external source
   * @param {Object} updates - Project updates
   */
  updateProjectData(updates) {
    this.model.updateProjectData(updates);
    // View will be updated automatically via model change listener
    
    console.log('🎛️ [ProjectDashboardViewModel] Project data updated:', Object.keys(updates));
  }

  /**
   * Get current ViewModel state for debugging
   * @returns {Object} Current state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      projectId: this.currentProjectId,
      modelState: this.model.getState ? this.model.getState() : {},
      viewState: this.view.getDOMState ? this.view.getDOMState() : {},
      hasCallbacks: {
        onPhaseClick: !!this.onPhaseClick,
        onDeliverableClick: !!this.onDeliverableClick,
        onProjectChange: !!this.onProjectChange
      }
    };
  }

  /**
   * Destroy ViewModel and clean up resources
   */
  destroy() {
    // Remove model change listener
    if (this.modelChangeHandler) {
      this.model.removeChangeListener(this.modelChangeHandler);
    }

    // Clean up model and view
    this.model.destroy();
    this.view.destroy();

    // Clear references
    this.model = null;
    this.view = null;
    this.onPhaseClick = null;
    this.onDeliverableClick = null;
    this.onProjectChange = null;
    this.currentProjectId = null;
    this.isInitialized = false;

    console.log('🎛️ [ProjectDashboardViewModel] ViewModel destroyed and cleaned up');
  }
}