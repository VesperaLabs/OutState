// Vespera - High-Performance Procedural & Studio-Mastered Audio System (WebAudio).
// Optimized for 60+ FPS: Zero WebAudio graph node leaks, pre-baked noise buffers,
// throttled high-frequency footsteps, deadband automation, and automatic node lifecycle cleanup.

function _clamp(v, a, b){
  if (typeof v !== 'number' || isNaN(v)) return a;
  return v < a ? a : (v > b ? b : v);
}
function _rand(a, b){
  return a + Math.random() * (b - a);
}
if (typeof clamp === 'undefined') var clamp = _clamp;
if (typeof rand === 'undefined') var rand = _rand;

var AudioSys = {
  ctx: null,
  master: null,
  sfxGain: null,
  ambienceGain: null,
  echo: null,
  echoGain: null,
  echoFilter: null,

  // Pre-baked noise buffers (generated once on init to eliminate runtime allocations & GC pauses)
  noiseBuf: null,
  screechBuf: null,
  crunchBuf: null,
  waterBuf: null,
  woodBuf: null,
  rainBuf: null,

  buffers: {},
  loadingAudio: false,

  // Safe node lifecycle cleanup utility
  _cleanupNodes: function(nodes, delayMs){
    if (!nodes || !nodes.length) return;
    setTimeout(function(){
      for (var i = 0; i < nodes.length; i++){
        var n = nodes[i];
        if (n){
          try { n.disconnect(); } catch(e){}
        }
      }
    }, Math.max(10, delayMs || 50));
  },

  init: function(){
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      var c = this.ctx;

      this.master = c.createGain();
      var mVol = (window.G && G.settings && typeof G.settings.masterVol === 'number') ? G.settings.masterVol : 0.7;
      this.master.gain.value = mVol;
      this.master.connect(c.destination);

      this.sfxGain = c.createGain();
      var sVol = (window.G && G.settings && typeof G.settings.sfxVol === 'number') ? G.settings.sfxVol : 0.85;
      this.sfxGain.gain.value = sVol;
      this.sfxGain.connect(this.master);

      this.ambienceGain = c.createGain();
      var aVol = (window.G && G.settings && typeof G.settings.ambienceVol === 'number') ? G.settings.ambienceVol : 0.65;
      this.ambienceGain.gain.value = aVol;
      this.ambienceGain.connect(this.master);

      var sr = c.sampleRate || 44100;

      // 1. General white noise buffer (0.8s) for gunshots, blasts, transients
      var nSamples = Math.floor(sr * 0.8);
      this.noiseBuf = c.createBuffer(1, nSamples, sr);
      var nd = this.noiseBuf.getChannelData(0);
      for (var i = 0; i < nSamples; i++){
        nd[i] = Math.random() * 2 - 1;
      }

      // 2. Pre-baked tire screech friction buffer (0.35s)
      var scSamples = Math.floor(sr * 0.35);
      this.screechBuf = c.createBuffer(1, scSamples, sr);
      var scd = this.screechBuf.getChannelData(0);
      for (var i = 0; i < scSamples; i++){
        scd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / scSamples, 0.8);
      }

      // 3. Pre-baked roadkill crunch/splatter buffer (0.3s)
      var crSamples = Math.floor(sr * 0.3);
      this.crunchBuf = c.createBuffer(1, crSamples, sr);
      var crd = this.crunchBuf.getChannelData(0);
      for (var i = 0; i < crSamples; i++){
        crd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crSamples, 1.4);
      }

      // 4. Pre-baked water hiss fountain buffer (0.5s)
      var wsSamples = Math.floor(sr * 0.5);
      this.waterBuf = c.createBuffer(1, wsSamples, sr);
      var wsd = this.waterBuf.getChannelData(0);
      for (var i = 0; i < wsSamples; i++){
        wsd[i] = (Math.random() * 2 - 1) * (0.6 + Math.random() * 0.4);
      }

      // 5. Pre-baked wood splinter buffer (0.2s)
      var spSamples = Math.floor(sr * 0.2);
      this.woodBuf = c.createBuffer(1, spSamples, sr);
      var spd = this.woodBuf.getChannelData(0);
      for (var i = 0; i < spSamples; i++){
        spd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / spSamples, 1.4);
      }

      // 6. Pre-baked rain loop buffer (2.0s)
      var rnSamples = Math.floor(sr * 2.0);
      this.rainBuf = c.createBuffer(1, rnSamples, sr);
      var rnd = this.rainBuf.getChannelData(0);
      for (var i = 0; i < rnSamples; i++){
        rnd[i] = Math.random() * 2 - 1;
      }

      // Reverb-ish echo bus for gunshots (city echo)
      this.echo = c.createDelay(0.5);
      this.echo.delayTime.value = 0.16;
      this.echoGain = c.createGain();
      this.echoGain.gain.value = 0.25;
      this.echoFilter = c.createBiquadFilter();
      this.echoFilter.type = 'lowpass';
      this.echoFilter.frequency.value = 850;
      this.echo.connect(this.echoFilter);
      this.echoFilter.connect(this.echoGain);
      this.echoGain.connect(this.sfxGain);
      this.echoGain.connect(this.echo); // feedback loop

      this.loadAudioFiles();
    } catch(e) { console.warn('audio unavailable', e); }
  },

  setMasterVolume: function(val){
    if (this.master && this.ctx){
      this.master.gain.setValueAtTime(_clamp(val, 0, 1), this.ctx.currentTime);
    }
  },
  setSfxVolume: function(val){
    if (this.sfxGain && this.ctx){
      this.sfxGain.gain.setValueAtTime(_clamp(val, 0, 1), this.ctx.currentTime);
    }
  },
  setAmbienceVolume: function(val){
    if (this.ambienceGain && this.ctx){
      this.ambienceGain.gain.setValueAtTime(_clamp(val, 0, 1), this.ctx.currentTime);
    }
  },

  loadAudioFiles: function(){
    if (!this.ctx || this.loadingAudio) return;
    this.loadingAudio = true;
    var files = {
      gunshot: 'assets/audio/gunshot.mp3',
      gunshot_suppressed: 'assets/audio/gunshot_suppressed.mp3',
      reload: 'assets/audio/reload.mp3',
      dry_fire: 'assets/audio/dry_fire.mp3',
      hit_marker: 'assets/audio/hit_marker.mp3',
      impact_flesh: 'assets/audio/impact_flesh.mp3',
      impact_concrete: 'assets/audio/impact_concrete.mp3',
      impact_metal: 'assets/audio/impact_metal.mp3',
      zombie_growl_1: 'assets/audio/zombie_growl_1.mp3',
      zombie_growl_2: 'assets/audio/zombie_growl_2.mp3',
      zombie_sprinter: 'assets/audio/zombie_sprinter.mp3',
      zombie_brute: 'assets/audio/zombie_brute.mp3',
      zombie_attack: 'assets/audio/zombie_attack.mp3',
      zombie_death: 'assets/audio/zombie_death.mp3',
      door_creak: 'assets/audio/door_creak.mp3',
      shotgun: 'assets/audio/shotgun.mp3',
      shotgun_reload: 'assets/audio/shotgun_reload.mp3',
      magnum: 'assets/audio/magnum.mp3',
      magnum_reload: 'assets/audio/magnum_reload.mp3',
      engine_amg: 'assets/audio/engine_amg.mp3',
      engine_demon: 'assets/audio/engine_demon.mp3',
      engine_start_amg: 'assets/audio/engine_start_amg.mp3',
      engine_start_demon: 'assets/audio/engine_start_demon.mp3'
    };
    var self = this;
    for (var key in files){
      (function(k, url){
        var mgr = (typeof THREE !== 'undefined' && THREE.DefaultLoadingManager) ? THREE.DefaultLoadingManager : null;
        if (mgr && mgr.itemStart) {
          try { mgr.itemStart(url); } catch(e){}
        }
        fetch(url)
          .then(function(res){
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.arrayBuffer();
          })
          .then(function(ab){
            return self.ctx.decodeAudioData(ab);
          })
          .then(function(audioBuf){
            self.buffers[k] = audioBuf;
            console.log('[VESPERA Audio] Loaded studio audio file:', k);
            if (mgr && mgr.itemEnd) {
              try { mgr.itemEnd(url); } catch(e){}
            }
          })
          .catch(function(err){
            console.warn('[VESPERA Audio] Audio stream fallback active for:', k, err);
            if (mgr && mgr.itemError) {
              try { mgr.itemError(url); } catch(e){}
            }
          });
      })(key, files[key]);
    }
  },

  // Bulletproof buffer playback with automatic node graph disconnection on finish
  playBuffer: function(key, outDest, vol, pitchVariation, timeOffset, spatialNode){
    if (!this.ctx || !this.buffers[key]) return false;
    try {
      var c = this.ctx;
      var src = c.createBufferSource();
      src.buffer = this.buffers[key];
      var pVar = (typeof pitchVariation === 'number') ? pitchVariation : 0.0;
      if (pVar > 0){
        src.playbackRate.value = 1.0 + (Math.random() * 2 - 1) * pVar;
      }
      var g = c.createGain();
      g.gain.value = (typeof vol === 'number') ? vol : 1.0;
      src.connect(g);
      var dest = outDest || this.master;
      g.connect(dest);
      var t = c.currentTime + (timeOffset || 0);
      src.start(t);

      // Cleanly disconnect when playback ends (prevents accumulation of thousands of dead nodes in audio graph)
      var cleaned = false;
      var cleanup = function(){
        if (cleaned) return;
        cleaned = true;
        try { src.disconnect(); } catch(e){}
        try { g.disconnect(); } catch(e){}
        if (spatialNode && spatialNode.destroy){
          try { spatialNode.destroy(); } catch(e){}
        }
      };
      src.onended = cleanup;
      var dur = (src.buffer.duration || 1.5) / Math.max(0.2, src.playbackRate.value || 1.0);
      setTimeout(cleanup, Math.ceil(dur * 1000) + 150);

      return true;
    } catch(e) {
      return false;
    }
  },

  resume: function(){
    try {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.loadingAudio) this.loadAudioFiles();
    } catch(e) {}
  },

  // Generic crisp mechanical click utility with auto-cleanup
  click: function(vol, freq, dur){
    if (!this.ctx) return;
    try {
      var c = this.ctx, t = c.currentTime;
      var v = (typeof vol === 'number') ? vol : 0.25;
      var f = (typeof freq === 'number') ? freq : 1200;
      var d = (typeof dur === 'number') ? dur : 0.03;
      var o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f * 0.35), t + d);
      var g = c.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + d + 0.005);
      this._cleanupNodes([o, g], Math.ceil((d + 0.02) * 1000));
    } catch(e) {}
  },

  // Crisp hitmarker audio confirmation
  hitTick: function(isHead){
    if (!this.ctx) return;
    try {
      this.resume();
      if (this.buffers['hit_marker']){
        var pitch = isHead ? 1.4 : 1.0;
        var vol = isHead ? 0.95 : 0.65;
        this.playBuffer('hit_marker', this.master, vol, 0);
        return;
      }
      var c = this.ctx, t = c.currentTime;
      var o = c.createOscillator();
      var g = c.createGain();
      if (isHead){
        o.type = 'sine';
        o.frequency.setValueAtTime(2000, t);
        o.frequency.exponentialRampToValueAtTime(1300, t + 0.04);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      } else {
        o.type = 'triangle';
        o.frequency.setValueAtTime(950, t);
        o.frequency.exponentialRampToValueAtTime(420, t + 0.025);
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      }
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.05);
      this._cleanupNodes([o, g], 65);
    } catch(e) {}
  },

  // Muffled distant gunshot from enemy thugs
  distantShot: function(vol, x, y, z){
    if (!this.ctx) return;
    try {
      this.resume();
      var c = this.ctx, t = c.currentTime;
      var v = (typeof vol === 'number') ? vol : 0.25;
      var outDest = this.master;
      var spat = null;
      if (x !== undefined && z !== undefined){
        spat = this.createSpatialNode(x, y, z, 8.0, 90.0, 1.0, 200);
        if (!spat) return;
        outDest = spat.input;
      }
      var o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      var g = c.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g);
      g.connect(outDest);
      o.start(t);
      o.stop(t + 0.15);
      var cleanNodes = [o, g];
      if (this.echo && outDest === this.master){
        var eg = c.createGain(); eg.gain.value = 0.22;
        g.connect(eg); eg.connect(this.echo);
        cleanNodes.push(eg);
      }
      this._cleanupNodes(cleanNodes, 180);
      if (spat) setTimeout(function(){ spat.destroy(); }, 200);
    } catch(e) {}
  },

  // Sharp metal ricochet ping
  ricochet: function(x, y, z){
    if (!this.ctx) return;
    try {
      this.resume();
      var outDest = this.master;
      var spat = null;
      if (x !== undefined && z !== undefined){
        spat = this.createSpatialNode(x, y, z, 4.0, 50.0, 1.1, 220);
        if (!spat) return;
        outDest = spat.input;
      }
      var c = this.ctx, t = c.currentTime;
      var o = c.createOscillator();
      o.type = 'sine';
      var f0 = 2400 + Math.random() * 1200;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(800 + Math.random() * 400, t + 0.15);
      var g = c.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      g.connect(outDest);
      o.start(t);
      o.stop(t + 0.17);
      this._cleanupNodes([o, g], 190);
      if (spat) setTimeout(function(){ spat.destroy(); }, 220);
    } catch(e) {}
  },

  // ---- 3D Positional Audio System ----
  listener: {
    pos: { x: 0, y: 1.7, z: 0 },
    fwd: { x: 0, y: 0, z: -1 },
    right: { x: 1, y: 0, z: 0 }
  },

  updateListener: function(pos, fwd, right){
    if (pos) { this.listener.pos.x = pos.x; this.listener.pos.y = pos.y; this.listener.pos.z = pos.z; }
    if (fwd) { this.listener.fwd.x = fwd.x; this.listener.fwd.y = fwd.y; this.listener.fwd.z = fwd.z; }
    if (right) { this.listener.right.x = right.x; this.listener.right.y = right.y; this.listener.right.z = right.z; }
  },

  // 3D Spatial audio node with mandatory lifecycle management & auto-cleanup
  createSpatialNode: function(x, y, z, refDist, maxDist, rolloff, autoCleanupMs){
    if (!this.ctx) return null;
    try {
      var c = this.ctx;
      refDist = refDist || 3.5;
      maxDist = maxDist || 55.0;
      rolloff = rolloff || 1.15;

      var lp = this.listener.pos;
      var lf = this.listener.fwd;
      var lr = this.listener.right;

      var dx = (x || 0) - lp.x, dy = (y || 0) - lp.y, dz = (z || 0) - lp.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > maxDist || isNaN(d)) return null;

      var invD = d > 0.001 ? (1.0 / d) : 0;
      var ndx = dx * invD, ndz = dz * invD;

      // Safe pan clamped strictly within WebAudio limits [-0.98, 0.98]
      var rawPan = ndx * lr.x + ndz * lr.z;
      var pan = _clamp(rawPan, -0.98, 0.98);

      var dotFwd = ndx * lf.x + ndz * lf.z;
      var distGain = 1.0 / (1.0 + Math.pow(Math.max(0, d - refDist) / refDist, rolloff));
      distGain = _clamp(distGain, 0.0, 1.5);

      var filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      var cutoff = dotFwd < 0 ? (2200 + (1 + dotFwd) * 2200) : (4500 + dotFwd * 7500);
      filter.frequency.value = _clamp(cutoff, 300, 18000);

      var gain = c.createGain();
      gain.gain.value = distGain;

      var panner = null;
      if (c.createStereoPanner){
        panner = c.createStereoPanner();
        panner.pan.value = pan;
        filter.connect(panner);
        panner.connect(gain);
      } else {
        filter.connect(gain);
      }
      gain.connect(this.master);

      var destroyed = false;
      var destroy = function(){
        if (destroyed) return;
        destroyed = true;
        try { filter.disconnect(); } catch(e){}
        if (panner) try { panner.disconnect(); } catch(e){}
        try { gain.disconnect(); } catch(e){}
      };

      // Automatic safety timeout disconnection (prevents audio thread saturation & stutters)
      var timer = setTimeout(destroy, autoCleanupMs || 2500);

      return {
        input: filter,
        gain: gain,
        panner: panner,
        dist: d,
        pan: pan,
        dotFwd: dotFwd,
        destroy: function(){
          clearTimeout(timer);
          destroy();
        }
      };
    } catch(err) {
      return null;
    }
  },

  // ---- Loud Punchy Blasting Assault Rifle Gunshot ----
  gunshot: function(x, y, z){
    this.resume();
    if (!this.ctx) return;
    try {
      var outDest = this.master;
      var spat = null;
      if (x !== undefined && z !== undefined){
        spat = this.createSpatialNode(x, y, z, 6.0, 95.0, 1.0, 1200);
        if (!spat) return;
        outDest = spat.input;
      }

      if (this.playBuffer('gunshot', outDest, 1.2, 0.03, 0, spat) || 
          this.playBuffer('rifle_blast', outDest, 1.2, 0.03, 0, spat)){
        return;
      }

      var c = this.ctx, t = c.currentTime;
      var cleanList = [];

      var o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 0.14);
      var og = c.createGain();
      og.gain.setValueAtTime(1.4, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(og);
      og.connect(outDest);
      o.start(t);
      o.stop(t + 0.17);
      cleanList.push(o, og);

      if (this.noiseBuf){
        var src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        var bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 0.85;
        bp.frequency.setValueAtTime(3800, t);
        bp.frequency.exponentialRampToValueAtTime(480, t + 0.095);
        var g = c.createGain();
        g.gain.setValueAtTime(1.45, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        src.connect(bp);
        bp.connect(g);
        g.connect(outDest);
        if (this.echo && outDest === this.master){
          var eg = c.createGain();
          eg.gain.value = 0.42;
          g.connect(eg);
          eg.connect(this.echo);
          cleanList.push(eg);
        }
        src.start(t);
        cleanList.push(src, bp, g);
      }

      this.click(0.38, 1700, 0.035);
      this.click(0.30, 720, 0.045);
      this._cleanupNodes(cleanList, 250);
      if (spat) setTimeout(function(){ spat.destroy(); }, 250);
    } catch(e) {}
  },

  // ---- Modern Warfare / Tarkov Tactical Suppressed Shot ----
  silencedShot: function(){
    this.resume();
    if (!this.ctx) return;
    try {
      if (this.playBuffer('gunshot_suppressed', this.master, 1.15, 0.03)){
        return;
      }

      var c = this.ctx, t = c.currentTime;
      var cleanList = [];

      if (this.noiseBuf){
        var snapSrc = c.createBufferSource();
        snapSrc.buffer = this.noiseBuf;
        var snapFilt = c.createBiquadFilter();
        snapFilt.type = 'bandpass';
        snapFilt.Q.value = 1.8;
        snapFilt.frequency.setValueAtTime(1350, t);
        snapFilt.frequency.exponentialRampToValueAtTime(420, t + 0.026);
        var snapGain = c.createGain();
        snapGain.gain.setValueAtTime(0.85, t);
        snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
        snapSrc.connect(snapFilt);
        snapFilt.connect(snapGain);
        snapGain.connect(this.master);
        snapSrc.start(t);
        cleanList.push(snapSrc, snapFilt, snapGain);
      }

      var oSub = c.createOscillator();
      oSub.type = 'sine';
      oSub.frequency.setValueAtTime(145, t);
      oSub.frequency.exponentialRampToValueAtTime(36, t + 0.072);
      var oSubGain = c.createGain();
      oSubGain.gain.setValueAtTime(1.1, t);
      oSubGain.gain.exponentialRampToValueAtTime(0.001, t + 0.082);
      oSub.connect(oSubGain);
      oSubGain.connect(this.master);
      oSub.start(t);
      oSub.stop(t + 0.085);
      cleanList.push(oSub, oSubGain);

      var oBolt = c.createOscillator();
      oBolt.type = 'triangle';
      oBolt.frequency.setValueAtTime(780, t);
      oBolt.frequency.exponentialRampToValueAtTime(220, t + 0.02);
      var gBolt = c.createGain();
      gBolt.gain.setValueAtTime(0.28, t);
      gBolt.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
      oBolt.connect(gBolt);
      gBolt.connect(this.master);
      oBolt.start(t);
      oBolt.stop(t + 0.025);
      cleanList.push(oBolt, gBolt);

      if (this.echo){
        var echoSend = c.createGain();
        echoSend.gain.setValueAtTime(0.18, t);
        echoSend.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        oSubGain.connect(echoSend);
        echoSend.connect(this.echo);
        cleanList.push(echoSend);
      }
      this._cleanupNodes(cleanList, 150);
    } catch(e) {}
  },

  // Tactical Multi-Stage Reload Sound Design
  reload: function(){
    this.resume();
    if (!this.ctx) return;
    if (this.playBuffer('reload', this.master, 0.95, 0.0)) return;
    try {
      var self = this;
      this.click(0.32, 1300, 0.035);
      setTimeout(function(){ self.click(0.24, 850, 0.045); }, 280);
      setTimeout(function(){
        self.click(0.42, 680, 0.05);
        self.click(0.35, 1400, 0.035);
      }, 950);
      setTimeout(function(){
        self.click(0.48, 1600, 0.04);
        self.click(0.38, 920, 0.05);
      }, 1350);
    } catch(e) {}
  },

  dryFire: function(){
    this.resume();
    if (!this.ctx) return;
    if (this.playBuffer('dry_fire', this.sfxGain || this.master, 0.85, 0.03)) return;
    this.click(0.38, 1600, 0.035);
    var self = this;
    setTimeout(function(){ self.click(0.22, 540, 0.045); }, 45);
  },

  shotgun: function(x, y, z){
    this.resume();
    if (!this.ctx) return;
    try {
      var outDest = this.sfxGain || this.master;
      var spat = null;
      if (x !== undefined && z !== undefined){
        spat = this.createSpatialNode(x, y, z, 7.0, 110.0, 1.0, 1200);
        if (spat) outDest = spat.input;
      }
      if (!this.playBuffer('shotgun', outDest, 1.35, 0.03, 0, spat)){
        this.gunshot(x, y, z);
      }
    } catch(e) {}
  },

  shotgunPump: function(){
    if (!this.ctx) return;
    this.resume();
    try {
      if (!this.playBuffer('shotgun_reload', this.sfxGain || this.master, 1.0, 0.03)){
        this.click(0.42, 1150, 0.035);
      }
    } catch(e) {}
  },

  shotgunReload: function(){
    if (!this.ctx) return;
    this.resume();
    try {
      if (!this.playBuffer('shotgun_reload', this.sfxGain || this.master, 1.15, 0.02)){
        this.reload();
      }
    } catch(e) {}
  },

  shotgunEquip: function(){
    if (!this.ctx) return;
    this.resume();
    try {
      if (!this.playBuffer('shotgun_reload', this.sfxGain || this.master, 0.85, 0.04)){
        this.click(0.35, 1100, 0.04);
      }
    } catch(e) {}
  },

  magnum: function(x, y, z){
    this.resume();
    if (!this.ctx) return;
    try {
      var outDest = this.sfxGain || this.master;
      var spat = null;
      if (x !== undefined && z !== undefined){
        spat = this.createSpatialNode(x, y, z, 7.0, 115.0, 1.0, 1200);
        if (spat) outDest = spat.input;
      }
      if (!this.playBuffer('magnum', outDest, 1.35, 0.03, 0, spat)){
        this.gunshot(x, y, z);
      }
    } catch(e) {}
  },

  magnumCock: function(){
    if (!this.ctx) return;
    this.resume();
    try {
      this.click(0.35, 2150, 0.022);
    } catch(e) {}
  },

  magnumReload: function(isEmpty){
    if (!this.ctx) return;
    this.resume();
    try {
      if (!this.playBuffer('magnum_reload', this.sfxGain || this.master, 1.2, 0.02)){
        this.reload();
      }
    } catch(e) {}
  },

  magnumEquip: function(){
    if (!this.ctx) return;
    this.resume();
    try {
      this.click(0.32, 1400, 0.03);
    } catch(e) {}
  },

  // Pulsing Low-Health Heartbeat with automatic gain disconnection
  heartbeat: function(intensity){
    if (!this.ctx) return;
    try {
      var c = this.ctx, t = c.currentTime;
      var outDest = this.sfxGain || this.master;
      var vol = clamp((typeof intensity === 'number' ? intensity : 0.6) * 1.2, 0.2, 1.2);

      // Pulse 1: 'Lub'
      var o1 = c.createOscillator();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(62, t);
      o1.frequency.exponentialRampToValueAtTime(36, t + 0.11);
      var g1 = c.createGain();
      g1.gain.setValueAtTime(vol, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      o1.connect(g1);
      g1.connect(outDest);
      o1.start(t);
      o1.stop(t + 0.14);
      this._cleanupNodes([o1, g1], 160);

      // Pulse 2: 'Dub'
      var t2 = t + 0.12;
      var o2 = c.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(50, t2);
      o2.frequency.exponentialRampToValueAtTime(30, t2 + 0.13);
      var g2 = c.createGain();
      g2.gain.setValueAtTime(vol * 0.75, t2);
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.15);
      o2.connect(g2);
      g2.connect(outDest);
      o2.start(t2);
      o2.stop(t2 + 0.16);
      this._cleanupNodes([o2, g2], 300);
    } catch(e) {}
  },

  weaponPickup: function(){
    this.resume();
    if (!this.ctx) return;
    try {
      var c = this.ctx, t = c.currentTime;
      var outDest = this.sfxGain || this.master;

      this.click(0.45, 1450, 0.04);
      var self = this;
      setTimeout(function(){
        self.click(0.55, 1950, 0.03);
        self.click(0.38, 720, 0.05);
      }, 120);

      var o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(520, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(1040, t + 0.28);
      var g = c.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.28, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g);
      g.connect(outDest);
      o.start(t + 0.05);
      o.stop(t + 0.48);
      this._cleanupNodes([o, g], 520);
    } catch(e) {}
  },

  // 3D Positional Surface Impacts
  impactConcrete: function(x, y, z){
    if (!this.ctx) return;
    var spat = this.createSpatialNode(x, y, z, 2.5, 45.0, 1.2, 120);
    if (!spat) return;
    if (this.playBuffer('impact_concrete', spat.input, 0.85, 0.08, 0, spat)) return;
    var c = this.ctx, t = c.currentTime;
    var o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.05);
    var g = c.createGain(); g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g); g.connect(spat.input);
    o.start(t); o.stop(t + 0.065);

    var clean = [o, g];
    var buf = this.noiseBuf;
    if (buf){
      var src = c.createBufferSource(); src.buffer = buf;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1.2;
      var ng = c.createGain(); ng.gain.setValueAtTime(0.35, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      src.connect(bp); bp.connect(ng); ng.connect(spat.input);
      src.start(t);
      clean.push(src, bp, ng);
    }
    this._cleanupNodes(clean, 100);
    setTimeout(function(){ spat.destroy(); }, 120);
  },

  impactMetal: function(x, y, z){
    if (!this.ctx) return;
    var spat = this.createSpatialNode(x, y, z, 3.0, 50.0, 1.1, 220);
    if (!spat) return;
    if (this.playBuffer('impact_metal', spat.input, 0.85, 0.08, 0, spat)) return;
    var c = this.ctx, t = c.currentTime;
    var o = c.createOscillator(); o.type = 'sine';
    var startF = 3600 + Math.random() * 1000;
    o.frequency.setValueAtTime(startF, t);
    o.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 600, t + 0.16);
    var g = c.createGain(); g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(spat.input);
    o.start(t); o.stop(t + 0.19);
    this._cleanupNodes([o, g], 210);
    setTimeout(function(){ spat.destroy(); }, 220);
  },

  impactWood: function(x, y, z){
    if (!this.ctx) return; var c = this.ctx, t = c.currentTime;
    var spat = this.createSpatialNode(x, y, z, 3.0, 45.0, 1.2, 120);
    if (!spat) return;
    var o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    var g = c.createGain(); g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g); g.connect(spat.input);
    o.start(t); o.stop(t + 0.095);
    this._cleanupNodes([o, g], 110);
    setTimeout(function(){ spat.destroy(); }, 120);
  },

  impactFlesh: function(x, y, z){
    if (!this.ctx) return;
    var spat = (x !== undefined && z !== undefined) ? this.createSpatialNode(x, y, z, 2.5, 40.0, 1.2, 140) : null;
    var outDest = spat ? spat.input : this.master;
    if (this.playBuffer('impact_flesh', outDest, 0.9, 0.08, 0, spat)) return;
    var c = this.ctx, t = c.currentTime;
    var o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    var g = c.createGain(); g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(outDest);
    o.start(t); o.stop(t + 0.11);
    this._cleanupNodes([o, g], 120);
    if (spat) setTimeout(function(){ spat.destroy(); }, 140);
  },

  hitFlesh: function(){
    this.impactFlesh();
  },

  // 3D Positional Zombie Soundscapes with concurrency limiting (max 3 growls)
  _activeGrowls: 0,
  zombieGrowl: function(vol, subType, x, y, z){
    if (!this.ctx) return;
    if (this._activeGrowls >= 3) return; // Prevent voice explosion & stutters
    this._activeGrowls++;
    var self = this;
    var onDone = function(){
      self._activeGrowls = Math.max(0, self._activeGrowls - 1);
    };

    try {
      var baseVol = vol || 0.6;
      var outDest = this.master;
      var spat = null;

      if (x !== undefined && z !== undefined){
        spat = this.createSpatialNode(x, y, z, 2.8, 38.0, 1.15, 3000);
        if (!spat){
          onDone();
          return;
        }
        outDest = spat.input;
        baseVol *= 1.2;
      }

      var sampleKey = 'zombie_growl_1';
      if (subType === 'brute') sampleKey = 'zombie_brute';
      else if (subType === 'sprinter') sampleKey = 'zombie_sprinter';
      else if (Math.random() < 0.5 && this.buffers['zombie_growl_2']) sampleKey = 'zombie_growl_2';

      if (this.playBuffer(sampleKey, outDest, baseVol, 0.08, 0, spat)){
        setTimeout(onDone, 2000);
        return;
      }

      var c = this.ctx, t = c.currentTime;
      var dur = 1.0;
      var nodesToClean = [];

      if (subType === 'brute'){
        dur = 1.5;
        var o = c.createOscillator(); o.type = 'sawtooth';
        var f = _rand(42, 62);
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * 0.75, t + 1.4);
        var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
        var g = c.createGain(); g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(baseVol * 1.8, t + 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        o.connect(lp); lp.connect(g); g.connect(outDest);
        o.start(t); o.stop(t + 1.45);
        nodesToClean.push(o, lp, g);
      } else if (subType === 'sprinter'){
        dur = 0.6;
        var o = c.createOscillator(); o.type = 'sawtooth';
        var f = _rand(240, 360);
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.12);
        o.frequency.linearRampToValueAtTime(f * 0.65, t + 0.48);
        var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 1.2;
        var g = c.createGain(); g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(baseVol * 1.3, t + 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
        o.connect(bp); bp.connect(g); g.connect(outDest);
        o.start(t); o.stop(t + 0.55);
        nodesToClean.push(o, bp, g);
      } else {
        dur = 1.2;
        var o = c.createOscillator(); o.type = 'sawtooth';
        var f = _rand(68, 110);
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 1.0);
        var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
        var g = c.createGain(); g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(baseVol * 1.15, t + 0.14);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

        var lfo = c.createOscillator(); lfo.frequency.value = _rand(8.5, 13.5);
        var lg = c.createGain(); lg.gain.value = f * 0.3;
        lfo.connect(lg); lg.connect(o.frequency);
        o.connect(lp); lp.connect(g); g.connect(outDest);
        o.start(t); o.stop(t + 1.15); lfo.start(t); lfo.stop(t + 1.15);
        nodesToClean.push(o, lfo, lg, lp, g);
      }
      var cleanDelay = Math.ceil(dur * 1000) + 100;
      this._cleanupNodes(nodesToClean, cleanDelay);
      if (spat) setTimeout(function(){ spat.destroy(); }, cleanDelay);
      setTimeout(onDone, cleanDelay);
    } catch(e) {
      onDone();
    }
  },

  zombieAttack: function(x, y, z, subType){
    if (!this.ctx) return;
    try {
      var spat = this.createSpatialNode(x, y, z, 2.0, 30.0, 1.3, 140);
      if (!spat) return;
      if (this.playBuffer('zombie_attack', spat.input, 0.85, 0.08, 0, spat)) return;
      var c = this.ctx, t = c.currentTime;
      this.click(0.45, 1800, 0.03);
      var o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(380, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.08);
      var g = c.createGain(); g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g); g.connect(spat.input);
      o.start(t); o.stop(t + 0.1);
      this._cleanupNodes([o, g], 120);
      setTimeout(function(){ spat.destroy(); }, 140);
    } catch(e) {}
  },

  // Positional footstep rustle throttled globally (~8/sec max) and node-cleaned
  _lastStepTime: 0,
  zombieStep: function(x, y, z, subType){
    if (!this.ctx) return;
    var now = performance.now();
    if (now - this._lastStepTime < 120) return; // Prevent footstep sound flooding
    this._lastStepTime = now;

    try {
      var spat = this.createSpatialNode(x, y, z, 2.0, 18.0, 1.4, 180);
      if (!spat) return;
      var c = this.ctx, t = c.currentTime;
      var isSprinter = (subType === 'sprinter');
      if (this.noiseBuf){
        var src = c.createBufferSource(); src.buffer = this.noiseBuf;
        var bp = c.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = isSprinter ? 750 : 420; bp.Q.value = 1.6;
        var g = c.createGain(); g.gain.setValueAtTime(isSprinter ? 0.22 : 0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (isSprinter ? 0.04 : 0.07));
        src.connect(bp); bp.connect(g); g.connect(spat.input);
        src.start(t);
        this._cleanupNodes([src, bp, g], isSprinter ? 60 : 90);
        setTimeout(function(){ spat.destroy(); }, 180);
      }
    } catch(e) {}
  },

  hurt: function(){
    if (!this.ctx) return; var c=this.ctx, t=c.currentTime;
    var o=c.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(180,t);
    o.frequency.exponentialRampToValueAtTime(90,t+0.2);
    var g=c.createGain(); g.gain.setValueAtTime(0.2,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.3);
    this._cleanupNodes([o, g], 320);
  },

  // Real Recorded Dual-Engine Audio
  engine: null,
  engineStart: function(carType){
    this.resume();
    if (!this.ctx) return;
    var c = this.ctx, t = c.currentTime;
    var outDest = this.master;

    if (this.engine){
      this.engineStop();
    }

    var type = carType || 'amg';
    var engKey = 'engine_' + type;
    var startKey = 'engine_start_' + type;

    var engineVol = (window.G && G.settings && typeof G.settings.engineVol === 'number') ? G.settings.engineVol : 0.85;

    if (this.buffers[startKey]){
      this.playBuffer(startKey, outDest, 0.72 * engineVol, 0.0);
    }

    var gainNode = c.createGain();
    gainNode.gain.setValueAtTime(0.001, t);
    gainNode.gain.linearRampToValueAtTime((type === 'demon' ? 0.28 : 0.24) * engineVol, t + 0.35);
    gainNode.connect(outDest);

    var src = null;
    var buffer = this.buffers[engKey];
    if (buffer){
      src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.playbackRate.setValueAtTime(type === 'demon' ? 0.82 : 0.88, t);
      src.connect(gainNode);
      src.start(t);
    }

    this.engine = {
      type: type,
      src: src,
      gain: gainNode,
      engKey: engKey,
      startTime: t,
      active: true,
      lastRpm: 0,
      _lastRate: 0,
      _lastVol: 0
    };

    if (!src && !buffer){
      var self = this;
      var pollCheck = setInterval(function(){
        if (!self.engine || !self.engine.active || self.engine.type !== type){
          clearInterval(pollCheck);
          return;
        }
        if (self.buffers[engKey]){
          clearInterval(pollCheck);
          if (!self.engine.src && self.ctx){
            var curT = self.ctx.currentTime;
            var newSrc = self.ctx.createBufferSource();
            newSrc.buffer = self.buffers[engKey];
            newSrc.loop = true;
            newSrc.playbackRate.setValueAtTime(type === 'demon' ? 0.82 : 0.88, curT);
            newSrc.connect(self.engine.gain);
            newSrc.start(curT);
            self.engine.src = newSrc;
          }
        }
      }, 100);
    }
  },

  // Optimized engine modulation with deadband thresholds (eliminates 120 timeline events/sec)
  engineUpdate: function(rpm, running, carType, speed){
    if (!this.engine || !this.ctx) return;
    var t = this.ctx.currentTime;
    rpm = _clamp(rpm, 0, 1);

    var eng = this.engine;
    eng.lastRpm = rpm;
    var isDemon = (eng.type === 'demon');

    if (!running){
      if (eng.gain && eng.gain.gain && eng._lastVol !== 0){
        eng._lastVol = 0;
        eng.gain.gain.setTargetAtTime(0.0001, t, 0.12);
      }
      return;
    }

    var modEnabled = (window.G && G.settings && typeof G.settings.rpmModEnabled === 'boolean') ? G.settings.rpmModEnabled : true;
    var modIntensity = (window.G && G.settings && typeof G.settings.rpmIntensity === 'number') ? G.settings.rpmIntensity : 1.0;
    var engineVol = (window.G && G.settings && typeof G.settings.engineVol === 'number') ? G.settings.engineVol : 0.85;

    var baseRate = isDemon ? 0.82 : 0.88;
    var maxRate = isDemon ? 1.28 : 1.36;
    var effectiveRpm = modEnabled ? (rpm * modIntensity) : 0;
    var targetRate = baseRate + effectiveRpm * (maxRate - baseRate);

    var baseVol = (isDemon ? 0.25 : 0.22) * engineVol;
    var fullVol = (isDemon ? 0.50 : 0.45) * engineVol;
    var targetVol = baseVol + (modEnabled ? rpm : 0.35) * (fullVol - baseVol);

    // Deadband check: Only schedule WebAudio automation if value has noticeably changed!
    if (eng.src && eng.src.playbackRate){
      if (Math.abs((eng._lastRate || 0) - targetRate) > 0.008){
        eng._lastRate = targetRate;
        eng.src.playbackRate.setTargetAtTime(targetRate, t, 0.08);
      }
    }
    if (eng.gain && eng.gain.gain){
      if (Math.abs((eng._lastVol || 0) - targetVol) > 0.008){
        eng._lastVol = targetVol;
        eng.gain.gain.setTargetAtTime(targetVol, t, 0.08);
      }
    }
  },

  setEngineVolume: function(val){
    if (this.engine && this.engine.active && this.ctx){
      this.engineUpdate(this.engine.lastRpm || 0, true, this.engine.type, 0);
    }
  },

  setRpmModulation: function(enabled, intensity){
    if (this.engine && this.engine.active && this.ctx){
      this.engineUpdate(this.engine.lastRpm || 0, true, this.engine.type, 0);
    }
  },

  engineStop: function(){
    if (!this.engine || !this.ctx) return;
    var eng = this.engine;
    this.engine = null;
    eng.active = false;
    try {
      var t = this.ctx.currentTime;
      if (eng.gain && eng.gain.gain){
        eng.gain.gain.setTargetAtTime(0.0001, t, 0.15);
      }
      setTimeout(function(){
        if (eng.src){
          try {
            eng.src.stop();
            eng.src.disconnect();
          } catch(e) {}
        }
        if (eng.gain){
          try { eng.gain.disconnect(); } catch(e) {}
        }
      }, 200);
    } catch(e) {}
  },

  radioBlip: function(){
    var self=this;
    this.click(0.12, 1400, 0.04);
    setTimeout(function(){ self.click(0.1, 700, 0.05); }, 90);
  },

  pickup: function(){
    var self=this;
    this.click(0.15, 900, 0.04);
    setTimeout(function(){ self.click(0.2, 1400, 0.05); }, 80);
    setTimeout(function(){ self.click(0.25, 1800, 0.06); }, 160);
  },

  duskSiren: function(){
    if (!this.ctx) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    var o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(320, t);
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(750, t);

    var g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.38, t + 0.4);
    g.gain.setValueAtTime(0.38, t + 2.8);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.8);

    var lfo = c.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = 0.35;
    var lg = c.createGain();
    lg.gain.value = 160;
    lfo.connect(lg);
    lg.connect(o.frequency);

    o.connect(lp);
    lp.connect(g);
    g.connect(this.master);

    o.start(t); o.stop(t + 4.0);
    lfo.start(t); lfo.stop(t + 4.0);
    this._cleanupNodes([o, lfo, lg, lp, g], 4100);
  },

  // Roadkill impact crunch & splatter (uses pre-baked crunchBuf, zero allocation)
  roadkillCrunch: function(intensity){
    if (!this.ctx) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    var scale = clamp(intensity || 1.0, 0.4, 2.0);

    var thud = c.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(140, t);
    thud.frequency.exponentialRampToValueAtTime(28, t + 0.28);
    var tg = c.createGain();
    tg.gain.setValueAtTime(0.65 * scale, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    thud.connect(tg);
    tg.connect(this.master);
    thud.start(t); thud.stop(t + 0.32);

    var cleanList = [thud, tg];
    if (this.crunchBuf){
      var noise = c.createBufferSource();
      noise.buffer = this.crunchBuf;
      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 520;
      bp.Q.value = 1.8;
      var ng = c.createGain();
      ng.gain.setValueAtTime(0.55 * scale, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(this.master);
      noise.start(t);
      cleanList.push(noise, bp, ng);
    }
    this._cleanupNodes(cleanList, 350);
  },

  hordeAlert: function(){
    if (!this.ctx) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    var freqs = [110, 147, 156];
    var cleanList = [];
    for (var i = 0; i < freqs.length; i++){
      var freq = freqs[i];
      var osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, t + 1.8);
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320 + i * 80, t);
      var g = c.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      cleanList.push(osc, lp, g);
      if (this.echo){
        var eg = c.createGain(); eg.gain.value = 0.35;
        g.connect(eg); eg.connect(this.echo);
        cleanList.push(eg);
      }
      osc.start(t); osc.stop(t + 2.0);
    }
    this._cleanupNodes(cleanList, 2100);
  },

  // Rushing high-pressure water fountain (uses pre-baked waterBuf, zero allocation)
  waterHiss: function(vol){
    if (!this.ctx || !this.waterBuf) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    var src = c.createBufferSource();
    src.buffer = this.waterBuf;

    var bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, t);
    bp.Q.value = 1.4;

    var gain = c.createGain();
    var v = clamp(vol || 0.28, 0.05, 0.5);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(v, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.master);
    src.start(t);
    this._cleanupNodes([src, bp, gain], 480);
  },

  // Squealing tire friction / rubber drift screech (uses pre-baked screechBuf, zero allocation)
  lastScreech: 0,
  tireScreech: function(){
    if (!this.ctx || !this.screechBuf) return;
    var now = performance.now();
    if (now - this.lastScreech < 180) return;
    this.lastScreech = now;
    this.resume();
    var c = this.ctx, t = c.currentTime;

    var src = c.createBufferSource();
    src.buffer = this.screechBuf;

    var bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(950 + rand(-100, 100), t);
    bp.frequency.linearRampToValueAtTime(1250, t + 0.25);
    bp.Q.value = 4.5;

    var g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.31);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    this._cleanupNodes([src, bp, g], 350);
  },

  propImpact: function(isMetal){
    if (!this.ctx) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    var osc = c.createOscillator();
    osc.type = isMetal ? 'triangle' : 'sine';
    var freq = isMetal ? rand(420, 680) : rand(180, 260);
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.18);

    var g = c.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
    this._cleanupNodes([osc, g], 230);
  },

  hammerWood: function(){
    if (!this.ctx) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    var m = c.createOscillator();
    m.type = 'triangle';
    m.frequency.setValueAtTime(2400, t);
    m.frequency.exponentialRampToValueAtTime(700, t + 0.035);
    var mg = c.createGain();
    mg.gain.setValueAtTime(0.35, t);
    mg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    m.connect(mg); mg.connect(this.master);
    m.start(t); m.stop(t + 0.045);

    var w = c.createOscillator();
    w.type = 'sine';
    w.frequency.setValueAtTime(320, t);
    w.frequency.exponentialRampToValueAtTime(110, t + 0.12);
    var wg = c.createGain();
    wg.gain.setValueAtTime(0.42, t);
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    w.connect(wg); wg.connect(this.master);
    w.start(t); w.stop(t + 0.15);
    this._cleanupNodes([m, mg, w, wg], 160);
  },

  // Wood splintering (uses pre-baked woodBuf, zero allocation)
  woodSplinter: function(){
    if (!this.ctx) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    var cleanList = [];

    if (this.woodBuf){
      var src = c.createBufferSource();
      src.buffer = this.woodBuf;
      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(850 + rand(-150, 150), t);
      bp.frequency.linearRampToValueAtTime(350, t + 0.15);
      bp.Q.value = 1.8;

      var g = c.createGain();
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);

      src.connect(bp); bp.connect(g); g.connect(this.master);
      src.start(t);
      cleanList.push(src, bp, g);
    }

    var o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.14);
    var og = c.createGain();
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 0.16);
    cleanList.push(o, og);
    this._cleanupNodes(cleanList, 180);
  },

  ammoResupply: function(){
    if (!this.ctx) return;
    this.resume();
    this.click(0.28, 1600, 0.05);
    var self = this;
    setTimeout(function(){ self.click(0.2, 2200, 0.04); }, 70);
    setTimeout(function(){ self.click(0.24, 1100, 0.06); }, 140);
  },

  workbenchUpgrade: function(){
    if (!this.ctx) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    var cleanList = [];
    for (var i = 0; i < 3; i++){
      var tt = t + i * 0.06;
      var o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(1200 + i * 200, tt);
      var g = c.createGain();
      g.gain.setValueAtTime(0.35, tt);
      g.gain.exponentialRampToValueAtTime(0.001, tt + 0.04);
      o.connect(g); g.connect(this.master);
      o.start(tt); o.stop(tt + 0.045);
      cleanList.push(o, g);
    }
    setTimeout(function(){
      if (!c) return;
      var now = c.currentTime;
      var ch = c.createOscillator();
      ch.type = 'sine';
      ch.frequency.setValueAtTime(880, now);
      ch.frequency.exponentialRampToValueAtTime(1760, now + 0.35);
      var cg = c.createGain();
      cg.gain.setValueAtTime(0.001, now);
      cg.gain.linearRampToValueAtTime(0.35, now + 0.06);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      ch.connect(cg); cg.connect(AudioSys.master);
      ch.start(now); ch.stop(now + 0.45);
      cleanList.push(ch, cg);
    }, 200);
    this._cleanupNodes(cleanList, 700);
  },

  trunkOpen: function(){
    if (!this.ctx) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    this.click(0.38, 1400, 0.04);
    var self = this;
    setTimeout(function(){
      if (!c) return;
      var now = c.currentTime;
      var o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(160, now);
      o.frequency.exponentialRampToValueAtTime(320, now + 0.28);
      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 520;
      var g = c.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.24, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      o.connect(bp); bp.connect(g); g.connect(AudioSys.master);
      o.start(now); o.stop(now + 0.32);
      self._cleanupNodes([o, bp, g], 350);
    }, 45);
  },

  scavengeSearch: function(){
    if (!this.ctx) return;
    this.resume();
    var self = this;
    for (var i = 0; i < 4; i++){
      (function(idx){
        setTimeout(function(){
          self.click(0.18 + Math.random() * 0.12, 1800 + Math.random() * 1200, 0.035);
        }, idx * 75);
      })(i);
    }
  },

  // Continuous rain audio with deadband volume updates (uses pre-baked rainBuf, zero allocations)
  rainGain: null,
  rainSource: null,
  _lastRainVol: -1,
  rainSound: function(vol){
    if (!this.ctx) return;
    var targetVol = clamp(vol || 0, 0, 0.4);
    if (!this.rainSource){
      var c = this.ctx;
      var buf = this.rainBuf || this.noiseBuf;
      var src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      var lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;

      var gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, c.currentTime);

      src.connect(lp);
      lp.connect(gain);
      gain.connect(this.master);
      src.start();

      this.rainSource = src;
      this.rainGain = gain;
    }
    if (this.rainGain && Math.abs((this._lastRainVol || 0) - targetVol) > 0.012){
      this._lastRainVol = targetVol;
      this.rainGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.4);
    }
  },

  thunder: function(isClose){
    if (!this.ctx) return;
    this.resume();
    var c = this.ctx, t = c.currentTime;
    var dur = isClose ? 3.5 : 5.0;

    var o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(isClose ? 95 : 65, t);
    o.frequency.exponentialRampToValueAtTime(32, t + dur);

    var og = c.createGain();
    og.gain.setValueAtTime(0.001, t);
    og.gain.linearRampToValueAtTime(isClose ? 0.9 : 0.55, t + 0.15);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur);

    o.connect(og);
    og.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.1);

    var cleanList = [o, og];
    if (this.noiseBuf){
      var src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(isClose ? 450 : 260, t);
      var ng = c.createGain();
      ng.gain.setValueAtTime(0.001, t);
      ng.gain.linearRampToValueAtTime(isClose ? 0.8 : 0.45, t + 0.12);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      src.connect(lp);
      lp.connect(ng);
      ng.connect(this.master);
      src.start(t);
      cleanList.push(src, lp, ng);
    }
    this._cleanupNodes(cleanList, Math.ceil(dur * 1000) + 200);
  },

  zombieDeath: function(x, y, z, subType){
    if (!this.ctx) return;
    try {
      var spat = (x !== undefined && z !== undefined) ? this.createSpatialNode(x, y, z, 3.5, 45.0, 1.15, 2000) : null;
      var outDest = spat ? spat.input : this.master;
      if (this.playBuffer('zombie_death', outDest, 0.9, 0.06, 0, spat)) return;
      this.zombieGrowl(0.35, subType, x, y, z);
    } catch(e) {}
  },

  doorCreak: function(isOpen){
    if (!this.ctx) return;
    this.resume();
    if (this.playBuffer('door_creak', this.master, 0.85, 0.04)) return;
    var c = this.ctx, t = c.currentTime;
    var o = c.createOscillator();
    o.type = 'sawtooth';
    var startF = isOpen ? 120 : 280;
    var endF = isOpen ? 310 : 90;
    o.frequency.setValueAtTime(startF, t);
    o.frequency.exponentialRampToValueAtTime(endF, t + 0.35);

    var bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 450;
    bp.Q.value = 3.5;

    var g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    o.connect(bp); bp.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.4);
    var cleanList = [o, bp, g];

    if (!isOpen){
      setTimeout(function(){
        if (!c) return;
        var now = c.currentTime;
        var thud = c.createOscillator();
        thud.type = 'triangle';
        thud.frequency.setValueAtTime(140, now);
        thud.frequency.exponentialRampToValueAtTime(45, now + 0.12);
        var tg = c.createGain();
        tg.gain.setValueAtTime(0.4, now);
        tg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        thud.connect(tg); tg.connect(AudioSys.master);
        thud.start(now); thud.stop(now + 0.15);
        AudioSys._cleanupNodes([thud, tg], 160);
      }, 250);
    }
    this._cleanupNodes(cleanList, 450);
  },

  spitterSpit: function(x, y, z){
    if (!this.ctx) return;
    this.resume();
    try {
      var spat = (x !== undefined && z !== undefined) ? this.createSpatialNode(x, y, z, 4.0, 50.0, 1.1, 400) : null;
      var outDest = spat ? spat.input : this.master;
      var c = this.ctx, t = c.currentTime;
      var cleanList = [];

      var o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(260, t);
      o.frequency.exponentialRampToValueAtTime(85, t + 0.28);
      var f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(320, t + 0.28);
      var g = c.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.45, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(f); f.connect(g); g.connect(outDest);
      o.start(t); o.stop(t + 0.32);
      cleanList.push(o, f, g);

      if (this.noiseBuf){
        var src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        var bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2400, t + 0.06);
        bp.frequency.exponentialRampToValueAtTime(800, t + 0.28);
        bp.Q.value = 2.8;
        var ng = c.createGain();
        ng.gain.setValueAtTime(0.001, t + 0.06);
        ng.linearRampToValueAtTime(0.55, t + 0.1);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        src.connect(bp); bp.connect(ng); ng.connect(outDest);
        src.start(t + 0.06);
        cleanList.push(src, bp, ng);
      }
      this._cleanupNodes(cleanList, 350);
      if (spat) setTimeout(function(){ spat.destroy(); }, 380);
    } catch(e) {}
  },

  acidSizzle: function(x, y, z){
    if (!this.ctx) return;
    this.resume();
    try {
      var spat = (x !== undefined && z !== undefined) ? this.createSpatialNode(x, y, z, 3.0, 40.0, 1.2, 400) : null;
      var outDest = spat ? spat.input : this.master;

      if (this.noiseBuf){
        var c = this.ctx, t = c.currentTime;
        var src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        var hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(1800, t);
        var bp = c.createBiquadFilter();
        bp.type = 'peaking';
        bp.frequency.setValueAtTime(3600, t);
        bp.gain.value = 6.0;
        var g = c.createGain();
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(outDest);
        src.start(t);
        this._cleanupNodes([src, hp, bp, g], 380);
      }
      if (spat) setTimeout(function(){ spat.destroy(); }, 400);
    } catch(e) {}
  },

  _lastAcidHiss: 0,
  acidHiss: function(){
    if (!this.ctx) return;
    this.resume();
    var now = Date.now();
    if (this._lastAcidHiss && now - this._lastAcidHiss < 220) return;
    this._lastAcidHiss = now;
    try {
      var c = this.ctx, t = c.currentTime;
      if (this.noiseBuf){
        var src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        var bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2800 + Math.random() * 800, t);
        bp.Q.value = 4.0;
        var g = c.createGain();
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        src.connect(bp); bp.connect(g); g.connect(this.master);
        src.start(t);
        this._cleanupNodes([src, bp, g], 240);
      }
    } catch(e) {}
  },

  bloaterExplode: function(x, y, z){
    if (!this.ctx) return;
    this.resume();
    try {
      var spat = (x !== undefined && z !== undefined) ? this.createSpatialNode(x, y, z, 5.0, 65.0, 1.0, 480) : null;
      var outDest = spat ? spat.input : this.master;
      var c = this.ctx, t = c.currentTime;
      var cleanList = [];

      var o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.3);
      var og = c.createGain();
      og.gain.setValueAtTime(0.9, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(og); og.connect(outDest);
      o.start(t); o.stop(t + 0.35);
      cleanList.push(o, og);

      if (this.noiseBuf){
        var src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        var lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1400, t);
        lp.frequency.exponentialRampToValueAtTime(260, t + 0.4);
        var ng = c.createGain();
        ng.gain.setValueAtTime(0.85, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        src.connect(lp); lp.connect(ng); ng.connect(outDest);
        src.start(t);
        cleanList.push(src, lp, ng);
      }
      this._cleanupNodes(cleanList, 460);
      if (spat) setTimeout(function(){ spat.destroy(); }, 480);
    } catch(e) {}
  },

  stalkerScreech: function(x, y, z){
    if (!this.ctx) return;
    this.resume();
    try {
      var spat = (x !== undefined && z !== undefined) ? this.createSpatialNode(x, y, z, 4.0, 60.0, 1.1, 550) : null;
      var outDest = spat ? spat.input : this.master;
      var c = this.ctx, t = c.currentTime;

      var o1 = c.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(740, t);
      o1.frequency.exponentialRampToValueAtTime(1420, t + 0.12);
      o1.frequency.exponentialRampToValueAtTime(380, t + 0.45);

      var o2 = c.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(755, t);
      o2.frequency.exponentialRampToValueAtTime(1450, t + 0.12);
      o2.frequency.exponentialRampToValueAtTime(390, t + 0.45);

      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1200, t);
      bp.Q.value = 3.0;

      var g = c.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.48, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

      o1.connect(bp); o2.connect(bp);
      bp.connect(g); g.connect(outDest);
      o1.start(t); o1.stop(t + 0.5);
      o2.start(t); o2.stop(t + 0.5);
      this._cleanupNodes([o1, o2, bp, g], 520);
      if (spat) setTimeout(function(){ spat.destroy(); }, 550);
    } catch(e) {}
  },

  stalkerDecloak: function(x, y, z){
    if (!this.ctx) return;
    this.resume();
    try {
      var spat = (x !== undefined && z !== undefined) ? this.createSpatialNode(x, y, z, 3.0, 35.0, 1.2, 350) : null;
      var outDest = spat ? spat.input : this.master;

      if (this.noiseBuf){
        var c = this.ctx, t = c.currentTime;
        var src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        var bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(800, t);
        bp.frequency.exponentialRampToValueAtTime(220, t + 0.28);
        bp.Q.value = 2.2;
        var g = c.createGain();
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        src.connect(bp); bp.connect(g); g.connect(outDest);
        src.start(t);
        this._cleanupNodes([src, bp, g], 320);
      }
      if (spat) setTimeout(function(){ spat.destroy(); }, 350);
    } catch(e) {}
  },

  convoyHorn: function(){
    if (!this.ctx) return;
    this.resume();
    try {
      var c = this.ctx, t = c.currentTime;
      var pitches = [174.6, 220.0];
      var cleanList = [];
      for (var i = 0; i < pitches.length; i++){
        var o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(pitches[i], t);
        var f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(850, t);
        var g = c.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.42, t + 0.08);
        g.gain.setValueAtTime(0.38, t + 1.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + 1.65);
        cleanList.push(o, f, g);
      }
      this._cleanupNodes(cleanList, 1750);
    } catch(e) {}
  },

  convoyTurret: function(x, y, z){
    if (!this.ctx) return;
    this.resume();
    try {
      var spat = (x !== undefined && z !== undefined) ? this.createSpatialNode(x, y, z, 8.0, 90.0, 0.9, 180) : null;
      var outDest = spat ? spat.input : this.master;
      var c = this.ctx, t = c.currentTime;
      var cleanList = [];

      var o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 0.12);
      var og = c.createGain();
      og.gain.setValueAtTime(0.9, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(og);
      og.connect(outDest);
      o.start(t);
      o.stop(t + 0.15);
      cleanList.push(o, og);

      if (this.noiseBuf){
        var src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        var bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2600, t);
        bp.frequency.exponentialRampToValueAtTime(450, t + 0.09);
        var ng = c.createGain();
        ng.gain.setValueAtTime(0.95, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
        src.connect(bp); bp.connect(ng); ng.connect(outDest);
        src.start(t);
        cleanList.push(src, bp, ng);
      }
      this._cleanupNodes(cleanList, 160);
      if (spat) setTimeout(function(){ spat.destroy(); }, 180);
    } catch(e) {}
  },

  relayBeaconBeep: function(x, y, z){
    if (!this.ctx) return;
    this.resume();
    try {
      var spat = (x !== undefined && z !== undefined) ? this.createSpatialNode(x, y, z, 5.0, 50.0, 1.0, 140) : null;
      var outDest = spat ? spat.input : this.master;
      var c = this.ctx, t = c.currentTime;

      var o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1760, t);
      o.frequency.exponentialRampToValueAtTime(2200, t + 0.08);
      var g = c.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g);
      g.connect(outDest);
      o.start(t);
      o.stop(t + 0.12);
      this._cleanupNodes([o, g], 130);
      if (spat) setTimeout(function(){ spat.destroy(); }, 140);
    } catch(e) {}
  }
};
