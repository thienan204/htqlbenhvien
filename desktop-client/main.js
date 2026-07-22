const { app, Tray, Menu, Notification, shell, dialog } = require('electron');
const path = require('path');
const EventSource = require('eventsource');
const fs = require('fs');

let tray = null;
let eventSource = null;
const configPath = path.join(app.getPath('userData'), 'server-config.json');

// Default server (fallback)
let serverUrl = 'http://192.168.3.98:3005/htqlbenhvien';
let maKhoa = '';

function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.serverUrl) {
        serverUrl = data.serverUrl;
      }
      if (data.maKhoa) {
        maKhoa = data.maKhoa;
      }
    } catch (e) {
      console.error('Error reading config', e);
    }
  }
}

function saveConfig(url, khoa) {
  serverUrl = url;
  maKhoa = khoa;
  fs.writeFileSync(configPath, JSON.stringify({ serverUrl, maKhoa }));
}

function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  // Ensure URL format
  let streamUrl = serverUrl;
  if (streamUrl.endsWith('/')) streamUrl = streamUrl.slice(0, -1);
  streamUrl += `/api/notifications/stream?ma_khoa=${encodeURIComponent(maKhoa)}`;

  console.log('Connecting to SSE:', streamUrl);
  eventSource = new EventSource(streamUrl);

  eventSource.onopen = () => {
    console.log('Connected to server!');
    tray.setToolTip(`HTQL Bệnh Viện (Đã kết nối)\nKhoa: ${maKhoa || 'Chưa cấu hình'}\nServer: ${serverUrl}`);
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.eventCode === 'CONNECTED') return;

      console.log('Received notification:', data);

      const notification = new Notification({
        title: data.title || 'Thông báo mới',
        body: data.body || '',
      });

      notification.on('click', () => {
        let openUrl = serverUrl;
        if (data.url) {
          openUrl = openUrl + (data.url.startsWith('/') ? data.url : `/${data.url}`);
        }
        shell.openExternal(openUrl);
      });

      notification.show();
    } catch (error) {
      console.error('Error parsing notification data:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    tray.setToolTip(`HTQL Bệnh Viện (Mất kết nối)\nKhoa: ${maKhoa || 'Chưa cấu hình'}\nServer: ${serverUrl}`);
    eventSource.close();
    setTimeout(connectSSE, 10000);
  };
}

function promptServerUrl() {
  const { BrowserWindow } = require('electron');
  let win = new BrowserWindow({ width: 400, height: 250, webPreferences: { nodeIntegration: true, contextIsolation: false } });
  win.setMenu(null);
  
  const html = `
    <html>
      <body style="font-family: sans-serif; padding: 20px;">
        <h3>Cài đặt kết nối Hệ thống</h3>
        <label>URL Máy Chủ:</label>
        <input id="url" type="text" value="${serverUrl}" style="width: 100%; padding: 8px; margin-bottom: 10px;" />
        
        <label>Mã Khoa Phòng (Ví dụ: KKB, KCC):</label>
        <input id="maKhoa" type="text" value="${maKhoa}" style="width: 100%; padding: 8px; margin-bottom: 15px;" />
        
        <button onclick="save()" style="padding: 8px 15px; cursor: pointer;">Lưu & Kết nối</button>
        <script>
          const { ipcRenderer } = require('electron');
          function save() {
            const url = document.getElementById('url').value;
            const khoa = document.getElementById('maKhoa').value;
            ipcRenderer.send('save-url', { url, khoa });
          }
        </script>
      </body>
    </html>
  `;
  
  const tempPath = path.join(app.getPath('temp'), 'prompt.html');
  fs.writeFileSync(tempPath, html);
  win.loadFile(tempPath);

  const { ipcMain } = require('electron');
  ipcMain.removeAllListeners('save-url');
  ipcMain.once('save-url', (event, { url, khoa }) => {
    saveConfig(url, khoa);
    win.close();
    connectSSE();
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.bvdklangson.htql');
  }

  loadConfig();

  const { nativeImage } = require('electron');
  const icon = nativeImage.createEmpty(); 

  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Cài đặt Server & Mã Khoa', click: promptServerUrl },
    { label: 'Mở trang web Bệnh Viện', click: () => shell.openExternal(serverUrl) },
    { type: 'separator' },
    { label: 'Thoát', click: () => { app.isQuiting = true; app.quit(); } }
  ]);

  tray.setToolTip('HTQL Bệnh Viện (Đang kết nối...)');
  tray.setContextMenu(contextMenu);

  connectSSE();
});

if (app.dock) {
  app.dock.hide();
}

app.on('window-all-closed', () => {});
