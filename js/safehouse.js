// Vespera - Safehouse Fortification & Weapon Workbench System
// Architectural House Rebuild: Real Craftsman Survival House with Weathered Timber Lap-Siding,
// Brick Foundation, Pitched Shingle Roof, Covered Porch, Double Fortified Security Doors,
// Cozy Survivor Living Quarters, Workbench, Ammo Cache, Generator, Beacon, & Player Stealth Hiding Mechanics.
// Also includes dynamic auto-loader for external 3D house GLB models (assets/New folder/house.glb).

var Safehouse = {
  pos: { x: 0, y: 0, z: 0 },
  bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
  barricades: [],
  door: null,
  ammoCache: null,
  workbench: null,
  generator: null,
  beacon: null,
  proceduralExterior: null,
  externalModel: null,
  upgrades: {
    extendedMag: { id: 'extendedMag', name: 'Extended Magazine', desc: 'Increases magazine capacity to 45 rounds', cost: 45, installed: false },
    compensator: { id: 'compensator', name: 'Tuned Gas Compensator', desc: 'Reduces recoil kick & spread by 40%', cost: 60, installed: false },
    apRounds:    { id: 'apRounds',    name: 'Tungsten AP Ammunition', desc: 'Boosts bullet damage from 28 to 38 (+35%)', cost: 80, installed: false },
    tunedBolt:   { id: 'tunedBolt',   name: 'Match-Grade Lightened Bolt', desc: 'Increases cyclic fire rate by 22%', cost: 100, installed: false }
  },
  tex: {},

  // Procedural textures for rich aesthetics
  buildTextures: function(){
    var self = this;

    // 1. Weathered Lap Siding / Timber Planks (Exterior)
    this.tex.clapboard = this.makeTex(256, 256, function(g){
      g.fillStyle = '#4a3b2c';
      g.fillRect(0, 0, 256, 256);
      var plankH = 24;
      for (var y = 0; y < 256; y += plankH){
        var c = randi(65, 85);
        g.fillStyle = 'rgb(' + (c + 8) + ',' + c + ',' + (c - 12) + ')';
        g.fillRect(0, y, 256, plankH - 2);

        // horizontal bevel shadow
        g.fillStyle = 'rgba(15, 10, 5, 0.55)';
        g.fillRect(0, y + plankH - 3, 256, 3);
        g.fillStyle = 'rgba(255, 235, 200, 0.08)';
        g.fillRect(0, y, 256, 1);

        // wood grain streaks
        for (var i = 0; i < 20; i++){
          g.fillStyle = 'rgba(20, 12, 5, ' + rand(0.08, 0.22) + ')';
          g.fillRect(rand(0, 256), y + rand(2, plankH - 4), rand(15, 60), 1);
        }
      }
    }, 4, 3);

    // 2. Weathered Red/Brown Brick (Foundation & Chimney)
    this.tex.brick = this.makeTex(256, 256, function(g){
      g.fillStyle = '#7a766f'; // mortar
      g.fillRect(0, 0, 256, 256);
      var bH = 16, bW = 32;
      var row = 0;
      for (var y = 2; y < 256; y += bH + 2){
        var off = (row % 2 === 0) ? 0 : bW / 2;
        for (var x = -bW + off; x < 256; x += bW + 2){
          var r = randi(110, 145);
          var gr = randi(45, 65);
          var b = randi(35, 50);
          g.fillStyle = 'rgb(' + r + ',' + gr + ',' + b + ')';
          g.fillRect(x, y, bW, bH);
          g.fillStyle = 'rgba(0, 0, 0, ' + rand(0.05, 0.18) + ')';
          g.fillRect(x + rand(2, bW - 4), y + rand(2, bH - 4), rand(2, 6), rand(2, 4));
        }
        row++;
      }
    }, 6, 6);

    // 3. Dark Slate Architectural Roof Shingles
    this.tex.shingles = this.makeTex(256, 256, function(g){
      g.fillStyle = '#1c1e22';
      g.fillRect(0, 0, 256, 256);
      var sH = 20, sW = 32;
      var row = 0;
      for (var y = 0; y < 256; y += sH){
        var off = (row % 2 === 0) ? 0 : sW / 2;
        for (var x = -sW + off; x < 256; x += sW){
          var shade = randi(38, 55);
          g.fillStyle = 'rgb(' + (shade - 4) + ',' + shade + ',' + (shade + 6) + ')';
          g.fillRect(x, y, sW - 1, sH - 2);

          g.fillStyle = 'rgba(8, 9, 10, 0.7)';
          g.fillRect(x, y + sH - 3, sW, 3);
          g.fillStyle = 'rgba(255, 255, 255, 0.08)';
          g.fillRect(x, y, sW, 1);
        }
        row++;
      }
    }, 5, 4);

    // 4. Polished Dark Oak Floorboards (Interior)
    this.tex.woodFloor = this.makeTex(256, 256, function(g){
      g.fillStyle = '#2d1e12';
      g.fillRect(0, 0, 256, 256);
      var fH = 20;
      for (var y = 0; y < 256; y += fH){
        var tone = randi(55, 80);
        g.fillStyle = 'rgb(' + (tone + 15) + ',' + tone + ',' + Math.max(10, tone - 20) + ')';
        g.fillRect(0, y, 256, fH - 1);
        g.fillStyle = 'rgba(15, 8, 4, 0.6)';
        g.fillRect(0, y + fH - 2, 256, 2);

        g.fillStyle = '#110c08';
        for (var nx = 18; nx < 256; nx += 64){
          g.fillRect(nx, y + 4, 2, 2);
          g.fillRect(nx, y + fH - 6, 2, 2);
        }
      }
    }, 6, 6);

    // 5. Warm Drywall / Plaster (Interior Walls)
    this.tex.plaster = this.makeTex(128, 128, function(g){
      g.fillStyle = '#bcb5a7';
      g.fillRect(0, 0, 128, 128);
      for (var i = 0; i < 400; i++){
        var c = randi(160, 210);
        g.fillStyle = 'rgba(' + c + ',' + c + ',' + c + ', 0.04)';
        g.fillRect(rand(0, 128), rand(0, 128), 2, 2);
      }
    }, 3, 3);

    // 6. Cozy Distressed Vintage Rug
    this.tex.rug = this.makeTex(128, 128, function(g){
      g.fillStyle = '#61211e'; // deep burgundy
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#c2a649'; // gold border
      g.lineWidth = 4;
      g.strokeRect(6, 6, 116, 116);
      g.strokeStyle = '#223843'; // dark teal inner border
      g.lineWidth = 2;
      g.strokeRect(14, 14, 100, 100);
      g.fillStyle = '#c2a649';
      g.beginPath();
      g.moveTo(64, 26); g.lineTo(102, 64); g.lineTo(64, 102); g.lineTo(26, 64);
      g.closePath(); g.fill();
      g.fillStyle = '#223843';
      g.beginPath();
      g.moveTo(64, 38); g.lineTo(90, 64); g.lineTo(64, 90); g.lineTo(38, 64);
      g.closePath(); g.fill();
    });

    // 7. Plank Wood
    this.tex.woodPlank = this.makeWoodTex();
    this.woodTex = this.tex.woodPlank;
  },

  makeTex: function(w, h, fn, repeatX, repeatY){
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeatX) t.repeat.set(repeatX, repeatY || repeatX);
    t.anisotropy = 2;
    return t;
  },

  makeWoodTex: function(){
    var c = document.createElement('canvas'); c.width = 128; c.height = 32;
    var g = c.getContext('2d');
    g.fillStyle = '#5c3e21'; g.fillRect(0, 0, 128, 32);
    for (var i = 0; i < 220; i++){
      g.fillStyle = 'rgba(35, 20, 8, ' + rand(0.08, 0.3) + ')';
      g.fillRect(rand(0, 128), rand(0, 32), rand(8, 32), rand(1, 3));
    }
    g.fillStyle = '#1c1b18';
    g.beginPath(); g.arc(10, 16, 2.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(118, 16, 2.5, 0, Math.PI * 2); g.fill();
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  },

  build: function(scene, swx, swz){
    var self = this;
    this.pos = { x: swx, y: 0, z: swz };
    this.buildTextures();

    // House Core Dimensions: 16m wide (East-West) x 14m deep (North-South)
    var W = 16, D = 14, WallH = 4.2;
    this.bounds = { minX: swx - W/2, maxX: swx + W/2, minZ: swz - D/2, maxZ: swz + D/2 };

    var matSiding = new THREE.MeshLambertMaterial({ map: this.tex.clapboard });
    var matBrick  = new THREE.MeshLambertMaterial({ map: this.tex.brick });
    var matRoof   = new THREE.MeshLambertMaterial({ map: this.tex.shingles });
    var matFloor  = new THREE.MeshLambertMaterial({ map: this.tex.woodFloor });
    var matDrywall= new THREE.MeshLambertMaterial({ map: this.tex.plaster });
    var matTrim   = new THREE.MeshLambertMaterial({ color: 0x3d352e });
    var matPorch  = new THREE.MeshLambertMaterial({ color: 0x4f3d2e });
    var matGlass  = new THREE.MeshLambertMaterial({ color: 0x22303c, transparent: true, opacity: 0.65 });

    var houseGrp = new THREE.Group();
    houseGrp.position.set(swx, 0, swz);
    this.proceduralExterior = houseGrp;

    function addWallSegment(x, z, w, d, h, yOff, hasCollider, mat){
      var y = (yOff || 0) + h / 2;
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || matSiding);
      mesh.position.set(x, y, z);
      houseGrp.add(mesh);
      if (hasCollider !== false && (!yOff || yOff < 1.5)){
        G.colliders.push({ x: swx + x, z: swz + z, hx: w / 2, hz: d / 2, h: (yOff || 0) + h });
      }
      return mesh;
    }

    // 1. Foundation & Flooring
    var fBase = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.65, D + 0.4), matBrick);
    fBase.position.set(0, 0.325, 0);
    houseGrp.add(fBase);

    var floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.15, D - 0.5), matFloor);
    floor.position.set(0, 0.65, 0);
    houseGrp.add(floor);

    var rugMat = new THREE.MeshLambertMaterial({ map: this.tex.rug });
    var rug = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 5.0), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-1.0, 0.73, -1.0);
    houseGrp.add(rug);

    // 2. Exterior Walls & Corner Posts
    var zNorth = -D/2 + 0.25;
    var zSouth =  D/2 - 0.25;
    var xWest  = -W/2 + 0.25;
    var xEast  =  W/2 - 0.25;

    var postGeom = new THREE.BoxGeometry(0.55, WallH, 0.55);
    var pNW = new THREE.Mesh(postGeom, matTrim); pNW.position.set(xWest, WallH/2, zNorth);
    var pNE = new THREE.Mesh(postGeom, matTrim); pNE.position.set(xEast, WallH/2, zNorth);
    var pSW = new THREE.Mesh(postGeom, matTrim); pSW.position.set(xWest, WallH/2, zSouth);
    var pSE = new THREE.Mesh(postGeom, matTrim); pSE.position.set(xEast, WallH/2, zSouth);
    houseGrp.add(pNW, pNE, pSW, pSE);

    // West Wall with brick chimney
    addWallSegment(xWest, 0, 0.5, D, WallH);

    var chimney = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8.8, 1.4), matBrick);
    chimney.position.set(xWest - 0.8, 4.4, 0);
    var chimCap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 1.7), matTrim);
    chimCap.position.set(xWest - 0.8, 8.9, 0);
    houseGrp.add(chimney, chimCap);
    G.colliders.push({ x: swx + xWest - 0.8, z: swz, hx: 0.9, hz: 0.8, h: 8.8 });

    // East Wall with window
    addWallSegment(xEast, -3.8, 0.5, 6.4, WallH);
    addWallSegment(xEast,  3.8, 0.5, 6.4, WallH);
    addWallSegment(xEast, 0, 0.5, 2.0, 1.2, 0, true);
    addWallSegment(xEast, 0, 0.5, 2.0, 1.2, 3.0, false);
    var winE = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 1.95), matGlass);
    winE.position.set(xEast, 2.1, 0);
    houseGrp.add(winE);

    // North Wall with 2 windows
    addWallSegment(-5.8, zNorth, 4.4, 0.5, WallH);
    addWallSegment( 0.0, zNorth, 4.0, 0.5, WallH);
    addWallSegment( 5.8, zNorth, 4.4, 0.5, WallH);
    addWallSegment(-2.8, zNorth, 2.4, 0.5, 1.1, 0, true);
    addWallSegment(-2.8, zNorth, 2.4, 0.5, 1.3, 2.9, false);
    var winN1 = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.8, 0.1), matGlass);
    winN1.position.set(-2.8, 2.0, zNorth);
    houseGrp.add(winN1);

    addWallSegment( 2.8, zNorth, 2.4, 0.5, 1.1, 0, true);
    addWallSegment( 2.8, zNorth, 2.4, 0.5, 1.3, 2.9, false);
    var winN2 = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.8, 0.1), matGlass);
    winN2.position.set( 2.8, 2.0, zNorth);
    houseGrp.add(winN2);

    // South Wall with Porch & Double Doors
    addWallSegment(-5.6, zSouth, 4.8, 0.5, WallH);
    addWallSegment( 5.6, zSouth, 4.8, 0.5, WallH);
    addWallSegment( 0.0, zSouth, 2.8, 0.5, 1.0, 3.2, false);

    addWallSegment(-2.2, zSouth, 2.0, 0.5, 1.1, 0, true);
    addWallSegment(-2.2, zSouth, 2.0, 0.5, 1.3, 2.9, false);
    var winS = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.8, 0.1), matGlass);
    winS.position.set(-2.2, 2.0, zSouth);
    houseGrp.add(winS);

    addWallSegment( 2.2, zSouth, 2.0, 0.5, 1.1, 0, true);
    addWallSegment( 2.2, zSouth, 2.0, 0.5, 1.3, 2.9, false);
    var winS2 = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.8, 0.1), matGlass);
    winS2.position.set( 2.2, 2.0, zSouth);
    houseGrp.add(winS2);

    // 3. Front Covered Porch
    var porchW = 8.8, porchD = 3.2, porchY = 0.45;
    var porchFloor = new THREE.Mesh(new THREE.BoxGeometry(porchW, 0.22, porchD), matPorch);
    porchFloor.position.set(0, porchY, zSouth + porchD / 2);
    houseGrp.add(porchFloor);

    for (var s = 0; s < 3; s++){
      var stepMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.45), matPorch);
      stepMesh.position.set(0, porchY - (s + 1) * 0.12, zSouth + porchD + 0.2 + s * 0.38);
      houseGrp.add(stepMesh);
    }

    var colGeom = new THREE.BoxGeometry(0.24, 3.2, 0.24);
    var c1 = new THREE.Mesh(colGeom, matTrim); c1.position.set(-porchW/2 + 0.3, 1.8, zSouth + porchD - 0.2);
    var c2 = new THREE.Mesh(colGeom, matTrim); c2.position.set( porchW/2 - 0.3, 1.8, zSouth + porchD - 0.2);
    var c3 = new THREE.Mesh(colGeom, matTrim); c3.position.set(-1.6, 1.8, zSouth + porchD - 0.2);
    var c4 = new THREE.Mesh(colGeom, matTrim); c4.position.set( 1.6, 1.8, zSouth + porchD - 0.2);
    houseGrp.add(c1, c2, c3, c4);

    var railGeom = new THREE.BoxGeometry(0.1, 0.8, porchD - 0.4);
    var rL = new THREE.Mesh(railGeom, matTrim); rL.position.set(-porchW/2 + 0.15, porchY + 0.5, zSouth + porchD / 2);
    var rR = new THREE.Mesh(railGeom, matTrim); rR.position.set( porchW/2 - 0.15, porchY + 0.5, zSouth + porchD / 2);
    houseGrp.add(rL, rR);
    G.colliders.push({ x: swx - porchW/2 + 0.15, z: swz + zSouth + porchD/2, hx: 0.1, hz: (porchD-0.4)/2, h: 1.2 });
    G.colliders.push({ x: swx + porchW/2 - 0.15, z: swz + zSouth + porchD/2, hx: 0.1, hz: (porchD-0.4)/2, h: 1.2 });

    var porchRoof = new THREE.Mesh(new THREE.BoxGeometry(porchW + 0.6, 0.18, porchD + 0.6), matRoof);
    porchRoof.position.set(0, 3.35, zSouth + porchD / 2);
    porchRoof.rotation.x = 0.12;
    houseGrp.add(porchRoof);

    var matBrass = new THREE.MeshLambertMaterial({ color: 0xb59445 });
    var lanternMat = new THREE.MeshBasicMaterial({ color: 0xffd077 });
    var lanternHead = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.32, 6), lanternMat);
    lanternHead.position.set(0, 3.4, zSouth + 0.45);
    var lanternArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.45), matBrass);
    lanternArm.position.set(0, 3.55, zSouth + 0.22);
    houseGrp.add(lanternHead, lanternArm);

    var porchLight = new THREE.PointLight(0xffb555, 1.8, 14);
    porchLight.position.set(0, 3.2, zSouth + 0.8);
    houseGrp.add(porchLight);

    // 4. Pitched Roof & Attic
    var roofOverhang = 0.7;
    var roofLen = W + roofOverhang * 2;
    var roofSlopeLen = Math.sqrt(Math.pow(D / 2 + roofOverhang, 2) + Math.pow(3.0, 2));

    var rSouth = new THREE.Mesh(new THREE.BoxGeometry(roofLen, 0.22, roofSlopeLen), matRoof);
    rSouth.position.set(0, WallH + 1.4, (D/2 + roofOverhang)/2 - 0.35);
    rSouth.rotation.x = Math.atan2(3.0, D/2 + roofOverhang);
    var rNorth = new THREE.Mesh(new THREE.BoxGeometry(roofLen, 0.22, roofSlopeLen), matRoof);
    rNorth.position.set(0, WallH + 1.4, -(D/2 + roofOverhang)/2 + 0.35);
    rNorth.rotation.x = -Math.atan2(3.0, D/2 + roofOverhang);
    houseGrp.add(rSouth, rNorth);

    var ridge = new THREE.Mesh(new THREE.BoxGeometry(roofLen + 0.1, 0.18, 0.45), matRoof);
    ridge.position.set(0, WallH + 2.95, 0);
    houseGrp.add(ridge);

    function addGableWall(gx, rotY){
      var gableGrp = new THREE.Group();
      gableGrp.position.set(gx, WallH, 0);
      gableGrp.rotation.y = rotY;
      for (var ty = 0; ty < 6; ty++){
        var tierY = ty * 0.48;
        var tierW = (D - 0.5) * (1.0 - ty / 6.0);
        var tier = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, tierW), matSiding);
        tier.position.set(0, tierY + 0.25, 0);
        gableGrp.add(tier);
      }
      var vent = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.8), matTrim);
      vent.position.set(0, 1.2, 0);
      gableGrp.add(vent);
      houseGrp.add(gableGrp);
    }
    addGableWall(xWest, 0);
    addGableWall(xEast, Math.PI);

    var ceil = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.18, D - 0.4), matDrywall);
    ceil.position.set(0, WallH, 0);
    houseGrp.add(ceil);

    for (var bz = -5; bz <= 5; bz += 2.5){
      var beam = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, 0.28, 0.18), matTrim);
      beam.position.set(0, WallH - 0.14, bz);
      houseGrp.add(beam);
    }

    // 5. Double Fortified Security Doors
    this.buildHouseDoors(scene, swx, swz + zSouth);

    // 6. Window Barricades
    this.barricades = [
      this.createBarricade(scene, 'win_south_left',  swx - 2.2, 2.0, swz + zSouth, 0, 2.0, 1.8, false),
      this.createBarricade(scene, 'win_south_right', swx + 2.2, 2.0, swz + zSouth, 0, 2.0, 1.8, false),
      this.createBarricade(scene, 'win_north_1',     swx - 2.8, 2.0, swz + zNorth, 0, 2.4, 1.8, false),
      this.createBarricade(scene, 'win_north_2',     swx + 2.8, 2.0, swz + zNorth, 0, 2.4, 1.8, false),
      this.createBarricade(scene, 'win_east',        swx + xEast, 2.1, swz, Math.PI/2, 2.0, 1.8, false)
    ];

    // 7. Survivor Living Quarters Furniture
    // A. Bed / Cot
    var matBedFrame = new THREE.MeshLambertMaterial({ color: 0x3d2817 });
    var matMattress = new THREE.MeshLambertMaterial({ color: 0x8a8479 });
    var matBlanket  = new THREE.MeshLambertMaterial({ color: 0x2e4231 });
    var matPillow   = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });

    var bedGrp = new THREE.Group();
    var bFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 2.5), matBedFrame);
    bFrame.position.y = 0.88;
    var bMat = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.22, 2.38), matMattress);
    bMat.position.y = 1.15;
    var bBlanket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 1.7), matBlanket);
    bBlanket.position.set(0, 1.18, 0.32);
    var bPillow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.55), matPillow);
    bPillow.position.set(0, 1.28, -0.85);
    bedGrp.add(bFrame, bMat, bBlanket, bPillow);
    bedGrp.position.set(-5.6, 0, -4.6);
    houseGrp.add(bedGrp);
    G.colliders.push({ x: swx - 5.6, z: swz - 4.6, hx: 0.85, hz: 1.3, h: 1.4 });

    // B. Survival Supply Shelf Rack
    var matSteelRack = new THREE.MeshLambertMaterial({ color: 0x22252a });
    var matRation    = new THREE.MeshLambertMaterial({ color: 0x9e7844 });
    var matMedkit    = new THREE.MeshLambertMaterial({ color: 0xb5352a });

    var rackGrp = new THREE.Group();
    for (var rx of [-0.9, 0.9]){
      for (var rz of [-0.35, 0.35]){
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 0.06), matSteelRack);
        post.position.set(rx, 1.95, rz);
        rackGrp.add(post);
      }
    }
    for (var sy = 0; sy < 4; sy++){
      var shelf = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.04, 0.78), matSteelRack);
      shelf.position.y = 0.95 + sy * 0.58;
      rackGrp.add(shelf);
      for (var c = 0; c < 4; c++){
        var can = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 6), matRation);
        can.position.set(-0.6 + c * 0.38, 1.05 + sy * 0.58, rand(-0.15, 0.15));
        rackGrp.add(can);
      }
    }
    var med = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.28), matMedkit);
    med.position.set(0.45, 1.62, 0);
    rackGrp.add(med);
    rackGrp.position.set(5.8, 0, -0.6);
    houseGrp.add(rackGrp);
    G.colliders.push({ x: swx + 5.8, z: swz - 0.6, hx: 1.0, hz: 0.5, h: 2.6 });

    // C. Radio Prep Table & Stool
    var tableGrp = new THREE.Group();
    var tTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.0), matPorch);
    tTop.position.y = 1.35;
    for (var tx of [-0.75, 0.75]){
      for (var tz of [-0.4, 0.4]){
        var tLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), matTrim);
        tLeg.position.set(tx, 1.0, tz);
        tableGrp.add(tLeg);
      }
    }
    var radio = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.28), matSteelRack);
    radio.position.set(-0.35, 1.5, 0.05);
    var mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 6), matMattress);
    mug.position.set(0.4, 1.45, 0.1);
    tableGrp.add(tTop, radio, mug);
    tableGrp.position.set(-1.8, 0, -3.8);
    houseGrp.add(tableGrp);
    G.colliders.push({ x: swx - 1.8, z: swz - 3.8, hx: 1.0, hz: 0.6, h: 1.5 });

    // 8. Interactive Safehouse Stations
    this.buildGenerator(scene, swx - 5.5, swz - 1.8);
    this.buildAmmoCache(scene, swx - 5.8, swz + 2.6);
    this.buildWorkbench(scene, swx + 5.4, swz - 3.6);
    this.buildBeacon(scene, swx + 5.4, swz + 2.6);

    // 9. Warm Interior Lighting & Incandescent Bulb
    var bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa });
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), bulbMat);
    bulb.position.set(0, WallH - 0.75, 0);
    var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 4), matTrim);
    cord.position.set(0, WallH - 0.38, 0);
    houseGrp.add(bulb, cord);

    var interiorLamp = new THREE.PointLight(0xffca77, 2.5, 24);
    interiorLamp.position.set(0, WallH - 0.85, 0);
    houseGrp.add(interiorLamp);
    this.interiorLamp = interiorLamp;

    var fillLight = new THREE.PointLight(0xffa855, 1.4, 18);
    fillLight.position.set(0, 2.2, 0);
    houseGrp.add(fillLight);

    scene.add(houseGrp);

    // Attempt to load external 3D House GLB if present
    this.load3DHouse(scene);
  },

  buildHouseDoors: function(scene, swx, doorZ){
    var doorW = 2.8, doorH = 3.1;
    var leafW = doorW / 2; // 1.4m per leaf

    var matDoorWood = new THREE.MeshLambertMaterial({ map: this.woodTex });
    var matIron = new THREE.MeshLambertMaterial({ color: 0x1a1a1c });
    var matHandle = new THREE.MeshLambertMaterial({ color: 0xb59445 });

    var frameMat = new THREE.MeshLambertMaterial({ color: 0x3d352e });
    var frameL = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorH, 0.28), frameMat);
    frameL.position.set(swx - doorW/2 - 0.08, doorH/2, doorZ);
    var frameR = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorH, 0.28), frameMat);
    frameR.position.set(swx + doorW/2 + 0.08, doorH/2, doorZ);
    var frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.36, 0.18, 0.28), frameMat);
    frameTop.position.set(swx, doorH + 0.08, doorZ);
    scene.add(frameL, frameR, frameTop);

    function buildLeaf(isLeft){
      var pivot = new THREE.Group();
      var hingeX = isLeft ? (swx - doorW/2) : (swx + doorW/2);
      pivot.position.set(hingeX, 0, doorZ);

      var panel = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.03, doorH - 0.04, 0.08), matDoorWood);
      var panelX = isLeft ? (leafW / 2) : (-leafW / 2);
      panel.position.set(panelX, doorH / 2, 0);
      pivot.add(panel);

      for (var sy of [0.65, doorH - 0.65]){
        var strap = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.06, 0.12, 0.095), matIron);
        strap.position.set(panelX, sy, 0.005);
        pivot.add(strap);
      }

      var brace = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.15, 0.12, 0.09), matDoorWood);
      brace.position.set(panelX, doorH / 2, 0.005);
      brace.rotation.z = isLeft ? 0.65 : -0.65;
      pivot.add(brace);

      var handleX = isLeft ? (leafW - 0.18) : (-leafW + 0.18);
      var handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.14), matHandle);
      handle.position.set(handleX, 1.45, 0.06);
      pivot.add(handle);

      if (isLeft){
        var bolt = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.12), matIron);
        bolt.position.set(leafW - 0.12, 1.62, -0.04);
        pivot.add(bolt);
      }

      scene.add(pivot);
      return pivot;
    }

    var pivotLeft  = buildLeaf(true);
    var pivotRight = buildLeaf(false);

    var collider = { x: swx, z: doorZ, hx: doorW / 2, hz: 0.35, h: doorH };
    G.colliders.push(collider);

    this.door = {
      pivotLeft: pivotLeft,
      pivotRight: pivotRight,
      pivot: pivotLeft,
      x: swx,
      z: doorZ,
      width: doorW,
      height: doorH,
      isOpen: false,
      angle: 0,
      targetAngle: 0,
      collider: collider,
      bangTimer: 0
    };
  },

  buildPlankDoor: function(scene, doorCenterX, doorZ){
    this.buildHouseDoors(scene, doorCenterX, doorZ);
  },

  toggleDoor: function(){
    if (!this.door) return;
    var p = G.player.pos;
    var d2 = dist2(p.x, p.z, this.door.x, this.door.z);
    if (d2 > 6.0 * 6.0){
      HUD.toast('Move closer to the front house doors!');
      return;
    }

    this.door.isOpen = !this.door.isOpen;
    this.door.targetAngle = this.door.isOpen ? 1.75 : 0;
    AudioSys.doorCreak(this.door.isOpen);

    if (this.door.isOpen){
      var idx;
      while ((idx = G.colliders.indexOf(this.door.collider)) !== -1){
        G.colliders.splice(idx, 1);
      }
      HUD.toast('🏠 HOUSE DOORS OPENED (Press O to close and hide)');
    } else {
      if (G.colliders.indexOf(this.door.collider) === -1){
        G.colliders.push(this.door.collider);
      }
      HUD.toast('🔒 HOUSE DOORS SECURED (You are now hidden)');
    }
  },

  isPlayerInside: function(){
    var p = G.player.pos;
    var b = this.bounds;
    return (p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ);
  },

  isPlayerHidden: function(){
    return this.isPlayerInside() && this.door && !this.door.isOpen;
  },

  createBarricade: function(scene, id, x, y, z, rotY, width, height, isDoor){
    var grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = rotY;
    scene.add(grp);

    var b = {
      id: id,
      isDoor: isDoor,
      x: x, y: y, z: z,
      width: width,
      height: height,
      planks: 3,
      maxPlanks: 4,
      hp: 75,
      maxHp: 100,
      grp: grp,
      plankMeshes: [],
      shakeTimer: 0
    };

    this.rebuildPlanks(b);
    return b;
  },

  rebuildPlanks: function(b){
    while (b.grp.children.length > 0){
      b.grp.remove(b.grp.children[0]);
    }
    b.plankMeshes = [];

    var matWood = new THREE.MeshLambertMaterial({ map: this.woodTex });
    var plankHeight = 0.22;
    var plankDepth = 0.08;
    var ySpacing = b.height / (b.maxPlanks + 1);
    var angles = [-0.04, 0.05, -0.06, 0.03];

    for (var i = 0; i < b.planks; i++){
      var plank = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 1.08, plankHeight, plankDepth),
        matWood
      );
      var yPos = -b.height / 2 + ySpacing * (i + 1);
      plank.position.set(0, yPos, rand(-0.02, 0.02));
      plank.rotation.z = angles[i % angles.length];
      b.grp.add(plank);
      b.plankMeshes.push(plank);
    }
  },

  damageBarricade: function(b, dmg){
    if (b.planks <= 0) return false;
    b.hp -= dmg;
    b.shakeTimer = 0.35;
    AudioSys.woodSplinter();

    if (b.hp <= 0){
      b.planks = Math.max(0, b.planks - 1);
      b.hp = b.planks > 0 ? b.maxHp : 0;
      this.rebuildPlanks(b);
      HUD.toast('⚠️ BARRICADE BREACHED! [' + b.planks + '/' + b.maxPlanks + ' planks remaining]');
      if (b.planks === 0) HUD.toast('🚨 WINDOW DEFENSE COLLAPSED! ZOMBIES ENTERING!');
      return true;
    }
    return false;
  },

  fortifyBarricade: function(b){
    if (b.planks >= b.maxPlanks){
      HUD.toast('Barricade fully fortified (4/4 planks)!');
      return;
    }
    var scrapCost = 10;
    if ((G.player.scrap || 0) < scrapCost){
      HUD.toast('Need ' + scrapCost + ' Scrap to nail a plank! (Have ' + (G.player.scrap || 0) + ')');
      return;
    }

    G.player.scrap -= scrapCost;
    b.planks++;
    b.hp = b.maxHp;
    this.rebuildPlanks(b);
    AudioSys.workbenchUpgrade();
    if (HUD.updateScrap) HUD.updateScrap(G.player.scrap);
    HUD.toast('🔨 Plank Fortified! [' + b.planks + '/' + b.maxPlanks + ' planks]');
  },

  buildGenerator: function(scene, x, z){
    var grp = new THREE.Group();
    var matSteel = new THREE.MeshLambertMaterial({ color: 0x2e3238 });
    var matEngine = new THREE.MeshLambertMaterial({ color: 0x4a5059 });
    var matGlow = new THREE.MeshBasicMaterial({ color: 0xffaa22 });

    var body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.2), matSteel);
    body.position.y = 0.7;
    var eng = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), matEngine);
    eng.position.set(0, 0.8, 0.1);
    var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), matEngine);
    pipe.position.set(0.6, 1.5, -0.3);
    var dial = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8), matGlow);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(-0.5, 1.1, 0.61);

    grp.add(body, eng, pipe, dial);
    grp.position.set(x, 0, z);
    scene.add(grp);
    G.colliders.push({ x: x, z: z, hx: 1.0, hz: 0.7, h: 1.6 });

    var genLight = new THREE.PointLight(0xffaa22, 1.2, 8);
    genLight.position.set(x, 1.2, z + 0.8);
    scene.add(genLight);

    this.generator = { grp: grp, light: genLight, x: x, z: z, phase: 0 };
  },

  buildAmmoCache: function(scene, x, z){
    var grp = new THREE.Group();
    var matCrate = new THREE.MeshLambertMaterial({ color: 0x3d4a36 });
    var matTrim = new THREE.MeshLambertMaterial({ color: 0xd4a017 });

    var box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), matCrate);
    box.position.y = 0.4;
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.12, 0.92), matTrim);
    stripe.position.y = 0.45;
    var latch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.06), matTrim);
    latch.position.set(0, 0.48, 0.46);

    var beamMat = new THREE.MeshBasicMaterial({
      color: 0xffbf36,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 3.2, 8), beamMat);
    beam.position.y = 2.0;

    grp.add(box, stripe, latch, beam);
    grp.position.set(x, 0, z);
    scene.add(grp);
    G.colliders.push({ x: x, z: z, hx: 0.8, hz: 0.55, h: 1.0 });

    this.ammoCache = {
      grp: grp,
      beam: beam,
      x: x, y: 0.8, z: z,
      cooldown: 0,
      maxCooldown: 45
    };
  },

  buildWorkbench: function(scene, x, z){
    var grp = new THREE.Group();
    var matBench = new THREE.MeshLambertMaterial({ color: 0x5a3e24 });
    var matSteel = new THREE.MeshLambertMaterial({ color: 0x2e3033 });
    var matBlueprint = new THREE.MeshBasicMaterial({ color: 0x1e5088 });

    var top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.2), matBench);
    top.position.y = 1.0;
    var bp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.7), matBlueprint);
    bp.position.set(0, 1.07, 0);

    var legGeom = new THREE.BoxGeometry(0.12, 1.0, 0.12);
    var leg1 = new THREE.Mesh(legGeom, matSteel); leg1.position.set(-1.05, 0.5, -0.45);
    var leg2 = new THREE.Mesh(legGeom, matSteel); leg2.position.set(1.05, 0.5, -0.45);
    var leg3 = new THREE.Mesh(legGeom, matSteel); leg3.position.set(-1.05, 0.5, 0.45);
    var leg4 = new THREE.Mesh(legGeom, matSteel); leg4.position.set(1.05, 0.5, 0.45);
    var vise = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 0.28), matSteel);
    vise.position.set(-0.9, 1.18, 0.35);

    var lampMat = new THREE.MeshBasicMaterial({ color: 0x88ccff });
    var lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lampMat);
    lampHead.position.set(0.8, 1.6, 0.2);
    var benchLight = new THREE.PointLight(0x88ccff, 0.8, 4);
    benchLight.position.set(0.8, 1.6, 0.2);

    grp.add(top, bp, leg1, leg2, leg3, leg4, vise, lampHead, benchLight);
    grp.position.set(x, 0, z);
    scene.add(grp);
    G.colliders.push({ x: x, z: z, hx: 1.3, hz: 0.7, h: 1.6 });

    this.workbench = { grp: grp, x: x, y: 1.1, z: z };
  },

  buildBeacon: function(scene, x, z){
    var grp = new THREE.Group();
    var matSteel = new THREE.MeshLambertMaterial({ color: 0x1c2026 });
    var matPanel = new THREE.MeshLambertMaterial({ color: 0x2d3748 });
    var matAlert = new THREE.MeshBasicMaterial({ color: 0xff2222 });

    var stand = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.6), matSteel);
    stand.position.y = 0.6;
    grp.add(stand);

    var panel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.4, 0.55), matPanel);
    panel.position.set(0, 1.25, 0);
    panel.rotation.x = -0.3;
    grp.add(panel);

    var screen = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.02), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    screen.position.set(-0.18, 1.32, 0.18);
    screen.rotation.x = -0.3;
    grp.add(screen);

    var strobe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 8), matAlert);
    strobe.position.set(0.24, 1.55, -0.05);
    grp.add(strobe);

    var strobeLight = new THREE.PointLight(0xff2222, 0.6, 12);
    strobeLight.position.set(0.24, 1.6, -0.05);
    grp.add(strobeLight);

    grp.position.set(x, 0, z);
    scene.add(grp);
    G.colliders.push({ x: x, z: z, hx: 0.5, hz: 0.4, h: 1.6 });

    this.beacon = {
      grp: grp,
      strobe: strobe,
      light: strobeLight,
      x: x, y: 1.3, z: z,
      active: false,
      phase: 0,
      kills: 0,
      targetKills: 15,
      cooldown: 0
    };
  },

  triggerDistressBeacon: function(){
    if (!this.beacon || this.beacon.active) return;
    if (this.beacon.cooldown > 0){
      HUD.toast('Distress Beacon recharging... (' + Math.ceil(this.beacon.cooldown) + 's)');
      return;
    }
    this.beacon.active = true;
    this.beacon.kills = 0;
    this.beacon.targetKills = 15;
    HUD.radio('CIVIL DEFENSE BEACON', 'EMERGENCY DISTRESS BEACON ACTIVE! Swarm converging on Safehouse! Fortify all barricades!', 8000);
    if (typeof AudioSys !== 'undefined' && AudioSys.airRaidSiren) AudioSys.airRaidSiren();

    if (typeof Enemies !== 'undefined' && Enemies.spawnZombie){
      var angles = [0, Math.PI/2, Math.PI, Math.PI * 1.5];
      for (var i = 0; i < 6; i++){
        var a = angles[i % angles.length] + rand(-0.4, 0.4);
        var dist = rand(22, 34);
        var zx = this.pos.x + Math.sin(a) * dist;
        var zz = this.pos.z + Math.cos(a) * dist;
        var subType = (i === 0) ? 'brute' : (i % 2 === 0 ? 'sprinter' : 'walker');
        var z = Enemies.spawnZombie(zx, zz, subType);
        if (z) z.alerted = true;
      }
    }
  },

  onSiegeEnemyKilled: function(){
    if (!this.beacon || !this.beacon.active) return;
    this.beacon.kills++;
    HUD.toast('💀 SIEGE DEFENSE: [' + this.beacon.kills + '/' + this.beacon.targetKills + ']');
    if (this.beacon.kills >= this.beacon.targetKills){
      this.beacon.active = false;
      this.beacon.cooldown = 180;
      G.player.scrap = (G.player.scrap || 0) + 120;
      if (typeof HUD !== 'undefined' && HUD.updateScrap) HUD.updateScrap(G.player.scrap);
      if (typeof Weapons !== 'undefined'){
        Weapons.state.reserve = Math.max(Weapons.state.reserve, 160);
        HUD.ammo(Weapons.state.mag, Weapons.state.reserve);
        var wpDrop = !Weapons.owned['magnum'] ? 'magnum' : (!Weapons.owned['shotgun'] ? 'shotgun' : null);
        if (wpDrop && Weapons.spawnPickup){
          Weapons.spawnPickup(wpDrop, this.pos.x - 2.5, this.pos.z);
        }
      }
      HUD.radio('VESPERA COMMAND', 'SIEGE VICTORY! Horde repelled. Reward: +120 SCRAP & Supplies replenished!', 9000);
      if (typeof AudioSys !== 'undefined' && AudioSys.workbenchUpgrade) AudioSys.workbenchUpgrade();
    }
  },

  resupplyAmmo: function(){
    if (!this.ammoCache) return;
    if (this.ammoCache.cooldown > 0){
      HUD.toast('Ammo Cache replenishing... (' + Math.ceil(this.ammoCache.cooldown) + 's left)');
      return;
    }
    var maxReserve = 180;
    Weapons.state.reserve = maxReserve;
    HUD.ammo(Weapons.state.mag, Weapons.state.reserve);
    AudioSys.ammoResupply();
    this.ammoCache.cooldown = this.ammoCache.maxCooldown;
    HUD.toast('📦 AMMO CACHE RESUPPLIED! Reserve: ' + maxReserve + ' rounds');
  },

  buyUpgrade: function(upgradeId){
    var up = this.upgrades[upgradeId];
    if (!up) return;
    if (up.installed){
      HUD.toast(up.name + ' already installed!');
      return;
    }
    var scrap = G.player.scrap || 0;
    if (scrap < up.cost){
      HUD.toast('Need ' + up.cost + ' Scrap! (Currently have ' + scrap + ')');
      return;
    }

    G.player.scrap -= up.cost;
    up.installed = true;
    AudioSys.workbenchUpgrade();

    var ak = Weapons.list.ak47;
    if (upgradeId === 'extendedMag'){
      ak.mag = 45; Weapons.state.mag = 45;
      HUD.toast('🔧 EXTENDED MAG INSTALLED: Mag capacity upgraded to 45!');
    } else if (upgradeId === 'compensator'){
      ak.recoil = 0.013; ak.spread = 0.007;
      HUD.toast('🔧 COMPENSATOR INSTALLED: Recoil & spread reduced by 40%!');
    } else if (upgradeId === 'apRounds'){
      ak.dmg = 38;
      HUD.toast('🔧 TUNGSTEN AP ROUNDS: Gun damage boosted to 38 (+35%)!');
    } else if (upgradeId === 'tunedBolt'){
      ak.rate = 0.082;
      HUD.toast('🔧 MATCH BOLT INSTALLED: Cyclic fire rate boosted by 22%!');
    }

    HUD.ammo(Weapons.state.mag, Weapons.state.reserve);
    if (HUD.updateScrap) HUD.updateScrap(G.player.scrap);
    this.refreshWorkbenchUI();
  },

  refreshWorkbenchUI: function(){
    var modal = document.getElementById('workbench-modal');
    if (!modal) return;
    var scrapEl = document.getElementById('wb-scrap-num');
    if (scrapEl) scrapEl.textContent = G.player.scrap || 0;

    var keys = Object.keys(this.upgrades);
    for (var i = 0; i < keys.length; i++){
      var up = this.upgrades[keys[i]];
      var btn = document.getElementById('wb-btn-' + up.id);
      if (btn){
        if (up.installed){
          btn.textContent = 'INSTALLED';
          btn.classList.add('installed');
          btn.disabled = true;
        } else {
          var canAfford = (G.player.scrap || 0) >= up.cost;
          btn.textContent = 'INSTALL (' + up.cost + ' SCRAP)';
          btn.classList.remove('installed');
          btn.disabled = !canAfford;
        }
      }
    }
  },

  openWorkbench: function(){
    var modal = document.getElementById('workbench-modal');
    if (!modal) return;
    this.refreshWorkbenchUI();
    modal.style.display = 'flex';
    document.exitPointerLock && document.exitPointerLock();
  },

  closeWorkbench: function(){
    var modal = document.getElementById('workbench-modal');
    if (modal) modal.style.display = 'none';
    var canvas = document.getElementById('game');
    if (!G.isMobile && canvas) canvas.requestPointerLock().catch(function(){});
  },

  nearestInteraction: function(px, pz){
    // 1. Check Front Doors (Open / Close)
    if (this.door && dist2(px, pz, this.door.x, this.door.z) < 4.2 * 4.2){
      var txt = this.door.isOpen ? 'Press O / E ➔ Close Doors (Hide)' : 'Press O / E ➔ Open Doors';
      return { type: 'door', text: txt };
    }
    // 2. Check Ammo Cache
    if (this.ammoCache && dist2(px, pz, this.ammoCache.x, this.ammoCache.z) < 2.5 * 2.5){
      if (this.ammoCache.cooldown > 0){
        return { type: 'ammo_cooling', text: 'Ammo Cache: Resupplying (' + Math.ceil(this.ammoCache.cooldown) + 's)' };
      }
      return { type: 'ammo', text: 'Press E ➔ Resupply Ammo Cache' };
    }
    // 3. Check Workbench
    if (this.workbench && dist2(px, pz, this.workbench.x, this.workbench.z) < 2.5 * 2.5){
      return { type: 'workbench', text: 'Press E ➔ Open Weapon Upgrade Workbench' };
    }
    // 4. Check Emergency Distress Beacon
    if (this.beacon && dist2(px, pz, this.beacon.x, this.beacon.z) < 2.8 * 2.8){
      if (this.beacon.active){
        return { type: 'beacon_active', text: 'Distress Beacon: Siege in Progress [' + this.beacon.kills + '/' + this.beacon.targetKills + ']' };
      }
      if (this.beacon.cooldown > 0){
        return { type: 'beacon_cooling', text: 'Distress Beacon Recharging (' + Math.ceil(this.beacon.cooldown) + 's)' };
      }
      return { type: 'beacon', text: 'Press E ➔ Activate Distress Beacon (Horde Siege)' };
    }
    // 5. Check Barricades
    for (var i = 0; i < this.barricades.length; i++){
      var b = this.barricades[i];
      if (dist2(px, pz, b.x, b.z) < 2.8 * 2.8){
        if (b.planks < b.maxPlanks){
          return { type: 'barricade', target: b, text: 'Press E ➔ Fortify Barricade (10 Scrap) [' + b.planks + '/' + b.maxPlanks + ']' };
        } else {
          return { type: 'barricade_full', text: 'Window Barricade Intact [4/4 Planks]' };
        }
      }
    }
    return null;
  },

  // Dynamic loader for external 3D House GLB models
  load3DHouse: function(scene){
    var self = this;
    if (typeof THREE.GLTFLoader === 'undefined') return;
    var loader = new THREE.GLTFLoader();

    var candidatePaths = [
      'assets/New folder/house.glb',
      'assets/New folder/safehouse.glb',
      'assets/house.glb',
      'assets/safehouse.glb'
    ];

    function tryLoad(index){
      if (index >= candidatePaths.length) return;
      var path = candidatePaths[index];
      loader.load(path, function(gltf){
        console.log('Vespera: Found and loaded external 3D House GLB from ' + path);
        var model = gltf.scene;
        var box = new THREE.Box3().setFromObject(model);
        var size = box.getSize(new THREE.Vector3());
        var center = box.getCenter(new THREE.Vector3());

        var targetW = 16, targetD = 14;
        var scale = Math.min(targetW / size.x, targetD / size.z);

        var wrapper = new THREE.Group();
        model.position.set(-center.x, -box.min.y, -center.z);
        wrapper.add(model);
        wrapper.scale.set(scale, scale, scale);
        wrapper.position.set(self.pos.x, 0.1, self.pos.z);

        if (self.proceduralExterior){
          self.proceduralExterior.visible = false;
        }
        scene.add(wrapper);
        self.externalModel = wrapper;
      }, undefined, function(){
        tryLoad(index + 1);
      });
    }
    tryLoad(0);
  },

  update: function(dt){
    // Dual Door Swing Interpolation
    if (this.door){
      this.door.angle += (this.door.targetAngle - this.door.angle) * dt * 7.5;
      if (this.door.pivotLeft){
        this.door.pivotLeft.rotation.y = -this.door.angle;
      }
      if (this.door.pivotRight){
        this.door.pivotRight.rotation.y = this.door.angle;
      }
    }

    // Generator pulsation
    if (this.generator){
      this.generator.phase += dt * 5.0;
      var pulse = 0.9 + 0.3 * Math.sin(this.generator.phase);
      if (this.generator.light) this.generator.light.intensity = pulse;
    }

    // Emergency Distress Beacon strobe & cooldown
    if (this.beacon){
      if (this.beacon.cooldown > 0) this.beacon.cooldown -= dt;
      if (this.beacon.active){
        this.beacon.phase += dt * 10.0;
        var strobeOn = Math.sin(this.beacon.phase) > 0.05;
        this.beacon.light.intensity = strobeOn ? 2.5 : 0.2;
        this.beacon.strobe.material.color.setHex(strobeOn ? 0xff2222 : 0x550000);
      } else {
        this.beacon.light.intensity = 0.3;
        this.beacon.strobe.material.color.setHex(this.beacon.cooldown > 0 ? 0x664422 : 0xcc2222);
      }
    }

    // Ammo Cache cooldown
    if (this.ammoCache && this.ammoCache.cooldown > 0){
      this.ammoCache.cooldown -= dt;
      if (this.ammoCache.cooldown <= 0){
        this.ammoCache.cooldown = 0;
        if (this.isPlayerInside()){
          HUD.toast('📦 Safehouse Ammo Cache is ready!');
        }
      }
      if (this.ammoCache.beam){
        this.ammoCache.beam.material.opacity = this.ammoCache.cooldown > 0 ? 0.05 : 0.25;
      }
    }

    // Barricade shake decay
    for (var i = 0; i < this.barricades.length; i++){
      var b = this.barricades[i];
      if (b.shakeTimer > 0){
        b.shakeTimer -= dt;
        var off = Math.sin(b.shakeTimer * 40) * 0.06;
        b.grp.position.x = b.x + off;
      } else {
        b.grp.position.x = b.x;
      }
    }
  }
};
