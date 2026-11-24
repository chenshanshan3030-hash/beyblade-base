/* 陀螺對戰基地：零件資料 + 對戰物理模擬（不含畫面，可在 node 測試） */
(function (root) {
  const BLADES = [
    { id: 'dragon', name: '龍牙刃', emoji: '🐉', color: '#ff5a36', color2: '#ffd23f', shape: 'claw', atk: 5, def: 1, sta: 1, say: '尖尖的牙，最會撞！' },
    { id: 'shield', name: '鐵盾刃', emoji: '🛡️', color: '#3a86ff', color2: '#bde0fe', shape: 'round', atk: 1, def: 5, sta: 2, say: '又圓又重，很難被推走。' },
    { id: 'wind', name: '旋風刃', emoji: '🌪️', color: '#14b8a6', color2: '#ccfbf1', shape: 'wing', atk: 2, def: 1, sta: 5, say: '像風一樣，可以轉好久。' },
    { id: 'star', name: '星光刃', emoji: '⭐', color: '#9b5de5', color2: '#f9a8d4', shape: 'star', atk: 3, def: 3, sta: 3, say: '什麼都會一點點。' }
  ];
  const RATCHETS = [
    { id: 'low', name: '矮矮固鎖', tag: '3-60', ring: '#4b5563', atk: 0, def: 1, sta: 1, lock: 3, say: '矮矮的很穩，不容易被撞散。' },
    { id: 'mid', name: '中中固鎖', tag: '5-70', ring: '#9ca3af', atk: 1, def: 1, sta: 0, lock: 2, say: '不高不矮，剛剛好。' },
    { id: 'high', name: '高高固鎖', tag: '9-80', ring: '#eab308', atk: 2, def: 0, sta: 0, lock: 1, say: '高高的好撞人，可是比較容易散開。' }
  ];
  const BITS = [
    { id: 'rush', name: '衝刺軸心', atk: 2, def: 0, sta: -1, speed: 1.0, center: 0.15, say: '跑超快！會衝到邊邊加速。' },
    { id: 'hexa', name: '六角軸心', atk: 1, def: 1, sta: 1, speed: 0.6, center: 0.6, say: '不快不慢，攻守都可以。' },
    { id: 'ball', name: '圓球軸心', atk: -1, def: 1, sta: 2, speed: 0.3, center: 1.0, say: '圓圓的，乖乖待在中間轉。' }
  ];
  const TYPES = {
    atk: { name: '攻擊型', color: '#ef4444', emoji: '💥' },
    def: { name: '防禦型', color: '#3b82f6', emoji: '🛡️' },
    sta: { name: '持久型', color: '#14b8a6', emoji: '⏳' },
    bal: { name: '平衡型', color: '#8b5cf6', emoji: '⚖️' }
  };

  const find = (list, id) => list.find(x => x.id === id) || list[0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function statsOf(cfg) {
    const b = find(BLADES, cfg.blade), r = find(RATCHETS, cfg.ratchet), t = find(BITS, cfg.bit);
    const atk = clamp(b.atk + r.atk + t.atk, 1, 7);
    const def = clamp(b.def + r.def + t.def, 1, 7);
    const sta = clamp(b.sta + r.sta + t.sta, 1, 7);
    const mx = Math.max(atk, def, sta), mn = Math.min(atk, def, sta);
    let type = 'bal';
    if (mx - mn > 2) type = atk === mx ? 'atk' : def === mx ? 'def' : 'sta';
    return { b, r, t, atk, def, sta, type };
  }

  // 球場：半徑 1。下方是極限區（3 分），左上、右上是擊飛口（2 分）
  const BR = 0.13;
  const POCKETS = [
    { a: Math.PI / 2, w: 0.36, pts: 3, kind: 'xtreme' },
    { a: -Math.PI / 2 - 1.05, w: 0.3, pts: 2, kind: 'over' },
    { a: -Math.PI / 2 + 1.05, w: 0.3, pts: 2, kind: 'over' }
  ];
  function angDiff(a, b) { let d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; }

  function makeTop(cfg, i, quality, style) {
    const s = statsOf(cfg);
    const a0 = i === 0 ? Math.PI : 0;
    const ux = Math.cos(a0), uy = Math.sin(a0);
    const tx = -uy, ty = ux;
    const sp0 = style === 'tilt' ? 0.9 + s.t.speed * 0.6 : 0.25;
    return {
      i, cfg, s, b: s.b, r: s.r, t: s.t,
      x: ux * 0.5, y: uy * 0.5,
      vx: tx * sp0 - ux * 0.15, vy: ty * sp0 - uy * 0.15,
      spin: 100 * quality * (1 + s.sta * 0.02),
      maxSpin: 100 * (1 + s.sta * 0.02),
      decay: 9 - s.sta * 0.7,
      mass: 1 + s.def * 0.15,
      ang: 0, hitT: -9, railT: 0, out: null, burst: false, outT: 0, stopAt: null
    };
  }

  function createWorld(cfgA, cfgB, opts) {
    opts = opts || {};
    const q = opts.quality || [0.9, 0.9], st = opts.style || ['steady', 'steady'];
    return {
      rand: opts.rand || Math.random,
      tops: [makeTop(cfgA, 0, q[0], st[0]), makeTop(cfgB, 1, q[1], st[1])],
      time: 0, lastHit: -1, events: [], result: null
    };
  }

  function active(p) { return !p.out && !p.burst && p.stopAt === null; }

  function step(w, dt) {
    if (w.result) return;
    w.time += dt;
    const rand = w.rand;
    for (const p of w.tops) {
      if (p.out || p.burst) { p.outT += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.ang += 3 * dt; continue; }
      if (p.stopAt !== null) { p.vx *= 0.85; p.vy *= 0.85; p.x += p.vx * dt; p.y += p.vy * dt; continue; }
      const r = Math.hypot(p.x, p.y) || 1e-6;
      const ux = p.x / r, uy = p.y / r, tx = -uy, ty = ux;
      const sp = Math.max(p.spin, 0) / 100;
      const pull = 0.6 + p.t.center * 0.8;
      let ax = -p.x * pull, ay = -p.y * pull;
      const drive = p.t.speed * 0.9 * sp;
      ax += tx * drive; ay += ty * drive;
      if (r > 0.7 && p.t.speed > 0.5) { // 齒軌加速，加速一下就衝向對手（極限衝刺）
        const dash = p.t.speed * p.t.speed * 2.2 * sp;
        ax += tx * dash; ay += ty * dash;
        p.railT += dt;
        const o = w.tops[1 - p.i];
        if (p.railT > 0.45 && active(o)) {
          const ox = o.x - p.x, oy = o.y - p.y, od = Math.hypot(ox, oy) || 1;
          const v0 = Math.max(Math.hypot(p.vx, p.vy), 1.2) * 1.1;
          p.vx = ox / od * v0; p.vy = oy / od * v0; p.railT = -0.6;
          w.events.push({ type: 'dash', who: p.i });
        }
      } else if (p.railT > 0) p.railT = 0;
      else p.railT = Math.min(0, p.railT + dt);
      { // 會跑的軸心會衝向對手
        const o = w.tops[1 - p.i];
        if (active(o)) {
          const ox = o.x - p.x, oy = o.y - p.y, od = Math.hypot(ox, oy) || 1;
          const seek = Math.max(0, p.t.speed - 0.25) * 2.2 * sp;
          ax += ox / od * seek; ay += oy / od * seek;
        }
      }
      if (p.spin < 25) { // 快停了會搖晃
        const k = (25 - Math.max(p.spin, 0)) / 25 * 3.2;
        ax += (rand() - 0.5) * k; ay += (rand() - 0.5) * k;
      }
      p.vx += ax * dt; p.vy += ay * dt;
      const damp = Math.max(0, 1 - (0.35 + p.t.center * 0.6) * dt);
      p.vx *= damp; p.vy *= damp;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const v = Math.hypot(p.vx, p.vy);
      p.spin -= (p.decay + v * 0.8) * dt;
      p.ang += (5 + sp * 45) * dt;
      const r2 = Math.hypot(p.x, p.y);
      if (r2 > 1 - BR) {
        const nx = p.x / r2, ny = p.y / r2;
        const vn = p.vx * nx + p.vy * ny;
        const th = Math.atan2(p.y, p.x);
        const pk = POCKETS.find(q => angDiff(th, q.a) < q.w);
        if (pk && vn > 0.32 && w.time - p.hitT < 0.8) { p.out = pk; w.events.push({ type: 'out', who: p.i, pocket: pk }); }
        else {
          if (vn > 0) { p.vx -= 1.5 * vn * nx; p.vy -= 1.5 * vn * ny; p.spin -= vn * 3; }
          p.x = nx * (1 - BR); p.y = ny * (1 - BR);
        }
      }
      if (p.spin <= 0 && !p.out) { p.spin = 0; p.stopAt = w.time; w.events.push({ type: 'stop', who: p.i }); }
    }

    const [A, B] = w.tops;
    if (active(A) && active(B)) {
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < 2 * BR && d > 1e-6) {
        const nx = dx / d, ny = dy / d;
        const ov = 2 * BR - d;
        A.x -= nx * ov / 2; A.y -= ny * ov / 2; B.x += nx * ov / 2; B.y += ny * ov / 2;
        if (w.time - w.lastHit > 0.25) {
          const vrel = Math.max((A.vx - B.vx) * nx + (A.vy - B.vy) * ny, 0);
          const hit = vrel + 0.12 * (A.spin + B.spin) / 200;
          const j = 1.6 * vrel / (1 / A.mass + 1 / B.mass);
          A.vx -= j / A.mass * nx; A.vy -= j / A.mass * ny;
          B.vx += j / B.mass * nx; B.vy += j / B.mass * ny;
          const kB = hit * (0.3 + A.s.atk * 0.17) * (A.spin / 100 + 0.3) / B.mass;
          const kA = hit * (0.3 + B.s.atk * 0.17) * (B.spin / 100 + 0.3) / A.mass;
          B.vx += nx * kB; B.vy += ny * kB; A.vx -= nx * kA; A.vy -= ny * kA;
          B.spin -= hit * (A.s.atk * 3.0) / (1 + B.s.def * 0.45);
          A.spin -= hit * (B.s.atk * 3.0) / (1 + A.s.def * 0.45);
          w.events.push({ type: 'hit', x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, power: hit });
          const tryBurst = (att, vic, sx, sy) => {
            if (hit < 0.35) return false;
            const chance = (att.s.atk * hit * 0.018) / vic.r.lock * (1.4 - Math.max(vic.spin, 0) / 100);
            if (rand() < chance) {
              vic.burst = true; vic.vx += sx * 0.5; vic.vy += sy * 0.5;
              w.events.push({ type: 'burst', who: vic.i, x: vic.x, y: vic.y });
              return true;
            }
            return false;
          };
          if (!tryBurst(A, B, nx, ny)) tryBurst(B, A, -nx, -ny);
          w.lastHit = w.time;
          const aIn = A.vx * nx + A.vy * ny, bIn = -(B.vx * nx + B.vy * ny);
          (aIn < bIn ? A : B).hitT = w.time; // 被撞的那顆才可能飛出去
        }
      }
    }

    // 判定
    for (const p of w.tops) {
      const o = w.tops[1 - p.i];
      if ((p.out || p.burst) && p.outT > 0.7) {
        const finish = p.burst ? 'burst' : p.out.kind;
        w.result = { winner: o.i, finish, pts: p.burst ? 2 : p.out.pts };
        return;
      }
    }
    if (A.stopAt !== null || B.stopAt !== null) {
      const first = A.stopAt !== null && (B.stopAt === null || A.stopAt <= B.stopAt) ? A : B;
      const other = w.tops[1 - first.i];
      if (w.time - first.stopAt > 0.35) {
        if (other.stopAt !== null && other.stopAt - first.stopAt < 0.35) w.result = { winner: -1, finish: 'draw', pts: 0 };
        else w.result = { winner: other.i, finish: 'spin', pts: 1 };
      }
    }
    if (!w.result && w.time > 40) {
      w.result = A.spin === B.spin ? { winner: -1, finish: 'draw', pts: 0 } : { winner: A.spin > B.spin ? 0 : 1, finish: 'spin', pts: 1 };
    }
  }

  const api = { BLADES, RATCHETS, BITS, TYPES, POCKETS, BR, statsOf, createWorld, step, find };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BeySim = api;
})(this);
