/**
 * Test data generator for semantic search tests
 */

export class TestDataGenerator {
  /**
   * Generate random documents
   */
  static generateDocuments(count = 10) {
    const documents = [];
    const categories = ['technical', 'business', 'research', 'tutorial'];
    const topics = ['machine learning', 'databases', 'cloud computing', 'security', 'networking'];
    
    for (let i = 0; i < count; i++) {
      documents.push({
        id: `doc_${i + 1}`,
        title: `Document ${i + 1}: ${topics[i % topics.length]}`,
        content: `This is the content of document ${i + 1} discussing ${topics[i % topics.length]}. ` +
                 `It covers various aspects of the topic including implementation details, best practices, ` +
                 `and real-world examples. The document provides comprehensive coverage suitable for ` +
                 `both beginners and advanced practitioners.`,
        author: `Author ${(i % 5) + 1}`,
        category: categories[i % categories.length],
        tags: [topics[i % topics.length], categories[i % categories.length], 'documentation'],
        metadata: {
          version: '1.0',
          lastUpdated: new Date(Date.now() - i * 86400000).toISOString(),
          wordCount: 500 + i * 50,
          readingTime: `${5 + i} minutes`
        }
      });
    }
    
    return documents;
  }

  /**
   * Generate code snippets
   */
  static generateCodeSnippets(count = 5) {
    const snippets = [];
    const languages = ['javascript', 'python', 'java', 'typescript', 'go'];
    const purposes = ['authentication', 'data processing', 'api client', 'utility function', 'database query'];
    
    for (let i = 0; i < count; i++) {
      snippets.push({
        id: `code_${i + 1}`,
        filepath: `/src/${purposes[i % purposes.length].replace(' ', '_')}.${languages[i % languages.length]}`,
        content: `// ${purposes[i % purposes.length]} implementation\nfunction process() {\n  // Implementation\n}`,
        language: languages[i % languages.length],
        purpose: purposes[i % purposes.length],
        imports: ['module1', 'module2'],
        exports: ['function1', 'function2']
      });
    }
    
    return snippets;
  }

  /**
   * Generate log entries
   */
  static generateLogs(count = 20) {
    const logs = [];
    const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const services = ['api-gateway', 'auth-service', 'data-processor', 'cache-manager'];
    const messages = [
      'Request processed successfully',
      'Connection timeout occurred',
      'Cache miss for key',
      'Database query executed',
      'Authentication failed'
    ];
    
    for (let i = 0; i < count; i++) {
      logs.push({
        id: `log_${i + 1}`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        level: levels[i % levels.length],
        service: services[i % services.length],
        message: messages[i % messages.length],
        metadata: {
          requestId: `req_${i + 1}`,
          userId: i % 2 === 0 ? `user_${i}` : null,
          duration: Math.floor(Math.random() * 1000)
        }
      });
    }
    
    return logs;
  }

  /**
   * Generate search queries
   */
  static generateQueries() {
    return [
      'find all authentication errors in the last hour',
      'documents about machine learning model deployment',
      'code that handles database connections',
      'user registration and validation logic',
      'performance optimization techniques',
      'security best practices for API development',
      'error handling patterns in microservices',
      'caching strategies for distributed systems'
    ];
  }

  /**
   * Generate expected search results
   */
  static generateSearchResults(query, documents, count = 5) {
    return documents.slice(0, count).map((doc, index) => ({
      document: doc,
      _similarity: 0.95 - (index * 0.1),
      _searchType: 'semantic',
      _id: doc.id
    }));
  }
}