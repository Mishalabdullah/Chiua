"use strict";

// Global variables
let chatHistory,
  userInput,
  apiKeyInput,
  modelSelect,
  deepgramApiKeyInput,
  micButton,
  mediaRecorder;
const audioChunks = [];
let conversationHistory = [];
let savedChats = {};
let currentChatId = null;
let githubToken = "";
let githubRepo = "";

// DOM Element Selectors
const getChatHistory = () => document.querySelector("#chat-history");
const getUserInput = () => document.querySelector("#user-input");
const getApiKeyInput = () => document.querySelector("#api-key");
const getModelSelect = () => document.querySelector("#model-select");
const getDeepgramApiKeyInput = () =>
  document.querySelector("#deepgram-api-key");
const getMicButton = () => document.querySelector("#mic-button");
const getSendButton = () => document.querySelector("#send-button");
const getNewChatBtn = () => document.querySelector(".new-chat-btn");
const getSaveButton = () => document.querySelector("#save-button");
const getPushToGithubButton = () =>
  document.querySelector("#push-to-github-button");
const getGithubTokenInput = () => document.querySelector("#github-token-input");
const getGithubRepoInput = () => document.querySelector("#github-repo-input");
const getSavedChatsList = () => document.querySelector("#saved-chats-list");
const getThemeToggle = () => document.querySelector("#checkbox");

// Utility functions
const showLoader = (element) => {
  const loader = document.createElement("div");
  loader.className = "loader";
  element.appendChild(loader);
};

const removeLoader = (element) => {
  const loader = element.querySelector(".loader");
  if (loader) loader.remove();
};

const adjustTextareaHeight = () => {
  if (userInput) {
    userInput.style.height = "auto";
    userInput.style.height = `${Math.min(userInput.scrollHeight, 200)}px`;
  }
};

const setTheme = (theme) => {
  document.body.classList.toggle("dark-theme", theme === "dark");
  localStorage.setItem("theme", theme);
  const themeToggle = getThemeToggle();
  if (themeToggle) {
    themeToggle.checked = theme === "dark";
  }
};
const toggleTheme = () => {
  const themeToggle = getThemeToggle();
  const newTheme = themeToggle.checked ? "dark" : "light";
  setTheme(newTheme);
};

const initializeTheme = () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);
};
const formatMessage = (message) => {
  const formattedMessage = marked.parse(message);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = formattedMessage;

  // Add copy buttons to code blocks
  wrapper.querySelectorAll("pre").forEach((pre, index) => {
    const codeBlock = pre.querySelector("code");
    if (codeBlock) {
      const copyButton = document.createElement("button");
      copyButton.textContent = "";
      copyButton.className = "copy-button";
      const originalCode = codeBlock.textContent;
      copyButton.addEventListener(
        "click",
        copyToClipboard(originalCode, copyButton)
      );

      pre.style.position = "relative";
      pre.insertBefore(copyButton, codeBlock);

      hljs.highlightElement(codeBlock);
    }
  });

  return wrapper.outerHTML; // Changed from innerHTML to outerHTML
};

