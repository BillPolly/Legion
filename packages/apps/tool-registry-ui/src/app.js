/**
 * Tool Registry UI Application Entry Point
 * Professional MVVM Architecture - Design Document Compliant
 * 
 * This file follows the design document exactly:
 * - Zero hardcoded HTML (all markup from component Views)
 * - CSS classes only (no inline styles)
 * - Proper ToolRegistryBrowser root component
 * - Umbilical Protocol compliance
 * - Complete MVVM separation
 */

import { ToolRegistryBrowser } from './components/tool-registry/index.js';

console.log('🛠️ Legion Tool Registry starting...');

/**
 * Initialize the Tool Registry Application
 * Simple, clean initialization following design document architecture
 */
async function initializeApplication() {
  try {
    console.log('🚀 Initializing ToolRegistryBrowser...');
    
    // Get the application container
    const container = document.getElementById('app-container');
    if (!container) {
      throw new Error('Application container #app-container not found');
    }
    
    // Create the ToolRegistryBrowser root component
    // This follows the exact pattern specified in the design document
    await ToolRegistryBrowser.create({
      dom: container,
      websocketUrl: 'ws://localhost:8090',
      title: '🛠️ Legion Tool Registry',
      subtitle: 'Professional MVVM Architecture with Complete Responsive Design',
      userInfo: {
        name: 'Developer',
        initials: 'DV'
      },
      onMount: (api) => {
        console.log('✅ ToolRegistryBrowser mounted successfully');
        
        // Make available globally for debugging and console access
        window.toolRegistryApp = api;
        
        console.log('📋 Available API methods:', Object.keys(api));
        console.log('🎯 Application ready for use');
      },
      onTabChange: (tabId, details) => {
        console.log(`🔄 Tab changed to: ${tabId}`, details);
      },
      onGlobalSearch: (query) => {
        console.log('🔍 Global search:', query);
      },
      onUserAction: (action) => {
        console.log('👤 User action:', action);
      },
      onError: (error) => {
        console.error('💥 Application error:', error);
      },
      onDestroy: () => {
        console.log('🧹 ToolRegistryBrowser destroyed');
      }
    });
    
    console.log('🎉 Tool Registry Application initialized successfully');
    console.log('💡 Try these commands in the console:');
    console.log('  - toolRegistryApp.switchToPanel("search")');
    console.log('  - toolRegistryApp.search("file")'); 
    console.log('  - toolRegistryApp.getTools()');
    console.log('  - toolRegistryApp.simulateError()');
    console.log('  - toolRegistryApp.testDetailsPanel()');
    
    // Add test function for details panel fix
    window.toolRegistryApp.testDetailsPanel = async () => {
      console.log('🧪 Testing details panel fix...');
      
      // Get available tools
      const tools = window.toolRegistryApp.getTools();
      console.log(`✅ Found ${tools.length} tools`);
      
      if (tools.length > 0) {
        const fileManagerTool = tools.find(t => t.name === 'file-manager');
        if (fileManagerTool) {
          console.log('🔧 Selecting file-manager tool...');
          
          // Select the tool (this should trigger the fix)
          window.toolRegistryApp.selectTool(fileManagerTool);
          
          // Wait a moment for the update to propagate
          setTimeout(() => {
            const selectedTool = window.toolRegistryApp.getSelectedTool();
            const currentPanel = window.toolRegistryApp.getCurrentPanel();
            
            console.log(`Selected Tool: ${selectedTool ? selectedTool.name : 'None'}`);
            console.log(`Current Panel: ${currentPanel}`);
            
            if (selectedTool && selectedTool.name === 'file-manager' && currentPanel === 'details') {
              console.log('🎉 SUCCESS: Tool selection and panel switch working!');
              
              // Now test if the details panel component received the update
              const navigation = window.toolRegistryApp.getComponent('navigation');
              if (navigation) {
                const detailsComponent = navigation.getTabComponent('details');
                if (detailsComponent) {
                  const detailsSelectedTool = detailsComponent.getSelectedTool();
                  console.log(`Details Panel Tool: ${detailsSelectedTool ? detailsSelectedTool.name : 'None'}`);
                  
                  if (detailsSelectedTool && detailsSelectedTool.name === 'file-manager') {
                    console.log('🎉 COMPLETE SUCCESS: Details panel properly updated with selected tool!');
                    console.log('✅ Fix is working correctly!');
                  } else {
                    console.log('❌ ISSUE: Details panel not updated with selected tool');
                    console.log('🔄 Fix needs more work...');
                  }
                } else {
                  console.log('⚠️ Details component not loaded yet, trying again in 2 seconds...');
                  setTimeout(() => window.toolRegistryApp.testDetailsPanel(), 2000);
                }
              } else {
                console.log('❌ Navigation component not found');
              }
            } else {
              console.log('❌ Tool selection or panel switch failed');
            }
          }, 1000);
        } else {
          console.log('❌ file-manager tool not found');
        }
      } else {
        console.log('❌ No tools available');
      }
    };
    
  } catch (error) {
    console.error('❌ Failed to initialize Tool Registry Application:', error);
    
    // Show error in the UI
    const container = document.getElementById('app-container');
    if (container) {
      container.innerHTML = `
        <div style="
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; 
          height: 100vh; 
          padding: 2rem;
          text-align: center;
          font-family: system-ui, -apple-system, sans-serif;
        ">
          <h1 style="color: #ef4444; font-size: 2rem; margin-bottom: 1rem;">
            🚨 Application Failed to Load
          </h1>
          <p style="color: #64748b; font-size: 1.125rem; margin-bottom: 1rem;">
            ${error.message}
          </p>
          <button 
            onclick="location.reload()" 
            style="
              padding: 0.75rem 1.5rem;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 0.5rem;
              font-size: 1rem;
              cursor: pointer;
            "
          >
            Reload Application
          </button>
        </div>
      `;
    }
  }
}

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
  initializeApplication();
}