/**
 * Realistic Agent Configurations for System Integration Testing
 * These configurations represent real-world use cases for the ConfigurableAgent
 */

/**
 * Customer Service Agent Configuration
 * A comprehensive customer service agent with multiple tools and knowledge management
 */
export function createCustomerServiceAgentConfig() {
  return {
    agent: {
      id: 'customer-service-agent',
      name: 'CustomerServiceAgent',
      type: 'conversational',
      version: '2.0.0',
      description: 'AI agent specialized in customer service and support',
      
      capabilities: [
        {
          module: 'mock-calculator-module',
          tools: ['add', 'subtract', 'multiply', 'divide'],
          permissions: { read: true, write: true, execute: true }
        }
      ],
      
      llm: {
        provider: 'anthropic',
        model: 'claude-3-haiku',
        temperature: 0.3,
        maxTokens: 500,
        systemPrompt: `You are a professional customer service representative. You are helpful, empathetic, and solution-focused. Always:
1. Acknowledge the customer's concerns
2. Provide clear, actionable solutions
3. Escalate when necessary
4. Maintain a professional but friendly tone
5. Use available tools to help solve problems`
      },
      
      prompts: {
        responseFormats: {
          greeting: { 
            type: "text",
            includeMetadata: false,
            template: "Hello {customerName}! How can I assist you today?", 
            requiredContext: ['customerName'] 
          },
          escalation: { 
            type: "text",
            includeMetadata: false,
            template: "I understand this is complex. Let me connect you with a specialist who can help.", 
            tone: "professional" 
          },
          resolution: { 
            type: "text",
            includeMetadata: false,
            template: "I'm glad we could resolve this for you. Is there anything else I can help with?", 
            tone: "satisfied" 
          }
        },
        contextPrompts: {
          customerHistory: "Previous interactions: {interactionHistory}",
          urgentIssue: "⚠️ URGENT: Customer reports critical issue affecting {impactLevel}"
        }
      },
      
      state: {
        maxHistorySize: 100,
        pruneStrategy: 'priority',
        contextVariables: {
          customerName: { type: 'string', persistent: true, description: 'Customer name for personalization' },
          customerTier: { type: 'string', persistent: true, description: 'Customer tier (basic, premium, enterprise)' },
          ticketId: { type: 'string', persistent: false, description: 'Current support ticket ID' },
          issueCategory: { type: 'string', persistent: false, description: 'Category of current issue' },
          priorityLevel: { type: 'number', persistent: false, description: 'Issue priority (1-5)' },
          resolutionStatus: { type: 'string', persistent: false, description: 'Current resolution status' },
          interactionCount: { type: 'number', persistent: true, description: 'Total interactions with this customer' },
          satisfactionRating: { type: 'number', persistent: true, description: 'Customer satisfaction rating' }
        }
      },
      
      knowledge: {
        enabled: true,
        persistence: 'persistent',
        categories: ['product_info', 'troubleshooting', 'policies', 'customer_history'],
        indexing: {
          enabled: true,
          strategy: 'semantic'
        }
      },
      
      behaviors: {
        autoSave: true,
        loggingLevel: 'detailed',
        responseTimeTarget: 3000,
        escalationThreshold: 3
      }
    }
  };
}

/**
 * Research Assistant Agent Configuration  
 * A sophisticated research agent with advanced knowledge management
 */
