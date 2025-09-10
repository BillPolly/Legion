# Project Management System Design Document
## Gemini Agent SD Tools Integration

### Version: 1.0 MVP
### Date: September 10, 2025

---

## Executive Summary

This document outlines the design for integrating comprehensive project management capabilities into the Gemini Compatible Agent, leveraging the existing SD (Software Development) module tools and **Legion's actor framework architecture**. The system will provide real-time project tracking, deliverable management, and visual progress monitoring through a sophisticated chat interface enhanced with floating window displays.

The solution extends the existing SD module's observability and planning capabilities while introducing a dedicated ProjectManagerAgent for coordination and rich **MVVM umbilical UI components** for visual project management. 

**CRITICAL ARCHITECTURE REQUIREMENTS:**
- **Actor Framework**: All server-side components must use Legion's actor framework for communication and coordination
- **MVVM Umbilical Components**: All frontend UI components must follow the MVVM umbilical protocol pattern established in `packages/frontend/components`
- **WebSocket Communication**: Real-time updates between actors and UI components via WebSocket messaging
- **No Direct DOM Manipulation**: All UI interactions must go through the umbilical component protocol

---

## Current State Analysis

### Existing SD Module Components

**SDObservabilityAgent**
- Intelligent monitoring with chat interface
- Real-time artifact tracking and indexing
- System status observation and reporting
- Conversation history and knowledge base
- Change stream monitoring for database updates

**SDPlanningProfile** 
- Integration with Legion's DecentPlanner
- Formal behavior tree generation for SD workflows
- Six methodology integration (DDD, Clean Architecture, Immutable Design, Flux, TDD, Clean Code)
- Hierarchical task decomposition with confidence thresholds

**SDModule.planDevelopment()**
- Method for planning software development goals
- Context-aware planning with methodology frameworks
- Tool integration with behavior tree execution
- Database connectivity and artifact management

**SDMethodologyService**
- Basic integration of SD tools into Gemini chat
- Requirements analysis and user story generation
- Professional development workflow detection
- Tool orchestration for complex development tasks

**Existing SD Agents (15 total)**
- RequirementsAgent, DomainModelingAgent, ArchitectureAgent
- CodeGenerationAgent, TestGenerationAgent, QualityAssuranceAgent  
- LiveTestingAgent, StateDesignAgent, FluxAgent
- Validation agents for requirements, code quality, domain logic
- Fixing agents for requirements and code issues
- SDObservabilityAgent for monitoring

**SD Tools (13+ available)**
- Requirements: parsing, user story generation, acceptance criteria
- Domain: bounded contexts, entity modeling, aggregates, domain events  
- Architecture: layer generation, use cases, interface design
- Database: connection, artifact storage, context retrieval

---

## Gap Analysis

### Missing Capabilities

**Project Coordination**
- No central agent coordinating work across multiple SD agents
- No project lifecycle state management (Requirements → Domain → Architecture → Implementation → Testing)
- No deliverable dependency tracking or milestone management
- No cross-phase validation or completion verification

**Visual Project Management**
- No dashboard for project status visualization
- No real-time progress tracking display
- No deliverable completion indicators
- No timeline or milestone visualization

**Enhanced Chat Integration**  
- No project-specific slash commands
- No project status reporting in chat interface
- No integration between project state and conversational context
- No project planning initiation through chat

**Deliverable Management**
- No formal deliverable definition or tracking
- No completion criteria specification
- No artifact linking to project phases
- No status reporting for stakeholders

---

## Solution Architecture

### Core Components

**1. ProjectManagerAgent**
```
Purpose: Central coordination and project lifecycle management
Base Class: SDAgentBase
Responsibilities:
- Project initialization and configuration
- Phase transition management (Requirements → Domain → Architecture → Implementation → Testing)
- Deliverable definition and tracking
- Agent coordination and task delegation
- Milestone management and validation
- Status aggregation and reporting
```

**2. Enhanced SDObservabilityAgent**
```
Purpose: Extended monitoring with project-aware capabilities
Base Class: Existing SDObservabilityAgent
New Responsibilities:
- Project-specific artifact monitoring
- Deliverable completion detection
- Real-time project status updates
- Integration with ProjectManagerAgent for status aggregation
- WebSocket broadcasting of project events
```

