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

- **Task**: 10
- **MaintenanceInspection**: 2
- **WaterHeater**: 1
- **PressureRegulator**: 1
- **ExpansionTank**: 1

---

## 🏗️  Upper-Level Ontology

### Bootstrap Categories

The knowledge graph uses a BFO-inspired upper-level ontology that categorizes all entities into fundamental types.

```
owl:Thing
├── Continuant (things that persist through time)
│   ├── PhysicalEntity (material objects)
│   └── State (conditions, configurations)
└── Occurrent (things that happen)
    ├── Process (natural/industrial transformations)
    └── Task (planned, goal-directed activities)
```

### Process-State Relationships

- **requires precondition** (requiresPrecondition): Process → State
- **produces postcondition** (producesPostcondition): Process → State
- **transforms** (transforms): Process → PhysicalEntity
- **has participant** (hasParticipant): Process → PhysicalEntity

---

## 🎯 Domain Ontology
### 🔧 Physical Entities

_Material objects that have physical presence_

#### WaterHeater
**Parent:** `PhysicalEntity`

**Definition:** An appliance designed to increase the temperature of water through thermal energy transfer. Consists of heating elements, insulation, and control systems to maintain target temperature.

**Description:** A type of PhysicalEntity that functions as a thermal energy transfer device for water heating.

#### InletSystem
**Parent:** `PhysicalEntity`

**Definition:** The physical entry point or port where material enters a system or process. Includes associated components for controlling and monitoring incoming flow.

**Description:** A type of PhysicalEntity that serves as an entry point for process materials or fluids.

#### Outlet
**Parent:** `PhysicalEntity`

**Definition:** A physical point or port where processed material exits a system or component. Typically equipped with temperature monitoring capabilities and flow control features.

**Description:** A type of PhysicalEntity that serves as an exit point for process streams or materials.

#### PressureRegulator
**Parent:** `PhysicalEntity`

**Definition:** A mechanical device designed to automatically reduce and maintain fluid pressure at a specified lower level from a higher input pressure. Contains internal components like diaphragms, springs, and adjustable mechanisms to control output pressure.

**Description:** A type of PhysicalEntity that modifies and controls fluid pressure levels in a system.

#### ExpansionTank
**Parent:** `PhysicalEntity`

**Definition:** A vessel designed to accommodate the expansion and contraction of water in a closed heating or cooling system. Provides an air cushion to absorb pressure changes and protect system components.

**Description:** A type of PhysicalEntity that serves as a buffer vessel in fluid systems to manage pressure variations.

#### HotWaterSystem
**Parent:** `PhysicalEntity`

**Definition:** An integrated network of components designed to heat, store, and distribute hot water. Includes heating elements, piping, tanks, and safety devices.

**Description:** A type of PhysicalEntity consisting of interconnected components for managing heated water.

#### Plumber
**Parent:** `PhysicalEntity`

**Definition:** A skilled professional tradesperson who specializes in installing, repairing, and maintaining plumbing systems and fixtures. Licensed to work with water supply, drainage, and related infrastructure.

**Description:** A type of PhysicalEntity representing a human worker specialized in plumbing systems.

#### PipeClamp
**Parent:** `PhysicalEntity`

**Definition:** A mechanical device designed to compress and seal around pipe surfaces to stop or prevent leaks. Consists of a band or collar that can be tightened around the pipe circumference.

**Description:** A type of PhysicalEntity that provides mechanical compression and sealing on pipe surfaces.

#### PipeSection
**Parent:** `PhysicalEntity`

**Definition:** A segment or length of pipe used in plumbing systems for fluid transport. Can be made of various materials like PVC, copper, or steel with specific dimensions and ratings.

**Description:** A type of PhysicalEntity that forms part of a piping system for fluid transport.

#### WaterSupply
**Parent:** `PhysicalEntity`

**Definition:** A system or infrastructure component that provides water to a facility or equipment. Includes the physical components like pipes, valves, and connections that enable water distribution.

