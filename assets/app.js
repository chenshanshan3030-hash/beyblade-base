/* 陀螺對戰基地：畫面互動 */
(function () {
  const { BLADES, RATCHETS, BITS, TYPES, POCKETS, BR, statsOf, createWorld, step, find } = window.BeySim;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const pickRand = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- 存檔（只存在這台電腦的瀏覽器） ---------- */
  const KEY = 'bey-site-v1';
  let save = { cfg: { blade: 'dragon', ratchet: 'low', bit: 'rush' }, best: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.cfg) save = Object.assign(save, s); } catch (e) {}
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };

  /* ---------- 畫陀螺（從上面看） ---------- */
  function bladePath(shape, R) {
    const pts = [], n = 160;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      let r;
      if (shape === 'claw') { const k = (a * 3 / (Math.PI * 2)) % 1; r = R * (0.7 + 0.3 * Math.pow(1 - k, 2.2)); }
      else if (shape === 'round') r = R * (0.9 + 0.07 * Math.cos(a * 6));
      else if (shape === 'wing') { const s = Math.sin(a * 4 + Math.sin(a * 4) * 0.8); r = R * (0.66 + 0.32 * Math.max(0, s)); }
      else r = R * (0.72 + 0.26 * Math.pow(Math.abs(Math.cos(a * 2.5)), 3));
      pts.push((r * Math.cos(a)).toFixed(1) + ',' + (r * Math.sin(a)).toFixed(1));
    }
    return 'M' + pts.join('L') + 'Z';
  }
  function beySVG(cfg) {
    const b = find(BLADES, cfg.blade), r = find(RATCHETS, cfg.ratchet);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">
      <path d="${bladePath(b.shape, 48)}" fill="${b.color}" stroke="#1b1f3b" stroke-width="3" stroke-linejoin="round"/>
      <path d="${bladePath(b.shape, 36)}" fill="${b.color2}" opacity=".85"/>
      <circle r="21" fill="${r.ring}" stroke="#1b1f3b" stroke-width="2.5"/>
      <path d="M0 -21 L5 -12 L-5 -12 Z M18 10 L8 9 L13 1 Z M-18 10 L-13 1 L-8 9 Z" fill="#1b1f3b" opacity=".55"/>
      <circle r="12" fill="#f8fafc" stroke="#1b1f3b" stroke-width="2"/>
      <text y="5.5" text-anchor="middle" font-size="15">${b.emoji}</text>
    </svg>`;
  }
  const beyName = cfg => {
    const b = find(BLADES, cfg.blade), r = find(RATCHETS, cfg.ratchet), t = find(BITS, cfg.bit);
    return `${b.name} ${r.tag} ${t.name.replace('軸心', '')}`;
  };

  /* ---------- 分頁 ---------- */
  const PAGES = ['home', 'parts', 'types', 'rules', 'launch', 'battle', 'parents'];
  function route() {
    const id = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
    $$('.page').forEach(p => { p.hidden = p.id !== id; });
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.go === id));
    window.scrollTo(0, 0);
    if (id === 'battle') Battle.show();
  }
  window.addEventListener('hashchange', route);

  $('#heroBey').innerHTML = beySVG({ blade: 'dragon', ratchet: 'low', bit: 'rush' });

  /* ---------- 零件拆解圖 ---------- */
  const PART_INFO = {
    blade: { t: '① 鋒刃（最上面）', p: '陀螺的「臉」，是金屬做的。', p2: '它的形狀決定撞人有多大力。尖尖的會撞，圓圓的會守。' },
    ratchet: { t: '② 固鎖（中間）', p: '把上下兩個零件鎖在一起。', p2: '上面的數字是高度。矮矮的比較穩，高高的比較好撞人。' },
    bit: { t: '③ 軸心（最下面）', p: '尖尖的腳，碰到盤子的地方。', p2: '它決定陀螺怎麼跑：亂衝亂撞，還是待在中間乖乖轉。' }
  };
  function showPart(k) {
    const i = PART_INFO[k];
    $('#partInfo').innerHTML = `<h3>${i.t}</h3><p>${i.p}</p><p>${i.p2}</p>`;
    $$('.part').forEach(g => g.classList.toggle('on', g.dataset.part === k));
    $$('.chip[data-part]').forEach(c => c.classList.toggle('on', c.dataset.part === k));
  }
  $$('.part, .chip[data-part]').forEach(el => el.addEventListener('click', () => showPart(el.dataset.part)));
  $('#assembleBtn').addEventListener('click', () => {
    const svg = $('#explodeSvg');
    const on = svg.classList.toggle('assembled');
    $('#assembleBtn').textContent = on ? '🔧 拆開來！' : '🔩 組合起來！';
  });

  /* ---------- 組裝實驗室 ---------- */
  function statBars(s) {
    const row = (label, v, c) => `<div class="bar"><span>${label}</span><div class="track"><div class="fill" style="width:${v / 7 * 100}%;background:${c}"></div></div></div>`;
    return row('💥 攻擊', s.atk, '#ef4444') + row('🛡️ 防禦', s.def, '#3b82f6') + row('⏳ 持久', s.sta, '#14b8a6');
  }
  function renderPicks() {
    const mk = (box, list, key, label) => {
      $(box).innerHTML = list.map(x => `<button class="pick${save.cfg[key] === x.id ? ' on' : ''}" data-k="${key}" data-id="${x.id}">
        <span class="ico">${label(x)}</span>${x.name}<small>${x.say}</small></button>`).join('');
    };
    mk('#pickBlade', BLADES, 'blade', x => x.emoji);
    mk('#pickRatchet', RATCHETS, 'ratchet', x => x.id === 'low' ? '⬇️' : x.id === 'mid' ? '↕️' : '⬆️');
    mk('#pickBit', BITS, 'bit', x => x.id === 'rush' ? '💨' : x.id === 'ball' ? '⚪' : '⬡');
    const s = statsOf(save.cfg), ty = TYPES[s.type];
    $('#labBey').innerHTML = beySVG(save.cfg);
    $('#labName').textContent = beyName(save.cfg);
    $('#labType').textContent = `${ty.emoji} ${ty.name}`;
    $('#labType').style.background = ty.color;
    $('#labBars').innerHTML = statBars(s);
    const tips = {
      atk: '很會撞！用「斜斜發射」去把對手撞出去吧！',
      def: '很穩很重！就站在中間，讓對手撞過來。',
      sta: '可以轉很久！用「放平發射」，撐到最後。',
      bal: '什麼都會一點，跟誰比都有機會！'
    };
    $('#labSay').textContent = tips[s.type];
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.pick');
    if (!b) return;
    save.cfg[b.dataset.k] = b.dataset.id; store(); renderPicks(); Battle.refreshMe();
  });
  $('#randomBtn').addEventListener('click', () => {
    save.cfg = { blade: pickRand(BLADES).id, ratchet: pickRand(RATCHETS).id, bit: pickRand(BITS).id };
    store(); renderPicks(); Battle.refreshMe();
  });

  /* ---------- 裁判小測驗 ---------- */
  const QUIZ = [
    { q: '對手的陀螺先停了，你的還在轉。', a: 1, why: '持久勝，1 分！' },
    { q: '你把對手撞出盤子外面。', a: 2, why: '擊飛勝，2 分！' },
    { q: '你把對手撞到零件散開了！', a: 2, why: '爆裂勝，2 分！' },
    { q: '你把對手撞進盤邊的極限區！', a: 3, why: '極限勝，3 分！最帥！' },
    { q: '兩顆陀螺同時停下來。', a: 0, why: '平手，重新來一次！' },
    { q: '你的陀螺先停了，對手還在轉。', a: -1, why: '是對手拿 1 分喔！' }
  ];
  let quizOrder = [], quizI = 0, quizRight = 0, quizDone = 0;
  const ANS = [{ v: 0, t: '🤝 平手' }, { v: 1, t: '1 分' }, { v: 2, t: '2 分' }, { v: 3, t: '3 分' }, { v: -1, t: '對手得分' }];
  function quizNext() {
    if (quizI >= quizOrder.length) { quizOrder = QUIZ.map((_, i) => i).sort(() => Math.random() - 0.5); quizI = 0; }
    const q = QUIZ[quizOrder[quizI]];
    $('#quizQ').textContent = '🌀 ' + q.q;
    $('#quizMsg').textContent = '';
    $('#quizA').innerHTML = ANS.map(a => `<button class="btn blue" data-v="${a.v}">${a.t}</button>`).join('');
  }
  $('#quizA').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const q = QUIZ[quizOrder[quizI]];
    const right = Number(b.dataset.v) === q.a;
    quizDone++; if (right) quizRight++;
    $('#quizMsg').innerHTML = right ? `<span class="ok">⭕ 答對了！${q.why}</span>` : `<span class="no">❌ 再想想～ 答案是：${q.why}</span>`;
    $$('#quizA button').forEach(x => { x.disabled = true; });
    $('#quizScore').textContent = `答對 ${quizRight} / ${quizDone} 題`;
    quizI++;
    setTimeout(quizNext, right ? 1500 : 2600);
  });
  quizNext();

  /* ---------- 拉繩練習 ---------- */
  (function practice() {
    const track = $('#pullTrack'), handle = $('#pullHandle'), bey = $('#practiceBey');
    bey.innerHTML = beySVG(save.cfg);
    const showBest = () => { $('#pullBest').textContent = save.best ? `最高紀錄：${save.best} 秒` : ''; };
    showBest();
    let drag = null, anim = null;
    const maxX = () => track.clientWidth - handle.offsetWidth - 8;
    handle.addEventListener('pointerdown', e => {
      if (anim) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      drag = { x0: e.clientX, y0: e.clientY, t0: performance.now(), dy: 0 };
      handle.classList.add('drag');
      $('#pullMsg').textContent = '拉！拉！拉！';
      $('#pullStars').textContent = '';
    });
    handle.addEventListener('pointermove', e => {
      if (!drag) return;
      const x = Math.max(0, Math.min(maxX(), e.clientX - drag.x0));
      drag.dy = Math.max(drag.dy, Math.abs(e.clientY - drag.y0));
      handle.style.left = (4 + x) + 'px';
      if (x >= maxX()) finish(true);
    });
    const end = () => { if (drag) finish(false); };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);

    function finish(full) {
      const ms = performance.now() - drag.t0, crooked = drag.dy > 45;
      drag = null; handle.classList.remove('drag');
      let sec, msg;
      if (!full) { sec = 3; msg = '😅 要拉到 🏁 才行喔！再一次！'; }
      else {
        sec = Math.round(Math.max(5, Math.min(35, 38 - ms / 28)));
        msg = sec >= 28 ? '🔥 超快！太厲害了！' : sec >= 18 ? '👍 不錯喔！再快一點點！' : '🐢 有點慢，要一口氣拉！';
        if (crooked) { sec = Math.round(sec * 0.7); msg = '↗️ 拉歪了！要直直地拉。'; }
      }
      $('#pullMsg').textContent = msg;
      handle.style.transition = 'left .3s'; handle.style.left = '4px';
      setTimeout(() => { handle.style.transition = ''; }, 320);
      if (full && sec > save.best) { save.best = sec; store(); }
      spinDown(sec, full);
    }
    function spinDown(sec, full) {
      bey.innerHTML = beySVG(save.cfg);
      const dur = Math.max(1.5, sec / 4) * 1000, t0 = performance.now();
      bey.classList.add('go');
      const tick = now => {
        const k = Math.min(1, (now - t0) / dur);
        const spd = 0.12 + Math.pow(k, 2) * 1.6;
        bey.style.setProperty('--spd', spd.toFixed(2) + 's');
        bey.style.transform = k > 0.85 ? `rotate(${Math.sin(now / 60) * (k - 0.85) * 60}deg)` : '';
        $('#practiceCount').textContent = `⏱ ${Math.round(sec * k)} 秒`;
        if (k < 1) anim = requestAnimationFrame(tick);
        else {
          anim = null; bey.classList.remove('go'); bey.style.transform = '';
          $('#practiceCount').textContent = `轉了 ${sec} 秒！`;
          $('#pullStars').textContent = !full ? '' : sec >= 28 ? '⭐⭐⭐' : sec >= 18 ? '⭐⭐' : '⭐';
          showBest();
        }
      };
      anim = requestAnimationFrame(tick);
    }
  })();

  /* ---------- 對戰遊戲 ---------- */
  const Battle = (function () {
    const cv = $('#stadium'), ctx = cv.getContext('2d');
    const callEl = $('#call'), msg = $('#battleMsg'), btn = $('#shootBtn');
    let W = 400, SC = 175, cx = 200, cy = 200;
    let cpuCfg = randomCpu(), score = [0, 0], style = 'steady';
    let phase = 'ready', world = null, imgs = [null, null], fx = [], last = 0, acc = 0, tGo = 0, timers = [];

    function randomCpu() { return { blade: pickRand(BLADES).id, ratchet: pickRand(RATCHETS).id, bit: pickRand(BITS).id }; }
    function toImg(cfg) { const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(beySVG(cfg)); return im; }

    function resize() {
      const css = cv.clientWidth || 400, dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(css * dpr); cv.height = Math.round(css * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = css; cx = cy = css / 2; SC = css / 2 * 0.86;
      draw();
    }
    function dots(n) { return [0, 1, 2, 3].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); }
    function refreshMe() {
      $('#meBey').innerHTML = beySVG(save.cfg); $('#meName').textContent = beyName(save.cfg);
      $('#cpuBey').innerHTML = beySVG(cpuCfg); $('#cpuName').textContent = beyName(cpuCfg);
      $('#meDots').innerHTML = dots(score[0]); $('#cpuDots').innerHTML = dots(score[1]);
      imgs = [toImg(save.cfg), toImg(cpuCfg)];
      imgs.forEach(im => { im.onload = draw; });
      if (phase === 'ready' || phase === 'over') { world = null; draw(); }
    }

    function drawStadium() {
      ctx.clearRect(0, 0, W, W);
      const rim = SC / 0.86 * 0.99;
      ctx.beginPath(); ctx.arc(cx, cy, rim, 0, Math.PI * 2); ctx.fillStyle = '#1d2b64'; ctx.fill();
      for (const p of POCKETS) {
        ctx.beginPath();
        ctx.arc(cx, cy, rim, p.a - p.w, p.a + p.w);
        ctx.arc(cx, cy, SC * 0.98, p.a + p.w, p.a - p.w, true);
        ctx.closePath();
        ctx.fillStyle = p.kind === 'xtreme' ? '#ff5a36' : '#050a24'; ctx.fill();
        const lx = cx + Math.cos(p.a) * (rim + SC * 0.98) / 2, ly = cy + Math.sin(p.a) * (rim + SC * 0.98) / 2;
        ctx.fillStyle = p.kind === 'xtreme' ? '#fff' : '#ffd23f';
        ctx.font = `900 ${Math.round(W * 0.04)}px "Noto Sans TC", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.pts, lx, ly);
      }
      const g = ctx.createRadialGradient(cx, cy, SC * 0.05, cx, cy, SC);
      g.addColorStop(0, '#f4f7ff'); g.addColorStop(0.75, '#b9cdf2'); g.addColorStop(1, '#7b9de0');
      ctx.beginPath(); ctx.arc(cx, cy, SC, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.save();
      ctx.setLineDash([SC * 0.05, SC * 0.04]);
      ctx.lineWidth = SC * 0.07; ctx.strokeStyle = 'rgba(255,170,40,.55)';
      ctx.beginPath(); ctx.arc(cx, cy, SC * 0.88, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(29,43,100,.15)';
      [0.3, 0.6].forEach(k => { ctx.beginPath(); ctx.arc(cx, cy, SC * k, 0, Math.PI * 2); ctx.stroke(); });
    }
    function drawTop(im, x, y, ang, alpha, scale) {
      if (!im || !im.complete) return;
      const s = BR * 2 * SC * (scale || 1);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(cx + x * SC, cy + y * SC);
      ctx.beginPath(); ctx.ellipse(3, 5, s / 2, s / 2.2, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fill();
      ctx.rotate(ang);
      ctx.drawImage(im, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    function draw() {
      drawStadium();
      if (!world) {
        drawTop(imgs[0], -0.5, 0, 0, 1); drawTop(imgs[1], 0.5, 0, 0, 1);
        return;
      }
      for (const p of world.tops) {
        let a = 1, sc = 1;
        if (p.out) { a = Math.max(0, 1 - p.outT / 0.7); sc = 1 + p.outT * 0.4; }
        if (p.burst) { a = Math.max(0, 1 - p.outT / 0.7); sc = 1 + p.outT * 1.2; }
        drawTop(imgs[p.i], p.x, p.y, p.ang, a, sc);
        if (p.burst && p.outT < 0.7) emoji('💥', p.x, p.y, 0.1 + p.outT * 0.2);
        if (p.stopAt !== null) emoji('😵', p.x, p.y - 0.2, 0.09);
      }
      fx = fx.filter(f => world.time - f.t < f.life);
      for (const f of fx) {
        const k = (world.time - f.t) / f.life;
        if (f.kind === 'spark') {
          ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
          const X = cx + f.x * SC, Y = cy + f.y * SC, L = SC * (0.05 + k * 0.12);
          for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(X + Math.cos(a) * L * 0.4, Y + Math.sin(a) * L * 0.4); ctx.lineTo(X + Math.cos(a) * L, Y + Math.sin(a) * L); ctx.stroke(); }
          ctx.restore();
        } else if (f.kind === 'text') {
          ctx.save(); ctx.globalAlpha = 1 - k;
          ctx.font = `900 ${Math.round(W * 0.06)}px "Noto Sans TC", sans-serif`;
          ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#1b1f3b'; ctx.fillStyle = f.color;
          const X = cx + f.x * SC, Y = cy + f.y * SC - k * 30;
          ctx.strokeText(f.text, X, Y); ctx.fillText(f.text, X, Y);
          ctx.restore();
        }
      }
    }
    function emoji(ch, x, y, size) {
      ctx.save(); ctx.font = `${Math.round(SC * size * 2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, cx + x * SC, cy + y * SC); ctx.restore();
    }

    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function setCall(t) { callEl.textContent = t; }
    function setPhase(p) {
      phase = p;
      btn.disabled = p === 'fight';
      btn.textContent = { ready: '準備！', count: '發射！', go: '發射！', fight: '比賽中…', next: '下一回合！', over: '再比一場！' }[p];
      btn.classList.toggle('green', p === 'count' || p === 'go');
    }

    function startCount() {
      world = null; fx = []; draw();
      setPhase('count');
      msg.textContent = '聽口令，喊到「Go Shoot!」才按發射！';
      const seq = ['3', '2', '1'];
      seq.forEach((t, i) => timers.push(setTimeout(() => setCall(t), i * 750)));
      timers.push(setTimeout(() => {
        setCall('Go Shoot!'); phase = 'go'; tGo = performance.now();
        timers.push(setTimeout(() => foul('⏰ 太慢了！沒有跟口令一起發射，犯規！再來一次。'), 1600));
      }, seq.length * 750));
    }
    function foul(text) {
      clearTimers(); setCall('犯規！'); msg.textContent = text; setPhase('ready');
      timers.push(setTimeout(() => setCall(''), 1200));
    }
    function shoot() {
      clearTimers();
      const delay = performance.now() - tGo;
      const q = Math.max(0.6, Math.min(1, 1 - (delay - 150) / 2500));
      setCall('');
      msg.textContent = delay < 400 ? '🔥 完美發射！' : delay < 800 ? '👍 發射成功！' : '🙂 有點慢，不過成功了！';
      const cpuStyle = find(BITS, cpuCfg.bit).speed > 0.5 ? 'tilt' : 'steady';
      world = createWorld(save.cfg, cpuCfg, { quality: [q, 0.72 + Math.random() * 0.23], style: [style, cpuStyle] });
      setPhase('fight'); last = performance.now(); acc = 0;
      requestAnimationFrame(loop);
    }
    function loop(now) {
      if (phase !== 'fight' || !world) return;
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= 1 / 60 && !world.result) {
        step(world, 1 / 60); acc -= 1 / 60;
        for (const e of world.events) {
          if (e.type === 'hit') {
            fx.push({ kind: 'spark', x: e.x, y: e.y, t: world.time, life: 0.3 });
            if (e.power > 1.1) fx.push({ kind: 'text', text: '碰！', color: '#ffd23f', x: e.x, y: e.y - 0.1, t: world.time, life: 0.6 });
          } else if (e.type === 'dash') {
            const p = world.tops[e.who];
            fx.push({ kind: 'text', text: '衝刺！', color: '#ff8a5b', x: p.x, y: p.y - 0.15, t: world.time, life: 0.7 });
          }
        }
        world.events.length = 0;
      }
      draw();
      if (world.result) return endRound(world.result);
      requestAnimationFrame(loop);
    }
    function endRound(r) {
      const names = { spin: '持久勝', over: '擊飛勝', burst: '爆裂勝', xtreme: '極限勝' };
      if (r.winner === -1) {
        setCall('平手！'); msg.textContent = '🤝 兩顆一起停下來，平手！再來一次。';
      } else {
        score[r.winner] += r.pts;
        const me = r.winner === 0;
        setCall(`${names[r.finish]} +${r.pts}`);
        const winText = {
          spin: '對手先停了！你還在轉！', over: '你把對手撞出去了！',
          burst: '對手被你撞散了！', xtreme: '撞進極限區！太帥了！⚡'
        };
        const loseText = {
          spin: '你的陀螺先停了…', over: '你被撞出去了…',
          burst: '你的陀螺被撞散了…', xtreme: '你被撞進極限區了…'
        };
        msg.textContent = me ? `🎉 ${winText[r.finish]}你拿到 ${r.pts} 分（${names[r.finish]}）。`
          : `😣 ${loseText[r.finish]}電腦拿到 ${r.pts} 分（${names[r.finish]}）。`;
      }
      $('#meDots').innerHTML = dots(score[0]); $('#cpuDots').innerHTML = dots(score[1]);
      if (score[0] >= 4 || score[1] >= 4) {
        const iWin = score[0] >= 4;
        timers.push(setTimeout(() => {
          setCall(iWin ? '🏆 你贏了！' : '電腦贏了');
          msg.textContent = iWin ? `🏆 ${score[0]} 比 ${score[1]}，你是冠軍！` : `${score[0]} 比 ${score[1]}，差一點點！換個零件再挑戰吧！`;
        }, 1300));
        setPhase('over');
      } else setPhase('next');
    }

    cv.addEventListener('click', () => { if (phase !== 'fight') btn.click(); });
    btn.addEventListener('click', () => {
      if (phase === 'ready' || phase === 'next') { setCall(''); startCount(); }
      else if (phase === 'count') foul('⏰ 太早了！要等到「Go Shoot!」才能發射。犯規，再來一次！');
      else if (phase === 'go') shoot();
      else if (phase === 'over') { score = [0, 0]; refreshMe(); setCall(''); startCount(); }
    });
    $$('[data-style]').forEach(b => b.addEventListener('click', () => {
      style = b.dataset.style;
      $$('[data-style]').forEach(x => x.classList.toggle('on', x === b));
    }));
    function stopAll() { clearTimers(); setPhase('ready'); setCall(''); world = null; }
    $('#newCpuBtn').addEventListener('click', () => {
      stopAll(); cpuCfg = randomCpu(); score = [0, 0]; refreshMe();
      msg.textContent = `新對手來了：${beyName(cpuCfg)}（${TYPES[statsOf(cpuCfg).type].name}）！`;
    });
    $('#resetBtn').addEventListener('click', () => { stopAll(); score = [0, 0]; refreshMe(); msg.textContent = '比數歸零，重新開始！按「準備」。'; });
    window.addEventListener('resize', () => { if (!$('#battle').hidden) resize(); });

    return {
      refreshMe,
      show() {
        if (phase === 'fight') return;
        refreshMe(); requestAnimationFrame(resize);
      }
    };
  })();

  renderPicks();
  Battle.refreshMe();
  route();
})();
