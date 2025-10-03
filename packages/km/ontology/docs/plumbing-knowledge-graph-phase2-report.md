# Plumbing Knowledge Graph - Phase 2 Extended

**Domain:** Plumbing & HVAC
**Generated:** 2025-10-03T10:48:33.317Z
**Generator:** Legion Knowledge Graph System

## 📝 Source Text

The knowledge graph was built from the following input:

```
## Phase 1: Plumbing System Basics

The water heater heats incoming cold water to 140 degrees Fahrenheit.
Before heating begins, the inlet temperature must be between 40 and 60 degrees Fahrenheit.
After the heating process completes, the outlet temperature reaches 140 degrees Fahrenheit.
The pressure regulator reduces street water pressure from 80 PSI to 50 PSI.
Annual maintenance inspections check for leaks and proper water pressure.
The expansion tank prevents pressure buildup in the hot water system.

## Phase 2: Real-World Plumber Tasks

**Source:** https://breakingac.com/news/2024/oct/29/from-repairs-to-replacements-how-plumbing-contractors-make-it-happen/

Source: https://breakingac.com/news/2024/oct/29/from-repairs-to-replacements-how-plumbing-contractors-make-it-happen/

Plumbers perform visual inspections to assess pipe damage.
For minor leaks, plumbers apply epoxy to fix the problem.
Pipe clamps repair small leaks quickly.
For extensive damage, plumbers replace damaged pipe sections.
The repair process requires shutting off the water supply first.
Plumbers drain the pipes before making repairs.
New pipe sections are measured and cut to the correct length.
Pipes are connected using soldering fittings.
After installation, plumbers test for leaks.

A plumber installs toilets by replacing the wax ring.
Sink installation requires connecting water supply lines.
The plumber seals the drain assembly during sink installation.

Plumbers use plungers for drain cleaning.
Hand augers clear stubborn drain blockages.
Camera inspections diagnose drain problems.

Water heater diagnostics check the thermostat.
Plumbers flush water heater tanks to remove sediment.
Tank flushing is part of regular maintenance.
```

---

## 📊 Overview

### Ontology Schema (RDF Triples)

| Metric | Count |
|--------|-------|
| Total Triples | 745 |
| Classes | 36 |
| Datatype Properties | 33 |
| Object Properties | 37 |

### Entity Instances (Knowledge Graph)

| Metric | Count |
|--------|-------|
| Total Items | 15 |
| Entities | 15 |
| Relationships | 0 |

### Instance Breakdown by Type

- **entity:kg:Task**: 10
- **entity:kg:MaintenanceInspection**: 2
- **entity:kg:WaterHeater**: 1
- **entity:kg:PressureRegulator**: 1
- **entity:kg:ExpansionTank**: 1

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

**Definition:** An appliance designed to increase the temperature of water through thermal energy transfer. Consists of heating elements, insulation, and control systems to maintain target temperature.

**Description:** A type of PhysicalEntity that functions as a thermal energy transfer device for water heating.

#### InletSystem
**URI:** `kg:InletSystem`  
**Parent:** `kg:PhysicalEntity`

**Definition:** The physical entry point or port where material enters a system or process. Includes associated components for controlling and monitoring incoming flow.

**Description:** A type of PhysicalEntity that serves as an entry point for process materials or fluids.

#### Outlet
**URI:** `kg:Outlet`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A physical point or port where processed material exits a system or component. Typically equipped with temperature monitoring capabilities and flow control features.

**Description:** A type of PhysicalEntity that serves as an exit point for process streams or materials.

#### PressureRegulator
**URI:** `kg:PressureRegulator`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A mechanical device designed to automatically reduce and maintain fluid pressure at a specified lower level from a higher input pressure. Contains internal components like diaphragms, springs, and adjustable mechanisms to control output pressure.

**Description:** A type of PhysicalEntity that modifies and controls fluid pressure levels in a system.

#### ExpansionTank
**URI:** `kg:ExpansionTank`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A vessel designed to accommodate the expansion and contraction of water in a closed heating or cooling system. Provides an air cushion to absorb pressure changes and protect system components.

**Description:** A type of PhysicalEntity that serves as a buffer vessel in fluid systems to manage pressure variations.

#### HotWaterSystem
**URI:** `kg:HotWaterSystem`  
**Parent:** `kg:PhysicalEntity`

**Definition:** An integrated network of components designed to heat, store, and distribute hot water. Includes heating elements, piping, tanks, and safety devices.

