/**
 * ComponentsCommand - List and filter declarative components
 * Usage: /components [filter]
 */

import { BaseCommand } from './BaseCommand.js';

export class ComponentsCommand extends BaseCommand {
  constructor(sessionActor) {
    super(
      'components',
      'List and filter declarative components',
      'components [filter]'
    );

    this.sessionActor = sessionActor;
  }

  /**
   * Execute the components command
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} Component list result
   */
  async execute(args) {
    // Get components from session context
    const allComponents = this.sessionActor.components || [];

    // Extract filter from args
    const filter = args.join(' ').trim().toLowerCase();

    // Apply filter if provided
    let filteredComponents = allComponents;
    if (filter) {
      filteredComponents = allComponents.filter(comp => {
        const name = comp.name.toLowerCase();
        const source = comp.source.toLowerCase();
        return name.includes(filter) || source.includes(filter);
      });
    }

    // Format the output
    let output = '\n' + (filter ? `Filtered Components (matching "${filter}"):` : 'All Components:') + '\n';
    output += '='.repeat(60) + '\n';

    if (filteredComponents.length === 0) {
      if (filter) {
        output += `\nNo components matching "${filter}".\n`;
      } else {
        output += '\nNo components loaded.\n';
      }
      output += 'Components are auto-loaded on session start.\n';
    } else {
      filteredComponents.forEach((comp, index) => {
        output += `\n[${index + 1}] ${comp.name}\n`;
        output += `    Type: ${comp.type}\n`;
        output += `    DSL: ${comp.source}\n`;
        if (comp.compiled) {
          output += `    Template: ${comp.compiled.template?.element || 'N/A'}\n`;
        }
      });

      output += `\n${filter ? 'Matched' : 'Total'}: ${filteredComponents.length} component(s)`;
      if (filter && filteredComponents.length < allComponents.length) {
        output += ` (of ${allComponents.length} total)`;
      }
      output += '\n';
    }

    output += '='.repeat(60) + '\n';

    return {
      success: true,
      message: output,
      components: filteredComponents,
      total: allComponents.length,
      filtered: filteredComponents.length
    };
  }

  /**
   * Get command help text
   * @returns {string} Help text
   */
  getHelp() {
    return `
/components - List and filter declarative components

Usage:
  /components            List all components
  /components [filter]   Filter components by name or DSL

Description:
  Shows declarative components loaded in the current session.
  Optional filter searches component names and DSL source code.

Examples:
  /components            List all components
  /components Counter    Show components with "Counter" in name/DSL
  /components button     Show components containing "button"
  /components div.card   Show components with "div.card" structure
`;
  }
}

export default ComponentsCommand;
