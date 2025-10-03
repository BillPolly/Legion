# Plumbing System Knowledge Graph

**Domain:** Plumbing & HVAC
**Generated:** 2025-10-03T10:05:58.313Z
**Generator:** Legion Knowledge Graph System

## 📝 Source Text

The knowledge graph was built from the following input:

```
The water heater heats incoming cold water to 140 degrees Fahrenheit.
Before heating begins, the inlet temperature must be between 40 and 60 degrees Fahrenheit.
After the heating process completes, the outlet temperature reaches 140 degrees Fahrenheit.
The pressure regulator reduces street water pressure from 80 PSI to 50 PSI.
Annual maintenance inspections check for leaks and proper water pressure.
The expansion tank prevents pressure buildup in the hot water system.
```

---

## 📊 Overview

### Ontology Schema (RDF Triples)

| Metric | Count |
|--------|-------|
| Total Triples | 293 |
| Classes | 17 |
| Datatype Properties | 13 |
| Object Properties | 14 |

### Entity Instances (Knowledge Graph)

| Metric | Count |
|--------|-------|
| Total Items | 12 |
| Entities | 8 |
| Relationships | 4 |

### Instance Breakdown by Type

- **relationship:kg:producesPostcondition**: 1
- **entity:kg:OutletTemperature**: 1
- **entity:kg:InletTemperature**: 1
- **entity:kg:MaintenanceInspection**: 1
- **entity:kg:HeatingProcess**: 1
- **entity:kg:PressureRegulator**: 1
- **entity:kg:ExpansionTank**: 1
- **entity:kg:PressureRegulation**: 1
- **relationship:kg:requiresPrecondition**: 1
- **relationship:kg:transforms**: 1
- **entity:kg:WaterHeater**: 1
- **relationship:kg:hasParticipant**: 1

---

## 🏗️  Upper-Level Ontology


### Bootstrap Categories

The knowledge graph uses a BFO-inspired upper-level ontology that categorizes all entities into fundamental types.

```
owl:Thing
├── kg:Continuant (things that persist through time)
│   ├── kg:PhysicalEntity (material objects)
│   └── kg:State (conditions, configurations)
└── kg:Occurrent (things that happen)
    ├── kg:Process (natural/industrial transformations)
    └── kg:Task (planned, goal-directed activities)
```


### Process-State Relationships

- **requires precondition** (kg:requiresPrecondition): kg:Process → kg:State
- **produces postcondition** (kg:producesPostcondition): kg:Process → kg:State
- **transforms** (kg:transforms): kg:Process → kg:PhysicalEntity
- **has participant** (kg:hasParticipant): kg:Process → kg:PhysicalEntity

---

## 🎯 Domain Ontology
### 🔧 Physical Entities

_Material objects that have physical presence_

#### WaterHeater
**URI:** `kg:WaterHeater`  
**Parent:** `kg:PhysicalEntity`

**Definition:** An appliance or device designed to increase the temperature of water for residential, commercial or industrial use. Contains heating elements and temperature control mechanisms to maintain desired water temperature.

**Description:** A type of PhysicalEntity that converts energy into heat for raising water temperature.

#### PressureRegulator
**URI:** `kg:PressureRegulator`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A mechanical device that automatically reduces and maintains fluid pressure from a higher inlet pressure to a lower outlet pressure. Contains internal components like diaphragms, springs, and adjustable mechanisms to control pressure reduction.

**Description:** A type of PhysicalEntity that modifies and controls fluid pressure in a system.

#### ExpansionTank
**URI:** `kg:ExpansionTank`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A vessel designed to accommodate the expansion of heated water in a closed system. Contains an air cushion or diaphragm that compresses as water volume increases, maintaining system pressure within safe limits.

**Description:** A type of PhysicalEntity that acts as a protective component in pressurized fluid systems.

#### HotWaterSystem
**URI:** `kg:HotWaterSystem`  
**Parent:** `kg:PhysicalEntity`

**Definition:** An integrated network of components designed to heat, store, and distribute hot water. Includes heating elements, pipes, tanks, and safety devices working together.

**Description:** A type of PhysicalEntity comprising multiple interconnected components for managing heated water.
### 📊 States

_Conditions, configurations, or situations_

#### InletTemperature
**URI:** `kg:InletTemperature`  
**Parent:** `kg:State`

**Definition:** A measurable thermal condition representing the temperature of a fluid or material at the point where it enters a system or process. Typically measured in degrees Fahrenheit or Celsius.

**Description:** A type of State that characterizes the thermal condition of incoming material or fluid.

#### OutletTemperature
**URI:** `kg:OutletTemperature`  
**Parent:** `kg:State`

