import { ITripleStore } from '../core/ITripleStore.js';
import { StorageError, ValidationError } from '../core/StorageError.js';
import { TripleIndex } from '../utils/TripleIndex.js';

/**
 * FileSystemProvider - File-based persistent triple store implementation
 * 
 * Features:
 * - Auto-save on changes
 * - File watching for external updates
 * - Multiple formats: JSON, Turtle, N-Triples
 * - Atomic writes via temp files
 * - Works with any filesystem DataSource (Local, Remote, etc.)
 * 
 * Runtime: ✅ Universal - Works on client and server via DataSource abstraction
 * 
 * Migrated from: /packages/km/kg-storage-file/
 */
export class FileSystemProvider extends ITripleStore {
  constructor(dataSource, filePath, options = {}) {
    super();
    
    // Validate DataSource
    if (!dataSource || typeof dataSource.query !== 'function' || typeof dataSource.update !== 'function') {
      throw new ValidationError('Valid DataSource with query() and update() methods is required');
    }
    
    // Validate file path before processing
    if (!filePath || (typeof filePath === 'string' && filePath.trim() === '')) {
      throw new ValidationError('File path is required');
    }
    
    this.dataSource = dataSource;
    this.filePath = this._normalizePath(filePath);
    this.format = options.format || this._detectFormat(filePath);
    this.autoSave = options.autoSave !== false; // Default to true
    this.watchForChanges = options.watchForChanges || false;
    this.encoding = options.encoding || 'utf8';
    
    // In-memory cache for performance
    this.triples = new Set();
    this.tripleData = new Map();
    this.index = new TripleIndex();
    
    // State management
    this.loaded = false;
    this.dirty = false;
    this.saving = false;
    this.watcher = null;
    
    // Validate configuration
    this._validateConfig();
  }

  /**
   * Get metadata about this provider
   * @returns {Object} - Provider metadata
   */
  getMetadata() {
    return {
      type: 'file',
      supportsTransactions: false,
      supportsPersistence: true,
      supportsAsync: true,
      filePath: this.filePath,
      format: this.format,
      autoSave: this.autoSave,
      watchForChanges: this.watchForChanges
    };
  }

  /**
   * Load data from file if not already loaded
   * @private
   */
  async _ensureLoaded() {
    if (!this.loaded) {
      await this.load();
    }
  }

  /**
   * Auto-save if enabled and data is dirty
   * @private
   */
  async _autoSave() {
    if (this.autoSave && this.dirty && !this.saving) {
      await this.save();
    }
  }

  /**
   * Add a triple to the store
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   * @returns {Promise<boolean>} - True if added, false if already exists
   */
  async addTriple(subject, predicate, object) {
    await this._ensureLoaded();
    
    const triple = [subject, predicate, object];
    const key = this._tripleKey(triple);
    
    if (this.triples.has(key)) return false;
    
    this.triples.add(key);
    this.tripleData.set(key, triple);
    this.index.addTriple(subject, predicate, object);
    this.dirty = true;
    
    await this._autoSave();
    return true;
  }

  /**
   * Remove a triple from the store
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   * @returns {Promise<boolean>} - True if removed, false if not found
   */
  async removeTriple(subject, predicate, object) {
    await this._ensureLoaded();
    
    const key = this._tripleKey([subject, predicate, object]);
    if (!this.triples.has(key)) return false;
    
    this.triples.delete(key);
    this.tripleData.delete(key);
    this.index.removeTriple(subject, predicate, object);
    this.dirty = true;
    
    await this._autoSave();
    return true;
  }