**Description:** A type of PhysicalEntity that serves as a source and distribution system for water.

#### Pipe
**Parent:** `PhysicalEntity`

**Definition:** A cylindrical conduit designed to transport fluids, gases, or other flowable materials between points in a system. Typically manufactured from metal, plastic, or composite materials with specific pressure and temperature ratings.

**Description:** A type of PhysicalEntity that creates pathways for fluid or material transport.

#### SolderingFitting
**Parent:** `PhysicalEntity`

**Definition:** A specialized component designed to join pipes or tubing through soldering processes. Includes various shapes and configurations like couplings, elbows, tees, and reducers.

**Description:** A type of PhysicalEntity that enables permanent connection between pipes through metallurgical bonding.

#### Toilet
**Parent:** `PhysicalEntity`

**Definition:** A sanitary plumbing fixture used for the disposal of human waste, typically consisting of a bowl, tank, and flushing mechanism.

**Description:** A type of PhysicalEntity that serves as a sanitary fixture in plumbing systems.

#### WaxRing
**Parent:** `PhysicalEntity`

**Definition:** A ring-shaped seal made of moldable wax used to create a watertight connection between a toilet and the floor flange. Prevents leaks and sewer gas escape.

**Description:** A type of PhysicalEntity that functions as a sealing component in toilet installations.

#### WaterSupplyLine
**Parent:** `PhysicalEntity`

**Definition:** Piping that delivers water from the main supply to plumbing fixtures. Typically includes both hot and cold water lines with appropriate fittings and connectors.

**Description:** A type of PhysicalEntity that functions as a conduit for water distribution in plumbing systems.

#### DrainAssembly
**Parent:** `PhysicalEntity`

**Definition:** A collection of plumbing components that form a complete drainage system for a sink or fixture. Includes drain fitting, trap, and connecting pipes.

**Description:** A type of PhysicalEntity that combines multiple drainage components into a functional unit.

#### HandAuger
**Parent:** `PhysicalEntity`

**Definition:** A manual plumbing tool consisting of a flexible cable with a rotating auger head used to clear drain blockages. Features a helical screw design that can break up and remove obstructions when manually rotated.

**Description:** A type of PhysicalEntity that serves as a manual drain cleaning tool.

#### WaterHeaterTank
**Parent:** `PhysicalEntity`

**Definition:** A vessel designed to heat and store hot water for residential or commercial use. Contains heating elements or burners and typically includes safety features like pressure relief valves.

**Description:** A type of PhysicalEntity that serves as a container for heating and storing water.
### 📊 States

_Conditions, configurations, or situations_

#### WaterPressure
**Parent:** `State`

**Definition:** The force per unit area exerted by water within a confined system or pipe. Measured in pounds per square inch (PSI) or similar pressure units.

**Description:** A type of State representing the internal force condition of water in a system.

#### Leak
**Parent:** `State`

**Definition:** An unintended escape of fluid or gas from a containment system through gaps, cracks, or faulty seals. Represents a deviation from normal operating conditions.

**Description:** A type of State indicating compromised containment or seal integrity.

#### PressureBuildup
**Parent:** `State`

**Definition:** The condition of increasing pressure within a closed system due to thermal expansion or other factors. Represents a potential safety concern if not properly managed.

**Description:** A type of State characterizing the increasing pressure condition in a fluid system.

#### PipeDamage
**Parent:** `State`

**Definition:** The condition of physical deterioration or impairment in a pipe section that compromises its function or integrity. May include cracks, breaks, corrosion, or other defects.

**Description:** A type of State indicating compromised physical condition of plumbing components.

#### DrainBlockage
**Parent:** `State`

**Definition:** An obstruction in a drain pipe that impedes or prevents normal water flow. Typically consists of accumulated debris, organic matter, or foreign objects.

**Description:** A type of State representing the condition of a drain being obstructed or clogged.
### ⚙️  Processes

_Natural or industrial transformations_

#### HeatingProcess
**Parent:** `Process`

