// Setup Twind

  let chatHistory, userInput, apiKeyInput, modelSelect;
  
  function adjustTextareaHeight() {
      if (userInput) {
          userInput.style.height = 'auto';
          userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
      }
  }
  
  function formatMessage(message) {
      const formattedMessage = marked.parse(message);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = formattedMessage;
      wrapper.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
      });
      return wrapper.innerHTML;
  }
  
  function addMessageToChat(sender, message, className) {
      const messageDiv = document.createElement("div");
      messageDiv.style.padding = "10px";
      messageDiv.style.marginBottom = "10px";
      messageDiv.style.borderRadius = "10px";
      
      const senderSpan = document.createElement("span");
      senderSpan.textContent = `${sender}: `;
      senderSpan.style.fontWeight = "bold";
      messageDiv.appendChild(senderSpan);
  
      const contentDiv = document.createElement("div");
      contentDiv.innerHTML = formatMessage(message);
      messageDiv.appendChild(contentDiv);
  
      chatHistory.appendChild(messageDiv);
      chatHistory.scrollTop = chatHistory.scrollHeight;
  }
  
  async function sendMessage(message) {
      const apiKey = apiKeyInput.value.trim();
      const selectedModel = modelSelect.value;
  
      if (!apiKey) {
          alert("Please enter your API key.");
          return;
      }
  
      if (!message) return;
  
      addMessageToChat("You", message, "user-message");
  
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
                      { role: "system", content: "You are a helpful assistant. Use Markdown formatting for code blocks and structured text." },
                      { role: "user", content: message },
                  ],
                  max_tokens: 2048,
              }),
          });
  
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
  
          const data = await response.json();
          const responseText = data.choices[0].message.content;
  
          addMessageToChat("AI", responseText, "ai-message");
  
      } catch (error) {
          console.error("Error:", error);
          alert("An error occurred while fetching the response. Please check your API key and try again.");
      }
  }
  
  function handleSendMessage() {
      console.log("handleSendMessage called");  // Debug log
      if (userInput) {
          const message = userInput.value.trim();
          if (message) {
              sendMessage(message);
              userInput.value = "";
              adjustTextareaHeight();
          }
      } else {
          console.error("userInput is not defined");
      }
  }
  
  function initializeEventListeners() {
    chatHistory = document.getElementById("chat-history");
    userInput = document.getElementById("user-input");
    apiKeyInput = document.getElementById("api-key");
    modelSelect = document.getElementById("model-select");
    const sendButton = document.getElementById("send-button");
    const newChatBtn = document.querySelector(".new-chat-btn");

    // Load API key from localStorage
    const savedApiKey = localStorage.getItem("apiKey");
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    if (sendButton) {
        console.log("Send button found");  // Debug log
        sendButton.addEventListener("click", function() {
            console.log("Send button clicked");  // Debug log
            handleSendMessage();
        });
    } else {
        console.error("Send button not found");
    }

    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            chatHistory.innerHTML = "";
        });
    }

    if (userInput) {
        userInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        userInput.addEventListener('input', adjustTextareaHeight);
    }

    // Save API key to localStorage when it changes
    if (apiKeyInput) {
        apiKeyInput.addEventListener("input", () => {
            localStorage.setItem("apiKey", apiKeyInput.value);
        });
    }
}
  // Wait for the DOM to be fully loaded before initializing
  document.addEventListener("DOMContentLoaded", () => {
      initializeEventListeners();
      adjustTextareaHeight();
  });
  
  // Make handleSendMessage globally accessible
  window.handleSendMessage = handleSendMessage;