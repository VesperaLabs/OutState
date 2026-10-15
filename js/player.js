// Vespera - player: FPS controller, health, car entry, pointer lock.
var Player = {
  bobT: 0, eyeH: 1.7,  // eyeH: G.player.pos.y IS the eye height, not the feet

  init: function(){
    var self = this;
    var canvas = document.getElementById('game');

    document.addEventListener('keydown', function(e){
      // Intercept key capture if settings key remapper is actively waiting for input
      if (typeof HUD !== 'undefined' && HUD.rebindingAction){
        e.preventDefault();
        if (e.code === 'Escape'){
          HUD.cancelRebind();
        } else {
          HUD.applyRebind(e.code);
        }
        return;
      }

      G.keys[e.code] = true;
      var act = (typeof G.getActionForKey === 'function') ? G.getActionForKey(e.code) : null;

      if (e.code === 'Escape'){
        var wb = document.getElementById('workbench-modal');
        if (wb && wb.style.display === 'flex'){
          e.preventDefault();
          Safehouse.closeWorkbench();
          return;
        }
        var menu = document.getElementById('menu');
        if (menu && menu.style.display !== 'none') return;
        e.preventDefault();
        if (typeof HUD !== 'undefined' && HUD.togglePause) HUD.togglePause();
        return;
      }

      if (G.paused || G.player.dead) return;

      if (act === 'interact') self.interact();
      if (act === 'vehCam'){
        if (G.player && G.player.inCar && typeof Cars !== 'undefined' && Cars.cycleCam){
          e.preventDefault();
          Cars.cycleCam();
        }
      }
      if (act === 'gearLock'){
        if (G.player && G.player.inCar && typeof Cars !== 'undefined' && Cars.toggleGearLock){
          e.preventDefault();
          Cars.toggleGearLock();
        }
      }
      if (act === 'shiftUp'){
        if (G.player && G.player.inCar && typeof Cars !== 'undefined' && Cars.shiftUp){
          e.preventDefault();
          Cars.shiftUp();
        }
      }
      if (act === 'shiftDown'){
        if (G.player && G.player.inCar && typeof Cars !== 'undefined' && Cars.shiftDown){
          e.preventDefault();
          Cars.shiftDown();
        }
      }
      if (act === 'bunkerDoor'){
        if (typeof Safehouse !== 'undefined' && Safehouse.toggleDoor) Safehouse.toggleDoor();
      }
      if (act === 'slot1'){
        if (typeof Weapons !== 'undefined') Weapons.switchTo('ak47');
      }
      if (act === 'slot2'){
        if (typeof Weapons !== 'undefined') Weapons.switchTo('shotgun');
      }
      if (act === 'slot3'){
        if (typeof Weapons !== 'undefined') Weapons.switchTo('magnum');
      }
      if (act === 'reload') Weapons.reload();
      if (act === 'fire') Weapons.fire();
      if (act === 'inspect'){
        e.preventDefault();
        Weapons.inspect && Weapons.inspect();
      }
      if (act === 'sprint' && G.settings && G.settings.sprintToggle){
        G.player.sprint = !G.player.sprint;
      }
      if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('keyup', function(e){ G.keys[e.code] = false; });
    window.addEventListener('blur', function(){ G.keys = {}; });

    // Weapon cycle on mouse scroll wheel (on foot & in car)
    window.addEventListener('wheel', function(e){
      if (G.paused || G.player.dead) return;
      var dir = e.deltaY > 0 ? 1 : -1;
      if (typeof Weapons !== 'undefined' && Weapons.cycle) Weapons.cycle(dir);
    }, { passive: true });

    // Global mousedown & pointerlock acquisition
    window.addEventListener('mousedown', function(e){
      if (G.paused) return;
      var wb = document.getElementById('workbench-modal');
      if (wb && wb.style.display === 'flex') return;
      var menu = document.getElementById('menu');
      if (menu && menu.style.display !== 'none') return;

      if (!document.pointerLockElement && !G.isMobile){
        canvas.requestPointerLock().catch(function(){});
      }
      if (e.button === 0){
        G.mouseDown = true;
        Weapons.fire();
      } else if (e.button === 2){
        if (G.settings && G.settings.adsToggle){
          G.aimDownSights = !G.aimDownSights;
        } else {
          G.aimDownSights = true;
        }
      }
    });

    window.addEventListener('mouseup', function(e){
      if (e.button === 0) G.mouseDown = false;
      if (e.button === 2){
        if (!G.settings || !G.settings.adsToggle){
          G.aimDownSights = false;
        }
      }
    });
    window.addEventListener('contextmenu', function(e){ e.preventDefault(); });

    // Robust mouse look for both pointer-locked and drag states, on foot & in car
    document.addEventListener('mousemove', function(e){
      var wb = document.getElementById('workbench-modal');
      if (wb && wb.style.display === 'flex') return;

      var isLocked = !!document.pointerLockElement;
      // Allow rotation if pointer-locked OR dragging with mouse
      if (!isLocked && !G.mouseDown && !G.mouseActive) {
        self.lastClientX = e.clientX;
        self.lastClientY = e.clientY;
        return;
      }

      var mx = (typeof e.movementX === 'number' && e.movementX !== 0) ? e.movementX : 0;
      var my = (typeof e.movementY === 'number' && e.movementY !== 0) ? e.movementY : 0;
      if (mx === 0 && my === 0 && self.lastClientX !== undefined){
        mx = e.clientX - self.lastClientX;
        my = e.clientY - self.lastClientY;
      }
      self.lastClientX = e.clientX;
      self.lastClientY = e.clientY;

      if (G.player.inCar){
        // In car: Mouse rotates the camera 360 degrees around the vehicle for driving & drive-by aiming
        var carSensMult = G.aimDownSights ? 0.6 : 1.0;
        var userSens = (G.settings && typeof G.settings.mouseSens === 'number') ? G.settings.mouseSens : 1.0;
        var sens = 0.0028 * carSensMult * userSens;
        G.player.carCamYaw = (G.player.carCamYaw || 0) - mx * sens;
        G.player.carCamPitch = clamp((G.player.carCamPitch || 0) - my * (sens * 0.72), -0.45, 0.7);
        G.player.carSteerX = (G.player.carSteerX || 0) + mx;
      } else {
        // On foot: First-person camera look
        var baseSens = G.aimDownSights ? 0.0014 : 0.0022;
        var userSens = (G.settings && typeof G.settings.mouseSens === 'number') ? G.settings.mouseSens : 1.0;
        var sens = baseSens * userSens;
        G.player.yaw -= mx * sens;
        G.player.pitch -= my * sens;
        G.player.pitch = clamp(G.player.pitch, -1.1, 0.6);
      }
    });

    document.addEventListener('pointerlockchange', function(){
      if (!document.pointerLockElement && !G.isMobile && !G.paused){
        G.aimDownSights = false;
        G.mouseDown = false;
      }
    });
  },

  interact: function(){
    if (G.paused || G.player.dead) return;
    if (G.player.inCar){ Cars.exit(); return; }

    var px = G.player.pos.x, pz = G.player.pos.z;

    // 0. Check Extraction Tower & Convoy interactions
    if (typeof Extraction !== 'undefined' && Extraction.nearestInteraction){
      var ext = Extraction.nearestInteraction(px, pz);
      if (ext){
        if (ext.type === 'tower'){ Extraction.startUplinkDefense(); return; }
        if (ext.type === 'convoy'){ Extraction.extract(); return; }
      }
    }

    // 0b. Check World Weapon Pickups (Shotgun, Magnum)
    if (typeof Weapons !== 'undefined' && Weapons.checkPickup){
      var wp = Weapons.checkPickup(px, pz);
      if (wp) return;
    }

    // 1. Check Safehouse interactions (Ammo Cache, Workbench, Barricades, Beacon)
    if (typeof Safehouse !== 'undefined' && Safehouse.nearestInteraction){
      var sh = Safehouse.nearestInteraction(px, pz);
      if (sh){
        if (sh.type === 'door'){ Safehouse.toggleDoor(); return; }
        if (sh.type === 'ammo'){ Safehouse.resupplyAmmo(); return; }
        if (sh.type === 'workbench'){ Safehouse.openWorkbench(); return; }
        if (sh.type === 'beacon'){ Safehouse.triggerDistressBeacon(); return; }
        if (sh.type === 'barricade'){ Safehouse.fortifyBarricade(sh.target); return; }
        if (sh.type === 'ammo_cooling' || sh.type === 'barricade_full' || sh.type === 'beacon_active' || sh.type === 'beacon_cooling'){
          HUD.toast(sh.text);
          return;
        }
      }
    }

    // 2. Check City Scavenging interactions (Trunks & Storefronts)
    if (typeof Scavenging !== 'undefined' && Scavenging.nearestInteraction){
      var sc = Scavenging.nearestInteraction(px, pz);
      if (sc){
        if (sc.type === 'trunk'){ Scavenging.searchTrunk(sc.target); return; }
        if (sc.type === 'store'){ Scavenging.scavengeStore(sc.target); return; }
        if (sc.type === 'trunk_empty' || sc.type === 'store_empty'){
          HUD.toast(sc.text);
          return;
        }
      }
    }

    // 3. Check drivable cars
    var c = Cars.nearestEnterable(px, pz);
    if (c){
      Cars.enter(c);
      if (HUD && HUD.el && HUD.el.radioSub) HUD.el.radioSub.classList.remove('show');
    }
  },

  damage: function(d, fromX, fromZ){
    if (G.player.dead || d<=0) return;
    if (G.player.armor > 0){
      var absorb = Math.min(G.player.armor, d*0.6);
      G.player.armor -= absorb; d -= absorb;
    }
    G.player.health -= d;
    HUD.flashDamage(fromX, fromZ);
    AudioSys.hurt();
    HUD.health(G.player.health);
    if (G.player.health <= 0) this.die();
  },

  die: function(){
    G.player.dead = true;
    AudioSys.engineStop();
    if (G.player.inCar) Cars.exit();
    document.getElementById('death-screen').style.display = 'flex';
    document.exitPointerLock && document.exitPointerLock();
  },

  respawn: function(){
    G.player.dead = false;
    G.player.health = 100;
    G.player.armor = 50;
    Weapons.state.mag = Weapons.list[Weapons.current].mag;
    Weapons.state.reserve = 90;
    HUD.health(100);
    HUD.ammo(Weapons.state.mag, Weapons.state.reserve);
    // respawn at start road (safe, near Vespera GT)
    G.player.pos.x = World.startPos.x + 3;
    G.player.pos.z = World.startPos.z + 3;
    G.player.yaw = Math.PI/4;
    G.player.vy = 0;
    G.player.onGround = true;
    document.getElementById('death-screen').style.display = 'none';
    HUD.radio('VESPERA RADIO', "Back on your feet. The fog doesn't wait, and neither do I.", 5000);
  },

  update: function(dt){
    var p = G.player;
    if (p.inCar){ // keep eye on car position for shooting exit etc.
      return;
    }
    // look from touch
    if (G.isMobile){
      p.yaw -= G.touch.lookDX * 0.004;
      p.pitch -= G.touch.lookDY * 0.004;
      p.pitch = clamp(p.pitch, -1.1, 0.6);
      G.touch.lookDX = 0; G.touch.lookDY = 0;
    }
    var fwdIn = (typeof G.isActionDown === 'function') 
      ? ((G.isActionDown('forward')?1:0) - (G.isActionDown('backward')?1:0))
      : ((G.keys['KeyW']||G.keys['ArrowUp']?1:0) - (G.keys['KeyS']||G.keys['ArrowDown']?1:0));
    var strIn = (typeof G.isActionDown === 'function')
      ? ((G.isActionDown('right')?1:0) - (G.isActionDown('left')?1:0))
      : ((G.keys['KeyD']||G.keys['ArrowRight']?1:0) - (G.keys['KeyA']||G.keys['ArrowLeft']?1:0));
    fwdIn -= G.touch.moveZ; strIn += G.touch.moveX;
    var mag = Math.sqrt(fwdIn*fwdIn + strIn*strIn);
    if (mag > 1){ fwdIn/=mag; strIn/=mag; }

    if (G.settings && G.settings.sprintToggle){
      if (mag < 0.05) p.sprint = false;
    } else {
      p.sprint = (typeof G.isActionDown === 'function') ? G.isActionDown('sprint') : (!!G.keys['ShiftLeft'] || !!G.keys['ShiftRight']);
    }

    var speed = p.sprint ? 8.5 : 4.5;
    if (p.acidSlow){
      speed *= p.acidSlow;
      p.acidSlow = 1.0;
    }
    var sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    // forward vector (yaw): -Z when yaw=0
    var vx = (-sy*fwdIn + cy*strIn) * speed;
    var vz = (-cy*fwdIn - sy*strIn) * speed;
    var nx = p.pos.x + vx*dt, nz = p.pos.z + vz*dt;
    var col = collideWorld(nx, nz, 0.4);
    p.pos.x = col.x; p.pos.z = col.z;
    // jump/gravity
    var jumpIn = ((typeof G.isActionDown === 'function') ? G.isActionDown('jump') : G.keys['Space']) || G.touch.jump;
    if (jumpIn && p.onGround){ p.vy = 5; p.onGround = false; }
    p.vy -= 14*dt;
    p.pos.y += p.vy*dt;
    if (p.pos.y <= this.eyeH){ p.pos.y = this.eyeH; p.vy = 0; p.onGround = true; }
    // head bob
    var moving = mag > 0.1;
    if (moving) this.bobT += dt * (p.sprint?11:7);
    var bob = moving ? Math.sin(this.bobT)*0.035 : 0;
    var bobX = moving ? Math.cos(this.bobT*0.5)*0.02 : 0;
    // --- First-person camera: sits exactly on the eye point ---
    // G.player.pos is what zombies target, what spawns orbit and what the
    // minimap draws — so the camera MUST be on it, not orbiting an invisible
    // third-person anchor in front of it. Facing comes straight from yaw/pitch.
    G.camera.rotation.order = 'YXZ';
    G.camera.position.set(p.pos.x, p.pos.y + bob, p.pos.z);
    G.camera.rotation.x = p.pitch;
    G.camera.rotation.y = p.yaw;
    // --- Player character animation state ---
    if (PlayerCharacter && PlayerCharacter.setState){
      if (!p.onGround){
        PlayerCharacter.setState('jump');
      } else if (moving && p.sprint){
        PlayerCharacter.setState('run');
      } else if (moving){
        PlayerCharacter.setState('walk');
      } else {
        PlayerCharacter.setState('idle');
      }
    }
    // Context-aware interaction hints
    if (!G.isMobile){
      var hintShown = false;
      if (typeof Safehouse !== 'undefined' && Safehouse.nearestInteraction){
        var shInt = Safehouse.nearestInteraction(p.pos.x, p.pos.z);
        if (shInt){ HUD.hint(shInt.text); hintShown = true; }
      }
      if (!hintShown && typeof Scavenging !== 'undefined' && Scavenging.nearestInteraction){
        var scInt = Scavenging.nearestInteraction(p.pos.x, p.pos.z);
        if (scInt){ HUD.hint(scInt.text); hintShown = true; }
      }
      if (!hintShown && typeof Weapons !== 'undefined' && Weapons.nearestPickupHint){
        var wpText = Weapons.nearestPickupHint(p.pos.x, p.pos.z);
        if (wpText){ HUD.hint(wpText); hintShown = true; }
      }
      if (!hintShown && typeof Extraction !== 'undefined' && Extraction.nearestInteraction){
        var exInt = Extraction.nearestInteraction(p.pos.x, p.pos.z);
        if (exInt){ HUD.hint(exInt.text); hintShown = true; }
      }
      if (!hintShown && typeof Safehouse !== 'undefined' && Safehouse.isPlayerHidden && Safehouse.isPlayerHidden()){
        HUD.hint('🔒 SAFEHOUSE: HIDDEN & SECURED (Doors Closed)');
        hintShown = true;
      }
      if (!hintShown){
        var c = Cars.nearestEnterable(p.pos.x, p.pos.z);
        if (c) HUD.hint('Press E — ' + (c.name || 'enter car'));
      }
    }
  }
};
