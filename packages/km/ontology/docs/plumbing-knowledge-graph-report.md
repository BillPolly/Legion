# Plumbing System Knowledge Graph

**Domain:** Plumbing & HVAC
**Generated:** 2025-10-03T10:00:26.263Z
**Generator:** Legion Knowledge Graph System

---

## 📊 Overview

### Ontology Schema (RDF Triples)

| Metric | Count |
|--------|-------|
| Total Triples | 288 |
| Classes | 18 |
| Datatype Properties | 10 |
| Object Properties | 14 |

### Entity Instances (Knowledge Graph)

| Metric | Count |
|--------|-------|
| Total Items | 12 |
| Entities | 8 |
| Relationships | 4 |

### Instance Breakdown by Type

- **entity:kg:PressureRegulator**: 1
- **entity:kg:PressureRegulation**: 1
- **entity:kg:MaintenanceInspection**: 1
- **entity:kg:WaterHeater**: 1
- **relationship:kg:requiresPrecondition**: 1
- **entity:kg:OutletTemperature**: 1
- **entity:kg:InletTemperature**: 1
- **relationship:kg:producesPostcondition**: 1
- **entity:kg:ExpansionTank**: 1
- **relationship:kg:transforms**: 1
- **relationship:kg:hasParticipant**: 1
- **entity:kg:HeatingProcess**: 1

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

**Definition:** An appliance designed to raise the temperature of water for residential, commercial or industrial use. Consists of heating elements, a tank, and temperature control mechanisms.

**Description:** A type of PhysicalEntity that functions as a heating appliance for water storage and temperature elevation.

#### PressureRegulator
**URI:** `kg:PressureRegulator`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A mechanical device designed to automatically reduce and maintain fluid pressure at a specified lower level from a higher input pressure. Contains internal components like diaphragms, springs, and adjustment mechanisms to control output pressure.

**Description:** A type of PhysicalEntity that modifies and controls fluid pressure levels in a system.

#### ExpansionTank
**URI:** `kg:ExpansionTank`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A vessel designed to accommodate the expansion and contraction of water in a closed heating system. Contains an air cushion or diaphragm to absorb volume changes and maintain system pressure within safe limits.

**Description:** A type of PhysicalEntity that serves as a protective component in fluid systems by managing thermal expansion.

#### HotWaterSystem
**URI:** `kg:HotWaterSystem`  
**Parent:** `kg:PhysicalEntity`

**Definition:** An integrated network of components designed to heat, store, and distribute hot water. Consists of heating elements, pipes, tanks, and safety devices working together.

**Description:** A type of PhysicalEntity comprising multiple interconnected components for managing heated water.
### 📊 States

_Conditions, configurations, or situations_

#### InletTemperature
**URI:** `kg:InletTemperature`  
**Parent:** `kg:State`

**Definition:** The measured temperature of a fluid or material at the point where it enters a system or process. Represents a critical process parameter that must be monitored and controlled within specified ranges.

**Description:** A type of State that characterizes the thermal condition of an input stream or material.

#### OutletTemperature
**URI:** `kg:OutletTemperature`  
**Parent:** `kg:State`

**Definition:** The temperature measurement at the discharge or exit point of a process or system. Represents the thermal condition of the material or fluid after processing.

**Description:** A type of State that characterizes the thermal condition at a system's output point.

#### Leak
**URI:** `kg:Leak`  
**Parent:** `kg:State`

**Definition:** An unintended escape or release of fluid from a contained system through gaps, cracks, or failing seals. Represents a deviation from normal operating conditions requiring attention.

**Description:** A type of State indicating compromised containment or seal integrity in a fluid system.

#### WaterPressure
**URI:** `kg:WaterPressure`  
**Parent:** `kg:State`

**Definition:** The force per unit area exerted by water within a contained system. A key operational parameter for fluid systems that affects flow and system performance.

**Description:** A type of State measuring the force intensity of contained water in a system.

#### PressureBuildup
**URI:** `kg:PressureBuildup`  
**Parent:** `kg:State`

**Definition:** The accumulation of pressure within a closed system due to thermal expansion or other factors. Represents a potentially hazardous condition requiring management.

**Description:** A type of State characterizing the increase in system pressure beyond normal operating conditions.
### ⚙️  Processes

_Natural or industrial transformations_

