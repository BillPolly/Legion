/**
 * CodeEditorViewModel - Coordination layer between CodeEditorModel and CodeEditorView
 * 
 * Handles user interactions, coordinates model updates with view updates,
 * manages animations, keyboard shortcuts, and business logic orchestration.
 */

export class CodeEditorViewModel {
  constructor(model, view, config = {}) {
    this.model = model;
    this.view = view;
    this.config = {
      autoSave: config.autoSave || false,
      autoSaveDelay: config.autoSaveDelay || 2000,
      syncCursor: config.syncCursor !== false,
      syncSelection: config.syncSelection !== false,
      enableAnimations: config.enableAnimations !== false,
      ...config
    };

    // State
    this.isDestroyed = false;
    this.autoSaveTimer = null;
    this.isSyncing = false; // Prevent infinite sync loops
    this.lastContent = ''; // Track content for change detection
    this.originalContent = ''; // Track original content to identify changes
    this.changeRanges = []; // Track ranges that have changed

    // Bind methods to maintain context
    this._handleModelChange = this._handleModelChange.bind(this);
    this._handleViewContentChange = this._handleViewContentChange.bind(this);
    this._handleViewSelectionChange = this._handleViewSelectionChange.bind(this);
    this._handleViewKeydown = this._handleViewKeydown.bind(this);
    this._handleViewFocus = this._handleViewFocus.bind(this);
    this._handleViewBlur = this._handleViewBlur.bind(this);

    this._initialize();
  }

  /**
   * Initialize the ViewModel
   */
  _initialize() {
    // Listen to model changes
    this.model.addChangeListener(this._handleModelChange);

    // Listen to view changes
    this.view.addEventListener('change', this._handleViewContentChange);
    this.view.addEventListener('selectionChange', this._handleViewSelectionChange);
    this.view.addEventListener('keydown', this._handleViewKeydown);
    this.view.addEventListener('focus', this._handleViewFocus);
    this.view.addEventListener('blur', this._handleViewBlur);

    // Initial sync from model to view
    this._syncModelToView();
    
    // Set original content for change tracking
    this.originalContent = this.view.getValue();
  }

  /**
   * Handle model changes and update view accordingly
   */
  _handleModelChange(changeType, data) {
    if (this.isDestroyed || this.isSyncing) return;

    switch (changeType) {
      case 'contentChanged':
        this._handleModelContentChange(data);
        break;
      
      case 'cursorChanged':
        this._handleModelCursorChange(data);
        break;
      
      case 'selectionChanged':
        this._handleModelSelectionChange(data);
        break;
      
      case 'languageChanged':
        this._handleModelLanguageChange(data);
        break;
      
      case 'undo':
      case 'redo':
        this._handleModelHistoryChange(data);
        break;
      
      case 'saved':
        this._handleModelSaved(data);
        break;

      case 'stateImported':
      case 'reset':
        this._syncModelToView();
        break;
    }

    // Fire callbacks if provided
    if (this.config.onModelChange) {
      this.config.onModelChange(changeType, data, this);
    }
  }

