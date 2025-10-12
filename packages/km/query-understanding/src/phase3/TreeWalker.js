/**
 * Phase 3: TreeWalker
 *
 * Walks NP/VP AST and applies mapping rules to build LogicalSkeleton.
 *
 * Implements 15 core rules from the design document.
 */

/**
 * TreeWalker - Convert NP/VP AST to LogicalSkeleton
 */
export class TreeWalker {
  /**
   * @param {SemanticMapper} semanticMapper - SemanticMapper for token → IRI mapping
   */
  constructor(semanticMapper) {
    if (!semanticMapper) {
      throw new Error('SemanticMapper is required for TreeWalker');
    }

    this.mapper = semanticMapper;
    this.varCounter = 0;
  }

  /**
   * Walk AST and build LogicalSkeleton
   *
   * @param {Object} ast - NP/VP AST (from Phase 2)
   * @returns {Promise<Object>} LogicalSkeleton
   */
  async walk(ast) {
    // Reset state
    this.varCounter = 0;
    const skeleton = {
      vars: [],
      atoms: [],
      project: [],
      order: [],
      limit: null,
      force: 'select',
      notes: [],
      operations: []  // NEW: Track operations for Phase 4
    };

    if (!ast || !ast.S) {
      throw new Error('Invalid AST: missing S node');
    }

    const { NP, VP, Force, Meta } = ast.S;

    // Rule 1 & 2: Subject NP → Variable + Type (or Constant)
    const subjVar = await this._walkNP(NP, skeleton, { isSubject: true, meta: Meta });

    // Rule 3: VP → Predicate/Relations
    await this._walkVP(VP, subjVar, skeleton);

    // NEW: Detect operations from NP Head and Meta
    await this._detectOperations(NP, VP, subjVar, skeleton, Meta);

    // Rule 14: Projection Logic
    this._determineProjection(NP, VP, Force, subjVar, skeleton);

    // Determine query force (ask/select/aggregate)
    skeleton.force = this._determineForce(Force, skeleton.project);

    return skeleton;
  }

  /**
   * Walk NP and generate variable/type or constant
   *
   * @private
   * @param {Object} np - NP node
   * @param {Object} skeleton - Logical skeleton being built
   * @param {Object} context - Context (isSubject, etc.)
   * @returns {Promise<string>} Variable or IRI
   */
  async _walkNP(np, skeleton, context = {}) {
    if (!np || !np.Head) {
      throw new Error('Invalid NP: missing Head');
    }

    // Rule 2: Proper Names → Constants
    if (typeof np.Head === 'object' && np.Head.Name) {
      // Proper name - map to constant IRI
      const properName = np.Head.Name;

      // Convert name to IRI format (replace spaces with underscores)
      const iri = properName.startsWith('Q') ? properName : `:${properName.replace(/\s+/g, '_')}`;
      return iri;
    }

    // Rule 1: Common noun → Variable + Type
    const head = np.Head;

    // Check for PP modifiers like "job of Börje Larsson"
    const ppMod = (np.Mods || []).find(m => Array.isArray(m) && m[0] === 'pp');

    if (ppMod && ppMod[1] === 'of') {
      // This is a property question: "What is the X of Y?"
      // X = property name (head)
      // Y = entity (in PP)

      // Map noun to property IRI
      const propertyMapping = await this.mapper.mapNoun(head);

      let propertyIRI;
      if (!propertyMapping) {
        // Try to map as verb/property
        const verbMapping = await this.mapper.mapVerb(head);
        if (verbMapping) {
          propertyIRI = verbMapping.ambiguous ? verbMapping.candidates[0].iri : verbMapping.iri;
        } else {
          skeleton.notes.push(`Unmapped property noun: ${head}`);
          // Create generic variable
          const varName = this._freshVar();
          skeleton.vars.push(varName);
          return varName;
        }
      } else {
        propertyIRI = propertyMapping.ambiguous ? propertyMapping.candidates[0].iri : propertyMapping.iri;
      }

      // Walk the PP object (the entity)
      const ppObjectNP = ppMod[2];
      const entityIRI = await this._walkNP(ppObjectNP, skeleton);

      // Create variable for the answer
      const varName = this._freshVar();
      skeleton.vars.push(varName);

      // Create relation: [entity, property, ?x]
      skeleton.atoms.push(['rel', propertyIRI, entityIRI, varName]);

      return varName;
    }

    // Standard common noun handling
    const mapping = await this.mapper.mapNoun(head);

    if (!mapping) {
      skeleton.notes.push(`Unmapped noun: ${head}`);
      // Create generic variable anyway
      const varName = this._freshVar();
      skeleton.vars.push(varName);
      return varName;
    }

    // Handle ambiguous mappings
    let classIRI;
    if (mapping.ambiguous) {
      classIRI = mapping.candidates[0].iri;
      skeleton.notes.push(`Ambiguous noun: ${head} → ${classIRI} (score: ${mapping.candidates[0].score})`);
    } else {
      classIRI = mapping.iri;
    }

    // Create variable
    const varName = this._freshVar();
    skeleton.vars.push(varName);

    // Add type atom
    skeleton.atoms.push(['isa', varName, classIRI]);

    return varName;
  }