export function createResearchAssistantConfig() {
  return {
    agent: {
      id: 'research-assistant',
      name: 'ResearchAssistant',
      type: 'analytical',
      version: '1.5.0',
      description: 'AI research assistant for academic and professional research',
      
      capabilities: [
        {
          module: 'mock-calculator-module',
          tools: ['add', 'subtract', 'multiply', 'divide'],
          permissions: { read: true, write: true, execute: true }
        }
      ],
      
      llm: {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.1,
        maxTokens: 2000,
        systemPrompt: `You are an expert research assistant with deep knowledge across multiple domains. You excel at:
1. Comprehensive literature analysis
2. Synthesizing information from multiple sources  
3. Identifying research gaps and opportunities
4. Creating structured, well-cited responses
5. Maintaining scientific rigor and objectivity`
      },
      
      prompts: {
        responseFormats: {
          literature_review: { 
            type: "text",
            includeMetadata: false,
            template: "## Literature Review: {topic}\n\n### Key Findings\n{findings}\n\n### Methodology\n{methodology}\n\n### Conclusions\n{conclusions}\n\n### References\n{references}",
            requiredContext: ['topic', 'findings', 'methodology']
          },
          research_summary: {
            type: "text",
            includeMetadata: false,
            template: "### Research Summary\n**Topic**: {topic}\n**Scope**: {scope}\n**Key Insights**: {insights}\n**Recommendations**: {recommendations}",
            requiredContext: ['topic', 'scope', 'insights']
          }
        },
        contextPrompts: {
          domain_expertise: "Research domain: {domain}. Apply {domain} methodologies and standards.",
          citation_style: "Use {citationStyle} citation format for all references."
        }
      },
      
      state: {
        maxHistorySize: 200,
        pruneStrategy: 'semantic',
        contextVariables: {
          researchTopic: { type: 'string', persistent: true, description: 'Current research topic' },
          researchDomain: { type: 'string', persistent: true, description: 'Primary research domain' },
          citationStyle: { type: 'string', persistent: true, description: 'Preferred citation style' },
          sourcesReviewed: { type: 'array', persistent: true, description: 'List of reviewed sources' },
          keyFindings: { type: 'array', persistent: true, description: 'Key research findings' },
          methodologyNotes: { type: 'string', persistent: true, description: 'Research methodology notes' },
          progressStage: { type: 'string', persistent: false, description: 'Current research stage' },
          dataQuality: { type: 'string', persistent: false, description: 'Assessment of data quality' }
        }
      },
      
      knowledge: {
        enabled: true,
        persistence: 'persistent',
        categories: ['literature', 'methodologies', 'data_sources', 'research_notes', 'citations'],
        indexing: {
          enabled: true,
          strategy: 'semantic',
          domainSpecific: true
        },
        validation: {
          requireSources: true,
          factCheckingEnabled: true
        }
      },
      
      behaviors: {
        autoSave: true,
        loggingLevel: 'comprehensive',
        responseTimeTarget: 5000,
        citationRequired: true,
        factVerification: true
      }
    }
  };
}

/**
 * Personal Assistant Agent Configuration
 * A versatile personal assistant for daily task management
 */
export function createPersonalAssistantConfig() {
  return {
    agent: {
      id: 'personal-assistant',
      name: 'PersonalAssistant', 
      type: 'conversational',
      version: '1.8.0',
      description: 'AI personal assistant for daily productivity and task management',
      
      capabilities: [
        {
          module: 'mock-calculator-module',
          tools: ['add', 'subtract', 'multiply', 'divide'],
          permissions: { read: true, write: true, execute: true }
        }
      ],
      
      llm: {
        provider: 'anthropic',
        model: 'claude-3-haiku',
        temperature: 0.4,
        maxTokens: 400,
        systemPrompt: `You are a helpful personal assistant. You are proactive, organized, and adaptable to your user's needs. You help with:
1. Task and schedule management
2. Information lookup and research
3. Decision-making support
4. Reminders and follow-ups
5. Personal productivity optimization`
      },
      
      prompts: {
        responseFormats: {
          task_created: { 
            type: "text",
            includeMetadata: false,
            template: "✅ Task created: '{taskTitle}' | Due: {dueDate} | Priority: {priority}",
            requiredContext: ['taskTitle', 'dueDate', 'priority']
          },
          reminder: {
            type: "text",
            includeMetadata: false,
            template: "⏰ Reminder: {reminderText} | Scheduled for: {reminderTime}",
            requiredContext: ['reminderText', 'reminderTime']
          },
          daily_summary: {
            type: "text",
            includeMetadata: false,
            template: "📋 Daily Summary for {date}\n\n✅ Completed: {completedTasks}\n📌 Pending: {pendingTasks}\n⚡ Priority: {priorityTasks}",
            requiredContext: ['date', 'completedTasks', 'pendingTasks']
          }
        },
        contextPrompts: {
          user_preferences: "User preferences: {preferences}. Adapt responses accordingly.",
          time_context: "Current time: {currentTime}. Consider time-sensitive information."
        }
      },
      
      state: {
        maxHistorySize: 150,
        pruneStrategy: 'sliding',
        contextVariables: {
          userName: { type: 'string', persistent: true, description: 'User name for personalization' },
          timezone: { type: 'string', persistent: true, description: 'User timezone' },
          workingHours: { type: 'object', persistent: true, description: 'User working hours' },
          preferences: { type: 'object', persistent: true, description: 'User preferences and settings' },
          currentTasks: { type: 'array', persistent: true, description: 'Active task list' },
          completedToday: { type: 'array', persistent: false, description: 'Tasks completed today' },
          dailyGoals: { type: 'array', persistent: false, description: 'Daily goals and objectives' },
          energyLevel: { type: 'string', persistent: false, description: 'User energy level indicator' }
        }
      },
      
      knowledge: {
        enabled: true,
        persistence: 'session',
        categories: ['personal_info', 'preferences', 'routines', 'contacts', 'notes'],
        indexing: {
          enabled: true,
          strategy: 'chronological'
        }
      },
      
      behaviors: {
        autoSave: true,
        loggingLevel: 'standard',
        responseTimeTarget: 2000,
        proactiveReminders: true,
        adaptToRoutines: true
      }
    }
  };
}

