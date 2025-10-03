# Upper-Level Ontology Implementation

## Overview

The Legion knowledge management system now includes a BFO-inspired upper-level ontology that automatically categorizes all domain entities into fundamental types. This enables sophisticated process modeling, state tracking, and task management.

## Categories

### Continuant (Things that persist through time)

**PhysicalEntity** - Material objects that have physical presence
- Examples: WaterHeater, PressureRegulator, Pipe, Valve, Pump, Tank
- Properties: Can have physical measurements (dimensions, capacity, weight)
- Usage: Equipment, components, materials, infrastructure

**State** - Conditions or configurations
- Examples: Temperature, Pressure, ValvePosition, OperationalMode
- Properties: Usually have values and units
- Usage: Sensor readings, configuration states, conditions

### Occurrent (Things that happen)

**Process** - Natural or industrial transformations
- Examples: Heating, Cooling, Pumping, Mixing, Flowing
- Properties: Has preconditions, postconditions, participants
- Usage: Continuous activities, transformations, operations

**Task** - Planned, goal-directed activities
- Examples: Maintenance, Inspection, Repair, Calibration
- Properties: Assigned to agents, has procedures
- Usage: Scheduled activities, work orders, procedures

## Special Relationships

### Process-State Relationships

**requiresPrecondition** (Process → State)
- Links a process to states that must hold before it can begin
- Example: Heating requiresPrecondition InletTemperature(50°F)

**producesPostcondition** (Process → State)
- Links a process to states that hold after it completes
- Example: Heating producesPostcondition OutletTemperature(140°F)

**transforms** (Process → PhysicalEntity)
- Links a process to physical entities it acts upon
- Example: Heating transforms WaterHeater

**hasParticipant** (Process → PhysicalEntity)
- Links a process to entities involved without being transformed
- Example: Pumping hasParticipant Pump

### State-Entity Relationships

**stateOf** (State → PhysicalEntity)
- Links a state to the entity it describes
- Example: Temperature stateOf Tank

## Automatic Categorization

### LLM Guidance

The extraction prompt provides clear guidance to the LLM:

```handlebars
UPPER-LEVEL CATEGORIES:
All entities must be categorized as one of:
- PhysicalEntity: Physical objects (equipment, components, materials)
- State: Conditions, configurations, situations
- Process: Natural or industrial transformations
- Task: Planned activities

For each class, include:
- suggestedSupertype: One of "PhysicalEntity", "State", "Process", or "Task" (REQUIRED)
```

### Example LLM Output

```json
{
  "classes": [
    {
      "name": "WaterHeater",
      "suggestedSupertype": "PhysicalEntity",
      "definition": "A device that heats water...",
      "supertypeDescription": "A type of PhysicalEntity that uses energy to increase water temperature",
      "usageDescription": "Used for providing hot water in residential and commercial buildings",
      "synonyms": "water heater, hot water tank, boiler"
    },
    {
      "name": "Heating",
      "suggestedSupertype": "Process",
      "definition": "A thermodynamic process that increases temperature...",
      "supertypeDescription": "A type of Process that transfers thermal energy",
      "usageDescription": "Used to raise temperature of substances to desired levels",
      "synonyms": "heating, warming, heat transfer"
    }
  ]
}
```

### Parent Determination

```javascript
// OntologyExtensionService.js
async determineParentClass(newClass, domain, createdParents) {
  // If LLM provided a category hint, use it directly
  if (newClass.suggestedSupertype) {
    const categoryMap = {
      'PhysicalEntity': 'kg:PhysicalEntity',
      'State': 'kg:State',
      'Process': 'kg:Process',
      'Task': 'kg:Task'
    };
    return categoryMap[newClass.suggestedSupertype];
  }

  // Otherwise, use LLM-based abstraction
  // ...
}
```

## Querying by Category

### Entity Queries

```javascript
// Find all physical entities
const physicalEntities = await knowledgeGraphStore.findPhysicalEntities();
// Returns: [WaterHeater WH-101, PressureRegulator PR-200, ...]

// Find all states
const states = await knowledgeGraphStore.findStates();
// Returns: [InletTemperature 50°F, OutletTemperature 140°F, ...]

// Find all processes
const processes = await knowledgeGraphStore.findProcesses();
// Returns: [HeatingProcess, CoolingProcess, ...]

// Find all tasks
const tasks = await knowledgeGraphStore.findTasks();
// Returns: [MaintenanceInspection, RepairTask, ...]
```

