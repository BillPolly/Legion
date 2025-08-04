import { ArtifactRenderer } from '../ArtifactRenderer.js';

/**
 * CodeRenderer - Renders code artifacts with syntax highlighting
 */
export class CodeRenderer extends ArtifactRenderer {
  constructor() {
    super('code');
  }

  renderContent(artifact, content) {
    const container = document.createElement('div');
    container.style.cssText = `
      background: #0d1117;
      border-radius: 6px;
      overflow: hidden;
      font-family: 'SFMono-Regular', 'Consolas', 'Monaco', 'Liberation Mono', 'Courier New', monospace;
    `;

    // Header with language and copy button
    const header = document.createElement('div');
    header.style.cssText = `
      background: #161b22;
      padding: 8px 12px;
      font-size: 12px;
      color: #8b949e;
      display: flex;
      justify-content: between;
      align-items: center;
      border-bottom: 1px solid #21262d;
    `;

    const languageLabel = document.createElement('span');
    languageLabel.textContent = this.getLanguageDisplayName(artifact.subtype);
    header.appendChild(languageLabel);

    const copyButton = document.createElement('button');
    copyButton.textContent = '📋 Copy';
    copyButton.style.cssText = `
      background: none;
      border: 1px solid #30363d;
      color: #8b949e;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      margin-left: auto;
    `;

    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        copyButton.textContent = '✅ Copied';
        setTimeout(() => {
          copyButton.textContent = '📋 Copy';
        }, 2000);
      });
    });

    header.appendChild(copyButton);
    container.appendChild(header);

    // Code content
    const pre = document.createElement('pre');
    pre.style.cssText = `
      margin: 0;
      padding: 16px;
      overflow-x: auto;
      background: #0d1117;
      color: #c9d1d9;
      font-size: 13px;
      line-height: 1.45;
    `;

    const code = document.createElement('code');
    code.className = `language-${artifact.subtype}`;
    
    // Apply basic syntax highlighting
    code.innerHTML = this.highlightCode(content, artifact.subtype);
    
    pre.appendChild(code);
    container.appendChild(pre);

    return container;
  }

  /**
   * Get display name for programming language
   * @param {string} extension - File extension or language identifier
   * @returns {string} Display name
   */
  getLanguageDisplayName(extension) {
    const languageMap = {
      js: 'JavaScript',
      jsx: 'JSX',
      ts: 'TypeScript',
      tsx: 'TSX',
      py: 'Python',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      cs: 'C#',
      php: 'PHP',
      rb: 'Ruby',
      go: 'Go',
      rs: 'Rust',
      swift: 'Swift',
      kt: 'Kotlin',
      scala: 'Scala',
      sh: 'Shell',
      bash: 'Bash',
      zsh: 'Zsh',
      fish: 'Fish',
      ps1: 'PowerShell',
      bat: 'Batch'
    };

    return languageMap[extension] || extension?.toUpperCase() || 'Code';
  }

  /**
   * Apply basic syntax highlighting
   * @param {string} code - Code content
   * @param {string} language - Programming language
   * @returns {string} Highlighted HTML
   */
  highlightCode(code, language) {
    // Escape HTML first
    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Apply basic highlighting based on language
    switch (language) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        highlighted = this.highlightJavaScript(highlighted);
        break;
      case 'py':
        highlighted = this.highlightPython(highlighted);
        break;
      case 'html':
      case 'htm':
        highlighted = this.highlightHTML(highlighted);
        break;
      case 'css':
        highlighted = this.highlightCSS(highlighted);
        break;
      case 'json':
        highlighted = this.highlightJSON(highlighted);
        break;
      default:
        highlighted = this.highlightGeneric(highlighted);
    }

    return highlighted;
  }

  /**
   * Highlight JavaScript/TypeScript code
   * @param {string} code - Code content
   * @returns {string} Highlighted HTML
   */
  highlightJavaScript(code) {
    // Keywords
    code = code.replace(/\b(const|let|var|function|class|extends|import|export|from|default|if|else|for|while|do|return|try|catch|finally|throw|new|this|super|async|await|yield|typeof|instanceof|in|of|delete|void)\b/g, 
      '<span style="color: #ff7b72;">$1</span>');

    // Strings
    code = code.replace(/(["'`])((?:\\.|(?!\1)[^\\])*)(\1)/g, 
      '<span style="color: #a5d6ff;">$1$2$3</span>');

    // Numbers
    code = code.replace(/\b\d+(\.\d+)?\b/g, 
      '<span style="color: #79c0ff;">$&</span>');

    // Comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, 
      '<span style="color: #8b949e;">$&</span>');
    code = code.replace(/\/\/.*$/gm, 
      '<span style="color: #8b949e;">$&</span>');

    return code;
  }

  /**
   * Highlight Python code
   * @param {string} code - Code content
   * @returns {string} Highlighted HTML
   */
  highlightPython(code) {
    // Keywords
    code = code.replace(/\b(def|class|import|from|as|if|elif|else|for|while|try|except|finally|with|return|yield|lambda|pass|break|continue|and|or|not|in|is|None|True|False)\b/g, 
      '<span style="color: #ff7b72;">$1</span>');

    // Strings
    code = code.replace(/(["'])((?:\\.|(?!\1)[^\\])*)(\1)/g, 
      '<span style="color: #a5d6ff;">$1$2$3</span>');

    // Numbers
    code = code.replace(/\b\d+(\.\d+)?\b/g, 
      '<span style="color: #79c0ff;">$&</span>');

    // Comments
    code = code.replace(/#.*$/gm, 
      '<span style="color: #8b949e;">$&</span>');

    return code;
  }

  /**
   * Highlight HTML code
   * @param {string} code - Code content
   * @returns {string} Highlighted HTML
   */
  highlightHTML(code) {
    // Tags
    code = code.replace(/(&lt;\/?)([\w-]+)([^&]*?)(&gt;)/g, 
      '<span style="color: #8b949e;">$1</span><span style="color: #7ee787;">$2</span><span style="color: #79c0ff;">$3</span><span style="color: #8b949e;">$4</span>');

    // Attributes
    code = code.replace(/([\w-]+)(=)(".*?")/g, 
      '<span style="color: #79c0ff;">$1</span>$2<span style="color: #a5d6ff;">$3</span>');

    return code;
  }

  /**
   * Highlight CSS code
   * @param {string} code - Code content
   * @returns {string} Highlighted HTML
   */
  highlightCSS(code) {
    // Selectors
    code = code.replace(/^([^{]+)(?={)/gm, 
      '<span style="color: #7ee787;">$1</span>');

    // Properties
    code = code.replace(/([\w-]+)(:)/g, 
      '<span style="color: #79c0ff;">$1</span>$2');

    // Values
    code = code.replace(/(:)([^;]+)(;)/g, 
      '$1<span style="color: #a5d6ff;">$2</span>$3');

    return code;
  }

  /**
   * Highlight JSON code
   * @param {string} code - Code content
   * @returns {string} Highlighted HTML
   */
  highlightJSON(code) {
    // Keys
    code = code.replace(/"(\w+)":/g, 
      '<span style="color: #79c0ff;">"$1"</span>:');

    // String values
    code = code.replace(/: *"([^"]*)"([,}])/g, 
      ': <span style="color: #a5d6ff;">"$1"</span>$2');

    // Numbers
    code = code.replace(/: *(\d+(\.\d+)?)([,}])/g, 
      ': <span style="color: #79c0ff;">$1</span>$3');

    // Booleans and null
    code = code.replace(/: *(true|false|null)([,}])/g, 
      ': <span style="color: #ff7b72;">$1</span>$2');

    return code;
  }

  /**
   * Generic highlighting for unknown languages
   * @param {string} code - Code content
   * @returns {string} Highlighted HTML
   */
  highlightGeneric(code) {
    // Strings
    code = code.replace(/(["'])((?:\\.|(?!\1)[^\\])*)(\1)/g, 
      '<span style="color: #a5d6ff;">$1$2$3</span>');

    // Numbers
    code = code.replace(/\b\d+(\.\d+)?\b/g, 
      '<span style="color: #79c0ff;">$&</span>');

    // Comments (C-style)
    code = code.replace(/\/\*[\s\S]*?\*\//g, 
      '<span style="color: #8b949e;">$&</span>');
    code = code.replace(/\/\/.*$/gm, 
      '<span style="color: #8b949e;">$&</span>');

    return code;
  }
}