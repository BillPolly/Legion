# Legion Tool Registry UI - User Acceptance Testing (UAT) Guide

## 1. Overview

The Legion Tool Registry UI is a professional web application for managing and discovering AI agent tools. This UAT guide provides comprehensive test scenarios to validate all features and functionality.

### Application Architecture
- **Frontend**: MVVM architecture with UmbilicalUtils component system
- **Backend**: WebSocket server with actor-based communication
- **Data Flow**: Real-time bidirectional communication via WebSocket actors
- **UI Components**: Tab-based navigation with specialized panels

## 2. Pre-Testing Setup

### 2.1 Environment Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js v18+ installed
- Docker installed (for Qdrant vector database)
- Network access to localhost:8090

### 2.2 Starting the Application
1. Start the backend server:
   ```bash
   npm run dev
   ```
2. Open browser to http://localhost:8090
3. Verify WebSocket connection indicator shows "Connected"

## 3. Application Components Testing

### 3.1 Application Header
**Component**: ApplicationHeader  
**Location**: Top of the application

#### Test Cases:
1. **Title and Subtitle Display**
   - ✅ Verify "🛠️ Legion Tool Registry" title is displayed
   - ✅ Verify subtitle "Professional tool management and discovery platform" is visible
   - ✅ Check responsive layout on window resize

2. **Global Search**
   - ✅ Click on global search input (id: `global-search-input`)
   - ✅ Type search query
   - ✅ Press Ctrl/Cmd+K to focus search
   - ✅ Press Escape to clear search
   - ✅ Verify search triggers navigation to Search tab when query entered

3. **User Information**
   - ✅ Verify user avatar/initials displayed
   - ✅ Click user avatar to trigger user menu
   - ✅ Verify user name displayed correctly

### 3.2 Navigation Tabs
**Component**: NavigationTabs  
**Location**: Below header

#### Tab Structure:
1. 🔧 Loading - Registry control
2. 🔍 Search - Tool discovery
3. 📦 Modules - Module management
4. 📋 Details - Tool information
5. ⚙️ Admin - System administration

#### Test Cases:
1. **Tab Navigation**
   - ✅ Click each tab (class: `navigation-tab`)
   - ✅ Verify active tab has `active` class
   - ✅ Verify correct panel content loads
   - ✅ Use keyboard arrows to navigate tabs
   - ✅ Press Enter/Space to select tab

2. **Tab Persistence**
   - ✅ Select a tab
   - ✅ Refresh page
   - ✅ Verify tab selection persists

## 4. Panel-Specific Testing

### 4.1 Loading Control Panel
**Tab**: Loading (🔧)  
**Purpose**: Control tool registry loading and monitor status

#### Test Cases:
1. **Load Registry**
   - ✅ Click "Load Tool Registry" button
   - ✅ Verify loading spinner appears
   - ✅ Check progress messages displayed
   - ✅ Confirm success/error message after load

2. **Registry Statistics**
   - ✅ Verify module count displayed
   - ✅ Verify tool count displayed
   - ✅ Check perspective count
   - ✅ Confirm timestamp updates

3. **Load History**
   - ✅ Perform multiple loads
   - ✅ Verify history list updates (max 10 entries)
   - ✅ Check timestamp accuracy
   - ✅ Verify success/failure status indicators

### 4.2 Tool Search Panel
**Tab**: Search (🔍)  
**Purpose**: Find and filter tools

#### Test Cases:
1. **Search Functionality**
   - ✅ Type in search input (id: `tool-search-input`)
   - ✅ Verify real-time filtering as you type
   - ✅ Test partial matches (e.g., "calc" finds "calculator")
   - ✅ Clear search and verify all tools return

2. **Tool Display**
   - ✅ Verify each tool item has unique ID (`tool-item-*`)
   - ✅ Check tool name displayed
   - ✅ Verify module name shown
   - ✅ Confirm description visible

