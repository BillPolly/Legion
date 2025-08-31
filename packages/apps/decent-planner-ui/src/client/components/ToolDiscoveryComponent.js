/**
 * ToolDiscoveryComponent - MVVM Implementation for tool discovery results
 * Properly maintains element references and state
 */

import { ThinkingComponent } from './ThinkingComponent.js';
import { ToolsListComponent } from './ToolsListComponent.js';
import { CollapsibleSectionComponent } from './CollapsibleSectionComponent.js';
import { PlanOverviewComponent } from './PlanOverviewComponent.js';

export class ToolDiscoveryComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      discoveryResult: null,
      isDiscovering: false,
      error: null,
      expandedTasks: new Set(),
      thinkingSteps: []
    };
    
    // View
    this.elements = {};
    
    // Create a separate container for thinking component
    this.thinkingContainer = document.createElement('div');
    this.thinkingContainer.className = 'thinking-container';
    
    // Create thinking component for showing progress
    this.thinkingComponent = new ThinkingComponent(this.thinkingContainer, {
      title: 'Tool Discovery Progress',
      showProgress: true
    });
    
    this.render();
  }
  
  setDiscovering(isDiscovering) {
    this.model.isDiscovering = isDiscovering;
    if (isDiscovering) {
      this.thinkingComponent.start('🔧 Tool Discovery');
    }
    this.render();
  }
  
  addThinkingStep(message, type = 'info') {
    this.thinkingComponent.addStep(message, type);
  }
  
  setResult(result) {
    this.model.discoveryResult = result;
    this.model.isDiscovering = false;
    this.model.error = null;
    
    // Complete thinking component
    const stats = result.statistics || {};
    const finalMessage = `✅ Discovery completed: ${stats.feasibleTasks || 0}/${stats.totalSimpleTasks || 0} tasks feasible, ${stats.uniqueToolsCount || 0} tools found`;
    this.thinkingComponent.complete(finalMessage);
    
    this.render();
  }
  
  setError(error) {
    this.model.error = error;
    this.model.isDiscovering = false;
    this.render();
  }
  
  render() {
    // Clear the container first
    this.container.innerHTML = '';
    
    // Add thinking component first
    this.container.appendChild(this.thinkingContainer);
    
    // Then add results if available
    if (!this.model.isDiscovering && this.model.discoveryResult) {
      this.renderResults();
    } else if (!this.model.isDiscovering && this.model.error) {
      this.renderError();
    } else if (!this.model.isDiscovering && !this.model.discoveryResult && !this.model.error) {
      this.renderEmpty();
    }
  }
  
  renderEmpty() {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'tool-discovery-empty';
    const p = document.createElement('p');
    p.textContent = 'Tool discovery will start automatically when you switch to this tab.';
    emptyDiv.appendChild(p);
    this.container.appendChild(emptyDiv);
  }
  
  
  renderError() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'tool-discovery-error';
    const h3 = document.createElement('h3');
    h3.textContent = '❌ Error';
    errorDiv.appendChild(h3);
    
    const p = document.createElement('p');
    p.textContent = this.model.error;
    errorDiv.appendChild(p);
    this.container.appendChild(errorDiv);
  }
  
  renderResults() {
    const result = this.model.discoveryResult;
    if (!result) return;
    
    const stats = result.statistics?.toolDiscovery || {};
    const toolDiscovery = result.statistics?.toolDiscovery?.taskResults || [];
    
    // Check if results already exist - remove old results first
    const existingResults = this.container.querySelector('.tool-discovery-results');
    if (existingResults) {
      existingResults.remove();
    }
    
    // Create main results container (no collapsible wrapper at this level)
    const mainResultsContainer = document.createElement('div');
    mainResultsContainer.className = 'tool-discovery-results';
    
    // Title section
    const titleSection = document.createElement('div');
    titleSection.className = 'tool-discovery-title';
    const titleH3 = document.createElement('h3');
    titleH3.textContent = '🔧 Tool Discovery Results';
    titleH3.style.marginBottom = '16px';
    titleSection.appendChild(titleH3);
    mainResultsContainer.appendChild(titleSection);
    
    // Create the actual results content
    const resultsContent = document.createElement('div');
    resultsContent.className = 'tool-discovery-results-content';
    
    // Header section (now inside collapsible content)
    const header = document.createElement('div');
    header.className = 'tool-discovery-header';
    
    // Stats section
    const statsDiv = document.createElement('div');
    statsDiv.className = 'tool-discovery-stats';
    
    const statItems = [
      { icon: '📊', value: stats.totalTasks || 0, label: 'SIMPLE tasks' },
      { icon: '✅', value: stats.feasibleTasks || 0, label: 'feasible' },
      { icon: '❌', value: stats.infeasibleTasks || 0, label: 'infeasible' },
      { icon: '🔧', value: stats.totalTools || 0, label: 'tools found' },
      { icon: '⏱️', value: result.processingTime || 0, label: 'ms' }
    ];
    
    statItems.forEach(item => {
      const stat = document.createElement('span');
      stat.className = 'stat';
      stat.textContent = `${item.icon} ${item.value} ${item.label}`;
      statsDiv.appendChild(stat);
    });
    
    header.appendChild(statsDiv);
    
    // Add found tools section using ToolsListComponent 
    const rootTaskTools = result.rootTask?.tools || [];
    if (rootTaskTools.length > 0) {
      const toolsContainer = document.createElement('div');
      const toolsListComponent = new ToolsListComponent(toolsContainer, { 
        showConfidence: true,
        collapsible: true,
        defaultExpanded: true,
        columns: 4
      });
      
      // Use tools directly from rootTask
      let allMergedTools = rootTaskTools;
      
      // Remove duplicates by tool name, keeping highest confidence
      const uniqueToolsMap = new Map();
      allMergedTools.forEach(tool => {
        if (!uniqueToolsMap.has(tool.name) || uniqueToolsMap.get(tool.name).confidence < tool.confidence) {
          uniqueToolsMap.set(tool.name, tool);
        }
      });
      
      const uniqueToolsWithConfidence = Array.from(uniqueToolsMap.values());
      
      if (uniqueToolsWithConfidence.length > 0) {
        toolsListComponent.setTools(uniqueToolsWithConfidence, `All Tools Found (${uniqueToolsWithConfidence.length})`);
      } else {
        // Fallback to unique tools list without confidence
        const toolsWithoutConfidence = stats.uniqueTools.map(name => ({ name }));
        toolsListComponent.setTools(toolsWithoutConfidence, `All Tools Found (${toolsWithoutConfidence.length})`);
      }
      
      header.appendChild(toolsContainer);
    }
    
    resultsContent.appendChild(header);
    
    // Plan Overview section
    const planOverviewContainer = document.createElement('div');
    const planOverview = new PlanOverviewComponent(planOverviewContainer, { 
      showConfidence: true 
    });
    planOverview.setPlanData(result.rootTask, toolDiscovery);
    resultsContent.appendChild(planOverviewContainer);
    
    // Tasks section with collapsible wrapper
    const tasksContainer = document.createElement('div');
    const tasksCollapsible = new CollapsibleSectionComponent(tasksContainer, {
      title: 'Task Analysis Results',
      icon: '📋',
      defaultExpanded: false  // Default collapsed since we have plan overview
    });
    
    // Create tasks content
    const tasksContent = document.createElement('div');
    tasksContent.className = 'tool-discovery-tasks-content';
    
    // Add JSON plan display
    const jsonPlanDiv = document.createElement('div');
    jsonPlanDiv.className = 'json-plan-display';
    jsonPlanDiv.style.marginBottom = '20px';
    
    const jsonTitle = document.createElement('h4');
    jsonTitle.textContent = '📋 Plan Structure with Tools (JSON)';
    jsonTitle.style.marginBottom = '8px';
    jsonPlanDiv.appendChild(jsonTitle);
    
    const jsonPre = document.createElement('pre');
    jsonPre.style.backgroundColor = '#f8f9fa';
    jsonPre.style.border = '1px solid #e9ecef';
    jsonPre.style.borderRadius = '4px';
    jsonPre.style.padding = '12px';
    jsonPre.style.overflow = 'auto';
    jsonPre.style.fontSize = '12px';
    jsonPre.style.maxHeight = '400px';
    jsonPre.textContent = JSON.stringify(result, null, 2);
    jsonPlanDiv.appendChild(jsonPre);
    
    tasksContent.appendChild(jsonPlanDiv);

    // Add task items
    toolDiscovery.forEach((item, index) => {
      const taskElement = this.renderTaskItem(item, index);
      tasksContent.appendChild(taskElement);
    });
    
    // Set the content in the collapsible section
    tasksCollapsible.setContent(tasksContent);
    
    resultsContent.appendChild(tasksContainer);
    
    // Add results content to main container
    mainResultsContainer.appendChild(resultsContent);
    
    this.container.appendChild(mainResultsContainer);
    
    // Attach event listeners for expand/collapse
    this.attachTaskEventListeners();
  }
  
  renderTaskItem(item, index) {
    const isExpanded = this.model.expandedTasks.has(index);
    const feasible = item.feasible;
    
    const taskItem = document.createElement('div');
    taskItem.className = `task-item ${feasible ? 'feasible' : 'infeasible'}`;
    
    // Task header
    const header = document.createElement('div');
    header.className = 'task-header';
    header.dataset.taskIndex = index;
    
    const expandIcon = document.createElement('span');
    expandIcon.className = 'task-expand-icon';
    expandIcon.textContent = isExpanded ? '▼' : '▶️';
    
    const description = document.createElement('span');
    description.className = 'task-description';
    description.textContent = item.description;
    
    const status = document.createElement('span');
    status.className = 'task-status';
    status.textContent = feasible ? '✅ Feasible' : '❌ Infeasible';
    
    header.appendChild(expandIcon);
    header.appendChild(description);
    header.appendChild(status);
    taskItem.appendChild(header);
    
    // Task details (if expanded)
    if (isExpanded) {
      const details = document.createElement('div');
      details.className = 'task-details';
      const debugInfo = this.renderTaskDebugInfo(item.debug);
      details.appendChild(debugInfo);
      taskItem.appendChild(details);
    }
    
    return taskItem;
  }
  
  renderTaskDebugInfo(debug) {
    if (!debug) {
      const noDebug = document.createElement('p');
      noDebug.textContent = 'No debug information available';
      return noDebug;
    }
    
    const debugContainer = document.createElement('div');
    debugContainer.className = 'debug-info';
    
    // Step 1: Tool Descriptions
    const step1 = this.createDebugStep('Step 1: Generated Tool Descriptions');
    const descList = document.createElement('ul');
    descList.className = 'tool-descriptions';
    (debug.step1_descriptions || []).forEach(desc => {
      const li = document.createElement('li');
      li.textContent = desc;
      descList.appendChild(li);
    });
    step1.appendChild(descList);
    debugContainer.appendChild(step1);
    
    // Step 2: Search Results (Detailed)
    const step2 = this.createDebugStep('Step 2: Tool Search Results (Detailed)');
    (debug.step2_discoveries || []).forEach(discovery => {
      const searchResult = this.createSearchResultElement(discovery);
      step2.appendChild(searchResult);
    });
    debugContainer.appendChild(step2);
    
    // Step 3: Final Tools
    const step3 = this.createDebugStep('Step 3: Final Tools');
    if (debug.step3_merged && Array.isArray(debug.step3_merged) && debug.step3_merged.length > 0) {
      const finalList = document.createElement('ul');
      finalList.className = 'final-tools';
      debug.step3_merged.forEach(tool => {
        const li = document.createElement('li');
        li.textContent = `${tool.name} (confidence: ${(tool.confidence * 100).toFixed(1)}%)`;
        finalList.appendChild(li);
      });
      step3.appendChild(finalList);
    } else {
      const noTools = document.createElement('p');
      noTools.textContent = debug.step3_merged ? `Tools found: ${JSON.stringify(debug.step3_merged)}` : 'No tools found';
      step3.appendChild(noTools);
    }
    debugContainer.appendChild(step3);
    
    // Debug Reason
    const reason = document.createElement('div');
    reason.className = 'debug-reason';
    const reasonStrong = document.createElement('strong');
    reasonStrong.textContent = 'Reason: ';
    reason.appendChild(reasonStrong);
    const reasonText = document.createTextNode(debug.final_feasible ? 
      `Found ${debug.step3_merged?.length || 0} suitable tools` : 
      'No suitable tools found through semantic search');
    reason.appendChild(reasonText);
    debugContainer.appendChild(reason);
    
    return debugContainer;
  }
  
  createDebugStep(title) {
    const step = document.createElement('div');
    step.className = 'debug-step';
    const heading = document.createElement('h5');
    heading.textContent = title;
    step.appendChild(heading);
    return step;
  }
  
  createSearchResultElement(discovery) {
    const searchResult = document.createElement('div');
    searchResult.className = 'search-result';
    
    // Search header
    const header = document.createElement('div');
    header.className = 'search-header';
    
    const desc = document.createElement('span');
    desc.className = 'search-desc';
    desc.textContent = `"${discovery.description}"`;
    header.appendChild(desc);
    
    const count = document.createElement('span');
    count.className = 'search-count';
    count.textContent = `→ ${discovery.toolsFound} tools found${discovery.toolsFiltered ? `, ${discovery.toolsFiltered} after filtering` : ''}`;
    header.appendChild(count);
    
    searchResult.appendChild(header);
    
    // Tools found details
    if (discovery.tools && discovery.tools.length > 0) {
      const toolsFound = document.createElement('div');
      toolsFound.className = 'tools-found';
      
      const label = document.createElement('strong');
      label.textContent = 'Tools Found:';
      toolsFound.appendChild(label);
      
      const toolsList = document.createElement('ul');
      discovery.tools.forEach(tool => {
        const li = document.createElement('li');
        li.textContent = `${tool.name} (${(tool.confidence * 100).toFixed(1)}% confidence)`;
        if (tool.filtered) {
          li.textContent += ' - FILTERED OUT';
          li.style.textDecoration = 'line-through';
          li.style.color = '#999';
        }
        toolsList.appendChild(li);
      });
      toolsFound.appendChild(toolsList);
      
      const thresholdInfo = document.createElement('div');
      thresholdInfo.className = 'threshold-info';
      thresholdInfo.textContent = `Confidence threshold: ${discovery.threshold * 100}%`;
      toolsFound.appendChild(thresholdInfo);
      
      searchResult.appendChild(toolsFound);
    } else {
      const noTools = document.createElement('div');
      noTools.className = 'no-tools';
      noTools.textContent = 'No tools found for this search';
      searchResult.appendChild(noTools);
    }
    
    return searchResult;
  }
  
  attachTaskEventListeners() {
    const headers = this.container.querySelectorAll('.task-header');
    headers.forEach(header => {
      header.addEventListener('click', (e) => {
        const index = parseInt(header.dataset.taskIndex);
        if (this.model.expandedTasks.has(index)) {
          this.model.expandedTasks.delete(index);
        } else {
          this.model.expandedTasks.add(index);
        }
        this.render();
      });
    });
  }
}