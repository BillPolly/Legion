/**
 * End-to-End Tests for Code Asset Display Workflow
 * 
 * Tests complete code workflow from tool execution to final UI display with syntax highlighting
 * NO MOCKS - Complete workflow validation with real Legion components
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

describe('Code Asset Display Workflow End-to-End', () => {
  let tool;
  let server;
  let clientActor;
  let displayManager;
  let assetDetector;
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3793;

  beforeAll(async () => {
    // Set up virtual DOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window;
    
    global.document = document;
    global.window = window;
    global.HTMLElement = window.HTMLElement;
    
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getInstance();
    
    // Start server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Initialize components
    assetDetector = new AssetTypeDetector();
    tool = new ShowAssetTool({ assetDetector, serverPort: testPort });
    
    displayManager = new AssetDisplayManager({
      serverUrl: `http://localhost:${testPort}`,
      wsUrl: `ws://localhost:${testPort}/showme`,
      container: document.getElementById('app')
    });
    await displayManager.initialize();
    
    clientActor = new ShowMeClientActor({
      serverUrl: `ws://localhost:${testPort}/showme`,
      displayManager: displayManager
    });
    await clientActor.initialize();
    await clientActor.connect();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 45000);

  afterAll(async () => {
    if (clientActor) {
      await clientActor.disconnect();
      await clientActor.cleanup();
    }
    if (displayManager) {
      await displayManager.cleanup();
    }
    if (server) {
      await server.stop();
    }
    
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
  });

  describe('JavaScript code workflow', () => {
    test('should handle complete JavaScript code display workflow', async () => {
      const jsCode = `// Advanced JavaScript Example
/**
 * Calculates the factorial of a number using recursion
 * @param {number} n - The number to calculate factorial for
 * @returns {number} The factorial result
 */
function factorial(n) {
  // Base case
  if (n <= 1) return 1;
  
  // Recursive case
  return n * factorial(n - 1);
}

// ES6 Arrow function version
const factorialArrow = (n) => n <= 1 ? 1 : n * factorialArrow(n - 1);

// Class example
class MathUtils {
  static fibonacci(n) {
    if (n <= 1) return n;
    return MathUtils.fibonacci(n - 1) + MathUtils.fibonacci(n - 2);
  }
  
  static isPrime(num) {
    if (num <= 1) return false;
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) return false;
    }
    return true;
  }
}

// Modern async/await example
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

// Test the functions
console.log('Factorial of 5:', factorial(5));
console.log('Fibonacci of 10:', MathUtils.fibonacci(10));
console.log('Is 17 prime?', MathUtils.isPrime(17));

// Array methods and destructuring
const numbers = [1, 2, 3, 4, 5];
const [first, second, ...rest] = numbers;
const doubled = numbers.map(n => n * 2);
const sum = numbers.reduce((acc, n) => acc + n, 0);