**Definition:** The measured temperature at the exit or discharge point of a system or process. Represents the thermal state of the material after processing.

**Description:** A type of State that characterizes the thermal condition at a system's output point.

#### WaterPressure
**URI:** `kg:WaterPressure`  
**Parent:** `kg:State`

**Definition:** The force per unit area exerted by water within a system. A critical operational parameter that affects system performance and functionality.

**Description:** A type of State that describes the internal force characteristics of water in a system.

#### PressureBuildup
**URI:** `kg:PressureBuildup`  
**Parent:** `kg:State`

**Definition:** The condition where fluid pressure increases beyond normal operating parameters in a closed system. Can result from thermal expansion or system malfunction.

**Description:** A type of State representing elevated pressure conditions in a fluid system.
### ⚙️  Processes

_Natural or industrial transformations_

#### Heating
**URI:** `kg:Heating`  
**Parent:** `kg:Process`

**Definition:** A thermal process that increases the temperature of a material or substance through the addition of thermal energy. Can be achieved through various methods including direct heat transfer, radiation, or convection.

**Description:** A type of Process that involves the transfer of thermal energy to raise temperature.

#### HeatingProcess
**URI:** `kg:HeatingProcess`  
**Parent:** `kg:Process`

**Definition:** A thermal operation that increases the temperature of a substance or material over time. Involves the transfer of heat energy to achieve a target temperature.

**Description:** A type of Process that specifically involves adding thermal energy to increase temperature.
### ✅ Tasks

_Planned, goal-directed activities_

#### MaintenanceInspection
**URI:** `kg:MaintenanceInspection`  
**Parent:** `kg:Task`

**Definition:** A scheduled examination procedure performed at regular intervals to verify equipment condition and performance. Involves systematic checking of components, measurements, and documentation of findings.

**Description:** A type of Task that involves examining and evaluating system components on a recurring basis.

---

## 🔗 Properties & Relationships
### 📝 Datatype Properties

- **temperature** (`kg:temperature`)
  - Domain: `kg:Water`
  - Range: `xsd:string`
- **targetTemperature** (`kg:targetTemperature`)
  - Domain: `kg:WaterHeater`
  - Range: `xsd:string`
- **temperatureValue** (`kg:temperatureValue`)
  - Domain: `kg:InletTemperature`
  - Range: `xsd:string`
- **temperatureUnit** (`kg:temperatureUnit`)
  - Domain: `kg:InletTemperature`
  - Range: `xsd:string`
- **minimumTemperature** (`kg:minimumTemperature`)
  - Domain: `kg:InletTemperature`
  - Range: `xsd:string`
- **maximumTemperature** (`kg:maximumTemperature`)
  - Domain: `kg:InletTemperature`
  - Range: `xsd:string`
- **inletPressure** (`kg:inletPressure`)
  - Domain: `kg:PressureRegulator`
  - Range: `xsd:string`
- **outletPressure** (`kg:outletPressure`)
  - Domain: `kg:PressureRegulator`
  - Range: `xsd:string`
- **pressureReduction** (`kg:pressureReduction`)
  - Domain: `kg:PressureRegulator`
  - Range: `xsd:string`
- **inspectionFrequency** (`kg:inspectionFrequency`)
  - Domain: `kg:MaintenanceInspection`
  - Range: `xsd:string`
- **pressureValue** (`kg:pressureValue`)
  - Domain: `kg:WaterPressure`
  - Range: `xsd:string`
- **systemPressure** (`kg:systemPressure`)
  - Domain: `kg:HotWaterSystem`
  - Range: `xsd:string`
- **operatingTemperature** (`kg:operatingTemperature`)
  - Domain: `kg:HotWaterSystem`
  - Range: `xsd:string`

### 🔀 Object Properties (Relationships)

- **requires precondition** (`kg:requiresPrecondition`)
  - Domain: `kg:Process`
  - Range: `kg:State`
- **produces postcondition** (`kg:producesPostcondition`)
  - Domain: `kg:Process`
  - Range: `kg:State`
- **transforms** (`kg:transforms`)
  - Domain: `kg:Process`
  - Range: `kg:PhysicalEntity`
- **has participant** (`kg:hasParticipant`)
  - Domain: `kg:Process`
  - Range: `kg:PhysicalEntity`
- **state of** (`kg:stateOf`)
  - Domain: `kg:State`
  - Range: `kg:PhysicalEntity`
- **relatesTo** (`kg:relatesTo`)
  - Domain: `owl:Thing`
  - Range: `owl:Thing`
