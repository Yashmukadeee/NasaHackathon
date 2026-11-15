import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

async function capture() {
  const userDir = 'C:\\Users\\Rahil\\AppData\\Local\\Temp\\chrome-synced-after-' + Date.now();
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9230',
    '--user-data-dir=' + userDir,
    '--window-size=1440,900',
    'http://localhost:8080'
  ]);

  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch('http://127.0.0.1:9230/json');
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page');

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));

  ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  // Wait 4.5 seconds for preloader to dismiss and app-zoom-in to complete
  await new Promise(r => setTimeout(r, 4500));

  ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } }));

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id === 2 && msg.result?.data) {
      const buf = Buffer.from(msg.result.data, 'base64');
      const outPath = 'C:\\Users\\Rahil\\.gemini\\antigravity\\brain\\837dcbe2-433d-4b0a-92ea-e7e738ff4aa9\\synced_ui_cockpit.png';
      writeFileSync(outPath, buf);
      console.log('SYNCED_UI_COCKPIT_SCREENSHOT_CAPTURED');
      ws.close();
      chrome.kill();
      process.exit(0);
    }
  });
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
