import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  remove
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// ==========================================
// 1. FIREBASE REALTIME DATABASE SETUP
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAO2wQwrEGcj1PJ_aKYrU3BFXY-QG6Oi5Y",
  authDomain: "bantahay-1f719.firebaseapp.com",
  databaseURL: "https://bantahay-1f719-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bantahay-1f719",
  storageBucket: "bantahay-1f719.firebasestorage.app",
  messagingSenderId: "628148127965",
  appId: "1:628148127965:web:a19039cb1c55ff3b55b334",
  measurementId: "G-K9QLBX8JB1"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const sensorsRef = ref(db, 'sensors');
const logsRef = ref(db, 'logs');

// ==========================================
// 2. COLOR PALETTE & SIDEBAR UI ELEMENTS
// ==========================================
const PALETTE = {
  cream: 0xEBEBC3,
  mist: 0xADC7C6,
  sageTeal: 0x6E9795,
  oceanTeal: 0x3D838E,
  deepTeal: 0x285963,
  statusOn: 0x22c55e,
  statusOff: 0xef4444
};

const logsListEl = document.getElementById('logs-list');
const logCountEl = document.getElementById('log-count');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const navButtons = document.querySelectorAll('.nav-btn');

let savedLogs = [];

function formatTimestamp(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function renderLogs() {
  if (logCountEl) {
    logCountEl.textContent = savedLogs.length;
  }

  if (!logsListEl) return;

  if (savedLogs.length === 0) {
    logsListEl.innerHTML = '<div class="logs-empty">No activity logged yet.</div>';
    return;
  }

  logsListEl.innerHTML = savedLogs
    .map(
      (log) => `
      <div class="log-entry type-${log.type}">
        <div class="log-top">
          <span class="log-badge">${log.badge}</span>
          <span>${log.time}</span>
        </div>
        <div class="log-message">${log.message}</div>
      </div>
    `
    )
    .join('');
}

// Add log locally immediately AND push to Firebase for cross-device sync
function addLog(badge, message, type = 'sys') {
  const newLog = {
    badge,
    message,
    type, // 'on' | 'off' | 'sys'
    time: formatTimestamp(),
    timestamp: Date.now()
  };

  savedLogs.unshift(newLog);
  if (savedLogs.length > 100) savedLogs.pop();
  renderLogs();

  push(logsRef, newLog).catch((err) => {
    console.error("Failed to sync log to Firebase:", err);
  });
}

// Listen for real-time log updates from other devices
onValue(logsRef, (snapshot) => {
  const raw = snapshot.val();
  if (raw) {
    const cloudLogs = Object.values(raw).sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
    if (cloudLogs.length > 0) {
      savedLogs = cloudLogs;
      renderLogs();
    }
  }
});

if (clearLogsBtn) {
  clearLogsBtn.addEventListener('click', () => {
    savedLogs = [];
    renderLogs();
    remove(logsRef).catch((err) => console.error("Failed to clear Firebase logs:", err));
  });
}

// Left Sidebar Navigation Buttons
navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    addLog('NAV', `Switched view to ${btn.textContent}`, 'sys');
  });
});

renderLogs();

