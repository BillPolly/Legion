import React, { useState } from 'react';
import './Hero.css';

// Props interface
interface HeroProps {
  title: string;
  subtitle: string;
}

const Hero = ({ title, subtitle }: HeroProps) => {
  const [state, setState] = useState({});


  return (
    <div className="hero-container">
      <h2>Welcome to Hero</h2>
      <p>{title}</p>
      <p>{subtitle}</p>
      <button 
        className="button"
        onClick={() => console.log('Hero clicked')}
      >
        Click Me
      </button>
    </div>
  );
};

export default Hero;