**Definition:** A thermal process involving the transfer of heat energy to increase the temperature of a substance or system. Includes various heating methods such as conduction, convection, or radiation.

**Description:** A type of Process that involves increasing thermal energy in a system.

#### Flushing
**Parent:** `Process`

**Definition:** The process of cleaning or clearing internal surfaces by forcing fluid through a system or component. Removes accumulated debris, deposits, or contamination.

**Description:** A type of Process that involves fluid flow to clean or clear internal surfaces.
### ✅ Tasks

_Planned, goal-directed activities_

#### MaintenanceInspection
**Parent:** `Task`

**Definition:** A scheduled examination of equipment and systems to assess condition and identify potential issues. Typically performed at regular intervals to ensure proper operation and prevent failures.

**Description:** A type of Task involving systematic checking and evaluation of system components and parameters.

#### RepairProcess
**Parent:** `Task`

**Definition:** A planned maintenance activity to fix, restore, or replace damaged or malfunctioning components. Involves specific steps, procedures, and safety measures.

**Description:** A type of Task that involves corrective maintenance actions to restore functionality.

#### SinkInstallation
**Parent:** `Task`

**Definition:** The process of mounting and connecting a sink fixture to water supply, drainage systems, and supporting structures. Includes physical mounting, plumbing connections, and testing.

**Description:** A type of Task involving the setup and connection of sink fixtures in plumbing systems.

#### Diagnostics
**Parent:** `Task`

**Definition:** A systematic examination and testing process to evaluate the condition and performance of water heater components. Includes checking electrical, mechanical, and control systems.

**Description:** A type of Task that involves inspection and testing of equipment to determine operational status and identify issues.

#### MaintenanceActivity
**Parent:** `Task`

**Definition:** A planned activity performed to maintain equipment functionality, reliability, and safety. Includes regular cleaning, inspection, and servicing of equipment components.

**Description:** A type of Task that involves scheduled or preventive actions to maintain equipment condition.

---

## 🔗 Properties & Relationships
### 📝 Datatype Properties

- **temperature** (`temperature`)
  - Domain: `Water`
  - Range: `xsd:string`
- **targetTemperature** (`targetTemperature`)
  - Domain: `WaterHeater`
  - Range: `xsd:string`
- **inletTemperature** (`inletTemperature`)
  - Domain: `InletSystem`
  - Range: `xsd:string`
- **temperatureRange** (`temperatureRange`)
  - Domain: `Temperature`
  - Range: `xsd:string`
- **processStatus** (`processStatus`)
  - Domain: `HeatingProcess`
  - Range: `xsd:string`
- **inletPressure** (`inletPressure`)
  - Domain: `PressureRegulator`
  - Range: `xsd:string`
- **outletPressure** (`outletPressure`)
  - Domain: `PressureRegulator`
  - Range: `xsd:string`
- **waterPressure** (`waterPressure`)
  - Domain: `WaterSystem`
  - Range: `xsd:string`
- **inspectionFrequency** (`inspectionFrequency`)
  - Domain: `MaintenanceInspection`
  - Range: `xsd:string`
- **systemPressure** (`systemPressure`)
  - Domain: `HotWaterSystem`
  - Range: `xsd:string`
- **bufferVolume** (`bufferVolume`)
  - Domain: `ExpansionTank`
  - Range: `xsd:string`
- **damageState** (`damageState`)
  - Domain: `Pipe`
  - Range: `xsd:string`
- **severity** (`severity`)
  - Domain: `Leak`
  - Range: `xsd:string`
- **leakSize** (`leakSize`)
  - Domain: `Leak`
  - Range: `xsd:string`
- **repairTime** (`repairTime`)
  - Domain: `PipeClamp`
  - Range: `xsd:string`
- **damageExtent** (`damageExtent`)
  - Domain: `PipeDamage`
  - Range: `xsd:string`
- **supplyStatus** (`supplyStatus`)
  - Domain: `WaterSupply`
  - Range: `xsd:boolean`
