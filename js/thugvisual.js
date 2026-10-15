// Vespera - thug visual asset system.
// Loads the animated soldier GLB ONCE, normalizes it to human height, and hands
// out SkeletonUtils clones (skinned meshes cannot be plain-clone()d safely).
// Visual replacement ONLY - no AI, health, collision or combat logic lives here.
// "Soldier" by Quaternius - CC0 (poly.pizza). Holds no rifle in the mesh, so a
// small CC0 rifle prop (prop_ak.glb) is attached to the wrist bone of each clone.

var ThugVisual = {
  ready: false,
  failed: false,
  gunReady: false,
  template: null,     // normalized THREE.Group (feet at y=0, centered, ~1.85 units tall)
  gunTemplate: null,  // normalized rifle prop (barrel along -Z, grip at origin)
  actions: {},        // animKey -> AnimationClip ('walk','idle','shoot','idleGun')
  targetHeight: 1.85,
  yawOffset: 0,       // Quaternius rigs face +Z at yaw 0 (same as the zombie)

  // clip-name fragments in the GLB; array order makes 'Gun_Shoot' beat 'Idle_Gun_Shoot'
  CLIP_MATCH: { walk: 'Walk', idle: 'Idle_Neutral', shoot: 'Idle_Gun_Pointing', idleGun: 'Idle_Gun' },

  init: function(){
    if (typeof THREE.GLTFLoader === 'undefined' || !THREE.SkeletonUtils){
      console.error('[VESPERA] ThugVisual: GLTFLoader/SkeletonUtils missing, keeping box thugs');
      this.failed = true;
      return;
    }
    var self = this;
    new THREE.GLTFLoader().load('assets/soldier.glb', function(gltf){
      var raw = gltf.scene || gltf.scenes[0];
      if (!raw){ self.failed = true; return; }

      // --- Normalize: uniform scale so total height == targetHeight, feet at y=0, centered ---
      var probe = new THREE.Box3().setFromObject(raw);
      var size = probe.getSize(new THREE.Vector3());
      if (size.y <= 0.0001){ self.failed = true; return; }
      var s = self.targetHeight / size.y;
      raw.scale.multiplyScalar(s);
      raw.updateMatrixWorld(true);

      var box = new THREE.Box3().setFromObject(raw);
      var center = box.getCenter(new THREE.Vector3());
      var wrapper = new THREE.Group();
      raw.position.x -= center.x;
      raw.position.z -= center.z;
      raw.position.y -= box.min.y; // feet on the ground
      wrapper.add(raw);
      // skinned meshes can be culled incorrectly while animating
      raw.traverse(function(o){ if (o.isSkinnedMesh || o.isMesh) o.frustumCulled = false; });

      self.template = wrapper;
      for (var key in self.CLIP_MATCH){
        var frag = self.CLIP_MATCH[key];
        for (var i = 0; i < gltf.animations.length; i++){
          if (gltf.animations[i].name.indexOf(frag) !== -1){
            self.actions[key] = gltf.animations[i];
            break;
          }
        }
      }
      self.ready = true;
      console.log('[VESPERA] ThugVisual ready. Clips:', Object.keys(self.actions).join(','));

      // Already-spawned thugs are waiting for the rifle
      if (self.pendingGun) for (var v = 0; v < self.pendingGun.length; v++) self.attachGun(self.pendingGun[v]);
    }, undefined, function(err){
      console.error('[VESPERA] ThugVisual load failed, keeping box thugs:', err);
      self.failed = true;
    });

    // Rifle prop for the hand (separate small GLB, no animation)
    new THREE.GLTFLoader().load('assets/prop_ak.glb', function(gltf){
      var gun = gltf.scene || gltf.scenes[0];
      if (!gun) return;
      // Normalize to a 0.75 m rifle; the Quaternius AK lies along +X with the
      // muzzle at +X — rotate so the barrel points -Z (character forward).
      var probe = new THREE.Box3().setFromObject(gun);
      var size = probe.getSize(new THREE.Vector3());
      var longest = Math.max(size.x, size.y, size.z, 0.001);
      gun.scale.multiplyScalar(0.75 / longest);
      gun.updateMatrixWorld(true);
      gun.rotation.y = Math.PI / 2; // +X (muzzle) -> -Z
      gun.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(gun);
      var c = box.getCenter(new THREE.Vector3());
      var g = new THREE.Group();
      // grip point = middle of the receiver, slightly above center
      gun.position.set(-c.x, -c.y + 0.03, 0.1);
      g.add(gun);
      gun.traverse(function(o){ if (o.isMesh) o.frustumCulled = false; });
      self.gunTemplate = g;
      self.gunReady = true;
      if (self.pendingGun) for (var v = 0; v < self.pendingGun.length; v++) self.attachGun(self.pendingGun[v]);
    }, undefined, function(){ /* rifle is cosmetic — silence is fine */ });
  },

  // Returns { group, mixer, actions, current } or null (caller falls back to boxes)
  spawn: function(){
    if (!this.ready || !this.template) return null;
    var clone = THREE.SkeletonUtils.clone(this.template);
    var mixer = new THREE.AnimationMixer(clone);
    var actions = {};
    for (var key in this.actions){
      actions[key] = mixer.clipAction(this.actions[key]);
    }
    if (actions.idle) actions.idle.play();
    var vis = { group: clone, mixer: mixer, actions: actions, current: actions.idle ? 'idle' : null, gunBound: false, shootT: 0 };
    this.attachGun(vis);
    return vis;
  },

  // Attach the rifle prop to the right wrist. If the prop hasn't loaded yet,
  // queue the vis and attach when it arrives.
  attachGun: function(vis){
    if (!vis || vis.gunAttached) return;
    if (!this.gunReady || !this.gunTemplate){ 
      this.pendingGun = this.pendingGun || [];
      if (this.pendingGun.indexOf(vis) === -1) this.pendingGun.push(vis);
      return;
    }
    var wrist = vis.group.getObjectByName('Wrist.R');
    if (!wrist){
      vis.group.traverse(function(o){ if (!wrist && o.isBone && /wrist.*r/i.test(o.name)) wrist = o; });
    }
    if (!wrist) return;
    // The soldier GLB is authored tiny and my normalizer scales the whole rig
    // up (~4x), so the wrist bone's world scale is >1. Counter-scale the prop
    // by it, or the rifle inherits the rig's size and becomes gigantic.
    vis.group.updateMatrixWorld(true);
    var ws = wrist.getWorldScale(new THREE.Vector3());
    var bs = Math.max(ws.x, 0.0001);
    var gunRoot = new THREE.Group();
    vis.gunRoot = gunRoot;
    var gun = this.gunTemplate.clone();
    gun.scale.multiplyScalar(1 / bs);
    gunRoot.add(gun);
    wrist.add(gunRoot);
    vis.gunAttached = true;
    var pi = this.pendingGun ? this.pendingGun.indexOf(vis) : -1;
    if (pi !== -1) this.pendingGun.splice(pi, 1);
  },

  // One-shot: called every frame while the thug is in its shoot clip. Once the
  // crossfade has settled into the aim pose, the rifle's barrel (-Z) is aligned
  // with the character's forward (+Z, slight up tilt) in the wrist bone's local
  // space — binding in the AIM pose so the arm's idle->aim rotation doesn't
  // carry the gun to vertical. The gun then follows the hand rigidly.
  bindGun: function(vis, dt){
    if (!vis || !vis.gunRoot || vis.gunBound) return;
    if (vis.current !== 'shoot'){ vis.shootT = 0; return; }
    vis.shootT += dt;
    if (vis.shootT < 0.45) return;
    vis.group.updateMatrixWorld(true);
    var wrist = vis.group.getObjectByName('Wrist.R');
    if (!wrist){
      vis.group.traverse(function(o){ if (!wrist && o.isBone && /wrist.*r/i.test(o.name)) wrist = o; });
    }
    if (!wrist) return;
    var groupQuat = new THREE.Quaternion();
    vis.group.getWorldQuaternion(groupQuat);
    var desired = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.10, 0, 0));
    var gunWorldQuat = groupQuat.multiply(desired);
    var invWrist = new THREE.Quaternion();
    wrist.getWorldQuaternion(invWrist).invert();
    vis.gunRoot.quaternion.copy(invWrist.multiply(gunWorldQuat));
    vis.gunBound = true;
  },

  // Crossfade to an anim key; rate scales walk with actual movement speed
  play: function(vis, key, rate){
    if (!vis || !vis.actions || !vis.actions[key] || vis.current === key) return;
    var next = vis.actions[key];
    next.reset();
    if (rate) next.setEffectiveTimeScale(rate);
    if (vis.current && vis.actions[vis.current]) next.crossFadeFrom(vis.actions[vis.current], 0.25, true);
    next.play();
    vis.current = key;
  },

  update: function(vis, dt){
    if (vis && vis.mixer) vis.mixer.update(dt);
  }
};
