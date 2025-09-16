/**
 * SystemConstants - Centralized configuration constants for the ROMA Agent system
 * Following Clean Code principle: No magic numbers - all constants are named and documented
 */

// ============================================================================
// Execution and Concurrency Constants
// ============================================================================

/** Maximum number of tasks that can execute concurrently */
export const MAX_CONCURRENT_TASKS = 5;

/** Default timeout for task execution in milliseconds */
export const DEFAULT_EXECUTION_TIMEOUT = 30000; // 30 seconds

/** Maximum depth for recursive task decomposition */
export const DEFAULT_MAX_RECURSION_DEPTH = 3;

/** Maximum depth for dependency resolution */
export const MAX_DEPENDENCY_DEPTH = 10;

/** Default timeout for dependency resolution in milliseconds */
export const DEPENDENCY_RESOLUTION_TIMEOUT = 30000; // 30 seconds

/** Maximum concurrency for parallel execution strategy */
export const MAX_PARALLEL_CONCURRENCY = 5;

/** Timeout per individual task in parallel execution */
export const PARALLEL_TASK_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Retry and Error Handling Constants
// ============================================================================

/** Default number of retry attempts for failed tasks */
export const DEFAULT_RETRY_LIMIT = 3;

/** Base delay for retry attempts in milliseconds */
export const DEFAULT_RETRY_DELAY = 1000; // 1 second

/** Maximum delay for retry attempts with exponential backoff */
export const MAX_RETRY_DELAY = 30000; // 30 seconds

/** Jitter factor for retry delays to prevent thundering herd */
export const RETRY_JITTER_FACTOR = 0.3; // 30% jitter

// ============================================================================
// Priority and Scoring Constants
// ============================================================================

/** Default task priority when not specified */
export const DEFAULT_TASK_PRIORITY = 5;

/** Minimum valid priority value */
export const MIN_PRIORITY = 1;

/** Maximum valid priority value */
export const MAX_PRIORITY = 10;

/** Decomposition threshold for recursive strategy (0-1 range) */
export const DECOMPOSITION_THRESHOLD = 0.7;

// ============================================================================
// Progress and History Management Constants
// ============================================================================

/** How long to retain task history in milliseconds */
export const TASK_HISTORY_RETENTION_TIME = 3600000; // 1 hour

/** Maximum number of history events per task */
export const MAX_HISTORY_PER_TASK = 1000;

/** Interval for pruning old history entries */
export const HISTORY_PRUNE_INTERVAL = 60000; // 1 minute

/** Number of events between creating snapshots for performance */
export const SNAPSHOT_INTERVAL = 100;

// ============================================================================
// Time Estimation Constants
// ============================================================================

/** Base time estimate for tool execution in milliseconds */
export const TOOL_EXECUTION_BASE_TIME = 2000; // 2 seconds

/** Multiplier for estimating composite task time based on subtask count */
export const COMPOSITE_TASK_TIME_MULTIPLIER = 1000; // 1 second per subtask

/** Minimum estimated task time in milliseconds */
export const MIN_TASK_TIME_ESTIMATE = 1000; // 1 second

/** Maximum estimated task time in milliseconds */
export const MAX_TASK_TIME_ESTIMATE = 10000; // 10 seconds

/** Character-to-time multiplier for text-based task estimation */
export const TEXT_LENGTH_TIME_MULTIPLIER = 10; // 10ms per character

/** Default task time estimate when no other estimate available */
export const DEFAULT_TASK_TIME_ESTIMATE = 1000; // 1 second

// ============================================================================
// Complexity Calculation Constants
// ============================================================================

/** Weight for node count in complexity calculation */
export const COMPLEXITY_NODE_WEIGHT = 0.3;

/** Weight for edge count in complexity calculation */
export const COMPLEXITY_EDGE_WEIGHT = 0.5;

/** Weight for maximum fan-in in complexity calculation */
export const COMPLEXITY_MAX_FANIN_WEIGHT = 0.2;

/** Maximum complexity score for text length consideration */
export const TEXT_COMPLEXITY_MAX_SCORE = 0.3;

/** Divisor for text length in complexity scoring */
export const TEXT_COMPLEXITY_DIVISOR = 1000;

/** Confidence boost per subtask in decomposition */
export const CONFIDENCE_PER_SUBTASK = 0.1;

/** Maximum confidence boost from subtasks */
export const MAX_SUBTASK_CONFIDENCE_BOOST = 0.3;

/** Maximum overall confidence score */
export const MAX_CONFIDENCE_SCORE = 1.0;

/** Multiplier for estimating subtask count from complexity */
export const COMPLEXITY_TO_SUBTASK_MULTIPLIER = 5;

/** Minimum estimated subtasks for complex tasks */
export const MIN_ESTIMATED_SUBTASKS = 2;

// ============================================================================
// Queue Management Constants
// ============================================================================

/** Success rate calculation percentage multiplier */
export const SUCCESS_RATE_PERCENTAGE = 100;

// ============================================================================
// ID Generation Constants
// ============================================================================

/** Length of random string suffix for IDs */
export const ID_RANDOM_SUFFIX_LENGTH = 9;

/** Radix for number to string conversion in ID generation */
export const ID_STRING_RADIX = 36;

/** Substring start index for random ID portion */
export const ID_SUBSTRING_START = 2;