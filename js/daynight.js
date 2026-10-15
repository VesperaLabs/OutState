// Vespera - day/night cycle: sun, sky, fog, and the dusk threat switch.
var DayNight = {
  // keyframed by hour: [hour, skyColor, fogColor, sunIntensity, ambient, fogNear, fogFar]
  keys: [
    [0,   0x080f1a, 0x070d16, 0.08, 0.18, 20, 150],
    [5,   0x0d1422, 0x0b111c, 0.10, 0.20, 24, 160],
    [6.5, 0x7d4e32, 0x623e2a, 0.50, 0.52, 35, 210],
    [8,   0x9aa4ac, 0xa8a49a, 0.85, 0.75, 60, 260],
    [12,  0xaeb6ba, 0xb8b2a4, 1.0,  0.85, 70, 300],
    [17,  0x9aa2a8, 0xa8a094, 0.85, 0.75, 60, 260],
    [19,  0x8a4a24, 0x6e361c, 0.45, 0.46, 35, 200],
    [20.5,0x101624, 0x0c121e, 0.12, 0.22, 22, 160],
    [24,  0x080f1a, 0x070d16, 0.08, 0.18, 20, 150]
  ],
  sun: null, hemi: null, wasNight: null, duskWarned: false, flashlight: null,

  init: function(){
    this.sun = new THREE.DirectionalLight(0xfff2dc, 1.0);
    this.sun.position.set(60, 100, 40);
    G.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbcc4c8, 0x5a5448, 0.85);
    G.scene.add(this.hemi);

    // Tactical weapon flashlight attached to player camera for clear night visibility
    if (G.camera){
      var fl = new THREE.SpotLight(0xfffaea, 1.6, 42, Math.PI / 5.5, 0.35, 1.2);
      fl.position.set(0.2, -0.15, 0.1);
      var flTarget = new THREE.Object3D();
      flTarget.position.set(0, -0.1, -15);
      G.camera.add(fl);
      G.camera.add(flTarget);
      fl.target = flTarget;
      this.flashlight = fl;
    }

    // The first-person weapon layer lives in its own scene — mirror the world
    // lights into it so the gun/arms darken at dusk with everything else.
    if (G.vmScene){
      this.vmSun = new THREE.DirectionalLight(0xfff2dc, 1.0);
      this.vmSun.position.set(60, 100, 40);
      G.vmScene.add(this.vmSun);
      this.vmHemi = new THREE.HemisphereLight(0xbcc4c8, 0x4a4438, 0.8);
      G.vmScene.add(this.vmHemi);
    }
  },

  _c1: new THREE.Color(),
  _c2: new THREE.Color(),

  lerpColor: function(a, b, t, target){
    var ca = target || this._c1;
    ca.setHex(a);
    this._c2.setHex(b);
    return ca.lerp(this._c2, t);
  },

  update: function(dt){
    G.timeOfDay = (G.timeOfDay + dt * 24 / G.dayLength) % 24;
    var h = G.timeOfDay;
    var k = this.keys;
    var i = 0;
    while (i < k.length-1 && !(h >= k[i][0] && h < k[i+1][0])) i++;
    var a = k[i], b = k[i+1];
    var t = (h - a[0]) / (b[0] - a[0]);
    if (G.scene && G.scene.background && G.scene.fog){
      this.lerpColor(a[1], b[1], t, G.scene.background);
      this.lerpColor(a[2], b[2], t, G.scene.fog.color);
    }
    G.scene.fog.near = a[5] + (b[5]-a[5])*t;
    G.scene.fog.far = a[6] + (b[6]-a[6])*t;
    this.sun.intensity = a[3] + (b[3]-a[3])*t;
    this.hemi.intensity = a[4] + (b[4]-a[4])*t;
    if (this.vmSun) this.vmSun.intensity = this.sun.intensity;
    if (this.vmHemi) this.vmHemi.intensity = this.hemi.intensity;
    // sun angle
    var ang = (h - 6) / 12 * Math.PI; // 6h->0, 18h->PI
    this.sun.position.set(Math.cos(ang)*100, Math.max(5, Math.sin(ang)*100), 40);
    // dusk warning at 18.2 - 19.5
    if (h >= 18.2 && h < 19.5 && !this.duskWarned){
      this.duskWarned = true;
      if (Enemies && Enemies.onDusk) Enemies.onDusk();
    } else if (h < 18.0 || h >= 20.0){
      this.duskWarned = false;
    }

    // night flag: dusk (19.5) to dawn (5.5)
    var night = h >= 19.5 || h < 5.5;
    if (this.flashlight){
      // Bright tactical beam at night, off during daylight noon
      this.flashlight.intensity = night ? 1.5 : (h >= 18.2 || h < 6.2 ? 0.65 : 0);
    }
    if (night !== this.wasNight){
      this.wasNight = night;
      G.isNight = night;
      World.setNight(night);
      Objectives.onPhaseChange(night);
      if (night){
        if (Enemies && Enemies.onNightStart) Enemies.onNightStart();
      } else {
        if (Enemies && Enemies.onDawn) Enemies.onDawn();
      }
    }
    HUD.clock(h, night);
  }
};
