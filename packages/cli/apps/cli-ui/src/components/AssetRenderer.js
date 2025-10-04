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
        // Use simple pre element for code display (avoid CodeMirror dependency)
        const codeData = this.extractCodeContent();
        const pre = document.createElement('pre');
        pre.style.cssText = `
          margin: 0;
          padding: 16px;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          overflow: auto;
          height: 100%;
          box-sizing: border-box;
        `;
        pre.textContent = codeData.content;
        this.container.appendChild(pre);

        return {
          destroy: () => {
            pre.remove();
          }
        };
      }

      case 'markup': {
        // HTML/SVG files - use simple pre element (avoid CodeMirror)
        const codeData = this.extractCodeContent();
        const pre = document.createElement('pre');
        pre.style.cssText = `
          margin: 0;
          padding: 16px;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          overflow: auto;
          height: 100%;
          box-sizing: border-box;
        `;
        pre.textContent = codeData.content;
        this.container.appendChild(pre);

        return {
          destroy: () => {
            pre.remove();
          }
        };
      }

      case 'style': {
        // CSS files - use simple pre element (avoid CodeMirror)
        const codeData = this.extractCodeContent();
        const pre = document.createElement('pre');
        pre.style.cssText = `
          margin: 0;
          padding: 16px;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          overflow: auto;
          height: 100%;
          box-sizing: border-box;
        `;
        pre.textContent = codeData.content;
        this.container.appendChild(pre);

        return {
          destroy: () => {
            pre.remove();
          }
        };
      }

      case 'table': {
        // Table data - use simple pre element for JSON (avoid CodeMirror)
        const content = JSON.stringify(this.assetData, null, 2);
        const pre = document.createElement('pre');
        pre.style.cssText = `
          margin: 0;
          padding: 16px;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          overflow: auto;
          height: 100%;
          box-sizing: border-box;
        `;
        pre.textContent = content;
        this.container.appendChild(pre);

        return {
          destroy: () => {
            pre.remove();
          }
        };
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

      case 'component': {
        // Declarative component DSL editor with live preview
        const dsl = this.assetData.componentDSL || this.assetData.assetData?.componentDSL || '';
        const componentCompiled = this.assetData.componentCompiled || this.assetData.assetData?.componentCompiled || null;
        const componentName = this.assetData.componentName || this.assetData.assetData?.componentName || 'Component';

        // Import dependencies dynamically (REMOVED @legion/components to avoid CodeMirror dependency)
        const imports = Promise.all([
          import('@legion/declarative-components'),
          import('@legion/data-store')
        ]);

        return imports.then(async ([declarativeModule, dataStoreModule]) => {
          const { ComponentLifecycle, CNLParser, DSLParser } = declarativeModule;
          const { DataStore } = dataStoreModule;

          // Create main container
          const editorContainer = document.createElement('div');
          editorContainer.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            position: relative;
          `;

          // Left pane: Editor with tabs
          const leftPane = document.createElement('div');
          leftPane.style.cssText = `
            width: 50%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #1e1e1e;
          `;

          // Tab bar
          const tabBar = document.createElement('div');
          tabBar.style.cssText = `
            display: flex;
            background: #252526;
            border-bottom: 1px solid #3a3a3a;
          `;

          const tabs = [
            { id: 'dsl', label: 'DSL' },
            { id: 'cnl', label: 'CNL' },
            { id: 'json', label: 'JSON' }
          ];

          let activeTab = 'dsl';
          const tabElements = {};

          tabs.forEach(tab => {
            const tabEl = document.createElement('button');
            tabEl.textContent = tab.label;
            tabEl.className = `tab-${tab.id}`;
            tabEl.style.cssText = `
              padding: 8px 16px;
              background: ${tab.id === activeTab ? '#1e1e1e' : 'transparent'};
              color: ${tab.id === activeTab ? '#ffffff' : '#8e8e8e'};
              border: none;
              border-bottom: 2px solid ${tab.id === activeTab ? '#007acc' : 'transparent'};
              cursor: pointer;
              font-size: 13px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            tabEl.addEventListener('click', () => switchTab(tab.id));
            tabElements[tab.id] = tabEl;
            tabBar.appendChild(tabEl);
          });

          leftPane.appendChild(tabBar);

          // Editor container
          const editorArea = document.createElement('div');
          editorArea.style.cssText = `
            flex: 1;
            position: relative;
          `;

          // DSL textarea
          const dslTextarea = document.createElement('textarea');
          dslTextarea.value = dsl;
          dslTextarea.className = 'component-dsl-editor';
          dslTextarea.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #1e1e1e;
            color: #d4d4d4;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            padding: 16px;
            border: none;
            resize: none;
            outline: none;
            box-sizing: border-box;
            display: block;
          `;

          // CNL textarea
          const cnlTextarea = document.createElement('textarea');
          cnlTextarea.value = '';
          cnlTextarea.className = 'component-cnl-editor';
          cnlTextarea.placeholder = 'Write CNL here... Example:\n\nDefine Counter with state:\n  With methods:\n    When increment is called:\n      Set state count to state count + 1\n  A container with class "counter" containing:\n    A heading showing the count\n    A button labeled "+" that calls increment on click';
          cnlTextarea.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #1e1e1e;
            color: #d4d4d4;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            padding: 16px;
            border: none;
            resize: none;
            outline: none;
            box-sizing: border-box;
            display: none;
          `;

          // JSON view (read-only)
          const jsonView = document.createElement('pre');
          jsonView.className = 'component-json-view';
          jsonView.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #1e1e1e;
            color: #d4d4d4;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            padding: 16px;
            margin: 0;
            overflow: auto;
            box-sizing: border-box;
            display: none;
          `;

          editorArea.appendChild(dslTextarea);
          editorArea.appendChild(cnlTextarea);
          editorArea.appendChild(jsonView);
          leftPane.appendChild(editorArea);

          // Create parser instances
          const cnlParser = new CNLParser();
          const dslParser = new DSLParser();

          // MODEL: The central JSON component definition
          let componentModel = null;

          // Initialize model from DSL
          try {
            const ast = dslParser.parse(dslTextarea.value);
            componentModel = ast;
          } catch (error) {
            console.error('[AssetRenderer] Initial DSL parse error:', error);
          }

          // Helper to compile DSL to JSON
          function dslToJSON(dslText) {
            try {
              const ast = dslParser.parse(dslText);
              return ast;
            } catch (error) {
              console.error('[AssetRenderer] DSL parse error:', error);
              return null;
            }
          }

          // Helper to compile CNL to JSON
          function cnlToJSON(cnlText) {
            try {
              const ast = cnlParser.parse(cnlText, { toJSON: true });
              return ast;
            } catch (error) {
              console.error('[AssetRenderer] CNL parse error:', error);
              return null;
            }
          }

          // Update the model and sync all views
          function updateModel(newModel) {
            if (!newModel) return;

            componentModel = newModel;

            // Update JSON view
            jsonView.textContent = JSON.stringify(componentModel, null, 2);

            // TODO: Convert model back to DSL/CNL for syncing
            // For now, we just update the JSON display
          }

          // Tab switching function
          function switchTab(tabId) {
            activeTab = tabId;

            // Update tab styles
            tabs.forEach(tab => {
              const tabEl = tabElements[tab.id];
              const isActive = tab.id === tabId;
              tabEl.style.background = isActive ? '#1e1e1e' : 'transparent';
              tabEl.style.color = isActive ? '#ffffff' : '#8e8e8e';
              tabEl.style.borderBottom = `2px solid ${isActive ? '#007acc' : 'transparent'}`;
            });

            // Update JSON view from current model when switching to JSON tab
            if (tabId === 'json' && componentModel) {
              jsonView.textContent = JSON.stringify(componentModel, null, 2);
            }

            // Show/hide editors
            dslTextarea.style.display = tabId === 'dsl' ? 'block' : 'none';
            cnlTextarea.style.display = tabId === 'cnl' ? 'block' : 'none';
            jsonView.style.display = tabId === 'json' ? 'block' : 'none';
          }

          // Make textarea accessible for later use
          const textarea = dslTextarea;

          // Right pane: Live preview
          const rightPane = document.createElement('div');
          rightPane.style.cssText = `
            width: 50%;
            height: 100%;
            background: #2d2d2d;
            padding: 16px;
            box-sizing: border-box;
            overflow: auto;
          `;

          const previewContainer = document.createElement('div');
          previewContainer.style.cssText = `
            width: 100%;
            height: 100%;
          `;
          rightPane.appendChild(previewContainer);

          // Add panes to container
          // Create simple inline divider (avoiding Divider component which pulls in CodeMirror)
          const divider = document.createElement('div');
          divider.style.cssText = `
            position: absolute;
            left: 50%;
            top: 0;
            bottom: 0;
            width: 4px;
            background: #3a3a3a;
            cursor: col-resize;
            z-index: 1000;
            transform: translateX(-50%);
          `;

          // Add divider drag functionality
          let isDragging = false;
          divider.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.preventDefault();
          });

          document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const containerRect = editorContainer.getBoundingClientRect();
            const position = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            const clampedPosition = Math.max(20, Math.min(80, position));

            leftPane.style.width = `${clampedPosition}%`;
            rightPane.style.width = `${100 - clampedPosition}%`;
            divider.style.left = `${clampedPosition}%`;
          });

          document.addEventListener('mouseup', () => {
            isDragging = false;
          });

          editorContainer.appendChild(leftPane);
          editorContainer.appendChild(rightPane);
          editorContainer.appendChild(divider);
          this.container.appendChild(editorContainer);

          // Setup live component preview
          const dataStore = new DataStore({
            ':state': {}
          });

          const lifecycle = new ComponentLifecycle(dataStore);
          let currentComponent = null;

          // Mount initial component
          const mountComponent = async () => {
            try {
              // Unmount existing component
              if (currentComponent) {
                await currentComponent.unmount();
                previewContainer.innerHTML = '';
              }

              // Get current DSL
              const currentDSL = textarea.value;

              // Mount new component
              currentComponent = await lifecycle.mount(
                currentDSL,
                previewContainer,
                { count: 0 } // Initial data
              );

              console.log('[AssetRenderer] Component mounted successfully');
            } catch (error) {
              console.error('[AssetRenderer] Component mount error:', error);
              previewContainer.innerHTML = `<div style="color: #ff6b6b; padding: 16px; font-family: monospace;">
                Error: ${error.message}
              </div>`;
            }
          };

          // Initial mount
          mountComponent();

          // Debounced recompile on DSL textarea input
          let dslDebounceTimer = null;
          dslTextarea.addEventListener('input', () => {
            clearTimeout(dslDebounceTimer);
            dslDebounceTimer = setTimeout(() => {
              console.log('[AssetRenderer] Component DSL changed, recompiling...');

              // Compile DSL to JSON and update model
              const json = dslToJSON(dslTextarea.value);
              if (json) {
                updateModel(json);
              }

              mountComponent();
            }, 500);
          });

          // Debounced recompile on CNL textarea input
          let cnlDebounceTimer = null;
          cnlTextarea.addEventListener('input', () => {
            clearTimeout(cnlDebounceTimer);
            cnlDebounceTimer = setTimeout(() => {
              console.log('[AssetRenderer] Component CNL changed, compiling to JSON...');

              // Try to compile CNL to JSON
              const json = cnlToJSON(cnlTextarea.value);
              if (json) {
                console.log('[AssetRenderer] CNL compiled successfully, updating model and mounting component...');

                // Update the model
                updateModel(json);

                // Mount component using the compiled JSON
                (async () => {
                  try {
                    if (currentComponent) {
                      await currentComponent.unmount();
                      previewContainer.innerHTML = '';
                    }

                    currentComponent = await lifecycle.mount(
                      json,
                      previewContainer,
                      { count: 0 }
                    );

                    console.log('[AssetRenderer] Component mounted from CNL successfully');
                  } catch (error) {
                    console.error('[AssetRenderer] Component mount from CNL error:', error);
                    previewContainer.innerHTML = `<div style="color: #ff6b6b; padding: 16px; font-family: monospace;">
                      Error: ${error.message}
                    </div>`;
                  }
                })();
              } else {
                console.error('[AssetRenderer] CNL compilation failed');
                previewContainer.innerHTML = `<div style="color: #ff6b6b; padding: 16px; font-family: monospace;">
                  Error: Failed to compile CNL - check console for details
                </div>`;
              }
            }, 500);
          });

          // Return viewer interface
          return {
            destroy: () => {
              clearTimeout(dslDebounceTimer);
              clearTimeout(cnlDebounceTimer);
              if (currentComponent) {
                currentComponent.unmount().catch(console.error);
              }
              editorContainer.remove();
            }
          };
        }).catch(error => {
          console.error('[AssetRenderer] Failed to load component editor dependencies:', error);
          this.container.innerHTML = `<div style="color: #ff6b6b; padding: 16px;">
            Failed to load component editor: ${error.message}
          </div>`;
          return { destroy: () => {} };
        });
      }

      default: {
        // Unknown type - use simple pre element for JSON (avoid CodeMirror)
        const content = JSON.stringify(this.assetData, null, 2);
        const pre = document.createElement('pre');
        pre.style.cssText = `
          margin: 0;
          padding: 16px;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          overflow: auto;
          height: 100%;
          box-sizing: border-box;
        `;
        pre.textContent = content;
        this.container.appendChild(pre);

        return {
          destroy: () => {
            pre.remove();
          }
        };
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
