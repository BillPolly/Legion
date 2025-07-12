/**
 * TabCompleter - Handles tab completion in interactive mode
 */

export class TabCompleter {
  constructor(moduleLoader, toolRegistry) {
    this.moduleLoader = moduleLoader;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Get completer function for readline
   * @returns {Function} Completer function
   */
  getCompleter() {
    return async (line) => {
      const completions = [];
      
      // Check if we're inside quotes
      const quoteCount = (line.match(/"/g) || []).length;
      const singleQuoteCount = (line.match(/'/g) || []).length;
      if (quoteCount % 2 !== 0 || singleQuoteCount % 2 !== 0) {
        // Inside quotes, no completion
        return [[], line];
      }
      
      // Parse with awareness of trailing spaces
      const hasTrailingSpace = line.endsWith(' ');
      const trimmed = line.trim();
      const parts = trimmed.split(' ').filter(p => p !== '');
      
      // Determine what we're completing
      let lastPart = '';
      if (hasTrailingSpace) {
        // Completing a new word
        lastPart = '';
      } else if (parts.length > 0) {
        // Completing the last word
        lastPart = parts[parts.length - 1];
      }
      
      // Special commands
      const specialCommands = ['exit', 'quit', '.exit', 'clear', 'cls', 'help', 'list', 'set', 'show'];
      
      // If no input or first word, complete commands and modules
      if (parts.length === 0 || (parts.length === 1 && !hasTrailingSpace && !lastPart.includes('.'))) {
        // Add special commands
        specialCommands.forEach(cmd => {
          if (cmd.startsWith(lastPart)) {
            completions.push(cmd);
          }
        });
        
        // Add module names
        this.moduleLoader.getModules().forEach((_, moduleName) => {
          if (moduleName.startsWith(lastPart)) {
            completions.push(moduleName);
          }
        });
        
        // If exact module match, add dot for tool completion
        if (this.moduleLoader.getModules().has(lastPart)) {
          completions.push(lastPart + '.');
        }
      }
      // Handle list subcommands
      else if (parts[0] === 'list' && (parts.length === 1 && hasTrailingSpace || parts.length === 2)) {
        const listTypes = ['modules', 'tools', 'all', 'aliases', 'presets'];
        listTypes.forEach(type => {
          if (type.startsWith(lastPart)) {
            completions.push(type);
          }
        });
      }
      // Handle module.tool completion
      else if (lastPart.includes('.') || (parts.length > 0 && parts[parts.length - 1].includes('.'))) {
        const targetPart = lastPart || parts[parts.length - 1];
        const dotIndex = targetPart.indexOf('.');
        const moduleName = targetPart.substring(0, dotIndex);
        const partialTool = targetPart.substring(dotIndex + 1);
        
        const moduleTools = this.toolRegistry.getToolsByModule(moduleName);
        moduleTools.forEach(tool => {
          const fullToolName = `${moduleName}.${tool.name}`;
          if (tool.name.startsWith(partialTool)) {
            completions.push(fullToolName);
          }
        });
      }
      // Handle parameter completion
      else if (lastPart.startsWith('--')) {
        // Find the tool being used
        const toolPart = parts.find(p => p.includes('.'));
        if (toolPart && toolPart.includes('.')) {
          const tool = this.toolRegistry.getToolByName(toolPart);
          if (tool && tool.parameters && tool.parameters.properties) {
            // Get already used parameters
            const usedParams = new Set();
            parts.forEach((part, idx) => {
              if (part.startsWith('--') && idx < parts.length - 1) {
                usedParams.add(part.substring(2));
              }
            });
            
            // Add unused parameters
            Object.keys(tool.parameters.properties).forEach(param => {
              if (!usedParams.has(param)) {
                const fullParam = '--' + param;
                if (fullParam.startsWith(lastPart)) {
                  completions.push(fullParam);
                }
              }
            });
          }
        }
      }
      // Handle help completion
      else if (parts[0] === 'help' && parts.length === 2) {
        // Complete with module names and tool names
        this.moduleLoader.getModules().forEach((_, moduleName) => {
          if (moduleName.startsWith(lastPart)) {
            completions.push(moduleName);
          }
        });
        
        this.toolRegistry.discoverTools().forEach((_, toolName) => {
          if (toolName.startsWith(lastPart)) {
            completions.push(toolName);
          }
        });
      }
      
      return [completions, line];
    };
  }
}

export default TabCompleter;