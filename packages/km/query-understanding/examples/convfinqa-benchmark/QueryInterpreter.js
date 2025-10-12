/**
 * QueryInterpreter - Translate LogicalSkeleton to ConvFinQA execution parameters
 *
 * This is the bridge layer between the generic query-understanding pipeline
 * and the ConvFinQA-specific FactQueryExecutor.
 *
 * Responsibilities:
 * - Extract entity names from LogicalSkeleton
 * - Resolve entity names to facts structure
 * - Extract operation parameters (attribute, years)
 * - Produce executor-ready query format
 */

export class QueryInterpreter {
  constructor(facts) {
    if (!facts) {
      throw new Error('Facts structure is required for QueryInterpreter');
    }
    this.facts = facts;
    this.conversationHistory = []; // Track previous results
  }

  /**
   * Interpret a LogicalSkeleton and produce execution parameters
   *
   * @param {Object} skeleton - LogicalSkeleton from Phase 3
   * @param {Object} context - Conversation context with previous results
   * @returns {Object} Execution parameters for FactQueryExecutor
   */
  interpret(skeleton, context = {}) {
    // Store conversation history for reference resolution
    if (context.conversationHistory) {
      this.conversationHistory = context.conversationHistory;
    }

    // Check for operation atoms (Rule 11: ["op", ...])
    if (skeleton && skeleton.atoms && skeleton.atoms.length > 0) {
      const opAtom = skeleton.atoms.find(a => Array.isArray(a) && a[0] === 'op');
      if (opAtom) {
        return this._interpretOperationAtom(opAtom, skeleton, context);
      }
    }

    // Check for legacy operations array (backward compatibility)
    if (!skeleton || !skeleton.operations || skeleton.operations.length === 0) {
      // No operations - this is a simple lookup
      return this._interpretLookup(skeleton, context);
    }

    // Has operations in legacy array - extract parameters
    return this._interpretOperation(skeleton, context);
  }

  /**
   * Interpret a lookup query (no operations)
   *
   * For questions like "what was the performance value of the s&p 500 index in 2009?"
   * Skeleton has atoms like: ['rel', ':performance', ':S&P_500_Index', '?x']
   * And may have temporal info in notes or atoms
   *
   * @private
   */
  _interpretLookup(skeleton, context = {}) {
    // Extract entity from atoms
    // Look for rel atoms: ['rel', propertyIRI, entityIRI, varName]
    const relAtom = skeleton.atoms.find(a => a[0] === 'rel');

    if (!relAtom) {
      return {
        type: 'lookup',
        entity: null,
        attribute: null,
        year: null,
        error: 'No relation atom found in lookup query'
      };
    }

    // Extract property and entity from rel atom
    const propertyIRI = relAtom[1]; // e.g., ':performance'
    const entityIRI = relAtom[2];   // e.g., ':S&P_500_Index' or a Name object

    // Extract attribute name from property IRI
    const attribute = propertyIRI.startsWith(':') ? propertyIRI.slice(1) : propertyIRI;

    // Extract and normalize entity name
    let entityName = null;
    if (typeof entityIRI === 'string' && entityIRI.startsWith(':')) {
      // Entity IRI like ':S&P_500_Index'
      entityName = entityIRI.slice(1);
    } else if (typeof entityIRI === 'object' && entityIRI.Name) {
      // Name object
      entityName = entityIRI.Name;
    }

    if (!entityName) {
      return {
        type: 'lookup',
        entity: null,
        attribute,
        year: null,
        error: 'Could not extract entity from relation atom'
      };
    }

    // Normalize entity name
    const normalizedEntity = this._normalizeEntityName(entityName);

    // Extract year from original question
    let year = null;

    if (context.question) {
      // Look for year patterns: 4-digit numbers
      const yearMatch = context.question.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        year = yearMatch[0];
      }
    }