**Description:** A type of PhysicalEntity consisting of interconnected components for managing heated water.

#### Plumber
**URI:** `kg:Plumber`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A skilled professional tradesperson who specializes in installing, repairing, and maintaining plumbing systems and fixtures. Licensed to work with water supply, drainage, and related infrastructure.

**Description:** A type of PhysicalEntity representing a human worker specialized in plumbing systems.

#### PipeClamp
**URI:** `kg:PipeClamp`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A mechanical device designed to compress and seal around pipe surfaces to stop or prevent leaks. Consists of a band or collar that can be tightened around the pipe circumference.

**Description:** A type of PhysicalEntity that provides mechanical compression and sealing on pipe surfaces.

#### PipeSection
**URI:** `kg:PipeSection`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A segment or length of pipe used in plumbing systems for fluid transport. Can be made of various materials like PVC, copper, or steel with specific dimensions and ratings.

**Description:** A type of PhysicalEntity that forms part of a piping system for fluid transport.

#### WaterSupply
**URI:** `kg:WaterSupply`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A system or infrastructure component that provides water to a facility or equipment. Includes the physical components like pipes, valves, and connections that enable water distribution.

**Description:** A type of PhysicalEntity that serves as a source and distribution system for water.

#### Pipe
**URI:** `kg:Pipe`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A cylindrical conduit designed to transport fluids, gases, or other flowable materials between points in a system. Typically manufactured from metal, plastic, or composite materials with specific pressure and temperature ratings.

**Description:** A type of PhysicalEntity that creates pathways for fluid or material transport.

#### SolderingFitting
**URI:** `kg:SolderingFitting`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A specialized component designed to join pipes or tubing through soldering processes. Includes various shapes and configurations like couplings, elbows, tees, and reducers.

**Description:** A type of PhysicalEntity that enables permanent connection between pipes through metallurgical bonding.

#### Toilet
**URI:** `kg:Toilet`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A sanitary plumbing fixture used for the disposal of human waste, typically consisting of a bowl, tank, and flushing mechanism.

**Description:** A type of PhysicalEntity that serves as a sanitary fixture in plumbing systems.

#### WaxRing
**URI:** `kg:WaxRing`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A ring-shaped seal made of moldable wax used to create a watertight connection between a toilet and the floor flange. Prevents leaks and sewer gas escape.

**Description:** A type of PhysicalEntity that functions as a sealing component in toilet installations.

#### WaterSupplyLine
**URI:** `kg:WaterSupplyLine`  
**Parent:** `kg:PhysicalEntity`

**Definition:** Piping that delivers water from the main supply to plumbing fixtures. Typically includes both hot and cold water lines with appropriate fittings and connectors.

**Description:** A type of PhysicalEntity that functions as a conduit for water distribution in plumbing systems.

#### DrainAssembly
**URI:** `kg:DrainAssembly`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A collection of plumbing components that form a complete drainage system for a sink or fixture. Includes drain fitting, trap, and connecting pipes.

**Description:** A type of PhysicalEntity that combines multiple drainage components into a functional unit.

#### HandAuger
**URI:** `kg:HandAuger`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A manual plumbing tool consisting of a flexible cable with a rotating auger head used to clear drain blockages. Features a helical screw design that can break up and remove obstructions when manually rotated.

**Description:** A type of PhysicalEntity that serves as a manual drain cleaning tool.

#### WaterHeaterTank
**URI:** `kg:WaterHeaterTank`  
**Parent:** `kg:PhysicalEntity`

**Definition:** A vessel designed to heat and store hot water for residential or commercial use. Contains heating elements or burners and typically includes safety features like pressure relief valves.

**Description:** A type of PhysicalEntity that serves as a container for heating and storing water.
### 📊 States

_Conditions, configurations, or situations_

#### WaterPressure
**URI:** `kg:WaterPressure`  
**Parent:** `kg:State`

**Definition:** The force per unit area exerted by water within a confined system or pipe. Measured in pounds per square inch (PSI) or similar pressure units.

**Description:** A type of State representing the internal force condition of water in a system.

#### Leak
**URI:** `kg:Leak`  
**Parent:** `kg:State`

**Definition:** An unintended escape of fluid or gas from a containment system through gaps, cracks, or faulty seals. Represents a deviation from normal operating conditions.

**Description:** A type of State indicating compromised containment or seal integrity.

