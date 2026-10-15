// Vespera - City Scavenging System: Abandoned Car Trunks & Searchable Storefronts
var Scavenging = {
  abandonedCars: [],
  storefronts: [],

  init: function(scene){
    this.buildAbandonedCars(scene);
    this.buildStorefronts(scene);
  },

  buildAbandonedCars: function(scene){
    var half = World.GRID * World.CELL / 2;
    var carRustMat = new THREE.MeshLambertMaterial({ color: 0x6e432b }); // rust brown
    var carBurnMat = new THREE.MeshLambertMaterial({ color: 0x333336 }); // charred dark
    var tireMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1c });
    var glassMat = new THREE.MeshLambertMaterial({ color: 0x243038, transparent: true, opacity: 0.65 });
    var hazardMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });

    // 8 distinct street locations away from the start
    var locations = [
      { x: -half + World.CELL * 1.5, z: -half + World.CELL * 2.2, rot: 0.4 },
      { x: -half + World.CELL * 2.8, z: -half + World.CELL * 1.6, rot: 1.8 },
      { x: -half + World.CELL * 4.2, z: -half + World.CELL * 2.5, rot: -0.8 },
      { x: -half + World.CELL * 2.1, z: -half + World.CELL * 4.4, rot: 2.5 },
      { x: -half + World.CELL * 4.8, z: -half + World.CELL * 4.6, rot: 0.1 },
      { x: -half + World.CELL * 5.4, z: -half + World.CELL * 2.8, rot: 1.2 },
      { x: -half + World.CELL * 3.5, z: -half + World.CELL * 5.2, rot: -1.9 },
      { x: -half + World.CELL * 1.8, z: -half + World.CELL * 5.5, rot: 0.9 }
    ];

    for (var i = 0; i < locations.length; i++){
      var loc = locations[i];
      var grp = new THREE.Group();
      var mat = (i % 2 === 0) ? carRustMat : carBurnMat;

      // Chassis
      var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), mat);
      body.position.y = 0.55;
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), mat);
      cabin.position.set(0, 1.15, -0.2);
      var glass = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.55, 1.9), glassMat);
      glass.position.set(0, 1.15, -0.2);

      // Wheels (partially flat/sunken)
      var wGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 8);
      var wPos = [
        [-0.95, 0.35, 1.3], [0.95, 0.35, 1.3],
        [-0.95, 0.35, -1.3], [0.95, 0.35, -1.3]
      ];
      for (var w = 0; w < 4; w++){
        var wh = new THREE.Mesh(wGeom, tireMat);
        wh.rotation.z = Math.PI / 2;
        wh.position.set(wPos[w][0], wPos[w][1], wPos[w][2]);
        grp.add(wh);
      }

      // Hazard blinkers on rear corners
      var h1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.05), hazardMat);
      h1.position.set(-0.85, 0.65, 2.21);
      var h2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.05), hazardMat);
      h2.position.set(0.85, 0.65, 2.21);
      grp.add(h1, h2);

      // Interactive Trunk Lid (pivoting around hinge at z = 1.0)
      var trunkLid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.2), mat);
      trunkLid.position.set(0, 0.95, 1.6);
      grp.add(trunkLid);

      grp.add(body, cabin, glass);
      grp.position.set(loc.x, 0, loc.z);
      grp.rotation.y = loc.rot;
      scene.add(grp);

      // Collider
      G.colliders.push({ x: loc.x, z: loc.z, hx: 1.2, hz: 2.3, h: 1.6 });

      // Calculate world-space rear trunk interaction coordinates
      var sinY = Math.sin(loc.rot), cosY = Math.cos(loc.rot);
      var trunkWorldX = loc.x + sinY * 2.4;
      var trunkWorldZ = loc.z + cosY * 2.4;

      this.abandonedCars.push({
        id: 'car_' + i,
        grp: grp,
        trunkLid: trunkLid,
        x: loc.x, z: loc.z,
        trunkX: trunkWorldX, trunkZ: trunkWorldZ,
        looted: false,
        trunkOpen: false,
        trunkAngle: 0,
        hazards: [h1, h2],
        hazardTimer: 0
      });
    }
  },

  buildStorefronts: function(scene){
    var half = World.GRID * World.CELL / 2;
    var stores = [
      { name: 'Downtown Pharmacy', type: 'med', color: 0x33cc66, bx: 2, bz: 2, offX: -8, offZ: 14, rot: 0 },
      { name: 'Metro Hardware Supply', type: 'scrap', color: 0xffaa22, bx: 4, bz: 2, offX: 14, offZ: -8, rot: Math.PI / 2 },
      { name: 'Lock & Load Gunsmith', type: 'ammo', color: 0xdd3333, bx: 2, bz: 4, offX: -14, offZ: 8, rot: -Math.PI / 2 },
      { name: 'Corner Convenience Mart', type: 'all', color: 0x3388ff, bx: 4, bz: 4, offX: 8, offZ: -14, rot: Math.PI },
      { name: 'Sunset Auto Parts Depot', type: 'scrap', color: 0xffcc00, bx: 1, bz: 3, offX: 14, offZ: 8, rot: Math.PI / 2 },
      { name: 'Eastside Emergency Clinic', type: 'med', color: 0x22eeaa, bx: 5, bz: 3, offX: -14, offZ: -8, rot: -Math.PI / 2 }
    ];

    var matSignPost = new THREE.MeshLambertMaterial({ color: 0x2a2a2c });
    var matShelf = new THREE.MeshLambertMaterial({ color: 0x4a3c30 });

    for (var i = 0; i < stores.length; i++){
      var st = stores[i];
      var cx = -half + World.CELL / 2 + st.bx * World.CELL + st.offX;
      var cz = -half + World.CELL / 2 + st.bz * World.CELL + st.offZ;

      var grp = new THREE.Group();

      // Awning / Entrance portal
      var awningMat = new THREE.MeshLambertMaterial({ color: st.color });
      var awning = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 1.8), awningMat);
      awning.position.set(0, 3.4, 0.9);
      awning.rotation.x = 0.15;

      // Neon Storefront Sign
      var signMat = new THREE.MeshBasicMaterial({ color: st.color });
      var sign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 0.1), signMat);
      sign.position.set(0, 3.8, 0.1);

      // Support pillars
      var pil1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), matSignPost);
      pil1.position.set(-1.7, 1.8, 1.6);
      var pil2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), matSignPost);
      pil2.position.set(1.7, 1.8, 1.6);

      // Supply Counter / Shelf
      var counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.8), matShelf);
      counter.position.set(0, 0.45, 0.8);

      // Interactive Luminous Supply Cache Box
      var cacheMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
      var cacheBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.6), cacheMat);
      cacheBox.position.set(0, 1.15, 0.8);

      // Beacon light pool
      var beaconLight = new THREE.PointLight(st.color, 1.2, 8);
      beaconLight.position.set(0, 2.2, 0.8);

      grp.add(awning, sign, pil1, pil2, counter, cacheBox, beaconLight);
      grp.position.set(cx, 0, cz);
      grp.rotation.y = st.rot;
      scene.add(grp);

      G.colliders.push({ x: cx, z: cz, hx: 1.8, hz: 1.2, h: 4.0 });

      this.storefronts.push({
        id: 'store_' + i,
        name: st.name,
        type: st.type,
        x: cx, z: cz,
        grp: grp,
        cacheBox: cacheBox,
        beaconLight: beaconLight,
        looted: false
      });
    }
  },

  searchTrunk: function(car){
    if (car.looted) return;
    car.looted = true;
    car.trunkOpen = true;
    AudioSys.trunkOpen();

    // Reward loot: Scrap + Ammo/Health
    var scrapFound = randi(25, 45);
    G.player.scrap = (G.player.scrap || 0) + scrapFound;

    var hasAmmo = Math.random() < 0.65;
    var ammoFound = hasAmmo ? randi(25, 40) : 0;
    if (hasAmmo){
      Weapons.state.reserve += ammoFound;
      HUD.ammo(Weapons.state.mag, Weapons.state.reserve);
    }

    var hasMed = !hasAmmo || Math.random() < 0.35;
    if (hasMed && G.player.health < 100){
      G.player.health = Math.min(100, G.player.health + 35);
      HUD.health(G.player.health);
    }

    if (HUD.updateScrap) HUD.updateScrap(G.player.scrap);

    var msg = '📦 TRUNK LOOTED: +' + scrapFound + ' Scrap';
    if (ammoFound > 0) msg += ' & +' + ammoFound + ' Ammo';
    if (hasMed) msg += ' & +35 HP';
    HUD.toast(msg);

    // Turn off hazard blinkers once looted
    if (car.hazards){
      car.hazards[0].material.color.setHex(0x331100);
      car.hazards[1].material.color.setHex(0x331100);
    }
  },

  scavengeStore: function(store){
    if (store.looted) return;
    store.looted = true;
    AudioSys.scavengeSearch();

    var scrapGained = randi(45, 75);
    G.player.scrap = (G.player.scrap || 0) + scrapGained;

    var rewardText = '🏪 ' + store.name.toUpperCase() + ': +' + scrapGained + ' SCRAP';

    if (store.type === 'med'){
      G.player.health = 100;
      G.player.armor = Math.min(100, (G.player.armor || 0) + 50);
      HUD.health(100);
      rewardText += ' & FULL MEDKIT RESTORE!';
    } else if (store.type === 'ammo'){
      Weapons.state.reserve += 60;
      HUD.ammo(Weapons.state.mag, Weapons.state.reserve);
      rewardText += ' & +60 RIFLE ROUNDS!';
    } else {
      Weapons.state.reserve += 35;
      G.player.health = Math.min(100, G.player.health + 40);
      HUD.health(G.player.health);
      HUD.ammo(Weapons.state.mag, Weapons.state.reserve);
      rewardText += ' & SUPPLIES COLLECTED!';
    }

    if (HUD.updateScrap) HUD.updateScrap(G.player.scrap);
    HUD.toast(rewardText);

    // Dim the beacon light and box to show it's scavenged
    if (store.beaconLight) store.beaconLight.intensity = 0.2;
    if (store.cacheBox) store.cacheBox.material.color.setHex(0x444444);
  },

  nearestInteraction: function(px, pz){
    // Check abandoned car trunks
    for (var i = 0; i < this.abandonedCars.length; i++){
      var c = this.abandonedCars[i];
      if (dist2(px, pz, c.trunkX, c.trunkZ) < 2.4 * 2.4){
        if (!c.looted){
          return { type: 'trunk', target: c, text: 'Press E — Search Abandoned Car Trunk' };
        } else {
          return { type: 'trunk_empty', text: 'Car Trunk [Empty]' };
        }
      }
    }

    // Check storefronts
    for (var j = 0; j < this.storefronts.length; j++){
      var s = this.storefronts[j];
      if (dist2(px, pz, s.x, s.z) < 3.2 * 3.2){
        if (!s.looted){
          return { type: 'store', target: s, text: 'Press E — Scavenge ' + s.name };
        } else {
          return { type: 'store_empty', text: s.name + ' [Scavenged]' };
        }
      }
    }

    return null;
  },

  update: function(dt){
    // 1. Animate opening trunks
    for (var i = 0; i < this.abandonedCars.length; i++){
      var c = this.abandonedCars[i];
      if (c.trunkOpen && c.trunkAngle < 0.95){
        c.trunkAngle = Math.min(0.95, c.trunkAngle + dt * 2.8);
        c.trunkLid.rotation.x = -c.trunkAngle;
        c.trunkLid.position.y = 0.95 + Math.sin(c.trunkAngle) * 0.4;
      }
      // Blink hazard lights on unlooted cars
      if (!c.looted && c.hazards){
        c.hazardTimer = (c.hazardTimer + dt * 3.5) % 2;
        var on = c.hazardTimer < 1.0;
        var col = on ? 0xff8800 : 0x221100;
        c.hazards[0].material.color.setHex(col);
        c.hazards[1].material.color.setHex(col);
      }
    }

    // 2. Pulse beacon lights on unlooted storefronts
    var t = performance.now() * 0.003;
    for (var j = 0; j < this.storefronts.length; j++){
      var st = this.storefronts[j];
      if (!st.looted && st.beaconLight){
        st.beaconLight.intensity = 1.0 + 0.35 * Math.sin(t * 3.0 + j);
      }
    }
  }
};
