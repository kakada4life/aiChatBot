// Get the elements
const toggleButton = document.querySelector('.toggle-btn');
const sidebar = document.querySelector('.sidebar');
const content = document.querySelector('.content');
const topbar = document.querySelector('.topbar');

// Add click event listener to the toggle button
toggleButton.addEventListener('click', () => {
  // If the sidebar is expanded, collapse it (and topbar)
  if (sidebar.classList.contains('expanded')) {
    sidebar.classList.remove('expanded');
    content.classList.remove('expanded');
    topbar.classList.remove('expanded');
  } else {
    // If the sidebar is collapsed, expand it (and topbar)
    sidebar.classList.add('expanded');
    content.classList.add('expanded');
    topbar.classList.add('expanded');
  }
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('content').classList.toggle('expanded');
}

// Function to open the settings modal
function showSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
}

// Function to close the settings modal
function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

// Function to change the language
function changeLanguage(language) {
    if (language === 'kh') {
        // Implement Khmer language logic (e.g., switch text content)
        document.body.setAttribute('lang', 'km');
        updateTextLanguage('kh');
    } else {
        // Implement English language logic
        document.body.setAttribute('lang', 'en');
        updateTextLanguage('en');
    }
}

// Function to update text based on language
function updateTextLanguage(language) {
    if (language === 'kh') {
        document.querySelector('.header-text').innerText = "AI Chatbot";  // Replace with Khmer translation
        document.querySelector('placeholderMessage').innerText = "កំពុងស្នើសុំអ្វីមួយ...";  // Replace with Khmer placeholder
        // Add more language-specific changes here
    } else {
        document.querySelector('.header-text').innerText = "AI Chatbot";
        document.querySelector('placeholderMessage').innerText = "What’s on your mind?";
        // Add more language-specific changes here
    }
}

// Function to toggle dark/light mode
function toggleDarkLight() {
    document.body.classList.toggle('light-mode');
    document.body.classList.toggle('dark-mode');
}

function newChat() {
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.innerHTML = '<div class="placeholder-message">What’s on your mind?</div>';
}

function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    if (!message) return;
    appendMessage('you', message);

    // Append a "typing..." message for the AI
    const aiTypingMessage = appendMessage('ai', "AI is typing",  'typing');

    fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message })
    })
    .then(response => response.json())
    .then(data => {
        aiTypingMessage.innerText = data.reply;
        aiTypingMessage.classList.remove('typing');
    })
    .catch(err => {
        appendMessage('ai', "Error: " + err);

        setTimeout(() => {
            aiTypingMessage.remove();
        }, 1000);
    });
    input.value = '';
}

function appendMessage(sender, text, className = '') {
    const chatWindow = document.getElementById('chatWindow');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender + ' ' + className;
    messageDiv.style.marginBottom = '10px';
    messageDiv.style.padding = '8px';
    messageDiv.style.borderRadius = '8px';

    const userBgColor = getComputedStyle(document.documentElement).getPropertyValue('--user-message-bg').trim();
    const aiBgColor = getComputedStyle(document.documentElement).getPropertyValue('--ai-message-bg').trim();

    messageDiv.style.backgroundColor = sender === 'user' ? userBgColor : aiBgColor;
    messageDiv.innerText = text;
    chatWindow.appendChild(messageDiv);

    document.getElementById('placeholderMessage').style.display = 'none';

    return messageDiv;
}

let mediaRecorder;
let audioChunks = [];

document.getElementById('start-recording').onclick = async () => {
    try {
        console.log("Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone access granted.");

        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/ogg; codecs=opus' });
        audioChunks = [];

        mediaRecorder.addEventListener("dataavailable", event => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener("stop", () => {
            console.log("Recording stopped. Sending audio...");
            const audioBlob = new Blob(audioChunks, { type: 'audio/ogg' });
            sendAudioToServer(audioBlob);
        });

        mediaRecorder.start();
        console.log("Recording started.");
        document.getElementById('start-recording').style.display = 'none';
        document.getElementById('stop-recording').style.display = 'block';
    } catch (err) {
        console.error("Error accessing microphone: " + err.message);
    }
};

document.getElementById('stop-recording').onclick = () => {
    mediaRecorder.stop();
    document.getElementById('start-recording').style.display = 'block';
    document.getElementById('stop-recording').style.display = 'none';
};

function sendAudioToServer(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');

    const aiTypingMessage = appendMessage('ai', "AI is typing...", 'typing');

    fetch('/upload', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        if (aiTypingMessage && aiTypingMessage.parentNode) {
            aiTypingMessage.parentNode.removeChild(aiTypingMessage); // Ensure removal
        }

        appendMessage('you', data.transcription);
        appendMessage('ai', data.reply);
    })
    .catch(error => {
        console.error('Error:', error);
        if (aiTypingMessage && aiTypingMessage.parentNode) {
            aiTypingMessage.parentNode.removeChild(aiTypingMessage);
        }
    });
}


function showAbout() {
    clearChat();
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.innerHTML = `
        <div class="about-section">
            <h2>About This Project</h2>
            <p>Project Idea by <strong>Prof. Ouk Polyvann</strong></p>
            <p>Developed by <li>Seng Put Kakada</li><li>Unso Lida</li><li>Chor Channe</li><li>Rin Daroth</li></p>
            <p>This AI Chatbot uses a Flask backend, supports speech-to-text input, and light/dark mode toggling.</p>
            <p class="thanks">Special Thanks to <strong>[Your University or Institution Name]</strong></p>
        </div>`;
}

function clearChat() {
    const chatWindow = document.getElementById('chatWindow');
    chatWindow.innerHTML = ''; // only clears messages
    document.getElementById('placeholderMessage').style.display = 'block';
}
