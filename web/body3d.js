/**
 * body3d.js — Three.js 3D body scan viewer for Mission Vitals
 *
 * Loads the OBJ/MTL body scan, centers + scales it, then overlays
 * transparent health-zone spheres that turn amber/red based on domain status.
 * Call body3d.updateStatus(domainStatusMap) whenever health data changes.
 *
 * Uses Three.js r158 from CDN (loaded via importmap in index.html).
 */

import * as THREE from 'three';
import { OBJLoader }  from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader }  from 'three/addons/loaders/MTLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Zone definitions ─────────────────────────────────────────────────────────
// Positions are in normalized model space (after bounding-box centering).
// Y axis = up. These are tuned for a standing-upright human scan.
// Each zone maps to a health domain and shows improvements on status > 0.
const ZONES = [
  {
    id: 'beh',
    label: 'Mind & Mood',
    // head region — top ~15% of body height
    anchorFrac: { x: 0, yFrac: 0.88, z: 0 },
    radius: 0.07,
    improvements: [
      '😴 Follow sleep wind-down: dim lights 1 hr before rest',
      '📞 Schedule crew social or private ground call',
      '🧘 10-min mindfulness or breathing exercise',
      '📓 Log mood & stress daily for trend tracking',
    ],
  },
  {
    id: 'car',
    label: 'Cardiovascular',
    // upper chest / heart
    anchorFrac: { x: -0.05, yFrac: 0.68, z: 0.04 },
    radius: 0.09,
    improvements: [
      '💧 Drink 500 ml water and rest for 30 min',
      '❤️ Measure resting HR again tomorrow morning',
      '🚴 Add light aerobic session if cleared by protocol',
      '📊 Check blood pressure; note dizziness or head fullness',
    ],
  },
  {
    id: 'imm',
    label: 'Immune System',
    // lower torso / abdomen (whole-body but anchored centrally)
    anchorFrac: { x: 0, yFrac: 0.55, z: 0.03 },
    radius: 0.11,
    improvements: [
      '🌡️ Log temperature every 6 hours',
      '💧 Increase water intake; reduce workload',
      '🤧 Distance from crew if fever or cough present',
      '📋 Crew medical officer: record full vitals & symptoms',
    ],
  },
  {
    id: 'msk',
    label: 'Bone & Muscle',
    // upper arm / shoulder region
    anchorFrac: { x: 0.22, yFrac: 0.70, z: 0 },
    radius: 0.07,
    improvements: [
      '🏋️ Return to full resistive exercise plan immediately',
      '📝 Log every session — trend accuracy depends on it',
      '🥗 Maintain high-protein nutrition score (>7/10)',
      '🩺 Report back pain or grip loss to crew medical officer',
    ],
  },
  {
    id: 'env',
    label: 'Habitat Air (CO₂)',
    // lung overlay — mid-chest bilateral (use a wider, lower zone)
    anchorFrac: { x: 0.08, yFrac: 0.72, z: 0.02 },
    radius: 0.065,
    improvements: [
      '🌬️ Check CO₂ scrubbers and fan operation immediately',
      '🚶 Move to best-ventilated module in habitat',
      '📋 Log headache, fatigue or slowed thinking symptoms',
      '🚨 Alert crew; follow CO₂ alarm checklist',
    ],
  },
  {
    id: 'rad',
    label: 'Radiation',
    // full-body aura — place near shoulders as a wide zone
    anchorFrac: { x: 0, yFrac: 0.80, z: 0 },
    radius: 0.14,
    improvements: [
      '🛡️ Move to storm shelter; minimise open-area exposure',
      '⏱️ Log time in shielded vs unshielded modules',
      '🔍 Monitor for nausea, skin redness, fatigue over 48 h',
      '📡 Contact ground immediately during active SPE',
    ],
  },
];

// ── Colours ───────────────────────────────────────────────────────────────────
const COLOR_OK    = new THREE.Color(0x3ecf84);  // green — normal
const COLOR_WARN  = new THREE.Color(0xf5be45);  // amber — watch
const COLOR_BAD   = new THREE.Color(0xff4444);  // red   — act
const COLOR_LEARN = new THREE.Color(0x5ca8ff);  // blue  — learning

// ── Module state ──────────────────────────────────────────────────────────────
let renderer, scene, camera, controls, body, zoneMeshes = {}, animId;
let modelHeight = 1; // set after load
let onZoneClick = null;

// ── Init ──────────────────────────────────────────────────────────────────────
export function initBody3D(canvas, onZoneClickCb) {
  onZoneClick = onZoneClickCb;

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  resize();

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
  camera.position.set(0, 0.5, 2.8);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(1, 2, 2);
  sun.castShadow = true;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x8ab4f8, 0.4);
  fill.position.set(-2, 0, -1);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(0, -1, -2);
  scene.add(rim);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.5;
  controls.maxDistance = 6;
  controls.target.set(0, 0.3, 0);

  // Resize observer
  new ResizeObserver(resize).observe(canvas.parentElement);

  // Load model
  loadModel();

  // Animate
  animate();
}

