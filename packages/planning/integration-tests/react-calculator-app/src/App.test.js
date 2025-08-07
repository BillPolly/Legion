import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders calculator display', () => {
  const { container } = render(<App />);
  const display = container.querySelector('.display');
  expect(display).toBeInTheDocument();
  expect(display.textContent).toBe('0');
});

test('can perform basic calculation', () => {
  const { container } = render(<App />);
  const button1 = screen.getByRole('button', { name: '1' });
  const buttonPlus = screen.getByRole('button', { name: '+' });
  const button2 = screen.getByRole('button', { name: '2' });
  const buttonEquals = screen.getByRole('button', { name: '=' });
  
  fireEvent.click(button1);
  fireEvent.click(buttonPlus);
  fireEvent.click(button2);
  fireEvent.click(buttonEquals);
  
  const display = container.querySelector('.display');
  expect(display.textContent).toBe('3');
});