  /**
   * Query triples with pattern matching
   * @param {string|number|null} subject - Subject or null for wildcard
   * @param {string|null} predicate - Predicate or null for wildcard
   * @param {string|number|boolean|null} object - Object or null for wildcard
   * @returns {Promise<Array<[subject, predicate, object]>>} - Array of matching triples
   */
  async query(subject, predicate, object) {
    await this._ensureLoaded();
    
    // Use same query logic as InMemoryProvider
    if (subject !== null && subject !== undefined && 
        predicate !== null && predicate !== undefined && 
        object !== null && object !== undefined) {
      const key = this._tripleKey([subject, predicate, object]);
      return this.triples.has(key) ? [[subject, predicate, object]] : [];
    }

    if ((subject !== null && subject !== undefined) && 
        (predicate !== null && predicate !== undefined)) {
      return this.index.getObjects(subject, predicate).map(o => [subject, predicate, o]);
    }

    if ((subject !== null && subject !== undefined) && 
        (object !== null && object !== undefined)) {
      return this.index.getPredicates(subject, object).map(p => [subject, p, object]);
    }

    if ((predicate !== null && predicate !== undefined) && 
        (object !== null && object !== undefined)) {
      return this.index.getSubjects(predicate, object).map(s => [s, predicate, object]);
    }

    if (subject !== null && subject !== undefined) {
      return this.index.getAllFromSubject(subject);
    }

    if (predicate !== null && predicate !== undefined) {
      return this.index.getAllFromPredicate(predicate);
    }

    if (object !== null && object !== undefined) {
      return this.index.getAllFromObject(object);
    }

    // Return all triples
    return Array.from(this.tripleData.values());
  }

  /**
   * Get the total number of triples
   * @returns {Promise<number>} - Count of triples
   */
  async size() {
    await this._ensureLoaded();
    return this.triples.size;
  }

  /**
   * Clear all triples
   * @returns {Promise<void>}
   */
  async clear() {
    this.triples.clear();
    this.tripleData.clear();
    this.index.clear();
    this.dirty = true;
    this.loaded = true;
    
    await this._autoSave();
  }

  /**
   * Save data to file
   * @returns {Promise<void>}
   */
  async save() {
    if (this.saving) return; // Prevent concurrent saves
    
    this.saving = true;
    try {
      await this._ensureLoaded();
      
      // Get all triples
      const triples = Array.from(this.tripleData.values());
      
      // Serialize based on format
      let content;
      switch (this.format) {
        case 'json':
          content = JSON.stringify(triples, null, 2);
          break;
        case 'turtle':
          content = this._serializeToTurtle(triples);
          break;
        case 'ntriples':
          content = this._serializeToNTriples(triples);
          break;
        default:
          throw new StorageError(`Unsupported format: ${this.format}`);
      }
      
      // Write file via DataSource
      const result = this.dataSource.update(this.filePath, {
        operation: 'write',
        content: content,
        options: {
          encoding: this.encoding,
          createParents: true
        }
      });
      
      if (!result.success) {
        throw new StorageError(`Failed to write file: ${result.error}`, 'SAVE_ERROR');
      }
      
      this.dirty = false;
    } catch (error) {
      this.saving = false;
      throw error;
    } finally {
      this.saving = false;
    }
  }

  /**
   * Load data from file
   * @returns {Promise<void>}
   */
  async load() {
    try {
      // Read file via DataSource
      const querySpec = {
        find: ['content'],
        where: [['file', this.filePath, 'content']],
        options: { encoding: this.encoding }
      };
      
      const results = this.dataSource.query(querySpec);
      
      if (!Array.isArray(results) || results.length === 0) {
        // File doesn't exist, start with empty store
        this.loaded = true;
        this.dirty = false;
        return;
      }
      
      const content = results[0];
      
      // Clear existing data
      this.triples.clear();
      this.tripleData.clear();
      this.index.clear();
      
      // Parse based on format
      let triples;
      switch (this.format) {
        case 'json':
          triples = JSON.parse(content);
          break;
        case 'turtle':
          triples = this._parseFromTurtle(content);
          break;
        case 'ntriples':
          triples = this._parseFromNTriples(content);
          break;
        default:
          throw new StorageError(`Unsupported format: ${this.format}`);
      }
      
      // Load triples into memory
      for (const [s, p, o] of triples) {
        const key = this._tripleKey([s, p, o]);
        this.triples.add(key);
        this.tripleData.set(key, [s, p, o]);
        this.index.addTriple(s, p, o);
      }
      
      this.loaded = true;
      this.dirty = false;
      
      // Start file watching if enabled
      if (this.watchForChanges && !this.watcher) {
        this._startWatching();
      }
      
    } catch (error) {
      // File doesn't exist or read error
      if (error.message && error.message.includes('not found')) {
        this.loaded = true;
        this.dirty = false;
      } else {
        throw new StorageError(`Failed to load file: ${error.message}`, 'LOAD_ERROR', error);
      }
    }
  }

