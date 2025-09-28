/**
 * TripleIndex - Shared indexing utilities for triple storage
 * 
 * Maintains three indices for fast queries:
 * - SPO: Subject → Predicate → Objects
 * - POS: Predicate → Object → Subjects  
 * - OSP: Object → Subject → Predicates
 * 
 * This class is used by InMemoryProvider and can be reused by other providers.
 */
export class TripleIndex {
  constructor() {
    this.spo = new Map(); // subject -> predicate -> objects
    this.pos = new Map(); // predicate -> object -> subjects  
    this.osp = new Map(); // object -> subject -> predicates
  }

  /**
   * Add a triple to all three indices
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   */
  addTriple(subject, predicate, object) {
    // SPO index
    if (!this.spo.has(subject)) {
      this.spo.set(subject, new Map());
    }
    if (!this.spo.get(subject).has(predicate)) {
      this.spo.get(subject).set(predicate, new Set());
    }
    this.spo.get(subject).get(predicate).add(object);

    // POS index  
    if (!this.pos.has(predicate)) {
      this.pos.set(predicate, new Map());
    }
    if (!this.pos.get(predicate).has(object)) {
      this.pos.get(predicate).set(object, new Set());
    }
    this.pos.get(predicate).get(object).add(subject);

    // OSP index
    if (!this.osp.has(object)) {
      this.osp.set(object, new Map());
    }
    if (!this.osp.get(object).has(subject)) {
      this.osp.get(object).set(subject, new Set());
    }
    this.osp.get(object).get(subject).add(predicate);
  }

  /**
   * Remove a triple from all three indices
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   */
  removeTriple(subject, predicate, object) {
    // Remove from SPO
    this.spo.get(subject)?.get(predicate)?.delete(object);
    
    // Clean up empty sets and maps in SPO
    if (this.spo.get(subject)?.get(predicate)?.size === 0) {
      this.spo.get(subject).delete(predicate);
    }
    if (this.spo.get(subject)?.size === 0) {
      this.spo.delete(subject);
    }

    // Remove from POS
    this.pos.get(predicate)?.get(object)?.delete(subject);
    
    // Clean up empty sets and maps in POS
    if (this.pos.get(predicate)?.get(object)?.size === 0) {
      this.pos.get(predicate).delete(object);
    }
    if (this.pos.get(predicate)?.size === 0) {
      this.pos.delete(predicate);
    }

    // Remove from OSP
    this.osp.get(object)?.get(subject)?.delete(predicate);
    
    // Clean up empty sets and maps in OSP
    if (this.osp.get(object)?.get(subject)?.size === 0) {
      this.osp.get(object).delete(subject);
    }
    if (this.osp.get(object)?.size === 0) {
      this.osp.delete(object);
    }
  }

  /**
   * Get all objects for a subject-predicate pair
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @returns {Array} - Array of objects
   */
  getObjects(subject, predicate) {
    return Array.from(this.spo.get(subject)?.get(predicate) || []);
  }

  /**
   * Get all subjects for a predicate-object pair
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   * @returns {Array} - Array of subjects
   */
  getSubjects(predicate, object) {
    return Array.from(this.pos.get(predicate)?.get(object) || []);
  }

  /**
   * Get all predicates connecting a subject and object
   * @param {string|number} subject - The subject
   * @param {string|number|boolean} object - The object
   * @returns {Array} - Array of predicates
   */
  getPredicates(subject, object) {
    return Array.from(this.osp.get(object)?.get(subject) || []);
  }

  /**
   * Get all triples with a given subject
   * @param {string|number} subject - The subject
   * @returns {Array<[subject, predicate, object]>} - Array of triples
   */
  getAllFromSubject(subject) {
    const results = [];
    const predicates = this.spo.get(subject);
    if (predicates) {
      for (const [predicate, objects] of predicates) {
        for (const object of objects) {
          results.push([subject, predicate, object]);
        }
      }
    }
    return results;
  }

  /**
   * Get all triples with a given predicate
   * @param {string} predicate - The predicate
   * @returns {Array<[subject, predicate, object]>} - Array of triples
   */
  getAllFromPredicate(predicate) {
    const results = [];
    const objects = this.pos.get(predicate);
    if (objects) {
      for (const [object, subjects] of objects) {
        for (const subject of subjects) {
          results.push([subject, predicate, object]);
        }
      }
    }
    return results;
  }

  /**
   * Get all triples with a given object
   * @param {string|number|boolean} object - The object
   * @returns {Array<[subject, predicate, object]>} - Array of triples
   */
  getAllFromObject(object) {
    const results = [];
    const subjects = this.osp.get(object);
    if (subjects) {
      for (const [subject, predicates] of subjects) {
        for (const predicate of predicates) {
          results.push([subject, predicate, object]);
        }
      }
    }
    return results;
  }

  /**
   * Clear all indices
   */
  clear() {
    this.spo.clear();
    this.pos.clear();
    this.osp.clear();
  }
}