/**
 * Educational Tutor Agent Configuration
 * A specialized agent for educational instruction and assessment
 */
export function createEducationalTutorConfig() {
  return {
    agent: {
      id: 'educational-tutor',
      name: 'EducationalTutor',
      type: 'instructional',
      version: '2.1.0',
      description: 'AI tutor specialized in adaptive learning and educational support',
      
      capabilities: [
        {
          module: 'mock-calculator-module',
          tools: ['add', 'subtract', 'multiply', 'divide'],
          permissions: { read: true, write: true, execute: true }
        }
      ],
      
      llm: {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.2,
        maxTokens: 800,
        systemPrompt: `You are an expert educational tutor. You adapt to individual learning styles and provide:
1. Clear, step-by-step explanations
2. Appropriate examples and analogies
3. Constructive feedback and encouragement
4. Progressive difficulty adjustment
5. Comprehensive learning assessments`
      },
      
      prompts: {
        responseFormats: {
          lesson_plan: {
            type: "text",
            includeMetadata: false,
            template: "## Lesson: {lessonTitle}\n\n### Learning Objectives\n{objectives}\n\n### Content\n{content}\n\n### Practice Exercises\n{exercises}\n\n### Assessment\n{assessment}",
            requiredContext: ['lessonTitle', 'objectives', 'content']
          },
          feedback: {
            type: "text",
            includeMetadata: false,
            template: "### Feedback on {topic}\n\n**Strengths**: {strengths}\n**Areas for Improvement**: {improvements}\n**Next Steps**: {nextSteps}",
            requiredContext: ['topic', 'strengths', 'improvements', 'nextSteps']
          },
          progress_report: {
            type: "text",
            includeMetadata: false,
            template: "📊 Progress Report for {studentName}\n\n**Topics Covered**: {topicsCovered}\n**Mastery Level**: {masteryLevel}\n**Recommended Focus**: {recommendedFocus}",
            requiredContext: ['studentName', 'topicsCovered', 'masteryLevel']
          }
        },
        contextPrompts: {
          learning_style: "Adapt to {learningStyle} learning preferences.",
          difficulty_level: "Adjust content difficulty to {difficultyLevel} level."
        }
      },
      
      state: {
        maxHistorySize: 300,
        pruneStrategy: 'educational',
        contextVariables: {
          studentName: { type: 'string', persistent: true, description: 'Student name' },
          gradeLevel: { type: 'string', persistent: true, description: 'Student grade/education level' },
          learningStyle: { type: 'string', persistent: true, description: 'Preferred learning style' },
          subjectFocus: { type: 'array', persistent: true, description: 'Primary subjects of study' },
          difficultyPreference: { type: 'string', persistent: true, description: 'Preferred difficulty level' },
          masteryTopics: { type: 'array', persistent: true, description: 'Topics already mastered' },
          strugglingTopics: { type: 'array', persistent: true, description: 'Topics needing more work' },
          currentLesson: { type: 'string', persistent: false, description: 'Current lesson topic' },
          lessonProgress: { type: 'number', persistent: false, description: 'Progress through current lesson' }
        }
      },
      
      knowledge: {
        enabled: true,
        persistence: 'persistent',
        categories: ['curriculum', 'assessments', 'student_progress', 'learning_materials', 'pedagogical_notes'],
        indexing: {
          enabled: true,
          strategy: 'hierarchical',
          educationalTaxonomy: true
        },
        validation: {
          curriculumAlignment: true,
          ageAppropriate: true
        }
      },
      
      behaviors: {
        autoSave: true,
        loggingLevel: 'educational',
        responseTimeTarget: 4000,
        adaptiveDifficulty: true,
        progressTracking: true,
        encouragementMode: true
      }
    }
  };
}

