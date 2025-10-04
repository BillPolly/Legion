/**
 * TreeScribe - YAML-based Hierarchical Document Viewer
 * 
 * A sophisticated document viewer that loads YAML files representing deeply 
 * hierarchical document trees with dynamic rendering, folding capabilities, 
 * and pluggable content renderers.
 * 
 * @author Claude Code
 * @version 1.0.0
 */

import { UmbilicalUtils } from '@legion/components';
import { TreeScribeInstance } from './TreeScribe.js';

export const TreeScribe = {
  create(umbilical) {
    // 1. Introspection mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Parent DOM element for rendering');
      requirements.add('yamlContent', 'string', 'Initial YAML document content (optional)');
      requirements.add('theme', 'string', 'Visual theme: light or dark (optional, default: light)');
      requirements.add('plugins', 'array', 'Custom renderer plugins (optional)');
      requirements.add('renderers', 'object', 'Custom renderer implementations (optional)');
      requirements.add('enableSearch', 'boolean', 'Enable search functionality (optional, default: true)');
      requirements.add('enableFolding', 'boolean', 'Enable folding functionality (optional, default: true)');
      requirements.add('enableKeyboard', 'boolean', 'Enable keyboard navigation (optional, default: true)');
      requirements.add('enableVirtualScroll', 'boolean', 'Enable virtual scrolling (optional, default: true)');
      requirements.add('enableAccessibility', 'boolean', 'Enable accessibility features (optional, default: true)');
      requirements.add('enableExport', 'boolean', 'Enable export functionality (optional, default: true)');
      requirements.add('onMount', 'function', 'Callback when component is mounted (optional)');
      requirements.add('onDestroy', 'function', 'Callback when component is destroyed (optional)');
      requirements.add('onNodeToggle', 'function', 'Callback when node is expanded/collapsed (optional)');
      requirements.add('onSearch', 'function', 'Callback when search is performed (optional)');
      requirements.add('onRendererError', 'function', 'Callback when renderer encounters error (optional)');
      umbilical.describe(requirements);
      return;
    }

    // 2. Validation mode
    if (umbilical.validate) {
      const checks = {
        hasDomElement: !!(umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE),
        hasValidTheme: !umbilical.theme || ['light', 'dark'].includes(umbilical.theme),
        hasValidPlugins: !umbilical.plugins || Array.isArray(umbilical.plugins),
        hasValidRenderers: !umbilical.renderers || typeof umbilical.renderers === 'object',
        hasValidCallbacks: this._validateCallbacks(umbilical)
      };
      return umbilical.validate(checks);
    }

    // 3. Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'TreeScribe');
    
    // Create and return TreeScribe instance
    const instance = new TreeScribeInstance(umbilical);
    
    // Load initial YAML content if provided
    if (umbilical.yamlContent) {
      instance.loadYaml(umbilical.yamlContent);
    }
    
    return instance;
  },

  _validateCallbacks(umbilical) {
    const callbacks = ['onMount', 'onDestroy', 'onNodeToggle', 'onSearch', 'onRendererError'];
    return callbacks.every(callback => 
      !umbilical[callback] || typeof umbilical[callback] === 'function'
    );
  }
};

/**
 * TreeScribe Instance Class (Implementation Pending)
 * 
 * This class will implement the full MVVM architecture as specified in:
 * src/components/tree-scribe/docs/design.md
 * 
 * Architecture:
 * - Model: TreeScribeModel, TreeNode, RendererRegistry, SearchEngine
 * - View: TreeScribeView, NodeRenderer, KeyboardNavigation, Content Renderers
 * - ViewModel: TreeScribeViewModel, FoldingManager, RenderingCoordinator
 * 
 * Public API:
 * - loadYaml(yamlString): void
 * - exportHtml(): string
 * - exportJson(): object
 * - expandAll(): void
 * - collapseAll(): void
 * - expandToDepth(depth): void
 * - searchContent(query): SearchResult[]
 * - getNodeState(nodeId): NodeState
 * - setNodeState(nodeId, state): void
 * - getFoldingState(): FoldingState
 * - destroy(): void
 */