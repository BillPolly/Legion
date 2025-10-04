/**
 * CNL Grammar Definition for Declarative Components
 * Defines the Controlled Natural Language syntax rules and patterns
 */

export class CNLGrammar {
  constructor() {
    // Component definition patterns
    this.componentPatterns = [
      /^Define\s+(\w+)\s+with\s+(\w+):?$/i,
      /^Component\s+(\w+)\s+using\s+(\w+):?$/i,
      /^Create\s+(\w+)\s+from\s+(\w+):?$/i
    ];

    // Element creation patterns - ORDER MATTERS! More specific patterns must come first
    this.elementPatterns = {
      // Heading with class and binding - check FIRST
      headingClassBinding: /^[Aa]\s+heading\s+with\s+class\s+"?([\w-]+)"?\s+(?:showing|displaying)\s+(?:the\s+)?(\w+)$/,

      // Heading shorthand with literal text (in quotes) - check SECOND
      headingLiteral: /^[Aa]\s+heading\s+(?:showing|displaying|with)\s+"([^"]+)"$/,

      // Heading shorthand with dynamic binding (no quotes) - check THIRD
      headingDynamic: /^[Aa]\s+heading\s+(?:showing|displaying)\s+(?:the\s+)?(\w+)$/,
      
      // Button shorthand - check before generic labeled
      // Match buttons with optional typos after quotes
      button: /^[Aa]\s+button\s+(?:labeled\s+)?"([^"]+)"[^a-zA-Z]*(?:that\s+(.+?)\s+on\s+(\w+))?$/,
      
      // Fallback for severe typos - extract what we can
      buttonFallback: /^[Aa]\s+button\s+.*?"([^"]+)".*?(?:that\s+(.+?)\s+on\s+(\w+))?/,
      
      // Input shorthand
      input: /^[Aa]n?\s+input\s+(?:field\s+)?(?:for\s+)?(.+?)(?:\s+(?:bound|connected)\s+to\s+(.+))?$/,
      
      // Basic element creation
      create: /^(?:Create\s+)?[Aa]n?\s+(\w+)(?:\s+with\s+class\s+"?([\w-]+)"?)?(?:\s+containing)?:?$/,
      
      // Element with content - now requires quotes to distinguish from bindings
      withContent: /^(?:Create\s+)?[Aa]n?\s+(\w+)\s+(?:showing|displaying|with\s+text)\s+"([^"]+)"$/,
      
      // Element with dynamic content - for non-quoted references
      withBinding: /^(?:Create\s+)?[Aa]n?\s+(\w+)\s+(?:showing|displaying)\s+(?:the\s+)?(\w+)$/,
      
      // Labeled element (for buttons, inputs)
      labeled: /^(?:Create\s+)?[Aa]n?\s+(\w+)\s+labeled\s+"?([^"]+)"?$/
    };

    // Container patterns
    this.containerPatterns = {
      containing: /^(?:containing|with):?$/i,
      wrapper: /^(?:wrapped\s+in|inside):?$/i
    };

    // Event patterns
    this.eventPatterns = {
      // Generic event handler
      generic: /^(?:that\s+|which\s+)?(\w+)\s+on\s+(\w+)$/,
      
      // Click specific
      click: /^(?:that\s+|which\s+)?(\w+)(?:\s+when\s+clicked)?$/,
      whenClicked: /^when\s+clicked,?\s+(.+)$/,
      onClick: /^on\s+click,?\s+(.+)$/,
      
      // Other events
      onEvent: /^on\s+(\w+),?\s+(.+)$/,
      whenEvent: /^when\s+(\w+),?\s+(.+)$/
    };

    // Conditional patterns
    this.conditionalPatterns = {
      when: /^When\s+(.+?):?$/i,
      if: /^If\s+(.+?),?\s+(?:then\s+)?(?:show)?:?$/i,
      show: /^Show\s+(?:a\s+)?(.+?)\s+when\s+(.+)$/i,
      otherwise: /^(?:Otherwise|Else):?$/i
    };

    // Iteration patterns
    this.iterationPatterns = {
      forEach: /^For\s+each\s+(\w+)\s+in\s+(?:the\s+)?(.+?):?$/i,
      repeat: /^Repeat\s+for\s+(?:all\s+)?(\w+)\s+in\s+(?:the\s+)?(.+?):?$/i,
      map: /^Map\s+(?:each\s+)?(\w+)\s+(?:from|in)\s+(?:the\s+)?(.+?)\s+to:?$/i
    };

    // Binding patterns
    this.bindingPatterns = {
      twoWay: /^(?:bound|connected|synchronized|linked)\s+(?:to|with)\s+(.+)$/i,
      oneWay: /^(?:showing|displaying)\s+(.+)$/i,
      fromData: /^from\s+(?:the\s+)?(.+)$/i
    };

    // Action patterns
    this.actionPatterns = {
      increment: /^increments?\s+(?:the\s+)?(.+)$/i,
      decrement: /^decrements?\s+(?:the\s+)?(.+)$/i,
      toggle: /^toggles?\s+(?:the\s+)?(.+)$/i,
      set: /^sets?\s+(?:the\s+)?(.+)\s+to\s+(.+)$/i,
      call: /^calls?\s+(?:the\s+)?(.+)(?:\s+with\s+(.+))?$/i,
      update: /^updates?\s+(?:the\s+)?(.+)\s+(?:to|with)\s+(.+)$/i
    };

    // Natural language keywords that map to DSL
    this.keywords = {
      elements: {
        'container': 'div',
        'section': 'div',
        'paragraph': 'p',
        'heading': 'h2',
        'title': 'h1',
        'subtitle': 'h3',
        'text': 'span',
        'link': 'a',
        'list': 'ul',
        'item': 'li',
        'row': 'div.row',
        'column': 'div.column',
        'grid': 'div.grid',
        'card': 'div.card',
        'panel': 'div.panel'
      },
      
      actions: {
        'increments': '++',
        'decrements': '--',
        'adds': '+=',
        'subtracts': '-=',
        'toggles': '= !',
        'clears': '= ""',
        'resets': '= 0'
      },
      
      events: {
        'clicked': 'click',
        'pressed': 'click',
        'submitted': 'submit',
        'changed': 'change',
        'typed': 'input',
        'focused': 'focus',
        'blurred': 'blur',
        'hovered': 'mouseenter',
        'left': 'mouseleave'
      }
    };
  }

  /**
   * Parse a component definition line
   */
  parseComponentDefinition(line) {
    for (const pattern of this.componentPatterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          type: 'component',
          name: match[1],
          parameter: match[2]
        };
      }
    }
    return null;
  }

  /**
   * Parse an element creation line
   */
  parseElement(line) {
    // Check each element pattern
    for (const [key, pattern] of Object.entries(this.elementPatterns)) {
      const match = line.match(pattern);
      if (match) {
        return this.buildElementNode(key, match);
      }
    }
    return null;
  }

  /**
   * Build element node from pattern match
   */
  buildElementNode(patternType, match) {
    switch (patternType) {
      case 'create':
        return {
          type: 'element',
          tag: this.normalizeElement(match[1]),
          className: match[2] || null,
          children: []
        };
      
      case 'withContent':
        return {
          type: 'element',
          tag: this.normalizeElement(match[1]),
          content: match[2]
        };
      
      case 'withBinding':
        return {
          type: 'element',
          tag: this.normalizeElement(match[1]),
          binding: match[2]  // Just the binding name, prefix will be added by transpiler
        };
      
      case 'labeled':
        return {
          type: 'element',
          tag: this.normalizeElement(match[1]),
          content: match[2]
        };

      case 'headingClassBinding':
        return {
          type: 'element',
          tag: 'h2',
          className: match[1],
          binding: match[2]
        };

      case 'headingLiteral':
        return {
          type: 'element',
          tag: 'h2',
          content: match[1]
        };

      case 'headingDynamic':
        return {
          type: 'element',
          tag: 'h2',
          binding: match[1]  // This will be translated to state.count or data.count
        };
      
      case 'button':
        return {
          type: 'element',
          tag: 'button',
          text: `"${match[1]}"`,  // Keep the quotes
          event: match[2] ? { 
            type: match[3] || 'click', 
            action: this.parseAction(match[2]) 
          } : null
        };
      
      case 'buttonFallback':
        // Extract label from the messy text
        const labelMatch = match.input.match(/"([^"]+)"/);
        return {
          type: 'element',
          tag: 'button',
          text: labelMatch ? `"${labelMatch[1]}"` : '"Button"',
          event: {
            type: match[2] || 'click',
            action: this.parseAction(match[1])
          }
        };
      
      case 'input':
        return {
          type: 'element',
          tag: 'input',
          placeholder: match[1],
          binding: match[2] || null
        };
      
      default:
        return null;
    }
  }

  /**
   * Parse a conditional statement
   */
  parseConditional(line) {
    for (const [key, pattern] of Object.entries(this.conditionalPatterns)) {
      const match = line.match(pattern);
      if (match) {
        switch (key) {
          case 'when':
          case 'if':
            return {
              type: 'conditional',
              condition: this.parseExpression(match[1]),
              children: []
            };
          
          case 'show':
            return {
              type: 'conditional',
              element: match[1],
              condition: this.parseExpression(match[2]),
              children: []
            };
          
          case 'otherwise':
            return {
              type: 'else',
              children: []
            };
        }
      }
    }
    return null;
  }

  /**
   * Parse an iteration statement
   */
  parseIteration(line) {
    for (const [key, pattern] of Object.entries(this.iterationPatterns)) {
      const match = line.match(pattern);
      if (match) {
        return {
          type: 'iteration',
          variable: match[1],
          collection: this.parseExpression(match[2]),
          children: []
        };
      }
    }
    return null;
  }

  /**
   * Parse an event handler
   */
  parseEvent(line) {
    for (const [key, pattern] of Object.entries(this.eventPatterns)) {
      const match = line.match(pattern);
      if (match) {
        switch (key) {
          case 'generic':
            return {
              type: 'event',
              event: this.normalizeEvent(match[2]),
              action: this.parseAction(match[1])
            };
          
          case 'click':
          case 'whenClicked':
          case 'onClick':
            return {
              type: 'event',
              event: 'click',
              action: this.parseAction(match[1])
            };
          
          case 'onEvent':
          case 'whenEvent':
            return {
              type: 'event',
              event: this.normalizeEvent(match[1]),
              action: this.parseAction(match[2])
            };
        }
      }
    }
    return null;
  }

  /**
   * Parse an action expression
   */
  parseAction(action) {
    // Check action patterns
    for (const [key, pattern] of Object.entries(this.actionPatterns)) {
      const match = action.match(pattern);
      if (match) {
        switch (key) {
          case 'increment':
            return `${match[1]}++`;
          case 'decrement':
            return `${match[1]}--`;
          case 'toggle':
            return `${match[1]} = !${match[1]}`;
          case 'set':
            return `${match[1]} = ${match[2]}`;
          case 'call':
            return match[2] ? `${match[1]}(${match[2]})` : `${match[1]}()`;
          case 'update':
            return `${match[1]} = ${match[2]}`;
        }
      }
    }
    
    // Return as-is if no pattern matches
    return action;
  }

  /**
   * Parse a data expression
   */
  parseExpression(expr) {
    // Handle possessive forms (user's name -> user.name)
    expr = expr.replace(/(\w+)'s\s+(\w+)/g, '$1.$2');
    
    // Handle "the" removal
    expr = expr.replace(/\bthe\s+/gi, '');
    
    // Handle natural language operators
    expr = expr.replace(/\bis\s+open\b/gi, 'Open');
    expr = expr.replace(/\bis\s+closed\b/gi, '!Open');
    expr = expr.replace(/\bis\s+true\b/gi, '');
    expr = expr.replace(/\bis\s+false\b/gi, '!');
    expr = expr.replace(/\band\b/gi, '&&');
    expr = expr.replace(/\bor\b/gi, '||');
    expr = expr.replace(/\bnot\b/gi, '!');
    
    return expr.trim();
  }

  /**
   * Normalize element names
   */
  normalizeElement(element) {
    const normalized = element.toLowerCase();
    return this.keywords.elements[normalized] || normalized;
  }

  /**
   * Normalize event names
   */
  normalizeEvent(event) {
    const normalized = event.toLowerCase();
    return this.keywords.events[normalized] || normalized;
  }

  /**
   * Check if a line is a container opening
   */
  isContainerStart(line) {
    for (const pattern of Object.values(this.containerPatterns)) {
      if (pattern.test(line)) {
        return true;
      }
    }
    return line.endsWith(':');
  }

  /**
   * Get indentation level
   */
  getIndentLevel(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }
}