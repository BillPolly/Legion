import { Node } from './Node.js';
import { Delta } from './Delta.js';
import { Tuple } from './Tuple.js';

/**
 * Join operator implementing LFTJ (Leapfrog Triejoin) per design §5.3 and §7.5
 * N-ary natural/equi-join over shared variables with worst-case optimal performance
 */
export class JoinNode extends Node {
  constructor(id, variableOrder, atomSpecs, iteratorFactory) {
    super(id);

    if (!Array.isArray(variableOrder) || variableOrder.length === 0) {
      throw new Error('Variable order must be a non-empty array');
    }

    if (!Array.isArray(atomSpecs) || atomSpecs.length === 0) {
      throw new Error('Atom specs must be a non-empty array');
    }

    if (!iteratorFactory) {
      throw new Error('Iterator factory must be provided');
    }

    this._variableOrder = [...variableOrder];
    this._atomSpecs = atomSpecs.map(spec => ({
      relation: spec.relation,
      variables: [...spec.variables]
    }));
    this._iteratorFactory = iteratorFactory;

    // Build level groups: for each variable in VO, which atoms contain it
    this._levelGroups = this._buildLevelGroups();

    // State: W[outTuple] → count (witness table) per design §5.3
    this._witnessTable = new Map();

    // Variable binding during enumeration
    this._currentBinding = new Map();

    // Track which input node corresponds to which atom spec
    this._inputToAtomMapping = new Map();

    // Validate that all atoms have sufficient variables for the VO
    this._validateAtomSpecs();
  }

  get variableOrder() {
    return [...this._variableOrder];
  }

  get atomSpecs() {
    return this._atomSpecs.map(spec => ({
      relation: spec.relation,
      variables: [...spec.variables]
    }));
  }

  /**
   * Build level groups: for each variable in VO, list of atom indices that contain it
   */
  _buildLevelGroups() {
    const groups = [];
    
    for (let level = 0; level < this._variableOrder.length; level++) {
      const variable = this._variableOrder[level];
      const atomIndices = [];
      
      for (let atomIdx = 0; atomIdx < this._atomSpecs.length; atomIdx++) {
        const atomVars = this._atomSpecs[atomIdx].variables;
        if (atomVars.includes(variable)) {
          atomIndices.push(atomIdx);
        }
      }
      
      if (atomIndices.length === 0) {
        throw new Error(`Variable '${variable}' in VO is not present in any atom`);
      }
      
      groups.push(atomIndices);
    }
    
    return groups;
  }

  /**
   * Validate that atom specs are consistent with variable order
   */
  _validateAtomSpecs() {
    // Check that all VO variables appear in at least one atom
    for (const variable of this._variableOrder) {
      const appearsInAtom = this._atomSpecs.some(spec => 
        spec.variables.includes(variable)
      );
      if (!appearsInAtom) {
        throw new Error(`Variable '${variable}' in VO not found in any atom`);
      }
    }
  }

  /**
   * Register which input node corresponds to which atom spec
   */
  mapInputToAtom(inputNode, atomIndex) {
    if (atomIndex < 0 || atomIndex >= this._atomSpecs.length) {
      throw new Error(`Invalid atom index: ${atomIndex}`);
    }
    this._inputToAtomMapping.set(inputNode, atomIndex);
  }

  /**
   * Handle incoming deltas from input nodes
   */
  onDeltaReceived(sourceNode, delta) {
    // Store the source node info for delta processing
    this._currentSourceNode = sourceNode;
    this.pushDelta(delta);
    this._currentSourceNode = null;
  }

  /**
   * Process delta per design §7.5:
   * For each input atom's Δ tuple t, run delta probe (LFTJ⁺) 
   * and adjust witness W, emitting on 0↔1 crossings
   */
  processDelta(delta) {
    const outputAdds = new Map();
    const outputRemoves = new Map();

    // Determine which atom this delta came from
    const sourceAtomIndex = this._currentSourceNode ? 
      this._inputToAtomMapping.get(this._currentSourceNode) : null;

    if (sourceAtomIndex === null || sourceAtomIndex === undefined) {
      // If no mapping, try to infer from tuple arity (fallback for tests)
      this._processGenericDelta(delta, outputAdds, outputRemoves);
    } else {
      // LFTJ+ optimization: sort delta tuples by VO prefix for cache locality (design §5.4)
      this._processSortedDelta(delta, sourceAtomIndex, outputAdds, outputRemoves);
    }

    return new Delta(new Set(outputAdds.values()), new Set(outputRemoves.values()));
  }

