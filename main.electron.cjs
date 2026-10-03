const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const waitOn = require('wait-on');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let serverProcess;

function startServer() {
  // Start the Express server
  // In production, we'll use the bundled dist/server.cjs
  // In development, we use tsx server.ts
  const serverPath = isDev 
    ? path.join(__dirname, 'server.ts')
    : path.join(process.resourcesPath, 'app', 'dist', 'server.cjs');

  const cmd = isDev ? 'npx' : 'node';
  const args = isDev ? ['tsx', serverPath] : [serverPath];

  serverProcess = spawn(cmd, args, {
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "Nexus System - Desktop",
    backgroundColor: '#020617'
  });

  // Use wait-on to ensure the server is ready before loading
  waitOn({ resources: ['http://localhost:3000'], timeout: 10000 })
    .then(() => {
      mainWindow.loadURL('http://localhost:3000');
    })
    .catch((err) => {
      console.error('Failed to wait for server:', err);
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
  });
}

app.on('ready', () => {
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  if (serverProcess) serverProcess.kill();
});
