/**
 * Verify the parameter coordination fix in TerminalView
 * This test ensures that values are correctly passed through all layers
 */

import { TerminalView } from '../src/components/terminal/TerminalView.js';
import { TerminalViewModel } from '../src/components/terminal/TerminalViewModel.js';
import { TerminalModel } from '../src/components/terminal/TerminalModel.js';

console.log('================================================================================');
console.log('🔧 VERIFYING PARAMETER COORDINATION FIX');
console.log('================================================================================\n');

// Test data
const TEST_INPUT = 'test command';
const TEST_KEY = 'Enter';

// Results tracking
let inputValueReceived = null;
let keyReceived = null;
let modelCommandSet = null;

// Create test components
function createTestComponents() {
  // Create container
  const container = {
    innerHTML: '',
    appendChild: () => {},
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    classList: { add: () => {}, remove: () => {} }
  };
  
  // Create model
  const model = new TerminalModel();
  
  // Override setCurrentCommand to track what value it receives
  const originalSetCommand = model.setCurrentCommand.bind(model);
  model.setCurrentCommand = function(value) {
    console.log(`[MODEL] setCurrentCommand received: "${value}" (type: ${typeof value})`);
    modelCommandSet = value;
    return originalSetCommand(value);
  };
  
  // Create proper DOM container
  if (typeof document === 'undefined') {
    // Create mock DOM for Node.js environment
    global.document = {
      createElement: (tag) => ({
        tagName: tag,
        className: '',
        classList: {
          add: function(cls) { this.className += ' ' + cls; },
          remove: function() {}
        },
        appendChild: () => {},
        querySelector: () => null,
        innerHTML: '',
        addEventListener: () => {},
        removeEventListener: () => {},
        style: {}
      })
    };
  }
  
  const domContainer = typeof document !== 'undefined' ? 
    document.createElement('div') : 
    global.document.createElement('div');
  
  // Create view
  const view = new TerminalView(domContainer);
  
  // Render the view to initialize subcomponents
  view.render();
  
  // Create mock actor space
  const mockActorSpace = {
    getActor: (name) => ({
      send: () => {},
      on: () => {},
      emit: () => {}
    }),
    createActor: () => ({}),
    destroyActor: () => {}
  };
  
  // Create view model with actor space
  const viewModel = new TerminalViewModel(model, view, {
    commandParser: { parse: (cmd) => ({ command: cmd }) },
    historyManager: { 
      addCommand: () => {},
      getPrevious: () => null,
      getNext: () => null
    },
    autocompleteService: { getSuggestions: () => [] }
  });
  
  // Set actor space
  viewModel.actorSpace = mockActorSpace;
  
  // Override handleInput to track what it receives
  const originalHandleInput = viewModel.handleInput.bind(viewModel);
  viewModel.handleInput = function(value, event) {
    console.log(`[VIEW MODEL] handleInput received:`);
    console.log(`  - value: "${value}" (type: ${typeof value})`);
    console.log(`  - event: ${event ? event.constructor.name : 'null'}`);
    inputValueReceived = value;
    return originalHandleInput(value, event);
  };
  
  // Override handleKeyDown to track what it receives
  const originalHandleKeyDown = viewModel.handleKeyDown.bind(viewModel);
  viewModel.handleKeyDown = function(key, event) {
    console.log(`[VIEW MODEL] handleKeyDown received:`);
    console.log(`  - key: "${key}" (type: ${typeof key})`);
    console.log(`  - event: ${event ? event.constructor.name : 'null'}`);
    keyReceived = key;
    return originalHandleKeyDown(key, event);
  };
  
  return { model, view, viewModel };
}

