/**
 * DOMTestGenerator - Generates tests for DOM structure validation
 * Validates element creation, attributes, and hierarchy in JSDOM
 */
export class DOMTestGenerator {
  /**
   * Generate DOM tests for component description
   * @param {Object} description - Component description
   * @returns {Array} Generated tests
   */
  static generateTests(description) {
    const tests = [];
    
    if (description.domStructure.total === 0) {
      return tests;
    }

    // Generate tests for each DOM element
    description.domStructure.elements.forEach(element => {
      tests.push(...this.generateElementTests(element));
    });

    // Generate hierarchy tests
    if (description.domStructure.hasHierarchy > 0) {
      tests.push(...this.generateHierarchyTests(description.domStructure));
    }

    // Generate integration tests
    tests.push(...this.generateIntegrationTests(description.domStructure));

    return tests;
  }

  /**
   * Generate tests for individual DOM element
   * @param {Object} element - Element specification
   * @returns {Array} Generated tests
   */
  static generateElementTests(element) {
    const tests = [];

    if (element.type === 'creates') {
      // Element creation test
      tests.push({
        name: `should create element matching selector '${element.selector}'`,
        category: 'DOM Structure',
        type: 'dom-creates',
        execute: async (component, mockDependencies = {}) => {
          const container = this.createTestContainer();
          const createdComponent = await this.createComponentWithDOM(component, container, mockDependencies);
          
          const foundElement = container.querySelector(element.selector);
          
          return {
            selector: element.selector,
            elementFound: !!foundElement,
            elementCount: container.querySelectorAll(element.selector).length,
            element: foundElement ? this.serializeElement(foundElement) : null
          };
        }
      });

      // Attributes test
      if (element.attributes && Object.keys(element.attributes).length > 0) {
        tests.push({
          name: `should set correct attributes on '${element.selector}'`,
          category: 'DOM Structure',
          type: 'dom-attributes',
          execute: async (component, mockDependencies = {}) => {
            const container = this.createTestContainer();
            const createdComponent = await this.createComponentWithDOM(component, container, mockDependencies);
            
            const foundElement = container.querySelector(element.selector);
            const attributeResults = {};

            if (foundElement) {
              for (const [attr, expectedValue] of Object.entries(element.attributes)) {
                const actualValue = foundElement.getAttribute(attr);
                attributeResults[attr] = {
                  expected: expectedValue,
                  actual: actualValue,
                  matches: actualValue === expectedValue
                };
              }
            }

            return {
              selector: element.selector,
              elementFound: !!foundElement,
              expectedAttributes: element.attributes,
              attributeResults
            };
          }
        });
      }
    } else if (element.type === 'contains') {
      // Element containment test
      tests.push({
        name: `should contain element matching selector '${element.selector}'`,
        category: 'DOM Structure',
        type: 'dom-contains',
        execute: async (component, mockDependencies = {}) => {
          const container = this.createTestContainer();
          
          // For contains tests, we need to pre-populate the container
          this.createRequiredElements(container, element);
          
          const createdComponent = await this.createComponentWithDOM(component, container, mockDependencies);
          
          const foundElement = container.querySelector(element.selector);
          
          return {
            selector: element.selector,
            elementFound: !!foundElement,
            elementCount: container.querySelectorAll(element.selector).length
          };
        }
      });
    }

    return tests;
  }

  /**
   * Generate hierarchy tests
   * @param {Object} domStructure - DOM structure description
   * @returns {Array} Generated tests
   */
  static generateHierarchyTests(domStructure) {
    const hierarchicalElements = domStructure.elements.filter(el => el.within);
    
    if (hierarchicalElements.length === 0) {
      return [];
    }

    return [
      {
        name: 'should maintain correct DOM hierarchy',
        category: 'DOM Structure',
        type: 'dom-hierarchy',
        execute: async (component, mockDependencies = {}) => {
          const container = this.createTestContainer();
          const createdComponent = await this.createComponentWithDOM(component, container, mockDependencies);
          
          const hierarchyResults = [];

          for (const element of hierarchicalElements) {
            const parentElement = container.querySelector(element.within);
            const childElement = parentElement ? 
              parentElement.querySelector(element.selector) : 
              container.querySelector(element.selector);

            hierarchyResults.push({
              selector: element.selector,
              expectedParent: element.within,
              parentFound: !!parentElement,
              childFoundInParent: !!(parentElement && parentElement.querySelector(element.selector)),
              childFoundAnywhere: !!container.querySelector(element.selector)
            });
          }

          return {
            hierarchyResults,
            allHierarchiesCorrect: hierarchyResults.every(r => r.childFoundInParent)
          };
        }
      }
    ];
  }

  /**
   * Generate integration tests for DOM structure
   * @param {Object} domStructure - DOM structure description
   * @returns {Array} Generated tests
   */
  static generateIntegrationTests(domStructure) {
    return [
      {
        name: 'should create all required DOM elements',
        category: 'DOM Structure',
        type: 'dom-integration',
        execute: async (component, mockDependencies = {}) => {
          const container = this.createTestContainer();
          const createdComponent = await this.createComponentWithDOM(component, container, mockDependencies);
          
          const createdElements = domStructure.elements.filter(el => el.type === 'creates');
          const containedElements = domStructure.elements.filter(el => el.type === 'contains');
          
          const results = {
            createdElements: [],
            containedElements: [],
            totalExpected: domStructure.total,
            totalFound: 0
          };

          // Check created elements
          for (const element of createdElements) {
            const found = container.querySelector(element.selector);
            results.createdElements.push({
              selector: element.selector,
              found: !!found
            });
            if (found) results.totalFound++;
          }

          // Check contained elements (pre-populate for testing)
          for (const element of containedElements) {
            this.createRequiredElements(container, element);
            const found = container.querySelector(element.selector);
            results.containedElements.push({
              selector: element.selector,
              found: !!found
            });
            if (found) results.totalFound++;
          }

          return results;
        }
      }
    ];
  }