#### PressureBuildup
**URI:** `kg:PressureBuildup`  
**Parent:** `kg:State`

**Definition:** The condition of increasing pressure within a closed system due to thermal expansion or other factors. Represents a potential safety concern if not properly managed.

**Description:** A type of State characterizing the increasing pressure condition in a fluid system.

#### PipeDamage
**URI:** `kg:PipeDamage`  
**Parent:** `kg:State`

**Definition:** The condition of physical deterioration or impairment in a pipe section that compromises its function or integrity. May include cracks, breaks, corrosion, or other defects.

**Description:** A type of State indicating compromised physical condition of plumbing components.

#### DrainBlockage
**URI:** `kg:DrainBlockage`  
**Parent:** `kg:State`

**Definition:** An obstruction in a drain pipe that impedes or prevents normal water flow. Typically consists of accumulated debris, organic matter, or foreign objects.

**Description:** A type of State representing the condition of a drain being obstructed or clogged.
### ⚙️  Processes

_Natural or industrial transformations_

#### HeatingProcess
**URI:** `kg:HeatingProcess`  
**Parent:** `kg:Process`

**Definition:** A thermal process involving the transfer of heat energy to increase the temperature of a substance or system. Includes various heating methods such as conduction, convection, or radiation.

**Description:** A type of Process that involves increasing thermal energy in a system.

#### Flushing
**URI:** `kg:Flushing`  
**Parent:** `kg:Process`

**Definition:** The process of cleaning or clearing internal surfaces by forcing fluid through a system or component. Removes accumulated debris, deposits, or contamination.

**Description:** A type of Process that involves fluid flow to clean or clear internal surfaces.
### ✅ Tasks

_Planned, goal-directed activities_

#### MaintenanceInspection
**URI:** `kg:MaintenanceInspection`  
**Parent:** `kg:Task`

**Definition:** A scheduled examination of equipment and systems to assess condition and identify potential issues. Typically performed at regular intervals to ensure proper operation and prevent failures.

**Description:** A type of Task involving systematic checking and evaluation of system components and parameters.

#### RepairProcess
**URI:** `kg:RepairProcess`  
**Parent:** `kg:Task`

**Definition:** A planned maintenance activity to fix, restore, or replace damaged or malfunctioning components. Involves specific steps, procedures, and safety measures.

**Description:** A type of Task that involves corrective maintenance actions to restore functionality.

#### SinkInstallation
**URI:** `kg:SinkInstallation`  
**Parent:** `kg:Task`

**Definition:** The process of mounting and connecting a sink fixture to water supply, drainage systems, and supporting structures. Includes physical mounting, plumbing connections, and testing.

**Description:** A type of Task involving the setup and connection of sink fixtures in plumbing systems.

#### Diagnostics
**URI:** `kg:Diagnostics`  
**Parent:** `kg:Task`

**Definition:** A systematic examination and testing process to evaluate the condition and performance of water heater components. Includes checking electrical, mechanical, and control systems.

**Description:** A type of Task that involves inspection and testing of equipment to determine operational status and identify issues.

#### MaintenanceActivity
**URI:** `kg:MaintenanceActivity`  
**Parent:** `kg:Task`

**Definition:** A planned activity performed to maintain equipment functionality, reliability, and safety. Includes regular cleaning, inspection, and servicing of equipment components.

**Description:** A type of Task that involves scheduled or preventive actions to maintain equipment condition.

---

## 🔗 Properties & Relationships
### 📝 Datatype Properties

- **temperature** (`kg:temperature`)
  - Domain: `kg:Water`
  - Range: `xsd:string`
- **targetTemperature** (`kg:targetTemperature`)
  - Domain: `kg:WaterHeater`
  - Range: `xsd:string`
- **inletTemperature** (`kg:inletTemperature`)
  - Domain: `kg:InletSystem`
  - Range: `xsd:string`
- **temperatureRange** (`kg:temperatureRange`)
  - Domain: `kg:Temperature`
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
- **waterPressure** (`kg:waterPressure`)
  - Domain: `kg:WaterSystem`
  - Range: `xsd:string`
- **inspectionFrequency** (`kg:inspectionFrequency`)
  - Domain: `kg:MaintenanceInspection`
  - Range: `xsd:string`
- **systemPressure** (`kg:systemPressure`)
  - Domain: `kg:HotWaterSystem`
  - Range: `xsd:string`
