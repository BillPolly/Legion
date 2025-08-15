/**
 * Basic usage example for @legion/semantic-search
 */

import { ResourceManager } from '@legion/tools-registry';
import { SemanticSearchProvider } from '@legion/semantic-search';

async function main() {
  // Initialize ResourceManager (loads .env automatically)
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  // Create semantic search provider
  const searchProvider = await SemanticSearchProvider.create(resourceManager);
  await searchProvider.connect();
  
  console.log('Semantic Search Provider initialized');
  
  // Example 1: Index documents
  const documents = [
    {
      id: 'doc1',
      title: 'Getting Started with Node.js',
      content: 'Node.js is a JavaScript runtime built on Chrome V8 engine...',
      category: 'tutorial',
      tags: ['nodejs', 'javascript', 'backend']
    },
    {
      id: 'doc2',
      title: 'Understanding React Hooks',
      content: 'React Hooks let you use state and other React features without writing a class...',
      category: 'tutorial',
      tags: ['react', 'frontend', 'hooks']
    },
    {
      id: 'doc3',
      title: 'Database Design Best Practices',
      content: 'Good database design is crucial for application performance and scalability...',
      category: 'guide',
      tags: ['database', 'sql', 'architecture']
    }
  ];
  
  console.log('\nIndexing documents...');
  const insertResult = await searchProvider.insert('knowledge_base', documents);
  console.log(`Indexed ${insertResult.insertedCount} documents`);
  
  // Example 2: Semantic search
  console.log('\n--- Semantic Search ---');
  const query = 'how to build backend applications';
  const searchResults = await searchProvider.semanticSearch('knowledge_base', query, {
    limit: 2,
    threshold: 0.5
  });
  
  console.log(`Query: "${query}"`);
  searchResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.document.title} (similarity: ${result._similarity.toFixed(3)})`);
  });
  
  // Example 3: Hybrid search (semantic + keyword)
  console.log('\n--- Hybrid Search ---');
  const hybridQuery = 'react state management';
  const hybridResults = await searchProvider.hybridSearch('knowledge_base', hybridQuery, {
    semanticWeight: 0.7,
    keywordWeight: 0.3,
    limit: 2
  });
  
  console.log(`Query: "${hybridQuery}"`);
  hybridResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.document.title}`);
    console.log(`   Hybrid Score: ${result._hybridScore?.toFixed(3)}`);
    console.log(`   Semantic: ${result._semanticScore?.toFixed(3)}, Keyword: ${result._keywordScore?.toFixed(3)}`);
  });
  
  // Example 4: Find similar documents
  console.log('\n--- Find Similar Documents ---');
  const referenceDoc = {
    title: 'MongoDB Tutorial',
    content: 'Learn how to use MongoDB, a NoSQL database for modern applications...',
    tags: ['mongodb', 'nosql', 'database']
  };
  
  const similarDocs = await searchProvider.findSimilar('knowledge_base', referenceDoc, {
    limit: 2,
    threshold: 0.3
  });
  
  console.log('Reference: "MongoDB Tutorial"');
  similarDocs.forEach((doc, i) => {
    console.log(`${i + 1}. ${doc.document.title} (similarity: ${doc._similarity.toFixed(3)})`);
  });
  
  // Example 5: Code search
  console.log('\n--- Code Search ---');
  const codeSnippets = [
    {
      id: 'snippet1',
      filepath: '/src/auth/login.js',
      content: `
        async function login(email, password) {
          const user = await User.findOne({ email });
          if (!user || !await bcrypt.compare(password, user.password)) {
            throw new Error('Invalid credentials');
          }
          return generateToken(user);
        }
      `,
      language: 'javascript',
      module: 'authentication'
    },
    {
      id: 'snippet2',
      filepath: '/src/utils/validation.js',
      content: `
        function validateEmail(email) {
          const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
          return emailRegex.test(email);
        }
      `,
      language: 'javascript',
      module: 'validation'
    }
  ];
  
  await searchProvider.insert('codebase', codeSnippets);
  
  const codeQuery = 'user authentication and validation';
  const codeResults = await searchProvider.semanticSearch('codebase', codeQuery, { limit: 2 });
  
  console.log(`Code search: "${codeQuery}"`);
  codeResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.document.filepath} (${result.document.module})`);
  });
  
  // Cleanup
  await searchProvider.disconnect();
  console.log('\nDisconnected from semantic search provider');
}

// Run the example
main().catch(console.error);