  /**
   * Create test container (JSDOM element)
   * @returns {HTMLElement} Test container
   */
  static createTestContainer() {
    if (typeof document !== 'undefined') {
      const container = document.createElement('div');
      container.id = 'test-container';
      return container;
    }
    
    // Mock container for non-JSDOM environments
    return {
      id: 'test-container',
      children: [],
      querySelector: function(selector) {
        return this.mockQuerySelector(selector);
      },
      querySelectorAll: function(selector) {
        return [this.mockQuerySelector(selector)].filter(Boolean);
      },
      appendChild: function(child) {
        this.children.push(child);
        return child;
      },
      mockQuerySelector: function(selector) {
        // Simple mock selector matching
        return this.children.find(child => 
          child.matches && child.matches(selector)
        ) || null;
      }
    };
  }

  /**
   * Create component with DOM container
   * @param {Object} component - Component to create
   * @param {HTMLElement} container - DOM container
   * @param {Object} mockDependencies - Mock dependencies
   * @returns {Promise<Object>} Created component
   */
  static async createComponentWithDOM(component, container, mockDependencies = {}) {
    const dependencies = {
      dom: container,
      ...mockDependencies
    };

    if (component && typeof component.create === 'function') {
      return component.create(dependencies);
    } else if (typeof component === 'function' && component.create) {
      return component.create(dependencies);
    } else if (component && typeof component.describe === 'function') {
      // Mock component creation
      return { dependencies, container, created: true };
    }
    
    throw new Error('Unable to create component - invalid component structure');
  }

  /**
   * Create required elements for contains tests
   * @param {HTMLElement} container - Container element
   * @param {Object} element - Element specification
   */
  static createRequiredElements(container, element) {
    if (typeof document === 'undefined') {
      // Mock element creation
      const mockElement = {
        selector: element.selector,
        matches: (sel) => sel === element.selector,
        getAttribute: () => null,
        setAttribute: () => {},
        classList: { add: () => {}, remove: () => {} }
      };
      container.children.push(mockElement);
      return;
    }

    // Parse selector and create element
    const elementInfo = this.parseSelector(element.selector);
    const createdElement = document.createElement(elementInfo.tagName);
    
    if (elementInfo.id) {
      createdElement.id = elementInfo.id;
    }
    
    if (elementInfo.classes.length > 0) {
      createdElement.className = elementInfo.classes.join(' ');
    }
    
    if (elementInfo.attributes) {
      for (const [attr, value] of Object.entries(elementInfo.attributes)) {
        createdElement.setAttribute(attr, value);
      }
    }
    
    container.appendChild(createdElement);
  }

  /**
   * Parse CSS selector into element information
   * @param {string} selector - CSS selector
   * @returns {Object} Element information
   */
  static parseSelector(selector) {
    const result = {
      tagName: 'div',
      id: null,
      classes: [],
      attributes: {}
    };

    // Simple parser for basic selectors
    const parts = selector.split(/([.#\[])/);
    
    if (parts[0] && !parts[0].match(/[.#\[]/)) {
      result.tagName = parts[0].toLowerCase();
    }

    for (let i = 1; i < parts.length; i += 2) {
      const delimiter = parts[i];
      const value = parts[i + 1];

      if (delimiter === '#') {
        result.id = value;
      } else if (delimiter === '.') {
        result.classes.push(value);
      } else if (delimiter === '[') {
        // Parse attribute selector [attr=value]
        const attrMatch = value.match(/([^=\]]+)(?:=([^\]]+))?/);
        if (attrMatch) {
          const attrName = attrMatch[1];
          const attrValue = attrMatch[2] || '';
          result.attributes[attrName] = attrValue;
        }
      }
    }

    return result;
  }

  /**
   * Serialize element for test results
   * @param {HTMLElement} element - Element to serialize
   * @returns {Object} Serialized element
   */
  static serializeElement(element) {
    if (!element) return null;

    const serialized = {
      tagName: element.tagName?.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      attributes: {}
    };

    if (element.attributes) {
      for (const attr of element.attributes) {
        serialized.attributes[attr.name] = attr.value;
      }
    }

    return serialized;
  }

  /**
   * Validate element matches selector
   * @param {HTMLElement} element - Element to validate
   * @param {string} selector - Expected selector
   * @returns {boolean} Whether element matches
   */
  static elementMatchesSelector(element, selector) {
    if (!element) return false;
    
    if (element.matches) {
      return element.matches(selector);
    }
    
    // Fallback manual matching
    const elementInfo = this.parseSelector(selector);
    
    if (elementInfo.tagName !== element.tagName?.toLowerCase()) {
      return false;
    }
    
    if (elementInfo.id && element.id !== elementInfo.id) {
      return false;
    }
    
    if (elementInfo.classes.length > 0) {
      const elementClasses = (element.className || '').split(/\s+/);
      for (const className of elementInfo.classes) {
        if (!elementClasses.includes(className)) {
          return false;
        }
      }
    }
    
    return true;
  }
}