- **bufferVolume** (`kg:bufferVolume`)
  - Domain: `kg:ExpansionTank`
  - Range: `xsd:string`
- **damageState** (`kg:damageState`)
  - Domain: `kg:Pipe`
  - Range: `xsd:string`
- **severity** (`kg:severity`)
  - Domain: `kg:Leak`
  - Range: `xsd:string`
- **leakSize** (`kg:leakSize`)
  - Domain: `kg:Leak`
  - Range: `xsd:string`
- **repairTime** (`kg:repairTime`)
  - Domain: `kg:PipeClamp`
  - Range: `xsd:string`
- **damageExtent** (`kg:damageExtent`)
  - Domain: `kg:PipeDamage`
  - Range: `xsd:string`
- **supplyStatus** (`kg:supplyStatus`)
  - Domain: `kg:WaterSupply`
  - Range: `xsd:boolean`
- **drainageStatus** (`kg:drainageStatus`)
  - Domain: `kg:Pipe`
  - Range: `xsd:boolean`
- **length** (`kg:length`)
  - Domain: `kg:PipeSection`
  - Range: `xsd:string`
- **isMeasured** (`kg:isMeasured`)
  - Domain: `kg:PipeSection`
  - Range: `xsd:boolean`
- **leakStatus** (`kg:leakStatus`)
  - Domain: `kg:PlumbingSystem`
  - Range: `xsd:boolean`
- **installationDate** (`kg:installationDate`)
  - Domain: `kg:Toilet`
  - Range: `xsd:date`
- **installationStatus** (`kg:installationStatus`)
  - Domain: `kg:SinkInstallation`
  - Range: `xsd:string`
- **sealingStatus** (`kg:sealingStatus`)
  - Domain: `kg:DrainAssembly`
  - Range: `xsd:boolean`
- **drainDiameter** (`kg:drainDiameter`)
  - Domain: `kg:Drain`
  - Range: `xsd:string`
- **blockageSeverity** (`kg:blockageSeverity`)
  - Domain: `kg:DrainBlockage`
  - Range: `xsd:string`
- **hasCondition** (`kg:hasCondition`)
  - Domain: `kg:Drain`
  - Range: `xsd:string`
- **operatingTemperature** (`kg:operatingTemperature`)
  - Domain: `kg:WaterHeater`
  - Range: `xsd:string`
- **setPoint** (`kg:setPoint`)
  - Domain: `kg:Thermostat`
  - Range: `xsd:string`
- **sedimentLevel** (`kg:sedimentLevel`)
  - Domain: `kg:WaterHeaterTank`
  - Range: `xsd:string`
- **tankCapacity** (`kg:tankCapacity`)
  - Domain: `kg:WaterHeaterTank`
  - Range: `xsd:string`
- **flushingFrequency** (`kg:flushingFrequency`)
  - Domain: `kg:Tank`
  - Range: `xsd:string`
- **lastFlushed** (`kg:lastFlushed`)
  - Domain: `kg:Tank`
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
- **hasInlet** (`kg:hasInlet`)
  - Domain: `kg:WaterHeater`
  - Range: `kg:Water`
  - Parent: `kg:relatesTo`
- **precedesProcess** (`kg:precedesProcess`)
  - Domain: `kg:Temperature`
  - Range: `kg:HeatingProcess`
  - Parent: `kg:relatesTo`
- **hasOutletTemperature** (`kg:hasOutletTemperature`)
  - Domain: `kg:Outlet`
  - Range: `kg:Temperature`
  - Parent: `kg:relatesTo`
- **reducesPressure** (`kg:reducesPressure`)
  - Domain: `kg:PressureRegulator`
  - Range: `kg:WaterPressure`
  - Parent: `kg:relatesTo`
- **checksFor** (`kg:checksFor`)
  - Domain: `kg:MaintenanceInspection`
  - Range: `kg:Leak`
  - Parent: `kg:relatesTo`
- **prevents** (`kg:prevents`)
  - Domain: `kg:ExpansionTank`
  - Range: `kg:PressureBuildup`
  - Parent: `kg:relatesTo`
- **isPartOf** (`kg:isPartOf`)
  - Domain: `kg:ExpansionTank`
  - Range: `kg:HotWaterSystem`
  - Parent: `kg:relatesTo`
- **performsInspectionOf** (`kg:performsInspectionOf`)
  - Domain: `kg:Plumber`
  - Range: `kg:Pipe`
  - Parent: `kg:relatesTo`
