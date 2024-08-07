// Use strict mode for better error catching and performance
'use strict';

// Declare variables using let or const for better scoping
let chatHistory, userInput, apiKeyInput, modelSelect, deepgramApiKeyInput, micButton, mediaRecorder;
const audioChunks = [];
const conversationHistory = [];

// Optimize adjustTextareaHeight function
const adjustTextareaHeight = () => {
  if (userInput) {
    userInput.style.height = 'auto';
    userInput.style.height = `${Math.min(userInput.scrollHeight, 200)}px`;
  }
};

// Define handleSendMessage function
const handleSendMessage = () => {
  const message = userInput.value.trim();
  if (message) {
    sendMessage(message);
    userInput.value = '';
    adjustTextareaHeight();
  }
};

// Combine and optimize event listener initialization
const initializeEventListeners = () => {
  console.log('Initializing event listeners');
  
  // Use querySelector for more flexible selection
  chatHistory = document.querySelector('#chat-history');
  userInput = document.querySelector('#user-input');
  apiKeyInput = document.querySelector('#api-key');
  modelSelect = document.querySelector('#model-select');
  deepgramApiKeyInput = document.querySelector('#deepgram-api-key');
  micButton = document.querySelector('#mic-button');
  const sendButton = document.querySelector('#send-button');
  const newChatBtn = document.querySelector('.new-chat-btn');

  // Load API keys from localStorage
  const savedApiKey = localStorage.getItem('apiKey');
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }

  const savedDeepgramApiKey = localStorage.getItem('deepgramApiKey');
  if (savedDeepgramApiKey) {
    deepgramApiKeyInput.value = savedDeepgramApiKey;
  }

  // Event listener for send button
  if (sendButton) {
    console.log('Send button found');
    sendButton.addEventListener('click', handleSendMessage);
  } else {
    console.error('Send button not found');
  }
  
  // Event listener for new chat button
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      chatHistory.innerHTML = '';
      conversationHistory.length = 0;
    });
  }

  // Event listeners for user input
  if (userInput) {
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
    userInput.addEventListener('input', adjustTextareaHeight);
  }

  // Event listener for API key inputs
  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', () => {
      localStorage.setItem('apiKey', apiKeyInput.value);
    });
  }

  if (deepgramApiKeyInput) {
    deepgramApiKeyInput.addEventListener('input', () => {
      localStorage.setItem('deepgramApiKey', deepgramApiKeyInput.value);
    });
  }

  // Event listener for mic button
  if (micButton) {
    console.log('Mic button found');
    micButton.addEventListener('click', handleMicButtonClick);
  } else {
    console.error('Mic button not found');
  }
};

const handleMicButtonClick = async () => {
  console.log('Mic button clicked');
  
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    micButton.textContent = 'Mic';
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      const audioChunks = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await handleSend(audioBlob);
      };
      
      mediaRecorder.start();
      micButton.textContent = 'Stop';
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('An error occurred while accessing the microphone.');
    }
  }
};

// Optimize formatMessage function
const formatMessage = (message) => {
  const formattedMessage = marked.parse(message);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = formattedMessage;
  wrapper.querySelectorAll('pre code').forEach(hljs.highlightElement);
  return wrapper.innerHTML;
};

// Optimize addMessageToChat function
const addMessageToChat = (sender, message, className) => {
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'padding: 10px; margin-bottom: 10px; border-radius: 10px;';

  const senderSpan = document.createElement('span');
  senderSpan.textContent = `${sender}: `;
  senderSpan.style.fontWeight = 'bold';
  messageDiv.appendChild(senderSpan);

  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = formatMessage(message);
  messageDiv.appendChild(contentDiv);

  chatHistory.appendChild(messageDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
};

// Optimize sendMessage function
const sendMessage = async (message) => {
  const apiKey = apiKeyInput.value.trim();
  const selectedModel = modelSelect.value;

  if (!apiKey) {
    alert('Please enter your API key.');
    return;
  }

  if (!message) return;

  addMessageToChat('You', message, 'user-message');
  conversationHistory.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Use Markdown formatting for code blocks and structured text.',
          },
          ...conversationHistory,
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;

    addMessageToChat('AI', responseText, 'ai-message');
    conversationHistory.push({ role: 'assistant', content: responseText });
  } catch (error) {
    console.error('Error:', error);
    alert('An error occurred while fetching the response. Please check your API key and try again.');
  }
};

const handleSend = async (audioBlob) => {
  if (audioBlob) {
    const apiKey = deepgramApiKeyInput.value.trim();
    
    if (!apiKey) {
      alert('Please enter your Deepgram API key.');
      return;
    }

    try {
      console.log('Sending audio to Deepgram...');
      const response = await fetch('https://api.deepgram.com/v1/listen', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'audio/webm',
        },
        body: audioBlob
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('Parsed data:', data);

      if (data.results && data.results.channels && data.results.channels[0].alternatives && data.results.channels[0].alternatives[0].transcript) {
        const transcript = data.results.channels[0].alternatives[0].transcript;
        console.log('Transcription:', transcript);
        
        userInput.value = transcript;
        adjustTextareaHeight();
      } else {
        console.error('Unexpected response structure:', data);
        alert('Received an unexpected response structure from Deepgram.');
      }
    } catch (error) {
      console.error('Error sending audio to Deepgram:', error);
      alert(`An error occurred while transcribing the audio: ${error.message}`);
    }
  } else {
    console.error('No audio blob provided');
    alert('No audio data available to transcribe.');
  }
};
// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded');
  initializeEventListeners();
  adjustTextareaHeight();
});

// Make handleSendMessage globally accessible
window.handleSendMessage = handleSendMessage;