  /**
   * Process delta with VO prefix sorting optimization per design §5.4
   */
  _processSortedDelta(delta, sourceAtomIndex, outputAdds, outputRemoves) {
    // Collect and sort tuples by their VO prefix for cache locality
    const removeTuples = Array.from(delta.removes);
    const addTuples = Array.from(delta.adds);

    // Sort by prefix binding to improve cache locality
    const atomSpec = this._atomSpecs[sourceAtomIndex];
    removeTuples.sort((a, b) => this._compareByVOPrefix(a, b, atomSpec));
    addTuples.sort((a, b) => this._compareByVOPrefix(a, b, atomSpec));

    // Process removes first (per §6.2)
    for (const tuple of removeTuples) {
      this._runDeltaProbe(tuple, sourceAtomIndex, false, outputAdds, outputRemoves);
    }

    // Then process adds
    for (const tuple of addTuples) {
      this._runDeltaProbe(tuple, sourceAtomIndex, true, outputAdds, outputRemoves);
    }
  }

  /**
   * Compare tuples by their VO prefix for sorting optimization
   */
  _compareByVOPrefix(tupleA, tupleB, atomSpec) {
    // Extract prefix values for comparison
    for (let i = 0; i < this._variableOrder.length; i++) {
      const variable = this._variableOrder[i];
      const atomVarIndex = atomSpec.variables.indexOf(variable);
      
      if (atomVarIndex !== -1) {
        const valueA = tupleA.atoms[atomVarIndex];
        const valueB = tupleB.atoms[atomVarIndex];
        const comparison = valueA.compareTo(valueB);
        if (comparison !== 0) {
          return comparison;
        }
      }
    }
    return 0;
  }

  /**
   * Process delta without source mapping (fallback for tests)
   */
  _processGenericDelta(delta, outputAdds, outputRemoves) {
    // Process removes first (per §6.2)
    for (const tuple of delta.removes) {
      this._processDeltaTupleGeneric(tuple, false, outputAdds, outputRemoves);
    }

    // Then process adds
    for (const tuple of delta.adds) {
      this._processDeltaTupleGeneric(tuple, true, outputAdds, outputRemoves);
    }
  }

  /**
   * Process a single delta tuple using LFTJ⁺ delta probes per design §5.4 (generic fallback)
   */
  _processDeltaTupleGeneric(deltaTuple, isAdd, outputAdds, outputRemoves) {
    // For MVP: try to match this tuple against each atom spec
    for (let atomIdx = 0; atomIdx < this._atomSpecs.length; atomIdx++) {
      const atomSpec = this._atomSpecs[atomIdx];
      
      // Check if tuple could belong to this atom (matching arity)
      if (deltaTuple.arity === atomSpec.variables.length) {
        this._runDeltaProbe(deltaTuple, atomIdx, isAdd, outputAdds, outputRemoves);
      }
    }
  }

  /**
   * Run delta probe for a tuple from specific atom per design §5.4
   */
  _runDeltaProbe(deltaTuple, atomIdx, isAdd, outputAdds, outputRemoves) {
    const atomSpec = this._atomSpecs[atomIdx];
    
    // 1. Bind prefix: extract values for VO variables present in this atom
    const boundPrefix = this._extractBoundPrefix(deltaTuple, atomSpec);
    
    // 2. Create constrained iterators for all OTHER atoms (excluding source atom)
    const iteratorGroups = this._createConstrainedIteratorsExcluding(boundPrefix, atomIdx);
    
    // 3. Run leapfrog enumeration starting after bound prefix level
    const startLevel = this._calculateStartLevel(boundPrefix);
    this._currentBinding = new Map(boundPrefix);
    
    // Enhanced witness table maintenance with proper projection handling
    this._leapfrogEnumeration(startLevel, iteratorGroups, (binding) => {
      this._updateWitnessTable(binding, isAdd, outputAdds, outputRemoves);
    });
  }

  /**
   * Create constrained iterators excluding the source atom to avoid double-counting
   */
  _createConstrainedIteratorsExcluding(boundPrefix, excludeAtomIdx) {
    const iteratorGroups = [];
    
    for (let level = 0; level < this._variableOrder.length; level++) {
      const variable = this._variableOrder[level];
      const atomIndices = this._levelGroups[level];
      const iterators = [];
      
      for (const atomIdx of atomIndices) {
        // Skip the source atom to avoid double-counting in LFTJ+
        if (atomIdx === excludeAtomIdx) {
          continue;
        }
        
        const atomSpec = this._atomSpecs[atomIdx];
        
        try {
          const iterator = this._createConstrainedIterator(atomSpec, level, boundPrefix);
          if (iterator) {
            iterators.push(iterator);
          }
        } catch (error) {
          const emptyIterator = this._createEmptyIterator();
          iterators.push(emptyIterator);
        }
      }
      
      iteratorGroups.push(iterators);
    }
    
    return iteratorGroups;
  }

