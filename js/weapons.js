// Vespera - weapons: AK-47 hitscan with recoil, muzzle flash, tracers, shells.

var _weapFdir = new THREE.Vector3();
var _weapRight = new THREE.Vector3();
var _weapUp = new THREE.Vector3();
var _weapFwd = new THREE.Vector3();
var _weapEjectPos = new THREE.Vector3();
var _weapMuzzlePos = new THREE.Vector3();
var _driveByMuzzlePos = new THREE.Vector3();
var _driveByCarPos = new THREE.Vector3();
var _driveByCarFwd = new THREE.Vector3();
var _driveByCarRight = new THREE.Vector3();
var _driveByCarUp = new THREE.Vector3(0, 1, 0);
var _driveByEjectDir = new THREE.Vector3();
var _rcOrigin = new THREE.Vector3();

var Weapons = {
  list: {
    ak47:    { name:'ACR Suppressed',       dmg:32, rate:0.105, mag:30, reserve:120, spread:0.014, recoil:0.024, auto:true,  sound:'gunshot', range:120 },
    shotgun: { name:'Pump 12G Shotgun',     dmg:16, rate:0.85,  mag:6,  reserve:36,  spread:0.052, recoil:0.065, auto:false, sound:'shotgun', range:40, pellets:8 },
    magnum:  { name:'.357 Magnum Revolver', dmg:85, rate:0.42,  mag:6,  reserve:30,  spread:0.008, recoil:0.055, auto:false, sound:'magnum',  range:105 }
  },
  owned: { ak47:true, shotgun:true, magnum:true },
  ammoData: {
    ak47:    { mag: 30, reserve: 120 },
    shotgun: { mag: 6,  reserve: 36 },
    magnum:  { mag: 6,  reserve: 30 }
  },
  order: ['ak47', 'shotgun', 'magnum'],
  pickups: [],
  current: 'ak47',
  state: {
    mag:30, reserve:120, cooldown:0, reloading:0, inspecting:false, idleInspectTimer:0,
    model:null, flash:null, flashLight:null, kick:0, bobTime:0, idleTime:0, walkPhase:0, bobAmount:0, sprintAmount:0,
    adsAmount:0,
    hipPos: new THREE.Vector3(-0.15, -0.22, -0.22),
    hipRot: new THREE.Euler(-0.06, Math.PI - 0.04, 0.02),
    adsPos: new THREE.Vector3(0.0, -0.145, -0.19),
    adsRot: new THREE.Euler(0, Math.PI, 0),
    basePos: new THREE.Vector3(0, 0, 0),
    baseRot: new THREE.Euler(0, 0, 0),
    offsetPos: new THREE.Vector3(),
    offsetRot: new THREE.Euler(0,0,0)
  },
  _defaultShotgunHipRot: new THREE.Euler(0.0, 0.0, 0.0),
  _defaultMagnumHipRot: new THREE.Euler(0.0, 0.0, 0.0),
  _defaultZeroRot: new THREE.Euler(0, 0, 0),

  buildViewmodel: function(){
    // AK built from boxes, bottom-right of camera
    var grp = new THREE.Group();
    var metal = new THREE.MeshLambertMaterial({ color:0x2a2a2c });
    var wood  = new THREE.MeshLambertMaterial({ color:0x6e4a26 });
    var blk = new THREE.MeshLambertMaterial({ color:0x141416 });
    // receiver
    var rec = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.07,0.42), metal); rec.position.set(0,0,0); grp.add(rec);
    // barrel
    var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,0.34,6), blk);
    bar.rotation.x = Math.PI/2; bar.position.set(0,0.012,-0.36); grp.add(bar);
    // gas tube + handguard (wood)
    var hg = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.2), wood); hg.position.set(0,-0.005,-0.3); grp.add(hg);
    // curved mag
    var mag = new THREE.Mesh(new THREE.BoxGeometry(0.045,0.16,0.07), metal);
    mag.position.set(0,-0.1,0.02); mag.rotation.x = 0.45; grp.add(mag);
    // grip + stock (wood)
    var grip = new THREE.Mesh(new THREE.BoxGeometry(0.045,0.1,0.05), wood);
    grip.position.set(0,-0.08,0.14); grip.rotation.x = -0.4; grp.add(grip);
    var stock = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.08,0.2), wood);
    stock.position.set(0,-0.015,0.3); grp.add(stock);
    // front sight
    var fs = new THREE.Mesh(new THREE.BoxGeometry(0.012,0.05,0.02), blk); fs.position.set(0,0.05,-0.48); grp.add(fs);
    grp.position.set(0, 0, 0);
    grp.rotation.set(0, 0, 0);
    G.camera.add(grp);
    this.state.model = grp;
    // Third-person: the camera-attached viewmodel is never rendered.
    // The visible weapon is the world-space gun attached to the character's hand (buildThirdPerson).
    grp.visible = true;
    // muzzle flash
    var flashTex = (function(){
      var c=document.createElement('canvas'); c.width=64;c.height=64;
      var g=c.getContext('2d');
      var grd=g.createRadialGradient(32,32,2,32,32,30);
      grd.addColorStop(0,'rgba(255,240,180,1)'); grd.addColorStop(0.4,'rgba(255,180,60,0.8)'); grd.addColorStop(1,'rgba(255,120,20,0)');
      g.fillStyle=grd; g.fillRect(0,0,64,64);
      return new THREE.CanvasTexture(c);
    })();
    var flash = new THREE.Sprite(new THREE.SpriteMaterial({ map:flashTex, transparent:true, depthTest:false }));
    flash.scale.set(0.3,0.3,0.3);
    flash.position.set(0,0.012,-0.56);
    flash.visible = false;
    grp.add(flash);
    this.state.flash = flash;
    this.state.flashLight = new THREE.PointLight(0xffb050, 0, 14);
    G.scene.add(this.state.flashLight);

    // Third-person weapon (attached to the character's hand once the GLB loads)
    this.buildThirdPerson();
    this.initPickups();

    // Initialize modular weapon containers immediately so custom weapons exist from frame 0
    this.setupModularWeapons();
    this.updateViewmodelMesh(this.current);

    // Real AK GLB (visual only): loads async; the box gun above stays until
    // the GLB is in (see onWeaponVisualLoaded).
    if (window.WeaponVisual) WeaponVisual.init();
  },

  // Called by WeaponVisual when ak47.glb has loaded: swap the procedural box
  // fallback out of the viewmodel Group and park the muzzle flash on the real
  // barrel tip. Nothing else about the viewmodel or weapon logic changes —
  // st.model stays the animated handle, so idle/bob/sprint/recoil/reload all
  // apply to the GLB exactly as they did to the boxes.
  onWeaponVisualLoaded: function(){
    var st = this.state;
    var glb = WeaponVisual.spawn();
    if (!glb || !st.model || !st.flash) return;
    // Remove only the procedural box fallback, not the arms or anything else
    // (the arms may already be attached — either directly or inside their
    // framing wrap Group, so test the parent chain, not identity).
    var armsChain = [];
    var t = WeaponVisual.armsTemplate;
    while (t){ armsChain.push(t); t = t.parent; }
    for (var i = st.model.children.length - 1; i >= 0; i--){
      var ch = st.model.children[i];
      if (ch !== st.flash && ch !== this.customWeaponMount && armsChain.indexOf(ch) === -1) st.model.remove(ch);
    }
    st.model.add(glb);
    // Only copy the AK-47 center muzzle position if the animated arms pack is NOT active
    if (!WeaponVisual.armsReady || !WeaponVisual.armsClips || !WeaponVisual.armsClips.idle){
      st.flash.position.copy(WeaponVisual.muzzle);
    }
    // While the animated arms pack (with its own ACR rifle) is the viewmodel,
    // our separate AK stays hidden — hands + rifle + clips are one authored
    // unit. Done here AND in onArmsLoaded so it holds regardless of which
    // GLB finishes loading first (the 14 MB pack usually lands last).
    if (WeaponVisual.armsReady && WeaponVisual.armsClips && WeaponVisual.armsClips.idle) glb.visible = false;
  },

