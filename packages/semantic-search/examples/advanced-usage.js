/**
 * Advanced usage examples for @legion/semantic-search
 */

import { ResourceManager } from '@legion/tools';
import { SemanticSearchProvider } from '@legion/semantic-search';

async function advancedExamples() {
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  const searchProvider = await SemanticSearchProvider.create(resourceManager);
  await searchProvider.connect();
  
  // Example 1: Batch processing large datasets
  console.log('--- Batch Processing Example ---');
  
  const generateDocuments = (count) => {
    const documents = [];
    for (let i = 0; i < count; i++) {
      documents.push({
        id: `doc_${i}`,
        title: `Document ${i}`,
        content: `This is the content of document ${i} with various topics...`,
        category: ['technical', 'business', 'research'][i % 3],
        timestamp: new Date(Date.now() - i * 86400000).toISOString()
      });
    }
    return documents;
  };
  
  // Process in batches
  const totalDocs = 1000;
  const batchSize = 100;
  
  console.log(`Processing ${totalDocs} documents in batches of ${batchSize}...`);
  
  for (let i = 0; i < totalDocs; i += batchSize) {
    const batch = generateDocuments(batchSize);
    await searchProvider.insert('large_dataset', batch);
    console.log(`Processed ${i + batchSize}/${totalDocs} documents`);
  }
  
  // Example 2: Complex filtering
  console.log('\n--- Advanced Filtering ---');
  
  const results = await searchProvider.semanticSearch('large_dataset', 
    'technical documentation about cloud computing', 
    {
      limit: 5,
      threshold: 0.6,
      filter: {
        category: 'technical',
        $and: [
          { timestamp: { $gte: new Date(Date.now() - 7 * 86400000).toISOString() } }
        ]
      }
    }
  );
  
  console.log(`Found ${results.length} matching documents with filters`);
  
  // Example 3: Custom document processing
  console.log('\n--- Custom Document Processing ---');
  
  const scientificPapers = [
    {
      id: 'paper1',
      title: 'Deep Learning for Natural Language Processing',
      abstract: 'This paper presents novel approaches to NLP using transformer architectures...',
      authors: ['John Doe', 'Jane Smith'],
      keywords: ['deep learning', 'NLP', 'transformers', 'BERT'],
      year: 2023,
      citations: 45,
      // Custom fields that will be processed
      methodology: 'We used a modified BERT architecture with attention mechanisms...',
      results: 'Our model achieved 95% accuracy on benchmark datasets...'
    }
  ];
  
  await searchProvider.insert('research_papers', scientificPapers);
  
  // Search with natural language
  const researchQuery = 'transformer models for text classification';
  const paperResults = await searchProvider.semanticSearch('research_papers', researchQuery);
  
  console.log(`Research papers matching "${researchQuery}":`);
  paperResults.forEach(r => {
    console.log(`- ${r.document.title} (${r.document.year})`);
  });
  
  // Example 4: Log analysis
  console.log('\n--- Log Analysis Example ---');
  
  const logs = [
    {
      id: 'log1',
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: 'auth-service',
      message: 'Failed to authenticate user: invalid JWT token',
      stackTrace: 'Error: Invalid token\n  at verifyJWT...',
      userId: 'user123',
      requestId: 'req456'
    },
    {
      id: 'log2',
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: 'payment-service',
      message: 'Payment processing failed: gateway timeout',
      errorCode: 'GATEWAY_TIMEOUT',
      userId: 'user789',
      amount: 99.99
    }
  ];
  
  await searchProvider.insert('application_logs', logs);
  
  // Find similar errors
  const errorPattern = {
    message: 'authentication failure with token validation',
    level: 'ERROR'
  };
  
  const similarErrors = await searchProvider.findSimilar('application_logs', errorPattern, {
    limit: 5,
    threshold: 0.5
  });
  
  console.log('Similar error patterns found:');
  similarErrors.forEach(err => {
    console.log(`- [${err.document.service}] ${err.document.message}`);
  });
  
  // Example 5: Multi-language content
  console.log('\n--- Multi-language Search ---');
  
  const multilingualDocs = [
    {
      id: 'ml1',
      title: 'Introduction to Machine Learning',
      content: 'Machine learning is a subset of artificial intelligence...',
      language: 'en'
    },
    {
      id: 'ml2',
      title: 'Introducción al Aprendizaje Automático',
      content: 'El aprendizaje automático es un subconjunto de la inteligencia artificial...',
      language: 'es'
    },
    {
      id: 'ml3',
      title: 'Introduction à l\'apprentissage automatique',
      content: 'L\'apprentissage automatique est un sous-ensemble de l\'intelligence artificielle...',
      language: 'fr'
    }
  ];
  
  await searchProvider.insert('multilingual', multilingualDocs);
  
  // Search across languages (embeddings understand semantic meaning)
  const crossLingualQuery = 'artificial intelligence and machine learning basics';
  const crossLingualResults = await searchProvider.semanticSearch('multilingual', crossLingualQuery);
  
  console.log('Cross-lingual search results:');
  crossLingualResults.forEach(r => {
    console.log(`- [${r.document.language}] ${r.document.title}`);
  });
  
  // Example 6: Performance optimization with caching
  console.log('\n--- Cache Performance Test ---');
  
  const testQuery = 'optimize database performance';
  
  console.time('First search (no cache)');
  await searchProvider.semanticSearch('large_dataset', testQuery);
  console.timeEnd('First search (no cache)');
  
  console.time('Second search (cached)');
  await searchProvider.semanticSearch('large_dataset', testQuery);
  console.timeEnd('Second search (cached)');
  
  // Example 7: Export and backup
  console.log('\n--- Data Export Example ---');
  
  // Get all documents from a collection
  const allDocs = await searchProvider.find('knowledge_base', {});
  console.log(`Exported ${allDocs.length} documents from knowledge_base`);
  
  // Get provider statistics
  const metadata = searchProvider.getMetadata();
  console.log('\nProvider metadata:', metadata);
  
  await searchProvider.disconnect();
}

// Run advanced examples
advancedExamples().catch(console.error);