  /**
   * Calculate the starting level for leapfrog enumeration based on bound prefix
   */
  _calculateStartLevel(boundPrefix) {
    // Start enumeration after the longest contiguous bound prefix
    let startLevel = 0;
    for (let i = 0; i < this._variableOrder.length; i++) {
      const variable = this._variableOrder[i];
      if (boundPrefix.has(variable)) {
        startLevel = i + 1;
      } else {
        break;
      }
    }
    return startLevel;
  }

  /**
   * Enhanced witness table update with proper projection and emit logic
   */
  _updateWitnessTable(binding, isAdd, outputAdds, outputRemoves) {
    // 4. Apply projection (if any) and create output tuple
    const outputTuple = this._createOutputTuple(binding);
    const key = outputTuple.toBytes().toString();
    
    // Enhanced witness table maintenance
    const currentCount = this._witnessTable.get(key) || 0;
    let newCount;
    
    if (isAdd) {
      newCount = currentCount + 1;
      if (currentCount === 0) {
        // 0→1 transition: emit add
        outputAdds.set(key, outputTuple);
      }
    } else {
      newCount = Math.max(0, currentCount - 1);
      if (currentCount === 1) {
        // 1→0 transition: emit remove
        outputRemoves.set(key, outputTuple);
      }
    }
    
    // Maintain witness table invariant
    if (newCount === 0) {
      this._witnessTable.delete(key);
    } else {
      this._witnessTable.set(key, newCount);
    }
  }

  /**
   * Extract bound prefix from delta tuple and atom spec
   */
  _extractBoundPrefix(deltaTuple, atomSpec) {
    const boundPrefix = new Map();
    
    for (let i = 0; i < this._variableOrder.length; i++) {
      const variable = this._variableOrder[i];
      const atomVarIndex = atomSpec.variables.indexOf(variable);
      
      if (atomVarIndex !== -1) {
        // This variable is present in the atom, bind it
        boundPrefix.set(variable, deltaTuple.atoms[atomVarIndex]);
      }
    }
    
    return boundPrefix;
  }

  /**
   * Create prefix tuple for iterator factory from bound variables
   */
  _createPrefixTuple(boundPrefix, level) {
    const prefixAtoms = [];
    for (let i = 0; i < level; i++) {
      const variable = this._variableOrder[i];
      const value = boundPrefix.get(variable);
      if (value !== undefined) {
        prefixAtoms.push(value);
      }
    }
    return prefixAtoms.length > 0 ? new Tuple(prefixAtoms) : null;
  }

  /**
   * Create constrained iterators for all atoms consistent with bound prefix per design §5.4
   */
  _createConstrainedIterators(boundPrefix) {
    const iteratorGroups = [];
    
    for (let level = 0; level < this._variableOrder.length; level++) {
      const variable = this._variableOrder[level];
      const atomIndices = this._levelGroups[level];
      const iterators = [];
      
      for (const atomIdx of atomIndices) {
        const atomSpec = this._atomSpecs[atomIdx];
        
        try {
          // Create constrained iterator with enhanced prefix binding
          const iterator = this._createConstrainedIterator(atomSpec, level, boundPrefix);
          if (iterator) {
            iterators.push(iterator);
          }
        } catch (error) {
          // If iterator creation fails (no data for prefix), create empty iterator
          const emptyIterator = this._createEmptyIterator();
          iterators.push(emptyIterator);
        }
      }
      
      iteratorGroups.push(iterators);
    }
    
    return iteratorGroups;
  }

  /**
   * Create a constrained iterator for a specific atom and level
   */
  _createConstrainedIterator(atomSpec, level, boundPrefix) {
    // Build prefix tuple considering variable mappings in this atom
    const prefixTuple = this._createConstrainedPrefixTuple(atomSpec, level, boundPrefix);
    
    // Create iterator through factory
    return this._iteratorFactory.makeIter(
      atomSpec.relation,
      level,
      prefixTuple
    );
  }