// Called by WeaponVisual when the first-person arms finish loading. The
// animated pack (fps_arms_anim.glb) is the COMPLETE authored viewmodel: its
// hands are rigged around its own ACR rifle, so the pack renders as one unit
// (our separate AK stays hidden). The static fallback arms keep the old
// hand-tuned group transform.
onArmsLoaded: function() {
    var st = this.state;
    if (!st.model || !WeaponVisual.armsTemplate) return;
    st.model.userData.armsAttached = false;
    var arms = WeaponVisual.armsTemplate;
    if (arms.parent) arms.parent.remove(arms);

    var animated = !!(WeaponVisual.armsClips && WeaponVisual.armsClips.idle);
    var self = this;
    if (animated) {
      // Hide our separate AK — the pack's own rifle is the viewmodel now.
      // (Order-independent: this runs even if the AK GLB loaded first.)
      if (WeaponVisual.template) WeaponVisual.template.visible = false;

      // AnimationMixer drives the arm skeleton. Idle loops forever; other
      // states (fire/reload/walk/run) get crossfaded in by name later.
      WeaponVisual.armsMixer = new THREE.AnimationMixer(arms);
      var idleAction = WeaponVisual.armsMixer.clipAction(WeaponVisual.armsClips.idle);
      idleAction.play();
      // Track the active action so we can crossfade correctly.
      this._armsActive = idleAction;
      this._armsCurrent = 'idle';
      this._armsPlay = function(name, loop, fadeIn, fadeOut){
        var clip = WeaponVisual.armsClips[name];
        if (!clip || !WeaponVisual.armsMixer) return null;
        if (this._armsCurrent === name && loop !== false) return this._armsActive;
        var action = WeaponVisual.armsMixer.clipAction(clip);
        action.reset();
        action.setLoop(loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        if (loop === false){
          // Clamp at the last frame so the rifle doesn't snap back to bind pose.
          action.clampWhenFinished = true;
        }
        action.enabled = true;
        action.setEffectiveWeight(1);
        // Fade in the new action, fade out the old one (r128-friendly — no warp arg).
        if (fadeIn) action.fadeIn(fadeIn);
        if (this._armsActive && this._armsActive !== action && fadeOut) this._armsActive.fadeOut(fadeOut);
        action.play();
        this._armsActive = action;
        this._armsCurrent = name;
        return action;
      };
      // Framing pass: the pack is authored ~100x oversized (Armature scale).
      // WeaponVisual.armsSize is the vertex-level true size (Box3.setFromObject
      // would only see the small local geometry bounds and shrink the hands to
      // a few mm). Target ~0.78 m longest axis — the rifle length on a real ACR.
      var asize = WeaponVisual.armsSize || new THREE.Vector3(0.5, 0.5, 0.5);
      var k = 0.78 / Math.max(asize.x, asize.y, asize.z);
      var wrap = new THREE.Group();
      wrap.name = 'fpsArmsWrap';
      wrap.scale.setScalar(0.45);
      // Approach A: lower Y (-0.22) so the sliced shoulder stump falls below the
      // bottom edge of the screen; push Z slightly forward (-0.22); pitch down (-0.06)
      // to keep the stock/shoulder tucked downward while keeping muzzle elevated toward crosshair.
      wrap.position.set(-0.15, -0.22, -0.22);
      wrap.rotation.set(-0.06, Math.PI - 0.04, 0.02);
      wrap.add(arms);
      arms.position.set(0, 0, 0);
      st.model.add(wrap);
      st.model.userData.armsAttached = true;
      st.model.userData.armsWrap = wrap;
      // Dynamically compute the exact front tip of the silencer/barrel mesh using boneTransform
      var tipPos = new THREE.Vector3(0, 0.09, 1.25);
      var silencer = arms.getObjectByName('Object_13');
      if (silencer && silencer.boneTransform && silencer.skeleton){
        silencer.skeleton.update();
        silencer.updateMatrixWorld(true);
        wrap.updateMatrixWorld(true);
        var pAttr = silencer.geometry.attributes.position;
        var tv = new THREE.Vector3(), bestTip = new THREE.Vector3();
        var maxZ = -Infinity;
        for (var vi = 0; vi < pAttr.count; vi++){
          silencer.boneTransform(vi, tv);
          tv.applyMatrix4(silencer.matrixWorld);
          wrap.worldToLocal(tv);
          if (tv.z > maxZ){
            maxZ = tv.z;
            bestTip.copy(tv);
          }
        }
        if (maxZ > -Infinity){
          tipPos.copy(bestTip);
          tipPos.z += 0.03; // place slightly in front of the silencer muzzle crown
          console.log('[VESPERA] Computed exact silencer tip in wrap:',
            tipPos.x.toFixed(3), tipPos.y.toFixed(3), tipPos.z.toFixed(3));
        }
      }
      if (st.flash){
        wrap.add(st.flash);
        st.flash.position.copy(tipPos);
        st.flash.scale.set(0.24, 0.24, 0.24);
      }
      // Hide any separate gun meshes in st.model so only the animated pack is visible
      for (var ci = 0; ci < st.model.children.length; ci++){
        var child = st.model.children[ci];
        if (child !== wrap && child !== st.flash && child !== self.customWeaponMount) child.visible = false;
      }
      // Keep basePos and baseRot neutral for the animated viewmodel
      st.basePos.set(0, 0, 0);
      st.baseRot.set(0, 0, 0);

      // Setup modular weapon swapping on animated arms
      self.setupModularWeapons(arms, wrap);
      self.updateViewmodelMesh(self.current);
      if (typeof G !== 'undefined' && G.player && G.player.inCar){
        self.setVisible(false);
      }

      console.log('[VESPERA] animated arms attached, Idle playing, frame k =', k.toFixed(5),
        'size=', asize.x.toFixed(2), asize.y.toFixed(2), asize.z.toFixed(2));
      return;
    }

    // --- static arms fallback: the old hand-tuned whole-model transform ---
    arms.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(arms);
    var size = box.getSize(new THREE.Vector3());
    var s = 0.78 / Math.max(size.x, size.y, size.z);
    arms.scale.set(s, s, s * 0.25);
    arms.rotation.set(0, 1.89, 0);
    arms.position.set(0.16, -0.10, 0.35);
    st.model.add(arms);
    st.model.userData.armsAttached = true;
    console.log('[VESPERA] arms attached to viewmodel (scale:', s.toFixed(4), ')');
  },

  // World-space AK held by the visible character (GTA-style third person).
  // Real AK-47: ~0.87 m long, receiver 0.39×0.07×0.05 m. Built to 1 unit = 1 m.
  buildThirdPerson: function(){
    var grp = new THREE.Group();
    var metal = new THREE.MeshLambertMaterial({ color:0x2a2a2c });
    var wood  = new THREE.MeshLambertMaterial({ color:0x6e4a26 });
    var blk = new THREE.MeshLambertMaterial({ color:0x141416 });
    // receiver (0.05 × 0.07 × 0.39 m, x = width, y = height, z = length)
    var rec = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.07,0.39), metal); grp.add(rec);
    // barrel (cylinder, length 0.4 m, radius 0.0085 m), points along -Z
    var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0085,0.0085,0.4,6), blk);
    bar.rotation.x = Math.PI/2; bar.position.set(0,0.012,-0.38); grp.add(bar);
    // handguard (wood) 0.05 × 0.05 × 0.18 m
    var hg = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.18), wood);
    hg.position.set(0,-0.005,-0.28); grp.add(hg);
    // curved magazine 0.04 × 0.14 × 0.05 m
    var mag = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.14,0.05), metal);
    mag.position.set(0,-0.09,0.02); mag.rotation.x = 0.45; grp.add(mag);
    // pistol grip (wood) 0.04 × 0.09 × 0.05 m
    var grip = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.09,0.05), wood);
    grip.position.set(0,-0.07,0.14); grip.rotation.x = -0.4; grp.add(grip);
    // stock (wood) 0.05 × 0.07 × 0.19 m
    var stock = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.07,0.19), wood);
    stock.position.set(0,-0.012,0.31); grp.add(stock);
    // front sight
    var fs = new THREE.Mesh(new THREE.BoxGeometry(0.01,0.05,0.02), blk);
    fs.position.set(0,0.05,-0.49); grp.add(fs);
    // total length: 0.39 (receiver) + 0.4 (barrel) = 0.79 m, plus stock 0.19 + 0.31 z = ~0.87 m
    grp.visible = false;
    this.state.tpGun = grp;
    this.state.tpAttached = false;
  },

  // Attach the TP gun to the character's right-hand bone (retry until character loads)
  tryAttachThirdPerson: function(){
    var st = this.state;
    if (st.tpAttached || !st.tpGun) return;
    if (!PlayerCharacter.loaded || !PlayerCharacter.model) return;
    // Mannequiny bone names use .r/.l suffixes
    var hand = PlayerCharacter.model.getObjectByName('hand.r');
    if (!hand){
      // fallback: search any descendant bone with 'hand' + 'r'
      PlayerCharacter.model.traverse(function(o){ if (!hand && o.isBone && /hand.*r/i.test(o.name)) hand = o; });
    }
    if (!hand) return;
    // Sit in the right palm: hand bone local +X = right, +Y = up the limb.
    // Rotate so the barrel (-Z of the gun) points along the finger axis (-Y of the bone).
    st.tpGun.position.set(0.02, -0.08, 0.02);
    st.tpGun.rotation.set(Math.PI/2, 0, 0);
    hand.add(st.tpGun);
    st.tpAttached = true;
    // Move the muzzle flash sprite from the (hidden) viewmodel to this gun's barrel tip
    if (st.flash){
      st.flash.position.set(0, 0.012, -0.58);
      st.tpGun.add(st.flash);
    }
    console.log('[VESPERA] Third-person gun attached to', hand.name);
  },

  switchTo: function(id){
    if (!this.list[id] || !this.owned[id]) return;
    if (this.current === id) return;
    if (this._shotgunReloadTimers){
      this._shotgunReloadTimers.forEach(function(t){ clearTimeout(t); });
      this._shotgunReloadTimers = [];
    }
    // Save current ammo state
    if (this.ammoData && this.ammoData[this.current]){
      this.ammoData[this.current].mag = this.state.mag;
      this.ammoData[this.current].reserve = this.state.reserve;
    }
    this.current = id;
    var w = this.list[id];
    // Restore ammo state
    if (this.ammoData && this.ammoData[id]){
      this.state.mag = this.ammoData[id].mag;
      this.state.reserve = this.ammoData[id].reserve;
    } else {
      this.state.mag = w.mag;
      this.state.reserve = w.reserve || 60;
    }
    this.state.cooldown = 0.22;
    this.state.reloading = 0;
    if (typeof HUD !== 'undefined' && HUD.weapon){
      HUD.weapon(w.name, this.state.mag, this.state.reserve);
    }
    if (id === 'shotgun' && AudioSys.shotgunEquip){
      AudioSys.shotgunEquip();
    } else if (id === 'magnum' && AudioSys.magnumEquip){
      AudioSys.magnumEquip();
    } else if (typeof AudioSys !== 'undefined' && AudioSys.click){
      AudioSys.click(0.35, 1200, 0.04);
    }
    this.updateViewmodelMesh(id);

    // Play take/draw animation on switch
    if (this.animatedClips && this.animatedClips[id] && this.animatedClips[id].take){
      var tc = this.animatedClips[id].take;
      tc.reset();
      tc.setLoop(THREE.LoopOnce);
      tc.clampWhenFinished = true;
      tc.play();
    } else if (this.animatedClips && this.animatedClips[id] && this.animatedClips[id].idle){
      var ic = this.animatedClips[id].idle;
      if (!ic.isRunning()){
        ic.reset().play();
      }
    }
  },

  cycle: function(dir){
    var ownedList = [];
    for (var i = 0; i < this.order.length; i++){
      var id = this.order[i];
      if (this.owned[id]) ownedList.push(id);
    }
    if (ownedList.length <= 1) return;
    var idx = ownedList.indexOf(this.current);
    if (idx === -1) idx = 0;
    var nextIdx = (idx + dir + ownedList.length) % ownedList.length;
    this.switchTo(ownedList[nextIdx]);
  },

  setupModularWeapons: function(arms, wrap){
    if (arms){
      this.acrMeshes = [
        arms.getObjectByName('Object_12'),
        arms.getObjectByName('Object_13'),
        arms.getObjectByName('Object_14'),
        arms.getObjectByName('Object_15')
      ].filter(Boolean);

      this.leftArmBones = [
        arms.getObjectByName('Arm_L_02'),
        arms.getObjectByName('UpArm_L_03'),
        arms.getObjectByName('Forearm_L_04'),
        arms.getObjectByName('IK_Hand_Cntrl_L_015'),
        arms.getObjectByName('Hand_L_016')
      ].filter(Boolean);
    }

    // Option A: Modular Viewmodel Architecture
    // st.model is the camera-mounted root group.
    // - wrap holds the ACR arms + rifle viewmodel (visible only for ak47)
    // - customWeaponMount holds independent modular viewmodels for other weapons
    var st = this.state;
    if (st.model){
      if (!this.customWeaponMount){
        this.customWeaponMount = new THREE.Group();
        this.customWeaponMount.name = 'customWeaponMount';
        st.model.add(this.customWeaponMount);
      } else if (this.customWeaponMount.parent !== st.model){
        st.model.add(this.customWeaponMount);
      }
      this.customWeapons = this.customWeapons || {};

      // 1. Procedural 3D Shotgun viewmodel fallback
      if (!this.customWeapons['shotgun']){
        var sgMesh = this.buildPickupMesh('shotgun');
        sgMesh.scale.set(0.95, 0.95, 0.95);
        sgMesh.userData.hipPos = new THREE.Vector3(0.18, -0.17, -0.42);
        sgMesh.userData.adsPos = new THREE.Vector3(0.0, -0.12, -0.32);
        sgMesh.position.copy(sgMesh.userData.hipPos);
        sgMesh.rotation.set(-0.02, 0, 0.02);
        this.customWeaponMount.add(sgMesh);
        this.customWeapons['shotgun'] = sgMesh;
      }

      // 2. Procedural 3D Magnum viewmodel fallback
      if (!this.customWeapons['magnum']){
        var mgMesh = this.buildPickupMesh('magnum');
        mgMesh.scale.set(0.95, 0.95, 0.95);
        mgMesh.userData.hipPos = new THREE.Vector3(0.16, -0.15, -0.38);
        mgMesh.userData.adsPos = new THREE.Vector3(0.0, -0.10, -0.28);
        mgMesh.position.copy(mgMesh.userData.hipPos);
        mgMesh.rotation.set(-0.02, 0, -0.02);
        this.customWeaponMount.add(mgMesh);
        this.customWeapons['magnum'] = mgMesh;
      }

      // Only initiate external load once
      if (!this._externalModelsInitiated){
        this._externalModelsInitiated = true;
        this.loadExternalWeaponModel('shotgun', 'shotgun.glb');
        this.loadExternalWeaponModel('magnum', 'revolver.glb');
      }
    }
  },

  loadExternalWeaponModel: function(id, filename){
    var self = this;
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) return;
    new THREE.GLTFLoader().load('assets/' + filename, function(gltf){
      if (!gltf || !gltf.scene) return;
      var model = gltf.scene;
      model.traverse(function(o){
        if (o.isMesh){
          o.frustumCulled = false;
          // Uniform scaling handles inches-to-meters conversion via model.scale.setScalar(0.0254) below
          if (o.material){
            var mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(function(m){
              m.side = THREE.DoubleSide;
              // Fix black baseColorFactor on glove material (THD_Gloves_0212SG has [0,0,0,1] factor which zeroes diffuse texture)
              if (m.map && m.color && m.color.r === 0 && m.color.g === 0 && m.color.b === 0){
                m.color.setHex(0xffffff);
              }
              // Prevent 0 roughness from causing black specular reflections without envmap
              if (m.roughness !== undefined && m.roughness < 0.25){
                m.roughness = 0.35;
              }
              if (m.emissive && !m.emissiveMap){
                m.emissive.setHex(0x000000);
                m.emissiveIntensity = 0;
              }
            });
          }
        }
      });

      self.animatedMixers = self.animatedMixers || {};
      self.animatedClips = self.animatedClips || {};

      var viewmodelContainer = model;

      if (gltf.animations && gltf.animations.length > 0){
        // Hide author's billboard 3D crosshair, shape_pose floor helper, and author cameras
        model.traverse(function(o){
          var nm = (o.name || '').toLowerCase();
          if (nm.includes('crosshair') || nm.includes('shape_pose') || o.name === 'Sun' ||
              (nm.includes('camera') && !nm.includes('head'))){
            o.visible = false;
          }
        });

        // Initialize AnimationMixer and register authored animation clips
        var mixer = new THREE.AnimationMixer(model);
        self.animatedMixers[id] = mixer;
        self.animatedClips[id] = {};

        gltf.animations.forEach(function(clip){
          var rawName = clip.name || '';
          var key = rawName.toLowerCase();
          if (key.includes('idle')) key = 'idle';
          else if (key.includes('walk')) key = 'walk';
          else if (key.includes('fire') || key.includes('shoot')) key = 'shoot';
          else if (key.includes('reloadstart') || key.includes('reload_start')) key = 'reload_start';
          else if (key.includes('reloadend') || key.includes('reload_end')) key = 'reload_end';
          else if (key.includes('reload_full') || key.includes('full')) key = 'reload_full';
          else if (key.includes('reload_easy') || key.includes('easy')) key = 'reload_easy';
          else if (key.includes('reload')) key = 'reload';
          else if (key.includes('take') || key.includes('draw')) key = 'take';
          else if (key.includes('watch') || key.includes('inspect')) key = 'watch';
          else if (key.includes('hide')) key = 'hide';

          var action = mixer.clipAction(clip);
          if (key === 'idle'){
            action.setLoop(THREE.LoopRepeat, Infinity);
          } else {
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
          }
          self.animatedClips[id][key] = action;
        });

        var wrap = new THREE.Group();
        wrap.name = id + '_viewmodel_wrap';
        wrap.add(model);

        if (id === 'shotgun'){
          // Assets/shotgun.glb was authored in Inches (1 in = 0.0254 m).
          // Author camera (camera_01) sits at (0, 34.0002, 0) inches, looking down +Z.
          // 1. Scale model by 0.0254 to convert inches to meters.
          // 2. Rotate Math.PI around Y to aim down -Z (Three.js camera forward).
          // 3. Offset model by (0, -34.0002 * 0.0254, 0) to align author camera with wrap origin.
          model.scale.setScalar(0.0254);
          model.rotation.set(0, Math.PI, 0);
          model.position.set(0, -34.0002 * 0.0254, 0);

          // Standardized viewmodel alignment matching the Rifle Standard:
          // Hip: Left hand clearly on the left side of screen holding the forend/pump.
          // ADS (RMB): Gun sight/barrel centered to exact middle (X = 0.0, Ry = 0.0).
          var sgAlign = window.SHOTGUN_VIEWMODEL_ALIGN || {
            x: -0.12,
            y: -0.045,
            z: 0.00,
            rx: 0.0,
            ry: 0.0,
            rz: 0.0,
            adsX: 0.0,
            adsY: 0.035,
            adsZ: 0.01,
            adsRx: 0.0,
            adsRy: 0.0,
            adsRz: 0.0,
            scale: 1.0
          };
          window.SHOTGUN_VIEWMODEL_ALIGN = sgAlign;

          wrap.scale.setScalar(sgAlign.scale || 1.0);
          wrap.position.set(sgAlign.x, sgAlign.y, sgAlign.z);
          wrap.rotation.set(sgAlign.rx, sgAlign.ry, sgAlign.rz);

          self.shotgunHipPos = new THREE.Vector3(sgAlign.x, sgAlign.y, sgAlign.z);
          self.shotgunHipRot = new THREE.Euler(sgAlign.rx, sgAlign.ry, sgAlign.rz);
          self.shotgunAdsPos = new THREE.Vector3(sgAlign.adsX, sgAlign.adsY, sgAlign.adsZ);
          self.shotgunAdsRot = new THREE.Euler(sgAlign.adsRx || 0.0, sgAlign.adsRy || 0.0, sgAlign.adsRz || 0.0);
          self.shotgunWrap = wrap;

          // Play Take animation to initialize the ready hold pose
          if (self.animatedClips[id].take){
            self.animatedClips[id].take.reset().play();
          }
        } else if (id === 'magnum'){
          // Center model on author's Head_Cam_014 bone:
          // In author space, Head_Cam_014 is at (0, 0.2158, 0), looking down +Z.
          // Rotating Math.PI around Y points the weapon down -Z (Three.js camera forward).
          // Offsetting model by (0, -0.2158, 0) aligns Head_Cam_014 directly with wrap's origin.
          model.rotation.set(0, Math.PI, 0);
          model.position.set(0, -0.2158, 0);

          // Standardized viewmodel alignment matching the Rifle Standard:
          // In author space, pistol receiver is at x = -0.0737, inverted to +0.0737 in wrap.
          // Hip: Left hand visible on left side (x: -0.16) supporting the grip.
          // ADS (RMB): Translating wrap to adsX = -0.0737 brings the pistol barrel to exact center (0.0)!
          var align = window.MAGNUM_VIEWMODEL_ALIGN || {
            x: -0.16,
            y: -0.06,
            z: -0.02,
            rx: 0.0,
            ry: 0.0,
            rz: 0.0,
            adsX: -0.0737,
            adsY: 0.038,
            adsZ: 0.01,
            adsRx: 0.0,
            adsRy: 0.0,
            adsRz: 0.0,
            scale: 0.95
          };
          window.MAGNUM_VIEWMODEL_ALIGN = align;

          wrap.scale.setScalar(align.scale || 0.95);
          wrap.position.set(align.x, align.y, align.z);
          wrap.rotation.set(align.rx, align.ry, align.rz);

          self.magnumHipPos = new THREE.Vector3(align.x, align.y, align.z);
          self.magnumHipRot = new THREE.Euler(align.rx, align.ry, align.rz);
          self.magnumAdsPos = new THREE.Vector3(align.adsX, align.adsY, align.adsZ);
          self.magnumAdsRot = new THREE.Euler(align.adsRx || 0.0, align.adsRy || 0.0, align.adsRz || 0.0);
          self.magnumWrap = wrap;

          // Start idle loop immediately
          if (self.animatedClips[id].idle){
            self.animatedClips[id].idle.reset().play();
          }
        }

        viewmodelContainer = wrap;

        if (self.animatedClips[id].take && id !== 'shotgun'){
          self.animatedClips[id].take.reset();
          self.animatedClips[id].take.play();
        }
      } else {
        // Static viewmodel handling (revolver.glb / shotgun)
        if (id === 'shotgun'){
          var box = new THREE.Box3().setFromObject(model);
          var size = new THREE.Vector3(); box.getSize(size);
          var maxDim = Math.max(size.x, size.y, size.z);
          var targetSize = 0.82;
          if (maxDim > 0) model.scale.setScalar(targetSize / maxDim);
          model.position.set(0.18, -0.17, -0.42);
          model.rotation.set(-0.02, Math.PI, 0.0);
          viewmodelContainer = model;
        } else if (id === 'magnum'){
          var wrap = new THREE.Group();
          wrap.name = 'magnum_viewmodel_wrap';

          // First-person orientation for assets/revolver.glb:
          // The GLB is in meters. +Y is up, +Z is forward.
          // Rotating Math.PI around Y points the barrel down -Z (camera forward), keeps +Y up,
          // and places right hand on screen right, left hand on screen left.
          model.rotation.set(0, Math.PI, 0);

          // In gltf.scene, the pistol receiver is at (-0.131, 1.400, 0.580).
          // Positioning model at (-0.131, -1.400, 0.580) centers the pistol receiver at (0, 0, 0) inside wrap.
          model.position.set(-0.131, -1.400, 0.580);
          wrap.add(model);

          // Configurable alignment for easy fine-tuning
          var align = window.MAGNUM_VIEWMODEL_ALIGN || {
            x: -0.07,
            y: -0.17,
            z: -0.40,
            rx: -0.02,
            ry: 0.0,
            rz: 0.0
          };
          window.MAGNUM_VIEWMODEL_ALIGN = align;

          wrap.position.set(align.x, align.y, align.z);
          wrap.rotation.set(align.rx, align.ry, align.rz);

          self.magnumHipPos = new THREE.Vector3(align.x, align.y, align.z);
          self.magnumAdsPos = new THREE.Vector3(0.0, -0.138, -0.32);
          self.magnumWrap = wrap;
          viewmodelContainer = wrap;
        } else {
          viewmodelContainer = model;
        }
      }

      self.externalModels = self.externalModels || {};
      self.externalModels[id] = viewmodelContainer;

      if (self.customWeaponMount && self.customWeapons){
        if (self.customWeapons[id]){
          self.customWeaponMount.remove(self.customWeapons[id]);
        }
        self.customWeaponMount.add(viewmodelContainer);
        self.customWeapons[id] = viewmodelContainer;
        viewmodelContainer.visible = (self.current === id);
        self.updateViewmodelMesh(self.current);
        console.log('[VESPERA] Successfully loaded modular weapon model: assets/' + filename + ' for ' + id);
      }
    }, undefined, function(){
      // External model not present yet; internal fallback stays active
    });
  },

  updateViewmodelMesh: function(id){
    var isRifle = (id === 'ak47');
    if (this.state && this.state.model){
      if (this.state.model.userData.armsWrap){
        this.state.model.userData.armsWrap.visible = isRifle;
      }
      if (this.state.model.userData.staticArms){
        this.state.model.userData.staticArms.visible = isRifle;
      }
      if (this.state.model.userData.akGlb){
        this.state.model.userData.akGlb.visible = isRifle;
      }
    }
    if (this.acrMeshes){
      for (var i = 0; i < this.acrMeshes.length; i++){
        if (this.acrMeshes[i]) this.acrMeshes[i].visible = isRifle;
      }
    }
    if (this.customWeaponMount){
      // Ensure customWeaponMount stays attached to st.model
      if (this.state && this.state.model && this.customWeaponMount.parent !== this.state.model){
        this.state.model.add(this.customWeaponMount);
      }
      this.customWeaponMount.visible = !isRifle;
      if (!isRifle && this.customWeapons){
        for (var k in this.customWeapons){
          if (this.customWeapons[k]){
            this.customWeapons[k].visible = (k === id);
          }
        }
      }
    }

    // Update muzzle flash position according to the active weapon
    if (this.state && this.state.flash){
      if (id === 'ak47'){
        if (this.state.model && this.state.model.userData.armsWrap){
          var wrap = this.state.model.userData.armsWrap;
          if (this.state.flash.parent !== wrap) wrap.add(this.state.flash);
          this.state.flash.position.set(0, 0.09, 1.25);
          this.state.flash.scale.set(0.24, 0.24, 0.24);
        }
      } else if (id === 'shotgun' && this.shotgunWrap){
        if (this.state.flash.parent !== this.shotgunWrap){
          this.shotgunWrap.add(this.state.flash);
        }
        this.state.flash.position.set(0.0, -0.065, -0.82);
        this.state.flash.scale.set(0.42, 0.42, 0.42);
      } else if (id === 'magnum' && this.magnumWrap){
        if (this.state.flash.parent !== this.magnumWrap){
          this.magnumWrap.add(this.state.flash);
        }
        this.state.flash.position.set(0.0737, -0.025, -0.350);
        this.state.flash.scale.set(0.28, 0.28, 0.28);
      } else {
        if (this.state.model && this.state.flash.parent !== this.state.model){
          this.state.model.add(this.state.flash);
        }
        this.state.flash.scale.set(0.32, 0.32, 0.32);
        if (id === 'shotgun'){
          this.state.flash.position.set(0.18, -0.16, -0.82);
        } else if (id === 'magnum'){
          this.state.flash.position.set(-0.065, -0.12, -0.40);
        }
      }
    }
  },

  buildPickupMesh: function(type){
    var grp = new THREE.Group();
    var matSteel = new THREE.MeshLambertMaterial({ color: 0x3a3d45 });
    var matDark = new THREE.MeshLambertMaterial({ color: 0x1a1c20 });
    var matWood = new THREE.MeshLambertMaterial({ color: 0x6e4a26 });
    var matChrome = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });

    if (type === 'shotgun'){
      // Receiver
      var rec = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.38), matSteel);
      grp.add(rec);
      // Twin barrels (barrel + magazine tube)
      var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 8), matDark);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(0, 0.015, -0.42);
      grp.add(bar);
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.44, 8), matDark);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, -0.018, -0.38);
      grp.add(tube);
      // Wood Stock & Grip
      var stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.28), matWood);
      stock.position.set(0, -0.02, 0.3);
      grp.add(stock);
      // Pump Forend
      var pump = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.065, 0.15), matWood);
      pump.position.set(0, -0.018, -0.28);
      grp.add(pump);
    } else if (type === 'magnum'){
      // Frame & Cylinder
      var frame = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.26), matChrome);
      grp.add(frame);
      // Cylinder
      var cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 6), matSteel);
      cyl.rotation.x = Math.PI / 2;
      cyl.position.set(0, 0.005, -0.02);
      grp.add(cyl);
      // Heavy 6-inch Barrel
      var barM = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.05, 0.22), matChrome);
      barM.position.set(0, 0.01, -0.22);
      grp.add(barM);
      // Rubber Combat Grip
      var grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.11, 0.065), matDark);
      grip.position.set(0, -0.06, 0.11);
      grip.rotation.x = -0.35;
      grp.add(grip);
    }
    return grp;
  },

  spawnPickup: function(type, x, z){
    if (!G.scene) return null;
    var wp = this.list[type];
    if (!wp) return null;

    var colorHex = (type === 'shotgun') ? 0x38bdf8 : 0xffbf36; // cyan for shotgun, amber for magnum
    var flareColor = (type === 'shotgun') ? 0x38bdf8 : 0xffbf36;

    var pickupObj = {
      type: type,
      x: x,
      z: z,
      baseY: 0.85,
      flareColor: flareColor,
      grp: new THREE.Group()
    };

    // 1. Pedestal Base
    var pedMat = new THREE.MeshLambertMaterial({ color: 0x22262c });
    var ped = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), pedMat);
    ped.position.set(0, 0.05, 0);
    pickupObj.grp.add(ped);

    // Hazard rim stripe
    var rimMat = new THREE.MeshBasicMaterial({ color: colorHex });
    var rim = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.02, 0.74), rimMat);
    rim.position.set(0, 0.1, 0);
    pickupObj.grp.add(rim);

    // 2. Vertical Luminous Light Beam
    var beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.0, 8, 1, true);
    var beamMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    var beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 2.0, 0);
    pickupObj.grp.add(beam);
    pickupObj.beam = beam;

    // 3. Floating 3D Gun Model
    var gunMesh = this.buildPickupMesh(type);
    gunMesh.position.set(0, pickupObj.baseY, 0);
    pickupObj.grp.add(gunMesh);
    pickupObj.gunMesh = gunMesh;

    // 4. Ambient Point Light
    var light = new THREE.PointLight(colorHex, 1.4, 7.5);
    light.position.set(0, 1.2, 0);
    pickupObj.grp.add(light);
    pickupObj.light = light;

    pickupObj.grp.position.set(x, 0, z);
    G.scene.add(pickupObj.grp);
    this.pickups.push(pickupObj);
    return pickupObj;
  },

  initPickups: function(){
    if (this._pickupsInited) return;
    this._pickupsInited = true;
    // Spawn initial world pickups
    // 1. Shotgun at Police / Gunsmith street corner (x: 24, z: -16)
    this.spawnPickup('shotgun', 24, -16);
    // 2. .357 Magnum at Financial Plaza (x: -32, z: 36)
    this.spawnPickup('magnum', -32, 36);
  },

  updatePickups: function(dt){
    var time = performance.now() * 0.001;
    for (var i = 0; i < this.pickups.length; i++){
      var p = this.pickups[i];
      if (p.gunMesh){
        p.gunMesh.rotation.y += dt * 1.6;
        p.gunMesh.position.y = p.baseY + Math.sin(time * 2.8 + i) * 0.07;
      }
      if (p.beam){
        p.beam.material.opacity = 0.18 + Math.sin(time * 4.0 + i) * 0.08;
      }
    }
  },

  checkPickup: function(px, pz){
    for (var i = this.pickups.length - 1; i >= 0; i--){
      var p = this.pickups[i];
      var d2 = dist2(px, pz, p.x, p.z);
      if (d2 < 2.5 * 2.5){
        var type = p.type;
        var wp = this.list[type];
        this.owned[type] = true;
        if (!this.ammoData[type]){
          this.ammoData[type] = { mag: wp.mag, reserve: wp.reserve || 36 };
        }
        // Particle pickup burst
        if (typeof Effects !== 'undefined' && Effects.spawn){
          Effects.spawn(p.x, 1.0, p.z, p.flareColor, 0.4, 0.4, 15);
        }
        // Remove 3D pickup from scene
        G.scene.remove(p.grp);
        this.pickups.splice(i, 1);
        // Toast and unlock
        if (typeof HUD !== 'undefined' && HUD.weaponUnlock){
          HUD.weaponUnlock(wp.name);
        }
        this.switchTo(type);
        return true;
      }
    }
    return false;
  },

  nearestPickupHint: function(px, pz){
    for (var i = 0; i < this.pickups.length; i++){
      var p = this.pickups[i];
      if (dist2(px, pz, p.x, p.z) < 3.0 * 3.0){
        var wp = this.list[p.type];
        return 'Press E — Pick up ' + (wp ? wp.name : 'Weapon');
      }
    }
    return null;
  },

  // Single source of truth for weapon visual + functionality gating.
  setVisible: function(visible){
    var st = this.state;
    if (st.model){
      st.model.visible = visible;
      if (st.model.userData && st.model.userData.armsWrap){
        st.model.userData.armsWrap.visible = visible;
      }
      if (this.customWeaponMount){
        this.customWeaponMount.visible = visible;
      }
      st.model.traverse(function(o){
        if (o.isMesh || o.isSkinnedMesh || o.isGroup){
          o.visible = visible;
        }
      });
      if (!visible){
        if (typeof G !== 'undefined' && G.camera && st.model.parent === G.camera){
          G.camera.remove(st.model);
        }
        st.model.position.set(0, -99999, 0);
      } else {
        if (typeof G !== 'undefined' && G.camera && st.model.parent !== G.camera){
          G.camera.add(st.model);
        }
        st.model.position.set(0, 0, 0);
        if (typeof this.updateViewmodelMesh === 'function'){
          this.updateViewmodelMesh(this.current);
        }
      }
    }
    // CRITICAL: Standalone ak47.glb MUST NEVER be visible when the animated pack is active!
    if (typeof WeaponVisual !== 'undefined' && WeaponVisual.template){
      WeaponVisual.template.visible = false;
    }
    if (st.tpGun){ st.tpGun.visible = false; }
    if (st.flash){ st.flash.visible = false; } // flash is independent and time-gated
    if (st.flashLight){ st.flashLight.intensity = 0; }
    // Hide crosshair via HUD
    if (typeof HUD !== "undefined" && HUD.el && HUD.el.crosshair){
      if (!visible && typeof G !== 'undefined' && G.player && G.player.inCar){
        HUD.el.crosshair.style.display = '';
      } else {
        HUD.el.crosshair.style.display = visible ? '' : 'none';
      }
    }
  },

  fire: function(){
    var st = this.state, w = this.list[this.current];
    if (G.paused || G.player.dead) return;
    if (st.reloading > 0) return;
    if (st.cooldown > 0) return;
    if (st.mag <= 0){ AudioSys.dryFire(); st.cooldown = 0.25; return; }

    // If player is in a vehicle, execute dedicated drive-by ballistics & physics
    if (G.player.inCar){
      this.fireDriveBy();
      return;
    }
    st.mag--; st.cooldown = w.rate;
    if (AudioSys[w.sound]) AudioSys[w.sound](); else AudioSys.gunshot();
    // muzzle flash at barrel tip
    st.flash.visible = true;
    st.flashT = 0.055;
    st.flash.scale.set(0.36, 0.36, 0.36);
    if (st.flash.material) st.flash.material.rotation = Math.random() * Math.PI * 2;
    st.flashLight.intensity = 2.2;
    G.camera.getWorldDirection(_weapFdir);
    // Flash light follows the barrel tip in world space
    if (st.flash){
      st.flash.getWorldPosition(st.flashLight.position);
    } else if (st.tpAttached && st.tpGun){
      st.tpGun.getWorldPosition(st.flashLight.position);
    } else {
      st.flashLight.position.copy(G.camera.position).addScaledVector(_weapFdir, 1.2);
    }

    // 3D Tumbling brass shell casing ejection from receiver (zero per-shot allocation)
    _weapRight.set(1, 0, 0).applyQuaternion(G.camera.quaternion);
    _weapUp.set(0, 1, 0).applyQuaternion(G.camera.quaternion);
    _weapFwd.set(0, 0, -1).applyQuaternion(G.camera.quaternion);
    _weapEjectPos.copy(G.camera.position);
    if (this.current === 'magnum'){
      _weapEjectPos.addScaledVector(_weapRight, 0.05)
                   .addScaledVector(_weapUp, -0.08)
                   .addScaledVector(_weapFwd, 0.33);
    } else if (this.current === 'shotgun'){
      _weapEjectPos.addScaledVector(_weapRight, 0.08)
                   .addScaledVector(_weapUp, -0.06)
                   .addScaledVector(_weapFwd, 0.38);
    } else {
      _weapEjectPos.addScaledVector(_weapRight, 0.18)
                   .addScaledVector(_weapUp, -0.12)
                   .addScaledVector(_weapFwd, 0.42);
    }
    if (Effects && Effects.spawnCasing) Effects.spawnCasing(_weapEjectPos, _weapFwd, _weapUp, _weapRight);

    // Muzzle position for tracers (zero per-shot allocation)
    if (st.flash && st.flash.parent){
      st.flash.getWorldPosition(_weapMuzzlePos);
    } else {
      _weapMuzzlePos.copy(G.camera.position).addScaledVector(_weapFwd, 0.7);
    }
    var muzzlePos = _weapMuzzlePos;

    // Trigger animated viewmodel shoot animation if active
    if (this.animatedClips && this.animatedClips[this.current] && this.animatedClips[this.current].shoot){
      var sc = this.animatedClips[this.current].shoot;
      sc.reset();
      sc.setLoop(THREE.LoopOnce);
      sc.clampWhenFinished = true;
      sc.play();
    } else if (this.current === 'shotgun' && this.shotgunClips && this.shotgunClips.shoot){
      this.shotgunClips.shoot.reset();
      this.shotgunClips.shoot.setLoop(THREE.LoopOnce);
      this.shotgunClips.shoot.play();
    }

    // Cancel inspect immediately on fire & reset idle timer
    if (st.inspecting) st.inspecting = false;
    st.idleInspectTimer = 0;
    // recoil: camera kick + model kick (reduced in ADS)
    var spreadMult = 1 - st.adsAmount * 0.65;
    var recoilMult = 1 - st.adsAmount * 0.45;
    G.player.pitch += w.recoil * recoilMult * rand(0.8,1.2);
    G.player.yaw += w.recoil * recoilMult * rand(-0.4,0.4);
    st.kick = 1 * (1 - st.adsAmount * 0.3);
    HUD.spread(1 * spreadMult);
    var pellets = w.pellets || 1;
    var effSpread = w.spread * spreadMult;
    for (var p=0;p<pellets;p++){
      var dir = _weapFdir.clone();
      dir.x += rand(-effSpread,effSpread); dir.y += rand(-effSpread,effSpread); dir.z += rand(-effSpread,effSpread);
      dir.normalize();
      this.raycastShot(dir, w.range, w.dmg, muzzlePos);
    }
    // Notify the character so the right arm kicks up
    if (PlayerCharacter && PlayerCharacter.triggerRecoil) PlayerCharacter.triggerRecoil();
    HUD.ammo(st.mag, st.reserve);
    // Trigger the animated arms Shoot clip (rifle only)
    if (this.current === 'ak47' && this._armsPlay){
      this._armsPlay('fire', false, 0.03, 0.03);
    }
  },

  fireDriveBy: function(){
    var st = this.state, w = this.list[this.current];
    var car = G.player.inCar;
    if (!car) return;

    st.mag--;
    st.cooldown = w.rate;
    car.lastDriveByFireTime = performance.now();

    // 1. Audio
    if (AudioSys[w.sound]) AudioSys[w.sound]();
    else AudioSys.gunshot();

    // 2. Camera Kick / Recoil
    var recoilMult = G.aimDownSights ? 0.35 : 0.65;
    G.player.carCamPitch = clamp((G.player.carCamPitch || 0) + w.recoil * recoilMult * rand(0.5, 0.9), -0.45, 0.7);
    G.player.carCamYaw = (G.player.carCamYaw || 0) + w.recoil * recoilMult * rand(-0.4, 0.4);
    if (typeof HUD !== 'undefined' && HUD.spread) HUD.spread(1.2);

    // 3. Vehicle Chassis Kick & Suspension Reaction
    car.suspensionJolt = (car.suspensionJolt || 0) + w.recoil * 0.08;

    // 4. Calculate Vehicle Muzzle Position (_driveByMuzzlePos)
    _driveByCarFwd.set(Math.sin(car.rotY), 0, Math.cos(car.rotY));
    _driveByCarRight.set(Math.cos(car.rotY), 0, -Math.sin(car.rotY));
    _driveByCarPos.set(car.x, car.y || 0, car.z);

    G.camera.getWorldDirection(_weapFdir);
    var sideDot = _weapFdir.dot(_driveByCarRight);

    if (typeof Cars !== 'undefined' && Cars.camMode === 2){
      // HOOD / COCKPIT VIEW: Mounted forward on hood/cowl
      _driveByMuzzlePos.copy(_driveByCarPos)
        .addScaledVector(_driveByCarFwd, 1.45)
        .addScaledVector(_driveByCarUp, 0.95);
      _driveByEjectDir.copy(_driveByCarRight);
    } else {
      // CHASE / CLOSE / FAR: Driver side window (left) or passenger window (right)
      if (sideDot < 0){
        // Aiming left -> Driver side window
        _driveByMuzzlePos.copy(_driveByCarPos)
          .addScaledVector(_driveByCarRight, -0.88)
          .addScaledVector(_driveByCarUp, 1.02)
          .addScaledVector(_driveByCarFwd, 0.2);
        _driveByEjectDir.copy(_driveByCarRight).negate();
      } else {
        // Aiming right -> Passenger side window
        _driveByMuzzlePos.copy(_driveByCarPos)
          .addScaledVector(_driveByCarRight, 0.88)
          .addScaledVector(_driveByCarUp, 1.02)
          .addScaledVector(_driveByCarFwd, 0.2);
        _driveByEjectDir.copy(_driveByCarRight);
      }
    }

    // 5. Muzzle Flash & Dynamic Light
    st.flashLight.intensity = 2.4;
    st.flashLight.position.copy(_driveByMuzzlePos);
    st.flashT = 0.055;

    // 6. Tumbling Brass Shell Ejection onto the street
    if (typeof Effects !== 'undefined' && Effects.spawnCasing){
      Effects.spawnCasing(_driveByMuzzlePos, _driveByEjectDir, _driveByCarUp, _driveByCarFwd);
    }

    // 7. Ballistics & Raycast Shot
    var pellets = w.pellets || 1;
    var effSpread = w.spread * (G.aimDownSights ? 0.45 : 0.85);
    for (var p = 0; p < pellets; p++){
      var dir = _weapFdir.clone();
      dir.x += rand(-effSpread, effSpread);
      dir.y += rand(-effSpread, effSpread);
      dir.z += rand(-effSpread, effSpread);
      dir.normalize();
      this.raycastShot(dir, w.range, w.dmg, _driveByMuzzlePos);
    }

    // 8. Update HUD
    if (typeof HUD !== 'undefined'){
      HUD.ammo(st.mag, st.reserve);
      if (HUD.updateCarWeapon){
        HUD.updateCarWeapon(this.current, st.mag, st.reserve, false);
      }
    }
  },

  raycastShot: function(dir, range, dmg, muzzlePos){
    // Origin is camera position for correct aiming (crosshair is screen center)
    _rcOrigin.copy(G.camera.position);
    var origin = _rcOrigin;
    var ox = _rcOrigin.x, oy = _rcOrigin.y, oz = _rcOrigin.z;
    var dx = dir.x, dy = dir.y, dz = dir.z;
    var bestT = raycastSolids(_rcOrigin, dir, range);

    // 1. Check cars / metal vehicles
    var hitCar = null, carHitT = bestT;
    if (G.cars){
      for (var ci = 0; ci < G.cars.length; ci++){
        var car = G.cars[ci];
        if (car === G.player.inCar) continue;
        var toCx = car.x - ox, toCy = 0.65 - oy, toCz = car.z - oz;
        var tc = toCx * dx + toCy * dy + toCz * dz;
        if (tc > 0 && tc < bestT && tc < carHitT){
          var perpDistSq = (toCx * toCx + toCy * toCy + toCz * toCz) - tc * tc;
          if (perpDistSq < 1.35 * 1.35){
            hitCar = car;
            carHitT = tc;
          }
        }
      }
    }

    // 2. Check enemies: body sphere & head critical sphere
    var best = null;
    for (var i = 0; i < G.enemies.length; i++){
      var e = G.enemies[i];
      if (e.dead) continue;
      var toEx = e.x - ox, toEy = (e.y || 1.2) - oy + 0.2, toEz = e.z - oz;
      var t = toEx * dx + toEy * dy + toEz * dz;
      if (t < 0 || t > bestT || (hitCar && t > carHitT)) continue;
      var perpSq = (toEx * toEx + toEy * toEy + toEz * toEz) - t * t;
      var hitR = e.hitR || (e.type === 'zombie' ? 0.55 : 0.5);
      if (perpSq < hitR * hitR && (!best || t < best.t)) { best = { e: e, t: t, head: false }; }

      var headR = e.headR || 0.24;
      var headH = e.headHeight || 1.45;
      var hx = e.x - ox, hy = (e.y || 0) + headH - oy, hz = e.z - oz;
      var th = hx * dx + hy * dy + hz * dz;
      if (th > 0 && th < bestT && (!hitCar || th < carHitT)){
        var perpHsq = (hx * hx + hy * hy + hz * hz) - th * th;
        if (perpHsq < headR * headR){ best = { e: e, t: th, head: true }; }
      }
    }

    // Test interactive props (hydrants, traffic cones)
    var hitProp = null, bestPropT = range;
    if (World && World.props){
      for (var pi = 0; pi < World.props.length; pi++){
        var pr = World.props[pi];
        var toPx = pr.x - ox, toPy = (pr.y || 0.4) - oy, toPz = pr.z - oz;
        var pt = toPx * dx + toPy * dy + toPz * dz;
        if (pt > 0.4 && pt < bestT && (!best || pt < best.t) && (!hitCar || pt < carHitT)){
          var perpDist2 = (toPx * toPx + toPy * toPy + toPz * toPz) - pt * pt;
          var rad = pr.radius || 0.35;
          if (perpDist2 < rad * rad && pt < bestPropT){
            bestPropT = pt;
            hitProp = pr;
          }
        }
      }
    }

    // 3. Determine tracer destination point
    var endPos = null;
    if (best){
      endPos = origin.clone().add(dir.clone().multiplyScalar(best.t));
    } else if (hitProp){
      endPos = origin.clone().add(dir.clone().multiplyScalar(bestPropT));
    } else if (hitCar){
      endPos = origin.clone().add(dir.clone().multiplyScalar(carHitT));
    } else if (bestT < range){
      endPos = origin.clone().add(dir.clone().multiplyScalar(bestT));
    } else {
      endPos = origin.clone().add(dir.clone().multiplyScalar(range));
    }

    // Spawn glowing bullet tracer from muzzle to impact point
    if (Effects && Effects.spawnTracer && muzzlePos){
      Effects.spawnTracer(muzzlePos, endPos);
    }

    // 4. Hit reactions
    if (best){
      var isHead = best.head;
      var d = dmg * (isHead ? 2.5 : 1.0); // 2.5x critical damage multiplier on headshots
      best.e.health -= d;
      best.e.flinchT = 0.24; // trigger hit flinch
      var headBloodY = (best.e.y||0) + (best.e.headHeight || 1.55);
      var bodyBloodY = (best.e.y||0) + (best.e.headHeight ? best.e.headHeight * 0.7 : 1.1);
      try {
        if (Enemies && Enemies.blood) {
          Enemies.blood(best.e.x, isHead ? headBloodY : bodyBloodY, best.e.z, isHead);
        }
      } catch(e) {}
      try {
        if (AudioSys && AudioSys.impactFlesh){
          AudioSys.impactFlesh(best.e.x, isHead ? headBloodY : bodyBloodY, best.e.z);
        } else if (AudioSys && AudioSys.hitFlesh) {
          AudioSys.hitFlesh();
        }
      } catch(e) {}
      try {
        if (AudioSys && AudioSys.hitTick) AudioSys.hitTick(isHead);
      } catch(e) {}
      try {
        if (HUD && HUD.hitmarker) HUD.hitmarker(isHead);
      } catch(e) {}
      if (best.e.health <= 0) { Enemies.kill(best.e); return true; }
      try {
        if (Enemies && Enemies.alert) Enemies.alert(best.e);
      } catch(e) {}
      return true;
    }

    if (hitProp){
      var ip = origin.clone().add(dir.clone().multiplyScalar(bestPropT));
      World.damageProp(hitProp, dir, ip);
      if (AudioSys && AudioSys.impactMetal) AudioSys.impactMetal(ip.x, ip.y, ip.z);
      return false;
    }

    if (hitCar){
      var ip = origin.clone().add(dir.clone().multiplyScalar(carHitT));
      if (Effects && Effects.ricochet) Effects.ricochet(ip, dir);
      if (AudioSys && AudioSys.impactMetal) AudioSys.impactMetal(ip.x, ip.y, ip.z);
      else AudioSys.ricochet();
      return false;
    }

    if (bestT < range){
      var ip = origin.clone().add(dir.clone().multiplyScalar(bestT));
      if (Effects){
        if (Effects.spark) Effects.spark(ip);
        if (Effects.dust) Effects.dust(ip, dir);
        if (Effects.bulletHole) Effects.bulletHole(ip, dir);
      }
      if (AudioSys && AudioSys.impactConcrete) AudioSys.impactConcrete(ip.x, ip.y, ip.z);
      return false;
    }
    return false;
  },

  reload: function(){
    var st = this.state, w = this.list[this.current];
    if (st.reloading>0 || st.mag >= w.mag || st.reserve<=0) return;
    var reloadDuration = (this.current === 'shotgun') ? 2.05 : 1.6;
    if (this.current === 'magnum'){
      var isEmpty = (st.mag === 0);
      reloadDuration = isEmpty ? 1.65 : 1.32;
    }
    st.reloading = reloadDuration;
    if (this.current === 'shotgun'){
      try { if (AudioSys.shotgunReload) AudioSys.shotgunReload(); else AudioSys.reload(); } catch(e){}
    } else if (this.current === 'magnum'){
      try { if (AudioSys.magnumReload) AudioSys.magnumReload(isEmpty); else AudioSys.reload(); } catch(e){}
    } else {
      try { AudioSys.reload(); } catch(e) {}
    }
    if (typeof G !== 'undefined' && G.player && G.player.inCar){
      if (typeof HUD !== 'undefined' && HUD.updateCarWeapon){
        HUD.updateCarWeapon(this.current, st.mag, st.reserve, true);
      }
      return;
    }
    // Trigger animated viewmodel reload clip if active
    if (this.animatedClips && this.animatedClips[this.current]){
      var clips = this.animatedClips[this.current];
      if (this.current === 'shotgun' && clips.reload_start && clips.reload && clips.reload_end){
        var self = this;
        if (this._shotgunReloadTimers){
          this._shotgunReloadTimers.forEach(function(t){ clearTimeout(t); });
        }
        this._shotgunReloadTimers = [];

        var rStart = clips.reload_start;
        var rMid = clips.reload;
        var rEnd = clips.reload_end;

        rStart.reset();
        rStart.setLoop(THREE.LoopOnce);
        rStart.clampWhenFinished = true;
        rStart.play();

        var t1 = setTimeout(function(){
          if (self.current === 'shotgun' && st.reloading > 0){
            rMid.reset();
            rMid.setLoop(THREE.LoopOnce);
            rMid.clampWhenFinished = true;
            rMid.play();
            try { AudioSys.click(0.42, 850, 0.04); } catch(e){}
            var t2 = setTimeout(function(){
              if (self.current === 'shotgun' && st.reloading > 0){
                rEnd.reset();
                rEnd.setLoop(THREE.LoopOnce);
                rEnd.clampWhenFinished = true;
                rEnd.play();
                try {
                  AudioSys.click(0.48, 1150, 0.035);
                  AudioSys.click(0.38, 620, 0.045);
                } catch(e){}
              }
            }, 708);
            self._shotgunReloadTimers.push(t2);
          }
        }, 625);
        this._shotgunReloadTimers.push(t1);
      } else {
        var rc = null;
        if (this.current === 'magnum'){
          rc = (st.mag === 0) ? (clips.reload_full || clips.reload) : (clips.reload_easy || clips.reload);
        } else {
          rc = clips.reload;
        }
        if (rc){
          rc.reset();
          rc.setLoop(THREE.LoopOnce);
          rc.clampWhenFinished = false;
          rc.play();
        }
      }
    } else if (this.current === 'shotgun' && this.shotgunClips && this.shotgunClips.reload){
      this.shotgunClips.reload.reset();
      this.shotgunClips.reload.setLoop(THREE.LoopOnce);
      this.shotgunClips.reload.play();
    }
    // Trigger the animated arms Reload clip (rifle only). 1.65 s clip vs 1.6 s timer
    // — timeScale stretches it to fit the reload window.
    if (this.current === 'ak47' && this._armsPlay){
      var a = this._armsPlay('reload', false, 0.08, 0.08);
      if (a && WeaponVisual.armsMixer){
        WeaponVisual.armsMixer.timeScale = 1.65/1.6;
        var self = this;
        var onReloadEnd = function(e){
          if (e.action === a){
            WeaponVisual.armsMixer.removeEventListener('finished', onReloadEnd);
            WeaponVisual.armsMixer.timeScale = 1.0;
            if (self._armsCurrent === 'reload'){
              var base = (st.sprintAmount > 0.3) ? 'run'
                       : (st.bobAmount   > 0.3) ? 'walk'
                       : 'idle';
              self._armsPlay(base, true, 0.18, 0.18);
            }
          }
        };
        WeaponVisual.armsMixer.addEventListener('finished', onReloadEnd);
      }
    }
  },

  inspect: function(){
    var st = this.state;
    if (G.paused || G.player.dead || G.player.inCar || st.reloading > 0 || st.inspecting) return;
    if (this.animatedClips && this.animatedClips[this.current] && this.animatedClips[this.current].watch){
      st.inspecting = true;
      st.idleInspectTimer = -5.0;
      var wc = this.animatedClips[this.current].watch;
      wc.reset();
      wc.setLoop(THREE.LoopOnce);
      wc.play();
    } else if (this.current === 'shotgun' && this.shotgunClips && this.shotgunClips.watch){
      st.inspecting = true;
      st.idleInspectTimer = -5.0;
      this.shotgunClips.watch.reset();
      this.shotgunClips.watch.setLoop(THREE.LoopOnce);
      this.shotgunClips.watch.play();
    } else if (this.current === 'magnum'){
      st.inspecting = true;
      st.inspectTimer = 2.4;
      st.idleInspectTimer = -5.0;
    }
    if (this.current === 'ak47' && this._armsPlay && WeaponVisual.armsClips && WeaponVisual.armsClips.inspect){
      st.inspecting = true;
      st.idleInspectTimer = -5.0; // buffer so it doesn't immediately re-trigger
      var a = this._armsPlay('inspect', false, 0.15, 0.15);
      if (a && WeaponVisual.armsMixer){
        var self = this;
        var onInspectEnd = function(e){
          if (e.action === a){
            WeaponVisual.armsMixer.removeEventListener('finished', onInspectEnd);
            st.inspecting = false;
            st.idleInspectTimer = -5.0;
            var base = (st.sprintAmount > 0.3) ? 'run'
                     : (st.bobAmount   > 0.3) ? 'walk'
                     : 'idle';
            if (base !== self._armsCurrent) self._armsPlay(base, true, 0.18, 0.18);
          }
        };
        WeaponVisual.armsMixer.addEventListener('finished', onInspectEnd);
      }
    }
  },

  updateInCar: function(dt){
    var st = this.state, w = this.list[this.current];
    this.updatePickups(dt);
    st.cooldown -= dt;
    if (st.reloading > 0){
      st.reloading -= dt;
      if (st.reloading <= 0){
        var need = w.mag - st.mag;
        var take = Math.min(need, st.reserve);
        st.mag += take; st.reserve -= take;
        if (typeof HUD !== 'undefined'){
          HUD.ammo(st.mag, st.reserve);
          if (HUD.updateCarWeapon) HUD.updateCarWeapon(this.current, st.mag, st.reserve, false);
        }
      }
    }
    if (st.flashT > 0){
      st.flashT -= dt;
      if (st.flashT <= 0){
        st.flashLight.intensity = 0;
      }
    }
    // Auto fire while driving (supports Left Mouse Button, KeyX, and mobile touch)
    if ((G.mouseDown || G.keys['KeyX'] || (G.touch && G.touch.fire)) && w.auto){
      this.fire();
    }
    // Update live in-car weapon HUD
    if (typeof HUD !== 'undefined' && HUD.updateCarWeapon){
      HUD.updateCarWeapon(this.current, st.mag, st.reserve, st.reloading > 0);
    }
  },

  update: function(dt){
    var st = this.state, w = this.list[this.current];
    this.updatePickups(dt);
    if (typeof G !== 'undefined' && G.player && G.player.inCar){
      this.updateInCar(dt);
      return;
    }
    st.cooldown -= dt;
    if (st.reloading > 0){
      st.reloading -= dt;
      if (st.reloading <= 0){
        var need = w.mag - st.mag;
        var take = Math.min(need, st.reserve);
        st.mag += take; st.reserve -= take;
        HUD.ammo(st.mag, st.reserve);
      }
    }
    if (st.flashT > 0){ st.flashT -= dt; if (st.flashT<=0){ st.flash.visible=false; st.flashLight.intensity=0; } }
    // Animated FPS arms: advance the skeleton (idle loop + future states).
    if (WeaponVisual.armsMixer) WeaponVisual.armsMixer.update(dt);
    if (this.animatedMixers && this.animatedMixers[this.current]){
      this.animatedMixers[this.current].update(dt);
    } else if (this.shotgunMixer && this.current === 'shotgun'){
      this.shotgunMixer.update(dt);
    }

    // Attach the third-person gun as soon as the character model is ready
    this.tryAttachThirdPerson();
    // Per-frame authoritative visibility: in-car hides everything, on-foot shows.
    this.setVisible(!G.player.inCar);
    // auto fire (supports Left Mouse Button, KeyX, and mobile touch)
    if ((G.mouseDown || G.keys['KeyX'] || G.touch.fire) && w.auto) this.fire();
    // Procedural viewmodel animation: target-based smooth interpolation
    var m = st.model;
    if (m && !G.player.inCar){
      // decay recoil kick smoothly
      st.kick = Math.max(0, st.kick - dt * 6);

      // movement detection (same input source as Player)
      var fwdIn = (G.keys['KeyW']||G.keys['ArrowUp']?1:0) - (G.keys['KeyS']||G.keys['ArrowDown']?1:0);
      var strIn = (G.keys['KeyD']||G.keys['ArrowRight']?1:0) - (G.keys['KeyA']||G.keys['ArrowLeft']?1:0);
      fwdIn -= G.touch.moveZ; strIn += G.touch.moveX;
      var mag = Math.sqrt(fwdIn*fwdIn + strIn*strIn);
      var moving = mag > 0.1;
      var sprint = (G.keys['ShiftLeft']||G.keys['ShiftRight']) && moving;
      var isAiming = !sprint && !!G.aimDownSights;

      // Cancel inspect if sprinting or actively moving
      if (st.inspecting && (sprint || mag > 0.5)){
        st.inspecting = false;
        st.idleInspectTimer = 0;
        var next = sprint ? 'run' : 'walk';
        if (this._armsPlay) this._armsPlay(next, true, 0.15, 0.15);
      }

      // Automatic inspect after 3.5s of no shooting, moving, or aiming
      if (moving || sprint || isAiming || st.reloading > 0 || G.mouseDown || G.keys['KeyX']){
        st.idleInspectTimer = 0;
      } else if (!st.inspecting){
        st.idleInspectTimer += dt;
        if (st.idleInspectTimer >= 3.5){
          this.inspect();
        }
      }

      // smoothed state intensities (0..1) — no abrupt snapping
      var moveT = moving ? 1 : 0;
      var sprT = sprint ? 1 : 0;
      st.bobAmount += (moveT - st.bobAmount) * Math.min(1, dt * 5);
      st.sprintAmount += (sprT - st.sprintAmount) * Math.min(1, dt * 4);

      // advance walk phase only while moving (drives the bob)
      if (moving) st.walkPhase += dt * (sprint ? 11 : 7.5);

      // Walk/Run crossfade on movement state changes (rifle only, when not inspecting or reloading).
      if (this.current === 'ak47' && this._armsPlay && st.reloading <= 0 && !st.inspecting){
        if (this._armsCurrent === 'fire'){
          if (this._armsActive && (!this._armsActive.isRunning() || st.cooldown < -0.06)){
            var base = sprint ? 'run' : (moving ? 'walk' : 'idle');
            this._armsPlay(base, true, 0.12, 0.12);
          }
        } else if (sprint){
          // Sprinting: run > walk > idle
          this._armsPlay('run', true, 0.15, 0.12);
        } else if (moving){
          // Walking: walk overrides idle (if currently idle)
          this._armsPlay('walk', true, 0.12, 0.12);
        } else {
          // Standing still: back to idle
          if (this._armsCurrent !== 'idle'){
            this._armsPlay('idle', true, 0.18, 0.18);
          }
        }
      } else if (this.current === 'magnum' && this.animatedClips && this.animatedClips['magnum'] && st.reloading <= 0 && !st.inspecting){
        var mClips = this.animatedClips['magnum'];
        if (mClips.walk && mClips.idle){
          var isMoving = (st.bobAmount > 0.25 || st.sprintAmount > 0.25);
          var shootAction = mClips.shoot;
          var isShooting = shootAction && shootAction.isRunning();
          if (!isShooting){
            if (isMoving && !mClips.walk.isRunning()){
              mClips.walk.reset();
              mClips.walk.setLoop(THREE.LoopRepeat, Infinity);
              mClips.walk.enabled = true;
              mClips.walk.crossFadeFrom(mClips.idle, 0.18, true);
              mClips.walk.play();
            } else if (!isMoving && mClips.walk.isRunning()){
              mClips.idle.reset();
              mClips.idle.setLoop(THREE.LoopRepeat, Infinity);
              mClips.idle.enabled = true;
              mClips.idle.crossFadeFrom(mClips.walk, 0.18, true);
              mClips.idle.play();
            }
          }
        }
      }

      // --- compute target offset from a stable base ---
      var op = st.offsetPos, or = st.offsetRot;
      op.set(0, 0, 0);
      or.set(0, 0, 0);

      // ADS state calculation
      if (isAiming && st.inspecting) st.inspecting = false;
      st.adsAmount += ((isAiming ? 1 : 0) - st.adsAmount) * Math.min(1, dt * 14);

      // Smoothly update wrap transform between hip and ADS
      var wrap = st.model.userData && st.model.userData.armsWrap;
      if (wrap && st.hipPos && st.adsPos){
        wrap.position.lerpVectors(st.hipPos, st.adsPos, st.adsAmount);
        wrap.rotation.x = THREE.MathUtils.lerp(st.hipRot.x, st.adsRot.x, st.adsAmount);
        wrap.rotation.y = THREE.MathUtils.lerp(st.hipRot.y, st.adsRot.y, st.adsAmount);
        wrap.rotation.z = THREE.MathUtils.lerp(st.hipRot.z, st.adsRot.z, st.adsAmount);
      }
      if (this.current === 'shotgun' && this.shotgunWrap && this.shotgunHipPos && this.shotgunAdsPos){
        this.shotgunWrap.position.lerpVectors(this.shotgunHipPos, this.shotgunAdsPos, st.adsAmount);
        var sHipR = this.shotgunHipRot || this._defaultShotgunHipRot;
        var sAdsR = this.shotgunAdsRot || this._defaultZeroRot;
        this.shotgunWrap.rotation.x = THREE.MathUtils.lerp(sHipR.x, sAdsR.x, st.adsAmount);
        this.shotgunWrap.rotation.y = THREE.MathUtils.lerp(sHipR.y, sAdsR.y, st.adsAmount);
        this.shotgunWrap.rotation.z = THREE.MathUtils.lerp(sHipR.z, sAdsR.z, st.adsAmount);
      }
      if (this.current === 'magnum' && this.magnumWrap && this.magnumHipPos && this.magnumAdsPos){
        this.magnumWrap.position.lerpVectors(this.magnumHipPos, this.magnumAdsPos, st.adsAmount);
        var mHipR = this.magnumHipRot || this._defaultMagnumHipRot;
        var mAdsR = this.magnumAdsRot || this._defaultZeroRot;
        this.magnumWrap.rotation.x = THREE.MathUtils.lerp(mHipR.x, mAdsR.x, st.adsAmount);
        this.magnumWrap.rotation.y = THREE.MathUtils.lerp(mHipR.y, mAdsR.y, st.adsAmount);
        this.magnumWrap.rotation.z = THREE.MathUtils.lerp(mHipR.z, mAdsR.z, st.adsAmount);
      }
      // Procedural fallback meshes ADS centering
      if (this.customWeapons && this.customWeapons[this.current]){
        var fb = this.customWeapons[this.current];
        if (fb && fb.userData && fb.userData.hipPos && fb.userData.adsPos){
          fb.position.lerpVectors(fb.userData.hipPos, fb.userData.adsPos, st.adsAmount);
        }
      }

      // Smooth camera FOV zoom (70 deg hip down to 52 deg in ADS)
      var targetFov = 70 - st.adsAmount * 18;
      if (G.camera && Math.abs(G.camera.fov - targetFov) > 0.02){
        G.camera.fov = targetFov;
        G.camera.updateProjectionMatrix();
      }

      // Update HUD crosshair opacity in ADS
      if (window.HUD && HUD.setADS){
        HUD.setADS(isAiming, st.adsAmount);
      }

      // idle: very subtle slow breathing (further calmed in ADS)
      var adsCalm = 1 - st.adsAmount * 0.6;
      st.idleTime += dt;
      op.x += Math.sin(st.idleTime * 0.8) * 0.0015 * adsCalm;
      op.y += Math.cos(st.idleTime * 0.6) * 0.0012 * adsCalm;
      or.x += Math.sin(st.idleTime * 0.45) * 0.0008 * adsCalm;

      // walk bob: smooth sine cycle, calmed in ADS
      var adsBobMult = 1 - st.adsAmount * 0.75;
      var bobX = Math.sin(st.walkPhase) * 0.010 * st.bobAmount * adsBobMult;
      var bobY = -Math.abs(Math.cos(st.walkPhase)) * 0.006 * st.bobAmount * adsBobMult;
      var bobTilt = Math.sin(st.walkPhase) * 0.03 * st.bobAmount * adsBobMult;
      op.x += bobX;
      op.y += bobY;
      or.z += bobTilt;

      // sprint: lower and to the side with a noticeable tilt (only when not aiming)
      var sprEff = st.sprintAmount * (1 - st.adsAmount);
      op.x += 0.055 * sprEff;
      op.y -= 0.085 * sprEff;
      or.x += -0.22 * sprEff;
      or.y += 0.18 * sprEff;

      // recoil: brief kick toward camera + up, springing back
      var kickEff = 1 - st.adsAmount * 0.35;
      op.z += st.kick * 0.035 * kickEff;
      op.y += st.kick * 0.018 * kickEff;
      or.x += st.kick * 0.10 * kickEff;

      // Procedural reload motion for magnum (only if no skeletal reload animation is active)
      if (st.reloading > 0 && this.current === 'magnum' && (!this.animatedClips || !this.animatedClips['magnum'] || (!this.animatedClips['magnum'].reload_easy && !this.animatedClips['magnum'].reload_full))){
        var rProg = 1.0 - (st.reloading / 1.8);
        if (rProg >= 0 && rProg <= 1){
          var dip = Math.sin(rProg * Math.PI) * 0.08;
          op.y -= dip;
          or.z += Math.sin(rProg * Math.PI) * 0.12;
        }
      }

      // Procedural weapon inspect flourish for magnum fallback
      if (st.inspecting && this.current === 'magnum' && (!this.animatedClips || !this.animatedClips['magnum'] || !this.animatedClips['magnum'].watch)){
        st.inspectTimer = (st.inspectTimer || 2.4) - dt;
        if (st.inspectTimer <= 0){
          st.inspecting = false;
          st.idleInspectTimer = -5.0;
        } else {
          var inspT = 1.0 - (st.inspectTimer / 2.4);
          var tilt = Math.sin(inspT * Math.PI) * 0.35;
          or.z += tilt;
          or.y -= tilt * 0.4;
          op.y += Math.sin(inspT * Math.PI) * 0.03;
        }
      } else if (st.inspecting && this.animatedMixers && this.animatedMixers[this.current]){
        st.inspectTimer = (st.inspectTimer || 2.5) - dt;
        if (st.inspectTimer <= 0){
          st.inspecting = false;
          st.idleInspectTimer = -5.0;
        }
      }

      // --- target = stable base + offsets ---
      // Narrow/portrait screens: the horizontal FOV shrinks with aspect while
      // the vertical stays fixed, so pull the anchor toward center to keep the
      // gun on-screen (desktop aspect >= 1.5 is unaffected).
      var baseX = st.basePos.x * Math.min(1, G.camera.aspect / 1.5);
      var tx = baseX + op.x;
      var ty = st.basePos.y + op.y;
      var tz = st.basePos.z + op.z;
      var trx = st.baseRot.x + or.x;
      var trY = st.baseRot.y + or.y;
      var trz = st.baseRot.z + or.z;

      // smooth exponential damping toward target (frame-rate independent)
      var k = 1 - Math.exp(-12 * dt);
      m.position.x += (tx - m.position.x) * k;
      m.position.y += (ty - m.position.y) * k;
      m.position.z += (tz - m.position.z) * k;
      m.rotation.x += (trx - m.rotation.x) * k;
      m.rotation.y += (trY - m.rotation.y) * k;
      m.rotation.z += (trz - m.rotation.z) * k;
    }
    // crosshair spread decay
    HUD.spreadDecay(dt);
  }
};

