/**
 * Example: Search Component with [object InputEvent] Bug
 * This component demonstrates the classic parameter passing bug that the
 * Umbilical Testing Framework is designed to detect.
 */

export const BuggySearchComponent = {
  name: 'BuggySearchComponent',
  
  // Component describes its contract
  describe: function(descriptor) {
    descriptor
      .name('BuggySearchComponent')
      .description('Search component with parameter passing bug')
      .requires('eventSystem', 'EventSystem')
      .requires('searchService', 'SearchService')
      .optional('logger', 'Logger')
      .manages('query', 'string', { default: '' })
      .manages('results', 'Array', { default: [] })
      .manages('isLoading', 'boolean', { default: false })
      .manages('error', 'string', { default: null })
      .listens('input', 'object')
      .listens('submit', 'object')
      .emits('search', 'string')
      .emits('resultsReceived', 'Array')
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
      .flow('search-flow', [
        'User types in search input',
        'Query state updates',
        'User presses enter or clicks search',
        'Search service is called',
        'Results are displayed'
      ]);
  },
  
  // Component implementation with bugs
  create: function(dependencies) {
    const { eventSystem, searchService, logger } = dependencies;
    const state = new Map([
      ['query', ''],
      ['results', []],
      ['isLoading', false],
      ['error', null]
    ]);
    
    return {
      dependencies,
      state,
      
      // BUG #1: Passing event object instead of value
      handleInput: function(event) {
        if (logger) logger.log('Input received:', event);
        
        // CRITICAL BUG: Storing the event object instead of the value!
        this.state.set('query', event); // Should be event.target.value
        
        // This will emit [object InputEvent] instead of the actual query
        eventSystem.dispatchEvent('search', event); // Should be event.target.value
      },
      
      // BUG #2: Type confusion in event handling
      handleKeydown: function(event) {
        if (event.key === 'Enter') {
          // Passing the wrong type to search
          this.performSearch(event); // Should be this.state.get('query')
        }
      },
      
      // BUG #3: Incorrect parameter extraction
      handleSubmit: function(event) {
        event.preventDefault();
        
        // Using toString() on event object
        const query = event.toString(); // Will be '[object MouseEvent]'
        this.performSearch(query);
      },
      
      // BUG #4: State type mismatch
      performSearch: async function(query) {
        this.state.set('isLoading', 'true'); // Should be boolean true, not string
        this.state.set('error', false); // Should be null or empty string
        
        try {
          // This will fail because query might be an object
          const results = await searchService.search(query);
          
          // BUG #5: Setting wrong type for results
          this.state.set('results', results || 'No results'); // Should always be array
          
          // Emitting wrong payload type
          eventSystem.dispatchEvent('resultsReceived', { results }); // Should be array
        } catch (error) {
          // BUG #6: Setting error as object instead of string
          this.state.set('error', error); // Should be error.message
        } finally {
          this.state.set('isLoading', false);
        }
      },
      
      // Additional methods that demonstrate parameter issues
      setState: function(key, value) {
        // Validate and set state
        if (key === 'query' && typeof value === 'object') {
          // This is where [object InputEvent] would be stored
          console.warn('Attempting to store object as query:', value.toString());
        }
        this.state.set(key, value);
      },
      
      getState: function(key) {
        return this.state.get(key);
      },
      
      // Render method showing how bugs affect output
      render: function() {
        const dom = this.config.dom;
        if (!dom) return null;
        
        const container = dom.createElement('div');
        container.className = 'search-container';
        
        const input = dom.createElement('input');
        input.className = 'search-input';
        // BUG: This will show [object InputEvent] in the input field
        input.value = this.state.get('query') || '';
        
        const button = dom.createElement('button');
        button.className = 'search-button';
        button.textContent = 'Search';
        
        const results = dom.createElement('div');
        results.className = 'results-container';
        
        // BUG: Results might be a string instead of array
        const resultsData = this.state.get('results');
        if (typeof resultsData === 'string') {
          results.textContent = resultsData; // Wrong: should iterate array
        } else if (Array.isArray(resultsData)) {
          resultsData.forEach(item => {
            const resultItem = dom.createElement('div');
            resultItem.textContent = item;
            results.appendChild(resultItem);
          });
        }
        
        container.appendChild(input);
        container.appendChild(button);
        container.appendChild(results);
        
        return container;
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
 *   verboseLogging: true,
 *   detectParameterBugs: true,
 *   detectCoordinationBugs: true
 * });
 * 
 * const results = await framework.testComponent(BuggySearchComponent);
 * 
 * console.log('Bugs detected:', results.analysis.bugAnalysis.totalBugs);
 * // Expected: 6+ bugs including the [object InputEvent] bug
 * 
 * console.log('Would detect original bug:', results.analysis.bugAnalysis.wouldDetectOriginalBug);
 * // Expected: true
 * 
 * console.log('Quality grade:', results.report.executive.grade);
 * // Expected: 'F' due to critical bugs
 */