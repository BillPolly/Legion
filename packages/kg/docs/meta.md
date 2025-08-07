# Knowledge Graph Metamodel Design

## Core Principles

- **Universal Inheritance**: Everything inherits from `Thing` with monotonic inheritance only
- **Attribute Specialization**: Everything can be specialized, including attributes themselves
- **Non-trivial Specialization**: When specializing any Thing, you must specialize at least one attribute (prevents meaningless inheritance)
  - This includes adding new attributes (specializing from "no attribute" to "having attribute")
  - Or making existing attributes more restrictive (domain reduction)
- **Domain Reduction**: Specialization = making attribute domains more restrictive 
- **Unified Relationships**: All relationships are represented as attributes
- **Single Hierarchy**: No separate class/instance distinction - everything is specialization
- **Self-describing**: The ontology is stored within the knowledge graph itself

## Metamodel Structure

```
Thing (specializes Thing)
├── Attribute (properties and relationships)
├── Kind 
│   ├── AtomicThing (abstract entities: numbers, measures, values)
│   ├── CompoundThing (entities with parts)
│   │   ├── Object (temporal, passive, gets transformed by processes)
│   │   └── Process (temporal, active, transforms objects)
│   └── Part (functional usage role within compound things)
```

## Key Mechanics

### State Categories
- **Entity**: Persistent compound things that exist over time (Person, Car, Organization, Database)
- **State**: States that any Thing can be in (Healthy, Broken, Valid, Active, Prime)
- Processes transform Things from one State to another within a context

### Attributes as Relationship Ends
- Every attribute is one end of a binary relationship
- **Relationship entities**: Reified binary relationships that exist as Things in the ontology
- **Dependent attributes**: Ontologically depend on their owner, cardinality exactly 1
  - Examples: `Person.birthdate`, `Car.serialNumber`, `House.roomPosition`
  - The dependent entity cannot exist without its owner
- **Independent attributes**: Reference independently existing entities, various cardinalities
  - Examples: `Person.employer`, `Car.manufacturer`, `Student.courses`  
  - The referenced entity has its own lifecycle
- **Inverse attributes**: Only included when they add meaningful clarity to the model
  - Examples: `name` ↔ `namedThing`, `parts` ↔ `partOf` (useful for navigation)
  - Mechanical inverses like `domainOf`, `rangeOf` are omitted as they don't clarify the model

### Attribute Instance Storage
Attributes store their properties using an array format where each element can be either:
- **String**: Simple attribute reference (e.g., `"name"`)
- **Object**: Specialized attribute with constant value (e.g., `{"domain": "thing"}`)

```json
{
  "_id": "name",
  "subtypeOf": "attribute", 
  "attributes": [
    {"domain": "thing"},
    {"range": "string"},
    {"cardinality": "1"},
    {"dependent": true},
    {"inverse": "namedThing"}
  ]
}
```

This represents that the `name` attribute has:
- `domain: "thing"` (specialization of the domain attribute to the constant "thing")
- `range: "string"` (specialization of the range attribute to the constant "string")
- `cardinality: "1"` (specialization of the cardinality attribute to the constant "1")
- `dependent: true` (specialization of the dependent attribute to the constant true)
- `inverse: "namedThing"` (specialization of the inverse attribute to the constant "namedThing")

### Attribute Reference vs Specialization Pattern

**Attribute References (Strings):**
```json
{
  "_id": "thing",
  "attributes": ["name", "description"]  // Simple references to attribute definitions
}
```

**Attribute Specializations (Objects):**
```json
{
  "_id": "name",
  "attributes": [
    {"domain": "thing"},      // Specialization of domain to constant "thing"
    {"range": "string"},      // Specialization of range to constant "string"
    {"cardinality": "1"}      // Specialization of cardinality to constant "1"
  ]
}
```

### Key:Value Specialization Pattern
When you have an attribute definition like `myattr` with `range: string`, then `{"myattr": "specificvalue"}` is a **specialization** where:
- The range has been reduced from "any string" to the specific constant "specificvalue"
- This follows the core principle that specialization = domain reduction
- The object represents a more restrictive version of the general attribute

**Examples:**
```
General: name attribute with range "string"
  ↓ (specialization to constant)
Specialized: {"name": "John"} (specific instance with constant value)

General: age attribute with range "number"  
  ↓ (specialization to constant)
Specialized: {"age": 25} (specific instance with constant value)

General: status attribute with range "string"
  ↓ (specialization to constant)  
Specialized: {"status": "active"} (specific instance with constant value)
```

