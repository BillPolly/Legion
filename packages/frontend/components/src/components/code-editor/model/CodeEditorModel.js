/**
 * CodeEditorModel - State management and business logic for CodeEditor component
 * 
 * Handles document content, history, validation, and provides controlled
 * access to editor operations. Maintains immutable state patterns.
 */
import { UmbilicalError } from '@legion/components/index.js';

export class CodeEditorModel {
  constructor(initialContent = '', config = {}) {
    // Configuration
    this.config = {
      language: config.language || 'javascript',
      readOnly: config.readOnly || false,
      maxHistorySize: config.maxHistorySize || 100,
      validateContent: config.validateContent || null,
      autoFormat: config.autoFormat || false,
      tabSize: config.tabSize || 2,
      insertSpaces: config.insertSpaces !== false,
      wordWrap: config.wordWrap || false,
      lineNumbers: config.lineNumbers !== false,
      foldGutter: config.foldGutter || false,
      ...config
    };

    // State
    this._content = initialContent;
    this._originalContent = initialContent;
    this._history = [{
      content: initialContent,
      timestamp: Date.now(),
      cursor: { line: 0, ch: 0 },
      selection: null
    }];
    this._historyIndex = 0;
    this._changeListeners = new Set();
    this._validationErrors = [];
    this._cursor = { line: 0, ch: 0 };
    this._selection = null;
    this._isDirty = false;

    // Language configurations
    this._languageConfigs = new Map([
      ['javascript', {
        extensions: ['js', 'mjs'],
        mode: 'javascript',
        keywords: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return'],
        brackets: ['()', '[]', '{}'],
        lineComment: '//',
        blockComment: ['/*', '*/'],
        autoCloseBrackets: true
      }],
      ['typescript', {
        extensions: ['ts', 'tsx'],
        mode: 'typescript',
        keywords: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'interface', 'type'],
        brackets: ['()', '[]', '{}'],
        lineComment: '//',
        blockComment: ['/*', '*/'],
        autoCloseBrackets: true
      }],
      ['python', {
        extensions: ['py'],
        mode: 'python',
        keywords: ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from'],
        brackets: ['()', '[]', '{}'],
        lineComment: '#',
        blockComment: ['"""', '"""'],
        autoCloseBrackets: true
      }],
      ['html', {
        extensions: ['html', 'htm'],
        mode: 'html',
        keywords: [],
        brackets: ['<>', '()', '[]', '{}'],
        lineComment: null,
        blockComment: ['<!--', '-->'],
        autoCloseBrackets: true
      }],
      ['css', {
        extensions: ['css'],
        mode: 'css',
        keywords: ['color', 'background', 'margin', 'padding', 'display', 'position'],
        brackets: ['()', '[]', '{}'],
        lineComment: null,
        blockComment: ['/*', '*/'],
        autoCloseBrackets: true
      }],
      ['json', {
        extensions: ['json'],
        mode: 'json',
        keywords: [],
        brackets: ['()', '[]', '{}'],
        lineComment: null,
        blockComment: null,
        autoCloseBrackets: true
      }]
    ]);

