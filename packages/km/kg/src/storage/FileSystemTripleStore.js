import { ITripleStore } from './ITripleStore.js';
import { StorageError, ValidationError } from './StorageError.js';
import fs from 'fs/promises';
import path from 'path';
import { RDFSerializer } from '../rdf/RDFSerializer.js';
import { RDFParser } from '../rdf/RDFParser.js';

/**
 * File system-based triple store implementation
 * Supports JSON, Turtle, and N-Triples formats with auto-save and file watching
 */
export class FileSystemTripleStore extends ITripleStore {
  constructor(filePath, options = {}) {
    super();
    
    // Validate file path before processing
    if (!filePath || filePath.trim() === '') {
      throw new ValidationError('File path is required');
    }
    
    this.filePath = path.resolve(filePath);
    this.format = options.format || this._detectFormat(filePath);
    this.autoSave = options.autoSave !== false; // Default to true
    this.watchForChanges = options.watchForChanges || false;
    this.encoding = options.encoding || 'utf8';
    
    // In-memory cache for performance
    this.triples = new Map();
    this.tripleData = new Map();
    this.spo = new Map();
    this.pos = new Map();
    this.osp = new Map();
    
    // State management
    this.loaded = false;
    this.dirty = false;
    this.saving = false;
    this.watcher = null;
    
    // Validate configuration
    this._validateConfig();
  }

  getMetadata() {
    return {
      type: 'file',
      supportsTransactions: false,
      supportsPersistence: true,
      supportsAsync: true,
      maxTriples: Infinity,
      filePath: this.filePath,
      format: this.format,
      autoSave: this.autoSave,
      watchForChanges: this.watchForChanges
    };
  }

  /**
   * Load data from file if not already loaded
   */
  async _ensureLoaded() {
    if (!this.loaded) {
      await this.load();
    }
  }

  /**
   * Auto-save if enabled and data is dirty
   */
  async _autoSave() {
    if (this.autoSave && this.dirty && !this.saving) {
      await this.save();
    }
  }

  /**
   * Add a triple to the store
   */
  async addTriple(subject, predicate, object) {
    await this._ensureLoaded();
    
    const triple = [subject, predicate, object];
    const key = this._tripleKey(triple);
    
    if (this.triples.has(key)) return false;
    
    this.triples.set(key, true);
    this.tripleData.set(key, triple);
    this._indexTriple(subject, predicate, object);
    this.dirty = true;
    
    await this._autoSave();
    return true;
  }

  /**
   * Remove a triple from the store
   */
  async removeTriple(subject, predicate, object) {
    await this._ensureLoaded();
    
    const key = this._tripleKey([subject, predicate, object]);
    if (!this.triples.has(key)) return false;
    
    this.triples.delete(key);
    this.tripleData.delete(key);
    this._unindexTriple(subject, predicate, object);
    this.dirty = true;
    
    await this._autoSave();
    return true;
  }

  /**
   * Query triples with pattern matching
   */
  async query(subject, predicate, object) {
    await this._ensureLoaded();
    
    // Use same logic as InMemoryTripleStore
    if (subject !== null && subject !== undefined && 
        predicate !== null && predicate !== undefined && 
        object !== null && object !== undefined) {
      const key = this._tripleKey([subject, predicate, object]);
      return this.triples.has(key) ? [[subject, predicate, object]] : [];
    }

    if ((subject !== null && subject !== undefined) && 
        (predicate !== null && predicate !== undefined)) {
      return this._getObjects(subject, predicate).map(o => [subject, predicate, o]);
    }

    if ((subject !== null && subject !== undefined) && 
        (object !== null && object !== undefined)) {
      return this._getPredicates(subject, object).map(p => [subject, p, object]);
    }

    if ((predicate !== null && predicate !== undefined) && 
        (object !== null && object !== undefined)) {
      return this._getSubjects(predicate, object).map(s => [s, predicate, object]);
    }

    if (subject !== null && subject !== undefined) {
      return this._getAllFromSubject(subject);
    }

    if (predicate !== null && predicate !== undefined) {
      return this._getAllFromPredicate(predicate);
    }

    if (object !== null && object !== undefined) {
      return this._getAllFromObject(object);
    }

    // Return all triples
    return Array.from(this.tripleData.values());
  }

  /**
   * Get the total number of triples
   */
  async size() {
    await this._ensureLoaded();
    return this.triples.size;
  }

  /**
   * Clear all triples
   */
  async clear() {
    this.triples.clear();
    this.tripleData.clear();
    this.spo.clear();
    this.pos.clear();
    this.osp.clear();
    this.dirty = true;
    this.loaded = true;
    
    await this._autoSave();
  }

