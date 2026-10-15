# VESPERA — 3D Zombie Survival FPS & Driving Experience

VESPERA is a high-octane 3D zombie-survival GTA-style FPS game built with Vanilla JavaScript, HTML5, CSS, and Three.js (r128). No build steps or bundlers required.

---

## ⚡ Quick Start

1. Start a local HTTP server inside the `vespera` directory:
   ```bash
   python -m http.server 8471
   ```
   *(or double-click `play.bat` on Windows)*
2. Open your browser and navigate to:
   ```
   http://localhost:8471/index.html
   ```

---

## 🎮 Controls

### On-Foot Combat
- **`W`, `A`, `S`, `D`**: Movement (Walk / Strafe)
- **`Shift`**: Sprint
- **`Space`**: Jump
- **`C` / `Ctrl`**: Crouch
- **`LMB` / `X`**: Fire Weapon
- **`RMB` / `Z`**: Aim Down Sights (ADS Holographic Sight)
- **`R`**: Reload Weapon
- **`1`, `2`, `3` / `Scroll Wheel`**: Weapon Slots (Primary ACR Rifle / Pump Shotgun / .357 Magnum)
- **`E`**: Interact / Enter Car / Barricade / Loot / Workbench
- **`T`**: Inspect Weapon Flourish
- **`M`**: Toggle Fullscreen Tactical Map
- **`ESC`**: Pause / Configuration Menu

### Vehicle Telemetry & Driving
- **`E`**: Mount / Dismount Vehicle
- **`W` / `S`**: Throttle / Active Brake & Reverse
- **`A` / `D`**: Steering Left / Right
- **`Space`**: Handbrake / Drift
- **`Z`** (or `Space` + `W`): **Staging Rev / Launch Control** (pins road speed to 0, sweeps needle to redline $8.5$–$9.0$, builds 2.45 BAR boost)
- **`G`**: Toggle Gear Speed Lock
- **`F` / `Q`**: Shift Up / Shift Down
- **`V` / `C`**: Cycle Camera Perspectives (Chase $\rightarrow$ Close $\rightarrow$ Hood $\rightarrow$ Far)
- **`L`**: Toggle Projector Headlights
- **`H`**: Toggle Hazard Warning Blinkers

---

## 🌟 Key Features

- **3D Vehicle Simulation:** Authentic Mercedes-Benz AMG ONE & 2018 Dodge Challenger SRT Demon models with realistic engine sounds, steering, suspension, drifting, and natural engine compression deceleration.
- **100% Transparent Racing Cluster:** Radial 0–9 speed scale calibrated to road speed, glowing redline arc, concentric gear indicator, status warning icons (High Beams, Hazards, Check Engine, ABS, HBK, Fuel), and slanted glowing neon digital speedometer.
- **Modular FPS Viewmodel Rig:** High-quality animated weapons with ADS zoom, holographic sight reticles, shell ejection, zero-allocation tracers, and locational headshot multiplier (2.5x).
- **Dynamic Zombie AI:** 6 distinct infected archetypes (Walkers, Sprinters, Crawlers, Brutes, Spitters, Stalkers) with locational damage hitboxes and ragdoll physics.
- **Atmospheric Urban World:** Real 3D tenement buildings, skyscrapers, asphalt roads with crosswalks, dynamic day/night diurnal cycle with air-raid siren, thunderstorms, and fog.
- **Safehouse & Economy:** Repairable wood barricades, ammo cache, Gunsmith upgrade workbench, and scavenging system.
- **60 FPS Optimized:** 95% draw call collapse with instanced rendering, batch-merged car sub-meshes, zero-allocation vector reuse, and real-time Resolution Scale slider (50%–100%).

---

## 📜 Documentation
- **[PROJECT.md](file:///c:/Users/DARSHANA/Projects/Vespera%20Game/vespera/PROJECT.md)**: Full architecture roadmap, technical notes, cache versions, and milestone progress.
- **[CREDITS.md](file:///c:/Users/DARSHANA/Projects/Vespera%20Game/vespera/CREDITS.md)**: Attributions for open-source 3D models, audio, and tools.
