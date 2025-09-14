/**
 * component - Template literal tag function for declarative components
 * 
 * Creates a component from a template literal with the declarative DSL.
 * The DSL is compiled to a JSON component definition.
 * 
 * @example
 * const MyComponent = component`
 *   MyComponent :: user =>
 *     div.card [
 *       h1 { user.name }
 *       p { user.bio }
 *     ]
 * `;
 */

import { ComponentCompiler } from '../compiler/ComponentCompiler.js';
import { ComponentLifecycle } from '../lifecycle/ComponentLifecycle.js';

/**
 * Template literal tag function for creating components
 * @param {Array} strings - Template literal string parts
 * @param {...any} values - Interpolated values
 * @returns {Function} Component function
 */
export function component(strings, ...values) {
  // Combine template literal parts
  let dslTemplate = '';
  for (let i = 0; i < strings.length; i++) {
    dslTemplate += strings[i];
    if (i < values.length) {
      // Handle interpolated values (could be functions, values, etc.)
      if (typeof values[i] === 'function') {
        dslTemplate += `\${${i}}`; // Placeholder for runtime evaluation
      } else {
        dslTemplate += values[i];
      }
    }
  }
  
  // Compile DSL to JSON component definition
  const compiler = new ComponentCompiler();
  const componentDef = compiler.compile(dslTemplate);
  
  // Create component function that mounts the component
  const Component = function(entityData = {}, container = null) {
    const lifecycle = new ComponentLifecycle();
    
    // Mount component with entity data
    return lifecycle.mount(componentDef, entityData, container);
  };
  
  // Attach metadata to function for inspection
  Component.componentDef = componentDef;
  Component.name = componentDef.name;
  Component.entity = componentDef.entity;
  Component.dsl = dslTemplate;
  
  return Component;
}

/**
 * Helper to create component from string (for testing/debugging)
 * @param {string} templateString - Component template as string
 * @returns {Function} Component function
 */
export function componentFromString(templateString) {
  // Convert string to template literal equivalent
  return component([templateString], ...[]);
}