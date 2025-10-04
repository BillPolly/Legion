/**
 * AssetRenderer - Generic asset display router (v2 - MIME type normalization)
 *
 * Routes different asset types to appropriate umbilical protocol components:
 * - image -> ImageViewer
 * - code -> CodeEditor
 * - markup -> CodeEditor (HTML/SVG with syntax highlighting)
 * - style -> CodeEditor (CSS with syntax highlighting)
 * - table -> CodeEditor (JSON display for now)
 * - graph -> GraphEditor (Knowledge graph visualization)
 * - unknown -> CodeEditor (JSON display)
 */

export class AssetRenderer {
  constructor(container, assetData, options = {}) {
    this.container = container;
    this.assetData = assetData;
    this.options = options;
    this.viewer = null;
  }

  /**
   * Initialize and render the appropriate viewer
   */
  async initialize() {
    try {
      console.log('[AssetRenderer] initialize() - assetData keys:', Object.keys(this.assetData));

      // Determine asset type
      const assetType = this.determineAssetType();
      console.log('[AssetRenderer] Determined asset type:', assetType);

      // Create appropriate viewer
      this.viewer = await this.createViewer(assetType);
      console.log('[AssetRenderer] Viewer created:', this.viewer);

      return this.viewer;
    } catch (error) {
      console.error('[AssetRenderer] initialize() error:', error);
      throw error;
    }
  }

  /**
   * Determine asset type from assetData
   */
  determineAssetType() {
    const { assetType, handle } = this.assetData;

    // Use explicit assetType if provided
    if (assetType) {
      // Normalize MIME types to generic types
      if (assetType.startsWith('image/')) {
        return 'image';
      }
      if (assetType.startsWith('text/')) {
        return 'code';
      }
      return assetType;
    }

    // Infer from handle resourceType
    if (handle?.resourceType) {
      return handle.resourceType;
    }

    // Infer from handle type
    if (handle?.type?.startsWith('image/')) {
      return 'image';
    }

    // Default to generic
    return 'unknown';
  }

  /**
   * Extract image data from assetData structure
   */
  extractImageData() {
    // Try different paths where image data might be
    if (typeof this.assetData.assetData === 'string') {
      return this.assetData.assetData; // Direct string (data URL)
    }
    if (this.assetData.assetData?.data) {
      return this.assetData.assetData.data; // Nested in .data
    }
    if (this.assetData.assetData?.assetData) {
      return this.assetData.assetData.assetData; // Double nested
    }
    if (this.assetData.handle?.data) {
      return this.assetData.handle.data; // Handle data
    }
    // Check for Handle with imageData property
    if (this.assetData.asset?.imageData?.data) {
      return this.assetData.asset.imageData.data; // Handle.imageData.data
    }

    const errorMsg = 'No image data found in asset structure: ' + JSON.stringify(Object.keys(this.assetData));
    throw new Error(errorMsg);
  }

  /**
   * Extract code/text content from assetData structure
   */
  extractCodeContent() {
    // Try different paths where content might be
    if (this.assetData.handle?.content) {
      return {
        content: this.assetData.handle.content,
        language: this.assetData.handle.language || 'text',
        filePath: this.assetData.handle.filePath || '',
        lineCount: this.assetData.handle.lineCount
      };
    }
    if (this.assetData.assetData?.content) {
      return {
        content: this.assetData.assetData.content,
        language: this.assetData.assetData.language || 'text',
        filePath: this.assetData.assetData.filePath || '',
        lineCount: this.assetData.assetData.lineCount
      };
    }
    return {
      content: 'No content available',
      language: 'text',
      filePath: '',
      lineCount: 1
    };
  }

  /**
   * Extract graph data from assetData structure
   * Graph data should have nodes and edges arrays
   */
  extractGraphData() {
    // Try different paths where graph data might be
    if (this.assetData.handle?.nodes && this.assetData.handle?.edges) {
      return {
        nodes: this.assetData.handle.nodes,
        edges: this.assetData.handle.edges
      };
    }
    if (this.assetData.assetData?.nodes && this.assetData.assetData?.edges) {
      return {
        nodes: this.assetData.assetData.nodes,
        edges: this.assetData.assetData.edges
      };
    }
    if (this.assetData.graphData) {
      return this.assetData.graphData;
    }
    // Default empty graph
    return {
      nodes: [],
      edges: []
    };
  }

