import { UmbilicalUtils } from '../../components/src/umbilical/index.js';
import { Tabs } from '../../components/src/components/tabs/index.js';

/**
 * ToolRegistryApp - Main application component using MVVM architecture
 * Manages the overall layout and tab navigation for the tool registry
 */
export const ToolRegistryApp = {
    create(umbilical) {
        // 1. Introspection mode
        if (umbilical.describe) {
            const requirements = UmbilicalUtils.createRequirements();
            requirements.add('dom', 'HTMLElement', 'Parent DOM element');
            requirements.add('websocketUrl', 'string', 'WebSocket URL for storage connection (optional)', false);
            requirements.add('onTabChange', 'function', 'Tab change callback (optional)', false);
            umbilical.describe(requirements);
            return;
        }

        // 2. Validation mode
        if (umbilical.validate) {
            return umbilical.validate({
                hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
                hasValidWebSocket: !umbilical.websocketUrl || typeof umbilical.websocketUrl === 'string'
            });
        }

        // 3. Instance creation mode
        UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ToolRegistryApp');

        // MVVM Architecture: Model
        const model = {
            activeTabId: 'search',
            websocketUrl: umbilical.websocketUrl || 'ws://localhost:3700/storage',
            tabs: [
                { id: 'search', title: '🔍 Tool Search', icon: '🔍' },
                { id: 'modules', title: '📦 Modules', icon: '📦' },
                { id: 'browse', title: '📚 Browse Collections', icon: '📚' },
                { id: 'perspectives', title: '🧠 Perspectives', icon: '🧠' },
                { id: 'admin', title: '⚙️ Admin Control', icon: '⚙️' }
            ]
        };

        // MVVM Architecture: View
        const view = {
            render() {
                umbilical.dom.innerHTML = `
                    <div style="height: 100%; display: flex; flex-direction: column; gap: 1rem;">
                        <div id="app-header" style="background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex-shrink: 0;">
                            <h1 style="color: #333; margin: 0 0 0.5rem 0; font-size: clamp(1.5rem, 4vw, 2rem);">🛠️ Legion Tool Registry</h1>
                            <p style="color: #666; margin: 0;">Browse and search for tools with MVVM component architecture</p>
                        </div>
                        <div id="main-tabs-container" style="flex: 1; min-height: 0;"></div>
                    </div>
                `;
            },

            getTabsContainer() {
                return umbilical.dom.querySelector('#main-tabs-container');
            }
        };

        // MVVM Architecture: ViewModel
        const viewModel = {
            tabs: null,

            init() {
                view.render();
                this.createTabsComponent();
            },

            createTabsComponent() {
                const tabsContainer = view.getTabsContainer();
                if (!tabsContainer) return;

                // Create tabs with placeholder content for now
                this.tabs = Tabs.create({
                    dom: tabsContainer,
                    tabs: model.tabs.map(tab => ({
                        ...tab,
                        content: `<div style="padding: 2rem; text-align: center;">
                            <h3>${tab.title} Panel</h3>
                            <p>Component implementation coming next...</p>
                            <div style="background: #f0f9ff; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                                <strong>Status:</strong> MVVM component architecture ready
                            </div>
                        </div>`
                    })),
                    theme: 'light',
                    variant: 'default',
                    onActiveTabChange: (tabId, tab) => {
                        model.activeTabId = tabId;
                        console.log(`ToolRegistryApp: Switched to ${tab.title}`);
                        
                        if (umbilical.onTabChange) {
                            umbilical.onTabChange(tabId, tab);
                        }
                    },
                    onMount: () => {
                        console.log('ToolRegistryApp: Tabs component mounted');
                    }
                });
            },

            getActiveTabId() {
                return model.activeTabId;
            },

            switchToTab(tabId) {
                if (this.tabs) {
                    this.tabs.setActiveTab(tabId);
                }
            }
        };

        // Initialize the component
        viewModel.init();

        // Public API
        const instance = {
            getActiveTab: () => viewModel.getActiveTabId(),
            switchToTab: (tabId) => viewModel.switchToTab(tabId),
            getModel: () => ({ ...model }), // Return copy for inspection
            
            destroy() {
                if (viewModel.tabs) {
                    viewModel.tabs.destroy();
                }
                umbilical.dom.innerHTML = '';
                
                if (umbilical.onDestroy) {
                    umbilical.onDestroy(instance);
                }
            }
        };

        if (umbilical.onMount) {
            umbilical.onMount(instance);
        }

        return instance;
    }
};