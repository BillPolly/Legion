/**
 * Data Grid Example
 * Shows a simple table with sortable columns and row actions
 */

export const DataGridExample = {
  name: 'Data Grid',
  description: 'Interactive data grid with sorting and row actions',
  category: 'lists',
  
  dsl: `
DataGrid :: data =>
  div.data-grid [
    div.grid-header [
      h3 { "Employee Directory" }
      div.grid-controls [
        button.sort-btn @click="sortByName" { "Sort by Name" }
        button.sort-btn @click="sortBySalary" { "Sort by Salary" }
        button.add-btn @click="addEmployee" { "+ Add Employee" }
      ]
    ]
    
    div.grid-container [
      div.grid-header-row [
        div.grid-cell.header { "Name" }
        div.grid-cell.header { "Department" }
        div.grid-cell.header { "Salary" }
        div.grid-cell.header { "Actions" }
      ]
      
      for employee in data.employees [
        div.grid-row [
          div.grid-cell { employee.name }
          div.grid-cell { employee.department }
          div.grid-cell { "$" + employee.salary }
          div.grid-cell.actions [
            button.edit-btn @click="editEmployee" { "Edit" }
            button.delete-btn @click="deleteEmployee" { "Delete" }
          ]
        ]
      ]
    ]
    
    div.grid-footer [
      p { "Total employees: " + data.employees.length }
      p { "Selected: " + data.selectedCount }
    ]
  ]`,
  
  data: {
    employees: [
      { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 75000 },
      { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 65000 },
      { id: 3, name: 'Carol Davis', department: 'Engineering', salary: 80000 },
      { id: 4, name: 'Dave Wilson', department: 'Sales', salary: 55000 },
      { id: 5, name: 'Eva Brown', department: 'HR', salary: 60000 }
    ],
    selectedCount: 0,
    sortBy: 'name',
    sortOrder: 'asc'
  },
  
  actions: {
    sortByName() {
      const employees = this.get('employees');
      const sorted = [...employees].sort((a, b) => a.name.localeCompare(b.name));
      this.set('employees', sorted);
    },
    
    sortBySalary() {
      const employees = this.get('employees');
      const sorted = [...employees].sort((a, b) => b.salary - a.salary);
      this.set('employees', sorted);
    },
    
    addEmployee() {
      const employees = this.get('employees');
      const newEmployee = {
        id: Date.now(),
        name: 'New Employee',
        department: 'Unassigned',
        salary: 50000
      };
      this.set('employees', [...employees, newEmployee]);
    },
    
    editEmployee() {
      alert('Edit functionality would open a form dialog');
    },
    
    deleteEmployee() {
      // In a real app, we'd get the employee ID from the event context
      const employees = this.get('employees');
      if (employees.length > 0) {
        this.set('employees', employees.slice(0, -1)); // Remove last for demo
      }
    }
  },
  
  styles: `
    .data-grid {
      max-width: 800px;
      margin: 20px auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .grid-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e1e5e9;
    }
    
    .grid-header h3 {
      margin: 0;
      color: #2c3e50;
    }
    
    .grid-controls {
      display: flex;
      gap: 10px;
    }
    
    .sort-btn, .add-btn {
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: #f8f9fa;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .sort-btn:hover, .add-btn:hover {
      background: #e9ecef;
      border-color: #adb5bd;
    }
    
    .add-btn {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }
    
    .add-btn:hover {
      background: #0056b3;
    }
    
    .grid-container {
      border: 1px solid #dee2e6;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .grid-header-row {
      display: grid;
      grid-template-columns: 2fr 1.5fr 1fr 1.5fr;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
    }
    
    .grid-row {
      display: grid;
      grid-template-columns: 2fr 1.5fr 1fr 1.5fr;
      border-bottom: 1px solid #dee2e6;
    }
    
    .grid-row:hover {
      background: #f1f3f4;
    }
    
    .grid-cell {
      padding: 12px;
      border-right: 1px solid #dee2e6;
      display: flex;
      align-items: center;
    }
    
    .grid-cell:last-child {
      border-right: none;
    }
    
    .grid-cell.header {
      font-weight: 600;
      color: #495057;
      background: #f8f9fa;
    }
    
    .grid-cell.actions {
      gap: 8px;
    }
    
    .edit-btn, .delete-btn {
      padding: 4px 8px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }
    
    .edit-btn:hover {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }
    
    .delete-btn:hover {
      background: #dc3545;
      color: white;
      border-color: #dc3545;
    }
    
    .grid-footer {
      margin-top: 15px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: #6c757d;
    }
    
    .grid-footer p {
      margin: 0;
    }
  `
};