  /**
   * Walk VP and generate predicates/relations
   *
   * @private
   * @param {Object} vp - VP node
   * @param {string} subjVar - Subject variable or IRI
   * @param {Object} skeleton - Logical skeleton being built
   */
  async _walkVP(vp, subjVar, skeleton) {
    if (!vp || !vp.Verb) {
      throw new Error('Invalid VP: missing Verb');
    }

    const verb = vp.Verb;
    const comps = vp.Comps || [];
    const mods = vp.Mods || [];

    // Rule 4: Copula (be) → handle specially
    if (verb === 'be') {
      // Copula doesn't add relations itself
      // The NP subject already handled the WH-word ("what job")
      // We're done here - the relation comes from NP structure
      return;
    }

    // Rule 3: Verb Frame → Predicate
    // Check for object complement
    const objComp = comps.find(c => c[0] === 'obj');

    if (objComp) {
      // Map verb to property IRI
      const mapping = await this.mapper.mapVerb(verb);

      if (!mapping) {
        skeleton.notes.push(`Unmapped verb: ${verb}`);
        return;
      }

      let propertyIRI;
      if (mapping.ambiguous) {
        propertyIRI = mapping.candidates[0].iri;
        skeleton.notes.push(`Ambiguous verb: ${verb} → ${propertyIRI}`);
      } else {
        propertyIRI = mapping.iri;
      }

      // Walk object NP
      const objNP = objComp[1];
      const objVar = await this._walkNP(objNP, skeleton);

      // Create relation atom: [rel, property, subject, object]
      skeleton.atoms.push(['rel', propertyIRI, subjVar, objVar]);
    }

    // TODO: Handle PP modifiers (Rule 5)
    // TODO: Handle relative clauses (Rule 6)
    // TODO: Handle comparatives (Rule 8)
  }

  /**
   * Determine projection (what to return)
   *
   * @private
   * @param {Object} np - Subject NP
   * @param {Object} vp - VP
   * @param {string} force - Force type (ask/yn)
   * @param {string} subjVar - Subject variable
   * @param {Object} skeleton - Logical skeleton being built
   */
  _determineProjection(np, vp, force, subjVar, skeleton) {
    // Rule 14: Projection Logic

    // If projection was already set (e.g., by Rule 11 operation), don't override it
    if (skeleton.project && skeleton.project.length > 0) {
      return;
    }

    // Check for WH-determiner
    if (np.Det === 'which' || np.Det === 'what' || np.Det === 'who') {
      // Project the WH-phrase variable
      skeleton.project = [subjVar];
      return;
    }

    // Rule 9: Quantifiers (how-many, how-much)
    if (np.Det === 'how-many') {
      skeleton.project = [['COUNT', subjVar]];
      return;
    }

    if (np.Det === 'how-much') {
      skeleton.project = [['SUM', subjVar]];
      return;
    }

    // Yes/No question - no projection
    if (force === 'yn') {
      skeleton.project = [];
      return;
    }

    // Default: project subject
    skeleton.project = [subjVar];
  }

  /**
   * Determine query force (ask/select/aggregate)
   *
   * @private
   * @param {string} force - Force type from AST
   * @param {Array} project - Projection specification
   * @returns {string} Force type
   */
  _determineForce(force, project) {
    // Yes/No question
    if (force === 'yn') {
      return 'ask';
    }

    // Check for aggregation in projection
    if (project.length > 0 && Array.isArray(project[0])) {
      return 'aggregate';
    }

    // Default: select query
    return 'select';
  }

  /**
   * Generate fresh variable
   *
   * @private
   * @returns {string} Fresh variable name
   */
  _freshVar() {
    const varName = `?x${this.varCounter === 0 ? '' : this.varCounter}`;
    this.varCounter++;
    return varName === '?x0' ? '?x' : varName;
  }

