#!/usr/bin/env node

/**
 * RAG Module Command Line Interface
 * Provides easy access to all RAG tools via npm scripts
 */

import { ResourceManager } from '@legion/resource-manager';
import RAGModule from '../src/RAGModule.js';

async function ragCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  
  try {
    const resourceManager = await ResourceManager.getInstance();
    const ragModule = await RAGModule.create(resourceManager);
    
    switch (command) {
      case 'index':
        await handleIndexCommand(ragModule, args.slice(1));
        break;
      case 'search':
        await handleSearchCommand(ragModule, args.slice(1));
        break;
      case 'query':
        await handleQueryCommand(ragModule, args.slice(1));
        break;
      case 'manage':
        await handleManageCommand(ragModule, args.slice(1));
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
    
    await ragModule.cleanup();
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

async function handleIndexCommand(ragModule, args) {
  const { workspace, source, sourceType, ...options } = parseArgs(args);
  
  if (!workspace || !source || !sourceType) {
    console.error('❌ Index command requires: --workspace <name> --source <path> --sourceType <file|directory|url>');
    console.error('Example: npm run index -- --workspace docs --source ./documentation --sourceType directory');
    process.exit(1);
  }
  
  console.log(`📚 Indexing ${sourceType}: ${source} into workspace: ${workspace}`);
  
  const indexTool = ragModule.getTool('index_content');
  const result = await indexTool.execute({
    workspace,
    source,
    sourceType,
    options: cleanOptions(options)
  });
  
  if (result.success) {
    console.log('✅ Indexing completed:');
    console.log(`   📄 Documents: ${result.data.documentsIndexed}`);
    console.log(`   🧩 Chunks: ${result.data.chunksCreated}`);
    console.log(`   🔢 Vectors: ${result.data.vectorsIndexed}`);
    console.log(`   ⏱️ Time: ${result.data.processingTime}ms`);
  } else {
    console.error('❌ Indexing failed:', result.error);
    process.exit(1);
  }
}

async function handleSearchCommand(ragModule, args) {
  const { workspace, query, ...options } = parseArgs(args);
  
  if (!workspace || !query) {
    console.error('❌ Search command requires: --workspace <name> --query <search terms>');
    console.error('Example: npm run search -- --workspace docs --query "database configuration"');
    process.exit(1);
  }
  
  console.log(`🔍 Searching workspace: ${workspace} for: "${query}"`);
  
  const searchTool = ragModule.getTool('search_content');
  const result = await searchTool.execute({
    workspace,
    query,
    options: cleanOptions(options)
  });
  
  if (result.success) {
    console.log(`✅ Found ${result.data.results.length} results (${result.data.searchTime}ms):`);
    console.log('');
    
    result.data.results.forEach((res, index) => {
      console.log(`${index + 1}. ${res.title} (${(res.similarity * 100).toFixed(1)}% match)`);
      console.log(`   📁 ${res.source}`);
      console.log(`   📝 ${res.content.substring(0, 150).replace(/\n/g, ' ')}...`);
      console.log('');
    });
  } else {
    console.error('❌ Search failed:', result.error);
    process.exit(1);
  }
}

async function handleQueryCommand(ragModule, args) {
  const { workspace, query, ...options } = parseArgs(args);
  
  if (!workspace || !query) {
    console.error('❌ Query command requires: --workspace <name> --query <question>');
    console.error('Example: npm run query -- --workspace docs --query "How do I configure the database?"');
    process.exit(1);
  }
  
  console.log(`🤖 RAG Query in workspace: ${workspace}`);
  console.log(`❓ Question: "${query}"`);
  console.log('');
  
  const ragTool = ragModule.getTool('query_rag');
  const result = await ragTool.execute({
    workspace,
    query,
    options: cleanOptions(options)
  });
  
  if (result.success) {
    console.log('✅ RAG Response:');
    console.log('━'.repeat(60));
    console.log(result.data.response);
    console.log('━'.repeat(60));
    console.log('');
    
    if (result.data.sources.length > 0) {
      console.log('📚 Sources:');
      result.data.sources.forEach((source, index) => {
        console.log(`   ${index + 1}. ${source.source} (${(source.similarity * 100).toFixed(1)}% relevant)`);
      });
      console.log('');
    }
    
    console.log('📊 Metadata:');
    console.log(`   🔍 Search Results: ${result.data.searchResults}`);
    console.log(`   🤖 Model: ${result.data.llmMetadata.model}`);
    console.log(`   ⏱️ Response Time: ${result.data.llmMetadata.responseTime}ms`);
  } else {
    console.error('❌ RAG Query failed:', result.error);
    process.exit(1);
  }
}

async function handleManageCommand(ragModule, args) {
  const { workspace, action, ...options } = parseArgs(args);
  
  if (!action) {
    console.error('❌ Manage command requires: --action <status|list|clear|list-workspaces|workspace-info|delete-workspace>');
    console.error('Examples:');
    console.error('  npm run manage -- --action list-workspaces');
    console.error('  npm run manage -- --workspace docs --action status');
    console.error('  npm run manage -- --workspace docs --action workspace-info');
    process.exit(1);
  }
  
  const globalActions = ['list-workspaces'];
  if (!workspace && !globalActions.includes(action)) {
    console.error(`❌ Action '${action}' requires --workspace parameter`);
    process.exit(1);
  }
  
  console.log(`🛠️ Managing ${workspace ? `workspace: ${workspace}` : 'global'} - Action: ${action}`);
  
  const manageTool = ragModule.getTool('manage_index');
  const params = { action, options: cleanOptions(options) };
  if (workspace) params.workspace = workspace;
  
  const result = await manageTool.execute(params);
  
  if (result.success) {
    switch (action) {
      case 'list-workspaces':
        console.log(`✅ Found ${result.data.result.totalWorkspaces} workspaces:`);
        console.log('');
        result.data.result.workspaces.forEach((ws, index) => {
          console.log(`${index + 1}. ${ws.name}`);
          console.log(`   📄 Documents: ${ws.documentCount}`);
          console.log(`   🧩 Chunks: ${ws.chunkCount}`);
          console.log(`   📊 Collection: ${ws.qdrantCollection}`);
          console.log(`   🟢 Status: ${ws.status}`);
          console.log('');
        });
        break;
        
      case 'status':
        console.log(`✅ Workspace "${workspace}" Status:`);
        console.log(`   📄 Documents: ${result.data.statistics.totalDocuments}`);
        console.log(`   🧩 Chunks: ${result.data.statistics.totalChunks}`);
        console.log(`   📊 Collection: ${result.data.statistics.qdrantCollection}`);
        console.log(`   💾 Index Size: ~${Math.round(result.data.statistics.indexSize / 1024 / 1024)} MB`);
        break;
        
      case 'list':
        console.log(`✅ Documents in workspace "${workspace}" (${result.data.result.totalCount}):`);
        console.log('');
        result.data.result.documents.slice(0, 10).forEach((doc, index) => {
          console.log(`${index + 1}. ${doc.title}`);
          console.log(`   📁 ${doc.source}`);
          console.log(`   📊 ${doc.contentType} (${doc.totalChunks} chunks)`);
          console.log('');
        });
        if (result.data.result.totalCount > 10) {
          console.log(`... and ${result.data.result.totalCount - 10} more documents`);
        }
        break;
        
      case 'workspace-info':
        const info = result.data.result;
        console.log(`✅ Detailed info for workspace "${workspace}":`);
        console.log(`   📄 Documents: ${info.statistics.totalDocuments}`);
        console.log(`   🧩 Chunks: ${info.statistics.totalChunks}`);
        console.log(`   📊 Collection: ${info.qdrant.collection}`);
        console.log(`   💾 Size: ${Math.round(info.qdrant.estimatedSize / 1024 / 1024)} MB`);
        console.log(`   📅 Last Activity: ${info.lastActivity ? new Date(info.lastActivity).toLocaleString() : 'None'}`);
        console.log('');
        console.log('📋 Content Types:');
        info.contentTypes.forEach(ct => {
          console.log(`   ${ct.type}: ${ct.count} documents`);
        });
        break;
        
      case 'clear':
        console.log(`✅ Cleared workspace "${workspace}":`);
        console.log(`   📄 Documents removed: ${result.data.result.documentsRemoved}`);
        console.log(`   🧩 Chunks removed: ${result.data.result.chunksRemoved}`);
        break;
        
      case 'delete-workspace':
        console.log(`✅ Deleted workspace "${workspace}":`);
        console.log(`   📄 Documents deleted: ${result.data.result.mongodb.documentsDeleted}`);
        console.log(`   🧩 Chunks deleted: ${result.data.result.mongodb.chunksDeleted}`);
        console.log(`   📊 Qdrant collection deleted: ${result.data.result.qdrant.deleted}`);
        break;
        
      default:
        console.log('✅ Command completed:', JSON.stringify(result.data, null, 2));
    }
  } else {
    console.error('❌ Management command failed:', result.error);
    process.exit(1);
  }
}

function parseArgs(args) {
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      
      if (value && !value.startsWith('--')) {
        // Handle special cases
        if (key === 'fileTypes') {
          parsed[key] = value.split(',');
        } else if (key === 'chunkSize' || key === 'limit' || key === 'searchLimit') {
          parsed[key] = parseInt(value);
        } else if (key === 'overlap' || key === 'threshold' || key === 'searchThreshold') {
          parsed[key] = parseFloat(value);
        } else if (key === 'recursive' || key === 'includeContext' || key === 'updateExisting') {
          parsed[key] = value.toLowerCase() === 'true';
        } else {
          parsed[key] = value;
        }
        i++; // Skip the value
      } else {
        // Boolean flag
        parsed[key] = true;
      }
    }
  }
  
  return parsed;
}

