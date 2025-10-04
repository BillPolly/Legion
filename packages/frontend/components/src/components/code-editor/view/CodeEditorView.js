/**
 * CodeEditorView - DOM rendering and CodeMirror 6 integration for CodeEditor component
 * 
 * Handles CodeMirror instance creation, theme management, extensions loading,
 * and visual presentation. Maintains separation between presentation and business logic.
 */

// Import from CodeMirror packages using import map
import {
  EditorView,
  keymap,
  lineNumbers,
  drawSelection,
  dropCursor,
  highlightActiveLineGutter,
  highlightSpecialChars,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  Decoration
} from '@lib/codemirror/view';

import {
  EditorState,
  EditorSelection,
  StateEffect,
  StateField
} from '@lib/codemirror/state';

import {
  defaultKeymap,
  historyKeymap,
  undo,
  redo,
  undoDepth,
  redoDepth,
  history
} from '@lib/codemirror/commands';

import {
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching
} from '@lib/codemirror/language';

import {
  openSearchPanel,
  searchKeymap
} from '@lib/codemirror/search';

import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap
} from '@lib/codemirror/autocomplete';

import { javascript } from '@lib/codemirror/lang-javascript';
import { oneDark } from '@lib/codemirror/theme-one-dark';
import fastDiff from '@lib/fast-diff';

export class CodeEditorView {
  constructor(container, config = {}) {
    this.container = container;
    this.config = {
      theme: config.theme || 'light',
      language: config.language || 'javascript',
      readOnly: config.readOnly || false,
      lineNumbers: config.lineNumbers !== false,
      foldGutter: config.foldGutter || false,
      wordWrap: config.wordWrap || false,
      autocompletion: config.autocompletion !== false,
      closeBrackets: config.closeBrackets !== false,
      searchPanel: config.searchPanel !== false,
      tabSize: config.tabSize || 2,
      insertSpaces: config.insertSpaces !== false,
      ...config
    };

    // State
    this.view = null;
    this.currentLanguage = null;
    this.currentTheme = null;
    this.eventListeners = new Map();
    this.animationQueue = [];
    this.isAnimating = false;

    // Language extensions map
    this.languageExtensions = new Map([
      ['javascript', () => javascript()],
      ['typescript', () => javascript({ typescript: true })]
    ]);

    // Animation styles
    this._injectAnimationStyles();

    // Create highlight effect and field
    this._createHighlightSystem();

    // Create the editor
    this._createView();
  }

  /**
   * Create highlight system using StateField and StateEffect
   * @private
   */
  _createHighlightSystem() {
    // Define the add highlight effect with proper mapping
    this.addHighlightEffect = StateEffect.define({
      map: (ranges, change) => ranges.map(range => ({
        from: change.mapPos(range.from),
        to: change.mapPos(range.to)
      }))
    });
    
    // Define the clear highlight effect
    this.clearHighlightEffect = StateEffect.define();
    
    // Define the highlight state field using official CodeMirror 6 pattern
    const addHighlightEffect = this.addHighlightEffect;
    const clearHighlightEffect = this.clearHighlightEffect;
    
    this.highlightField = StateField.define({
      create() { 
        return Decoration.none;
      },
      update(value, tr) {
        // Map existing decorations through document changes
        value = value.map(tr.changes);
        
        // Process effects
        for (let effect of tr.effects) {
          if (effect.is(addHighlightEffect)) {
            // Create decorations for the ranges
            const decorations = effect.value.map(range =>
              Decoration.mark({ class: "cm-highlight" }).range(range.from, range.to)
            );
            value = value.update({ add: decorations, sort: true });
          } else if (effect.is(clearHighlightEffect)) {
            // Clear all highlights
            value = Decoration.none;
          }
        }
        return value;
      },
      provide: f => EditorView.decorations.from(f)
    });
    
    // Create the highlight theme
    this.highlightTheme = EditorView.baseTheme({
      ".cm-highlight": {
        backgroundColor: "rgba(255, 235, 59, 0.8)",
        borderRadius: "2px",
        border: "1px solid rgba(255, 235, 59, 1)"
      }
    });
  }

  /**
   * Create CodeMirror view
   * @private
   */
  _createView() {
    // Build extensions based on config
    const extensions = this._buildExtensions();

    // Create initial state
    const state = EditorState.create({
      doc: this.config.initialValue || '',
      extensions
    });

    // Create view
    this.view = new EditorView({
      state,
      parent: this.container
    });

    // Add event handlers
    this._setupEventHandlers();
  }