// Comprehensive ballistics effect system: 3D shell casings, tracers, bullet holes, dust, ricochets & blood
var Effects = {
  pool: [],
  casings: [],
  tracers: [],
  decals: [],

  init: function(){
    // Canvas texture for particle billboards (dust, sparks, blood)
    var c = document.createElement('canvas'); c.width = 32; c.height = 32;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    this.tex = new THREE.CanvasTexture(c);

    // Canvas texture for bullet hole decals
    var dc = document.createElement('canvas'); dc.width = 64; dc.height = 64;
    var dg = dc.getContext('2d');
    dg.beginPath(); dg.arc(32, 32, 9, 0, Math.PI * 2);
    dg.fillStyle = '#0a0a0c'; dg.fill();
    dg.beginPath(); dg.arc(32, 32, 17, 0, Math.PI * 2);
    dg.fillStyle = 'rgba(38,34,30,0.55)'; dg.fill();
    dg.beginPath(); dg.arc(32, 32, 27, 0, Math.PI * 2);
    dg.fillStyle = 'rgba(75,70,65,0.16)'; dg.fill();
    this.decalTex = new THREE.CanvasTexture(dc);

    // Canvas texture for street blood pool decals
    var bc = document.createElement('canvas'); bc.width = 128; bc.height = 128;
    var bg = bc.getContext('2d');
    var bGrad = bg.createRadialGradient(64, 64, 10, 64, 64, 56);
    bGrad.addColorStop(0, 'rgba(110, 8, 8, 0.92)');
    bGrad.addColorStop(0.55, 'rgba(80, 5, 5, 0.85)');
    bGrad.addColorStop(0.85, 'rgba(50, 4, 4, 0.5)');
    bGrad.addColorStop(1, 'rgba(40, 2, 2, 0)');
    bg.fillStyle = bGrad;
    bg.beginPath();
    bg.arc(64, 64, 52, 0, Math.PI * 2);
    bg.fill();
    bg.fillStyle = 'rgba(75, 6, 6, 0.82)';
    for (var bi = 0; bi < 16; bi++){
      var ba = Math.random() * Math.PI * 2;
      var bd = 38 + Math.random() * 22;
      var br = 2.5 + Math.random() * 4.5;
      bg.beginPath();
      bg.arc(64 + Math.cos(ba) * bd, 64 + Math.sin(ba) * bd, br, 0, Math.PI * 2);
      bg.fill();
    }
    this.bloodTex = new THREE.CanvasTexture(bc);

    // Canvas texture for corrosive acid hazard pool decals
    var ac = document.createElement('canvas'); ac.width = 128; ac.height = 128;
    var ag = ac.getContext('2d');
    var aGrad = ag.createRadialGradient(64, 64, 8, 64, 64, 58);
    aGrad.addColorStop(0, 'rgba(120, 240, 20, 0.95)');
    aGrad.addColorStop(0.45, 'rgba(80, 200, 15, 0.85)');
    aGrad.addColorStop(0.75, 'rgba(40, 150, 10, 0.55)');
    aGrad.addColorStop(1, 'rgba(20, 90, 5, 0)');
    ag.fillStyle = aGrad;
    ag.beginPath();
    ag.arc(64, 64, 56, 0, Math.PI * 2);
    ag.fill();
    ag.fillStyle = 'rgba(180, 255, 60, 0.9)';
    for (var ai = 0; ai < 18; ai++){
      var aa = Math.random() * Math.PI * 2;
      var ad = 12 + Math.random() * 42;
      var ar = 2.0 + Math.random() * 4.0;
      ag.beginPath();
      ag.arc(64 + Math.cos(aa) * ad, 64 + Math.sin(aa) * ad, ar, 0, Math.PI * 2);
      ag.fill();
    }
    this.acidTex = new THREE.CanvasTexture(ac);

    // 3D brass shell casing geometry & metallic material
    // 3D brass shell casing geometry & metallic material (high visibility gold)
    this.casingGeo = new THREE.CylinderGeometry(0.009, 0.011, 0.038, 7);
    this.casingMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.92,
      roughness: 0.22,
      emissive: 0x332200,
      transparent: true,
      opacity: 1
    });

    // High-speed glowing tracer material
    this.tracerMat = new THREE.LineBasicMaterial({
      color: 0xffea77,
      linewidth: 3,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending
    });
  },

  spawn: function(x, y, z, color, size, life, vy, vx, vz, sizeGrowth, gravity){
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:this.tex, color:color, transparent:true, depthWrite:false }));
    sp.position.set(x, y, z); sp.scale.set(size, size, 1);
    G.scene.add(sp);
    this.pool.push({
      s: sp,
      life: life,
      max: life,
      baseSize: size,
      growth: sizeGrowth || 0,
      gravity: gravity || 0,
      vx: vx || 0,
      vy: vy || 0,
      vz: vz || 0
    });
  },

  // High-pressure water geyser fountain from cracked fire hydrant
  waterSpray: function(x, y, z){
    for (var i = 0; i < 6; i++){
      var ang = Math.random() * Math.PI * 2;
      var spd = rand(0.25, 1.2);
      this.spawn(
        x + rand(-0.06, 0.06), y + rand(-0.02, 0.08), z + rand(-0.06, 0.06),
        Math.random() < 0.45 ? 0xffffff : 0x88ccee,
        rand(0.18, 0.38),
        rand(0.55, 1.05),
        rand(4.2, 7.6),
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        0.35,
        13.0
      );
    }
  },

  // Friction tire smoke behind car tires during handbrake drift
  tireSmoke: function(x, y, z){
    for (var i = 0; i < 3; i++){
      this.spawn(
        x + rand(-0.2, 0.2), y + rand(0.04, 0.15), z + rand(-0.2, 0.2),
        0xdddddf,
        rand(0.28, 0.45),
        rand(0.35, 0.7),
        rand(0.15, 0.45),
        rand(-0.2, 0.2),
        rand(-0.2, 0.2),
        0.75,
        0
      );
    }
  },

  // Concrete dust puff on pavement / building hit
  dust: function(p, dir){
    for (var i = 0; i < 4; i++){
      var offX = rand(-0.08, 0.08) - (dir ? dir.x * 0.05 : 0);
      var offY = rand(-0.05, 0.08) - (dir ? dir.y * 0.05 : 0);
      var offZ = rand(-0.08, 0.08) - (dir ? dir.z * 0.05 : 0);
      this.spawn(
        p.x + offX, p.y + offY, p.z + offZ,
        0xcac0b4, rand(0.15, 0.28), rand(0.4, 0.6),
        rand(0.12, 0.4), rand(-0.2, 0.2), rand(-0.2, 0.2),
        0.45
      );
    }
  },

  spark: function(p){
    for (var i = 0; i < 4; i++){
      this.spawn(
        p.x + rand(-0.05, 0.05), p.y + rand(-0.05, 0.05), p.z + rand(-0.05, 0.05),
        0xffea99, rand(0.1, 0.2), 0.25, rand(0.35, 0.8), rand(-0.4, 0.4), rand(-0.4, 0.4)
      );
    }
  },

  // Directional metal ricochet spark burst
  ricochet: function(p, inDir){
    var normX = -inDir.x, normZ = -inDir.z;
    for (var i = 0; i < 9; i++){
      var spx = normX * rand(0.8, 2.5) + rand(-1.1, 1.1);
      var spy = rand(0.9, 2.8);
      var spz = normZ * rand(0.8, 2.5) + rand(-1.1, 1.1);
      this.spawn(
        p.x, p.y, p.z,
        Math.random() < 0.35 ? 0xffffff : 0xffaa33,
        rand(0.08, 0.16),
        rand(0.22, 0.38),
        spy, spx, spz
      );
    }
  },

  // Locational blood puffs
  blood: function(x, y, z, headshot){
    var count = headshot ? 9 : 4;
    var col = headshot ? 0x900c0c : 0x7a1010;
    for (var i = 0; i < count; i++){
      this.spawn(
        x + rand(-0.16, 0.16), y + rand(-0.12, 0.12), z + rand(-0.16, 0.16),
        col,
        rand(0.18, headshot ? 0.45 : 0.3),
        rand(0.35, 0.55),
        rand(-0.4, 0.15),
        rand(-0.25, 0.25), rand(-0.25, 0.25)
      );
    }
  },

  // Bullet hole decals on walls and pavement
  bulletHole: function(p, dir){
    if (!this.decalTex) return;
    var norm = new THREE.Vector3(-dir.x, 0, -dir.z).normalize();
    if (Math.abs(p.y) < 0.06) norm.set(0, 1, 0);
    var decal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.15),
      new THREE.MeshBasicMaterial({
        map: this.decalTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      })
    );
    decal.position.copy(p).add(norm.clone().multiplyScalar(0.015));
    if (norm.y > 0.8){
      decal.rotation.x = -Math.PI / 2;
    } else {
      decal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
    }
    decal.rotation.z = Math.random() * Math.PI * 2;
    G.scene.add(decal);
    this.decals.push({ m: decal, life: 14.0, max: 14.0 });
    if (this.decals.length > 50){
      var old = this.decals.shift();
      G.scene.remove(old.m);
      if (old.m.geometry) old.m.geometry.dispose();
      if (old.m.material) old.m.material.dispose();
    }
  },

  // Street blood puddle decal beneath slain infected
  bloodPool: function(x, z, scale){
    if (!this.bloodTex) return;
    var sz = (scale || 1.0) * (0.8 + Math.random() * 0.4);
    var decal = new THREE.Mesh(
      new THREE.PlaneGeometry(sz, sz),
      new THREE.MeshBasicMaterial({
        map: this.bloodTex,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      })
    );
    decal.position.set(x, 0.02, z);
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = Math.random() * Math.PI * 2;
    G.scene.add(decal);
    this.decals.push({ m: decal, life: 30.0, max: 30.0 });
    if (this.decals.length > 50){
      var old = this.decals.shift();
      G.scene.remove(old.m);
      if (old.m.geometry) old.m.geometry.dispose();
      if (old.m.material) old.m.material.dispose();
    }
  },

  // Corrosive acid puddle decal on street asphalt
  acidPoolDecal: function(x, z, radius, duration){
    if (!this.acidTex) return null;
    var sz = (radius || 2.2) * 2;
    var decal = new THREE.Mesh(
      new THREE.PlaneGeometry(sz, sz),
      new THREE.MeshBasicMaterial({
        map: this.acidTex,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      })
    );
    decal.position.set(x, 0.025, z);
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = Math.random() * Math.PI * 2;
    G.scene.add(decal);
    var item = { m: decal, life: duration || 7.5, max: duration || 7.5 };
    this.decals.push(item);
    return item;
  },

  // Toxic green bile vapor trail behind lobbed acid projectile
  acidTrail: function(x, y, z){
    for (var i = 0; i < 2; i++){
      this.spawn(
        x + rand(-0.08, 0.08), y + rand(-0.06, 0.06), z + rand(-0.08, 0.08),
        Math.random() < 0.6 ? 0x76ea1c : 0xa4ff30,
        rand(0.12, 0.24),
        rand(0.25, 0.45),
        rand(0.3, 0.8),
        rand(-0.15, 0.15), rand(-0.15, 0.15),
        0.35,
        -0.5
      );
    }
  },

  // Acid splatter explosion when projectile or Spitter detonates
  acidBurst: function(x, y, z, count){
    var n = count || 18;
    for (var i = 0; i < n; i++){
      var ang = Math.random() * Math.PI * 2;
      var spd = rand(0.5, 3.2);
      this.spawn(
        x + rand(-0.1, 0.1), y + rand(0.05, 0.3), z + rand(-0.1, 0.1),
        Math.random() < 0.7 ? 0x62e012 : 0x8df538,
        rand(0.14, 0.32),
        rand(0.4, 0.85),
        rand(1.2, 3.8),
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        0.4,
        9.5
      );
    }
  },

  // Wispy shadow smoke trailing behind Stalker infected
  shadowMist: function(x, y, z){
    for (var i = 0; i < 2; i++){
      this.spawn(
        x + rand(-0.12, 0.12), y + rand(0.1, 1.2), z + rand(-0.12, 0.12),
        Math.random() < 0.5 ? 0x221133 : 0x7700aa,
        rand(0.15, 0.3),
        rand(0.3, 0.55),
        rand(0.1, 0.35),
        rand(-0.1, 0.1), rand(-0.1, 0.1),
        0.35,
        0
      );
    }
  },

  // Violent shadow burst when Stalker decloaks and lunges
  shadowBurst: function(x, y, z){
    for (var i = 0; i < 14; i++){
      var ang = Math.random() * Math.PI * 2;
      var spd = rand(0.6, 2.4);
      this.spawn(
        x + rand(-0.1, 0.1), y + rand(0.4, 1.4), z + rand(-0.1, 0.1),
        Math.random() < 0.6 ? 0x181022 : 0xaa22ee,
        rand(0.25, 0.48),
        rand(0.45, 0.75),
        rand(0.3, 1.2),
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        0.6,
        0
      );
    }
  },

  // Heavy .50 BMG armored convoy tracer fire
  convoyTracer: function(from, to){
    var dir = to.clone().sub(from);
    var dist = dir.length();
    if (dist < 0.1) return;
    dir.normalize();
    var geo = new THREE.BufferGeometry();
    var posArr = new Float32Array([from.x, from.y, from.z, from.x, from.y, from.z]);
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    var mat = new THREE.LineBasicMaterial({
      color: 0xff4411,
      linewidth: 4,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending
    });
    var line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    G.scene.add(line);
    var headGeo = new THREE.SphereGeometry(0.06, 6, 6);
    var headMat = new THREE.MeshBasicMaterial({ color: 0xffaa44, blending: THREE.AdditiveBlending });
    var head = new THREE.Mesh(headGeo, headMat);
    head.position.copy(from);
    G.scene.add(head);
    this.tracers.push({
      line: line, head: head, start: from.clone(), dir: dir, dist: dist,
      progress: 0, speed: 320, tailLen: 4.5
    });
  },

  // 3D brass shell casing ejection with physics, tumbling and street bounce
  spawnCasing: function(pos, fwd, up, right){
    if (!this.casingGeo) return;
    var mesh = new THREE.Mesh(this.casingGeo, this.casingMat.clone());
    mesh.position.copy(pos);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    G.scene.add(mesh);
    // Ejection impulse: arched rightward & upward within FOV view
    var vel = right.clone().multiplyScalar(rand(1.2, 2.0))
      .add(up.clone().multiplyScalar(rand(1.2, 2.0)))
      .add(fwd.clone().multiplyScalar(rand(-0.3, 0.3)));
    var rotVel = new THREE.Vector3(rand(-18, 18), rand(-25, 25), rand(-18, 18));
    this.casings.push({
      m: mesh,
      pos: mesh.position,
      vel: vel,
      rotVel: rotVel,
      life: 5.5,
      bounces: 0,
      atRest: false
    });
    if (this.casings.length > 25){
      var old = this.casings.shift();
      G.scene.remove(old.m);
      if (old.m.material) old.m.material.dispose();
    }
  },

  // High-speed glowing bullet tracer with glowing round head
  spawnTracer: function(startPos, endPos){
    if (!this.tracerMat) return;
    var geom = new THREE.BufferGeometry().setFromPoints([startPos.clone(), startPos.clone()]);
    var line = new THREE.Line(geom, this.tracerMat.clone());
    line.frustumCulled = false;
    G.scene.add(line);

    // Radiant bullet head sprite
    var head = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.tex,
      color: 0xfff088,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    head.scale.set(0.18, 0.18, 1);
    head.position.copy(startPos);
    G.scene.add(head);

    var dist = startPos.distanceTo(endPos);
    var dir = endPos.clone().sub(startPos).normalize();
    this.tracers.push({
      line: line,
      head: head,
      start: startPos.clone(),
      end: endPos.clone(),
      dir: dir,
      dist: dist,
      progress: 0,
      speed: 210,
      tailLen: Math.min(4.5, dist * 0.4)
    });
  },

  // Wood splinters and sawdust burst when barricade planks are hammered or broken
  woodDebris: function(x, y, z){
    var count = 14;
    for (var i = 0; i < count; i++){
      var sp = this.spawn(
        x + rand(-0.3, 0.3),
        y + rand(-0.3, 0.3),
        z + rand(-0.3, 0.3),
        (Math.random() < 0.5) ? 0x7c532b : 0x54361c,
        rand(0.12, 0.22),
        rand(0.4, 0.8),
        rand(8, 14)
      );
      sp.vx = rand(-3.5, 3.5);
      sp.vy = rand(1.5, 5.0);
      sp.vz = rand(-3.5, 3.5);
    }
  },

  // Water splash droplets for rain puddles and vehicle tire spray
  waterSplash: function(x, y, z){
    var count = 8;
    for (var i = 0; i < count; i++){
      var sp = this.spawn(
        x + rand(-0.2, 0.2),
        y + 0.05,
        z + rand(-0.2, 0.2),
        0x9ac8e8,
        rand(0.15, 0.28),
        rand(0.3, 0.6),
        16
      );
      sp.vx = rand(-2.5, 2.5);
      sp.vy = rand(2.0, 4.5);
      sp.vz = rand(-2.5, 2.5);
    }
  },

  update: function(dt){
    // 1. Particle pool (sparks, dust, blood)
    for (var i = this.pool.length - 1; i >= 0; i--){
      var p = this.pool[i];
      p.life -= dt;
      if (p.gravity) p.vy -= p.gravity * dt;
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      if (p.growth){
        var prog = 1 - (p.life / p.max);
        var sz = p.baseSize + prog * p.growth;
        p.s.scale.set(sz, sz, 1);
      }
      p.s.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0){
        G.scene.remove(p.s);
        this.pool.splice(i, 1);
      }
    }
    if (this.pool.length > 140){
      var old = this.pool.shift();
      G.scene.remove(old.s);
    }

    // 2. 3D Tumbling brass shell casings
    for (var i = this.casings.length - 1; i >= 0; i--){
      var c = this.casings[i];
      c.life -= dt;
      if (!c.atRest){
        c.vel.y -= 9.8 * dt; // gravity
        c.pos.x += c.vel.x * dt;
        c.pos.y += c.vel.y * dt;
        c.pos.z += c.vel.z * dt;
        c.m.rotation.x += c.rotVel.x * dt;
        c.m.rotation.y += c.rotVel.y * dt;
        c.m.rotation.z += c.rotVel.z * dt;

        // Ground collision (flat city pavement at y=0)
        if (c.pos.y <= 0.015){
          c.pos.y = 0.015;
          c.bounces++;
          if (c.bounces < 3 && Math.abs(c.vel.y) > 0.4){
            c.vel.y = -c.vel.y * 0.38; // bounce restitution
            c.vel.x *= 0.65;
            c.vel.z *= 0.65;
            c.rotVel.multiplyScalar(0.5);
          } else {
            c.atRest = true;
            c.vel.set(0, 0, 0);
            c.rotVel.set(0, 0, 0);
            c.m.rotation.x = Math.PI / 2; // settle flat on pavement
          }
        }
      }
      // Fade out in last 1.2 seconds
      if (c.life < 1.2){
        c.m.material.opacity = Math.max(0, c.life / 1.2);
      }
      if (c.life <= 0){
        G.scene.remove(c.m);
        if (c.m.material) c.m.material.dispose();
        this.casings.splice(i, 1);
      }
    }

    // 3. Glowing bullet tracers
    for (var i = this.tracers.length - 1; i >= 0; i--){
      var t = this.tracers[i];
      t.progress += t.speed * dt;
      var headDist = Math.min(t.dist, t.progress);
      var tailDist = Math.max(0, t.progress - t.tailLen);
      var hx = t.start.x + t.dir.x * headDist;
      var hy = t.start.y + t.dir.y * headDist;
      var hz = t.start.z + t.dir.z * headDist;
      var tx = t.start.x + t.dir.x * tailDist;
      var ty = t.start.y + t.dir.y * tailDist;
      var tz = t.start.z + t.dir.z * tailDist;
      var posAttr = t.line.geometry.attributes.position;
      posAttr.setXYZ(0, tx, ty, tz);
      posAttr.setXYZ(1, hx, hy, hz);
      posAttr.needsUpdate = true;
      if (t.head) t.head.position.set(hx, hy, hz);
      if (tailDist >= t.dist){
        G.scene.remove(t.line);
        if (t.line.geometry) t.line.geometry.dispose();
        if (t.line.material) t.line.material.dispose();
        if (t.head){
          G.scene.remove(t.head);
          if (t.head.material) t.head.material.dispose();
        }
        this.tracers.splice(i, 1);
      }
    }

    // 4. Bullet hole decals
    for (var i = this.decals.length - 1; i >= 0; i--){
      var d = this.decals[i];
      d.life -= dt;
      if (d.life < 2.0){
        d.m.material.opacity = Math.max(0, d.life / 2.0);
      }
      if (d.life <= 0){
        G.scene.remove(d.m);
        if (d.m.geometry) d.m.geometry.dispose();
        if (d.m.material) d.m.material.dispose();
        this.decals.splice(i, 1);
      }
    }
  }
};