3. **Tool Selection**
   - ✅ Click on a tool item
   - ✅ Verify tool highlights as selected
   - ✅ Confirm automatic navigation to Details tab
   - ✅ Check selected tool persists when returning to Search

4. **View Modes**
   - ✅ Switch between list/grid/detailed views
   - ✅ Verify layout changes appropriately
   - ✅ Check all information visible in each mode

### 4.3 Module Browser Panel
**Tab**: Modules (📦)  
**Purpose**: Browse and manage tool modules

#### Test Cases:
1. **Module Display**
   - ✅ Verify grid layout of module cards
   - ✅ Check module name, tool count, status
   - ✅ Verify module icons/badges

2. **Module Filtering**
   - ✅ Filter by status (all/active/inactive/error)
   - ✅ Search modules by name
   - ✅ Sort by name/tool count/status

3. **Module Selection**
   - ✅ Click module card
   - ✅ Verify selection highlight
   - ✅ Check module details update
   - ✅ View list of tools in module

### 4.4 Tool Details Panel
**Tab**: Details (📋)  
**Purpose**: View detailed tool information

#### Test Cases:
1. **Tool Information Display**
   - ✅ Select tool from Search tab
   - ✅ Verify tool name, module, description
   - ✅ Check schema/parameters displayed
   - ✅ View usage examples

2. **Schema Visualization**
   - ✅ Toggle between visual/raw schema views
   - ✅ Verify parameter types shown
   - ✅ Check required/optional indicators
   - ✅ Validate default values displayed

3. **Tool Execution** (if enabled)
   - ✅ Fill in parameter values
   - ✅ Click "Execute" button
   - ✅ Verify execution spinner
   - ✅ Check result/error display
   - ✅ View execution history

### 4.5 Administration Panel
**Tab**: Admin (⚙️)  
**Purpose**: System configuration and monitoring

#### Test Cases:
1. **System Settings**
   - ✅ View connection URL
   - ✅ Check timeout settings
   - ✅ Verify logging configuration
   - ✅ Test save/cancel buttons

2. **User Management**
   - ✅ View user list
   - ✅ Check role assignments
   - ✅ Verify status indicators
   - ✅ View last login times

3. **System Logs**
   - ✅ View log entries
   - ✅ Filter by level (info/warn/error)
   - ✅ Filter by category
   - ✅ Search log messages
   - ✅ Check timestamp format

4. **Performance Metrics**
   - ✅ View memory usage chart
   - ✅ Check CPU utilization
   - ✅ Verify request/response times
   - ✅ Monitor active connections

## 5. WebSocket Actor Communication

### 5.1 Connection Testing
1. **Initial Connection**
   - ✅ Open developer console
   - ✅ Verify "WebSocket connected" message
   - ✅ Check actor handshake completion
   - ✅ Confirm tool/module data loads

2. **Connection Loss Recovery**
   - ✅ Disconnect network temporarily
   - ✅ Verify connection status indicator changes
   - ✅ Reconnect network
   - ✅ Confirm automatic reconnection
   - ✅ Verify data refreshes

### 5.2 Real-time Updates
1. **Tool Updates**
   - ✅ Modify tool on backend
   - ✅ Verify UI updates automatically
   - ✅ Check no page refresh required

## 6. Keyboard Accessibility

### 6.1 Navigation Shortcuts
- ✅ **Ctrl/Cmd + K**: Focus global search
- ✅ **Escape**: Clear search/close dialogs
- ✅ **Tab**: Navigate between elements
- ✅ **Arrow Keys**: Navigate tabs
- ✅ **Enter/Space**: Activate buttons/tabs

### 6.2 Focus Management
- ✅ Tab through all interactive elements
- ✅ Verify focus indicators visible
- ✅ Check logical tab order
- ✅ Test screen reader compatibility

## 7. Performance Testing

### 7.1 Load Testing
1. **Large Dataset**
   - ✅ Load registry with 100+ tools
   - ✅ Verify search remains responsive
   - ✅ Check scroll performance
   - ✅ Monitor memory usage

