/**
 * FormalPlanningComponent - MVVM Component for formal planning with behavior trees
 * Shows progress, results, and behavior tree visualization
 */

import { ThinkingComponent } from './ThinkingComponent.js';
import { CollapsibleSectionComponent } from './CollapsibleSectionComponent.js';

export class FormalPlanningComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      formalResult: options.formalResult || null,
      isPlanning: options.isPlanning || false,
      error: null,
      thinkingSteps: [],
      toolsResult: options.toolsResult || null
    };
    
    // View elements
    this.elements = {};
    
    // Create thinking component for progress
    this.thinkingContainer = document.createElement('div');
    this.thinkingContainer.className = 'formal-thinking-container';
    
    this.thinkingComponent = new ThinkingComponent(this.thinkingContainer, {
      title: 'Formal Planning Progress',
      showProgress: true
    });
    
    this.render();
  }
  
  setPlanning(isPlanning) {
    this.model.isPlanning = isPlanning;
    if (isPlanning) {
      this.thinkingComponent.start('🏗️ Formal Planning');
    }
    this.render();
  }
  
  addThinkingStep(message, type = 'info') {
    this.thinkingComponent.addStep(message, type);
  }
  
  setResult(result) {
    this.model.formalResult = result;
    this.model.isPlanning = false;
    this.model.error = null;
    
    // Complete thinking component
    const finalMessage = result.success ? 
      '✅ Formal planning completed successfully' : 
      '❌ Formal planning failed';
    this.thinkingComponent.complete(finalMessage);
    
    this.render();
  }
  
  setToolsResult(toolsResult) {
    this.model.toolsResult = toolsResult;
    this.render();
  }
  
  setError(error) {
    this.model.error = error;
    this.model.isPlanning = false;
    this.thinkingComponent.error(error);
    this.render();
  }
  
  render() {
    // Clear container
    this.container.innerHTML = '';
    
    // Add thinking component first
    this.container.appendChild(this.thinkingContainer);
    
    // Show results or current state
    if (!this.model.isPlanning && this.model.formalResult) {
      this.renderResults();
    } else if (!this.model.isPlanning && this.model.error) {
      this.renderError();
    } else if (!this.model.isPlanning && !this.model.formalResult && !this.model.error) {
      this.renderEmpty();
    }
  }
  
  renderEmpty() {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'formal-planning-empty';
    
    if (!this.model.toolsResult) {
      emptyDiv.innerHTML = '<p>Complete tool discovery first to enable formal planning.</p>';
    } else {
      emptyDiv.innerHTML = '<p>Tools discovered. Click "Start Formal Planning" to begin.</p>';
    }
    
    this.container.appendChild(emptyDiv);
  }
  
  renderError() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'formal-planning-error';
    errorDiv.innerHTML = `<h3>❌ Error</h3><p>${this.model.error}</p>`;
    this.container.appendChild(errorDiv);
  }
  
  renderResults() {
    const result = this.model.formalResult;
    if (!result) return;
    
    // Check if results already exist
    if (this.container.querySelector('.formal-planning-results')) {
      return; // Already rendered
    }
    
    // Create main results container
    const mainResultsContainer = document.createElement('div');
    mainResultsContainer.className = 'formal-planning-results';
    
    // Title section with save button
    const titleSection = document.createElement('div');
    titleSection.className = 'formal-planning-title';
    titleSection.style.display = 'flex';
    titleSection.style.justifyContent = 'space-between';
    titleSection.style.alignItems = 'center';
    titleSection.style.marginBottom = '16px';
    
    const titleH3 = document.createElement('h3');
    titleH3.textContent = '🏗️ Formal Planning Results';
    titleH3.style.margin = '0';
    titleSection.appendChild(titleH3);
    
    const saveButton = document.createElement('button');
    saveButton.id = 'formal-save-plan-button';
    saveButton.className = 'save-plan-btn';
    saveButton.innerHTML = '💾 Save Plan';
    saveButton.onclick = () => {
      // Dispatch event to parent ClientPlannerActor
      window.clientActor?.handleSavePlan();
    };
    titleSection.appendChild(saveButton);
    
    mainResultsContainer.appendChild(titleSection);
    
    // Create results content
    const resultsContent = document.createElement('div');
    resultsContent.className = 'formal-planning-results-content';
    
    // Add scrollbar styling
    resultsContent.style.maxHeight = '60vh';
    resultsContent.style.overflowY = 'auto';
    resultsContent.style.overflowX = 'hidden';
    resultsContent.style.scrollbarWidth = 'thin';
    resultsContent.style.scrollbarColor = '#888 #f1f1f1';
    
    // Summary section
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'formal-planning-summary';
    
    const summaryItems = [
      { icon: '📊', label: 'Phase', value: result.phase || 'formal' },
      { icon: result.success ? '✅' : '❌', label: 'Status', value: result.success ? 'Success' : 'Failed' },
      { icon: '⏱️', label: 'Processing Time', value: `${result.processingTime || 0}ms` }
    ];
    
    summaryItems.forEach(item => {
      const stat = document.createElement('span');
      stat.className = 'stat';
      stat.textContent = `${item.icon} ${item.label}: ${item.value}`;
      summaryDiv.appendChild(stat);
    });
    
    resultsContent.appendChild(summaryDiv);
    
    // Add complete plan JSON display
    if (result.success && result.plan) {
      const planJsonDiv = document.createElement('div');
      planJsonDiv.className = 'formal-plan-json';
      planJsonDiv.style.marginBottom = '20px';
      
      const planJsonTitle = document.createElement('h4');
      planJsonTitle.textContent = '🗺️ Complete Formal Plan (JSON)';
      planJsonTitle.style.marginBottom = '8px';
      planJsonDiv.appendChild(planJsonTitle);
      
      const planJsonPre = document.createElement('pre');
      planJsonPre.style.backgroundColor = '#f8f9fa';
      planJsonPre.style.border = '1px solid #e9ecef';
      planJsonPre.style.borderRadius = '4px';
      planJsonPre.style.padding = '12px';
      planJsonPre.style.overflow = 'auto';
      planJsonPre.style.fontSize = '12px';
      planJsonPre.style.maxHeight = '400px';
      planJsonPre.textContent = JSON.stringify(result.plan, null, 2);
      planJsonDiv.appendChild(planJsonPre);
      
      resultsContent.appendChild(planJsonDiv);
    }

    // Results details
    if (result.success && result.formal) {
      this.renderFormalDetails(resultsContent, result.formal);
    } else if (result.success) {
      this.renderFormalDetails(resultsContent, result);
    } else if (!result.success) {
      this.renderFailureDetails(resultsContent, result);
    }
    
    // Add results content to main container
    mainResultsContainer.appendChild(resultsContent);
    this.container.appendChild(mainResultsContainer);
  }
  
  renderFormalDetails(container, formal) {
    // Behavior trees section
    const behaviorTreesContainer = document.createElement('div');
    const behaviorTreesCollapsible = new CollapsibleSectionComponent(behaviorTreesContainer, {
      title: 'Behavior Trees',
      icon: '🌳',
      defaultExpanded: true
    });
    
    const behaviorTreesContent = document.createElement('div');
    behaviorTreesContent.className = 'behavior-trees-content';
    
    if (formal.behaviorTrees && Array.isArray(formal.behaviorTrees) && formal.behaviorTrees.length > 0) {
      const treeCount = document.createElement('p');
      treeCount.textContent = `Generated ${formal.behaviorTrees.length} behavior tree(s)`;
      treeCount.style.marginBottom = '16px';
      behaviorTreesContent.appendChild(treeCount);
      
      // Display each behavior tree
      formal.behaviorTrees.forEach((tree, index) => {
        const treeDiv = document.createElement('div');
        treeDiv.className = 'behavior-tree';
        treeDiv.style.marginBottom = '16px';
        treeDiv.style.padding = '12px';
        treeDiv.style.border = '1px solid #ddd';
        treeDiv.style.borderRadius = '6px';
        treeDiv.style.backgroundColor = '#f9f9f9';
        
        const treeTitle = document.createElement('h4');
        treeTitle.textContent = `Behavior Tree ${index + 1}`;
        treeTitle.style.marginBottom = '8px';
        treeDiv.appendChild(treeTitle);
        
        const treePre = document.createElement('pre');
        treePre.style.backgroundColor = 'white';
        treePre.style.padding = '8px';
        treePre.style.borderRadius = '4px';
        treePre.style.overflow = 'auto';
        treePre.style.fontSize = '12px';
        treePre.textContent = JSON.stringify(tree, null, 2);
        treeDiv.appendChild(treePre);
        
        behaviorTreesContent.appendChild(treeDiv);
      });
    } else {
      const noTrees = document.createElement('p');
      noTrees.textContent = 'No behavior trees generated';
      noTrees.style.color = '#666';
      behaviorTreesContent.appendChild(noTrees);
    }
    
    behaviorTreesCollapsible.setContent(behaviorTreesContent);
    container.appendChild(behaviorTreesContainer);
    
    // Status information
    const statusDiv = document.createElement('div');
    statusDiv.className = 'formal-status';
    statusDiv.style.marginTop = '16px';
    statusDiv.style.padding = '12px';
    statusDiv.style.backgroundColor = '#e8f5e8';
    statusDiv.style.borderRadius = '6px';
    statusDiv.style.border = '1px solid #c3e6c3';
    
    const statusTitle = document.createElement('h4');
    statusTitle.textContent = 'Planning Status';
    statusTitle.style.marginBottom = '8px';
    statusDiv.appendChild(statusTitle);
    
    const statusText = document.createElement('p');
    statusText.textContent = `Status: ${formal.status || 'completed'}`;
    if (formal.count !== undefined) {
      statusText.textContent += ` | Trees Generated: ${formal.count}`;
    }
    statusDiv.appendChild(statusText);
    
    container.appendChild(statusDiv);
  }
  
  renderFailureDetails(container, result) {
    const failureDiv = document.createElement('div');
    failureDiv.className = 'formal-failure';
    failureDiv.style.marginTop = '16px';
    failureDiv.style.padding = '12px';
    failureDiv.style.backgroundColor = '#ffe8e8';
    failureDiv.style.borderRadius = '6px';
    failureDiv.style.border = '1px solid #ffbaba';
    
    const failureTitle = document.createElement('h4');
    failureTitle.textContent = 'Planning Failed';
    failureTitle.style.marginBottom = '8px';
    failureTitle.style.color = '#cc0000';
    failureDiv.appendChild(failureTitle);
    
    const reasonText = document.createElement('p');
    reasonText.textContent = `Reason: ${result.reason || 'Unknown error occurred during formal planning'}`;
    reasonText.style.color = '#cc0000';
    failureDiv.appendChild(reasonText);
    
    if (result.errors && result.errors.length > 0) {
      const errorsList = document.createElement('ul');
      errorsList.style.color = '#cc0000';
      result.errors.forEach(error => {
        const errorItem = document.createElement('li');
        errorItem.textContent = error;
        errorsList.appendChild(errorItem);
      });
      failureDiv.appendChild(errorsList);
    }
    
    container.appendChild(failureDiv);
  }
}