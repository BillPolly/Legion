/**
 * DiagramGenerator - Generates visual diagrams from SD artifacts
 */

export class DiagramGenerator {
  constructor(databaseService) {
    this.databaseService = databaseService;
  }

  /**
   * Generate class diagram from domain model
   */
  async generateClassDiagram(projectId) {
    const entities = await this.getEntities(projectId);
    const aggregates = await this.getAggregates(projectId);
    const valueObjects = await this.getValueObjects(projectId);
    
    const nodes = [];
    const edges = [];
    
    // Create nodes for entities
    for (const entity of entities) {
      nodes.push({
        id: entity.id || `entity_${entity.name}`,
        type: 'entity',
        label: entity.name,
        properties: entity.properties || [],
        methods: entity.methods || [],
        position: this.calculatePosition(nodes.length),
        style: {
          fill: '#e3f2fd',
          stroke: '#1976d2',
          strokeWidth: 2
        }
      });
    }
    
    // Create nodes for value objects
    for (const vo of valueObjects) {
      nodes.push({
        id: vo.id || `vo_${vo.name}`,
        type: 'valueObject',
        label: vo.name,
        properties: vo.properties || [],
        position: this.calculatePosition(nodes.length),
        style: {
          fill: '#f3e5f5',
          stroke: '#7b1fa2',
          strokeWidth: 2
        }
      });
    }
    
    // Create nodes for aggregates
    for (const aggregate of aggregates) {
      nodes.push({
        id: aggregate.id || `aggregate_${aggregate.name}`,
        type: 'aggregate',
        label: aggregate.name,
        rootEntity: aggregate.rootEntity,
        position: this.calculatePosition(nodes.length),
        style: {
          fill: '#fff3e0',
          stroke: '#f57c00',
          strokeWidth: 3,
          strokeDasharray: '5,5'
        }
      });
      
      // Create edge from aggregate to root entity
      if (aggregate.rootEntity) {
        edges.push({
          id: `edge_${aggregate.name}_${aggregate.rootEntity}`,
          source: aggregate.id || `aggregate_${aggregate.name}`,
          target: `entity_${aggregate.rootEntity}`,
          type: 'aggregateRoot',
          label: 'root',
          style: {
            stroke: '#f57c00',
            strokeWidth: 2,
            strokeDasharray: '5,5'
          }
        });
      }
    }
    
    // Create edges for relationships
    for (const entity of entities) {
      if (entity.relationships) {
        for (const rel of entity.relationships) {
          edges.push({
            id: `edge_${entity.name}_${rel.target}`,
            source: `entity_${entity.name}`,
            target: `entity_${rel.target}`,
            type: rel.type,
            label: rel.label || rel.type,
            style: {
              stroke: '#666',
              strokeWidth: 1
            }
          });
        }
      }
    }
    
    return {
      nodes,
      edges,
      layout: 'hierarchical',
      metadata: {
        projectId,
        entityCount: entities.length,
        valueObjectCount: valueObjects.length,
        aggregateCount: aggregates.length,
        generated: new Date().toISOString()
      }
    };
  }

  /**
   * Generate architecture diagram
   */
  async generateArchitectureDiagram(projectId) {
    const layers = await this.getLayers(projectId);
    const useCases = await this.getUseCases(projectId);
    const interfaces = await this.getInterfaces(projectId);
    
    const nodes = [];
    const edges = [];
    
    // Create layer nodes
    const layerOrder = ['presentation', 'application', 'domain', 'infrastructure'];
    let yPosition = 100;
    
    for (const layerName of layerOrder) {
      const layer = layers.find(l => l.name === layerName) || { name: layerName };
      
      nodes.push({
        id: `layer_${layerName}`,
        type: 'layer',
        label: layerName.charAt(0).toUpperCase() + layerName.slice(1) + ' Layer',
        components: layer.components || [],
        position: { x: 400, y: yPosition },
        size: { width: 600, height: 120 },
        style: {
          fill: this.getLayerColor(layerName),
          stroke: '#333',
          strokeWidth: 2
        }
      });
      
      yPosition += 150;
    }
    
    // Add use cases to application layer
    for (const useCase of useCases) {
      nodes.push({
        id: useCase.id || `usecase_${useCase.name}`,
        type: 'useCase',
        label: useCase.name,
        layer: 'application',
        position: this.calculatePositionInLayer('application', nodes.length),
        style: {
          fill: '#fff',
          stroke: '#4caf50',
          strokeWidth: 2
        }
      });
    }
    
    // Add interfaces
    for (const iface of interfaces) {
      nodes.push({
        id: iface.id || `interface_${iface.name}`,
        type: 'interface',
        label: iface.name,
        layer: iface.layer || 'domain',
        position: this.calculatePositionInLayer(iface.layer || 'domain', nodes.length),
        style: {
          fill: '#fff',
          stroke: '#ff9800',
          strokeWidth: 2,
          strokeDasharray: '3,3'
        }
      });
    }
    
    // Create dependency edges
    for (const layer of layers) {
      if (layer.dependencies) {
        for (const dep of layer.dependencies) {
          edges.push({
            id: `dep_${layer.name}_${dep}`,
            source: `layer_${layer.name}`,
            target: `layer_${dep}`,
            type: 'dependency',
            style: {
              stroke: '#999',
              strokeWidth: 2,
              strokeDasharray: '5,5'
            }
          });
        }
      }
    }
    
    return {
      nodes,
      edges,
      layout: 'layered',
      metadata: {
        projectId,
        layerCount: layers.length,
        useCaseCount: useCases.length,
        interfaceCount: interfaces.length,
        generated: new Date().toISOString()
      }
    };
  }

