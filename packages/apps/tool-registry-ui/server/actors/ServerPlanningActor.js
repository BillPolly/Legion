/**
 * ServerPlanningActor - Server-side actor for planning operations
 * Handles plan creation, validation, and management through DecentPlanner
 * Updated to use ToolRegistry singleton pattern for tool operations
 */

export class ServerPlanningActor {
  constructor(decentPlanner, toolRegistry, mongoProvider = null) {
    if (!decentPlanner) {
      throw new Error('DecentPlanner is required');
    }
    if (!toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    
    this.decentPlanner = decentPlanner;
    this.toolRegistry = toolRegistry;
    this.mongoProvider = mongoProvider; // Optional for UI-specific plan storage
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'plan:create':
          await this.handlePlanCreate(data);
          break;
          
        case 'plan:save':
          await this.handlePlanSave(data);
          break;
          
        case 'plan:load':
          await this.handlePlanLoad(data);
          break;
          
        case 'plan:list':
          await this.handlePlanList(data);
          break;
          
        case 'plan:validate':
          await this.handlePlanValidate(data);
          break;
          
        case 'plan:update':
          await this.handlePlanUpdate(data);
          break;
          
        case 'plan:delete':
          await this.handlePlanDelete(data);
          break;
          
        default:
          await this.sendError(`Unknown message type: ${type}`);
      }
    } catch (error) {
      await this.sendError(`Error processing ${type}: ${error.message}`, error);
    }
  }

  async handlePlanCreate(data) {
    if (!data || !data.goal) {
      await this.sendError('Missing required field: goal');
      return;
    }

    const { goal, context = {}, options = {} } = data;
    
    // Notify client that planning has started
    await this.sendMessage('plan:decomposition:start', { goal });
    
    try {
      // Call DecentPlanner to create the plan
      const planResult = await this.decentPlanner.plan(goal, context);
      
      // Check if planning succeeded
      if (!planResult.success) {
        // Send validation failure if that's the reason
        if (planResult.phases?.informal?.validation) {
          await this.sendMessage('plan:validation:result', {
            valid: false,
            errors: planResult.phases.informal.validation.errors || []
          });
        }
        
        await this.sendError(`Planning failed: ${planResult.reason || 'Unknown error'}`, planResult);
        return;
      }
      
      // Extract informal planning results
      const informal = planResult.phases?.informal || {};
      const hierarchy = informal.hierarchy || {};
      const validation = informal.validation || {};
      
      // Send validation results
      if (validation) {
        await this.sendMessage('plan:validation:result', validation);
      }
      
      // Send complete plan
      await this.sendMessage('plan:complete', {
        hierarchy,
        validation,
        behaviorTrees: planResult.phases?.formal?.behaviorTrees,
        metadata: {
          goal,
          context,
          options,
          createdAt: new Date()
        }
      });
      
    } catch (error) {
      await this.sendError(`Failed to create plan: ${error.message}`, error);
    }
  }

  async handlePlanSave(data) {
    if (!data || !data.goal) {
      await this.sendError('Missing required fields for save');
      return;
    }

    try {
      // Try to use ToolRegistry first for plan storage
      if (this.toolRegistry && this.toolRegistry.savePlan) {
        const planDocument = {
          ...data,
          metadata: {
            ...data.metadata,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
        
        const result = await this.toolRegistry.savePlan(planDocument);
        
        await this.sendMessage('plan:saved', {
          planId: result.id || result.insertedId
        });
      } else if (this.mongoProvider) {
        // Fallback to direct MongoDB for UI-specific plan storage
        const collection = this.mongoProvider.getCollection('plans');
        
        const planDocument = {
          ...data,
          metadata: {
            ...data.metadata,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
        
        const result = await collection.insertOne(planDocument);
        
        await this.sendMessage('plan:saved', {
          planId: result.insertedId
        });
      } else {
        throw new Error('No storage provider available for plans');
      }
      
    } catch (error) {
      await this.sendError(`Failed to save plan: ${error.message}`, error);
    }
  }

  async handlePlanLoad(data) {
    if (!data || !data.planId) {
      await this.sendError('Missing planId');
      return;
    }

    try {
      let plan = null;
      
      // Try to use ToolRegistry first for plan loading
      if (this.toolRegistry && this.toolRegistry.loadPlan) {
        plan = await this.toolRegistry.loadPlan(data.planId);
      } else if (this.mongoProvider) {
        // Fallback to direct MongoDB for UI-specific plan storage
        const collection = this.mongoProvider.getCollection('plans');
        plan = await collection.findOne({ _id: data.planId });
      } else {
        throw new Error('No storage provider available for plans');
      }
      
      if (!plan) {
        await this.sendError(`Plan not found: ${data.planId}`);
        return;
      }
      
      await this.sendMessage('plan:loaded', plan);
      
    } catch (error) {
      await this.sendError(`Failed to load plan: ${error.message}`, error);
    }
  }

  async handlePlanList(data) {
    try {
      let plans = [];
      
      // Try to use ToolRegistry first for plan listing
      if (this.toolRegistry && this.toolRegistry.listPlans) {
        const filter = data?.filter || {};
        plans = await this.toolRegistry.listPlans(filter);
      } else if (this.mongoProvider) {
        // Fallback to direct MongoDB for UI-specific plan storage
        const collection = this.mongoProvider.getCollection('plans');
        const filter = data?.filter || {};
        
        plans = await collection
          .find(filter)
          .sort({ 'metadata.createdAt': -1 })
          .toArray();
      } else {
        throw new Error('No storage provider available for plans');
      }
      
      await this.sendMessage('plan:list:result', { plans });
      
    } catch (error) {
      await this.sendError(`Failed to list plans: ${error.message}`, error);
    }
  }

  async handlePlanValidate(data) {
    if (!data || !data.hierarchy) {
      await this.sendError('Missing hierarchy for validation');
      return;
    }

    try {
      const validationResult = await this.decentPlanner.validatePlan(data.hierarchy);
      
      await this.sendMessage('plan:validation:result', validationResult);
      
    } catch (error) {
      await this.sendError(`Failed to validate plan: ${error.message}`, error);
    }
  }

  async handlePlanUpdate(data) {
    if (!data || !data.planId || !data.updates) {
      await this.sendError('Missing planId or updates');
      return;
    }

    try {
      let result = null;
      
      // Try to use ToolRegistry first for plan updates
      if (this.toolRegistry && this.toolRegistry.updatePlan) {
        const updates = {
          ...data.updates,
          'metadata.updatedAt': new Date()
        };
        
        result = await this.toolRegistry.updatePlan(data.planId, updates);
        
        if (!result || !result.success) {
          await this.sendError(`Plan not found or not modified: ${data.planId}`);
          return;
        }
      } else if (this.mongoProvider) {
        // Fallback to direct MongoDB for UI-specific plan storage
        const collection = this.mongoProvider.getCollection('plans');
        
        const updateDoc = {
          $set: {
            ...data.updates,
            'metadata.updatedAt': new Date()
          }
        };
        
        result = await collection.updateOne(
          { _id: data.planId },
          updateDoc
        );
        
        if (result.modifiedCount === 0) {
          await this.sendError(`Plan not found or not modified: ${data.planId}`);
          return;
        }
      } else {
        throw new Error('No storage provider available for plans');
      }
      
      await this.sendMessage('plan:updated', {
        planId: data.planId
      });
      
    } catch (error) {
      await this.sendError(`Failed to update plan: ${error.message}`, error);
    }
  }

  async handlePlanDelete(data) {
    if (!data || !data.planId) {
      await this.sendError('Missing planId');
      return;
    }

    try {
      let result = null;
      
      // Try to use ToolRegistry first for plan deletion
      if (this.toolRegistry && this.toolRegistry.deletePlan) {
        result = await this.toolRegistry.deletePlan(data.planId);
        
        if (!result || !result.success) {
          await this.sendError(`Plan not found: ${data.planId}`);
          return;
        }
      } else if (this.mongoProvider) {
        // Fallback to direct MongoDB for UI-specific plan storage
        const collection = this.mongoProvider.getCollection('plans');
        
        result = await collection.deleteOne({ _id: data.planId });
        
        if (result.deletedCount === 0) {
          await this.sendError(`Plan not found: ${data.planId}`);
          return;
        }
      } else {
        throw new Error('No storage provider available for plans');
      }
      
      await this.sendMessage('plan:deleted', {
        planId: data.planId
      });
      
    } catch (error) {
      await this.sendError(`Failed to delete plan: ${error.message}`, error);
    }
  }

  async sendMessage(type, data) {
    if (this.remoteActor) {
      await this.remoteActor.receive({ type, data });
    }
  }

  async sendError(error, details = null) {
    await this.sendMessage('plan:error', {
      error,
      details: details || {},
      timestamp: new Date()
    });
  }
}