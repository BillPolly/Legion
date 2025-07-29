/**
 * @legion/profile-planner - Main exports
 * 
 * Profile-based planning module for Legion framework that simplifies complex task planning
 * by providing pre-configured domain environments with required tools and context prompts.
 */

// Core classes
export { ProfileManager } from './ProfileManager.js';
export { ProfilePlannerModule } from './ProfilePlannerModule.js';

// Tools
export { ProfilePlannerTool } from './tools/ProfilePlannerTool.js';

// Built-in profiles
export { JavascriptProfile } from './profiles/javascript.js';

// Default export is the Legion module
import { ProfilePlannerModule as DefaultModule } from './ProfilePlannerModule.js';
export default DefaultModule;