  /**
   * Create viewer instance for asset type using umbilical protocol
   */
  async createViewer(assetType) {
    switch (assetType) {
      case 'image': {
        const { ImageViewer } = await import('@legion/components');
        const imageData = this.extractImageData();

        return ImageViewer.create({
          dom: this.container,
          imageData: imageData,
          showControls: true,
          showInfo: true,
          onImageLoaded: (instance) => {
            console.log('[AssetRenderer] Image loaded successfully');
          },
          onError: (instance) => {
            console.error('[AssetRenderer] Image failed to load');
          }
        });
      }

      case 'code': {
        // Import CodeEditor directly - not exported from @legion/components due to CodeMirror dependency
        const { CodeEditor } = await import('@legion/components/src/components/code-editor/index.js');
        const codeData = this.extractCodeContent();

        return CodeEditor.create({
          dom: this.container,
          content: codeData.content,
          language: codeData.language,
          theme: 'dark',
          readOnly: false,
          lineNumbers: true,
          onContentChange: (content, instance) => {
            console.log('[AssetRenderer] Content changed');
          },
          onSaveRequest: async (content, instance) => {
            console.log('[AssetRenderer] Save requested:', codeData.filePath);
            // TODO: Implement save via Handle
          }
        });
      }

      case 'markup': {
        // HTML/SVG files - use CodeEditor with syntax highlighting
        const { CodeEditor } = await import('@legion/components/src/components/code-editor/index.js');
        const codeData = this.extractCodeContent();

        return CodeEditor.create({
          dom: this.container,
          content: codeData.content,
          language: 'html',
          theme: 'dark',
          readOnly: false,
          lineNumbers: true,
          onContentChange: (content, instance) => {
            console.log('[AssetRenderer] Markup content changed');
          }
        });
      }

      case 'style': {
        // CSS files - use CodeEditor with CSS highlighting
        const { CodeEditor } = await import('@legion/components/src/components/code-editor/index.js');
        const codeData = this.extractCodeContent();

        return CodeEditor.create({
          dom: this.container,
          content: codeData.content,
          language: 'css',
          theme: 'dark',
          readOnly: false,
          lineNumbers: true,
          onContentChange: (content, instance) => {
            console.log('[AssetRenderer] Style content changed');
          }
        });
      }

      case 'table': {
        // Table data - use CodeEditor with JSON highlighting for now
        const { CodeEditor } = await import('@legion/components/src/components/code-editor/index.js');
        const content = JSON.stringify(this.assetData, null, 2);

        return CodeEditor.create({
          dom: this.container,
          content: content,
          language: 'json',
          theme: 'dark',
          readOnly: true,
          lineNumbers: true
        });
      }

      case 'graph': {
        // Knowledge graph visualization
        const { GraphEditor } = await import('@legion/components');
        const graphData = this.extractGraphData();

        return GraphEditor.create({
          dom: this.container,
          graphData: graphData,
          editable: true,
          showControls: true,
          onModelChange: (changeType, data) => {
            console.log('[AssetRenderer] Graph model changed:', changeType, data);
            // TODO: Implement save via Handle
          },
          onNodeSelected: (nodeId, instance) => {
            console.log('[AssetRenderer] Node selected:', nodeId);
          },
          onEdgeSelected: (edgeId, instance) => {
            console.log('[AssetRenderer] Edge selected:', edgeId);
          }
        });
      }

      default: {
        // Unknown type - display as JSON
        const { CodeEditor } = await import('@legion/components/src/components/code-editor/index.js');
        const content = JSON.stringify(this.assetData, null, 2);

        return CodeEditor.create({
          dom: this.container,
          content: content,
          language: 'json',
          theme: 'dark',
          readOnly: true,
          lineNumbers: true
        });
      }
    }
  }

  /**
   * Get current viewer instance
   */
  getViewer() {
    return this.viewer;
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    if (this.viewer && typeof this.viewer.destroy === 'function') {
      this.viewer.destroy();
    }
    this.viewer = null;
  }
}
