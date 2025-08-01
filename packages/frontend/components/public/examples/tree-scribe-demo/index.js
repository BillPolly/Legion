/**
 * TreeScribeDemo - A complete demo application as an umbilical component
 * Demonstrates the full TreeScribe functionality with a comprehensive UI
 */

import { TreeScribeInstance } from '/src/components/tree-scribe/TreeScribe.js';
import { UmbilicalUtils } from '/src/umbilical/index.js';

export const TreeScribeDemo = {
  create(umbilical) {
    // 1. Introspection mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Parent DOM element');
      umbilical.describe(requirements);
      return;
    }

    // 2. Validation mode
    if (umbilical.validate) {
      const checks = {
        hasDomElement: !!(umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE)
      };
      return umbilical.validate(checks);
    }

    // 3. Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'TreeScribeDemo');
    
    return new TreeScribeDemoInstance(umbilical);
  }
};

class TreeScribeDemoInstance {
  constructor(umbilical) {
    this.umbilical = umbilical;
    this._destroyed = false;
    this.treeScribe = null;
    this.currentDocument = 'simple-guide';
    this.searchTimeout = null;
    this.pluginManager = null;
    
    // Create the demo UI
    this._createDemoUI();
    this._initializeTreeScribe();
    this._initializePluginManager();
    
    // Make instance globally accessible for onclick handlers
    window.treeScribeDemoInstance = this;
    
    if (umbilical.onMount) {
      umbilical.onMount(this);
    }
  }
  
