/**
 * RenderCommand - Render a declarative component visually in browser
 * Usage: /render <component-name>
 */

import { BaseCommand } from './BaseCommand.js';

export class RenderCommand extends BaseCommand {
  constructor(sessionActor) {
    super(
      'render',
      'Render a component visually in the browser',
      'render <component-name>'
    );

    this.sessionActor = sessionActor;
  }

  /**
   * Execute the render command
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} Render result
   */
  async execute(args) {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /render <component-name>\nExample: /render Counter'
      };
    }

    const componentName = args[0];
    const allComponents = this.sessionActor.components || [];

    // Find the component
    const component = allComponents.find(c =>
      c.name.toLowerCase() === componentName.toLowerCase()
    );

    if (!component) {
      return {
        success: false,
        message: `Component "${componentName}" not found.\nAvailable: ${allComponents.map(c => c.name).join(', ')}`
      };
    }

    // Send component data to browser for rendering
    const assetData = {
      componentName: component.name,
      componentDSL: component.source,
      componentCompiled: component.compiled,
      renderInstructions: {
        type: 'declarative-component',
        framework: '@legion/declarative-components'
      }
    };

    return {
      success: true,
      message: `Rendering ${component.name} component...`,
      rendered: 'browser',
      assetType: 'component',
      assetData: assetData,
      title: `Component: ${component.name}`
    };
  }

  /**
   * Get command help text
   * @returns {string} Help text
   */
  getHelp() {
    return `
/render - Render a declarative component visually

Usage:
  /render <component-name>

Description:
  Renders a declarative component in a visual window with full interactivity.
  The component will be mounted with its DSL definition and you can
  interact with it (click buttons, etc.).

Examples:
  /render Counter        Render the Counter component
  /render TodoList       Render the TodoList component
`;
  }
}

export default RenderCommand;
