import { ContextProvider, ContextData } from '../types';
import { SessionState } from '../../session/types';

export class StateContextProvider implements ContextProvider {
  name = 'state';
  description = 'Provides context about current session state';
  priority = 10;

  async getContext(session: SessionState): Promise<ContextData> {
    const stateSize = session.state.size;
    
    if (stateSize === 0) {
      return {
        summary: 'Session state is empty',
        details: { stateSize: 0 }
      };
    }

    const keys = Array.from(session.state.keys());
    const summary = `Session has ${stateSize} state ${stateSize === 1 ? 'entry' : 'entries'}`;

    // Create a preview of the state (limit to first 5 entries for large states)
    const preview: Record<string, any> = {};
    let count = 0;
    for (const [key, value] of session.state.entries()) {
      if (count >= 5) break;
      preview[key] = value;
      count++;
    }

    return {
      summary,
      details: {
        stateSize,
        keys,
        preview
      }
    };
  }

  async isRelevant(session: SessionState): Promise<boolean> {
    // State context is always relevant
    return true;
  }
}