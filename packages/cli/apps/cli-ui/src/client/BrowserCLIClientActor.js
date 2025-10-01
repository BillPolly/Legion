/**
 * BrowserCLIClientActor
 *
 * Browser-compatible client actor for CLI module
 * Handles command execution via remote CLISessionActor through WebSocket
 */

export class BrowserCLIClientActor {
  constructor(config = {}) {
    // Reference to terminal for displaying output
    this.terminal = config.terminal;

    // WebSocket connection
    this.websocket = null;
    this.connected = false;

    // Unique client ID
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Server URL
    this.serverUrl = config.serverUrl || 'ws://localhost:4000/ws?route=/cli';

    // Session info
    this.sessionId = null;
    this.serverActorGuid = null; // Server actor GUID from handshake

    // Pending command callbacks
    this.pendingCommands = new Map(); // messageId -> { resolve, reject, timeout }
    this.messageIdCounter = 0;
  }

  /**
   * Initialize the actor and connect to server
   */
  async initialize() {
    try {
      await this.connectToServer();
      console.log('BrowserCLIClientActor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BrowserCLIClientActor:', error);
      throw error;
    }
  }

  /**
   * Connect to the CLI server via WebSocket
   */
  async connectToServer() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.serverUrl);

        this.websocket.onopen = () => {
          this.connected = true;
          console.log('Connected to CLI server');

          // Send actor handshake
          this.websocket.send(JSON.stringify({
            type: 'actor_handshake',
            clientRootActor: this.clientId,
            route: '/cli'
          }));

          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };

        this.websocket.onclose = () => {
          this.connected = false;
          console.log('Disconnected from CLI server');

          if (this.terminal) {
            this.terminal.writeLine('\n[Disconnected from server]', 'error');
          }
        };

        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages from server
   */
  handleMessage(message) {
    console.log('Received message:', message);

    // Handle handshake acknowledgment
    if (message.type === 'actor_handshake_ack') {
      this.serverActorGuid = message.serverRootActor;
      console.log(`Server actor connected: ${this.serverActorGuid}`);
      return;
    }

    // Handle Actor protocol messages
    if (message.targetGuid && message.payload) {
      // Check if payload is an array (Actor protocol message) or object (response)
      if (Array.isArray(message.payload)) {
        const [messageType, data] = message.payload;

        switch (messageType) {
          case 'session-ready':
            this.handleSessionReady(data);
            break;

          case 'display-asset':
            this.handleDisplayAsset(data);
            break;

          default:
            console.warn('Unknown message type:', messageType);
        }
      } else {
        // Direct response object (command response)
        if (message.targetGuid) {
          const pending = this.pendingCommands.get(message.targetGuid);
          if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve(message.payload);
            this.pendingCommands.delete(message.targetGuid);
          }
        }
      }
    }
  }

  /**
   * Handle session-ready message
   */
  handleSessionReady(data) {
    this.sessionId = data.sessionId;
    console.log(`Session ready: ${this.sessionId}`);

    if (this.terminal) {
      this.terminal.writeLine(`Connected to CLI server`, 'success');
      this.terminal.writeLine(`Session: ${this.sessionId}`, 'info');
      this.terminal.writeLine('');
    }
  }

  /**
   * Handle display-asset message
   */
  handleDisplayAsset(data) {
    console.log('Display asset:', data);

    const { asset, title, assetType } = data;

    // Extract content from asset
    let content, language, metadata;
    if (typeof asset === 'string') {
      content = asset;
    } else if (asset && asset.data) {
      content = asset.data;
      language = asset.language;
      metadata = asset.metadata || {};
    } else {
      console.error('Unknown asset format:', asset);
      return;
    }

    // Route to appropriate viewer
    switch (assetType) {
      case 'code':
        this.createCodeWindow(title || 'Code', content, language || 'javascript');
        break;

      case 'markup':
        this.createMarkupWindow(title || 'Preview', content, language || 'html');
        break;

      case 'style':
        this.createStyleWindow(title || 'CSS', content);
        break;

      case 'data':
        this.createJsonEditorWindow(title || 'JSON', content, metadata);
        break;

      case 'image':
        this.createFloatingWindow(title || 'Image', content);
        break;

      default:
        console.warn('Unknown asset type:', assetType);
        // Fallback to code window
        this.createCodeWindow(title || 'File', content, 'text');
    }
  }

  /**
   * Create floating window with code
   */
  createCodeWindow(title, codeData, language) {
    // Escape HTML in code
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Create window container
    const window = document.createElement('div');
    window.className = 'floating-window code-window';
    window.innerHTML = `
      <div class="window-header">
        <span class="window-title">${escapeHtml(title)}</span>
        <span class="code-language">${escapeHtml(language)}</span>
        <button class="window-close">&times;</button>
      </div>
      <div class="window-content code-content">
        <pre><code class="language-${escapeHtml(language)}">${escapeHtml(codeData)}</code></pre>
      </div>
    `;

    // Add to body
    document.body.appendChild(window);

    // Handle close button
    const closeBtn = window.querySelector('.window-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(window);
    });

    // Make draggable
    this.makeDraggable(window);

    // Apply syntax highlighting using simple regex-based highlighting
    const codeElement = window.querySelector('code');
    this.applySyntaxHighlighting(codeElement, language);
  }

  /**
   * Apply simple syntax highlighting
   */
  applySyntaxHighlighting(codeElement, language) {
    let html = codeElement.innerHTML;

    // Only highlight JavaScript for now (can be extended)
    if (language === 'javascript' || language === 'js') {
      // Keywords
      html = html.replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new)\b/g,
        '<span class="keyword">$1</span>');

      // Strings
      html = html.replace(/(&quot;[^&]*&quot;|'[^']*')/g,
        '<span class="string">$1</span>');

      // Comments
      html = html.replace(/(\/\/.*$)/gm,
        '<span class="comment">$1</span>');
      html = html.replace(/(\/\*[\s\S]*?\*\/)/g,
        '<span class="comment">$1</span>');

      // Numbers
      html = html.replace(/\b(\d+)\b/g,
        '<span class="number">$1</span>');

      // Functions
      html = html.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
        '<span class="function">$1</span>(');
    }

    codeElement.innerHTML = html;
  }

  /**
   * Create floating window with image
   */
  createFloatingWindow(title, imageData) {
    // Create window container
    const window = document.createElement('div');
    window.className = 'floating-window';
    window.innerHTML = `
      <div class="window-header">
        <span class="window-title">${title}</span>
        <button class="window-close">&times;</button>
      </div>
      <div class="window-content">
        <img src="${imageData}" alt="${title}" />
      </div>
    `;

    // Add to body
    document.body.appendChild(window);

    // Handle close button
    const closeBtn = window.querySelector('.window-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(window);
    });

    // Make draggable
    this.makeDraggable(window);
  }

  /**
   * Create markup preview window (HTML/SVG)
   */
  createMarkupWindow(title, content, language) {
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    const window = document.createElement('div');
    window.className = 'floating-window markup-window';
    window.innerHTML = `
      <div class="window-header">
        <span class="window-title">${escapeHtml(title)}</span>
        <span class="markup-language">${escapeHtml(language.toUpperCase())}</span>
        <button class="view-toggle" data-view="preview">Preview</button>
        <button class="window-close">&times;</button>
      </div>
      <div class="window-content markup-content">
        <div class="preview-pane"></div>
        <div class="code-pane" style="display: none;">
          <pre><code class="language-${escapeHtml(language)}">${escapeHtml(content)}</code></pre>
        </div>
      </div>
    `;

    document.body.appendChild(window);

    // Render preview
    const previewPane = window.querySelector('.preview-pane');
    const codePane = window.querySelector('.code-pane');

    if (language === 'svg') {
      previewPane.innerHTML = content; // Render SVG directly
    } else if (language === 'html') {
      // Create iframe for HTML preview
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      previewPane.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(content);
      iframe.contentDocument.close();
    }

    // Apply syntax highlighting to code pane
    const codeElement = codePane.querySelector('code');
    this.applySyntaxHighlighting(codeElement, language);

    // Toggle between preview and code view
    const toggleBtn = window.querySelector('.view-toggle');
    let currentView = 'preview';
    toggleBtn.addEventListener('click', () => {
      if (currentView === 'preview') {
        previewPane.style.display = 'none';
        codePane.style.display = 'block';
        toggleBtn.textContent = 'Preview';
        toggleBtn.dataset.view = 'code';
        currentView = 'code';
      } else {
        previewPane.style.display = 'flex';
        codePane.style.display = 'none';
        toggleBtn.textContent = 'Code';
        toggleBtn.dataset.view = 'preview';
        currentView = 'preview';
      }
    });

    // Close button
    window.querySelector('.window-close').addEventListener('click', () => {
      document.body.removeChild(window);
    });

    this.makeDraggable(window);
  }

  /**
   * Create CSS style preview window
   */
  createStyleWindow(title, content) {
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    const window = document.createElement('div');
    window.className = 'floating-window style-window';
    window.innerHTML = `
      <div class="window-header">
        <span class="window-title">${escapeHtml(title)}</span>
        <span class="markup-language">CSS</span>
        <button class="view-toggle" data-view="preview">Preview</button>
        <button class="window-close">&times;</button>
      </div>
      <div class="window-content style-content">
        <div class="preview-pane">
          <div class="css-preview-demo">
            <h1>Heading 1</h1>
            <h2>Heading 2</h2>
            <p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
            <button>Button</button>
            <div class="box">Box Element</div>
          </div>
        </div>
        <div class="code-pane" style="display: none;">
          <pre><code class="language-css">${escapeHtml(content)}</code></pre>
        </div>
      </div>
    `;

    document.body.appendChild(window);

    // Apply CSS to preview
    const previewPane = window.querySelector('.preview-pane');
    const codePane = window.querySelector('.code-pane');
    const style = document.createElement('style');
    style.textContent = content;
    previewPane.appendChild(style);

    // Apply syntax highlighting to code pane
    const codeElement = codePane.querySelector('code');
    this.applySyntaxHighlighting(codeElement, 'css');

    // Toggle between preview and code view
    const toggleBtn = window.querySelector('.view-toggle');
    let currentView = 'preview';
    toggleBtn.addEventListener('click', () => {
      if (currentView === 'preview') {
        previewPane.style.display = 'none';
        codePane.style.display = 'block';
        toggleBtn.textContent = 'Preview';
        toggleBtn.dataset.view = 'code';
        currentView = 'code';
      } else {
        previewPane.style.display = 'block';
        codePane.style.display = 'none';
        toggleBtn.textContent = 'Code';
        toggleBtn.dataset.view = 'preview';
        currentView = 'preview';
      }
    });

    // Close button
    window.querySelector('.window-close').addEventListener('click', () => {
      document.body.removeChild(window);
    });

    this.makeDraggable(window);
  }

  /**
   * Make window draggable
   */
  makeDraggable(element) {
    const header = element.querySelector('.window-header');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  /**
   * Execute command on remote session
   */
  async executeCommand(command) {
    if (!this.connected) {
      throw new Error('Not connected to server');
    }

    if (!this.serverActorGuid) {
      throw new Error('Server actor not ready');
    }

    // Generate message ID
    const messageId = `msg-${++this.messageIdCounter}`;

    // Send via Actor protocol
    const message = {
      targetGuid: this.serverActorGuid,  // Route to server actor using GUID from handshake
      payload: ['execute-command', { command }],
      sourceGuid: messageId
    };

    this.websocket.send(JSON.stringify(message));

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(messageId);
        reject(new Error('Command timeout'));
      }, 30000); // 30 second timeout

      this.pendingCommands.set(messageId, { resolve, reject, timeout });
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.connected = false;
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get client information
   */
  getClientInfo() {
    return {
      clientId: this.clientId,
      connected: this.connected,
      sessionId: this.sessionId,
      serverUrl: this.serverUrl
    };
  }

  /**
   * Create JSON Editor Window
   */
  createJsonEditorWindow(title, jsonContent, metadata) {
    // Parse JSON
    let jsonData;
    try {
      jsonData = JSON.parse(jsonContent);
    } catch (error) {
      console.error('Invalid JSON:', error);
      return;
    }

    // Create window container
    const window = document.createElement('div');
    window.className = 'floating-window json-editor-window';

    // Create header
    const header = document.createElement('div');
    header.className = 'window-header';
    header.style.cursor = 'move';

    const titleElem = document.createElement('span');
    titleElem.textContent = title;
    titleElem.className = 'window-title';

    const badgeContainer = document.createElement('div');
    badgeContainer.className = 'header-controls';

    const jsonBadge = document.createElement('span');
    jsonBadge.className = 'language-badge';
    jsonBadge.textContent = 'JSON';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-button';
    saveBtn.textContent = 'SAVE';
    saveBtn.title = 'Save changes to file';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-button';
    closeBtn.textContent = '×';

    badgeContainer.appendChild(jsonBadge);
    badgeContainer.appendChild(saveBtn);
    badgeContainer.appendChild(closeBtn);

    header.appendChild(titleElem);
    header.appendChild(badgeContainer);

    // Create editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'json-editor-container';

    // Create textarea for editing
    const textarea = document.createElement('textarea');
    textarea.className = 'json-editor-textarea';
    textarea.value = JSON.stringify(jsonData, null, 2);
    textarea.spellcheck = false;

    // Create status bar
    const statusBar = document.createElement('div');
    statusBar.className = 'json-status-bar';
    statusBar.textContent = 'Ready';

    editorContainer.appendChild(textarea);
    editorContainer.appendChild(statusBar);

    window.appendChild(header);
    window.appendChild(editorContainer);

    // Add to document
    document.body.appendChild(window);

    // Store file path if available
    const filePath = metadata?.filePath;

    // Save button handler
    saveBtn.addEventListener('click', async () => {
      try {
        // Validate JSON
        const newContent = textarea.value;
        JSON.parse(newContent); // Throws if invalid

        if (!filePath) {
          statusBar.textContent = '❌ No file path available';
          statusBar.style.color = '#ff6b6b';
          return;
        }

        // Send save command to server
        statusBar.textContent = '💾 Saving...';
        statusBar.style.color = '#4ecdc4';

        const response = await fetch('/api/save-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filePath,
            content: newContent
          })
        });

        if (response.ok) {
          statusBar.textContent = '✅ Saved successfully';
          statusBar.style.color = '#51cf66';
          setTimeout(() => {
            statusBar.textContent = 'Ready';
            statusBar.style.color = '';
          }, 3000);
        } else {
          throw new Error('Save failed');
        }
      } catch (error) {
        statusBar.textContent = `❌ ${error.message}`;
        statusBar.style.color = '#ff6b6b';
      }
    });

    // Close button handler
    closeBtn.addEventListener('click', () => {
      window.remove();
    });

    // Make window draggable
    this.makeDraggable(window, header);

    // Auto-validate JSON on edit
    textarea.addEventListener('input', () => {
      try {
        JSON.parse(textarea.value);
        statusBar.textContent = 'Valid JSON';
        statusBar.style.color = '#51cf66';
        saveBtn.disabled = false;
      } catch (error) {
        statusBar.textContent = `❌ ${error.message}`;
        statusBar.style.color = '#ff6b6b';
        saveBtn.disabled = true;
      }
    });
  }
}
