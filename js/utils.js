// Vespera - shared helpers & global state
var G = {
  scene: null, camera: null, renderer: null,
  clock: null,
  settings: {
    mouseSens: 1.0,
    masterVol: 0.7,
    sfxVol: 0.85,
    ambienceVol: 0.65,
    engineVol: 0.85,
    rpmIntensity: 1.0,
    rpmModEnabled: true,
    graphicsQuality: 'high',
    resolutionScale: 1.0,
    sprintToggle: false,
    adsToggle: false,
    speedoTheme: 'amber',
    speedoUnit: 'MPH',
    keys: {
      forward: 'KeyW',
      backward: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      sprint: 'ShiftLeft',
      jump: 'Space',
      interact: 'KeyE',
      reload: 'KeyR',
      fire: 'KeyX',
      inspect: 'KeyT',
      slot1: 'Digit1',
      slot2: 'Digit2',
      slot3: 'Digit3',
      vehCam: 'KeyV',
      bunkerDoor: 'KeyO',
      gearLock: 'KeyG',
      shiftUp: 'KeyF',
      shiftDown: 'KeyQ',
      stageRev: 'KeyZ'
    }
  },
  player: { pos: new THREE.Vector3(0,1.7,0), vel: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0,
            health: 100, armor: 0, scrap: 30, onGround: true, inCar: null, dead: false, sprint:false },
  keys: {}, mouseDown: false,
  touch: { moveX:0, moveZ:0, lookDX:0, lookDY:0, fire:false, jump:false },
  buildings: [],      // collision AABBs {minX,maxX,minZ,maxZ}
  cars: [],           // all cars
  enemies: [],
  pickups: [],
  timeOfDay: 7.33,    // hours, 24h
  dayLength: 420,     // real seconds per full day
  isNight: false,
  blockCenters: [],
  kills: 0,
  paused: true,
  isMobile: ('ontouchstart' in window) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || navigator.userAgentData || ''),
  objective: null,    // {x,z,label}
  colliders: []       // solid boxes for bullets/car {x,z,hx,hz,h}
};

try {
  var _saved = localStorage.getItem('vespera_settings');
  if (_saved){
    var _parsed = JSON.parse(_saved);
    if (_parsed && typeof _parsed === 'object'){
      if (typeof _parsed.mouseSens === 'number') G.settings.mouseSens = _parsed.mouseSens;
      if (typeof _parsed.masterVol === 'number') G.settings.masterVol = _parsed.masterVol;
      if (typeof _parsed.engineVol === 'number') G.settings.engineVol = _parsed.engineVol;
      if (typeof _parsed.rpmIntensity === 'number') G.settings.rpmIntensity = _parsed.rpmIntensity;
      if (typeof _parsed.rpmModEnabled === 'boolean') G.settings.rpmModEnabled = _parsed.rpmModEnabled;
      if (typeof _parsed.sfxVol === 'number') G.settings.sfxVol = _parsed.sfxVol;
      if (typeof _parsed.ambienceVol === 'number') G.settings.ambienceVol = _parsed.ambienceVol;
      if (_parsed.graphicsQuality) G.settings.graphicsQuality = _parsed.graphicsQuality;
      if (typeof _parsed.resolutionScale === 'number') G.settings.resolutionScale = _parsed.resolutionScale;
      if (typeof _parsed.sprintToggle === 'boolean') G.settings.sprintToggle = _parsed.sprintToggle;
      if (typeof _parsed.adsToggle === 'boolean') G.settings.adsToggle = _parsed.adsToggle;
      if (_parsed.speedoTheme) G.settings.speedoTheme = _parsed.speedoTheme;
      if (_parsed.speedoUnit) G.settings.speedoUnit = _parsed.speedoUnit;
      if (_parsed.keys && typeof _parsed.keys === 'object'){
        G.settings.keys = Object.assign({}, G.settings.keys, _parsed.keys);
      }
    }
  }
  var _themeBackup = localStorage.getItem('vespera_speedo_theme');
  if (_themeBackup) G.settings.speedoTheme = _themeBackup;
  var _unitBackup = localStorage.getItem('vespera_speedo_unit');
  if (_unitBackup) G.settings.speedoUnit = _unitBackup;
} catch(e){}


// Global action keybinding checking
G.isActionDown = function(action){
  if (!G.keys) return false;
  var customKey = G.settings && G.settings.keys && G.settings.keys[action];
  if (customKey && G.keys[customKey]) return true;
  // Fallbacks & defaults
  if (action === 'forward') return !!(G.keys['KeyW'] || G.keys['ArrowUp']);
  if (action === 'backward') return !!(G.keys['KeyS'] || G.keys['ArrowDown']);
  if (action === 'left') return !!(G.keys['KeyA'] || G.keys['ArrowLeft']);
  if (action === 'right') return !!(G.keys['KeyD'] || G.keys['ArrowRight']);
  if (action === 'sprint') return !!(G.keys['ShiftLeft'] || G.keys['ShiftRight']);
  if (action === 'jump') return !!G.keys['Space'];
  if (action === 'interact') return !!G.keys['KeyE'];
  if (action === 'reload') return !!G.keys['KeyR'];
  if (action === 'fire') return !!G.keys['KeyX'];
  if (action === 'inspect') return !!(G.keys['KeyT'] || G.keys['KeyI']);
  if (action === 'slot1') return !!G.keys['Digit1'];
  if (action === 'slot2') return !!G.keys['Digit2'];
  if (action === 'slot3') return !!G.keys['Digit3'];
  if (action === 'vehCam') return !!(G.keys['KeyV'] || G.keys['KeyC']);
  if (action === 'bunkerDoor') return !!G.keys['KeyO'];
  if (action === 'gearLock') return !!G.keys['KeyG'];
  if (action === 'shiftUp') return !!G.keys['KeyF'];
  if (action === 'shiftDown') return !!G.keys['KeyQ'];
  if (action === 'stageRev') return !!G.keys['KeyZ'];
  return false;
};

