// Vespera - Dynamic Weather System: Rain, Wet Asphalt Puddles, Thunderstorms & Midnight Fog
var Weather = {
  state: 'CLEAR', // 'CLEAR', 'RAIN', 'THUNDERSTORM', 'MIDNIGHT_FOG'
  rainIntensity: 0, // 0.0 to 1.0
  rainSystem: null,
  rainGeo: null,
  rainPos: null,
  puddles: [],
  ripples: [],
  groundFog: null,
  lightningTimer: 0,
  isFlashing: false,
  flashTimer: 0,

  init: function(scene){
    this.buildRain(scene);
    this.buildPuddles(scene);
    this.buildGroundFog(scene);
  },

  buildRain: function(scene){
    var count = 1100;
    var positions = new Float32Array(count * 6); // 2 vertices per rain line streak
    var spread = 42;

    for (var i = 0; i < count; i++){
      var idx = i * 6;
      var x = rand(-spread, spread);
      var y = rand(0, 30);
      var z = rand(-spread, spread);
      var len = rand(0.6, 1.1);

      // Top vertex
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      // Bottom vertex (angled with wind)
      positions[idx + 3] = x - 0.08;
      positions[idx + 4] = y - len;
      positions[idx + 5] = z - 0.05;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainGeo = geo;
    this.rainPos = positions;

    var mat = new THREE.LineBasicMaterial({
      color: 0xa8c8e8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    var lines = new THREE.LineSegments(geo, mat);
    scene.add(lines);
    this.rainSystem = lines;
  },

  buildPuddles: function(scene){
    var half = World.GRID * World.CELL / 2;
    var puddleMat = new THREE.MeshBasicMaterial({
      color: 0x14181c,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    // Puddles across major street intersections
    for (var i = 1; i < World.GRID; i++){
      for (var j = 1; j < World.GRID; j++){
        if (Math.random() < 0.75){
          var px = -half + i * World.CELL + rand(-4, 4);
          var pz = -half + j * World.CELL + rand(-4, 4);
          var rad = rand(2.2, 4.2);

          var pMesh = new THREE.Mesh(new THREE.CircleGeometry(rad, 16), puddleMat.clone());
          pMesh.rotation.x = -Math.PI / 2;
          pMesh.position.set(px, 0.025, pz);
          scene.add(pMesh);

          this.puddles.push({
            mesh: pMesh,
            x: px, z: pz,
            radius: rad,
            rippleTimer: rand(0, 2)
          });
        }
      }
    }
  },

  buildGroundFog: function(scene){
    // Subtle low-altitude rolling mist planes
    var half = World.GRID * World.CELL / 2;
    var fogMat = new THREE.MeshBasicMaterial({
      color: 0x8898a8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    var grp = new THREE.Group();
    for (var i = 0; i < 12; i++){
      var mist = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), fogMat.clone());
      mist.rotation.x = -Math.PI / 2;
      mist.position.set(rand(-half * 0.8, half * 0.8), 0.8 + rand(0, 1.2), rand(-half * 0.8, half * 0.8));
      grp.add(mist);
    }
    scene.add(grp);
    this.groundFog = { grp: grp, mat: fogMat };
  },

  _ripGeo: null,
  spawnRipple: function(scene, x, z){
    if (this.ripples.length > 24) return;
    if (!this._ripGeo){
      this._ripGeo = new THREE.RingGeometry(0.05, 0.12, 12);
    }
    var ripMat = new THREE.MeshBasicMaterial({
      color: 0x8ab8d8,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var rip = new THREE.Mesh(this._ripGeo, ripMat);
    rip.rotation.x = -Math.PI / 2;
    rip.position.set(x, 0.03, z);
    scene.add(rip);
    this.ripples.push({ mesh: rip, scale: 1.0, alpha: 0.5, maxScale: rand(1.8, 3.2) });
  },

  update: function(dt){
    var hour = G.timeOfDay;

    // 1. Determine dynamic weather state based on day/night cycle
    // Hour schedule:
    // 06:00 - 14:00: Clear morning / noon
    // 14:00 - 18:20: Rain showers building up
    // 18:20 - 22:30: Dusk Thunderstorm escalation
    // 22:30 - 05:00: Midnight Fog survival horror
    // 05:00 - 06:00: Dawn clearing
    var targetRain = 0;
    var targetFogOpacity = 0;

    if (hour >= 14.0 && hour < 18.3){
      this.state = 'RAIN';
      targetRain = 0.55;
    } else if (hour >= 18.3 && hour < 22.5){
      this.state = 'THUNDERSTORM';
      targetRain = 0.95;
    } else if (hour >= 22.5 || hour < 5.0){
      this.state = 'MIDNIGHT_FOG';
      targetRain = 0.15;
      targetFogOpacity = 0.28;
    } else {
      this.state = 'CLEAR';
      targetRain = 0.0;
    }

    // Smooth transition
    this.rainIntensity += (targetRain - this.rainIntensity) * dt * 0.4;

    // 2. Update Rain Particles
    if (this.rainSystem && this.rainPos){
      var op = clamp(this.rainIntensity * 0.7, 0, 0.75);
      this.rainSystem.material.opacity = op;

      if (op > 0.02){
        var camPos = G.camera.position;
        var count = this.rainPos.length / 6;
        var spread = 45;
        var vy = -42 * dt;
        var vx = -5 * dt;
        var vz = -3 * dt;

        var shBounds = (typeof Safehouse !== 'undefined' && Safehouse.bounds) ? Safehouse.bounds : null;
        var playerInside = (typeof Safehouse !== 'undefined' && Safehouse.isPlayerInside) ? Safehouse.isPlayerInside() : false;

        // Muffle rain audio when inside the safehouse
        AudioSys.rainSound(this.rainIntensity * (playerInside ? 0.08 : 0.32));

        for (var i = 0; i < count; i++){
          var idx = i * 6;
          // Apply velocity
          this.rainPos[idx + 1] += vy;
          this.rainPos[idx + 4] += vy;
          this.rainPos[idx] += vx;
          this.rainPos[idx + 3] += vx;
          this.rainPos[idx + 2] += vz;
          this.rainPos[idx + 5] += vz;

          // Determine ground/roof collision plane for this particle
          var px = this.rainPos[idx + 3];
          var pz = this.rainPos[idx + 5];
          var floorY = 0;

          if (shBounds && px >= shBounds.minX - 0.3 && px <= shBounds.maxX + 0.3 && pz >= shBounds.minZ - 0.3 && pz <= shBounds.maxZ + 0.3){
            // Hits the safehouse solid roof at y=4.95, cannot enter the interior!
            floorY = 4.95;
          }

          // If particle drops below ground/roof level, recycle above
          if (this.rainPos[idx + 4] < floorY){
            var rx = camPos.x + rand(-spread, spread);
            var ry = camPos.y + rand(15, 28);
            var rz = camPos.z + rand(-spread, spread);
            var len = rand(0.6, 1.2);

            // If player is inside safehouse, avoid spawning directly inside the room
            if (playerInside && shBounds && rx >= shBounds.minX && rx <= shBounds.maxX && rz >= shBounds.minZ && rz <= shBounds.maxZ){
              ry = 22 + rand(4, 12); // strictly high above roof
            }

            this.rainPos[idx] = rx;
            this.rainPos[idx + 1] = ry;
            this.rainPos[idx + 2] = rz;

            this.rainPos[idx + 3] = rx - 0.08;
            this.rainPos[idx + 4] = ry - len;
            this.rainPos[idx + 5] = rz - 0.05;
          }
        }
        this.rainGeo.attributes.position.needsUpdate = true;
      }
    }

    // 3. Update Puddles & Ripple Rings
    var puddleOp = clamp(this.rainIntensity * 0.65, 0, 0.65);
    if (Math.abs((this._lastPuddleOp || 0) - puddleOp) > 0.01){
      this._lastPuddleOp = puddleOp;
      for (var p = 0; p < this.puddles.length; p++){
        this.puddles[p].mesh.material.opacity = puddleOp;
      }
    }
    for (var p = 0; p < this.puddles.length; p++){
      var pud = this.puddles[p];
      if (this.rainIntensity > 0.25){
        pud.rippleTimer -= dt;
        if (pud.rippleTimer <= 0){
          pud.rippleTimer = rand(0.4, 1.2);
          var rx = pud.x + rand(-pud.radius * 0.7, pud.radius * 0.7);
          var rz = pud.z + rand(-pud.radius * 0.7, pud.radius * 0.7);
          if (dist2(rx, rz, G.camera.position.x, G.camera.position.z) < 32 * 32){
            this.spawnRipple(G.scene, rx, rz);
          }
        }
      }
    }

    // Update active ripples
    for (var r = this.ripples.length - 1; r >= 0; r--){
      var rip = this.ripples[r];
      rip.scale += dt * 3.2;
      rip.alpha -= dt * 0.6;
      rip.mesh.scale.set(rip.scale, rip.scale, 1);
      rip.mesh.material.opacity = Math.max(0, rip.alpha);
      if (rip.alpha <= 0 || rip.scale > rip.maxScale){
        G.scene.remove(rip.mesh);
        if (rip.mesh.material) rip.mesh.material.dispose();
        this.ripples.splice(r, 1);
      }
    }

    // 4. Update Ground Fog
    if (this.groundFog && this.groundFog.grp){
      var time = performance.now() * 0.0004;
      var fogChildren = this.groundFog.grp.children;
      for (var f = 0; f < fogChildren.length; f++){
        var mist = fogChildren[f];
        mist.material.opacity = targetFogOpacity;
        mist.rotation.z = time * (f % 2 === 0 ? 0.3 : -0.3);
      }
    }

    // 5. Thunderstorm Lightning Spikes
    if (this.state === 'THUNDERSTORM'){
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0){
        this.lightningTimer = rand(14, 28);
        this.triggerLightning();
      }
    }

    // Flash decay
    if (this.isFlashing){
      this.flashTimer -= dt;
      if (this.flashTimer <= 0){
        this.isFlashing = false;
        var flashEl = document.getElementById('lightning-flash');
        if (flashEl) flashEl.style.opacity = 0;
      }
    }
  },

  triggerLightning: function(){
    this.isFlashing = true;
    this.flashTimer = 0.12;
    var flashEl = document.getElementById('lightning-flash');
    if (flashEl) flashEl.style.opacity = rand(0.55, 0.85);

    var isClose = Math.random() < 0.45;
    var delay = isClose ? rand(200, 600) : rand(1000, 2200);

    setTimeout(function(){
      AudioSys.thunder(isClose);
    }, delay);
  }
};
