// Vespera - Realistic City Generation: 3D GLTF Photorealistic Buildings, Detailed Asphalt Roads, & Organic Foliage
// Complete Road Rebuild: Continuous asphalt corridors, precision intersection crosswalks & stop lines,
// beveled curbs, perfectly centered 3D modular buildings (buildings.glb & futuristic_building.glb),
// and zero-obstruction driving lanes.

var World = {
  CELL: 64, ROAD: 14, GRID: 7, // 7x7 blocks
  tex: {},
  props: [],
  lamps: [],
  mats: {},
  nightMats: [],
  bldgPrefabs: [],
  futuristicPrefab: null,
  realBuildingsSpawned: false,

  makeTex: function(w, h, fn, repeatX, repeatY){
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeatX) t.repeat.set(repeatX, repeatY || repeatX);
    t.anisotropy = 2;
    return t;
  },

  buildTextures: function(){
    var self = this;

    // 1. Enhanced Asphalt with aggregates, oil patches, and micro-cracks
    this.tex.asphalt = this.makeTex(512, 512, function(g){
      g.fillStyle = '#1e1f22';
      g.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 3500; i++){
        var c = randi(180, 240);
        g.fillStyle = 'rgba(' + c + ',' + c + ',' + c + ',' + rand(0.015, 0.05) + ')';
        g.fillRect(rand(0, 512), rand(0, 512), rand(1, 2.5), rand(1, 2.5));
      }
      for (var i = 0; i < 70; i++){
        g.fillStyle = 'rgba(10, 10, 12,' + rand(0.08, 0.22) + ')';
        g.beginPath();
        g.ellipse(rand(0, 512), rand(0, 512), rand(8, 35), rand(3, 14), rand(0, Math.PI), 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(12, 12, 14, 0.25)';
      g.lineWidth = 1;
      for (var i = 0; i < 12; i++){
        var cx = rand(0, 512), cy = rand(0, 512);
        g.beginPath(); g.moveTo(cx, cy);
        for (var step = 0; step < 5; step++){
          cx += rand(-15, 15); cy += rand(-15, 15);
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
    }, 8, 8);

    // 2. Concrete sidewalk / paving stones
    this.tex.pavement = this.makeTex(256, 256, function(g){
      g.fillStyle = '#7a7d80';
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(40, 40, 42, 0.35)';
      g.lineWidth = 2;
      for (var x = 0; x <= 256; x += 64){
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
        g.beginPath(); g.moveTo(0, x); g.lineTo(256, x); g.stroke();
      }
      for (var i = 0; i < 600; i++){
        g.fillStyle = 'rgba(0, 0, 0,' + rand(0.02, 0.07) + ')';
        g.fillRect(rand(0, 256), rand(0, 256), rand(2, 6), rand(2, 6));
      }
    }, 6, 6);

    // 3. Concrete curb texture
    this.tex.curb = this.makeTex(128, 128, function(g){
      g.fillStyle = '#94989d';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(0,0,0,0.15)';
      g.fillRect(0, 0, 128, 16);
      g.strokeStyle = 'rgba(40,40,40,0.3)';
      g.lineWidth = 2;
      for (var x = 0; x <= 128; x += 32){
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke();
      }
    }, 16, 1);

    // 4. Grass
    this.tex.grass = this.makeTex(256, 256, function(g){
      g.fillStyle = '#3c4e28';
      g.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 1800; i++){
        g.fillStyle = 'rgba(' + randi(45, 85) + ',' + randi(85, 130) + ',' + randi(35, 55) + ',0.55)';
        g.fillRect(rand(0, 256), rand(0, 256), 2, 3);
      }
    }, 5, 5);

    // 5. Road center dashed yellow lines
    this.tex.lane = this.makeTex(64, 64, function(g){
      g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 64, 64);
      g.fillStyle = '#e5c43d'; g.fillRect(0, 16, 64, 14);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 16, 64, 3);
    });
    this.tex.lane.repeat.set(40, 1);

    // 6. Zebra Crosswalk Stripes
    this.tex.crosswalk = this.makeTex(128, 64, function(g){
      g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 128, 64);
      for (var x = 6; x < 128; x += 22){
        g.fillStyle = '#e8ebed';
        g.fillRect(x, 4, 14, 56);
        g.fillStyle = 'rgba(20,20,25,0.15)';
        g.fillRect(x, 22, 14, 20);
      }
    });

    // 7. Stop bar line
    this.tex.stopLine = this.makeTex(64, 32, function(g){
      g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 64, 32);
      g.fillStyle = '#f0f2f5';
      g.fillRect(0, 6, 64, 20);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(0, 12, 64, 6);
    });

    // 8. Cast Iron Sewer Manhole Cover
    this.tex.manhole = this.makeTex(128, 128, function(g){
      g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 128, 128);
      g.fillStyle = '#232528';
      g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a3e44'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = '#18191b'; g.lineWidth = 2;
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 8){
        g.beginPath();
        g.moveTo(64 + Math.cos(a) * 16, 64 + Math.sin(a) * 16);
        g.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52);
        g.stroke();
      }
      g.fillStyle = '#15171a';
      g.beginPath(); g.arc(64, 64, 16, 0, Math.PI * 2); g.fill();
    });

    // 9. Storm Drain Curb Grate
    this.tex.stormDrain = this.makeTex(128, 64, function(g){
      g.fillStyle = '#1c1e20'; g.fillRect(0, 0, 128, 64);
      g.strokeStyle = '#3c4046'; g.lineWidth = 3; g.strokeRect(2, 2, 124, 60);
      g.fillStyle = '#08090a';
      for (var x = 12; x < 118; x += 14){
        g.fillRect(x, 8, 7, 48);
      }
    });

    // 10. Weathered Tree Bark
    this.tex.bark = this.makeTex(128, 256, function(g){
      g.fillStyle = '#423425'; g.fillRect(0, 0, 128, 256);
      for (var i = 0; i < 400; i++){
        g.fillStyle = 'rgba(' + randi(30, 55) + ',' + randi(20, 40) + ',' + randi(12, 25) + ',0.7)';
        g.fillRect(rand(0, 128), rand(0, 256), rand(2, 6), rand(12, 36));
      }
    }, 2, 4);
  },

  build: function(){
    var self = this;
    this.buildTextures();
    var scene = G.scene;
    var span = this.GRID * this.CELL; // 448m total span
    var half = span / 2; // 224m
    var swx = -half + this.CELL / 2 + 3 * this.CELL; // 0 (Safehouse block center)
    var swz = -half + this.CELL / 2 + 3 * this.CELL; // 0

    // 1. Asphalt Ground Plane
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 1.6, span * 1.6),
      new THREE.MeshLambertMaterial({ map: this.tex.asphalt }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0;
    scene.add(ground);

    // Sea & Beach to the east
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(600, span * 1.8),
      new THREE.MeshLambertMaterial({ color: 0x1a333e }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(half + 300, 0.02, 0);
    scene.add(sea);

    var sand = new THREE.Mesh(new THREE.PlaneGeometry(60, span * 1.4),
      new THREE.MeshLambertMaterial({ color: 0x9d8f6e }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(half + 28, 0.01, 0);
    scene.add(sand);

    // Materials
    var matPave = new THREE.MeshLambertMaterial({ map: this.tex.pavement });
    var matCurb = new THREE.MeshLambertMaterial({ map: this.tex.curb });
    var matGrass = new THREE.MeshLambertMaterial({ map: this.tex.grass });
    var matBark = new THREE.MeshLambertMaterial({ map: this.tex.bark });
    var matLeaf1 = new THREE.MeshLambertMaterial({ color: 0x2e4a24 });
    var matLeaf2 = new THREE.MeshLambertMaterial({ color: 0x3d5c2e });
    var matLeaf3 = new THREE.MeshLambertMaterial({ color: 0x486b36 });
    var matConcrete = new THREE.MeshLambertMaterial({ color: 0x8e8e8a });

    // Instanced collectors for maximum 60 FPS WebGL throughput
    var treeList = [];
    var lampList = [];
    var curbNSList = [];
    var curbEWList = [];
    var paveList = [];
    var grassList = [];
    var stormDrainList = [];
    var cwNSList = [];
    var cwEWList = [];
    var stopList = [];
    var mhList = [];

    // 2. Organic Trees (Collected for THREE.InstancedMesh - eliminates 1,168 draw calls)
    function addOrganicTree(x, z, s){
      var treeRad = 2.4 * s;
      if (x >= swx - 8.5 - treeRad && x <= swx + 8.5 + treeRad &&
          z >= swz - 7.5 - treeRad && z <= swz + 7.5 + treeRad + 3.0){
        return;
      }
      treeList.push({
        x: x, z: z, s: s,
        rotBaseX: rand(-0.06, 0.06),
        rotBaseZ: rand(-0.06, 0.06),
        upperOx: rand(-0.15, 0.15) * s,
        upperOz: rand(-0.15, 0.15) * s,
        upperRotZ: rand(-0.12, 0.12),
        f1Ox: rand(-0.5, 0.5) * s, f1Oz: rand(-0.5, 0.5) * s,
        f2Ox: rand(-0.4, 0.4) * s, f2Oz: rand(-0.4, 0.4) * s,
        f3Ox: rand(0.6, 1.1) * s, f3Oz: rand(-0.5, 0.5) * s,
        f4Ox: rand(-1.1, -0.6) * s, f4Oz: rand(-0.5, 0.5) * s
      });
      G.colliders.push({ x: x, z: z, hx: 0.5 * s, hz: 0.5 * s, h: 3.6 * s });
    }

    // 3. Street Lamps (Collected for THREE.InstancedMesh - eliminates 392 draw calls)
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x383c42 });
    var lampMat = new THREE.MeshLambertMaterial({ color: 0x8a7a4a, emissive: 0x000000 });
    this.lampMat = lampMat;

    function addLamp(x, z, rotY){
      var ry = rotY !== undefined ? rotY : (Math.random() < 0.5 ? 0 : Math.PI);
      lampList.push({ x: x, z: z, rotY: ry });
    }

    // 4. Interactive Props (Hydrants, Cones, Dumpsters, Benches)
    var hydrantRed = new THREE.MeshLambertMaterial({ color: 0xb4241c, emissive: 0x220505 });
    var hydrantMetal = new THREE.MeshLambertMaterial({ color: 0x4a4a4c });
    function addHydrant(x, z){
      var grp = new THREE.Group();
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.72, 8), hydrantRed);
      body.position.y = 0.36;
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.19, 0.16, 7), hydrantRed);
      cap.position.y = 0.78;
      var nut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 5), hydrantMetal);
      nut.position.y = 0.88;
      var nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.54, 6), hydrantMetal);
      nozzle.rotation.z = Math.PI / 2; nozzle.position.y = 0.5;
      grp.add(body, cap, nut, nozzle);
      grp.position.set(x, 0, z);
      scene.add(grp);
      World.props.push({
        type: 'hydrant', mesh: grp, cap: cap, nut: nut,
        x: x, y: 0, z: z, radius: 0.38, cracked: false, waterTimer: 0, hissTimer: 0
      });
      G.colliders.push({ x: x, z: z, hx: 0.35, hz: 0.35, h: 0.8 });
    }

    var matDumpster = new THREE.MeshLambertMaterial({ color: 0x2f4f34 });
    var matDumpsterLid = new THREE.MeshLambertMaterial({ color: 0x1f2420 });
    function addDumpster(x, z, rotY){
      var grp = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.25, 1.3), matDumpster);
      body.position.y = 0.68;
      var lid = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.12, 1.36), matDumpsterLid);
      lid.position.set(0, 1.34, 0); lid.rotation.x = -0.08;
      grp.add(body, lid);
      grp.position.set(x, 0, z);
      grp.rotation.y = rotY || 0;
      scene.add(grp);
      G.colliders.push({ x: x, z: z, hx: 1.15, hz: 0.75, h: 1.4 });
    }

    var matBenchWood = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
    var matBenchIron = new THREE.MeshLambertMaterial({ color: 0x222428 });
    function addBench(x, z, rotY){
      var grp = new THREE.Group();
      var seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.45), matBenchWood);
      seat.position.set(0, 0.48, 0);
      var back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.06), matBenchWood);
      back.position.set(0, 0.78, -0.2);
      var legs = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.44, 0.38), matBenchIron);
      legs.position.set(0, 0.22, 0);
      grp.add(seat, back, legs);
      grp.position.set(x, 0, z);
      grp.rotation.y = rotY || 0;
      scene.add(grp);
      G.colliders.push({ x: x, z: z, hx: 1.0, hz: 0.35, h: 0.9 });
    }

    // 5. ROAD REBUILD: Continuous Asphalt Corridors, Markings, & Precision Intersections
    var roadMat = new THREE.MeshLambertMaterial({ map: this.tex.asphalt });
    var laneMat = new THREE.MeshBasicMaterial({ map: this.tex.lane, transparent: true });
    var crosswalkMat = new THREE.MeshBasicMaterial({ map: this.tex.crosswalk, transparent: true, depthWrite: false });
    var stopLineMat = new THREE.MeshBasicMaterial({ map: this.tex.stopLine, transparent: true, depthWrite: false });
    var manholeMat = new THREE.MeshBasicMaterial({ map: this.tex.manhole, transparent: true, depthWrite: false });
    var shoulderMat = new THREE.MeshBasicMaterial({ color: 0xdedede });

    // A. Road Strips along all Avenues (East-West) and Boulevards (North-South)
    for (var i = 0; i <= this.GRID; i++){
      var p = -half + i * this.CELL;

      // Continuous Asphalt Avenues (East-West)
      var ave = new THREE.Mesh(new THREE.PlaneGeometry(span, this.ROAD), roadMat);
      ave.rotation.x = -Math.PI / 2; ave.position.set(0, 0.012, p); scene.add(ave);

      // Continuous Asphalt Boulevards (North-South)
      var blvd = new THREE.Mesh(new THREE.PlaneGeometry(this.ROAD, span), roadMat);
      blvd.rotation.x = -Math.PI / 2; blvd.position.set(p, 0.014, 0); scene.add(blvd);

      // Yellow Center Divider Line (East-West)
      var yLaneE = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.36), laneMat);
      yLaneE.rotation.x = -Math.PI / 2; yLaneE.position.set(0, 0.022, p); scene.add(yLaneE);

      // Yellow Center Divider Line (North-South)
      var yLaneN = new THREE.Mesh(new THREE.PlaneGeometry(0.36, span), laneMat);
      yLaneN.rotation.x = -Math.PI / 2; yLaneN.position.set(p, 0.024, 0); scene.add(yLaneN);

      // White solid shoulder lines along curbs at ±5.8m from road center
      var sh1 = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.16), shoulderMat);
      sh1.rotation.x = -Math.PI / 2; sh1.position.set(0, 0.022, p - 5.8); scene.add(sh1);
      var sh2 = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.16), shoulderMat);
      sh2.rotation.x = -Math.PI / 2; sh2.position.set(0, 0.022, p + 5.8); scene.add(sh2);

      var sh3 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, span), shoulderMat);
      sh3.rotation.x = -Math.PI / 2; sh3.position.set(p - 5.8, 0.024, 0); scene.add(sh3);
      var sh4 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, span), shoulderMat);
      sh4.rotation.x = -Math.PI / 2; sh4.position.set(p + 5.8, 0.024, 0); scene.add(sh4);
    }

    // B. Intersections: Crosswalks, Stop Bars, and Utility Manholes (Batched via InstancedMesh)
    for (var ix = 1; ix < this.GRID; ix++){
      for (var iz = 1; iz < this.GRID; iz++){
        var rx = -half + ix * this.CELL;
        var rz = -half + iz * this.CELL;
        var isNearSea = (ix === this.GRID - 1);

        cwNSList.push({ x: rx, y: 0.026, z: rz - this.ROAD / 2 - 1.8 });
        cwNSList.push({ x: rx, y: 0.026, z: rz + this.ROAD / 2 + 1.8 });
        cwEWList.push({ x: rx - this.ROAD / 2 - 1.8, y: 0.026, z: rz });
        if (!isNearSea){
          cwEWList.push({ x: rx + this.ROAD / 2 + 1.8, y: 0.026, z: rz });
        }
        stopList.push({ x: rx + 3.4, y: 0.027, z: rz - this.ROAD / 2 - 3.8 });
        stopList.push({ x: rx - 3.4, y: 0.027, z: rz + this.ROAD / 2 + 3.8 });
        mhList.push({ x: rx + 2.5, y: 0.028, z: rz + 2.5 });
      }
    }

    // 6. Block Setup: Sidewalks, Curbs & Furniture
    var inner = (this.CELL - this.ROAD) / 2; // 25m
    var swSize = this.CELL - this.ROAD; // 50m x 50m sidewalk block
    var curbH = 0.22, curbThick = 0.32;

    for (var bx = 0; bx < this.GRID; bx++){
      for (var bz = 0; bz < this.GRID; bz++){
        var cx = -half + this.CELL / 2 + bx * this.CELL;
        var cz = -half + this.CELL / 2 + bz * this.CELL;
        var isSeaSide = (bx === this.GRID - 1);
        var isPark = !isSeaSide && (bx === 2 && bz === 3 || bx === 4 && bz === 1);
        var isSafehouseBlock = (bx === 3 && bz === 3);

        if (isPark){
          grassList.push({ x: cx, y: 0.09, z: cz });
        } else {
          paveList.push({ x: cx, y: 0.09, z: cz });
        }

        // Curbs (North, South, East, West)
        curbNSList.push({ x: cx, y: curbH / 2, z: cz - swSize / 2 + curbThick / 2 });
        curbNSList.push({ x: cx, y: curbH / 2, z: cz + swSize / 2 - curbThick / 2 });
        curbEWList.push({ x: cx + swSize / 2 - curbThick / 2, y: curbH / 2, z: cz });
        curbEWList.push({ x: cx - swSize / 2 + curbThick / 2, y: curbH / 2, z: cz });

        // Storm drain
        stormDrainList.push({ x: cx - swSize / 2 + 3.2, y: 0.025, z: cz - swSize / 2 - 0.35 });

        if (isSeaSide){
          if (bz === 3){
            // Landmark Beachside Hotel - replaced with Futuristic Skyscraper once loaded
            G.hotelPos = { x: cx, z: cz };
          } else {
            for (var t = 0; t < 4; t++){
              addOrganicTree(cx + rand(-18, 18), cz + rand(-18, 18), rand(0.95, 1.35));
            }
            addBench(cx + 18, cz - 4, -Math.PI / 2);
            addBench(cx + 18, cz + 4, -Math.PI / 2);
          }
        } else if (isSafehouseBlock){
          G.blockCenters.push({ x: cx, z: cz });
          var yardOffsets = [
            [-18, -16], [18, -16], [-18, 16], [18, 16], [-18, 0], [18, 0]
          ];
          for (var t = 0; t < yardOffsets.length; t++){
            var tx = cx + yardOffsets[t][0] + rand(-1.0, 1.0);
            var tz = cz + yardOffsets[t][1] + rand(-1.0, 1.0);
            addOrganicTree(tx, tz, rand(0.85, 1.15));
          }
          addDumpster(cx - 18, cz - 10, 0);
        } else if (isPark){
          for (var t = 0; t < 9; t++){
            addOrganicTree(cx + rand(-18, 18), cz + rand(-18, 18), rand(0.85, 1.45));
          }
          addBench(cx - 3, cz, 0);
          addBench(cx + 3, cz, Math.PI);
        } else {
          // Store city block coordinates for 3D building generation
          if (!this.cityBlocks) this.cityBlocks = [];
          this.cityBlocks.push({ cx: cx, cz: cz, inner: inner });
          if (Math.random() < 0.6){
            addDumpster(cx - 15, cz - 15, rand(0, Math.PI));
          }
        }

        // Sidewalk perimeter trees (along East & West sidewalk curbs)
        addOrganicTree(cx - 22.5, cz + rand(-14, 14), rand(0.8, 1.1));
        addOrganicTree(cx + 22.5, cz + rand(-14, 14), rand(0.8, 1.1));

        // Streetlamps placed along the sidewalk curbs facing the roadways
        addLamp(cx - 16, cz - 23.4, Math.PI / 2);
        addLamp(cx + 16, cz + 23.4, -Math.PI / 2);

        // Fire hydrant placed along the sidewalk curb
        if (Math.random() < 0.65){
          addHydrant(cx - 20, cz - 23.6);
        }
      }
    }

    // 7. Instant Batch Assembly with THREE.InstancedMesh (60 FPS WebGL Engine)
    var dummy = new THREE.Object3D();

    // Trees (~146 trees collapsed from 1,168 draw calls to 6 draw calls)
    if (treeList.length > 0){
      var nTrees = treeList.length;
      var instBaseTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.44, 2.0, 7), matBark, nTrees);
      var instUpperTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6), matBark, nTrees);
      var instRootFlare = new THREE.InstancedMesh(new THREE.ConeGeometry(0.6, 0.45, 6), matBark, nTrees);

      var geoSphere = new THREE.SphereGeometry(1.0, 7, 6);
      var instLeaf1 = new THREE.InstancedMesh(geoSphere, matLeaf1, nTrees * 2);
      var instLeaf2 = new THREE.InstancedMesh(geoSphere, matLeaf2, nTrees * 2);
      var instLeaf3 = new THREE.InstancedMesh(geoSphere, matLeaf3, nTrees);

      for (var t = 0; t < nTrees; t++){
        var tr = treeList[t];
        var s = tr.s;

        // Base trunk
        dummy.position.set(tr.x, 1.0 * s, tr.z);
        dummy.rotation.set(tr.rotBaseX, 0, tr.rotBaseZ);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        instBaseTrunk.setMatrixAt(t, dummy.matrix);

        // Upper trunk
        dummy.position.set(tr.x + tr.upperOx, 2.9 * s, tr.z + tr.upperOz);
        dummy.rotation.set(0, 0, tr.upperRotZ);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        instUpperTrunk.setMatrixAt(t, dummy.matrix);

        // Root flare
        dummy.position.set(tr.x, 0.2 * s, tr.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        instRootFlare.setMatrixAt(t, dummy.matrix);

        // Foliage 0 (matLeaf1)
        dummy.position.set(tr.x, 3.8 * s, tr.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1.8 * s, 1.8 * 0.85 * s, 1.8 * s);
        dummy.updateMatrix();
        instLeaf1.setMatrixAt(t * 2, dummy.matrix);

        // Foliage 4 (matLeaf1)
        dummy.position.set(tr.x + tr.f4Ox, 4.3 * s, tr.z + tr.f4Oz);
        dummy.scale.set(1.1 * s, 1.1 * 0.85 * s, 1.1 * s);
        dummy.updateMatrix();
        instLeaf1.setMatrixAt(t * 2 + 1, dummy.matrix);

        // Foliage 1 (matLeaf2)
        dummy.position.set(tr.x + tr.f1Ox, 4.6 * s, tr.z + tr.f1Oz);
        dummy.scale.set(1.5 * s, 1.5 * 0.85 * s, 1.5 * s);
        dummy.updateMatrix();
        instLeaf2.setMatrixAt(t * 2, dummy.matrix);

        // Foliage 3 (matLeaf2)
        dummy.position.set(tr.x + tr.f3Ox, 4.2 * s, tr.z + tr.f3Oz);
        dummy.scale.set(1.1 * s, 1.1 * 0.85 * s, 1.1 * s);
        dummy.updateMatrix();
        instLeaf2.setMatrixAt(t * 2 + 1, dummy.matrix);

        // Foliage 2 (matLeaf3)
        dummy.position.set(tr.x + tr.f2Ox, 5.4 * s, tr.z + tr.f2Oz);
        dummy.scale.set(1.2 * s, 1.2 * 0.85 * s, 1.2 * s);
        dummy.updateMatrix();
        instLeaf3.setMatrixAt(t, dummy.matrix);
      }

      instBaseTrunk.instanceMatrix.needsUpdate = true;
      instUpperTrunk.instanceMatrix.needsUpdate = true;
      instRootFlare.instanceMatrix.needsUpdate = true;
      instLeaf1.instanceMatrix.needsUpdate = true;
      instLeaf2.instanceMatrix.needsUpdate = true;
      instLeaf3.instanceMatrix.needsUpdate = true;

      scene.add(instBaseTrunk, instUpperTrunk, instRootFlare, instLeaf1, instLeaf2, instLeaf3);
    }

    // Street Lamps (~98 lamps collapsed from 392 draw calls to 4 draw calls)
    if (lampList.length > 0){
      var nLamps = lampList.length;
      var instPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 5.4, 6), poleMat, nLamps);
      var instArm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), poleMat, nLamps);
      var instHead = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), lampMat, nLamps);

      var poolMat = new THREE.MeshBasicMaterial({
        color: 0xffd277,
        transparent: true,
        opacity: G.isNight ? 0.28 : 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      if (typeof Effects !== 'undefined' && Effects.tex) poolMat.map = Effects.tex;
      this.lampPoolMat = poolMat;
      var instPool = new THREE.InstancedMesh(new THREE.PlaneGeometry(6.8, 6.8), poolMat, nLamps);

      for (var l = 0; l < nLamps; l++){
        var lp = lampList[l];
        var cosY = Math.cos(lp.rotY), sinY = Math.sin(lp.rotY);

        dummy.position.set(lp.x, 2.7, lp.z);
        dummy.rotation.set(0, lp.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instPole.setMatrixAt(l, dummy.matrix);

        dummy.position.set(lp.x + cosY * 0.6, 5.3, lp.z - sinY * 0.6);
        dummy.rotation.set(0, lp.rotY, 0);
        dummy.updateMatrix();
        instArm.setMatrixAt(l, dummy.matrix);

        dummy.position.set(lp.x + cosY * 1.15, 5.2, lp.z - sinY * 1.15);
        dummy.rotation.set(0, lp.rotY, 0);
        dummy.updateMatrix();
        instHead.setMatrixAt(l, dummy.matrix);

        dummy.position.set(lp.x + cosY * 1.15, 0.02, lp.z - sinY * 1.15);
        dummy.rotation.set(-Math.PI / 2, 0, lp.rotY);
        dummy.updateMatrix();
        instPool.setMatrixAt(l, dummy.matrix);
      }

      instPole.instanceMatrix.needsUpdate = true;
      instArm.instanceMatrix.needsUpdate = true;
      instHead.instanceMatrix.needsUpdate = true;
      instPool.instanceMatrix.needsUpdate = true;

      scene.add(instPole, instArm, instHead, instPool);
    }

    // Sidewalks & Curbs (collapsed from 245 draw calls to 5 draw calls)
    if (paveList.length > 0){
      var instPave = new THREE.InstancedMesh(new THREE.BoxGeometry(swSize, 0.18, swSize), matPave, paveList.length);
      for (var p = 0; p < paveList.length; p++){
        dummy.position.set(paveList[p].x, paveList[p].y, paveList[p].z);
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instPave.setMatrixAt(p, dummy.matrix);
      }
      instPave.instanceMatrix.needsUpdate = true;
      scene.add(instPave);
    }
    if (grassList.length > 0){
      var instGrass = new THREE.InstancedMesh(new THREE.BoxGeometry(swSize, 0.18, swSize), matGrass, grassList.length);
      for (var g = 0; g < grassList.length; g++){
        dummy.position.set(grassList[g].x, grassList[g].y, grassList[g].z);
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instGrass.setMatrixAt(g, dummy.matrix);
      }
      instGrass.instanceMatrix.needsUpdate = true;
      scene.add(instGrass);
    }
    if (curbNSList.length > 0){
      var instCurbNS = new THREE.InstancedMesh(new THREE.BoxGeometry(swSize, curbH, curbThick), matCurb, curbNSList.length);
      for (var c = 0; c < curbNSList.length; c++){
        dummy.position.set(curbNSList[c].x, curbNSList[c].y, curbNSList[c].z);
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instCurbNS.setMatrixAt(c, dummy.matrix);
      }
      instCurbNS.instanceMatrix.needsUpdate = true;
      scene.add(instCurbNS);
    }
    if (curbEWList.length > 0){
      var instCurbEW = new THREE.InstancedMesh(new THREE.BoxGeometry(curbThick, curbH, swSize - curbThick * 2), matCurb, curbEWList.length);
      for (var c = 0; c < curbEWList.length; c++){
        dummy.position.set(curbEWList[c].x, curbEWList[c].y, curbEWList[c].z);
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instCurbEW.setMatrixAt(c, dummy.matrix);
      }
      instCurbEW.instanceMatrix.needsUpdate = true;
      scene.add(instCurbEW);
    }
    if (stormDrainList.length > 0){
      var sdMat = new THREE.MeshBasicMaterial({ map: this.tex.stormDrain, depthWrite: false });
      var instStormDrain = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 0.65), sdMat, stormDrainList.length);
      for (var s = 0; s < stormDrainList.length; s++){
        dummy.position.set(stormDrainList[s].x, stormDrainList[s].y, stormDrainList[s].z);
        dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instStormDrain.setMatrixAt(s, dummy.matrix);
      }
      instStormDrain.instanceMatrix.needsUpdate = true;
      scene.add(instStormDrain);
    }

    // Intersections (Crosswalks, Stop Bars, Manholes - collapsed from 252 draw calls to 4 draw calls)
    if (cwNSList.length > 0){
      var instCwNS = new THREE.InstancedMesh(new THREE.PlaneGeometry(11.6, 2.8), crosswalkMat, cwNSList.length);
      for (var c = 0; c < cwNSList.length; c++){
        dummy.position.set(cwNSList[c].x, cwNSList[c].y, cwNSList[c].z);
        dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instCwNS.setMatrixAt(c, dummy.matrix);
      }
      instCwNS.instanceMatrix.needsUpdate = true;
      scene.add(instCwNS);
    }
    if (cwEWList.length > 0){
      var instCwEW = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.8, 11.6), crosswalkMat, cwEWList.length);
      for (var c = 0; c < cwEWList.length; c++){
        dummy.position.set(cwEWList[c].x, cwEWList[c].y, cwEWList[c].z);
        dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instCwEW.setMatrixAt(c, dummy.matrix);
      }
      instCwEW.instanceMatrix.needsUpdate = true;
      scene.add(instCwEW);
    }
    if (stopList.length > 0){
      var instStop = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.6, 0.55), stopLineMat, stopList.length);
      for (var s = 0; s < stopList.length; s++){
        dummy.position.set(stopList[s].x, stopList[s].y, stopList[s].z);
        dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instStop.setMatrixAt(s, dummy.matrix);
      }
      instStop.instanceMatrix.needsUpdate = true;
      scene.add(instStop);
    }
    if (mhList.length > 0){
      var instMh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.2, 1.2), manholeMat, mhList.length);
      for (var m = 0; m < mhList.length; m++){
        dummy.position.set(mhList[m].x, mhList[m].y, mhList[m].z);
        dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        instMh.setMatrixAt(m, dummy.matrix);
      }
      instMh.instanceMatrix.needsUpdate = true;
      scene.add(instMh);
    }

    // Boundary Colliders
    var B = half + this.CELL / 2;
    G.colliders.push(
      { x: -B - 5, z: 0, hx: 5, hz: B + 40, h: 30 },
      { x:  B + 5, z: 0, hx: 5, hz: B + 40, h: 30 },
      { x: 0, z: -B - 5, hx: B + 40, hz: 5, h: 30 },
      { x: 0, z:  B + 5, hx: B + 40, hz: 5, h: 30 }
    );

    // Fog & Player Start
    scene.fog = new THREE.Fog(0xb8b2a4, 60, 260);
    scene.background = new THREE.Color(0xb8b2a4);

    this.startPos = { x: -half + this.CELL, z: -half + this.CELL };
    G.player.pos.x = this.startPos.x;
    G.player.pos.z = this.startPos.z;

    if (typeof Safehouse !== 'undefined'){
      Safehouse.build(scene, swx, swz);
    } else {
      var swh = 5;
      var sface = new THREE.Mesh(new THREE.BoxGeometry(14, swh, 10), matConcrete);
      sface.position.set(swx, swh / 2, swz); scene.add(sface);
    }
    this.safehouse = { x: swx, z: swz };

    // 7. Load Real 3D GLB Buildings Pack (buildings.glb & futuristic_building.glb)
    this.load3DBuildings(scene);
  },

  load3DBuildings: function(scene){
    var self = this;
    if (typeof THREE.GLTFLoader === 'undefined') return;
    var loader = new THREE.GLTFLoader();

    // 1. Load 10 Modular Urban Buildings (buildings.glb by Elbolillo)
    loader.load('assets/New folder/buildings.glb', function(gltf){
      var root = gltf.scene;
      var bNames = [
        'Building_01', 'Building_02', 'Building_03', 'Building_04',
        'Building_05', 'Building_06', 'Building_07', 'Building_08',
        'Building_09', 'Building'
      ];

      self.bldgPrefabs = [];
      bNames.forEach(function(name){
        var node = root.getObjectByName(name);
        if (node){
          // Measure accurate unscaled local dimensions inside an isolated wrapper
          var wrapper = new THREE.Group();
          var testClone = node.clone(true);
          wrapper.add(testClone);
          wrapper.updateMatrixWorld(true);

          var box = new THREE.Box3().setFromObject(wrapper);
          var center = box.getCenter(new THREE.Vector3());
          var minY = box.min.y;
          var size = box.getSize(new THREE.Vector3());

          self.bldgPrefabs.push({
            name: name,
            node: node,
            center: center,
            minY: minY,
            size: size
          });
        }
      });

      console.log('Vespera: Extracted', self.bldgPrefabs.length, 'real 3D building prefabs from buildings.glb');
      self.populateCityWithRealBuildings(scene);
    }, undefined, function(err){
      console.warn('Vespera: Could not load buildings.glb, keeping procedural city', err);
    });

    // 2. Load Landmark Skyscraper (futuristic_building.glb by 3DHaupt)
    loader.load('assets/New folder/futuristic_building.glb', function(gltf){
      var root = gltf.scene;
      var box = new THREE.Box3().setFromObject(root);
      var center = new THREE.Vector3();
      var size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      var pivot = new THREE.Group();
      root.position.set(-center.x, -box.min.y, -center.z);
      pivot.add(root);

      // Place as seaside landmark hotel / grand tower
      if (G.hotelPos){
        pivot.position.set(G.hotelPos.x, 0.18, G.hotelPos.z);
        pivot.scale.set(0.95, 0.95, 0.95);
        scene.add(pivot);
        G.colliders.push({
          x: G.hotelPos.x,
          z: G.hotelPos.z,
          hx: (size.x * 0.95) / 2,
          hz: (size.z * 0.95) / 2,
          h: size.y * 0.95
        });
        console.log('Vespera: Placed Futuristic Skyscraper at hotelPos (', G.hotelPos.x, G.hotelPos.z, ')');
      }
    }, undefined, function(err){
      console.warn('Vespera: Could not load futuristic_building.glb', err);
    });
  },

  populateCityWithRealBuildings: function(scene){
    if (this.bldgPrefabs.length === 0 || !this.cityBlocks || this.realBuildingsSpawned) return;
    this.realBuildingsSpawned = true;

    var self = this;

    // City block is 50m x 50m centered at (cx, cz).
    // Road curb is at cx ± 25m, cz ± 25m.
    // The roadway is outside: [25m, 39m] from block center.
    // We enforce a strict buildable zone: [cx - 18.5m, cx + 18.5m] and [cz - 18.5m, cz + 18.5m].
    // This leaves a guaranteed 6.5m wide pedestrian sidewalk plaza between building walls and the street curb!
    // NO building wall or collider can EVER touch or encroach upon the road or crosswalk!

    for (var b = 0; b < this.cityBlocks.length; b++){
      var block = this.cityBlocks[b];
      var cx = block.cx;
      var cz = block.cz;

      // Select primary building prefab
      var prefabIdx = b % self.bldgPrefabs.length;
      var p = self.bldgPrefabs[prefabIdx];

      var rawW = p.size.x;
      var rawH = p.size.y;
      var rawD = p.size.z;

      // Safe scale: ensure building fits comfortably inside max 28m width and 22m depth
      var maxAllowedW = 28.0;
      var maxAllowedD = 22.0;
      var scale = Math.min(0.0072, maxAllowedW / rawW, maxAllowedD / rawD);

      var bw = rawW * scale;
      var bh = rawH * scale;
      var bd = rawD * scale;

      // Build wrapper + clone with precision local origin centering
      var wrapper = new THREE.Group();
      var clone = p.node.clone(true);
      wrapper.add(clone);
      wrapper.position.set(-p.center.x, -p.minY, -p.center.z);

      var pivot = new THREE.Group();
      pivot.add(wrapper);
      pivot.scale.set(scale, scale, scale);

      // Determine rotation to face adjacent avenue/street
      var rotY = (b % 4 === 0) ? 0 : (b % 4 === 1) ? Math.PI : (b % 4 === 2) ? Math.PI / 2 : -Math.PI / 2;
      pivot.rotation.y = rotY;

      var halfW = (Math.abs(Math.sin(rotY)) > 0.5) ? bd / 2 : bw / 2;
      var halfD = (Math.abs(Math.sin(rotY)) > 0.5) ? bw / 2 : bd / 2;

      // Clamped within 18m of block center
      var maxReach = 18.0;
      var finalX = clamp(cx, cx - maxReach + halfW, cx + maxReach - halfW);
      var finalZ = clamp(cz, cz - maxReach + halfD, cz + maxReach - halfD);

      pivot.position.set(finalX, 0.18, finalZ);

      // Optimize materials and geometries on building hierarchy
      pivot.traverse(function(node){
        if (node.isMesh){
          node.castShadow = false;
          node.receiveShadow = false;
          if (node.geometry && !node.geometry.boundingSphere){
            node.geometry.computeBoundingSphere();
          }
          if (node.material){
            var mats = Array.isArray(node.material) ? node.material : [node.material];
            for (var m = 0; m < mats.length; m++){
              if (mats[m]){
                mats[m].side = THREE.FrontSide;
                mats[m].shadowSide = THREE.FrontSide;
              }
            }
          }
        }
      });
      scene.add(pivot);

      // Exact physical collision box
      G.colliders.push({
        x: finalX,
        z: finalZ,
        hx: halfW,
        hz: halfD,
        h: bh + 0.2
      });

      // Place a secondary storefront/shop on the opposite side of the block for rich urban skyline
      if (bw < 22.0 && bd < 16.0 && (b % 2 === 0)){
        var pSmall = self.bldgPrefabs[(b * 3 + 7) % self.bldgPrefabs.length];
        var sScale = Math.min(0.0068, 18.0 / pSmall.size.x, 13.0 / pSmall.size.z);
        var sW = pSmall.size.x * sScale;
        var sH = pSmall.size.y * sScale;
        var sD = pSmall.size.z * sScale;

        var sWrapper = new THREE.Group();
        var sClone = pSmall.node.clone(true);
        sWrapper.add(sClone);
        sWrapper.position.set(-pSmall.center.x, -pSmall.minY, -pSmall.center.z);

        var sPivot = new THREE.Group();
        sPivot.add(sWrapper);
        sPivot.scale.set(sScale, sScale, sScale);
        var sRotY = rotY + Math.PI;
        sPivot.rotation.y = sRotY;

        var sHalfW = (Math.abs(Math.sin(sRotY)) > 0.5) ? sD / 2 : sW / 2;
        var sHalfD = (Math.abs(Math.sin(sRotY)) > 0.5) ? sW / 2 : sD / 2;

        var sX = cx + (Math.abs(Math.sin(rotY)) > 0.5 ? 0 : (b % 4 === 0 ? 9.5 : -9.5));
        var sZ = cz + (Math.abs(Math.sin(rotY)) > 0.5 ? (b % 4 === 2 ? 9.5 : -9.5) : 0);

        sX = clamp(sX, cx - maxReach + sHalfW, cx + maxReach - sHalfW);
        sZ = clamp(sZ, cz - maxReach + sHalfD, cz + maxReach - sHalfD);

        if (Math.abs(sX - finalX) > (halfW + sHalfW + 1.2) || Math.abs(sZ - finalZ) > (halfD + sHalfD + 1.2)){
          sPivot.position.set(sX, 0.18, sZ);
          sPivot.traverse(function(node){
            if (node.isMesh){
              node.castShadow = false;
              node.receiveShadow = false;
              if (node.geometry && !node.geometry.boundingSphere){
                node.geometry.computeBoundingSphere();
              }
              if (node.material){
                var mats = Array.isArray(node.material) ? node.material : [node.material];
                for (var m = 0; m < mats.length; m++){
                  if (mats[m]){
                    mats[m].side = THREE.FrontSide;
                    mats[m].shadowSide = THREE.FrontSide;
                  }
                }
              }
            }
          });
          scene.add(sPivot);
          G.colliders.push({
            x: sX,
            z: sZ,
            hx: sHalfW,
            hz: sHalfD,
            h: sH + 0.2
          });
        }
      }
    }

    console.log('Vespera: Rebuilt city with 3D buildings and high-performance instancing!');
  },

  setNight: function(night){
    if (this.lampMat && this.lampMat.emissive){
      this.lampMat.emissive.setHex(night ? 0xccaa55 : 0x000000);
    }
    if (this.lampPoolMat){
      this.lampPoolMat.opacity = night ? 0.28 : 0;
    }
  },

  damageProp: function(prop, dir, hitPoint){
    if (prop.type === 'hydrant'){
      if (!prop.cracked){
        prop.cracked = true;
        prop.waterTimer = 60.0;
        if (prop.cap) prop.cap.position.y += 0.35;
        if (prop.nut) prop.nut.position.y += 0.45;
        AudioSys.propImpact(true);
        AudioSys.waterHiss(0.45);
        if (typeof Effects !== 'undefined' && Effects.waterSpray){
          Effects.waterSpray(prop.x, 0.8, prop.z);
        }
        HUD.toast('💧 FIRE HYDRANT CRACKED!');
      }
    } else if (prop.type === 'cone'){
      var fwd = dir ? dir.clone().normalize() : new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
      var spd = rand(10, 16);
      prop.vx = fwd.x * spd;
      prop.vy = rand(4.5, 8.0);
      prop.vz = fwd.z * spd;
      prop.rotVx = rand(-14, 14);
      prop.rotVz = rand(-14, 14);
      prop.hit = true;
      AudioSys.propImpact(false);
    }
  },

  update: function(dt){
    for (var i = 0; i < this.props.length; i++){
      var p = this.props[i];
      if (p.type === 'hydrant' && p.cracked && p.waterTimer > 0){
        p.waterTimer -= dt;
        p.hissTimer -= dt;
        if (typeof Effects !== 'undefined' && Effects.waterSpray){
          Effects.waterSpray(p.x, 0.75, p.z);
        }
        if (p.hissTimer <= 0){
          p.hissTimer = 0.45;
          var d2 = dist2(p.x, p.z, G.player.pos.x, G.player.pos.z);
          if (d2 < 32 * 32){
            var vol = clamp(0.35 - Math.sqrt(d2) * 0.01, 0.05, 0.35);
            AudioSys.waterHiss(vol);
          }
        }
      } else if (p.type === 'cone' && p.hit){
        p.vy -= 18 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.mesh.rotation.x += p.rotVx * dt;
        p.mesh.rotation.z += p.rotVz * dt;
        if (p.y <= 0){
          p.y = 0;
          if (Math.abs(p.vy) > 2.0){
            p.vy = -p.vy * 0.45;
            p.vx *= 0.65;
            p.vz *= 0.65;
          } else {
            p.vy = 0; p.vx = 0; p.vz = 0;
            p.hit = false;
          }
        }
        p.mesh.position.set(p.x, p.y, p.z);
      }
    }

    if (G.isNight && this.lampPoolMat){
      var time = performance.now() * 0.003;
      var flk = Math.sin(time * 8);
      this.lampPoolMat.opacity = (flk > 0.85) ? 0.18 : 0.28;
    }
  }
};
