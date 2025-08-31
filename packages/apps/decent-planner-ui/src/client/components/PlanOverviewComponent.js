/**
 * PlanOverviewComponent - MVVM Component for displaying the complete plan hierarchy with tools
 * Shows the whole plan structure with each task and its assigned tools
 */

import { ToolsListComponent } from './ToolsListComponent.js';
import { CollapsibleSectionComponent } from './CollapsibleSectionComponent.js';

export class PlanOverviewComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showConfidence: options.showConfidence !== false,
      ...options
    };
    
    // Model
    this.model = {
      hierarchy: null,
      toolDiscovery: []
    };
    
    // View elements
    this.elements = {};
    
    this.render();
  }
  
  setPlanData(hierarchy, toolDiscovery = []) {
    this.model.hierarchy = hierarchy;
    this.model.toolDiscovery = toolDiscovery;
    this.render();
  }
  
  clear() {
    this.model.hierarchy = null;
    this.model.toolDiscovery = [];
    this.render();
  }
  
  render() {
    // Clear container
    this.container.innerHTML = '';
    
    if (!this.model.hierarchy) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'plan-overview-empty';
      emptyDiv.innerHTML = '<p>No plan data available</p>';
      this.container.appendChild(emptyDiv);
      return;
    }
    
    // Create main container with collapsible wrapper
    const planContainer = document.createElement('div');
    const planCollapsible = new CollapsibleSectionComponent(planContainer, {
      title: 'Complete Plan Overview',
      icon: '🗺️',
      defaultExpanded: true
    });
    
    // Create plan content
    const planContent = document.createElement('div');
    planContent.className = 'plan-overview-content';
    
    // Render the hierarchy
    this.renderHierarchyNode(this.model.hierarchy, planContent, 0);
    
    // Set content in collapsible
    planCollapsible.setContent(planContent);
    this.container.appendChild(planContainer);
  }
  
  renderHierarchyNode(node, container, depth) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = `plan-node plan-node-depth-${depth}`;
    nodeDiv.style.marginLeft = `${depth * 20}px`;
    nodeDiv.style.marginBottom = '12px';
    nodeDiv.style.padding = '12px';
    nodeDiv.style.border = '1px solid #ddd';
    nodeDiv.style.borderRadius = '6px';
    nodeDiv.style.backgroundColor = depth === 0 ? '#f9f9f9' : '#ffffff';
    
    // Node header
    const header = document.createElement('div');
    header.className = 'plan-node-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '12px';
    header.style.marginBottom = '8px';
    
    // Complexity indicator
    const complexityBadge = document.createElement('span');
    complexityBadge.className = `complexity-badge ${node.complexity?.toLowerCase() || 'simple'}`;
    complexityBadge.textContent = node.complexity || 'SIMPLE';
    complexityBadge.style.padding = '2px 6px';
    complexityBadge.style.borderRadius = '3px';
    complexityBadge.style.fontSize = '0.8em';
    complexityBadge.style.fontWeight = 'bold';
    complexityBadge.style.backgroundColor = node.complexity === 'COMPLEX' ? '#ffebcd' : '#e6f3ff';
    complexityBadge.style.color = node.complexity === 'COMPLEX' ? '#8b4513' : '#0066cc';
    
    // Task description
    const description = document.createElement('span');
    description.className = 'plan-node-description';
    description.textContent = node.description || 'Unnamed task';
    description.style.flex = '1';
    description.style.fontSize = '1em';
    description.style.fontWeight = depth === 0 ? 'bold' : 'normal';
    
    // Feasibility status
    const feasible = node.feasible !== false; // Default to true if not specified
    const statusBadge = document.createElement('span');
    statusBadge.className = `feasibility-badge ${feasible ? 'feasible' : 'infeasible'}`;
    statusBadge.textContent = feasible ? '✅ Feasible' : '❌ Infeasible';
    statusBadge.style.padding = '2px 6px';
    statusBadge.style.borderRadius = '3px';
    statusBadge.style.fontSize = '0.8em';
    statusBadge.style.fontWeight = 'bold';
    statusBadge.style.backgroundColor = feasible ? '#e6f7e6' : '#ffe6e6';
    statusBadge.style.color = feasible ? '#006600' : '#cc0000';
    
    header.appendChild(complexityBadge);
    header.appendChild(description);
    header.appendChild(statusBadge);
    nodeDiv.appendChild(header);
    
    // Tools for this task
    const nodeTools = this.getToolsForNode(node);
    if (nodeTools && nodeTools.length > 0) {
      const toolsContainer = document.createElement('div');
      toolsContainer.className = 'plan-node-tools';
      toolsContainer.style.marginTop = '8px';
      
      const toolsComponent = new ToolsListComponent(toolsContainer, { 
        showConfidence: this.options.showConfidence,
        collapsible: true,
        defaultExpanded: true,
        columns: 2
      });
      toolsComponent.setTools(nodeTools, `Tools (${nodeTools.length})`);
      
      nodeDiv.appendChild(toolsContainer);
    }
    
    // Render subtasks if any
    if (node.subtasks && node.subtasks.length > 0) {
      const subtasksDiv = document.createElement('div');
      subtasksDiv.className = 'plan-node-subtasks';
      
      node.subtasks.forEach(subtask => {
        this.renderHierarchyNode(subtask, subtasksDiv, depth + 1);
      });
      
      nodeDiv.appendChild(subtasksDiv);
    }
    
    container.appendChild(nodeDiv);
  }
  
  getToolsForNode(node) {
    // Simply return the tools that should now be directly on the node
    // (since we fixed DecentPlanner to add discovered tools to task nodes)
    const tools = node.tools || [];
    
    console.log(`[PlanOverview] Getting tools for "${node.description}": found ${tools.length} tools`);
    
    return tools;
  }
}