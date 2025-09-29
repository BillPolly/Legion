/**
 * SearchComponent - PROPER MVVM Implementation with element tracking
 * No more innerHTML garbage - real element references and updates
 */

export class SearchComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model - the single source of truth
    this.model = {
      stats: {
        totalTools: 0,
        totalModules: 0
      },
      allTools: [],
      searchResults: [],
      searchQuery: '',
      searchType: 'text',
      isLoading: false,
      error: null,
      expandedTools: new Set(),
      remoteActor: options.remoteActor || null
    };
    
    // View - actual DOM element references, not selector garbage
    this.elements = {
      root: null,
      searchInput: null,
      searchButton: null,
      searchTypeRadios: {},
      statsModules: null,
      statsTools: null,
      resultsHeader: null,
      toolsList: null,
      errorContainer: null,
      loadingContainer: null,
      resultsContainer: null,
      toolElements: new Map() // Map of tool index to DOM elements
    };
    
    // Initialize the view
    this.createView();
    this.bindEvents();
    
    // Load initial data
    if (this.model.remoteActor) {
      this.loadRegistryStats();
      this.loadAllTools();
    }
  }
  
  // CREATE THE VIEW ONCE - NO MORE innerHTML NONSENSE
  createView() {
    // Root container
    this.elements.root = document.createElement('div');
    this.elements.root.className = 'search-container';
    
    // Header
    const header = document.createElement('div');
    header.className = 'search-header';
    
    const title = document.createElement('h3');
    title.textContent = '🔍 Tool Search & Discovery';
    header.appendChild(title);
    
    const statsDiv = document.createElement('div');
    statsDiv.className = 'search-stats';
    
    this.elements.statsModules = document.createElement('span');
    this.elements.statsModules.className = 'stat';
    this.elements.statsModules.textContent = '📦 0 modules';
    
    this.elements.statsTools = document.createElement('span');
    this.elements.statsTools.className = 'stat';
    this.elements.statsTools.textContent = '🔧 0 tools';
    
    statsDiv.appendChild(this.elements.statsModules);
    statsDiv.appendChild(this.elements.statsTools);
    header.appendChild(statsDiv);
    
    // Search controls
    const controls = document.createElement('div');
    controls.className = 'search-controls';
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'search-input-group';
    
    this.elements.searchInput = document.createElement('input');
    this.elements.searchInput.type = 'text';
    this.elements.searchInput.className = 'search-input';
    this.elements.searchInput.placeholder = 'Search for tools...';
    
    this.elements.searchButton = document.createElement('button');
    this.elements.searchButton.className = 'search-button';
    this.elements.searchButton.textContent = '🔍 Search';
    
    inputGroup.appendChild(this.elements.searchInput);
    inputGroup.appendChild(this.elements.searchButton);
    
    // Search type selector
    const typeSelector = document.createElement('div');
    typeSelector.className = 'search-type-selector';
    
    ['text', 'semantic'].forEach(type => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'searchType';
      radio.value = type;
      radio.checked = type === 'text';
      
      this.elements.searchTypeRadios[type] = radio;
      
      label.appendChild(radio);
      label.appendChild(document.createTextNode(` ${type === 'text' ? 'Text' : 'Semantic'} Search`));
      typeSelector.appendChild(label);
    });
    
    controls.appendChild(inputGroup);
    controls.appendChild(typeSelector);
    
    // Error container
    this.elements.errorContainer = document.createElement('div');
    this.elements.errorContainer.className = 'search-error';
    this.elements.errorContainer.style.display = 'none';
    
    // Loading container
    this.elements.loadingContainer = document.createElement('div');
    this.elements.loadingContainer.className = 'search-loading';
    this.elements.loadingContainer.style.display = 'none';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const loadingText = document.createElement('p');
    loadingText.textContent = 'Searching tools...';
    this.elements.loadingContainer.appendChild(spinner);
    this.elements.loadingContainer.appendChild(loadingText);
    
    // Results container
    this.elements.resultsContainer = document.createElement('div');
    this.elements.resultsContainer.className = 'search-results';
    
    const resultsHeaderDiv = document.createElement('div');
    resultsHeaderDiv.className = 'results-header';
    
    this.elements.resultsHeader = document.createElement('h4');
    this.elements.resultsHeader.textContent = 'All Tools (0)';
    resultsHeaderDiv.appendChild(this.elements.resultsHeader);
    
    this.elements.toolsList = document.createElement('div');
    this.elements.toolsList.className = 'tools-list';
    
    this.elements.resultsContainer.appendChild(resultsHeaderDiv);
    this.elements.resultsContainer.appendChild(this.elements.toolsList);
    
    // Assemble the view
    this.elements.root.appendChild(header);
    this.elements.root.appendChild(controls);
    this.elements.root.appendChild(this.elements.errorContainer);
    this.elements.root.appendChild(this.elements.loadingContainer);
    this.elements.root.appendChild(this.elements.resultsContainer);
    
    // Add to container
    this.container.appendChild(this.elements.root);
  }
  
  // BIND EVENTS ONCE - with proper references
  bindEvents() {
    // Search button click
    this.elements.searchButton.addEventListener('click', () => this.handleSearch());
    
    // Enter key on search input
    this.elements.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch();
      }
    });
    
    // Radio button changes
    Object.values(this.elements.searchTypeRadios).forEach(radio => {
      radio.addEventListener('change', (e) => this.handleSearchTypeChange(e));
    });
    
    // Tool expand/collapse - using event delegation
    this.elements.toolsList.addEventListener('click', (e) => {
      const header = e.target.closest('.tool-header');
      if (header) {
        const index = parseInt(header.dataset.toolIndex);
        this.toggleTool(index);
      }
    });
  }
  
  // UPDATE METHODS - modify existing elements, don't recreate
  updateStats() {
    this.elements.statsModules.textContent = `📦 ${this.model.stats.totalModules} modules`;
    this.elements.statsTools.textContent = `🔧 ${this.model.stats.totalTools} tools`;
  }
  
  updateSearchButton() {
    this.elements.searchButton.textContent = this.model.isLoading ? '⏳ Searching...' : '🔍 Search';
    this.elements.searchButton.disabled = this.model.isLoading;
  }
  
  updateError() {
    if (this.model.error) {
      this.elements.errorContainer.textContent = `❌ ${this.model.error}`;
      this.elements.errorContainer.style.display = 'block';
    } else {
      this.elements.errorContainer.style.display = 'none';
    }
  }
  
  updateLoading() {
    this.elements.loadingContainer.style.display = this.model.isLoading ? 'block' : 'none';
    this.elements.resultsContainer.style.display = this.model.isLoading ? 'none' : 'block';
  }
  
  updateResultsHeader() {
    if (this.model.searchQuery) {
      this.elements.resultsHeader.textContent = 
        `Results for "${this.model.searchQuery}" (${this.model.searchResults.length} tools)`;
    } else {
      this.elements.resultsHeader.textContent = 
        `All Tools (${this.model.searchResults.length})`;
    }
  }
  
  updateToolsList() {
    // Clear existing tool elements
    this.elements.toolElements.clear();
    this.elements.toolsList.innerHTML = '';
    
    if (this.model.searchResults.length === 0) {
      const noResults = document.createElement('p');
      noResults.className = 'no-results';
      noResults.textContent = 'No tools found';
      this.elements.toolsList.appendChild(noResults);
      return;
    }
    
    // Create tool elements
    this.model.searchResults.forEach((tool, index) => {
      const toolItem = this.createToolElement(tool, index);
      this.elements.toolElements.set(index, toolItem);
      this.elements.toolsList.appendChild(toolItem);
    });
  }
  
  createToolElement(tool, index) {
    const toolItem = document.createElement('div');
    toolItem.className = 'tool-item';
    
    const header = document.createElement('div');
    header.className = 'tool-header';
    header.dataset.toolIndex = index;
    
    const expandIcon = document.createElement('span');
    expandIcon.className = 'tool-expand-icon';
    expandIcon.textContent = this.model.expandedTools.has(index) ? '▼' : '▶️';
    
    const toolName = document.createElement('span');
    toolName.className = 'tool-name';
    const confidence = tool.confidence ? ` (${(tool.confidence * 100).toFixed(1)}% match)` : '';
    toolName.textContent = `${tool.name}${confidence}`;
    
    const toolModule = document.createElement('span');
    toolModule.className = 'tool-module';
    toolModule.textContent = tool.moduleName || 'Unknown Module';
    
    header.appendChild(expandIcon);
    header.appendChild(toolName);
    header.appendChild(toolModule);
    toolItem.appendChild(header);
    
    if (this.model.expandedTools.has(index)) {
      const details = document.createElement('div');
      details.className = 'tool-details';
      
      const description = document.createElement('p');
      description.className = 'tool-description';
      description.textContent = tool.description || 'No description available';
      details.appendChild(description);
      
      if (tool.inputSchema) {
        const schemaDiv = document.createElement('div');
        schemaDiv.className = 'tool-schema';
        const schemaTitle = document.createElement('h5');
        schemaTitle.textContent = 'Input Schema:';
        const schemaPre = document.createElement('pre');
        schemaPre.textContent = JSON.stringify(tool.inputSchema, null, 2);
        schemaDiv.appendChild(schemaTitle);
        schemaDiv.appendChild(schemaPre);
        details.appendChild(schemaDiv);
      }
      
      if (tool.outputSchema) {
        const schemaDiv = document.createElement('div');
        schemaDiv.className = 'tool-schema';
        const schemaTitle = document.createElement('h5');
        schemaTitle.textContent = 'Output Schema:';
        const schemaPre = document.createElement('pre');
        schemaPre.textContent = JSON.stringify(tool.outputSchema, null, 2);
        schemaDiv.appendChild(schemaTitle);
        schemaDiv.appendChild(schemaPre);
        details.appendChild(schemaDiv);
      }
      
      // Add confidence information if available
      if (tool.confidence !== undefined || tool.perspectiveCount !== undefined) {
        const confidenceDiv = document.createElement('div');
        confidenceDiv.className = 'tool-confidence';
        const confidenceTitle = document.createElement('h5');
        confidenceTitle.textContent = 'Search Confidence:';
        confidenceDiv.appendChild(confidenceTitle);
        
        if (tool.confidence !== undefined) {
          const confidenceValue = document.createElement('p');
          const strongEl = document.createElement('strong');
          strongEl.textContent = 'Overall Confidence:';
          confidenceValue.appendChild(strongEl);
          confidenceValue.appendChild(document.createTextNode(` ${(tool.confidence * 100).toFixed(1)}%`));
          confidenceDiv.appendChild(confidenceValue);
        }
        
        if (tool.maxScore !== undefined) {
          const maxScoreValue = document.createElement('p');
          const strongEl = document.createElement('strong');
          strongEl.textContent = 'Max Similarity:';
          maxScoreValue.appendChild(strongEl);
          maxScoreValue.appendChild(document.createTextNode(` ${(tool.maxScore * 100).toFixed(1)}%`));
          confidenceDiv.appendChild(maxScoreValue);
        }
        
        if (tool.perspectiveCount !== undefined) {
          const perspectiveValue = document.createElement('p');
          const strongEl = document.createElement('strong');
          strongEl.textContent = 'Matching Perspectives:';
          perspectiveValue.appendChild(strongEl);
          perspectiveValue.appendChild(document.createTextNode(` ${tool.perspectiveCount}`));
          confidenceDiv.appendChild(perspectiveValue);
        }
        
        details.appendChild(confidenceDiv);
      }
      
      // Add perspectives information if available
      if (tool.perspectives && tool.perspectives.length > 0) {
        const perspectivesDiv = document.createElement('div');
        perspectivesDiv.className = 'tool-perspectives';
        const perspectivesTitle = document.createElement('h5');
        perspectivesTitle.textContent = 'Matching Perspectives:';
        perspectivesDiv.appendChild(perspectivesTitle);
        
        tool.perspectives.slice(0, 3).forEach((perspective, i) => {
          const perspectiveItem = document.createElement('div');
          perspectiveItem.className = 'perspective-item';
          
          const scoreDiv = document.createElement('div');
          scoreDiv.className = 'perspective-score';
          scoreDiv.textContent = `${(perspective.score * 100).toFixed(1)}%`;
          
          const contextDiv = document.createElement('div');
          contextDiv.className = 'perspective-context';
          contextDiv.textContent = perspective.context;
          
          perspectiveItem.appendChild(scoreDiv);
          perspectiveItem.appendChild(contextDiv);
          perspectivesDiv.appendChild(perspectiveItem);
        });
        
        if (tool.perspectives.length > 3) {
          const moreInfo = document.createElement('p');
          moreInfo.className = 'perspective-more';
          moreInfo.textContent = `... and ${tool.perspectives.length - 3} more perspectives`;
          perspectivesDiv.appendChild(moreInfo);
        }
        
        details.appendChild(perspectivesDiv);
      }
      
      toolItem.appendChild(details);
    }
    
    return toolItem;
  }
  
  toggleTool(index) {
    if (this.model.expandedTools.has(index)) {
      this.model.expandedTools.delete(index);
    } else {
      this.model.expandedTools.add(index);
    }
    
    // Update just that tool element
    const oldElement = this.elements.toolElements.get(index);
    if (oldElement) {
      const tool = this.model.searchResults[index];
      const newElement = this.createToolElement(tool, index);
      oldElement.replaceWith(newElement);
      this.elements.toolElements.set(index, newElement);
    }
  }
  
  // ACTION HANDLERS
  handleSearch() {
    console.log('🔍 SearchComponent.handleSearch called');
    const query = this.elements.searchInput.value.trim();
    console.log('🔍 Search query:', query);
    
    if (!query) {
      this.model.searchResults = this.model.allTools;
      this.model.searchQuery = '';
      this.updateResultsHeader();
      this.updateToolsList();
      return;
    }
    
    this.model.searchQuery = query;
    this.model.isLoading = true;
    this.model.error = null;
    
    this.updateSearchButton();
    this.updateError();
    this.updateLoading();
    
    if (this.model.searchType === 'text') {
      console.log('🔍 Sending text search request:', query);
      this.model.remoteActor.receive('search-tools-text', { query });
    } else {
      console.log('🔍 Sending semantic search request:', query);
      this.model.remoteActor.receive('search-tools-semantic', { query, limit: 50 });
    }
  }
  
  handleSearchTypeChange(event) {
    this.model.searchType = event.target.value;
    if (this.model.searchQuery) {
      this.handleSearch();
    }
  }
  
  // DATA LOADING
  setRemoteActor(remoteActor) {
    this.model.remoteActor = remoteActor;
    this.loadRegistryStats();
    this.loadAllTools();
  }
  
  loadRegistryStats() {
    if (!this.model.remoteActor) return;
    this.model.remoteActor.receive('get-registry-stats', {});
  }
  
  loadAllTools() {
    if (!this.model.remoteActor) return;
    this.model.isLoading = true;
    this.updateLoading();
    this.model.remoteActor.receive('list-all-tools', {});
  }
  
  // MESSAGE HANDLERS
  handleRegistryStats(stats) {
    this.model.stats = stats;
    this.updateStats();
  }
  
  handleToolsList(data) {
    console.log('🔍 SearchComponent received tools list:', data.tools?.length || 0, 'tools');
    this.model.allTools = data.tools || [];
    this.model.searchResults = this.model.allTools;
    this.model.isLoading = false;
    
    this.updateLoading();
    this.updateResultsHeader();
    this.updateToolsList();
  }
  
  handleSearchResults(data) {
    console.log('🔍 SearchComponent received search results:', data.results?.length || 0, 'results');
    this.model.searchResults = data.results || [];
    this.model.isLoading = false;
    
    this.updateSearchButton();
    this.updateLoading();
    this.updateResultsHeader();
    this.updateToolsList();
  }
  
  handleError(error) {
    console.error('🔍 SearchComponent error:', error);
    this.model.error = error;
    this.model.isLoading = false;
    
    this.updateSearchButton();
    this.updateError();
    this.updateLoading();
  }
  
  // Public method for receiving messages from the actor
  receiveMessage(messageType, data) {
    switch (messageType) {
      case 'registryStatsComplete':
        this.handleRegistryStats(data);
        break;
        
      case 'toolsListComplete':
        this.handleToolsList(data);
        break;
        
      case 'toolsSearchTextComplete':
      case 'toolsSearchSemanticComplete':
        this.handleSearchResults(data);
        break;
        
      case 'toolsListError':
      case 'toolsSearchTextError':
      case 'toolsSearchSemanticError':
      case 'registryStatsError':
        this.handleError(data.error);
        break;
    }
  }
  
  /**
   * Update tools list - compatibility method for ToolsBrowserComponent
   */
  updateTools(tools) {
    console.log('🔍 SearchComponent updateTools called with', tools?.length || 0, 'tools');
    this.model.allTools = tools || [];
    this.model.searchResults = tools || [];
    this.updateToolsList();
  }
  
  /**
   * Set connection status - compatibility method for ToolsBrowserComponent
   */
  setConnected(connected) {
    console.log('🔍 SearchComponent setConnected called with', connected);
    // Update any connection-related UI if needed
    if (!connected) {
      this.model.error = 'Disconnected from server';
      this.updateError();
    } else {
      this.model.error = null;
      this.updateError();
    }
  }
}