**Why this is specialization:**
- The general attribute `name` with range `string` can hold any string value
- The specialized version `{"name": "John"}` can only hold the specific value "John"
- This is domain reduction: from "all possible strings" to "exactly this string"
- It follows monotonic inheritance: the specialized version is more restrictive, never less

**Array Format Benefits:**
- Clean separation between references and specializations
- JSON-native object structure for specializations (no string parsing)
- Easy iteration and processing
- Clear distinction between general attributes and constant values

### Compound Things and Part Positions
- `CompoundThing.parts: [PartPosition]` 
- Part positions are **dependent** structural slots that define what can fill them
- Part positions can be specialized: `House.roomPosition: Room` → `Bungalow.roomPosition: GroundFloorRoom`
- Part positions can nest: `House.floorPositions: [Floor]` where `Floor.roomPositions: [Room]`
- The actual fillers are **independent** entities that occupy positions over time
- Part relationships track temporal bindings: `PartPosition ← Filler (start_time - end_time)`

### Processes and State Transformation
- `Process.inputState: State` 
- `Process.outputState: State`
- Processes affect objects by changing them from a starting state to a finishing state
- For the process to be applicable, the object's current state must satisfy the state the process is expecting (inputState)
- The process then transforms the object to the specified finishing state (outputState)
- States can apply to ANY Thing (Entities, AtomicThings, Attributes, etc.)
- Context is implicit from part-whole relationships
- Processes happen "within" their containing CompoundThing

### Constraints
- **Physical Reality**: All physical things are compound; only abstract entities are atomic
- **Temporal Agency**: Objects are passive (acted upon), Processes are active (act on objects)
- **Transformation Requirement**: If no state transformation occurs, it's not a Process
- **Relationship Structure**: Every Relationship has exactly one dependent and one independent Attribute
  - Peer relationships (e.g., `Person.knows: Person`) and n-ary relationships are modeled as entities with multiple binary relationships
- **Universal States**: States can apply to any Thing, not just Entities

## Example Domain Application: Service Matching

This section demonstrates how the metamodel can be applied to model a complete real-world domain - service matching for task-based work. The example shows how abstract foundational concepts specialize into concrete domain entities while maintaining the core ontological principles.

### Domain Requirements
- Model professions and their capabilities
- Model tasks with hierarchical structure (tasks containing subtasks/steps)  
- Tasks act on Entities that must be in specific Conditions
- Task steps are specialized Tasks with additional properties (duration, cost)
- Lowest level steps involve: skill application, tool use, component/consumable use
- Support finding service providers who can perform tasks
- Enable cost estimation for task completion

### Ontology Specialization from Metamodel

#### Tasks as Process Specializations
Tasks naturally specialize `Process` since they transform Entities from one Condition to another:

```
Process
  ↓
Task
  ↓
PlumbingRepair: inputState=LeakyPipeCondition, outputState=FixedPipeCondition
BrakeRepair: inputState=WornBrakeCondition, outputState=NewBrakeCondition
WebsiteDevelopment: inputState=NoWebsiteCondition, outputState=LiveWebsiteCondition
```

#### Task Hierarchy via Part Mechanism
Since `Process` specializes `CompoundThing`, tasks can have hierarchical structure using the Part mechanism:

```
Task.parts: [TaskStep]
TaskStep (specializes Part)
  duration: Duration
  cost: Money
  taskDefinition: Task (the actual task being performed)
```

Example decomposition:
```
PlumbingRepair.parts: [DiagnoseStep, RepairStep, TestStep]
DiagnoseStep.taskDefinition: PipeInspection
DiagnoseStep.duration: 30_minutes
DiagnoseStep.cost: $50

RepairStep.taskDefinition: PipeReplacement  
RepairStep.duration: 2_hours
RepairStep.cost: $200
```

#### Entities and Target Conditions
Tasks act on specific Entities that must be in particular Conditions:

```
PlumbingRepair (Task)
  targetEntity: PipingSystem (Entity)
  inputState: LeakyCondition (Condition)
  outputState: FixedCondition (Condition)
  context: House (implied from part-whole relationship)
```

#### Lowest Level Task Specializations
Leaf-level tasks specialize into specific resource usage patterns:

```
Task
├── SkillApplicationTask
│   skill: Skill (Entity)
│   proficiencyLevel: SkillLevel (AtomicThing)
├── ToolUseTask  
│   tool: Tool (Entity)
│   operationTime: Duration (AtomicThing)
├── ComponentUseTask
│   component: Component (Entity)  
│   quantity: Number (AtomicThing)
└── ConsumableUseTask
    consumable: Consumable (Entity)
    quantity: Number (AtomicThing)
```

#### Resources as Entity Specializations
Skills, tools, components, and consumables are modeled as Entity specializations:

