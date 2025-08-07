let display = document.getElementById('display');

function calculate(value) {
  try {
    if (value === '=') {
      display.value = eval(display.value);
    } else {
      display.value += value;
    }
  } catch (error) {
    display.value = 'Error';
  }
}