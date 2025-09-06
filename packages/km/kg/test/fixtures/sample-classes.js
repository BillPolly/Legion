/**
 * Sample classes for testing the Knowledge Graph system
 */

export class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
    this.friends = [];
  }

  greet(other) {
    return `Hello ${other.name}, I'm ${this.name}`;
  }

  addFriend(friend) {
    if (!this.friends.includes(friend)) {
      this.friends.push(friend);
      friend.friends.push(this);
    }
  }

  static getSpecies() {
    return "Homo sapiens";
  }
}

export class Employee extends Person {
  constructor(name, age, department, salary) {
    super(name, age);
    this.department = department;
    this.salary = salary;
    this.manager = null;
    this.subordinates = [];
  }

  setManager(manager) {
    this.manager = manager;
    if (!manager.subordinates.includes(this)) {
      manager.subordinates.push(this);
    }
  }

  getAnnualSalary() {
    return this.salary * 12;
  }

  static getEmployeeCount() {
    return Employee._count || 0;
  }
}

export class Agent extends Person {
  constructor(name, age) {
    super(name, age);
    this.beliefs = [];
    this.observations = [];
  }

  observe(subject, predicate, object, confidence = 0.7) {
    const observation = {
      subject,
      predicate,
      object,
      confidence,
      timestamp: new Date().toISOString(),
      source: 'direct_observation'
    };
    this.observations.push(observation);
    return observation;
  }

  infer(subject, predicate, object, confidence = 0.5) {
    const belief = {
      subject,
      predicate,
      object,
      confidence,
      timestamp: new Date().toISOString(),
      source: 'inference'
    };
    this.beliefs.push(belief);
    return belief;
  }
}

export class SimpleClass {
  constructor(value) {
    this.value = value;
  }

  getValue() {
    return this.value;
  }

  setValue(newValue) {
    this.value = newValue;
  }
}

export class ComplexClass {
  constructor(data) {
    this.id = data.id;
    this.metadata = data.metadata || {};
    this.children = data.children || [];
    this.parent = data.parent || null;
    this.tags = data.tags || [];
  }

  addChild(child) {
    this.children.push(child);
    child.parent = this;
  }

  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  getDepth() {
    let depth = 0;
    let current = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }
}
