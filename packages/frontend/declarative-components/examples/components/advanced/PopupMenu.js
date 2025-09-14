/**
 * Popup Menu Example
 * Shows conditional rendering with interactive dropdown menus
 */

export const PopupMenuExample = {
  name: 'Popup Menu',
  description: 'Interactive dropdown menus with conditional rendering',
  category: 'advanced',
  
  dsl: `
PopupMenu :: data =>
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
              div.menu-item.submenu [
                span { "More Options ►" }
                div.submenu-items [
                  div.menu-item @click="selectAction" { "Format" }
                  div.menu-item @click="selectAction" { "Properties" }
                ]
              ]
            ]
          ]
        ]
      ]
      
      div.menu-group [
        h4 { "User Menu" }
        div.menu-container [
          button.user-menu-trigger @click="toggleUserMenu" [
            img.avatar { src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%234285f4'/%3E%3Ctext x='16' y='21' text-anchor='middle' fill='white' font-family='Arial' font-size='14'%3EU%3C/text%3E%3C/svg%3E" }
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
  },
  
  actions: {
    toggleSimpleMenu() {
      this.set('simpleMenuOpen', !this.get('simpleMenuOpen'));
      this.set('contextMenuOpen', false);
      this.set('userMenuOpen', false);
    },
    
    toggleContextMenu() {
      this.set('contextMenuOpen', !this.get('contextMenuOpen'));
      this.set('simpleMenuOpen', false);
      this.set('userMenuOpen', false);
    },
    
    toggleUserMenu() {
      this.set('userMenuOpen', !this.get('userMenuOpen'));
      this.set('simpleMenuOpen', false);
      this.set('contextMenuOpen', false);
    },
    
    selectAction(event) {
      const actionName = event.target.textContent.trim();
      const history = this.get('actionHistory');
      const newAction = {
        name: actionName,
        time: new Date().toLocaleTimeString()
      };
      
      this.set('actionHistory', [newAction, ...history.slice(0, 9)]); // Keep last 10
      
      // Close all menus
      this.set('simpleMenuOpen', false);
      this.set('contextMenuOpen', false);
      this.set('userMenuOpen', false);
    }
  },
  
  styles: `
    .popup-demo {
      max-width: 900px;
      margin: 20px auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .demo-header {
      text-align: center;
      margin-bottom: 40px;
    }
    
    .demo-header h3 {
      color: #2c3e50;
      margin-bottom: 10px;
    }
    
    .demo-header p {
      color: #6c757d;
      margin: 0;
    }
    
    .menu-examples {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 30px;
      margin-bottom: 40px;
    }
    
    .menu-group h4 {
      margin-bottom: 15px;
      color: #495057;
    }
    
    .menu-container {
      position: relative;
      display: inline-block;
    }
    
    .menu-trigger, .user-menu-trigger {
      padding: 12px 20px;
      border: 1px solid #ddd;
      background: #f8f9fa;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .menu-trigger:hover, .user-menu-trigger:hover {
      background: #e9ecef;
      border-color: #adb5bd;
    }
    
    .avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
    }
    
    .menu-arrow {
      margin-left: auto;
      font-size: 12px;
    }
    
    .popup-menu {
      position: absolute;
      top: 100%;
      left: 0;
      min-width: 200px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      margin-top: 4px;
      overflow: hidden;
    }
    
    .popup-menu.context {
      min-width: 180px;
    }
    
    .popup-menu.user-menu {
      min-width: 240px;
    }
    
    .menu-header {
      padding: 12px 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
    }
    
    .user-name {
      display: block;
      font-weight: 600;
      color: #2c3e50;
    }
    
    .user-email {
      display: block;
      font-size: 12px;
      color: #6c757d;
      margin-top: 2px;
    }
    
    .menu-item {
      padding: 10px 16px;
      cursor: pointer;
      transition: background-color 0.2s;
      color: #495057;
    }
    
    .menu-item:hover {
      background: #f1f3f4;
    }
    
    .menu-item.danger {
      color: #dc3545;
    }
    
    .menu-item.danger:hover {
      background: #f8d7da;
    }
    
    .menu-separator {
      height: 1px;
      background: #dee2e6;
      margin: 4px 0;
    }
    
    .submenu {
      position: relative;
    }
    
    .submenu-items {
      position: absolute;
      left: 100%;
      top: 0;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 150px;
      display: none;
    }
    
    .submenu:hover .submenu-items {
      display: block;
    }
    
    .action-log {
      border-top: 2px solid #e1e5e9;
      padding-top: 20px;
    }
    
    .action-log h4 {
      margin-bottom: 15px;
      color: #495057;
    }
    
    .log-container {
      background: #f8f9fa;
      border-radius: 4px;
      padding: 15px;
      max-height: 200px;
      overflow-y: auto;
    }
    
    .log-entry {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #e9ecef;
    }
    
    .log-entry:last-child {
      border-bottom: none;
    }
    
    .timestamp {
      font-size: 12px;
      color: #6c757d;
    }
    
    .action {
      font-weight: 500;
      color: #495057;
    }
    
    .no-actions {
      text-align: center;
      color: #6c757d;
      font-style: italic;
      margin: 0;
    }
  `
};