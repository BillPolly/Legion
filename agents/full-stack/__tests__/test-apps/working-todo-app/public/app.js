/**
 * Frontend JavaScript for Todo App
 * Clean implementation without intentional bugs
 */

const API_URL = 'http://localhost:3002/api';

// State
let currentUser = null;
let authToken = null;
let todos = [];

// ======================
// Authentication
// ======================

function setupAuthForms() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showLoginBtn = document.getElementById('show-login-btn');
  const showRegisterBtn = document.getElementById('show-register-btn');

  // Tab switching
  showLoginBtn.addEventListener('click', () => {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    showLoginBtn.classList.add('active');
    showRegisterBtn.classList.remove('active');
  });

  showRegisterBtn.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    showLoginBtn.classList.remove('active');
    showRegisterBtn.classList.add('active');
  });

  // Login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        errorEl.textContent = error.error || 'Login failed';
        errorEl.style.display = 'block';
        return;
      }

      const data = await response.json();
      handleAuthSuccess(data);
    } catch (error) {
      console.error('Login error:', error);
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.style.display = 'block';
    }
  });

  // Register form submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorEl = document.getElementById('register-error');
    errorEl.style.display = 'none';

    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      if (!response.ok) {
        const error = await response.json();
        errorEl.textContent = error.error || 'Registration failed';
        errorEl.style.display = 'block';
        return;
      }

      const data = await response.json();
      handleAuthSuccess(data);
    } catch (error) {
      console.error('Registration error:', error);
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.style.display = 'block';
    }
  });
}

function handleAuthSuccess(data) {
  currentUser = data.user;
  authToken = data.token;
  localStorage.setItem('authToken', authToken);
  localStorage.setItem('user', JSON.stringify(currentUser));

  console.log('Authentication successful');

  showPage('dashboard');
  displayUserName();
  loadTodos();
}

function displayUserName() {
  const userNameEl = document.getElementById('user-name');
  if (currentUser) {
    userNameEl.textContent = `Welcome, ${currentUser.name}!`;
  }
}

// ======================
// Todo Management
// ======================

async function loadTodos() {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error-message');
  const listEl = document.getElementById('todos-list');

  try {
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';

    const response = await fetch(`${API_URL}/todos`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load todos');
    }

    todos = await response.json();
    loadingEl.style.display = 'none';
    renderTodos();
  } catch (error) {
    console.error('Load todos error:', error);
    loadingEl.style.display = 'none';
    errorEl.textContent = 'Failed to load todos';
    errorEl.style.display = 'block';
  }
}

function setupAddTodo() {
  const input = document.getElementById('new-todo-input');
  const btn = document.getElementById('add-todo-btn');

  btn.addEventListener('click', async () => {
    await addTodo();
  });

  input.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      await addTodo();
    }
  });
}

async function addTodo() {
  const input = document.getElementById('new-todo-input');
  const title = input.value.trim();

  if (!title) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ title })
    });

    if (!response.ok) {
      throw new Error('Failed to add todo');
    }

    const newTodo = await response.json();
    todos.unshift(newTodo);  // Add to beginning

    input.value = '';  // Clear input
    renderTodos();
    console.log('Todo added:', newTodo);
  } catch (error) {
    console.error('Add todo error:', error);
    alert('Failed to add todo');
  }
}

function renderTodos() {
  const listEl = document.getElementById('todos-list');

  if (todos.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No todos yet. Add one above!</p>';
    return;
  }

  listEl.innerHTML = todos.map(todo => `
    <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
      <input
        type="checkbox"
        class="todo-checkbox"
        ${todo.completed ? 'checked' : ''}
        data-id="${todo.id}"
      >
      <span class="todo-title">${escapeHtml(todo.title)}</span>
      <button class="btn btn-danger btn-sm delete-btn" data-id="${todo.id}">Delete</button>
    </div>
  `).join('');

  // Add event listeners
  document.querySelectorAll('.todo-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleToggleTodo);
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', handleDeleteTodo);
  });
}

async function handleToggleTodo(e) {
  const id = parseInt(e.target.dataset.id);
  const todo = todos.find(t => t.id === id);

  if (!todo) return;

  try {
    const response = await fetch(`${API_URL}/todos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        completed: !todo.completed
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update todo');
    }

    const updated = await response.json();
    const index = todos.findIndex(t => t.id === id);
    todos[index] = updated;

    renderTodos();
  } catch (error) {
    console.error('Toggle todo error:', error);
    e.target.checked = !e.target.checked;  // Revert checkbox
    alert('Failed to update todo');
  }
}

async function handleDeleteTodo(e) {
  const id = parseInt(e.target.dataset.id);

  if (!confirm('Are you sure you want to delete this todo?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/todos/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete todo');
    }

    todos = todos.filter(t => t.id !== id);
    renderTodos();
    console.log('Todo deleted');
  } catch (error) {
    console.error('Delete todo error:', error);
    alert('Failed to delete todo');
  }
}

// ======================
// Utility Functions
// ======================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showPage(pageName) {
  document.querySelectorAll('.page').forEach(page => {
    page.style.display = 'none';
  });
  document.getElementById(`${pageName}-page`).style.display = 'block';
}

function setupLogout() {
  const btn = document.getElementById('logout-btn');
  btn.addEventListener('click', () => {
    currentUser = null;
    authToken = null;
    todos = [];
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    showPage('login');
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    console.log('Logged out');
  });
}

// ======================
// Initialization
// ======================

function init() {
  setupAuthForms();
  setupAddTodo();
  setupLogout();

  // Check for existing auth token
  const savedToken = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('user');

  if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = JSON.parse(savedUser);

    console.log('Restoring session for:', currentUser.email);

    showPage('dashboard');
    displayUserName();
    loadTodos();
  } else {
    showPage('login');
  }
}

// Start app
document.addEventListener('DOMContentLoaded', init);
