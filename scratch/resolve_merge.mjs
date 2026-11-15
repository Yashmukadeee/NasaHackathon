import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('web/index.html', 'utf8');

// Normalize CRLF to LF temporarily
const hasCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// Resolve Conflict 1
const regex1 = /<<<<<<< HEAD\n\s*<div class="header-pill status-ok" id="header-supabase-pill"[\s\S]*?>>>>>>> origin\/master\n/;
const replacement1 = `        <div class="header-pill status-ok" id="header-supabase-pill" title="Supabase Cloud Database & Realtime">
          <span class="pill-dot"></span>
          <span id="supabase-status-label">Supabase Cloud</span>
        </div>

        <div class="header-pill status-ok" id="header-wearable-pill" title="Astronaut Wearable Hardware Gateway">
          <span class="pill-dot"></span>
          <span id="wearable-status-label">BLE Gateway</span>
        </div>

        <!-- Essential Utilities -->
        <button id="quick-escalate-btn" class="header-action-btn danger" title="Ground Emergency Escalation">GROUND ALERT</button>
        <button id="crew-ripple-btn" class="header-action-btn" title="Compare Crew Biometrics">CREW</button>
        <button id="mute-toggle-btn" class="header-action-btn" title="Toggle Audio Alarms">AUDIO</button>
`;
if (regex1.test(content)) {
  content = content.replace(regex1, replacement1);
  console.log('Regex 1 matched and replaced!');
} else {
  console.log('Regex 1 did not match');
}

// Resolve Conflict 2
const regex2 = /<<<<<<< HEAD\n([\s\S]*?)=======\n\s*<!-- Scientific Research Footer -->\n>>>>>>> origin\/master\n/;
if (regex2.test(content)) {
  content = content.replace(regex2, '$1');
  console.log('Regex 2 matched and replaced!');
} else {
  console.log('Regex 2 did not match');
}

// Restore CRLF if needed
if (hasCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

writeFileSync('web/index.html', content, 'utf8');
console.log('Done!');
