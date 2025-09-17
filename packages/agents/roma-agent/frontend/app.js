document.addEventListener('DOMContentLoaded', () => {
    fetch('http://localhost:3000/api/hello')
        .then(response => response.json())
        .then(data => {
            document.getElementById('message').textContent = data.message;
        })
        .catch(error => console.error('Error:', error));
});