// ==========================================
// 3. THREE.JS SCENE, CAMERA & RENDERER
// ==========================================
const container = document.getElementById('canvas-container');
const labelsContainer = document.getElementById('labels-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.deepTeal);
scene.fog = new THREE.FogExp2(PALETTE.deepTeal, 0.018);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.set(14, 13, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Omnidirectional Mouse / Touch Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 60;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;
controls.target.set(0, 2.5, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(PALETTE.cream, 0.75);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(12, 22, 14);
dirLight.castShadow = true;
scene.add(dirLight);

const accentLight = new THREE.PointLight(PALETTE.cream, 1.2, 18);
accentLight.position.set(0, 4.2, 0);
scene.add(accentLight);

// Ground Reference Grid
const gridHelper = new THREE.GridHelper(36, 36, PALETTE.sageTeal, PALETTE.oceanTeal);
scene.add(gridHelper);

// ==========================================
// 4. BUILD THE 8x8 SLOPED-WALL ROOM (5m to 4m) + 2m OPEN DOOR ON ONE SIDE
// ==========================================
const ROOM_SIZE = 8;
const HEIGHT_LEFT = 5;
const HEIGHT_RIGHT = 4;
const WALL_THICKNESS = 0.2;

const DOOR_WIDTH = 2.0;
const DOOR_HEIGHT = 2.2;
const DOOR_THICKNESS = 0.08;

const roomGroup = new THREE.Group();

const floorMat = new THREE.MeshStandardMaterial({
  color: PALETTE.oceanTeal,
  roughness: 0.85,
  metalness: 0.05
});

const wallMat = new THREE.MeshStandardMaterial({
  color: PALETTE.sageTeal,
  roughness: 0.7,
  metalness: 0.05
});

const doorMat = new THREE.MeshStandardMaterial({
  color: PALETTE.mist,
  roughness: 0.65,
  metalness: 0.08
});

const edgeMat = new THREE.LineBasicMaterial({ color: PALETTE.mist });

function addMeshWithEdges(geometry, material, x = 0, y = 0, z = 0, parent = roomGroup) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const edges = new THREE.EdgesGeometry(geometry);
  const line = new THREE.LineSegments(edges, edgeMat);
  mesh.add(line);

  parent.add(mesh);
  return mesh;
}

// 1. Floor (8m x 0.2m x 8m)
addMeshWithEdges(
  new THREE.BoxGeometry(ROOM_SIZE, WALL_THICKNESS, ROOM_SIZE),
  floorMat,
  0,
  WALL_THICKNESS / 2,
  0
);

// 2. Left Wall (Height = 5m)
addMeshWithEdges(
  new THREE.BoxGeometry(WALL_THICKNESS, HEIGHT_LEFT, ROOM_SIZE),
  wallMat,
  -ROOM_SIZE / 2 + WALL_THICKNESS / 2,
  HEIGHT_LEFT / 2,
  0
);

// 3. Right Wall (Height = 4m)
addMeshWithEdges(
  new THREE.BoxGeometry(WALL_THICKNESS, HEIGHT_RIGHT, ROOM_SIZE),
  wallMat,
  ROOM_SIZE / 2 - WALL_THICKNESS / 2,
  HEIGHT_RIGHT / 2,
  0
);

// 4. Front & Back Sloped Walls (5m -> 4m)
const innerWidth = ROOM_SIZE - WALL_THICKNESS * 2;
const halfInner = innerWidth / 2;

// Solid sloped wall shape (for Back Wall)
const solidSlopedWallShape = new THREE.Shape();
solidSlopedWallShape.moveTo(-halfInner, 0);
solidSlopedWallShape.lineTo(halfInner, 0);
solidSlopedWallShape.lineTo(halfInner, HEIGHT_RIGHT);
solidSlopedWallShape.lineTo(-halfInner, HEIGHT_LEFT);
solidSlopedWallShape.closePath();

const solidSlopedWallGeo = new THREE.ExtrudeGeometry(solidSlopedWallShape, {
  depth: WALL_THICKNESS,
  bevelEnabled: false
});

// Back Wall (-Z) — Solid (no doorway)
const backWallZ = -ROOM_SIZE / 2;
addMeshWithEdges(solidSlopedWallGeo, wallMat, 0, 0, backWallZ);

// Sloped wall shape WITH a 2m doorway opening on the 5m wall side (left side)
const doorWallShape = new THREE.Shape();
doorWallShape.moveTo(-halfInner, 0);
doorWallShape.lineTo(halfInner, 0);
doorWallShape.lineTo(halfInner, HEIGHT_RIGHT);
doorWallShape.lineTo(-halfInner, HEIGHT_LEFT);
doorWallShape.closePath();

const doorLeftX = -halfInner + 0.6;
const doorRightX = doorLeftX + DOOR_WIDTH;
const doorBottomY = WALL_THICKNESS;
const doorTopY = doorBottomY + DOOR_HEIGHT;

const doorHole = new THREE.Path();
doorHole.moveTo(doorLeftX, doorBottomY);
doorHole.lineTo(doorRightX, doorBottomY);
doorHole.lineTo(doorRightX, doorTopY);
doorHole.lineTo(doorLeftX, doorTopY);
doorHole.closePath();
doorWallShape.holes.push(doorHole);

const doorSlopedWallGeo = new THREE.ExtrudeGeometry(doorWallShape, {
  depth: WALL_THICKNESS,
  bevelEnabled: false
});

// Front Wall (+Z) — Has the 2m doorway opening on the 5m side
const frontWallZ = ROOM_SIZE / 2 - WALL_THICKNESS;
addMeshWithEdges(doorSlopedWallGeo, wallMat, 0, 0, frontWallZ);

// 5. Opened Door Leaf hinged at the doorway on the Front Wall (+Z)
const doorPivot = new THREE.Group();
doorPivot.position.set(doorLeftX, doorBottomY, frontWallZ + WALL_THICKNESS / 2);
doorPivot.rotation.y = Math.PI * 0.42;

const doorPanelGeo = new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, DOOR_THICKNESS);
doorPanelGeo.translate(DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0);
addMeshWithEdges(doorPanelGeo, doorMat, 0, 0, 0, doorPivot);

roomGroup.add(doorPivot);

// ==========================================
// 5. INTERACTIVE SENSOR NODES (CLOUD-SYNCED)
// ==========================================
const sensors = {};
const sensorHitboxes = [];

function createSensorNode(id, label, geometry, position, initialOn = true) {
  const nodeGroup = new THREE.Group();
  nodeGroup.position.copy(position);

  // Mounting bracket
  const mountGeo = new THREE.BoxGeometry(0.42, 0.52, 0.42);
  const mountMat = new THREE.MeshStandardMaterial({
    color: PALETTE.deepTeal,
    roughness: 0.6
  });
  const mountMesh = new THREE.Mesh(mountGeo, mountMat);
  nodeGroup.add(mountMesh);

  // Glowing Green/Red core
  const coreMat = new THREE.MeshBasicMaterial({
    color: initialOn ? PALETTE.statusOn : PALETTE.statusOff,
    depthTest: false,
    transparent: true,
    opacity: 0.95
  });
  const coreMesh = new THREE.Mesh(geometry, coreMat);
  coreMesh.renderOrder = 10;
  nodeGroup.add(coreMesh);

  // Wireframe outline
  const edges = new THREE.EdgesGeometry(geometry);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color: PALETTE.cream,
      depthTest: false,
      transparent: true
    })
  );
  line.renderOrder = 11;
  coreMesh.add(line);

  // Invisible spherical hitbox
  const hitGeo = new THREE.SphereGeometry(0.45, 12, 12);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.userData.sensorId = id;
  nodeGroup.add(hitMesh);
  sensorHitboxes.push(hitMesh);

  roomGroup.add(nodeGroup);

  sensors[id] = {
    id,
    label,
    isOn: initialOn,
    position,
    coreMat,
    coreMesh,
    labelElement: null
  };

  return sensors[id];
}

