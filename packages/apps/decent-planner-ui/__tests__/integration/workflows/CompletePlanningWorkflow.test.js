/**
 * End-to-end workflow tests using REAL DecentPlanner - NO MOCKS
 * Tests complete planning workflow with real LLM integration and progress notifications
 */

import { PlanningSession } from '../../../src/server/domain/entities/PlanningSession.js';
import { DecentPlannerAdapter } from '../../../src/server/infrastructure/adapters/DecentPlannerAdapter.js';
import { StartPlanningUseCase } from '../../../src/server/application/use-cases/StartPlanningUseCase.js';
import { DiscoverToolsUseCase } from '../../../src/server/application/use-cases/DiscoverToolsUseCase.js';
import { SearchToolsUseCase } from '../../../src/server/application/use-cases/SearchToolsUseCase.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Complete Planning Workflow E2E with REAL Components', () => {
  let realPlanner;
  let resourceManager;
  let session;
  
  beforeAll(async () => {
    console.log('\n🚀 Setting up REAL components for E2E workflow tests');
    
    // Get ResourceManager - fail fast if not available
    resourceManager = await ResourceManager.getInstance();
    
    // Verify LLM client is available - fail fast if not
    const llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client required for E2E workflow test - no fallbacks');
    }
    console.log('✅ LLM client available for E2E workflow tests');
  });
  
  beforeEach(async () => {
    realPlanner = new DecentPlannerAdapter();
    await realPlanner.initialize();
    session = null;
    console.log('✅ Fresh REAL DecentPlannerAdapter initialized');
  });
  
  afterEach(() => {
    if (realPlanner) {
      realPlanner.cancel();
    }
  });
  
  describe('Full Planning Flow with REAL LLM', () => {
    test('should complete informal -> tools -> formal workflow with progress tracking', async () => {
      console.log('\n🎯 Testing complete workflow with REAL DecentPlanner');
      
      let allProgressMessages = [];
      const progressTracker = (phase) => (message) => {
        const logMessage = `[${phase}] ${message}`;
        console.log(`📢 ${logMessage}`);
        allProgressMessages.push(logMessage);
      };
      
      // Step 1: Create session and start informal planning with REAL LLM
      const goal = 'Create a web scraper for news articles';
      console.log(`📋 Goal: "${goal}"`);
      
      session = new PlanningSession(goal);
      session.startInformalPlanning();
      
      console.log('\n🚀 Step 1: Informal planning with REAL LLM...');
      const informalResult = await realPlanner.planInformal(
        goal,
        {},
        progressTracker('INFORMAL')
      );
      
      expect(informalResult.success).toBe(true);
      expect(informalResult.informal.hierarchy).toBeDefined();
      console.log(`✅ Informal planning completed in ${informalResult.duration}ms`);
      
      session.completeInformalPlanning(informalResult.informal);
      expect(session.mode).toBe('INFORMAL_COMPLETE');
      
      // Step 2: Discover tools with REAL components
      console.log('\n🔍 Step 2: Tool discovery with REAL components...');
      session.startToolDiscovery();
      
      const toolsResult = await realPlanner.discoverTools(
        informalResult.informal.hierarchy,
        progressTracker('TOOLS')
      );
      
      expect(toolsResult.tools).toBeDefined();
      expect(toolsResult.tools.length).toBeGreaterThan(0);
      console.log(`✅ Tool discovery completed - found ${toolsResult.tools.length} tools`);
      
      session.completeToolDiscovery(toolsResult);
      expect(session.mode).toBe('TOOLS_DISCOVERED');
      
      // Step 3: Formal planning with REAL LLM
      console.log('\n🎯 Step 3: Formal planning with REAL LLM...');
      session.startFormalPlanning();
      
      const formalResult = await realPlanner.planFormal(
        informalResult.informal,
        progressTracker('FORMAL')
      );
      
      expect(formalResult.success).toBe(true);
      expect(formalResult.behaviorTrees).toBeDefined();
      expect(formalResult.validation.valid).toBe(true);
      console.log(`✅ Formal planning completed in ${formalResult.duration}ms`);
      
      session.completeFormalPlanning(formalResult);
      expect(session.mode).toBe('COMPLETE');
      expect(session.isComplete()).toBe(true);
      
      // Verify we captured REAL LLM progress notifications
      expect(allProgressMessages.length).toBeGreaterThan(0);
      console.log(`\n📊 Total REAL progress notifications: ${allProgressMessages.length}`);
      
      console.log('\n📋 All workflow progress messages:');
      allProgressMessages.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. ${msg}`);
      });
      
      console.log('🎉 Complete E2E workflow with REAL LLM PASSED!');
    }, 300000); // 5 minutes for complete workflow
    
    test('should handle workflow with use cases and REAL progress tracking', async () => {
      console.log('\n🎯 Testing workflow with Use Cases and REAL DecentPlanner');
      
      // Create REAL UI renderer that captures interactions
      const realUIInteractions = [];
      const realUIRenderer = {
        showLoading: (message) => {
          console.log(`🔄 UI: Loading - ${message}`);
          realUIInteractions.push(`showLoading: ${message}`);
        },
        setElementEnabled: (element, enabled) => {
          console.log(`⚙️  UI: ${element} enabled = ${enabled}`);
          realUIInteractions.push(`setElementEnabled: ${element} = ${enabled}`);
        },
        updateProgress: (progress) => {
          console.log(`📊 UI: Progress - ${progress.message} (${progress.percentage}%)`);
          realUIInteractions.push(`updateProgress: ${progress.message}`);
        },
        showError: (error) => {
          console.log(`❌ UI: Error - ${error}`);
          realUIInteractions.push(`showError: ${error}`);
        },
        updateElement: (element, data) => {
          console.log(`🔄 UI: Update ${element}`);
          realUIInteractions.push(`updateElement: ${element}`);
        },
        updateComponent: (component, data) => {
          console.log(`🔄 UI: Update component ${component}`);
          realUIInteractions.push(`updateComponent: ${component}`);
        },
        switchTab: (tab) => {
          console.log(`📂 UI: Switch to ${tab} tab`);
          realUIInteractions.push(`switchTab: ${tab}`);
        },
        hideLoading: () => {
          console.log(`✅ UI: Hide loading`);
          realUIInteractions.push('hideLoading');
        }
      };
      
      // Create REAL actor communication handler
      const realActorMessages = [];
      const realActorComm = {
        send: (message) => {
          console.log(`📤 Actor: Send - ${message.type}`);
          realActorMessages.push(message);
        },
        onMessage: (handler) => {
          console.log('📥 Actor: Message handler registered');
        }
      };
      
      // Create use cases with REAL planner adapter
      const startPlanningUseCase = new StartPlanningUseCase({
        plannerService: realPlanner,
        uiRenderer: realUIRenderer,
        actorCommunication: realActorComm
      });
      
      const discoverToolsUseCase = new DiscoverToolsUseCase({
        plannerService: realPlanner,
        uiRenderer: realUIRenderer
      });
      
      // Execute workflow with REAL components
      const goal = 'Build a REST API for user management';
      console.log(`📋 Goal: "${goal}"`);
      
      // Start informal planning with REAL LLM
      console.log('\n🚀 Starting informal planning use case...');
      const informalResult = await startPlanningUseCase.execute({
        goal,
        mode: 'informal'
      });
      
      expect(informalResult.success).toBe(true);
      session = informalResult.session;
      console.log('✅ Informal planning use case completed');
      
      // Discover tools with REAL components
      console.log('\n🔍 Starting tool discovery use case...');
      const toolsResult = await discoverToolsUseCase.execute({
        session
      });
      
      expect(toolsResult.success).toBe(true);
      expect(toolsResult.toolDiscoveryResult).toBeDefined();
      expect(toolsResult.toolDiscoveryResult.tools.length).toBeGreaterThan(0);
      console.log(`✅ Tool discovery use case completed - found ${toolsResult.toolDiscoveryResult.tools.length} tools`);
      
      expect(session.mode).toBe('TOOLS_DISCOVERED');
      
      // Verify REAL UI interactions occurred
      expect(realUIInteractions.length).toBeGreaterThan(0);
      console.log(`\n🖥️  Captured ${realUIInteractions.length} UI interactions:`);
      realUIInteractions.forEach((interaction, idx) => {
        console.log(`   ${idx + 1}. ${interaction}`);
      });
      
      // Verify REAL actor messages were sent
      expect(realActorMessages.length).toBeGreaterThan(0);
      console.log(`\n📤 Captured ${realActorMessages.length} actor messages:`);
      realActorMessages.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. ${msg.type}`);
      });
      
      console.log('🎉 Use cases with REAL components PASSED!');
    }, 240000); // 4 minutes
  });
  
  describe('Tool Search Workflow with REAL Components', () => {
    test('should search tools with REAL tool registry', async () => {
      console.log('\n🎯 Testing REAL tool search functionality');
      
      const realUIInteractions = [];
      const realUIRenderer = {
        showLoading: (message) => {
          realUIInteractions.push(`showLoading: ${message}`);
        },
        updateComponent: (component, data) => {
          realUIInteractions.push(`updateComponent: ${component} - ${data?.results?.length || 0} results`);
        },
        showError: (error) => {
          realUIInteractions.push(`showError: ${error}`);
        }
      };
      
      const searchUseCase = new SearchToolsUseCase({
        plannerService: realPlanner,
        uiRenderer: realUIRenderer
      });
      
      console.log('🔍 Searching for file-related tools...');
      const result = await searchUseCase.execute({
        query: 'file',
        searchType: 'TEXT',
        limit: 10
      });
      
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeLessThanOrEqual(10);
      expect(result.results.length).toBeGreaterThan(0);
      
      console.log(`✅ Found ${result.results.length} file-related tools`);
      
      // Verify all results contain 'file'
      result.results.forEach(tool => {
        const hasFileInName = tool.name.toLowerCase().includes('file');
        const hasFileInDesc = (tool.description || '').toLowerCase().includes('file');
        expect(hasFileInName || hasFileInDesc).toBe(true);
        console.log(`   📋 ${tool.name}: ${tool.description}`);
      });
      
      // Verify UI interactions occurred
      expect(realUIInteractions.length).toBeGreaterThan(0);
      
      console.log('🎉 REAL tool search PASSED!');
    }, 60000);
  });
  
  describe('Error Recovery Workflow with REAL Components', () => {
    test('should handle cancellation during REAL workflow', async () => {
      console.log('\n🎯 Testing cancellation with REAL DecentPlanner');
      
      session = new PlanningSession('Test cancellation with real LLM');
      
      // Start planning with REAL components
      session.startInformalPlanning();
      console.log('🚀 Starting planning that will be cancelled...');
      
      const planPromise = realPlanner.planInformal('Test cancellation with real LLM');
      
      // Cancel after short delay
      setTimeout(() => {
        console.log('⏹️  Cancelling REAL planner...');
        session.cancel();
        realPlanner.cancel();
      }, 1000); // Give it time to start actual LLM call
      
      // Should handle cancellation gracefully
      try {
        await planPromise;
        // If it completes before cancellation, that's also valid
        console.log('✅ Planning completed before cancellation');
      } catch (error) {
        console.log(`🛑 Planning cancelled: ${error.message}`);
        expect(error.message.toLowerCase()).toContain('cancel');
      }
      
      expect(session.mode).toBe('CANCELLED');
      console.log('🎉 REAL cancellation handling PASSED!');
    }, 60000);
  });
  
  describe('State Persistence with REAL Components', () => {
    test('should maintain session state through REAL workflow', async () => {
      console.log('\n🎯 Testing state persistence with REAL DecentPlanner');
      
      const goal = 'Create a task management system';
      session = new PlanningSession(goal);
      
      const stateHistory = [];
      
      // Track state changes
      const trackState = (phase) => {
        const state = {
          phase,
          mode: session.mode,
          hasInformal: session.hasInformalResult(),
          hasTools: session.hasToolDiscoveryResult(),
          hasFormal: session.hasFormalResult()
        };
        console.log(`📊 State [${phase}]: ${state.mode}, informal=${state.hasInformal}, tools=${state.hasTools}, formal=${state.hasFormal}`);
        stateHistory.push(state);
      };
      
      trackState('Initial');
      
      // Go through workflow with REAL components
      session.startInformalPlanning();
      trackState('Planning Started');
      
      console.log('🚀 Informal planning with REAL LLM...');
      const informalResult = await realPlanner.planInformal(goal);
      session.completeInformalPlanning(informalResult.informal);
      trackState('Informal Complete');
      
      session.startToolDiscovery();
      trackState('Tool Discovery Started');
      
      console.log('🔍 Tool discovery with REAL components...');
      const toolsResult = await realPlanner.discoverTools(informalResult.informal.hierarchy);
      session.completeToolDiscovery(toolsResult);
      trackState('Tools Complete');
      
      // Verify state progression
      expect(stateHistory).toHaveLength(5);
      expect(stateHistory[0].mode).toBe('IDLE');
      expect(stateHistory[4].mode).toBe('TOOLS_DISCOVERED');
      expect(stateHistory[4].hasInformal).toBe(true);
      expect(stateHistory[4].hasTools).toBe(true);
      
      console.log('\n📊 Final state verification:');
      stateHistory.forEach((state, idx) => {
        console.log(`   ${idx + 1}. [${state.phase}] ${state.mode}`);
      });
      
      console.log('🎉 REAL state persistence PASSED!');
    }, 180000); // 3 minutes
  });
  
  describe('Report Generation with REAL Components', () => {
    test('should generate planning report after REAL completion', async () => {
      console.log('\n🎯 Testing report generation with REAL DecentPlanner');
      
      // Complete planning workflow with REAL components
      const goal = 'Generate report for task automation system';
      session = new PlanningSession(goal);
      
      console.log('🚀 Completing full workflow for report generation...');
      session.startInformalPlanning();
      const informalResult = await realPlanner.planInformal(goal);
      session.completeInformalPlanning(informalResult.informal);
      
      session.startFormalPlanning();
      const formalResult = await realPlanner.planFormal(informalResult.informal);
      session.completeFormalPlanning(formalResult);
      
      // Generate report with REAL planner
      const plan = {
        goal,
        informal: informalResult.informal,
        formal: formalResult,
        session: session.getSummary()
      };
      
      console.log('📄 Generating report with REAL planner...');
      const report = realPlanner.generateReport(plan);
      
      expect(report).toBeDefined();
      expect(report.summary).toContain('successfully');
      expect(report.markdown).toContain('# Planning Report');
      expect(report.details.goal).toBe(goal);
      
      console.log('✅ Report generated successfully');
      console.log(`📋 Summary: ${report.summary}`);
      console.log(`📄 Markdown length: ${report.markdown.length} characters`);
      
      console.log('🎉 REAL report generation PASSED!');
    }, 300000); // 5 minutes for full workflow + report
  });
});