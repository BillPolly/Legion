/**
 * ServerTodoActor
 * Server-side actor managing todo list state with file persistence
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TodoResourceProvider } from '../resources/TodoResourceProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the todos data file
const TODOS_FILE = path.join(__dirname, '../data/todos.json');
const DATA_DIR = path.join(__dirname, '../data');

// Shared state across all ServerTodoActor instances
const sharedState = {
  todos: [],
  nextId: 1,
  clients: new Set(),
  initialized: false,
  loading: false
};

// Load todos from file and notify clients when ready (Flux-style)
function loadTodos() {
  if (sharedState.loading || sharedState.initialized) {
    return; // Already loading or loaded
  }
  
  sharedState.loading = true;
  
  // Handle file I/O asynchronously but notify via message passing
  setImmediate(async () => {
    try {
      // Ensure data directory exists
      await fs.mkdir(DATA_DIR, { recursive: true });
      
      // Try to read existing todos
      const data = await fs.readFile(TODOS_FILE, 'utf-8');
      const savedData = JSON.parse(data);
      
      sharedState.todos = savedData.todos || [];
      sharedState.nextId = savedData.nextId || 1;
      
      console.log(`[ServerTodoActor] Loaded ${sharedState.todos.length} todos from file`);
      
    } catch (error) {
      // File doesn't exist or is invalid, start with empty state
      console.log('[ServerTodoActor] No existing todos file, starting with empty state');
      sharedState.todos = [];
      sharedState.nextId = 1;
    }
    
    // Update state synchronously (Flux pattern)
    sharedState.initialized = true;
    sharedState.loading = false;
    
    // Notify all waiting clients that data is ready
    sharedState.clients.forEach(client => {
      if (client.remoteActor) {
        client.sendTodos();
      }
    });
  });
}

// Save todos to file
async function saveTodos() {
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    const data = {
      todos: sharedState.todos,
      nextId: sharedState.nextId,
      lastSaved: new Date().toISOString()
    };
    
    await fs.writeFile(TODOS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[ServerTodoActor] Saved ${sharedState.todos.length} todos to file`);
  } catch (error) {
    console.error('[ServerTodoActor] Error saving todos:', error);
  }
}

export default class ServerTodoActor {
  /**
   * Create custom resource provider (Clean Architecture - Dependency Inversion)
   * Framework asks the server actor if it wants to customize resource serving
   */
  static createResourceProvider(defaultProvider) {
    return new TodoResourceProvider(defaultProvider);
  }

  constructor(services = {}) {
    this.remoteActor = null;
    this.services = services;
    // Use shared state instead of instance state
    this.state = sharedState;
    
    // Initialize todos from file on first actor creation (Flux pattern)
    if (!this.state.initialized && !this.state.loading) {
      loadTodos();
    }
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('[ServerTodoActor] Connected to client');
    
    // Add this client to the set of connected clients
    if (this.remoteActor) {
      this.state.clients.add(this);
    }
    
    // Send initial todos only if data is ready
    if (this.state.initialized) {
      this.sendTodos();
    }
    // If not ready, sendTodos() will be called when loading completes
  }
  
  /**
   * Clean up when actor is destroyed
   */
  destroy() {
    // Remove this client from the set
    this.state.clients.delete(this);
  }

  /**
   * Handle incoming messages from client
   */
  receive(messageType, data) {
    console.log(`[ServerTodoActor] Received: ${messageType}`, data);
    
    switch (messageType) {
      case 'add_todo':
        this.addTodo(data);
        break;
        
      case 'toggle_todo':
        this.toggleTodo(data);
        break;
        
      case 'delete_todo':
        this.deleteTodo(data);
        break;
        
      case 'clear_completed':
        this.clearCompleted();
        break;
        
      case 'get_todos':
        this.sendTodos();
        break;
        
      default:
        console.log(`[ServerTodoActor] Unknown message type: ${messageType}`);
    }
  }

  /**
   * Add a new todo
   */
  async addTodo(data) {
    if (!data || !data.text || data.text.trim() === '') {
      console.log('[ServerTodoActor] Invalid todo text');
      return;
    }
    
    const todo = {
      id: this.state.nextId++,
      text: data.text.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    
    this.state.todos.push(todo);
    console.log(`[ServerTodoActor] Added todo: ${todo.text}`);
    
    // Save to file
    await saveTodos();
    
    // Broadcast updated todos to all clients
    this.broadcastTodos();
  }

  /**
   * Toggle todo completion status
   */
  async toggleTodo(data) {
    const todo = this.state.todos.find(t => t.id === data.id);
    if (todo) {
      todo.completed = !todo.completed;
      console.log(`[ServerTodoActor] Toggled todo ${todo.id}: completed=${todo.completed}`);
      
      // Save to file
      await saveTodos();
      
      this.broadcastTodos();
    }
  }

  /**
   * Delete a todo
   */
  async deleteTodo(data) {
    const index = this.state.todos.findIndex(t => t.id === data.id);
    if (index !== -1) {
      const deleted = this.state.todos.splice(index, 1)[0];
      console.log(`[ServerTodoActor] Deleted todo ${deleted.id}: ${deleted.text}`);
      
      // Save to file
      await saveTodos();
      
      this.broadcastTodos();
    }
  }

  /**
   * Clear all completed todos
   */
  async clearCompleted() {
    const before = this.state.todos.length;
    this.state.todos = this.state.todos.filter(t => !t.completed);
    const removed = before - this.state.todos.length;
    console.log(`[ServerTodoActor] Cleared ${removed} completed todos`);
    
    // Save to file
    await saveTodos();
    
    this.broadcastTodos();
  }

  /**
   * Send current todos to this client
   */
  sendTodos() {
    if (this.remoteActor) {
      const stats = {
        total: this.state.todos.length,
        completed: this.state.todos.filter(t => t.completed).length,
        active: this.state.todos.filter(t => !t.completed).length
      };
      
      this.remoteActor.receive('todos_updated', {
        todos: this.state.todos,
        stats: stats
      });
      
      console.log(`[ServerTodoActor] Sent ${this.state.todos.length} todos to client`);
    }
  }
  
  /**
   * Broadcast todos to all connected clients
   */
  broadcastTodos() {
    const stats = {
      total: this.state.todos.length,
      completed: this.state.todos.filter(t => t.completed).length,
      active: this.state.todos.filter(t => !t.completed).length
    };
    
    const payload = {
      todos: this.state.todos,
      stats: stats
    };
    
    // Send to all connected clients
    for (const client of this.state.clients) {
      if (client.remoteActor) {
        client.remoteActor.receive('todos_updated', payload);
      }
    }
    
    console.log(`[ServerTodoActor] Broadcast ${this.state.todos.length} todos to ${this.state.clients.size} clients`);
  }
}