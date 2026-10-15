// Vespera - City Extraction Event & Boulevard Communications Relay Tower
var Extraction = {
  state: 'inactive', // 'ready', 'defending', 'convoy_arrived', 'extracted', 'freeroam'
  tower: null,
  towerPos: { x: 30, y: 0, z: -35 },
  uplinkTime: 0,
  uplinkDuration: 65, // 65 seconds defense
  strobeLight: null,
  strobeTimer: 0,
  convoy: null,
  convoyPos: { x: 26, y: 0, z: -25 },
  turretCooldown: 0,
  startTime: 0,
  mutantsKilled: 0,

  init: function(scene){
    this.startTime = Date.now();
    this.buildTower(scene);
  },

  buildTower: function(scene){
    var grp = new THREE.Group();
    var tx = this.towerPos.x, tz = this.towerPos.z;

    var matSteel = new THREE.MeshStandardMaterial({ color: 0x4a4d52, metalness: 0.85, roughness: 0.35 });
    var matDark = new THREE.MeshStandardMaterial({ color: 0x222428, metalness: 0.9, roughness: 0.4 });
    var matEquip = new THREE.MeshStandardMaterial({ color: 0x3d433b, roughness: 0.6 });
    var matYellow = new THREE.MeshLambertMaterial({ color: 0xe0a020 });

    // 1. Concrete Foundation Slab
    var slab = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.4, 6.5), new THREE.MeshLambertMaterial({ color: 0x5a5c58 }));
    slab.position.set(0, 0.2, 0);
    grp.add(slab);

    // 2. Steel Lattice Antenna Mast (4 structural legs tapering to peak)
    var towerHeight = 16.0;
    var legGeo = new THREE.CylinderGeometry(0.06, 0.09, towerHeight, 6);
    var legOffsets = [
      { x: -1.8, z: -1.8, tx: -0.3, tz: -0.3 },
      { x: 1.8, z: -1.8, tx: 0.3, tz: -0.3 },
      { x: -1.8, z: 1.8, tx: -0.3, tz: 0.3 },
      { x: 1.8, z: 1.8, tx: 0.3, tz: 0.3 }
    ];
    for (var i = 0; i < legOffsets.length; i++){
      var lo = legOffsets[i];
      var leg = new THREE.Mesh(legGeo, matSteel);
      leg.position.set((lo.x + lo.tx) / 2, towerHeight / 2 + 0.4, (lo.z + lo.tz) / 2);
      var angX = (lo.tz - lo.z) / towerHeight;
      var angZ = (lo.x - lo.tx) / towerHeight;
      leg.rotation.x = angX;
      leg.rotation.z = angZ;
      grp.add(leg);
    }

    // Horizontal & diagonal cross bracing struts
    for (var h = 2.0; h < towerHeight - 1.0; h += 2.2){
      var ringScale = 1.0 - (h / towerHeight) * 0.75;
      var ring = new THREE.Mesh(new THREE.BoxGeometry(3.6 * ringScale, 0.08, 3.6 * ringScale), matDark);
      ring.position.set(0, h + 0.4, 0);
      grp.add(ring);
    }

    // 3. Top Antenna Platform, Dish & Spire
    var plat = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 8), matSteel);
    plat.position.set(0, towerHeight + 0.4, 0);
    grp.add(plat);

    var spire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.08, 3.5, 6), matSteel);
    spire.position.set(0, towerHeight + 2.15, 0);
    grp.add(spire);

    // Microwave Communications Dish
    var dish = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.15, 0.4, 12, 1, true), matDark);
    dish.position.set(0.65, towerHeight - 1.2, 0);
    dish.rotation.z = Math.PI / 2 + 0.2;
    dish.rotation.y = 0.5;
    grp.add(dish);

    // Red FAA Aviation Warning Strobe Light
    var strobeGeo = new THREE.SphereGeometry(0.12, 8, 8);
    var strobeMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });
    var strobeMesh = new THREE.Mesh(strobeGeo, strobeMat);
    strobeMesh.position.set(0, towerHeight + 3.85, 0);
    grp.add(strobeMesh);

    var strobeLight = new THREE.PointLight(0xff1111, 0, 45, 1.8);
    strobeLight.position.set(0, towerHeight + 3.85, 0);
    grp.add(strobeLight);
    this.strobeLight = strobeLight;
    this.strobeMesh = strobeMesh;

    // 4. Ground Power Generator & Transmitter Terminal Console
    var genBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), matEquip);
    genBox.position.set(-0.8, 1.0, 0.8);
    grp.add(genBox);

    var genPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), matSteel);
    genPipe.position.set(-1.4, 1.8, 0.8);
    grp.add(genPipe);

    var consoleBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.7), matDark);
    consoleBox.position.set(0.8, 1.05, 0.8);
    grp.add(consoleBox);

    // Glowing frequency screen
    var scrMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), scrMat);
    screen.position.set(0.8, 1.3, 1.16);
    grp.add(screen);
    this.terminalScreen = screen;

    // Golden guidance objective vertical beam
    var beamGeo = new THREE.CylinderGeometry(0.05, 0.3, 25, 8);
    var beamMat = new THREE.MeshBasicMaterial({
      color: 0xffcc33,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 12.5, 0);
    grp.add(beam);
    this.beaconBeam = beam;

    grp.position.set(tx, 0, tz);
    scene.add(grp);
    this.tower = grp;
    this.state = 'ready';
  },

  buildConvoyVehicle: function(scene){
    var grp = new THREE.Group();
    var cx = this.convoyPos.x, cz = this.convoyPos.z;

    var matArmor = new THREE.MeshStandardMaterial({ color: 0x3b4436, roughness: 0.7, metalness: 0.4 });
    var matSteel = new THREE.MeshStandardMaterial({ color: 0x1f221e, roughness: 0.4, metalness: 0.9 });
    var matTire = new THREE.MeshLambertMaterial({ color: 0x18181a });

    // 1. Armored Hull
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 5.4), matArmor);
    body.position.set(0, 1.3, 0);
    grp.add(body);

    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 2.8), matArmor);
    cabin.position.set(0, 2.2, -0.4);
    grp.add(cabin);

    // Reinforced front push bumper
    var bumper = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 0.4), matSteel);
    bumper.position.set(0, 0.8, -2.8);
    grp.add(bumper);

    // 2. Heavy 6-Wheel Offroad Tires
    var wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    var zOffsets = [-1.7, 0.3, 1.9];
    for (var i = 0; i < zOffsets.length; i++){
      var wL = new THREE.Mesh(wheelGeo, matTire);
      wL.position.set(-1.3, 0.55, zOffsets[i]);
      var wR = new THREE.Mesh(wheelGeo, matTire);
      wR.position.set(1.3, 0.55, zOffsets[i]);
      grp.add(wL, wR);
    }

    // 3. Automated Roof .50 Caliber Machine Gun Turret
    var turretMount = new THREE.Group();
    turretMount.position.set(0, 2.8, -0.5);

    var tBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 8), matSteel);
    turretMount.add(tBase);

    var gunBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.9), matSteel);
    gunBox.position.set(0, 0.3, -0.2);
    turretMount.add(gunBox);

    var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 6), matSteel);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.3, -0.9);
    turretMount.add(barrel);

    var muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.3, -1.6);
    turretMount.add(muzzlePoint);

    grp.add(turretMount);
    this.turret = turretMount;
    this.turretMuzzle = muzzlePoint;

    // Glowing extract zone beacon
    var ezGeo = new THREE.CylinderGeometry(0.04, 0.25, 15, 8);
    var ezMat = new THREE.MeshBasicMaterial({ color: 0x22ff88, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
    var ezBeam = new THREE.Mesh(ezGeo, ezMat);
    ezBeam.position.set(0, 7.5, 0);
    grp.add(ezBeam);

    grp.position.set(cx, 0, cz);
    scene.add(grp);
    this.convoy = grp;
    this.state = 'convoy_arrived';
  },

  // Player approaches tower and presses [E] to begin defense
  startUplinkDefense: function(){
    if (this.state !== 'ready') return;
    this.state = 'defending';
    this.uplinkTime = 0;

    // Deduct scrap if player has it, else emergency bypass
    if (G.player && G.player.scrap >= 35){
      G.player.scrap -= 35;
      HUD.updateScrap(G.player.scrap);
      HUD.toast('🛠️ Uplink Repaired & Activated (-35 Scrap)');
    } else {
      HUD.toast('⚡ Emergency Transmitter Override Engaged!');
    }

    if (AudioSys && AudioSys.duskSiren) AudioSys.duskSiren();
    if (AudioSys && AudioSys.relayBeaconBeep) AudioSys.relayBeaconBeep(this.towerPos.x, 3, this.towerPos.z);
    HUD.radio('MAJOR VANCE — EVAC 1', 'Uplink signal acquired! Hold that communications tower for 65 seconds while our convoy breaches the sector!', 8000);
    HUD.showUplink(0, true);

    // Initial defense wave assault
    this.spawnDefenseWave();
  },

  spawnDefenseWave: function(){
    if (typeof Enemies === 'undefined') return;
    var tx = this.towerPos.x, tz = this.towerPos.z;
    var spawnTypes = ['spitter', 'stalker', 'sprinter', 'sprinter', 'walker', 'brute'];
    for (var i = 0; i < spawnTypes.length; i++){
      var ang = (i / spawnTypes.length) * Math.PI * 2 + rand(-0.3, 0.3);
      var dist = rand(22, 34);
      var sx = tx + Math.cos(ang) * dist;
      var sz = tz + Math.sin(ang) * dist;
      var z = Enemies.spawnZombie(sx, sz, spawnTypes[i]);
      if (z) z.alerted = true;
    }
    HUD.toast('⚠️ HORDE ASSAULT CONVERGING ON RELAY TOWER!');
  },

  extract: function(){
    if (this.state !== 'convoy_arrived') return;
    this.state = 'extracted';
    var elapsedSec = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
    var mins = Math.floor(elapsedSec / 60);
    var secs = elapsedSec % 60;
    var timeStr = mins + 'm ' + (secs < 10 ? '0' : '') + secs + 's';

    var stats = {
      timeStr: timeStr,
      kills: G.kills || 0,
      mutants: Math.max(6, Math.round((G.kills || 0) * 0.35)),
      headshots: Math.round((G.kills || 0) * 0.42),
      scrap: (G.player && G.player.scrap) || 0
    };

    if (AudioSys && AudioSys.convoyHorn) AudioSys.convoyHorn();
    HUD.showUplink(100, false);
    HUD.showExtractionDebrief(stats);
  },

  continueFreeRoam: function(){
    var modal = document.getElementById('extraction-modal');
    if (modal) modal.style.display = 'none';
    G.paused = false;
    this.state = 'freeroam';

    // Grant extraction bonus rewards
    if (G.player){
      G.player.scrap = (G.player.scrap || 0) + 150;
      HUD.updateScrap(G.player.scrap);
    }
    if (typeof Weapons !== 'undefined' && Weapons.state){
      Weapons.state.reserve = Math.max(Weapons.state.reserve, 180);
      HUD.ammo(Weapons.state.mag, Weapons.state.reserve);
    }

    HUD.toast('🔥 ENDLESS NIGHTMARE ACTIVE (+150 Scrap & Full Reserve Ammo)');
    HUD.radio('MAJOR VANCE — EVAC 1', 'Convoy returning to base. You\'re staying behind in the fog. Godspeed, soldier. Vespera is yours.', 8000);
    var canvas = document.getElementById('game');
    if (!G.isMobile && canvas) canvas.requestPointerLock().catch(function(){});
  },

  nearestInteraction: function(px, pz){
    if (this.state === 'ready'){
      var d = Math.sqrt(dist2(px, pz, this.towerPos.x, this.towerPos.z));
      if (d < 4.2){
        return { type: 'tower', text: 'Press E — Repair & Activate Distress Uplink' };
      }
    } else if (this.state === 'convoy_arrived'){
      var cd = Math.sqrt(dist2(px, pz, this.convoyPos.x, this.convoyPos.z));
      if (cd < 5.0){
        return { type: 'convoy', text: 'Press E — Board Armored Convoy to Extract' };
      }
    }
    return null;
  },

  update: function(dt){
    var p = G.player.pos;

    // Beacon beam animation
    if (this.beaconBeam){
      this.beaconBeam.rotation.y += dt * 1.5;
    }

    // Strobe light flashing (rapid red pulse)
    this.strobeTimer += dt * 3.5;
    if (this.strobeLight){
      var isBright = (this.state === 'defending' || this.state === 'convoy_arrived') ? (Math.sin(this.strobeTimer * 4) > 0.4) : (Math.sin(this.strobeTimer) > 0.7);
      this.strobeLight.intensity = isBright ? 2.5 : 0;
      if (this.strobeMesh) this.strobeMesh.material.color.setHex(isBright ? 0xff3333 : 0x550000);
    }

    // Uplink defense progress
    if (this.state === 'defending'){
      this.uplinkTime += dt;
      var pct = (this.uplinkTime / this.uplinkDuration) * 100;
      HUD.showUplink(pct, true);

      // Periodic defense wave surges at 20s and 42s
      if (Math.abs(this.uplinkTime - 20) < dt * 1.1 || Math.abs(this.uplinkTime - 42) < dt * 1.1){
        this.spawnDefenseWave();
      }

      // Periodic radio chirps
      if (Math.random() < 0.015 && AudioSys && AudioSys.relayBeaconBeep){
        AudioSys.relayBeaconBeep(this.towerPos.x, 3, this.towerPos.z);
      }

      // Uplink completed!
      if (this.uplinkTime >= this.uplinkDuration){
        this.state = 'convoy_arrived';
        HUD.showUplink(100, false);
        HUD.toast('📡 UPLINK 100% COMPLETE! CONVOY INBOUND!');
        HUD.radio('MAJOR VANCE — EVAC 1', 'Uplink locked! Lead APC breaching Boulevard Checkpoint NOW! Get to the extraction vehicle!', 7000);
        if (AudioSys && AudioSys.convoyHorn) AudioSys.convoyHorn();
        this.buildConvoyVehicle(G.scene);
      }
    }

    // Convoy roof turret suppression AI
    if (this.state === 'convoy_arrived' && this.convoy && this.turret){
      this.turretCooldown -= dt;
      // Find nearest living enemy to convoy within 45m
      var nearestEnemy = null, nearestD2 = 45 * 45;
      for (var i = 0; i < G.enemies.length; i++){
        var en = G.enemies[i];
        if (en.dead) continue;
        var ed2 = dist2(en.x, en.z, this.convoyPos.x, this.convoyPos.z);
        if (ed2 < nearestD2){
          nearestD2 = ed2;
          nearestEnemy = en;
        }
      }

      if (nearestEnemy){
        var tdx = nearestEnemy.x - this.convoyPos.x;
        var tdz = nearestEnemy.z - this.convoyPos.z;
        this.turret.rotation.y = Math.atan2(tdx, tdz) + Math.PI;

        if (this.turretCooldown <= 0){
          this.turretCooldown = 0.55;
          var muzzlePos = new THREE.Vector3();
          this.turretMuzzle.getWorldPosition(muzzlePos);
          var targetPos = new THREE.Vector3(nearestEnemy.x, (nearestEnemy.y || 0) + 1.2, nearestEnemy.z);

          if (AudioSys && AudioSys.convoyTurret) AudioSys.convoyTurret(muzzlePos.x, muzzlePos.y, muzzlePos.z);
          if (Effects && Effects.convoyTracer) Effects.convoyTracer(muzzlePos, targetPos);
          if (Effects && Effects.spark) Effects.spark(targetPos);

          nearestEnemy.health -= 75;
          nearestEnemy.flinchT = 0.28;
          if (nearestEnemy.health <= 0) Enemies.kill(nearestEnemy);
        }
      }
    }
  }
};