- **repairs** (`kg:repairs`)
  - Domain: `kg:Plumber`
  - Range: `kg:Leak`
  - Parent: `kg:performsInspectionOf`
- **appliesTo** (`kg:appliesTo`)
  - Domain: `kg:Epoxy`
  - Range: `kg:Leak`
  - Parent: `kg:relatesTo`
- **replaces** (`kg:replaces`)
  - Domain: `kg:Plumber`
  - Range: `kg:PipeSection`
  - Parent: `kg:performsInspectionOf`
- **requires** (`kg:requires`)
  - Domain: `kg:RepairProcess`
  - Range: `kg:WaterSupply`
  - Parent: `kg:relatesTo`
- **drains** (`kg:drains`)
  - Domain: `kg:Plumber`
  - Range: `kg:Pipe`
  - Parent: `kg:performsInspectionOf`
- **hasCutOperation** (`kg:hasCutOperation`)
  - Domain: `kg:PipeSection`
  - Range: `kg:CuttingTask`
  - Parent: `kg:relatesTo`
- **connectedBy** (`kg:connectedBy`)
  - Domain: `kg:Pipe`
  - Range: `kg:SolderingFitting`
  - Parent: `kg:relatesTo`
- **inspectionAction** (`kg:inspectionAction`)
  - Domain: `kg:Plumber`
  - Range: `kg:Continuant`
  - Parent: `kg:performsInspectionOf`
- **testsFor** (`kg:testsFor`)
  - Domain: `kg:Plumber`
  - Range: `kg:Leak`
  - Parent: `kg:inspectionAction`
- **installs** (`kg:installs`)
  - Domain: `kg:Plumber`
  - Range: `kg:Toilet`
  - Parent: `kg:performsInspectionOf`
- **replacesComponent** (`kg:replacesComponent`)
  - Domain: `kg:Plumber`
  - Range: `kg:WaxRing`
  - Parent: `kg:replaces`
- **requiresConnection** (`kg:requiresConnection`)
  - Domain: `kg:Sink`
  - Range: `kg:WaterSupplyLine`
  - Parent: `kg:relatesTo`
- **seals** (`kg:seals`)
  - Domain: `kg:Plumber`
  - Range: `kg:DrainAssembly`
  - Parent: `kg:performsInspectionOf`
- **toolUsage** (`kg:toolUsage`)
  - Domain: `kg:Plumber`
  - Range: `owl:Thing`
  - Parent: `kg:performsInspectionOf`
- **uses** (`kg:uses`)
  - Domain: `kg:Plumber`
  - Range: `kg:Plunger`
  - Parent: `kg:toolUsage`
- **cleans** (`kg:cleans`)
  - Domain: `kg:Plumber`
  - Range: `kg:Drain`
  - Parent: `kg:performsInspectionOf`
- **clears** (`kg:clears`)
  - Domain: `kg:HandAuger`
  - Range: `kg:DrainBlockage`
  - Parent: `kg:relatesTo`
- **diagnoses** (`kg:diagnoses`)
  - Domain: `kg:Camera`
  - Range: `kg:Drain`
  - Parent: `kg:relatesTo`
- **checks** (`kg:checks`)
  - Domain: `kg:Diagnostics`
  - Range: `kg:Thermostat`
  - Parent: `kg:relatesTo`
- **controls** (`kg:controls`)
  - Domain: `kg:Thermostat`
  - Range: `kg:WaterHeater`
  - Parent: `kg:relatesTo`
- **flushes** (`kg:flushes`)
  - Domain: `kg:Plumber`
  - Range: `kg:WaterHeaterTank`
  - Parent: `kg:performsInspectionOf`
- **containsSediment** (`kg:containsSediment`)
  - Domain: `kg:WaterHeaterTank`
  - Range: `kg:Sediment`
  - Parent: `kg:relatesTo`

---

## 💾 Entity Instances
### 🔧 Physical Entity Instances

- **Expansion Tank ET-50**
  - Type: `kg:ExpansionTank`
  - ID: `68dfaa00d7a01243de9c9444`
  - Attributes: {"capacity":5,"unit":"gallons"}
  - Sources: phase1_sent_1
  - Confidence: 91%
