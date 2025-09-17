function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('clock').textContent = timeString;
}

// Update the clock immediately
updateClock();

// Update the clock every second
setInterval(updateClock, 1000);