- **drainageStatus** (`drainageStatus`)
  - Domain: `Pipe`
  - Range: `xsd:boolean`
- **length** (`length`)
  - Domain: `PipeSection`
  - Range: `xsd:string`
- **isMeasured** (`isMeasured`)
  - Domain: `PipeSection`
  - Range: `xsd:boolean`
- **leakStatus** (`leakStatus`)
  - Domain: `PlumbingSystem`
  - Range: `xsd:boolean`
- **installationDate** (`installationDate`)
  - Domain: `Toilet`
  - Range: `xsd:date`
- **installationStatus** (`installationStatus`)
  - Domain: `SinkInstallation`
  - Range: `xsd:string`
- **sealingStatus** (`sealingStatus`)
  - Domain: `DrainAssembly`
  - Range: `xsd:boolean`
- **drainDiameter** (`drainDiameter`)
  - Domain: `Drain`
  - Range: `xsd:string`
- **blockageSeverity** (`blockageSeverity`)
  - Domain: `DrainBlockage`
  - Range: `xsd:string`
- **hasCondition** (`hasCondition`)
  - Domain: `Drain`
  - Range: `xsd:string`
- **operatingTemperature** (`operatingTemperature`)
  - Domain: `WaterHeater`
  - Range: `xsd:string`
- **setPoint** (`setPoint`)
  - Domain: `Thermostat`
  - Range: `xsd:string`
- **sedimentLevel** (`sedimentLevel`)
  - Domain: `WaterHeaterTank`
  - Range: `xsd:string`
- **tankCapacity** (`tankCapacity`)
  - Domain: `WaterHeaterTank`
  - Range: `xsd:string`
- **flushingFrequency** (`flushingFrequency`)
  - Domain: `Tank`
  - Range: `xsd:string`
- **lastFlushed** (`lastFlushed`)
  - Domain: `Tank`
  - Range: `xsd:string`

### 🔀 Object Properties (Relationships)

- **requires precondition** (`requiresPrecondition`)
  - Domain: `Process`
  - Range: `State`
- **produces postcondition** (`producesPostcondition`)
  - Domain: `Process`
  - Range: `State`
- **transforms** (`transforms`)
  - Domain: `Process`
  - Range: `PhysicalEntity`
- **has participant** (`hasParticipant`)
  - Domain: `Process`
  - Range: `PhysicalEntity`
- **state of** (`stateOf`)
  - Domain: `State`
  - Range: `PhysicalEntity`
- **relatesTo** (`relatesTo`)
  - Domain: `owl:Thing`
  - Range: `owl:Thing`
- **heats** (`heats`)
  - Domain: `WaterHeater`
  - Range: `Water`
  - Parent: `relatesTo`
- **hasInlet** (`hasInlet`)
  - Domain: `WaterHeater`
  - Range: `Water`
  - Parent: `relatesTo`
- **precedesProcess** (`precedesProcess`)
  - Domain: `Temperature`
  - Range: `HeatingProcess`
  - Parent: `relatesTo`
- **hasOutletTemperature** (`hasOutletTemperature`)
  - Domain: `Outlet`
  - Range: `Temperature`
  - Parent: `relatesTo`
- **reducesPressure** (`reducesPressure`)
  - Domain: `PressureRegulator`
  - Range: `WaterPressure`
  - Parent: `relatesTo`
- **checksFor** (`checksFor`)
  - Domain: `MaintenanceInspection`
  - Range: `Leak`
  - Parent: `relatesTo`
- **prevents** (`prevents`)
  - Domain: `ExpansionTank`
  - Range: `PressureBuildup`
  - Parent: `relatesTo`
- **isPartOf** (`isPartOf`)
  - Domain: `ExpansionTank`
  - Range: `HotWaterSystem`
  - Parent: `relatesTo`
- **performsInspectionOf** (`performsInspectionOf`)
  - Domain: `Plumber`
  - Range: `Pipe`
  - Parent: `relatesTo`