  /**
   * Start watching file for external changes
   * @private
   */
  _startWatching() {
    if (this.watcher) return;
    
    try {
      // Subscribe to file changes via DataSource
      const querySpec = {
        find: ['event', 'data'],
        where: [
          ['file', this.filePath, 'change'],
          ['event', '?event'],
          ['data', '?data']
        ]
      };
      
      this.watcher = this.dataSource.subscribe(querySpec, (results) => {
        if (!this.saving) {
          // Reload file if changed externally
          this.loaded = false;
          this._ensureLoaded().catch(console.error);
        }
      });
    } catch (error) {
      console.warn('File watching not available:', error.message);
    }
  }

  /**
   * Stop watching file
   * @private
   */
  _stopWatching() {
    if (this.watcher && typeof this.watcher.unsubscribe === 'function') {
      this.watcher.unsubscribe();
      this.watcher = null;
    }
  }

  /**
   * Normalize path to use forward slashes
   * @private
   * @param {string} filePath - The file path
   * @returns {string} - Normalized path
   */
  _normalizePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new ValidationError('File path must be a non-empty string');
    }
    // Normalize to forward slashes for consistency
    return filePath.replace(/\\/g, '/');
  }
  
  /**
   * Detect file format from extension
   * @private
   * @param {string} filePath - The file path
   * @returns {string} - Detected format
   */
  _detectFormat(filePath) {
    const normalized = this._normalizePath(filePath);
    const lastDot = normalized.lastIndexOf('.');
    if (lastDot < 0) return 'json'; // No extension, default to JSON
    
    const ext = normalized.substring(lastDot).toLowerCase();
    switch (ext) {
      case '.json': return 'json';
      case '.ttl': case '.turtle': return 'turtle';
      case '.nt': case '.ntriples': return 'ntriples';
      default: return 'json'; // Default to JSON
    }
  }

  /**
   * Validate configuration
   * @private
   */
  _validateConfig() {
    if (!this.filePath || this.filePath.trim() === '') {
      throw new ValidationError('File path is required');
    }
    
    const supportedFormats = ['json', 'turtle', 'ntriples'];
    if (!supportedFormats.includes(this.format)) {
      throw new ValidationError(`Unsupported format: ${this.format}. Supported: ${supportedFormats.join(', ')}`);
    }
  }

  /**
   * Serialize triples to Turtle format
   * @private
   * @param {Array<Array>} triples - Array of triples
   * @returns {string} - Turtle string
   */
  _serializeToTurtle(triples) {
    // Simple Turtle serialization without namespaces
    let turtle = '';
    for (const [s, p, o] of triples) {
      // Format subject
      const subject = s.startsWith('http') ? `<${s}>` : s;
      // Format predicate
      const predicate = p.startsWith('http') ? `<${p}>` : p;
      // Format object - if it's a literal (doesn't start with http and doesn't contain ':')
      let object;
      if (typeof o === 'string' && !o.startsWith('http') && !o.includes(':')) {
        // Escape quotes in string literals
        object = `"${o.replace(/"/g, '\\"')}"`;
      } else if (typeof o === 'number') {
        object = `"${o}"^^xsd:integer`;
      } else if (typeof o === 'boolean') {
        object = `"${o}"^^xsd:boolean`;
      } else {
        object = o.startsWith('http') ? `<${o}>` : o;
      }
      turtle += `${subject} ${predicate} ${object} .\n`;
    }
    return turtle;
  }

  /**
   * Serialize triples to N-Triples format
   * @private
   * @param {Array<Array>} triples - Array of triples
   * @returns {string} - N-Triples string
   */
  _serializeToNTriples(triples) {
    // N-Triples format - all URIs in angle brackets
    let ntriples = '';
    for (const [s, p, o] of triples) {
      // Format subject (always a URI)
      const subject = `<${s}>`;
      // Format predicate (always a URI)
      const predicate = `<${p}>`;
      // Format object
      let object;
      if (typeof o === 'string' && !o.startsWith('http') && !o.includes(':')) {
        // String literal
        object = `"${o.replace(/"/g, '\\"')}"`;
      } else if (typeof o === 'number') {
        object = `"${o}"^^<http://www.w3.org/2001/XMLSchema#integer>`;
      } else if (typeof o === 'boolean') {
        object = `"${o}"^^<http://www.w3.org/2001/XMLSchema#boolean>`;
      } else {
        // URI
        object = `<${o}>`;
      }
      ntriples += `${subject} ${predicate} ${object} .\n`;
    }
    return ntriples;
  }

  /**
   * Parse triples from Turtle format
   * @private
   * @param {string} content - Turtle content
   * @returns {Array<Array>} - Array of triples
   */
  _parseFromTurtle(content) {
    // Simple Turtle parser - handles basic triple format
    const triples = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('@')) continue;
      
      // Basic triple pattern: subject predicate object .
      const match = trimmed.match(/^(.+?)\s+(.+?)\s+(.+?)\s*\.\s*$/);
      if (match) {
        let [, subject, predicate, object] = match;
        
        // Remove angle brackets if present
        subject = subject.replace(/^<|>$/g, '');
        predicate = predicate.replace(/^<|>$/g, '');
        
        // Parse object - could be URI or literal
        if (object.startsWith('"')) {
          // String literal - extract value, handling escaped quotes
          const literalMatch = object.match(/^"((?:[^"\\]|\\.)*)"/);
          if (literalMatch) {
            // Unescape the quotes and backslashes
            object = literalMatch[1]
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
          }
        } else {
          // Remove angle brackets if present
          object = object.replace(/^<|>$/g, '');
        }
        
        triples.push([subject, predicate, object]);
      }
    }
    
    return triples;
  }

  /**
   * Parse triples from N-Triples format
   * @private
   * @param {string} content - N-Triples content
   * @returns {Array<Array>} - Array of triples
   */
  _parseFromNTriples(content) {
    // N-Triples parser - simpler format than Turtle
    const triples = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // N-Triples pattern: <subject> <predicate> <object> .
      const match = trimmed.match(/^<([^>]+)>\s+<([^>]+)>\s+(.+?)\s*\.\s*$/);
      if (match) {
        const [, subject, predicate, objectPart] = match;
        let object;
        
        // Parse object - could be URI or literal
        if (objectPart.startsWith('<')) {
          // URI
          const uriMatch = objectPart.match(/^<([^>]+)>$/);
          if (uriMatch) {
            object = uriMatch[1];
          }
        } else if (objectPart.startsWith('"')) {
          // Literal - match escaped characters properly
          const literalMatch = objectPart.match(/^"((?:[^"\\]|\\.)*)"(?:\^\^.*)?$/);
          if (literalMatch) {
            object = literalMatch[1].replace(/\\"/g, '"');
          }
        }
        
        if (subject && predicate && object !== undefined) {
          triples.push([subject, predicate, object]);
        }
      }
    }
    
    return triples;
  }

  /**
   * Generate a unique key for a triple
   * @private
   * @param {Array} triple - [subject, predicate, object]
   * @returns {string} - Unique key
   */
  _tripleKey([subject, predicate, object]) {
    return `${subject}|${predicate}|${object}`;
  }

  /**
   * Cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    this._stopWatching();
    if (this.dirty) {
      try {
        await this.save();
      } catch (error) {
        // Log error but don't throw - close should always succeed
        console.error(`Failed to save on close: ${error.message}`);
      }
    }
  }
}