    return {
      type: 'lookup',
      entity: normalizedEntity,
      attribute,
      year
    };
  }

  /**
   * Interpret an operation query
   * @private
   */
  _interpretOperation(skeleton, context = {}) {
    const operation = skeleton.operations[0]; // Handle first operation

    // Check if this is a two-entity coordination operation
    // e.g., "difference between X and Y"
    const coordOp = this._interpretCoordinationOperation(skeleton, operation);
    if (coordOp) {
      return coordOp;
    }

    // Check if this operation uses previous results
    // e.g., "how much does THIS CHANGE represent" - "this change" is previous answer
    const usesHistory = this._usesPreviousResults(operation);

    if (usesHistory) {
      // Use previous result directly
      return {
        type: 'operation_on_value',
        baseValue: usesHistory.value,
        divisor: usesHistory.divisor || null,
        entity: usesHistory.entity || null,  // Include entity for history tracking
        operationType: operation.type,
        format: operation.format || 'absolute'
      };
    }

    // Extract entity name from npMods
    let entityName = this._extractEntityName(operation.npMods);

    // If no entity name found, check for pronoun reference ("that performance")
    if (!entityName && this.conversationHistory.length > 0) {
      // Look at most recent history entry for entity
      const prevEntry = this.conversationHistory[this.conversationHistory.length - 1];

      if (prevEntry && prevEntry.execParams) {
        // Get entity from previous operation or lookup
        if (prevEntry.execParams.entity) {
          entityName = prevEntry.execParams.entity;
        }
      }
    }

    if (!entityName) {
      return {
        type: 'operation',
        entity: null,
        error: 'Could not extract entity from query'
      };
    }

    // Normalize entity name to match facts structure
    const normalizedEntity = this._normalizeEntityName(entityName);

    // Check if entity exists in facts
    const entityId = `:${normalizedEntity}`;
    if (!this.facts[entityId]) {
      return {
        type: 'operation',
        entity: normalizedEntity,
        error: `Entity ${normalizedEntity} not found in facts`
      };
    }

    // Extract years - try operation first, then fall back to parsing question
    let fromYear = operation.fromYear;
    let toYear = operation.toYear;

    // If years are not in operation, try to extract from question text
    if (!fromYear || !toYear) {
      if (context.question) {
        // Look for year ranges: "from YYYY to YYYY"
        const yearRangeMatch = context.question.match(/from\s+(\d{4})\s+to\s+(\d{4})/i);
        if (yearRangeMatch) {
          fromYear = parseInt(yearRangeMatch[1], 10);
          toYear = parseInt(yearRangeMatch[2], 10);
        } else {
          // Look for all 4-digit years in the question
          const years = context.question.match(/\b(19|20)\d{2}\b/g);
          if (years && years.length >= 2) {
            // Use first two years found
            fromYear = parseInt(years[0], 10);
            toYear = parseInt(years[1], 10);
          }
        }
      }
    }

    return {
      type: 'operation',
      entity: normalizedEntity,
      attribute: operation.attribute || 'performance',
      fromYear,
      toYear,
      operationType: operation.type,
      format: operation.format || 'absolute'
    };
  }

  /**
   * Interpret coordination operation - "difference between X and Y"
   *
   * This handles queries where two entities are coordinated and we need to
   * retrieve values for each from history, then perform an operation.
   *
   * Example: "what is the difference between the percent representation of
   * the united parcel service inc . and the s&p 500 index?"
   *
   * @private
   */
  _interpretCoordinationOperation(skeleton, operation) {
    if (!operation || !operation.npMods) {
      return null;
    }

    // Look for coordination in npMods structure
    // Structure: ["pp", "between", { Mods: [..., ["coord", "and", entity2NP]] }]
    const betweenMod = operation.npMods.find(m =>
      Array.isArray(m) && m[0] === 'pp' && m[1] === 'between'
    );

    if (!betweenMod || !betweenMod[2] || !betweenMod[2].Mods) {
      return null; // Not a coordination query
    }

    const mods = betweenMod[2].Mods;

    // Find the first "of" modifier (entity 1)
    const ofMod = mods.find(m => Array.isArray(m) && m[0] === 'pp' && m[1] === 'of');

    // Find the "coord" modifier (entity 2)
    const coordMod = mods.find(m => Array.isArray(m) && m[0] === 'coord' && m[1] === 'and');

    if (!ofMod || !coordMod) {
      return null; // Missing entities
    }

    // Extract entity names
    const entity1NP = ofMod[2];
    // coord structure: ["coord", "and", null, entityNP] or ["coord", "and", entityNP]
    const entity2NP = coordMod[3] || coordMod[2];

    // Extract entity names from NP structures
    let entity1Name = null;
    let entity2Name = null;

    // Entity 1: from "of" modifier
    if (entity1NP && typeof entity1NP.Head === 'object' && entity1NP.Head.Name) {
      entity1Name = entity1NP.Head.Name;
    } else if (typeof entity1NP === 'string' && entity1NP.startsWith(':')) {
      entity1Name = entity1NP.slice(1);
    }

    // Entity 2: from "coord" modifier
    if (entity2NP && typeof entity2NP.Head === 'object' && entity2NP.Head.Name) {
      entity2Name = entity2NP.Head.Name;
    } else if (typeof entity2NP === 'string' && entity2NP.startsWith(':')) {
      entity2Name = entity2NP.slice(1);
    }

    if (!entity1Name || !entity2Name) {
      return null; // Couldn't extract both entities
    }

    const normalizedEntity1 = this._normalizeEntityName(entity1Name);
    const normalizedEntity2 = this._normalizeEntityName(entity2Name);

    // Find values for both entities in conversation history
    // For Turn 6, we're looking for "percent representation" which are the
    // percentage calculations from Turn 2 (UPS: -24.05%) and Turn 5 (S&P500: 2.11%)
    const entity1Value = this._findEntityValueInHistory(normalizedEntity1);
    const entity2Value = this._findEntityValueInHistory(normalizedEntity2);

    if (entity1Value === null || entity2Value === null) {
      return {
        type: 'coordination_operation',
        error: `Could not find values for both entities in history: ${normalizedEntity1}=${entity1Value}, ${normalizedEntity2}=${entity2Value}`
      };
    }

    return {
      type: 'coordination_operation',
      entity1: normalizedEntity1,
      entity2: normalizedEntity2,
      value1: entity1Value,
      value2: entity2Value,
      operationType: operation.type,
      format: operation.format || 'absolute'
    };
  }

  /**
   * Interpret operation atom from Rule 11
   *
   * Structure: ["op", "subtract", entity1IRI, entity2IRI, var1, var2, outVar]
   *
   * This handles queries like "difference between X and Y" where Phase 3
   * has created an operation atom following Rule 11.
   *
   * @private
   */
  _interpretOperationAtom(opAtom, skeleton, context) {
    // opAtom structure: ["op", operation, entity1IRI, entity2IRI, var1, var2, outVar]
    const operation = opAtom[1];
    const entity1IRI = opAtom[2];
    const entity2IRI = opAtom[3];

    // Extract entity names from IRIs
    let entity1Name = null;
    let entity2Name = null;

    // Entity 1
    if (typeof entity1IRI === 'object' && entity1IRI.Name) {
      entity1Name = entity1IRI.Name;
    } else if (typeof entity1IRI === 'string' && entity1IRI.startsWith(':')) {
      entity1Name = entity1IRI.slice(1);
    }

    // Entity 2
    if (typeof entity2IRI === 'object' && entity2IRI.Name) {
      entity2Name = entity2IRI.Name;
    } else if (typeof entity2IRI === 'string' && entity2IRI.startsWith(':')) {
      entity2Name = entity2IRI.slice(1);
    }

    if (!entity1Name || !entity2Name) {
      return {
        type: 'coordination_operation',
        error: `Could not extract entity names from operation atom: entity1=${entity1Name}, entity2=${entity2Name}`
      };
    }

    // Normalize entity names
    const normalizedEntity1 = this._normalizeEntityName(entity1Name);
    const normalizedEntity2 = this._normalizeEntityName(entity2Name);

    // Find values for both entities in conversation history
    const entity1Value = this._findEntityValueInHistory(normalizedEntity1);
    const entity2Value = this._findEntityValueInHistory(normalizedEntity2);

    if (entity1Value === null || entity2Value === null) {
      return {
        type: 'coordination_operation',
        error: `Could not find values for both entities in history: ${normalizedEntity1}=${entity1Value}, ${normalizedEntity2}=${entity2Value}`
      };
    }

    return {
      type: 'coordination_operation',
      entity1: normalizedEntity1,
      entity2: normalizedEntity2,
      value1: entity1Value,
      value2: entity2Value,
      operationType: operation,
      format: 'absolute'
    };
  }

  /**
   * Find the most recent value for an entity in conversation history
   *
   * Searches backwards through history for operations or lookups involving
   * the specified entity.
   *
   * @private
   */
  _findEntityValueInHistory(entityName) {
    // Search backwards through history
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const entry = this.conversationHistory[i];

      if (!entry.execParams || entry.answer === null) {
        continue;
      }

      // Check if this entry involves the target entity
      if (entry.execParams.entity === entityName) {
        return entry.answer;
      }
    }

    return null; // Entity not found in history
  }

  /**
   * Check if operation uses previous results from conversation history
   *
   * Patterns:
   * - "how much does this change represent" → use previous answer
   * - "what percentage does this represent" → use previous answer
   * - Operation has no years but has history → use previous values
   *
   * @private
   */
  _usesPreviousResults(operation) {
    if (this.conversationHistory.length === 0) {
      return null;
    }

    // If operation is a percentage/divide operation with no years, it's likely a calculation on the previous result
    // Example: "how much does this fluctuation represent in relation to that price in 2004?"
    const hasNoYears = !operation.fromYear && !operation.toYear;

    if (hasNoYears && (operation.type === 'divide' || operation.type === 'percentage' || operation.type === 'subtract')) {
      // Percentage calculation on previous result
      // Get most recent computed answer
      const prevEntry = this.conversationHistory[this.conversationHistory.length - 1];

      if (prevEntry && prevEntry.answer !== null) {
        // Need base value for division (e.g., performance in 2004)
        // Look up the base value from the previous operation's fromYear
        let baseValue = null;
        let entity = null;

        if (prevEntry.execParams && prevEntry.execParams.type === 'operation') {
          const { entity: prevEntity, attribute, fromYear } = prevEntry.execParams;
          entity = prevEntity;  // Store entity for history tracking

          // Look up base value from facts
          const entityId = `:${prevEntity}`;
          if (this.facts[entityId]) {
            const attrData = this.facts[entityId][`:${attribute || 'performance'}`];
            // Convert year to integer if it's a string
            const fromYearInt = typeof fromYear === 'string' ? parseInt(fromYear, 10) : fromYear;
            if (attrData && attrData[fromYearInt]) {
              baseValue = attrData[fromYearInt];
            }
          }
        }

        return {
          value: prevEntry.answer,
          divisor: baseValue,
          entity  // Include entity so we can track it in history
        };
      }
    }

    return null;
  }

  /**
   * Extract entity name from NP modifiers
   *
   * Handles two patterns:
   * 1. "change in [performance of United Parcel Service] from 2004 to 2009"
   *    Entity in: npMods → pp "in" → NP → Mods → pp "of" → NP → Head
   *
   * 2. "fluctuation of [the performance price of UPS] from 2004 to 2006"
   *    Entity in: npMods → pp "of" → NP → Head (direct)
   *    Or nested: npMods → pp "of" → NP → Mods → pp "of" → NP → Head
   *
   * @private
   */
  _extractEntityName(npMods) {
    if (!npMods || !Array.isArray(npMods)) {
      return null;
    }

    // Pattern 1: Find "in X" modifier (e.g., "change in performance")
    const inMod = npMods.find(m => Array.isArray(m) && m[0] === 'pp' && m[1] === 'in');
    if (inMod && inMod[2]) {
      // Look inside the "in X" NP for "of Y" modifier
      const inNP = inMod[2];
      if (inNP.Mods && Array.isArray(inNP.Mods)) {
        const ofMod = inNP.Mods.find(m => Array.isArray(m) && m[0] === 'pp' && m[1] === 'of');
        if (ofMod && ofMod[2]) {
          const entityNP = ofMod[2];
          if (typeof entityNP.Head === 'object' && entityNP.Head.Name) {
            return entityNP.Head.Name;
          }
        }
      }
    }

    // Pattern 2: Find direct "of X" modifier (e.g., "fluctuation of the price")
    // Look for the last "of" modifier which typically contains the entity
    const ofMods = npMods.filter(m => Array.isArray(m) && m[0] === 'pp' && m[1] === 'of');

    // Check each "of" modifier for an entity name
    for (let i = ofMods.length - 1; i >= 0; i--) {
      const ofMod = ofMods[i];
      if (!ofMod[2]) continue;

      const ofNP = ofMod[2];

      // Direct entity name
      if (typeof ofNP.Head === 'object' && ofNP.Head.Name) {
        return ofNP.Head.Name;
      }

      // Check nested "of" modifiers inside this NP
      if (ofNP.Mods && Array.isArray(ofNP.Mods)) {
        const nestedOfMod = ofNP.Mods.find(m => Array.isArray(m) && m[0] === 'pp' && m[1] === 'of');
        if (nestedOfMod && nestedOfMod[2]) {
          const entityNP = nestedOfMod[2];
          if (typeof entityNP.Head === 'object' && entityNP.Head.Name) {
            return entityNP.Head.Name;
          }
        }
      }
    }

    return null;
  }

  /**
   * Normalize entity name to match FinancialKGBuilder normalization
   *
   * This MUST match FinancialKGBuilder._normalizeEntityName() exactly
   *
   * @private
   */
  _normalizeEntityName(name) {
    const lower = name.toLowerCase().trim();

    // Special cases (must match FinancialKGBuilder exactly!)
    if (lower.includes('united parcel') || lower.includes('ups')) return 'ups';
    // Handle all S&P 500 variants: "s&p 500", "s & p 500", "s&p_500"
    if (lower.includes('s&p 500') || lower.includes('s & p 500') || lower.includes('s&p_500')) return 'sp500';
    if (lower.includes('dow jones') && lower.includes('transport')) return 'dj_transport';

    // Generic normalization - remove punctuation, replace spaces with underscores
    return lower
      .replace(/[.&]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 50); // Limit length
  }
}
