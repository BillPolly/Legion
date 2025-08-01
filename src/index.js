import { greet } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const contentDiv = document.getElementById('content');
    const message = greet('World');
    contentDiv.innerHTML = `<p>${message}</p>`;
    
    console.log('ES6 Frontend Project loaded successfully!');
});