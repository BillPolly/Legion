/**
 * Smart Tool Result Formatter
 * Handles errors consistently and provides tool-specific formatting
 */

import path from 'path';

export class SmartToolResultFormatter {
  /**
   * Format any tool result with smart error handling and tool-specific formatting
   * @param {string} toolName - Name of the tool that was executed
   * @param {Object} result - Tool execution result
   * @returns {string} Formatted markdown content
   */
  static format(toolName, result) {
    // First check for errors (all tools have similar error patterns)
    if (!result.success) {
      return this.formatError(toolName, result);
    }

    // Check for command failure (exit code != 0) for shell tools
    if (result.data && result.data.exit_code && result.data.exit_code !== 0) {
      return this.formatCommandFailure(toolName, result);
    }

    // Route to tool-specific formatter
    switch (toolName) {
      case 'shell_command':
        return this.formatShellCommand(result);
      case 'list_files':
        return this.formatFileList(result);
      case 'read_file':
        return this.formatFileContent(result);
      case 'write_file':
        return this.formatFileWrite(result);
      case 'grep_search':
        return this.formatSearchResults(result);
      case 'edit_file':
        return this.formatFileEdit(result);
      case 'save_memory':
        return this.formatMemorySave(result);
      case 'glob_pattern':
        return this.formatGlobResults(result);
      case 'ripgrep_search':
        return this.formatSearchResults(result);
      default:
        return this.formatDefault(toolName, result);
    }
  }

  /**
   * Format error results (consistent across all tools)
   */
  static formatError(toolName, result) {
    return `⚠️ **Tool Error (${toolName}):** ${result.error}

The ${toolName} tool encountered an error and could not complete the requested operation.`;
  }

  /**
   * Format command failure (exit code != 0)
   */
  static formatCommandFailure(toolName, result) {
    const command = result.data.command || 'unknown';
    const exitCode = result.data.exit_code;
    const stderr = result.data.stderr || '';
    
    return `❌ **Command Failed (${toolName})**

**Command:** \`${command}\`  
**Exit Code:** ${exitCode}

\`\`\`
${stderr}
\`\`\``;
  }

  /**
   * Format shell command results (bash, sh, etc.)
   */
  static formatShellCommand(result) {
    const command = result.data.command || 'unknown';
    const stdout = result.data.stdout || '';
    const exitCode = result.data.exit_code ?? 'unknown';
    
    return `## 🔧 Shell Command Result

**Command:** \`${command}\`  
**Exit Code:** ${exitCode}

\`\`\`bash
${stdout}
\`\`\``;
  }

  /**
   * Format file listing results
   */
  static formatFileList(result) {
    const entries = result.data.entries || [];
    const path = result.data.path || 'unknown';
    
    if (entries.length === 0) {
      return `## 📁 Directory Listing

Path: \`${path}\`

*Directory is empty*`;
    }

    const formatted = entries.map(entry => {
      const icon = entry.type === 'directory' ? '📂' : '📄';
      const size = this.formatBytes(entry.size || 0);
      const date = entry.modified ? new Date(entry.modified).toLocaleDateString() : '';
      return `- **${icon} ${entry.name}** (${entry.type}) - ${size} ${date}`;
    }).join('\\n');

    return `## 📁 Directory Listing

Path: \`${path}\`

${formatted}`;
  }

  /**
   * Format file content results
   */
  static formatFileContent(result) {
    const content = result.data.content || '';
    const filePath = result.data.path || 'unknown';
    const lines = result.data.lines || 'unknown';
    
    // Detect language for syntax highlighting
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
    const bytes = result.data.bytesWritten || result.data.bytes || 0;
    
    return `## ✅ File Written

**File:** \`${filePath}\`  
**Size:** ${this.formatBytes(bytes)}

File has been successfully created and written.`;
  }

