/**
 * HierarchyEditor - Multi-format editable hierarchy display component
 * 
 * A component that allows viewing and editing structured data in various formats
 * (JSON, XML, YAML, Markdown) while maintaining both tree view and native format
 * representation with full editing capabilities.
 */

import { UmbilicalUtils, UmbilicalError } from '@legion/components';
import { HierarchyEditorInstance } from './HierarchyEditorInstance.js';

export const HierarchyEditor = {
  create(umbilical) {
    // 1. Introspection mode
    if (umbilical && umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      
      // Required
      requirements.add('dom', 'HTMLElement', 'Container element for the hierarchy editor');
      
      // Content
      requirements.add('content', 'string', 'Initial content to display (optional)');
      requirements.add('format', 'string', 'Format: "json", "xml", "yaml", "markdown" (optional, auto-detected)');
      
      // Features
      requirements.add('editable', 'boolean', 'Enable editing capabilities (default: true)');
      requirements.add('showToolbar', 'boolean', 'Show mode toolbar (default: true)');
      requirements.add('defaultMode', 'string', 'Initial view mode: "tree" or "source" (default: "tree")');
      
      // Event callbacks
      requirements.add('onMount', 'function', 'Callback when component is mounted (optional)');
      requirements.add('onDestroy', 'function', 'Callback when component is destroyed (optional)');
      requirements.add('onContentChange', 'function', 'Callback when content changes (optional)');
      requirements.add('onNodeEdit', 'function', 'Callback when node is edited (optional)');
      requirements.add('onNodeAdd', 'function', 'Callback when node is added (optional)');
      requirements.add('onNodeRemove', 'function', 'Callback when node is removed (optional)');
      requirements.add('onFormatChange', 'function', 'Callback when format changes (optional)');
      requirements.add('onValidationError', 'function', 'Callback when validation errors occur (optional)');
      requirements.add('onModeChange', 'function', 'Callback when view mode changes (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // 2. Validation mode
    if (umbilical && umbilical.validate) {
      const checks = {
        hasDomElement: !!(umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE),
        hasValidContent: !umbilical.content || typeof umbilical.content === 'string',
        hasValidFormat: !umbilical.format || ['json', 'xml', 'yaml', 'markdown'].includes(umbilical.format),
        hasValidEditable: !umbilical.editable || typeof umbilical.editable === 'boolean',
        hasValidMode: !umbilical.defaultMode || ['tree', 'source'].includes(umbilical.defaultMode),
        hasValidCallbacks: this._validateCallbacks(umbilical)
      };
      
      return umbilical.validate(checks);
    }

    // 3. Instance creation mode
    if (!umbilical) {
      throw new UmbilicalError('Umbilical parameter is required', 'HierarchyEditor');
    }

    if (!umbilical.dom) {
      throw new UmbilicalError('DOM container element is required', 'HierarchyEditor');
    }

    if (umbilical.dom.nodeType !== Node.ELEMENT_NODE) {
      throw new UmbilicalError('DOM parameter must be an HTML element', 'HierarchyEditor');
    }

    // Create and return instance
    const instance = new HierarchyEditorInstance(umbilical);
    
    // Call onMount callback
    if (umbilical.onMount) {
      umbilical.onMount(instance);
    }
    
    return instance;
  },

  _validateCallbacks(umbilical) {
    const callbacks = [
      'onMount', 'onDestroy', 'onContentChange', 'onNodeEdit', 
      'onNodeAdd', 'onNodeRemove', 'onFormatChange', 
      'onValidationError', 'onModeChange'
    ];
    
    return callbacks.every(callback => 
      !umbilical[callback] || typeof umbilical[callback] === 'function'
    );
  }
};