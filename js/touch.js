// Vespera - Tactical Touch Controls & Interactive Custom HUD Designer
var Touch = {
  moveId: null, lookId: null, lookX: 0, lookY: 0,
  isEditing: false,
  selectedKey: null,

  // Elevated, ergonomic default positions (lifted safely above Android gesture bar)
  defaultLayout: {
    'joy-move':      { leftPct: 6,  bottomPct: 15, scale: 1.05 },
    'btn-sprint':    { leftPct: 24, bottomPct: 15, scale: 1.0 },
    'btn-fire':      { rightPct: 8, bottomPct: 22, scale: 1.2 },
    'btn-jump':      { rightPct: 20, bottomPct: 12, scale: 1.05 },
    'btn-enter':     { rightPct: 20, bottomPct: 28, scale: 1.0 },
    'btn-reload':    { rightPct: 8,  bottomPct: 42, scale: 1.0 },
    'btn-stage-rev': { rightPct: 20, bottomPct: 44, scale: 1.0 },
  },

  controlNames: {
    'joy-move': 'MOVEMENT JOYSTICK',
    'btn-sprint': 'SPRINT / RUN',
    'btn-fire': 'PRIMARY WEAPON FIRE',
    'btn-jump': 'JUMP / VAULT',
    'btn-enter': 'ENTER / EXIT VEHICLE',
    'btn-reload': 'RELOAD MAGAZINE (R)',
    'btn-stage-rev': 'STAGING REV / BOOST',
    'btn-mobile-fs': 'FULLSCREEN TOGGLE'
  },

  currentLayout: null,

  loadLayout: function(){
    try {
      var saved = localStorage.getItem('vespera_custom_hud');
      if (saved){
        this.currentLayout = JSON.parse(saved);
      }
    } catch(e){}
    if (!this.currentLayout){
      this.currentLayout = JSON.parse(JSON.stringify(this.defaultLayout));
    }
  },

  applyLayout: function(){
    if (!this.currentLayout) this.loadLayout();
    var layout = this.currentLayout;
    for (var key in layout){
      var el = document.getElementById(key);
      if (!el) continue;
      var item = layout[key];
      if (typeof item.leftPct === 'number'){
        el.style.left = item.leftPct + '%';
        el.style.right = 'auto';
      } else if (typeof item.rightPct === 'number'){
        el.style.right = item.rightPct + '%';
        el.style.left = 'auto';
      }
      if (typeof item.bottomPct === 'number'){
        el.style.bottom = item.bottomPct + '%';
        el.style.top = 'auto';
      } else if (typeof item.topPct === 'number'){
        el.style.top = item.topPct + '%';
        el.style.bottom = 'auto';
      }
      var s = (typeof item.scale === 'number') ? item.scale : 1.0;
      el.style.transform = 'scale(' + s + ')';
      el.style.transformOrigin = 'center center';
    }
  },

  init: function(){
    this.loadLayout();
    this.applyLayout();

    var self = this;
    window.addEventListener('resize', function(){
      self.applyLayout();
    });

    if (!G.isMobile) return;
    var touchUi = document.getElementById('touch-ui');
    if (touchUi) touchUi.classList.add('active');

    var joy = document.getElementById('joy-move');
    var knob = document.getElementById('joy-knob');
    var zone = document.getElementById('look-zone');

    function joyMove(e){
      if (self.isEditing) return;
      var t = e.targetTouches[0];
      if (!t) return;
      var r = joy.getBoundingClientRect();
      var dx = t.clientX - (r.left + r.width/2);
      var dy = t.clientY - (r.top + r.height/2);
      var m = Math.min(1, Math.sqrt(dx*dx+dy*dy)/(r.width/2));
      var a = Math.atan2(dy,dx);
      var kx = Math.cos(a)*m, ky = Math.sin(a)*m;
      G.touch.moveX = kx; G.touch.moveZ = ky;
      knob.style.left = (38 + kx*34) + 'px';
      knob.style.top = (38 + ky*34) + 'px';
    }
    joy.addEventListener('touchstart', function(e){ if (self.isEditing) return; e.preventDefault(); self.moveId = e.targetTouches[0].identifier; joyMove(e); });
    joy.addEventListener('touchmove', function(e){ if (self.isEditing) return; e.preventDefault(); joyMove(e); });
    joy.addEventListener('touchend', function(e){
      if (self.isEditing) return;
      for (var i=0;i<e.changedTouches.length;i++)
        if (e.changedTouches[i].identifier===self.moveId){ self.moveId=null; G.touch.moveX=0; G.touch.moveZ=0; knob.style.left='38px'; knob.style.top='38px'; }
    });

    zone.addEventListener('touchstart', function(e){
      if (self.isEditing) return;
      e.preventDefault();
      var t = e.changedTouches[0]; self.lookId = t.identifier; self.lookX = t.clientX; self.lookY = t.clientY;
    });
    zone.addEventListener('touchmove', function(e){
      if (self.isEditing) return;
      e.preventDefault();
      for (var i=0;i<e.changedTouches.length;i++){
        var t = e.changedTouches[i];
        if (t.identifier !== self.lookId) continue;
        G.touch.lookDX += (t.clientX - self.lookX);
        G.touch.lookDY += (t.clientY - self.lookY);
        self.lookX = t.clientX; self.lookY = t.clientY;
      }
    });
    zone.addEventListener('touchend', function(e){
      if (self.isEditing) return;
      for (var i=0;i<e.changedTouches.length;i++)
        if (e.changedTouches[i].identifier===self.lookId) self.lookId=null;
    });

    function bindBtn(id, down, up){
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', function(e){
        if (self.isEditing) return;
        e.preventDefault();
        el.classList.add('on');
        down();
      });
      el.addEventListener('touchend', function(e){
        if (self.isEditing) return;
        e.preventDefault();
        el.classList.remove('on');
        if (up) up();
      });
    }
    bindBtn('btn-fire', function(){ G.touch.fire = true; Weapons.fire(); }, function(){ G.touch.fire = false; });
    bindBtn('btn-jump', function(){ G.touch.jump = true; }, function(){ G.touch.jump = false; });
    bindBtn('btn-enter', function(){ Player.toggleCar(); });
    bindBtn('btn-reload', function(){ Weapons.reload(); });
    bindBtn('btn-sprint', function(){ G.player.sprint = !G.player.sprint;
      document.getElementById('btn-sprint').classList.toggle('on', G.player.sprint); });

    var stageBtn = document.getElementById('btn-stage-rev');
    if (stageBtn){
      bindBtn('btn-stage-rev', function(){ G.keys['KeyZ'] = true; }, function(){ G.keys['KeyZ'] = false; });
    }

    var fsBtn = document.getElementById('btn-mobile-fs');
    if (fsBtn){
      fsBtn.addEventListener('click', function(e){
        e.preventDefault();
        if (window.enterMobileLandscape) window.enterMobileLandscape();
      });
      fsBtn.addEventListener('touchstart', function(e){
        if (self.isEditing) return;
        e.preventDefault();
        if (window.enterMobileLandscape) window.enterMobileLandscape();
      });
    }
  },

  openCustomEditor: function(){
    this.isEditing = true;
    this.loadLayout();
    this.applyLayout();

    var touchUi = document.getElementById('touch-ui');
    if (touchUi){
      touchUi.classList.add('active', 'editing');
    }
    var editorOv = document.getElementById('hud-editor-overlay');
    if (editorOv){
      editorOv.style.display = 'flex';
    }

    this.bindEditorDragHandles();
    this.selectElement('btn-fire');
  },

  closeCustomEditor: function(){
    this.isEditing = false;
    this.selectedKey = null;

    var touchUi = document.getElementById('touch-ui');
    if (touchUi){
      touchUi.classList.remove('editing');
      if (!G.isMobile && (!G.paused || !document.getElementById('hud').classList.contains('active'))){
        touchUi.classList.remove('active');
      }
    }
    var editorOv = document.getElementById('hud-editor-overlay');
    if (editorOv){
      editorOv.style.display = 'none';
    }
    var cPanel = document.getElementById('he-control-panel');
    if (cPanel) cPanel.style.display = 'none';

    document.querySelectorAll('#touch-ui .he-selected').forEach(function(el){
      el.classList.remove('he-selected');
    });

    this.applyLayout();
  },

  selectElement: function(key){
    this.selectedKey = key;
    var el = document.getElementById(key);
    if (!el) return;

    document.querySelectorAll('#touch-ui .he-selected').forEach(function(node){
      node.classList.remove('he-selected');
    });
    el.classList.add('he-selected');

    var cPanel = document.getElementById('he-control-panel');
    if (cPanel) cPanel.style.display = 'flex';

    var nameEl = document.getElementById('he-selected-name');
    if (nameEl) nameEl.textContent = this.controlNames[key] || key.toUpperCase();

    var item = (this.currentLayout && this.currentLayout[key]) || this.defaultLayout[key] || {};
    var s = (typeof item.scale === 'number') ? item.scale : 1.0;
    var scaleEl = document.getElementById('he-selected-scale');
    if (scaleEl) scaleEl.textContent = Math.round(s * 100) + '%';
  },

  adjustSelectedScale: function(delta){
    if (!this.selectedKey) return;
    var key = this.selectedKey;
    if (!this.currentLayout[key]){
      this.currentLayout[key] = JSON.parse(JSON.stringify(this.defaultLayout[key] || {}));
    }
    var item = this.currentLayout[key];
    var s = (typeof item.scale === 'number') ? item.scale : 1.0;
    s = Math.max(0.65, Math.min(1.65, Math.round((s + delta) * 10) / 10));
    item.scale = s;

    var el = document.getElementById(key);
    if (el){
      el.style.transform = 'scale(' + s + ')';
      el.style.transformOrigin = 'center center';
    }
    var scaleEl = document.getElementById('he-selected-scale');
    if (scaleEl) scaleEl.textContent = Math.round(s * 100) + '%';
  },

  saveCustomLayout: function(){
    try {
      localStorage.setItem('vespera_custom_hud', JSON.stringify(this.currentLayout));
    } catch(e){}
    if (typeof HUD !== 'undefined' && HUD.toast){
      HUD.toast('HUD LAYOUT SAVED & APPLIED');
    }
    this.closeCustomEditor();
  },

  resetCustomLayout: function(){
    this.currentLayout = JSON.parse(JSON.stringify(this.defaultLayout));
    try {
      localStorage.removeItem('vespera_custom_hud');
    } catch(e){}
    this.applyLayout();
    if (this.selectedKey){
      this.selectElement(this.selectedKey);
    }
    if (typeof HUD !== 'undefined' && HUD.toast){
      HUD.toast('DEFAULT HUD RESTORED');
    }
  },

  bindEditorDragHandles: function(){
    var self = this;
    var keys = Object.keys(this.defaultLayout);

    keys.forEach(function(key){
      var el = document.getElementById(key);
      if (!el || el._dragBound) return;
      el._dragBound = true;

      function onDown(e){
        if (!self.isEditing) return;
        e.preventDefault();
        e.stopPropagation();

        self.selectElement(key);

        var pageX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        var pageY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;

        var rect = el.getBoundingClientRect();
        var offsetX = pageX - rect.left;
        var offsetY = pageY - rect.top;

        function onMove(ev){
          ev.preventDefault();
          var curX = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
          var curY = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;

          var newLeft = curX - offsetX;
          var newTop = curY - offsetY;

          var maxLeft = window.innerWidth - rect.width - 8;
          var maxTop = window.innerHeight - rect.height - 8;
          newLeft = Math.max(8, Math.min(maxLeft, newLeft));
          newTop = Math.max(8, Math.min(maxTop, newTop));

          var leftPct = parseFloat(((newLeft / window.innerWidth) * 100).toFixed(1));
          var bottomPct = parseFloat((((window.innerHeight - (newTop + rect.height)) / window.innerHeight) * 100).toFixed(1));

          if (!self.currentLayout[key]){
            self.currentLayout[key] = JSON.parse(JSON.stringify(self.defaultLayout[key] || {}));
          }
          var entry = self.currentLayout[key];
          entry.leftPct = leftPct;
          entry.bottomPct = bottomPct;
          delete entry.rightPct;
          delete entry.topPct;

          el.style.left = leftPct + '%';
          el.style.bottom = bottomPct + '%';
          el.style.right = 'auto';
          el.style.top = 'auto';
        }

        function onUp(){
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onUp);
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
      }

      el.addEventListener('pointerdown', onDown);
      el.addEventListener('touchstart', onDown, { passive: false });
    });
  }
};