const addMessageToChat = (sender, message, className) => {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${className}`;

  const senderSpan = document.createElement("span");
  senderSpan.textContent = `${sender}: `;
  senderSpan.className = "message-sender";

  const contentDiv = document.createElement("div");
  contentDiv.innerHTML = formatMessage(message);
  contentDiv.className = "message-content";

  if (className === "ai-message") {
    const headerDiv = document.createElement("div");
    headerDiv.className = "message-header";

    const copyFullResponseButton = document.createElement("button");
    copyFullResponseButton.textContent = "Copy Full Response";
    copyFullResponseButton.className = "copy-full-response-button";
    copyFullResponseButton.onclick = () =>
      copyToClipboard(message, copyFullResponseButton);

    headerDiv.appendChild(senderSpan);
    headerDiv.appendChild(copyFullResponseButton);
    messageDiv.appendChild(headerDiv);
  } else {
    messageDiv.appendChild(senderSpan);
  }

  messageDiv.appendChild(contentDiv);

  chatHistory.appendChild(messageDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
};

const copyToClipboard = (text, button) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      console.log(text, button);
      const originalText = button.textContent;
      button.textContent = "Copied!";
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy text: ", err);
    });
};


const sendMessage = async (message) => {
  const apiKey = apiKeyInput.value.trim();
  const selectedModel = modelSelect.value;

  if (!apiKey) {
    alert("Please enter your API key.");
    return;
  }

  if (!message) return;

  // User's message
  addMessageToChat("You", message, "user-message");
  conversationHistory.push({ role: "user", content: message });

  // Placeholder for AI's message
  const tempMessageId = `temp_ai_message_${Date.now()}`;
  const placeholderDiv = document.createElement("div");
  placeholderDiv.className = "message ai-message";
  placeholderDiv.id = tempMessageId;
  placeholderDiv.innerHTML = `<span class="message-sender">AI: </span><div class="message-content"></div>`;
  chatHistory.appendChild(placeholderDiv);

  const loaderContainer = document.createElement("div");
  chatHistory.appendChild(loaderContainer);
  showLoader(loaderContainer);

  let rawAiMessage = ''; // Raw message for buffering streaming content

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Use Markdown formatting for code blocks and structured text.",
          },
          ...conversationHistory,
        ],
        max_tokens: 2048,
        stream: true, // Enable streaming
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let messageBuffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      messageBuffer += chunk;

      let boundary = messageBuffer.indexOf('\n');

      while (boundary !== -1) {
        const completeMessage = messageBuffer.substring(0, boundary + 1).trim();
        messageBuffer = messageBuffer.substring(boundary + 1);

        if (completeMessage.startsWith('data: ')) {
          const jsonString = completeMessage.substring(6); // Remove 'data: ' prefix
          if (jsonString !== "[DONE]") {
            const jsonData = JSON.parse(jsonString);
            const content = jsonData.choices[0].delta.content;
            if (content) {
              rawAiMessage += content;
              // Update placeholder without formatting
              updateChatMessage("AI", rawAiMessage, "ai-message", tempMessageId);
            }
          }
        }

        boundary = messageBuffer.indexOf('\n');
      }
    }

    if (rawAiMessage.trim()) {
      const formattedAiMessage = formatMessage(rawAiMessage); // Format the final message with markdown
      // Update the final message with formatted markdown
      updateChatMessage("AI", formattedAiMessage, "ai-message", tempMessageId, true);

      conversationHistory.push({ role: "assistant", content: rawAiMessage });
    }

    // Update the current chat in savedChats if it exists
    if (currentChatId && savedChats[currentChatId]) {
      savedChats[currentChatId].messages = [...conversationHistory];
      localStorage.setItem("savedChats", JSON.stringify(savedChats));
      console.log(savedChats);
      updateSavedChatsList();
    }
  } catch (error) {
    console.error("Error:", error);
    alert(
      "An error occurred while fetching the response. Please check your API key and try again."
    );
  } finally {
    removeLoader(loaderContainer);
    loaderContainer.remove();
    userInput.value = "";
    adjustTextareaHeight();
  }
};

function updateChatMessage(sender, message, className, messageId, isFinalFormat = false) {
  const messageDiv = document.getElementById(messageId);

  if (messageDiv) {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (isFinalFormat) {
      contentDiv.innerHTML = message;
    } else {
      contentDiv.textContent = message;
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
}




// Chat storage functions
const generateChatId = () => `chat_${Date.now()}`;

const saveCurrentChat = () => {
  const currentDate = new Date().toISOString().split("T")[0];

  if (!currentChatId) {
    currentChatId = generateChatId();
  }

  savedChats[currentChatId] = {
    date: currentDate,
    messages: [...conversationHistory],
  };

  localStorage.setItem("savedChats", JSON.stringify(savedChats));
  updateSavedChatsList();
};

const updateSavedChatsList = () => {
  const savedChatsList = getSavedChatsList();
  if (!savedChatsList) return;

  savedChatsList.innerHTML = "";

  Object.entries(savedChats).forEach(([chatId, chatData]) => {
    const chatItem = document.createElement("div");
    chatItem.textContent = `${chatData.date} - ${
      chatData.messages[0]?.content.substring(0, 30) || "Empty chat"
    }...`;
    chatItem.className = "saved-chat-item";
    chatItem.addEventListener("click", () => loadChat(chatId));
    savedChatsList.appendChild(chatItem);
  });
};

const loadChat = (chatId) => {
  currentChatId = chatId;
  conversationHistory = [...savedChats[chatId].messages];
  chatHistory.innerHTML = "";
  conversationHistory.forEach((message) => {
    addMessageToChat(
      message.role === "user" ? "You" : "AI",
      message.content,
      message.role === "user" ? "user-message" : "ai-message"
    );
  });
};

const startNewChat = () => {
  chatHistory.innerHTML = "";
  conversationHistory = [];
  currentChatId = null;
};

// GitHub integration
const pushToGithub = async () => {
  if (!githubToken || !githubRepo) {
    alert(
      "Please enter your GitHub token and repository name in the settings."
    );
    return;
  }

  const content = btoa(JSON.stringify(savedChats, null, 2));
  const date = new Date().toISOString().split("T")[0];
  const path = `chats/${date}/chats.json`;

  try {
    // Step 1: Fetch the current file's `sha`
    let sha = null;
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/${path}`,
      {
        method: "GET",
        headers: {
          Authorization: `token ${githubToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
    }

    // Step 2: Include the `sha` in the update request
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Update chats for ${date}`,
          content: content,
          branch: "main",
          sha: sha, // Include the `sha` if it exists
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    alert("Chats successfully pushed to GitHub!");
  } catch (error) {
    console.error("Error pushing to GitHub:", error);
    alert(`Failed to push to GitHub: ${error.message}`);
  }
};

// Mic handling
const handleMicButtonClick = async () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    micButton.textContent = "Mic";
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        await handleSendAudio(audioBlob);
      };

      mediaRecorder.start();
      micButton.textContent = "Stop";
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("An error occurred while accessing the microphone.");
    }
  }
};