```
Entity
├── Skill (PlumbingSkill, ElectricalSkill, ProgrammingSkill)
├── Tool (Wrench, Drill, Laptop, TestMeter)  
├── Component (Pipe, Wire, Database, SoftwareModule)
└── Consumable (Solder, PipeTape, ServerTime, APICredits)
```

#### Service Providers as Entity Specializations
Service providers specialize Entity with profession-related attributes:

```
Entity
  ↓
Person
  ↓  
ServiceProvider
  profession: Profession (Entity or Condition)
  skills: [Skill] (independent attribute, cardinality 0..*)
  tools: [Tool] (independent attribute, cardinality 0..*)
  location: GeographicRegion (Entity)
  hourlyRate: Money (AtomicThing)
```

#### Complete Example: Bathroom Renovation
```
BathroomRenovation (Task - specializes Process)
  targetEntity: Bathroom (Entity)
  inputState: OldBathroomCondition
  outputState: RenovatedBathroomCondition
  
  parts: [DemolitionStep, PlumbingStep, TilingStep, FinishingStep]
  
  PlumbingStep (TaskStep)
    taskDefinition: PlumbingInstallation (Task)
    duration: 8_hours  
    cost: $800
    
    PlumbingInstallation.parts: [PipeReplacementStep, FixtureInstallStep]
    
    PipeReplacementStep (TaskStep)
      taskDefinition: PipeReplacement (SkillApplicationTask)
      skill: PlumbingSkill
      tools: [PipeWrench, PipeCutter]
      components: [CopperPipe, PipeJoints]
      duration: 4_hours
      cost: $400
```

#### Service Matching Capabilities
This model enables sophisticated service matching through:

1. **Task decomposition**: Break complex tasks into TaskSteps
2. **Resource identification**: Extract required skills, tools, components from leaf tasks  
3. **Provider search**: Find ServiceProviders with matching capabilities
4. **Constraint checking**: Verify provider location, availability, cost constraints
5. **Cost estimation**: Sum TaskStep costs based on provider rates

Example query: *"Find ServiceProviders in PlumberCondition with PlumbingSkill and WrenchTool within 50km of target location"*

### Key Insights from Domain Application

**Complete metamodel coverage**: Every domain concept maps naturally to metamodel categories without forcing or gaps.

**Hierarchical decomposition**: The Part mechanism elegantly handles task breakdown from complex projects to atomic skill applications.

**State transformation clarity**: Process/Condition modeling makes task requirements and outcomes explicit.

**Resource polymorphism**: Different resource types (skills, tools, components) are unified under Entity while maintaining their distinctions.

**Query composability**: Standard attribute queries support complex service matching without special mechanisms.

This example demonstrates how the metamodel's foundational abstractions can specialize into rich, practical domain models while maintaining ontological consistency and enabling sophisticated reasoning.

## Bootstrap Foundation
- `Thing` specializes `Thing` (self-referential root)
- `Attribute` and `Kind` are the first specializations of `Thing`
- All subsequent concepts built through specialization of these foundations

## Basic Examples

### Attribute Specialization
```
relatedTo: Thing
  ↓ (domain reduction)
knows: Person  
  ↓ (domain reduction + constraint)
spouse: Person (cardinality: exactly 1)
```

### Adding New Attributes (also specialization)
```
Thing
  ↓ (adds age attribute)
Person: age: Number
  ↓ (restricts age domain)  
Adult: age: 18..120
```

### Part Position Usage
```
Car.enginePosition (dependent part position)
  ← Engine_123 (Jan 1 - Mar 15)  
  ← Engine_456 (Mar 20 - ongoing)

House.floorPositions: [GroundFloor] (nested positions)
GroundFloor.roomPositions: [KitchenPosition, BedroomPosition]
KitchenPosition ← Kitchen_789
```

### Dependent vs Independent Attributes
```
Person.birthdate: DateTime (dependent, cardinality 1)
Person.employer: Company (independent, cardinality 0..1) 
Person.children: Person (independent, cardinality 0..*)

Car.enginePosition: Engine (dependent part position, cardinality 1)
Car.manufacturer: Company (independent, cardinality 1)
```

### Process Transformation
```
HealingProcess (Process within Person context)
  inputState: SickCondition (applied to Person)
  outputState: HealthyCondition (applied to Person)

ValidationProcess (Process within System context)  
  inputState: UnverifiedCondition (applied to Data)
  outputState: ValidatedCondition (applied to Data)

CalculationProcess (Process within Calculator context)
  inputState: UnknownCondition (applied to Number)
  outputState: ComputedCondition (applied to Number)
```
