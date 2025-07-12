import { ContextProvider, ContextData } from './types';
import { SessionState } from '../session/types';
import { CommandResult } from '../../core/types';

export interface AggregatedContext {
  contexts: ContextData[];
  relevantCommands: string[];
  warnings: string[];
  suggestions: string[];
}

export class ContextManager {
  async gatherContext(session: SessionState): Promise<ContextData[]> {
    const providers = session.contextProviders;
    
    // Filter relevant providers
    const relevantProviders = await this.filterRelevantProviders(providers, session);
    
    // Gather context in parallel, maintaining provider association
    const contextResults = await Promise.all(
      relevantProviders.map(async provider => {
        try {
          const context = await provider.getContext(session);
          return { provider, context };
        } catch (error) {
          console.error(`Error gathering context from provider ${provider.name}:`, error);
          return null;
        }
      })
    );
    
    // Filter out failed contexts
    const validResults = contextResults.filter(
      (result): result is { provider: ContextProvider; context: ContextData } => 
        result !== null
    );
    
    // Sort by provider priority (higher priority first)
    validResults.sort((a, b) => {
      const priorityA = a.provider.priority ?? 0;
      const priorityB = b.provider.priority ?? 0;
      return priorityB - priorityA;
    });
    
    return validResults.map(result => result.context);
  }

  private async filterRelevantProviders(
    providers: ContextProvider[],
    session: SessionState
  ): Promise<ContextProvider[]> {
    const relevanceChecks = await Promise.all(
      providers.map(async provider => {
        if (!provider.isRelevant) {
          return { provider, relevant: true };
        }
        
        try {
          const relevant = await provider.isRelevant(session);
          return { provider, relevant };
        } catch (error) {
          console.error(`Error checking relevance for provider ${provider.name}:`, error);
          return { provider, relevant: false };
        }
      })
    );
    
    return relevanceChecks
      .filter(check => check.relevant)
      .map(check => check.provider);
  }


  async getAggregatedContext(session: SessionState): Promise<AggregatedContext> {
    const contexts = await this.gatherContext(session);
    
    // Aggregate data from all contexts
    const relevantCommands = new Set<string>();
    const warnings: string[] = [];
    const suggestions = new Set<string>();
    
    contexts.forEach(context => {
      // Collect relevant commands
      context.relevantCommands?.forEach(cmd => relevantCommands.add(cmd));
      
      // Collect warnings
      if (context.warnings) {
        warnings.push(...context.warnings);
      }
      
      // Collect suggestions (deduplicated)
      context.suggestions?.forEach(suggestion => suggestions.add(suggestion));
    });
    
    return {
      contexts,
      relevantCommands: Array.from(relevantCommands),
      warnings,
      suggestions: Array.from(suggestions)
    };
  }

  async updateContext(
    session: SessionState,
    result: CommandResult
  ): Promise<void> {
    const updatePromises = session.contextProviders.map(async provider => {
      if (!provider.updateContext) {
        return;
      }
      
      try {
        await provider.updateContext(session, result);
      } catch (error) {
        console.error(`Error updating context for provider ${provider.name}:`, error);
      }
    });
    
    await Promise.all(updatePromises);
  }
}