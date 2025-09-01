/**
 * LLMDebugTabComponent - MVVM Component for LLM interaction debugging
 * Displays LLM interactions with expand/collapse functionality
 */

export class LLMDebugTabComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      interactions: [],
      expandedInteractions: new Set()
    };
    
    // View elements
    this.elements = {
      root: null,
      placeholderContainer: null,
      interactionsContainer: null,
      interactionElements: new Map()
    };
    
    this.createView();
    this.bindEvents();
  }
  
  // CREATE VIEW ONCE
  createView() {
    this.elements.root = document.createElement('div');
    this.elements.root.className = 'llm-debug-component';
    
    // Placeholder container (for empty state)
    this.elements.placeholderContainer = document.createElement('div');
    this.elements.placeholderContainer.className = 'llm-debug-placeholder';
    
    const title = document.createElement('h2');
    title.textContent = '🧠 LLM Debug';
    this.elements.placeholderContainer.appendChild(title);
    
    const description = document.createElement('p');
    description.textContent = 'No LLM interactions yet. Start planning to see prompts and responses.';
    this.elements.placeholderContainer.appendChild(description);
    
    this.elements.root.appendChild(this.elements.placeholderContainer);
    
    // Interactions container (for populated state)
    this.elements.interactionsContainer = document.createElement('div');
    this.elements.interactionsContainer.className = 'llm-debug-container';
    this.elements.interactionsContainer.style.display = 'none';
    
    const interactionsTitle = document.createElement('h2');
    interactionsTitle.className = 'interactions-title';
    this.elements.interactionsContainer.appendChild(interactionsTitle);
    
    const interactionsList = document.createElement('div');
    interactionsList.className = 'interactions-list';
    this.elements.interactionsContainer.appendChild(interactionsList);
    
    this.elements.root.appendChild(this.elements.interactionsContainer);
    
    // Add to container
    this.container.appendChild(this.elements.root);
  }
  
  // BIND EVENTS ONCE
  bindEvents() {
    // Use event delegation for interaction clicks
    this.elements.interactionsContainer.addEventListener('click', (e) => {
      const header = e.target.closest('.interaction-header');
      if (header) {
        const interactionId = header.dataset.interactionId;
        if (interactionId) {
          this.toggleInteraction(interactionId);
        }
      }
    });
  }
  
  // PUBLIC API - called by ClientPlannerActor
  setInteractions(interactions) {
    this.model.interactions = interactions || [];
    this.updateView();
  }
  
  addInteraction(interaction) {
    const existingIndex = this.model.interactions.findIndex(i => i.id === interaction.id);
    if (existingIndex >= 0) {
      this.model.interactions[existingIndex] = interaction;
    } else {
      this.model.interactions.push(interaction);
    }
    this.updateView();
  }
  
  // UPDATE METHODS - incremental updates
  updateView() {
    if (this.model.interactions.length === 0) {
      this.elements.placeholderContainer.style.display = 'block';
      this.elements.interactionsContainer.style.display = 'none';
      return;
    }
    
    this.elements.placeholderContainer.style.display = 'none';
    this.elements.interactionsContainer.style.display = 'block';
    
    // Update title
    const title = this.elements.interactionsContainer.querySelector('.interactions-title');
    title.textContent = `🧠 LLM Debug (${this.model.interactions.length} interactions)`;
    
    // Update interactions list
    this.updateInteractionsList();
  }
  
  updateInteractionsList() {
    const interactionsList = this.elements.interactionsContainer.querySelector('.interactions-list');
    interactionsList.innerHTML = '';
    this.elements.interactionElements.clear();
    
    this.model.interactions.forEach((interaction, index) => {
      const interactionElement = this.createInteractionElement(interaction, index);
      this.elements.interactionElements.set(interaction.id, interactionElement);
      interactionsList.appendChild(interactionElement);
    });
  }
  
  createInteractionElement(interaction, index) {
    const isExpanded = this.model.expandedInteractions.has(interaction.id);
    
    const interactionItem = document.createElement('div');
    interactionItem.className = `interaction-item ${isExpanded ? 'expanded' : 'collapsed'}`;
    interactionItem.dataset.interactionId = interaction.id;
    
    // Header
    const header = document.createElement('div');
    header.className = 'interaction-header';
    header.dataset.interactionId = interaction.id;
    
    const expandIcon = document.createElement('span');
    expandIcon.className = 'expand-icon';
    expandIcon.textContent = isExpanded ? '🔽' : '▶️';
    
    const interactionInfo = document.createElement('span');
    interactionInfo.className = 'interaction-info';
    
    const number = document.createElement('strong');
    number.textContent = `#${index + 1}`;
    interactionInfo.appendChild(number);
    
    interactionInfo.appendChild(document.createTextNode(' '));
    
    const modelInfo = document.createElement('span');
    modelInfo.className = 'model-info';
    modelInfo.textContent = `${interaction.provider}/${interaction.model}`;
    interactionInfo.appendChild(modelInfo);
    
    interactionInfo.appendChild(document.createTextNode(' '));
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date(interaction.timestamp).toLocaleTimeString();
    interactionInfo.appendChild(timestamp);
    
    interactionInfo.appendChild(document.createTextNode(' '));
    
    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = interaction.response ? '✅ Complete' : 
                        interaction.error ? '❌ Error' : '🔄 Pending';
    interactionInfo.appendChild(status);
    
    header.appendChild(expandIcon);
    header.appendChild(interactionInfo);
    interactionItem.appendChild(header);
    
    // Details (if expanded)
    if (isExpanded) {
      const details = document.createElement('div');
      details.className = 'interaction-details';
      
      // Prompt section
      const promptSection = document.createElement('div');
      promptSection.className = 'prompt-section';
      
      const promptTitle = document.createElement('h4');
      promptTitle.textContent = '📝 Prompt';
      promptSection.appendChild(promptTitle);
      
      const promptPre = document.createElement('pre');
      promptPre.className = 'prompt-content';
      promptPre.textContent = interaction.prompt;
      promptSection.appendChild(promptPre);
      
      details.appendChild(promptSection);
      
      // Response section (if exists)
      if (interaction.response) {
        const responseSection = document.createElement('div');
        responseSection.className = 'response-section';
        
        const responseTitle = document.createElement('h4');
        responseTitle.textContent = '💬 Response';
        responseSection.appendChild(responseTitle);
        
        const responsePre = document.createElement('pre');
        responsePre.className = 'response-content';
        responsePre.textContent = interaction.response;
        responseSection.appendChild(responsePre);
        
        details.appendChild(responseSection);
      }
      
      // Error section (if exists)
      if (interaction.error) {
        const errorSection = document.createElement('div');
        errorSection.className = 'error-section';
        
        const errorTitle = document.createElement('h4');
        errorTitle.textContent = '❌ Error';
        errorSection.appendChild(errorTitle);
        
        const errorPre = document.createElement('pre');
        errorPre.className = 'error-content';
        errorPre.textContent = interaction.error;
        errorSection.appendChild(errorPre);
        
        details.appendChild(errorSection);
      }
      
      interactionItem.appendChild(details);
    }
    
    return interactionItem;
  }
  
  toggleInteraction(interactionId) {
    if (this.model.expandedInteractions.has(interactionId)) {
      this.model.expandedInteractions.delete(interactionId);
    } else {
      this.model.expandedInteractions.add(interactionId);
    }
    
    // Update just that interaction element
    const interaction = this.model.interactions.find(i => i.id === interactionId);
    if (interaction) {
      const index = this.model.interactions.indexOf(interaction);
      const oldElement = this.elements.interactionElements.get(interactionId);
      if (oldElement) {
        const newElement = this.createInteractionElement(interaction, index);
        oldElement.replaceWith(newElement);
        this.elements.interactionElements.set(interactionId, newElement);
      }
    }
  }
}