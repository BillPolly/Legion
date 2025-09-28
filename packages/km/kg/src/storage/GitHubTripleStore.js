import { ITripleStore, StorageError, ValidationError } from '@legion/triplestore';
// Define additional error types locally since they're not in triplestore yet
class NetworkError extends StorageError {
  constructor(message, statusCode = null) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
  }
}

class AuthenticationError extends StorageError {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
import { GitHubClient } from './GitHubClient.js';
import { ConflictResolver } from './ConflictResolver.js';

/**
 * GitHub-based triple store implementation
 * Enables collaborative knowledge graph storage using GitHub repositories
 */
export class GitHubTripleStore extends ITripleStore {
  constructor(repo, path, options = {}) {
    super();
    
    // Parse repository string
    this.repo = this._parseRepo(repo);
    this.path = path || 'knowledge-graph.json';
    this.branch = options.branch || 'main';
    this.format = options.format || this._detectFormat(this.path);
    this.conflictResolution = options.conflictResolution || 'merge';
    this.autoCommit = options.autoCommit !== false; // Default to true
    this.commitMessage = options.commitMessage || 'Update knowledge graph';
    
    // GitHub client
    this.client = new GitHubClient({
      token: options.token,
      timeout: options.timeout,
      retries: options.retries
    });
    
    // Conflict resolver
    this.conflictResolver = new ConflictResolver(this.conflictResolution);
    
    // In-memory cache for performance
    this.triples = new Map();
    this.tripleData = new Map();
    this.spo = new Map();
    this.pos = new Map();
    this.osp = new Map();
    
    // State management
    this.loaded = false;
    this.dirty = false;
    this.lastSha = null;
    this.lastCommit = null;
    
    this._validateConfig();
  }

  getMetadata() {
    return {
      type: 'github',
      supportsTransactions: false,
      supportsPersistence: true,
      supportsAsync: true,
      maxTriples: Infinity,
      repo: `${this.repo.owner}/${this.repo.name}`,
      path: this.path,
      branch: this.branch,
      format: this.format,
      conflictResolution: this.conflictResolution,
      autoCommit: this.autoCommit,
      lastSha: this.lastSha,
      lastCommit: this.lastCommit
    };
  }

  /**
   * Load data from GitHub if not already loaded
   */
  async _ensureLoaded() {
    if (!this.loaded) {
      await this.load();
    }
  }