// Test parameter passing
function testParameterPassing() {
  console.log('Testing parameter passing through component layers...\n');
  
  const { model, view, viewModel } = createTestComponents();
  
  // Initialize the view model (sets up event handlers)
  viewModel.initialize();
  
  // Simulate input from TerminalInputView
  console.log(`1. Simulating input: "${TEST_INPUT}"`);
  
  // Create mock event
  const mockInputEvent = {
    constructor: { name: 'InputEvent' },
    target: { value: TEST_INPUT },
    toString: () => '[object InputEvent]'
  };
  
  // Trigger the input callback chain
  if (view.inputView && view.inputView.onInput) {
    console.log('   Calling inputView.onInput...');
    view.inputView.onInput(TEST_INPUT, mockInputEvent);
  }
  
  // Check if value was received correctly
  console.log('\n2. Checking value propagation:');
  console.log(`   ✓ TerminalInputView sent: "${TEST_INPUT}"`);
  console.log(`   ${inputValueReceived === TEST_INPUT ? '✓' : '✗'} TerminalViewModel received: "${inputValueReceived}"`);
  console.log(`   ${modelCommandSet === TEST_INPUT ? '✓' : '✗'} Model received: "${modelCommandSet}"`);
  
  // Test keyboard event
  console.log(`\n3. Simulating key press: "${TEST_KEY}"`);
  
  const mockKeyEvent = {
    constructor: { name: 'KeyboardEvent' },
    key: TEST_KEY,
    preventDefault: () => {}
  };
  
  if (view.inputView && view.inputView.onKeyDown) {
    console.log('   Calling inputView.onKeyDown...');
    view.inputView.onKeyDown(TEST_KEY, mockKeyEvent);
  }
  
  console.log(`   ${keyReceived === TEST_KEY ? '✓' : '✗'} TerminalViewModel received key: "${keyReceived}"`);
  
  // Verify results
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICATION RESULTS');
  console.log('='.repeat(80) + '\n');
  
  const inputTestPassed = inputValueReceived === TEST_INPUT && modelCommandSet === TEST_INPUT;
  const keyTestPassed = keyReceived === TEST_KEY;
  
  if (inputTestPassed) {
    console.log('✅ INPUT HANDLING: FIXED');
    console.log('   Values are correctly passed through all layers');
    console.log('   No [object InputEvent] or parameter coordination issues');
  } else {
    console.log('❌ INPUT HANDLING: STILL BROKEN');
    console.log('   Expected value: "' + TEST_INPUT + '"');
    console.log('   ViewModel received: "' + inputValueReceived + '"');
    console.log('   Model received: "' + modelCommandSet + '"');
  }
  
  if (keyTestPassed) {
    console.log('\n✅ KEYBOARD HANDLING: WORKING');
    console.log('   Keys are correctly passed to handlers');
  } else {
    console.log('\n❌ KEYBOARD HANDLING: BROKEN');
    console.log('   Expected key: "' + TEST_KEY + '"');
    console.log('   Received: "' + keyReceived + '"');
  }
  
  // Check for potential [object InputEvent] bug
  console.log('\n🔍 [object InputEvent] Bug Check:');
  
  const hasObjectBug = 
    (inputValueReceived && inputValueReceived.toString().includes('[object')) ||
    (modelCommandSet && modelCommandSet.toString().includes('[object'));
  
  if (hasObjectBug) {
    console.log('❌ BUG DETECTED: [object InputEvent] is being stored!');
  } else {
    console.log('✅ No [object InputEvent] bug detected');
  }
  
  // Overall result
  console.log('\n' + '='.repeat(80));
  if (inputTestPassed && keyTestPassed && !hasObjectBug) {
    console.log('✅ ALL TESTS PASSED - Parameter coordination is working correctly!');
  } else {
    console.log('❌ TESTS FAILED - Parameter coordination issues remain');
  }
  console.log('='.repeat(80) + '\n');
  
  return inputTestPassed && keyTestPassed && !hasObjectBug;
}

// Run the verification
try {
  const success = testParameterPassing();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('❌ Test failed with error:', error);
  console.error(error.stack);
  process.exit(1);
}