### Process Relationship Queries

```javascript
// Get preconditions for a process
const preconditions = await knowledgeGraphStore.findProcessPreconditions(heatingProcessId);
// Returns: [InletTemperature 50°F]

// Get postconditions for a process
const postconditions = await knowledgeGraphStore.findProcessPostconditions(heatingProcessId);
// Returns: [OutletTemperature 140°F]

// Get entities transformed by a process
const transformed = await knowledgeGraphStore.findProcessTransforms(heatingProcessId);
// Returns: [WaterHeater WH-101]
```

### Category Inference

```javascript
// Infer category for an ontology type
const category = await knowledgeGraphStore.inferCategory('kg:WaterHeater');
// Returns: "PhysicalEntity"

const category = await knowledgeGraphStore.inferCategory('kg:Heating');
// Returns: "Process"
```

## Implementation Architecture

### Bootstrap Loading

```javascript
// OntologyBuilder automatically loads bootstrap on first use
async ensureBootstrapLoaded() {
  if (this.bootstrapLoaded) return;

  // Check if already loaded
  const continuantCheck = await this.tripleStore.query('kg:Continuant', 'rdf:type', 'owl:Class');
  if (continuantCheck.length > 0) {
    this.bootstrapLoaded = true;
    return;
  }

  // Load bootstrap triples
  const bootstrapTriples = getBootstrapTriples();
  for (const [subject, predicate, object] of bootstrapTriples) {
    await this.tripleStore.add(subject, predicate, object);
  }

  // Index in semantic search
  await this._indexBootstrapClasses();

  this.bootstrapLoaded = true;
}
```

### Hierarchy Traversal

```javascript
// Category checking uses ancestor traversal
export async function isPhysicalEntity(ontologyType, getAncestors) {
  if (ontologyType === 'kg:PhysicalEntity') return true;
  const ancestors = await getAncestors(ontologyType);
  return ancestors.includes('kg:PhysicalEntity');
}

// Example hierarchy:
// kg:CentrifugalPump → kg:Pump → kg:PhysicalEntity → kg:Continuant → owl:Thing
const ancestors = await hierarchyTraversal.getAncestors('kg:CentrifugalPump');
// Returns: ['kg:Pump', 'kg:PhysicalEntity', 'kg:Continuant', 'owl:Thing']
```

## Plumbing Domain Example

### Input Text

```
The water heater heats incoming cold water to 140 degrees Fahrenheit.
Before heating begins, the inlet temperature must be between 40 and 60 degrees Fahrenheit.
After the heating process completes, the outlet temperature reaches 140 degrees Fahrenheit.
The pressure regulator reduces street water pressure from 80 PSI to 50 PSI.
Annual maintenance inspections check for leaks and proper water pressure.
```

### Extracted Ontology (Categorized)

**Physical Entities (3):**
- WaterHeater
- Outlet
- PressureRegulator

**Processes (1):**
- HeatingProcess

**States (2):**
- Temperature
- WaterPressure

**Tasks (1):**
- MaintenanceInspection

### Entity Instances

```javascript
// Physical Entity Instance
{
  _id: ObjectId("..."),
  graphType: "entity",
  ontologyType: "kg:WaterHeater",
  label: "Water Heater WH-101",
  attributes: { capacity: 50, unit: "gallons" },
  provenance: { mentionedIn: ["sent_1"], confidence: 0.95 }
}

// State Instance
{
  _id: ObjectId("..."),
  graphType: "entity",
  ontologyType: "kg:InletTemperature",
  label: "Inlet Temperature 50°F",
  attributes: { value: 50, unit: "F", location: "inlet" },
  provenance: { mentionedIn: ["sent_2"], confidence: 0.92 }
}

// Process Instance
{
  _id: ObjectId("..."),
  graphType: "entity",
  ontologyType: "kg:HeatingProcess",
  label: "Water Heating Process",
  attributes: { targetTemp: 140 },
  provenance: { mentionedIn: ["sent_3"], confidence: 0.94 }
}
```

