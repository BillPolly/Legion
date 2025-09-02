/**
 * LLMDebugComponent - Real-time LLM interaction debugging
 * 
 * Shows all LLM prompt/response pairs from the tool agent:
 * - Categorized by interaction purpose (tool-need-analysis, tool-selection, etc.)
 * - Syntax highlighted prompts and responses
 * - Timing and success/error status
 * - Collapsible sections for detailed inspection
 * 
 * Updates in real-time as the agent makes LLM calls.
 */

import { CollapsibleSectionComponent } from './CollapsibleSectionComponent.js';

export class LLMDebugComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      interactions: [],
      interactionsByPurpose: {},
      statistics: {
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        averageResponseTime: 0,
        lastInteraction: null
      }
    };
    
    // View elements
    this.elements = {};
    
    this.createView();
  }

  /**
   * Create the LLM debug view
   */
  createView() {
    this.container.innerHTML = '';
    
    // Main container
    const mainDiv = document.createElement('div');
    mainDiv.className = 'llm-debug-container';
    
    // Header with statistics
    const headerDiv = document.createElement('div');
    headerDiv.className = 'llm-debug-header';
    
    const titleH3 = document.createElement('h3');
    titleH3.textContent = '🧠 LLM Interactions';
    titleH3.style.margin = '0 0 8px 0';
    titleH3.style.fontSize = '16px';
    
    this.elements.statsDiv = document.createElement('div');
    this.elements.statsDiv.className = 'llm-debug-stats';
    this.elements.statsDiv.style.fontSize = '12px';
    this.elements.statsDiv.style.color = '#666';
    this.elements.statsDiv.textContent = '0 interactions';
    
    headerDiv.appendChild(titleH3);
    headerDiv.appendChild(this.elements.statsDiv);
    
    // Clear button
    this.elements.clearButton = document.createElement('button');
    this.elements.clearButton.className = 'llm-debug-clear-button';
    this.elements.clearButton.textContent = '🗑️ Clear History';
    this.elements.clearButton.style.marginLeft = '16px';
    this.elements.clearButton.style.padding = '4px 8px';
    this.elements.clearButton.style.fontSize = '11px';
    this.elements.clearButton.style.backgroundColor = '#6b7280';
    this.elements.clearButton.style.color = 'white';
    this.elements.clearButton.style.border = 'none';
    this.elements.clearButton.style.borderRadius = '3px';
    this.elements.clearButton.style.cursor = 'pointer';
    this.elements.clearButton.onclick = () => this.clearHistory();
    
    headerDiv.appendChild(this.elements.clearButton);
    
    // Interactions list container
    this.elements.interactionsList = document.createElement('div');
    this.elements.interactionsList.className = 'llm-interactions-list';
    this.elements.interactionsList.style.maxHeight = 'calc(100vh - 200px)';
    this.elements.interactionsList.style.overflowY = 'auto';
    this.elements.interactionsList.style.marginTop = '16px';
    
    // Assemble view
    mainDiv.appendChild(headerDiv);
    mainDiv.appendChild(this.elements.interactionsList);
    
    this.container.appendChild(mainDiv);
    
    this.renderInteractions();
    this.updateStats();
  }

  /**
   * Add new LLM interaction
   */
  addInteraction(interaction) {
    this.model.interactions.push(interaction);
    
    // Group by purpose
    const purpose = interaction.purpose || 'unknown';
    if (!this.model.interactionsByPurpose[purpose]) {
      this.model.interactionsByPurpose[purpose] = [];
    }
    this.model.interactionsByPurpose[purpose].push(interaction);
    
    this.renderInteractions();
    this.updateStats();
    
    // Auto-scroll to latest interaction
    setTimeout(() => {
      this.elements.interactionsList.scrollTop = this.elements.interactionsList.scrollHeight;
    }, 100);
  }

  /**
   * Render all interactions grouped by purpose
   */
  renderInteractions() {
    this.elements.interactionsList.innerHTML = '';
    
    const purposes = Object.keys(this.model.interactionsByPurpose);
    
    if (purposes.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.color = '#999';
      emptyDiv.style.fontStyle = 'italic';
      emptyDiv.style.textAlign = 'center';
      emptyDiv.style.padding = '20px';
      emptyDiv.textContent = 'No LLM interactions yet';
      this.elements.interactionsList.appendChild(emptyDiv);
      return;
    }
    
    // Render each purpose group
    purposes.forEach(purpose => {
      const interactions = this.model.interactionsByPurpose[purpose];
      const container = document.createElement('div');
      container.className = 'llm-purpose-group';
      container.style.marginBottom = '16px';
      
      // Create collapsible section for this purpose
      const collapsible = new CollapsibleSectionComponent(container, {
        title: `${this.getPurposeDisplayName(purpose)} (${interactions.length})`,
        icon: this.getPurposeIcon(purpose),
        defaultExpanded: interactions.length <= 2 // Expand if few interactions
      });
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'llm-purpose-content';
      
      // Render interactions in this purpose group
      interactions.forEach((interaction, index) => {
        if (interaction.type === 'response' || interaction.type === 'error') {
          const interactionDiv = this.createInteractionElement(interaction, index);
          contentDiv.appendChild(interactionDiv);
        }
      });
      
      collapsible.setContent(contentDiv);
      this.elements.interactionsList.appendChild(container);
    });
  }

  /**
   * Create element for single LLM interaction
   */
  createInteractionElement(interaction, index) {
    const interactionDiv = document.createElement('div');
    interactionDiv.className = 'llm-interaction';
    interactionDiv.style.marginBottom = '12px';
    interactionDiv.style.border = '1px solid #e5e7eb';
    interactionDiv.style.borderRadius = '6px';
    interactionDiv.style.backgroundColor = interaction.type === 'error' ? '#fef2f2' : '#f9fafb';
    
    // Interaction header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'llm-interaction-header';
    headerDiv.style.padding = '8px 12px';
    headerDiv.style.borderBottom = '1px solid #e5e7eb';
    headerDiv.style.backgroundColor = interaction.type === 'error' ? '#fee2e2' : '#f3f4f6';
    headerDiv.style.fontSize = '12px';
    headerDiv.style.fontWeight = 'bold';
    
    const timestamp = new Date(interaction.timestamp).toLocaleTimeString();
    const status = interaction.type === 'error' ? '❌ Error' : '✅ Success';
    headerDiv.textContent = `${index + 1}. ${timestamp} - ${status}`;
    
    if (interaction.id) {
      const idSpan = document.createElement('span');
      idSpan.style.float = 'right';
      idSpan.style.fontSize = '10px';
      idSpan.style.color = '#6b7280';
      idSpan.textContent = interaction.id;
      headerDiv.appendChild(idSpan);
    }
    
    interactionDiv.appendChild(headerDiv);
    
    // Prompt section
    if (interaction.prompt) {
      const promptSection = document.createElement('div');
      promptSection.className = 'llm-prompt-section';
      promptSection.style.padding = '8px 12px';
      
      const promptTitle = document.createElement('div');
      promptTitle.style.fontSize = '11px';
      promptTitle.style.fontWeight = 'bold';
      promptTitle.style.color = '#4b5563';
      promptTitle.style.marginBottom = '4px';
      promptTitle.textContent = '📝 Prompt:';
      
      const promptContent = document.createElement('pre');
      promptContent.style.fontSize = '10px';
      promptContent.style.fontFamily = 'monospace';
      promptContent.style.backgroundColor = 'white';
      promptContent.style.border = '1px solid #d1d5db';
      promptContent.style.borderRadius = '3px';
      promptContent.style.padding = '6px';
      promptContent.style.margin = '0';
      promptContent.style.maxHeight = '150px';
      promptContent.style.overflow = 'auto';
      promptContent.style.whiteSpace = 'pre-wrap';
      promptContent.textContent = interaction.prompt;
      
      promptSection.appendChild(promptTitle);
      promptSection.appendChild(promptContent);
      interactionDiv.appendChild(promptSection);
    }
    
    // Response section
    if (interaction.response) {
      const responseSection = document.createElement('div');
      responseSection.className = 'llm-response-section';
      responseSection.style.padding = '8px 12px';
      
      const responseTitle = document.createElement('div');
      responseTitle.style.fontSize = '11px';
      responseTitle.style.fontWeight = 'bold';
      responseTitle.style.color = '#4b5563';
      responseTitle.style.marginBottom = '4px';
      responseTitle.textContent = '💬 Response:';
      
      const responseContent = document.createElement('pre');
      responseContent.style.fontSize = '10px';
      responseContent.style.fontFamily = 'monospace';
      responseContent.style.backgroundColor = '#f0f9ff';
      responseContent.style.border = '1px solid #bfdbfe';
      responseContent.style.borderRadius = '3px';
      responseContent.style.padding = '6px';
      responseContent.style.margin = '0';
      responseContent.style.maxHeight = '200px';
      responseContent.style.overflow = 'auto';
      responseContent.style.whiteSpace = 'pre-wrap';
      responseContent.textContent = interaction.response;
      
      responseSection.appendChild(responseTitle);
      responseSection.appendChild(responseContent);
      interactionDiv.appendChild(responseSection);
    }
    
    // Error section
    if (interaction.error) {
      const errorSection = document.createElement('div');
      errorSection.className = 'llm-error-section';
      errorSection.style.padding = '8px 12px';
      errorSection.style.backgroundColor = '#fef2f2';
      
      const errorTitle = document.createElement('div');
      errorTitle.style.fontSize = '11px';
      errorTitle.style.fontWeight = 'bold';
      errorTitle.style.color = '#dc2626';
      errorTitle.style.marginBottom = '4px';
      errorTitle.textContent = '❌ Error:';
      
      const errorContent = document.createElement('div');
      errorContent.style.fontSize = '11px';
      errorContent.style.color = '#dc2626';
      errorContent.textContent = interaction.error;
      
      errorSection.appendChild(errorTitle);
      errorSection.appendChild(errorContent);
      interactionDiv.appendChild(errorSection);
    }
    
    return interactionDiv;
  }

  /**
   * Get display name for interaction purpose
   */
  getPurposeDisplayName(purpose) {
    const names = {
      'tool-need-analysis': 'Tool Need Analysis',
      'tool-sequence-planning': 'Tool Sequence Planning', 
      'tool-selection': 'Tool Selection',
      'completion-decision': 'Completion Decision',
      'error-retry-analysis': 'Error Retry Analysis',
      'user-response-generation': 'Response Generation',
      'context-analysis': 'Context Analysis'
    };
    return names[purpose] || purpose.charAt(0).toUpperCase() + purpose.slice(1);
  }

  /**
   * Get icon for interaction purpose
   */
  getPurposeIcon(purpose) {
    const icons = {
      'tool-need-analysis': '🤔',
      'tool-sequence-planning': '🎯',
      'tool-selection': '🔧', 
      'completion-decision': '✅',
      'error-retry-analysis': '🔄',
      'user-response-generation': '💬',
      'context-analysis': '📊'
    };
    return icons[purpose] || '🧠';
  }

  /**
   * Update statistics display
   */
  updateStats() {
    const total = this.model.interactions.length;
    const successful = this.model.interactions.filter(i => i.type === 'response').length;
    const failed = this.model.interactions.filter(i => i.type === 'error').length;
    
    this.model.statistics.totalInteractions = total;
    this.model.statistics.successfulInteractions = successful;
    this.model.statistics.failedInteractions = failed;
    
    if (total > 0) {
      this.model.statistics.lastInteraction = new Date(this.model.interactions[total - 1].timestamp).toLocaleTimeString();
    }
    
    let statsText = `${total} interactions`;
    if (failed > 0) {
      statsText += ` (${failed} errors)`;
    }
    if (this.model.statistics.lastInteraction) {
      statsText += ` • Last: ${this.model.statistics.lastInteraction}`;
    }
    
    this.elements.statsDiv.textContent = statsText;
  }

  /**
   * Clear interaction history
   */
  clearHistory() {
    if (confirm('Clear all LLM interaction history?')) {
      this.model.interactions = [];
      this.model.interactionsByPurpose = {};
      this.model.statistics.lastInteraction = null;
      
      this.renderInteractions();
      this.updateStats();
    }
  }

  /**
   * Get interaction statistics for debugging
   */
  getStatistics() {
    return this.model.statistics;
  }

  /**
   * Get interactions by purpose for analysis
   */
  getInteractionsByPurpose() {
    return this.model.interactionsByPurpose;
  }

  /**
   * Search interactions by content
   */
  searchInteractions(query) {
    const queryLower = query.toLowerCase();
    return this.model.interactions.filter(interaction => {
      return (interaction.prompt && interaction.prompt.toLowerCase().includes(queryLower)) ||
             (interaction.response && interaction.response.toLowerCase().includes(queryLower)) ||
             (interaction.purpose && interaction.purpose.toLowerCase().includes(queryLower));
    });
  }

  /**
   * Export interactions for external analysis
   */
  exportInteractions() {
    return {
      timestamp: new Date().toISOString(),
      statistics: this.model.statistics,
      interactions: this.model.interactions,
      interactionsByPurpose: this.model.interactionsByPurpose
    };
  }

  /**
   * Import interactions from external source
   */
  importInteractions(data) {
    if (data.interactions && Array.isArray(data.interactions)) {
      this.model.interactions = data.interactions;
      
      // Rebuild purpose grouping
      this.model.interactionsByPurpose = {};
      data.interactions.forEach(interaction => {
        const purpose = interaction.purpose || 'unknown';
        if (!this.model.interactionsByPurpose[purpose]) {
          this.model.interactionsByPurpose[purpose] = [];
        }
        this.model.interactionsByPurpose[purpose].push(interaction);
      });
      
      this.renderInteractions();
      this.updateStats();
    }
  }

  /**
   * Highlight JSON in text content
   */
  highlightJSON(text) {
    // Simple JSON syntax highlighting
    return text
      .replace(/(".*?")/g, '<span style="color: #059669;">$1</span>')
      .replace(/(\b\d+\b)/g, '<span style="color: #dc2626;">$1</span>')
      .replace(/(\btrue\b|\bfalse\b|\bnull\b)/g, '<span style="color: #7c3aed;">$1</span>')
      .replace(/([{}[\]])/g, '<span style="color: #4b5563; font-weight: bold;">$1</span>');
  }

  /**
   * Format prompt for display with highlighting
   */
  formatPrompt(prompt) {
    // Add basic formatting for readability
    return prompt
      .replace(/## (.*)/g, '<strong style="color: #1f2937;">## $1</strong>')
      .replace(/### (.*)/g, '<strong style="color: #4b5563;">### $1</strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code style="background: #f3f4f6; padding: 1px 3px; border-radius: 2px;">$1</code>');
  }
}