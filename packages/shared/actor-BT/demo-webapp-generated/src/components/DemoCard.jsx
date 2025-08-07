import React, { useState, useEffect } from 'react';
import './DemoCard.css';

// Props interface
interface DemoCardProps {
  title: string;
  description: string;
  featured: boolean;
}

const DemoCard = ({ title, description, featured }: DemoCardProps) => {
  const [state, setState] = useState({});

  useEffect(() => {
    // Effect logic here
  }, []);

  return (
    <div className="democard-container">
      <h2>Welcome to DemoCard</h2>
      <p>{title}</p>
      <p>{description}</p>
      <p>{featured}</p>
      <button 
        className="button"
        onClick={() => console.log('DemoCard clicked')}
      >
        Click Me
      </button>
    </div>
  );
};

export default DemoCard;