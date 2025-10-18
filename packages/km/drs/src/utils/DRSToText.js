/**
 * DRSToText - Deterministic DRS-to-Text Converter
 *
 * Converts ClausalDRS to natural language paraphrase using template-based rendering.
 * NO LLM - purely deterministic algorithm.
 *
 * Output is literal but accurate (e.g., "Every student read a book").
 */

export class DRSToText {
  /**
   * Generate natural language paraphrase from DRS
   * @param {ClausalDRS} drs - The DRS to convert
   * @returns {string} Natural language paraphrase
   */
  generateParaphrase(drs) {
    if (!drs || !drs.conditions || drs.conditions.length === 0) {
      return 'There is nothing.';
    }

    // Separate conditions by type
    const predicates = drs.conditions.filter(c => c.pred && !c.rel);
    const relations = drs.conditions.filter(c => c.rel);

    // Extract scope operators
    const quantifiers = relations.filter(r => ['Every', 'Some'].includes(r.rel));
    const negations = relations.filter(r => r.rel === 'Not');
    const implications = relations.filter(r => r.rel === 'Imp');
    const disjunctions = relations.filter(r => r.rel === 'Or');
    const eventRoles = relations.filter(r => ['Agent', 'Theme', 'Patient', 'Experiencer', 'Instrument', 'Location', 'Time'].includes(r.rel));
    const binaryRelations = relations.filter(r => !['Every', 'Some', 'Not', 'Imp', 'Or', 'Agent', 'Theme', 'Patient', 'Experiencer', 'Instrument', 'Location', 'Time'].includes(r.rel));

    // Build referent index (what predicates apply to each referent)
    const referentPredicates = {};
    for (const pred of predicates) {
      if (pred.args && pred.args.length > 0) {
        const ref = pred.args[0];
        if (!referentPredicates[ref]) {
          referentPredicates[ref] = [];
        }
        referentPredicates[ref].push(pred.pred);
      }
    }

    // Build event index
    const events = predicates.filter(p => p.args && p.args[0] && p.args[0].startsWith('e'));
    const entities = predicates.filter(p => p.args && p.args[0] && p.args[0].startsWith('x'));

    // Handle different DRS patterns
    if (implications.length > 0) {
      return this._renderImplication(implications[0], events, entities, eventRoles, referentPredicates);
    }

    if (disjunctions.length > 0) {
      return this._renderDisjunction(disjunctions[0], events, entities, eventRoles, referentPredicates);
    }

    if (negations.length > 0) {
      return this._renderNegation(negations[0], events, entities, eventRoles, referentPredicates);
    }

    if (quantifiers.length > 0) {
      return this._renderQuantified(quantifiers, events, entities, eventRoles, referentPredicates);
    }

    // Simple case: just entities and events
    return this._renderSimple(events, entities, eventRoles, referentPredicates, binaryRelations);
  }

  /**
   * Render simple sentence (no scope operators)
   */
  _renderSimple(events, entities, eventRoles, referentPredicates, binaryRelations) {
    if (events.length === 0 && entities.length === 0) {
      return 'There is nothing.';
    }

    if (events.length > 0) {
      const event = events[0];
      const verb = event.pred;
      const agentRole = eventRoles.find(r => r.rel === 'Agent' && r.args[0] === event.args[0]);
      const themeRole = eventRoles.find(r => r.rel === 'Theme' && r.args[0] === event.args[0]);

      let parts = [];

      if (agentRole) {
        const agentRef = agentRole.args[1];
        const agentType = referentPredicates[agentRef] ? referentPredicates[agentRef][0] : 'someone';
        parts.push(`A ${agentType}`);
      }

      parts.push(verb + 's');

      if (themeRole) {
        const themeRef = themeRole.args[1];
        const themeType = referentPredicates[themeRef] ? referentPredicates[themeRef][0] : 'something';
        parts.push(`a ${themeType}`);
      }

      return parts.join(' ') + '.';
    }

    if (entities.length > 0) {
      const entity = entities[0];
      const type = entity.pred;
      const attributes = referentPredicates[entity.args[0]] || [];
      const attrs = attributes.filter(a => a !== type);
      if (attrs.length > 0) {
        return `There is a ${type} that is ${attrs.join(' and ')}.`;
      }
      return `There is a ${type}.`;
    }

    if (binaryRelations.length > 0) {
      const rel = binaryRelations[0];
      const ref1 = rel.args[0];
      const ref2 = rel.args[1];
      const type1 = referentPredicates[ref1] ? referentPredicates[ref1][0] : 'someone';
      const type2 = referentPredicates[ref2] ? referentPredicates[ref2][0] : 'someone';
      return `A ${type1} ${rel.rel} a ${type2}.`;
    }

    return 'Something exists.';
  }

