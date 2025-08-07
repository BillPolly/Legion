/**
 * Example: Correctly Implemented Search Component
 * This component demonstrates the proper way to handle events and parameters,
 * avoiding the [object InputEvent] bug and other common mistakes.
 */

export const CorrectSearchComponent = {
  name: 'CorrectSearchComponent',
  
  // Component describes its contract
  describe: function(descriptor) {
    descriptor
      .name('CorrectSearchComponent')
      .description('Properly implemented search component')
      .requires('eventSystem', 'EventSystem')
      .requires('searchService', 'SearchService')
      .optional('logger', 'Logger')
      .manages('query', 'string', { default: '' })
      .manages('results', 'Array', { default: [] })
      .manages('isLoading', 'boolean', { default: false })
      .manages('error', 'string', { default: '' })
      .manages('searchHistory', 'Array', { default: [] })
      .listens('input', 'object')
      .listens('submit', 'object')
      .emits('search', 'string')
      .emits('resultsReceived', 'Array')
      .emits('error', 'string')
      .creates('div.search-container')
      .creates('input.search-input', {
        attributes: { 
          value: 'state.query',
          placeholder: 'Search...'
        },
        events: {
          input: 'handleInput',
          keydown: 'handleKeydown'
        }
      })
      .creates('button.search-button', {
        events: { click: 'handleSubmit' }
      })
      .creates('div.results-container')
      .creates('div.error-message')
      .flow('search-flow', [
        'User types in search input',
        'Query state updates with debouncing',
        'User presses enter or clicks search',
        'Search service is called with proper parameters',
        'Results are validated and displayed',
        'Search history is updated'
      ])
      .invariant('query-type', (state) => typeof state.query === 'string')
      .invariant('results-array', (state) => Array.isArray(state.results))
      .invariant('loading-boolean', (state) => typeof state.isLoading === 'boolean');
  },
  
  // Correct component implementation
  create: function(dependencies) {
    const { eventSystem, searchService, logger } = dependencies;
    const state = new Map([
      ['query', ''],
      ['results', []],
      ['isLoading', false],
      ['error', ''],
      ['searchHistory', []]
    ]);
    
    let debounceTimer = null;
    
    return {
      dependencies,
      state,
      
      // CORRECT: Properly extracting value from event
      handleInput: function(event) {
        // Extract the actual value from the event
        const value = event.target.value;
        
        if (logger) {
          logger.log('Input received:', value);
        }
        
        // Store the string value, not the event object
        this.state.set('query', value);
        
        // Emit the actual query string
        eventSystem.dispatchEvent('search', value);
        
        // Debounced search
        this.debouncedSearch(value);
      },
      
      // CORRECT: Proper debouncing implementation
      debouncedSearch: function(query) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(() => {
          if (query.length >= 2) {
            this.performSearch(query);
          }
        }, 300);
      },
      
      // CORRECT: Handling keyboard events properly
      handleKeydown: function(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          
          // Get the current query from state, not from event
          const currentQuery = this.state.get('query');
          
          // Clear debounce and search immediately
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          
          this.performSearch(currentQuery);
        }
      },
      
      // CORRECT: Handling form submission
      handleSubmit: function(event) {
        event.preventDefault();
        
        // Get query from state, not from event
        const currentQuery = this.state.get('query');
        
        // Validate before searching
        if (this.validateQuery(currentQuery)) {
          this.performSearch(currentQuery);
        }
      },
      
      // CORRECT: Input validation
      validateQuery: function(query) {
        if (typeof query !== 'string') {
          this.state.set('error', 'Invalid query type');
          return false;
        }
        
        if (query.trim().length === 0) {
          this.state.set('error', 'Query cannot be empty');
          return false;
        }
        
        if (query.length > 100) {
          this.state.set('error', 'Query too long (max 100 characters)');
          return false;
        }
        
        return true;
      },
      
      // CORRECT: Async search with proper error handling
      performSearch: async function(query) {
        // Type check before proceeding
        if (typeof query !== 'string') {
          console.error('Invalid query type:', typeof query);
          return;
        }
        
        // Set loading state with correct type
        this.state.set('isLoading', true);
        this.state.set('error', '');
        
        try {
          // Call search service with validated string
          const results = await searchService.search(query);
          
          // Ensure results is always an array
          const validResults = Array.isArray(results) ? results : [];
          
          // Update state with correct types
          this.state.set('results', validResults);
          this.state.set('isLoading', false);
          
          // Update search history
          const history = this.state.get('searchHistory');
          const updatedHistory = [...history, { query, timestamp: Date.now(), resultCount: validResults.length }];
          this.state.set('searchHistory', updatedHistory.slice(-10)); // Keep last 10
          
          // Emit with correct payload types
          eventSystem.dispatchEvent('resultsReceived', validResults);
          
          if (logger) {
            logger.log(`Search completed: ${validResults.length} results for "${query}"`);
          }
        } catch (error) {
          // Handle error properly
          const errorMessage = error.message || 'Search failed';
          
          this.state.set('error', errorMessage);
          this.state.set('results', []);
          this.state.set('isLoading', false);
          
          // Emit error event with string message
          eventSystem.dispatchEvent('error', errorMessage);
          
          if (logger) {
            logger.error('Search error:', errorMessage);
          }
        }
      },
      
      // Type-safe state management
      setState: function(key, value) {
        // Validate types before setting
        const typeValidation = {
          query: (v) => typeof v === 'string',
          results: (v) => Array.isArray(v),
          isLoading: (v) => typeof v === 'boolean',
          error: (v) => typeof v === 'string',
          searchHistory: (v) => Array.isArray(v)
        };
        
        if (typeValidation[key] && !typeValidation[key](value)) {
          console.error(`Type mismatch for ${key}:`, typeof value);
          return;
        }
        
        this.state.set(key, value);
      },
      
      getState: function(key) {
        return this.state.get(key);
      },
      
      // Clear search results
      clearResults: function() {
        this.state.set('results', []);
        this.state.set('query', '');
        this.state.set('error', '');
      },
      
      // Get search suggestions from history
      getSuggestions: function(partial) {
        const history = this.state.get('searchHistory');
        return history
          .map(h => h.query)
          .filter(q => q.toLowerCase().includes(partial.toLowerCase()))
          .slice(-5);
      },
      
      // Correct rendering with type safety
      render: function() {
        const dom = this.config.dom;
        if (!dom) return null;
        
        const container = dom.createElement('div');
        container.className = 'search-container';
        
        // Input with correct value binding
        const input = dom.createElement('input');
        input.className = 'search-input';
        input.placeholder = 'Search...';
        const queryValue = this.state.get('query');
        input.value = typeof queryValue === 'string' ? queryValue : '';
        
        // Search button
        const button = dom.createElement('button');
        button.className = 'search-button';
        button.textContent = this.state.get('isLoading') ? 'Searching...' : 'Search';
        button.disabled = this.state.get('isLoading');
        
        // Error message
        const errorDiv = dom.createElement('div');
        errorDiv.className = 'error-message';
        const errorMessage = this.state.get('error');
        if (errorMessage) {
          errorDiv.textContent = errorMessage;
          errorDiv.style.color = 'red';
        }
        
        // Results container with proper array handling
        const results = dom.createElement('div');
        results.className = 'results-container';
        
        const resultsData = this.state.get('results');
        if (Array.isArray(resultsData) && resultsData.length > 0) {
          resultsData.forEach((item, index) => {
            const resultItem = dom.createElement('div');
            resultItem.className = 'result-item';
            resultItem.textContent = `${index + 1}. ${item}`;
            results.appendChild(resultItem);
          });
        } else if (!this.state.get('isLoading') && queryValue) {
          results.textContent = 'No results found';
        }
        
        // Assemble DOM
        container.appendChild(input);
        container.appendChild(button);
        if (errorMessage) {
          container.appendChild(errorDiv);
        }
        container.appendChild(results);
        
        return container;
      },
      
      // Cleanup method
      destroy: function() {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        this.state.clear();
      }
    };
  }
};

/**
 * Example usage and testing:
 * 
 * import { UmbilicalTestingFramework } from '@legion/umbilical-testing';
 * 
 * const framework = new UmbilicalTestingFramework({
 *   verboseLogging: true
 * });
 * 
 * const results = await framework.testComponent(CorrectSearchComponent);
 * 
 * console.log('Bugs detected:', results.analysis.bugAnalysis.totalBugs);
 * // Expected: 0 bugs
 * 
 * console.log('Would detect original bug:', results.analysis.bugAnalysis.wouldDetectOriginalBug);
 * // Expected: false (no bug present)
 * 
 * console.log('Quality grade:', results.report.executive.grade);
 * // Expected: 'A' or 'A+' for correct implementation
 * 
 * console.log('Test pass rate:', results.testResults.summary.passRate);
 * // Expected: 95-100%
 */