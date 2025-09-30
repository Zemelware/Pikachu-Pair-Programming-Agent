const { ipcRenderer } = require('electron');

// Elements
const thoughtBubble = document.getElementById('thought-bubble');
const thoughtText = document.getElementById('thought-text');
const pikachuImg = document.getElementById('pikachu-img');

// Simple API for controlling Pikachu
window.pikachuAPI = {
  // Set to listening state
  setListening: (message = 'pikachu is listening...') => {
    thoughtBubble.classList.remove('working');
    thoughtText.textContent = message;
    pikachuImg.classList.remove('bouncing');
    ipcRenderer.send('set-border-animated', false);
  },
  
  // Set to thinking state
  setThinking: (message = 'pikachu is thinking...') => {
    thoughtBubble.classList.add('working');
    thoughtText.textContent = message;
    pikachuImg.classList.add('bouncing');
    ipcRenderer.send('set-border-animated', true);
  },
  
  // Update message without changing state
  showMessage: (message) => {
    thoughtText.textContent = message;
  }
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.tabKey || e.metaKey) && e.key === 'p') {
    ipcRenderer.send('quit-app');
  }
  
  if ((e.tabKey || e.metaKey) && e.key === 'b') {
    ipcRenderer.send('toggle-border');
  }
});

console.log('Pikachu Agent Ready! ⚡');
console.log('API: setListening(msg), setThinking(msg), showMessage(msg)');