// Vespera - boot & main loop.
var _audioFwd = new THREE.Vector3();
var _audioRight = new THREE.Vector3();

var Main = {
  initialized: false,
  _mmFrame: 0,

  init: function(){
    if (this.initialized) return;
    this.initialized = true;

    window.VESPERA_DIAG = G;
    window.onerror = function(msg,src,line,col,err){ window.VESPERA_DIAG_ERR = (window.VESPERA_DIAG_ERR||'') + msg+' @'+line+' '; return false; };
    var canvas = document.getElementById('game');

    // Prefer high performance dedicated GPU on dual-GPU PCs/laptops to prevent stutters
    var renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: !G.isMobile,
        powerPreference: 'high-performance'
      });
      G.renderer = renderer;
      this.applyResolutionScale();
    } catch(e) {
      console.warn('[VESPERA] WebGL context fallback:', e);
    }

    var scene = new THREE.Scene();
    G.scene = scene;
    var camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.05, 400);
    G.camera = camera;
    scene.add(camera);

    G.clock = new THREE.Clock();

    if (typeof Preloader !== 'undefined' && Preloader.init) Preloader.init();

    if (location.search.indexOf('debug') !== -1) window.__DEBUG_LUM = true;
    if (location.search.indexOf('debug') !== -1){
      var dbg = document.createElement('div');
      dbg.id = 'pc-debug';
      dbg.style.cssText = 'position:fixed;bottom:8px;left:8px;background:rgba(0,0,0,.65);color:#cfc;font:11px monospace;padding:4px 8px;z-index:99;border-radius:3px;';
      document.body.appendChild(dbg);
    }

    // Defensive subsystem initialization
    function trySub(name, fn){
      try { fn(); } catch(e){ console.error('[VESPERA Subsystem Error] ' + name + ':', e); }
    }

    trySub('Audio', function(){ if (typeof AudioSys !== 'undefined') AudioSys.init(); });
    trySub('Effects', function(){ Effects.init(); });
    trySub('World', function(){ World.build(); });
    trySub('DayNight', function(){ DayNight.init(); });
    trySub('Weather', function(){ if (typeof Weather !== 'undefined') Weather.init(scene); });
    trySub('Cars', function(){ Cars.build(); });
    trySub('Scavenging', function(){ if (typeof Scavenging !== 'undefined') Scavenging.init(scene); });
    trySub('Extraction', function(){ if (typeof Extraction !== 'undefined') Extraction.init(scene); });
    trySub('Weapons', function(){ Weapons.buildViewmodel(); });
    trySub('Enemies', function(){ Enemies.init && Enemies.init(); });
    trySub('Objectives', function(){ Objectives.init(); });
    trySub('HUD', function(){ HUD.init(); });
    trySub('Player', function(){ Player.init(); });
    trySub('Touch', function(){ Touch.init(); });

    // start position: on the road, near the Vespera GT
    G.player.pos.x = World.startPos.x + 3;
    G.player.pos.z = World.startPos.z + 3;
    G.player.yaw = Math.PI/4;
    G.camera.position.set(G.player.pos.x, G.player.pos.y, G.player.pos.z);
    var col = collideWorld(G.player.pos.x, G.player.pos.z, 0.5);
    if (col.hit){ G.player.pos.x = col.x; G.player.pos.z = col.z; }

    window.addEventListener('resize', function(){
      camera.aspect = window.innerWidth/window.innerHeight;
      camera.updateProjectionMatrix();
      Main.applyResolutionScale();
    });

    // Wire up start and respawn buttons
    var startBtn = document.getElementById('btn-start');
    if (startBtn){
      startBtn.addEventListener('click', function(e){
        e.preventDefault();
        if (window._onStartBtn){
          window._onStartBtn();
        } else if (typeof Preloader !== 'undefined' && !Preloader.isReady){
          Preloader.requestStart();
        } else {
          Main.start();
        }
      });
    }

    var respawnBtn = document.getElementById('btn-respawn');
    if (respawnBtn){
      respawnBtn.addEventListener('click', function(){
        Player.respawn();
        if (!G.isMobile && canvas && canvas.requestPointerLock){
          try {
            var p = canvas.requestPointerLock();
            if (p && typeof p.catch === 'function') p.catch(function(){});
          } catch(e){}
        }
      });
    }

    this.animate();

    if (window._pendingStart){
      window._pendingStart = false;
      this.start();
    }
  },

  
  applyResolutionScale: function(){
    if (!G.renderer) return;
    var dpr = window.devicePixelRatio || 1;
    var quality = (G.settings && G.settings.graphicsQuality) || 'high';
    var maxDpr = (quality === 'high') ? Math.min(dpr, 1.25) : (quality === 'med' ? 1.0 : 0.75);
    var scale = (G.settings && typeof G.settings.resolutionScale === 'number') ? G.settings.resolutionScale : 1.0;
    var effectiveDpr = Math.max(0.4, Math.min(2.0, maxDpr * scale));
    G.renderer.setPixelRatio(effectiveDpr);
    G.renderer.setSize(window.innerWidth, window.innerHeight);

    var rw = Math.round(window.innerWidth * effectiveDpr);
    var rh = Math.round(window.innerHeight * effectiveDpr);
    var resBadge = document.getElementById('val-render-res');
    if (resBadge) resBadge.textContent = rw + ' \u00D7 ' + rh;
    var diagBuffer = document.getElementById('pm-diag-buffer');
    if (diagBuffer) diagBuffer.textContent = rw + ' \u00D7 ' + rh;
    var diagWin = document.getElementById('pm-diag-win');
    if (diagWin) diagWin.textContent = window.innerWidth + ' \u00D7 ' + window.innerHeight;
    var diagDpr = document.getElementById('pm-diag-dpr');
    if (diagDpr) diagDpr.textContent = effectiveDpr.toFixed(2) + 'x (Sys: ' + dpr.toFixed(1) + 'x)';
    var diagSavings = document.getElementById('pm-diag-savings');
    if (diagSavings){
      var nativePixels = (window.innerWidth * maxDpr) * (window.innerHeight * maxDpr);
      var scaledPixels = rw * rh;
      var savingsPct = Math.round((1 - (scaledPixels / (nativePixels || 1))) * 100);
      if (savingsPct > 0){
        diagSavings.textContent = '+' + savingsPct + '% GPU Fill-Rate Boost';
        diagSavings.style.color = '#00e5ff';
      } else {
        diagSavings.textContent = 'Native (100% Quality)';
        diagSavings.style.color = '#94a3b8';
      }
    }
  },

  start: function(){
    if (!this.initialized) this.init();

    // Enforce asset and shader caching before launching into gameplay
    if (typeof Preloader !== 'undefined' && !Preloader.isReady){
      Preloader.requestStart();
      return;
    }

    // Trigger mobile landscape & fullscreen experience if on touch / mobile device
    if (window.enterMobileLandscape){
      try { window.enterMobileLandscape(); } catch(e){}
    }

    try {
      if (typeof AudioSys !== 'undefined'){
        if (AudioSys.init) AudioSys.init();
        if (AudioSys.resume) AudioSys.resume();
      }
    } catch(e){ console.warn('Audio start warning:', e); }

    var preOverlay = document.getElementById('preloader-overlay');
    if (preOverlay) preOverlay.style.display = 'none';
    var note = document.getElementById('loading-note');
    if (note) note.style.display = 'none';
    var menu = document.getElementById('menu');
    if (menu) menu.style.display = 'none';
    var hud = document.getElementById('hud');
    if (hud) hud.classList.add('active');

    G.paused = false;

    try {
      if (typeof Weapons !== 'undefined' && Weapons.list && Weapons.current){
        var curW = Weapons.list[Weapons.current];
        var wName = curW ? curW.name : 'Weapon';
        HUD.weapon(wName, Weapons.state.mag, Weapons.state.reserve);
        HUD.ammo(Weapons.state.mag, Weapons.state.reserve);
      }
      if (typeof HUD !== 'undefined' && G.player) HUD.health(G.player.health);
      if (typeof Objectives !== 'undefined' && Objectives.begin) Objectives.begin();
    } catch(e){ console.warn('HUD/Objectives start warning:', e); }

    var canvas = document.getElementById('game');
    if (!G.isMobile && canvas && canvas.requestPointerLock){
      try {
        var p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(function(){});
      } catch(e){}
    }
  },

  animate: function(){
    requestAnimationFrame(function(){ Main.animate(); });
    var rawDelta = G.clock.getDelta();
    var dt = G.paused ? 0 : Math.min(0.05, rawDelta);

    // Update 3D positional audio listener without per-frame allocations
    if (typeof AudioSys !== 'undefined' && AudioSys.updateListener && G.camera){
      G.camera.getWorldDirection(_audioFwd);
      _audioRight.set(1, 0, 0).applyQuaternion(G.camera.quaternion);
      AudioSys.updateListener(G.camera.position, _audioFwd, _audioRight);
    }

    if (!G.paused){
      try {
        DayNight.update(dt);
        if (typeof Weather !== 'undefined') Weather.update(dt);
        Player.update(dt);
        Cars.update(dt);
        if (typeof Safehouse !== 'undefined') Safehouse.update(dt);
        if (typeof Scavenging !== 'undefined') Scavenging.update(dt);
        if (typeof Extraction !== 'undefined') Extraction.update(dt);
        Weapons.update(dt);
        Enemies.update(dt);
        Effects.update(dt);
        if (World.update) World.update(dt);
      } catch(frameErr){
        console.error('[VESPERA FRAME ERROR]', frameErr);
      }
    }

    if (window.__DEBUG_LUM){
      var el = document.getElementById('pc-debug');
      if (el){
        el.textContent = 'PC loaded:'+PlayerCharacter.loaded+
          ' model:'+(PlayerCharacter.model?'yes':'no')+
          ' vis:'+(PlayerCharacter.model?PlayerCharacter.model.visible:'?')+
          ' pos:'+Math.round(PlayerCharacter.model?PlayerCharacter.model.position.x:0)+','+Math.round(PlayerCharacter.model?PlayerCharacter.model.position.y:0)+','+Math.round(PlayerCharacter.model?PlayerCharacter.model.position.z:0)+
          ' cam:'+Math.round(G.camera.position.x)+','+Math.round(G.camera.position.y)+','+Math.round(G.camera.position.z);
      }
    }

    Objectives.update();

    // Render dynamic rotating 2D minimap
    if (typeof HUD !== 'undefined' && HUD.minimap){
      HUD.minimap();
    }

    this._fpsTimer = (this._fpsTimer || 0) + dt;
    this._fpsFrames = (this._fpsFrames || 0) + 1;
    if (this._fpsTimer >= 0.5){
      var curFps = Math.round(this._fpsFrames / this._fpsTimer);
      this._fpsTimer = 0;
      this._fpsFrames = 0;
      var fpsEl = document.getElementById('pm-fps-counter');
      if (fpsEl) fpsEl.textContent = curFps + ' FPS';
      if (G.paused && typeof HUD !== 'undefined' && HUD.updateLiveTelemetry) HUD.updateLiveTelemetry();
    }

    if (!G.paused){ G.T_cars = G.cars.length; G.T_enemies = G.enemies.length; }
    window.VESPERA_DIAG_ERR = window.VESPERA_DIAG_ERR || '';
    if (G.renderer) G.renderer.render(G.scene, G.camera);
  }
};

// Guarantee Main.init runs even if DOMContentLoaded already fired before script execution
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', function(){ Main.init(); });
} else {
  Main.init();
}

// Global Mobile Landscape & Fullscreen Orientation Trigger
window.enterMobileLandscape = function(){
  var docEl = document.documentElement;
  var rfs = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
  if (rfs){
    try {
      var p = rfs.call(docEl);
      if (p && p.catch) p.catch(function(){});
    } catch(e){}
  }
  if (screen.orientation && screen.orientation.lock){
    try {
      screen.orientation.lock('landscape').catch(function(){});
    } catch(e){}
  }
};