2. **Rapid Actions**
   - ✅ Switch tabs rapidly (10+ times)
   - ✅ Type/clear search quickly
   - ✅ Select/deselect tools rapidly
   - ✅ Verify no UI freezing

### 7.2 Response Times
- ✅ Tool search: < 100ms
- ✅ Tab switching: < 50ms  
- ✅ Initial load: < 3 seconds
- ✅ WebSocket messages: < 200ms

## 8. Error Handling

### 8.1 Network Errors
1. **Server Unavailable**
   - ✅ Stop backend server
   - ✅ Verify error message displayed
   - ✅ Check retry mechanism
   - ✅ Confirm graceful degradation

2. **Invalid Data**
   - ✅ Send malformed tool data
   - ✅ Verify error boundaries catch errors
   - ✅ Check UI remains functional
   - ✅ Confirm error logged to console

### 8.2 User Input Validation
1. **Search Input**
   - ✅ Enter special characters
   - ✅ Test very long strings (1000+ chars)
   - ✅ Try SQL injection patterns
   - ✅ Verify safe handling

## 9. Browser Compatibility

### 9.1 Desktop Browsers
Test on latest versions:
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge

### 9.2 Features to Verify
- ✅ WebSocket connectivity
- ✅ CSS rendering
- ✅ JavaScript execution
- ✅ Local storage
- ✅ Keyboard events

## 10. Acceptance Criteria

### 10.1 Critical Requirements
All must pass for acceptance:
- ✅ Application loads without errors
- ✅ WebSocket connection establishes
- ✅ All tabs accessible and functional
- ✅ Tool search returns results
- ✅ No console errors during normal use
- ✅ Data persists between sessions

### 10.2 Performance Requirements
- ✅ Initial load time < 3 seconds
- ✅ Search response < 100ms
- ✅ Memory usage < 200MB
- ✅ No memory leaks after 30 min use

### 10.3 Accessibility Requirements  
- ✅ Keyboard navigation functional
- ✅ Focus indicators visible
- ✅ ARIA labels present
- ✅ Color contrast sufficient

## 11. Issue Reporting

### 11.1 Information to Capture
When reporting issues:
1. Browser version and OS
2. Steps to reproduce
3. Expected vs actual behavior
4. Console error messages
5. Network tab screenshots
6. WebSocket frame captures

### 11.2 Severity Levels
- **Critical**: Application unusable
- **Major**: Feature non-functional
- **Minor**: Cosmetic or UX issues
- **Enhancement**: Suggestions

## 12. Sign-off Checklist

### 12.1 Functional Testing
- [ ] All panels load correctly
- [ ] Search functionality works
- [ ] Tool selection and details display
- [ ] WebSocket communication stable
- [ ] Error handling appropriate

### 12.2 Non-Functional Testing
- [ ] Performance acceptable
- [ ] Browser compatibility verified
- [ ] Accessibility standards met
- [ ] Security testing passed
- [ ] Documentation complete

### 12.3 User Experience
- [ ] Intuitive navigation
- [ ] Responsive feedback
- [ ] Clear error messages
- [ ] Consistent design
- [ ] Help documentation available

## 13. Test Execution Log

| Date | Tester | Version | Browser | Test Suite | Pass | Fail | Issues |
|------|--------|---------|---------|------------|------|------|--------|
| | | | | | | | |

## 14. Appendix

### 14.1 Test Data
- Mock tools: calculator, file_write, file_read
- Mock modules: FileModule, CalculatorModule
- Test search queries: "calc", "file", "write"

### 14.2 Known Limitations
- Semantic search requires Qdrant container
- Some features require backend connection
- Admin panel in demo mode only

### 14.3 Support Resources
- Documentation: `/docs`
- API Reference: `/api-docs`
- Issue Tracker: GitHub Issues
- Support Email: support@legion.ai

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: Quarterly

This UAT guide provides comprehensive coverage of all UI components and functionality. Testers should work through each section systematically, marking items as complete and documenting any issues found.