  /**
   * Format search results
   */
  static formatSearchResults(result) {
    const matches = result.data.matches || [];
    const totalMatches = result.data.totalMatches || matches.length;
    const pattern = result.data.pattern || 'unknown';
    
    if (matches.length === 0) {
      return `## 🔍 Search Results

**Pattern:** \`${pattern}\`

*No matches found*`;
    }

    const formatted = matches.slice(0, 10).map(match => {
      const fileName = match.filePath ? path.basename(match.filePath) : 'unknown';
      const lineNum = match.lineNumber || match.line || '?';
      const content = (match.line || match.content || '').trim();
      return `- **${fileName}:${lineNum}** - \`${content}\``;
    }).join('\\n');

    const moreResults = matches.length > 10 ? `\\n\\n*...and ${matches.length - 10} more matches*` : '';

    return `## 🔍 Search Results

**Pattern:** \`${pattern}\`  
**Total Matches:** ${totalMatches}

${formatted}${moreResults}`;
  }

  /**
   * Format file edit results
   */
  static formatFileEdit(result) {
    const filePath = result.data.path || 'unknown';
    const replacements = result.data.replacements || 0;
    const backupPath = result.data.backup_path;
    
    const backupInfo = backupPath ? `\n\n*Backup created at:* \`${path.basename(backupPath)}\`` : '';
    
    return `## ✏️ File Edited

**File:** \`${filePath}\`  
**Replacements:** ${replacements}${backupInfo}

File has been successfully modified.`;
  }

  /**
   * Format memory save results
   */
  static formatMemorySave(result) {
    const fact = result.data.fact || '';
    const memoryPath = result.data.memoryPath;
    
    const pathInfo = memoryPath ? `\n\n*Saved to:* \`${path.basename(memoryPath)}\`` : '';
    
    return `## 💾 Memory Updated

**Fact:** ${fact.substring(0, 100)}${fact.length > 100 ? '...' : ''}${pathInfo}

Information has been saved to long-term memory for future reference.`;
  }

  /**
   * Format glob pattern results
   */
  static formatGlobResults(result) {
    const files = result.data.files || [];
    const totalFiles = result.data.totalFiles || files.length;
    const pattern = result.data.pattern || 'unknown';
    
    if (files.length === 0) {
      return `## 🔍 Pattern Search Results

**Pattern:** \`${pattern}\`

*No files found matching pattern*`;
    }

    const formatted = files.slice(0, 15).map(filePath => {
      const fileName = path.basename(filePath);
      const dir = path.dirname(filePath);
      const relativePath = dir.split('/').slice(-2).join('/'); // Show last 2 dirs
      return `- **📄 ${fileName}** in \`${relativePath}\``;
    }).join('\\n');

    const moreFiles = files.length > 15 ? `\\n\\n*...and ${files.length - 15} more files*` : '';

    return `## 🔍 Pattern Search Results

**Pattern:** \`${pattern}\`  
**Files Found:** ${totalFiles}

${formatted}${moreFiles}`;
  }

  /**
   * Default formatter for unknown tools
   */
  static formatDefault(toolName, result) {
    return `## 🔧 Tool Result (${toolName})

\`\`\`json
${JSON.stringify(result.data || result, null, 2)}
\`\`\``;
  }

  /**
   * Format byte sizes
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 bytes';
    const k = 1024;
    const sizes = ['bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return (value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Detect programming language
   */
  static detectLanguage(ext, content) {
    const extMap = {
      'js': 'javascript', 'ts': 'typescript', 'py': 'python',
      'json': 'json', 'md': 'markdown', 'html': 'html',
      'css': 'css', 'sh': 'bash', 'yml': 'yaml', 'yaml': 'yaml'
    };

    if (extMap[ext]) return extMap[ext];
    
    // Content-based detection
    if (content.includes('function ') || content.includes('const ')) return 'javascript';
    if (content.includes('def ') || content.includes('import ')) return 'python';
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) return 'json';
    
    return 'plaintext';
  }
}