  /**
   * Build CodeMirror extensions based on config
   * @private
   */
  _buildExtensions() {
    const extensions = [
      // Core
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true })
    ];

    // Optional features
    if (this.config.lineNumbers) {
      extensions.push(lineNumbers());
      extensions.push(highlightActiveLineGutter());
    }

    if (this.config.foldGutter) {
      extensions.push(foldGutter());
    }

    if (this.config.wordWrap) {
      extensions.push(EditorView.lineWrapping);
    }

    if (this.config.autocompletion) {
      extensions.push(autocompletion());
    }

    if (this.config.closeBrackets) {
      extensions.push(closeBrackets());
    }

    // Add more visual enhancements
    extensions.push(
      highlightSpecialChars(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine()
    );

    // Add highlight system
    extensions.push(this.highlightField, this.highlightTheme);

    // Language
    const languageExtension = this.languageExtensions.get(this.config.language);
    if (languageExtension) {
      extensions.push(languageExtension());
      this.currentLanguage = this.config.language;
    }

    // Theme
    extensions.push(this._getThemeExtension());

    // Keymaps (order matters)
    const keymaps = [];
    if (this.config.closeBrackets) {
      keymaps.push(...closeBracketsKeymap);
    }
    keymaps.push(...defaultKeymap, ...historyKeymap);
    if (this.config.searchPanel) {
      keymaps.push(...searchKeymap);
    }
    if (this.config.foldGutter) {
      keymaps.push(...foldKeymap);
    }
    if (this.config.autocompletion) {
      keymaps.push(...completionKeymap);
    }
    extensions.push(keymap.of(keymaps));

    // Read-only
    if (this.config.readOnly) {
      extensions.push(EditorView.editable.of(false));
    }

    // Tab handling
    extensions.push(this._createTabHandling());

    // Change listener - properly using CodeMirror 6 updateListener
    extensions.push(EditorView.updateListener.of(update => {
      if (update.docChanged) {
        console.log('CodeMirror docChanged:', {
          value: update.state.doc.toString(),
          changes: update.changes,
          transactions: update.transactions
        });
        this._notifyListeners('change', {
          value: update.state.doc.toString(),
          changes: update.changes
        });
      }
      if (update.selectionSet) {
        const sel = update.state.selection.main;
        console.log('CodeMirror selectionSet:', {
          cursor: sel.head,
          selection: sel.from !== sel.to ? { from: sel.from, to: sel.to } : null
        });
        this._notifyListeners('selectionChange', {
          cursor: sel.head,
          selection: sel.from !== sel.to ? { from: sel.from, to: sel.to } : null
        });
      }
    }));

    return extensions;
  }

  /**
   * Get theme extension
   * @private
   */
  _getThemeExtension() {
    if (this.config.theme === 'dark') {
      this.currentTheme = 'dark';
      return oneDark;
    } else {
      this.currentTheme = 'light';
      return EditorView.theme({
        '&': {
          fontSize: '14px'
        },
        '.cm-content': {
          padding: '10px'
        },
        '.cm-editor': {
          border: '1px solid #ddd',
          borderRadius: '4px'
        },
        '.cm-editor.cm-focused': {
          outline: 'none',
          borderColor: '#007acc'
        }
      });
    }
  }

  /**
   * Create tab handling configuration
   * @private
   */
  _createTabHandling() {
    const tabCommand = this.config.insertSpaces
      ? {
          key: 'Tab',
          run: (view) => {
            const spaces = ' '.repeat(this.config.tabSize);
            view.dispatch({
              changes: view.state.changeByRange(range => ({
                changes: { from: range.from, to: range.to, insert: spaces },
                range: EditorSelection.cursor(range.from + spaces.length)
              }))
            });
            return true;
          }
        }
      : { key: 'Tab', run: () => true }; // Use default tab behavior

    return keymap.of([tabCommand]);
  }

  /**
   * Setup event handlers
   * @private
   */
  _setupEventHandlers() {
    // Focus/blur handlers
    this.view.dom.addEventListener('focus', () => {
      this._notifyListeners('focus');
    });

    this.view.dom.addEventListener('blur', () => {
      this._notifyListeners('blur');
    });

    // Keydown handler
    this.view.dom.addEventListener('keydown', (event) => {
      this._notifyListeners('keydown', { event });
    });
  }

  /**
   * Update theme
   */
  setTheme(theme) {
    if (theme === this.currentTheme) return;

    this.config.theme = theme;
    this.view.dispatch({
      effects: StateEffect.reconfigure.of(this._buildExtensions())
    });
  }

  /**
   * Update language
   */
  setLanguage(language) {
    if (language === this.currentLanguage || !this.languageExtensions.has(language)) return;

    this.config.language = language;
    this.view.dispatch({
      effects: StateEffect.reconfigure.of(this._buildExtensions())
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    let needsRebuild = false;

    // Check if any config that requires rebuilding extensions has changed
    const rebuildKeys = ['theme', 'language', 'readOnly', 'lineNumbers', 'foldGutter', 
                        'wordWrap', 'autocompletion', 'closeBrackets', 'searchPanel'];
    
    for (const key of rebuildKeys) {
      if (newConfig.hasOwnProperty(key) && this.config[key] !== newConfig[key]) {
        this.config[key] = newConfig[key];
        needsRebuild = true;
      }
    }

    // Update other config that doesn't require rebuild
    if (newConfig.tabSize !== undefined) this.config.tabSize = newConfig.tabSize;
    if (newConfig.insertSpaces !== undefined) this.config.insertSpaces = newConfig.insertSpaces;

    // Rebuild extensions if needed
    if (needsRebuild) {
      this.view.dispatch({
        effects: StateEffect.reconfigure.of(this._buildExtensions())
      });
    }
  }

  /**
   * Get current content
   */
  getValue() {
    return this.view.state.doc.toString();
  }

  /**
   * Set content
   */
  setValue(value) {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: value
      }
    });
  }

  /**
   * Set selection
   */
  setSelection(from, to) {
    // Convert line/ch positions to numeric offsets if needed
    const fromOffset = this.posToOffset(from);
    const toOffset = to !== undefined ? this.posToOffset(to) : fromOffset;
    
    this.view.dispatch({
      selection: EditorSelection.single(fromOffset, toOffset)
    });
  }

  /**
   * Get selection
   */
  getSelection() {
    const sel = this.view.state.selection.main;
    return {
      from: sel.from,
      to: sel.to,
      text: this.view.state.doc.sliceString(sel.from, sel.to)
    };
  }

  /**
   * Focus the editor
   */
  focus() {
    this.view.focus();
  }

  /**
   * Check if has focus
   */
  hasFocus() {
    return this.view.hasFocus;
  }

  /**
   * Undo last change
   */
  undo() {
    // Use the undo command directly from CM exports
    if (undo) {
      return undo(this.view);
    }
    
    console.warn('Undo command not available');
    return false;
  }

  /**
   * Redo last change
   */
  redo() {
    // Use the redo command directly from CM exports
    if (redo) {
      return redo(this.view);
    }
    
    console.warn('Redo command not available');
    return false;
  }

  /**
   * Convert line/ch position to numeric offset
   */
  posToOffset(pos) {
    if (typeof pos === 'number') return pos;
    if (!pos || typeof pos.line === 'undefined') return 0;
    
    const line = this.view.state.doc.line(Math.min(pos.line + 1, this.view.state.doc.lines));
    return Math.min(line.from + (pos.ch || 0), line.to);
  }

  /**
   * Convert numeric offset to line/ch position
   */
  offsetToPos(offset) {
    const line = this.view.state.doc.lineAt(offset);
    return {
      line: line.number - 1,
      ch: offset - line.from
    };
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    // Use undoDepth to check if undo is available
    if (undoDepth) {
      return undoDepth(this.view.state) > 0;
    }
    return false;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    // Use redoDepth to check if redo is available
    if (redoDepth) {
      return redoDepth(this.view.state) > 0;
    }
    return false;
  }

  /**
   * Add event listener
   */
  addEventListener(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(handler);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event, handler) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(handler);
    }
  }

  /**
   * Notify listeners
   * @private
   */
  _notifyListeners(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(handler => handler(data));
    }
  }

  /**
   * Destroy the view
   */
  destroy() {
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    this.eventListeners.clear();
    this.animationQueue = [];
    this.isAnimating = false;
  }

  // Animation methods

  /**
   * Inject animation styles
   * @private
   */
  _injectAnimationStyles() {
    if (document.getElementById('code-editor-animations')) return;

    const style = document.createElement('style');
    style.id = 'code-editor-animations';
    style.textContent = `
      @keyframes code-editor-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }

      .code-editor-cursor {
        display: inline-block;
        width: 2px;
        height: 1.2em;
        background: #007acc;
        animation: code-editor-blink 1s infinite;
        vertical-align: text-bottom;
      }

      .code-editor-highlight {
        background: rgba(255, 235, 59, 0.3);
        animation: code-editor-highlight-fade 0.5s ease-out;
      }

      @keyframes code-editor-highlight-fade {
        from { background: rgba(255, 235, 59, 0.6); }
        to { background: rgba(255, 235, 59, 0.3); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Animate typewriter effect
   */
  async typewriterAnimation(text, options = {}) {
    const { speed = 50, cursor = true, highlight = true } = options;
    
    return new Promise((resolve) => {
      this.animationQueue.push({
        type: 'typewriter',
        text,
        speed,
        cursor,
        highlight,
        resolve
      });
      this._processAnimationQueue();
    });
  }

  /**
   * Highlight a single range
   */
  highlightRange(from, to, options = {}) {
    return this.highlightRanges([{ from, to }], options);
  }

  /**
   * Animate highlight ranges
   */
  async highlightRanges(ranges, options = {}) {
    const { duration = 2000, color = 'rgba(255, 235, 59, 0.5)' } = options;
    
    return new Promise((resolve) => {
      this.animationQueue.push({
        type: 'highlight',
        ranges,
        duration,
        color,
        resolve
      });
      this._processAnimationQueue();
    });
  }

  /**
   * Animate progressive code building
   */
  async progressiveBuild(blocks, options = {}) {
    const { blockDelay = 500, typeSpeed = 30 } = options;
    
    return new Promise((resolve) => {
      this.animationQueue.push({
        type: 'progressive',
        blocks,
        blockDelay,
        typeSpeed,
        resolve
      });
      this._processAnimationQueue();
    });
  }

  /**
   * Process animation queue
   * @private
   */
  async _processAnimationQueue() {
    if (this.isAnimating || this.animationQueue.length === 0) return;

    this.isAnimating = true;
    const animation = this.animationQueue.shift();

    switch (animation.type) {
      case 'typewriter':
        await this._runTypewriterAnimation(animation);
        break;
      case 'highlight':
        await this._runHighlightAnimation(animation);
        break;
      case 'progressive':
        await this._runProgressiveAnimation(animation);
        break;
    }

    animation.resolve();
    this.isAnimating = false;
    this._processAnimationQueue();
  }

  /**
   * Run typewriter animation
   * @private
   */
  async _runTypewriterAnimation({ text, speed, cursor, highlight }) {
    const startPos = this.view.state.doc.length;
    let pos = 0;

    while (pos < text.length) {
      const char = text[pos];
      const insertPos = startPos + pos;

      // Insert character
      this.view.dispatch({
        changes: { from: insertPos, insert: char }
      });

      // Move cursor
      if (cursor) {
        this.view.dispatch({
          selection: EditorSelection.cursor(insertPos + 1)
        });
      }

      // Highlight new character
      if (highlight && char.trim()) {
        this._flashHighlight(insertPos, insertPos + 1);
      }

      pos++;

      // Call progress callback
      if (this.config.onAnimationProgress) {
        this.config.onAnimationProgress('typewriter', {
          current: pos,
          total: text.length,
          char
        });
      }

      await this._sleep(speed);
    }
  }

  /**
   * Run highlight animation
   * @private
   */
  async _runHighlightAnimation({ ranges, duration, color }) {
    // Filter out empty ranges
    const validRanges = ranges.filter(range => range.from < range.to);
    
    console.log('Highlighting ranges:', validRanges);
    
    if (validRanges.length > 0) {
      // Apply highlights using the new effect
      this.view.dispatch({
        effects: this.addHighlightEffect.of(validRanges)
      });
      
      console.log('Applied highlight decorations');
      
      // If duration is specified, clear after timeout
      if (duration && duration > 0) {
        setTimeout(() => {
          console.log('Auto-clearing decorations after', duration, 'ms');
          this.view.dispatch({
            effects: this.clearHighlightEffect.of(null)
          });
        }, duration);
      }
    }
    
    if (duration && duration > 0) {
      await this._sleep(duration);
    }
  }

  /**
   * Run progressive build animation
   * @private
   */
  async _runProgressiveAnimation({ blocks, blockDelay, typeSpeed }) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      if (i > 0) {
        await this._sleep(blockDelay);
      }

      await this._runTypewriterAnimation({
        text: block,
        speed: typeSpeed,
        cursor: true,
        highlight: true
      });
    }
  }

  /**
   * Flash highlight effect
   * @private
   */
  _flashHighlight(from, to) {
    // Create temporary highlight effect
    // In a real implementation, this would use StateField decorations
  }

  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add highlight to ranges
   */
  addHighlight(ranges) {
    const validRanges = Array.isArray(ranges) ? ranges : [ranges];
    const filteredRanges = validRanges.filter(range => range.from < range.to);
    
    if (filteredRanges.length > 0) {
      this.view.dispatch({
        effects: this.addHighlightEffect.of(filteredRanges)
      });
    }
  }

  /**
   * Clear all highlights
   */
  clearHighlight() {
    this.view.dispatch({
      effects: this.clearHighlightEffect.of(null)
    });
  }

  /**
   * Get fast-diff function for text comparison
   */
  getFastDiff() {
    return fastDiff;
  }
}