- **Pressure Regulator PR-200**
  - Type: `kg:PressureRegulator`
  - ID: `68dfaa00d7a01243de9c9443`
  - Attributes: {"maxPressure":80,"minPressure":50,"unit":"PSI"}
  - Sources: phase1_sent_1
  - Confidence: 93%
- **Water Heater WH-101**
  - Type: `kg:WaterHeater`
  - ID: `68dfaa00d7a01243de9c9442`
  - Attributes: {"capacity":50,"unit":"gallons","manufacturer":"Rheem"}
  - Sources: phase1_sent_1
  - Confidence: 95%

### ✅ Task Instances

- **Water Heater Diagnostics**
  - Type: `kg:MaintenanceInspection`
  - ID: `68dfaa01d7a01243de9c944d`
  - Attributes: {"taskType":"diagnostics","checks":["thermostat","heating element","gas valve"]}
  - Sources: phase2_sent_water_heater
  - Confidence: 94%
- **Tank Flushing**
  - Type: `kg:MaintenanceInspection`
  - ID: `68dfaa01d7a01243de9c944e`
  - Attributes: {"taskType":"maintenance","purpose":"remove sediment buildup","frequency":"periodic"}
  - Sources: phase2_sent_water_heater
  - Confidence: 93%
- **Visual Inspection**
  - Type: `kg:Task`
  - ID: `68dfaa00d7a01243de9c9445`
  - Attributes: {"taskType":"inspection","purpose":"assess pipe damage","tools":["visual","specialized tools"]}
  - Sources: phase2_sent_pipe_repair
  - Confidence: 92%
- **Leak Repair with Epoxy**
  - Type: `kg:Task`
  - ID: `68dfaa00d7a01243de9c9446`
  - Attributes: {"taskType":"repair","method":"epoxy application","severity":"minor"}
  - Sources: phase2_sent_pipe_repair
  - Confidence: 90%
- **Pipe Section Replacement**
  - Type: `kg:Task`
  - ID: `68dfaa00d7a01243de9c9447`
  - Attributes: {"taskType":"replacement","severity":"extensive damage","steps":["shut off water","drain pipes","cut pipe","install new section","test"]}
  - Sources: phase2_sent_pipe_repair
  - Confidence: 93%
- **Toilet Installation**
  - Type: `kg:Task`
  - ID: `68dfaa00d7a01243de9c9448`
  - Attributes: {"taskType":"installation","fixture":"toilet","components":["wax ring","flange"]}
  - Sources: phase2_sent_installations
  - Confidence: 91%
- **Sink Installation**
  - Type: `kg:Task`
  - ID: `68dfaa00d7a01243de9c9449`
  - Attributes: {"taskType":"installation","fixture":"sink","steps":["connect supply lines","seal drain assembly"]}
  - Sources: phase2_sent_installations
  - Confidence: 91%
- **Shower Installation**
  - Type: `kg:Task`
  - ID: `68dfaa00d7a01243de9c944a`
  - Attributes: {"taskType":"installation","fixture":"shower","requirements":["waterproofing","framing"]}
  - Sources: phase2_sent_installations
  - Confidence: 90%
- **Drain Cleaning**
  - Type: `kg:Task`
  - ID: `68dfaa00d7a01243de9c944b`
  - Attributes: {"taskType":"maintenance","tools":["plunger","hand auger","motorized snake","hydro-jetting"],"diagnostic":"camera inspection"}
  - Sources: phase2_sent_drain_cleaning
  - Confidence: 93%
- **Camera Inspection**
  - Type: `kg:Task`
  - ID: `68dfaa01d7a01243de9c944c`
  - Attributes: {"taskType":"diagnostic","timing":"before and after cleaning","purpose":"diagnose blockages"}
  - Sources: phase2_sent_drain_cleaning
  - Confidence: 92%
- **Water Heater Installation**
  - Type: `kg:Task`
  - ID: `68dfaa01d7a01243de9c944f`
  - Attributes: {"taskType":"installation","steps":["disconnect old unit","connect water supply","connect power","install safety features"],"safetyFeatures":["pressure relief valve"]}
  - Sources: phase2_sent_water_heater
  - Confidence: 95%
- **Leak Detection**
  - Type: `kg:Task`
  - ID: `68dfaa01d7a01243de9c9450`
  - Attributes: {"taskType":"diagnostic","tools":["acoustic detector","thermal camera","moisture meter","tracer gas"],"approach":"minimize structural damage"}
  - Sources: phase2_sent_leak_detection
  - Confidence: 94%