  /**
   * Save data to file
   */
  async save() {
    if (this.saving) return; // Prevent concurrent saves
    
    this.saving = true;
    try {
      await this._ensureLoaded();
      
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      
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
      
      // Atomic write using temporary file
      const tempPath = this.filePath + '.tmp';
      await fs.writeFile(tempPath, content, this.encoding);
      await fs.rename(tempPath, this.filePath);
      
      this.dirty = false;
    } finally {
      this.saving = false;
    }
  }

  /**
   * Load data from file
   */
  async load() {
    try {
      const content = await fs.readFile(this.filePath, this.encoding);
      
      // Clear existing data
      this.triples.clear();
      this.tripleData.clear();
      this.spo.clear();
      this.pos.clear();
      this.osp.clear();
      
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
        this.triples.set(key, true);
        this.tripleData.set(key, [s, p, o]);
        this._indexTriple(s, p, o);
      }
      
      this.loaded = true;
      this.dirty = false;
      
      // Start file watching if enabled
      if (this.watchForChanges && !this.watcher) {
        this._startWatching();
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, start with empty store
        this.loaded = true;
        this.dirty = false;
      } else {
        throw new StorageError(`Failed to load file: ${error.message}`, 'LOAD_ERROR', error);
      }
    }
  }

  /**
   * Start watching file for external changes
   */
  _startWatching() {
    if (this.watcher) return;
    
    try {
      const fs = require('fs');
      this.watcher = fs.watch(this.filePath, { encoding: 'buffer' }, (eventType) => {
        if (eventType === 'change' && !this.saving) {
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
   */
  _stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Detect file format from extension
   */
  _detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.json': return 'json';
      case '.ttl': case '.turtle': return 'turtle';
      case '.nt': case '.ntriples': return 'ntriples';
      default: return 'json'; // Default to JSON
    }
  }

  /**
   * Validate configuration
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
   */
  _serializeToTurtle(triples) {
    const serializer = new RDFSerializer();
    return serializer.serializeToTurtle(triples);
  }

  /**
   * Serialize triples to N-Triples format
   */
  _serializeToNTriples(triples) {
    const serializer = new RDFSerializer();
    return serializer.serializeToNTriples(triples);
  }

  /**
   * Parse triples from Turtle format
   */
  _parseFromTurtle(content) {
    const parser = new RDFParser();
    return parser.parseFromTurtle(content);
  }

  /**
   * Parse triples from N-Triples format
   */
  _parseFromNTriples(content) {
    const parser = new RDFParser();
    return parser.parseFromNTriples(content);
  }

  // Private indexing methods (same as InMemoryTripleStore)
  _tripleKey([s, p, o]) {
    return `${s}|${p}|${o}`;
  }

  _indexTriple(s, p, o) {
    if (!this.spo.has(s)) this.spo.set(s, new Map());
    if (!this.spo.get(s).has(p)) this.spo.get(s).set(p, new Set());
    this.spo.get(s).get(p).add(o);

    if (!this.pos.has(p)) this.pos.set(p, new Map());
    if (!this.pos.get(p).has(o)) this.pos.get(p).set(o, new Set());
    this.pos.get(p).get(o).add(s);

    if (!this.osp.has(o)) this.osp.set(o, new Map());
    if (!this.osp.get(o).has(s)) this.osp.get(o).set(s, new Set());
    this.osp.get(o).get(s).add(p);
  }

  _unindexTriple(s, p, o) {
    this.spo.get(s)?.get(p)?.delete(o);
    this.pos.get(p)?.get(o)?.delete(s);
    this.osp.get(o)?.get(s)?.delete(p);
  }

  _getObjects(s, p) {
    return Array.from(this.spo.get(s)?.get(p) || []);
  }

  _getSubjects(p, o) {
    return Array.from(this.pos.get(p)?.get(o) || []);
  }

  _getPredicates(s, o) {
    return Array.from(this.osp.get(o)?.get(s) || []);
  }

  _getAllFromSubject(s) {
    const results = [];
    const predicates = this.spo.get(s);
    if (predicates) {
      for (const [p, objects] of predicates) {
        for (const o of objects) {
          results.push([s, p, o]);
        }
      }
    }
    return results;
  }

  _getAllFromPredicate(p) {
    const results = [];
    const objects = this.pos.get(p);
    if (objects) {
      for (const [o, subjects] of objects) {
        for (const s of subjects) {
          results.push([s, p, o]);
        }
      }
    }
    return results;
  }

  _getAllFromObject(o) {
    const results = [];
    const subjects = this.osp.get(o);
    if (subjects) {
      for (const [s, predicates] of subjects) {
        for (const p of predicates) {
          results.push([s, p, o]);
        }
      }
    }
    return results;
  }

  /**
   * Cleanup resources
   */
  async close() {
    this._stopWatching();
    if (this.dirty) {
      await this.save();
    }
  }
}
