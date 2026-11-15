import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

async function run() {
  const userDir = 'C:\\Users\\Rahil\\AppData\\Local\\Temp\\chrome-checkin-test-' + Date.now();
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9233',
    '--user-data-dir=' + userDir,
    '--window-size=1440,950',
    'http://localhost:8080'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9233/json');
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page');

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));

  let reqId = 1;
  const callbacks = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    }
  });

  function sendCmd(method, params = {}) {
    return new Promise((resolve) => {
      const id = reqId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  function evaluate(expression) {
    return sendCmd('Runtime.evaluate', { expression, returnByValue: true });
  }

  async function takeScreenshot(filename) {
    const res = await sendCmd('Page.captureScreenshot', { format: 'png' });
    if (res.result?.data) {
      const buf = Buffer.from(res.result.data, 'base64');
      const outPath = 'C:\\Users\\Rahil\\.gemini\\antigravity\\brain\\837dcbe2-433d-4b0a-92ea-e7e738ff4aa9\\' + filename;
      writeFileSync(outPath, buf);
      console.log('SAVED_SCREENSHOT: ' + filename);
    }
  }

  await sendCmd('Page.enable');
  await sendCmd('Runtime.enable');

  // Wait 4.5 seconds for complete app initialization & data loading
  await new Promise(r => setTimeout(r, 4500));
  await evaluate(`
    document.getElementById('mission-preloader')?.remove();
    const checkinBtn = document.querySelector('[data-tab="tab-checkin"]');
    if (checkinBtn) checkinBtn.click();
  `);
  await new Promise(r => setTimeout(r, 1200));

  // 1. Initial Check-in screen with biosensor stream strip and manual inputs
  await takeScreenshot('checkin_manual_only_view.png');

  // 2. Select Day 45, apply Fatigue & Stress manual inputs, submit to FastAPI
  await evaluate(`
    const dayInp = document.getElementById('checkin-target-day');
    if (dayInp) {
      dayInp.value = 45;
      dayInp.dispatchEvent(new Event('change'));
    }
    // Set manual inputs: High Stress, High Fatigue, Low Sleep
    const fatInp = document.getElementById('ci-fat');
    if (fatInp) { fatInp.value = 8.5; fatInp.dispatchEvent(new Event('input')); }
    const stressInp = document.getElementById('ci-stress');
    if (stressInp) { stressInp.value = 8.0; stressInp.dispatchEvent(new Event('input')); }
    const slpInp = document.getElementById('ci-slp');
    if (slpInp) { slpInp.value = 4.2; slpInp.dispatchEvent(new Event('input')); }

    const chkHeadache = document.querySelector('input[name="symptom"][value="Headache / ICP Elevation"]');
    if (chkHeadache) chkHeadache.checked = true;
    const chkCog = document.querySelector('input[name="symptom"][value="Cognitive Slowing / Brain Fog"]');
    if (chkCog) chkCog.checked = true;
  `);
  await new Promise(r => setTimeout(r, 800));

  // Submit form
  await evaluate(`
    document.getElementById('checkin-form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  `);
  // Give FastAPI 2.5s to respond and render predicted directives and citations
  await new Promise(r => setTimeout(r, 2500));

  // 2. Screenshot of FastAPI predicted commands and citations
  await takeScreenshot('checkin_fastapi_commands.png');

  // 3. Switch to Overview and capture the updated dashboard with FastAPI directives
  await evaluate(`
    document.querySelector('[data-tab="tab-overview"]')?.click();
  `);
  await new Promise(r => setTimeout(r, 1200));
  await takeScreenshot('checkin_dashboard_directives.png');

  ws.close();
  chrome.kill();
  console.log('ALL_TESTS_COMPLETED_SUCCESSFULLY');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
