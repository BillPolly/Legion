/**
 * ClientSemanticSearchActor - Client-side actor for semantic search operations
 * Communicates with ServerSemanticSearchActor via WebSocket
 */

import { Actor } from '/legion/shared/actors/src/index.js';

export class ClientSemanticSearchActor extends Actor {
  constructor(toolRegistryBrowser) {
    super();
    this.toolRegistryBrowser = toolRegistryBrowser;
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🔗 ClientSemanticSearchActor connected to server');
  }

  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'search:results':
          await this.handleSearchResults(data);
          break;
          
        case 'search:status':
          await this.handleSearchStatus(data);
          break;
          
        case 'error':
          console.error('Search server error:', data.error);
          break;
          
        default:
          console.log('Unknown search message from server:', type, data);
      }
    } catch (error) {
      console.error('Error handling search message:', error);
    }
  }

  // Perform semantic search for tools
  searchTools(query, options = {}) {
    if (this.remoteActor) {
      console.log('🔍 Performing semantic search on server:', query);
      this.remoteActor.receive({
        type: 'search:semantic',
        data: { 
          query, 
          limit: options.limit || 10,
          threshold: options.threshold || 0,
          includeMetadata: options.includeMetadata !== false,
          collection: 'tool_perspectives'
        }
      });
    }
  }

  // Get search status/capabilities
  getSearchStatus() {
    if (this.remoteActor) {
      console.log('📊 Requesting search status from server...');
      this.remoteActor.receive({
        type: 'search:get-status'
      });
    }
  }

  // Handle search results from server
  async handleSearchResults(data) {
    console.log('🔍 Search results:', data);
    
    const { results = [] } = data;
    
    // If we have a resolver waiting for these results, call it
    if (this.searchResultsResolver) {
      console.log(`📊 Resolving semantic search with ${results.length} results`);
      this.searchResultsResolver(results);
      this.searchResultsResolver = null;
    }
    
    // Also update the search panel directly if needed
    if (this.toolRegistryBrowser) {
      const navigation = this.toolRegistryBrowser.getComponent('navigation');
      if (navigation) {
        const searchComponent = navigation.getTabComponent('search');
        if (searchComponent) {
          // If there's a semantic search method, use it
          if (searchComponent.setSemanticResults) {
            searchComponent.setSemanticResults(results, data.query, data.metadata);
          } else {
            // Otherwise, update the regular search with semantic results
            searchComponent.setTools?.(results);
          }
        }
      }
      
      console.log(`🔄 Updated search panel with ${results.length} semantic results`);
    }
  }

  // Handle search status from server
  async handleSearchStatus(status) {
    console.log('📊 Search status:', status);
    
    // Update UI with search capabilities
    if (this.toolRegistryBrowser) {
      // Could show search status in admin panel or search interface
      this.toolRegistryBrowser.updateSearchStatus?.(status);
    }
  }
}