  /**
   * Render quantified sentence
   */
  _renderQuantified(quantifiers, events, entities, eventRoles, referentPredicates) {
    const quant = quantifiers[0];
    const quantVar = quant.args[0];
    const quantType = referentPredicates[quantVar] ? referentPredicates[quantVar][0] : 'thing';

    let quantWord = quant.rel === 'Every' ? 'Every' : 'A';

    if (events.length > 0) {
      const event = events[0];
      const verb = event.pred;
      const themeRole = eventRoles.find(r => r.rel === 'Theme' && r.args[0] === event.args[0]);

      let parts = [`${quantWord} ${quantType}`, verb];

      if (themeRole) {
        const themeRef = themeRole.args[1];
        const themeType = referentPredicates[themeRef] ? referentPredicates[themeRef][0] : 'something';
        parts.push(`a ${themeType}`);
      }

      return parts.join(' ') + '.';
    }

    return `${quantWord} ${quantType} exists.`;
  }

  /**
   * Render negated sentence
   */
  _renderNegation(negation, events, entities, eventRoles, referentPredicates) {
    if (events.length > 0) {
      const event = events[0];
      const verb = event.pred;
      const agentRole = eventRoles.find(r => r.rel === 'Agent' && r.args[0] === event.args[0]);

      let parts = [];

      if (agentRole) {
        const agentRef = agentRole.args[1];
        const agentType = referentPredicates[agentRef] ? referentPredicates[agentRef][0] : 'someone';
        parts.push(`A ${agentType}`);
      } else {
        parts.push('Someone');
      }

      parts.push('does not', verb);

      return parts.join(' ') + '.';
    }

    return 'It is not the case.';
  }

  /**
   * Render implication (conditional)
   */
  _renderImplication(implication, events, entities, eventRoles, referentPredicates) {
    // Simplified: just indicate conditional structure
    const parts = ['If'];

    if (events.length > 0) {
      const event1 = events[0];
      const verb1 = event1.pred;
      const agent1Role = eventRoles.find(r => r.rel === 'Agent' && r.args[0] === event1.args[0]);

      if (agent1Role) {
        const agentRef = agent1Role.args[1];
        const agentType = referentPredicates[agentRef] ? referentPredicates[agentRef][0] : 'someone';
        parts.push(`a ${agentType} ${verb1}s`);
      } else {
        parts.push(`something ${verb1}s`);
      }
    } else {
      parts.push('something');
    }

    parts.push('then');

    if (events.length > 1) {
      const event2 = events[1];
      const verb2 = event2.pred;
      const agent2Role = eventRoles.find(r => r.rel === 'Agent' && r.args[0] === event2.args[0]);

      if (agent2Role) {
        const agentRef = agent2Role.args[1];
        const agentType = referentPredicates[agentRef] ? referentPredicates[agentRef][0] : 'someone';
        parts.push(`a ${agentType} ${verb2}s`);
      } else {
        parts.push(`something ${verb2}s`);
      }
    } else {
      parts.push('something happens');
    }

    return parts.join(' ') + '.';
  }

  /**
   * Render disjunction (or)
   */
  _renderDisjunction(disjunction, events, entities, eventRoles, referentPredicates) {
    const parts = [];

    if (events.length > 0) {
      const event1 = events[0];
      const verb1 = event1.pred;
      const agent1Role = eventRoles.find(r => r.rel === 'Agent' && r.args[0] === event1.args[0]);

      if (agent1Role) {
        const agentRef = agent1Role.args[1];
        const agentType = referentPredicates[agentRef] ? referentPredicates[agentRef][0] : 'someone';
        parts.push(`A ${agentType} ${verb1}s`);
      } else {
        parts.push(`Something ${verb1}s`);
      }
    }

    parts.push('or');

    if (events.length > 1) {
      const event2 = events[1];
      const verb2 = event2.pred;
      parts.push(verb2 + 's');
    } else {
      parts.push('something else happens');
    }

    return parts.join(' ') + '.';
  }
}