  /**
   * Auto-commit if enabled and data is dirty
   */
  async _autoCommit() {
    if (this.autoCommit && this.dirty) {
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
    
    await this._autoCommit();
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
    
    await this._autoCommit();
    return true;
  }

  /**
   * Query triples with pattern matching
   */
  async query(subject, predicate, object) {
    await this._ensureLoaded();
    
    // Use same logic as other stores
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
    
    await this._autoCommit();
  }

  /**
   * Save data to GitHub
   */
  async save(commitMessage = null) {
    await this._ensureLoaded();
    
    try {
      // Get current file state from GitHub
      const currentMetadata = await this.client.getFileMetadata(
        this.repo.owner, 
        this.repo.name, 
        this.path, 
        this.branch
      );
      
      // Check for conflicts if file exists and we have a different SHA
      if (currentMetadata && currentMetadata.sha !== this.lastSha) {
        await this._handleConflict(currentMetadata.sha);
      }
      
      // Serialize triples
      const triples = Array.from(this.tripleData.values());
      const content = this._serializeTriples(triples);
      
      // Commit to GitHub
      const message = commitMessage || this.commitMessage;
      const result = await this.client.putFile(
        this.repo.owner,
        this.repo.name,
        this.path,
        content,
        message,
        this.lastSha,
        this.branch
      );
      
      // Update state
      this.lastSha = result.sha;
      this.lastCommit = result.commit;
      this.dirty = false;
      
      return result;
      
    } catch (error) {
      if (error instanceof NetworkError || error instanceof AuthenticationError) {
        throw error;
      }
      throw new StorageError(`Failed to save to GitHub: ${error.message}`, 'SAVE_ERROR', error);
    }
  }

  /**
   * Load data from GitHub
   */
  async load() {
    try {
      // Get file content and metadata
      const fileData = await this.client.getFile(
        this.repo.owner,
        this.repo.name,
        this.path,
        this.branch
      );
      
      if (!fileData) {
        // File doesn't exist, start with empty store
        this._initializeEmpty();
        return;
      }
      
      // Get metadata for SHA
      const metadata = await this.client.getFileMetadata(
        this.repo.owner,
        this.repo.name,
        this.path,
        this.branch
      );
      
      // Clear existing data
      this.triples.clear();
      this.tripleData.clear();
      this.spo.clear();
      this.pos.clear();
      this.osp.clear();
      
      // Parse content
      const triples = this._parseTriples(fileData.content);
      
      // Load triples into memory
      for (const [s, p, o] of triples) {
        const key = this._tripleKey([s, p, o]);
        this.triples.set(key, true);
        this.tripleData.set(key, [s, p, o]);
        this._indexTriple(s, p, o);
      }
      
      // Update state
      this.lastSha = metadata?.sha;
      this.loaded = true;
      this.dirty = false;
      
    } catch (error) {
      if (error instanceof NetworkError || error instanceof AuthenticationError) {
        throw error;
      }
      throw new StorageError(`Failed to load from GitHub: ${error.message}`, 'LOAD_ERROR', error);
    }
  }

  /**
   * Handle merge conflicts
   */
  async _handleConflict(remoteSha) {
    try {
      // Get remote content
      const remoteData = await this.client.getFile(
        this.repo.owner,
        this.repo.name,
        this.path,
        this.branch
      );
      
      if (!remoteData) {
        // Remote file was deleted, keep local changes
        return;
      }
      
      // Parse remote triples
      const remoteTriples = this._parseTriples(remoteData.content);
      const localTriples = Array.from(this.tripleData.values());
      
      // Resolve conflict
      const resolution = await this.conflictResolver.resolveConflict(
        localTriples,
        remoteTriples,
        {
          localSha: this.lastSha,
          remoteSha,
          timestamp: new Date().toISOString()
        }
      );
      
      if (!resolution.resolved) {
        throw new StorageError(
          `Merge conflict requires manual resolution: ${resolution.resolution.message}`,
          'MERGE_CONFLICT',
          resolution
        );
      }
      
      // Apply resolved triples
      this.triples.clear();
      this.tripleData.clear();
      this.spo.clear();
      this.pos.clear();
      this.osp.clear();
      
      for (const [s, p, o] of resolution.triples) {
        const key = this._tripleKey([s, p, o]);
        this.triples.set(key, true);
        this.tripleData.set(key, [s, p, o]);
        this._indexTriple(s, p, o);
      }
      
      // Update SHA to remote version
      this.lastSha = remoteSha;
      this.dirty = true; // Mark as dirty to save merged result
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to resolve conflict: ${error.message}`, 'CONFLICT_ERROR', error);
    }
  }

  /**
   * Initialize empty store
   */
  _initializeEmpty() {
    this.triples.clear();
    this.tripleData.clear();
    this.spo.clear();
    this.pos.clear();
    this.osp.clear();
    this.lastSha = null;
    this.loaded = true;
    this.dirty = false;
  }

  /**
   * Parse repository string
   */
  _parseRepo(repo) {
    if (typeof repo === 'object') {
      return repo;
    }
    
    const parts = repo.split('/');
    if (parts.length !== 2) {
      throw new ValidationError('Repository must be in format "owner/name"');
    }
    
    return {
      owner: parts[0],
      name: parts[1]
    };
  }

  /**
   * Detect file format from extension
   */
  _detectFormat(path) {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json': return 'json';
      case 'ttl': case 'turtle': return 'turtle';
      case 'nt': case 'ntriples': return 'ntriples';
      default: return 'json';
    }
  }

  /**
   * Serialize triples to string
   */
  _serializeTriples(triples) {
    switch (this.format) {
      case 'json':
        return JSON.stringify(triples, null, 2);
      case 'turtle':
        // Would use RDFSerializer here
        return this._serializeToTurtle(triples);
      case 'ntriples':
        // Would use RDFSerializer here
        return this._serializeToNTriples(triples);
      default:
        throw new StorageError(`Unsupported format: ${this.format}`);
    }
  }

  /**
   * Parse triples from string
   */
  _parseTriples(content) {
    switch (this.format) {
      case 'json':
        return JSON.parse(content);
      case 'turtle':
        // Would use RDFParser here
        return this._parseFromTurtle(content);
      case 'ntriples':
        // Would use RDFParser here
        return this._parseFromNTriples(content);
      default:
        throw new StorageError(`Unsupported format: ${this.format}`);
    }
  }

  /**
   * Placeholder for Turtle serialization
   */
  _serializeToTurtle(triples) {
    // Simple implementation - would use RDFSerializer in real implementation
    return triples.map(([s, p, o]) => `<${s}> <${p}> "${o}" .`).join('\n');
  }

  /**
   * Placeholder for N-Triples serialization
   */
  _serializeToNTriples(triples) {
    // Simple implementation - would use RDFSerializer in real implementation
    return triples.map(([s, p, o]) => `<${s}> <${p}> "${o}" .`).join('\n');
  }

  /**
   * Placeholder for Turtle parsing
   */
  _parseFromTurtle(content) {
    // Simple implementation - would use RDFParser in real implementation
    return content.split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const match = line.match(/<([^>]+)>\s+<([^>]+)>\s+"([^"]+)"/);
        return match ? [match[1], match[2], match[3]] : null;
      })
      .filter(Boolean);
  }

  /**
   * Placeholder for N-Triples parsing
   */
  _parseFromNTriples(content) {
    // Simple implementation - would use RDFParser in real implementation
    return this._parseFromTurtle(content);
  }

  /**
   * Validate configuration
   */
  _validateConfig() {
    if (!this.repo.owner || !this.repo.name) {
      throw new ValidationError('Repository owner and name are required');
    }
    
    if (!this.path) {
      throw new ValidationError('File path is required');
    }
    
    const supportedFormats = ['json', 'turtle', 'ntriples'];
    if (!supportedFormats.includes(this.format)) {
      throw new ValidationError(`Unsupported format: ${this.format}. Supported: ${supportedFormats.join(', ')}`);
    }
  }

  // Private indexing methods (same as other stores)
  _tripleKey([s, p, o]) {
    return `${s}|${p}|${JSON.stringify(o)}`;
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
   * Get repository information
   */
  async getRepositoryInfo() {
    return await this.client.getRepository(this.repo.owner, this.repo.name);
  }

  /**
   * List available branches
   */
  async getBranches() {
    return await this.client.getBranches(this.repo.owner, this.repo.name);
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(branchName) {
    if (this.dirty) {
      throw new StorageError('Cannot switch branches with unsaved changes. Save or discard changes first.');
    }
    
    this.branch = branchName;
    this.loaded = false;
    this.lastSha = null;
    this.lastCommit = null;
    
    // Reload from new branch
    await this.load();
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName, fromBranch = null) {
    const sourceBranch = fromBranch || this.branch;
    return await this.client.createBranch(this.repo.owner, this.repo.name, branchName, sourceBranch);
  }

  /**
   * Cleanup resources
   */
  async close() {
    if (this.dirty && this.autoCommit) {
      await this.save();
    }
  }
}
