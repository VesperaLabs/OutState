var HUD = {
  spreadAmt: 0, toastT: null, lastHeartbeat: 0,

  init: function(){
    this.el = {
      health: document.getElementById('health-bar'),
      healthNum: document.getElementById('health-num'),
      armor: document.getElementById('armor-bar'),
      wname: document.getElementById('weapon-name'),
      mag: document.getElementById('ammo-mag'),
      res: document.getElementById('ammo-res'),
      magPips: document.getElementById('mag-pips'),
      clock: document.getElementById('clock'),
      phase: document.getElementById('phase-label'),
      objective: document.getElementById('objective'),
      radioName: document.getElementById('radio-name'),
      radioText: document.getElementById('radio-text'),
      radioSub: document.getElementById('radio-sub'),
      hint: document.getElementById('interact-hint'),
      hitm: document.getElementById('hitmarker'),
      flash: document.getElementById('damage-flash'),
      dmgLayer: document.getElementById('damage-indicator-layer'),
      lowHealth: document.getElementById('low-health-vignette'),
      pauseMenu: document.getElementById('pause-menu'),
      wub: document.getElementById('weapon-unlock-banner'),
      wubName: document.getElementById('wub-name'),
      minimap: document.getElementById('minimap'),
      crosshair: document.getElementById('crosshair'),
      scrapNum: document.getElementById('scrap-num'),
      acidVignette: document.getElementById('acid-vignette'),
      uplinkHud: document.getElementById('uplink-hud'),
      uplinkBar: document.getElementById('uplink-bar'),
      uplinkNum: document.getElementById('uplink-num')
    };
    this.mm = this.el.minimap.getContext('2d');
    this.updateScrap(G.player.scrap || 0);
    this.initSettingsUI();
  },

  activeTab: 'av',
  rebindingAction: null,

  bindableActions: [
    { id: 'forward', label: 'Move Forward / Drive Accelerate', group: 'Movement', defaultKey: 'KeyW' },
    { id: 'backward', label: 'Move Backward / Reverse', group: 'Movement', defaultKey: 'KeyS' },
    { id: 'left', label: 'Strafe Left / Steer Left', group: 'Movement', defaultKey: 'KeyA' },
    { id: 'right', label: 'Strafe Right / Steer Right', group: 'Movement', defaultKey: 'KeyD' },
    { id: 'sprint', label: 'Sprint / Tactical Dash', group: 'Movement', defaultKey: 'ShiftLeft' },
    { id: 'jump', label: 'Jump / Handbrake Drift', group: 'Movement', defaultKey: 'Space' },
    { id: 'interact', label: 'Interact / Enter Car / Loot', group: 'Tactical', defaultKey: 'KeyE' },
    { id: 'reload', label: 'Tactical Magazine Reload', group: 'Combat', defaultKey: 'KeyR' },
    { id: 'fire', label: 'Alt Fire Key (LMB Primary)', group: 'Combat', defaultKey: 'KeyX' },
    { id: 'inspect', label: 'Flourish Inspect Weapon', group: 'Combat', defaultKey: 'KeyT' },
    { id: 'slot1', label: 'Equip Primary Rifle (ACR)', group: 'Arsenal', defaultKey: 'Digit1' },
    { id: 'slot2', label: 'Equip Remington 870 Shotgun', group: 'Arsenal', defaultKey: 'Digit2' },
    { id: 'slot3', label: 'Equip .357 Magnum Sidearm', group: 'Arsenal', defaultKey: 'Digit3' },
    { id: 'vehCam', label: 'Cycle 3D Vehicle Camera', group: 'Tactical', defaultKey: 'KeyV' },
    { id: 'bunkerDoor', label: 'Bunker Blast Door Toggle', group: 'Tactical', defaultKey: 'KeyO' },
    { id: 'gearLock', label: 'Lock / Unlock Gear Transmission', group: 'Vehicle', defaultKey: 'KeyG' },
    { id: 'shiftUp', label: 'Shift Transmission Up', group: 'Vehicle', defaultKey: 'KeyF' },
    { id: 'shiftDown', label: 'Shift Transmission Down', group: 'Vehicle', defaultKey: 'KeyQ' },
    { id: 'stageRev', label: 'Accelerate Handbrake / Staging Rev', group: 'Vehicle', defaultKey: 'KeyZ' }
  ],

    showTooltip: function(targetEl, title, text){
    var tip = document.getElementById('pm-tooltip');
    if (!tip) return;
    tip.innerHTML = '<div class="pm-tooltip-title"><span class="pm-pulse-pip"></span>' + (title || 'TACTICAL INTEL') + '</div><div class="pm-tooltip-body">' + text + '</div>';
    tip.style.display = 'block';
    
    var rect = targetEl.getBoundingClientRect();
    var tipWidth = 280;
    var tipHeight = tip.offsetHeight || 75;
    
    var left = rect.left + (rect.width / 2) - (tipWidth / 2);
    if (left < 14) left = 14;
    if (left + tipWidth > window.innerWidth - 14) left = window.innerWidth - tipWidth - 14;
    
    var top = rect.top - tipHeight - 10;
    if (top < 14) top = rect.bottom + 10;
    
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
    
    requestAnimationFrame(function(){
      tip.classList.add('visible');
    });
  },

  hideTooltip: function(){
    var tip = document.getElementById('pm-tooltip');
    if (!tip) return;
    tip.classList.remove('visible');
    setTimeout(function(){
      if (!tip.classList.contains('visible')) tip.style.display = 'none';
    }, 150);
  },

  switchSettingsTab: function(tabId){
    this.activeTab = tabId;
    var tabs = ['av', 'ctrl', 'sys'];
    for (var i = 0; i < tabs.length; i++){
      var btn = document.getElementById('pm-tab-btn-' + tabs[i]);
      var pane = document.getElementById('pm-pane-' + tabs[i]);
      if (btn){
        if (tabs[i] === tabId) btn.classList.add('active');
        else btn.classList.remove('active');
      }
      if (pane){
        if (tabs[i] === tabId) pane.classList.add('active');
        else pane.classList.remove('active');
      }
    }
    if (tabId === 'sys') this.updateLiveTelemetry();
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.18, 1400, 0.02);
  },

  formatKeyCode: function(code){
    if (!code) return 'NONE';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code === 'ShiftLeft') return 'L-SHIFT';
    if (code === 'ShiftRight') return 'R-SHIFT';
    if (code === 'ControlLeft') return 'L-CTRL';
    if (code === 'ControlRight') return 'R-CTRL';
    if (code === 'AltLeft') return 'L-ALT';
    if (code === 'AltRight') return 'R-ALT';
    if (code === 'Space') return 'SPACE';
    if (code === 'ArrowUp') return '\u25B2 UP';
    if (code === 'ArrowDown') return '\u25BC DOWN';
    if (code === 'ArrowLeft') return '\u25C0 LEFT';
    if (code === 'ArrowRight') return '\u25B6 RIGHT';
    if (code === 'Tab') return 'TAB';
    if (code === 'CapsLock') return 'CAPS';
    if (code === 'Enter') return 'ENTER';
    if (code === 'Backspace') return 'BKSP';
    return code;
  },

  renderKeybindings: function(){
    var container = document.getElementById('pm-binds-grid');
    if (!container) return;
    container.innerHTML = '';
    var s = G.settings || {};
    var keys = s.keys || {};
    var self = this;

    for (var i = 0; i < this.bindableActions.length; i++){
      var item = this.bindableActions[i];
      var boundCode = keys[item.id] || item.defaultKey;
      var isRebinding = (self.rebindingAction === item.id);

      var row = document.createElement('div');
      row.className = 'pm-bind-card' + (isRebinding ? ' rebinding' : '');
      
      var infoWrap = document.createElement('div');
      infoWrap.className = 'pm-bind-info';
      var title = document.createElement('div');
      title.className = 'pm-bind-label';
      title.textContent = item.label;
      var group = document.createElement('div');
      group.className = 'pm-bind-group';
      group.textContent = item.group;
      infoWrap.appendChild(title);
      infoWrap.appendChild(group);

      var keySlot = document.createElement('button');
      keySlot.className = 'pm-bind-slot' + (isRebinding ? ' active-bind' : '');
      keySlot.setAttribute('type', 'button');
      keySlot.setAttribute('data-action', item.id);
      keySlot.textContent = isRebinding ? 'PRESS KEY...' : self.formatKeyCode(boundCode);
      
      (function(actionId){
        keySlot.onclick = function(e){
          e.stopPropagation();
          self.startRebind(actionId);
        };
      })(item.id);

      row.appendChild(infoWrap);
      row.appendChild(keySlot);
      container.appendChild(row);
    }
  },

  startRebind: function(actionId){
    this.rebindingAction = actionId;
    this.renderKeybindings();
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.25, 2100, 0.03);
  },

  cancelRebind: function(){
    this.rebindingAction = null;
    this.renderKeybindings();
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.16, 900, 0.025);
  },

  applyRebind: function(code){
    if (!this.rebindingAction) return;
    if (!G.settings) G.settings = {};
    if (!G.settings.keys) G.settings.keys = {};
    G.settings.keys[this.rebindingAction] = code;
    this.rebindingAction = null;
    this.renderKeybindings();
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.3, 1800, 0.035);
    try {
      localStorage.setItem('vespera_settings', JSON.stringify(G.settings));
    } catch(e){}
    this.toast('KEY REBOUND SUCCESSFULLY');
  },

  resetKeybindings: function(){
    if (!G.settings) G.settings = {};
    G.settings.keys = {
      forward: 'KeyW',
      backward: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      sprint: 'ShiftLeft',
      jump: 'Space',
      interact: 'KeyE',
      reload: 'KeyR',
      fire: 'KeyX',
      inspect: 'KeyT',
      slot1: 'Digit1',
      slot2: 'Digit2',
      slot3: 'Digit3',
      vehCam: 'KeyV',
      bunkerDoor: 'KeyO'
    };
    this.rebindingAction = null;
    this.renderKeybindings();
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.25, 1500, 0.03);
    try {
      localStorage.setItem('vespera_settings', JSON.stringify(G.settings));
    } catch(e){}
    this.toast('DEFAULT CONTROLS RESTORED');
  },

  resetAllSettings: function(){
    G.settings = {
      mouseSens: 1.0,
      masterVol: 0.7,
      sfxVol: 0.85,
      ambienceVol: 0.65,
      engineVol: 0.85,
      rpmIntensity: 1.0,
      rpmModEnabled: true,
      graphicsQuality: 'high',
      resolutionScale: 1.0,
      sprintToggle: false,
      adsToggle: false,
      keys: {
        forward: 'KeyW',
        backward: 'KeyS',
        left: 'KeyA',
        right: 'KeyD',
        sprint: 'ShiftLeft',
        jump: 'Space',
        interact: 'KeyE',
        reload: 'KeyR',
        fire: 'KeyX',
        inspect: 'KeyT',
        slot1: 'Digit1',
        slot2: 'Digit2',
        slot3: 'Digit3',
        vehCam: 'KeyV',
        bunkerDoor: 'KeyO'
      }
    };
    try {
      localStorage.setItem('vespera_settings', JSON.stringify(G.settings));
    } catch(e){}
    if (typeof AudioSys !== 'undefined'){
      AudioSys.setMasterVolume(0.7);
      AudioSys.setSfxVolume(0.85);
      AudioSys.setAmbienceVolume(0.65);
      if (AudioSys.setEngineVolume) AudioSys.setEngineVolume(0.85);
      if (AudioSys.setRpmModulation) AudioSys.setRpmModulation(true, 1.0);
    }
    if (typeof Main !== 'undefined' && Main.applyResolutionScale) Main.applyResolutionScale();
    this.initSettingsUI();
    this.toast('FACTORY SETTINGS APPLIED');
  },

  updateLiveTelemetry: function(){
    var diagWin = document.getElementById('pm-diag-win');
    if (diagWin) diagWin.textContent = window.innerWidth + ' \u00D7 ' + window.innerHeight;
    var diagCars = document.getElementById('pm-diag-cars');
    if (diagCars) diagCars.textContent = (G.cars ? G.cars.length : 0) + ' Vehicles';
    var diagZ = document.getElementById('pm-diag-zombies');
    if (diagZ) diagZ.textContent = (G.enemies ? G.enemies.length : 0) + ' Hostiles';
    var diagCol = document.getElementById('pm-diag-colls');
    if (diagCol) diagCol.textContent = (G.colliders ? G.colliders.length : 0) + ' Colliders';
    var diagAudio = document.getElementById('pm-diag-audio');
    if (diagAudio && typeof AudioSys !== 'undefined' && AudioSys.ctx){
      diagAudio.textContent = AudioSys.ctx.state.toUpperCase() + ' (Optimal)';
    }
    if (typeof Main !== 'undefined' && Main.applyResolutionScale) Main.applyResolutionScale();
  },

  initSettingsUI: function(){
    var s = G.settings || {};

    // 1. Mouse Sensitivity
    var sSens = document.getElementById('slider-mouse-sens');
    var vSens = document.getElementById('val-mouse-sens');
    var sensVal = (typeof s.mouseSens === 'number') ? s.mouseSens : 1.0;
    if (sSens) sSens.value = sensVal;
    if (vSens) vSens.textContent = sensVal.toFixed(2) + 'x';

    // 2. Audio Sliders
    var sM = document.getElementById('slider-master-vol');
    var vM = document.getElementById('val-master-vol');
    var mVal = (typeof s.masterVol === 'number') ? s.masterVol : 0.7;
    if (sM) sM.value = mVal;
    if (vM) vM.textContent = Math.round(mVal * 100) + '%';

    var sS = document.getElementById('slider-sfx-vol');
    var vS = document.getElementById('val-sfx-vol');
    var sVal = (typeof s.sfxVol === 'number') ? s.sfxVol : 0.85;
    if (sS) sS.value = sVal;
    if (vS) vS.textContent = Math.round(sVal * 100) + '%';

    var sA = document.getElementById('slider-amb-vol');
    var vA = document.getElementById('val-amb-vol');
    var aVal = (typeof s.ambienceVol === 'number') ? s.ambienceVol : 0.65;
    if (sA) sA.value = aVal;
    if (vA) vA.textContent = Math.round(aVal * 100) + '%';

    var sEng = document.getElementById('slider-engine-vol');
    var vEng = document.getElementById('val-engine-vol');
    var engVal = (typeof s.engineVol === 'number') ? s.engineVol : 0.85;
    if (sEng) sEng.value = engVal;
    if (vEng) vEng.textContent = Math.round(engVal * 100) + '%';

    var sRpm = document.getElementById('slider-rpm-intensity');
    var vRpm = document.getElementById('val-rpm-intensity');
    var rpmVal = (typeof s.rpmIntensity === 'number') ? s.rpmIntensity : 1.0;
    if (sRpm) sRpm.value = rpmVal;
    if (vRpm) vRpm.textContent = Math.round(rpmVal * 100) + '%';

    // 3. Resolution Scale
    var sRes = document.getElementById('slider-res-scale');
    var vRes = document.getElementById('val-res-scale');
    var resVal = (typeof s.resolutionScale === 'number') ? s.resolutionScale : 1.0;
    if (sRes) sRes.value = resVal;
    if (vRes) vRes.textContent = Math.round(resVal * 100) + '%';

    // 4. Toggle buttons (RPM, Graphics, Sprint Mode, ADS Mode)
    this.updateRpmButtons(typeof s.rpmModEnabled === 'boolean' ? s.rpmModEnabled : true);
    this.updateGfxButtons(s.graphicsQuality || 'high');
    this.updateSprintButtons(!!s.sprintToggle);
    this.updateAdsButtons(!!s.adsToggle);
    this.setSpeedoTheme(s.speedoTheme || localStorage.getItem('vespera_speedo_theme') || 'amber');
    this.setSpeedoUnit(s.speedoUnit || localStorage.getItem('vespera_speedo_unit') || 'MPH');

    // 5. Render keybindings
    this.renderKeybindings();

    // 6. Sizing & Telemetry
    if (typeof Main !== 'undefined' && Main.applyResolutionScale) Main.applyResolutionScale();
    this.updateLiveTelemetry();
  },

  updateRpmButtons: function(active){
    var btnOn = document.getElementById('btn-rpm-on');
    var btnOff = document.getElementById('btn-rpm-off');
    if (btnOn && btnOff){
      if (active){
        btnOn.classList.add('active');
        btnOff.classList.remove('active');
      } else {
        btnOff.classList.add('active');
        btnOn.classList.remove('active');
      }
    }
    var vRpmT = document.getElementById('val-rpm-toggle');
    if (vRpmT) vRpmT.textContent = active ? 'SIMULATED' : 'FLAT PURR';
  },

  updateGfxButtons: function(quality){
    var btns = ['high', 'med', 'low'];
    for (var i = 0; i < btns.length; i++){
      var btn = document.getElementById('btn-gfx-' + btns[i]);
      if (btn){
        if (btns[i] === quality){
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    }
    var vGfx = document.getElementById('val-gfx');
    if (vGfx) vGfx.textContent = quality.toUpperCase();
  },

  updateSprintButtons: function(isToggle){
    var btnHold = document.getElementById('btn-sprint-hold');
    var btnTog = document.getElementById('btn-sprint-toggle');
    if (btnHold && btnTog){
      if (isToggle){
        btnTog.classList.add('active');
        btnHold.classList.remove('active');
      } else {
        btnHold.classList.add('active');
        btnTog.classList.remove('active');
      }
    }
    var vSprint = document.getElementById('val-sprint-mode');
    if (vSprint) vSprint.textContent = isToggle ? 'TOGGLE' : 'HOLD';
  },

  updateAdsButtons: function(isToggle){
    var btnHold = document.getElementById('btn-ads-hold');
    var btnTog = document.getElementById('btn-ads-toggle');
    if (btnHold && btnTog){
      if (isToggle){
        btnTog.classList.add('active');
        btnHold.classList.remove('active');
      } else {
        btnHold.classList.add('active');
        btnTog.classList.remove('active');
      }
    }
    var vAds = document.getElementById('val-ads-mode');
    if (vAds) vAds.textContent = isToggle ? 'TOGGLE' : 'HOLD';
  },

  onSettingChange: function(key, val){
    if (!G.settings) G.settings = {};

    if (key === 'mouseSens'){
      G.settings.mouseSens = parseFloat(val);
      var v = document.getElementById('val-mouse-sens');
      if (v) v.textContent = G.settings.mouseSens.toFixed(2) + 'x';
    } else if (key === 'resolutionScale'){
      G.settings.resolutionScale = parseFloat(val);
      var v = document.getElementById('val-res-scale');
      if (v) v.textContent = Math.round(G.settings.resolutionScale * 100) + '%';
      if (typeof Main !== 'undefined' && Main.applyResolutionScale) Main.applyResolutionScale();
    } else if (key === 'sprintToggle'){
      G.settings.sprintToggle = !!val;
      this.updateSprintButtons(G.settings.sprintToggle);
    } else if (key === 'adsToggle'){
      G.settings.adsToggle = !!val;
      this.updateAdsButtons(G.settings.adsToggle);
    } else if (key === 'masterVol'){
      G.settings.masterVol = parseFloat(val);
      var v = document.getElementById('val-master-vol');
      if (v) v.textContent = Math.round(G.settings.masterVol * 100) + '%';
      if (typeof AudioSys !== 'undefined') AudioSys.setMasterVolume(G.settings.masterVol);
    } else if (key === 'sfxVol'){
      G.settings.sfxVol = parseFloat(val);
      var v = document.getElementById('val-sfx-vol');
      if (v) v.textContent = Math.round(G.settings.sfxVol * 100) + '%';
      if (typeof AudioSys !== 'undefined') AudioSys.setSfxVolume(G.settings.sfxVol);
    } else if (key === 'ambienceVol'){
      G.settings.ambienceVol = parseFloat(val);
      var v = document.getElementById('val-amb-vol');
      if (v) v.textContent = Math.round(G.settings.ambienceVol * 100) + '%';
      if (typeof AudioSys !== 'undefined') AudioSys.setAmbienceVolume(G.settings.ambienceVol);
    } else if (key === 'engineVol'){
      G.settings.engineVol = parseFloat(val);
      var v = document.getElementById('val-engine-vol');
      if (v) v.textContent = Math.round(G.settings.engineVol * 100) + '%';
      if (typeof AudioSys !== 'undefined' && AudioSys.setEngineVolume) AudioSys.setEngineVolume(G.settings.engineVol);
    } else if (key === 'rpmIntensity'){
      G.settings.rpmIntensity = parseFloat(val);
      var v = document.getElementById('val-rpm-intensity');
      if (v) v.textContent = Math.round(G.settings.rpmIntensity * 100) + '%';
      if (typeof AudioSys !== 'undefined' && AudioSys.setRpmModulation) AudioSys.setRpmModulation(G.settings.rpmModEnabled !== false, G.settings.rpmIntensity);
    } else if (key === 'rpmModEnabled'){
      G.settings.rpmModEnabled = !!val;
      this.updateRpmButtons(G.settings.rpmModEnabled);
      if (typeof AudioSys !== 'undefined' && AudioSys.setRpmModulation) AudioSys.setRpmModulation(G.settings.rpmModEnabled, (typeof G.settings.rpmIntensity === 'number') ? G.settings.rpmIntensity : 1.0);
    } else if (key === 'graphicsQuality'){
      G.settings.graphicsQuality = val;
      this.updateGfxButtons(val);
      if (typeof Main !== 'undefined' && Main.applyResolutionScale) Main.applyResolutionScale();
    }

    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.14, 1800, 0.02);

    try {
      localStorage.setItem('vespera_settings', JSON.stringify(G.settings));
    } catch(e){}
  },
  togglePause: function(){
    if (G.player.dead) return;
    var wb = document.getElementById('workbench-modal');
    if (wb && wb.style.display === 'flex') return; // workbench handles itself
    var menu = document.getElementById('menu');
    var isFromMenu = (menu && menu.style.display !== 'none');

  openCustomHudEditor: function(){
    if (this.el && this.el.pauseMenu) this.el.pauseMenu.style.display = 'none';
    if (window.Touch && Touch.openCustomEditor){
      Touch.openCustomEditor();
    }
  },

  togglePause: function(isFromMenu){
    var pm = this.el.pauseMenu;
    if (!pm) return;
    var isPaused = (pm.style.display === 'flex');
    if (isPaused){
      // Resume game or close config
      pm.style.display = 'none';
      if (!isFromMenu){
        G.paused = false;
        var canvas = document.getElementById('game');
        if (!G.isMobile && canvas) canvas.requestPointerLock().catch(function(){});
      }
    } else {
      // Pause game
      pm.style.display = 'flex';
      G.paused = true;
      document.exitPointerLock && document.exitPointerLock();
      this.initSettingsUI();
    }
  },

  updateScrap: function(amt){
    if (this.el.scrapNum) this.el.scrapNum.textContent = amt;
  },

  weapon: function(name, mag, res){
    this.el.wname.textContent = name;
    this.ammo(mag, res);
  },
  ammo: function(mag, res){
    this.el.mag.textContent = mag;
    this.el.res.textContent = res;
    var maxMag = 30;
    if (typeof Weapons !== 'undefined' && Weapons.list && Weapons.current){
      var w = Weapons.list[Weapons.current];
      if (w) maxMag = w.mag;
    }
    this.updateMagPips(mag, maxMag);
  },
  updateMagPips: function(mag, maxMag){
    var container = this.el.magPips;
    if (!container) return;
    var count = Math.min(45, maxMag || 30);
    // Reuse existing pips or build
    while (container.children.length < count){
      var p = document.createElement('div');
      p.className = 'mag-pip';
      container.appendChild(p);
    }
    while (container.children.length > count){
      container.removeChild(container.lastChild);
    }
    var ratio = mag / count;
    for (var i = 0; i < count; i++){
      var pip = container.children[i];
      if (i >= mag){
        pip.className = 'mag-pip empty';
      } else if (ratio <= 0.2 || mag <= 5){
        pip.className = 'mag-pip low';
      } else if (ratio <= 0.45){
        pip.className = 'mag-pip mid';
      } else {
        pip.className = 'mag-pip';
      }
    }
  },
  weaponUnlock: function(name){
    if (!this.el.wub || !this.el.wubName) return;
    this.el.wubName.textContent = name;
    this.el.wub.classList.add('show');
    if (typeof AudioSys !== 'undefined' && AudioSys.weaponPickup) AudioSys.weaponPickup();
    clearTimeout(this._wubT);
    this._wubT = setTimeout(function(){
      if (HUD.el && HUD.el.wub) HUD.el.wub.classList.remove('show');
    }, 3600);
  },
  health: function(h){
    this.el.health.style.width = clamp(h,0,100) + '%';
    this.el.healthNum.textContent = Math.max(0, Math.round(h));
    this.el.health.style.background = h>50 ? '#b8322c' : (h>25 ? '#c86a20' : '#d83020');
    this.updateHealthVignette(h);
  },
  updateHealthVignette: function(h){
    var v = this.el.lowHealth;
    if (!v) return;
    if (h <= 0 || G.player.dead){
      v.className = '';
      return;
    }
    var now = performance.now();
    if (h <= 15){
      v.className = 'active critical';
      if (now - this.lastHeartbeat > 580){
        this.lastHeartbeat = now;
        if (typeof AudioSys !== 'undefined' && AudioSys.heartbeat) AudioSys.heartbeat(0.95);
      }
    } else if (h <= 28){
      v.className = 'active';
      if (now - this.lastHeartbeat > 950){
        this.lastHeartbeat = now;
        if (typeof AudioSys !== 'undefined' && AudioSys.heartbeat) AudioSys.heartbeat(0.65);
      }
    } else {
      v.className = '';
    }
  },
  clock: function(h, night){
    var hh = Math.floor(h), mm = Math.floor((h-hh)*60);
    this.el.clock.textContent = (hh<10?'0':'')+hh + ':' + (mm<10?'0':'')+mm;
    if (night){
      var w = (Enemies && Enemies.horde) ? Enemies.horde.wave : 1;
      var k = (Enemies && Enemies.horde) ? Enemies.horde.waveKills : 0;
      var t = (Enemies && Enemies.horde) ? Enemies.horde.waveTarget : 14;
      this.el.phase.textContent = 'WAVE ' + w + ' [' + k + '/' + t + ']';
      this.el.phase.style.color = '#e04040';
    } else {
      this.el.phase.textContent = 'DAY';
      this.el.phase.style.color = '#c9a86a';
    }
  },
  objective: function(text){
    if (!this.el.objective) return;
    if (!text || text === '...' || (typeof text === 'string' && text.trim() === '')){
      this.el.objective.style.display = 'none';
      return;
    }
    this.el.objective.textContent = text;
    this.el.objective.style.display = 'block';
  },
  hint: function(text){
    if (!text){ this.el.hint.style.display='none'; return; }
    this.el.hint.textContent = text;
    this.el.hint.style.display='block';
    clearTimeout(this._hintT);
    this._hintT = setTimeout(function(){ HUD.el.hint.style.display='none'; }, 2500);
  },
  hitmarker: function(headshot){
    var el = this.el.hitm;
    if (!el) return;
    if (headshot){
      el.classList.add('headshot');
    } else {
      el.classList.remove('headshot');
    }
    el.classList.remove('show');
    void el.offsetWidth; // force DOM reflow for rapid-fire re-triggering
    el.classList.add('show');
    clearTimeout(this._hmT);
    this._hmT = setTimeout(function(){
      el.classList.remove('show');
      el.classList.remove('headshot');
    }, 130);
  },
  flashDamage: function(fromX, fromZ){
    var el = this.el.flash;
    if (el){
      el.style.opacity = 1;
      clearTimeout(this._fdT);
      this._fdT = setTimeout(function(){ el.style.opacity = 0; }, 250);
    }
    if (fromX !== undefined && fromZ !== undefined){
      var px = G.player.pos.x, pz = G.player.pos.z;
      var dx = fromX - px, dz = fromZ - pz;
      var pyaw = G.player.yaw;
      var sy = Math.sin(pyaw), cy = Math.cos(pyaw);
      // Project into player local coordinate space
      var fwdDot = -sy * dx - cy * dz; // forward
      var rightDot = cy * dx - sy * dz; // rightward
      var relAngle = Math.atan2(rightDot, fwdDot);
      this.showDamageArc(relAngle);
    }
  },

  showDamageArc: function(relAngle){
    var layer = this.el.dmgLayer;
    if (!layer) return;
    var arcDiv = document.createElement('div');
    arcDiv.className = 'damage-arc';
    var deg = (relAngle * 180 / Math.PI);
    arcDiv.style.transform = 'rotate(' + deg.toFixed(1) + 'deg)';
    arcDiv.innerHTML = '<svg viewBox="0 0 300 300">' +
      '<defs>' +
        '<filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">' +
          '<feGaussianBlur stdDeviation="3" result="blur" />' +
          '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>' +
      '</defs>' +
      '<path d="M 95 65 A 120 120 0 0 1 205 65" fill="none" stroke="#ff2222" stroke-width="5" stroke-linecap="round" filter="url(#arcGlow)"/>' +
      '<path d="M 85 70 A 125 125 0 0 1 215 70" fill="none" stroke="rgba(255, 35, 35, 0.45)" stroke-width="12" stroke-linecap="round"/>' +
    '</svg>';
    layer.appendChild(arcDiv);

    // Fade out smoothly
    setTimeout(function(){
      arcDiv.classList.add('fade');
    }, 45);

    // Clean up
    setTimeout(function(){
      if (arcDiv.parentNode) arcDiv.parentNode.removeChild(arcDiv);
    }, 900);
  },
  toast: function(text){
    // reuse radio sub area briefly
    this.el.radioName.textContent = '';
    this.el.radioText.textContent = text;
    this.el.radioSub.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(function(){ HUD.el.radioSub.classList.remove('show'); }, 2000);
  },
  radio: function(name, text, hold){
    AudioSys.radioBlip();
    this.el.radioName.textContent = '📻 ' + name;
    this.el.radioText.textContent = text;
    this.el.radioSub.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(function(){ HUD.el.radioSub.classList.remove('show'); }, hold||6000);
  },
  wave: function(waveNum, title, sub){
    this.el.radioName.textContent = '⚔️ ' + title;
    this.el.radioText.textContent = sub || ('Wave ' + waveNum + ' Active');
    this.el.radioSub.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(function(){ HUD.el.radioSub.classList.remove('show'); }, 5000);
  },
  waveProgress: function(waveNum, kills, target){
    if (this.el.phase){
      this.el.phase.textContent = 'WAVE ' + waveNum + ' [' + kills + '/' + target + ']';
      this.el.phase.style.color = '#e04040';
    }
  },
  flashAcid: function(){
    var v = this.el.acidVignette;
    if (!v) return;
    v.style.opacity = '0.85';
    clearTimeout(this._acidFlashT);
    this._acidFlashT = setTimeout(function(){
      if (v) v.style.opacity = '0';
    }, 280);
  },
  showUplink: function(percent, active){
    var hud = this.el.uplinkHud;
    var bar = this.el.uplinkBar;
    var num = this.el.uplinkNum;
    if (!hud) return;
    if (!active){
      hud.style.display = 'none';
      return;
    }
    hud.style.display = 'flex';
    var p = Math.max(0, Math.min(100, Math.round(percent)));
    if (bar) bar.style.width = p + '%';
    if (num) num.textContent = p + '%';
  },
  showExtractionDebrief: function(stats){
    var modal = document.getElementById('extraction-modal');
    if (!modal) return;
    document.exitPointerLock && document.exitPointerLock();
    G.paused = true;
    modal.style.display = 'flex';

    var elSurv = document.getElementById('deb-surv-time');
    var elKills = document.getElementById('deb-kills');
    var elMut = document.getElementById('deb-mutants');
    var elScrap = document.getElementById('deb-scrap');
    var elHead = document.getElementById('deb-headshots');

    if (elSurv) elSurv.textContent = (stats && stats.timeStr) || '14m 32s';
    if (elKills) elKills.textContent = G.kills || 0;
    if (elMut) elMut.textContent = (stats && stats.mutants) || 8;
    if (elScrap) elScrap.textContent = (G.player && G.player.scrap) || 0;
    if (elHead) elHead.textContent = (stats && stats.headshots) || (Math.round((G.kills || 1) * 0.45));
  },
  spread: function(a){ this.spreadAmt = Math.min(2, this.spreadAmt + a); },
  spreadDecay: function(dt){ this.spreadAmt = Math.max(0, this.spreadAmt - dt*3); this.updateCrosshair(); },
  setADS: function(isADS, adsAmount){
    var ch = document.getElementById('crosshair');
    if (!ch) return;
    var a = typeof adsAmount === 'number' ? adsAmount : (isADS ? 1 : 0);
    a = Math.max(0, Math.min(1, a));
    ch.style.opacity = '1';
    var hip = document.getElementById('hip-crosshair');
    var ads = document.getElementById('ads-crosshair');
    if (hip){
      hip.style.opacity = Math.max(0, 1 - a * 1.3).toFixed(2);
      hip.style.transform = 'scale(' + (1 - a * 0.25).toFixed(2) + ')';
    } else {
      ch.style.opacity = '1';
    }
    if (ads){
      ads.style.opacity = Math.min(1, a * 1.3).toFixed(2);
      ads.style.transform = 'scale(' + (0.8 + a * 0.2).toFixed(2) + ')';
    }
  },
  updateCrosshair: function(){
    if (typeof G !== 'undefined' && G.player && G.player.inCar){
      var veh = document.getElementById('veh-crosshair');
      if (veh){
        if (G.aimDownSights){
          veh.classList.add('aiming');
        } else {
          veh.classList.remove('aiming');
        }
        var bl = veh.querySelector('.veh-bracket-l');
        var br = veh.querySelector('.veh-bracket-r');
        var baseOff = G.aimDownSights ? 16 : 22;
        var spreadOff = baseOff + this.spreadAmt * 12;
        if (bl) bl.style.left = (-spreadOff) + 'px';
        if (br) br.style.right = (-spreadOff) + 'px';
      }
      return;
    }
    var s = 6 + this.spreadAmt * 10;
    var hip = document.getElementById('hip-crosshair');
    var ch = hip || document.getElementById('crosshair');
    if (!ch) return;
    var t = ch.querySelector('.ch-t');
    var b = ch.querySelector('.ch-b');
    var l = ch.querySelector('.ch-left');
    var r = ch.querySelector('.ch-right');
    if (t) t.style.top = (-s - 8) + 'px';
    if (b) b.style.top = s + 'px';
    if (l) l.style.left = (-s - 8) + 'px';
    if (r) r.style.left = s + 'px';
  },

  minimap: function(){
    var c = this.mm, S = 180, scale = 0.35; // world->px
    c.clearRect(0, 0, S, S);
    c.save();

    // 1. Clip to rounded canvas bounds so rotated map elements stay inside frame
    var r = 4;
    c.beginPath();
    c.moveTo(r, 0);
    c.lineTo(S - r, 0);
    c.quadraticCurveTo(S, 0, S, r);
    c.lineTo(S, S - r);
    c.quadraticCurveTo(S, S, S - r, S);
    c.lineTo(r, S);
    c.quadraticCurveTo(0, S, 0, S - r);
    c.lineTo(0, r);
    c.quadraticCurveTo(0, 0, r, 0);
    c.closePath();
    c.clip();

    // 2. Center coordinate system on player
    c.translate(S / 2, S / 2);

    // 3. Facing orientation (player yaw on foot, or car body + camera yaw when driving)
    var viewYaw = (G.player && G.player.inCar)
      ? (G.player.inCar.rotY + (G.player.carCamYaw || 0))
      : ((G.player && G.player.yaw !== undefined) ? G.player.yaw : 0);

    // 4. Rotate entire map content so forward view always faces UP
    c.save();
    c.rotate(viewYaw);

    var px = G.player.pos.x, pz = G.player.pos.z;

    // roads grid
    c.strokeStyle = 'rgba(200,200,200,0.35)'; c.lineWidth = 3;
    var half = World.GRID * World.CELL / 2;
    for (var i = 0; i <= World.GRID; i++){
      var p = -half + i * World.CELL;
      c.beginPath(); c.moveTo((p - px) * scale, (-half - pz) * scale); c.lineTo((p - px) * scale, (half - pz) * scale); c.stroke();
      c.beginPath(); c.moveTo((-half - px) * scale, (p - pz) * scale); c.lineTo((half - px) * scale, (p - pz) * scale); c.stroke();
    }

    // sea
    c.fillStyle = 'rgba(40,90,110,0.5)';
    c.fillRect((half - px) * scale, -S * 1.5, 300, 3 * S);

    // objective
    if (G.objective){
      c.fillStyle = '#e8c060';
      c.beginPath(); c.arc((G.objective.x - px) * scale, (G.objective.z - pz) * scale, 4.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.stroke();
    }

    // safehouse bunker icon
    if (World.safehouse){
      c.fillStyle = '#ffaa33';
      c.strokeStyle = '#ffee88';
      c.lineWidth = 1.5;
      var shx = (World.safehouse.x - px) * scale;
      var shz = (World.safehouse.z - pz) * scale;
      c.strokeRect(shx - 4, shz - 4, 8, 8);
      c.fillRect(shx - 2, shz - 2, 4, 4);
    }

    // extraction communications tower / convoy (if active)
    if (typeof Extraction !== 'undefined' && Extraction.towerPos && Extraction.state !== 'inactive' && Extraction.state !== 'extracted'){
      var etx = (Extraction.towerPos.x - px) * scale;
      var etz = (Extraction.towerPos.z - pz) * scale;
      c.fillStyle = '#38bdf8';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(etx, etz, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // enemies
    for (var i = 0; i < G.enemies.length; i++){
      var e = G.enemies[i];
      if (e.dead) continue;
      c.fillStyle = e.type === 'zombie' ? '#7ac05a' : '#d05050';
      c.fillRect((e.x - px) * scale - 1.5, (e.z - pz) * scale - 1.5, 3, 3);
    }

    // cars (small grey rects)
    c.fillStyle = 'rgba(180,180,180,0.6)';
    for (var i = 0; i < G.cars.length; i++){
      var cc = G.cars[i];
      if (cc === G.player.inCar) continue;
      c.fillRect((cc.x - px) * scale - 1, (cc.z - pz) * scale - 1, 2, 2);
    }

    // Restore map rotation so HUD indicators (North indicator, player chevron) stay oriented
    c.restore();

    // 5. Compass North indicator tracking true North around the perimeter
    var northAngle = viewYaw - Math.PI / 2;
    var northR = S / 2 - 11;
    var nx = Math.cos(northAngle) * northR;
    var ny = Math.sin(northAngle) * northR;
    c.font = 'bold 9px "Segoe UI", sans-serif';
    c.fillStyle = '#ff4d4d';
    c.shadowColor = 'rgba(0, 0, 0, 0.8)';
    c.shadowBlur = 2;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('N', nx, ny);
    c.shadowBlur = 0;

    // 6. Player Chevron: Centered & FIXED pointing straight UP
    c.fillStyle = '#ffffff';
    c.shadowColor = 'rgba(0, 0, 0, 0.85)';
    c.shadowBlur = 3;
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(4.5, 4.5);
    c.lineTo(0, 2);
    c.lineTo(-4.5, 4.5);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;

    c.restore();
  },

  // --- IN-CAR SPEEDOMETER & INSTRUMENT CLUSTER ---
  // --- MOTORSPORT RACING TELEMETRY HUD (PURE 2D CANVAS + 4 RACING THEMES) ---
  // --- IN-CAR SPEEDOMETER & INSTRUMENT CLUSTER ---
  // --- TRANSPARENT MOTORSPORT TACHOMETER & SPEEDOMETER GAUGE ---
  speedoThemes: {
    amber: {
      name: 'JDM AMBER',
      primary: '#ff9e00',
      secondary: '#ff6200',
      accent: '#ffe066',
      redline: '#ff2a00',
      glow: 'rgba(255, 158, 0, 0.45)',
      tick: '#ffaa00'
    },
    toxic: {
      name: 'TOXIC LIME',
      primary: '#6ee7b7',
      secondary: '#a3ff12',
      accent: '#eaff66',
      redline: '#ff0055',
      glow: 'rgba(110, 231, 183, 0.45)',
      tick: '#a3ff12'
    },
    crimson: {
      name: 'TRACK CRIMSON',
      primary: '#ff1e42',
      secondary: '#ff471a',
      accent: '#ff8599',
      redline: '#ff002f',
      glow: 'rgba(255, 30, 66, 0.45)',
      tick: '#ff3355'
    },
    monochrome: {
      name: 'GHOST MONOCHROME',
      primary: '#ffffff',
      secondary: '#c0c6d0',
      accent: '#ffd000',
      redline: '#ff2a2a',
      glow: 'rgba(255, 255, 255, 0.35)',
      tick: '#e2e8f0'
    }
  },

  setSpeedoTheme: function(themeKey){
    if (!this.speedoThemes[themeKey]) themeKey = 'toxic';
    if (!G.settings) G.settings = {};
    G.settings.speedoTheme = themeKey;
    try {
      localStorage.setItem('vespera_speedo_theme', themeKey);
      localStorage.setItem('vespera_settings', JSON.stringify(G.settings));
    } catch(e){}

    var themeKeys = ['amber', 'toxic', 'crimson', 'monochrome'];
    for (var i = 0; i < themeKeys.length; i++){
      var btn = document.getElementById('btn-theme-' + themeKeys[i]);
      if (btn){
        if (themeKeys[i] === themeKey) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    }
    var valBadge = document.getElementById('val-speedo-theme');
    if (valBadge){
      var names = { amber: 'JDM AMBER', toxic: 'TOXIC LIME', crimson: 'CRIMSON', monochrome: 'GHOST' };
      valBadge.textContent = names[themeKey] || 'TOXIC LIME';
    }
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.18, 1400, 0.02);
  },

  setSpeedoUnit: function(unit){
    if (unit !== 'MPH' && unit !== 'KM/H') unit = 'KM/H';
    if (!G.settings) G.settings = {};
    G.settings.speedoUnit = unit;
    try {
      localStorage.setItem('vespera_speedo_unit', unit);
      localStorage.setItem('vespera_settings', JSON.stringify(G.settings));
    } catch(e){}

    var btnM = document.getElementById('btn-unit-mph');
    var btnK = document.getElementById('btn-unit-kmh');
    if (btnM && btnK){
      if (unit === 'MPH'){ btnM.classList.add('active'); btnK.classList.remove('active'); }
      else { btnK.classList.add('active'); btnM.classList.remove('active'); }
    }
    var valU = document.getElementById('val-speedo-unit');
    if (valU) valU.textContent = unit;
    if (typeof AudioSys !== 'undefined' && AudioSys.click) AudioSys.click(0.18, 1200, 0.02);
  },

  toggleSpeedoUnit: function(){
    var cur = (G.settings && G.settings.speedoUnit) ? G.settings.speedoUnit : 'KM/H';
    this.setSpeedoUnit(cur === 'MPH' ? 'KM/H' : 'MPH');
  },

  drawTransparentGauge: function(ctx, w, h, smoothedSpeed, displaySpeed, rpm, gear, unit, theme, status){
    if (!ctx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var cx = 116;
    var cy = 126;
    var R = 84;
    var startAngle = 0.75 * Math.PI; // 135 deg (bottom left, 0 RPM)
    var endAngle = 2.25 * Math.PI;   // 405 deg = 45 deg (bottom right, 9 RPM)
    var sweep = endAngle - startAngle; // 1.5 * Math.PI (270 deg)

    // 1. Outer Tachometer Arcs
    // Normal Zone: 0 to 7.5k RPM (white arc)
    var splitRatio = 7.5 / 9.0;
    var splitAngle = startAngle + splitRatio * sweep;

    ctx.beginPath();
    ctx.arc(cx, cy, R, startAngle, splitAngle);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.stroke();

    // Redline Zone: 7.5k to 9.0k RPM (red arc + glow)
    ctx.beginPath();
    ctx.arc(cx, cy, R, splitAngle, endAngle);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#ff2e56';
    ctx.shadowColor = '#ff2e56';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Redline outer halo strip
    ctx.beginPath();
    ctx.arc(cx, cy, R + 3, splitAngle, endAngle);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(255, 46, 86, 0.45)';
    ctx.stroke();

    // 2. Radial Tick Marks & RPM Numbers (0 to 9)
    for (var i = 0; i <= 45; i++){
      var val = i * 0.2;
      var ratio = i / 45;
      var angle = startAngle + ratio * sweep;
      var isMajor = (i % 5 === 0);
      var isRed = (val >= 7.5);
      var cos = Math.cos(angle);
      var sin = Math.sin(angle);
      var tickLen = isMajor ? 9 : 4.5;

      ctx.beginPath();
      ctx.moveTo(cx + cos * R, cy + sin * R);
      ctx.lineTo(cx + cos * (R + tickLen), cy + sin * (R + tickLen));
      ctx.lineWidth = isMajor ? 1.6 : 0.9;
      ctx.strokeStyle = isRed ? '#ff2e56' : (isMajor ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.42)');
      ctx.stroke();

      if (isMajor){
        var numDist = R - 13;
        var nx = cx + cos * numDist;
        var ny = cy + sin * numDist;
        ctx.font = 'bold 12.5px "Segoe UI", system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isRed ? '#ff2e56' : 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(String(Math.round(val)), nx, ny);
      }
    }

    // 3. Embedded Dashboard Status Icons (Inside Dial)
    // Hazard Indicator (◄ ►)
    var isHz = !!(status && status.isHazard);
    var hzColor = isHz ? '#fbbf24' : 'rgba(255, 255, 255, 0.18)';
    ctx.fillStyle = hzColor;
    ctx.strokeStyle = hzColor;
    ctx.lineWidth = 1.2;
    if (isHz) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 6; }
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 42);
    ctx.lineTo(cx - 5, cy - 46);
    ctx.lineTo(cx - 5, cy - 38);
    ctx.closePath();
    ctx.fill();
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(cx + 10, cy - 42);
    ctx.lineTo(cx + 5, cy - 46);
    ctx.lineTo(cx + 5, cy - 38);
    ctx.closePath();
    ctx.fill();
    // Center bar
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 42);
    ctx.lineTo(cx + 3, cy - 42);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Headlight / High Beam Icon (D)
    var isNight = !!(status && status.isNight);
    var hlColor = isNight ? '#38bdf8' : 'rgba(255, 255, 255, 0.18)';
    ctx.strokeStyle = hlColor;
    ctx.lineWidth = 1.3;
    if (isNight) { ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 6; }
    ctx.beginPath();
    ctx.arc(cx - 25, cy - 23, 5.5, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(cx - 25, cy - 28.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy - 27); ctx.lineTo(cx - 36, cy - 27);
    ctx.moveTo(cx - 28, cy - 23); ctx.lineTo(cx - 36, cy - 23);
    ctx.moveTo(cx - 28, cy - 19); ctx.lineTo(cx - 36, cy - 19);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Check Engine Light
    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = '#22c55e';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 5;
    ctx.strokeRect(cx + 36, cy - 17, 12, 8);
    ctx.strokeRect(cx + 33, cy - 15, 3, 4);
    ctx.strokeRect(cx + 39, cy - 20, 6, 3);
    ctx.shadowBlur = 0;

    // ABS Indicator
    var isBraking = !!(status && status.isBraking);
    ctx.font = 'bold 9.5px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isBraking ? '#fbbf24' : 'rgba(255, 255, 255, 0.6)';
    if (isBraking) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 6; }
    ctx.fillText('ABS', cx - 38, cy + 18);
    ctx.shadowBlur = 0;

    // HBK (Handbrake / Staging) Indicator
    var isHbk = !!(status && (status.handbrake || status.isStaging));
    ctx.font = 'bold 9.5px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHbk ? '#ef4444' : 'rgba(255, 255, 255, 0.35)';
    if (isHbk) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8; }
    ctx.fillText('HBK', cx - 38, cy + 32);
    ctx.shadowBlur = 0;

    // Fuel Pump Icon
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 5;
    ctx.strokeRect(cx - 20, cy + 44, 7, 11);
    ctx.strokeRect(cx - 19, cy + 46, 5, 3);
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 52);
    ctx.lineTo(cx - 10, cy + 52);
    ctx.lineTo(cx - 10, cy + 46);
    ctx.lineTo(cx - 12, cy + 44);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 4. Center Hub & Gear Indicator
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.88)';
    ctx.fill();
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.stroke();

    // Outer stylish arc
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0.65 * Math.PI, 1.85 * Math.PI);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.stroke();

    // Center Gear text
    var gearStr = String(gear || '1').toUpperCase();
    ctx.font = 'italic bold 23px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gearStr, cx, cy + 1);

    // 5. Razor Racing Needle (Speedometer Gauge)
    var needleRatio = 0;
    if (status && status.isStaging){
      var clampedRpm = clamp(rpm || 950, 950, 9000);
      needleRatio = clamp((clampedRpm - 950) / (8500 - 950), 0, 1.0);
    } else {
      var maxGaugeSpeed = (unit === 'MPH' ? 90.0 : 150.0);
      needleRatio = clamp(smoothedSpeed / maxGaugeSpeed, 0, 1.0);
    }
    var needleAngle = startAngle + needleRatio * sweep;
    var bx = cx + Math.cos(needleAngle) * 22;
    var by = cy + Math.sin(needleAngle) * 22;
    var tx = cx + Math.cos(needleAngle) * (R - 8);
    var ty = cy + Math.sin(needleAngle) * (R - 8);

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 6. Digital Speed Display (Bottom-Right of Gauge)
    var sx = cx + 64;
    var sy = cy + 62;

    // Speed Unit (KMH or MPH)
    var unitStr = (unit === 'MPH' ? 'MPH' : 'KMH');
    ctx.font = 'italic bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(unitStr, sx, sy - 26);

    // Big Hollow Glowing Neon Numbers (000)
    var spdStr = String(Math.max(0, Math.round(displaySpeed))).padStart(3, '0');
    ctx.font = 'italic 800 48px "Segoe UI", system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var spdColor = theme.primary || '#6ee7b7';
    ctx.shadowColor = theme.glow || 'rgba(110, 231, 183, 0.5)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = spdColor;
    ctx.lineWidth = 2.6;
    ctx.strokeText(spdStr, sx, sy);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillText(spdStr, sx, sy);
    ctx.shadowBlur = 0;
  },

  initCarCluster: function(){
    var canvas = document.getElementById('cc-gauge-canvas');
    var ctx = null;
    if (canvas){
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = 280 * dpr;
      canvas.height = 280 * dpr;
      ctx = canvas.getContext('2d');
    }

    this.elCar = {
      cluster: document.getElementById('car-cluster'),
      canvas: canvas,
      ctx: ctx,
      bottomRight: document.getElementById('bottom-right'),
      btnStageRev: document.getElementById('btn-stage-rev')
    };

    if (this.elCar.btnStageRev && this.elCar.btnStageRev.addEventListener && !this.elCar.btnStageRev._bound){
      this.elCar.btnStageRev._bound = true;
      var onStage = function(e){ if (e && e.preventDefault) e.preventDefault(); G.keys['KeyZ'] = true; };
      var offStage = function(e){ if (e && e.preventDefault) e.preventDefault(); G.keys['KeyZ'] = false; };
      this.elCar.btnStageRev.addEventListener('mousedown', onStage);
      window.addEventListener('mouseup', offStage);
      this.elCar.btnStageRev.addEventListener('touchstart', onStage, { passive: false });
      window.addEventListener('touchend', offStage);
    }

    this._dispSpeed = 0;
    this._dispRpm = 950;
  },

  enterCar: function(car){
    if (!this.elCar) this.initCarCluster();
    if (this.elCar.bottomRight) this.elCar.bottomRight.style.display = 'none';
    if (this.elCar.cluster) this.elCar.cluster.style.display = 'block';
    if (this.elCar.btnStageRev) this.elCar.btnStageRev.style.display = 'flex';

    var cwh = document.getElementById('car-weapon-hud');
    if (cwh) cwh.style.display = 'block';

    // Activate dedicated vehicular drive-by crosshair
    var ch = document.getElementById('crosshair');
    if (ch) ch.style.display = 'block';
    var hip = document.getElementById('hip-crosshair');
    if (hip) hip.style.display = 'none';
    var ads = document.getElementById('ads-crosshair');
    if (ads) ads.style.display = 'none';
    var veh = document.getElementById('veh-crosshair');
    if (veh) veh.style.display = 'block';

    // Populate in-car weapon HUD with currently equipped weapon
    if (typeof Weapons !== 'undefined' && Weapons.state){
      var st = Weapons.state;
      this.updateCarWeapon(Weapons.current, st.mag, st.reserve, st.reloading > 0);
    }

    var themeKey = (G.settings && G.settings.speedoTheme) || localStorage.getItem('vespera_speedo_theme') || 'toxic';
    this.setSpeedoTheme(themeKey);
    var unit = (G.settings && G.settings.speedoUnit) || localStorage.getItem('vespera_speedo_unit') || 'KM/H';
    this.setSpeedoUnit(unit);
  },

  exitCar: function(){
    if (!this.elCar) this.initCarCluster();
    if (this.elCar.cluster) this.elCar.cluster.style.display = 'none';
    if (this.elCar.btnStageRev) this.elCar.btnStageRev.style.display = 'none';
    if (this.elCar.bottomRight) this.elCar.bottomRight.style.display = 'block';

    var cwh = document.getElementById('car-weapon-hud');
    if (cwh) cwh.style.display = 'none';

    // Restore standard on-foot FPS crosshairs
    var hip = document.getElementById('hip-crosshair');
    if (hip) hip.style.display = '';
    var ads = document.getElementById('ads-crosshair');
    if (ads) ads.style.display = '';
    var veh = document.getElementById('veh-crosshair');
    if (veh) veh.style.display = 'none';
  },

  updateCarWeapon: function(id, mag, res, isReloading){
    var el = document.getElementById('car-weapon-hud');
    if (!el) return;
    var elSlot = document.getElementById('cwh-slot');
    var elName = document.getElementById('cwh-name');
    var elMode = document.getElementById('cwh-mode');
    var elMag = document.getElementById('cwh-mag');
    var elRes = document.getElementById('cwh-res');
    var elStatus = document.getElementById('cwh-status');
    var elPips = document.getElementById('cwh-pips');

    var names = {
      ak47: { slot: '1', name: 'ACR 5.56 SILENCED', mode: 'AUTO' },
      shotgun: { slot: '2', name: 'REMINGTON 870', mode: 'PUMP' },
      magnum: { slot: '3', name: '.357 MAGNUM', mode: 'SEMI' }
    };
    var info = names[id] || { slot: '1', name: 'WEAPON', mode: 'FIRE' };

    if (elSlot) elSlot.textContent = info.slot;
    if (elName) elName.textContent = info.name;
    if (elMode) elMode.textContent = info.mode;
    if (elMag) elMag.textContent = mag;
    if (elRes) elRes.textContent = res;
    if (elStatus){
      if (isReloading){
        elStatus.textContent = 'RELOADING';
        elStatus.className = 'cwh-status reloading';
      } else if (mag === 0){
        elStatus.textContent = 'EMPTY [R]';
        elStatus.className = 'cwh-status empty';
      } else if (typeof G !== 'undefined' && G.aimDownSights){
        elStatus.textContent = 'AIM LOCK';
        elStatus.className = 'cwh-status aiming';
      } else {
        elStatus.textContent = 'READY';
        elStatus.className = 'cwh-status ready';
      }
    }

    if (elPips){
      var maxMag = (typeof Weapons !== 'undefined' && Weapons.list && Weapons.list[id] && Weapons.list[id].mag) ? Weapons.list[id].mag : 30;
      if (elPips.children.length !== maxMag){
        elPips.innerHTML = '';
        var isWide = (maxMag <= 8);
        for (var i = 0; i < maxMag; i++){
          var pip = document.createElement('span');
          pip.className = 'cwh-pip' + (isWide ? ' cwh-pip-wide' : '');
          elPips.appendChild(pip);
        }
      }
      for (var j = 0; j < elPips.children.length; j++){
        if (j < mag){
          elPips.children[j].classList.remove('spent');
        } else {
          elPips.children[j].classList.add('spent');
        }
      }
    }
  },

  setCarCamBadge: function(name){
    if (this.toast) this.toast('CAM: ' + name);
  },

  updateCar: function(car, dt, telem){
    if (!this.elCar) this.initCarCluster();
    if (!this.elCar.cluster || this.elCar.cluster.style.display === 'none') return;

    var isMph = (G.settings && G.settings.speedoUnit === 'MPH');
    var rawSpd = Math.abs((telem && telem.speed !== undefined) ? telem.speed : (car.speed || 0));
    var roadSpeed = isMph ? (rawSpd * 2.237) : (rawSpd * 3.6);

    this._dispSpeed += (roadSpeed - this._dispSpeed) * Math.min(1.0, dt * 14.0);
    var displaySpeedNum = Math.round(this._dispSpeed);

    var isStaging = !!(telem && telem.isStaging);
    var curRpm = (telem && telem.rpm !== undefined) ? telem.rpm : (car.rpm || 950);
    this._dispRpm += (curRpm - this._dispRpm) * Math.min(1.0, dt * 16.0);
    var rpmVal = Math.round(this._dispRpm);

    var displaySpeed = isStaging ? 0 : displaySpeedNum;
    var gear = isStaging ? 'P' : ((telem && telem.gear !== undefined) ? telem.gear : (car.gear || 1));
    var unit = isMph ? 'MPH' : 'KM/H';

    if (this.elCar.ctx){
      var themeKey = (G.settings && G.settings.speedoTheme) || 'toxic';
      var theme = this.speedoThemes[themeKey] || this.speedoThemes.toxic;
      var status = {
        isNight: !!G.isNight,
        handbrake: !!(telem && telem.handbrake),
        isStaging: isStaging,
        isBraking: !!(telem && telem.brake > 0 && roadSpeed > 5),
        isHazard: false
      };
      this.drawTransparentGauge(this.elCar.ctx, 280, 280, this._dispSpeed, displaySpeed, rpmVal, gear, unit, theme, status);
    }
  }

};
