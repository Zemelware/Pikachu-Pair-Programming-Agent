const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let overlayWindow;
let borderWindow;

function createBorderWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  borderWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Make the window click-through
  borderWindow.setIgnoreMouseEvents(true);
  
  borderWindow.loadFile('border.html');
  
  // Keep window always on top but below the overlay window
  borderWindow.setAlwaysOnTop(true, 'screen-saver', 1);
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 300,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  overlayWindow.loadFile('index.html');
  
  // Keep window always on top
  overlayWindow.setAlwaysOnTop(true, 'floating', 2);
  
  // Remove menu bar
  overlayWindow.setMenuBarVisibility(false);
}

// Handle window dragging from renderer process
ipcMain.on('start-drag', (event) => {
  overlayWindow.setBounds({ 
    ...overlayWindow.getBounds(),
  });
});

// Handle border animation state
ipcMain.on('set-border-animated', (event, animated) => {
  if (borderWindow) {
    borderWindow.webContents.send('set-animated', animated);
  }
});

// Handle border toggle (for manual Cmd+B toggle)
ipcMain.on('toggle-border', (event, show) => {
  if (show && !borderWindow) {
    createBorderWindow();
  } else if (!show && borderWindow) {
    borderWindow.close();
    borderWindow = null;
  }
});

// Handle quit
ipcMain.on('quit-app', () => {
  app.quit();
});

app.whenReady().then(() => {
  createBorderWindow();
  createOverlayWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createBorderWindow();
    createOverlayWindow();
  }
});
