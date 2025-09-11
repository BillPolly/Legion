/**
 * CitationService - Citation tracking for web tools (ported from Gemini CLI)
 * Provides source attribution and citation management
 */

/**
 * Citation tracking service (ported from Gemini CLI citation patterns)
 */
export class CitationService {
  constructor() {
    this.citations = new Map(); // url -> citation info
    this.citationHistory = [];
    this.maxCitations = 100;
  }

  /**
   * Add citation from web operation (ported from Gemini CLI)
   * @param {string} url - Source URL
   * @param {string} title - Page title
   * @param {string} content - Content excerpt
   * @param {string} operation - Operation type (fetch, search)
   * @returns {Object} Citation info
   */
  addCitation(url, title = null, content = null, operation = 'web_operation') {
    const citation = {
      url,
      title: title || 'No title',
      contentPreview: content ? content.substring(0, 200) + '...' : 'No preview',
      operation,
      timestamp: new Date().toISOString(),
      id: `citation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.citations.set(url, citation);
    this.citationHistory.push(citation);
    
    // Maintain citation history size
    if (this.citationHistory.length > this.maxCitations) {
      this.citationHistory = this.citationHistory.slice(-this.maxCitations);
    }
    
    return citation;
  }

  /**
   * Get citations for current session
   * @returns {Array} Recent citations
   */
  getRecentCitations() {
    return this.citationHistory.slice(-10); // Last 10 citations
  }

  /**
   * Format citations for display (ported from Gemini CLI)
   * @param {Array} citations - Citations to format
   * @returns {string} Formatted citation text
   */
  formatCitations(citations = null) {
    const citesToFormat = citations || this.getRecentCitations();
    
    if (citesToFormat.length === 0) {
      return '';
    }
    
    let formatted = '\\n\\n**Sources:**\\n';
    
    for (const citation of citesToFormat) {
      formatted += `- [${citation.title}](${citation.url})\\n`;
      if (citation.contentPreview && citation.contentPreview !== 'No preview') {
        formatted += `  ${citation.contentPreview}\\n`;
      }
    }
    
    return formatted;
  }

  /**
   * Create citation from web_fetch result
   * @param {Object} fetchResult - Result from web_fetch tool
   * @returns {Object} Citation
   */
  createCitationFromFetch(fetchResult) {
    return this.addCitation(
      fetchResult.url,
      fetchResult.title,
      fetchResult.content,
      'web_fetch'
    );
  }

  /**
   * Create citation from web_search result  
   * @param {Object} searchResult - Result from web_search tool
   * @returns {Array} Citations from search
   */
  createCitationsFromSearch(searchResult) {
    const citations = [];
    
    if (searchResult.sources && Array.isArray(searchResult.sources)) {
      for (const source of searchResult.sources) {
        const citation = this.addCitation(
          source.url || 'Unknown source',
          source.title || 'Search result',
          source.snippet || searchResult.content?.substring(0, 200),
          'web_search'
        );
        citations.push(citation);
      }
    } else {
      // Fallback citation for search
      citations.push(this.addCitation(
        'search://query',
        `Search: ${searchResult.query}`,
        searchResult.content,
        'web_search'
      ));
    }
    
    return citations;
  }

  /**
   * Get citation statistics
   * @returns {Object} Citation stats
   */
  getCitationStatistics() {
    const operationCounts = {};
    
    for (const citation of this.citationHistory) {
      operationCounts[citation.operation] = (operationCounts[citation.operation] || 0) + 1;
    }
    
    return {
      totalCitations: this.citationHistory.length,
      uniqueUrls: this.citations.size,
      operationTypes: operationCounts,
      recentCitations: this.citationHistory.slice(-5)
    };
  }

  /**
   * Clear citation history (for testing)
   */
  clearCitations() {
    this.citations.clear();
    this.citationHistory = [];
  }
}

export default CitationService;