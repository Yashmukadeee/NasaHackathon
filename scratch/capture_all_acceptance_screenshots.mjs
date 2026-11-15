import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\Rahil\\.gemini\\antigravity\\brain\\837dcbe2-433d-4b0a-92ea-e7e738ff4aa9';

async function runCapture() {
  const userDir = 'C:\\Users\\Rahil\\AppData\\Local\\Temp\\chrome-acceptance-' + Date.now();
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9235',
    '--user-data-dir=' + userDir,
    '--window-size=1600,1050',
    'http://localhost:8080'
  ]);

  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch('http://127.0.0.1:9235/json');
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page');

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));

  let reqId = 1;
  const pendingRequests = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pendingRequests.has(msg.id)) {
      const cb = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      cb(msg.result);
    }
  });

  function sendCmd(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++reqId;
      pendingRequests.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await sendCmd('Runtime.evaluate', { expression, awaitPromise: true });
    return res?.result?.value;
  }

  async function takeScreenshot(fileName) {
    const res = await sendCmd('Page.captureScreenshot', { format: 'png' });
    if (res?.data) {
      const buf = Buffer.from(res.data, 'base64');
      const outPath = `${ARTIFACT_DIR}\\${fileName}`;
      writeFileSync(outPath, buf);
      console.log(`CAPTURED: ${fileName} -> ${outPath}`);
    }
  }

  await sendCmd('Page.enable');
  await sendCmd('Runtime.enable');

  // 1. Wait for preloader dismissal (4.5s)
  console.log('Waiting for preloader and initialization...');
  await new Promise(r => setTimeout(r, 4500));

  // Screenshot 1: Overview Flight Deck
  console.log('Taking Screenshot 1: Overview Flight Deck');
  await takeScreenshot('audit_01_dark_header_and_twin.png');

  // Screenshot 2: Click Heart Hotspot to open Organ Inspector
  console.log('Clicking Heart Hotspot to open Organ Inspector Drawer...');
  await evaluate(`
    (() => {
      const el = document.getElementById('hotspot-heart') || document.querySelector('.twin-callout.heart');
      if (el) el.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 1200));
  await takeScreenshot('audit_02_organ_inspector_drawer.png');

  // Close Organ Inspector
  await evaluate(`document.getElementById('organ-inspector-close')?.click()`);
  await new Promise(r => setTimeout(r, 400));

  // Screenshot 3: Telemetry Matrix
  console.log('Navigating to Telemetry Matrix...');
  await evaluate(`document.querySelector('[data-tab="tab-telemetry"]')?.click()`);
  await new Promise(r => setTimeout(r, 1200));
  await takeScreenshot('audit_03_telemetry_matrix.png');

  // Screenshot 4: Daily Check-In
  console.log('Navigating to Daily Check-in...');
  await evaluate(`document.querySelector('[data-tab="tab-checkin"]')?.click()`);
  await new Promise(r => setTimeout(r, 1200));
  await takeScreenshot('audit_04_daily_checkin.png');

  // Screenshot 5: Ground Transmission
  console.log('Navigating to Ground Transmission...');
  await evaluate(`document.querySelector('[data-tab="tab-data"]')?.click()`);
  await new Promise(r => setTimeout(r, 1200));
  await takeScreenshot('audit_05_ground_transmission.png');

  console.log('All 5 acceptance screenshots captured successfully!');
  ws.close();
  chrome.kill();
  process.exit(0);
}

runCapture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
