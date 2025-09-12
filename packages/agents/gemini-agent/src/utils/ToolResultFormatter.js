/**
 * ToolResultFormatter - Beautiful markdown formatting for tool results
 * Converts raw tool output into nicely formatted markdown
 */

export class ToolResultFormatter {
  /**
   * Format tool result based on tool type and result data
   * @param {string} toolName - Name of the tool that was executed
   * @param {Object} result - Tool execution result
   * @returns {string} Formatted markdown content
   */
  static format(toolName, result) {
    if (!result.success) {
      return this.formatError(toolName, result);
    }

    // Format based on tool type
    switch (toolName) {
      case 'list_files':
        return this.formatFileList(result);
      case 'read_file':
        return this.formatFileContent(result);
      case 'write_file':
        return this.formatFileWrite(result);
      case 'shell_command':
        return this.formatCommandOutput(result);
      case 'grep_search':
        return this.formatSearchResults(result);
      case 'save_memory':
        return this.formatMemorySave(result);
      default:
        return this.formatGeneric(toolName, result);
    }
  }

  /**
   * Format error results
   */
  static formatError(toolName, result) {
    return `⚠️ **Tool Error (${toolName}):** ${result.error}

The ${toolName} tool encountered an error and could not complete the requested operation.`;
  }

  /**
   * Format file listing results
   */
  static formatFileList(result) {
    const entries = result.data.entries || [];
    
    if (entries.length === 0) {
      return `## 📁 Directory Listing

Path: \`${result.data.path}\`

*Directory is empty*`;
    }

    const formatted = entries.map(entry => {
      const icon = entry.type === 'directory' ? '📂' : '📄';
      const size = entry.size ? ` - ${this.formatBytes(entry.size)}` : '';
      const modified = entry.modified ? ` (${new Date(entry.modified).toLocaleDateString()})` : '';
      return `- **${icon} ${entry.name}** (${entry.type})${size}${modified}`;
    }).join('\\n');

    return `## 📁 Directory Listing

Path: \`${result.data.path}\`

${formatted}`;
  }

  /**
   * Format file content results
   */
  static formatFileContent(result) {
    const content = result.data.content || '';
    const filePath = result.data.path || 'unknown';
    const lines = result.data.lines || 'unknown';
    
    // Detect file type for syntax highlighting
    const ext = filePath.split('.').pop();
    const language = this.detectLanguage(ext, content);
    
    return `## 📄 File Content

**File:** \`${filePath}\` (${lines} lines)

\`\`\`${language}
${content}
\`\`\``;
  }

  /**
   * Format file write results
   */
  static formatFileWrite(result) {
    const filePath = result.data.path || 'unknown';
    const bytes = result.data.bytes || 0;
    
    return `## ✅ File Created

**File:** \`${filePath}\`  
**Size:** ${this.formatBytes(bytes)}

File has been successfully created and written.`;
  }

  /**
   * Format shell command output
   */
  static formatCommandOutput(result) {
    const command = result.data.command || 'unknown';
    const output = result.data.stdout || result.data.output || '';
    const exitCode = result.data.exit_code ?? result.data.exitCode ?? 'unknown';
    
    return `## 🔧 Command Result

**Command:** \`${command}\`  
**Exit Code:** ${exitCode}

\`\`\`bash
${output}
\`\`\``;
  }

  /**
   * Format search results
   */
  static formatSearchResults(result) {
    const matches = result.data.matches || [];
    const pattern = result.data.pattern || 'unknown';
    
    if (matches.length === 0) {
      return `## 🔍 Search Results

**Pattern:** \`${pattern}\`

*No matches found*`;
    }

    const formatted = matches.slice(0, 10).map(match => {
      return `- **${match.file}:${match.line}** - \`${match.content.trim()}\``;
    }).join('\\n');

    const moreResults = matches.length > 10 ? `\\n\\n*...and ${matches.length - 10} more matches*` : '';

    return `## 🔍 Search Results

**Pattern:** \`${pattern}\`  
**Matches:** ${matches.length}

${formatted}${moreResults}`;
  }

  /**
   * Format memory save results
   */
  static formatMemorySave(result) {
    return `## 💾 Memory Updated

Information has been saved to long-term memory for future reference.`;
  }

  /**
   * Format generic tool results
   */
  static formatGeneric(toolName, result) {
    const data = result.data || result;
    
    return `## 🔧 Tool Result (${toolName})

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``;
  }

  /**
   * Detect programming language from file extension and content
   */
  static detectLanguage(ext, content) {
    const extMap = {
      'js': 'javascript',
      'ts': 'typescript', 
      'py': 'python',
      'json': 'json',
      'md': 'markdown',
      'html': 'html',
      'css': 'css',
      'sh': 'bash',
      'yml': 'yaml',
      'yaml': 'yaml'
    };

    if (extMap[ext]) {
      return extMap[ext];
    }

    // Content-based detection
    if (content.includes('function ') || content.includes('const ')) return 'javascript';
    if (content.includes('def ') || content.includes('import ')) return 'python';
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) return 'json';
    if (content.includes('<!DOCTYPE') || content.includes('<html')) return 'html';
    
    return 'plaintext';
  }

  /**
   * Format byte sizes in human readable format
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 bytes';
    const k = 1024;
    const sizes = ['bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
    return formatted + ' ' + sizes[i];
  }
}