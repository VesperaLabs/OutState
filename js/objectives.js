// Vespera - story & objectives: the radio voice guides you. Survive till dawn.
var Objectives = {
  step: 0, waveCount: 0, waveNeed: 8, waveActive: false, storyIdx: 0,

  story: [
    { radio:['VESPERA RADIO',"You're awake. Good. Don't ask how I know — the radio tells me things. That car you're sitting in? It's yours. Keep it moving."] },
    { text:'Drive. Get a feel for the Vespera GT.', drive:true },
    { radio:['VESPERA RADIO',"The fog takes the city at dusk. Infected walk the streets all night. By day, the scavengers come — they shoot first. Get to the safehouse marked on your map before dark."] },
    { text:'Reach the safehouse (yellow marker).', goto:'safehouse' },
    { radio:['VESPERA RADIO',"That safehouse holds a generator. It keeps the fog thin for blocks around. But you can't hide forever — the city needs supplies."] },
    { text:'Clear 8 infected around the docks (marker).', killWave:8, goto:'docks' },
    { radio:['VESPERA RADIO',"You shoot like you've done this before. Muscle memory from a life you can't remember. Whoever you were, Vespera doesn't care. Vespera only asks: survive till dawn."] },
    { text:'Survive till dawn. Then drive.', surviveNight:true },
    { radio:['MAJOR VANCE — EVAC 1',"Attention any surviving units on this frequency: Sector quarantine lockdown is underway. Boulevard Relay Tower 9 is disabled. Reach the communications tower to signal our extraction convoy."] },
    { text:'Reach Boulevard Communications Relay Tower 9 (star marker).', goto:'tower' },
    { radio:['MAJOR VANCE — EVAC 1',"Transmitter console located. Repair the generator and activate the distress uplink [E]. Hold that plaza against the horde until the armored convoy arrives."] },
    { text:'Repair & Activate Distress Uplink [E] at the tower.', interactTower:true }
  ],

  docks: null,

  init: function(){
    // dock marker: east edge
    var half = World.GRID*World.CELL/2;
    this.docks = { x: half - 10, z: -half + World.CELL*1.5 };
  },

  current: function(){ return this.story[this.step]; },

  begin: function(){
    this.advance(0);
  },

  advance: function(i){
    this.step = i !== undefined ? i : this.step+1;
    var s = this.story[this.step];
    if (!s){ this.loopEnd(); return; }
    if (s.radio) HUD.radio(s.radio[0], s.radio[1], s.radio[2]||7000);
    if (s.drive){
      G.objective = null;
      HUD.objective(s.text);
      setTimeout(function(){ Objectives.advance(); }, 9000);
    }
    if (s.goto) {
      var tgt = s.goto==='safehouse' ? World.safehouse : (s.goto==='docks'? this.docks : (s.goto==='tower' && typeof Extraction !== 'undefined' ? Extraction.towerPos : (s.goto==='convoy' && typeof Extraction !== 'undefined' ? Extraction.convoyPos : null)));
      G.objective = tgt ? { x:tgt.x, z:tgt.z } : null;
      HUD.objective(s.text);
    }
    if (s.killWave){
      this.waveActive = true; this.waveCount = 0; this.waveNeed = s.killWave;
      HUD.objective(s.text);
    }
    if (s.surviveNight){
      G.objective = null;
      HUD.objective(s.text);
      if (!G.isNight) setTimeout(function(){ Objectives.advance(); }, 8000);
    }
  },

  onPhaseChange: function(night){
    if (night){
      HUD.radio('VESPERA RADIO', 'Dusk. The fog is moving. Get indoors or get ready.', 5000);
    } else {
      HUD.radio('VESPERA RADIO', 'Dawn. You made it. Most don\'t.', 5000);
      var s = this.current();
      if (s && s.surviveNight) this.advance();
    }
  },

  onEnemyKilled: function(e){
    if (this.waveActive && e.type==='zombie'){
      this.waveCount++;
      HUD.objective('Clear infected: ' + this.waveCount + ' / ' + this.waveNeed);
      if (this.waveCount >= this.waveNeed){
        this.waveActive = false;
        HUD.radio('VESPERA RADIO', 'Clean work. There\'s a cache near you — take what you need.', 5000);
        Enemies.dropPickup(G.player.pos.x+2, G.player.pos.z, 'ammo');
        Enemies.dropPickup(G.player.pos.x-2, G.player.pos.z, 'health');
        this.advance();
      }
    }
  },

  loopEnd: function(){
    // open world after story beats: repeatable night survival
    HUD.radio('VESPERA RADIO', 'The city\'s still out there. Drive. Scavenge. Survive. I\'ll keep talking.', 7000);
    HUD.objective('Free roam — survive the nights. Kills: ' + G.kills);
    G.objective = null;
    this.storyIdx++;
    // re-run survival loop after delay
    var self = this;
    setTimeout(function(){
      if (G.paused) return;
      self.step = 3; // jump back to 'reach safehouse' rhythm
      self.advance();
    }, 60000);
  },

  update: function(){
    var s = this.current();
    if (!s) return;
    if (s.goto && G.objective){
      if (dist2(G.player.pos.x, G.player.pos.z, G.objective.x, G.objective.z) < 8*8){
        if (s.killWave && !this.waveActive){} // handled by kills
        else if (s.goto === 'tower' && typeof Extraction !== 'undefined'){
          this.advance();
        } else if (!s.killWave) this.advance();
      }
    }
  }
};