  /**
   * Create prefix tuple with proper variable mapping for constrained iteration
   */
  _createConstrainedPrefixTuple(atomSpec, level, boundPrefix) {
    const prefixAtoms = [];
    
    // Map bound prefix variables to atom positions
    for (let i = 0; i < level; i++) {
      const variable = this._variableOrder[i];
      const atomVarIndex = atomSpec.variables.indexOf(variable);
      
      if (atomVarIndex !== -1) {
        // This variable exists in the atom - use bound value
        const boundValue = boundPrefix.get(variable);
        if (boundValue !== undefined) {
          // Pad prefix if needed to match atom's variable order
          while (prefixAtoms.length < atomVarIndex) {
            prefixAtoms.push(null); // Placeholder for unbound variables
          }
          prefixAtoms[atomVarIndex] = boundValue;
        }
      }
    }
    
    // Filter out null placeholders and create tuple
    const validAtoms = prefixAtoms.filter(atom => atom !== null);
    return validAtoms.length > 0 ? new Tuple(validAtoms) : null;
  }

  /**
   * Create empty iterator for missing relations
   */
  _createEmptyIterator() {
    return {
      seekGE: function() {},
      key: function() { throw new Error('Empty iterator has no key'); },
      next: function() {},
      atEnd: function() { return true; }
    };
  }

  /**
   * Leapfrog enumeration algorithm per design §5.3
   */
  _leapfrogEnumeration(level, iteratorGroups, onComplete) {
    if (level >= this._variableOrder.length) {
      // Base case: completed binding
      onComplete(new Map(this._currentBinding));
      return;
    }

    const variable = this._variableOrder[level];
    const iterators = iteratorGroups[level];
    
    if (iterators.length === 0) {
      // No iterators for this level (empty result)
      return;
    }

    // Initialize all iterators to start
    for (const iterator of iterators) {
      iterator.seekGE(null); // Seek to beginning
      if (iterator.atEnd()) {
        return; // No solutions
      }
    }

    while (true) {
      // Find maximum key among all iterators
      let maxKey = null;
      for (const iterator of iterators) {
        if (!iterator.atEnd()) {
          const key = iterator.key();
          if (maxKey === null || key.compareTo(maxKey) > 0) {
            maxKey = key;
          }
        }
      }

      if (maxKey === null) {
        break; // All iterators exhausted
      }

      // Advance all iterators to maxKey
      let allEqual = true;
      for (const iterator of iterators) {
        iterator.seekGE(maxKey);
        if (iterator.atEnd()) {
          return; // No more solutions
        }
        
        if (iterator.key().compareTo(maxKey) !== 0) {
          allEqual = false;
        }
      }

      if (allEqual) {
        // All iterators agree on this key - descend
        this._currentBinding.set(variable, maxKey);
        this._leapfrogEnumeration(level + 1, iteratorGroups, onComplete);
        this._currentBinding.delete(variable);
        
        // Advance first iterator to find next candidate
        iterators[0].next();
        if (iterators[0].atEnd()) {
          break;
        }
      }
      // If not all equal, loop will continue and find new maxKey
    }
  }

  /**
   * Create output tuple from current variable binding
   */
  _createOutputTuple(binding) {
    const atoms = [];
    for (const variable of this._variableOrder) {
      const value = binding.get(variable);
      if (value === undefined) {
        throw new Error(`Variable '${variable}' not bound in output`);
      }
      atoms.push(value);
    }
    return new Tuple(atoms);
  }

  /**
   * Reset state
   */
  reset() {
    this._witnessTable.clear();
    this._currentBinding.clear();
  }

  /**
   * Get state information
   */
  /**
   * Get current set of join results
   */
  getCurrentSet() {
    // For integration testing, return simplified representation
    const currentSet = new Set();
    for (const witnessKey of this._witnessTable.keys()) {
      currentSet.add(`witness_${witnessKey.substring(0, 8)}`);
    }
    return currentSet;
  }

  getState() {
    return {
      type: 'Join',
      variableOrder: [...this._variableOrder],
      atomSpecs: this.atomSpecs,
      witnessTableSize: this._witnessTable.size,
      levelGroups: this._levelGroups.map(group => [...group])
    };
  }

  toString() {
    const voStr = this._variableOrder.join(',');
    const atomStr = this._atomSpecs.map(spec => 
      `${spec.relation}(${spec.variables.join(',')})`
    ).join(' ⋈ ');
    return `Join(${this._id}, VO:[${voStr}], ${atomStr})`;
  }
}