**3. ProjectDashboardComponent (MVVM Umbilical)**
```
Purpose: Visual project management interface
Base Framework: MVVM Umbilical Component Protocol (packages/frontend/components pattern)
Architecture: Model-View-ViewModel with umbilical interface
Components Used: Window + Grid + Tree umbilical components
Responsibilities:
- Real-time project status visualization through MVVM data binding
- Deliverable tracking and completion indicators via reactive UI updates
- Phase progress monitoring with live WebSocket updates
- Agent activity display through umbilical event handling
- Interactive project navigation following umbilical protocol patterns
- NO direct DOM manipulation - all updates through ViewModel
```

**4. Enhanced Chat Integration (Actor Framework)**
```
Purpose: Project management through conversational interface
Base: Existing GeminiRootClientActor/ServerActor (Legion Actor Framework)
Actor Communication: WebSocket-based actor messaging protocol
New Capabilities:
- Project-specific slash commands routed through actor messages
- Contextual project status in responses via actor state sharing
- Project planning initiation through actor coordination
- Deliverable status reporting via actor event broadcasting
- ALL chat interactions must use actor framework messaging
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Gemini Chat Interface                      │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   Chat Messages     │    │   ProjectDashboardComponent     │ │
│  │   Slash Commands    │    │   (Floating Window)             │ │
│  │   Status Reports    │    │   - Phase Progress              │ │
│  └─────────────────────┘    │   - Deliverable Status          │ │
│           │                 │   - Agent Activity              │ │
│           │                 └─────────────────────────────────┘ │
└───────────┼─────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                Actor Framework Layer                            │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │ GeminiRootServer    │    │    WebSocket Communication     │ │
│  │ Actor (Enhanced)    │◄──►│    Real-time Updates           │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
└───────────┼─────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                  SD Module Integration                          │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │ ProjectManager      │◄──►│ Enhanced SDObservability       │ │
│  │ Agent               │    │ Agent                           │ │
│  │ - Project Lifecycle │    │ - Project Monitoring            │ │
│  │ - Deliverable Mgmt  │    │ - Status Aggregation           │ │
│  │ - Agent Coordination│    │ - Real-time Updates            │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
│           │                              │                     │
│           ▼                              ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Existing SD Agents & Tools                    │ │
│  │ Requirements│Domain│Architecture│Code│Test│Quality│Fixing   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### ProjectManagerAgent

**Class Definition**
```javascript
export class ProjectManagerAgent extends SDAgentBase {
  constructor(config) {
    super({
      name: 'ProjectManagerAgent',
      description: 'Central project coordination and lifecycle management'
    });
  }
}
```

**Core Responsibilities**

*Project Initialization*
- Parse project requirements and scope
- Initialize project configuration and context
- Create deliverable definitions and dependencies
- Set up project workspace and artifacts

*Lifecycle Management*
- Manage five-phase workflow: Requirements → Domain → Architecture → Implementation → Testing
- Validate phase completion criteria
- Coordinate phase transitions
- Handle phase rollback scenarios

*Deliverable Tracking*
- Define deliverable specifications per phase
- Track completion status and quality metrics
- Manage deliverable dependencies and blockers
- Generate completion reports

*Agent Coordination*
- Delegate tasks to appropriate SD agents
- Monitor agent activity and progress
- Handle agent failure and retry scenarios
- Aggregate agent results into project status

**Key Methods**
```javascript
async initializeProject(requirements, context)
async planProject(goal, constraints) 
async executePhase(phaseName, deliverables)
async validatePhaseCompletion(phaseName)
async transitionToPhase(fromPhase, toPhase)
async getProjectStatus()
async getDeliverablesStatus()
async coordinateAgents(tasks)
```

**State Management**
```javascript
projectState = {
  id: string,
  name: string,
  phase: 'requirements' | 'domain' | 'architecture' | 'implementation' | 'testing',
  status: 'planning' | 'active' | 'paused' | 'completed' | 'failed',
  deliverables: Map<string, DeliverableStatus>,
  agents: Map<string, AgentStatus>,
  timeline: Array<PhaseTransition>,
  artifacts: Map<string, ArtifactReference>
}
```

### Enhanced SDObservabilityAgent

**Extension Capabilities**

*Project-Aware Monitoring*
- Monitor project-specific artifacts and changes
- Track deliverable completion events
- Observe agent coordination activities
- Generate project-focused reports

*Real-time Status Broadcasting*
- WebSocket integration for live updates
- Project event streaming to UI components
- Status change notifications
- Agent activity broadcasting

*Integration with ProjectManagerAgent*
- Subscribe to project lifecycle events
- Provide monitoring data for decision making
- Alert on project issues or blockers
- Generate project health metrics

**New Methods**
```javascript
async subscribeToProject(projectId)
async broadcastProjectUpdate(projectId, updateType, data)
async getProjectMetrics(projectId)
async generateProjectReport(projectId, reportType)
```

### ProjectDashboardComponent (MVVM Umbilical)

**Component Structure**
```javascript
export const ProjectDashboardComponent = {
  create(umbilical) {
    // Introspection, validation, and instance modes
    // Uses Window + Grid + Tree components
  }
}
```

**Umbilical Requirements**
```javascript
requirements = {
  dom: HTMLElement,              // Container element
  projectId: string,             // Project to display
  onPhaseClick: function,        // Phase interaction callback
  onDeliverableClick: function,  // Deliverable interaction callback
  theme: 'light' | 'dark',       // Visual theme
  position: {x, y},              // Initial window position
  size: {width, height}          // Initial window size
}
```

**Visual Layout**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 Project: User Authentication System                    [×][□][−]│
├─────────────────────────────────────────────────────────────────┤
│ Phase Progress                                                  │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                      │
│ │ REQ │→│ DOM │→│ARCH │→│IMPL │→│TEST │                      │
│ │ ✅  │ │ ⚠️  │ │ ⏳  │ │ ⏳  │ │ ⏳  │                      │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                      │
├─────────────────────────────────────────────────────────────────┤
│ Deliverables Status                                             │
│ 📋 Requirements Analysis        ✅ Complete                     │
│ 📝 User Stories                ✅ Complete                     │  
│ ✅ Acceptance Criteria         ✅ Complete                     │
│ 🏗️ Domain Model               ⚠️ In Progress (80%)            │
│ 🏛️ Bounded Contexts           ⏳ Pending                       │
│ 📐 Architecture Design        ⏳ Pending                       │
├─────────────────────────────────────────────────────────────────┤
│ Active Agents                                                   │
│ 🤖 DomainModelingAgent        🔄 Processing entities           │
│ 🔍 SDObservabilityAgent      👁️ Monitoring progress           │
│ 📊 ProjectManagerAgent        🎯 Coordinating workflow         │
└─────────────────────────────────────────────────────────────────┘
```

