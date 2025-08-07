/**
 * VoiceIntegrationNode - Handles voice-related operations
 * 
 * Manages speech-to-text transcription, text-to-speech synthesis,
 * and voice preference management within BT workflows.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class VoiceIntegrationNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'voice_integration';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.action = config.action || 'transcribe';
    this.voiceModel = config.voiceModel || 'tts-1';
    this.defaultVoice = config.defaultVoice || 'nova';
    this.defaultFormat = config.defaultFormat || 'mp3';
  }

  async executeNode(context) {
    try {
      // Check if voice module is available
      if (!this.isVoiceModuleAvailable(context)) {
        return {
          status: NodeStatus.FAILURE,
          data: { error: 'Voice module not available' }
        };
      }
      
      switch (this.action) {
        case 'transcribe':
          return await this.transcribeAudio(context);
        case 'synthesize':
          return await this.synthesizeSpeech(context);
        case 'update_preferences':
          return await this.updateVoicePreferences(context);
        default:
          return {
            status: NodeStatus.FAILURE,
            data: { error: `Unknown voice action: ${this.action}` }
          };
      }
      
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          stackTrace: error.stack
        }
      };
    }
  }
  
  /**
   * Check if voice module is available
   */
  isVoiceModuleAvailable(context) {
    return context.voiceEnabled && 
           context.moduleLoader && 
           context.moduleLoader.hasTool('transcribe_audio') &&
           context.moduleLoader.hasTool('generate_voice');
  }
  
  /**
   * Transcribe audio to text
   */
  async transcribeAudio(context) {
    const audioData = this.getParameter('audio', context);
    const format = this.getParameter('format', context) || 'mp3';
    const language = this.getParameter('language', context) || 'auto';
    
    if (!audioData) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'No audio data provided for transcription' }
      };
    }
    
    try {
      // Send transcription started event
      this.emitVoiceEvent(context, 'voice_transcription_started', {
        format: format,
        language: language
      });
      
      // Execute transcription
      const result = await context.moduleLoader.executeTool('transcribe_audio', {
        audio: audioData,
        format: format,
        language: language
      });
      
      if (result.success !== false && result.text) {
        // Send transcription result event
        this.emitVoiceEvent(context, 'voice_transcription', {
          text: result.text,
          language: result.language || language,
          confidence: result.confidence
        });
        
        // Store transcription in context for further processing
        context.transcriptionResult = result;
        context.transcribedText = result.text;
        
        return {
          status: NodeStatus.SUCCESS,
          data: {
            text: result.text,
            language: result.language,
            confidence: result.confidence,
            transcriptionComplete: true
          }
        };
      } else {
        throw new Error(result.error || 'Transcription failed');
      }
      
    } catch (error) {
      this.emitVoiceEvent(context, 'voice_error', {
        message: `Transcription failed: ${error.message}`,
        details: error
      });
      
      return {
        status: NodeStatus.FAILURE,
        data: { error: `Transcription failed: ${error.message}` }
      };
    }
  }
  
  /**
   * Synthesize speech from text
   */
  async synthesizeSpeech(context) {
    const text = this.getParameter('text', context);
    const voice = this.getParameter('voice', context) || 
                  context.voicePreferences?.voice || 
                  this.defaultVoice;
    const model = this.getParameter('model', context) || this.voiceModel;
    const format = this.getParameter('format', context) || this.defaultFormat;
    const speed = this.getParameter('speed', context) || 1.0;
    const messageId = this.getParameter('messageId', context);
    
    if (!text) {
      return {
        status: NodeStatus.FAILURE,
        data: { error: 'No text provided for speech synthesis' }
      };
    }
    
    try {
      // Send synthesis started event
      this.emitVoiceEvent(context, 'voice_synthesis_started', {
        textLength: text.length,
        voice: voice,
        model: model
      });
      
      // Execute synthesis
      const result = await context.moduleLoader.executeTool('generate_voice', {
        text: text,
        voice: voice,
        model: model,
        format: format,
        speed: speed
      });
      
      if (result.success !== false && result.audio) {
        // Send audio result event
        this.emitVoiceEvent(context, 'voice_audio', {
          audio: result.audio,
          format: result.format || format,
          messageId: messageId,
          voice: voice,
          audioGenerated: true
        });
        
        // Store audio data in context
        context.voiceData = {
          audio: result.audio,
          format: result.format || format,
          voice: voice
        };
        
        return {
          status: NodeStatus.SUCCESS,
          data: {
            audio: result.audio,
            format: result.format || format,
            voice: voice,
            audioSize: result.audio ? result.audio.length : 0,
            synthesisComplete: true
          }
        };
      } else {
        throw new Error(result.error || 'Speech synthesis failed');
      }
      
    } catch (error) {
      this.emitVoiceEvent(context, 'voice_error', {
        message: `Speech synthesis failed: ${error.message}`,
        messageId: messageId,
        details: error
      });
      
      return {
        status: NodeStatus.FAILURE,
        data: { error: `Speech synthesis failed: ${error.message}` }
      };
    }
  }
  
  /**
   * Update voice preferences
   */
  async updateVoicePreferences(context) {
    const enabled = this.getParameter('enabled', context);
    const voice = this.getParameter('voice', context);
    const autoPlay = this.getParameter('autoPlay', context);
    
    // Update voice preferences in context
    if (!context.voicePreferences) {
      context.voicePreferences = {};
    }
    
    if (enabled !== undefined) {
      context.voicePreferences.enabled = Boolean(enabled);
    }
    
    if (voice !== undefined) {
      context.voicePreferences.voice = voice;
    }
    
    if (autoPlay !== undefined) {
      context.voicePreferences.autoPlay = Boolean(autoPlay);
    }
    
    // If we have a ChatAgent reference, update its preferences
    if (context.chatAgent && context.chatAgent.updateVoicePreferences) {
      context.chatAgent.updateVoicePreferences(context.voicePreferences);
    }
    
    console.log('VoiceIntegrationNode: Updated voice preferences:', context.voicePreferences);
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        preferencesUpdated: true,
        preferences: context.voicePreferences
      }
    };
  }
  
  /**
   * Get parameter value with context resolution
   */
  getParameter(paramName, context) {
    // First check explicit parameters
    if (this.config.parameters && this.config.parameters[paramName] !== undefined) {
      return this.resolveParams({ [paramName]: this.config.parameters[paramName] }, context)[paramName];
    }
    
    // Check message parameters
    if (context.message && context.message[paramName] !== undefined) {
      return context.message[paramName];
    }
    
    // Check context directly
    return context[paramName];
  }
  
  /**
   * Emit voice-related events
   */
  emitVoiceEvent(context, eventType, data) {
    if (context.remoteActor && context.remoteActor.receive) {
      context.remoteActor.receive({
        type: eventType,
        ...data,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Check if voice feature is enabled
   */
  isVoiceEnabled(context) {
    return context.voiceEnabled && 
           context.voicePreferences?.enabled !== false;
  }
  
  /**
   * Get available voices (if supported by voice module)
   */
  async getAvailableVoices(context) {
    try {
      if (context.moduleLoader && context.moduleLoader.hasTool('list_voices')) {
        const result = await context.moduleLoader.executeTool('list_voices', {});
        return result.voices || [];
      }
    } catch (error) {
      console.warn('VoiceIntegrationNode: Failed to get available voices:', error);
    }
    
    // Return default voices
    return ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'];
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'voice_integration',
      action: this.action,
      voiceModel: this.voiceModel,
      defaultVoice: this.defaultVoice,
      defaultFormat: this.defaultFormat,
      supportsActions: [
        'transcribe',
        'synthesize', 
        'update_preferences'
      ],
      requiresVoiceModule: true
    };
  }
}