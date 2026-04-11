const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let pythonProcess = null;
let mainWindow = null;

function startPythonServer() {
  const isDev = !app.isPackaged;

  let command, args;
  if (isDev) {
    // 開発時: python コマンドで直接起動
    command = 'python';
    args = [path.join(__dirname, '../python/server.py')];
  } else {
    // パッケージ後: extraResources に同梱した server.py を起動
    command = 'python';
    args = [path.join(process.resourcesPath, 'python', 'server.py')];
  }

  pythonProcess = spawn(command, args, { stdio: 'pipe' });
  pythonProcess.stdout.on('data', (d) => console.log(`[Python] ${d}`));
  pythonProcess.stderr.on('data', (d) => console.error(`[Python ERR] ${d}`));
  pythonProcess.on('close', (code) => console.log(`[Python] process exited: ${code}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  startPythonServer();
  // Python サーバーの起動を待ってからウィンドウを開く
  setTimeout(createWindow, 1500);
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