  /**
   * Generate sequence diagram for a use case
   */
  async generateSequenceDiagram(projectId, useCaseName) {
    const participants = [];
    const messages = [];
    
    // Mock sequence for demonstration
    participants.push(
      { id: 'user', label: 'User', type: 'actor' },
      { id: 'controller', label: 'Controller', type: 'boundary' },
      { id: 'usecase', label: 'UseCase', type: 'control' },
      { id: 'repository', label: 'Repository', type: 'entity' },
      { id: 'database', label: 'Database', type: 'database' }
    );
    
    messages.push(
      { from: 'user', to: 'controller', label: 'request', seq: 1 },
      { from: 'controller', to: 'usecase', label: 'execute', seq: 2 },
      { from: 'usecase', to: 'repository', label: 'find', seq: 3 },
      { from: 'repository', to: 'database', label: 'query', seq: 4 },
      { from: 'database', to: 'repository', label: 'result', seq: 5, type: 'return' },
      { from: 'repository', to: 'usecase', label: 'entity', seq: 6, type: 'return' },
      { from: 'usecase', to: 'controller', label: 'response', seq: 7, type: 'return' },
      { from: 'controller', to: 'user', label: 'display', seq: 8, type: 'return' }
    );
    
    return {
      participants,
      messages,
      metadata: {
        projectId,
        useCaseName,
        generated: new Date().toISOString()
      }
    };
  }

  /**
   * Generate data flow diagram
   */
  async generateDataFlowDiagram(projectId) {
    const stores = await this.getStores(projectId);
    const actions = await this.getActions(projectId);
    const components = await this.getComponents(projectId);
    
    const nodes = [];
    const edges = [];
    
    // Add stores
    for (const store of stores) {
      nodes.push({
        id: store.id || `store_${store.name}`,
        type: 'store',
        label: store.name,
        position: this.calculatePosition(nodes.length),
        style: {
          fill: '#e8f5e9',
          stroke: '#4caf50',
          strokeWidth: 2
        }
      });
    }
    
    // Add components
    for (const component of components) {
      nodes.push({
        id: component.id || `component_${component.name}`,
        type: 'component',
        label: component.name,
        position: this.calculatePosition(nodes.length),
        style: {
          fill: '#e3f2fd',
          stroke: '#2196f3',
          strokeWidth: 2
        }
      });
    }
    
    // Add action flows
    for (const action of actions) {
      if (action.source && action.target) {
        edges.push({
          id: `flow_${action.name}`,
          source: action.source,
          target: action.target,
          label: action.name,
          type: 'dataFlow',
          style: {
            stroke: '#ff5722',
            strokeWidth: 2
          }
        });
      }
    }
    
    return {
      nodes,
      edges,
      layout: 'force',
      metadata: {
        projectId,
        storeCount: stores.length,
        componentCount: components.length,
        actionCount: actions.length,
        generated: new Date().toISOString()
      }
    };
  }

  // Helper methods for data retrieval
  
  async getEntities(projectId) {
    if (!this.databaseService) {
      return this.getMockEntities();
    }
    
    const artifacts = await this.databaseService.retrieveArtifacts('entity', { projectId });
    return artifacts.results || [];
  }
  
  async getAggregates(projectId) {
    if (!this.databaseService) {
      return this.getMockAggregates();
    }
    
    const artifacts = await this.databaseService.retrieveArtifacts('aggregate', { projectId });
    return artifacts.results || [];
  }
  
  async getValueObjects(projectId) {
    if (!this.databaseService) {
      return this.getMockValueObjects();
    }
    
    const artifacts = await this.databaseService.retrieveArtifacts('value_object', { projectId });
    return artifacts.results || [];
  }
  
