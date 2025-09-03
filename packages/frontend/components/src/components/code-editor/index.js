/**
 * CodeEditor Component - Main entry point
 * 
 * A sophisticated code editor component that follows the umbilical protocol
 * externally and uses MVVM pattern internally. Features CodeMirror 6 with
 * syntax highlighting, themes, animation support, and extensive customization.
 */
import { UmbilicalUtils, UmbilicalError } from '/legion/components/src/umbilical/index.js';
import { CodeEditorModel } from '/legion/components/src/components/code-editor/model/CodeEditorModel.js';
import { CodeEditorView } from '/legion/components/src/components/code-editor/view/CodeEditorView.js';
import { CodeEditorViewModel } from '/legion/components/src/components/code-editor/viewmodel/CodeEditorViewModel.js';

export const CodeEditor = {
  /**
   * Create a CodeEditor instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical && umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      
      // Required capabilities
      requirements.add('dom', 'HTMLElement', 'DOM container element for the code editor');
      requirements.add('content', 'string', 'Initial code content (optional, defaults to empty string)');
      
      // Language and syntax
      requirements.add('language', 'string', 'Programming language: "javascript", "typescript", "python", "html", "css", "json" (optional, defaults to "javascript")');
      requirements.add('theme', 'string', 'Visual theme: "light" or "dark" (optional, defaults to "light")');
      
      // Editor behavior
      requirements.add('readOnly', 'boolean', 'Whether editor is read-only (optional, defaults to false)');
      requirements.add('lineNumbers', 'boolean', 'Show line numbers (optional, defaults to true)');
      requirements.add('foldGutter', 'boolean', 'Show code folding gutter (optional, defaults to false)');
      requirements.add('wordWrap', 'boolean', 'Enable word wrapping (optional, defaults to false)');
      requirements.add('autocompletion', 'boolean', 'Enable autocompletion (optional, defaults to true)');
      requirements.add('closeBrackets', 'boolean', 'Auto-close brackets and quotes (optional, defaults to true)');
      requirements.add('searchPanel', 'boolean', 'Enable search panel (optional, defaults to false)');
      
      // Formatting options
      requirements.add('tabSize', 'number', 'Tab size in spaces (optional, defaults to 2)');
      requirements.add('insertSpaces', 'boolean', 'Use spaces instead of tabs (optional, defaults to true)');
      requirements.add('autoFormat', 'boolean', 'Auto-format code on paste (optional, defaults to false)');
      
      // History and state
      requirements.add('maxHistorySize', 'number', 'Maximum undo history size (optional, defaults to 100)');
      requirements.add('autoSave', 'boolean', 'Enable auto-save (optional, defaults to false)');
      requirements.add('autoSaveDelay', 'number', 'Auto-save delay in milliseconds (optional, defaults to 2000)');
      
      // Animation features for AI agents
      requirements.add('enableAnimations', 'boolean', 'Enable typewriter and highlight animations (optional, defaults to true)');
      requirements.add('typewriterSpeed', 'number', 'Default typewriter animation speed in ms per character (optional, defaults to 50)');
      requirements.add('highlightDuration', 'number', 'Default highlight animation duration in ms (optional, defaults to 2000)');
      
      // Validation
      requirements.add('validateContent', 'function', 'Custom content validation function (optional)');
      
      // Event callbacks
      requirements.add('onContentChange', 'function', 'Callback when content changes (optional)');
      requirements.add('onCursorChange', 'function', 'Callback when cursor position changes (optional)');
      requirements.add('onSelectionChange', 'function', 'Callback when selection changes (optional)');
      requirements.add('onLanguageChange', 'function', 'Callback when language changes (optional)');
      requirements.add('onHistoryChange', 'function', 'Callback when undo/redo state changes (optional)');
      requirements.add('onSave', 'function', 'Callback when content is saved (optional)');
      requirements.add('onAutoSave', 'function', 'Callback for auto-save events (optional)');
      requirements.add('onSaveRequest', 'function', 'Callback when user requests save (Ctrl+S) (optional)');
      requirements.add('onFocus', 'function', 'Callback when editor gains focus (optional)');
      requirements.add('onBlur', 'function', 'Callback when editor loses focus (optional)');
      requirements.add('onKeyDown', 'function', 'Callback for key events (optional)');
      requirements.add('onError', 'function', 'Callback for error handling (optional)');
      
      // Agent animation callbacks
      requirements.add('onAnimationStart', 'function', 'Callback when animation starts (optional)');
      requirements.add('onAnimationProgress', 'function', 'Callback during animation progress (optional)');
      requirements.add('onAnimationComplete', 'function', 'Callback when animation completes (optional)');
      
      // Lifecycle callbacks
      requirements.add('onMount', 'function', 'Callback fired after component is mounted (optional)');
      requirements.add('onDestroy', 'function', 'Callback fired before component is destroyed (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical && umbilical.validate) {
      const testUmbilical = umbilical.validate;
      const hasDOM = !!(testUmbilical.dom && testUmbilical.dom.nodeType === 1);
      const hasValidContent = testUmbilical.content === undefined || typeof testUmbilical.content === 'string';
      const hasValidLanguage = testUmbilical.language === undefined || 
        ['javascript', 'typescript', 'python', 'html', 'css', 'json'].includes(testUmbilical.language);
      const hasValidTheme = testUmbilical.theme === undefined || 
        ['light', 'dark'].includes(testUmbilical.theme);
      
      return {
        valid: hasDOM && hasValidContent && hasValidLanguage && hasValidTheme,
        hasDOM,
        hasValidContent,
        hasValidLanguage,
        hasValidTheme,
        hasRequiredCapabilities: hasDOM
      };
    }

    // No umbilical - return component info
    if (!umbilical) {
      return {
        name: 'CodeEditor',
        version: '1.0.0',
        description: 'Advanced code editor with CodeMirror 6, syntax highlighting, themes, and AI agent animations',
        capabilities: [
          'syntax-highlighting', 'multiple-languages', 'themes', 'typewriter-animations',
          'highlight-animations', 'undo-redo', 'search-replace', 'auto-completion',
          'bracket-matching', 'code-folding', 'line-numbers', 'auto-save',
          'keyboard-shortcuts', 'validation', 'state-management'
        ]
      };
    }

    // Instance mode - create actual code editor instance
    const {
      // Required
      dom = null,
      
      // Content and language
      content = '',
      language = 'javascript',
      theme = 'light',
      
      // Editor behavior
      readOnly = false,
      lineNumbers = true,
      foldGutter = false,
      wordWrap = false,
      autocompletion = true,
      closeBrackets = true,
      searchPanel = false,
      
      // Formatting
      tabSize = 2,
      insertSpaces = true,
      autoFormat = false,
      
      // History and state
      maxHistorySize = 100,
      autoSave = false,
      autoSaveDelay = 2000,
      
      // Animation features
      enableAnimations = true,
      typewriterSpeed = 50,
      highlightDuration = 2000,
      
      // Validation
      validateContent = null,
      
      // Event callbacks
      onContentChange = null,
      onCursorChange = null,
      onSelectionChange = null,
      onLanguageChange = null,
      onHistoryChange = null,
      onSave = null,
      onAutoSave = null,
      onSaveRequest = null,
      onFocus = null,
      onBlur = null,
      onKeyDown = null,
      onError = null,
      
      // Animation callbacks
      onAnimationStart = null,
      onAnimationProgress = null,
      onAnimationComplete = null,
      
      // Lifecycle callbacks
      onMount = null,
      onDestroy = null
    } = umbilical;

    // Validation
    if (!dom) {
      throw new UmbilicalError('CodeEditor requires a DOM container element', 'CodeEditor');
    }

    if (typeof content !== 'string') {
      throw new UmbilicalError('CodeEditor content must be a string', 'CodeEditor');
    }

    if (!['javascript', 'typescript', 'python', 'html', 'css', 'json'].includes(language)) {
      throw new UmbilicalError('CodeEditor language must be one of: javascript, typescript, python, html, css, json', 'CodeEditor');
    }

    if (!['light', 'dark'].includes(theme)) {
      throw new UmbilicalError('CodeEditor theme must be "light" or "dark"', 'CodeEditor');
    }

    if (typeof tabSize !== 'number' || tabSize < 1 || tabSize > 8) {
      throw new UmbilicalError('CodeEditor tabSize must be a number between 1 and 8', 'CodeEditor');
    }

    // Create configuration objects
    const modelConfig = {
      language,
      readOnly,
      maxHistorySize,
      validateContent,
      autoFormat,
      tabSize,
      insertSpaces,
      wordWrap,
      lineNumbers,
      foldGutter
    };

    const viewConfig = {
      theme,
      language,
      readOnly,
      lineNumbers,
      foldGutter,
      wordWrap,
      autocompletion,
      closeBrackets,
      searchPanel,
      tabSize,
      insertSpaces,
      initialValue: content
    };

    const viewModelConfig = {
      autoSave,
      autoSaveDelay,
      syncCursor: true,
      syncSelection: true,
      enableAnimations,
      onContentChange,
      onCursorChange,
      onSelectionChange,
      onLanguageChange,
      onHistoryChange,
      onSave,
      onAutoSave,
      onSaveRequest,
      onFocus,
      onBlur,
      onKeyDown,
      onError
    };

    // Create MVVM components
    const model = new CodeEditorModel(content, modelConfig);
    const view = new CodeEditorView(dom, viewConfig);
    const viewModel = new CodeEditorViewModel(model, view, viewModelConfig);

    // Create code editor instance
    const codeEditorInstance = {
      // Content operations
      getContent() {
        return viewModel.getContent();
      },

      setContent(newContent, options = {}) {
        try {
          const result = viewModel.setContent(newContent, options);
          return result;
        } catch (error) {
          if (onError) {
            onError('setContent', error, newContent);
          }
          throw error;
        }
      },

      insertText(text, position = null, options = {}) {
        try {
          return viewModel.insertText(text, position, options);
        } catch (error) {
          if (onError) {
            onError('insertText', error, { text, position });
          }
          throw error;
        }
      },

      deleteRange(from, to, options = {}) {
        try {
          return viewModel.deleteRange(from, to, options);
        } catch (error) {
          if (onError) {
            onError('deleteRange', error, { from, to });
          }
          throw error;
        }
      },

      // History operations
      undo() {
        return viewModel.undo();
      },

      redo() {
        return viewModel.redo();
      },

      canUndo() {
        return viewModel.canUndo();
      },

      canRedo() {
        return viewModel.canRedo();
      },

      // Cursor and selection operations
      getCursor() {
        return viewModel.getCursor();
      },

      setCursor(position) {
        try {
          viewModel.setCursor(position);
        } catch (error) {
          if (onError) {
            onError('setCursor', error, position);
          }
          throw error;
        }
      },

      getSelection() {
        return viewModel.getSelection();
      },

      setSelection(from, to = null) {
        try {
          viewModel.setSelection(from, to);
        } catch (error) {
          if (onError) {
            onError('setSelection', error, { from, to });
          }
          throw error;
        }
      },

      getSelectedText() {
        return viewModel.getSelectedText();
      },

      // Language operations
      getLanguage() {
        return viewModel.getLanguage();
      },

      setLanguage(newLanguage) {
        try {
          viewModel.setLanguage(newLanguage);
        } catch (error) {
          if (onError) {
            onError('setLanguage', error, newLanguage);
          }
          throw error;
        }
      },

      // Focus operations
      focus() {
        viewModel.focus();
      },

      hasFocus() {
        return viewModel.hasFocus();
      },

      // State operations
      isDirty() {
        return viewModel.isDirty();
      },

      markSaved() {
        viewModel.markSaved();
      },

      getValidationErrors() {
        return viewModel.getValidationErrors();
      },

      // Animation operations (for AI agents)
      async typeText(text, options = {}) {
        const animationOptions = {
          speed: options.speed || typewriterSpeed,
          cursor: options.cursor !== false,
          highlight: options.highlight !== false,
          onProgress: (current, total, char) => {
            if (onAnimationProgress) {
              onAnimationProgress('typewriter', { current, total, char, text });
            }
          },
          onComplete: (typedText, startPos, endPos) => {
            if (onAnimationComplete) {
              onAnimationComplete('typewriter', { text: typedText, startPos, endPos });
            }
            if (options.onComplete) {
              options.onComplete(typedText, startPos, endPos);
            }
          },
          ...options
        };

        if (onAnimationStart) {
          onAnimationStart('typewriter', { text, options: animationOptions });
        }

        return viewModel.typeText(text, animationOptions);
      },

      highlightRange(from, to, options = {}) {
        const animationOptions = {
          duration: options.duration || highlightDuration,
          className: options.className || 'cm-highlight-change',
          ...options
        };

        if (onAnimationStart) {
          onAnimationStart('highlight', { from, to, options: animationOptions });
        }

        const result = viewModel.highlightRange(from, to, animationOptions);

        if (onAnimationComplete) {
          setTimeout(() => {
            onAnimationComplete('highlight', { from, to, options: animationOptions });
          }, animationOptions.duration);
        }

        return result;
      },

      async highlightRanges(ranges, options = {}) {
        return viewModel.highlightRanges(ranges, options);
      },

      /**
       * Toggle highlight for entire content
       */
      toggleHighlight() {
        return viewModel.toggleHighlight();
      },

      /**
       * Clear all highlights
       */
      clearHighlights() {
        return viewModel.clearHighlights();
      },

      /**
       * Reset original content for change tracking
       */
      resetOriginalContent() {
        return viewModel.resetOriginalContent();
      },

      async progressiveBuild(codeBlocks, options = {}) {
        const animationOptions = {
          speed: options.speed || typewriterSpeed,
          highlightStructure: options.highlightStructure !== false,
          onBlockComplete: (index, block, blocks) => {
            if (onAnimationProgress) {
              onAnimationProgress('buildCode', { index, block, blocks, total: blocks.length });
            }
            if (options.onBlockComplete) {
              options.onBlockComplete(index, block, blocks);
            }
          },
          onComplete: (blocks) => {
            if (onAnimationComplete) {
              onAnimationComplete('buildCode', { blocks });
            }
            if (options.onComplete) {
              options.onComplete(blocks);
            }
          },
          ...options
        };

        if (onAnimationStart) {
          onAnimationStart('buildCode', { codeBlocks, options: animationOptions });
        }

        return viewModel.progressiveBuild(codeBlocks, animationOptions);
      },

      // Editor command operations
      selectAll() {
        viewModel.selectAll();
      },

      selectLine() {
        viewModel.selectLine();
      },

      duplicateLine() {
        viewModel.duplicateLine();
      },

      toggleComment() {
        viewModel.toggleComment();
      },

      indent(increase = true) {
        viewModel.indent(increase);
      },

      findAndReplace(searchText, replaceText, options = {}) {
        return viewModel.findAndReplace(searchText, replaceText, options);
      },

      // View operations
      scrollToPosition(position) {
        viewModel.scrollToPosition(position);
      },

      getVisibleRange() {
        return viewModel.getVisibleRange();
      },

      // Statistics and debugging
      getStats() {
        return viewModel.getStats();
      },

      // Configuration
      getConfig() {
        return {
          ...modelConfig,
          ...viewConfig,
          ...viewModelConfig,
          enableAnimations,
          typewriterSpeed,
          highlightDuration
        };
      },

      updateConfig(newConfig) {
        try {
          viewModel.updateConfig(newConfig);
          
          // Update local config tracking
          Object.assign(modelConfig, newConfig);
          Object.assign(viewConfig, newConfig);
          Object.assign(viewModelConfig, newConfig);
        } catch (error) {
          if (onError) {
            onError('updateConfig', error, newConfig);
          }
          throw error;
        }
      },

      // Theme operations
      getTheme() {
        return viewConfig.theme;
      },

      setTheme(newTheme) {
        if (!['light', 'dark'].includes(newTheme)) {
          throw new UmbilicalError('Theme must be "light" or "dark"', 'CodeEditor');
        }
        this.updateConfig({ theme: newTheme });
      },

      // State management
      exportState() {
        return viewModel.exportState();
      },

      importState(state) {
        try {
          viewModel.importState(state);
        } catch (error) {
          if (onError) {
            onError('importState', error, state);
          }
          throw error;
        }
      },

      reset(newContent = '') {
        viewModel.reset(newContent);
      },

      clear() {
        viewModel.setContent('');
      },

      // Validation
      validate() {
        const errors = this.getValidationErrors();
        return errors.length === 0;
      },

      // Utility operations
      refresh() {
        // Force re-sync
        viewModel._syncModelToView();
      },

      // Development helpers
      debug() {
        return {
          model,
          view,
          viewModel,
          config: this.getConfig(),
          stats: this.getStats(),
          content: this.getContent(),
          cursor: this.getCursor(),
          selection: this.getSelection(),
          validationErrors: this.getValidationErrors()
        };
      },

      // Cleanup
      destroy() {
        viewModel.destroy();
        view.destroy();
        model.destroy();
        
        if (onDestroy) {
          onDestroy(codeEditorInstance);
        }
      }
    };

    // Call onMount callback
    if (onMount) {
      onMount(codeEditorInstance);
    }

    return codeEditorInstance;
  }
};

// Export individual components for advanced usage
export { CodeEditorModel } from './model/CodeEditorModel.js';
export { CodeEditorView } from './view/CodeEditorView.js';
export { CodeEditorViewModel } from './viewmodel/CodeEditorViewModel.js';