**MVVM Architecture**
- **Model**: ProjectDashboardModel managing project state and data
- **View**: ProjectDashboardView handling DOM rendering and updates  
- **ViewModel**: ProjectDashboardViewModel coordinating between model and view
- **Umbilical Interface**: Clean external API following umbilical protocol

### Enhanced Chat Integration

**New Slash Commands**

`/project status`
```
Response: Complete project status overview
- Current phase and progress
- Deliverable completion summary  
- Active agents and their tasks
- Recent milestone achievements
- Next steps and blockers
```

`/project plan <goal>`
```
Response: Initialize new project planning
- Parse goal and requirements
- Generate project structure
- Create deliverable definitions
- Initiate ProjectManagerAgent
- Display planning results
```

`/project deliverables`
```
Response: Detailed deliverable status
- Per-phase deliverable lists
- Completion percentages
- Quality metrics
- Dependency relationships
- Blocker identification
```

`/project phase <phase_name>`
```
Response: Phase-specific information
- Phase objectives and requirements
- Current deliverables in phase
- Agent assignments and progress
- Completion criteria
- Transition readiness
```

**Enhanced Chat Responses**
- Project context awareness in LLM responses
- Automatic project status inclusion when relevant
- Deliverable progress mentions in tool execution results
- Phase transition notifications in chat feed

---

## Integration Points

### ProjectManagerAgent ↔ SDObservabilityAgent
```javascript
// ProjectManagerAgent notifies about project events
await observabilityAgent.onProjectEvent(projectId, 'phase_transition', {
  from: 'requirements',
  to: 'domain',
  timestamp: Date.now()
});

// SDObservabilityAgent provides monitoring data
const metrics = await observabilityAgent.getProjectMetrics(projectId);
await projectManager.updateProjectHealth(metrics);
```