/**
 * Technical Support Agent Configuration
 * A specialized agent for technical troubleshooting and system support
 */
export function createTechnicalSupportConfig() {
  return {
    agent: {
      id: 'technical-support',
      name: 'TechnicalSupport',
      type: 'diagnostic',
      version: '2.3.0',
      description: 'AI agent specialized in technical troubleshooting and system diagnostics',
      
      capabilities: [
        {
          module: 'mock-calculator-module',
          tools: ['add', 'subtract', 'multiply', 'divide'],
          permissions: { read: true, write: true, execute: true }
        }
      ],
      
      llm: {
        provider: 'anthropic',
        model: 'claude-3-haiku',
        temperature: 0.1,
        maxTokens: 600,
        systemPrompt: `You are a technical support specialist. You provide systematic troubleshooting and:
1. Methodical problem diagnosis
2. Step-by-step resolution procedures
3. Clear technical explanations
4. Preventive maintenance recommendations
5. Escalation procedures when needed`
      },
      
      prompts: {
        responseFormats: {
          diagnostic_report: {
            type: "text",
            includeMetadata: false,
            template: "## Diagnostic Report\n\n**Issue**: {issue}\n**System**: {system}\n**Status**: {status}\n**Findings**: {findings}\n**Recommendations**: {recommendations}",
            requiredContext: ['issue', 'system', 'status', 'findings']
          },
          troubleshooting_steps: {
            type: "text",
            includeMetadata: false,
            template: "### Troubleshooting: {problemDescription}\n\n**Steps to try**:\n{steps}\n\n**If this doesn't work**: {alternativeSteps}",
            requiredContext: ['problemDescription', 'steps']
          },
          resolution_summary: {
            type: "text",
            includeMetadata: false,
            template: "✅ **Issue Resolved**: {issue}\n\n**Solution Applied**: {solution}\n**Time to Resolution**: {timeToResolution}\n**Follow-up Required**: {followUpRequired}",
            requiredContext: ['issue', 'solution', 'timeToResolution']
          }
        },
        contextPrompts: {
          system_context: "System environment: {systemType} running {operatingSystem}",
          urgency_level: "Issue urgency: {urgencyLevel}. Prioritize accordingly."
        }
      },
      
      state: {
        maxHistorySize: 100,
        pruneStrategy: 'diagnostic',
        contextVariables: {
          ticketId: { type: 'string', persistent: false, description: 'Current support ticket ID' },
          systemType: { type: 'string', persistent: true, description: 'Type of system being supported' },
          operatingSystem: { type: 'string', persistent: true, description: 'Operating system information' },
          issueCategory: { type: 'string', persistent: false, description: 'Category of technical issue' },
          urgencyLevel: { type: 'string', persistent: false, description: 'Issue urgency level' },
          diagnosticResults: { type: 'object', persistent: false, description: 'Latest diagnostic results' },
          resolutionSteps: { type: 'array', persistent: false, description: 'Steps taken towards resolution' },
          escalationTriggered: { type: 'boolean', persistent: false, description: 'Whether escalation was triggered' }
        }
      },
      
      knowledge: {
        enabled: true,
        persistence: 'persistent',
        categories: ['known_issues', 'solutions', 'system_configs', 'troubleshooting_guides', 'escalation_procedures'],
        indexing: {
          enabled: true,
          strategy: 'technical',
          symptomBased: true
        }
      },
      
      behaviors: {
        autoSave: true,
        loggingLevel: 'technical',
        responseTimeTarget: 2500,
        systematicApproach: true,
        escalationRules: true
      }
    }
  };
}