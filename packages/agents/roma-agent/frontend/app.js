document.addEventListener('DOMContentLoaded', () => {
    // Check backend health
    fetch('http://localhost:3000/api/health')
        .then(response => response.json())
        .then(data => console.log('Backend status:', data))
        .catch(error => console.error('Error:', error));
});