### Actor Framework ↔ UI Components
```javascript
// Server actor broadcasts project updates
this.remoteActor.receive('project_update', {
  type: 'deliverable_completed',
  projectId: 'auth-system-001',
  deliverable: 'user_stories',
  phase: 'requirements',
  completion: 100
});

// Client actor updates dashboard
clientActor.onProjectUpdate = (data) => {
  dashboardComponent.updateDeliverable(data.deliverable, data.completion);
};
```

### Chat Interface ↔ Project Management
```javascript
// Enhanced message routing in GeminiRootServerActor
if (message.startsWith('/project')) {
  const projectCommand = this.parseProjectCommand(message);
  const response = await this.projectManager.handleCommand(projectCommand);
  this.remoteActor.receive('project_response', response);
} else {
  // Existing LLM processing with project context
  const context = await this.projectManager.getProjectContext();
  const response = await this.conversationManager.processMessage(message, context);
}
```

### SD Tools ↔ Project State
```javascript
// SD tools notify project manager of completions
class RequirementParserTool extends ToolBase {
  async execute(params) {
    const result = await this.performRequirementParsing(params);
    
    // Notify project manager of deliverable completion
    await this.projectManager?.onDeliverableCompleted({
      deliverable: 'requirements_analysis',
      phase: 'requirements',
      result: result,
      quality: this.assessQuality(result)
    });
    
    return result;
  }
}
```

---

## User Experience Design

### Chat Interface Workflow

**Project Initiation**
1. User: "I want to build a user authentication system"
2. Agent: Detects development intent, suggests project planning
3. User: "/project plan user authentication system"  
4. Agent: Creates project, shows deliverables, opens dashboard window
5. ProjectManagerAgent: Begins requirements phase

**Project Monitoring**
1. Dashboard window shows real-time progress
2. Chat continues with development questions
3. Agent provides project-aware responses
4. Slash commands give instant project status
5. Phase transitions appear in both chat and dashboard

**Deliverable Completion**
1. Agent completes requirements analysis using SD tools
2. ProjectManagerAgent updates deliverable status
3. SDObservabilityAgent broadcasts completion event
4. Dashboard immediately reflects completion (✅)
5. Chat shows completion notification
6. Next phase deliverables become active

### Dashboard Interaction Model

**Window Management**
- Draggable, resizable floating window
- Minimizable but preserves state
- Always-on-top option for monitoring
- Remembers position and size preferences

**Interactive Elements**
- Click phases to see detailed breakdown
- Click deliverables to view artifacts
- Click agents to see current activity
- Progress bars show completion percentages
- Color coding for status (green=complete, yellow=progress, red=blocked)

**Real-time Updates**
- WebSocket-driven live updates
- Smooth animations for progress changes
- Instant reflection of agent activity
- No manual refresh required

---

## Data Models

### Project State Model
```javascript
interface ProjectState {
  id: string;
  name: string;
  description: string;
  phase: ProjectPhase;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  estimatedCompletion?: Date;
  
  deliverables: Map<string, Deliverable>;
  agents: Map<string, AgentAssignment>;
  artifacts: Map<string, Artifact>;
  timeline: PhaseTransition[];
  metrics: ProjectMetrics;
}

type ProjectPhase = 'requirements' | 'domain' | 'architecture' | 'implementation' | 'testing';
type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'failed';
```

### Deliverable Model
```javascript
interface Deliverable {
  id: string;
  name: string;
  description: string;
  phase: ProjectPhase;
  status: DeliverableStatus;
  completion: number; // 0-100
  
  dependencies: string[]; // Other deliverable IDs
  artifacts: string[];    // Artifact IDs
  assignedAgent?: string;
  
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  qualityMetrics?: QualityMetrics;
  completionCriteria: CompletionCriteria;
}

type DeliverableStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'blocked';
```

### Agent Assignment Model
```javascript
interface AgentAssignment {
  agentId: string;
  agentType: string;
  status: AgentStatus;
  
  assignedDeliverables: string[];
  currentTask?: TaskDefinition;
  
  assignedAt: Date;
  lastActivity: Date;
  
  metrics: AgentMetrics;
}

type AgentStatus = 'available' | 'busy' | 'blocked' | 'error' | 'completed';
```