### Relationship Instances

```javascript
// Precondition Relationship
{
  _id: ObjectId("..."),
  graphType: "relationship",
  ontologyType: "kg:requiresPrecondition",
  from: ObjectId("heatingProcessId"),
  to: ObjectId("inletTempId"),
  provenance: { mentionedIn: ["sent_3"], confidence: 0.9 }
}

// Postcondition Relationship
{
  _id: ObjectId("..."),
  graphType: "relationship",
  ontologyType: "kg:producesPostcondition",
  from: ObjectId("heatingProcessId"),
  to: ObjectId("outletTempId"),
  provenance: { mentionedIn: ["sent_3"], confidence: 0.9 }
}

// Transforms Relationship
{
  _id: ObjectId("..."),
  graphType: "relationship",
  ontologyType: "kg:transforms",
  from: ObjectId("heatingProcessId"),
  to: ObjectId("waterHeaterId"),
  provenance: { mentionedIn: ["sent_3"], confidence: 0.9 }
}
```

## Test Results

### Unit Tests (15 tests) ✅

```bash
✓ should return bootstrap triples
✓ should define Continuant category
✓ should define Occurrent category
✓ should define PhysicalEntity as subclass of Continuant
✓ should define State as subclass of Continuant
✓ should define Process as subclass of Occurrent
✓ should define Task as subclass of Occurrent
✓ should define disjointness axioms
✓ should define process-state relationships
✓ should include multi-perspective descriptions (SKOS)
✓ isPhysicalEntity should identify PhysicalEntity descendants
✓ isState should identify State descendants
✓ isProcess should identify Process descendants
✓ isTask should identify Task descendants
✓ inferCategory should categorize entities correctly

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Time:        0.071 s
```

### Integration Tests (2 tests) ✅

```bash
✓ Build ontology and demonstrate categorization (64s)
  - Processed 5 sentences
  - Created: 13 classes, 12 relationships
  - Physical Entities: 3
  - Processes: 1
  - States: 2
  - Tasks: 1

✓ Extract instances and demonstrate process modeling (0.5s)
  - Created Water Heater (PhysicalEntity)
  - Created Inlet Temperature (State)
  - Created Outlet Temperature (State)
  - Created Heating Process (Process)
  - Queried by category successfully
  - Process preconditions/postconditions tracked

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Time:        65.574 s
```

## Benefits

1. **Semantic Clarity** - Entities are automatically categorized by fundamental type
2. **Process Modeling** - Full support for preconditions, postconditions, and transformations
3. **State Tracking** - Conditions and configurations are first-class entities
4. **Task Management** - Planned activities are distinguished from natural processes
5. **Rich Queries** - Query by category, find process relationships, infer types
6. **LLM Guidance** - The LLM receives clear instructions for categorization
7. **Provenance** - All entities track which sentences mentioned them
8. **MongoDB Integration** - Entity instances stored with ObjectIds as canonical identifiers

## Files

### Core Implementation
- `src/bootstrap/upper-level-ontology.js` - Bootstrap triples and category inference helpers
- `src/OntologyBuilder.js` - Automatic bootstrap loading
- `src/prompts/extract-implied-types.hbs` - LLM guidance for categorization
- `src/services/GapAnalysisService.js` - Schema validation with suggestedSupertype
- `src/services/OntologyExtensionService.js` - Smart parent determination
- `packages/km/entity-store/src/KnowledgeGraphStore.js` - Category query methods

### Tests
- `__tests__/unit/UpperLevelOntology.test.js` - Bootstrap and inference tests (15 tests)
- `__tests__/integration/PlumbingDomain.Demo.test.js` - Full E2E demonstration (2 tests)

## Summary

The upper-level ontology implementation provides a robust foundation for knowledge modeling across any domain. By automatically categorizing entities into fundamental types (PhysicalEntity, State, Process, Task), the system enables sophisticated reasoning about processes, states, and their relationships. The plumbing domain demonstration shows how this works in practice with realistic text and full process modeling capabilities.