// 1. Humidity Sensor (Mounted on 5m Left Wall)
const humidityPos = new THREE.Vector3(-ROOM_SIZE / 2 + 0.35, 3.8, -1.5);
createSensorNode(
  'humidity',
  'HUMIDITY SENSOR',
  new THREE.BoxGeometry(0.28, 0.42, 0.28),
  humidityPos,
  true
);

// 2. Gas Sensor (Mounted on Solid Sloped Back Wall)
const gasPos = new THREE.Vector3(0.8, 3.6, -ROOM_SIZE / 2 + 0.35);
createSensorNode(
  'gas',
  'GAS SENSOR',
  new THREE.CylinderGeometry(0.18, 0.18, 0.42, 16),
  gasPos,
  true
);

// 3. Proximity Sensor (Mounted on 4m Right Wall)
const proximityPos = new THREE.Vector3(ROOM_SIZE / 2 - 0.35, 2.6, 1.5);
createSensorNode(
  'proximity',
  'PROXIMITY SENSOR',
  new THREE.OctahedronGeometry(0.24, 0),
  proximityPos,
  false
);

scene.add(roomGroup);

// Apply visual state locally
function applySensorVisuals(id, isOn) {
  const sensor = sensors[id];
  if (!sensor) return;

  sensor.isOn = isOn;
  const stateText = isOn ? 'ON' : 'OFF';

  sensor.coreMat.color.setHex(isOn ? PALETTE.statusOn : PALETTE.statusOff);

  if (sensor.labelElement) {
    sensor.labelElement.classList.toggle('state-on', isOn);
    sensor.labelElement.classList.toggle('state-off', !isOn);
    sensor.labelElement.querySelector('.label-text').textContent = `${sensor.label}: ${stateText}`;
  }

  const rtDot = document.getElementById(`rt-dot-${id}`);
  const rtVal = document.getElementById(`rt-val-${id}`);
  if (rtDot) {
    rtDot.classList.toggle('on', isOn);
    rtDot.classList.toggle('off', !isOn);
  }
  if (rtVal) {
    rtVal.textContent = stateText;
  }
}

