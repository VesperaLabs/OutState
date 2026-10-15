// Vespera - Player character (Mannequiny).
// Loads the Mannequiny GLB, manages animation states, follows the player.
// 3D character "Mannequiny" by GDQuest, Luciano Muñoz, and contributors
// Licensed under CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

var PlayerCharacter = {
  model: null,          // THREE.Group root
  mixer: null,          // AnimationMixer
  actions: {},          // name -> AnimationAction
  current: null,        // currently playing action name
  loaded: false,
  loadError: false,
  scale: 1.0,           // model scale; ~1.0 matches Mannequiny's 1.8m
  yawSmooth: 0,         // smoothed character yaw (we don't snap)
  posLerp: 12,          // position follow smoothing
  yawLerp: 10,          // yaw follow smoothing
  _tmpVec: new THREE.Vector3(),
  // map our internal state names to animation names in the GLB
  ANIM: {
    idle: 'idle',
    walk: 'walk',
    run: 'run',
    jump: 'air_jump'
  },

  init: function(){
    var self = this;
    if (typeof THREE.GLTFLoader === 'undefined'){
      console.error('[VESPERA] GLTFLoader missing — cannot load Mannequiny');
      this.loadError = true;
      this._buildPlaceholder();
      return;
    }
    console.log('[VESPERA] PlayerCharacter.init: starting GLB load...');
    // Reset state for reloads
    self._snapped = false;
    self.scaleX = 0.55; self.scaleY = 1.00; self.scaleZ = 0.55;
    var loader = new THREE.GLTFLoader();
    loader.load('assets/mannequiny-0.4.0.glb', function(gltf){
      console.log('[VESPERA] GLB file loaded. Scene children:', gltf.scene.children.length, 'Anims:', gltf.animations.length);
      // Wrap the model in a parent group so we control position/scale independently
      var wrapper = new THREE.Group();
      wrapper.name = 'PlayerCharacterWrapper';
      var raw = gltf.scene || gltf.scenes[0];
      // Mannequiny raw is 1.64 m wide and 1.80 m tall — that's 3x a real human's
      // shoulder width. Compress X and Z so the silhouette matches a normal person
      // (enemies are 0.42 m wide at scale 1.0).
      raw.scale.set(self.scaleX, self.scaleY, self.scaleZ);
      raw.frustumCulled = false;
      // Compute bounding box AFTER scale
      var box = new THREE.Box3().setFromObject(raw);
      var center = new THREE.Vector3();
      box.getCenter(center);
      var size = new THREE.Vector3();
      box.getSize(size);
      // raw offset so its feet are at y=0 and X/Z centered
      raw.position.x = -center.x;
      raw.position.y = -box.min.y;
      raw.position.z = -center.z;
      wrapper.add(raw);
      wrapper.frustumCulled = false;
      G.scene.add(wrapper);
      self.model = wrapper;
      console.log('[VESPERA] Character wrapper added at', wrapper.position.x.toFixed(1), wrapper.position.y.toFixed(1), wrapper.position.z.toFixed(1), 'size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));

      // animation mixer + actions
      self.mixer = new THREE.AnimationMixer(raw);
      if (gltf.animations){
        for (var i=0;i<gltf.animations.length;i++){
          var clip = gltf.animations[i];
          self.actions[clip.name] = self.mixer.clipAction(clip);
        }
      }
      self.loaded = true;
      self.play('idle', true);
      // Snap to player immediately
      self.model.position.set(G.player.pos.x, G.player.pos.y - Player.eyeH, G.player.pos.z);
      self.yawSmooth = G.player.yaw + Math.PI;
      self.model.rotation.y = self.yawSmooth;
      console.log('[VESPERA] Mannequiny READY. Anims:', Object.keys(self.actions).join(', '));
    }, undefined, function(err){
      console.error('[VESPERA] Mannequiny load error:', err);
      self.loadError = true;
      self._buildPlaceholder();
    });
  },

  // Fallback: build a simple visible character if the GLB fails
  _buildPlaceholder: function(){
    var wrapper = new THREE.Group();
    wrapper.name = 'PlayerCharacterPlaceholder';
    var inner = new THREE.Group();
    var skinM = new THREE.MeshLambertMaterial({ color: 0xc69a78 });
    var clothM = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    var pantsM = new THREE.MeshLambertMaterial({ color: 0x22252a });
    var bootM = new THREE.MeshLambertMaterial({ color: 0x111114 });
    // legs
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.2), pantsM);
    legL.position.set(-0.11, 0.425, 0); inner.add(legL);
    var legR = legL.clone(); legR.position.x = 0.11; inner.add(legR);
    // boots
    var bootL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.28), bootM);
    bootL.position.set(-0.11, 0.05, 0.05); inner.add(bootL);
    var bootR = bootL.clone(); bootR.position.x = 0.11; inner.add(bootR);
    // torso (jacket)
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.28), clothM);
    torso.position.set(0, 1.15, 0); inner.add(torso);
    // arms
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.16), clothM);
    armL.position.set(-0.33, 1.15, 0); inner.add(armL);
    var armR = armL.clone(); armR.position.x = 0.33; inner.add(armR);
    // head
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), skinM);
    head.position.set(0, 1.62, 0); inner.add(head);
    // neck
    var neck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), skinM);
    neck.position.set(0, 1.45, 0); inner.add(neck);
    wrapper.add(inner);
    wrapper.frustumCulled = false;
    G.scene.add(wrapper);
    this.model = wrapper;
    this.loaded = true;
    this.model.position.set(G.player.pos.x, G.player.pos.y - Player.eyeH, G.player.pos.z);
    this.yawSmooth = G.player.yaw + Math.PI;
    this.model.rotation.y = this.yawSmooth;
    console.log('[VESPERA] Placeholder character built (GLB unavailable)');
  },

  // play an animation; immediate=true jumps, else crossfade
  play: function(name, immediate){
    if (!this.loaded || !this.mixer) return;
    var clipName = this.ANIM[name] || name;
    var action = this.actions[clipName];
    if (!action){ return; }
    if (this.current === clipName) return;
    if (immediate){
      action.reset().play();
    } else {
      action.reset();
      action.crossFadeFrom(this.current ? this.actions[this.current] : action, 0.2, true);
      action.play();
    }
    this.current = clipName;
  },

  // State setter: choose animation based on gameplay state
  setState: function(state){
    if (!this.loaded) return;
    // state is one of: 'idle', 'walk', 'run', 'jump'
    this.play(state);
  },

  // Set the animation playback rate (e.g., scale up for sprint)
  setRate: function(rate){
    if (!this.loaded || !this.current) return;
    var action = this.actions[this.current];
    if (action) action.setEffectiveTimeScale(rate);
  },

  hide: function(){ if (this.model) this.model.visible = false; },
  show: function(){ if (this.model) this.model.visible = true; },

  update: function(dt){
    if (!this.loaded || !this.model) return;
    if (typeof G !== 'undefined' && G.player && G.player.inCar){
      this.hide();
      return;
    }
    // Advance the animation mixer
    this.mixer.update(dt);
    // Follow the player position smoothly
    var p = G.player;
    if (!p) return;
    // SNAP to player on the first frame after load (handles async race where
    // the wrapper was placed at world origin before main.js set the player pos)
    if (!this._snapped){
      this.model.position.set(p.pos.x, p.pos.y - Player.eyeH, p.pos.z);
      this.yawSmooth = p.yaw + Math.PI;
      this.model.rotation.y = this.yawSmooth;
      this._snapped = true;
      console.log('[VESPERA] Character snapped to player at', p.pos.x.toFixed(1), p.pos.y.toFixed(1), p.pos.z.toFixed(1));
      return;
    }
    var lerp = 1 - Math.exp(-this.posLerp * dt);
    this.model.position.x += (p.pos.x - this.model.position.x) * lerp;
    this.model.position.y += ((p.pos.y - Player.eyeH) - this.model.position.y) * lerp;
    this.model.position.z += (p.pos.z - this.model.position.z) * lerp;
    // Yaw: character faces the player's aim direction (yaw + PI so the front faces forward)
    var targetYaw = p.yaw + Math.PI;
    // shortest-arc lerp
    var d = targetYaw - this.yawSmooth;
    while (d > Math.PI) d -= Math.PI*2;
    while (d < -Math.PI) d += Math.PI*2;
    this.yawSmooth += d * (1 - Math.exp(-this.yawLerp * dt));
    this.model.rotation.y = this.yawSmooth;
    // Shooting recoil: kick the right arm up briefly when a shot is fired
    if (this._recoilT > 0){
      this._recoilT -= dt;
      if (this._armR){
        var t = Math.max(0, this._recoilT) / 0.15; // 0.15s kick window
        this._armR.rotation.x = -1.4 - t * 0.5; // swing arm up
      }
    } else if (this._armR && this._armRBase){
      // return to base pose smoothly
      this._armR.rotation.x += (this._armRBase - this._armR.rotation.x) * Math.min(1, dt*8);
    }
  },

  // Called by Weapons.fire() on each shot
  triggerRecoil: function(){
    this._recoilT = 0.15;
    if (this.model && !this._armR){
      this._armR = this.model.getObjectByName('upperarm.r');
      if (this._armR && this._armRBase === undefined) this._armRBase = this._armR.rotation.x;
    }
  },

  hide: function(){
    if (this.model) this.model.visible = false;
  },

  show: function(){
    if (this.model) this.model.visible = true;
  }
};
