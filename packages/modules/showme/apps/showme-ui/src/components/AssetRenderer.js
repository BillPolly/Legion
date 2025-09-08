/**
 * AssetRenderer
 * 
 * Renders different asset types using appropriate renderers
 * Dynamically imports renderers from the showme module
 */

export class AssetRenderer {
  constructor(config = {}) {
    this.config = config;
    this.renderers = new Map();
    this.renderersLoaded = false;
  }
  
  /**
   * Load available renderers
   */
  async loadRenderers() {
    if (this.renderersLoaded) return;
    
    try {
      // Import renderers from showme module
      const rendererModules = [
        { name: 'text', module: () => import('../../../src/renderers/TextRenderer.js') },
        { name: 'json', module: () => import('../../../src/renderers/JSONRenderer.js') },
        { name: 'table', module: () => import('../../../src/renderers/TableRenderer.js') },
        { name: 'chart', module: () => import('../../../src/renderers/ChartRenderer.js') },
        { name: 'image', module: () => import('../../../src/renderers/ImageRenderer.js') },
        { name: 'code', module: () => import('../../../src/renderers/CodeRenderer.js') },
        { name: 'html', module: () => import('../../../src/renderers/HTMLRenderer.js') },
        { name: 'error', module: () => import('../../../src/renderers/ErrorRenderer.js') }
      ];
      
      // Load each renderer
      for (const { name, module } of rendererModules) {
        try {
          const { default: RendererClass } = await module();
          const renderer = new RendererClass();
          this.renderers.set(name, renderer);
        } catch (error) {
          console.warn(`Failed to load ${name} renderer:`, error);
        }
      }
      
      this.renderersLoaded = true;
      console.log(`Loaded ${this.renderers.size} renderers`);
      
    } catch (error) {
      console.error('Failed to load renderers:', error);
    }
  }
  
  /**
   * Render asset based on type
   */
  render(asset, assetType) {
    // Ensure renderers are loaded
    if (!this.renderersLoaded) {
      this.loadRenderers();
    }
    
    // Create container
    const container = document.createElement('div');
    container.className = 'asset-renderer-container';
    container.style.cssText = 'width: 100%; height: 100%; overflow: auto;';
    
    try {
      // Get appropriate renderer
      const renderer = this.getRenderer(assetType);
      
      if (renderer) {
        // Use renderer to create content
        renderer.render(container, asset);
      } else {
        // Fallback rendering
        this.renderFallback(container, asset, assetType);
      }
      
    } catch (error) {
      console.error('Rendering error:', error);
      this.renderError(container, error, asset, assetType);
    }
    
    return container;
  }
  
  /**
   * Get renderer for asset type
   */
  getRenderer(assetType) {
    // Direct type match
    if (this.renderers.has(assetType)) {
      return this.renderers.get(assetType);
    }
    
    // Type mapping
    const typeMap = {
      'plaintext': 'text',
      'csv': 'table',
      'tsv': 'table',
      'javascript': 'code',
      'typescript': 'code',
      'python': 'code',
      'java': 'code',
      'css': 'code',
      'sql': 'code',
      'markdown': 'text',
      'xml': 'code',
      'yaml': 'code',
      'jsx': 'code',
      'tsx': 'code',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'svg': 'image',
      'webp': 'image'
    };
    
    const mappedType = typeMap[assetType];
    if (mappedType && this.renderers.has(mappedType)) {
      return this.renderers.get(mappedType);
    }
    
    // Check for partial matches
    if (assetType.includes('json')) return this.renderers.get('json');
    if (assetType.includes('table') || assetType.includes('csv')) return this.renderers.get('table');
    if (assetType.includes('chart') || assetType.includes('graph')) return this.renderers.get('chart');
    if (assetType.includes('image') || assetType.includes('img')) return this.renderers.get('image');
    if (assetType.includes('html')) return this.renderers.get('html');
    if (assetType.includes('error') || assetType.includes('exception')) return this.renderers.get('error');
    
    // Default to text for unknown types
    return this.renderers.get('text');
  }
  
  /**
   * Fallback rendering for unknown types
   */
  renderFallback(container, asset, assetType) {
    container.innerHTML = `
      <div style="padding: 20px;">
        <div style="
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        ">
          <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">
            Unknown Asset Type: ${assetType}
          </div>
          <div style="color: #78350f; font-size: 14px;">
            No specific renderer available for this asset type.
          </div>
        </div>
        <div style="
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 16px;
        ">
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
            Raw Content:
          </div>
          <pre style="
            margin: 0;
            font-family: monospace;
            font-size: 13px;
            color: #111827;
            white-space: pre-wrap;
            word-break: break-word;
          ">${this.escapeHtml(this.formatAsset(asset))}</pre>
        </div>
      </div>
    `;
  }
  
  /**
   * Render error state
   */
  renderError(container, error, asset, assetType) {
    container.innerHTML = `
      <div style="padding: 20px;">
        <div style="
          background: #fee2e2;
          border: 1px solid #ef4444;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        ">
          <div style="font-weight: 600; color: #991b1b; margin-bottom: 4px;">
            Rendering Error
          </div>
          <div style="color: #7f1d1d; font-size: 14px;">
            ${error.message}
          </div>
        </div>
        <details style="margin-top: 12px;">
          <summary style="
            cursor: pointer;
            color: #6b7280;
            font-size: 14px;
            padding: 8px;
            background: #f9fafb;
            border-radius: 4px;
          ">
            Debug Information
          </summary>
          <div style="
            margin-top: 8px;
            padding: 12px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
          ">
            <div style="margin-bottom: 8px;">
              <strong>Asset Type:</strong> ${assetType}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Asset:</strong>
              <pre style="
                margin: 4px 0 0 0;
                font-size: 12px;
                color: #4b5563;
                max-height: 200px;
                overflow: auto;
              ">${this.escapeHtml(this.formatAsset(asset))}</pre>
            </div>
            <div>
              <strong>Error Stack:</strong>
              <pre style="
                margin: 4px 0 0 0;
                font-size: 12px;
                color: #4b5563;
                max-height: 200px;
                overflow: auto;
              ">${error.stack}</pre>
            </div>
          </div>
        </details>
      </div>
    `;
  }
  
  /**
   * Format asset for display
   */
  formatAsset(asset) {
    if (asset === null) return 'null';
    if (asset === undefined) return 'undefined';
    
    if (typeof asset === 'string') {
      return asset;
    }
    
    if (typeof asset === 'object') {
      try {
        return JSON.stringify(asset, null, 2);
      } catch {
        return String(asset);
      }
    }
    
    return String(asset);
  }
  
  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Get available renderer types
   */
  getAvailableTypes() {
    return Array.from(this.renderers.keys());
  }
  
  /**
   * Check if renderer exists for type
   */
  hasRenderer(assetType) {
    return this.getRenderer(assetType) !== null;
  }
  
  /**
   * Register custom renderer
   */
  registerRenderer(type, renderer) {
    if (type && renderer && typeof renderer.render === 'function') {
      this.renderers.set(type, renderer);
    }
  }
  
  /**
   * Unregister renderer
   */
  unregisterRenderer(type) {
    this.renderers.delete(type);
  }
}