// Write to Firebase (Optimistic UI update + background cloud sync)
function setSensorState(id, targetState, source = '3D Node') {
  const sensor = sensors[id];
  if (!sensor) return;

  applySensorVisuals(id, targetState);

  const stateText = targetState ? 'ON' : 'OFF';
  addLog(
    `NODE · ${stateText}`,
    `${sensor.label} switched ${stateText} (${source})`,
    targetState ? 'on' : 'off'
  );

  set(ref(db, `sensors/${id}`), targetState).catch((error) => {
    console.error("Firebase sync error:", error);
  });
}

function toggleSensor(id, source = '3D Node') {
  const sensor = sensors[id];
  if (!sensor) return;
  setSensorState(id, !sensor.isOn, source);
}

onValue(sensorsRef, (snapshot) => {
  const data = snapshot.val();

  if (!data) {
    set(sensorsRef, {
      humidity: true,
      gas: true,
      proximity: false
    });
    return;
  }

  Object.keys(sensors).forEach((id) => {
    if (typeof data[id] === 'boolean') {
      applySensorVisuals(id, data[id]);
    }
  });
});

document.querySelectorAll('.rt-box[data-sensor]').forEach((box) => {
  box.addEventListener('click', () => {
    toggleSensor(box.dataset.sensor, 'Sidebar');
  });
});

const wakeyBtn = document.getElementById('wakey-btn');
if (wakeyBtn) {
  wakeyBtn.addEventListener('click', () => {
    Object.keys(sensors).forEach((id) => {
      set(ref(db, `sensors/${id}`), true);
    });
    addLog('WAKE', 'Wakey Wakey triggered — all nodes active', 'on');
  });
}

// ==========================================
// 6. FLOATING 3D-TRACKED LABELS
// ==========================================
const roomLabelEl = document.createElement('div');
roomLabelEl.className = 'floating-label';
roomLabelEl.textContent = 'ZONE 01 (8x8m · 5m→4m)';
labelsContainer.appendChild(roomLabelEl);

const trackedLabels = [
  { element: roomLabelEl, position: new THREE.Vector3(0, 0.8, 0) }
];

Object.values(sensors).forEach((sensor) => {
  const el = document.createElement('div');
  el.className = `floating-label sensor ${sensor.isOn ? 'state-on' : 'state-off'}`;
  el.innerHTML = `<span class="label-dot"></span><span class="label-text">${sensor.label}: ${sensor.isOn ? 'ON' : 'OFF'}</span>`;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSensor(sensor.id, 'Label');
  });
  labelsContainer.appendChild(el);
  sensor.labelElement = el;

  trackedLabels.push({
    element: el,
    position: sensor.position.clone().add(new THREE.Vector3(0, 0.55, 0))
  });
});

function updateLabels() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  trackedLabels.forEach(({ element, position }) => {
    const projected = position.clone().project(camera);

    if (projected.z > 1) {
      element.style.display = 'none';
      return;
    }

    element.style.display = 'flex';
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-(projected.y * 0.5) + 0.5) * height;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });
}

// ==========================================
// 7. RAYCASTING THROUGH WALLS (CLICK/TAP)
// ==========================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownPos = { x: 0, y: 0 };

function updatePointerCoords(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointermove', (e) => {
  updatePointerCoords(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(sensorHitboxes, false);
  renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;

  const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (moveDist > 5) return; // Ignore camera orbit drags

  updatePointerCoords(e);
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(sensorHitboxes, false);
  if (hits.length > 0) {
    const sensorId = hits[0].object.userData.sensorId;
    toggleSensor(sensorId, '3D Viewport');
  }
});

// ==========================================
// 8. RESIZE HANDLER & ANIMATION LOOP
// ==========================================
function onResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener('resize', onResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
}

animate();
