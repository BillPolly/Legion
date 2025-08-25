/**
 * ClientTodoActor
 * Client-side actor handling UI updates and user interactions
 * Implements MVVM pattern for clean separation of concerns
 */

export default class ClientTodoActor {
  constructor() {
    this.remoteActor = null;
    this.todos = [];
    this.stats = { total: 0, completed: 0, active: 0 };
    this.ui = null;
    
    // Initialize UI after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeUI());
    } else {
      this.initializeUI();
    }
  }

  setRemoteActor(remoteActor) {
    // This is now handled in the server_actor_ready message
    // Keeping method for compatibility but it's not used in current flow
    this.remoteActor = remoteActor;
    console.log('[ClientTodoActor] Connected to server (via setRemoteActor)');
  }

  /**
   * Handle incoming messages from server
   */
  receive(messageType, data) {
    console.log(`[ClientTodoActor] Received: ${messageType}`, data);
    
    switch (messageType) {
      case 'todos_updated':
        this.updateTodos(data);
        break;
        
      case 'server_actor_ready':
        console.log('[ClientTodoActor] Server actor ready:', data);
        // Create remote reference to server actor using the provided ID
        if (data.serverActorId) {
          // Try to get the channel from the ActorSpace
          const actorSpace = window.__legionActorSpace;
          const channel = actorSpace && actorSpace._channel;
          
          if (channel) {
            console.log('[ClientTodoActor] Creating remote reference to server actor:', data.serverActorId);
            this.remoteActor = channel.makeRemote(data.serverActorId);
            console.log('[ClientTodoActor] Remote server actor connected!');
            // Request initial todos now that we're connected
            if (this.remoteActor) {
              this.remoteActor.receive('get_todos', {});
            }
          } else {
            console.log('[ClientTodoActor] Channel not available yet');
          }
        }
        break;
        
      default:
        console.log(`[ClientTodoActor] Unknown message type: ${messageType}`);
    }
  }

  /**
   * Update local todos and refresh UI
   */
  updateTodos(data) {
    this.todos = data.todos || [];
    this.stats = data.stats || { total: 0, completed: 0, active: 0 };
    this.renderUI();
  }

  /**
   * Initialize the UI
   */
  initializeUI() {
    const app = document.getElementById('app');
    if (!app) {
      console.error('[ClientTodoActor] App container not found');
      return;
    }
    
    // Create UI structure
    app.innerHTML = `
      <div class="todo-app">
        <header class="todo-header">
          <h1>📝 Legion Todo</h1>
          <p class="subtitle">Configuration-driven actor demo</p>
        </header>
        
        <div class="todo-input-container">
          <input 
            type="text" 
            id="todo-input" 
            class="todo-input" 
            placeholder="What needs to be done?"
            autocomplete="off"
          />
          <button id="add-btn" class="add-btn">Add</button>
        </div>
        
        <div class="todo-stats">
          <span id="stats-text" class="stats-text">0 todos</span>
          <button id="clear-completed-btn" class="clear-btn" style="display: none;">
            Clear completed
          </button>
        </div>
        
        <ul id="todo-list" class="todo-list"></ul>
        
        <div class="todo-footer">
          <small>Powered by Legion Actor Framework</small>
        </div>
      </div>
    `;
    
    // Load custom styles from server
    this.loadCustomStyles();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Store UI references
    this.ui = {
      input: document.getElementById('todo-input'),
      addBtn: document.getElementById('add-btn'),
      list: document.getElementById('todo-list'),
      stats: document.getElementById('stats-text'),
      clearBtn: document.getElementById('clear-completed-btn')
    };
    
    console.log('[ClientTodoActor] UI initialized');
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Add todo on button click
    document.getElementById('add-btn').addEventListener('click', () => {
      this.addTodo();
    });
    
    // Add todo on Enter key
    document.getElementById('todo-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addTodo();
      }
    });
    
    // Clear completed
    document.getElementById('clear-completed-btn').addEventListener('click', () => {
      this.clearCompleted();
    });
    
    // Delegate events for todo items
    document.getElementById('todo-list').addEventListener('click', (e) => {
      const todoItem = e.target.closest('.todo-item');
      if (!todoItem) return;
      
      const todoId = parseInt(todoItem.dataset.id);
      
      if (e.target.classList.contains('todo-checkbox')) {
        this.toggleTodo(todoId);
      } else if (e.target.classList.contains('delete-btn')) {
        this.deleteTodo(todoId);
      }
    });
  }

  /**
   * Add a new todo
   */
  addTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    
    if (text && this.remoteActor) {
      this.remoteActor.receive('add_todo', { text });
      input.value = '';
      input.focus();
    }
  }

  /**
   * Toggle todo completion
   */
  toggleTodo(id) {
    if (this.remoteActor) {
      this.remoteActor.receive('toggle_todo', { id });
    }
  }

  /**
   * Delete a todo
   */
  deleteTodo(id) {
    if (this.remoteActor) {
      this.remoteActor.receive('delete_todo', { id });
    }
  }

  /**
   * Clear completed todos
   */
  clearCompleted() {
    if (this.remoteActor) {
      this.remoteActor.receive('clear_completed', {});
    }
  }

  /**
   * Render the UI with current todos
   */
  renderUI() {
    if (!this.ui) return;
    
    // Update stats
    this.ui.stats.textContent = `${this.stats.active} active, ${this.stats.completed} completed`;
    
    // Show/hide clear button
    this.ui.clearBtn.style.display = this.stats.completed > 0 ? 'inline-block' : 'none';
    
    // Render todo list
    this.ui.list.innerHTML = this.todos.map(todo => `
      <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
        <input 
          type="checkbox" 
          class="todo-checkbox" 
          ${todo.completed ? 'checked' : ''}
        />
        <span class="todo-text">${this.escapeHtml(todo.text)}</span>
        <button class="delete-btn" title="Delete">×</button>
      </li>
    `).join('');
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Load custom styles from server resource provider
   */
  loadCustomStyles() {
    // Create link to server-provided CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = '/todos/styles.css'; // Served by TodoResourceProvider
    document.head.appendChild(link);
  }
}