  /**
   * Handle model content changes
   */
  _handleModelContentChange(data) {
    this.isSyncing = true;
    
    try {
      // Update view content if different
      const viewContent = this.view.getValue();
      if (viewContent !== data.newContent) {
        this.view.setValue(data.newContent);
      }

      // Handle auto-save
      if (this.config.autoSave && data.isDirty) {
        this._scheduleAutoSave();
      }

      // Fire callback
      if (this.config.onContentChange) {
        this.config.onContentChange(data.newContent, data.oldContent, data.isDirty);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Handle model cursor changes
   */
  _handleModelCursorChange(data) {
    if (!this.config.syncCursor) return;

    this.isSyncing = true;
    
    try {
      this.view.setSelection(data.cursor, data.cursor);
      
      if (this.config.onCursorChange) {
        this.config.onCursorChange(data.cursor, data.selection);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Handle model selection changes
   */
  _handleModelSelectionChange(data) {
    if (!this.config.syncSelection) return;

    this.isSyncing = true;
    
    try {
      if (data.selection) {
        this.view.setSelection(data.selection.from, data.selection.to);
      } else {
        this.view.setSelection(data.cursor, data.cursor);
      }

      if (this.config.onSelectionChange) {
        this.config.onSelectionChange(data.cursor, data.selection);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Handle model language changes
   */
  _handleModelLanguageChange(data) {
    this.view.setLanguage(data.language);
    
    if (this.config.onLanguageChange) {
      this.config.onLanguageChange(data.language, data.config);
    }
  }

  /**
   * Handle model history changes (undo/redo)
   */
  _handleModelHistoryChange(data) {
    this._syncModelToView();
    
    if (this.config.onHistoryChange) {
      this.config.onHistoryChange(data.historyIndex, data.canUndo, data.canRedo);
    }
  }

  /**
   * Handle model saved event
   */
  _handleModelSaved(data) {
    if (this.config.onSave) {
      this.config.onSave(data.content, data.isDirty);
    }
  }

  /**
   * Handle view content changes
   */
  _handleViewContentChange(data) {
    if (this.isSyncing) return;

    console.log('ViewModel received content change:', {
      newValue: data.value,
      lastContent: this.lastContent
    });

    // Track changes for highlighting
    if (data.changes) {
      this._trackChanges(data.changes);
    }

    // Just fire callbacks - CodeMirror is the source of truth
    if (this.config.onContentChange) {
      this.config.onContentChange(data.value, this.lastContent || '', true);
    }
    
    // Also fire history change callback if provided - this will update undo/redo buttons
    if (this.config.onHistoryChange) {
      // Use setTimeout to ensure the history state is updated after the current transaction
      setTimeout(() => {
        const canUndo = this.view.canUndo();
        const canRedo = this.view.canRedo();
        console.log('History state after content change:', { canUndo, canRedo });
        this.config.onHistoryChange(0, canUndo, canRedo);
      }, 0);
    }
    
    this.lastContent = data.value;
  }

  /**
   * Handle view selection changes
   */
  _handleViewSelectionChange(data) {
    if (this.isSyncing) return;

    // Don't sync selection back to model - CodeMirror is the source of truth
    // Just fire external callbacks
    
    if (this.config.onSelectionChange && data.selection) {
      this.config.onSelectionChange(data.selection);
    }
    
    if (this.config.onCursorChange && data.cursor !== undefined) {
      this.config.onCursorChange(data.cursor);
    }
  }

  /**
   * Handle view keydown events
   */
  _handleViewKeydown(data) {
    const { event } = data;
    
    // Handle custom keyboard shortcuts
    if (this._handleKeyboardShortcuts(event)) {
      event.preventDefault();
      return;
    }

    if (this.config.onKeyDown) {
      this.config.onKeyDown(event, this);
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  _handleKeyboardShortcuts(event) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? event.metaKey : event.ctrlKey;

    if (!modifier) return false;

    switch (event.key.toLowerCase()) {
      case 'z':
        if (event.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
        return true;

      case 'y':
        if (!event.shiftKey) {
          this.redo();
          return true;
        }
        break;

      case 'd':
        this.duplicateLine();
        return true;

      case 'l':
        this.selectLine();
        return true;

      case 'a':
        this.selectAll();
        return true;

      case 's':
        if (this.config.onSaveRequest) {
          this.config.onSaveRequest(this.model.getContent(), this);
        }
        return true;

      case '/':
        this.toggleComment();
        return true;

      case '[':
        this.indent(false);
        return true;

      case ']':
        this.indent(true);
        return true;
    }

    return false;
  }

  /**
   * Handle view focus
   */
  _handleViewFocus(data) {
    if (this.config.onFocus) {
      this.config.onFocus(this);
    }
  }

  /**
   * Handle view blur
   */
  _handleViewBlur(data) {
    if (this.config.onBlur) {
      this.config.onBlur(this);
    }
  }

  /**
   * Sync model state to view
   */
  _syncModelToView() {
    if (this.isDestroyed) return;

    this.isSyncing = true;
    
    try {
      // Update content
      const content = this.model.getContent();
      if (this.view.getValue() !== content) {
        this.view.setValue(content);
      }
      
      // Don't sync cursor/selection if document is empty
      if (!content || content.length === 0) {
        return;
      }

      // Update cursor - skip if cursor is in line/ch format
      if (this.config.syncCursor) {
        const cursor = this.model.getCursor();
        // Only sync if cursor is a number (position), not {line, ch}
        if (typeof cursor === 'number') {
          this.view.setSelection(cursor, cursor);
        }
      }

      // Update selection
      if (this.config.syncSelection) {
        const selection = this.model.getSelection();
        if (selection && typeof selection.from === 'number' && typeof selection.to === 'number') {
          this.view.setSelection(selection.from, selection.to);
        }
      }

      // Update language if needed
      if (this.view.currentLanguage !== this.model.config.language) {
        this.view.setLanguage(this.model.config.language);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Schedule auto-save
   */
  _scheduleAutoSave() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = setTimeout(() => {
      if (this.config.onAutoSave && this.model.isDirty()) {
        this.config.onAutoSave(this.model.getContent(), this);
      }
    }, this.config.autoSaveDelay);
  }

  /**
   * Public API methods
   */

  /**
   * Get current content
   */
  getContent() {
    // CodeMirror is the source of truth
    return this.view.getValue();
  }

  /**
   * Set content
   */
  setContent(content, options = {}) {
    // Set in CodeMirror to preserve history
    this.view.setValue(content);
  }

  /**
   * Insert text at current cursor or specified position
   */
  insertText(text, position = null, options = {}) {
    return this.model.insertText(text, position, options);
  }

  /**
   * Delete text range
   */
  deleteRange(from, to, options = {}) {
    return this.model.deleteRange(from, to, options);
  }

  /**
   * Undo last change
   */
  undo() {
    // Use CodeMirror's built-in undo through the view
    console.log('ViewModel.undo() called, canUndo =', this.view.canUndo());
    const result = this.view.undo();
    console.log('undo() result:', result);
    return result;
  }

  /**
   * Redo last undone change
   */
  redo() {
    // Use CodeMirror's built-in redo through the view
    console.log('ViewModel.redo() called, canRedo =', this.view.canRedo());
    const result = this.view.redo();
    console.log('redo() result:', result);
    return result;
  }

  /**
   * Check if undo is possible
   */
  canUndo() {
    // Use CodeMirror's history state
    return this.view.canUndo();
  }

  /**
   * Check if redo is possible
   */
  canRedo() {
    // Use CodeMirror's history state
    return this.view.canRedo();
  }

  /**
   * Get cursor position
   */
  getCursor() {
    // Get from CodeMirror
    const selection = this.view.getSelection();
    return selection.from;
  }

  /**
   * Set cursor position
   */
  setCursor(position) {
    // Set in CodeMirror
    this.view.setSelection(position, position);
  }

  /**
   * Get selection
   */
  getSelection() {
    // Get from CodeMirror
    return this.view.getSelection();
  }

  /**
   * Set selection
   */
  setSelection(from, to = null) {
    this.model.setSelection(from, to);
  }

  /**
   * Get selected text
   */
  getSelectedText() {
    return this.model.getSelectedText();
  }

  /**
   * Set language
   */
  setLanguage(language) {
    this.model.setLanguage(language);
  }

  /**
   * Get language
   */
  getLanguage() {
    return this.model.config.language;
  }

  /**
   * Focus the editor
   */
  focus() {
    this.view.focus();
  }

  /**
   * Check if editor has focus
   */
  hasFocus() {
    return this.view.hasFocus();
  }

  /**
   * Check if content is dirty
   */
  isDirty() {
    return this.model.isDirty();
  }

  /**
   * Mark content as saved
   */
  markSaved() {
    this.model.markSaved();
  }

  /**
   * Track changes for highlighting
   * @private
   */
  _trackChanges(changes) {
    // CodeMirror 6 changes are objects with from, to, insert properties
    if (changes && changes.iterChanges) {
      changes.iterChanges((from, to, fromB, toB, inserted) => {
        // Track the range that was changed
        this.changeRanges.push({
          from: fromB,
          to: toB,
          inserted: inserted.toString()
        });
      });
    }
  }

  /**
   * Calculate difference ranges between original and current content
   * Using a proper diff algorithm instead of naive character comparison
   * @private 
   */
  _calculateChangedRanges() {
    const currentContent = this.view.getValue();
    const originalContent = this.originalContent;
    
    if (!originalContent || originalContent === currentContent) {
      return [];
    }

    // Use a simple but more accurate diff algorithm
    // This implements a basic longest common subsequence approach
    return this._findDiffRanges(originalContent, currentContent);
  }

  /**
   * Find diff ranges using fast-diff library for accurate change detection
   * @private
   */
  _findDiffRanges(oldText, newText) {
    // Get fast-diff function from the View (which has access to it)
    const fastDiff = this.view.getFastDiff ? this.view.getFastDiff() : null;
    
    if (!fastDiff) {
      console.warn('fast-diff not available, falling back to simple diff');
      return [];
    }
    
    console.log('Using fast-diff to compare texts:', { oldLength: oldText.length, newLength: newText.length });
    
    const diffs = fastDiff(oldText, newText);
    console.log('fast-diff results:', diffs);
    
    const ranges = [];
    let position = 0;
    
    // Process fast-diff results: [type, text] arrays
    // type: -1 = delete, 0 = equal, 1 = insert
    for (const [type, text] of diffs) {
      if (type === 1) { // INSERT - highlight added text
        ranges.push({
          from: position,
          to: position + text.length
        });
        console.log('Found insertion:', { from: position, to: position + text.length, text });
        position += text.length;
      } else if (type === 0) { // EQUAL - skip unchanged text
        position += text.length;
      } else if (type === -1) { // DELETE - highlight deletion point
        // For deletions, we show where text was removed by highlighting the adjacent character
        if (position < newText.length) {
          ranges.push({
            from: position,
            to: position + 1
          });
          console.log('Found deletion at position:', position);
        }
        // Don't advance position for deletions (text wasn't added to new string)
      }
    }
    
    return ranges;
  }

  /**
   * Toggle highlight for changes only
   */
  toggleHighlight() {
    // Calculate what has actually changed
    const changedRanges = this._calculateChangedRanges();
    
    console.log('Changed ranges:', changedRanges);
    
    if (changedRanges.length > 0) {
      // Highlight only the changed ranges
      this.view.addHighlight(changedRanges);
    } else {
      console.log('No changes detected to highlight');
    }
  }

  /**
   * Clear all highlights
   */
  clearHighlights() {
    this.view.clearHighlight();
  }

  /**
   * Reset original content (for tracking new changes)
   */
  resetOriginalContent() {
    this.originalContent = this.view.getValue();
    this.changeRanges = [];
  }

  /**
   * Get validation errors
   */
  getValidationErrors() {
    return this.model.getValidationErrors();
  }

  /**
   * Get editor statistics
   */
  getStats() {
    return this.model.getStats();
  }

  /**
   * Animation methods (delegated to view)
   */

  /**
   * Typewriter animation
   */
  async typeText(text, options = {}) {
    if (!this.config.enableAnimations) {
      this.insertText(text);
      return;
    }

    return this.view.typewriterAnimation(text, {
      onComplete: (typedText, startPos, endPos) => {
        if (options.onComplete) {
          options.onComplete(typedText, startPos, endPos);
        }
      },
      ...options
    });
  }

  /**
   * Highlight text range
   */
  highlightRange(from, to, options = {}) {
    if (!this.config.enableAnimations) return;
    
    // Convert line/ch positions to numeric positions if needed
    const fromPos = this.view.posToOffset(from);
    const toPos = this.view.posToOffset(to);
    
    console.log('ViewModel highlightRange:', { from, to, fromPos, toPos });
    
    return this.view.highlightRange(fromPos, toPos, options);
  }

  /**
   * Highlight multiple ranges
   */
  async highlightRanges(ranges, options = {}) {
    if (!this.config.enableAnimations) return;
    
    // Convert line/ch positions to numeric positions if needed
    const convertedRanges = ranges.map(range => ({
      from: this.view.posToOffset(range.from),
      to: this.view.posToOffset(range.to)
    }));
    
    console.log('ViewModel highlightRanges:', { original: ranges, converted: convertedRanges });
    
    return this.view.highlightRanges(convertedRanges, options);
  }

  /**
   * Progressive code building animation
   */
  async progressiveBuild(codeBlocks, options = {}) {
    if (!this.config.enableAnimations) {
      this.setContent(codeBlocks.join(''));
      return;
    }
    return this.view.progressiveBuild(codeBlocks, options);
  }

  /**
   * Progressive code building
   */
  async buildCode(codeBlocks, options = {}) {
    if (!this.config.enableAnimations) {
      const content = codeBlocks.map(block => 
        typeof block === 'string' ? block : block.content
      ).join('\n');
      this.setContent(content);
      return;
    }

    return this.view.buildCode(codeBlocks, options);
  }

  /**
   * Editor command methods
   */

  /**
   * Select all text
   */
  selectAll() {
    const content = this.model.getContent();
    // Use numeric positions for CodeMirror 6
    this.view.setSelection(0, content.length);
  }

  /**
   * Select current line
   */
  selectLine() {
    const cursor = this.getCursor();
    const content = this.model.getContent();
    const lines = content.split('\n');
    const lineLength = lines[cursor.line].length;

    this.setSelection(
      { line: cursor.line, ch: 0 },
      { line: cursor.line, ch: lineLength }
    );
  }

  /**
   * Duplicate current line
   */
  duplicateLine() {
    const cursor = this.getCursor();
    const content = this.model.getContent();
    const lines = content.split('\n');
    const currentLine = lines[cursor.line];

    this.insertText('\n' + currentLine, {
      line: cursor.line,
      ch: lines[cursor.line].length
    });
  }

  /**
   * Toggle line comment
   */
  toggleComment() {
    const langConfig = this.model.getLanguageConfig();
    if (!langConfig || !langConfig.lineComment) return;

    const cursor = this.getCursor();
    const selection = this.getSelection();
    const content = this.model.getContent();
    const lines = content.split('\n');

    const startLine = selection ? selection.from.line : cursor.line;
    const endLine = selection ? selection.to.line : cursor.line;
    const commentPrefix = langConfig.lineComment + ' ';

    // Check if lines are commented
    let allCommented = true;
    for (let i = startLine; i <= endLine; i++) {
      if (!lines[i].trim().startsWith(langConfig.lineComment)) {
        allCommented = false;
        break;
      }
    }

    // Toggle comments
    for (let i = startLine; i <= endLine; i++) {
      if (allCommented) {
        // Remove comment
        const line = lines[i];
        const commentIndex = line.indexOf(commentPrefix);
        if (commentIndex >= 0) {
          lines[i] = line.slice(0, commentIndex) + line.slice(commentIndex + commentPrefix.length);
        } else {
          const singleCommentIndex = line.indexOf(langConfig.lineComment);
          if (singleCommentIndex >= 0) {
            lines[i] = line.slice(0, singleCommentIndex) + line.slice(singleCommentIndex + langConfig.lineComment.length);
          }
        }
      } else {
        // Add comment
        const trimmed = lines[i].trimStart();
        const indent = lines[i].slice(0, lines[i].length - trimmed.length);
        lines[i] = indent + commentPrefix + trimmed;
      }
    }

    this.setContent(lines.join('\n'));
  }

  /**
   * Indent/unindent selected lines
   */
  indent(increase = true) {
    const cursor = this.getCursor();
    const selection = this.getSelection();
    const content = this.model.getContent();
    const lines = content.split('\n');

    const startLine = selection ? selection.from.line : cursor.line;
    const endLine = selection ? selection.to.line : cursor.line;
    const indentStr = this.model.config.insertSpaces ? 
      ' '.repeat(this.model.config.tabSize) : '\t';

    for (let i = startLine; i <= endLine; i++) {
      if (increase) {
        lines[i] = indentStr + lines[i];
      } else {
        // Remove indentation
        if (lines[i].startsWith(indentStr)) {
          lines[i] = lines[i].slice(indentStr.length);
        } else if (lines[i].startsWith('\t')) {
          lines[i] = lines[i].slice(1);
        }
      }
    }

    this.setContent(lines.join('\n'));
  }

  /**
   * Find and replace
   */
  findAndReplace(searchText, replaceText, options = {}) {
    const { replaceAll = false, caseSensitive = false, useRegex = false } = options;
    
    let content = this.model.getContent();
    let pattern;

    if (useRegex) {
      const flags = caseSensitive ? 'g' : 'gi';
      pattern = new RegExp(searchText, replaceAll ? flags : flags.replace('g', ''));
    } else {
      const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = caseSensitive ? 'g' : 'gi';
      pattern = new RegExp(escapedSearch, replaceAll ? flags : flags.replace('g', ''));
    }

    const newContent = content.replace(pattern, replaceText);
    const replacements = (content.match(pattern) || []).length;

    if (replacements > 0) {
      this.setContent(newContent);
    }

    return replacements;
  }

  /**
   * Scroll to position
   */
  scrollToPosition(position) {
    this.view.scrollToPosition(position);
  }

  /**
   * Get visible range
   */
  getVisibleRange() {
    return this.view.getVisibleRange();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    // Update view config if needed
    if (newConfig.theme !== undefined || 
        newConfig.language !== undefined ||
        newConfig.readOnly !== undefined ||
        newConfig.lineNumbers !== undefined ||
        newConfig.foldGutter !== undefined) {
      this.view.updateConfig(newConfig);
    }

    // Update model config if needed
    if (newConfig.validateContent !== undefined ||
        newConfig.tabSize !== undefined ||
        newConfig.insertSpaces !== undefined) {
      Object.assign(this.model.config, newConfig);
    }
  }

  /**
   * Export current state
   */
  exportState() {
    return this.model.exportState();
  }

  /**
   * Import state
   */
  importState(state) {
    this.model.importState(state);
  }

  /**
   * Reset to initial state
   */
  reset(newContent = '') {
    this.model.reset(newContent);
  }

  /**
   * Destroy the ViewModel
   */
  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // Clear auto-save timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Remove model listeners
    this.model.removeChangeListener(this._handleModelChange);

    // Clear references
    this.model = null;
    this.view = null;
    this.config = null;
  }
}