### Project Metrics Model
```javascript
interface ProjectMetrics {
  totalDeliverables: number;
  completedDeliverables: number;
  inProgressDeliverables: number;
  blockedDeliverables: number;
  
  phaseProgress: Map<ProjectPhase, number>; // 0-100
  
  timeMetrics: {
    totalTimeSpent: number; // minutes
    averageDeliverableTime: number;
    estimatedTimeRemaining: number;
  };
  
  qualityMetrics: {
    averageQualityScore: number;
    reworkCount: number;
    validationPassRate: number;
  };
  
  agentMetrics: {
    totalAgentsUsed: number;
    averageAgentEfficiency: number;
    agentUtilization: Map<string, number>;
  };
}
```

---

## API Specifications

### ProjectManagerAgent API

**Project Lifecycle**
```javascript
// Initialize new project
async initializeProject(requirements: ProjectRequirements): Promise<ProjectState>

// Plan project deliverables and phases  
async planProject(goal: string, context: ProjectContext): Promise<ProjectPlan>

// Execute specific project phase
async executePhase(phase: ProjectPhase): Promise<PhaseResult>

// Get current project status
async getProjectStatus(projectId: string): Promise<ProjectState>

// Update project configuration
async updateProject(projectId: string, updates: Partial<ProjectState>): Promise<ProjectState>
```

**Deliverable Management**
```javascript
// Get deliverables for phase or project
async getDeliverables(projectId: string, phase?: ProjectPhase): Promise<Deliverable[]>

// Update deliverable status
async updateDeliverable(projectId: string, deliverableId: string, updates: Partial<Deliverable>): Promise<Deliverable>

// Mark deliverable completed
async completeDeliverable(projectId: string, deliverableId: string, result: DeliverableResult): Promise<void>

// Check deliverable dependencies
async checkDependencies(projectId: string, deliverableId: string): Promise<DependencyStatus>
```

**Agent Coordination**
```javascript
// Assign agent to deliverable
async assignAgent(projectId: string, deliverableId: string, agentId: string): Promise<AgentAssignment>

// Get agent assignments
async getAgentAssignments(projectId: string): Promise<AgentAssignment[]>

// Update agent status
async updateAgentStatus(projectId: string, agentId: string, status: AgentStatus): Promise<void>
```

### SDObservabilityAgent Enhanced API

**Project Monitoring**
```javascript
// Subscribe to project events
async subscribeToProject(projectId: string): Promise<void>

// Get project metrics
async getProjectMetrics(projectId: string): Promise<ProjectMetrics>

// Generate project report
async generateProjectReport(projectId: string, reportType: ReportType): Promise<ProjectReport>

// Broadcast project update
async broadcastProjectUpdate(projectId: string, update: ProjectUpdate): Promise<void>
```

### Chat Integration API

**Slash Commands**
```javascript
// Handle project slash commands
async handleProjectCommand(command: string, args: string[]): Promise<CommandResponse>

// Get project context for LLM
async getProjectContext(projectId?: string): Promise<ProjectContext>

// Format project status for chat
async formatProjectStatus(projectId: string): Promise<string>
```

### WebSocket Events

**Client → Server**
```javascript
// Subscribe to project updates
{
  type: 'subscribe_project',
  projectId: string
}

// Request project status
{
  type: 'get_project_status', 
  projectId: string
}
```

**Server → Client**
```javascript
// Project status update
{
  type: 'project_update',
  projectId: string,
  updateType: 'deliverable_completed' | 'phase_transition' | 'agent_assigned' | 'status_change',
  data: ProjectUpdateData
}

// Agent activity update
{
  type: 'agent_activity',
  projectId: string,
  agentId: string,
  activity: AgentActivity
}
```

---

## Review Request

This design document outlines a comprehensive project management system that extends the existing Gemini Agent with SD tools integration. The solution provides:

- **Central project coordination** through the new ProjectManagerAgent
- **Enhanced monitoring** via the extended SDObservabilityAgent  
- **Visual project management** through a floating dashboard component
- **Seamless chat integration** with project-aware responses and slash commands
- **Real-time updates** using WebSocket communication
- **Comprehensive deliverable tracking** across the five-phase SD methodology

The design leverages existing SD module capabilities while introducing new coordination and visualization layers. All components follow established patterns (SDAgentBase, MVVM umbilical protocol, actor framework) ensuring consistency with the Legion architecture.

**Please review this design document and provide feedback on:**
1. Architecture and component organization
2. Integration points and API design
3. User experience and interface design
4. Data models and state management
5. Any missing capabilities or concerns

Your review will help refine this design before implementation begins.