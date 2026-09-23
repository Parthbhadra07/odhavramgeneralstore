const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const url = require("url");

// Enable Web Bluetooth and experimental web features in Chromium for desktop BLE printer pairing
app.commandLine.appendSwitch("enable-web-bluetooth");
app.commandLine.appendSwitch("enable-experimental-web-platform-features");

let mainWindow = null;
let localServer = null;
let selectBluetoothCallback = null;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function getOutDirectory() {
  const possiblePaths = [
    path.join(__dirname, "../out"),
    path.join(process.resourcesPath || "", "out"),
    path.join(app.getAppPath(), "out"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, "../out");
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
  });
  stream.pipe(res);
}

function startInternalServer() {
  return new Promise((resolve) => {
    const outDir = getOutDirectory();

    localServer = http.createServer((req, res) => {
      try {
        const parsedUrl = url.parse(req.url);
        let pathname = decodeURIComponent(parsedUrl.pathname || "/");

        if (pathname === "/") {
          pathname = "/admin/pos/";
        }

        let filePath = path.join(outDir, pathname);

        // Check if exact file exists
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          serveFile(res, filePath);
          return;
        }

        // Check if index.html exists in subdirectory
        const indexFile = path.join(filePath, "index.html");
        if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
          serveFile(res, indexFile);
          return;
        }

        // Check with .html extension
        const htmlFile = filePath.replace(/\/$/, "") + ".html";
        if (fs.existsSync(htmlFile) && fs.statSync(htmlFile).isFile()) {
          serveFile(res, htmlFile);
          return;
        }

        // Fallback to POS index for client-side navigation
        const posFallback = path.join(outDir, "admin/pos/index.html");
        if (fs.existsSync(posFallback)) {
          serveFile(res, posFallback);
          return;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("File Not Found");
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Internal Server Error: ${err.message}`);
      }
    });

    // Listen on dynamic available port on 127.0.0.1 (zero port collisions!)
    localServer.listen(0, "127.0.0.1", () => {
      const port = localServer.address().port;
      console.log(`[Electron] Self-contained POS server running on http://127.0.0.1:${port}`);
      resolve(`http://127.0.0.1:${port}/admin/pos/`);
    });
  });
}

function buildApplicationMenu() {
  const template = [
    {
      label: "POS",
      submenu: [
        {
          label: "Quick POS Billing",
          accelerator: "CmdOrCtrl+1",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(
                `window.location.href = "/admin/pos/";`
              );
            }
          },
        },
        {
          label: "Dashboard",
          accelerator: "CmdOrCtrl+D",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(
                `window.location.href = "/admin/";`
              );
            }
          },
        },
        { type: "separator" },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (mainWindow) mainWindow.reload();
          },
        },
        {
          label: "Exit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "Printer",
      submenu: [
        {
          label: "Printer & POS Settings...",
          accelerator: "CmdOrCtrl+P",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("open-printer-settings");
            }
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    title: "Odhavram General Store - POS Desktop",
    icon: path.join(__dirname, "../src/app/favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
    autoHideMenuBar: false,
    backgroundColor: "#f8fafc",
  });

  mainWindow.maximize();

  // Intercept Web Bluetooth device selection requests
  mainWindow.webContents.on("select-bluetooth-device", (event, deviceList, callback) => {
    event.preventDefault();
    selectBluetoothCallback = callback;
    // Send list of discovered devices to renderer to display popup UI
    mainWindow.webContents.send("bluetooth-device-list", deviceList);
  });

  // Automatically handle Bluetooth PIN confirmation for thermal printers
  if (mainWindow.webContents.session.setBluetoothPairingHandler) {
    mainWindow.webContents.session.setBluetoothPairingHandler((details, callback) => {
      if (details.pairingKind === "confirm" || details.pairingKind === "confirmPin") {
        callback({ confirmed: true });
      } else if (details.pairingKind === "providePin") {
        callback({ confirmed: true, pin: "0000" });
      } else {
        callback({ confirmed: true });
      }
    });
  }

  let startUrl = process.env.ELECTRON_START_URL;
  if (!startUrl) {
    // Completely self-contained: start internal zero-configuration server
    startUrl = await startInternalServer();
  }

  mainWindow.loadURL(startUrl).catch((err) => {
    console.error("[Electron] Failed to load URL:", err);
  });

  mainWindow.on("closed", () => {
    if (selectBluetoothCallback) {
      try {
        selectBluetoothCallback("");
      } catch {}
      selectBluetoothCallback = null;
    }
    mainWindow = null;
  });
}

// IPC handler when user selects a Bluetooth device from the popup UI
ipcMain.on("select-bluetooth-device", (_event, deviceId) => {
  if (selectBluetoothCallback) {
    selectBluetoothCallback(deviceId || "");
    selectBluetoothCallback = null;
  }
});

// IPC handler when user cancels Bluetooth device selection
ipcMain.on("cancel-bluetooth-device", () => {
  if (selectBluetoothCallback) {
    selectBluetoothCallback("");
    selectBluetoothCallback = null;
  }
});

// IPC handler to list connected printers (thermal / laser)
ipcMain.handle("get-printers", async () => {
  if (!mainWindow) return [];
  return mainWindow.webContents.getPrintersAsync();
});

// IPC handler for silent thermal receipt printing
ipcMain.handle("print-silent", async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: "No window available" };
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options.silent ?? true,
        printBackground: true,
        deviceName: options.deviceName || "",
        pageSize: options.pageSize || { width: 80000, height: 297000 },
        margins: { marginType: "none" },
      },
      (success, failureReason) => {
        if (!success) {
          resolve({ success: false, error: failureReason });
        } else {
          resolve({ success: true });
        }
      }
    );
  });
});

app.whenReady().then(() => {
  buildApplicationMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (localServer) {
    try {
      localServer.close();
    } catch {}
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

