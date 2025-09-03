/**
 * IndexContentTool - Tool for indexing content from directories or URLs
 * Metadata comes from tools-metadata.json, tool contains pure logic only
 */

import { Tool } from '@legion/tools-registry';
import FileProcessor from '../processors/FileProcessor.js';
import WebProcessor from '../processors/WebProcessor.js';
import ContentProcessor from '../processors/ContentProcessor.js';
import DocumentIndexer from '../indexers/DocumentIndexer.js';
import DatabaseSchema from '../database/DatabaseSchema.js';
import { MongoClient } from 'mongodb';
import path from 'path';

export default class IndexContentTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.semanticSearchModule = null;
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    if (!this.semanticSearchModule) {
      throw new Error('Semantic search module not provided to IndexContentTool');
    }

    // Extract workspace as first parameter for clean API  
    const { workspace, source, sourceType, options = {} } = params;
    
    if (!workspace) {
      throw new Error('Workspace parameter is required');
    }
    
    this.progress(`Starting indexing of ${sourceType}: ${source} in workspace: ${workspace}`, 5, {
      workspace,
      source,
      sourceType,
      options
    });

    const startTime = Date.now();
    let mongoClient = null;
    
    try {
      // Initialize database connection
      const mongoUrl = this.semanticSearchModule.resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
      mongoClient = new MongoClient(mongoUrl);
      await mongoClient.connect();
      
      const config = this.semanticSearchModule.config;
      const db = mongoClient.db(config.mongodb.database);
      
      // Set up database schema
      const databaseSchema = new DatabaseSchema(db, config.mongodb);
      
      // Create content processor
      const contentProcessor = new ContentProcessor({
        defaultChunkSize: options.chunkSize || config.processing.defaultChunkSize,
        defaultOverlap: options.overlap !== undefined ? options.overlap : config.processing.defaultOverlap,
        maxFileSize: config.processing.maxFileSize,
        supportedFileTypes: config.processing.supportedFileTypes
      });

      // Create document indexer with workspace-aware configuration
      // Each workspace will get its own Qdrant collection for optimal performance
      const documentIndexer = new DocumentIndexer({
        databaseSchema,
        contentProcessor,
        resourceManager: this.semanticSearchModule.resourceManager,
        options: {
          qdrantCollection: config.qdrant.collection  // Base collection name for workspace generation
        }
      });

      this.progress(`Processing ${sourceType}: ${source}`, 15, { sourceType });

      // Process content based on source type
      let indexingResults;
      
      switch (sourceType) {
        case 'file':
          indexingResults = await this._indexFile(source, options, documentIndexer, workspace);
          break;
        case 'directory':
          indexingResults = await this._indexDirectory(source, options, documentIndexer, contentProcessor, workspace);
          break;
        case 'url':
          indexingResults = await this._indexUrl(source, options, documentIndexer, workspace);
          break;
        default:
          throw new Error(`Unsupported source type: ${sourceType}`);
      }

      this.progress('Indexing completed successfully', 100, {
        documentsIndexed: indexingResults.documentsIndexed,
        chunksCreated: indexingResults.chunksCreated
      });

      const totalTime = Date.now() - startTime;

      return {
        documentsIndexed: indexingResults.documentsIndexed,
        chunksCreated: indexingResults.chunksCreated,
        vectorsIndexed: indexingResults.vectorsIndexed,
        processingTime: totalTime,
        errors: indexingResults.errors || [],
        summary: {
          totalFiles: indexingResults.totalFiles || 1,
          totalSize: indexingResults.totalSize || 0,
          avgChunksPerDoc: indexingResults.chunksCreated / Math.max(1, indexingResults.documentsIndexed),
          duplicatesSkipped: indexingResults.duplicatesSkipped || 0
        }
      };

    } catch (error) {
      this.error(`Indexing failed: ${error.message}`, {
        source,
        sourceType,
        error: error.message
      });
      
      throw error;
    } finally {
      if (mongoClient) {
        await mongoClient.close();
      }
    }
  }

  /**
   * Index a single file into specific workspace
   * Creates workspace-specific Qdrant collection automatically
   */
  async _indexFile(filePath, options, documentIndexer, workspace) {
    this.progress(`Reading file: ${filePath} for workspace: ${workspace}`, 30);
    
    try {
      const fileProcessor = new FileProcessor({
        basePath: path.dirname(filePath),
        supportedFileTypes: this.semanticSearchModule.config.processing.supportedFileTypes,
        maxFileSize: this.semanticSearchModule.config.processing.maxFileSize
      });

      const fileResult = await fileProcessor.processFile(filePath);
      
      this.progress(`Indexing file content in workspace: ${workspace}`, 60);
      
      // Pass workspace to indexDocument for proper workspace-specific indexing
      const indexResult = await documentIndexer.indexDocument(
        fileResult.content,
        fileResult.contentType,
        {
          source: `file://${filePath}`,
          ...fileResult.metadata
        },
        {
          ...options,
          workspace: workspace  // Ensure workspace is passed to indexing
        }
      );

      return {
        documentsIndexed: 1,
        chunksCreated: indexResult.chunksIndexed,
        vectorsIndexed: indexResult.vectorsIndexed,
        totalFiles: 1,
        totalSize: fileResult.size,
        duplicatesSkipped: indexResult.alreadyExists ? 1 : 0
      };
      
    } catch (error) {
      throw new Error(`File indexing failed: ${error.message}`);
    }
  }

  /**
   * Index all files in a directory into specific workspace
   * All files in directory go into same workspace for logical grouping
   */
  async _indexDirectory(dirPath, options, documentIndexer, contentProcessor, workspace) {
    this.progress(`Scanning directory: ${dirPath} for workspace: ${workspace}`, 20);
    
    try {
      const fileProcessor = new FileProcessor({
        basePath: dirPath,
        supportedFileTypes: options.fileTypes || this.semanticSearchModule.config.processing.supportedFileTypes,
        maxFileSize: this.semanticSearchModule.config.processing.maxFileSize
      });

      // Scan directory for files
      const fileList = await fileProcessor.scanDirectory(dirPath, {
        recursive: options.recursive !== false,
        fileTypes: options.fileTypes
      });

      if (fileList.length === 0) {
        return {
          documentsIndexed: 0,
          chunksCreated: 0,
          vectorsIndexed: 0,
          totalFiles: 0,
          totalSize: 0,
          errors: ['No supported files found in directory']
        };
      }

      this.progress(`Found ${fileList.length} files to process`, 30);

      // Process files in batches
      const batchResults = await fileProcessor.processFiles(fileList);
      const successfulFiles = batchResults.filter(r => r.success);
      const failedFiles = batchResults.filter(r => !r.success);

      this.progress(`Processed ${successfulFiles.length} files, indexing content`, 50);

      // Index successful files into workspace
      const documents = successfulFiles.map(fileResult => ({
        content: fileResult.content,
        contentType: fileResult.contentType,
        metadata: {
          source: `file://${fileResult.filePath}`,
          ...fileResult.metadata
        }
      }));

      // Pass workspace to indexDocuments for workspace-specific indexing
      const indexResults = await documentIndexer.indexDocuments(documents, {
        ...options,
        workspace: workspace
      });

      this.progress(`Indexed ${indexResults.successfulDocuments} documents`, 90);

      // Calculate summary statistics
      const totalSize = successfulFiles.reduce((sum, f) => sum + f.size, 0);

      return {
        documentsIndexed: indexResults.successfulDocuments,
        chunksCreated: indexResults.totalChunks,
        vectorsIndexed: indexResults.totalVectors,
        totalFiles: fileList.length,
        totalSize,
        duplicatesSkipped: indexResults.documents.filter(d => d.alreadyExists).length,
        errors: [
          ...failedFiles.map(f => `File processing failed: ${f.error}`),
          ...indexResults.errors.map(e => `Indexing failed: ${e.error}`)
        ]
      };

    } catch (error) {
      throw new Error(`Directory indexing failed: ${error.message}`);
    }
  }

  /**
   * Index content from a URL into specific workspace
   */
  async _indexUrl(url, options, documentIndexer, workspace) {
    this.progress(`Fetching URL: ${url} for workspace: ${workspace}`, 30);
    
    try {
      const webProcessor = new WebProcessor({
        timeout: 15000,
        maxContentSize: 2 * 1024 * 1024, // 2MB
        userAgent: 'Legion Semantic Search Bot'
      });

      const urlResult = await webProcessor.processUrl(url);
      
      this.progress(`Processing URL content`, 60);

      // Index URL content into workspace
      const indexResult = await documentIndexer.indexDocument(
        urlResult.content,
        urlResult.contentType,
        {
          source: url,
          title: urlResult.title,
          ...urlResult.metadata
        },
        {
          ...options,
          workspace: workspace
        }
      );

      return {
        documentsIndexed: 1,
        chunksCreated: indexResult.chunksIndexed,
        vectorsIndexed: indexResult.vectorsIndexed,
        totalFiles: 1,
        totalSize: urlResult.size,
        duplicatesSkipped: indexResult.alreadyExists ? 1 : 0
      };

    } catch (error) {
      throw new Error(`URL indexing failed: ${error.message}`);
    }
  }
}