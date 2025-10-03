/**
 * Upper-Level Ontology Bootstrap
 *
 * Defines fundamental categories for entity classification:
 *
 * kg:Continuant (things that persist through time)
 * ├─ kg:PhysicalEntity - Physical objects (pumps, tanks, valves)
 * └─ kg:State - States and situations (temperature=150°F, valve=open)
 *
 * kg:Occurrent (things that happen)
 * ├─ kg:Process - Processes and transformations (heating, pumping)
 * └─ kg:Task - Tasks and activities (maintenance, inspection)
 *
 * These categories are mutually exclusive (disjoint) and always present
 * in the ontology. All domain entities should be subclasses of these.
 */

/**
 * Get bootstrap RDF triples for upper-level ontology
 *
 * @returns {Array<Array<string>>} - Array of [subject, predicate, object] triples
 */
export function getBootstrapTriples() {
  return [
    // ===================================================================
    // TOP-LEVEL CATEGORIES
    // ===================================================================

    // Continuant - Things that persist through time
    ['kg:Continuant', 'rdf:type', 'owl:Class'],
    ['kg:Continuant', 'rdfs:subClassOf', 'owl:Thing'],
    ['kg:Continuant', 'rdfs:label', '"Continuant"'],
    ['kg:Continuant', 'skos:definition', '"An entity that persists through time while maintaining its identity. Continuants can change their properties (a pump can change speed) but remain the same entity."'],
    ['kg:Continuant', 'rdfs:comment', '"Top-level category for entities that exist and endure"'],
    ['kg:Continuant', 'skos:scopeNote', '"Used to classify persistent entities like physical objects and states"'],
    ['kg:Continuant', 'skos:altLabel', '"persistent entity, enduring entity, thing that persists"'],

    // Occurrent - Things that happen
    ['kg:Occurrent', 'rdf:type', 'owl:Class'],
    ['kg:Occurrent', 'rdfs:subClassOf', 'owl:Thing'],
    ['kg:Occurrent', 'rdfs:label', '"Occurrent"'],
    ['kg:Occurrent', 'skos:definition', '"An entity that happens or occurs, unfolding through time. Occurrents have temporal parts and do not persist - they occur."'],
    ['kg:Occurrent', 'rdfs:comment', '"Top-level category for processes, events, and activities"'],
    ['kg:Occurrent', 'skos:scopeNote', '"Used to classify things that happen like processes, transformations, and tasks"'],
    ['kg:Occurrent', 'skos:altLabel', '"event, happening, occurrence, process"'],

    // Disjointness axiom - Continuants and Occurrents cannot overlap
    ['kg:Continuant', 'owl:disjointWith', 'kg:Occurrent'],

    // ===================================================================
    // CONTINUANT SUBCATEGORIES
    // ===================================================================

    // PhysicalEntity - Physical objects
    ['kg:PhysicalEntity', 'rdf:type', 'owl:Class'],
    ['kg:PhysicalEntity', 'rdfs:subClassOf', 'kg:Continuant'],
    ['kg:PhysicalEntity', 'rdfs:label', '"Physical Entity"'],
    ['kg:PhysicalEntity', 'skos:definition', '"A material object that has physical presence and occupies space. Physical entities include equipment, components, materials, and infrastructure."'],
    ['kg:PhysicalEntity', 'rdfs:comment', '"A type of Continuant that has physical manifestation and spatial extent"'],
    ['kg:PhysicalEntity', 'skos:scopeNote', '"Used for pumps, tanks, valves, pipes, motors, sensors - any physical object in the domain"'],
    ['kg:PhysicalEntity', 'skos:altLabel', '"physical object, material object, equipment, component, device"'],

    // State - States and situations
    ['kg:State', 'rdf:type', 'owl:Class'],
    ['kg:State', 'rdfs:subClassOf', 'kg:Continuant'],
    ['kg:State', 'rdfs:label', '"State"'],
    ['kg:State', 'skos:definition', '"A condition or situation that holds for some entity at a particular time. States describe how things are configured, what values they have, or what condition they are in."'],
    ['kg:State', 'rdfs:comment', '"A type of Continuant that represents a condition, configuration, or situation"'],
    ['kg:State', 'skos:scopeNote', '"Used for temperature readings, valve positions, pressure levels, operational modes, system configurations"'],
    ['kg:State', 'skos:altLabel', '"condition, situation, configuration, status, mode"'],

    // Disjointness - PhysicalEntity and State don't overlap
    ['kg:PhysicalEntity', 'owl:disjointWith', 'kg:State'],

    // ===================================================================
    // OCCURRENT SUBCATEGORIES
    // ===================================================================

    // Process - Processes and transformations
    ['kg:Process', 'rdf:type', 'owl:Class'],
    ['kg:Process', 'rdfs:subClassOf', 'kg:Occurrent'],
    ['kg:Process', 'rdfs:label', '"Process"'],
    ['kg:Process', 'skos:definition', '"A natural or industrial activity that transforms inputs to outputs through a series of steps. Processes have participants (entities involved), preconditions (required states), and postconditions (resulting states)."'],
    ['kg:Process', 'rdfs:comment', '"A type of Occurrent that represents transformation or continuous activity"'],
    ['kg:Process', 'skos:scopeNote', '"Used for heating, cooling, pumping, mixing, chemical reactions, flows"'],
    ['kg:Process', 'skos:altLabel', '"transformation, operation, activity, procedure"'],

    // Task - Tasks and activities
    ['kg:Task', 'rdf:type', 'owl:Class'],
    ['kg:Task', 'rdfs:subClassOf', 'kg:Occurrent'],
    ['kg:Task', 'rdfs:label', '"Task"'],
    ['kg:Task', 'skos:definition', '"A planned activity or action performed by an agent to achieve a specific goal. Tasks are typically discrete, goal-directed, and often involve human or automated agency."'],
    ['kg:Task', 'rdfs:comment', '"A type of Occurrent that represents planned, goal-directed action"'],
    ['kg:Task', 'skos:scopeNote', '"Used for maintenance activities, inspections, repairs, calibrations, procedures"'],
    ['kg:Task', 'skos:altLabel', '"activity, action, job, work, procedure, operation"'],

    // Disjointness - Process and Task don't overlap
    ['kg:Process', 'owl:disjointWith', 'kg:Task'],

    // ===================================================================
    // PROCESS-STATE RELATIONSHIPS
    // ===================================================================

    // requiresPrecondition - Process requires State before it can start
    ['kg:requiresPrecondition', 'rdf:type', 'owl:ObjectProperty'],
    ['kg:requiresPrecondition', 'rdfs:label', '"requires precondition"'],
    ['kg:requiresPrecondition', 'skos:definition', '"Relates a process to a state that must hold before the process can begin."'],
    ['kg:requiresPrecondition', 'rdfs:domain', 'kg:Process'],
    ['kg:requiresPrecondition', 'rdfs:range', 'kg:State'],
    ['kg:requiresPrecondition', 'rdfs:comment', '"Links processes to their required precondition states"'],
    ['kg:requiresPrecondition', 'skos:scopeNote', '"Used when a process needs specific conditions to be met before starting"'],
    ['kg:requiresPrecondition', 'skos:altLabel', '"needs state, requires condition, prerequisite"'],

    // producesPostcondition - Process produces State after it completes
    ['kg:producesPostcondition', 'rdf:type', 'owl:ObjectProperty'],
    ['kg:producesPostcondition', 'rdfs:label', '"produces postcondition"'],
    ['kg:producesPostcondition', 'skos:definition', '"Relates a process to a state that holds after the process completes."'],
    ['kg:producesPostcondition', 'rdfs:domain', 'kg:Process'],
    ['kg:producesPostcondition', 'rdfs:range', 'kg:State'],
    ['kg:producesPostcondition', 'rdfs:comment', '"Links processes to their resulting postcondition states"'],
    ['kg:producesPostcondition', 'skos:scopeNote', '"Used when a process brings about or ensures certain conditions"'],
    ['kg:producesPostcondition', 'skos:altLabel', '"results in state, creates condition, ensures"'],

    // transforms - Process acts on PhysicalEntity
    ['kg:transforms', 'rdf:type', 'owl:ObjectProperty'],
    ['kg:transforms', 'rdfs:label', '"transforms"'],
    ['kg:transforms', 'skos:definition', '"Relates a process to a physical entity that it acts upon or changes."'],
    ['kg:transforms', 'rdfs:domain', 'kg:Process'],
    ['kg:transforms', 'rdfs:range', 'kg:PhysicalEntity'],
    ['kg:transforms', 'rdfs:comment', '"Links processes to the physical entities they transform"'],
    ['kg:transforms', 'skos:scopeNote', '"Used when a process acts on, modifies, or changes a physical entity"'],
    ['kg:transforms', 'skos:altLabel', '"acts on, modifies, changes, processes"'],

    // hasParticipant - Process involves PhysicalEntity
    ['kg:hasParticipant', 'rdf:type', 'owl:ObjectProperty'],
    ['kg:hasParticipant', 'rdfs:label', '"has participant"'],
    ['kg:hasParticipant', 'skos:definition', '"Relates a process to a physical entity that participates in or is involved in the process."'],
    ['kg:hasParticipant', 'rdfs:domain', 'kg:Process'],
    ['kg:hasParticipant', 'rdfs:range', 'kg:PhysicalEntity'],
    ['kg:hasParticipant', 'rdfs:comment', '"Links processes to participating physical entities"'],
    ['kg:hasParticipant', 'skos:scopeNote', '"Used when a physical entity is involved in a process without necessarily being transformed"'],
    ['kg:hasParticipant', 'skos:altLabel', '"involves, includes, uses"'],

    // ===================================================================
    // STATE-ENTITY RELATIONSHIPS
    // ===================================================================

    // stateOf - State is about PhysicalEntity
    ['kg:stateOf', 'rdf:type', 'owl:ObjectProperty'],
    ['kg:stateOf', 'rdfs:label', '"state of"'],
    ['kg:stateOf', 'skos:definition', '"Relates a state to the physical entity whose condition or configuration it describes."'],
    ['kg:stateOf', 'rdfs:domain', 'kg:State'],
    ['kg:stateOf', 'rdfs:range', 'kg:PhysicalEntity'],
    ['kg:stateOf', 'rdfs:comment', '"Links states to the entities they describe"'],
    ['kg:stateOf', 'skos:scopeNote', '"Used to connect a state (e.g., temperature=150°F) to the entity it describes (e.g., Tank T100)"'],
    ['kg:stateOf', 'skos:altLabel', '"describes, is condition of, pertains to"']
  ];
}

