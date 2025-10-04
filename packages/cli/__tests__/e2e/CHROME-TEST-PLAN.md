# Chrome E2E Test Plan

This document outlines the manual E2E testing procedure using chrome-devtools-mcp tools.

## Test 1: CLI Web UI Basic Flow

### Setup
1. Start CLIServer on port 5100
2. Navigate Chrome to `http://localhost:5100/cli`

### Test Steps
1. **Load page and verify no errors**
   - Take page snapshot
   - Verify DOM structure (app, terminal containers)
   - Check console for errors
   - Verify import map loaded

2. **Verify WebSocket connection**
   - Wait 3 seconds for connection
   - Take snapshot
   - Verify connection status indicator
   - Check network requests for successful WebSocket upgrade

3. **Execute /help command**
   - Find terminal input field in snapshot
   - Fill input with "/help"
   - Submit command
   - Wait for response
   - Verify help text displays

4. **Take screenshots**
   - Capture full page screenshot
   - Verify visual state

5. **Check network requests**
   - List all network requests
   - Verify no 4xx/5xx errors
   - Verify all static files loaded

## Test 2: Graph Rendering

### Setup
1. Start CLIServer on port 5101
2. Navigate Chrome to `http://localhost:5101/cli`
3. Wait for connection

### Test Steps
1. **Execute /show graph command**
   - Fill input with "/show legion://test/graph"
   - Submit command
   - Wait 3 seconds for rendering

2. **Verify floating window**
   - Take snapshot
   - Verify `.asset-floating-window` exists
   - Verify window position and size

3. **Verify SVG graph**
   - Check snapshot for `<svg>` element
   - Count nodes (should be 3)
   - Count edges (should be 3)
   - Verify node structure (rect, text)

4. **Test interactivity**
   - Hover over SVG element
   - Verify hover events work
   - Take screenshot

5. **Check console**
   - List console messages
   - Verify no errors during rendering

## Test 3: Component Browser

### Setup
1. Start CLIServer on port 5102
2. Navigate Chrome to `http://localhost:5102/component-browser`

### Test Steps
1. **Verify page loads**
   - Take snapshot
   - Verify component browser UI elements
   - Check for component list

2. **Test component filtering**
   - Find search/filter input
   - Type "button"
   - Wait 1 second
   - Verify filtered results

3. **Test component selection**
   - Find component item
   - Click component
   - Verify detail/editor view appears

4. **Visual verification**
   - Take full page screenshot
   - Verify UI layout

5. **Check errors**
   - List console messages
   - List network requests
   - Verify no critical errors

## Success Criteria

### CLI Web UI
- ✅ Page loads without console errors
- ✅ WebSocket connects successfully
- ✅ Commands execute and display output
- ✅ All static resources load (200 status)
- ✅ Import map resolves correctly

### Graph Rendering
- ✅ Graph command executes
- ✅ Floating window appears
- ✅ SVG renders with correct node/edge count
- ✅ Graph is interactive
- ✅ No rendering errors in console

### Component Browser
- ✅ Page loads with component list
- ✅ Filter/search works
- ✅ Component selection works
- ✅ UI is responsive
- ✅ No critical errors

## Notes

This testing approach uses chrome-devtools-mcp tools directly from Claude Code, not from within Jest. The tools are invoked interactively to test the REAL browser experience.