  /**
   * Detect operations from NP Head and Meta
   *
   * Operations like "change", "difference", "percentage" indicate arithmetic
   * operations need to be performed on retrieved values.
   *
   * Implements Rule 11: Head="difference" + PP("between", A) + PP("and", B)
   *   → ["op", "difference", ?vA, ?vB, ?out]
   *
   * @private
   * @param {Object} np - Subject NP
   * @param {Object} vp - VP
   * @param {string} subjVar - Subject variable
   * @param {Object} skeleton - Logical skeleton being built
   * @param {Object} meta - Metadata from AST
   */
  async _detectOperations(np, vp, subjVar, skeleton, meta) {
    // Check if NP Head indicates an operation
    const operationNouns = {
      'change': 'subtract',
      'difference': 'subtract',
      'fluctuation': 'subtract',
      'ratio': 'divide',
      'percentage': 'percentage',
      'percent': 'percentage'
    };

    const head = typeof np.Head === 'string' ? np.Head.toLowerCase() : null;
    let operation = head && operationNouns[head] ? operationNouns[head] : null;

    // Use Meta.operation only if we don't have a mapping for the head noun
    // The operationNouns mapping takes precedence over LLM suggestions
    if (!operation && meta && meta.operation) {
      // Map Meta.operation to our standard operations
      const metaOperationMap = {
        'analyze_trend': 'subtract',
        'calculate_change': 'subtract',
        'calculate_difference': 'subtract',
        'calculate_percentage': 'percentage',
        'calculate_ratio': 'divide'
      };
      operation = metaOperationMap[meta.operation] || meta.operation;
    }

    if (!operation) {
      return; // No operation detected
    }

    // Check for coordination pattern: "difference between X and Y"
    // Rule 11: Head="difference" + PP("between", A) + PP("and", B) → ["op", "difference", ?vA, ?vB, ?out]
    const betweenMod = (np.Mods || []).find(m => Array.isArray(m) && m[0] === 'pp' && m[1] === 'between');

    if (betweenMod && betweenMod[2]) {
      const betweenNP = betweenMod[2];

      // Look for coordination in betweenNP.Mods: ["coord", "and", entity1NP, entity2NP]
      if (betweenNP.Mods && Array.isArray(betweenNP.Mods)) {
        const coordMod = betweenNP.Mods.find(m =>
          Array.isArray(m) && m[0] === 'coord' && m[1] === 'and'
        );

        if (coordMod) {
          // Rule 11 pattern detected!
          // coord structure: ["coord", "and", entity1NP, entity2NP]
          const entity1NP = coordMod[2];
          const entity2NP = coordMod[3];

          // Extract entity IRIs/Names
          let entity1IRI = null;
          let entity2IRI = null;

          // Entity 1
          if (entity1NP) {
            if (typeof entity1NP.Head === 'object' && entity1NP.Head.Name) {
              entity1IRI = entity1NP.Head;
            } else if (typeof entity1NP.Head === 'string') {
              entity1IRI = { Name: entity1NP.Head };
            } else if (typeof entity1NP === 'string') {
              entity1IRI = { Name: entity1NP };
            }
          }

          // Entity 2
          if (entity2NP) {
            if (typeof entity2NP.Head === 'object' && entity2NP.Head.Name) {
              entity2IRI = entity2NP.Head;
            } else if (typeof entity2NP.Head === 'string') {
              entity2IRI = { Name: entity2NP.Head };
            } else if (typeof entity2NP === 'string') {
              entity2IRI = { Name: entity2NP };
            }
          }

          if (entity1IRI && entity2IRI) {
            // Create variables for the two entity values
            const var1 = this._freshVar();
            const var2 = this._freshVar();
            const outVar = this._freshVar();

            skeleton.vars.push(var1, var2, outVar);

            // Create operation atom per Rule 11
            skeleton.atoms.push(['op', operation, entity1IRI, entity2IRI, var1, var2, outVar]);

            // Project the output variable
            skeleton.project = [outVar];

            skeleton.notes.push(`Rule 11: ${operation} between ${JSON.stringify(entity1IRI)} and ${JSON.stringify(entity2IRI)}`);

            // Done - coordination operation handled
            return;
          }
        }
      }
    }

    // Standard single-entity operation handling
    // Extract temporal modifiers (from/to years) from NP.Mods
    const fromMod = (np.Mods || []).find(m => Array.isArray(m) && m[0] === 'pp' && m[1] === 'from');
    const toMod = (np.Mods || []).find(m => Array.isArray(m) && m[0] === 'pp' && m[1] === 'to');

    const fromYear = fromMod && fromMod[2] ? fromMod[2].Head : null;
    const toYear = toMod && toMod[2] ? toMod[2].Head : null;

    // Extract attribute from "in X" modifier
    const inMod = (np.Mods || []).find(m => Array.isArray(m) && m[0] === 'pp' && m[1] === 'in');
    const attribute = inMod && inMod[2] ? inMod[2].Head : null;

    // Build operation descriptor for non-coordination operations
    // Store in operations array for backward compatibility with ConvFinQA
    const opDescriptor = {
      type: operation,
      attribute: attribute,
      fromYear: fromYear,
      toYear: toYear,
      format: (meta && meta.format) || 'absolute',
      // Store the AST structure for QueryInterpreter to resolve
      npMods: np.Mods
    };

    skeleton.operations.push(opDescriptor);
    skeleton.notes.push(`Operation detected: ${operation}`);
  }
}