/**
 * Check if ontology type is a PhysicalEntity
 *
 * @param {string} ontologyType - The kg:* type to check
 * @param {Function} getAncestors - Function to get ancestors (from HierarchyTraversalService)
 * @returns {Promise<boolean>}
 */
export async function isPhysicalEntity(ontologyType, getAncestors) {
  if (ontologyType === 'kg:PhysicalEntity') return true;
  const ancestors = await getAncestors(ontologyType);
  return ancestors.includes('kg:PhysicalEntity');
}

/**
 * Check if ontology type is a State
 *
 * @param {string} ontologyType - The kg:* type to check
 * @param {Function} getAncestors - Function to get ancestors (from HierarchyTraversalService)
 * @returns {Promise<boolean>}
 */
export async function isState(ontologyType, getAncestors) {
  if (ontologyType === 'kg:State') return true;
  const ancestors = await getAncestors(ontologyType);
  return ancestors.includes('kg:State');
}

/**
 * Check if ontology type is a Process
 *
 * @param {string} ontologyType - The kg:* type to check
 * @param {Function} getAncestors - Function to get ancestors (from HierarchyTraversalService)
 * @returns {Promise<boolean>}
 */
export async function isProcess(ontologyType, getAncestors) {
  if (ontologyType === 'kg:Process') return true;
  const ancestors = await getAncestors(ontologyType);
  return ancestors.includes('kg:Process');
}

