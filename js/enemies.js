// Vespera - enemies: infected (zombies) & armed scavengers, humanoid proportions.

var Enemies = {
  MAX: 14,
  horde: {
    wave: 1,
    state: 'day',
    waveKills: 0,
    waveTarget: 14,
    rushTimer: 25.0,
    sirenPlayed: false
  },
  acidProjectiles: [],
  acidPools: [],

  init: function(){
    if (ZombieVisual) ZombieVisual.init();
    if (ThugVisual) ThugVisual.init();
  },

  buildHumanoid: function(opts){
    // GTA-SA-ish proportions: torso box, head box, limb boxes, ~1.75m tall
    var grp = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: opts.skin });
    var cloth = new THREE.MeshLambertMaterial({ color: opts.cloth });
    var pants = new THREE.MeshLambertMaterial({ color: opts.pants });
    var parts = {};
    // legs
    parts.legL = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.8,0.18), pants);
    parts.legL.position.set(-0.11,0.4,0);
    parts.legR = parts.legL.clone(); parts.legR.position.x = 0.11;
    // torso
    parts.torso = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.55,0.24), cloth);
    parts.torso.position.set(0,1.08,0);
    // arms (pivot at shoulder)
    parts.armL = new THREE.Group(); parts.armR = new THREE.Group();
    var aL = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.62,0.14), opts.sleeves?cloth:skin);
    aL.position.set(0,-0.31,0);
    parts.armL.add(aL); parts.armL.position.set(-0.28,1.32,0);
    var aR = aL.clone();
    parts.armR.add(aR); parts.armR.position.set(0.28,1.32,0);
    // head
    parts.head = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.26,0.24), skin);
    parts.head.position.set(0,1.5,0);
    grp.add(parts.legL, parts.legR, parts.torso, parts.armL, parts.armR, parts.head);
    grp.userData.parts = parts;
    return grp;
  },

  ARCHETYPES: {
    walker: {
      name: 'Walker',
      subType: 'walker',
      speedMin: 1.5, speedMax: 2.2,
      health: 65,
      scale: 1.0,
      hitR: 0.55, headR: 0.24, headHeight: 1.45,
      atkRange: 0.85, atkDmgMin: 8, atkDmgMax: 14, atkCd: 1.1,
      anim: 'walk', animSpeed: 1.0,
      eyeColor: 0xff2222
    },
    sprinter: {
      name: 'Sprinter',
      subType: 'sprinter',
      speedMin: 3.8, speedMax: 4.8,
      health: 45,
      scale: 0.94,
      hitR: 0.50, headR: 0.22, headHeight: 1.36,
      atkRange: 0.95, atkDmgMin: 12, atkDmgMax: 18, atkCd: 0.85,
      anim: 'run', animSpeed: 1.25,
      eyeColor: 0xff7700
    },
    crawler: {
      name: 'Crawler',
      subType: 'crawler',
      speedMin: 1.1, speedMax: 1.6,
      health: 40,
      scale: 0.92,
      hitR: 0.46, headR: 0.22, headHeight: 0.38,
      atkRange: 0.75, atkDmgMin: 14, atkDmgMax: 22, atkCd: 1.25,
      anim: 'crawl', animSpeed: 1.2,
      eyeColor: 0xff1111
    },
    brute: {
      name: 'Brute',
      subType: 'brute',
      speedMin: 1.3, speedMax: 1.7,
      health: 190,
      scale: 1.44,
      hitR: 0.82, headR: 0.34, headHeight: 2.15,
      atkRange: 1.2, atkDmgMin: 26, atkDmgMax: 38, atkCd: 1.5,
      anim: 'walk', animSpeed: 0.8,
      eyeColor: 0xff0000
    },
    spitter: {
      name: 'Spitter',
      subType: 'spitter',
      speedMin: 1.8, speedMax: 2.4,
      health: 85,
      scale: 1.14,
      hitR: 0.62, headR: 0.28, headHeight: 1.62,
      atkRange: 24.0, // ranged bile range
      meleeRange: 1.1,
      atkDmgMin: 14, atkDmgMax: 22, atkCd: 3.6,
      anim: 'walk', animSpeed: 0.88,
      eyeColor: 0x39ff14
    },
    stalker: {
      name: 'Stalker',
      subType: 'stalker',
      speedMin: 3.2, speedMax: 4.2,
      health: 55,
      scale: 0.92,
      hitR: 0.48, headR: 0.22, headHeight: 1.34,
      atkRange: 1.1,
      atkDmgMin: 18, atkDmgMax: 26, atkCd: 0.85,
      anim: 'run', animSpeed: 1.3,
      eyeColor: 0xbf00ff
    }
  },

  spawnAcidProjectile: function(fx, fy, fz, tx, tz){
    var dx = tx - fx, dz = tz - fz;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var flightTime = Math.max(0.65, Math.min(1.4, dist / 18.0));
    var gravity = 12.0;
    var vy = (0.05 - fy + 0.5 * gravity * flightTime * flightTime) / flightTime;
    var vx = dx / flightTime;
    var vz = dz / flightTime;

    var geo = new THREE.SphereGeometry(0.14, 8, 8);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x76ea1c,
      transparent: true,
      opacity: 0.95
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(fx, fy, fz);
    G.scene.add(mesh);

    var proj = {
      mesh: mesh,
      x: fx, y: fy, z: fz,
      vx: vx, vy: vy, vz: vz,
      gravity: gravity,
      life: flightTime + 0.2
    };
    this.acidProjectiles.push(proj);
    if (AudioSys && AudioSys.spitterSpit) AudioSys.spitterSpit(fx, fy, fz);
  },

  spawnAcidPool: function(x, z, radius, duration){
    var rad = radius || 2.2;
    var dur = duration || 7.5;
    var decalItem = Effects && Effects.acidPoolDecal ? Effects.acidPoolDecal(x, z, rad, dur) : null;
    this.acidPools.push({
      x: x, z: z,
      radius: rad,
      life: dur,
      maxLife: dur,
      dmgTimer: 0,
      decal: decalItem
    });
  },

  spawnZombie: function(x, z, subType){
    if (!subType){
      var r = Math.random();
      if (G.isNight){
        // Night frenzy: varied threat pool including Spitters, Stalkers, Sprinters, Brutes
        if (r < 0.22) subType = 'walker';
        else if (r < 0.45) subType = 'sprinter';
        else if (r < 0.60) subType = 'crawler';
        else if (r < 0.74) subType = 'spitter';
        else if (r < 0.88) subType = 'stalker';
        else subType = 'brute';
      } else {
        // Day: mostly walkers with occasional sprinters, crawlers, and rare mutations
        if (r < 0.50) subType = 'walker';
        else if (r < 0.70) subType = 'sprinter';
        else if (r < 0.82) subType = 'crawler';
        else if (r < 0.90) subType = 'spitter';
        else if (r < 0.96) subType = 'stalker';
        else subType = 'brute';
      }
    }
    var arch = this.ARCHETYPES[subType] || this.ARCHETYPES.walker;
    var opts = { skin: pick([0x7a8a6a,0x8a8a72,0x6f7d64]), cloth: pick([0x4a4038,0x3c4448,0x554a3a]), pants:0x33363a, sleeves:true };
    if (subType === 'brute') {
      opts.skin = 0x4a5a42;
      opts.cloth = 0x222222;
    } else if (subType === 'spitter'){
      opts.skin = 0x4d6c34;
      opts.cloth = 0x334426;
    } else if (subType === 'stalker'){
      opts.skin = 0x16161a;
      opts.cloth = 0x111114;
    }
    // Prefer the animated GLB visual; fall back to the box humanoid while it loads / if it fails
    var vis = ZombieVisual ? ZombieVisual.spawn() : null;
    var mesh;
    if (vis){
      mesh = new THREE.Group();
      vis.group.rotation.y = ZombieVisual.yawOffset;

      // Mutation-specific material styling
      if (subType === 'spitter'){
        vis.group.traverse(function(node){
          if (node.isMesh && node.material){
            node.material = node.material.clone();
            node.material.color.setHex(0x56753a);
            node.material.roughness = 0.5;
          }
        });
      } else if (subType === 'stalker'){
        vis.group.traverse(function(node){
          if (node.isMesh && node.material){
            node.material = node.material.clone();
            node.material.color.setHex(0x18181c);
            node.material.transparent = true;
            node.material.opacity = 0.22;
            node.material.roughness = 0.85;
          }
        });
      }

      mesh.add(vis.group);
      mesh.userData.vis = vis;
    } else {
      mesh = this.buildHumanoid(opts);
      // hunched pose (box fallback only)
      mesh.userData.parts.torso.rotation.x = 0.25;
      mesh.userData.parts.head.position.z = 0.08;
      mesh.userData.parts.armL.rotation.x = -1.2;
      mesh.userData.parts.armR.rotation.x = -1.1;
    }

    // Attach bulging glowing toxic pustules for Spitter
    if (subType === 'spitter'){
      var pustules = new THREE.Group();
      var pMat = new THREE.MeshLambertMaterial({
        color: 0x99ff22,
        emissive: 0x44aa11,
        roughness: 0.35
      });
      var p1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), pMat);
      p1.position.set(-0.16, 1.30, -0.12);
      var p2 = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8), pMat);
      p2.position.set(0.14, 1.36, -0.09);
      var p3 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), pMat);
      p3.position.set(0.01, 1.22, -0.16);
      var p4 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), pMat);
      p4.position.set(-0.06, 1.44, -0.08);
      pustules.add(p1, p2, p3, p4);
      mesh.add(pustules);
      mesh.userData.pustules = pustules;
    }

    // Scale mesh based on archetype
    mesh.scale.setScalar(arch.scale);
    if (subType === 'crawler') {
      mesh.position.y = -0.05;
    }

    // Glowing night eyes
    var eyeGroup = new THREE.Group();
    var eyeMat = new THREE.SpriteMaterial({
      color: arch.eyeColor,
      transparent: true,
      opacity: G.isNight ? 0.95 : 0.3,
      blending: THREE.AdditiveBlending
    });
    var eyeTex = (Effects && Effects.tex) ? Effects.tex : null;
    if (eyeTex) eyeMat.map = eyeTex;
    var eyeL = new THREE.Sprite(eyeMat);
    var eyeR = new THREE.Sprite(eyeMat.clone());
    var eyeSz = subType === 'brute' ? 0.12 : (subType === 'stalker' ? 0.09 : 0.08);
    eyeL.scale.set(eyeSz, eyeSz, 1);
    eyeR.scale.set(eyeSz, eyeSz, 1);
    var eyeY = (arch.headHeight || 1.45) * 0.98;
    var eyeSpacing = subType === 'brute' ? 0.09 : 0.06;
    eyeL.position.set(-eyeSpacing, eyeY, 0.14);
    eyeR.position.set(eyeSpacing, eyeY, 0.14);
    eyeGroup.add(eyeL, eyeR);
    mesh.add(eyeGroup);

    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    var e = {
      type: 'zombie',
      subType: subType,
      arch: arch,
      mesh: mesh,
      eyeGroup: eyeGroup,
      x: x, z: z, y: 0,
      health: arch.health,
      maxHealth: arch.health,
      speed: rand(arch.speedMin, arch.speedMax),
      hitR: arch.hitR,
      headR: arch.headR,
      headHeight: arch.headHeight,
      dead: false,
      animT: rand(0, 6),
      atkCd: 0,
      growlCd: rand(2, 6),
      acidCd: rand(1.5, 3.5),
      cloaked: (subType === 'stalker'),
      orbitAngle: rand(0, Math.PI * 2),
      lungeT: 0
    };
    G.enemies.push(e);
    return e;
  },

  spawnThug: function(x,z){
    var opts = { skin: pick([0xa8785a,0x8a5e42,0xc09878]), cloth: pick([0x2c2c30,0x3a2e28,0x26323a]), pants: pick([0x2a2d33,0x3a3a3e]), sleeves:true };
    // Prefer the animated GLB visual; fall back to the box humanoid while it loads / if it fails
    var vis = ThugVisual ? ThugVisual.spawn() : null;
    var mesh;
    if (vis){
      mesh = new THREE.Group();
      vis.group.rotation.y = ThugVisual.yawOffset;
      mesh.add(vis.group);
      mesh.userData.vis = vis;
    } else {
      mesh = this.buildHumanoid(opts);
      // gun in right hand: small dark box
      var gun = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.08,0.4), new THREE.MeshLambertMaterial({color:0x1a1a1c}));
      gun.position.set(0,-0.55,-0.18);
      mesh.userData.parts.armR.add(gun);
      mesh.userData.parts.armR.rotation.x = -1.35;
    }
    mesh.position.set(x,0,z);
    G.scene.add(mesh);
    var e = { type:'thug', mesh:mesh, x:x, z:z, y:0, health:80, speed:rand(1.8,2.6),
              dead:false, animT:rand(0,6), atkCd:rand(1,3), shootCd:rand(1,2.5), homeX:x, homeZ:z, wanderT:0, tx:x, tz:z };
    G.enemies.push(e);
    return e;
  },

  alert: function(e){
    if (e.type==='thug'){ e.alerted = true; }
  },

  kill: function(e, byCar, impulseVec){
    if (e.dead) return;
    e.dead = true;
    e.deathT = 0;
    G.kills++;
    if (e.eyeGroup) e.eyeGroup.visible = false;
    try {
      if (AudioSys && AudioSys.zombieDeath) {
        AudioSys.zombieDeath(e.x, e.y || 1.2, e.z, e.subType);
      } else if (AudioSys && AudioSys.zombieGrowl) {
        AudioSys.zombieGrowl(0.25, e.subType, e.x, e.y || 1.2, e.z);
      }
    } catch(err) {}

    // Track Horde Wave progress
    if (e.type === 'zombie'){
      this.onZombieKilled(e);
    }

    if (byCar && impulseVec){
      e.isRagdoll = true;
      e.vx = impulseVec.x;
      e.vy = impulseVec.y;
      e.vz = impulseVec.z;
      e.rotVx = rand(-8, 8);
      e.rotVz = rand(-8, 8);
      if (Effects && Effects.bloodPool) Effects.bloodPool(e.x, e.z, e.subType === 'brute' ? 1.8 : 1.1);
      if (Effects && Effects.blood) Effects.blood(e.x, 0.8, e.z, true);
    } else {
      if (Effects && Effects.bloodPool) Effects.bloodPool(e.x, e.z, e.subType === 'brute' ? 1.5 : 0.85);
    }

    if (e.subType === 'brute'){
      HUD.toast('💀 BRUTE ELIMINATED! (+Ammo & Health)');
      this.dropPickup(e.x, e.z, 'ammo');
      this.dropPickup(e.x + 0.5, e.z + 0.5, 'health');
      if (typeof Weapons !== 'undefined' && Weapons.spawnPickup){
        if (!Weapons.owned['shotgun'] && Math.random() < 0.65){
          Weapons.spawnPickup('shotgun', e.x + rand(-1.2, 1.2), e.z + rand(-1.2, 1.2));
        } else if (!Weapons.owned['magnum'] && Math.random() < 0.65){
          Weapons.spawnPickup('magnum', e.x + rand(-1.2, 1.2), e.z + rand(-1.2, 1.2));
        }
      }
    } else if (e.subType === 'spitter'){
      HUD.toast('☣️ SPITTER DETONATED! (+Ammo & Health)');
      if (AudioSys && AudioSys.bloaterExplode) AudioSys.bloaterExplode(e.x, e.y || 1.0, e.z);
      if (Effects && Effects.acidBurst) Effects.acidBurst(e.x, 1.0, e.z, 30);
      this.spawnAcidPool(e.x, e.z, 2.6, 8.5);

      // Bloater explosion shockwave damage (player + nearby zombies)
      var p = G.player.pos;
      var dToP = Math.sqrt(dist2(e.x, e.z, p.x, p.z));
      if (dToP < 4.2 && !G.player.dead){
        Player.damage(Math.round(24 * (1 - dToP / 4.2)), e.x, e.z);
      }
      for (var zi = 0; zi < G.enemies.length; zi++){
        var other = G.enemies[zi];
        if (other === e || other.dead) continue;
        var ozDist = Math.sqrt(dist2(e.x, e.z, other.x, other.z));
        if (ozDist < 4.2){
          other.health -= Math.round(55 * (1 - ozDist / 4.2));
          other.flinchT = 0.28;
          if (other.health <= 0) Enemies.kill(other);
        }
      }

      this.dropPickup(e.x, e.z, 'ammo');
      if (Math.random() < 0.6) this.dropPickup(e.x + 0.4, e.z + 0.4, 'health');
      if (G.player) { G.player.scrap = (G.player.scrap || 0) + randi(12, 22); HUD.updateScrap(G.player.scrap); }
    } else if (e.subType === 'stalker'){
      HUD.toast('👁️ STALKER ELIMINATED! (+Rare Scrap)');
      if (AudioSys && AudioSys.stalkerDecloak) AudioSys.stalkerDecloak(e.x, e.y || 1.0, e.z);
      if (Effects && Effects.shadowBurst) Effects.shadowBurst(e.x, (e.y || 0) + 0.8, e.z);
      if (Math.random() < 0.7) this.dropPickup(e.x, e.z, 'ammo');
      if (G.player) { G.player.scrap = (G.player.scrap || 0) + randi(18, 32); HUD.updateScrap(G.player.scrap); }
    } else if (e.subType === 'crawler'){
      if (Math.random() < 0.45) this.dropPickup(e.x, e.z, 'health');
    } else if (e.subType === 'sprinter'){
      if (Math.random() < 0.55) this.dropPickup(e.x, e.z, 'ammo');
    } else {
      if (Math.random() < 0.35) this.dropPickup(e.x, e.z, 'ammo');
    }
    if (e.type==='thug' && Math.random()<0.5) this.dropPickup(e.x, e.z, Math.random()<0.5?'ammo':'health');
    if (G.objective && G.objective.type==='clearWave') Objectives.onEnemyKilled(e);
    if (typeof Safehouse !== 'undefined' && Safehouse.onSiegeEnemyKilled) Safehouse.onSiegeEnemyKilled();
  },

  dropPickup: function(x, z, kind){
    var grp = new THREE.Group();
    var beaconColor = kind === 'health' ? 0x22ff66 : 0xffaa22;

    if (kind === 'health'){
      // Medical field kit: clean white box + embossed red cross
      var boxMat = new THREE.MeshLambertMaterial({ color: 0xeeece8, emissive: 0x222222 });
      var box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.24), boxMat);
      grp.add(box);

      // Red cross bars on top
      var redMat = new THREE.MeshLambertMaterial({ color: 0xd01414, emissive: 0x440000 });
      var crossH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.06), redMat);
      crossH.position.set(0, 0.115, 0);
      var crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.18), redMat);
      crossV.position.set(0, 0.115, 0);
      grp.add(crossH, crossV);
    } else {
      // Military ammo tin: olive drab metal + yellow stencil stripe + top handle
      var tinMat = new THREE.MeshLambertMaterial({ color: 0x3d4a36, emissive: 0x1a2216 });
      var tin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.22), tinMat);
      grp.add(tin);

      // Yellow military stencil accent stripe
      var stMat = new THREE.MeshLambertMaterial({ color: 0xcca030, emissive: 0x332800 });
      var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.04, 0.08), stMat);
      stripe.position.set(0, 0.04, 0);
      grp.add(stripe);

      // Handle on top
      var handleMat = new THREE.MeshLambertMaterial({ color: 0x20241e });
      var handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.04), handleMat);
      handle.position.set(0, 0.13, 0);
      grp.add(handle);
    }

    // Vertical luminous beacon light column
    var beaconGeo = new THREE.CylinderGeometry(0.02, 0.12, 2.2, 8);
    var beaconMat = new THREE.MeshBasicMaterial({
      color: beaconColor,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 1.1, 0);
    grp.add(beacon);

    grp.position.set(x, 0.35, z);
    G.scene.add(grp);
    G.pickups.push({
      mesh: grp,
      beacon: beacon,
      kind: kind,
      x: x, z: z,
      bob: rand(0, 6),
      baseY: 0.35
    });
  },

  onDusk: function(){
    if (this.horde.state === 'dusk') return;
    this.horde.state = 'dusk';
    this.horde.sirenPlayed = true;
    AudioSys.duskSiren();
    HUD.toast('⚠️ DUSK WARNING: AIR RAID SIREN ACTIVE — THE HORDE AWAKENS');
    HUD.radio('VESPERA RADIO', 'Emergency sirens are echoing across the city. Night is falling — they are coming.', 6500);
  },

  onNightStart: function(){
    if (this.horde.state === 'night') return;
    this.horde.state = 'night';
    this.horde.waveKills = 0;
    this.horde.waveTarget = 10 + this.horde.wave * 4;
    AudioSys.hordeAlert();
    HUD.wave(this.horde.wave, 'WAVE ' + this.horde.wave + ' — NIGHT HORDE', 'Survive till dawn or eliminate the pack (' + this.horde.waveTarget + ' kills)');
  },

  onDawn: function(){
    if (this.horde.state === 'day') return;
    this.horde.state = 'day';
    this.horde.sirenPlayed = false;
    HUD.wave(this.horde.wave, 'WAVE ' + this.horde.wave + ' SURVIVED', 'The sun rises. Supply caches air-dropped!');
    HUD.radio('VESPERA RADIO', 'Dawn breaks. You made it through the night. Restock while you can.', 6000);
    // Air drop reward cache near player
    var p = G.player.pos;
    this.dropPickup(p.x + rand(2, 4), p.z + rand(-2, 2), 'ammo');
    this.dropPickup(p.x + rand(-4, -2), p.z + rand(-2, 2), 'health');
    this.horde.wave++;
  },

  onZombieKilled: function(e){
    if (G.isNight){
      this.horde.waveKills++;
      HUD.waveProgress(this.horde.wave, this.horde.waveKills, this.horde.waveTarget);
      if (this.horde.waveKills >= this.horde.waveTarget){
        var clearedWave = this.horde.wave;
        HUD.toast('🏆 WAVE ' + clearedWave + ' CLEARED! (+Supply Drops & Scrap)');
        if (typeof G !== 'undefined' && G.scrap !== undefined){
          G.scrap += 30 + clearedWave * 5;
          if (HUD && HUD.scrap) HUD.scrap(G.scrap);
        }
        if (e && e.x !== undefined){
          this.dropPickup(e.x + 1.2, e.z, 'ammo');
          this.dropPickup(e.x - 1.2, e.z, 'health');
          this.dropPickup(e.x, e.z + 1.2, 'ammo');
        }

        // Advance to next horde wave
        this.horde.wave++;
        this.horde.waveKills = 0;
        this.horde.waveTarget = 12 + this.horde.wave * 4;
        this.horde.rushTimer = rand(18, 28);
        HUD.wave(this.horde.wave, 'WAVE ' + this.horde.wave + ' — NIGHT HORDE', 'Survive till dawn or eliminate the pack (' + this.horde.waveTarget + ' kills)');
        HUD.waveProgress(this.horde.wave, 0, this.horde.waveTarget);
        if (typeof AudioSys !== 'undefined' && AudioSys.hordeAlert) AudioSys.hordeAlert();
      }
    }
  },

  rallyNearby: function(x, z, radius){
    var r2 = radius * radius;
    for (var i = 0; i < G.enemies.length; i++){
      var en = G.enemies[i];
      if (en.dead || en.type !== 'zombie') continue;
      var d2 = dist2(x, z, en.x, en.z);
      if (d2 < r2){
        en.alerted = true;
      }
    }
  },

  spawnMiniHorde: function(){
    var s = this.findSpawn();
    if (!s) return;
    AudioSys.hordeAlert();
    HUD.toast('⚠️ HORDE SURGE DETECTED NEARBY!');
    var types = ['sprinter', 'walker', 'walker', Math.random() < 0.4 ? 'brute' : 'crawler'];
    for (var i = 0; i < types.length; i++){
      var offX = rand(-3, 3), offZ = rand(-3, 3);
      var z = this.spawnZombie(s.x + offX, s.z + offZ, types[i]);
      if (z) z.alerted = true;
    }
  },

  // spawn positions: on streets 15-40m from player (close enough to be found)
  findSpawn: function(){
    var p = G.player.pos;
    for (var tries=0; tries<12; tries++){
      var a = rand(0, Math.PI*2), d = rand(15, 40);
      var x = p.x + Math.sin(a)*d, z = p.z + Math.cos(a)*d;
      var hit = collideWorld(x,z,1);
      if (!hit.hit) return {x:hit.x, z:hit.z};
    }
    return null;
  },

  manageSpawns: function(){
    var alive = { zombie:0, thug:0 };
    for (var i=0;i<G.enemies.length;i++) if(!G.enemies[i].dead) alive[G.enemies[i].type]++;
    // night: zombie capacity escalates with wave level; day: small roaming population
    var maxZombies = G.isNight ? Math.min(26, 14 + this.horde.wave * 3) : 6;
    if (G.isNight && alive.zombie < maxZombies && Math.random()<0.04){
      var s = this.findSpawn(); if (s) this.spawnZombie(s.x, s.z);
    }
    else if (!G.isNight && alive.zombie < 6 && Math.random()<0.006){
      var sDay = this.findSpawn(); if (sDay) this.spawnZombie(sDay.x, sDay.z);
    }
    if (alive.thug < (G.isNight? 4 : 2) && Math.random()<0.008){
      var s2 = this.findSpawn(); if (s2) this.spawnThug(s2.x, s2.z);
    }

    // Night mini-horde rush timer
    if (G.isNight){
      this.horde.rushTimer -= 0.016;
      if (this.horde.rushTimer <= 0 && alive.zombie < maxZombies - 3){
        this.horde.rushTimer = rand(24, 38);
        this.spawnMiniHorde();
      }
    }

    // despawn far dead bodies & far enemies
    for (var i=G.enemies.length-1;i>=0;i--){
      var e=G.enemies[i];
      var d2 = dist2(e.x,e.z, G.player.pos.x, G.player.pos.z);
      if (e.dead && e.deathT > 12){ G.scene.remove(e.mesh); G.enemies.splice(i,1); }
      else if (!e.dead && d2 > 130*130){ G.scene.remove(e.mesh); G.enemies.splice(i,1); }
    }
  },

  update: function(dt){
    var p = G.player.pos;
    var playerInCar = !!G.player.inCar;
    for (var i=0;i<G.enemies.length;i++){
      var e = G.enemies[i];
      if (e.dead){ 
        e.deathT += dt;
        if (e.isRagdoll){
          // Vehicular roadkill launch physics
          e.vy -= 18 * dt; // gravity
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.z += e.vz * dt;
          e.mesh.rotation.x += (e.rotVx || 3) * dt;
          e.mesh.rotation.z += (e.rotVz || 3) * dt;
          if (e.y <= 0){
            e.y = 0;
            if (Math.abs(e.vy) > 2.5){
              e.vy = -e.vy * 0.35; // bounce
              e.vx *= 0.6; e.vz *= 0.6;
              if (AudioSys.roadkillCrunch) AudioSys.roadkillCrunch(0.3);
            } else {
              e.vy = 0; e.vx = 0; e.vz = 0;
              e.isRagdoll = false;
              e.mesh.rotation.x = -Math.PI / 2;
            }
          }
          e.mesh.position.set(e.x, e.y, e.z);
        } else {
          // Normal fall over
          var t = Math.min(1, e.deathT*3);
          e.mesh.rotation.x = -Math.PI/2 * t;
          e.mesh.position.y = (e.subType === 'crawler' ? -0.1 : 0.15) * t;
        }
        continue;
      }
      var dx = p.x - e.x, dz = p.z - e.z;
      var d = Math.sqrt(dx*dx+dz*dz);
      var engageDist = (G.isNight || e.alerted) ? 65 : 45;
      var engaged = d < engageDist && !G.player.dead;
      e.animT += dt;

      if (e.type === 'zombie'){
        var arch = e.arch || this.ARCHETYPES.walker;
        var atkRange = arch.atkRange || 0.85;

        // Pack rally: when close to player, alert nearby zombies
        if (engaged && d < 22 && !e.rallied){
          e.rallied = true;
          this.rallyNearby(e.x, e.z, 22);
        }

        // 3D Directional growl
        e.growlCd -= dt;
        if (e.growlCd <= 0 && d < 35){
          AudioSys.zombieGrowl(0.24, e.subType, e.x, e.y || 1.2, e.z);
          e.growlCd = rand(3, 7.5);
        }

        // Night eye brightness
        if (e.eyeGroup && e.eyeGroup.children){
          var eyeOp = G.isNight ? 0.95 : 0.25;
          for (var ei = 0; ei < e.eyeGroup.children.length; ei++){
            e.eyeGroup.children[ei].material.opacity = eyeOp;
          }
        }

        // Check if zombie is in front of a fortified safehouse barricade or closed plank door
        var attackingBarricade = null;
        if (typeof Safehouse !== 'undefined' && Safehouse.barricades){
          for (var bi = 0; bi < Safehouse.barricades.length; bi++){
            var bar = Safehouse.barricades[bi];
            if (bar.planks > 0 && dist2(e.x, e.z, bar.x, bar.z) < 2.4 * 2.4){
              attackingBarricade = bar;
              break;
            }
          }
        }
        var attackingDoor = (typeof Safehouse !== 'undefined' && Safehouse.door && !Safehouse.door.isOpen && dist2(e.x, e.z, Safehouse.door.x, Safehouse.door.z) < 2.5 * 2.5);

        if (attackingBarricade){
          // Face and attack the barricade planks
          e.mesh.rotation.y = Math.atan2(attackingBarricade.x - e.x, attackingBarricade.z - e.z);
          e.atkCd -= dt;
          if (e.atkCd <= 0){
            e.atkCd = arch.atkCd || 1.1;
            var plankDmg = randi(arch.atkDmgMin, arch.atkDmgMax);
            Safehouse.damageBarricade(attackingBarricade, plankDmg);
          }
        } else if (attackingDoor){
          // Face and bang on the closed wooden plank door
          e.mesh.rotation.y = Math.atan2(Safehouse.door.x - e.x, Safehouse.door.z - e.z);
          e.atkCd -= dt;
          if (e.atkCd <= 0){
            e.atkCd = arch.atkCd || 1.1;
            AudioSys.woodSplinter();
            if (Effects && Effects.woodDebris) Effects.woodDebris(Safehouse.door.x, 1.4, Safehouse.door.z);
          }
        } else if (engaged && d > atkRange){
          // Steer towards nearest safehouse opening (open door or window) if player is inside bunker
          var moveX = dx, moveZ = dz, moveD = d;
          if (typeof Safehouse !== 'undefined' && Safehouse.isPlayerInside && Safehouse.isPlayerInside()){
            var bestTarget = Safehouse.door;
            var bestD2 = Safehouse.door ? dist2(e.x, e.z, Safehouse.door.x, Safehouse.door.z) : 1e9;
            for (var bj = 0; bj < Safehouse.barricades.length; bj++){
              var bb = Safehouse.barricades[bj];
              var bd2 = dist2(e.x, e.z, bb.x, bb.z);
              if (bd2 < bestD2){ bestD2 = bd2; bestTarget = bb; }
            }
            if (bestTarget && dist2(e.x, e.z, bestTarget.x, bestTarget.z) > 1.8 * 1.8){
              moveX = bestTarget.x - e.x;
              moveZ = bestTarget.z - e.z;
              moveD = Math.sqrt(moveX * moveX + moveZ * moveZ);
            }
          }

          // Spitter AI: maintain distance and vomit lobbed acid bile
          if (e.subType === 'spitter'){
            if (e.mesh.userData.pustules){
              var pulse = 1.0 + Math.sin(e.animT * 8) * 0.12;
              e.mesh.userData.pustules.scale.set(pulse, pulse, pulse);
            }
            // Ranged acid projectile cooldown & firing
            e.acidCd = (e.acidCd || 3.0) - dt;
            if (e.acidCd <= 0 && engaged && d < 28 && !playerInCar){
              var clearLoS = true;
              if (typeof raycastSolids === 'function'){
                var wallDist = raycastSolids({ x: e.x, y: 1.5, z: e.z }, { x: dx/d, y: 0, z: dz/d }, d);
                if (wallDist < d - 0.4) clearLoS = false;
              }
              if (clearLoS){
                this.spawnAcidProjectile(e.x, (e.y || 0) + 1.45, e.z, p.x + rand(-0.6, 0.6), p.z + rand(-0.6, 0.6));
                e.acidCd = rand(arch.atkCd || 3.5, (arch.atkCd || 3.5) + 1.4);
              }
            }
            // Spitter positioning: retreat if player gets too close (< 9m), otherwise hold range
            if (d < 9.0){
              moveX = -dx; moveZ = -dz;
              moveD = Math.sqrt(moveX * moveX + moveZ * moveZ);
            } else if (d < 22.0){
              // Circle / strafe slowly
              moveX = -dz * 0.5 + dx * 0.2;
              moveZ = dx * 0.5 + dz * 0.2;
              moveD = Math.sqrt(moveX * moveX + moveZ * moveZ);
            }
          }

          // Stalker AI: cloaked stealth flanking & explosive ambush lunge
          if (e.subType === 'stalker'){
            if (Math.random() < 0.45 && Effects && Effects.shadowMist){
              Effects.shadowMist(e.x, (e.y || 0) + 0.6, e.z);
            }
            if (d > 10.0 && !e.damaged && (e.lungeT || 0) <= 0){
              // In cloaked stalking mode: flank around player's side/rear
              if (!e.cloaked){
                e.cloaked = true;
                if (e.mesh.userData.vis && e.mesh.userData.vis.group){
                  e.mesh.userData.vis.group.traverse(function(node){
                    if (node.isMesh && node.material) node.material.opacity = 0.20;
                  });
                }
              }
              e.orbitAngle = (e.orbitAngle || 0) + dt * 1.5;
              var ox = p.x + Math.cos(e.orbitAngle) * 11;
              var oz = p.z + Math.sin(e.orbitAngle) * 11;
              moveX = ox - e.x; moveZ = oz - e.z;
              moveD = Math.sqrt(moveX * moveX + moveZ * moveZ);
            } else {
              // Decloaking and rapid lunge
              if (e.cloaked){
                e.cloaked = false;
                if (AudioSys && AudioSys.stalkerDecloak) AudioSys.stalkerDecloak(e.x, e.y || 1.0, e.z);
                if (AudioSys && AudioSys.stalkerScreech) AudioSys.stalkerScreech(e.x, e.y || 1.0, e.z);
                if (Effects && Effects.shadowBurst) Effects.shadowBurst(e.x, (e.y || 0) + 0.8, e.z);
                if (e.mesh.userData.vis && e.mesh.userData.vis.group){
                  e.mesh.userData.vis.group.traverse(function(node){
                    if (node.isMesh && node.material) node.material.opacity = 1.0;
                  });
                }
                e.lungeT = 3.2;
              }
            }
          }

          // Movement speed resolution
          var nightMult = G.isNight ? (e.subType === 'sprinter' ? 1.28 : 1.12) : 0.85;
          var sp = e.speed * nightMult;
          if (e.subType === 'stalker' && (e.lungeT || 0) > 0){
            e.lungeT -= dt;
            sp = 5.8; // lethal ambush lunge sprint
          }

          if (moveD > 0.1){
            e.x += moveX / moveD * sp * dt;
            e.z += moveZ / moveD * sp * dt;
            e.mesh.rotation.y = Math.atan2(moveX, moveZ);

            // 3D Positional footstep shuffling in spatial proximity
            e.stepTimer = (e.stepTimer || 0) - dt;
            if (e.stepTimer <= 0 && d < 12){
              e.stepTimer = (e.subType === 'sprinter' ? 0.32 : 0.55);
              if (AudioSys && AudioSys.zombieStep) AudioSys.zombieStep(e.x, e.y || 0, e.z, e.subType);
            }
          }
        } else if (engaged && d <= atkRange){
          e.mesh.rotation.y = Math.atan2(dx,dz); // keep facing the player while biting
          e.atkCd -= dt;
          if (e.atkCd<=0){
            e.atkCd = arch.atkCd || 1.1;
            var dmg = randi(arch.atkDmgMin, arch.atkDmgMax);
            if (!playerInCar){
              // Guard: Check if player and zombie are separated by safehouse walls or solid colliders
              var pInBunker = (typeof Safehouse !== 'undefined' && Safehouse.isPlayerInside && Safehouse.isPlayerInside());
              var zInBunker = (typeof Safehouse !== 'undefined' && Safehouse.bounds &&
                e.x >= Safehouse.bounds.minX && e.x <= Safehouse.bounds.maxX &&
                e.z >= Safehouse.bounds.minZ && e.z <= Safehouse.bounds.maxZ);
              var blockedByWall = (pInBunker !== zInBunker);
              if (!blockedByWall && typeof raycastSolids === 'function'){
                var wallDist = raycastSolids({ x: e.x, y: 1.2, z: e.z }, { x: dx/d, y: 0, z: dz/d }, d);
                if (wallDist < d - 0.35) blockedByWall = true;
              }

              if (!blockedByWall){
                if (AudioSys && AudioSys.zombieAttack) AudioSys.zombieAttack(e.x, e.y || 1.2, e.z, e.subType);
                Player.damage(dmg, e.x, e.z);
                if (e.subType === 'brute') HUD.flashDamage(e.x, e.z);
              }
            } else {
              Player.damage(0);
            }
          }
        }
        // visuals: drive GLB animations when present, else box limb swing
        var vis = e.mesh.userData.vis;
        if (vis){
          if (engaged && d <= atkRange){
            ZombieVisual.play(vis, 'bite', 1.2);
          } else if (engaged){
            var moveClip = arch.anim || 'walk';
            var animRate = (arch.animSpeed || 1.0) * (e.speed / (arch.speedMin || 2.0));
            ZombieVisual.play(vis, moveClip, animRate);
          } else {
            ZombieVisual.play(vis, 'idle');
          }
          ZombieVisual.update(vis, dt);
        } else {
          var sw = Math.sin(e.animT*6)*0.5;
          var parts = e.mesh.userData.parts;
          if (parts){
            parts.legL.rotation.x = sw; parts.legR.rotation.x = -sw;
            parts.armL.rotation.x = -1.2 + sw*0.3; parts.armR.rotation.x = -1.1 - sw*0.3;
          }
        }
      } else {
        // thug AI: wander; if player within 30 & clear line of sight (no solid walls), shoot
        e.shootCd -= dt;
        var vis = e.mesh.userData.vis;

        var pInBunkerThug = (typeof Safehouse !== 'undefined' && Safehouse.isPlayerInside && Safehouse.isPlayerInside());
        var tInBunkerThug = (typeof Safehouse !== 'undefined' && Safehouse.bounds &&
          e.x >= Safehouse.bounds.minX && e.x <= Safehouse.bounds.maxX &&
          e.z >= Safehouse.bounds.minZ && e.z <= Safehouse.bounds.maxZ);
        var wallBlocksLoS = (pInBunkerThug !== tInBunkerThug);
        if (!wallBlocksLoS && typeof raycastSolids === 'function' && d > 1.0){
          var tWallDist = raycastSolids({ x: e.x, y: 1.35, z: e.z }, { x: dx/d, y: 0, z: dz/d }, d);
          if (tWallDist < d - 0.4) wallBlocksLoS = true;
        }

        if (engaged && d < 32 && !playerInCar && !wallBlocksLoS){
          e.mesh.rotation.y = Math.atan2(dx,dz);
          if (e.shootCd<=0){
            e.shootCd = rand(0.8, 1.8);
            AudioSys.distantShot(clamp(0.3 - d*0.008, 0.05, 0.3));
            Effects.spawn(e.x + dx/d*0.6, 1.35, e.z + dz/d*0.6, 0xffd080, 0.2, 0.08, 0);
            // chance to hit, drops with distance
            if (Math.random() < clamp(0.4 - d*0.01, 0.08, 0.4)) Player.damage(randi(4,9), e.x, e.z);
          }
          if (vis){ ThugVisual.play(vis, 'shoot'); ThugVisual.update(vis, dt); ThugVisual.bindGun(vis, dt); }
          // strafe slightly / hold
        } else {
          e.wanderT -= dt;
          if (e.wanderT<=0){
            e.wanderT = rand(2,5);
            e.tx = e.homeX + rand(-8,8); e.tz = e.homeZ + rand(-8,8);
          }
          var wdx = e.tx-e.x, wdz = e.tz-e.z, wd = Math.sqrt(wdx*wdx+wdz*wdz);
          if (wd>0.5){ e.x += wdx/wd*e.speed*0.6*dt; e.z += wdz/wd*e.speed*0.6*dt; e.mesh.rotation.y = Math.atan2(wdx,wdz); }
          if (vis){
            ThugVisual.play(vis, wd>0.5 ? 'walk' : 'idleGun', wd>0.5 ? Math.max(0.7, e.speed*0.6/2) : 0);
            ThugVisual.update(vis, dt);
          } else {
            var parts2 = e.mesh.userData.parts;
            if (parts2){
              var sw2 = Math.sin(e.animT*4)*0.4;
              parts2.legL.rotation.x = sw2; parts2.legR.rotation.x = -sw2;
            }
          }
        }
      }
      // keep off buildings
      var col = collideWorld(e.x, e.z, 0.4);
      e.x = col.x; e.z = col.z;
      // zombie-zombie separation: no stacking into one blob (so the one at
      // your face is visually THE one biting you)
      if (e.type === 'zombie'){
        for (var j=i+1;j<G.enemies.length;j++){
          var o = G.enemies[j];
          if (o.dead || o.type!=='zombie') continue;
          var sx = e.x-o.x, sz = e.z-o.z, sd2 = sx*sx+sz*sz;
          if (sd2 < 0.49 && sd2 > 0.0001){
            var sd = Math.sqrt(sd2), push = (0.7-sd)*0.5;
            e.x += sx/sd*push; e.z += sz/sd*push;
            o.x -= sx/sd*push; o.z -= sz/sd*push;
          }
        }
      }
      // flinch feedback on bullet impact
      if (e.flinchT > 0){
        e.flinchT -= dt;
        var flinchAmount = Math.max(0, e.flinchT / 0.22);
        e.mesh.rotation.x = -0.35 * flinchAmount;
      } else {
        e.mesh.rotation.x = 0;
      }
      e.mesh.position.x = e.x; e.mesh.position.z = e.z;
    }
    this.manageSpawns();

    // Update acid projectiles
    for (var pi = this.acidProjectiles.length - 1; pi >= 0; pi--){
      var ap = this.acidProjectiles[pi];
      ap.life -= dt;
      ap.vy -= ap.gravity * dt;
      ap.x += ap.vx * dt;
      ap.y += ap.vy * dt;
      ap.z += ap.vz * dt;
      ap.mesh.position.set(ap.x, ap.y, ap.z);
      if (Effects && Effects.acidTrail) Effects.acidTrail(ap.x, ap.y, ap.z);

      var pDist = Math.sqrt(dist2(ap.x, ap.z, p.x, p.z));
      var hitPlayer = pDist < 1.3 && Math.abs(ap.y - 1.0) < 1.1;
      var hitGround = ap.y <= 0.04;

      if (hitGround || hitPlayer || ap.life <= 0){
        if (Effects && Effects.acidBurst) Effects.acidBurst(ap.x, Math.max(0.08, ap.y), ap.z, 22);
        if (AudioSys && AudioSys.acidSizzle) AudioSys.acidSizzle(ap.x, ap.y, ap.z);
        if (hitPlayer && !playerInCar){
          Player.damage(18, ap.x, ap.z);
          if (HUD && HUD.flashAcid) HUD.flashAcid();
        }
        this.spawnAcidPool(ap.x, ap.z, 2.3, 7.5);
        G.scene.remove(ap.mesh);
        if (ap.mesh.geometry) ap.mesh.geometry.dispose();
        if (ap.mesh.material) ap.mesh.material.dispose();
        this.acidProjectiles.splice(pi, 1);
      }
    }

    // Update acid hazard pools
    for (var hi = this.acidPools.length - 1; hi >= 0; hi--){
      var pool = this.acidPools[hi];
      pool.life -= dt;

      // Rising toxic bubbling particles
      if (Math.random() < 0.28 && Effects && Effects.spawn){
        Effects.spawn(
          pool.x + rand(-pool.radius * 0.7, pool.radius * 0.7),
          0.04,
          pool.z + rand(-pool.radius * 0.7, pool.radius * 0.7),
          Math.random() < 0.5 ? 0x76ea1c : 0xb4ff33,
          rand(0.08, 0.18),
          rand(0.4, 0.7),
          rand(0.2, 0.55),
          rand(-0.05, 0.05), rand(-0.05, 0.05),
          0.2,
          -0.3
        );
      }

      // Check player inside pool
      var pDist = Math.sqrt(dist2(pool.x, pool.z, p.x, p.z));
      if (pDist < pool.radius && !playerInCar && !G.player.dead){
        G.player.acidSlow = 0.65; // slow down movement
        pool.dmgTimer = (pool.dmgTimer || 0) - dt;
        if (pool.dmgTimer <= 0){
          pool.dmgTimer = 0.35;
          Player.damage(5, pool.x, pool.z);
          if (HUD && HUD.flashAcid) HUD.flashAcid();
          if (AudioSys && AudioSys.acidHiss) AudioSys.acidHiss();
        }
      }

      // Check zombies inside pool (environmental crossfire)
      for (var zi = 0; zi < G.enemies.length; zi++){
        var ez = G.enemies[zi];
        if (ez.dead || ez.subType === 'spitter') continue;
        if (dist2(ez.x, ez.z, pool.x, pool.z) < pool.radius * pool.radius){
          ez.health -= 6 * dt;
          if (ez.health <= 0) Enemies.kill(ez);
        }
      }

      if (pool.life <= 0){
        this.acidPools.splice(hi, 1);
      }
    }

    // 3D physical pickups
    for (var i=G.pickups.length-1;i>=0;i--){
      var pk = G.pickups[i];
      pk.bob += dt*3;
      var yOffset = (pk.baseY || 0.35) + Math.sin(pk.bob)*0.08;
      pk.mesh.position.y = yOffset;
      pk.mesh.rotation.y += dt*2;
      if (pk.beacon){
        pk.beacon.material.opacity = 0.35 + Math.sin(pk.bob*2)*0.18;
      }
      if (dist2(pk.x,pk.z,p.x,p.z) < 2.5){
        if (pk.kind==='health'){ G.player.health = Math.min(100, G.player.health+25); HUD.toast('+25 Medical Supplies'); }
        else { Weapons.state.reserve += 30; HUD.toast('+30 Rifle Ammo'); HUD.ammo(Weapons.state.mag, Weapons.state.reserve); }
        AudioSys.pickup();
        G.scene.remove(pk.mesh); G.pickups.splice(i,1);
      }
    }
  },

  blood: function(x,y,z,headshot){ Effects.blood(x,y,z,headshot); }
};
