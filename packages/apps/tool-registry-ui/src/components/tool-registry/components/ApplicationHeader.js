/**
 * ApplicationHeader Component - MVVM Implementation
 * Displays application title, subtitle, and global controls like search
 * Following the design document specification
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

class ApplicationHeaderModel {
  constructor(options = {}) {
    this.state = {
      title: options.title || 'Application',
      subtitle: options.subtitle || '',
      showSearch: options.showSearch !== false,
      searchQuery: '',
      userInfo: options.userInfo || null
    };
  }
  
  updateState(path, value) {
    const keys = path.split('.');
    let current = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
  
  getState(path = '') {
    if (!path) return this.state;
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }
}

class ApplicationHeaderView {
  constructor(container) {
    this.container = container;
    this.cssInjected = false;
  }
  
  generateCSS() {
    return `
      .app-header-container {
        padding: var(--spacing-sm) var(--spacing-lg);
        background: var(--surface-primary);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--spacing-md);
        min-height: clamp(3rem, 8vh, 4rem);
        box-sizing: border-box;
      }
      
      .header-main-content {
        flex: 1;
        min-width: clamp(20rem, 40vw, 30rem);
      }
      
      .app-title {
        font-size: var(--font-lg);
        font-weight: 700;
        margin: 0;
        color: var(--text-primary);
        line-height: 1.1;
      }
      
      .app-subtitle {
        font-size: var(--font-sm);
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.2;
      }
      
      .header-controls {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
        flex-shrink: 0;
      }
      
      .global-search-container {
        position: relative;
        min-width: clamp(15rem, 25vw, 20rem);
      }
      
      .global-search-input {
        width: 100%;
        padding: var(--spacing-sm) var(--spacing-md);
        padding-left: clamp(2.5rem, 6vw, 3rem);
        font-size: var(--font-sm);
        border: 0.125rem solid var(--border-subtle);
        border-radius: var(--radius-md);
        background: var(--surface-secondary);
        color: var(--text-primary);
        transition: all 0.2s ease;
      }
      
      .global-search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 0.1875rem rgba(59, 130, 246, 0.15);
        background: var(--surface-primary);
      }
      
      .global-search-input::placeholder {
        color: var(--text-tertiary);
      }
      
      .search-icon {
        position: absolute;
        left: var(--spacing-sm);
        top: 50%;
        transform: translateY(-50%);
        width: clamp(1rem, 2.5vw, 1.25rem);
        height: clamp(1rem, 2.5vw, 1.25rem);
        color: var(--text-tertiary);
        pointer-events: none;
      }
      
      .user-controls {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }
      
      .user-avatar {
        width: clamp(2rem, 5vw, 2.5rem);
        height: clamp(2rem, 5vw, 2.5rem);
        border-radius: 50%;
        background: var(--color-primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: var(--font-sm);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .user-avatar:hover {
        background: var(--color-primary-hover);
        transform: scale(1.05);
      }
      
      .notifications-button {
        padding: var(--spacing-sm);
        background: transparent;
        border: 0.125rem solid var(--border-subtle);
        border-radius: var(--radius-sm);
        cursor: pointer;
        color: var(--text-secondary);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .notifications-button:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background: rgba(59, 130, 246, 0.05);
      }
      
      @media (max-width: 48rem) {
        .app-header-container {
          flex-direction: column;
          align-items: stretch;
          text-align: center;
        }
        
        .header-controls {
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .global-search-container {
          min-width: 100%;
        }
      }
    `;
  }
  
  injectCSS() {
    if (this.cssInjected) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'app-header-styles';
    styleElement.textContent = this.generateCSS();
    document.head.appendChild(styleElement);
    this.cssInjected = true;
  }
  
  render(modelData) {
    this.injectCSS();
    
    this.container.innerHTML = '';
    this.container.className = 'app-header-container';
    
    // Main content (title and subtitle)
    const mainContent = this.createMainContent(modelData);
    this.container.appendChild(mainContent);
    
    // Controls (search and user)
    if (modelData.showSearch || modelData.userInfo) {
      const controls = this.createHeaderControls(modelData);
      this.container.appendChild(controls);
    }
    
    return this.container;
  }
  
  createMainContent(modelData) {
    const mainContent = document.createElement('div');
    mainContent.className = 'header-main-content';
    
    const title = document.createElement('h1');
    title.className = 'app-title';
    title.textContent = modelData.title;
    
    const subtitle = document.createElement('p');
    subtitle.className = 'app-subtitle';
    subtitle.textContent = modelData.subtitle;
    
    mainContent.appendChild(title);
    if (modelData.subtitle) {
      mainContent.appendChild(subtitle);
    }
    
    return mainContent;
  }
  
  createHeaderControls(modelData) {
    const controls = document.createElement('div');
    controls.className = 'header-controls';
    
    // Global search
    if (modelData.showSearch) {
      const searchContainer = this.createSearchControl(modelData);
      controls.appendChild(searchContainer);
    }
    
    // User controls
    if (modelData.userInfo) {
      const userControls = this.createUserControls(modelData);
      controls.appendChild(userControls);
    }
    
    return controls;
  }
  
  createSearchControl(modelData) {
    const container = document.createElement('div');
    container.className = 'global-search-container';
    
    const searchIcon = document.createElement('div');
    searchIcon.className = 'search-icon';
    searchIcon.innerHTML = '🔍';
    
    const input = document.createElement('input');
    input.className = 'global-search-input';
    input.type = 'text';
    input.placeholder = 'Search tools, modules, or documentation...';
    input.value = modelData.searchQuery || '';
    
    container.appendChild(searchIcon);
    container.appendChild(input);
    
    return container;
  }
  
  createUserControls(modelData) {
    const controls = document.createElement('div');
    controls.className = 'user-controls';
    
    // Notifications button
    const notificationsButton = document.createElement('button');
    notificationsButton.className = 'notifications-button';
    notificationsButton.innerHTML = '🔔';
    notificationsButton.title = 'Notifications';
    
    // User avatar
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = modelData.userInfo?.initials || '👤';
    avatar.title = modelData.userInfo?.name || 'User Account';
    
    controls.appendChild(notificationsButton);
    controls.appendChild(avatar);
    
    return controls;
  }
}

class ApplicationHeaderViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    this.eventListeners = [];
  }
  
  initialize() {
    this.render();
    this.setupEventListeners();
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(this.createPublicAPI());
    }
    
    return this.createPublicAPI();
  }
  
  render() {
    this.view.render(this.model.getState());
  }
  
  setupEventListeners() {
    const searchInput = this.view.container.querySelector('.global-search-input');
    if (searchInput) {
      const handleSearch = (event) => {
        const query = event.target.value;
        this.model.updateState('searchQuery', query);
        
        if (this.umbilical.onSearch) {
          this.umbilical.onSearch(query);
        }
      };
      
      searchInput.addEventListener('input', handleSearch);
      this.eventListeners.push(() => searchInput.removeEventListener('input', handleSearch));
    }
    
    const userAvatar = this.view.container.querySelector('.user-avatar');
    if (userAvatar) {
      const handleUserClick = () => {
        if (this.umbilical.onUserClick) {
          this.umbilical.onUserClick();
        }
      };
      
      userAvatar.addEventListener('click', handleUserClick);
      this.eventListeners.push(() => userAvatar.removeEventListener('click', handleUserClick));
    }
  }
  
  createPublicAPI() {
    return {
      updateTitle: (title) => {
        this.model.updateState('title', title);
        this.render();
      },
      updateSubtitle: (subtitle) => {
        this.model.updateState('subtitle', subtitle);
        this.render();
      },
      getSearchQuery: () => this.model.getState('searchQuery'),
      clearSearch: () => {
        this.model.updateState('searchQuery', '');
        this.render();
      },
      destroy: () => this.destroy()
    };
  }
  
  destroy() {
    this.eventListeners.forEach(cleanup => cleanup());
    this.view.container.innerHTML = '';
    
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
  }
}

export const ApplicationHeader = {
  create(umbilical) {
    // 1. Introspection Mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Container element');
      requirements.add('title', 'string', 'Application title (optional)', false);
      requirements.add('subtitle', 'string', 'Application subtitle (optional)', false);
      requirements.add('showSearch', 'boolean', 'Show global search (optional)', false);
      requirements.add('userInfo', 'object', 'User information object (optional)', false);
      requirements.add('onMount', 'function', 'Mount callback (optional)', false);
      requirements.add('onSearch', 'function', 'Search callback (optional)', false);
      requirements.add('onUserClick', 'function', 'User click callback (optional)', false);
      umbilical.describe(requirements);
      return;
    }
    
    // 2. Validation Mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE
      });
    }
    
    // 3. Instance Creation Mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ApplicationHeader');
    
    const model = new ApplicationHeaderModel(umbilical);
    const view = new ApplicationHeaderView(umbilical.dom);
    const viewModel = new ApplicationHeaderViewModel(model, view, umbilical);
    
    return viewModel.initialize();
  }
};