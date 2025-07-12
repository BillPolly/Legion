export interface GeneratedResponse {
  success: boolean;
  message: string;
  data?: any;
  suggestions?: string[];
  executionId: string;
  timestamp: Date;
  command: string;
  metadata?: Record<string, any>;
}