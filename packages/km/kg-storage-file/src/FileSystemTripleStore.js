import { ITripleStore, StorageError, ValidationError } from '@legion/kg-storage-core';
import fs from 'fs/promises';
import path from 'path';
import { RDFSerializer, RDFParser } from '@legion/kg-rdf';

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
      
      // Try to create directory - this might fail if we don't have permissions
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (mkdirError) {
        // If we can't create the directory, we can't save
        // This is expected for invalid paths like /invalid/...
        this.saving = false;
        throw new StorageError(`Cannot create directory: ${mkdirError.message}`, 'SAVE_ERROR', mkdirError);
      }
      
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
    } catch (error) {
      this.saving = false;
      throw error;
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
        // Make sure the data structures are initialized (they should be from constructor but just in case)
        if (!this.triples) this.triples = new Map();
        if (!this.tripleData) this.tripleData = new Map();
        if (!this.spo) this.spo = new Map();
        if (!this.pos) this.pos = new Map();
        if (!this.osp) this.osp = new Map();
        
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
          // Literal
          const literalMatch = objectPart.match(/^"([^"]*)"(?:\^\^.*)?$/);
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
      try {
        await this.save();
      } catch (error) {
        // Log error but don't throw - close should always succeed
        console.error(`Failed to save on close: ${error.message}`);
      }
    }
  }
}
