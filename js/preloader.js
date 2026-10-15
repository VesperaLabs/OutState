// Vespera - Tactical Preloader & GPU Shader Pipeline Cache Manager
// Eliminates in-game streaming stutter by pre-loading 3D models and pre-compiling WebGL shaders upfront.

var Preloader = {
  total: 0,
  loaded: 0,
  targetPercent: 0,
  currentPercent: 0,
  isReady: false,
  pendingStart: false,
  gpuWarmed: false,
  activeAsset: '',
  animId: null,
  startTime: Date.now(),

  // Friendly tactical asset descriptions
  assetNames: {
    'mercedes-benz_amg_one': 'VEHICLE // Mercedes-Benz AMG ONE (F1 Hybrid)',
    '2018_dodge_challenger_srt_demon': 'VEHICLE // Dodge Challenger SRT Demon (Supercharged V8)',
    'buildings.glb': 'METROPOLIS // Modular Storefronts & City Blocks',
    'futuristic_building': 'LANDMARK // Civic Skyscraper Tower',
    'fps_arms_anim': 'VIEWMODEL // ACR Assault Rifle & Viewmodel Rig',
    'shotgun': 'VIEWMODEL // Remington 870 12G Shotgun',
    'revolver': 'VIEWMODEL // .357 Magnum Tactical Sidearm',
    'ak47': 'WEAPONS // Ballistic Weapon Visuals',
    'zombie': 'INFECTED // Neural Zombie Horde Archetypes',
    'mannequiny': 'SURVIVOR // Player Character Skeletal Rig',
    'soldier': 'CONVOY // Military Extraction Escort Rig',
    'prop_ak': 'PROPS // Military Weapon Prop'
  },

  getFriendlyName: function(url){
    if (!url) return '3D Asset Geometry';
    var lower = url.toLowerCase();
    for (var key in this.assetNames){
      if (lower.indexOf(key) !== -1){
        return this.assetNames[key];
      }
    }
    var clean = url.split('/').pop().split('?')[0];
    return 'ASSET // ' + clean;
  },

  init: function(){
    var self = this;
    if (typeof THREE === 'undefined') return;

    // Hook Three.js DefaultLoadingManager to monitor 100% of GLTF / texture / audio requests
    var mgr = THREE.DefaultLoadingManager;

    mgr.onStart = function(url, itemsLoaded, itemsTotal){
      self.total = Math.max(self.total, itemsTotal);
      self.loaded = itemsLoaded;
      self.activeAsset = self.getFriendlyName(url);
      self.updateTargetPercent();
      console.log('[VESPERA Preloader] Started loading:', self.activeAsset, '(' + itemsLoaded + '/' + itemsTotal + ')');
    };

    mgr.onProgress = function(url, itemsLoaded, itemsTotal){
      self.total = Math.max(self.total, itemsTotal);
      self.loaded = itemsLoaded;
      self.activeAsset = self.getFriendlyName(url);
      self.updateTargetPercent();
    };

    mgr.onLoad = function(){
      console.log('[VESPERA Preloader] All raw assets downloaded (' + self.loaded + '/' + self.total + '). Initializing GPU pipeline...');
      self.targetPercent = 95;
      self.activeAsset = 'PRE-COMPILING GPU SHADERS & VRAM TEXTURES...';

      // Allow 1 render tick for DOM to show 95%, then trigger GPU warmup
      setTimeout(function(){
        self.warmupGPU();
        self.targetPercent = 100;
        self.currentPercent = 100;
        self.onComplete();
      }, 120);
    };

    mgr.onError = function(url){
      console.warn('[VESPERA Preloader] Asset failed (skipping to prevent hang):', url);
      self.loaded = Math.min(self.total, self.loaded + 1);
      self.updateTargetPercent();
    };

    // Safety timeout: Never leave the user stuck on loading screen if network stalls
    setTimeout(function(){
      if (!self.isReady){
        console.warn('[VESPERA Preloader] Safety timeout reached (forcing ready state).');
        self.warmupGPU();
        self.targetPercent = 100;
        self.currentPercent = 100;
        self.onComplete();
      }
    }, 9000);

    // Start UI update animation loop
    this.startAnimationLoop();
  },

  updateTargetPercent: function(){
    if (this.total > 0){
      // Clamp target to 90% while downloading; final 10% reserved for GPU shader compile & warmup
      var pct = Math.round((this.loaded / this.total) * 90);
      this.targetPercent = Math.max(this.targetPercent, Math.min(90, pct));
    }
  },

  startAnimationLoop: function(){
    var self = this;
    function tick(){
      if (!self.isReady){
        // Smoothly interpolate current display percentage towards target
        if (self.currentPercent < self.targetPercent){
          self.currentPercent += Math.max(0.4, (self.targetPercent - self.currentPercent) * 0.12);
          if (self.currentPercent > self.targetPercent) self.currentPercent = self.targetPercent;
        }
        self.renderUI();
        self.animId = requestAnimationFrame(tick);
      }
    }
    this.animId = requestAnimationFrame(tick);
  },

  renderUI: function(){
    var pct = Math.min(100, Math.round(this.currentPercent));

    // 1. Menu inline loading panel
    var barFill = document.getElementById('lp-bar-fill');
    if (barFill) barFill.style.width = pct + '%';

    var pctText = document.getElementById('lp-percent');
    if (pctText) pctText.textContent = pct + '%';

    var ticker = document.getElementById('lp-status-ticker');
    if (ticker && this.activeAsset) ticker.textContent = this.activeAsset;

    var counter = document.getElementById('lp-counter');
    if (counter && this.total > 0){
      counter.textContent = '[' + this.loaded + ' / ' + this.total + '] STREAMED';
    }

    // 2. Start button label & state
    var btnStart = document.getElementById('btn-start');
    var btnText = document.getElementById('btn-start-text');
    if (btnStart && !this.isReady){
      if (this.pendingStart){
        if (btnText) btnText.textContent = 'DEPLOYING ONCE 60 FPS READY... [' + pct + '%]';
        btnStart.classList.add('btn-pending');
      } else {
        if (btnText) btnText.textContent = 'STREAMING ASSETS... [' + pct + '%]';
      }
    }

    // 3. Fullscreen deployment overlay (if active)
    var ovFill = document.getElementById('po-bar-fill');
    if (ovFill) ovFill.style.width = pct + '%';

    var ovPct = document.getElementById('po-percent');
    if (ovPct) ovPct.textContent = pct + '%';

    var ovStatus = document.getElementById('po-status-text');
    if (ovStatus && this.activeAsset) ovStatus.textContent = this.activeAsset;
  },

  warmupGPU: function(){
    if (this.gpuWarmed) return;
    this.gpuWarmed = true;

    if (window.G && G.renderer && G.scene && G.camera){
      try {
        // Pre-compile all world, vehicle (Mercedes & Dodge), and city materials into WebGL shaders
        G.renderer.compile(G.scene, G.camera);

        // Pre-compile weapon viewmodels scene if present
        if (G.vmScene && G.vmCamera){
          G.renderer.compile(G.vmScene, G.vmCamera);
        }

        // Render 1 background frame to flush the driver's shader pipeline cache
        G.renderer.render(G.scene, G.camera);
        console.log('[VESPERA Preloader] WebGL shaders & VRAM pipeline successfully pre-warmed.');
      } catch(e){
        console.warn('[VESPERA Preloader] GPU warmup warning:', e);
      }
    }
  },

  onComplete: function(){
    if (this.isReady) return;
    this.isReady = true;
    this.currentPercent = 100;
    this.renderUI();

    var ticker = document.getElementById('lp-status-ticker');
    if (ticker) ticker.textContent = 'SYSTEM SYNCHRONIZED // 60 FPS PIPELINE READY';

    var counter = document.getElementById('lp-counter');
    if (counter) counter.textContent = '100% VRAM CACHED';

    var btnStart = document.getElementById('btn-start');
    var btnText = document.getElementById('btn-start-text');
    var btnIcon = document.getElementById('btn-start-icon');
    if (btnStart){
      btnStart.classList.remove('btn-start-loading', 'btn-pending');
      btnStart.classList.add('btn-start-ready');
      if (btnIcon) btnIcon.textContent = '⚡';
      if (btnText) btnText.textContent = 'ENTER VESPERA';
    }

    // If the user already clicked "ENTER VESPERA" while assets were loading, launch immediately
    if (this.pendingStart){
      console.log('[VESPERA Preloader] Deploying queued entry into Vespera...');
      setTimeout(function(){
        if (window.Main && Main.start){
          Main.start();
        }
      }, 200);
    }
  },

  requestStart: function(){
    if (this.isReady){
      if (window.Main && Main.start) Main.start();
      return;
    }

    // User clicked while still streaming assets: Show dedicated deployment overlay and queue entry
    this.pendingStart = true;
    var overlay = document.getElementById('preloader-overlay');
    if (overlay){
      overlay.style.display = 'flex';
      overlay.classList.add('active');
    }
    this.renderUI();
  }
};

// Auto-initialize Preloader early
if (typeof THREE !== 'undefined'){
  Preloader.init();
} else {
  window.addEventListener('DOMContentLoaded', function(){ Preloader.init(); });
}