    // Initial validation
    this._validateContent();
  }

  /**
   * Add a change listener
   */
  addChangeListener(listener) {
    if (typeof listener !== 'function') {
      throw new UmbilicalError('Change listener must be a function', 'CodeEditorModel');
    }
    this._changeListeners.add(listener);
  }

  /**
   * Remove a change listener
   */
  removeChangeListener(listener) {
    this._changeListeners.delete(listener);
  }

  /**
   * Notify change listeners
   */
  _notifyChange(changeType, data = {}) {
    this._changeListeners.forEach(listener => {
      try {
        listener(changeType, data, this);
      } catch (error) {
        console.error('CodeEditor change listener error:', error);
      }
    });
  }

  /**
   * Validate content
   */
  _validateContent() {
    this._validationErrors = [];

    if (this.config.validateContent) {
      try {
        const errors = this.config.validateContent(this._content, this.config.language);
        if (Array.isArray(errors)) {
          this._validationErrors = errors;
        }
      } catch (error) {
        this._validationErrors.push({
          line: 1,
          column: 1,
          message: `Validation error: ${error.message}`,
          severity: 'error'
        });
      }
    }

    // Basic syntax validation for known languages
    this._performBasicValidation();
  }

  /**
   * Perform basic syntax validation
   */
  _performBasicValidation() {
    const langConfig = this._languageConfigs.get(this.config.language);
    if (!langConfig) return;

    const lines = this._content.split('\n');
    
    // Check for unmatched brackets
    const bracketStack = [];
    const bracketPairs = {
      '(': ')', '[': ']', '{': '}', '<': '>'
    };

    lines.forEach((line, lineIndex) => {
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        // Skip comments and strings (basic detection)
        if (this._isInComment(line, i) || this._isInString(line, i)) {
          continue;
        }

        if (bracketPairs[char]) {
          bracketStack.push({ char, line: lineIndex + 1, column: i + 1 });
        } else if (Object.values(bracketPairs).includes(char)) {
          const last = bracketStack.pop();
          if (!last || bracketPairs[last.char] !== char) {
            this._validationErrors.push({
              line: lineIndex + 1,
              column: i + 1,
              message: `Unmatched ${char}`,
              severity: 'error'
            });
          }
        }
      }
    });

    // Check for unclosed brackets
    bracketStack.forEach(bracket => {
      this._validationErrors.push({
        line: bracket.line,
        column: bracket.column,
        message: `Unclosed ${bracket.char}`,
        severity: 'error'
      });
    });
  }

  /**
   * Check if position is in comment (basic detection)
   */
  _isInComment(line, position) {
    const langConfig = this._languageConfigs.get(this.config.language);
    if (!langConfig) return false;

    // Check line comment
    if (langConfig.lineComment) {
      const commentIndex = line.indexOf(langConfig.lineComment);
      if (commentIndex !== -1 && position >= commentIndex) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if position is in string (basic detection)
   */
  _isInString(line, position) {
    // Simple string detection - could be enhanced
    let inString = false;
    let stringChar = null;

    for (let i = 0; i < position; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : null;

      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = null;
        }
      }
    }

    return inString;
  }

  /**
   * Get current content
   */
  getContent() {
    return this._content;
  }

  /**
   * Set content with history tracking
   */
  setContent(newContent, options = {}) {
    if (this.config.readOnly && !options.force) {
      throw new UmbilicalError('Cannot modify read-only editor', 'CodeEditorModel');
    }

    if (newContent === this._content) {
      return false; // No change
    }

    const oldContent = this._content;
    this._content = newContent;
    this._isDirty = newContent !== this._originalContent;

    // Add to history if not from undo/redo
    if (!options.fromHistory) {
      this._addToHistory({
        content: newContent,
        timestamp: Date.now(),
        cursor: options.cursor || this._cursor,
        selection: options.selection || this._selection
      });
    }

    // Validate new content
    this._validateContent();

    this._notifyChange('contentChanged', {
      oldContent,
      newContent,
      isDirty: this._isDirty,
      validationErrors: this._validationErrors
    });

    return true;
  }

  /**
   * Insert text at position
   */
  insertText(text, position = null, options = {}) {
    if (this.config.readOnly && !options.force) {
      throw new UmbilicalError('Cannot modify read-only editor', 'CodeEditorModel');
    }

    const pos = position || this._cursor;
    const lines = this._content.split('\n');
    
    if (pos.line < 0 || pos.line >= lines.length) {
      throw new UmbilicalError('Invalid line position', 'CodeEditorModel');
    }

    const line = lines[pos.line];
    if (pos.ch < 0 || pos.ch > line.length) {
      throw new UmbilicalError('Invalid character position', 'CodeEditorModel');
    }

    // Insert text
    const newLine = line.slice(0, pos.ch) + text + line.slice(pos.ch);
    lines[pos.line] = newLine;
    
    const newContent = lines.join('\n');
    const newCursor = {
      line: pos.line,
      ch: pos.ch + text.length
    };

    this.setContent(newContent, {
      cursor: newCursor,
      ...options
    });

    this._cursor = newCursor;
    return newCursor;
  }

  /**
   * Delete text range
   */
  deleteRange(from, to, options = {}) {
    if (this.config.readOnly && !options.force) {
      throw new UmbilicalError('Cannot modify read-only editor', 'CodeEditorModel');
    }

    const lines = this._content.split('\n');

    // Normalize positions
    if (from.line > to.line || (from.line === to.line && from.ch > to.ch)) {
      [from, to] = [to, from];
    }

    // Single line deletion
    if (from.line === to.line) {
      const line = lines[from.line];
      const newLine = line.slice(0, from.ch) + line.slice(to.ch);
      lines[from.line] = newLine;
    } else {
      // Multi-line deletion
      const firstLine = lines[from.line].slice(0, from.ch);
      const lastLine = lines[to.line].slice(to.ch);
      const newLine = firstLine + lastLine;

      // Remove lines in between and update
      lines.splice(from.line, to.line - from.line + 1, newLine);
    }

    const newContent = lines.join('\n');
    this.setContent(newContent, {
      cursor: from,
      ...options
    });

    this._cursor = from;
    return from;
  }

  /**
   * Add entry to history
   */
  _addToHistory(entry) {
    // Remove any history after current index
    this._history = this._history.slice(0, this._historyIndex + 1);
    
    // Add new entry
    this._history.push(entry);
    this._historyIndex = this._history.length - 1;

    // Trim history if too large
    if (this._history.length > this.config.maxHistorySize) {
      this._history.shift();
      this._historyIndex--;
    }
  }

  /**
   * Undo last change
   */
  undo() {
    if (!this.canUndo()) {
      return false;
    }

    this._historyIndex--;
    const entry = this._history[this._historyIndex];
    
    this.setContent(entry.content, {
      fromHistory: true,
      cursor: entry.cursor,
      selection: entry.selection
    });

    this._cursor = entry.cursor;
    this._selection = entry.selection;

    this._notifyChange('undo', {
      historyIndex: this._historyIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });

    return true;
  }

  /**
   * Redo last undone change
   */
  redo() {
    if (!this.canRedo()) {
      return false;
    }

    this._historyIndex++;
    const entry = this._history[this._historyIndex];
    
    this.setContent(entry.content, {
      fromHistory: true,
      cursor: entry.cursor,
      selection: entry.selection
    });

    this._cursor = entry.cursor;
    this._selection = entry.selection;

    this._notifyChange('redo', {
      historyIndex: this._historyIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });

    return true;
  }

  /**
   * Check if undo is possible
   */
  canUndo() {
    return this._historyIndex > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo() {
    return this._historyIndex < this._history.length - 1;
  }

  /**
   * Get cursor position
   */
  getCursor() {
    return { ...this._cursor };
  }

  /**
   * Set cursor position
   */
  setCursor(position) {
    if (position.line < 0 || position.ch < 0) {
      throw new UmbilicalError('Invalid cursor position', 'CodeEditorModel');
    }

    const lines = this._content.split('\n');
    if (position.line >= lines.length) {
      throw new UmbilicalError('Cursor line out of bounds', 'CodeEditorModel');
    }

    if (position.ch > lines[position.line].length) {
      throw new UmbilicalError('Cursor character out of bounds', 'CodeEditorModel');
    }

    this._cursor = { ...position };
    
    this._notifyChange('cursorChanged', {
      cursor: this._cursor,
      selection: this._selection
    });
  }

  /**
   * Get selection
   */
  getSelection() {
    return this._selection ? { ...this._selection } : null;
  }

  /**
   * Set selection
   */
  setSelection(from, to = null) {
    if (!to) {
      this._selection = null;
      this._cursor = from;
    } else {
      this._selection = { from: { ...from }, to: { ...to } };
      this._cursor = to;
    }

    this._notifyChange('selectionChanged', {
      cursor: this._cursor,
      selection: this._selection
    });
  }

  /**
   * Get selected text
   */
  getSelectedText() {
    if (!this._selection) {
      return '';
    }

    const lines = this._content.split('\n');
    const { from, to } = this._selection;

    if (from.line === to.line) {
      return lines[from.line].slice(from.ch, to.ch);
    }

    let result = lines[from.line].slice(from.ch) + '\n';
    for (let i = from.line + 1; i < to.line; i++) {
      result += lines[i] + '\n';
    }
    result += lines[to.line].slice(0, to.ch);

    return result;
  }

  /**
   * Get language configuration
   */
  getLanguageConfig() {
    return this._languageConfigs.get(this.config.language) || null;
  }

  /**
   * Set language
   */
  setLanguage(language) {
    if (!this._languageConfigs.has(language)) {
      throw new UmbilicalError(`Unsupported language: ${language}`, 'CodeEditorModel');
    }

    this.config.language = language;
    this._validateContent();

    this._notifyChange('languageChanged', {
      language,
      config: this.getLanguageConfig()
    });
  }

  /**
   * Get validation errors
   */
  getValidationErrors() {
    return [...this._validationErrors];
  }

  /**
   * Check if content is dirty
   */
  isDirty() {
    return this._isDirty;
  }

  /**
   * Mark content as saved
   */
  markSaved() {
    this._originalContent = this._content;
    this._isDirty = false;

    this._notifyChange('saved', {
      content: this._content,
      isDirty: false
    });
  }

  /**
   * Get editor statistics
   */
  getStats() {
    const lines = this._content.split('\n');
    const words = this._content.split(/\s+/).filter(word => word.length > 0);
    
    return {
      lines: lines.length,
      characters: this._content.length,
      charactersNoSpaces: this._content.replace(/\s/g, '').length,
      words: words.length,
      language: this.config.language,
      isDirty: this._isDirty,
      historySize: this._history.length,
      historyIndex: this._historyIndex,
      validationErrors: this._validationErrors.length,
      cursor: this._cursor,
      hasSelection: !!this._selection
    };
  }

  /**
   * Export current state
   */
  exportState() {
    return {
      content: this._content,
      originalContent: this._originalContent,
      cursor: this._cursor,
      selection: this._selection,
      history: this._history.map(entry => ({ ...entry })),
      historyIndex: this._historyIndex,
      config: { ...this.config },
      validationErrors: [...this._validationErrors],
      isDirty: this._isDirty
    };
  }

  /**
   * Import state
   */
  importState(state) {
    if (!state || typeof state !== 'object') {
      throw new UmbilicalError('Invalid state object for import', 'CodeEditorModel');
    }

    this._content = state.content || '';
    this._originalContent = state.originalContent || '';
    this._cursor = state.cursor || { line: 0, ch: 0 };
    this._selection = state.selection || null;
    this._history = state.history || [{ content: this._content, timestamp: Date.now(), cursor: this._cursor }];
    this._historyIndex = state.historyIndex || 0;
    this._validationErrors = state.validationErrors || [];
    this._isDirty = state.isDirty || false;

    if (state.config) {
      Object.assign(this.config, state.config);
    }

    this._notifyChange('stateImported', { importedState: state });
  }

  /**
   * Reset to initial state
   */
  reset(newContent = '') {
    this._content = newContent;
    this._originalContent = newContent;
    this._cursor = { line: 0, ch: 0 };
    this._selection = null;
    this._history = [{
      content: newContent,
      timestamp: Date.now(),
      cursor: { line: 0, ch: 0 },
      selection: null
    }];
    this._historyIndex = 0;
    this._validationErrors = [];
    this._isDirty = false;

    this._validateContent();
    this._notifyChange('reset', { newContent });
  }

  /**
   * Destroy model and cleanup
   */
  destroy() {
    this._changeListeners.clear();
    this._history = [];
    this._validationErrors = [];
    this._content = '';
    this._cursor = { line: 0, ch: 0 };
    this._selection = null;
  }
}