const handleSendAudio = async (audioBlob) => {
  if (!audioBlob) {
    console.error("No audio blob provided");
    alert("No audio data available to transcribe.");
    return;
  }

  const apiKey = deepgramApiKeyInput.value.trim();

  if (!apiKey) {
    alert("Please enter your Deepgram API key.");
    return;
  }

  micButton.innerHTML = '<div class="loader"></div>';
  micButton.disabled = true;

  try {
    const response = await fetch("https://api.deepgram.com/v1/listen", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "audio/webm",
      },
      body: audioBlob,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      const transcript = data.results.channels[0].alternatives[0].transcript;
      userInput.value = transcript;
      adjustTextareaHeight();
    } else {
      throw new Error("Unexpected response structure from Deepgram.");
    }
  } catch (error) {
    console.error("Error sending audio to Deepgram:", error);
    alert(`An error occurred while transcribing the audio: ${error.message}`);
  } finally {
    micButton.innerHTML = "Mic";
    micButton.disabled = false;
  }
};

// Event listeners
const initializeEventListeners = () => {
  chatHistory = getChatHistory();
  userInput = getUserInput();
  apiKeyInput = getApiKeyInput();
  modelSelect = getModelSelect();
  deepgramApiKeyInput = getDeepgramApiKeyInput();
  micButton = getMicButton();

  const sendButton = getSendButton();
  const newChatBtn = getNewChatBtn();
  const saveButton = getSaveButton();
  const pushToGithubButton = getPushToGithubButton();
  const githubTokenInput = getGithubTokenInput();
  const githubRepoInput = getGithubRepoInput();

  if (saveButton) saveButton.addEventListener("click", saveCurrentChat);
  if (pushToGithubButton)
    pushToGithubButton.addEventListener("click", pushToGithub);

  if (githubTokenInput) {
    githubTokenInput.addEventListener("input", () => {
      githubToken = githubTokenInput.value;
      localStorage.setItem("githubToken", githubToken);
    });
  }

  if (githubRepoInput) {
    githubRepoInput.addEventListener("input", () => {
      githubRepo = githubRepoInput.value;
      localStorage.setItem("githubRepo", githubRepo);
    });
  }

  if (sendButton) {
    sendButton.addEventListener("click", () => {
      sendMessage(userInput.value.trim());
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener("click", startNewChat);
  }

  if (userInput) {
    userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(userInput.value.trim());
      }
    });
    userInput.addEventListener("input", adjustTextareaHeight);
  }

  if (apiKeyInput) {
    apiKeyInput.addEventListener("input", () => {
      localStorage.setItem("apiKey", apiKeyInput.value);
    });
  }

  if (deepgramApiKeyInput) {
    deepgramApiKeyInput.addEventListener("input", () => {
      localStorage.setItem("deepgramApiKey", deepgramApiKeyInput.value);
    });
  }

  if (micButton) {
    micButton.addEventListener("click", handleMicButtonClick);
  }
  const themeToggle = getThemeToggle();
  if (themeToggle) {
    themeToggle.addEventListener("change", toggleTheme);
  }
};

// Load saved data from localStorage
const loadSavedData = () => {
  const savedApiKey = localStorage.getItem("apiKey");
  if (savedApiKey && apiKeyInput) apiKeyInput.value = savedApiKey;

  const savedDeepgramApiKey = localStorage.getItem("deepgramApiKey");
  if (savedDeepgramApiKey && deepgramApiKeyInput)
    deepgramApiKeyInput.value = savedDeepgramApiKey;

  const savedChatsJson = localStorage.getItem("savedChats");
  if (savedChatsJson) {
    savedChats = JSON.parse(savedChatsJson);
    updateSavedChatsList();
    initializeTheme();
  }

  githubToken = localStorage.getItem("githubToken") || "";
  githubRepo = localStorage.getItem("githubRepo") || "";
  if (githubTokenInput) githubTokenInput.value = githubToken;
  if (githubRepoInput) githubRepoInput.value = githubRepo;
};

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  loadSavedData();
  adjustTextareaHeight();
  initializeTheme();
});

// Make handleSendMessage globally accessible
window.handleSendMessage = () => sendMessage(userInput.value.trim());
