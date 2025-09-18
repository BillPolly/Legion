document.addEventListener('DOMContentLoaded', () => {
    fetchMessage();
});

async function fetchMessage() {
    try {
        const response = await fetch('http://localhost:3000/api/hello');
        const data = await response.json();
        document.getElementById('message').textContent = data.message;
    } catch (error) {
        console.error('Error:', error);
    }
}