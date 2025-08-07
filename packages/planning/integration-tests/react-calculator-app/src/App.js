import React, { useState } from 'react';

function App() {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');

  const handleNumber = (num) => {
    setDisplay(display === '0' ? num : display + num);
  };

  const handleOperator = (op) => {
    setEquation(display + op);
    setDisplay('0');
  };

  const calculateResult = () => {
    try {
      const result = eval(equation + display);
      setDisplay(result.toString());
      setEquation('');
    } catch (error) {
      setDisplay('Error');
    }
  };

  return (
    <div className="calculator">
      <div className="display">{display}</div>
      <div className="keypad">
        {[1,2,3,4,5,6,7,8,9,0].map(num => (
          <button key={num} onClick={() => handleNumber(num.toString())}>{num}</button>
        ))}
        <button onClick={() => handleOperator('+')}>+</button>
        <button onClick={() => handleOperator('-')}>-</button>
        <button onClick={calculateResult}>=</button>
      </div>
    </div>
  );
}

export default App;