/**
 * CodeLinter - Utility for linting code
 * 
 * Provides code linting functionality with ESLint integration
 * and automatic issue detection.
 */

class CodeLinter {
  constructor(codeAgent) {
    this.codeAgent = codeAgent;
  }

  /**
   * Lint JavaScript code
   * @param {string} content - Code content to lint
   * @param {Object} config - ESLint configuration
   * @returns {Promise<Array>} Array of lint issues
   */
  async lintCode(content, config) {
    // Mock linting for now - in production this would use actual ESLint
    const issues = [];
    
    // Basic checks
    if (content.includes('console.log') && !config.rules?.['no-console']?.[0] === 'off') {
      issues.push({
        line: 1,
        column: 1,
        severity: 1,
        message: 'Unexpected console statement',
        ruleId: 'no-console'
      });
    }
    
    if (content.includes('var ')) {
      issues.push({
        line: 1,
        column: 1,
        severity: 2,
        message: 'Unexpected var, use let or const instead',
        ruleId: 'no-var'
      });
    }
    
    // Check for missing semicolons if required
    if (config.rules?.semi?.[0] === 'error') {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.trim() && 
            !line.trim().endsWith(';') && 
            !line.trim().endsWith('{') && 
            !line.trim().endsWith('}') &&
            !line.includes('//')) {
          issues.push({
            line: index + 1,
            column: line.length,
            severity: 2,
            message: 'Missing semicolon',
            ruleId: 'semi'
          });
        }
      });
    }
    
    return issues;
  }

  /**
   * Generate fix for an ESLint issue
   * @param {Object} issue - ESLint issue
   * @param {string} content - Original code content
   * @returns {string} Fixed code content
   */
  generateESLintFix(issue, content) {
    let fixedContent = content;
    const lines = content.split('\n');
    
    switch (issue.ruleId) {
      case 'no-console':
        // Remove console statements
        fixedContent = content.replace(/console\.(log|warn|error|info)\([^)]*\);?\n?/g, '');
        break;
        
      case 'no-var':
        // Replace var with let
        fixedContent = content.replace(/\bvar\s+/g, 'let ');
        break;
        
      case 'semi':
        // Add missing semicolons
        if (issue.line && issue.line <= lines.length) {
          const lineIndex = issue.line - 1;
          const line = lines[lineIndex];
          if (!line.trim().endsWith(';')) {
            lines[lineIndex] = line + ';';
            fixedContent = lines.join('\n');
          }
        }
        break;
        
      case 'quotes':
        // Fix quote style
        if (issue.message.includes('single')) {
          fixedContent = content.replace(/"/g, "'");
        } else {
          fixedContent = content.replace(/'/g, '"');
        }
        break;
        
      case 'indent':
        // Fix indentation (simple 2-space indent)
        fixedContent = lines.map(line => {
          const leadingSpaces = line.match(/^\s*/)[0];
          const tabCount = leadingSpaces.split('\t').length - 1;
          const spaceCount = leadingSpaces.replace(/\t/g, '').length;
          const totalIndent = tabCount * 2 + spaceCount;
          const normalizedIndent = Math.floor(totalIndent / 2) * 2;
          return ' '.repeat(normalizedIndent) + line.trim();
        }).join('\n');
        break;
    }
    
    return fixedContent;
  }
}

export { CodeLinter };