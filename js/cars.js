// Vespera - cars: all parked cars are enterable, traffic AI, arcade driving.
var _carFwdScratch = new THREE.Vector3();
var _carImpulseScratch = new THREE.Vector3();
var _carColScratch = { x: 0, z: 0 };

var Cars = {
  makes: [
    // sedan-ish shapes: [bodyW, bodyL, cabH, color pool]
    { w:2.0, l:4.4, cab:0.72, colors:[0x7a2e2a,0x2e4a6e,0x8a8a86,0x3c4c3a,0xd8d4c8,0x54555c] },
    { w:2.2, l:5.2, cab:0.8,  colors:[0x1e1e22,0x6e6a60,0x84342c,0x3a4e60] },
    { w:1.9, l:3.8, cab:0.7,  colors:[0xc4b428,0x7a5a2a,0x9aa0a6] }
  ],
  sport: { w:2.1, l:4.6, cab:0.5, colors:[0xb8521e] }, // the burnt-orange supercar "Vespera GT"
  beamTex: null, groundSpot: null, groundSpotTarget: null,
  camMode: 0, // 0: CHASE, 1: CLOSE, 2: HOOD, 3: FAR
  camModes: ['CHASE', 'CLOSE', 'HOOD', 'FAR'],
  _curCamD: 8.5,
  _curCamH: 3.4,
  _curCamTargetH: 1.35,

  cycleCam: function(){
    this.camMode = (this.camMode + 1) % this.camModes.length;
    var name = this.camModes[this.camMode];
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click();
    if (typeof HUD !== 'undefined' && HUD.setCarCamBadge) HUD.setCarCamBadge(name);
    if (typeof HUD !== 'undefined' && HUD.toast) HUD.toast('🎥 CAMERA: ' + name);
    return name;
  },


  makeHeadlightTexture: function(){
    if (this.beamTex) return this.beamTex;
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 512;
    var g = cv.getContext('2d');

    // Dual conical headlight projections onto asphalt
    var gL = g.createRadialGradient(85, 20, 4, 85, 220, 240);
    gL.addColorStop(0, 'rgba(255, 245, 190, 0.75)');
    gL.addColorStop(0.3, 'rgba(255, 230, 150, 0.45)');
    gL.addColorStop(0.7, 'rgba(240, 210, 130, 0.18)');
    gL.addColorStop(1, 'rgba(200, 180, 100, 0)');
    g.fillStyle = gL;
    g.beginPath();
    g.moveTo(70, 0);
    g.lineTo(15, 500);
    g.lineTo(155, 500);
    g.lineTo(100, 0);
    g.closePath();
    g.fill();

    var gR = g.createRadialGradient(171, 20, 4, 171, 220, 240);
    gR.addColorStop(0, 'rgba(255, 245, 190, 0.75)');
    gR.addColorStop(0.3, 'rgba(255, 230, 150, 0.45)');
    gR.addColorStop(0.7, 'rgba(240, 210, 130, 0.18)');
    gR.addColorStop(1, 'rgba(200, 180, 100, 0)');
    g.fillStyle = gR;
    g.beginPath();
    g.moveTo(156, 0);
    g.lineTo(101, 500);
    g.lineTo(241, 500);
    g.lineTo(186, 0);
    g.closePath();
    g.fill();

    this.beamTex = new THREE.CanvasTexture(cv);
    return this.beamTex;
  },

  buildRoadBeam: function(car){
    var tex = this.makeHeadlightTexture();
    var mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var geo = new THREE.PlaneGeometry(6.4, 20.0);
    geo.rotateX(-Math.PI / 2);
    // Position directly in front of the car flat on the road surface (y = 0.02)
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.02, car.hl + 9.8);
    car.mesh.add(mesh);
    car.roadBeam = mesh;
    return mesh;
  },

  setupCarLight: function(){
    if (this.groundSpot) return;
    var spot = new THREE.SpotLight(0xfffae0, 1.4, 22, Math.PI / 4.5, 0.6, 1.4);
    var target = new THREE.Object3D();
    G.scene.add(spot);
    G.scene.add(target);
    spot.target = target;
    this.groundSpot = spot;
    this.groundSpotTarget = target;
  },

  buildMesh: function(spec, color){
    var grp = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ color: color });
    var glass = new THREE.MeshLambertMaterial({ color: 0x2a3540 });
    var wheelM = new THREE.MeshLambertMaterial({ color: 0x141416 });
    // body
    var body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, 0.55, spec.l), mat);
    body.position.y = 0.55; grp.add(body);
    // cabin
    var cab = new THREE.Mesh(new THREE.BoxGeometry(spec.w*0.86, spec.cab, spec.l*0.45), glass);
    cab.position.set(0, 0.55+0.28+spec.cab/2, -spec.l*0.05);
    grp.add(cab);
    // hood/trunk accents
    var hood = new THREE.Mesh(new THREE.BoxGeometry(spec.w*0.94, 0.1, spec.l*0.3), mat);
    hood.position.set(0, 0.85, spec.l*0.3); grp.add(hood);
    // wheels
    var wg = new THREE.CylinderGeometry(0.34,0.34,0.26,8);
    var wheels = [];
    var wx = spec.w/2 - 0.05, wz = spec.l/2 - 0.7;
    [[wx,wz],[-wx,wz],[wx,-wz],[-wx,-wz]].forEach(function(p){
      var w = new THREE.Mesh(wg, wheelM);
      w.rotation.z = Math.PI/2;
      w.position.set(p[0], 0.34, p[1]);
      grp.add(w); wheels.push(w);
    });
    // headlights / taillights
    var hl = new THREE.MeshLambertMaterial({ color:0xd8d0a8, emissive:0x000000 });
    var tl = new THREE.MeshLambertMaterial({ color:0x8a1e1a, emissive:0x000000 });
    [[-spec.w/2+0.3,1],[spec.w/2-0.3,1]].forEach(function(p){
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.14,0.06), hl);
      h.position.set(p[0],0.62,spec.l/2+0.02); grp.add(h);
    });
    [[-spec.w/2+0.3,1],[spec.w/2-0.3,1]].forEach(function(p){
      var t2 = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.14,0.06), tl);
      t2.position.set(p[0],0.62,-spec.l/2-0.02); grp.add(t2);
    });
    grp.userData.wheels = wheels;
    grp.userData.headlights = hl;
    return grp;
  },

  getGroundY: function(x, z){
    if (typeof World === 'undefined' || !World.GRID) return 0;
    var half = World.GRID * World.CELL / 2;
    var rx = ((x + half) % World.CELL + World.CELL) % World.CELL;
    var rz = ((z + half) % World.CELL + World.CELL) % World.CELL;
    var roadHalf = World.ROAD / 2;
    // Inside road corridor (+0.25 margin for smooth curb transitions)
    var onRoadX = (rx < roadHalf + 0.25 || rx > World.CELL - roadHalf - 0.25);
    var onRoadZ = (rz < roadHalf + 0.25 || rz > World.CELL - roadHalf - 0.25);
    return (onRoadX || onRoadZ) ? 0.0 : 0.18;
  },

  spawn: function(spec, color, x, z, rotY, kind){
    var mesh = this.buildMesh(spec, color);
    var y = this.getGroundY(x, z);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY || 0;
    if (kind === 'parked'){
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
    }
    G.scene.add(mesh);
    // Collision bounds (XZ rectangle)
    var hw = spec.w * 0.5;
    var hl = spec.l * 0.5;
    var car = {
      mesh: mesh, spec: spec,
      x:x, y: y, z:z, rotY: rotY||0,
      speed: 0, steer: 0,
      kind: kind,               // 'parked' | 'traffic' | 'sport'
      dirX: 0, dirZ: 0,         // traffic direction
      headlightMat: mesh.userData.headlights,
      // collision box
      hw: hw, hl: hl
    };
    G.cars.push(car);
    return car;
  },

  build: function(){
    var half = World.GRID * World.CELL / 2;
    var start = World.startPos;

    // THE supercar: Mercedes-AMG ONE parallel-parked cleanly curbside on the avenue near player spawn
    var sport = this.spawn(this.sport, 0xb8521e, start.x + 16, start.z + 5.2, Math.PI / 2, 'sport');
    sport.name = 'Mercedes-AMG ONE';
    sport.carType = 'amg';
    sport.maxSpeed = 38; sport.accel = 17; sport.grip = 2.8;
    sport.hw = 1.1; sport.hl = 2.4;
    G.sportCar = sport;

    // THE muscle car: Dodge Challenger SRT Demon parallel-parked along the boulevard curb
    var demon = this.spawn({ w:2.2, l:5.0, cab:0.65 }, 0x18181c, start.x + 28, start.z + 5.2, Math.PI / 2, 'sport');
    demon.name = 'Dodge Challenger SRT Demon';
    demon.carType = 'demon';
    demon.maxSpeed = 34; demon.accel = 20; demon.grip = 1.85;
    demon.hw = 1.1; demon.hl = 2.5;
    G.demonCar = demon;

    // Load authentic 3D GLB vehicle models asynchronously
    this.loadCustomVehicles();

    // High-performance curbside parked cars (~18 cars cleanly distributed along avenues & intersections)
    var curbsideSlots = [
      // Near start / player spawn block
      { x: start.x - 12, z: start.z + 5.2, rot: Math.PI / 2 },
      { x: start.x + 42, z: start.z + 5.2, rot: -Math.PI / 2 },
      { x: start.x + 5.2, z: start.z + 24, rot: 0 },
      // Near safehouse block (3, 3)
      { x: -16, z: -26.4, rot: Math.PI / 2 },
      { x: 18, z: -26.4, rot: -Math.PI / 2 },
      { x: -26.4, z: 12, rot: 0 },
      { x: 26.4, z: -14, rot: Math.PI },
      // Avenue 1
      { x: -half + 1 * World.CELL + 14, z: -half + 2 * World.CELL - 5.8, rot: Math.PI / 2 },
      { x: -half + 2 * World.CELL - 14, z: -half + 2 * World.CELL + 5.8, rot: -Math.PI / 2 },
      // Avenue 2
      { x: -half + 4 * World.CELL + 10, z: -half + 4 * World.CELL - 5.8, rot: Math.PI / 2 },
      { x: -half + 5 * World.CELL - 10, z: -half + 4 * World.CELL + 5.8, rot: -Math.PI / 2 },
      // Boulevard 1
      { x: -half + 2 * World.CELL - 5.8, z: -half + 4 * World.CELL + 12, rot: 0 },
      { x: -half + 2 * World.CELL + 5.8, z: -half + 5 * World.CELL - 12, rot: Math.PI },
      // Boulevard 2
      { x: -half + 5 * World.CELL - 5.8, z: -half + 2 * World.CELL + 14, rot: 0 },
      { x: -half + 5 * World.CELL + 5.8, z: -half + 3 * World.CELL - 14, rot: Math.PI },
      // Park side
      { x: -half + 2 * World.CELL + 18, z: -half + 3 * World.CELL - 26.4, rot: Math.PI / 2 },
      { x: -half + 4 * World.CELL - 18, z: -half + 1 * World.CELL + 26.4, rot: -Math.PI / 2 },
      // Commercial district
      { x: -half + 3 * World.CELL + 22, z: -half + 5 * World.CELL - 5.8, rot: Math.PI / 2 }
    ];

    for (var k = 0; k < curbsideSlots.length; k++){
      var slot = curbsideSlots[k];
      var mk = pick(this.makes);
      this.spawn(mk, pick(mk.colors), slot.x, slot.z, slot.rot, 'parked');
    }

    // Traffic cars on interior roadways (continuous throughways, unobstructed by buildings)
    for (var i = 0; i < 7; i++){
      var mk3 = pick(this.makes);
      var horiz = Math.random() < 0.5;
      var gridLine = randi(1, World.GRID - 2);
      var laneP = -half + gridLine * World.CELL + (Math.random() < 0.5 ? -3.5 : 3.5);
      var along = rand(-half + 32, half - 32);
      var car = this.spawn(mk3, pick(mk3.colors), horiz ? along : laneP, horiz ? laneP : along, horiz ? 0 : Math.PI / 2, 'traffic');
      car.maxSpeed = rand(9, 14); car.accel = 5; car.grip = 2;
      car.dirX = horiz ? (laneP < 0 ? 1 : -1) * 0 : 0;
      car.axis = horiz ? 'x' : 'z';
      car.dirSign = Math.random() < 0.5 ? 1 : -1;
    }
  },

  loadCustomVehicles: function(){
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) return;
    var loader = new THREE.GLTFLoader();

    function tuneMercedesMaterials(model){
      model.traverse(function(node){
        if (!node.isMesh) return;
        // Strip costly shadow map computations (directional light does not use shadow maps)
        node.castShadow = false;
        node.receiveShadow = false;

        // Precompute bounding sphere and bounding box so Three.js frustum culling
        // NEVER has to compute them on the CPU during active render frames
        if (node.geometry){
          if (!node.geometry.boundingSphere) node.geometry.computeBoundingSphere();
          if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
        }

        var nodeName = (node.name || '').toLowerCase();
        // Hide completely occluded high-poly interior and engine geometry:
        // Inside the closed carbon chassis behind the dark-tinted canopy glass,
        // these parts waste ~28,700 triangles and 6 draw calls with zero visual visibility
        if (nodeName.indexOf('interior') !== -1 || nodeName.indexOf('engine') !== -1){
          if (nodeName.indexOf('carbon_043') !== -1 || nodeName.indexOf('details_mat_016') !== -1 ||
              nodeName.indexOf('carbon_042') !== -1 || nodeName.indexOf('details_int1') !== -1 ||
              nodeName.indexOf('engine') !== -1){
            node.visible = false;
            return;
          }
        }

        var mats = Array.isArray(node.material) ? node.material : [node.material];
        for (var i = 0; i < mats.length; i++){
          var m = mats[i];
          if (!m) continue;

          // Single-sided front rendering: Cuts GPU polygon rasterization and shading load in half (from 255k to 127k faces)
          m.side = THREE.FrontSide;
          m.shadowSide = THREE.FrontSide;

          var name = (m.name || '').toLowerCase();
          if (name.indexOf('carpaint') !== -1){
            // High-grade Mercedes AMG Liquid Metal Silver / Iridium Metallic finish (crisp daylight silver, vibrant and bright)
            m.map = null; // Strip the inverted micro-carbon / watermark pattern
            m.color.setHex(0xd0d5da); // Crisp Brilliant Silver Metallic
            m.roughness = 0.22;
            m.metalness = 0.52;
          } else if (name.indexOf('carbon') !== -1){
            // Stealth aero carbon on dorsal shark fin, roof scoop, rear wing & diffuser
            m.color.setHex(0x222226);
            m.roughness = 0.45;
            m.metalness = 0.25;
          } else if (name.indexOf('tire') !== -1 && name.indexOf('hub') === -1 && name.indexOf('brake') === -1 && name.indexOf('disk') === -1){
            // Matte performance tire rubber
            m.color.setHex(0x1c1c1e);
            m.roughness = 0.9;
            m.metalness = 0.05;
          } else if (name.indexOf('hub') !== -1){
            // AMG forged alloy gunmetal rims
            m.color.setHex(0x383c44);
            m.roughness = 0.32;
            m.metalness = 0.75;
          } else if (name.indexOf('brake') !== -1){
            // Performance brake calipers: Iconic Petronas F1 Cyan
            m.color.setHex(0x00d2be);
            m.roughness = 0.3;
            m.metalness = 0.4;
          } else if (name.indexOf('disk') !== -1){
            // Carbon-ceramic brake rotors
            m.color.setHex(0x56585c);
            m.roughness = 0.5;
            m.metalness = 0.6;
          } else if (name.indexOf('glass') !== -1){
            // Tinted hypercar cockpit canopy
            m.transparent = true;
            m.opacity = 0.58;
            m.color.setHex(0x161c28);
            m.roughness = 0.08;
            m.metalness = 0.15;
            m.depthWrite = true;
          } else if (name.indexOf('light') !== -1){
            // Crystal headlight & taillight lenses
            m.color.setHex(0xffffff);
            m.roughness = 0.1;
            m.metalness = 0.2;
          } else {
            if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.6);
            if (m.roughness !== undefined) m.roughness = Math.max(0.25, m.roughness);
          }
          m.needsUpdate = true;
        }
      });
    }

    function tuneDodgeMaterials(model){
      model.traverse(function(node){
        if (!node.isMesh) return;
        node.castShadow = false;
        node.receiveShadow = false;
        if (node.geometry){
          if (!node.geometry.boundingSphere) node.geometry.computeBoundingSphere();
          if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
        }
        var mats = Array.isArray(node.material) ? node.material : [node.material];
        for (var i = 0; i < mats.length; i++){
          var m = mats[i];
          if (!m) continue;
          m.side = THREE.FrontSide;
          m.shadowSide = THREE.FrontSide;
          var name = (m.name || '').toLowerCase();
          if (name.indexOf('paint') !== -1){
            // Glossy TorRed Demon Red
            m.color.setHex(0xb8181a);
            m.roughness = 0.22;
            m.metalness = 0.35;
          } else if (name.indexOf('wheel') !== -1){
            m.color.setHex(0x18181a);
            m.roughness = 0.35;
            m.metalness = 0.7;
          } else if (name.indexOf('window') !== -1 || name.indexOf('glass') !== -1){
            m.transparent = true;
            m.opacity = 0.55;
            m.color.setHex(0x101014);
            m.depthWrite = true;
          } else {
            if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.65);
            if (m.roughness !== undefined) m.roughness = Math.max(0.2, m.roughness);
          }
          m.needsUpdate = true;
        }
      });
    }

    // 1. Mercedes-Benz AMG ONE (Supercar Vespera GT replacement)
    loader.load('assets/vehicles/mercedes-benz_amg_one.glb', function(gltf){
      if (!G.sportCar) return;
      var car = G.sportCar;
      var model = gltf.scene;

      // Compensate for FBX 0.01 centimeter unit scale; restore 1:1 real-world meter proportions
      model.scale.set(100, 100, 100);
      model.updateMatrixWorld(true);

      tuneMercedesMaterials(model);

      var wheels = [];
      var frontWheels = [];
      model.traverse(function(node){
        var n = (node.name || '').toLowerCase();
        if (n === 'amgprojone_tire' || n === 'amgprojone_tire.003' || n === 'amgprojone_tire.001' || n === 'amgprojone_tire.002'){
          wheels.push(node);
          if (n === 'amgprojone_tire' || n === 'amgprojone_tire.003'){
            frontWheels.push(node);
          }
        }
      });

      // Freeze static node matrices so Three.js doesn't recalculate 100+ matrices every frame
      model.traverse(function(node){
        var isWheel = wheels.indexOf(node) !== -1 || frontWheels.indexOf(node) !== -1;
        var p = node.parent;
        while (p && p !== model && !isWheel){
          if (wheels.indexOf(p) !== -1 || frontWheels.indexOf(p) !== -1) isWheel = true;
          p = p.parent;
        }
        if (!isWheel && node !== model){
          node.updateMatrix();
          node.matrixAutoUpdate = false;
        }
      });

      var bbox = new THREE.Box3().setFromObject(model);
      var center = bbox.getCenter(new THREE.Vector3());
      var minY = bbox.min.y;

      var carRoot = new THREE.Group();
      // Center horizontally and place bottom of tires flat on pavement (+0.035 flush offset)
      model.position.set(-center.x, -minY + 0.035, -center.z);
      carRoot.add(model);

      var oldMesh = car.mesh;
      var curY = Cars.getGroundY(car.x, car.z);
      car.y = curY;
      carRoot.position.set(car.x, curY, car.z);
      carRoot.rotation.y = car.rotY;

      carRoot.userData.wheels = wheels;
      carRoot.userData.frontWheels = frontWheels;

      if (car.roadBeam && oldMesh){
        oldMesh.remove(car.roadBeam);
        carRoot.add(car.roadBeam);
      }

      if (oldMesh){
        oldMesh.traverse(function(child){
          if (child.geometry && child.geometry.dispose) child.geometry.dispose();
          if (child.material){
            var mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(function(m){ if (m && m.dispose) m.dispose(); });
          }
        });
      }

      G.scene.remove(oldMesh);
      G.scene.add(carRoot);

      car.mesh = carRoot;
      car.name = 'Mercedes-AMG ONE';
      car.carType = 'amg';
      car.maxSpeed = 38;
      car.accel = 17;
      car.grip = 2.8;
      car.hw = 1.1;
      car.hl = 2.4;

      if (G.player.inCar === car && !car.roadBeam){
        Cars.buildRoadBeam(car);
        if (car.roadBeam) car.roadBeam.visible = !!G.isNight;
      }

      // Pre-compile shaders and upload textures into GPU VRAM immediately during load time.
      // This completely eliminates the first-look render spike / shader compilation freeze!
      if (G.renderer && G.scene && G.camera){
        try {
          G.renderer.compile(G.scene, G.camera);
        } catch(e){
          console.warn('[VESPERA] Shader precompile warning:', e);
        }
      }

      console.log('[VESPERA] Mercedes-Benz AMG ONE mounted at real-world scale (4.77m x 2.18m) [Optimized].');
    }, undefined, function(err){
      console.warn('[VESPERA] Could not load Mercedes-Benz AMG ONE GLB:', err);
    });

    // 2. 2018 Dodge Challenger SRT Demon (Downtown Muscle Car)
    loader.load('assets/vehicles/2018_dodge_challenger_srt_demon.glb', function(gltf){
      if (!G.demonCar) return;
      var car = G.demonCar;
      var model = gltf.scene;

      // Compensate for FBX 0.01 centimeter unit scale; restore 1:1 real-world meter proportions
      model.scale.set(100, 100, 100);
      model.updateMatrixWorld(true);

      tuneDodgeMaterials(model);

      var wheels = [];
      var frontWheels = [];
      var wheelParents = [];
      model.traverse(function(node){
        var n = (node.name || '').toLowerCase();
        if (n.indexOf('3dwheel') !== -1 && (n.indexOf('front') !== -1 || n.indexOf('rear') !== -1)){
          wheelParents.push(node);
          wheels.push(node);
          if (n.indexOf('front') !== -1){
            frontWheels.push(node);
          }
        }
      });

      // Merge 474 wheel child meshes into 4 clean wheel meshes (1 per wheel)
      if (typeof THREE.BufferGeometryUtils !== 'undefined' && THREE.BufferGeometryUtils.mergeBufferGeometries){
        for (var w = 0; w < wheelParents.length; w++){
          var wp = wheelParents[w];
          wp.updateMatrixWorld(true);
          var wpInv = new THREE.Matrix4().copy(wp.matrixWorld).invert();
          var childMeshes = [];
          wp.traverse(function(child){
            if (child.isMesh && child.geometry) childMeshes.push(child);
          });
          if (childMeshes.length > 1){
            var geos = [];
            var commonMat = childMeshes[0].material;
            for (var c = 0; c < childMeshes.length; c++){
              var cm = childMeshes[c];
              cm.updateMatrixWorld(true);
              var localMat = new THREE.Matrix4().multiplyMatrices(wpInv, cm.matrixWorld);
              var cloneGeo = cm.geometry.clone();
              cloneGeo.applyMatrix4(localMat);
              if (!cloneGeo.attributes.normal) cloneGeo.computeVertexNormals();
              geos.push(cloneGeo);
            }
            try {
              var mergedGeo = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false);
              if (mergedGeo){
                while (wp.children.length > 0) wp.remove(wp.children[0]);
                var singleWheelMesh = new THREE.Mesh(mergedGeo, commonMat);
                singleWheelMesh.castShadow = false;
                singleWheelMesh.receiveShadow = false;
                wp.add(singleWheelMesh);
              }
            } catch(e){}
          }
        }

        // Merge ~120 static body meshes into single meshes grouped by material
        model.updateMatrixWorld(true);
        var modelInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
        var bodyMeshesByMat = new Map();
        model.traverse(function(node){
          if (!node.isMesh || !node.geometry) return;
          var p = node.parent;
          var inWheel = false;
          while (p && p !== model){
            if (wheelParents.indexOf(p) !== -1 || wheels.indexOf(p) !== -1){ inWheel = true; break; }
            p = p.parent;
          }
          if (inWheel) return;
          var mat = node.material;
          if (!bodyMeshesByMat.has(mat)) bodyMeshesByMat.set(mat, []);
          bodyMeshesByMat.get(mat).push(node);
        });

        bodyMeshesByMat.forEach(function(meshList, mat){
          if (meshList.length > 1){
            var geos = [];
            for (var m = 0; m < meshList.length; m++){
              var bm = meshList[m];
              bm.updateMatrixWorld(true);
              var localMat = new THREE.Matrix4().multiplyMatrices(modelInv, bm.matrixWorld);
              var cloneGeo = bm.geometry.clone();
              cloneGeo.applyMatrix4(localMat);
              if (!cloneGeo.attributes.normal) cloneGeo.computeVertexNormals();
              geos.push(cloneGeo);
            }
            try {
              var mergedGeo = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false);
              if (mergedGeo){
                for (var m = 0; m < meshList.length; m++){
                  if (meshList[m].parent) meshList[m].parent.remove(meshList[m]);
                }
                var singleBodyMesh = new THREE.Mesh(mergedGeo, mat);
                singleBodyMesh.castShadow = false;
                singleBodyMesh.receiveShadow = false;
                model.add(singleBodyMesh);
              }
            } catch(e){}
          }
        });
      }

      // Freeze static node matrices for Dodge (500+ nodes collapsed)
      model.traverse(function(node){
        var isWheel = wheels.indexOf(node) !== -1 || frontWheels.indexOf(node) !== -1;
        var p = node.parent;
        while (p && p !== model && !isWheel){
          if (wheels.indexOf(p) !== -1 || frontWheels.indexOf(p) !== -1) isWheel = true;
          p = p.parent;
        }
        if (!isWheel && node !== model){
          node.updateMatrix();
          node.matrixAutoUpdate = false;
        }
      });

      var bbox = new THREE.Box3().setFromObject(model);
      var center = bbox.getCenter(new THREE.Vector3());
      var minY = bbox.min.y;

      var carRoot = new THREE.Group();
      // Center horizontally and place bottom of tires flat on pavement (+0.03 flush offset)
      model.position.set(-center.x, -minY + 0.03, -center.z);
      carRoot.add(model);

      var oldMesh = car.mesh;
      var curY = Cars.getGroundY(car.x, car.z);
      car.y = curY;
      carRoot.position.set(car.x, curY, car.z);
      carRoot.rotation.y = car.rotY;

      carRoot.userData.wheels = wheels;
      carRoot.userData.frontWheels = frontWheels;

      if (car.roadBeam && oldMesh){
        oldMesh.remove(car.roadBeam);
        carRoot.add(car.roadBeam);
      }

      if (oldMesh){
        oldMesh.traverse(function(child){
          if (child.geometry && child.geometry.dispose) child.geometry.dispose();
          if (child.material){
            var mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(function(m){ if (m && m.dispose) m.dispose(); });
          }
        });
      }

      G.scene.remove(oldMesh);
      G.scene.add(carRoot);

      car.mesh = carRoot;
      car.name = 'Dodge Challenger SRT Demon';
      car.carType = 'demon';
      car.maxSpeed = 34;
      car.accel = 20;
      car.grip = 1.85;
      car.hw = 1.1;
      car.hl = 2.5;

      if (G.player.inCar === car && !car.roadBeam){
        Cars.buildRoadBeam(car);
        if (car.roadBeam) car.roadBeam.visible = !!G.isNight;
      }

      if (G.renderer && G.scene && G.camera){
        try {
          G.renderer.compile(G.scene, G.camera);
        } catch(e){}
      }

      console.log('[VESPERA] 2018 Dodge Challenger SRT Demon mounted at real-world scale (5.02m x 2.19m) [Optimized].');
    }, undefined, function(err){
      console.warn('[VESPERA] Could not load Dodge Challenger GLB:', err);
    });
  },

  // Check car-to-car collision (XZ AABB rotated)
  checkCarCollision: function(car, nx, nz){
    _carColScratch.x = nx;
    _carColScratch.z = nz;
    var cw = car.hw || 1.0, cl = car.hl || 2.2;
    var maxR = cw + cl + 3.2;
    var maxR2 = maxR * maxR;
    var cars = G.cars;
    if (!cars) return _carColScratch;
    var len = cars.length;

    for (var i=0;i<len;i++){
      var other = cars[i];
      if (other === car) continue;
      // Only check against solid cars (parked, traffic, sport, player)
      if (other.kind !== 'parked' && other.kind !== 'traffic' && other.kind !== 'sport' && other.kind !== 'player') continue;
      // Fast distance check BEFORE trig calculations:
      var dx = nx - other.x, dz = nz - other.z;
      if (dx*dx + dz*dz > maxR2) continue;

      var ow = other.hw || 1.0, ol = other.hl || 2.2;
      var ocos = Math.cos(other.rotY), osin = Math.sin(other.rotY);
      // Transform to other car's local space
      var lx = dx * ocos + dz * osin;
      var lz = -dx * osin + dz * ocos;
      if (Math.abs(lx) < cw + ow && Math.abs(lz) < cl + ol){
        // Collision - push out along shortest axis
        var overlapX = (cw + ow) - Math.abs(lx);
        var overlapZ = (cl + ol) - Math.abs(lz);
        if (overlapX < overlapZ){
          // Push along X
          var pushX = (lx >= 0 ? overlapX : -overlapX);
          nx += pushX * ocos;
          nz += pushX * osin;
        } else {
          // Push along Z
          var pushZ = (lz >= 0 ? overlapZ : -overlapZ);
          nx -= pushZ * osin;
          nz += pushZ * ocos;
        }
        // Slow down significantly
        car.speed *= 0.3;
      }
    }
    _carColScratch.x = nx;
    _carColScratch.z = nz;
    return _carColScratch;
  },
  nearestEnterable: function(px,pz){
    var best=null, bd=4.8*4.8;
    for (var i=0;i<G.cars.length;i++){
      var c=G.cars[i];
      var d = dist2(px,pz,c.x,c.z);
      if (d<bd){ bd=d; best=c; }
    }
    return best;
  },

  update: function(dt){
    // traffic AI: drive along axis, turn around at edges, brake for player ahead
    for (var i=0;i<G.cars.length;i++){
      var c = G.cars[i];
      if (c === G.player.inCar) continue;
      if (c.kind === 'traffic'){
        var tx = c.x + (c.axis==='x'? c.dirSign:0);
        var tz = c.z + (c.axis==='z'? c.dirSign:0);
        // steer target
        var targetRot = c.axis==='x' ? (c.dirSign>0? Math.PI/2 : -Math.PI/2) : (c.dirSign>0? 0 : Math.PI);
        var half = World.GRID*World.CELL/2 - 6;
        var pos = c.axis==='x'? c.x : c.z;
        if (pos > half) { c.dirSign=-1; } else if (pos < -half) { c.dirSign=1; }
        // brake if player or enemy on road ahead
        var ahead = 6 + c.speed;
        var px=G.player.pos.x, pz=G.player.pos.z;
        var dxp = px-c.x, dzp = pz-c.z;
        var fwdX = Math.sin(targetRot), fwdZ = Math.cos(targetRot);
        var proj = dxp*fwdX + dzp*fwdZ, side = Math.abs(dxp*fwdZ - dzp*fwdX);
        var braking = (proj>2 && proj<ahead && side<2.5);
        var targetSpeed = braking ? 0 : c.maxSpeed;
        c.speed += clamp(targetSpeed - c.speed, -20*dt, c.accel*dt);
        // move along axis
        var nx = c.x, nz = c.z;
        if (c.axis==='x'){ nx += fwdX*c.speed*dt; } else { nz += fwdZ*c.speed*dt; }
        // car-to-car collision for traffic
        var cc = this.checkCarCollision(c, nx, nz);
        c.x = cc.x; c.z = cc.z;
        c.y = this.getGroundY(c.x, c.z);
        c.rotY = targetRot;
        c.mesh.position.set(c.x, c.y, c.z);
        c.mesh.rotation.y = c.rotY;
      } else if (c.kind === 'parked'){
        // idle
      }
    }
    // player driving physics
    var pc = G.player.inCar;
    if (pc) this.updateDriving(pc, dt);
  },

  // --- TRANSMISSION & SPEED LIMITS SPECIFICATION ---
  gearLimits: [7.5, 13.5, 19.5, 25.5, 31.5, 38.0], // m/s (1: ~17mph, 2: ~30mph, 3: ~44mph, 4: ~57mph, 5: ~71mph, 6: ~85mph)
  gearRatios: [3.90, 2.35, 1.65, 1.25, 1.00, 0.82],

  getGearLimit: function(g){
    if (g === 'R') return 10.0;
    if (g === 'N') return 0.0;
    if (typeof g === 'number' && g >= 1 && g <= 6) return this.gearLimits[g - 1];
    return 38.0;
  },

  toggleGearLock: function(){
    var c = G.player.inCar;
    if (!c) return;
    if (c.gear === undefined) c.gear = 1;
    c.gearLocked = !c.gearLocked;
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.28, c.gearLocked ? 1900 : 1200, 0.035);
    var limitMph = Math.round(this.getGearLimit(c.gear) * 2.237);
    var label = c.gearLocked ? ('🔒 GEAR ' + c.gear + ' LOCKED (MAX ' + limitMph + ' MPH)') : '🔓 AUTO TRANSMISSION (UNLOCKED)';
    if (typeof HUD !== 'undefined' && HUD.toast) HUD.toast(label);
  },

  shiftUp: function(){
    var c = G.player.inCar;
    if (!c) return;
    if (c.gear === undefined) c.gear = 1;
    var g = c.gear;
    if (g === 'R'){ c.gear = 'N'; }
    else if (g === 'N'){ c.gear = 1; }
    else if (typeof g === 'number' && g < 6){
      c.gear = g + 1;
      c.rpm = Math.max(2600, (c.rpm || 3000) * 0.68);
    }
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.22, 1700, 0.035);
    var limitMph = Math.round(this.getGearLimit(c.gear) * 2.237);
    if (typeof HUD !== 'undefined' && HUD.toast) HUD.toast('TRANSMISSION: GEAR ' + c.gear + (c.gearLocked ? ' [LOCKED MAX ' + limitMph + ' MPH]' : ''));
  },

  shiftDown: function(){
    var c = G.player.inCar;
    if (!c) return;
    if (c.gear === undefined) c.gear = 1;
    var g = c.gear;
    if (g === 1){
      if (Math.abs(c.speed) < 3.0) c.gear = 'N';
    } else if (g === 'N'){
      if (Math.abs(c.speed) < 3.0) c.gear = 'R';
    } else if (typeof g === 'number' && g > 1){
      c.gear = g - 1;
      c.rpm = Math.min(8400, (c.rpm || 3000) * 1.32);
    }
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.22, 1100, 0.035);
    var limitMph = Math.round(this.getGearLimit(c.gear) * 2.237);
    if (typeof HUD !== 'undefined' && HUD.toast) HUD.toast('TRANSMISSION: GEAR ' + c.gear + (c.gearLocked ? ' [LOCKED MAX ' + limitMph + ' MPH]' : ''));
  },

  lastBackfireTime: 0,
  backfirePop: function(){
    var now = performance.now();
    if (now - this.lastBackfireTime < 110) return;
    this.lastBackfireTime = now;
    if (typeof AudioSys !== 'undefined' && AudioSys.ctx){
      try {
        var ctx = AudioSys.ctx;
        if (ctx.state === 'suspended') ctx.resume();
        var t = ctx.currentTime;
        var buf = AudioSys.noiseBuf;
        if (buf){
          var src = ctx.createBufferSource();
          src.buffer = buf;
          var bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1250 + Math.random() * 450, t);
          bp.Q.value = 1.4;
          var g = ctx.createGain();
          g.gain.setValueAtTime(0.38, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
          src.connect(bp);
          bp.connect(g);
          g.connect(AudioSys.master || ctx.destination);
          src.start(t);
        }
      } catch(e){}
    }
  },

  updateDriving: function(c, dt){
    var fwd = ((typeof G.isActionDown === 'function' ? G.isActionDown('forward') : (G.keys['KeyW']||G.keys['ArrowUp'])) || G.touch.moveZ<-0.3) ? 1 : 0;
    var back = ((typeof G.isActionDown === 'function' ? G.isActionDown('backward') : (G.keys['KeyS']||G.keys['ArrowDown'])) || G.touch.moveZ>0.3) ? 1 : 0;
    var left = ((typeof G.isActionDown === 'function' ? G.isActionDown('left') : (G.keys['KeyA']||G.keys['ArrowLeft'])) || G.touch.moveX<-0.3) ? 1 : 0;
    var right = ((typeof G.isActionDown === 'function' ? G.isActionDown('right') : (G.keys['KeyD']||G.keys['ArrowRight'])) || G.touch.moveX>0.3) ? 1 : 0;

    var stageKey = (typeof G.isActionDown === 'function') ? G.isActionDown('stageRev') : !!G.keys['KeyZ'];
    var handbrake = !!((typeof G.isActionDown === 'function' ? G.isActionDown('jump') : G.keys['Space']) || G.keys['KeyB']);

    // Initialize car state properties if absent
    if (c.gear === undefined) c.gear = 1;
    if (c.gearLocked === undefined) c.gearLocked = false;
    if (c.rpm === undefined) c.rpm = 950;
    if (c.boost === undefined) c.boost = 0.0;
    if (c.tripKm === undefined) c.tripKm = 0.0;
    if (c.gForce === undefined) c.gForce = 0.0;
    c.isLimiter = false;

    // Mouse-based steering (consume accumulated mouse X delta)
    var mouseSteer = 0;
    if (G.player.carSteerX){
      mouseSteer = clamp(-G.player.carSteerX * 0.0035, -1, 1);
      G.player.carSteerX = 0;
    }

    var baseMaxS = c.maxSpeed || 38;
    var maxS = baseMaxS;
    var acc = c.accel || 17;

    // Accelerate / Staging Rev Button:
    // "Accelerate means a handbrake that needs to throttle the vehicle but not move.
    // The speed meter needs to get up without showing the speed, the meter only."
    var isStaging = stageKey || (handbrake && fwd && Math.abs(c.speed) < 3.0);

    if (isStaging){
      c.isStaging = true;
      c.speed = 0; // Completely stationary!

      // Engine revs up violently toward redline
      var targetRpm = 8350 + (Math.sin(performance.now() * 0.04) * 280);
      c.rpm += (targetRpm - c.rpm) * Math.min(1.0, dt * 15.0);
      c.boost += (2.45 - c.boost) * Math.min(1.0, dt * 7.5);

      if (c.rpm >= 7900){
        c.isLimiter = true;
      }

      // Continuous staging burnout tire smoke
      if (Effects && Effects.tireSmoke){
        var backX = c.x - Math.sin(c.rotY) * (c.hl * 0.75), backZ = c.z - Math.cos(c.rotY) * (c.hl * 0.75);
        var rX = -Math.cos(c.rotY) * (c.hw * 0.65), rZ = Math.sin(c.rotY) * (c.hw * 0.65);
        Effects.tireSmoke(backX + rX, 0.1, backZ + rZ);
        Effects.tireSmoke(backX - rX, 0.1, backZ - rZ);
      }
      c._wasStaging = true;
    } else {
      c.isStaging = false;
      // Launch control dump on staging release
      if (c._wasStaging){
        if (c.rpm > 5500){
          c.speed = (c.gear === 'R') ? -7.5 : 8.5;
          if (AudioSys && AudioSys.tireScreech) AudioSys.tireScreech();
          if (typeof HUD !== 'undefined' && HUD.toast) HUD.toast('🚀 LAUNCH CONTROL RELEASE!');
        }
        c._wasStaging = false;
      }

      // Automatic transmission logic when gear is UNLOCKED
      if (!c.gearLocked){
        if (back && c.speed <= 0.35){
          // Stopped or rolling backwards: shift to reverse
          c.gear = 'R';
        } else if (fwd && c.speed >= -0.35){
          // Stopped or rolling forwards: shift to gear 1
          if (c.gear === 'R' || c.gear === 'N') c.gear = 1;
        } else if (!fwd && !back && Math.abs(c.speed) < 0.2){
          // Standstill idle: keep in gear 1 ready to launch
          if (c.gear === 'N') c.gear = 1;
        }

        if (typeof c.gear === 'number'){
          // Upshift when RPM exceeds 7900
          if (fwd && c.rpm >= 7900 && c.gear < 6){
            c.gear++;
            c.rpm = 5100;
          }
          // Downshift when speed drops below downshift threshold
          if (c.gear > 1){
            var downshiftThreshold = this.gearLimits[c.gear - 2] * 0.82;
            if (Math.abs(c.speed) < downshiftThreshold){
              c.gear--;
              c.rpm = 5600;
            }
          }
        }
      }

      // Enforce Gear Speed Limits
      var currentLimit = this.getGearLimit(c.gear);
      var effectiveLimit = Math.min(baseMaxS, currentLimit);

      if (c.gear === 'N'){
        // Neutral: Free rev, coast down to complete stop
        if (c.speed > 0) c.speed = Math.max(0, c.speed - 5.5 * dt);
        else if (c.speed < 0) c.speed = Math.min(0, c.speed + 5.5 * dt);
        if (Math.abs(c.speed) < 0.2) c.speed = 0;

        var targetRpm = fwd ? (7800 + Math.sin(performance.now() * 0.03) * 200) : 950;
        c.rpm += (targetRpm - c.rpm) * Math.min(1.0, dt * 11.0);
        c.boost += ((fwd ? 1.5 : 0) - c.boost) * dt * 5.0;
        if (c.rpm >= 7800){ c.isLimiter = true; }
      } else if (c.gear === 'R'){
        // Reverse Gear
        if (back){
          c.speed -= acc * 0.85 * dt;
          var rRatio = Math.min(1.0, Math.abs(c.speed) / effectiveLimit);
          var targetRpm = 1400 + rRatio * 6800;
          c.rpm += (targetRpm - c.rpm) * Math.min(1.0, dt * 10.0);
          if (Math.abs(c.speed) >= effectiveLimit * 0.98){
            c.isLimiter = true;
          }
        } else if (fwd){
          // Active service brake while moving in reverse
          c.speed = Math.min(0, c.speed + 22.0 * dt);
          c.rpm = Math.max(950, c.rpm - 8000 * dt);
          if (c.speed >= -0.2 && !c.gearLocked){
            c.gear = 1;
            c.speed = 0;
          }
        } else {
          // Coasting deceleration in reverse
          c.speed = Math.min(0, c.speed + 8.0 * dt);
          if (Math.abs(c.speed) < 0.2) c.speed = 0;
          c.rpm += (950 - c.rpm) * Math.min(1.0, dt * 6.0);
        }

        c.speed = clamp(c.speed, -effectiveLimit, 0);
      } else {
        // Forward Gears (1 to 6)
        var gearIdx = (typeof c.gear === 'number' ? c.gear : 1) - 1;
        var ratio = this.gearRatios[gearIdx] || 1.0;
        var torqueMult = 0.85 + (ratio * 0.40); // Punchy launch torque

        if (fwd){
          // Acceleration
          if (c.speed >= effectiveLimit){
            c.speed = effectiveLimit;
            c.isLimiter = true;
            c.rpm = 8000;
          } else {
            c.speed += acc * torqueMult * dt;
            if (c.speed > effectiveLimit) c.speed = effectiveLimit;
            var speedRatio = clamp(c.speed / effectiveLimit, 0, 1.0);
            var targetRpm = 1400 + (speedRatio * 6600);
            c.rpm += (targetRpm - c.rpm) * Math.min(1.0, dt * 12.0);
          }
        } else if (back){
          // Active service braking
          c.speed = Math.max(0, c.speed - 24.0 * dt);
          c.rpm = Math.max(950, c.rpm - 7500 * dt);
          if (c.speed <= 0.2){
            c.speed = 0;
            if (!c.gearLocked){
              // Natural transition to Reverse when held
              c.gear = 'R';
            }
          }
        } else {
          // Engine braking & natural rolling drag when releasing throttle (W key)
          var coastDecel = 8.5; // m/s^2 natural deceleration
          if (c.speed > 0){
            c.speed = Math.max(0, c.speed - coastDecel * dt);
          } else if (c.speed < 0){
            c.speed = Math.min(0, c.speed + coastDecel * dt);
          }
          if (Math.abs(c.speed) < 0.25) c.speed = 0;

          var speedRatio = clamp(c.speed / effectiveLimit, 0, 1.0);
          var targetRpm = Math.max(950, 950 + speedRatio * 2200);
          c.rpm += (targetRpm - c.rpm) * Math.min(1.0, dt * 6.0);
        }

        c.speed = clamp(c.speed, 0, effectiveLimit);
      }

      // Handbrake drift & high-friction stopping
      if (handbrake){
        if (c.speed > 0) c.speed = Math.max(0, c.speed - 26.0 * dt);
        else if (c.speed < 0) c.speed = Math.min(0, c.speed + 26.0 * dt);
        if (Math.abs(c.speed) < 0.25) c.speed = 0;

        if (Math.abs(c.speed) > 4.5){
          if (AudioSys && AudioSys.tireScreech) AudioSys.tireScreech();
          if (Effects && Effects.tireSmoke){
            var backX = c.x - Math.sin(c.rotY) * (c.hl * 0.75), backZ = c.z - Math.cos(c.rotY) * (c.hl * 0.75);
            var rX = -Math.cos(c.rotY) * (c.hw * 0.65), rZ = Math.sin(c.rotY) * (c.hw * 0.65);
            Effects.tireSmoke(backX + rX, 0.1, backZ + rZ);
            Effects.tireSmoke(backX - rX, 0.1, backZ - rZ);
          }
        }
      }

      // Turbo boost simulation
      var targetBoost = (fwd && c.gear !== 'N') ? (0.35 + (c.rpm / 9000) * 1.85) : 0;
      c.boost += (targetBoost - c.boost) * dt * 6.0;

      // Odometer & G-Force
      c.tripKm += (Math.abs(c.speed) / 1000) * dt;
      var targetG = (fwd ? 0.65 : 0) - (back ? 1.05 : 0);
      c.gForce += (targetG - c.gForce) * dt * 5.0;
    }
    var kbdTurn = (left?1:0) - (right?1:0);
    var totalTurn = kbdTurn + mouseSteer;
    if (Math.abs(c.speed) > 0.5){
      // Combine WASD + mouse steering
      var steerRate = 1.8 * clamp(Math.abs(c.speed)/8, 0, 1) * (c.speed<0?-1:1);
      if (handbrake && Math.abs(c.speed) > 5.5) steerRate *= 1.85; // slide out rear!
      c.rotY += totalTurn * steerRate * dt;
    }
    var fx = Math.sin(c.rotY), fz = Math.cos(c.rotY);
    var nx = c.x + fx*c.speed*dt, nz = c.z + fz*c.speed*dt;
    // walls: heavy stop
    var hit = collideWorld(nx, nz, 1.6);
    if (hit.hit){
      if (Math.abs(c.speed) > 10){ G.player.health -= Math.abs(c.speed)*0.6; HUD.flashDamage(); AudioSys.hurt(); }
      c.speed *= -0.3;
      nx = hit.x; nz = hit.z;
    }
    // car-to-car collision
    var cc = this.checkCarCollision(c, nx, nz);
    nx = cc.x; nz = cc.z;
    c.x = nx; c.z = nz;
    var targetY = this.getGroundY(c.x, c.z);
    c.y = (c.y !== undefined ? c.y : targetY) + (targetY - (c.y !== undefined ? c.y : targetY)) * Math.min(1, 15 * dt);
    c.mesh.position.set(c.x, c.y, c.z);
    c.mesh.rotation.y = c.rotY;

    // wheel spin
    var spin = c.speed*dt*2.2;
    var wheels = (c.mesh && c.mesh.userData) ? c.mesh.userData.wheels : null;
    if (wheels && wheels.length){
      for (var w=0; w<wheels.length; w++) wheels[w].rotation.x += spin;
    }
    // front wheel steering
    var frontWheels = (c.mesh && c.mesh.userData) ? c.mesh.userData.frontWheels : null;
    if (frontWheels && frontWheels.length){
      var targetSteer = clamp(totalTurn * 0.48, -0.52, 0.52);
      c.steerAngle = (c.steerAngle || 0) + (targetSteer - (c.steerAngle || 0)) * Math.min(1, 12 * dt);
      for (var fw=0; fw<frontWheels.length; fw++){
        if (frontWheels[fw].userData.baseRotY === undefined){
          frontWheels[fw].userData.baseRotY = frontWheels[fw].rotation.y;
        }
        frontWheels[fw].rotation.y = frontWheels[fw].userData.baseRotY + c.steerAngle;
      }
    }

    // Headlights project onto the road surface
    var isNight = !!G.isNight;
    if (c.roadBeam){
      c.roadBeam.visible = isNight;
    }
    if (this.groundSpot && this.groundSpotTarget){
      this.groundSpot.visible = isNight;
      if (isNight){
        this.groundSpot.position.set(c.x + fx * (c.hl - 0.2), (c.y || 0) + 0.85, c.z + fz * (c.hl - 0.2));
        this.groundSpotTarget.position.set(c.x + fx * (c.hl + 9.0), (c.y || 0), c.z + fz * (c.hl + 9.0));
      }
    }
    if (c.headlightMat && c.headlightMat.emissive){
      c.headlightMat.emissive.setHex(isNight ? 0xffea88 : 0x000000);
    }

    // Ramming interactive props (fire hydrants, traffic cones)
    if (typeof World !== 'undefined' && World.props && Math.abs(c.speed) > 4.5){
      _carFwdScratch.set(fx, 0, fz);
      for (var pi = 0; pi < World.props.length; pi++){
        var pr = World.props[pi];
        var pdist2 = dist2(c.x, c.z, pr.x, pr.z);
        var colR = (c.hw + (pr.radius || 0.35) + 0.45);
        if (pdist2 < colR * colR){
          World.damageProp(pr, _carFwdScratch);
          if (pr.type === 'hydrant'){
            c.speed *= 0.85;
          }
        }
      }
    }

    // Vehicular roadkill physics & kinetic impact
    var spd = Math.abs(c.speed);
    if (spd > 5.5){
      _carFwdScratch.set(fx, 0, fz);
      for (var e = 0; e < G.enemies.length; e++){
        var en = G.enemies[e];
        if (en.dead) continue;
        if (dist2(en.x, en.z, c.x, c.z) < 5.8){
          var dmg = spd * (en.subType === 'brute' ? 8 : 14);
          en.health -= dmg;

          // Roadkill audio crunch
          if (AudioSys.roadkillCrunch) AudioSys.roadkillCrunch(spd / 16);

          // Kinetic launch vector (flung forward and upward over the hood)
          var impulse = _carImpulseScratch.copy(_carFwdScratch).multiplyScalar(c.speed * 0.9);
          impulse.y = 3.2 + spd * 0.22;
          impulse.x += rand(-2.5, 2.5);
          impulse.z += rand(-2.5, 2.5);

          // Kinetic resistance on car
          if (en.subType === 'brute'){
            c.speed *= 0.68;
            HUD.flashDamage();
            if (spd > 18){ G.player.health -= 8; AudioSys.hurt(); }
          } else {
            c.speed *= 0.94;
          }

          if (en.health <= 0){
            Enemies.kill(en, true, impulse);
            HUD.toast('🚗 ROADKILL! (+50 PTS)');
          } else {
            en.x += fx * 1.8;
            en.z += fz * 1.8;
            if (Effects && Effects.blood) Effects.blood(en.x, 0.8, en.z, false);
          }
        }
      }
    }
    // engine sound (dynamic dual-engine profile: F1 Hybrid V6 vs Supercharged HEMI V8)
    var cType = c.carType || ((c === G.demonCar || (c.name && c.name.toLowerCase().includes('demon'))) ? 'demon' : 'amg');
    var normalizedRpm = clamp(((c.rpm || 950) - 950) / (8500 - 950), 0, 1.0);
    AudioSys.engineUpdate(normalizedRpm, true, cType, c.speed);
        // --- DYNAMIC MULTI-VIEW IN-CAR CAMERA SYSTEM ---
    var mode = this.camMode || 0;
    var targetCamD = 8.5, targetCamH = 3.4, targetH = 1.35, targetFov = 70;
    var isHood = false;

    if (mode === 0){ // 0: CHASE (Dynamic chase with speed offset)
      targetCamD = 8.2 + clamp(Math.abs(c.speed)/maxS, 0, 1) * 1.8;
      targetCamH = 3.3;
      targetH = 1.35;
      targetFov = 70 + clamp(Math.abs(c.speed)/maxS, 0, 1) * 12;
    } else if (mode === 1){ // 1: CLOSE (Aggressive street-level close chase)
      targetCamD = 5.2;
      targetCamH = 2.0;
      targetH = 1.15;
      targetFov = 74 + clamp(Math.abs(c.speed)/maxS, 0, 1) * 8;
    } else if (mode === 2){ // 2: HOOD / COCKPIT (First-person behind windshield)
      isHood = true;
      targetCamD = 0;
      targetCamH = 1.18;
      targetH = 1.05;
      targetFov = 76 + clamp(Math.abs(c.speed)/maxS, 0, 1) * 14;
    } else if (mode === 3){ // 3: FAR (Tactical high-angle urban overview)
      targetCamD = 13.5;
      targetCamH = 6.0;
      targetH = 1.5;
      targetFov = 68 + clamp(Math.abs(c.speed)/maxS, 0, 1) * 10;
    }

    // Smooth camera lerp transitions
    var lerpSpeed = Math.min(1.0, dt * 9.0);
    this._curCamD = (this._curCamD !== undefined) ? this._curCamD + (targetCamD - this._curCamD) * lerpSpeed : targetCamD;
    this._curCamH = (this._curCamH !== undefined) ? this._curCamH + (targetCamH - this._curCamH) * lerpSpeed : targetCamH;
    this._curCamTargetH = (this._curCamTargetH !== undefined) ? this._curCamTargetH + (targetH - this._curCamTargetH) * lerpSpeed : targetH;

    var carY = c.y || 0;
    var pitchOff = (G.player.carCamPitch || 0) * (isHood ? 2.5 : 4.0);

    if (isHood){
      // Sits directly on hood / windshield looking forward
      var fx = Math.sin(c.rotY), fz = Math.cos(c.rotY);
      var cx = c.x + fx * 0.45;
      var cz = c.z + fz * 0.45;
      var cy = carY + this._curCamH;
      var lookYaw = c.rotY + (G.player.carCamYaw || 0);
      var lx = cx + Math.sin(lookYaw) * 30.0;
      var lz = cz + Math.cos(lookYaw) * 30.0;
      var ly = cy + pitchOff;
      G.camera.position.set(cx, cy, cz);
      G.camera.lookAt(lx, ly, lz);
    } else {
      // Chase cameras orbiting behind the car with forward horizon aim alignment
      var camYaw = c.rotY + (G.player.carCamYaw || 0);
      var cfx = Math.sin(camYaw), cfz = Math.cos(camYaw);
      var cx = c.x - cfx * this._curCamD;
      var cz = c.z - cfz * this._curCamD;
      var cy = Math.max(carY + 0.6, carY + this._curCamH + pitchOff);
      G.camera.position.set(cx, cy, cz);
      var lx = c.x + cfx * 25.0;
      var lz = c.z + cfz * 25.0;
      var ly = carY + this._curCamTargetH + (G.player.carCamPitch || 0) * 8.0;
      G.camera.lookAt(lx, ly, lz);
    }

    var eyeH = (typeof Player !== 'undefined' && Player.eyeH) ? Player.eyeH : 1.7;
    G.player.pos.x = c.x; G.player.pos.y = carY + eyeH; G.player.pos.z = c.z;

    // Gently auto-center camera behind car when cruising straight, but pause when aiming or firing
    var now = performance.now();
    var isAiming = !!G.aimDownSights;
    var isFiring = !!(G.mouseDown || G.keys['KeyX'] || (G.touch && G.touch.fire));
    var recentlyFired = (c.lastDriveByFireTime && (now - c.lastDriveByFireTime < 1800));

    if (!isAiming && !isFiring && !recentlyFired){
      if (Math.abs(c.speed) > 3.0 && Math.abs(G.player.carCamYaw || 0) > 0.001){
        G.player.carCamYaw = (G.player.carCamYaw || 0) * 0.965;
        G.player.carCamPitch = (G.player.carCamPitch || 0) * 0.965;
      }
    }

    // Dynamic FOV update with Drive-by ADS Zoom
    if (isAiming) targetFov = Math.max(50, targetFov - 14);
    G.camera.fov = targetFov;
    G.camera.updateProjectionMatrix();

    // Forward rich telemetry to in-car instrument cluster HUD
    if (typeof HUD !== 'undefined' && HUD.updateCar){
      HUD.updateCar(c, dt, {
        speed: c.speed,
        rpm: c.rpm || 950,
        gear: c.gear,
        gearLocked: !!c.gearLocked,
        isStaging: !!c.isStaging,
        boost: c.boost || 0,
        throttle: fwd,
        brake: back,
        handbrake: handbrake,
        isLimiter: !!c.isLimiter,
        tripKm: c.tripKm || 0,
        gForce: c.gForce || 0,
        health: (c.health !== undefined ? c.health : 100),
        maxHealth: c.maxHealth || 100
      });
    }
  },

  enter: function(car){
    G.player.inCar = car;
    car.kind = 'player';
    G.player.carCamYaw = 0;
    G.player.carCamPitch = 0;
    G.player.carSteerX = 0;
    this._curCamD = 8.5;
    this._curCamH = 3.4;
    this._curCamTargetH = 1.35;
    if (car.gear === undefined || car.gear === 'N') car.gear = 1;
    if (car.rpm === undefined) car.rpm = 950;
    if (car.speed === undefined) car.speed = 0;
    car.gearLocked = false;
    car.isStaging = false;

    // Immediately snap camera behind vehicle to prevent 0/NaN lerp freeze
    var carY = this.getGroundY(car.x, car.z) || 0;
    var cfx = Math.sin(car.rotY), cfz = Math.cos(car.rotY);
    var cx = car.x - cfx * this._curCamD;
    var cz = car.z - cfz * this._curCamD;
    var cy = Math.max(carY + 0.6, carY + this._curCamH);
    if (G.camera){
      G.camera.position.set(cx, cy, cz);
      G.camera.lookAt(car.x, carY + this._curCamTargetH, car.z);
      G.camera.fov = 70;
      G.camera.updateProjectionMatrix();
    }

    var cType = car.carType || ((car === G.demonCar || (car.name && car.name.toLowerCase().includes('demon'))) ? 'demon' : 'amg');
    if (typeof AudioSys !== 'undefined' && AudioSys.engineStart) AudioSys.engineStart(cType);

    // Attach road headlight projection beam onto the asphalt
    if (!car.roadBeam){
      this.buildRoadBeam(car);
    }
    this.setupCarLight();

    // Sync headlights & road beam according to current time of day
    var isNight = !!G.isNight;
    if (car.roadBeam) car.roadBeam.visible = isNight;
    if (this.groundSpot) this.groundSpot.visible = isNight;
    if (car.headlightMat && car.headlightMat.emissive){
      car.headlightMat.emissive.setHex(isNight ? 0xffea88 : 0x000000);
    }

    // Hide weapon viewmodel + arms + crosshair
    if (typeof Weapons !== 'undefined' && Weapons.setVisible) Weapons.setVisible(false);
    if (typeof Weapons !== 'undefined' && Weapons.state && Weapons.state.model && G.camera && Weapons.state.model.parent === G.camera){
      G.camera.remove(Weapons.state.model);
    }
    if (typeof HUD !== 'undefined' && HUD.enterCar) HUD.enterCar(car);
    // Hide player character (we're inside the car now)
    if (typeof PlayerCharacter !== 'undefined' && PlayerCharacter.hide) PlayerCharacter.hide();
    if (typeof HUD !== 'undefined' && HUD.toast) HUD.toast('🚗 ' + (car.name || 'Vehicle').toUpperCase());
    if (typeof HUD !== 'undefined' && HUD.hint) HUD.hint('Press E to exit — [W/S] Drive, [LMB] Drive-by Fire, [RMB] Aim, [R] Reload, [1-3] Weapon');
  },
  exit: function(){
    var c = G.player.inCar;
    if (!c) return;
    if (typeof AudioSys !== 'undefined' && AudioSys.engineStop) AudioSys.engineStop();
    if (c.roadBeam) c.roadBeam.visible = false;
    if (this.groundSpot) this.groundSpot.visible = false;
    if (c.headlightMat && c.headlightMat.emissive) c.headlightMat.emissive.setHex(0x000000);
    // place player beside car
    var fx = Math.sin(c.rotY), fz = Math.cos(c.rotY);
    var px = c.x - fz*2.2, pz = c.z + fx*2.2;
    var hit = collideWorld(px, pz, 0.4);
    G.player.pos.x = hit.x; G.player.pos.z = hit.z;
    G.player.pos.y = Player.eyeH + (this.getGroundY(hit.x, hit.z) || 0);
    G.player.yaw = c.rotY + Math.PI;
    G.player.pitch = 0;
    G.player.inCar = null;
    G.player.carSteerX = 0;
    G.player.carCamYaw = 0;
    G.player.carCamPitch = 0;
    c.kind = 'parked';
    c.speed = 0;
    if (G.camera){
      G.camera.fov = 70;
      G.camera.updateProjectionMatrix();
    }
    // Restore weapon viewmodel + crosshair
    if (typeof Weapons !== 'undefined' && Weapons.setVisible) Weapons.setVisible(true);
    if (typeof HUD !== 'undefined' && HUD.exitCar) HUD.exitCar();
    // Restore player character
    if (typeof PlayerCharacter !== 'undefined' && PlayerCharacter.show) PlayerCharacter.show();
    if (typeof HUD !== 'undefined' && HUD.hint) HUD.hint(null);
  }
};