- **heats** (`kg:heats`)
  - Domain: `kg:WaterHeater`
  - Range: `kg:Water`
  - Parent: `kg:relatesTo`
- **precedesProcess** (`kg:precedesProcess`)
  - Domain: `kg:InletTemperature`
  - Range: `kg:Heating`
  - Parent: `kg:relatesTo`
- **hasOutletTemperature** (`kg:hasOutletTemperature`)
  - Domain: `kg:HeatingProcess`
  - Range: `kg:OutletTemperature`
  - Parent: `kg:relatesTo`
- **reduces** (`kg:reduces`)
  - Domain: `kg:PressureRegulator`
  - Range: `kg:Pressure`
  - Parent: `kg:relatesTo`
- **checksFor** (`kg:checksFor`)
  - Domain: `kg:MaintenanceInspection`
  - Range: `kg:Leak`
  - Parent: `kg:relatesTo`
- **verifies** (`kg:verifies`)
  - Domain: `kg:MaintenanceInspection`
  - Range: `kg:WaterPressure`
  - Parent: `kg:relatesTo`
- **prevents** (`kg:prevents`)
  - Domain: `kg:ExpansionTank`
  - Range: `kg:PressureBuildup`
  - Parent: `kg:relatesTo`
- **isPartOf** (`kg:isPartOf`)
  - Domain: `kg:ExpansionTank`
  - Range: `kg:HotWaterSystem`
  - Parent: `kg:relatesTo`

---

## 💾 Entity Instances
### 🔧 Physical Entity Instances

- **Expansion Tank ET-50**
  - Type: `kg:ExpansionTank`
  - ID: `68dfa0058955e3220259bb0e`
  - Attributes: {"capacity":5,"unit":"gallons"}
  - Sources: sent_1
  - Confidence: 91%
- **Pressure Regulator PR-200**
  - Type: `kg:PressureRegulator`
  - ID: `68dfa0058955e3220259bb0d`
  - Attributes: {"maxPressure":80,"minPressure":50,"unit":"PSI"}
  - Sources: sent_1
  - Confidence: 93%
- **Water Heater WH-101**
  - Type: `kg:WaterHeater`
  - ID: `68dfa0058955e3220259bb0c`
  - Attributes: {"capacity":50,"unit":"gallons","manufacturer":"Rheem"}
  - Sources: sent_1
  - Confidence: 95%

### 📊 State Instances

- **Inlet 50°F**
  - Type: `kg:InletTemperature`
  - ID: `68dfa0068955e3220259bb0f`
  - Attributes: {"value":50,"unit":"F","location":"inlet"}
  - Sources: sent_2
  - Confidence: 92%
- **Outlet 140°F**
  - Type: `kg:OutletTemperature`
  - ID: `68dfa0068955e3220259bb10`
  - Attributes: {"value":140,"unit":"F","location":"outlet"}
  - Sources: sent_2
  - Confidence: 92%

### ⚙️  Process Instances

- **Water Heating**
  - Type: `kg:HeatingProcess`
  - ID: `68dfa0068955e3220259bb11`
  - Attributes: {"targetTemp":140,"energySource":"electric"}
  - Sources: sent_3
  - Confidence: 94%

#### Process Details: Water Heating

**Preconditions:**
- Inlet 50°F ({"value":50,"unit":"F","location":"inlet"})

**Postconditions:**
- Outlet 140°F ({"value":140,"unit":"F","location":"outlet"})

**Transforms:**
- Water Heater WH-101

### ✅ Task Instances

- **Annual Inspection**
  - Type: `kg:MaintenanceInspection`
  - ID: `68dfa0068955e3220259bb13`
  - Attributes: {"frequency":"annual","checklist":["leaks","pressure"]}
  - Sources: sent_5
  - Confidence: 88%

### 🔀 Relationship Instances

- **has participant**
  - Type: `kg:hasParticipant`
  - From: Pressure Regulation (`kg:PressureRegulation`)
  - To: Pressure Regulator PR-200 (`kg:PressureRegulator`)
  - Confidence: 88%
- **produces postcondition**
  - Type: `kg:producesPostcondition`
  - From: Water Heating (`kg:HeatingProcess`)
  - To: Outlet 140°F (`kg:OutletTemperature`)
  - Confidence: 90%
- **requires precondition**
  - Type: `kg:requiresPrecondition`
  - From: Water Heating (`kg:HeatingProcess`)
  - To: Inlet 50°F (`kg:InletTemperature`)
  - Confidence: 90%
- **transforms**
  - Type: `kg:transforms`
  - From: Water Heating (`kg:HeatingProcess`)
  - To: Water Heater WH-101 (`kg:WaterHeater`)
  - Confidence: 90%