/**
 * Check if ontology type is a Task
 *
 * @param {string} ontologyType - The kg:* type to check
 * @param {Function} getAncestors - Function to get ancestors (from HierarchyTraversalService)
 * @returns {Promise<boolean>}
 */
export async function isTask(ontologyType, getAncestors) {
  if (ontologyType === 'kg:Task') return true;
  const ancestors = await getAncestors(ontologyType);
  return ancestors.includes('kg:Task');
}

/**
 * Infer category for an ontology type
 *
 * @param {string} ontologyType - The kg:* type to categorize
 * @param {Function} getAncestors - Function to get ancestors (from HierarchyTraversalService)
 * @returns {Promise<string|null>} - 'PhysicalEntity', 'State', 'Process', 'Task', or null
 */
export async function inferCategory(ontologyType, getAncestors) {
  // Check if the type itself is one of the categories
  if (ontologyType === 'kg:PhysicalEntity') return 'PhysicalEntity';
  if (ontologyType === 'kg:State') return 'State';
  if (ontologyType === 'kg:Process') return 'Process';
  if (ontologyType === 'kg:Task') return 'Task';

  // Check ancestors
  const ancestors = await getAncestors(ontologyType);

  if (ancestors.includes('kg:PhysicalEntity')) return 'PhysicalEntity';
  if (ancestors.includes('kg:State')) return 'State';
  if (ancestors.includes('kg:Process')) return 'Process';
  if (ancestors.includes('kg:Task')) return 'Task';

  return null;
}
