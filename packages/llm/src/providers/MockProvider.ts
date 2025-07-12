import { ILLMProvider, LLMModel } from './ILLMProvider';

/**
 * Mock provider implementation for testing
 */
export class MockProvider implements ILLMProvider {
  private interactions: Array<{prompt: string, response: string, timestamp: Date}> = [];

  async getAvailableModels(): Promise<LLMModel[]> {
    return [
      {
        id: 'quantum-nexus-v7',
        name: 'Quantum Nexus v7',
        description: 'Ultra-advanced quantum reasoning model',
        contextWindow: 1000000,
        maxTokens: 10000
      },
      {
        id: 'neural-storm-pro',
        name: 'Neural Storm Pro',
        description: 'High-performance neural processing engine',
        contextWindow: 500000,
        maxTokens: 8000
      },
      {
        id: 'cosmic-intellect-x1',
        name: 'Cosmic Intellect X1',
        description: 'Galactic-scale intelligence system',
        contextWindow: 2000000,
        maxTokens: 15000
      },
      {
        id: 'hyperbrain-omega',
        name: 'HyperBrain Omega',
        description: 'Next-generation cognitive architecture',
        contextWindow: 750000,
        maxTokens: 12000
      },
      {
        id: 'mindforge-titan',
        name: 'MindForge Titan',
        description: 'Industrial-strength thought processor',
        contextWindow: 300000,
        maxTokens: 6000
      },
      {
        id: 'synapse-lightning',
        name: 'Synapse Lightning',
        description: 'Ultra-fast neural response system',
        contextWindow: 100000,
        maxTokens: 4000
      }
    ];
  }

  async complete(prompt: string, model: string, maxTokens: number = 1000): Promise<string> {
    // Generate a mock response based on the model
    let response: string;
    
    switch (model) {
      case 'quantum-nexus-v7':
        response = `[Quantum Nexus v7] Quantum analysis complete. The request "${prompt}" has been processed through quantum entanglement matrices.`;
        break;
      case 'neural-storm-pro':
        response = `[Neural Storm Pro] High-speed neural processing engaged. Response to "${prompt}": Neural pathways optimized for maximum efficiency.`;
        break;
      case 'cosmic-intellect-x1':
        response = `[Cosmic Intellect X1] Galactic intelligence network activated. Universal knowledge synthesis for "${prompt}" complete.`;
        break;
      case 'hyperbrain-omega':
        response = `[HyperBrain Omega] Next-gen cognitive architecture online. Advanced reasoning applied to "${prompt}".`;
        break;
      case 'mindforge-titan':
        response = `[MindForge Titan] Industrial-grade processing initiated. Robust analysis of "${prompt}" completed.`;
        break;
      case 'synapse-lightning':
        response = `[Synapse Lightning] Ultra-fast response generated. Lightning-speed processing of "${prompt}" finished.`;
        break;
      default:
        response = `Mock LLM response: The request "${prompt}" has been processed successfully by ${model}.`;
    }

    // Record the interaction
    this.interactions.push({
      prompt,
      response,
      timestamp: new Date()
    });

    return response;
  }

  getProviderName(): string {
    return 'Mock';
  }

  isReady(): boolean {
    return true;
  }

  /**
   * Get recorded interactions (for testing/debugging)
   */
  getInteractions(): Array<{prompt: string, response: string, timestamp: Date}> {
    return [...this.interactions];
  }

  /**
   * Clear interaction history
   */
  clearInteractions(): void {
    this.interactions = [];
  }
}