  async getLayers(projectId) {
    if (!this.databaseService) {
      return this.getMockLayers();
    }
    
    const artifacts = await this.databaseService.retrieveArtifacts('layer', { projectId });
    return artifacts.results || [];
  }
  
  async getUseCases(projectId) {
    if (!this.databaseService) {
      return this.getMockUseCases();
    }
    
    const artifacts = await this.databaseService.retrieveArtifacts('use_case', { projectId });
    return artifacts.results || [];
  }
  
  async getInterfaces(projectId) {
    if (!this.databaseService) {
      return [];
    }
    
    const artifacts = await this.databaseService.retrieveArtifacts('interface', { projectId });
    return artifacts.results || [];
  }
  
  async getStores(projectId) {
    if (!this.databaseService) {
      return [];
    }
    
    const artifacts = await this.databaseService.retrieveArtifacts('store', { projectId });
    return artifacts.results || [];
  }
  
  async getActions(projectId) {
    if (!this.databaseService) {
      return [];
    }
    
    const artifacts = await this.databaseService.retrieveArtifacts('action', { projectId });
    return artifacts.results || [];
  }
  
  async getComponents(projectId) {
    if (!this.databaseService) {
      return [];
    }
    
    const artifacts = await this.databaseService.retrieveArtifacts('component', { projectId });
    return artifacts.results || [];
  }
  
  // Helper methods for layout
  
  calculatePosition(index) {
    const columns = 4;
    const spacing = 200;
    const x = (index % columns) * spacing + 100;
    const y = Math.floor(index / columns) * spacing + 100;
    return { x, y };
  }
  
  calculatePositionInLayer(layerName, index) {
    const layerY = {
      'presentation': 100,
      'application': 250,
      'domain': 400,
      'infrastructure': 550
    };
    
    return {
      x: 200 + (index * 150),
      y: layerY[layerName] || 300
    };
  }
  
  getLayerColor(layerName) {
    const colors = {
      'presentation': '#e8eaf6',
      'application': '#e0f2f1',
      'domain': '#fff9c4',
      'infrastructure': '#fce4ec'
    };
    
    return colors[layerName] || '#f5f5f5';
  }
  
  // Mock data methods for testing
  
  getMockEntities() {
    return [
      {
        name: 'User',
        properties: ['id', 'email', 'password', 'profile'],
        methods: ['authenticate', 'updateProfile'],
        relationships: [
          { target: 'Task', type: 'oneToMany', label: 'owns' }
        ]
      },
      {
        name: 'Task',
        properties: ['id', 'title', 'description', 'status', 'assigneeId'],
        methods: ['complete', 'assign', 'updateStatus'],
        relationships: [
          { target: 'User', type: 'manyToOne', label: 'assignedTo' }
        ]
      },
      {
        name: 'Project',
        properties: ['id', 'name', 'description', 'startDate'],
        methods: ['addTask', 'addMember'],
        relationships: [
          { target: 'Task', type: 'oneToMany', label: 'contains' }
        ]
      }
    ];
  }
  
  getMockAggregates() {
    return [
      {
        name: 'UserAggregate',
        rootEntity: 'User'
      },
      {
        name: 'ProjectAggregate',
        rootEntity: 'Project'
      }
    ];
  }
  
  getMockValueObjects() {
    return [
      {
        name: 'Email',
        properties: ['value'],
        methods: ['validate']
      },
      {
        name: 'TaskStatus',
        properties: ['value'],
        methods: ['canTransitionTo']
      }
    ];
  }
  
  getMockLayers() {
    return [
      {
        name: 'presentation',
        components: ['Controllers', 'Views', 'ViewModels'],
        dependencies: ['application']
      },
      {
        name: 'application',
        components: ['UseCases', 'Services', 'DTOs'],
        dependencies: ['domain']
      },
      {
        name: 'domain',
        components: ['Entities', 'ValueObjects', 'DomainServices'],
        dependencies: []
      },
      {
        name: 'infrastructure',
        components: ['Repositories', 'External Services', 'Database'],
        dependencies: ['domain', 'application']
      }
    ];
  }
  
  getMockUseCases() {
    return [
      {
        name: 'CreateTaskUseCase',
        input: ['title', 'description', 'projectId'],
        output: 'Task'
      },
      {
        name: 'CompleteTaskUseCase',
        input: ['taskId', 'userId'],
        output: 'Task'
      },
      {
        name: 'AssignTaskUseCase',
        input: ['taskId', 'assigneeId'],
        output: 'Task'
      }
    ];
  }
}