#### Heating
**URI:** `kg:Heating`  
**Parent:** `kg:Process`

**Definition:** A thermal process that increases the temperature of a material, substance, or system through the addition of thermal energy. May involve various heat transfer mechanisms including conduction, convection, or radiation.

**Description:** A type of Process that involves thermal energy transfer to raise temperature.

#### HeatingProcess
**URI:** `kg:HeatingProcess`  
**Parent:** `kg:Process`

**Definition:** A thermal operation that increases the temperature of a substance or material over time. Involves the transfer of heat energy to achieve a target temperature condition.

**Description:** A type of Process that specifically involves thermal energy transfer to raise temperature.
### ✅ Tasks

_Planned, goal-directed activities_

#### MaintenanceInspection
**URI:** `kg:MaintenanceInspection`  
**Parent:** `kg:Task`

**Definition:** A systematic examination and assessment of equipment or systems performed at regular intervals to ensure proper functioning and identify potential issues. Includes visual checks, measurements, and operational tests.

**Description:** A type of Task that involves scheduled evaluation and verification of system conditions and performance.

---

## 🔗 Properties & Relationships
### 📝 Datatype Properties

- **temperature** (`kg:temperature`)
  - Domain: `kg:Water`
  - Range: `xsd:string`
- **temperatureValue** (`kg:temperatureValue`)
  - Domain: `kg:InletTemperature`
  - Range: `xsd:string`
- **temperatureUnit** (`kg:temperatureUnit`)
  - Domain: `kg:InletTemperature`
  - Range: `xsd:string`
- **processStatus** (`kg:processStatus`)
  - Domain: `kg:HeatingProcess`
  - Range: `xsd:string`
- **inletPressure** (`kg:inletPressure`)
  - Domain: `kg:PressureRegulator`
  - Range: `xsd:string`
- **outletPressure** (`kg:outletPressure`)
  - Domain: `kg:PressureRegulator`
  - Range: `xsd:string`
- **inspectionFrequency** (`kg:inspectionFrequency`)
  - Domain: `kg:MaintenanceInspection`
  - Range: `xsd:string`
- **pressureLevel** (`kg:pressureLevel`)
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
- **resultsIn** (`kg:resultsIn`)
  - Domain: `kg:HeatingProcess`
  - Range: `kg:OutletTemperature`
  - Parent: `kg:relatesTo`
- **reducesPressure** (`kg:reducesPressure`)
  - Domain: `kg:PressureRegulator`
  - Range: `kg:State`
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
- **isComponentOf** (`kg:isComponentOf`)
  - Domain: `kg:ExpansionTank`
  - Range: `kg:HotWaterSystem`
  - Parent: `kg:relatesTo`

---

## 💾 Entity Instances
### 🔧 Physical Entity Instances

- **Expansion Tank ET-50**
  - Type: `kg:ExpansionTank`
  - ID: `68df9eb96a14f370ad858ccd`
  - Attributes: {"capacity":5,"unit":"gallons"}
  - Sources: sent_1
  - Confidence: 91%
- **Pressure Regulator PR-200**
  - Type: `kg:PressureRegulator`
  - ID: `68df9eb96a14f370ad858ccc`
  - Attributes: {"maxPressure":80,"minPressure":50,"unit":"PSI"}
  - Sources: sent_1
  - Confidence: 93%
- **Water Heater WH-101**
  - Type: `kg:WaterHeater`
  - ID: `68df9eb96a14f370ad858ccb`
  - Attributes: {"capacity":50,"unit":"gallons","manufacturer":"Rheem"}
  - Sources: sent_1
  - Confidence: 95%

### 📊 State Instances

- **Inlet 50°F**
  - Type: `kg:InletTemperature`
  - ID: `68df9eb96a14f370ad858cce`
  - Attributes: {"value":50,"unit":"F","location":"inlet"}
  - Sources: sent_2
  - Confidence: 92%
- **Outlet 140°F**
  - Type: `kg:OutletTemperature`
  - ID: `68df9eba6a14f370ad858ccf`
  - Attributes: {"value":140,"unit":"F","location":"outlet"}
  - Sources: sent_2
  - Confidence: 92%

### ⚙️  Process Instances

- **Water Heating**
  - Type: `kg:HeatingProcess`
  - ID: `68df9eba6a14f370ad858cd0`
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
  - ID: `68df9eba6a14f370ad858cd2`
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