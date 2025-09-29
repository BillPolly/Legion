/**
 * HandleMetadataExtractor - Extracts meaningful metadata from handles
 *
 * Provides handle-type-specific analysis to extract business context
 * and meaningful information about what the handle represents.
 */

export class HandleMetadataExtractor {
  constructor() {
    // Registry of handle-type-specific analyzers
    this.analyzers = new Map();

    // Register default analyzers
    this._registerDefaultAnalyzers();
  }

  /**
   * Register default handle analyzers
   * @private
   */
  _registerDefaultAnalyzers() {
    // MongoDB analyzer
    this.analyzers.set('mongodb', {
      analyze: async (handle) => {
        return {
          handleType: 'mongodb',
          database: handle.database || 'unknown',
          collection: handle.collection || null,
          resourceDescription: `MongoDB database: ${handle.database}${handle.collection ? `, collection: ${handle.collection}` : ''}`,
          capabilities: ['query', 'update', 'subscribe'],
          metadata: {
            server: handle.server || 'local',
            hasCollection: !!handle.collection
          }
        };
      }
    });

    // Filesystem analyzer with rich metadata extraction
    this.analyzers.set('filesystem', {
      analyze: async (handle) => {
        // FileHandle uses 'filePath' property, not 'path'
        const filePath = handle.filePath || handle.path || 'unknown';
        const fs = await import('fs/promises');

        // Extract filename and extension from path (always available)
        const pathParts = filePath.split('/');
        const filename = pathParts[pathParts.length - 1];
        const filenameParts = filename.split('.');
        const extension = filenameParts.length > 1 ? filenameParts[filenameParts.length - 1].toLowerCase() : '';

        let fileStats = null;
        let fileType = 'file'; // Default to file
        let fileSize = 0;

        try {
          // Try to get file stats
          fileStats = await fs.stat(filePath);
          fileSize = fileStats.size;
          fileType = fileStats.isDirectory() ? 'directory' : 'file';
        } catch (err) {
          // File might not exist yet or no access - keep defaults
          fileType = 'file';
        }

        // Build resource description
        let resourceDescription = `${fileType === 'directory' ? 'Directory' : 'File'} at: ${filePath}`;
        if (fileType === 'file' && extension) {
          resourceDescription = `${extension.toUpperCase()} file at: ${filePath}`;
        }

        return {
          handleType: 'file',
          path: filePath, // Keep 'path' for consistency with other metadata
          filename,
          extension,
          fileType,
          fileSize,
          resourceDescription,
          capabilities: ['read', 'write'],
          metadata: {
            server: handle.server || 'local',
            isFile: fileType === 'file',
            isDirectory: fileType === 'directory',
            extension,
            sizeBytes: fileSize,
            exists: fileStats !== null
          }
        };
      }
    });

    // Strategy analyzer with rich metadata extraction
    this.analyzers.set('strategy', {
      analyze: async (handle) => {
        // Strategy handles use dataSource to query for metadata
        let strategyMetadata = {};

        try {
          // Query the StrategyDataSource for metadata
          const results = await handle.dataSource.queryAsync({ getMetadata: true });
          if (results && results.length > 0) {
            strategyMetadata = results[0].data || {};
          }
        } catch (err) {
          // If metadata extraction fails, use basic info
          console.warn(`Strategy metadata extraction failed: ${err.message}`);
        }

        const filePath = handle.filePath || handle.dataSource?.filePath || 'unknown';
        const fileName = strategyMetadata.fileName || filePath.split('/').pop();
        const strategyName = strategyMetadata.strategyName || fileName.replace('.js', '');
        const strategyType = strategyMetadata.strategyType || strategyName.toLowerCase();

        // Build capabilities list
        const capabilities = ['instantiate', 'execute'];
        if (strategyMetadata.requiredTools && strategyMetadata.requiredTools.length > 0) {
          capabilities.push(...strategyMetadata.requiredTools.map(t => `uses-${t}`));
        }

        // Build resource description
        let resourceDescription = strategyMetadata.description
          || `${strategyName} strategy for task execution`;

        // Add tool and prompt info to description if available
        if (strategyMetadata.requiredTools && strategyMetadata.requiredTools.length > 0) {
          resourceDescription += ` (requires: ${strategyMetadata.requiredTools.join(', ')})`;
        }

        return {
          handleType: 'strategy',
          strategyName,
          strategyType,
          filePath,
          fileName,
          requiredTools: strategyMetadata.requiredTools || [],
          promptSchemas: strategyMetadata.promptSchemas || [],
          resourceDescription,
          capabilities,
          metadata: {
            server: handle.server || 'local',
            fileSize: strategyMetadata.fileSize,
            lastModified: strategyMetadata.lastModified,
            hasMetadata: Object.keys(strategyMetadata).length > 0
          }
        };
      }
    });

    // Generic fallback analyzer
    this.analyzers.set('generic', {
      analyze: async (handle) => {
        const capabilities = [];
        if (typeof handle.query === 'function') capabilities.push('query');
        if (typeof handle.update === 'function') capabilities.push('update');
        if (typeof handle.subscribe === 'function') capabilities.push('subscribe');

        return {
          handleType: handle.resourceType || 'generic',
          resourceDescription: `Generic handle of type: ${handle.resourceType || 'unknown'}`,
          capabilities,
          metadata: {
            server: handle.server || 'local',
            hasQueryMethod: typeof handle.query === 'function',
            hasUpdateMethod: typeof handle.update === 'function'
          }
        };
      }
    });
  }

  /**
   * Detect handle type from handle object
   * @param {Object} handle - Handle instance
   * @returns {string} Handle type identifier
   */
  detectHandleType(handle) {
    if (!handle) {
      return 'generic';
    }

    // Check resourceType property
    if (handle.resourceType) {
      // If we have an analyzer for this type, return it
      if (this.analyzers.has(handle.resourceType)) {
        return handle.resourceType;
      }
      // Otherwise fall back to generic
      return 'generic';
    }

    // No resourceType, use generic
    return 'generic';
  }

  /**
   * Get analyzer for a handle
   * @param {Object} handle - Handle instance
   * @returns {Object} Analyzer with analyze() method
   */
  getAnalyzer(handle) {
    const handleType = this.detectHandleType(handle);

    // Get analyzer or fall back to generic
    const analyzer = this.analyzers.get(handleType) || this.analyzers.get('generic');

    if (!analyzer) {
      throw new Error(`No analyzer found for handle type: ${handleType}`);
    }

    return analyzer;
  }

  /**
   * Extract metadata from handle
   * @param {Object} handle - Handle instance
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractMetadata(handle) {
    if (!handle) {
      throw new Error('Handle is required for metadata extraction');
    }

    const analyzer = this.getAnalyzer(handle);
    const metadata = await analyzer.analyze(handle);

    return metadata;
  }
}