- **repairs** (`repairs`)
  - Domain: `Plumber`
  - Range: `Leak`
  - Parent: `performsInspectionOf`
- **appliesTo** (`appliesTo`)
  - Domain: `Epoxy`
  - Range: `Leak`
  - Parent: `relatesTo`
- **replaces** (`replaces`)
  - Domain: `Plumber`
  - Range: `PipeSection`
  - Parent: `performsInspectionOf`
- **requires** (`requires`)
  - Domain: `RepairProcess`
  - Range: `WaterSupply`
  - Parent: `relatesTo`
- **drains** (`drains`)
  - Domain: `Plumber`
  - Range: `Pipe`
  - Parent: `performsInspectionOf`
- **hasCutOperation** (`hasCutOperation`)
  - Domain: `PipeSection`
  - Range: `CuttingTask`
  - Parent: `relatesTo`
- **connectedBy** (`connectedBy`)
  - Domain: `Pipe`
  - Range: `SolderingFitting`
  - Parent: `relatesTo`
- **inspectionAction** (`inspectionAction`)
  - Domain: `Plumber`
  - Range: `Continuant`
  - Parent: `performsInspectionOf`
- **testsFor** (`testsFor`)
  - Domain: `Plumber`
  - Range: `Leak`
  - Parent: `inspectionAction`
- **installs** (`installs`)
  - Domain: `Plumber`
  - Range: `Toilet`
  - Parent: `performsInspectionOf`
- **replacesComponent** (`replacesComponent`)
  - Domain: `Plumber`
  - Range: `WaxRing`
  - Parent: `replaces`
- **requiresConnection** (`requiresConnection`)
  - Domain: `Sink`
  - Range: `WaterSupplyLine`
  - Parent: `relatesTo`
- **seals** (`seals`)
  - Domain: `Plumber`
  - Range: `DrainAssembly`
  - Parent: `performsInspectionOf`
- **toolUsage** (`toolUsage`)
  - Domain: `Plumber`
  - Range: `owl:Thing`
  - Parent: `performsInspectionOf`
- **uses** (`uses`)
  - Domain: `Plumber`
  - Range: `Plunger`
  - Parent: `toolUsage`
- **cleans** (`cleans`)
  - Domain: `Plumber`
  - Range: `Drain`
  - Parent: `performsInspectionOf`
- **clears** (`clears`)
  - Domain: `HandAuger`
  - Range: `DrainBlockage`
  - Parent: `relatesTo`
- **diagnoses** (`diagnoses`)
  - Domain: `Camera`
  - Range: `Drain`
  - Parent: `relatesTo`
- **checks** (`checks`)
  - Domain: `Diagnostics`
  - Range: `Thermostat`
  - Parent: `relatesTo`
- **controls** (`controls`)
  - Domain: `Thermostat`
  - Range: `WaterHeater`
  - Parent: `relatesTo`
- **flushes** (`flushes`)
  - Domain: `Plumber`
  - Range: `WaterHeaterTank`
  - Parent: `performsInspectionOf`
- **containsSediment** (`containsSediment`)
  - Domain: `WaterHeaterTank`
  - Range: `Sediment`
  - Parent: `relatesTo`

---

## 💾 Entity Instances
### 🔧 Physical Entity Instances

- **Expansion Tank ET-50**
  - Type: `ExpansionTank`
  - ID: `68dfaa00d7a01243de9c9444`
  - Attributes: {"capacity":5,"unit":"gallons"}
  - Sources: phase1_sent_1
  - Confidence: 91%
- **Pressure Regulator PR-200**
  - Type: `PressureRegulator`
  - ID: `68dfaa00d7a01243de9c9443`
  - Attributes: {"maxPressure":80,"minPressure":50,"unit":"PSI"}
  - Sources: phase1_sent_1
  - Confidence: 93%
- **Water Heater WH-101**
  - Type: `WaterHeater`
  - ID: `68dfaa00d7a01243de9c9442`
  - Attributes: {"capacity":50,"unit":"gallons","manufacturer":"Rheem"}
  - Sources: phase1_sent_1
  - Confidence: 95%