function resize() {
  if (!renderer) return;
  const c = renderer.domElement;
  const w = c.parentElement ? c.parentElement.clientWidth  : 500;
  const h = c.parentElement ? c.parentElement.clientHeight : 700;
  renderer.setSize(w, h, false);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function loadModel() {
  const mtlLoader = new MTLLoader();
  mtlLoader.setPath('model/');
  mtlLoader.load('body.mtl', (materials) => {
    materials.preload();

    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.setPath('model/');
    objLoader.load(
      'body.obj',
      (obj) => onModelLoaded(obj),
      (xhr) => {
        const pct = xhr.loaded && xhr.total ? Math.round((xhr.loaded / xhr.total) * 100) : '…';
        const el = document.getElementById('body3d-status');
        if (el) el.textContent = `Loading 3D scan… ${pct}%`;
      },
      (err) => {
        console.error('OBJ load error', err);
        const el = document.getElementById('body3d-status');
        if (el) el.textContent = 'Could not load 3D model.';
      }
    );
  });
}

function onModelLoaded(obj) {
  // Hide status text
  const el = document.getElementById('body3d-status');
  if (el) el.style.display = 'none';

  // Centre + normalise scale
  const box = new THREE.Box3().setFromObject(obj);
  const size   = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  modelHeight  = size.y;

  const scale = 1.6 / modelHeight;          // fit to ~1.6 units tall
  obj.scale.setScalar(scale);
  obj.position.sub(centre.multiplyScalar(scale));  // re-centre
  obj.position.y -= 0.05;                   // slight nudge so feet touch "ground"

  obj.traverse(child => {
    if (child.isMesh) {
      child.castShadow    = true;
      child.receiveShadow = true;
      child.userData.isBody = true;
    }
  });

  scene.add(obj);
  body = obj;

  // Build zone overlays
  buildZones(scale, centre, size);
}

function buildZones(modelScale, origCentre, origSize) {
  // origCentre was the pre-scale centre; after scaling + recentering the
  // model is centred at (0, 0, 0) with Y from ~ -0.8 to +0.8.
  const H = 1.6; // normalised height

  ZONES.forEach(zone => {
    const yPos = -H / 2 + zone.anchorFrac.yFrac * H;
    const r    = zone.radius;

    // Outer glow sphere (transparent)
    const geo  = new THREE.SphereGeometry(r, 32, 32);
    const mat  = new THREE.MeshBasicMaterial({
      color: COLOR_LEARN,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(zone.anchorFrac.x, yPos, zone.anchorFrac.z + 0.08);
    mesh.userData.zoneId = zone.id;
    mesh.userData.isZone = true;
    scene.add(mesh);

    // Inner ring (wireframe outline)
    const wireMat = new THREE.MeshBasicMaterial({
      color: COLOR_LEARN,
      transparent: true,
      opacity: 0.55,
      wireframe: true,
    });
    const wire = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 16, 16), wireMat);
    wire.position.copy(mesh.position);
    wire.userData.isZoneWire = true;
    scene.add(wire);

    zoneMeshes[zone.id] = { mesh, wire, status: -1, t: 0 };
  });

  // Raycasting for click
  renderer.domElement.addEventListener('click', onCanvasClick);
  renderer.domElement.addEventListener('mousemove', onCanvasHover);
}

// ── Status update (called from app.js) ───────────────────────────────────────
export function updateStatus(domainStatusMap) {
  // domainStatusMap: { imm: 0|1|2|-1, car: ..., ... }
  ZONES.forEach(zone => {
    const entry = zoneMeshes[zone.id];
    if (!entry) return;
    const s = domainStatusMap[zone.id] ?? -1;
    entry.status = s;
    const color = s === -1 ? COLOR_LEARN : s === 0 ? COLOR_OK : s === 1 ? COLOR_WARN : COLOR_BAD;
    entry.mesh.material.color.set(color);
    entry.wire.material.color.set(color);
    entry.mesh.material.opacity = s <= 0 ? 0.12 : 0.28;
    entry.wire.material.opacity = s <= 0 ? 0.35 : 0.65;
  });
}

// ── Raycasting ───────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();
let   hoveredZone = null;

function getMouseNDC(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top)   / rect.height)  * 2 + 1;
}

function onCanvasClick(e) {
  getMouseNDC(e);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(
    ZONES.map(z => zoneMeshes[z.id]?.mesh).filter(Boolean)
  );
  if (hits.length && onZoneClick) {
    onZoneClick(hits[0].object.userData.zoneId);
  }
}

function onCanvasHover(e) {
  getMouseNDC(e);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(
    ZONES.map(z => zoneMeshes[z.id]?.mesh).filter(Boolean)
  );
  const zone = hits.length ? hits[0].object.userData.zoneId : null;

  if (zone !== hoveredZone) {
    hoveredZone = zone;
    renderer.domElement.style.cursor = zone ? 'pointer' : 'grab';
    // scale up hovered zone
    ZONES.forEach(z => {
      const e = zoneMeshes[z.id];
      if (!e) return;
      const s = z.id === zone ? 1.25 : 1.0;
      e.mesh.scale.setScalar(s);
      e.wire.scale.setScalar(s);
    });
  }
}

// ── Animation loop ────────────────────────────────────────────────────────────
let clock = new THREE.Clock();

function animate() {
  animId = requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // Pulse act-status zones
  ZONES.forEach(zone => {
    const entry = zoneMeshes[zone.id];
    if (!entry) return;
    entry.t = (entry.t || 0) + dt;
    if (entry.status === 2) {
      // pulsing opacity for "Act" zones
      entry.mesh.material.opacity = 0.22 + 0.18 * Math.sin(entry.t * 3.5);
      entry.wire.material.opacity = 0.55 + 0.30 * Math.sin(entry.t * 3.5);
    } else if (entry.status === 1) {
      entry.mesh.material.opacity = 0.16 + 0.08 * Math.sin(entry.t * 2.0);
    }
  });

  controls.update();
  renderer.render(scene, camera);
}

export function disposeBody3D() {
  cancelAnimationFrame(animId);
  renderer?.dispose();
}