console.log({ first, second, rest, doubled, sum });`;

      console.log('💻 Starting JavaScript workflow...');

      // Step 1: Tool execution with code detection
      const startTime = Date.now();
      const toolResult = await tool.execute({
        asset: jsCode,
        hint: 'code', // Ensure code detection
        title: 'Advanced JavaScript Example',
        options: {
          language: 'javascript',
          lineNumbers: true,
          theme: 'monokai',
          wordWrap: true,
          fontSize: 14,
          tabSize: 2,
          highlightLines: [8, 15, 23, 35],
          readOnly: false
        }
      });

      // Validate tool execution
      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('code');
      expect(toolResult.assetId).toBeTruthy();
      expect(toolResult.url).toContain(`http://localhost:${testPort}`);
      console.log('✅ Tool execution successful - Type detected:', toolResult.detected_type);

      // Step 2: Verify code storage on server (exact preservation)
      const serverResponse = await fetch(toolResult.url);
      expect(serverResponse.status).toBe(200);
      
      const serverCodeData = await serverResponse.text();
      expect(serverCodeData).toBe(jsCode); // Exact code preservation
      console.log('✅ Server storage verified - Code preserved exactly');

      // Step 3: Client actor display request with code options
      const displayResult = await clientActor.displayAsset(toolResult.assetId, {
        width: 900,
        height: 600,
        x: 50,
        y: 50,
        language: 'javascript',
        lineNumbers: true,
        theme: 'monokai',
        wordWrap: true,
        fontSize: 14,
        readOnly: false
      });

      expect(displayResult).toBeTruthy();
      console.log('✅ Client display request sent');

      // Wait for UI rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Verify UI window creation
      const codeWindow = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(codeWindow).toBeTruthy();
      expect(codeWindow.classList.contains('showme-window')).toBe(true);
      expect(codeWindow.classList.contains('showme-window-code')).toBe(true);

      // Verify window dimensions
      expect(codeWindow.style.width).toContain('900');
      expect(codeWindow.style.height).toContain('600');

      // Step 5: Verify window header and controls
      const header = codeWindow.querySelector('.showme-window-header');
      expect(header).toBeTruthy();
      
      const title = header.querySelector('.showme-window-title');
      expect(title.textContent).toContain('Advanced JavaScript Example');

      const controls = header.querySelectorAll('.showme-window-close, .showme-window-minimize, .showme-window-maximize');
      expect(controls.length).toBe(3);
      console.log('✅ Window header and controls verified');

      // Step 6: Verify code content rendering
      const content = codeWindow.querySelector('.showme-window-content');
      expect(content).toBeTruthy();

      // Look for code editor or pre element
      const codeElement = content.querySelector('.code-editor, .code-viewer, pre, code');
      expect(codeElement).toBeTruthy();

      // Check for line numbers if enabled
      const lineNumbers = content.querySelector('.line-numbers, .gutter');
      if (lineNumbers) {
        // Should have line numbers for multi-line code
        const lineCount = jsCode.split('\n').length;
        expect(lineCount).toBeGreaterThan(20); // Our test code has many lines
      }

      // Verify code content is present
      const codeTextContent = content.textContent || '';
      expect(codeTextContent).toContain('function factorial');
      expect(codeTextContent).toContain('class MathUtils');
      expect(codeTextContent).toContain('async function fetchData');
      console.log('✅ Code content rendering verified');

      // Step 7: Test syntax highlighting elements (if present)
      const syntaxElements = content.querySelectorAll('.keyword, .string, .comment, .function, .number');
      if (syntaxElements.length > 0) {
        console.log(`✅ Syntax highlighting active - ${syntaxElements.length} highlighted elements`);
      }

      // Step 8: Test code editor interactions (if editable)
      if (!toolResult.options?.readOnly) {
        // Try to focus the editor
        const editorElement = content.querySelector('.code-editor, textarea, [contenteditable="true"]');
        if (editorElement) {
          editorElement.focus();
          console.log('✅ Code editor is interactive');
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      console.log(`🎉 JavaScript workflow completed in ${totalTime}ms`);

      // Verify workflow timing
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Python code workflow', () => {
    test('should handle complete Python code display workflow', async () => {
      const pythonCode = `#!/usr/bin/env python3
"""
Advanced Python Examples
Demonstrates various Python features and best practices
"""

import math
import asyncio
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class Priority(Enum):
    """Task priority levels"""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class Task:
    """Represents a task with priority and completion status"""
    id: int
    title: str
    description: Optional[str] = None
    priority: Priority = Priority.MEDIUM
    completed: bool = False
    
    def mark_completed(self) -> None:
        """Mark this task as completed"""
        self.completed = True
    
    def __str__(self) -> str:
        status = "✓" if self.completed else "○"
        return f"{status} [{self.priority.name}] {self.title}"


class TaskManager:
    """Manages a collection of tasks"""
    
    def __init__(self):
        self.tasks: List[Task] = []
        self._next_id = 1
    
    def add_task(self, title: str, description: str = None, 
                 priority: Priority = Priority.MEDIUM) -> Task:
        """Add a new task to the manager"""
        task = Task(
            id=self._next_id,
            title=title,
            description=description,
            priority=priority
        )
        self.tasks.append(task)
        self._next_id += 1
        return task
    
    def get_tasks_by_priority(self, priority: Priority) -> List[Task]:
        """Get all tasks with the specified priority"""
        return [task for task in self.tasks if task.priority == priority]
    
    def get_completion_rate(self) -> float:
        """Calculate the completion rate as a percentage"""
        if not self.tasks:
            return 0.0
        completed = sum(1 for task in self.tasks if task.completed)
        return (completed / len(self.tasks)) * 100


def fibonacci_generator(n: int):
    """Generate fibonacci sequence up to n terms"""
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b


async def simulate_work(task_name: str, duration: float) -> str:
    """Simulate asynchronous work"""
    print(f"Starting {task_name}...")
    await asyncio.sleep(duration)
    print(f"Completed {task_name}")
    return f"Result from {task_name}"


def main():
    """Main function demonstrating the task manager"""
    # Create task manager
    manager = TaskManager()
    
    # Add some tasks
    manager.add_task("Review code", "Review PR #123", Priority.HIGH)
    manager.add_task("Write tests", "Unit tests for new feature", Priority.MEDIUM)
    manager.add_task("Update docs", "API documentation updates", Priority.LOW)
    
    # Mark some tasks as completed
    manager.tasks[0].mark_completed()
    
    # Display tasks
    print("All tasks:")
    for task in manager.tasks:
        print(f"  {task}")
    
    # Show completion rate
    rate = manager.get_completion_rate()
    print(f"\\nCompletion rate: {rate:.1f}%")
    
    # Fibonacci example
    print("\\nFirst 10 Fibonacci numbers:")
    fib_numbers = list(fibonacci_generator(10))
    print(fib_numbers)
    
    # Mathematical calculations
    numbers = [1, 4, 9, 16, 25]
    sqrt_numbers = [math.sqrt(x) for x in numbers]
    print(f"\\nSquare roots: {sqrt_numbers}")


if __name__ == "__main__":
    main()`;

      const toolResult = await tool.execute({
        asset: pythonCode,
        hint: 'code',
        title: 'Python Task Manager Example',
        options: {
          language: 'python',
          lineNumbers: true,
          theme: 'github',
          fontSize: 12,
          showDocstrings: true,
          highlightLines: [15, 30, 45, 70]
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('code');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 800,
        height: 700,
        language: 'python',
        lineNumbers: true,
        theme: 'github'
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();
      expect(window.classList.contains('showme-window-code')).toBe(true);

      const content = window.querySelector('.showme-window-content');
      const codeElement = content.querySelector('.code-editor, .code-viewer, pre');
      expect(codeElement).toBeTruthy();

      // Verify Python-specific content
      const textContent = content.textContent;
      expect(textContent).toContain('def fibonacci_generator');
      expect(textContent).toContain('class TaskManager');
      expect(textContent).toContain('async def simulate_work');
      expect(textContent).toContain('from typing import');
    });
  });

  describe('SQL code workflow', () => {
    test('should handle complete SQL code display workflow', async () => {
      const sqlCode = `-- Advanced SQL Query Examples
-- Database schema for e-commerce platform

-- Create tables with proper constraints
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price > 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    category_id INTEGER,
    brand VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_customers_email ON customers(email);

-- Complex query: Top customers with their order statistics
WITH customer_stats AS (
    SELECT 
        c.customer_id,
        c.first_name,
        c.last_name,
        c.email,
        COUNT(DISTINCT o.order_id) as total_orders,
        COUNT(DISTINCT oi.product_id) as unique_products_bought,
        SUM(oi.quantity * oi.price) as total_spent,
        AVG(oi.quantity * oi.price) as avg_order_value,
        MAX(o.order_date) as last_order_date,
        MIN(o.order_date) as first_order_date
    FROM customers c
    LEFT JOIN orders o ON c.customer_id = o.customer_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 1 YEAR)
    GROUP BY c.customer_id, c.first_name, c.last_name, c.email
),
customer_ranking AS (
    SELECT *,
        ROW_NUMBER() OVER (ORDER BY total_spent DESC) as spending_rank,
        NTILE(4) OVER (ORDER BY total_spent DESC) as spending_quartile,
        CASE 
            WHEN total_spent > 10000 THEN 'VIP'
            WHEN total_spent > 5000 THEN 'Premium'
            WHEN total_spent > 1000 THEN 'Regular'
            ELSE 'Bronze'
        END as customer_tier
    FROM customer_stats
    WHERE total_orders > 0
)
SELECT 
    spending_rank,
    customer_tier,
    CONCAT(first_name, ' ', last_name) as customer_name,
    email,
    total_orders,
    unique_products_bought,
    ROUND(total_spent, 2) as total_spent,
    ROUND(avg_order_value, 2) as avg_order_value,
    DATEDIFF(last_order_date, first_order_date) as customer_lifetime_days,
    CASE 
        WHEN DATEDIFF(CURRENT_DATE, last_order_date) <= 30 THEN 'Active'
        WHEN DATEDIFF(CURRENT_DATE, last_order_date) <= 90 THEN 'At Risk'
        ELSE 'Churned'
    END as customer_status
FROM customer_ranking
WHERE spending_rank <= 100
ORDER BY total_spent DESC;

-- Product performance analysis with window functions
SELECT 
    p.name as product_name,
    p.price,
    p.stock_quantity,
    SUM(oi.quantity) as total_sold,
    SUM(oi.quantity * oi.price) as total_revenue,
    AVG(oi.quantity * oi.price) as avg_sale_value,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    -- Window functions for analytics
    RANK() OVER (ORDER BY SUM(oi.quantity * oi.price) DESC) as revenue_rank,
    PERCENT_RANK() OVER (ORDER BY SUM(oi.quantity * oi.price)) as revenue_percentile,
    LAG(SUM(oi.quantity * oi.price)) OVER (ORDER BY SUM(oi.quantity * oi.price) DESC) as prev_product_revenue,
    -- Calculate revenue difference from previous product
    SUM(oi.quantity * oi.price) - LAG(SUM(oi.quantity * oi.price)) OVER (ORDER BY SUM(oi.quantity * oi.price) DESC) as revenue_gap
FROM products p
JOIN order_items oi ON p.product_id = oi.product_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
GROUP BY p.product_id, p.name, p.price, p.stock_quantity
HAVING SUM(oi.quantity) > 0
ORDER BY total_revenue DESC
LIMIT 50;

-- Stored procedure example
DELIMITER //
CREATE PROCEDURE UpdateProductStock(
    IN product_id INT,
    IN quantity_change INT,
    OUT new_stock_level INT
)
BEGIN
    DECLARE current_stock INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    
    -- Get current stock level
    SELECT stock_quantity INTO current_stock 
    FROM products 
    WHERE product_id = product_id 
    FOR UPDATE;
    
    -- Update stock
    UPDATE products 
    SET stock_quantity = stock_quantity + quantity_change,
        updated_at = CURRENT_TIMESTAMP
    WHERE product_id = product_id;
    
    -- Return new stock level
    SET new_stock_level = current_stock + quantity_change;
    
    COMMIT;
END //
DELIMITER ;`;

      const toolResult = await tool.execute({
        asset: sqlCode,
        hint: 'code',
        title: 'Advanced SQL Queries',
        options: {
          language: 'sql',
          lineNumbers: true,
          theme: 'default',
          readOnly: true,
          highlightQueries: true
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('code');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 1000,
        height: 800,
        language: 'sql',
        lineNumbers: true
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();
      expect(window.classList.contains('showme-window-code')).toBe(true);

      const content = window.querySelector('.showme-window-content');
      const textContent = content.textContent;
      expect(textContent).toContain('CREATE TABLE');
      expect(textContent).toContain('WITH customer_stats');
      expect(textContent).toContain('WINDOW FUNCTIONS');
      expect(textContent).toContain('CREATE PROCEDURE');
    });
  });

  describe('code workflow with custom options', () => {
    test('should handle code with advanced display options', async () => {
      const codeWithOptions = `// TypeScript Interface Example
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  preferences?: UserPreferences;
}

interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
}

class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  findUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }
}`;

      const toolResult = await tool.execute({
        asset: codeWithOptions,
        hint: 'code',
        title: 'TypeScript Code with Options',
        options: {
          language: 'typescript',
          lineNumbers: true,
          wordWrap: true,
          fontSize: 16,
          tabSize: 2,
          theme: 'vs-dark',
          minimap: true,
          readOnly: false,
          highlightActiveLines: true,
          showWhitespace: true
        }
      });

      expect(toolResult.success).toBe(true);

      await clientActor.displayAsset(toolResult.assetId, {
        width: 700,
        height: 500,
        language: 'typescript',
        lineNumbers: true,
        wordWrap: true,
        theme: 'vs-dark',
        fontSize: 16
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      // Verify options applied to window manager
      const windowInfo = displayManager.windows.get(displayManager.getWindowIdForAsset(toolResult.assetId));
      if (windowInfo) {
        expect(windowInfo.options.language).toBe('typescript');
        expect(windowInfo.options.fontSize).toBe(16);
        expect(windowInfo.options.wordWrap).toBe(true);
      }
    });
  });

  describe('code workflow error scenarios', () => {
    test('should handle very long code files gracefully', async () => {
      // Generate a large code file
      const longCode = Array(1000).fill(0).map((_, i) => 
        `function generatedFunction${i}() {\n  return ${i};\n}`
      ).join('\n\n');

      const toolResult = await tool.execute({
        asset: longCode,
        hint: 'code',
        title: 'Large Code File Test',
        options: {
          virtualScrolling: true,
          lazyLoading: true
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('code');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 800,
        height: 600,
        virtualScrolling: true
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      const content = window.querySelector('.showme-window-content');
      expect(content).toBeTruthy();
    });

    test('should handle unknown programming language', async () => {
      const unknownLangCode = `// Unknown language syntax
      UNKNOWN_KEYWORD variable = value;
      CUSTOM_FUNCTION doSomething() {
        SPECIAL_OPERATOR result = compute();
        return result;
      }`;

      const toolResult = await tool.execute({
        asset: unknownLangCode,
        hint: 'code',
        title: 'Unknown Language Test',
        options: {
          language: 'unknown-lang'
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('code');

      await clientActor.displayAsset(toolResult.assetId, {
        language: 'unknown-lang'
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      // Should display as plain text or with basic highlighting
      const content = window.querySelector('.showme-window-content');
      const codeElement = content.querySelector('pre, code, .code-viewer');
      expect(codeElement).toBeTruthy();
    });
  });

  describe('code workflow performance', () => {
    test('should handle multiple code files efficiently', async () => {
      const codeFiles = [
        { code: 'console.log("File 1");', lang: 'javascript', title: 'JS File' },
        { code: 'print("File 2")', lang: 'python', title: 'Python File' },
        { code: 'SELECT * FROM users;', lang: 'sql', title: 'SQL File' }
      ];

      const startTime = Date.now();
      const toolResults = [];

      // Execute all code files
      for (const file of codeFiles) {
        const result = await tool.execute({
          asset: file.code,
          hint: 'code',
          title: file.title,
          options: { language: file.lang }
        });
        expect(result.success).toBe(true);
        toolResults.push(result);
      }

      // Display all files
      for (let i = 0; i < toolResults.length; i++) {
        await clientActor.displayAsset(toolResults[i].assetId, {
          width: 600,
          height: 400,
          x: i * 200,
          y: i * 100
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all windows created
      const windows = document.querySelectorAll('.showme-window-code');
      expect(windows.length).toBe(3);

      // Performance check
      expect(totalTime).toBeLessThan(4000);

      // Verify each code file displayed
      for (const result of toolResults) {
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
      }
    });
  });
});