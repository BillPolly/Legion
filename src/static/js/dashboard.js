let ws;
const connectionStatus = document.getElementById('connection-status');
const currentStep = document.getElementById('current-step');
const currentDetail = document.getElementById('current-detail');
const progressFill = document.getElementById('progress-fill');
const resultsContainer = document.getElementById('results-container');
const topicInput = document.getElementById('topic-input');
const startButton = document.getElementById('start-button');
const stepHistory = document.getElementById('step-history');

let currentProgress = 0;
let targetProgress = 0;
let progressInterval = null;
let lastAgent = null;
let simulationInterval = null;

function connect() {
  ws = new WebSocket('ws://localhost:8765');

  ws.onopen = () => {
    console.log('Connected to dashboard server');
    connectionStatus.textContent = '✅ Connected to server';
    connectionStatus.className = 'connection-status connected';
    startButton.disabled = false;
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received:', message);
    handleMessage(message);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('Disconnected from server');
    connectionStatus.textContent = '⚠️ Disconnected from server';
    connectionStatus.className = 'connection-status disconnected';
    startButton.disabled = true;
    // Attempt to reconnect after 3 seconds
    setTimeout(connect, 3000);
  };
}

function smoothProgress() {
  if (progressInterval) clearInterval(progressInterval);

  progressInterval = setInterval(() => {
    if (currentProgress < targetProgress) {
      currentProgress += 0.5;
      if (currentProgress > targetProgress) currentProgress = targetProgress;
      progressFill.style.width = currentProgress + '%';
    } else {
      clearInterval(progressInterval);
    }
  }, 50);
}

function setProgress(target) {
  targetProgress = target;
  smoothProgress();

  // Clear any existing simulation
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  // Turn progress bar green when complete
  if (target >= 100) {
    progressFill.classList.add('complete');
  } else {
    progressFill.classList.remove('complete');
  }

  // Start simulating progress toward next milestone (but don't reach it)
  if (target < 100) {
    const nextTarget = Math.min(target + 18, 95); // Simulate up to 18% ahead, but max 95%
    simulationInterval = setInterval(() => {
      if (currentProgress < nextTarget) {
        currentProgress += 0.15;
        progressFill.style.width = currentProgress + '%';
      }
    }, 100);
  }
}

function startResearch() {
  const topic = topicInput.value.trim();
  if (!topic) {
    alert('Please enter a research topic');
    return;
  }

  // Reset progress
  currentProgress = 0;
  targetProgress = 0;
  progressFill.style.width = '0%';
  progressFill.classList.remove('complete');
  lastAgent = null;

  // Disable button and clear previous results
  startButton.disabled = true;
  startButton.textContent = 'Researching...';
  resultsContainer.innerHTML = '';
  stepHistory.innerHTML = '';
  stepHistory.classList.remove('hidden');

  // Show status section again
  const statusElement = document.querySelector('.status');
  statusElement.classList.remove('fade-out');

  currentStep.textContent = 'Starting research...';
  currentDetail.textContent = `Topic: ${topic}`;

  // Send start message to server
  ws.send(JSON.stringify({
    type: 'start_research',
    topic: topic
  }));
}

function addStepToHistory(agent, displayName) {
  // Mark previous step as complete
  const items = stepHistory.querySelectorAll('.step-item');
  items.forEach(item => item.classList.add('complete'));

  // Add new step
  const stepItem = document.createElement('div');
  stepItem.className = 'step-item';
  stepItem.textContent = displayName;
  stepHistory.appendChild(stepItem);

  // Auto scroll to bottom
  stepHistory.scrollTop = stepHistory.scrollHeight;
}

// Event listeners
startButton.addEventListener('click', startResearch);
topicInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    startResearch();
  }
});

