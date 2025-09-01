/**
 * PlansTabComponent - MVVM Component for saved plans management
 * Handles plan loading, saving, and current plan display
 */

export class PlansTabComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      savedPlans: [],
      selectedPlan: '',
      currentPlan: null,
      isLoading: false,
      error: null,
      onLoadPlan: options.onLoadPlan || (() => {}),
      onRefreshPlans: options.onRefreshPlans || (() => {}),
      renderCurrentPlan: options.renderCurrentPlan || (() => null)
    };
    
    // View elements
    this.elements = {
      root: null,
      planSelect: null,
      loadButton: null,
      refreshButton: null,
      currentPlanDisplay: null,
      errorContainer: null
    };
    
    this.createView();
    this.bindEvents();
    
    // Load initial plans
    this.refreshPlans();
  }
  
  // CREATE VIEW ONCE
  createView() {
    this.elements.root = document.createElement('div');
    this.elements.root.className = 'plans-content';
    
    // Title
    const title = document.createElement('h2');
    title.textContent = '📁 Saved Plans';
    this.elements.root.appendChild(title);
    
    // Load section
    const loadSection = document.createElement('div');
    loadSection.className = 'load-section';
    
    const loadControls = document.createElement('div');
    loadControls.className = 'load-controls';
    
    // Select dropdown
    this.elements.planSelect = document.createElement('select');
    this.elements.planSelect.id = 'load-plan-select';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Choose a saved plan to load...';
    this.elements.planSelect.appendChild(defaultOption);
    
    // Load button
    this.elements.loadButton = document.createElement('button');
    this.elements.loadButton.id = 'load-plan-button';
    this.elements.loadButton.textContent = '📂 Load Plan';
    this.elements.loadButton.disabled = true;
    
    // Refresh button
    this.elements.refreshButton = document.createElement('button');
    this.elements.refreshButton.id = 'refresh-plans-button';
    this.elements.refreshButton.textContent = '🔄 Refresh';
    
    loadControls.appendChild(this.elements.planSelect);
    loadControls.appendChild(this.elements.loadButton);
    loadControls.appendChild(this.elements.refreshButton);
    loadSection.appendChild(loadControls);
    this.elements.root.appendChild(loadSection);
    
    // Current plan display
    this.elements.currentPlanDisplay = document.createElement('div');
    this.elements.currentPlanDisplay.id = 'current-plan-display';
    this.elements.root.appendChild(this.elements.currentPlanDisplay);
    
    // Error container
    this.elements.errorContainer = document.createElement('div');
    this.elements.errorContainer.className = 'error-message';
    this.elements.errorContainer.style.display = 'none';
    this.elements.root.appendChild(this.elements.errorContainer);
    
    // Add to container
    this.container.appendChild(this.elements.root);
    
    // Initial current plan display
    this.updateCurrentPlanDisplay();
  }
  
  // BIND EVENTS ONCE
  bindEvents() {
    this.elements.planSelect.addEventListener('change', (e) => {
      this.model.selectedPlan = e.target.value;
      this.elements.loadButton.disabled = !this.model.selectedPlan;
    });
    
    this.elements.loadButton.addEventListener('click', () => {
      if (this.model.selectedPlan) {
        this.model.onLoadPlan(this.model.selectedPlan);
      }
    });
    
    this.elements.refreshButton.addEventListener('click', () => {
      this.refreshPlans();
    });
  }
  
  // PUBLIC API - called by ClientPlannerActor
  setSavedPlans(plans) {
    this.model.savedPlans = plans || [];
    this.updatePlansList();
  }
  
  setCurrentPlan(planData) {
    this.model.currentPlan = planData;
    this.updateCurrentPlanDisplay();
  }
  
  setError(error) {
    this.model.error = error;
    this.updateError();
  }
  
  refreshPlans() {
    this.model.onRefreshPlans();
  }
  
  // UPDATE METHODS - incremental updates
  updatePlansList() {
    // Clear existing options except default
    this.elements.planSelect.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Choose a saved plan to load...';
    this.elements.planSelect.appendChild(defaultOption);
    
    // Add plan options
    this.model.savedPlans.forEach(plan => {
      const option = document.createElement('option');
      option.value = plan.filename;
      option.textContent = `${plan.name} (${new Date(plan.savedAt).toLocaleDateString()})`;
      this.elements.planSelect.appendChild(option);
    });
    
    // Reset selection
    this.model.selectedPlan = '';
    this.elements.loadButton.disabled = true;
  }
  
  updateCurrentPlanDisplay() {
    // Clear current display
    this.elements.currentPlanDisplay.innerHTML = '';
    
    // Get plan content from parent (maintains compatibility)
    const planContent = this.model.renderCurrentPlan();
    
    if (planContent) {
      if (typeof planContent === 'string') {
        this.elements.currentPlanDisplay.innerHTML = planContent;
      } else {
        this.elements.currentPlanDisplay.appendChild(planContent);
      }
    } else {
      const noPlan = document.createElement('p');
      noPlan.textContent = 'No plan loaded. Create a plan using the Planning tab.';
      this.elements.currentPlanDisplay.appendChild(noPlan);
    }
  }
  
  updateError() {
    if (this.model.error) {
      this.elements.errorContainer.textContent = `❌ ${this.model.error}`;
      this.elements.errorContainer.style.display = 'block';
    } else {
      this.elements.errorContainer.style.display = 'none';
    }
  }
}