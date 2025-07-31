# Available Legion Tools for Plan Execution

Generated: 2025-07-31T17:21:29.275Z

## Summary

- **Total Modules**: 1
- **Total Tools**: 1

## Modules

### file

- **Description**: File system operations for reading, writing, and managing files and directories
- **Tools**: 1
- **Tool Names**: `file_operations`

## Tools Reference

| Tool Name | Description | Has Execute | Has Invoke |
|-----------|-------------|-------------|------------|
| `file_operations` | Comprehensive file system operations including reading, writing, and directory management | ✅ | ✅ |

## Using Tools in Plans

When creating plans for the PlanExecutor, use the tool names listed above in your action types:

```json
{
  "id": "example-plan",
  "status": "validated",
  "steps": [
    {
      "id": "write-file",
      "actions": [
        {
          "type": "file_operations",
          "parameters": {
            "filepath": "/tmp/output.txt",
            "content": "Hello from PlanExecutor!"
          }
        }
      ]
    }
  ]
}
```
