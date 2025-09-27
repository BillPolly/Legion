import { MongoClient, ObjectId } from 'mongodb';
import { DatabaseError } from './errors/index.js';

const DEFAULT_SOP_PERSPECTIVE_TYPES = [
  {
    name: "intent_perspective",
    description: "What user goal or intent does this SOP address?",
    prompt_template: "Describe the user's goal or intent that this SOP addresses. Focus on what the user is trying to accomplish. SOP: {title} - {intent}. One sentence maximum.",
    category: "discovery",
    scope: "sop",
    order: 1,
    enabled: true
  },
  {
    name: "preconditions_perspective",
    description: "What must be true before using this SOP?",
    prompt_template: "List the key prerequisites and preconditions for this SOP. What must exist or be true before starting? SOP: {title}. Prerequisites: {prerequisites}. One sentence maximum.",
    category: "applicability",
    scope: "sop",
    order: 2,
    enabled: true
  },
  {
    name: "tools_perspective",
    description: "What tools and resources does this SOP use?",
    prompt_template: "List the primary tools, APIs, and resources used in this SOP. Focus on what the SOP relies on. SOP: {title}. Tools: {toolsMentioned}. One sentence maximum.",
    category: "technical",
    scope: "sop",
    order: 3,
    enabled: true
  },
  {
    name: "outcomes_perspective",
    description: "What results or outputs does this SOP produce?",
    prompt_template: "Describe the key outputs and results produced by this SOP. What does the user get when it's complete? SOP: {title}. Outputs: {outputs}. One sentence maximum.",
    category: "results",
    scope: "sop",
    order: 4,
    enabled: true
  },
  {
    name: "step_perspective",
    description: "What does this individual step accomplish?",
    prompt_template: "Describe what this step accomplishes in the context of the SOP. Step: {stepGloss}. SOP context: {title}. One sentence maximum.",
    category: "execution",
    scope: "step",
    order: 5,
    enabled: true
  }
];

export class SOPStorage {
  constructor({ resourceManager, db }) {
    if (!resourceManager && !db) {
      throw new DatabaseError(
        'ResourceManager or db instance is required',
        'initialization',
        'SOPStorage'
      );
    }
    
    this.resourceManager = resourceManager;
    this.db = db;
    this.client = null;
    this._isConnected = false;
  }
  
  async initialize() {
    if (this.db) {
      this._isConnected = true;
      await this._ensureCollections();
      await this._seedPerspectiveTypes();
      await this._createIndexes();
      return;
    }
    
    const mongoUrl = this.resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    const dbName = this.resourceManager.get('env.SOP_DB_NAME') || 'legion_sops';
    
    this.client = new MongoClient(mongoUrl);
    await this.client.connect();
    this.db = this.client.db(dbName);
    this._isConnected = true;
    
    await this._ensureCollections();
    await this._seedPerspectiveTypes();
    await this._createIndexes();
  }
  
  async close() {
    this._isConnected = false;
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.db = null;
  }
  
  isConnected() {
    return this._isConnected;
  }
  
  async _ensureCollections() {
    const collections = await this.db.listCollections().toArray();
    const names = new Set(collections.map(c => c.name));
    
    if (!names.has('sops')) {
      await this.db.createCollection('sops');
    }
    if (!names.has('sop_perspective_types')) {
      await this.db.createCollection('sop_perspective_types');
    }
    if (!names.has('sop_perspectives')) {
      await this.db.createCollection('sop_perspectives');
    }
  }
  
  async _seedPerspectiveTypes() {
    const collection = this.db.collection('sop_perspective_types');
    const count = await collection.countDocuments();
    
    if (count === 0) {
      const types = DEFAULT_SOP_PERSPECTIVE_TYPES.map(t => ({
        ...t,
        created_at: new Date(),
        updated_at: new Date()
      }));
      
      await collection.insertMany(types);
    }
  }
  
  async _createIndexes() {
    const sopsCollection = this.db.collection('sops');
    await sopsCollection.createIndex({ title: 1 }, { unique: true });
    await sopsCollection.createIndex({ tags: 1 });
    await sopsCollection.createIndex({ toolsMentioned: 1 });
    await sopsCollection.createIndex({ 'quality.source': 1 });
    await sopsCollection.createIndex({ title: 'text', intent: 'text', description: 'text' });
    
    const typesCollection = this.db.collection('sop_perspective_types');
    await typesCollection.createIndex({ name: 1 }, { unique: true });
    await typesCollection.createIndex({ scope: 1 });
    await typesCollection.createIndex({ enabled: 1 });
    await typesCollection.createIndex({ order: 1 });
    
    const perspectivesCollection = this.db.collection('sop_perspectives');
    await perspectivesCollection.createIndex({ sop_id: 1 });
    await perspectivesCollection.createIndex({ perspective_type_name: 1 });
    await perspectivesCollection.createIndex({ sop_id: 1, perspective_type_name: 1, step_index: 1 }, { unique: true, sparse: true });
    await perspectivesCollection.createIndex({ scope: 1 });
    await perspectivesCollection.createIndex({ batch_id: 1 });
    await perspectivesCollection.createIndex({ content: 'text', keywords: 'text' });
  }
  
