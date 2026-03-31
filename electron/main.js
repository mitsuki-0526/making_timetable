const { app, BrowserWindow } = require('electron');
const path = require('path');

// Viteの開発サーバーURL（開発時）
const DEV_URL = 'http://localhost:5173/making_timetable/';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // 今回はシンプルなデモ構築のためfalseを許容（セキュアにする場合はpreload利用推奨）
    },
  });

  // 開発時とビルド後（exe）で読み込むファイルを変える
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL(DEV_URL);
    // mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
