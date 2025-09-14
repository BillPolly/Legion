/**
 * Interactive Examples Application
 * Main JavaScript for the Declarative Components examples page
 */

import { 
  ComponentCompiler, 
  ComponentLifecycle,
  EquationSolver 
} from '/legion/declarative-components/index.js';

/**
 * Simple DataStore implementation for examples
 */
class DataStore {
  constructor(options = {}) {
    this.data = new Map();
    this.listeners = new Map();
    this.resourceManager = options.resourceManager;
  }

  async set(key, value) {
    const oldValue = this.data.get(key);
    this.data.set(key, value);
    
    // Notify listeners
    if (this.listeners.has(key)) {
      for (const listener of this.listeners.get(key)) {
        listener(value, oldValue);
      }
    }
  }

  get(key) {
    return this.data.get(key);
  }

  async clear() {
    this.data.clear();
    this.listeners.clear();
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
  }

  unsubscribe(key, callback) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).delete(callback);
    }
  }
}

class ExamplesApp {
  constructor() {
    this.currentExample = null;
    this.editor = null;
    this.compiler = new ComponentCompiler();
    this.dataStore = null;
    this.compiledComponent = null;
    this.previewContainer = document.getElementById('preview-container');
    this.errorDisplay = document.getElementById('error-display');
    this.compileStatus = document.getElementById('compile-status');
    this.compileMessage = document.getElementById('compile-message');
    this.elementCount = document.getElementById('element-count');
    
    // Available examples with DSL code and data
    this.examples = {
      basic: {
        UserCard: {
          title: 'User Card',
          description: 'A basic user profile card demonstrating data binding, conditional rendering, and event handling',
          dsl: `UserCard :: data =>
  div.user-card [
    div.card-header [
      h2 { data.name }
      span.status { data.status }
    ]
    div.card-body [
      p { "Email: " + data.email }
      p { "Role: " + data.role }
      p { "Member since: " + data.memberSince }
    ]
    div.card-actions [
      button.toggle @click="toggleStatus" { data.active ? "Deactivate" : "Activate" }
    ]
  ]`,
          data: {
            name: 'Alice Johnson',
            email: 'alice@example.com',
            role: 'Developer',
            status: 'Active',
            memberSince: '2023',
            active: true
          }
        },
        Counter: {
          title: 'Counter',
          description: 'Simple counter with increment/decrement buttons',
          dsl: `Counter :: data =>
  div.counter-app [
    h2 { "Counter: " + data.count }
    div.counter-actions [
      button.counter @click="decrement" { "- Decrease" }
      button.counter @click="increment" { "+ Increase" }
      button.counter @click="reset" { "Reset" }
    ]
    p { "Button clicked " + data.totalClicks + " times" }
  ]`,
          data: {
            count: 0,
            totalClicks: 0
          }
        },
        SimpleForm: {
          title: 'Simple Form',
          description: 'Basic form with input validation and submission',
          dsl: `SimpleForm :: data =>
  div.form-container [
    h2 { "Contact Form" }
    form @submit="handleSubmit" [
      div.field [
        label { "Name:" }
        input @bind="name" placeholder="Enter your name"
      ]
      div.field [
        label { "Email:" }
        input @bind="email" type="email" placeholder="Enter your email"
      ]
      div.field [
        label { "Message:" }
        textarea @bind="message" placeholder="Your message"
      ]
      div.actions [
        button.btn-primary type="submit" { "Submit" }
        button @click="clear" type="button" { "Clear" }
      ]
    ]
    if (data.submitted) [
      div.success { "Thank you, " + data.name + "! Your message has been sent." }
    ]
  ]`,
          data: {
            name: '',
            email: '',
            message: '',
            submitted: false
          }
        }
      },
      forms: {
        LoginForm: {
          title: 'Login Form',
          description: 'Login form with validation and error handling',
          dsl: `LoginForm :: data =>
  div.login-form [
    h2 { "Sign In" }
    if (data.error) [
      div.error { data.error }
    ]
    form @submit="login" [
      div.field [
        label { "Username:" }
        input @bind="username" placeholder="Username" required
      ]
      div.field [
        label { "Password:" }
        input @bind="password" type="password" placeholder="Password" required
      ]
      div.field [
        label.checkbox [
          input @bind="remember" type="checkbox"
          " Remember me"
        ]
      ]
      button.btn-primary type="submit" { data.loading ? "Signing in..." : "Sign In" }
    ]
  ]`,
          data: {
            username: '',
            password: '',
            remember: false,
            loading: false,
            error: null
          }
        },
        ContactForm: {
          title: 'Contact Form',
          description: 'Advanced contact form with multiple fields and validation',
          dsl: `ContactForm :: data =>
  div.contact-form [
    h2 { "Get in Touch" }
    form @submit="submitContact" [
      div.form-row [
        div.field [
          label { "First Name:" }
          input @bind="firstName" placeholder="First name" required
        ]
        div.field [
          label { "Last Name:" }
          input @bind="lastName" placeholder="Last name" required
        ]
      ]
      div.field [
        label { "Email:" }
        input @bind="email" type="email" placeholder="your@email.com" required
      ]
      div.field [
        label { "Subject:" }
        select @bind="subject" [
          option value="" { "Select a subject" }
          option value="general" { "General Inquiry" }
          option value="support" { "Technical Support" }
          option value="sales" { "Sales Question" }
        ]
      ]
      div.field [
        label { "Message:" }
        textarea @bind="message" rows="5" placeholder="Your message..." required
      ]
      button.btn-primary type="submit" { "Send Message" }
    ]
    if (data.sent) [
      div.success { "Message sent successfully!" }
    ]
  ]`,
          data: {
            firstName: '',
            lastName: '',
            email: '',
            subject: '',
            message: '',
            sent: false
          }
        }
      },
      lists: {
        DataGrid: {
          title: 'Data Grid',
          description: 'Interactive data grid with sorting and row actions',
          dsl: `DataGrid :: data =>
  div.data-grid [
    div.grid-header [
      h3 { "Employee Directory" }
      div.grid-controls [
        button.sort-btn @click="sortByName" { "Sort by Name" }
        button.sort-btn @click="sortBySalary" { "Sort by Salary" }
        button.add-btn @click="addEmployee" { "+ Add Employee" }
      ]
    ]
    
    div.grid-container [
      div.grid-header-row [
        div.grid-cell.header { "Name" }
        div.grid-cell.header { "Department" }
        div.grid-cell.header { "Salary" }
        div.grid-cell.header { "Actions" }
      ]
      
      for employee in data.employees [
        div.grid-row [
          div.grid-cell { employee.name }
          div.grid-cell { employee.department }
          div.grid-cell { "$" + employee.salary }
          div.grid-cell.actions [
            button.edit-btn @click="editEmployee" { "Edit" }
            button.delete-btn @click="deleteEmployee" { "Delete" }
          ]
        ]
      ]
    ]
    
    div.grid-footer [
      p { "Total employees: " + data.employees.length }
      p { "Selected: " + data.selectedCount }
    ]
  ]`,
          data: {
            employees: [
              { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 75000 },
              { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 65000 },
              { id: 3, name: 'Carol Davis', department: 'Engineering', salary: 80000 },
              { id: 4, name: 'Dave Wilson', department: 'Sales', salary: 55000 },
              { id: 5, name: 'Eva Brown', department: 'HR', salary: 60000 }
            ],
            selectedCount: 0
          }
        },
        TodoApp: {
          title: 'Todo App',
          description: 'Complete todo application with add, toggle, and filter functionality',
          dsl: `TodoApp :: data =>
  div.todo-app [
    h1 { "Todo List (" + data.todos.length + " items)" }
    div.todo-input [
      input @bind="newTodo" @keyup.enter="addTodo" placeholder="Add a new todo..."
      button @click="addTodo" { "Add" }
    ]
    div.todo-filters [
      button.filter @click="setFilter('all')" class={ data.filter === 'all' ? 'active' : '' } { "All" }
      button.filter @click="setFilter('active')" class={ data.filter === 'active' ? 'active' : '' } { "Active" }
      button.filter @click="setFilter('completed')" class={ data.filter === 'completed' ? 'active' : '' } { "Completed" }
    ]
    ul.todo-list [
      for todo in data.filteredTodos [
        li.todo-item class={ todo.completed ? 'completed' : '' } [
          input @click="toggleTodo(todo.id)" type="checkbox" checked={ todo.completed }
          span.todo-text { todo.text }
          button.delete @click="deleteTodo(todo.id)" { "×" }
        ]
      ]
    ]
    if (data.todos.length === 0) [
      p.empty { "No todos yet. Add one above!" }
    ]
  ]`,
          data: {
            newTodo: '',
            filter: 'all',
            todos: [
              { id: 1, text: 'Learn Declarative Components', completed: false },
              { id: 2, text: 'Build an example app', completed: true },
              { id: 3, text: 'Write documentation', completed: false }
            ],
            nextId: 4
          }
        },
        ShoppingCart: {
          title: 'Shopping Cart',
          description: 'Shopping cart with item management and total calculation',
          dsl: `ShoppingCart :: data =>
  div.shopping-cart [
    h2 { "Shopping Cart (" + data.items.length + " items)" }
    div.cart-items [
      if (data.items.length === 0) [
        p.empty { "Your cart is empty" }
      ]
      for item in data.items [
        div.cart-item [
          div.item-info [
            h4 { item.name }
            p { "$" + item.price + " each" }
          ]
          div.item-controls [
            button @click="decreaseQuantity(item.id)" { "-" }
            span.quantity { item.quantity }
            button @click="increaseQuantity(item.id)" { "+" }
            button.remove @click="removeItem(item.id)" { "Remove" }
          ]
          div.item-total { "$" + (item.price * item.quantity).toFixed(2) }
        ]
      ]
    ]
    if (data.items.length > 0) [
      div.cart-summary [
        div.total { "Total: $" + data.total.toFixed(2) }
        button.checkout { "Checkout" }
      ]
    ]
  ]`,
          data: {
            items: [
              { id: 1, name: 'Widget A', price: 19.99, quantity: 2 },
              { id: 2, name: 'Widget B', price: 29.99, quantity: 1 }
            ],
            total: 69.97
          }
        }
      },
      advanced: {
        PopupMenu: {
          title: 'Popup Menu',
          description: 'Interactive dropdown menus with conditional rendering',
          dsl: `PopupMenu :: data =>
  div.popup-demo [
    div.demo-header [
      h3 { "Popup Menu Demo" }
      p { "Click buttons to open different types of menus" }
    ]
    
    div.menu-examples [
      div.menu-group [
        h4 { "Simple Menu" }
        div.menu-container [
          button.menu-trigger @click="toggleSimpleMenu" { 
            "Actions " + (data.simpleMenuOpen ? "▲" : "▼")
          }
          
          if (data.simpleMenuOpen) [
            div.popup-menu [
              div.menu-item @click="selectAction" { "New File" }
              div.menu-item @click="selectAction" { "Open File" }
              div.menu-item @click="selectAction" { "Save File" }
              div.menu-separator
              div.menu-item @click="selectAction" { "Exit" }
            ]
          ]
        ]
      ]
      
      div.menu-group [
        h4 { "Context Menu" }
        div.menu-container [
          button.menu-trigger @click="toggleContextMenu" { 
            "Right-click Menu " + (data.contextMenuOpen ? "▲" : "▼")
          }
          
          if (data.contextMenuOpen) [
            div.popup-menu.context [
              div.menu-item @click="selectAction" { "Copy" }
              div.menu-item @click="selectAction" { "Paste" }
              div.menu-item @click="selectAction" { "Cut" }
              div.menu-separator
              div.menu-item @click="selectAction" { "Properties" }
            ]
          ]
        ]
      ]
      
      div.menu-group [
        h4 { "User Menu" }
        div.menu-container [
          button.user-menu-trigger @click="toggleUserMenu" [
            span { data.currentUser.name }
            span.menu-arrow { data.userMenuOpen ? "▲" : "▼" }
          ]
          
          if (data.userMenuOpen) [
            div.popup-menu.user-menu [
              div.menu-header [
                span.user-name { data.currentUser.name }
                span.user-email { data.currentUser.email }
              ]
              div.menu-separator
              div.menu-item @click="selectAction" { "Profile Settings" }
              div.menu-item @click="selectAction" { "Account Settings" }
              div.menu-item @click="selectAction" { "Privacy" }
              div.menu-separator
              div.menu-item.danger @click="selectAction" { "Sign Out" }
            ]
          ]
        ]
      ]
    ]
    
    div.action-log [
      h4 { "Action Log" }
      div.log-container [
        for action in data.actionHistory [
          div.log-entry [
            span.timestamp { action.time }
            span.action { action.name }
          ]
        ]
      ]
      if (data.actionHistory.length === 0) [
        p.no-actions { "No actions performed yet" }
      ]
    ]
  ]`,
          data: {
            simpleMenuOpen: false,
            contextMenuOpen: false,
            userMenuOpen: false,
            currentUser: {
              name: 'John Doe',
              email: 'john.doe@example.com'
            },
            actionHistory: []
          }
        },
        Dashboard: {
          title: 'Dashboard',
          description: 'Complex dashboard with multiple components and real-time updates',
          dsl: `Dashboard :: data =>
  div.dashboard [
    header.dashboard-header [
      h1 { "Analytics Dashboard" }
      div.date-range { "Last 30 days" }
    ]
    div.stats-grid [
      div.stat-card [
        div.stat-value { data.stats.users }
        div.stat-label { "Total Users" }
        div.stat-change class={ data.stats.userChange > 0 ? 'positive' : 'negative' } { 
          (data.stats.userChange > 0 ? '+' : '') + data.stats.userChange + '%'
        }
      ]
      div.stat-card [
        div.stat-value { "$" + data.stats.revenue }
        div.stat-label { "Revenue" }
        div.stat-change class={ data.stats.revenueChange > 0 ? 'positive' : 'negative' } { 
          (data.stats.revenueChange > 0 ? '+' : '') + data.stats.revenueChange + '%'
        }
      ]
      div.stat-card [
        div.stat-value { data.stats.orders }
        div.stat-label { "Orders" }
        div.stat-change class={ data.stats.orderChange > 0 ? 'positive' : 'negative' } { 
          (data.stats.orderChange > 0 ? '+' : '') + data.stats.orderChange + '%'
        }
      ]
    ]
    div.dashboard-content [
      div.recent-activity [
        h3 { "Recent Activity" }
        ul [
          for activity in data.recentActivity [
            li [
              span.activity-time { activity.time }
              span.activity-text { activity.text }
            ]
          ]
        ]
      ]
    ]
  ]`,
          data: {
            stats: {
              users: '12,345',
              userChange: 15.3,
              revenue: '89,765',
              revenueChange: -2.4,
              orders: '3,456',
              orderChange: 8.7
            },
            recentActivity: [
              { time: '2 min ago', text: 'New user registered' },
              { time: '5 min ago', text: 'Order #1234 completed' },
              { time: '12 min ago', text: 'Payment processed: $299.99' },
              { time: '1 hour ago', text: 'Server maintenance completed' }
            ]
          }
        }
      }
    };
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Initialize DataStore
      this.dataStore = new DataStore();

      // Skip Monaco editor initialization for now - causes errors
      console.log('Skipping Monaco editor initialization');

      // Set up event listeners
      this.setupEventListeners();

      // Load initial example
      await this.loadExample('basic', 'UserCard');

      console.log('Examples app initialized successfully');
    } catch (error) {
      console.error('Failed to initialize examples app:', error);
      this.showError('Failed to initialize application: ' + error.message);
    }
  }

  /**
   * Initialize Monaco Editor
   */
  async initializeEditor() {
    return new Promise((resolve, reject) => {
      require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } });
      require(['vs/editor/editor.main'], () => {
        try {
          // Register custom language for DSL
          monaco.languages.register({ id: 'declarative-dsl' });

          // Define syntax highlighting
          monaco.languages.setMonarchTokensProvider('declarative-dsl', {
            tokenizer: {
              root: [
                [/\b(if|for|in|class)\b/, 'keyword'],
                [/\b(data|div|span|h1|h2|h3|h4|h5|h6|p|button|input|form|ul|li|select|option|textarea|label)\b/, 'type'],
                [/@[a-zA-Z_]\w*/, 'annotation'],
                [/".*?"/, 'string'],
                [/'.*?'/, 'string'],
                [/\d+/, 'number'],
                [/::/, 'operator'],
                [/=>/, 'operator'],
                [/[{}[\]]/, 'bracket'],
                [/[()]/, 'bracket'],
              ]
            }
          });

          // Create editor
          this.editor = monaco.editor.create(document.getElementById('dsl-editor'), {
            value: '',
            language: 'declarative-dsl',
            theme: 'vs',
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            tabSize: 2
          });

          // Listen for changes
          this.editor.onDidChangeModelContent(() => {
            this.debounceCompile();
          });

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Example selection
    document.getElementById('examples-list').addEventListener('click', (e) => {
      const item = e.target.closest('.example-item');
      if (item) {
        const category = item.dataset.category;
        const name = item.dataset.name;
        this.loadExample(category, name);
      }
    });

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
      if (this.currentExample) {
        this.loadExample(this.currentExample.category, this.currentExample.name);
      }
    });

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.compileAndRender();
    });

    // Textarea change listener (fallback when Monaco is not available)
    const textarea = document.getElementById('dsl-editor-textarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        this.debounceCompile();
      });
    }
  }

  /**
   * Load an example
   */
  async loadExample(category, name) {
    try {
      const example = this.examples[category]?.[name];
      if (!example) {
        throw new Error(`Example ${category}/${name} not found`);
      }

      // Update current example
      this.currentExample = { category, name, ...example };

      // Update UI
      this.updateExampleSelection(category, name);
      document.getElementById('current-example-title').textContent = example.title;
      document.getElementById('current-example-description').textContent = example.description;

      // Update editor
      if (this.editor) {
        this.editor.setValue(example.dsl);
      } else {
        // Use simple textarea as fallback
        const textarea = document.getElementById('dsl-editor-textarea');
        if (textarea) {
          textarea.value = example.dsl;
        }
      }

      // Update data store
      await this.updateDataStore(example.data);

      // Compile and render
      await this.compileAndRender();

    } catch (error) {
      console.error('Failed to load example:', error);
      this.showError('Failed to load example: ' + error.message);
    }
  }

  /**
   * Update example selection in sidebar
   */
  updateExampleSelection(category, name) {
    // Remove active class from all items
    document.querySelectorAll('.example-item').forEach(item => {
      item.classList.remove('active');
    });

    // Add active class to selected item
    const selectedItem = document.querySelector(`[data-category="${category}"][data-name="${name}"]`);
    if (selectedItem) {
      selectedItem.classList.add('active');
    }
  }

  /**
   * Update data store with example data
   */
  async updateDataStore(data) {
    if (!this.dataStore) return;

    // Clear existing data
    await this.dataStore.clear();

    // Add new data
    for (const [key, value] of Object.entries(data)) {
      await this.dataStore.set(key, value);
    }

    // Add common event handlers
    await this.addEventHandlers();
  }

  /**
   * Add common event handlers to data store
   */
  async addEventHandlers() {
    if (!this.dataStore) return;

    // Counter handlers
    await this.dataStore.set('increment', () => {
      const current = this.dataStore.get('count') || 0;
      this.dataStore.set('count', current + 1);
      const total = this.dataStore.get('totalClicks') || 0;
      this.dataStore.set('totalClicks', total + 1);
    });

    await this.dataStore.set('decrement', () => {
      const current = this.dataStore.get('count') || 0;
      this.dataStore.set('count', Math.max(0, current - 1));
      const total = this.dataStore.get('totalClicks') || 0;
      this.dataStore.set('totalClicks', total + 1);
    });

    await this.dataStore.set('reset', () => {
      this.dataStore.set('count', 0);
    });

    // Todo handlers
    await this.dataStore.set('addTodo', () => {
      const newTodo = this.dataStore.get('newTodo');
      if (!newTodo?.trim()) return;
      
      const todos = this.dataStore.get('todos') || [];
      const nextId = this.dataStore.get('nextId') || 1;
      
      todos.push({
        id: nextId,
        text: newTodo.trim(),
        completed: false
      });
      
      this.dataStore.set('todos', todos);
      this.dataStore.set('nextId', nextId + 1);
      this.dataStore.set('newTodo', '');
      this.updateFilteredTodos();
    });

    await this.dataStore.set('toggleTodo', (id) => {
      const todos = this.dataStore.get('todos') || [];
      const todo = todos.find(t => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
        this.dataStore.set('todos', todos);
        this.updateFilteredTodos();
      }
    });

    await this.dataStore.set('deleteTodo', (id) => {
      const todos = this.dataStore.get('todos') || [];
      const filtered = todos.filter(t => t.id !== id);
      this.dataStore.set('todos', filtered);
      this.updateFilteredTodos();
    });

    await this.dataStore.set('setFilter', (filter) => {
      this.dataStore.set('filter', filter);
      this.updateFilteredTodos();
    });

    // Form handlers
    await this.dataStore.set('toggleStatus', () => {
      const active = this.dataStore.get('active');
      this.dataStore.set('active', !active);
      this.dataStore.set('status', !active ? 'Active' : 'Inactive');
    });

    await this.dataStore.set('handleSubmit', (e) => {
      e.preventDefault();
      this.dataStore.set('submitted', true);
    });

    await this.dataStore.set('clear', () => {
      this.dataStore.set('name', '');
      this.dataStore.set('email', '');
      this.dataStore.set('message', '');
      this.dataStore.set('submitted', false);
    });

    // Data Grid handlers
    await this.dataStore.set('sortByName', () => {
      const employees = this.dataStore.get('employees') || [];
      const sorted = [...employees].sort((a, b) => a.name.localeCompare(b.name));
      this.dataStore.set('employees', sorted);
    });

    await this.dataStore.set('sortBySalary', () => {
      const employees = this.dataStore.get('employees') || [];
      const sorted = [...employees].sort((a, b) => b.salary - a.salary);
      this.dataStore.set('employees', sorted);
    });

    await this.dataStore.set('addEmployee', () => {
      const employees = this.dataStore.get('employees') || [];
      const newEmployee = {
        id: Date.now(),
        name: 'New Employee',
        department: 'Unassigned',
        salary: 50000
      };
      this.dataStore.set('employees', [...employees, newEmployee]);
    });

    await this.dataStore.set('editEmployee', () => {
      alert('Edit functionality would open a form dialog');
    });

    await this.dataStore.set('deleteEmployee', () => {
      const employees = this.dataStore.get('employees') || [];
      if (employees.length > 0) {
        this.dataStore.set('employees', employees.slice(0, -1)); // Remove last for demo
      }
    });

    // Popup Menu handlers
    await this.dataStore.set('toggleSimpleMenu', () => {
      this.dataStore.set('simpleMenuOpen', !this.dataStore.get('simpleMenuOpen'));
      this.dataStore.set('contextMenuOpen', false);
      this.dataStore.set('userMenuOpen', false);
    });

    await this.dataStore.set('toggleContextMenu', () => {
      this.dataStore.set('contextMenuOpen', !this.dataStore.get('contextMenuOpen'));
      this.dataStore.set('simpleMenuOpen', false);
      this.dataStore.set('userMenuOpen', false);
    });

    await this.dataStore.set('toggleUserMenu', () => {
      this.dataStore.set('userMenuOpen', !this.dataStore.get('userMenuOpen'));
      this.dataStore.set('simpleMenuOpen', false);
      this.dataStore.set('contextMenuOpen', false);
    });

    await this.dataStore.set('selectAction', (event) => {
      const actionName = event.target.textContent.trim();
      const history = this.dataStore.get('actionHistory') || [];
      const newAction = {
        name: actionName,
        time: new Date().toLocaleTimeString()
      };
      
      this.dataStore.set('actionHistory', [newAction, ...history.slice(0, 9)]); // Keep last 10
      
      // Close all menus
      this.dataStore.set('simpleMenuOpen', false);
      this.dataStore.set('contextMenuOpen', false);
      this.dataStore.set('userMenuOpen', false);
    });
  }

  /**
   * Update filtered todos based on current filter
   */
  updateFilteredTodos() {
    const todos = this.dataStore.get('todos') || [];
    const filter = this.dataStore.get('filter') || 'all';
    
    let filtered;
    switch (filter) {
      case 'active':
        filtered = todos.filter(t => !t.completed);
        break;
      case 'completed':
        filtered = todos.filter(t => t.completed);
        break;
      default:
        filtered = todos;
    }
    
    this.dataStore.set('filteredTodos', filtered);
  }

  /**
   * Debounced compile function
   */
  debounceCompile() {
    clearTimeout(this.compileTimeout);
    this.compileTimeout = setTimeout(() => {
      this.compileAndRender();
    }, 500);
  }

  /**
   * Compile DSL and render component
   */
  async compileAndRender() {
    if (!this.dataStore) return;

    try {
      this.updateStatus('compiling', 'Compiling...');
      this.hideError();

      // Get DSL from editor or fallback to textarea
      let dsl;
      if (this.editor) {
        dsl = this.editor.getValue();
      } else {
        // Use simple textarea as fallback
        const textarea = document.getElementById('dsl-editor-textarea');
        if (textarea) {
          dsl = textarea.value;
        } else if (this.currentExample) {
          dsl = this.currentExample.dsl;
        } else {
          throw new Error('No DSL source available');
        }
      }
      
      console.log('Compiling DSL:', dsl ? `${dsl.substring(0, 100)}...` : 'EMPTY');
      
      // Compile DSL
      const result = this.compiler.compile(dsl);
      
      // Clear preview container
      this.previewContainer.innerHTML = '';
      this.previewContainer.classList.add('has-content');

      // Create component instance and mount
      if (this.compiledComponent) {
        this.compiledComponent.unmount();
      }

      this.compiledComponent = result;
      await this.compiledComponent.mount(this.previewContainer, this.dataStore);

      // Update status
      const elementCount = this.previewContainer.querySelectorAll('*').length;
      this.updateStatus('success', `Compiled successfully`);
      this.elementCount.textContent = `${elementCount} elements`;

    } catch (error) {
      console.error('Compilation error:', error);
      console.error('Error stack:', error.stack);
      this.updateStatus('error', 'Compilation failed');
      this.showError(error.message || error.toString());
      this.previewContainer.innerHTML = '<p>Compilation failed - check the error above</p>';
      this.previewContainer.classList.remove('has-content');
      this.elementCount.textContent = '0 elements';
    }
  }

  /**
   * Update compilation status
   */
  updateStatus(type, message) {
    this.compileStatus.className = `status-dot ${type}`;
    this.compileMessage.textContent = message;
  }

  /**
   * Show error message
   */
  showError(message) {
    this.errorDisplay.textContent = message;
    this.errorDisplay.style.display = 'block';
  }

  /**
   * Hide error message
   */
  hideError() {
    this.errorDisplay.style.display = 'none';
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new ExamplesApp();
  await app.initialize();
  
  // Make app globally available for debugging
  window.examplesApp = app;
});