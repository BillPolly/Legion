/**
 * MarkdownRenderer - Standalone component for rendering markdown with syntax highlighting
 * Follows Legion umbilical protocol for maximum reusability
 */

import { UmbilicalUtils, UmbilicalError } from '../../umbilical/index.js';
import { MarkdownModel } from './model/MarkdownModel.js';
import { MarkdownView } from './view/MarkdownView.js';
import { MarkdownViewModel } from './viewmodel/MarkdownViewModel.js';

export const MarkdownRenderer = {
  /**
   * Create MarkdownRenderer instance following umbilical protocol
   * @param {Object} umbilical - Component dependencies and capabilities
   */
  create(umbilical) {
    // 1. Introspection mode - describe what this component needs
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Parent DOM element for rendering');
      requirements.add('content', 'string', 'Markdown content to render (optional)', false);
      requirements.add('theme', 'string', 'Theme: light or dark (optional, default: light)', false);
      requirements.add('showLineNumbers', 'boolean', 'Show line numbers in code blocks (optional)', false);
      requirements.add('onContentChange', 'function', 'Callback when content changes (optional)', false);
      requirements.add('onCopy', 'function', 'Callback when code is copied (optional)', false);
      umbilical.describe(requirements);
      return;
    }

    // 2. Validation mode - check if umbilical provides what we need
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasValidTheme: !umbilical.theme || ['light', 'dark'].includes(umbilical.theme),
        hasValidContent: !umbilical.content || typeof umbilical.content === 'string',
        hasValidCallbacks: {
          onContentChange: !umbilical.onContentChange || typeof umbilical.onContentChange === 'function',
          onCopy: !umbilical.onCopy || typeof umbilical.onCopy === 'function'
        }
      });
    }

    // 3. Instance creation mode - create working renderer
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'MarkdownRenderer');

    try {
      // Create MVVM components
      const model = new MarkdownModel({
        content: umbilical.content || '',
        theme: umbilical.theme || 'light',
        showLineNumbers: umbilical.showLineNumbers || false
      });

      const view = new MarkdownView({
        dom: umbilical.dom,
        theme: model.theme,
        onCopy: umbilical.onCopy
      });

      const viewModel = new MarkdownViewModel({
        model: model,
        view: view,
        onContentChange: umbilical.onContentChange
      });

      // Create public instance API
      const instance = {
        /**
         * Update markdown content
         * @param {string} content - New markdown content
         */
        setContent(content) {
          model.setContent(content);
        },

        /**
         * Get current content
         * @returns {string} Current markdown content
         */
        getContent() {
          return model.content;
        },

        /**
         * Set theme
         * @param {string} theme - 'light' or 'dark'
         */
        setTheme(theme) {
          model.setTheme(theme);
        },

        /**
         * Get current theme
         * @returns {string} Current theme
         */
        getTheme() {
          return model.theme;
        },

        /**
         * Clear content
         */
        clear() {
          model.setContent('');
        },

        /**
         * Append content
         * @param {string} content - Content to append
         */
        append(content) {
          model.setContent(model.content + '\n\n' + content);
        },

        /**
         * Destroy component and clean up
         */
        destroy() {
          if (viewModel) {
            viewModel.destroy();
          }
          if (view) {
            view.destroy();
          }
          if (model) {
            model.destroy();
          }
          
          if (umbilical.onDestroy) {
            umbilical.onDestroy(instance);
          }
        }
      };

      // Initialize with any provided content
      if (umbilical.content) {
        model.setContent(umbilical.content);
      }

      // Call onMount if provided
      if (umbilical.onMount) {
        umbilical.onMount(instance);
      }

      return instance;

    } catch (error) {
      throw new UmbilicalError(
        `MarkdownRenderer creation failed: ${error.message}`,
        'COMPONENT_CREATION_FAILED',
        { originalError: error }
      );
    }
  }
};