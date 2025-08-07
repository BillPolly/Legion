import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DemoCard from './DemoCard';

describe('DemoCard', () => {
  test('renders DemoCard component', () => {
    render(<DemoCard />);
    
    const heading = screen.getByText(/Welcome to DemoCard/i);
    expect(heading).toBeInTheDocument();
    
    const button = screen.getByText(/Click Me/i);
    expect(button).toBeInTheDocument();
  });

  test('handles button click', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    render(<DemoCard />);
    
    const button = screen.getByText(/Click Me/i);
    button.click();
    
    expect(consoleSpy).toHaveBeenCalledWith('DemoCard clicked');
    consoleSpy.mockRestore();
  });
});