G.getActionForKey = function(code){
  if (G.settings && G.settings.keys){
    for (var act in G.settings.keys){
      if (G.settings.keys[act] === code) return act;
    }
  }
  if (code === 'KeyW' || code === 'ArrowUp') return 'forward';
  if (code === 'KeyS' || code === 'ArrowDown') return 'backward';
  if (code === 'KeyA' || code === 'ArrowLeft') return 'left';
  if (code === 'KeyD' || code === 'ArrowRight') return 'right';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'sprint';
  if (code === 'Space') return 'jump';
  if (code === 'KeyE') return 'interact';
  if (code === 'KeyR') return 'reload';
  if (code === 'KeyX') return 'fire';
  if (code === 'KeyT' || code === 'KeyI') return 'inspect';
  if (code === 'Digit1') return 'slot1';
  if (code === 'Digit2') return 'slot2';
  if (code === 'Digit3') return 'slot3';
  if (code === 'KeyV' || code === 'KeyC') return 'vehCam';
  if (code === 'KeyO') return 'bunkerDoor';
  if (code === 'KeyG') return 'gearLock';
  if (code === 'KeyF') return 'shiftUp';
  if (code === 'KeyQ') return 'shiftDown';
  if (code === 'KeyZ') return 'stageRev';
  return null;
};

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function rand(a,b){ return a + Math.random()*(b-a); }
function randi(a,b){ return Math.floor(rand(a,b+1)); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function dist2(ax,az,bx,bz){ var dx=ax-bx, dz=az-bz; return dx*dx+dz*dz; }

var _colWorldResult = { x: 0, z: 0, hit: false };

// Robust 2D collision vs box colliders (circle radius r, multi-pass relaxation) - Zero Allocation
function collideWorld(x, z, r) {
  var hitAny = false;
  var r2 = r * r;
  var colls = G.colliders;
  if (!colls){
    _colWorldResult.x = x; _colWorldResult.z = z; _colWorldResult.hit = false;
    return _colWorldResult;
  }
  var len = colls.length;
  for (var pass = 0; pass < 3; pass++) {
    var hitThisPass = false;
    for (var i = 0; i < len; i++) {
      var c = colls[i];
      // Fast AABB rejection before clamp/distance:
      var maxDx = c.hx + r;
      var cdx = x - c.x;
      if (cdx > maxDx || cdx < -maxDx) continue;
      var maxDz = c.hz + r;
      var cdz = z - c.z;
      if (cdz > maxDz || cdz < -maxDz) continue;

      var nx = clamp(x, c.x - c.hx, c.x + c.hx);
      var nz = clamp(z, c.z - c.hz, c.z + c.hz);
      var dx = x - nx, dz = z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r2) {
        hitAny = true;
        hitThisPass = true;
        if (d2 > 1e-6) {
          var d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Center is inside box: push out along shortest penetration axis
          var penLeft = x - (c.x - c.hx);
          var penRight = (c.x + c.hx) - x;
          var penBack = z - (c.z - c.hz);
          var penFront = (c.z + c.hz) - z;
          var minPen = Math.min(penLeft, penRight, penBack, penFront);
          if (minPen === penLeft) x = c.x - c.hx - r;
          else if (minPen === penRight) x = c.x + c.hx + r;
          else if (minPen === penBack) z = c.z - c.hz - r;
          else z = c.z + c.hz + r;
        }
      }
    }
    if (!hitThisPass) break;
  }
  _colWorldResult.x = x;
  _colWorldResult.z = z;
  _colWorldResult.hit = hitAny;
  return _colWorldResult;
}

function raycastSolids(origin, dir, maxDist){
  // coarse: step along ray, check point inside any collider
  var steps = Math.ceil(maxDist/1.5);
  for (var i=1;i<=steps;i++){
    var t = i*1.5;
    var px = origin.x + dir.x*t, py = origin.y + dir.y*t, pz = origin.z + dir.z*t;
    if (py < 0 || py > 40) continue;
    for (var j=0;j<G.colliders.length;j++){
      var c = G.colliders[j];
      if (px > c.x-c.hx && px < c.x+c.hx && pz > c.z-c.hz && pz < c.z+c.hz && py < c.h) return t;
    }
  }
  return maxDist;
}

// ground height: 0 everywhere (flat city), sidewalks cosmetic
function groundY(){ return 0; }
