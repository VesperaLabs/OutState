// Vespera - weapon visual: loads the CC0 AK-47 GLB (OpenGameArt, loafbrr_1)
// once and hands it to the viewmodel. The procedural box gun in weapons.js
// stays as the fallback until this load succeeds.
// The GLB is a static mesh (no skin, no animations) — no cloning needed.
var WeaponVisual = {
  ready: false,
  loading: false,
  template: null,
  // Exact barrel-tip point in viewmodel-Group space (computed from geometry,
  // not guessed). weapons.js moves the muzzle flash sprite here on load.
  muzzle: new THREE.Vector3(0, 0.012, -0.56),
  targetLength: 0.78, // viewmodel scale: 0.9x of the real 0.87 m (framing tuning)

  init: function () {
    if (this.loading || this.template) return;
    this.loading = true;
    var self = this;
    var loader = new THREE.GLTFLoader();
    loader.load('assets/ak47.glb', function (gltf) {
      var raw = gltf.scene;
      // The author exported his whole presentation scene: the rifle is the
      // 'AK' node (Bolt/Lock/Trigger and the inserted Magazine hang off it),
      // while loose props (spare Magazine, Bullet, BulletBox, BulletFired)
      // sit directly on the scene root. Drop the props BEFORE measuring,
      // otherwise they skew the bounding box and float in the FPS view.
      var props = [];
      raw.traverse(function (o) {
        if (o.parent === raw && o !== raw && o.name !== 'AK') props.push(o);
      });
      props.forEach(function (p) { raw.remove(p); });
      // The model is authored lying along +X (muzzle at +X, stock at -X).
      // Rotate +90° about Y so the muzzle points down -Z (screen forward).
      raw.rotation.y = Math.PI / 2;
      raw.updateMatrixWorld(true);
      // Uniform-scale to real-world length, then bake X/Y centering into the
      // root so child coordinates ARE viewmodel coordinates. Z stays anchored
      // at the receiver (z=0): muzzle ends up at negative z, stock at positive.
      var box = new THREE.Box3().setFromObject(raw);
      var size = new THREE.Vector3(); box.getSize(size);
      var s = self.targetLength / Math.max(size.z, 0.001);
      raw.scale.setScalar(s);
      raw.updateMatrixWorld(true);
      box.setFromObject(raw);
      var c = new THREE.Vector3(); box.getCenter(c);
      raw.position.x -= c.x;
      raw.position.y -= c.y;
      raw.updateMatrixWorld(true);
      // Viewmodels hug the camera: never frustum-cull (same as zombie fix).
      // Double-sided so the near-plane cut through the receiver/grip reads as
      // a solid section instead of a see-through hole (the stock and grip sit
      // behind the camera's near plane — classic FPS "half gun" framing).
      raw.traverse(function (o) {
        if (o.isMesh) {
          o.frustumCulled = false;
          if (o.material) o.material.side = THREE.DoubleSide;
        }
      });
      self.muzzle.copy(self.findMuzzle(raw, box));
      self.template = raw;
      self.ready = true;
      console.log('[VESPERA] WeaponVisual ready. Muzzle at',
        self.muzzle.x.toFixed(3), self.muzzle.y.toFixed(3), self.muzzle.z.toFixed(3));
      if (window.Weapons && Weapons.onWeaponVisualLoaded) Weapons.onWeaponVisualLoaded();
    }, undefined, function (err) {
      console.warn('[VESPERA] ak47.glb failed to load — box fallback stays', err);
    });
    this.loadArms();
  },

  // First-person arms: "Animated FPS hands (rifle animation pack)" by ccransh
  // (CC-BY, Sketchfab), hands by @bumstrum. Fully rigged with finger joints and
  // 8 clips (Draw/OneShot/Walk/Run/Reload_Fast/inspect/Shoot/Idle). The pack
  // ships its own ACR rifle — those meshes stay hidden and our AK renders on
  // top; the animation is authored around their rifle's transform, which is the
  // anchor the hands are posed against.
  armsReady: false,
  armsTemplate: null,
  armsClips: {},    // animKey -> AnimationClip
  armsMixer: null,  // AnimationMixer for the attached arms instance
  armsBbox: null,   // true world-space Box3 (vertex-level, includes armature scale)
  armsSize: null,   // cached getSize() of armsBbox
  CLIP_MATCH: {
    idle: 'Idle', walk: 'Walk', run: 'Run', fire: 'Shoot',
    reload: 'Reload_Fast', draw: 'Draw', inspect: 'inspect'
  },
  loadArms: function () {
    var self = this;
    new THREE.GLTFLoader().load('assets/fps_arms_anim.glb', function (gltf) {
      var raw = gltf.scene;
      if (!raw || !gltf.animations || !gltf.animations.length) {
        console.warn('[VESPERA] fps_arms_anim.glb unusable — falling back to static arms.glb');
        return self.loadStaticArms();
      }
      raw.traverse(function (o) {
        if (o.isMesh) {
          o.frustumCulled = false;
          // Reset emissive so the author's textured PBR materials display correctly
          if (o.material) {
            var mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(function (m) {
              if (m.emissive) {
                m.emissive.setHex(0x000000);
                m.emissiveIntensity = 0;
              }
            });
          }
        }
      });
      // Fix stray magazine vertices in Object_15 (Pmag) that stretch into sky.
      // Indices [1144, 1147, 1149, 1151, 1154, 1156] have corrupted/zero skin weights
      // (1147 has a -4.5e32 float, others have zero weight). Copy position, normal,
      // skinWeight and skinIndex from neighboring vertex 1143 so the GPU skinning
      // shader moves them rigidly with the magazine bone (joint 79) instead of exploding.
      var pmag = raw.getObjectByName('Object_15');
      if (pmag && pmag.geometry && pmag.geometry.attributes) {
        var attrs = pmag.geometry.attributes;
        var badIndices = [1144, 1147, 1149, 1151, 1154, 1156];
        var ref = 1143;
        if (attrs.position) {
          var px = attrs.position.getX(ref), py = attrs.position.getY(ref), pz = attrs.position.getZ(ref);
          badIndices.forEach(function (idx) { attrs.position.setXYZ(idx, px, py, pz); });
          attrs.position.needsUpdate = true;
        }
        if (attrs.normal) {
          var nx = attrs.normal.getX(ref), ny = attrs.normal.getY(ref), nz = attrs.normal.getZ(ref);
          badIndices.forEach(function (idx) { attrs.normal.setXYZ(idx, nx, ny, nz); });
          attrs.normal.needsUpdate = true;
        }
        if (attrs.skinWeight) {
          var wx = attrs.skinWeight.getX(ref), wy = attrs.skinWeight.getY(ref), wz = attrs.skinWeight.getZ(ref), ww = attrs.skinWeight.getW(ref);
          badIndices.forEach(function (idx) { attrs.skinWeight.setXYZW(idx, wx, wy, wz, ww); });
          attrs.skinWeight.needsUpdate = true;
        }
        if (attrs.skinIndex) {
          var jx = attrs.skinIndex.getX(ref), jy = attrs.skinIndex.getY(ref), jz = attrs.skinIndex.getZ(ref), jw = attrs.skinIndex.getW(ref);
          badIndices.forEach(function (idx) { attrs.skinIndex.setXYZW(idx, jx, jy, jz, jw); });
          attrs.skinIndex.needsUpdate = true;
        }
      }
      self.armsTemplate = raw;
      for (var key in self.CLIP_MATCH) {
        var frag = self.CLIP_MATCH[key];
        for (var i = 0; i < gltf.animations.length; i++) {
          if (gltf.animations[i].name.indexOf(frag) !== -1) {
            self.armsClips[key] = gltf.animations[i];
            break;
          }
        }
      }
      // Measure at the VERTEX level (like findMuzzle does). Box3.setFromObject
      // reads each mesh's geometry.boundingBox × matrixWorld, but for a
      // SkinnedMesh that local box does NOT include the skeleton's bone
      // transforms — and this pack's Armature carries a baked ×100 scale, so
      // the naive box is ~100× too small and the framing scale crushes the
      // hands to ~3 mm. Vertex-level traversal applies the full matrixWorld
      // (armature scale + bone poses) and gives the true rendered size.
      self.measureArms();
      self.armsReady = true;
      console.log('[VESPERA] ArmsVisual ready. Clips:', Object.keys(self.armsClips).join(','),
        'size:', self.armsSize.x.toFixed(3), self.armsSize.y.toFixed(3), self.armsSize.z.toFixed(3));
      if (window.Weapons && Weapons.onArmsLoaded) Weapons.onArmsLoaded();
    }, undefined, function (err) {
      console.warn('[VESPERA] fps_arms_anim.glb failed — falling back to static arms.glb', err);
      self.loadStaticArms();
    });
  },

  // True world-space bounding box of the arms pack, computed by transforming
  // every vertex by its mesh's full matrixWorld. This is the only measurement
  // that matches what the renderer actually draws (Box3.setFromObject skips
  // skeleton bone transforms and mis-sizes rigged packs).
  measureArms: function () {
    var root = this.armsTemplate;
    if (!root) return;
    root.updateMatrixWorld(true);
    var box = new THREE.Box3();
    var v = new THREE.Vector3();
    var first = true;
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      var pos = o.geometry.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (first) { box.set(v, v); first = false; }
        else { box.expandByPoint(v); }
      }
    });
    this.armsBbox = box;
    this.armsSize = box.getSize(new THREE.Vector3());
  },

  // Fallback: original J-Toastie static arms (CC-BY, poly.pizza) — same
  // center + emissive treatment as before the animated pack existed.
  loadStaticArms: function () {
    var self = this;
    new THREE.GLTFLoader().load('assets/arms.glb', function (gltf) {
      var raw = gltf.scene;
      if (!raw) return;
      var box = new THREE.Box3().setFromObject(raw);
      var c = box.getCenter(new THREE.Vector3());
      raw.position.x -= c.x;
      raw.position.y -= c.y;
      raw.position.z -= c.z;
      raw.traverse(function (o) {
        if (o.isMesh) {
          o.frustumCulled = false;
          if (o.material) {
            o.material.emissive = o.material.color.clone();
            o.material.emissiveIntensity = 0.3;
          }
        }
      });
      self.armsTemplate = raw;
      self.armsReady = true;
      console.log('[VESPERA] ArmsVisual ready (static fallback)');
      if (window.Weapons && Weapons.onArmsLoaded) Weapons.onArmsLoaded();
    }, undefined, function (err) {
      console.warn('[VESPERA] arms.glb failed — gun-only viewmodel stays', err);
    });
  },

  // Barrel tip = the vertex with the smallest z among rifle meshes, in the
  // final normalized space. Ammo props (spare bullets/box) are skipped so a
  // loose prop can't fake the muzzle. Runs once at load — allocations OK here.
  findMuzzle: function (root, box) {
    var best = null, bz = Infinity;
    var v = new THREE.Vector3();
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      if (/bullet/i.test(o.name || '')) return;
      var pos = o.geometry.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (v.z < bz) { bz = v.z; best = v.clone(); }
      }
    });
    return best || new THREE.Vector3(0, 0, box.min.z);
  },

  spawn: function () { return this.ready ? this.template : null; }
};