function handleMessage(message) {
  switch (message.type) {
    case 'progress':
      // Skip supervisor messages
      if (message.data.agent === 'supervisor') {
        return;
      }

      // Map agent names to display text
      const agentNames = {
        'query_planner': '� Planning Queries',
        'web_search': '� Searching Web',
        'link_checker': '� Checking Links',
        'content_extractor': '� Extracting Content',
        'analyst': '� Generating Report'
      };
      const displayName = agentNames[message.data.agent] || message.data.agent;

      // Add to history if this is a new agent
      if (message.data.agent !== lastAgent) {
        addStepToHistory(message.data.agent, displayName);
        lastAgent = message.data.agent;
      }

      currentStep.textContent = displayName;
      currentDetail.textContent = 'Processing...';
      setProgress(message.data.progress);
      break;

    case 'step_update':
      currentStep.textContent = message.data.title;
      currentDetail.textContent = message.data.subtitle || '';
      progressFill.style.width = message.data.progress + '%';
      break;

    case 'search_results':
      displaySearchResults(message.data);
      break;

    case 'link_check_results':
      displayLinkResults(message.data);
      break;

    case 'report_ready':
      displayReportLink(message.data);
      break;

    case 'page_previews':
      displayPagePreviews(message.data);
      break;

    case 'complete':
      displayFinalReport(message.data);
      currentStep.textContent = '✅ Research Complete!';
      currentDetail.textContent = `Generated ${message.data.word_count}-word report with ${message.data.sources.length} sources`;
      setProgress(100);
      startButton.disabled = false;
      startButton.textContent = 'Start Research';
      break;

    case 'error':
      currentStep.textContent = '❌ Error';
      currentDetail.textContent = message.data.message || 'An error occurred';
      startButton.disabled = false;
      startButton.textContent = 'Start Research';
      break;
  }
}

function displaySearchResults(data) {
  const html = `
    <div class="results">
      <h3>� Search Results</h3>
      ${data.results.map(result => `
        <div class="result-item">
          <strong>${result.title}</strong><br>
          <small>${result.url}</small>
        </div>
      `).join('')}
    </div>
  `;
  resultsContainer.innerHTML = html;
}

function displayLinkResults(data) {
  const html = `
    <div class="results">
      <h3>� Link Verification</h3>
      <p>Checked ${data.total} links: ${data.valid} valid, ${data.invalid} invalid</p>
      ${data.links.map(link => `
        <div class="result-item">
          ${link.url}
          <span class="link-status ${link.status}">${link.status}</span>
        </div>
      `).join('')}
    </div>
  `;
  resultsContainer.innerHTML += html;
}

function displayReportLink(data) {
  const html = `
    <div class="results">
      <h3>� Research Report Generated</h3>
      <p>${data.message}</p>
      <a href="${data.report_path}" class="report-link" target="_blank">View Report</a>
    </div>
  `;
  resultsContainer.innerHTML += html;
}

function displayPagePreviews(data) {
  const html = `
    <div class="results">
      <h3>� Page Previews (${data.pages.length} pages)</h3>
      ${data.pages.map(page => `
        <div class="page-preview">
          <div class="url"><a href="${page.url}" target="_blank">${page.url}</a></div>
          <div class="text">${page.preview}</div>
        </div>
      `).join('')}
    </div>
  `;
  resultsContainer.innerHTML += html;
}

function displayFinalReport(data) {
  // Get the status element
  const statusElement = document.querySelector('.status');

  // After 1 second (to show green bar), fade out the entire status section
  setTimeout(() => {
    statusElement.classList.add('fade-out');
  }, 1000);

  // Render markdown content
  const markdownHtml = marked.parse(data.content);

  const html = `
    <div class="results">
      <h3>� ${data.title}</h3>
      <p><strong>Word Count:</strong> ${data.word_count} words</p>
      <p><strong>Sources:</strong> ${data.sources.length} verified sources</p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
      <div class="markdown-content">${markdownHtml}</div>
    </div>
  `;
  resultsContainer.innerHTML = html;
}

// Intercept all link clicks and send to parent frame (VSCode webview)
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.href) {
    e.preventDefault();

    console.log('� LINK CLICKED:', link.href);
    console.log('� window.parent:', window.parent);
    console.log('� window.parent === window:', window.parent === window);

    // Try to post message to parent (VSCode webview wrapper)
    try {
      console.log('� Sending postMessage to parent...');
      window.parent.postMessage({
        type: 'open-link',
        url: link.href
      }, '*');
      console.log('✅ postMessage sent successfully');
    } catch (err) {
      console.error('❌ postMessage failed:', err);
      // Fallback if not in iframe
      console.log('� Using fallback window.open');
      window.open(link.href, '_blank');
    }
  }
});

// Connect on page load
connect();

// Listen for script execution requests from VSCode webview wrapper
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'executeScript') {
    console.log('� Received script execution request:', event.data.script);
    try {
      // Execute the script
      const result = eval(event.data.script);
      console.log('✅ Script executed successfully:', result);
    } catch (error) {
      console.error('❌ Script execution failed:', error);
    }
  }
});
����������������