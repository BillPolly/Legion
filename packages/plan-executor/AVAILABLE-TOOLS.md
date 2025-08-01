# Available Tools for Plan Executor

Generated: 2025-07-31T21:17:12.754Z

## Summary

- **Total Tools**: 24

## Available Tools

### `file_operations`

- **Description**: Comprehensive file system operations including reading, writing, and directory management
- **Input Schema**:
  ```json
  {}
  ```

### `navigate_to_page`

- **Description**: Navigate to a web page and wait for it to load completely
- **Input Schema**:
  ```json
  {}
  ```

### `click_element`

- **Description**: Click on an element using various selector strategies
- **Input Schema**:
  ```json
  {}
  ```

### `fill_form`

- **Description**: Fill out a form with provided data and optionally submit it
- **Input Schema**:
  ```json
  {}
  ```

### `take_screenshot`

- **Description**: Take a screenshot of the current page or specific element
- **Input Schema**:
  ```json
  {}
  ```

### `extract_data`

- **Description**: Extract structured data from the page using CSS selectors
- **Input Schema**:
  ```json
  {}
  ```

### `wait_for_element`

- **Description**: Wait for an element to appear, disappear, or change state
- **Input Schema**:
  ```json
  {}
  ```

### `execute_script`

- **Description**: Execute JavaScript code in the browser context
- **Input Schema**:
  ```json
  {}
  ```

### `get_page_info`

- **Description**: Get information about the current page
- **Input Schema**:
  ```json
  {}
  ```

### `handle_file_upload`

- **Description**: Upload a file to a file input element
- **Input Schema**:
  ```json
  {}
  ```

### `emulate_device`

- **Description**: Emulate a mobile device or change viewport settings
- **Input Schema**:
  ```json
  {}
  ```

### `close_browser`

- **Description**: Close the browser and clean up resources
- **Input Schema**:
  ```json
  {}
  ```

### `record_video`

- **Description**: Record a video of browser interactions for a specified duration
- **Input Schema**:
  ```json
  {}
  ```

### `start_node_process`

- **Description**: Start a Node.js process with full configuration options
- **Input Schema**:
  ```json
  {}
  ```

### `stop_process`

- **Description**: Stop a running process gracefully or forcefully
- **Input Schema**:
  ```json
  {}
  ```

### `restart_process`

- **Description**: Restart a process with new configuration
- **Input Schema**:
  ```json
  {}
  ```

### `list_processes`

- **Description**: List all managed processes and their status
- **Input Schema**:
  ```json
  {}
  ```

### `start_web_server`

- **Description**: Start a web server with port management and health checks
- **Input Schema**:
  ```json
  {}
  ```

### `start_dev_server`

- **Description**: Start a development server with hot reload support
- **Input Schema**:
  ```json
  {}
  ```

### `check_server_health`

- **Description**: Check the health status of a running server
- **Input Schema**:
  ```json
  {}
  ```

### `install_dependencies`

- **Description**: Install NPM packages and dependencies
- **Input Schema**:
  ```json
  {}
  ```

### `run_npm_script`

- **Description**: Execute a script defined in package.json
- **Input Schema**:
  ```json
  {}
  ```

### `get_process_logs`

- **Description**: Get logs from a running or finished process
- **Input Schema**:
  ```json
  {}
  ```

### `command_executor`

- **Description**: Execute a bash command in the terminal and return the output
- **Input Schema**:
  ```json
  {}
  ```

## Usage in Plans

Use these tools in your plan JSON files:

```json
{
  "id": "example-plan",
  "name": "Example Plan",
  "status": "validated",
  "steps": [
    {
      "id": "step-1",
      "name": "Example Step",
      "actions": [
        {
          "id": "action-1",
          "type": "<tool-name>",
          "parameters": {
            // Tool-specific parameters
          }
        }
      ]
    }
  ]
}
```

## Quick Reference - All Tool Names

- `file_operations` - Comprehensive file system operations including reading, writing, and directory management
- `navigate_to_page` - Navigate to a web page and wait for it to load completely
- `click_element` - Click on an element using various selector strategies
- `fill_form` - Fill out a form with provided data and optionally submit it
- `take_screenshot` - Take a screenshot of the current page or specific element
- `extract_data` - Extract structured data from the page using CSS selectors
- `wait_for_element` - Wait for an element to appear, disappear, or change state
- `execute_script` - Execute JavaScript code in the browser context
- `get_page_info` - Get information about the current page
- `handle_file_upload` - Upload a file to a file input element
- `emulate_device` - Emulate a mobile device or change viewport settings
- `close_browser` - Close the browser and clean up resources
- `record_video` - Record a video of browser interactions for a specified duration
- `start_node_process` - Start a Node.js process with full configuration options
- `stop_process` - Stop a running process gracefully or forcefully
- `restart_process` - Restart a process with new configuration
- `list_processes` - List all managed processes and their status
- `start_web_server` - Start a web server with port management and health checks
- `start_dev_server` - Start a development server with hot reload support
- `check_server_health` - Check the health status of a running server
- `install_dependencies` - Install NPM packages and dependencies
- `run_npm_script` - Execute a script defined in package.json
- `get_process_logs` - Get logs from a running or finished process
- `command_executor` - Execute a bash command in the terminal and return the output
