// Vespera - touch controls: left stick = move, right drag = look, action buttons.
var Touch = {
  moveId: null, lookId: null, lookX: 0, lookY: 0,

  init: function(){
    if (!G.isMobile) return;
    document.getElementById('touch-ui').classList.add('active');
    var joy = document.getElementById('joy-move');
    var knob = document.getElementById('joy-knob');
    var zone = document.getElementById('look-zone');
    var self = this;

    function joyMove(e){
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
    joy.addEventListener('touchstart', function(e){ e.preventDefault(); self.moveId = e.targetTouches[0].identifier; joyMove(e); });
    joy.addEventListener('touchmove', function(e){ e.preventDefault(); joyMove(e); });
    joy.addEventListener('touchend', function(e){
      for (var i=0;i<e.changedTouches.length;i++)
        if (e.changedTouches[i].identifier===self.moveId){ self.moveId=null; G.touch.moveX=0; G.touch.moveZ=0; knob.style.left='38px'; knob.style.top='38px'; }
    });

    zone.addEventListener('touchstart', function(e){ e.preventDefault();
      var t = e.changedTouches[0]; self.lookId = t.identifier; self.lookX = t.clientX; self.lookY = t.clientY;
    });
    zone.addEventListener('touchmove', function(e){ e.preventDefault();
      for (var i=0;i<e.changedTouches.length;i++){
        var t = e.changedTouches[i];
        if (t.identifier !== self.lookId) continue;
        G.touch.lookDX += (t.clientX - self.lookX);
        G.touch.lookDY += (t.clientY - self.lookY);
        self.lookX = t.clientX; self.lookY = t.clientY;
      }
    });
    zone.addEventListener('touchend', function(e){
      for (var i=0;i<e.changedTouches.length;i++)
        if (e.changedTouches[i].identifier===self.lookId) self.lookId=null;
    });

    function bindBtn(id, down, up){
      var el = document.getElementById(id);
      el.addEventListener('touchstart', function(e){ e.preventDefault(); el.classList.add('on'); down(); });
      el.addEventListener('touchend', function(e){ e.preventDefault(); el.classList.remove('on'); if (up) up(); });
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
        e.preventDefault();
        if (window.enterMobileLandscape) window.enterMobileLandscape();
      });
    }
  }
};
