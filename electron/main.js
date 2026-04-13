const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");

// Vite 開発サーバー URL（開発時）
const DEV_URL = "http://localhost:5173/making_timetable/";

// Python バックエンドのポート
const PYTHON_PORT = 8000;

// 起動した Python プロセスの参照（終了時に kill するため）
let pythonProcess = null;

// ------------------------------------------------------------------ //
// Python バックエンド起動
// ------------------------------------------------------------------ //
function startPythonServer() {
  // uv の検索パス候補（Windows / macOS / Linux）
  const uvCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.USERPROFILE || "", ".local", "bin", "uv.exe"),
          path.join(process.env.LOCALAPPDATA || "", "uv", "bin", "uv.exe"),
          "uv", // PATH に入っていれば通る
        ]
      : [
          path.join(process.env.HOME || "", ".local", "bin", "uv"),
          "/usr/local/bin/uv",
          "uv",
        ];

  const pythonDir = path.join(__dirname, "..", "desktop", "python");
  const serverScript = path.join(pythonDir, "server.py");

  // uv run server.py を実行（uv が仮想環境を自動管理）
  const tryStart = (idx) => {
    if (idx >= uvCandidates.length) {
      console.error(
        "[Electron] uv コマンドが見つかりませんでした。OR-Tools モードは手動起動が必要です。",
      );
      return;
    }

    const uv = uvCandidates[idx];
    console.log(
      `[Electron] Python サーバー起動試行: ${uv} run ${serverScript}`,
    );

    const proc = spawn(uv, ["run", serverScript], {
      cwd: pythonDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (d) => console.log("[Python]", d.toString().trim()));
    proc.stderr.on("data", (d) => console.log("[Python]", d.toString().trim()));

    proc.on("error", () => {
      // このパスで失敗 → 次の候補へ
      tryStart(idx + 1);
    });

    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[Electron] Python サーバーが終了しました (code=${code})`);
      }
    });

    pythonProcess = proc;
  };

  tryStart(0);
}

// ------------------------------------------------------------------ //
// ポートが使用可能（サーバー起動済み）か確認
// ------------------------------------------------------------------ //
function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const s = net.createConnection(port, "127.0.0.1");
      s.on("connect", () => {
        s.destroy();
        resolve();
      });
      s.on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error("timeout"));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

// ------------------------------------------------------------------ //
// ウィンドウ生成
// ------------------------------------------------------------------ //
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // デモ用暫定。本番化時は preload.js で安全化すること
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    mainWindow.loadURL(DEV_URL);
    // mainWindow.webContents.openDevTools();
  }
}

// ------------------------------------------------------------------ //
// アプリ起動
// ------------------------------------------------------------------ //
app.whenReady().then(async () => {
  // Python サーバーをバックグラウンドで起動
  startPythonServer();

  // ウィンドウはすぐ表示（サーバー起動完了を待たない）
  createWindow();

  // サーバーが 30 秒以内に応答しなければコンソールにログだけ出す
  waitForPort(PYTHON_PORT, 30000)
    .then(() =>
      console.log(
        `[Electron] Python サーバーが :${PYTHON_PORT} で起動しました`,
      ),
    )
    .catch(() =>
      console.warn(
        `[Electron] Python サーバーが :${PYTHON_PORT} で起動しませんでした（OR-Tools モードは使えません）`,
      ),
    );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ------------------------------------------------------------------ //
// アプリ終了時に Python プロセスも終了させる
// ------------------------------------------------------------------ //
app.on("window-all-closed", () => {
  if (pythonProcess) {
    console.log("[Electron] Python サーバーを終了します");
    pythonProcess.kill();
    pythonProcess = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
});