function cleanOptions(options) {
  // Remove command-specific parameters from options
  const { workspace, source, sourceType, query, action, ...cleanedOptions } = options;
  return cleanedOptions;
}

function showHelp() {
  console.log(`
🚀 RAG Module CLI - Retrieval-Augmented Generation Tools

USAGE:
  npm run <command> -- [options]

COMMANDS:
  npm run index         Index content into workspace
  npm run search        Search content in workspace  
  npm run query         RAG query with LLM response
  npm run manage        Manage workspaces
  npm run workspaces    List all workspaces (shortcut)

INDEX CONTENT:
  npm run index -- --workspace <name> --source <path> --sourceType <type> [options]
  
  Required:
    --workspace <name>       Workspace name (e.g., "docs", "projects")
    --source <path>          File/directory path or URL
    --sourceType <type>      Type: file, directory, or url
    
  Options:
    --recursive <true|false> Recursively process directories (default: true)
    --fileTypes <.ext,...>   File extensions to include (e.g., ".md,.txt,.js")
    --chunkSize <number>     Target chunk size in characters (default: 800)
    --overlap <decimal>      Overlap ratio between chunks (default: 0.2)
    --updateExisting <bool>  Whether to reindex existing content
    
  Examples:
    npm run index -- --workspace docs --source ./documentation --sourceType directory
    npm run index -- --workspace api --source ./api.md --sourceType file --chunkSize 600
    npm run index -- --workspace web --source https://example.com/docs --sourceType url

SEARCH CONTENT:
  npm run search -- --workspace <name> --query "<terms>" [options]
  
  Required:
    --workspace <name>       Workspace to search in
    --query "<terms>"        Search query text
    
  Options:
    --limit <number>         Maximum results (default: 10)
    --threshold <decimal>    Similarity threshold (default: 0.3)
    --includeContext <bool>  Include surrounding chunks
    
  Examples:
    npm run search -- --workspace docs --query "database configuration" 
    npm run search -- --workspace api --query "authentication setup" --limit 5 --threshold 0.4

RAG QUERY:
  npm run query -- --workspace <name> --query "<question>" [options]
  
  Required:
    --workspace <name>       Workspace to query
    --query "<question>"     Question for RAG response
    
  Options:
    --searchLimit <number>   Max search results for context (default: 5)
    --searchThreshold <dec>  Search similarity threshold (default: 0.3)
    --responseStyle <style>  Response style: detailed or concise
    
  Examples:
    npm run query -- --workspace docs --query "How do I configure the database?"
    npm run query -- --workspace api --query "What are the authentication options?" --responseStyle concise

WORKSPACE MANAGEMENT:
  npm run manage -- --action <action> [--workspace <name>] [options]
  
  Actions:
    list-workspaces         List all available workspaces (global)
    status                  Get workspace status (requires --workspace)
    list                    List documents in workspace (requires --workspace)  
    workspace-info          Get detailed workspace info (requires --workspace)
    clear                   Clear workspace content (requires --workspace)
    delete-workspace        Delete workspace completely (requires --workspace)
    
  Examples:
    npm run workspaces                                           # List all workspaces
    npm run manage -- --workspace docs --action status          # Get docs status
    npm run workspace:info -- --workspace docs                  # Detailed docs info
    npm run manage -- --workspace docs --action list            # List docs documents
    npm run workspace:delete -- --workspace old-project         # Delete workspace

SHORTCUTS:
  npm run workspaces                    # List all workspaces
  npm run workspace:info -- --workspace <name>    # Get workspace info
  npm run workspace:delete -- --workspace <name>  # Delete workspace
  
For more information, see: packages/modules/rag/docs/DESIGN.md
`);
}

ragCLI().catch(console.error);