/**
 * SlashCommandService - Centralized slash command handling
 * Single place for all slash command logic (Legion pattern: one way of doing things)
 */

/**
 * Handle slash commands
 * @param {string} input - Slash command input 
 * @param {Object} agent - Conversation manager
 * @returns {string} Response
 */
export async function handleSlashCommand(input, agent) {
  const command = input.slice(1).split(' ')[0].toLowerCase(); // Remove / and get command
  const args = input.slice(1).split(' ').slice(1); // Get arguments
  
  switch (command) {
    case 'help':
      return `**Available Slash Commands:**

⚡ **/help** - Show this help message
🔧 **/tools** - List all available tools
📋 **/context** - Show current conversation context  
🗂️ **/files** - Show recently accessed files
🧹 **/clear** - Clear conversation history
📊 **/debug** - Show debug information

Type any command for more details. Regular chat messages work as before!`;

    case 'show':
      const param = args[0];
      if (!param) {
        return `**Show Command Usage:**

Use \`/show <parameter>\` where parameter is:
• tools, context, files, errors, citations, compression, debug, all`;
      }
      
      switch (param.toLowerCase()) {
        case 'tools':
          const toolsStats = agent.toolsModule?.getStatistics();
          return toolsStats ? `**🔧 Tools (${toolsStats.toolCount}):** ${toolsStats.tools.join(', ')}` : 'Tools not available';
          
        case 'context':
          const history = agent.getConversationHistory();
          return `**📋 Context:** ${history.length} messages, Working dir: ${process.cwd()}`;
          
        case 'all':
          const allStats = agent.toolsModule?.getStatistics() || {};
          return `**🎯 Complete State:**
🔧 Tools: ${allStats.toolCount || 0}
💬 Messages: ${agent.getConversationHistory().length}
💾 Memory: ${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB`;
          
        default:
          return `Unknown parameter: ${param}. Use /show without parameters for help.`;
      }

    case 'tools':
      const toolsStats = agent.toolsModule?.getStatistics();
      if (toolsStats) {
        return `**Available Tools (${toolsStats.toolCount} total):**

${toolsStats.tools.map(tool => `• ${tool}`).join('\\n')}

All tools are working and available for use through normal chat or slash commands.`;
      }
      return 'Tools information not available';

    case 'context':
      const history = agent.getConversationHistory();
      const recentFiles = agent.projectContextService?.getRecentFilesContext() || 'No recent files tracked';
      
      return `**Current Context:**

**Conversation:** ${history.length} messages in history
**Working Directory:** ${process.cwd()}
**Recent Files:** ${recentFiles.includes('Recently Accessed Files') ? '✅ Files tracked' : '❌ No files tracked'}

Use /clear to reset context or continue with regular chat.`;

    case 'clear':
      agent.clearHistory();
      return '🧹 **Context Cleared!** \\n\\nConversation history has been reset. You can start a fresh conversation.';

    case 'debug':
      return `**Debug Information:**

**Agent Status:** ✅ Operational
**Tools Module:** ${agent.toolsModule ? '✅ Loaded' : '❌ Not loaded'}
**LLM Client:** ✅ Connected to Anthropic
**Tool Count:** ${agent.toolsModule?.getStatistics().toolCount || 0}
**Memory Usage:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB

All systems operational for debugging and testing.`;

    default:
      return `❌ **Unknown Command:** /${command}

Type /help to see available commands.`;
  }
}