### ✅ Task Instances

- **Water Heater Diagnostics**
  - Type: `MaintenanceInspection`
  - ID: `68dfaa01d7a01243de9c944d`
  - Attributes: {"taskType":"diagnostics","checks":["thermostat","heating element","gas valve"]}
  - Sources: phase2_sent_water_heater
  - Confidence: 94%
- **Tank Flushing**
  - Type: `MaintenanceInspection`
  - ID: `68dfaa01d7a01243de9c944e`
  - Attributes: {"taskType":"maintenance","purpose":"remove sediment buildup","frequency":"periodic"}
  - Sources: phase2_sent_water_heater
  - Confidence: 93%
- **Visual Inspection**
  - Type: `Task`
  - ID: `68dfaa00d7a01243de9c9445`
  - Attributes: {"taskType":"inspection","purpose":"assess pipe damage","tools":["visual","specialized tools"]}
  - Sources: phase2_sent_pipe_repair
  - Confidence: 92%
- **Leak Repair with Epoxy**
  - Type: `Task`
  - ID: `68dfaa00d7a01243de9c9446`
  - Attributes: {"taskType":"repair","method":"epoxy application","severity":"minor"}
  - Sources: phase2_sent_pipe_repair
  - Confidence: 90%
- **Pipe Section Replacement**
  - Type: `Task`
  - ID: `68dfaa00d7a01243de9c9447`
  - Attributes: {"taskType":"replacement","severity":"extensive damage","steps":["shut off water","drain pipes","cut pipe","install new section","test"]}
  - Sources: phase2_sent_pipe_repair
  - Confidence: 93%
- **Toilet Installation**
  - Type: `Task`
  - ID: `68dfaa00d7a01243de9c9448`
  - Attributes: {"taskType":"installation","fixture":"toilet","components":["wax ring","flange"]}
  - Sources: phase2_sent_installations
  - Confidence: 91%
- **Sink Installation**
  - Type: `Task`
  - ID: `68dfaa00d7a01243de9c9449`
  - Attributes: {"taskType":"installation","fixture":"sink","steps":["connect supply lines","seal drain assembly"]}
  - Sources: phase2_sent_installations
  - Confidence: 91%
- **Shower Installation**
  - Type: `Task`
  - ID: `68dfaa00d7a01243de9c944a`
  - Attributes: {"taskType":"installation","fixture":"shower","requirements":["waterproofing","framing"]}
  - Sources: phase2_sent_installations
  - Confidence: 90%
- **Drain Cleaning**
  - Type: `Task`
  - ID: `68dfaa00d7a01243de9c944b`
  - Attributes: {"taskType":"maintenance","tools":["plunger","hand auger","motorized snake","hydro-jetting"],"diagnostic":"camera inspection"}
  - Sources: phase2_sent_drain_cleaning
  - Confidence: 93%
- **Camera Inspection**
  - Type: `Task`
  - ID: `68dfaa01d7a01243de9c944c`
  - Attributes: {"taskType":"diagnostic","timing":"before and after cleaning","purpose":"diagnose blockages"}
  - Sources: phase2_sent_drain_cleaning
  - Confidence: 92%
- **Water Heater Installation**
  - Type: `Task`
  - ID: `68dfaa01d7a01243de9c944f`
  - Attributes: {"taskType":"installation","steps":["disconnect old unit","connect water supply","connect power","install safety features"],"safetyFeatures":["pressure relief valve"]}
  - Sources: phase2_sent_water_heater
  - Confidence: 95%
- **Leak Detection**
  - Type: `Task`
  - ID: `68dfaa01d7a01243de9c9450`
  - Attributes: {"taskType":"diagnostic","tools":["acoustic detector","thermal camera","moisture meter","tracer gas"],"approach":"minimize structural damage"}
  - Sources: phase2_sent_leak_detection
  - Confidence: 94%