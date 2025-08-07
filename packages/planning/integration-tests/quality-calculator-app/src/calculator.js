'use strict';

class Calculator {
  constructor() {
    this.display = document.getElementById('display');
    this.value = '';
    this.operator = null;
  }

  clear() {
    this.value = '';
    this.operator = null;
    this.updateDisplay();
  }

  updateDisplay() {
    this.display.textContent = this.value || '0';
  }
}