  async saveSOP(sop) {
    const collection = this.db.collection('sops');
    
    const sopDoc = {
      ...sop,
      createdAt: sop.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.replaceOne(
      { title: sop.title },
      sopDoc,
      { upsert: true }
    );
    
    if (result.upsertedId) {
      sopDoc._id = result.upsertedId;
    } else {
      const found = await collection.findOne({ title: sop.title });
      sopDoc._id = found._id;
    }
    
    return sopDoc;
  }
  
  async findSOP(sopId) {
    const collection = this.db.collection('sops');
    return await collection.findOne({ _id: new ObjectId(sopId) });
  }
  
  async findSOPByTitle(title) {
    const collection = this.db.collection('sops');
    return await collection.findOne({ title });
  }
  
  async findSOPs(filter = {}) {
    const collection = this.db.collection('sops');
    return await collection.find(filter).toArray();
  }
  
  async deleteSOP(sopId) {
    const collection = this.db.collection('sops');
    await collection.deleteOne({ _id: new ObjectId(sopId) });
  }
  
  async countSOPs(filter = {}) {
    const collection = this.db.collection('sops');
    return await collection.countDocuments(filter);
  }
  
  async savePerspectiveType(type) {
    const collection = this.db.collection('sop_perspective_types');
    
    const typeDoc = {
      ...type,
      created_at: type.created_at || new Date(),
      updated_at: new Date()
    };
    
    await collection.replaceOne(
      { name: type.name },
      typeDoc,
      { upsert: true }
    );
    
    return typeDoc;
  }
  
  async getPerspectiveType(name) {
    const collection = this.db.collection('sop_perspective_types');
    return await collection.findOne({ name });
  }
  
  async findPerspectiveTypes(filter = {}) {
    const collection = this.db.collection('sop_perspective_types');
    return await collection.find(filter).sort({ order: 1 }).toArray();
  }
  
  async saveSOPPerspective(perspective) {
    const collection = this.db.collection('sop_perspectives');
    
    const perspectiveDoc = {
      ...perspective,
      generated_at: perspective.generated_at || new Date()
    };
    
    const filter = { 
      sop_id: perspective.sop_id,
      perspective_type_name: perspective.perspective_type_name
    };
    
    if (perspective.scope === 'step' && perspective.step_index !== undefined) {
      filter.step_index = perspective.step_index;
    }
    
    const result = await collection.replaceOne(
      filter,
      perspectiveDoc,
      { upsert: true }
    );
    
    if (result.upsertedId) {
      perspectiveDoc._id = result.upsertedId;
    } else {
      const found = await collection.findOne(filter);
      perspectiveDoc._id = found._id;
    }
    
    return perspectiveDoc;
  }
  
  async saveSOPPerspectives(perspectives) {
    if (!Array.isArray(perspectives) || perspectives.length === 0) {
      return 0;
    }
    
    const collection = this.db.collection('sop_perspectives');
    
    const docs = perspectives.map(p => ({
      ...p,
      generated_at: p.generated_at || new Date()
    }));
    
    const bulkOps = docs.map(doc => {
      const filter = {
        sop_id: doc.sop_id,
        perspective_type_name: doc.perspective_type_name
      };
      
      if (doc.scope === 'step' && doc.step_index !== undefined) {
        filter.step_index = doc.step_index;
      }
      
      return {
        replaceOne: {
          filter,
          replacement: doc,
          upsert: true
        }
      };
    });
    
    const result = await collection.bulkWrite(bulkOps);
    return result.upsertedCount + result.modifiedCount;
  }
  
  async findSOPPerspectives(filter = {}) {
    const collection = this.db.collection('sop_perspectives');
    return await collection.find(filter).toArray();
  }
  
  async findPerspectivesBySOP(sopId) {
    return await this.findSOPPerspectives({ sop_id: new ObjectId(sopId) });
  }
  
  async findPerspectivesByStep(sopId, stepIndex) {
    return await this.findSOPPerspectives({ 
      sop_id: new ObjectId(sopId),
      scope: 'step',
      step_index: stepIndex
    });
  }
  
  async countSOPPerspectives(filter = {}) {
    const collection = this.db.collection('sop_perspectives');
    return await collection.countDocuments(filter);
  }
  
  async clearSOPPerspectives(sopId) {
    const collection = this.db.collection('sop_perspectives');
    const result = await collection.deleteMany({ sop_id: new ObjectId(sopId) });
    return result.deletedCount;
  }
  
  async clearAll() {
    await this.db.collection('sops').deleteMany({});
    await this.db.collection('sop_perspectives').deleteMany({});
  }
  
  async getStatistics() {
    const sopsCount = await this.countSOPs();
    const perspectiveTypesCount = await this.db.collection('sop_perspective_types').countDocuments();
    const perspectivesCount = await this.countSOPPerspectives();
    
    return {
      sops: {
        total: sopsCount
      },
      perspectives: {
        total: perspectivesCount,
        perspectiveTypes: perspectiveTypesCount
      }
    };
  }
  
  async healthCheck() {
    try {
      if (!this._isConnected || !this.db) {
        return false;
      }
      await this.db.admin().ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}