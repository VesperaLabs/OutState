// Vespera - zombie visual asset system.
// Loads the animated zombie GLB ONCE, normalizes it to human height, and hands
// out SkeletonUtils clones (skinned meshes cannot be plain-clone()d safely).
// Visual replacement ONLY - no AI, health, collision or combat logic lives here.
// "Animated Zombie" by Quaternius - CC-BY 3.0 (poly.pizza)

var ZombieVisual = {
  ready: false,
  failed: false,
  template: null,     // normalized THREE.Group (feet at y=0, centered, ~1.8 units tall)
  actions: {},        // animKey -> AnimationClip ('bite','crawl','idle','run','walk')
  targetHeight: 1.8,  // matches the enemy box-humanoid silhouette (~1.6-1.9)
  yawOffset: 0,       // Quaternius rigs face +Z at yaw 0; atan2(dx,dz) wrapper yaw already aims +Z at the player

  // clip-name fragments in the GLB: Zombie|ZombieBite / Crawl / Idle / Run / Walk
  CLIP_MATCH: { bite: 'Bite', crawl: 'Crawl', idle: 'Idle', run: 'Run', walk: 'Walk' },

  init: function(){
    if (typeof THREE.GLTFLoader === 'undefined' || !THREE.SkeletonUtils){
      console.error('[VESPERA] ZombieVisual: GLTFLoader/SkeletonUtils missing, keeping box zombies');
      this.failed = true;
      return;
    }
    var self = this;
    new THREE.GLTFLoader().load('assets/zombie.glb', function(gltf){
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
      console.log('[VESPERA] ZombieVisual ready. Clips:', Object.keys(self.actions).join(','));
    }, undefined, function(err){
      console.error('[VESPERA] ZombieVisual load failed, keeping box zombies:', err);
      self.failed = true;
    });
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
    return { group: clone, mixer: mixer, actions: actions, current: actions.idle ? 'idle' : null };
  },

  // Crossfade to an anim key; rate scales walk/run with actual movement speed
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