  _createDemoUI() {
    // Create the main container
    this.container = document.createElement('div');
    this.container.className = 'tree-scribe-demo';
    this.container.innerHTML = `
      <div class="demo-header">
        <h1>🌳 TreeScribe Universal Document Viewer</h1>
        <p>Multi-format document viewer with 8+ supported formats, plugin system, and enterprise features - built as a single umbilical component</p>
        <div class="format-badges">
          <span class="badge">YAML</span>
          <span class="badge">JSON</span>
          <span class="badge">Markdown</span>
          <span class="badge">HTML</span>
          <span class="badge">JavaScript</span>
          <span class="badge">XML</span>
          <span class="badge plugin">CSV Plugin</span>
          <span class="badge plugin">TOML Plugin</span>
        </div>
      </div>
      
      <div class="demo-toolbar">
        <div class="toolbar-group">
          <label>Document:</label>
          <select id="documentSelect" class="btn-select">
            <option value="simple-guide">📘 Simple Guide (YAML)</option>
            <option value="complex-structure">🏢 Complex Structure (YAML)</option>
            <option value="markdown-demo">📝 Markdown Demo</option>
            <option value="json-demo">{ } JSON Demo</option>
            <option value="html-demo">🌐 HTML Demo</option>
            <option value="javascript-demo">📝 JavaScript Demo</option>
            <option value="xml-demo">📃 XML Demo</option>
            <option value="csv-demo">📊 CSV Demo (Plugin)</option>
            <option value="toml-demo">⚙️ TOML Demo (Plugin)</option>
            <option value="data-showcase">📊 Data Showcase (YAML)</option>
            <option value="accessibility-demo">♿ Accessibility Demo (YAML)</option>
          </select>
        </div>
        
        <div class="toolbar-group">
          <label>Format:</label>
          <select id="formatSelect" class="btn-select">
            <option value="auto">🔍 Auto-detect</option>
            <option value="yaml">📄 YAML</option>
            <option value="json">{ } JSON</option>
            <option value="markdown">📝 Markdown</option>
            <option value="html">🌐 HTML</option>
            <option value="javascript">📝 JavaScript</option>
            <option value="xml">📃 XML</option>
          </select>
        </div>
        
        <div class="toolbar-group">
          <label>Theme:</label>
          <select id="themeSelect" class="btn-select">
            <option value="light">☀️ Light</option>
            <option value="dark">🌙 Dark</option>
          </select>
        </div>
        
        <div class="toolbar-group">
          <input type="text" id="searchInput" placeholder="Search content..." class="search-input">
          <button id="clearSearchBtn" class="btn secondary">Clear</button>
        </div>
        
        <div class="toolbar-group">
          <button id="expandAllBtn" class="btn">Expand All</button>
          <button id="collapseAllBtn" class="btn">Collapse All</button>
        </div>
        
        <div class="toolbar-group">
          <button id="exportHtmlBtn" class="btn">Export HTML</button>
          <button id="exportJsonBtn" class="btn">Export JSON</button>
        </div>
        
        <div class="toolbar-group">
          <input type="file" id="fileInput" accept=".yaml,.yml,.json,.md,.markdown,.mdown,.mkd,.html,.htm,.js,.jsx,.ts,.tsx,.xml,.svg,.txt" style="display: none;">
          <button id="loadFileBtn" class="btn secondary">Load File</button>
          <button id="reloadBtn" class="btn secondary">Reload</button>
        </div>
        
        <div class="toolbar-group">
          <button id="pluginsBtn" class="btn secondary">🔌 Plugins</button>
        </div>
      </div>
      
      <div class="demo-content">
        <div class="demo-sidebar">
          <div class="status-panel">
            <h4>Document Status</h4>
            <div class="status-item">Nodes: <span id="nodeCount">0</span></div>
            <div class="status-item">Load Time: <span id="loadTime">0ms</span></div>
            <div class="status-item">Theme: <span id="currentTheme">light</span></div>
            <div class="status-item">Search Results: <span id="searchResults">0</span></div>
          </div>
          
          <div class="features-panel">
            <h4>Features</h4>
            <div class="feature-item">
              <label>
                <input type="checkbox" id="enableSearch" checked> Search
              </label>
            </div>
            <div class="feature-item">
              <label>
                <input type="checkbox" id="enableFolding" checked> Folding
              </label>
            </div>
            <div class="feature-item">
              <label>
                <input type="checkbox" id="enableKeyboard" checked> Keyboard Nav
              </label>
            </div>
            <div class="feature-item">
              <label>
                <input type="checkbox" id="enableVirtualScroll" checked> Virtual Scroll
              </label>
            </div>
            <div class="feature-item">
              <label>
                <input type="checkbox" id="enableAccessibility" checked> Accessibility
              </label>
            </div>
          </div>
          
          <div class="format-panel">
            <h4>Format Detection</h4>
            <div id="formatInfo" class="format-info">
              <div class="format-badge" id="currentFormat">Auto</div>
              <div class="format-details" id="formatDetails">Select a document to see format information</div>
            </div>
          </div>
          
          <div class="log-panel">
            <h4>Event Log</h4>
            <div id="eventLog" class="event-log"></div>
            <button id="clearLogBtn" class="btn secondary small">Clear Log</button>
          </div>
        </div>
        
        <div class="demo-main">
          <div class="tree-scribe-container">
            <div id="treeScribeContainer" class="tree-container"></div>
          </div>
        </div>
      </div>
      
      <div class="demo-footer">
        <div class="footer-stats">
          <span>TreeScribe v2.0.0 - Universal Document Viewer</span> • 
          <span id="formatCount">Formats: <span id="supportedFormats">Loading...</span></span> • 
          <span id="nodeCount">Nodes: 0</span> • 
          <span id="loadTime">Load: 0ms</span>
        </div>
      </div>
      
      <!-- Plugin Manager Modal -->
      <div id="pluginModal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>🔌 Plugin Manager</h2>
            <button class="modal-close" id="closePluginModal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="plugin-tabs">
              <button class="plugin-tab active" data-tab="installed">Installed Plugins</button>
              <button class="plugin-tab" data-tab="examples">Example Plugins</button>
              <button class="plugin-tab" data-tab="load">Load Plugin</button>
            </div>
            
            <div class="plugin-content">
              <!-- Installed Plugins Tab -->
              <div id="installedTab" class="tab-pane active">
                <div class="plugin-list" id="installedPlugins">
                  <p class="empty-message">No plugins currently installed</p>
                </div>
              </div>
              
              <!-- Example Plugins Tab -->
              <div id="examplesTab" class="tab-pane" style="display: none;">
                <div class="plugin-examples">
                  <div class="plugin-card">
                    <h4>CSV Parser Plugin</h4>
                    <p>Parse CSV and TSV files with automatic hierarchy detection and grouping support.</p>
                    <div class="plugin-actions">
                      <button class="btn small" id="loadCsvPlugin">Load Plugin</button>
                      <button class="btn small secondary" id="viewCsvCode">View Code</button>
                    </div>
                  </div>
                  <div class="plugin-card">
                    <h4>TOML Parser Plugin</h4>
                    <p>Parse TOML configuration files with full spec support including tables and arrays.</p>
                    <div class="plugin-actions">
                      <button class="btn small" id="loadTomlPlugin">Load Plugin</button>
                      <button class="btn small secondary" id="viewTomlCode">View Code</button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Load Plugin Tab -->
              <div id="loadTab" class="tab-pane" style="display: none;">
                <div class="load-plugin-form">
                  <h4>Load Plugin from File</h4>
                  <p>Select a JavaScript file containing a TreeScribe parser plugin.</p>
                  <input type="file" id="pluginFileInput" accept=".js,.mjs" style="display: none;">
                  <button class="btn" id="selectPluginFile">Select Plugin File</button>
                  <div id="pluginFileInfo" style="margin-top: 10px;"></div>
                  
                  <h4 style="margin-top: 30px;">Load Plugin from URL</h4>
                  <p>Enter the URL of a TreeScribe parser plugin (development only, localhost only).</p>
                  <input type="text" id="pluginUrlInput" placeholder="http://localhost:3000/my-parser.js" class="plugin-url-input">
                  <button class="btn" id="loadPluginUrl">Load from URL</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    this._addStyles();
    
    // Append to umbilical DOM
    this.umbilical.dom.appendChild(this.container);
  }
  
  _addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .tree-scribe-demo {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f8f9fa;
      }
      
      .demo-header {
        padding: 20px 30px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
      }
      
      .demo-header h1 {
        margin: 0 0 8px 0;
        font-size: 28px;
        font-weight: 600;
      }
      
      .demo-header p {
        margin: 0 0 15px 0;
        opacity: 0.9;
        font-size: 16px;
      }
      
      .format-badges {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
      }
      
      .badge {
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 500;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
      
      .badge.plugin {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 193, 7, 0.5);
        color: #ffc107;
      }
      
      .demo-toolbar {
        display: flex;
        gap: 15px;
        padding: 15px 20px;
        background: #ffffff;
        border-bottom: 1px solid #e9ecef;
        flex-wrap: wrap;
        align-items: center;
      }
      
      .toolbar-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .toolbar-group label {
        font-weight: 500;
        color: #495057;
        font-size: 14px;
      }
      
      .btn, .btn-select, .search-input {
        padding: 8px 16px;
        border: 1px solid #ced4da;
        border-radius: 6px;
        font-size: 14px;
        background: white;
        color: #495057;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .btn:hover {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-color: #667eea;
        transform: translateY(-1px);
      }
      
      .btn.secondary {
        background: #6c757d;
        color: white;
        border-color: #5a6268;
      }
      
      .btn.secondary:hover {
        background: #545b62;
        transform: translateY(-1px);
      }
      
      .btn.small {
        padding: 4px 8px;
        font-size: 12px;
      }
      
      .search-input {
        width: 200px;
      }
      
      .search-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
      }
      
      .demo-content {
        flex: 1;
        display: flex;
        min-height: 0;
      }
      
      .demo-sidebar {
        width: 280px;
        background: #ffffff;
        border-right: 1px solid #e9ecef;
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .status-panel, .features-panel, .log-panel {
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 15px;
        background: #f8f9fa;
      }
      
      .status-panel h4, .features-panel h4, .log-panel h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
        color: #2c3e50;
      }
      
      .status-item {
        margin: 8px 0;
        font-size: 13px;
        color: #6c757d;
        display: flex;
        justify-content: space-between;
      }
      
      .status-item span {
        font-weight: 500;
        color: #495057;
      }
      
      .feature-item {
        margin: 8px 0;
      }
      
      .feature-item label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #495057;
        cursor: pointer;
      }
      
      .event-log {
        height: 150px;
        overflow-y: auto;
        font-size: 11px;
        font-family: monospace;
        background: #ffffff;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 10px;
      }
      
      .log-entry {
        margin: 2px 0;
        padding: 2px 4px;
        border-radius: 2px;
      }
      
      .log-entry.info {
        color: #0f5132;
      }
      
      .log-entry.error {
        background: #f8d7da;
        color: #721c24;
      }
      
      .log-entry.success {
        background: #d1edff;
        color: #055160;
      }
      
      .demo-main {
        flex: 1;
        padding: 20px;
        overflow: hidden;
      }
      
      .tree-scribe-container {
        width: 100%;
        height: 100%;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        background: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .tree-container {
        width: 100%;
        height: 100%;
      }
      
      /* Tree node styles */
      .tree-node {
        margin: 4px 0;
        user-select: none;
      }
      
      .node-header {
        display: flex;
        align-items: center;
        padding: 4px 0;
        cursor: pointer;
      }
      
      .node-header:hover {
        background-color: rgba(102, 126, 234, 0.1);
        border-radius: 4px;
      }
      
      .node-arrow {
        display: inline-block;
        width: 20px;
        text-align: center;
        font-size: 12px;
        color: #666;
        cursor: pointer;
        transition: transform 0.2s ease;
        flex-shrink: 0;
      }
      
      .node-arrow.expanded {
        transform: rotate(90deg);
      }
      
      .node-arrow:hover {
        color: #667eea;
      }
      
      .node-title {
        font-weight: 500;
        color: #2c3e50;
        padding-left: 4px;
        flex-grow: 1;
      }
      
      .node-content {
        margin-left: 24px;
        padding: 8px 0;
      }
      
      .node-children {
        margin-left: 20px;
      }
      
      .tree-node.collapsed .node-content {
        display: none;
      }
      
      .tree-node.collapsed .node-children {
        display: none;
      }
      
      /* Dark theme adjustments */
      .tree-scribe-theme-dark .node-title {
        color: #e1e4e8;
      }
      
      .tree-scribe-theme-dark .node-arrow {
        color: #8b949e;
      }
      
      .tree-scribe-theme-dark .node-header:hover {
        background-color: rgba(110, 118, 129, 0.2);
      }
      
      .demo-footer {
        background: #2c3e50;
        color: white;
        padding: 12px 20px;
        text-align: center;
      }
      
      .footer-stats {
        font-size: 13px;
        opacity: 0.9;
      }
      
      .footer-stats span {
        margin: 0 5px;
      }
      
      /* Format panel styles */
      .format-panel {
        margin-bottom: 20px;
        padding: 15px;
        border: 1px solid #e1e4e8;
        border-radius: 6px;
        background: #f6f8fa;
      }
      
      .format-panel h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        font-weight: 600;
        color: #24292f;
      }
      
      .format-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .format-badge {
        display: inline-block;
        padding: 4px 8px;
        background: #0969da;
        color: white;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        width: fit-content;
      }
      
      .format-badge.yaml { background: #8250df; }
      .format-badge.json { background: #1f883d; }
      .format-badge.markdown { background: #d1242f; }
      .format-badge.html { background: #e36209; }
      .format-badge.javascript { background: #f9c513; color: #24292f; }
      .format-badge.typescript { background: #3178c6; }
      .format-badge.xml { background: #6f42c1; }
      .format-badge.auto { background: #656d76; }
      
      .format-details {
        font-size: 12px;
        color: #656d76;
        line-height: 1.4;
      }
      
      /* Markdown styles */
      .markdown-content {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
      }
      
      .markdown-content h1, .markdown-content h2, .markdown-content h3, 
      .markdown-content h4, .markdown-content h5, .markdown-content h6 {
        margin-top: 1em;
        margin-bottom: 0.5em;
        font-weight: 600;
      }
      
      .markdown-content h1 { font-size: 2em; }
      .markdown-content h2 { font-size: 1.5em; }
      .markdown-content h3 { font-size: 1.25em; }
      
      .markdown-content p {
        margin-bottom: 1em;
      }
      
      .markdown-content a {
        color: #667eea;
        text-decoration: none;
      }
      
      .markdown-content a:hover {
        text-decoration: underline;
      }
      
      .markdown-content code {
        background: #f4f4f4;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 0.9em;
      }
      
      .markdown-content pre {
        background: #f8f8f8;
        border: 1px solid #e1e4e8;
        border-radius: 6px;
        padding: 16px;
        overflow-x: auto;
        margin: 1em 0;
      }
      
      .markdown-content pre code {
        background: none;
        padding: 0;
      }
      
      .markdown-content blockquote {
        border-left: 4px solid #dfe2e5;
        padding-left: 1em;
        margin-left: 0;
        color: #6a737d;
      }
      
      .markdown-content ul, .markdown-content ol {
        margin-bottom: 1em;
        padding-left: 2em;
      }
      
      .markdown-content table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
      }
      
      .markdown-content th, .markdown-content td {
        border: 1px solid #dfe2e5;
        padding: 8px 12px;
      }
      
      .markdown-content th {
        background: #f6f8fa;
        font-weight: 600;
      }
      
      .markdown-content img {
        max-width: 100%;
        height: auto;
      }
      
      .markdown-content .code-container {
        position: relative;
        margin: 1em 0;
      }
      
      .markdown-content .copy-button {
        position: absolute;
        top: 8px;
        right: 8px;
        background: #667eea;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.3s;
      }
      
      .markdown-content .code-container:hover .copy-button {
        opacity: 1;
      }
      
      .markdown-content .copy-button:hover {
        background: #764ba2;
      }
      
      /* Dark theme for markdown */
      .tree-scribe-theme-dark .markdown-content {
        color: #e1e4e8;
      }
      
      .tree-scribe-theme-dark .markdown-content code {
        background: #3a3a3a;
        color: #e1e4e8;
      }
      
      .tree-scribe-theme-dark .markdown-content pre {
        background: #2d2d2d;
        border-color: #444;
      }
      
      .tree-scribe-theme-dark .markdown-content blockquote {
        border-color: #444;
        color: #8b949e;
      }
      
      .tree-scribe-theme-dark .markdown-content th {
        background: #3a3a3a;
      }
      
      .tree-scribe-theme-dark .markdown-content th,
      .tree-scribe-theme-dark .markdown-content td {
        border-color: #444;
      }
      
      /* Responsive design */
      @media (max-width: 768px) {
        .demo-content {
          flex-direction: column;
        }
        
        .demo-sidebar {
          width: 100%;
          height: 200px;
        }
        
        .demo-toolbar {
          flex-direction: column;
          align-items: stretch;
        }
        
        .toolbar-group {
          justify-content: space-between;
        }
      }
      
      /* Plugin Modal Styles */
      .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .modal-content {
        background: white;
        border-radius: 8px;
        width: 90%;
        max-width: 800px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }
      
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 30px;
        border-bottom: 1px solid #e9ecef;
        background: #f8f9fa;
      }
      
      .modal-header h2 {
        margin: 0;
        color: #333;
        font-size: 24px;
      }
      
      .modal-close {
        background: none;
        border: none;
        font-size: 28px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s ease;
      }
      
      .modal-close:hover {
        background: #e9ecef;
        color: #333;
      }
      
      .modal-body {
        padding: 0;
        max-height: calc(80vh - 80px);
        overflow-y: auto;
      }
      
      .plugin-tabs {
        display: flex;
        border-bottom: 1px solid #e9ecef;
        background: #f8f9fa;
      }
      
      .plugin-tab {
        background: none;
        border: none;
        padding: 15px 25px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: #666;
        border-bottom: 3px solid transparent;
        transition: all 0.2s ease;
      }
      
      .plugin-tab:hover {
        background: #e9ecef;
        color: #333;
      }
      
      .plugin-tab.active {
        color: #667eea;
        border-bottom-color: #667eea;
        background: white;
      }
      
      .plugin-content {
        padding: 20px 30px;
      }
      
      .tab-pane {
        display: none;
      }
      
      .tab-pane.active {
        display: block;
      }
      
      .plugin-list {
        min-height: 100px;
      }
      
      .empty-message {
        text-align: center;
        color: #666;
        padding: 40px 20px;
        font-style: italic;
      }
      
      .plugin-examples {
        display: grid;
        gap: 20px;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      }
      
      .plugin-card {
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 20px;
        background: #f8f9fa;
      }
      
      .plugin-card h4 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 18px;
      }
      
      .plugin-card p {
        margin: 0 0 15px 0;
        color: #666;
        line-height: 1.5;
      }
      
      .plugin-actions {
        display: flex;
        gap: 10px;
      }
      
      .btn.small {
        padding: 8px 16px;
        font-size: 13px;
      }
      
      .load-plugin-form h4 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 18px;
      }
      
      .load-plugin-form p {
        margin: 0 0 15px 0;
        color: #666;
        line-height: 1.5;
      }
      
      .plugin-url-input {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        margin-bottom: 15px;
      }
      
      .plugin-url-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
      }
      
      .plugin-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        margin-bottom: 10px;
        background: #f8f9fa;
      }
      
      .plugin-item-info h5 {
        margin: 0 0 5px 0;
        color: #333;
        font-size: 16px;
      }
      
      .plugin-item-info p {
        margin: 0;
        color: #666;
        font-size: 13px;
      }
      
      .plugin-item-actions {
        display: flex;
        gap: 10px;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  _initializeTreeScribe() {
    try {
      const container = this.container.querySelector('#treeScribeContainer');
      
      this.treeScribe = new TreeScribeInstance({
        dom: container,
        theme: 'light',
        enableSearch: true,
        enableFolding: true,
        enableKeyboard: true,
        enableVirtualScroll: true,
        enableAccessibility: true,
        enableExport: true,
        onNodeToggle: (nodeId, expanded) => {
          this._log(`Node ${nodeId} ${expanded ? 'expanded' : 'collapsed'}`, 'info');
        },
        onSearch: (query, resultCount) => {
          this._log(`Search "${query}": ${resultCount} results`, 'info');
          this._updateSearchResults(resultCount);
        },
        onMount: (instance) => {
          this._log('TreeScribe mounted successfully', 'success');
          this._loadDefaultDocument();
        },
        onError: (error) => {
          this._log(`Error: ${error.message}`, 'error');
        }
      });
      
      // Initialize format info display
      this._updateSupportedFormats();
      
      // Setup event handlers
      this._setupEventHandlers();
      
    } catch (error) {
      this._log(`Initialization error: ${error.message}`, 'error');
    }
  }
  
  _setupEventHandlers() {
    // Document selector
    this.container.querySelector('#documentSelect').addEventListener('change', (e) => {
      this.currentDocument = e.target.value;
      this._loadDocument(this.currentDocument);
    });
    
    // Format selector
    this.container.querySelector('#formatSelect').addEventListener('change', (e) => {
      this.selectedFormat = e.target.value;
      this._log(`Format selection changed to ${e.target.value}`, 'info');
      if (this.currentDocument) {
        this._loadDocument(this.currentDocument);
      }
    });
    
    // Theme selector
    this.container.querySelector('#themeSelect').addEventListener('change', (e) => {
      if (this.treeScribe) {
        this.treeScribe.setTheme(e.target.value);
        this._updateThemeStatus(e.target.value);
        this._log(`Theme changed to ${e.target.value}`, 'info');
      }
    });
    
    // Search input
    this.container.querySelector('#searchInput').addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        if (this.treeScribe && e.target.value.trim()) {
          this.treeScribe.search(e.target.value.trim());
        } else if (this.treeScribe) {
          this.treeScribe.clearSearch();
          this._updateSearchResults(0);
        }
      }, 300);
    });
    
    // Clear search
    this.container.querySelector('#clearSearchBtn').addEventListener('click', () => {
      const searchInput = this.container.querySelector('#searchInput');
      if (searchInput) {
        searchInput.value = '';
      }
      if (this.treeScribe) {
        this.treeScribe.clearSearch();
        this._updateSearchResults(0);
      }
    });
    
    // Tree controls
    this.container.querySelector('#expandAllBtn').addEventListener('click', () => {
      if (this.treeScribe) {
        this.treeScribe.expandAll();
        this._log('Expanded all nodes', 'info');
      }
    });
    
    this.container.querySelector('#collapseAllBtn').addEventListener('click', () => {
      if (this.treeScribe) {
        this.treeScribe.collapseAll();
        this._log('Collapsed all nodes', 'info');
      }
    });
    
    // Export buttons
    this.container.querySelector('#exportHtmlBtn').addEventListener('click', () => {
      if (this.treeScribe) {
        const html = this.treeScribe.exportHTML();
        if (html) {
          this._downloadFile('treescribe-export.html', html, 'text/html');
          this._log('HTML export downloaded', 'success');
        }
      }
    });
    
    this.container.querySelector('#exportJsonBtn').addEventListener('click', () => {
      if (this.treeScribe) {
        const json = this.treeScribe.exportJson();
        if (json) {
          const jsonStr = JSON.stringify(json, null, 2);
          this._downloadFile('treescribe-export.json', jsonStr, 'application/json');
          this._log('JSON export downloaded', 'success');
        }
      }
    });
    
    // File input
    this.container.querySelector('#loadFileBtn').addEventListener('click', () => {
      this.container.querySelector('#fileInput').click();
    });
    
    this.container.querySelector('#fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file && this.treeScribe) {
        try {
          const content = await file.text();
          const startTime = Date.now();
          
          // Use filename as hint for format detection
          const loadOptions = {
            filename: file.name,
            mimeType: file.type
          };
          
          // Add explicit format if selected
          if (this.selectedFormat && this.selectedFormat !== 'auto') {
            loadOptions.format = this.selectedFormat;
          }
          
          const result = await this.treeScribe.load(content, loadOptions);
          const loadTime = Date.now() - startTime;
          
          if (result.success) {
            this._updateStats(result.nodeCount, loadTime);
            this._updateFormatInfo(result.format, result.parser);
            this._log(`Loaded file "${file.name}" with ${result.nodeCount} nodes (${result.format})`, 'success');
          } else {
            this._log(`Failed to load file: ${result.error}`, 'error');
          }
        } catch (error) {
          this._log(`File load error: ${error.message}`, 'error');
        }
      }
    });
    
    // Reload button
    this.container.querySelector('#reloadBtn').addEventListener('click', () => {
      this._loadDocument(this.currentDocument);
    });
    
    // Feature toggles (for demonstration - would require recreating TreeScribe)
    ['enableSearch', 'enableFolding', 'enableKeyboard', 'enableVirtualScroll', 'enableAccessibility'].forEach(feature => {
      this.container.querySelector(`#${feature}`).addEventListener('change', (e) => {
        this._log(`${feature} ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
      });
    });
    
    // Clear log button
    this.container.querySelector('#clearLogBtn').addEventListener('click', () => {
      this.container.querySelector('#eventLog').innerHTML = '';
    });
    
    // Plugin manager events
    this._setupPluginEvents();
  }
  
  async _loadDefaultDocument() {
    await this._loadDocument(this.currentDocument);
  }
  
  async _loadDocument(documentName) {
    if (!this.treeScribe) return;
    
    try {
      this._log(`Loading document: ${documentName}`, 'info');
      const startTime = Date.now();
      
      let content = await this._getDocumentContent(documentName);
      
      // Prepare load options based on format selector
      const loadOptions = {};
      if (this.selectedFormat && this.selectedFormat !== 'auto') {
        loadOptions.format = this.selectedFormat;
        this._log(`Using explicit format: ${this.selectedFormat}`, 'info');
      }
      
      // Detect format before loading if in auto mode
      if (!loadOptions.format) {
        const detection = this.treeScribe.analyzeFormat(content);
        this._updateFormatDetection(detection);
        this._log(`Auto-detected format: ${detection.format} (confidence: ${Math.round(detection.confidence * 100)}%)`, 'info');
      }
      
      // Load with new universal method
      const result = await this.treeScribe.load(content, loadOptions);
      const loadTime = Date.now() - startTime;
      
      if (result.success) {
        this._updateStats(result.nodeCount, loadTime);
        this._updateFormatInfo(result.format, result.parser);
        this._log(`Document loaded successfully (${result.nodeCount} nodes, ${loadTime}ms, ${result.format})`, 'success');
      } else {
        this._log(`Failed to load document: ${result.error}`, 'error');
      }
      
    } catch (error) {
      this._log(`Load error: ${error.message}`, 'error');
    }
  }
  
  async _getDocumentContent(documentName) {
    // Try to fetch from the tree-scribe examples directory first
    const documentPaths = {
      'simple-guide': '/examples/tree-scribe/simple-guide.yaml',
      'complex-structure': '/examples/tree-scribe/complex-structure.yaml',
      'csv-demo': '/examples/tree-scribe-demo/content/csv-demo.csv',
      'toml-demo': '/examples/tree-scribe-demo/content/toml-demo.toml'
    };
    
    if (documentPaths[documentName]) {
      try {
        const response = await fetch(documentPaths[documentName]);
        if (response.ok) {
          return await response.text();
        }
      } catch (e) {
        // Fall back to inline content
      }
    }
    
    // Fallback to inline YAML content
    const inlineDocuments = {
      'simple-guide': `
title: TreeScribe Quick Start Guide
content: |
  # Welcome to TreeScribe
  
  TreeScribe is a powerful YAML document viewer with advanced features:
  - Interactive tree navigation
  - Full-text search
  - Multiple content renderers
  - Keyboard accessibility
  - Export functionality

children:
  - title: Getting Started
    content: |
      ## Basic Usage
      
      TreeScribe follows the Umbilical Component Protocol:
      
      \`\`\`javascript
      const treeScribe = new TreeScribeInstance({
        dom: container,
        theme: 'light',
        enableSearch: true
      });
      
      await treeScribe.loadYaml(yamlContent);
      \`\`\`
    
    children:
      - title: Installation
        content: |
          ### Installation Steps
          1. Include TreeScribe in your project
          2. Create a container element
          3. Initialize with umbilical object
          4. Load your YAML content
          
      - title: Configuration
        content: |
          ### Configuration Options
          - **theme**: 'light' or 'dark'
          - **enableSearch**: Enable search functionality
          - **enableFolding**: Enable node folding
          - **enableKeyboard**: Enable keyboard navigation
          - **enableAccessibility**: Enable a11y features

  - title: Features
    content: |
      ## Core Features
      
      TreeScribe provides a comprehensive set of features for document viewing.
    
    children:
      - title: Search
        content: |
          ### Search Functionality
          - Full-text search across all content
          - Highlight search results
          - Navigate between results
          - Case-sensitive options
          
      - title: Navigation
        content: |
          ### Tree Navigation
          - Expand/collapse nodes
          - Keyboard navigation
          - Focus management
          - Breadcrumb trails
          
      - title: Export
        content: |
          ### Export Options
          - Export to HTML
          - Export to JSON
          - Include styling
          - Custom formatting

  - title: Examples
    content: |
      ## Usage Examples
      
      Here are some common usage patterns.
    
    children:
      - title: Simple Document
        content: |
          \`\`\`yaml
          title: My Document
          content: This is a simple document
          children:
            - title: Section 1
              content: Content for section 1
          \`\`\`
          
      - title: Complex Structure
        content: |
          \`\`\`yaml
          title: Complex Document
          metadata:
            author: TreeScribe Demo
            version: 1.0
          content: |
            # Advanced Document
            
            This shows complex structures.
          children:
            - title: Data Section
              content:
                type: data
                values: [1, 2, 3, 4, 5]
          \`\`\`

metadata:
  author: "TreeScribe Team"
  version: "1.0.0"
  created: "2024-01-17"
  description: "Quick start guide for TreeScribe"
`,
      
      'complex-structure': `
title: Enterprise Architecture Documentation
content: |
  # Enterprise System Architecture
  
  This document provides a comprehensive overview of our enterprise architecture,
  including microservices, databases, and infrastructure components.

metadata:
  document_type: "architecture"
  classification: "internal"
  version: "2.1.0"
  last_updated: "2024-01-17"
  owner: "Architecture Team"

children:
  - title: System Overview
    content: |
      ## High-Level Architecture
      
      Our enterprise system consists of multiple layers and components
      designed for scalability, reliability, and maintainability.
    
    children:
      - title: Presentation Layer
        content: |
          ### Frontend Applications
          - Web portal (React.js)
          - Mobile app (React Native)
          - Admin dashboard (Vue.js)
          - API documentation (OpenAPI)
        
        children:
          - title: Web Portal
            content: |
              #### Technology Stack
              - Framework: React 18
              - State Management: Redux Toolkit
              - Styling: Tailwind CSS
              - Build Tool: Vite
              - Testing: Jest + React Testing Library
              
              #### Features
              - User authentication
              - Dashboard analytics
              - Real-time notifications
              - Responsive design
            
          - title: Mobile Application
            content: |
              #### React Native Setup
              - Platform: iOS & Android
              - Navigation: React Navigation 6
              - State: Redux Persist
              - Push Notifications: Firebase
              
              #### Key Features
              - Offline capability
              - Biometric authentication
              - Push notifications
              - Deep linking
      
      - title: Application Layer
        content: |
          ### Microservices Architecture
          - API Gateway (Kong)
          - User Service (Node.js)
          - Order Service (Java Spring)
          - Payment Service (Python Flask)
          - Notification Service (Go)
        
        children:
          - title: API Gateway
            content: |
              #### Kong Configuration
              - Rate limiting: 1000 req/min
              - Authentication: JWT + OAuth2
              - Load balancing: Round robin
              - Caching: Redis
              - Monitoring: Prometheus
              
              #### Plugins
              - Authentication
              - Rate limiting
              - CORS handling
              - Request/response transformation
            
          - title: User Service
            content: |
              #### Service Details
              - Runtime: Node.js 18
              - Framework: Express.js
              - Database: PostgreSQL
              - Cache: Redis
              - Queue: RabbitMQ
              
              #### Endpoints
              - POST /users - Create user
              - GET /users/:id - Get user
              - PUT /users/:id - Update user
              - DELETE /users/:id - Delete user
              - GET /users/search - Search users
              
              #### Business Logic
              - User registration
              - Profile management
              - Authentication
              - Authorization
              - Audit logging
            
            children:
              - title: Database Schema
                content: |
                  \`\`\`sql
                  CREATE TABLE users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    first_name VARCHAR(100),
                    last_name VARCHAR(100),
                    role VARCHAR(50) DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT true
                  );
                  
                  CREATE INDEX idx_users_email ON users(email);
                  CREATE INDEX idx_users_role ON users(role);
                  CREATE INDEX idx_users_active ON users(is_active);
                  \`\`\`
              
              - title: API Documentation
                content: |
                  #### User API Specification
                  
                  **Create User**
                  \`\`\`
                  POST /api/v1/users
                  Content-Type: application/json
                  
                  {
                    "email": "user@example.com",
                    "password": "securePassword123",
                    "firstName": "John",
                    "lastName": "Doe"
                  }
                  \`\`\`
                  
                  **Response**
                  \`\`\`json
                  {
                    "id": "123e4567-e89b-12d3-a456-426614174000",
                    "email": "user@example.com",
                    "firstName": "John",
                    "lastName": "Doe",
                    "role": "user",
                    "createdAt": "2024-01-17T10:30:00Z"
                  }
                  \`\`\`
          
          - title: Order Service
            content: |
              #### Service Architecture
              - Runtime: Java 17
              - Framework: Spring Boot 3
              - Database: PostgreSQL
              - Message Queue: Apache Kafka
              - Cache: Redis
              
              #### Domain Model
              - Order aggregate
              - Order items
              - Payment information
              - Shipping details
              - Order lifecycle
              
              #### Integration Points
              - User Service (user validation)
              - Payment Service (payment processing)
              - Inventory Service (stock checking)
              - Notification Service (order updates)
            
            children:
              - title: Order Lifecycle
                content: |
                  #### State Machine
                  1. **DRAFT** - Order being created
                  2. **PENDING** - Awaiting payment
                  3. **CONFIRMED** - Payment successful
                  4. **PROCESSING** - Being prepared
                  5. **SHIPPED** - In transit
                  6. **DELIVERED** - Successfully delivered
                  7. **CANCELLED** - Order cancelled
                  8. **REFUNDED** - Payment refunded
                  
                  #### Business Rules
                  - Orders can only be cancelled before shipping
                  - Refunds require manager approval
                  - Inventory is reserved on confirmation
                  - Automatic cancellation after 24h if unpaid
      
      - title: Data Layer
        content: |
          ### Database Architecture
          - Primary: PostgreSQL cluster
          - Cache: Redis cluster
          - Search: Elasticsearch
          - Analytics: ClickHouse
          - Backup: AWS S3
        
        children:
          - title: PostgreSQL Cluster
            content: |
              #### Cluster Configuration
              - Master-slave replication
              - 3 read replicas
              - Automatic failover
              - Connection pooling (PgBouncer)
              - Monitoring (pg_stat_statements)
              
              #### Database Design
              - Normalized schema
              - Proper indexing strategy
              - Partitioning for large tables
              - Regular VACUUM and ANALYZE
              - Point-in-time recovery
            
            children:
              - title: Performance Tuning
                content: |
                  #### Configuration Optimizations
                  \`\`\`
                  shared_buffers = 2GB
                  effective_cache_size = 6GB
                  work_mem = 16MB
                  maintenance_work_mem = 256MB
                  max_connections = 100
                  checkpoint_segments = 32
                  wal_buffers = 16MB
                  \`\`\`
                  
                  #### Query Optimization
                  - Use EXPLAIN ANALYZE for slow queries
                  - Create appropriate indexes
                  - Avoid N+1 query problems
                  - Use prepared statements
                  - Monitor query performance
          
          - title: Redis Cache
            content: |
              #### Cache Strategy
              - Session storage
              - API response caching
              - Database query results
              - Rate limiting counters
              - Pub/sub for real-time updates
              
              #### Configuration
              - Memory: 8GB
              - Persistence: RDB + AOF
              - Replication: Master-slave
              - Cluster mode: Enabled
              - Eviction policy: allkeys-lru

  - title: Infrastructure
    content: |
      ## Cloud Infrastructure
      
      Our infrastructure is built on AWS with containerized services
      running on Kubernetes.
    
    children:
      - title: Container Orchestration
        content: |
          ### Kubernetes Setup
          - EKS cluster with 3 node groups
          - Horizontal Pod Autoscaling
          - Cluster Autoscaling
          - Network policies
          - Service mesh (Istio)
        
        children:
          - title: Deployment Strategy
            content: |
              #### Rolling Updates
              \`\`\`yaml
              apiVersion: apps/v1
              kind: Deployment
              metadata:
                name: user-service
              spec:
                replicas: 3
                strategy:
                  type: RollingUpdate
                  rollingUpdate:
                    maxSurge: 1
                    maxUnavailable: 0
                template:
                  spec:
                    containers:
                    - name: user-service
                      image: user-service:v1.2.0
                      resources:
                        requests:
                          memory: "256Mi"
                          cpu: "250m"
                        limits:
                          memory: "512Mi"
                          cpu: "500m"
              \`\`\`
          
          - title: Service Configuration
            content: |
              #### Service Mesh
              - Traffic management
              - Security policies
              - Observability
              - Circuit breaking
              - Retry policies
              
              #### Resource Management
              - CPU and memory limits
              - Quality of Service classes
              - Resource quotas
              - Limit ranges
      
      - title: Monitoring & Observability
        content: |
          ### Observability Stack
          - Metrics: Prometheus + Grafana
          - Logging: ELK Stack
          - Tracing: Jaeger
          - Alerting: AlertManager
          - Uptime: Pingdom
        
        children:
          - title: Metrics Collection
            content: |
              #### Prometheus Configuration
              - Service discovery
              - Recording rules
              - Alert rules
              - Federation
              - Long-term storage (Thanos)
              
              #### Key Metrics
              - Request rate, errors, duration
              - CPU and memory usage
              - Database performance
              - Queue depth
              - Business metrics
          
          - title: Log Management
            content: |
              #### ELK Stack Setup
              - Elasticsearch cluster (3 nodes)
              - Logstash for log processing
              - Kibana for visualization
              - Filebeat for log shipping
              - Index lifecycle management
              
              #### Log Formats
              - Structured logging (JSON)
              - Correlation IDs
              - Log levels (ERROR, WARN, INFO, DEBUG)
              - Security event logging
              - Audit trails

  - title: Security
    content: |
      ## Security Architecture
      
      Comprehensive security measures across all layers of the application.
    
    children:
      - title: Authentication & Authorization
        content: |
          ### Identity Management
          - OAuth 2.0 / OpenID Connect
          - Multi-factor authentication
          - Single Sign-On (SSO)
          - Role-based access control
          - Just-in-time provisioning
        
        children:
          - title: JWT Implementation
            content: |
              #### Token Structure
              \`\`\`json
              {
                "header": {
                  "typ": "JWT",
                  "alg": "RS256"
                },
                "payload": {
                  "sub": "user123",
                  "iat": 1642428000,
                  "exp": 1642431600,
                  "roles": ["user", "admin"],
                  "scope": "read write"
                }
              }
              \`\`\`
              
              #### Security Considerations
              - Short token expiration (1 hour)
              - Refresh token rotation
              - Token blacklisting
              - Secure storage
      
      - title: Network Security
        content: |
          ### Network Architecture
          - VPC with private subnets
          - WAF (Web Application Firewall)
          - DDoS protection
          - TLS 1.3 encryption
          - Certificate management
        
        children:
          - title: Firewall Rules
            content: |
              #### Security Groups
              - Principle of least privilege
              - Ingress rules for necessary ports only
              - Egress rules restricted
              - Regular rule auditing
              - Automated compliance checking
          
          - title: SSL/TLS Configuration
            content: |
              #### Certificate Management
              - Automated certificate provisioning
              - Certificate rotation
              - HSTS headers
              - Perfect Forward Secrecy
              - OCSP stapling

  - title: Development Process
    content: |
      ## Development Workflow
      
      Our development process emphasizes quality, security, and collaboration.
    
    children:
      - title: CI/CD Pipeline
        content: |
          ### Pipeline Stages
          1. Code commit
          2. Static analysis
          3. Unit tests
          4. Integration tests
          5. Security scanning
          6. Build Docker image
          7. Deploy to staging
          8. E2E tests
          9. Deploy to production
        
        children:
          - title: Quality Gates
            content: |
              #### Code Quality Checks
              - SonarQube analysis
              - Code coverage > 80%
              - Security vulnerability scanning
              - Dependency vulnerability checking
              - License compliance
              
              #### Test Requirements
              - Unit test coverage > 90%
              - Integration test coverage > 70%
              - E2E test suite passes
              - Performance tests pass
              - Security tests pass
          
          - title: Deployment Strategy
            content: |
              #### Blue-Green Deployment
              - Zero-downtime deployments
              - Instant rollback capability
              - Traffic switching
              - Health checks
              - Automated rollback on failure
              
              #### Feature Flags
              - Gradual feature rollout
              - A/B testing capability
              - Emergency feature disable
              - User-based targeting
              - Performance monitoring

performance_metrics:
  availability: "99.9%"
  response_time: "< 200ms p95"
  throughput: "10,000 req/sec"
  recovery_time: "< 5 minutes"
  data_durability: "99.999999999%"
`,
      
      'markdown-demo': `
title: Markdown Features Demonstration
content: |
  # Comprehensive Markdown Demo
  
  This document showcases all the Markdown features supported by TreeScribe.

children:
  - title: Text Formatting
    content: |
      ## Basic Text Formatting
      
      Learn how to format text in Markdown with various styling options.
    type: markdown
    children:
      - title: Bold and Italic
        content: |
          **Bold text** and __also bold text__
          
          *Italic text* and _also italic text_
          
          ***Bold and italic*** combined
        type: markdown
      - title: Other Formatting
        content: |
          ~~Strikethrough text~~
          
          \`Inline code\` formatting
          
          > This is a blockquote
          > It can span multiple lines
        type: markdown
    
  - title: Code Examples
    content: |
      ## Code Blocks
      
      TreeScribe supports syntax highlighting for multiple programming languages.
    type: markdown
    children:
      - title: JavaScript Example
        content: |
          ### JavaScript
          \`\`\`javascript
          const treeScribe = new TreeScribeInstance({
            dom: container,
            theme: 'dark',
            onMount: (instance) => {
              console.log('TreeScribe loaded!');
            }
          });
          
          await treeScribe.loadYaml(yamlContent);
          \`\`\`
        type: markdown
      - title: Python Example
        content: |
          ### Python
          \`\`\`python
          import yaml
          
          def load_document(file_path):
              with open(file_path, 'r') as file:
                  return yaml.safe_load(file)
          
          doc = load_document('example.yaml')
          print(f"Document title: {doc['title']}")
          \`\`\`
        type: markdown
      - title: Other Languages
        content: |
          ### CSS
          \`\`\`css
          .tree-scribe {
            font-family: system-ui;
            line-height: 1.6;
          }
          \`\`\`
          
          ### SQL
          \`\`\`sql
          SELECT * FROM documents
          WHERE content LIKE '%markdown%'
          ORDER BY created_at DESC;
          \`\`\`
        type: markdown
    
  - title: Lists and Tables
    content: |
      ## Lists
      
      ### Unordered List
      - First item
      - Second item
        - Nested item
        - Another nested item
      - Third item
      
      ### Ordered List
      1. First step
      2. Second step
         1. Sub-step
         2. Another sub-step
      3. Third step
      
      ### Task List
      - [x] Completed task
      - [ ] Incomplete task
      - [x] Another completed task
      
      ## Tables
      
      | Feature | Support | Notes |
      |---------|---------|-------|
      | Markdown | ✅ | Full support |
      | YAML | ✅ | Native format |
      | Search | ✅ | Full-text |
      | Export | ✅ | HTML, JSON |
    type: markdown
`,
      
      'data-showcase': `
title: Data Types Showcase
content: |
  # YAML Data Types Demonstration
  
  This document shows various YAML data types and structures.

children:
  - title: Primitive Types
    content:
      string_value: "Hello, World!"
      integer_value: 42
      float_value: 3.14159
      boolean_true: true
      boolean_false: false
      null_value: null
      date_value: 2024-01-17
    type: yaml
    
  - title: Collections
    content:
      # Array of strings
      colors:
        - red
        - green
        - blue
        - yellow
      
      # Array of objects
      users:
        - name: "Alice"
          age: 30
          active: true
        - name: "Bob"
          age: 25
          active: false
      
      # Nested object
      configuration:
        database:
          host: "localhost"
          port: 5432
          ssl: true
        cache:
          enabled: true
          ttl: 3600
    type: yaml
`,
      
      'accessibility-demo': `
title: Accessibility Features Demo
content: |
  # TreeScribe Accessibility
  
  This document demonstrates TreeScribe's accessibility features.
  
  **Keyboard Navigation:**
  - Use arrow keys to navigate
  - Press Enter to expand/collapse
  - Use Tab to move between sections
  - Press / to focus search

children:
  - title: Screen Reader Support
    content: |
      ## ARIA Implementation
      
      TreeScribe provides comprehensive screen reader support:
      
      - Proper ARIA roles and properties
      - Live region announcements
      - Descriptive labels
      - Focus management
    
  - title: Keyboard Navigation
    content: |
      ## Keyboard Shortcuts
      
      | Key | Action |
      |-----|--------|
      | ↑/↓ | Navigate nodes |
      | ←/→ | Collapse/expand |
      | Enter | Toggle node |
      | / | Focus search |
      | F3 | Next search result |
      | Home | First node |
      | End | Last node |
    
  - title: Visual Design
    content: |
      ## Accessibility Features
      
      - High contrast colors
      - Large touch targets (44px minimum)
      - Clear focus indicators
      - Scalable fonts
      - Reduced motion options
`,
      
      'json-demo': `{
  "title": "JSON Document Structure Demo",
  "description": "This document demonstrates how TreeScribe can parse and display JSON documents with hierarchical structure.",
  "metadata": {
    "format": "json",
    "version": "1.0.0",
    "created": "2024-01-17",
    "author": "TreeScribe Team"
  },
  "sections": [
    {
      "title": "Introduction to JSON",
      "content": "JSON (JavaScript Object Notation) is a lightweight data interchange format. It's easy for humans to read and write, and easy for machines to parse and generate.",
      "examples": [
        {
          "name": "Simple Object",
          "code": "{ \"name\": \"John\", \"age\": 30 }",
          "description": "A basic JSON object with string and number values"
        },
        {
          "name": "Array Example",
          "code": "[1, 2, 3, \"four\", true]",
          "description": "JSON array containing mixed data types"
        }
      ]
    },
    {
      "title": "Data Types",
      "content": "JSON supports several primitive data types and two structural types.",
      "primitives": {
        "string": "Text data enclosed in double quotes",
        "number": 42,
        "boolean": true,
        "null": null
      },
      "structural": {
        "object": "Key-value pairs enclosed in curly braces",
        "array": "Ordered list enclosed in square brackets"
      }
    },
    {
      "title": "Complex Example",
      "content": "Here's a more complex JSON structure showing nested objects and arrays.",
      "company": {
        "name": "Tech Corp",
        "founded": 2020,
        "employees": [
          {
            "id": 1,
            "name": "Alice Johnson",
            "position": "Senior Developer",
            "skills": ["JavaScript", "Python", "React"],
            "active": true
          },
          {
            "id": 2,
            "name": "Bob Smith",
            "position": "Product Manager",
            "skills": ["Strategy", "Analytics", "Leadership"],
            "active": true
          }
        ],
        "departments": {
          "engineering": {
            "head": "Alice Johnson",
            "budget": 500000,
            "projects": ["Web App", "Mobile App", "API Gateway"]
          },
          "product": {
            "head": "Bob Smith",
            "budget": 200000,
            "projects": ["Market Research", "User Studies"]
          }
        }
      }
    }
  ],
  "tips": [
    "Always validate JSON syntax before parsing",
    "Use proper indentation for readability",
    "Be careful with trailing commas (not allowed in JSON)",
    "String keys must be double-quoted",
    "Comments are not supported in pure JSON"
  ]
}`,
      
      'markdown-demo': `# Markdown Document Demo

This document demonstrates TreeScribe's ability to parse **Markdown** documents and extract their hierarchical structure based on headings.

## Features Overview

TreeScribe can parse various Markdown elements:

- Headers (H1-H6)
- **Bold** and *italic* text
- Lists (ordered and unordered)
- Code blocks and \`inline code\`
- [Links](https://example.com) and images
- Tables and blockquotes

## Code Examples

Here are some code examples in different languages:

### JavaScript

\`\`\`javascript
const treeScribe = new TreeScribeInstance({
  dom: container,
  theme: 'light',
  enableSearch: true
});

await treeScribe.load(markdownContent, { format: 'markdown' });
\`\`\`

### Python

\`\`\`python
import yaml

def process_document(content):
    """Process document content"""
    data = yaml.safe_load(content)
    return data.get('title', 'Untitled')
\`\`\`

## Lists and Tables

### Task List

- [x] Parse Markdown headers
- [x] Extract content between headers
- [x] Build hierarchical tree structure
- [ ] Add syntax highlighting
- [ ] Support for math equations

### Feature Comparison

| Feature | YAML | JSON | Markdown |
|---------|------|---------|----------|
| Hierarchy | ✅ Native | ✅ Nested | ✅ Headers |
| Comments | ✅ Yes | ❌ No | ✅ Yes |
| Readability | ✅ High | ⚠️ Medium | ✅ High |
| Validation | ⚠️ Loose | ✅ Strict | ⚠️ Loose |

## Advanced Features

### Blockquotes

> TreeScribe provides a universal interface for viewing hierarchical documents.
> It supports multiple formats while maintaining a consistent user experience.

### Nested Structure

This section demonstrates how Markdown headers create natural hierarchy:

#### Level 4 Header

Content under level 4 header.

##### Level 5 Header

Content under level 5 header.

###### Level 6 Header

Content under level 6 header (deepest level).

## Conclusion

Markdown parsing in TreeScribe enables you to:

1. **View** documents with natural hierarchy
2. **Navigate** through sections easily  
3. **Search** across all content
4. **Export** to other formats

The parser maintains the original Markdown formatting while extracting the structural hierarchy for tree navigation.`,
      
      'html-demo': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="TreeScribe HTML parsing demonstration">
    <title>HTML Document Structure Demo</title>
</head>
<body>
    <header>
        <h1>HTML Document Parsing</h1>
        <nav>
            <ul>
                <li><a href="#intro">Introduction</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#examples">Examples</a></li>
            </ul>
        </nav>
    </header>
    
    <main>
        <section id="intro">
            <h2>Introduction to HTML Parsing</h2>
            <p>TreeScribe can extract hierarchical structure from HTML documents by analyzing:</p>
            <ul>
                <li>Heading elements (H1-H6)</li>
                <li>Semantic HTML5 elements</li>
                <li>Document sections and articles</li>
                <li>Nested structures</li>
            </ul>
        </section>
        
        <section id="features">
            <h2>Key Features</h2>
            
            <article>
                <h3>Semantic Element Recognition</h3>
                <p>The parser understands HTML5 semantic elements like header, nav, main, section, article, aside, and footer.</p>
            </article>
            
            <article>
                <h3>Heading Hierarchy</h3>
                <p>Document structure is extracted based on heading levels, creating a natural outline.</p>
            </article>
            
            <article>
                <h3>Content Extraction</h3>
                <p>Text content is extracted while preserving structure and removing formatting tags.</p>
            </article>
        </section>
        
        <section id="examples">
            <h2>Usage Examples</h2>
            
            <div class="example">
                <h3>Basic HTML Structure</h3>
                <pre><code>&lt;article&gt;
    &lt;h1&gt;Title&lt;/h1&gt;
    &lt;p&gt;Content&lt;/p&gt;
&lt;/article&gt;</code></pre>
            </div>
            
            <div class="example">
                <h3>Nested Sections</h3>
                <pre><code>&lt;section&gt;
    &lt;h2&gt;Main Section&lt;/h2&gt;
    &lt;section&gt;
        &lt;h3&gt;Subsection&lt;/h3&gt;
    &lt;/section&gt;
&lt;/section&gt;</code></pre>
            </div>
        </section>
    </main>
    
    <aside>
        <h2>Related Information</h2>
        <p>HTML parsing is useful for:</p>
        <ul>
            <li>Documentation sites</li>
            <li>Content management systems</li>
            <li>Web scraping</li>
            <li>Accessibility tools</li>
        </ul>
    </aside>
    
    <footer>
        <p>&copy; 2024 TreeScribe Demo. All rights reserved.</p>
    </footer>
</body>
</html>`,
      
      'javascript-demo': `/**
 * TreeScribe JavaScript Parser Demo
 * Demonstrates parsing of JavaScript/TypeScript code structures
 */

import { Component } from './component.js';
import { Utils } from './utils.js';
import type { Config, Options } from './types';

// Configuration constants
const DEFAULT_CONFIG = {
  theme: 'light',
  autoSave: true,
  maxRetries: 3
};

/**
 * Main application class
 * Handles initialization and lifecycle
 */
export class Application {
  private config: Config;
  private components: Component[] = [];
  private initialized: boolean = false;
  
  constructor(options: Options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.initialize();
  }
  
  /**
   * Initialize the application
   * @returns {Promise<void>}
   */
  async initialize(): Promise<void> {
    try {
      await this.loadComponents();
      await this.setupEventHandlers();
      this.initialized = true;
      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Load all components
   * @private
   */
  private async loadComponents(): Promise<void> {
    const componentModules = await this.discoverComponents();
    
    for (const module of componentModules) {
      const component = new module.default(this.config);
      this.components.push(component);
    }
  }
  
  /**
   * Set up event handlers
   * @private
   */
  private setupEventHandlers(): void {
    window.addEventListener('resize', this.handleResize.bind(this));
    document.addEventListener('click', this.handleClick.bind(this));
  }
  
  // Event handlers
  private handleResize = (event: Event): void => {
    this.components.forEach(component => {
      component.onResize?.(event);
    });
  }
  
  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (target.matches('.component')) {
      this.handleComponentClick(target);
    }
  }
  
  // Public API
  public getComponent(name: string): Component | undefined {
    return this.components.find(c => c.name === name);
  }
  
  public addComponent(component: Component): void {
    this.components.push(component);
    component.mount(this.config);
  }
  
  public removeComponent(name: string): boolean {
    const index = this.components.findIndex(c => c.name === name);
    if (index !== -1) {
      this.components[index].unmount();
      this.components.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Utility functions
export function createApp(options?: Options): Application {
  return new Application(options);
}

export const utils = {
  formatDate: (date: Date): string => {
    return new Intl.DateTimeFormat('en-US').format(date);
  },
  
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): T => {
    let timeout: NodeJS.Timeout;
    return ((...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }) as T;
  }
};

// TypeScript interfaces
interface ComponentLifecycle {
  mount(config: Config): void;
  unmount(): void;
  onResize?(event: Event): void;
}

type ComponentState = 'idle' | 'loading' | 'ready' | 'error';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Default export
export default Application;`,
      
      'xml-demo': `<?xml version="1.0" encoding="UTF-8"?>
<library xmlns="http://example.com/library"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://example.com/library library.xsd"
         version="2.0">
    
    <metadata>
        <name>City Public Library</name>
        <description>Digital catalog of available books and resources</description>
        <lastUpdated>2024-01-17T10:30:00Z</lastUpdated>
        <totalItems>15420</totalItems>
    </metadata>
    
    <categories>
        <category id="fiction" name="Fiction">
            <subcategory id="sci-fi" name="Science Fiction"/>
            <subcategory id="fantasy" name="Fantasy"/>
            <subcategory id="mystery" name="Mystery"/>
        </category>
        
        <category id="non-fiction" name="Non-Fiction">
            <subcategory id="biography" name="Biography"/>
            <subcategory id="history" name="History"/>
            <subcategory id="science" name="Science"/>
        </category>
    </categories>
    
    <books>
        <book id="978-0-123-45678-9" category="sci-fi" available="true">
            <title>The Quantum Paradox</title>
            <author>
                <firstName>Jane</firstName>
                <lastName>Smith</lastName>
                <bio>Award-winning science fiction author</bio>
            </author>
            <publishedDate>2023-06-15</publishedDate>
            <pages>342</pages>
            <language>en</language>
            <rating>4.5</rating>
            <reviews count="127">
                <review>
                    <reviewer>John Doe</reviewer>
                    <date>2023-07-20</date>
                    <rating>5</rating>
                    <comment>Excellent blend of science and fiction!</comment>
                </review>
            </reviews>
        </book>
        
        <book id="978-0-987-65432-1" category="biography" available="false">
            <title>Life in Code</title>
            <author>
                <firstName>Alice</firstName>
                <lastName>Johnson</lastName>
            </author>
            <publishedDate>2022-11-30</publishedDate>
            <pages>428</pages>
            <language>en</language>
            <rating>4.8</rating>
            <reservation>
                <reservedBy>Mary Wilson</reservedBy>
                <reservationDate>2024-01-10</reservationDate>
                <expectedReturn>2024-02-10</expectedReturn>
            </reservation>
        </book>
    </books>
    
    <resources>
        <digitalResource type="ebook" format="pdf">
            <title>Introduction to XML</title>
            <url>https://library.example.com/resources/xml-intro.pdf</url>
            <fileSize unit="MB">2.5</fileSize>
        </digitalResource>
        
        <digitalResource type="audiobook" format="mp3">
            <title>The Art of Programming</title>
            <url>https://library.example.com/resources/programming-art.mp3</url>
            <duration>PT6H30M</duration>
            <narrator>David Brown</narrator>
        </digitalResource>
    </resources>
    
    <schedule>
        <hours dayOfWeek="Monday" open="09:00" close="21:00"/>
        <hours dayOfWeek="Tuesday" open="09:00" close="21:00"/>
        <hours dayOfWeek="Wednesday" open="09:00" close="21:00"/>
        <hours dayOfWeek="Thursday" open="09:00" close="21:00"/>
        <hours dayOfWeek="Friday" open="09:00" close="18:00"/>
        <hours dayOfWeek="Saturday" open="10:00" close="17:00"/>
        <hours dayOfWeek="Sunday" open="12:00" close="17:00"/>
    </schedule>
</library>`
    };
    
    return inlineDocuments[documentName] || inlineDocuments['simple-guide'];
  }
  
  _updateStats(nodeCount, loadTime) {
    this.container.querySelector('#nodeCount').textContent = nodeCount || '0';
    this.container.querySelector('#loadTime').textContent = `${loadTime || 0}ms`;
    
    // Update performance info
    const performanceInfo = this.container.querySelector('#performanceInfo');
    if (loadTime < 100) {
      performanceInfo.textContent = 'Performance: Excellent';
    } else if (loadTime < 500) {
      performanceInfo.textContent = 'Performance: Good';
    } else {
      performanceInfo.textContent = 'Performance: Fair';
    }
  }
  
  _updateSearchResults(count) {
    this.container.querySelector('#searchResults').textContent = count || '0';
  }
  
  _updateThemeStatus(theme) {
    this.container.querySelector('#currentTheme').textContent = theme;
  }
  
  _updateSupportedFormats() {
    if (this.treeScribe) {
      const formats = this.treeScribe.getSupportedFormats();
      const supportedFormatsEl = this.container.querySelector('#supportedFormats');
      if (supportedFormatsEl) {
        supportedFormatsEl.textContent = formats.join(', ');
      }
      this._log(`Supported formats: ${formats.join(', ')}`, 'info');
    }
  }
  
  _updateFormatDetection(detection) {
    const formatBadge = this.container.querySelector('#currentFormat');
    const formatDetails = this.container.querySelector('#formatDetails');
    
    if (detection && detection.format) {
      // Update format badge
      formatBadge.textContent = detection.format.toUpperCase();
      formatBadge.className = `format-badge ${detection.format}`;
      
      // Update format details
      const confidence = Math.round(detection.confidence * 100);
      let details = `Format: ${detection.format} (${confidence}% confidence)`;
      
      if (detection.source) {
        details += `\nSource: ${detection.source}`;
      }
      
      if (detection.alternatives && detection.alternatives.length > 0) {
        const alternatives = detection.alternatives
          .map(alt => `${alt.format} (${Math.round(alt.confidence * 100)}%)`)
          .join(', ');
        details += `\nAlternatives: ${alternatives}`;
      }
      
      formatDetails.textContent = details;
    } else {
      formatBadge.textContent = 'UNKNOWN';
      formatBadge.className = 'format-badge auto';
      formatDetails.textContent = 'Unable to detect format';
    }
  }
  
  _updateFormatInfo(format, parser) {
    const formatBadge = this.container.querySelector('#currentFormat');
    const formatDetails = this.container.querySelector('#formatDetails');
    
    if (format) {
      formatBadge.textContent = format.toUpperCase();
      formatBadge.className = `format-badge ${format}`;
      formatDetails.textContent = `Loaded as ${format} using ${parser || 'unknown parser'}`;
    }
  }
  
  _log(message, type = 'info') {
    const logEl = this.container.querySelector('#eventLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
    
    // Limit log entries to prevent memory issues
    const entries = logEl.querySelectorAll('.log-entry');
    if (entries.length > 100) {
      entries[0].remove();
    }
  }
  
  _downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // Public API
  getTreeScribe() {
    return this.treeScribe;
  }
  
  async _initializePluginManager() {
    try {
      // Import plugin manager dynamically
      const { ParserPluginManager } = await import('/src/components/tree-scribe/features/plugins/ParserPluginManager.js');
      this.pluginManager = new ParserPluginManager({
        sandbox: true,
        maxPlugins: 20,
        maxParseTime: 5000
      });
      
      this._log('Plugin manager initialized', 'info');
    } catch (error) {
      this._log(`Failed to initialize plugin manager: ${error.message}`, 'error');
    }
  }
  
  _setupPluginEvents() {
    // Plugin modal toggle
    this.container.querySelector('#pluginsBtn').addEventListener('click', () => {
      this._showPluginModal();
    });
    
    // Close modal
    this.container.querySelector('#closePluginModal').addEventListener('click', () => {
      this._hidePluginModal();
    });
    
    // Close modal on background click
    this.container.querySelector('#pluginModal').addEventListener('click', (e) => {
      if (e.target.id === 'pluginModal') {
        this._hidePluginModal();
      }
    });
    
    // Plugin tabs
    this.container.querySelectorAll('.plugin-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this._switchPluginTab(e.target.dataset.tab);
      });
    });
    
    // Example plugin loading
    this.container.querySelector('#loadCsvPlugin').addEventListener('click', () => {
      this._loadExamplePlugin('csv');
    });
    
    this.container.querySelector('#loadTomlPlugin').addEventListener('click', () => {
      this._loadExamplePlugin('toml');
    });
    
    // View plugin code
    this.container.querySelector('#viewCsvCode').addEventListener('click', () => {
      this._viewPluginCode('csv');
    });
    
    this.container.querySelector('#viewTomlCode').addEventListener('click', () => {
      this._viewPluginCode('toml');
    });
    
    // Plugin file loading
    this.container.querySelector('#selectPluginFile').addEventListener('click', () => {
      this.container.querySelector('#pluginFileInput').click();
    });
    
    this.container.querySelector('#pluginFileInput').addEventListener('change', (e) => {
      this._handlePluginFileSelect(e);
    });
    
    // Plugin URL loading
    this.container.querySelector('#loadPluginUrl').addEventListener('click', () => {
      this._loadPluginFromUrl();
    });
  }
  
  _showPluginModal() {
    const modal = this.container.querySelector('#pluginModal');
    modal.style.display = 'flex';
    this._refreshInstalledPlugins();
  }
  
  _hidePluginModal() {
    const modal = this.container.querySelector('#pluginModal');
    modal.style.display = 'none';
  }
  
  _switchPluginTab(tabName) {
    // Update tab buttons
    this.container.querySelectorAll('.plugin-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    this.container.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab panes
    this.container.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
      pane.style.display = 'none';
    });
    
    const targetPane = this.container.querySelector(`#${tabName}Tab`);
    targetPane.classList.add('active');
    targetPane.style.display = 'block';
    
    // Refresh content if needed
    if (tabName === 'installed') {
      this._refreshInstalledPlugins();
    }
  }
  
  async _loadExamplePlugin(type) {
    if (!this.pluginManager) {
      this._log('Plugin manager not available', 'error');
      return;
    }
    
    try {
      let pluginUrl;
      if (type === 'csv') {
        pluginUrl = '/src/components/tree-scribe/features/plugins/examples/csv-parser-plugin.js';
      } else if (type === 'toml') {
        pluginUrl = '/src/components/tree-scribe/features/plugins/examples/toml-parser-plugin.js';
      }
      
      this._log(`Loading ${type.toUpperCase()} parser plugin...`, 'info');
      
      // Import the plugin module
      const pluginModule = await import(pluginUrl);
      const plugin = pluginModule.default;
      
      // Register with plugin manager
      await this.pluginManager.register(type, plugin);
      
      // Register with TreeScribe
      if (this.treeScribe && this.treeScribe.registerPlugin) {
        this.treeScribe.registerPlugin(type, plugin);
      }
      
      this._log(`${plugin.metadata.name} loaded successfully`, 'success');
      this._refreshInstalledPlugins();
      this._updateFormatOptions();
      
    } catch (error) {
      this._log(`Failed to load ${type} plugin: ${error.message}`, 'error');
    }
  }
  
  _viewPluginCode(type) {
    let url;
    if (type === 'csv') {
      url = '/src/components/tree-scribe/features/plugins/examples/csv-parser-plugin.js';
    } else if (type === 'toml') {
      url = '/src/components/tree-scribe/features/plugins/examples/toml-parser-plugin.js';
    }
    
    window.open(url, '_blank');
  }
  
  async _handlePluginFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileInfo = this.container.querySelector('#pluginFileInfo');
    fileInfo.innerHTML = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    try {
      const content = await file.text();
      
      // Basic validation
      if (!content.includes('export default') || !content.includes('Parser')) {
        throw new Error('File does not appear to be a valid TreeScribe plugin');
      }
      
      // Create a blob URL and import
      const blob = new Blob([content], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      
      const pluginModule = await import(blobUrl);
      const plugin = pluginModule.default;
      const format = plugin.metadata.name.toLowerCase().replace('parser', '');
      
      await this.pluginManager.register(format, plugin);
      
      if (this.treeScribe && this.treeScribe.registerPlugin) {
        this.treeScribe.registerPlugin(format, plugin);
      }
      
      this._log(`Plugin "${plugin.metadata.name}" loaded from file`, 'success');
      this._refreshInstalledPlugins();
      this._updateFormatOptions();
      
      // Clean up
      URL.revokeObjectURL(blobUrl);
      
    } catch (error) {
      this._log(`Failed to load plugin from file: ${error.message}`, 'error');
      fileInfo.innerHTML = `Error: ${error.message}`;
    }
  }
  
  async _loadPluginFromUrl() {
    const urlInput = this.container.querySelector('#pluginUrlInput');
    const url = urlInput.value.trim();
    
    if (!url) {
      this._log('Please enter a plugin URL', 'error');
      return;
    }
    
    if (!url.startsWith('http://localhost')) {
      this._log('Only localhost URLs are allowed for security', 'error');
      return;
    }
    
    try {
      this._log(`Loading plugin from ${url}...`, 'info');
      
      const pluginModule = await this.pluginManager.loadFromUrl(url);
      const format = pluginModule.metadata.name.toLowerCase().replace('parser', '');
      
      await this.pluginManager.register(format, pluginModule);
      
      if (this.treeScribe && this.treeScribe.registerPlugin) {
        this.treeScribe.registerPlugin(format, pluginModule);
      }
      
      this._log(`Plugin "${pluginModule.metadata.name}" loaded from URL`, 'success');
      this._refreshInstalledPlugins();
      this._updateFormatOptions();
      urlInput.value = '';
      
    } catch (error) {
      this._log(`Failed to load plugin from URL: ${error.message}`, 'error');
    }
  }
  
  _refreshInstalledPlugins() {
    const pluginList = this.container.querySelector('#installedPlugins');
    
    if (!this.pluginManager) {
      pluginList.innerHTML = '<p class="empty-message">Plugin manager not available</p>';
      return;
    }
    
    const formats = this.pluginManager.getFormats();
    
    if (formats.length === 0) {
      pluginList.innerHTML = '<p class="empty-message">No plugins currently installed</p>';
      return;
    }
    
    pluginList.innerHTML = formats.map(format => {
      const metadata = this.pluginManager.getMetadata(format);
      const stats = this.pluginManager.getStatistics().plugins[format];
      
      return `
        <div class="plugin-item">
          <div class="plugin-item-info">
            <h5>${metadata.name} v${metadata.version}</h5>
            <p>${metadata.description}</p>
            <p><small>Format: ${format} | Uses: ${stats.metrics.uses} | Avg Time: ${Math.round(stats.averageParseTime)}ms</small></p>
          </div>
          <div class="plugin-item-actions">
            <button class="btn small secondary" onclick="treeScribeDemoInstance._unloadPlugin('${format}')">Unload</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  _unloadPlugin(format) {
    if (!this.pluginManager) return;
    
    try {
      this.pluginManager.unregister(format);
      
      if (this.treeScribe && this.treeScribe.unregisterPlugin) {
        this.treeScribe.unregisterPlugin(format);
      }
      
      this._log(`Plugin for format "${format}" unloaded`, 'info');
      this._refreshInstalledPlugins();
      this._updateFormatOptions();
      
    } catch (error) {
      this._log(`Failed to unload plugin: ${error.message}`, 'error');
    }
  }
  
  _updateFormatOptions() {
    const formatSelect = this.container.querySelector('#formatSelect');
    const currentValue = formatSelect.value;
    
    // Get base formats
    const baseOptions = [
      { value: 'auto', text: '🔍 Auto-detect' },
      { value: 'yaml', text: '📄 YAML' },
      { value: 'json', text: '{ } JSON' },
      { value: 'markdown', text: '📝 Markdown' },
      { value: 'html', text: '🌐 HTML' },
      { value: 'javascript', text: '📝 JavaScript' },
      { value: 'xml', text: '📃 XML' }
    ];
    
    // Add plugin formats
    if (this.pluginManager) {
      const pluginFormats = this.pluginManager.getFormats();
      for (const format of pluginFormats) {
        const metadata = this.pluginManager.getMetadata(format);
        baseOptions.push({
          value: format,
          text: `🔌 ${format.toUpperCase()} (Plugin)`
        });
      }
    }
    
    // Update select options
    formatSelect.innerHTML = baseOptions.map(option => 
      `<option value="${option.value}">${option.text}</option>`
    ).join('');
    
    // Restore previous selection if still valid
    if (baseOptions.some(option => option.value === currentValue)) {
      formatSelect.value = currentValue;
    }
  }
  
  destroy() {
    if (this._destroyed) return;
    
    if (this.treeScribe && this.treeScribe.destroy) {
      this.treeScribe.destroy();
    }
    
    if (this.pluginManager) {
      // Clean up plugins
      const formats = this.pluginManager.getFormats();
      formats.forEach(format => {
        this.pluginManager.unregister(format);
      });
    }
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Clean up global reference
    if (window.treeScribeDemoInstance === this) {
      delete window.treeScribeDemoInstance;
    }
    
    this._destroyed = true;
    
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy(this);
    }
  }
}