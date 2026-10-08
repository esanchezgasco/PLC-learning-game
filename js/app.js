/* =========================================================================
 * PLC Academy — Aplicación: mapa de niveles, etapas, puntuación, ayudas,
 * medallas, progreso guardado y laboratorio libre.
 * ========================================================================= */
(function () {
  'use strict';
  const esc = PLC.esc;
  const $ = function (s, el) { return (el || document).querySelector(s); };
  const $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  const STORE_KEY = 'plc-academy-v1';
  const SCORE = [100, 80, 60, 40, 20];
  const EXERCISE = ['guided', 'free', 'challenge', 'test'];
  const LEVELS = PLC.LEVELS;
  const UNLOCK_ALL = /[?&](profesor|unlockall)\b/.test(location.search);

  const TYPE = {
    intro: { icon: '📖', label: 'Introducción' },
    concept: { icon: '💡', label: 'Nuevo concepto' },
    example: { icon: '🔍', label: 'Ejemplo' },
    interact: { icon: '🧭', label: 'Ejercicio guiado' },
    guided: { icon: '🧭', label: 'Ejercicio guiado' },
    free: { icon: '✏️', label: 'Ejercicio' },
    challenge: { icon: '🐞', label: 'Reto' },
    test: { icon: '🏁', label: 'Prueba final' },
    quiz: { icon: '🏁', label: 'Prueba final' }
  };
  const TITLES = ['Aprendiz', 'Ayudante de mantenimiento', 'Técnico junior', 'Técnico de automatización', 'Programador PLC', 'Programador PLC senior', 'Ingeniero de control', 'Maestro de la automatización'];
  const XP_PER_LEVEL = 600;
  const MEDALS = [
    { id: 'first', icon: '🌱', name: 'Primer programa', desc: 'Resuelve tu primer ejercicio de programación.' },
    { id: 'quiz', icon: '🧠', name: 'Teórico', desc: 'Completa una prueba de preguntas sin fallar ninguna.' },
    { id: 'self', icon: '🐘', name: 'Memoria de elefante', desc: 'Completa el nivel 3 (auto-retención).' },
    { id: 'time', icon: '⏱️', name: 'Señor del tiempo', desc: 'Completa el nivel 4 (temporizadores).' },
    { id: 'count', icon: '🔢', name: 'Contable', desc: 'Completa el nivel 5 (contadores).' },
    { id: 'bug', icon: '🐞', name: 'Cazabugs', desc: 'Resuelve un reto de diagnóstico sin usar pistas.' },
    { id: 'seq', icon: '🎼', name: 'Director de orquesta', desc: 'Completa el nivel 7 (secuencias).' },
    { id: 'states', icon: '🔀', name: 'Arquitecto de estados', desc: 'Completa el nivel 8 (máquinas de estados).' },
    { id: 'plant', icon: '🏭', name: 'Ingeniero de planta', desc: 'Completa el nivel 9 (automatización industrial).' },
    { id: 'streak', icon: '🔥', name: 'En racha', desc: 'Resuelve 5 ejercicios seguidos sin pistas.' },
    { id: 'autodidact', icon: '🎓', name: 'Autodidacta', desc: 'Completa un nivel entero sin usar ninguna pista.' },
    { id: 'perfect', icon: '💯', name: 'Perfeccionista', desc: 'Consigue 100 puntos en todos los ejercicios de un nivel.' },
    { id: 'final', icon: '🏆', name: 'Maestro de la automatización', desc: 'Supera el reto final.' }
  ];
  const LEVEL_MEDAL = { 3: 'self', 4: 'time', 5: 'count', 7: 'seq', 8: 'states', 9: 'plant', 10: 'final' };

  // asignar identificadores a las etapas
  LEVELS.forEach(function (lvl) {
    lvl.stages.forEach(function (st, i) { st.id = st.id || ('L' + lvl.id + '-' + i + '-' + st.type); });
  });

  /* ------------------------------ estado ------------------------------ */
  function defaults() {
    return { v: 1, done: {}, scores: {}, hintUse: {}, programs: {}, levelsDone: {}, xp: 0, medals: {}, streak: 0, bestStreak: 0, flags: {}, debugOn: false };
  }
  let S = defaults();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) S = Object.assign(defaults(), JSON.parse(raw));
  } catch (e) { /* almacenamiento no disponible */ }
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* nada */ } }, 150);
  }

  /* ------------------------------ utilidades ------------------------------ */
  function levelUnlocked(li) { return UNLOCK_ALL || li === 0 || !!S.levelsDone[LEVELS[li - 1].id]; }
  function stageUnlocked(li, si) {
    if (!levelUnlocked(li)) return false;
    if (UNLOCK_ALL || si === 0 || S.levelsDone[LEVELS[li].id]) return true;
    return !!S.done[LEVELS[li].stages[si - 1].id];
  }
  function levelDoneCount(li) { return LEVELS[li].stages.filter(function (s) { return S.done[s.id]; }).length; }
  function totalProgress() {
    let t = 0, d = 0;
    LEVELS.forEach(function (l) { l.stages.forEach(function (s) { t++; if (S.done[s.id]) d++; }); });
    return t ? Math.round(d * 100 / t) : 0;
  }
  function playerLevel() {
    const n = Math.floor(S.xp / XP_PER_LEVEL);
    return { n: n + 1, title: TITLES[Math.min(n, TITLES.length - 1)], cur: S.xp - n * XP_PER_LEVEL };
  }
  function toolsFor(li) {
    const tools = [], locked = {};
    LEVELS.forEach(function (l, i) {
      (l.tools || []).forEach(function (t) { if (i <= li) tools.push(t); else locked[t] = l.id; });
    });
    return { tools: tools, locked: locked };
  }
  function maxUnlockedLevel() { let m = 0; LEVELS.forEach(function (l, i) { if (levelUnlocked(i)) m = i; }); return m; }
  function debugUnlocked() { return UNLOCK_ALL || !!S.flags.debug; }
  function findStage(id) {
    for (let li = 0; li < LEVELS.length; li++) {
      const si = LEVELS[li].stages.findIndex(function (s) { return s.id === id; });
      if (si >= 0) return { li: li, si: si };
    }
    return null;
  }
  function currentPointer() {
    for (let li = 0; li < LEVELS.length; li++) {
      if (!levelUnlocked(li)) break;
      const st = LEVELS[li].stages;
      for (let si = 0; si < st.length; si++) if (!S.done[st[si].id] && stageUnlocked(li, si)) return { li: li, si: si };
    }
    return { li: LEVELS.length - 1, si: LEVELS[LEVELS.length - 1].stages.length - 1 };
  }

  /* ------------------------------ UI básica ------------------------------ */
  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || 'info');
    t.innerHTML = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 3600);
    setTimeout(function () { t.remove(); }, 4100);
  }
  PLC.ui = { toast: toast };

  function modal(html, buttons, opts) {
    opts = opts || {};
    const root = $('#modalRoot');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true">' + html + '<div class="modal-actions"></div></div>';
    const actions = $('.modal-actions', wrap);
    const close = function () { wrap.classList.add('out'); setTimeout(function () { wrap.remove(); }, 200); };
    (buttons || [{ label: 'Cerrar', primary: true }]).forEach(function (b) {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.primary ? 'primary' : 'ghost') + (b.danger ? ' danger' : '');
      btn.innerHTML = b.label;
      btn.addEventListener('click', function () { close(); if (b.onClick) b.onClick(); });
      actions.appendChild(btn);
    });
    wrap.addEventListener('click', function (e) { if (e.target === wrap && !opts.sticky) close(); });
    root.appendChild(wrap);
    const first = $('.btn.primary', wrap);
    if (first) first.focus();
    return close;
  }
  function confirmBox(html, yes, onYes) {
    modal(html, [{ label: 'Cancelar' }, { label: yes, primary: true, onClick: onYes }]);
  }

  /* ------------------------------ barra superior ------------------------------ */
  function renderTop() {
    const p = playerLevel();
    const medals = Object.keys(S.medals).length;
    const pct = totalProgress();
    $('#topStats').innerHTML =
      '<div class="player" title="' + S.xp + ' XP en total"><span class="p-lvl">' + p.n + '</span><span class="p-txt"><b>' + esc(p.title) + '</b><span class="xpbar"><i style="width:' + (p.cur * 100 / XP_PER_LEVEL) + '%"></i></span><small>' + p.cur + ' / ' + XP_PER_LEVEL + ' XP</small></span></div>' +
      '<div class="stat" title="Racha: ejercicios seguidos resueltos sin pistas (récord ' + S.bestStreak + ')">🔥 <b>' + S.streak + '</b></div>' +
      '<button class="stat btnlike" id="medalsTop" title="Medallas">🏅 <b>' + medals + '</b>/' + MEDALS.length + '</button>' +
      '<div class="stat ring" title="Progreso total" style="--p:' + pct + '"><span>' + pct + '%</span></div>';
    $('#medalsTop').addEventListener('click', showMedals);
  }

  /* ------------------------------ barra lateral ------------------------------ */
  function renderSidebar(active) {
    let h = '<div class="side-h">Mapa de niveles</div><nav class="levels">';
    LEVELS.forEach(function (l, li) {
      const unl = levelUnlocked(li), done = !!S.levelsDone[l.id];
      const n = levelDoneCount(li), t = l.stages.length;
      const st = done ? '<span class="lvl-st ok">✓</span>' : unl ? '<span class="lvl-st cur">▶</span>' : '<span class="lvl-st">🔒</span>';
      h += '<button class="lvl' + (active === li ? ' active' : '') + (unl ? '' : ' locked') + (done ? ' done' : '') + '" data-l="' + li + '">' +
        '<span class="lvl-num">' + l.icon + '</span><span class="lvl-txt"><small>Nivel ' + l.id + '</small><b>' + esc(l.title) + '</b>' +
        '<span class="lvl-bar"><i style="width:' + (n * 100 / t) + '%"></i></span></span>' + st + '</button>';
    });
    h += '</nav><div class="side-extra">' +
      '<button class="side-btn' + (active === 'lab' ? ' active' : '') + '" data-lab>🧪 Laboratorio libre</button>' +
      '<button class="side-btn" data-medals>🏅 Medallas</button>' +
      '<button class="side-btn muted" data-reset>⟲ Reiniciar progreso</button></div>';
    const sb = $('#sidebar');
    sb.innerHTML = h;
    $$('[data-l]', sb).forEach(function (b) {
      b.addEventListener('click', function () {
        const li = Number(b.getAttribute('data-l'));
        if (!levelUnlocked(li)) { toast('🔒 Completa la prueba final del nivel ' + LEVELS[li - 1].id + ' para desbloquear este nivel.', 'warn'); return; }
        const st = LEVELS[li].stages;
        let si = st.findIndex(function (s, i) { return !S.done[s.id] && stageUnlocked(li, i); });
        if (si < 0) si = 0;
        openStage(li, si);
        closeDrawer();
      });
    });
    $('[data-lab]', sb).addEventListener('click', function () { openLab(); closeDrawer(); });
    $('[data-medals]', sb).addEventListener('click', showMedals);
    $('[data-reset]', sb).addEventListener('click', function () {
      confirmBox('<h2>¿Reiniciar todo el progreso?</h2><p>Se borrarán tus niveles completados, puntos, medallas y programas guardados.</p>', 'Sí, reiniciar', function () {
        S = defaults(); try { localStorage.removeItem(STORE_KEY); } catch (e) { /* nada */ }
        renderTop(); showHome();
      });
    });
  }
  function closeDrawer() { document.body.classList.remove('drawer'); }

  /* ------------------------------ medallas ------------------------------ */
  function showMedals() {
    let h = '<h2>🏅 Medallas</h2><div class="medal-grid">';
    MEDALS.forEach(function (m) {
      const got = !!S.medals[m.id];
      h += '<div class="medal' + (got ? ' got' : '') + '"><div class="m-ico">' + (got ? m.icon : '🔒') + '</div><b>' + esc(m.name) + '</b><small>' + esc(m.desc) + '</small></div>';
    });
    h += '</div><p class="muted center">XP total: <b>' + S.xp + '</b> · Mejor racha: <b>' + S.bestStreak + '</b></p>';
    modal(h, null, { cls: 'wide' });
  }
  function award(id, list) {
    if (S.medals[id]) return;
    S.medals[id] = Date.now();
    const m = MEDALS.find(function (x) { return x.id === id; });
    if (m) list.push(m);
  }

  /* ------------------------------ limpieza ------------------------------ */
  let current = { li: -1, si: -1 };
  let live = { sim: null, editor: null, demos: [], dbg: null, timers: [] };
  function cleanup() {
    if (live.sim) live.sim.destroy();
    if (live.editor) live.editor.destroy();
    live.demos.forEach(function (d) { d.destroy(); });
    live.timers.forEach(function (t) { clearInterval(t); });
    live = { sim: null, editor: null, demos: [], dbg: null, timers: [] };
  }

  /* ------------------------------ portada ------------------------------ */
  function showHome() {
    cleanup();
    current = { li: -1, si: -1 };
    renderSidebar(-1);
    renderTop();
    const ptr = currentPointer();
    const lvl = LEVELS[ptr.li], st = lvl.stages[ptr.si];
    let h = '<div class="home fade-in">';
    h += '<section class="hero"><div class="hero-txt"><span class="kicker">Learn PLC by doing</span><h1>Aprende a programar <span>PLC</span> desde cero</h1>' +
      '<p>Un juego para aprender automatización industrial haciendo: programa en <b>Ladder</b>, ejecuta tu programa en un <b>PLC virtual</b> y controla una <b>fábrica simulada</b>. Sin conocimientos previos.</p>' +
      '<div class="hero-actions"><button class="btn primary big" id="continueBtn">▶ ' + (totalProgress() ? 'Continuar' : 'Empezar') + ': Nivel ' + lvl.id + '</button>' +
      '<span class="muted">' + TYPE[st.type].icon + ' ' + esc(st.title) + '</span></div></div>' +
      '<div class="hero-art">' + heroArt() + '</div></section>';
    h += '<section class="map"><h2>Tu camino</h2><div class="road">';
    LEVELS.forEach(function (l, li) {
      const unl = levelUnlocked(li), done = !!S.levelsDone[l.id];
      const n = levelDoneCount(li), t = l.stages.length;
      h += '<button class="node' + (unl ? '' : ' locked') + (done ? ' done' : '') + (li === ptr.li ? ' current' : '') + '" data-l="' + li + '">' +
        '<span class="node-ico">' + (unl ? l.icon : '🔒') + '</span><span class="node-n">Nivel ' + l.id + (done ? ' ✓' : '') + '</span><b>' + esc(l.title) + '</b><small>' + esc(l.short) + '</small>' +
        '<span class="lvl-bar"><i style="width:' + (n * 100 / t) + '%"></i></span></button>';
    });
    h += '</div></section></div>';
    $('#main').innerHTML = h;
    $('#continueBtn').addEventListener('click', function () { openStage(ptr.li, ptr.si); });
    $$('.node', $('#main')).forEach(function (b) {
      b.addEventListener('click', function () {
        const li = Number(b.getAttribute('data-l'));
        if (!levelUnlocked(li)) { toast('🔒 Supera la prueba final del nivel anterior para desbloquearlo.', 'warn'); return; }
        const sts = LEVELS[li].stages;
        let si = sts.findIndex(function (s, i) { return !S.done[s.id] && stageUnlocked(li, i); });
        openStage(li, si < 0 ? 0 : si);
      });
    });
    $('#panel').innerHTML =
      '<section class="pcard"><h3>🎮 Cómo se juega</h3><ol class="howto">' +
      '<li><b>Lee</b> cada concepto nuevo (son cortos) y pulsa <b>Entendido → Probar</b>.</li>' +
      '<li>Mira los <b>ejemplos</b> funcionando en el simulador.</li>' +
      '<li>Programa: elige un elemento en la <b>paleta</b> y haz clic en el segmento.</li>' +
      '<li>Pulsa <b>▶ EJECUTAR PLC</b> y prueba tu programa con los pulsadores y sensores.</li>' +
      '<li>Pulsa <b>✔ Comprobar</b>: el profesor virtual prueba tu programa y te explica qué falla.</li></ol></section>' +
      '<section class="pcard"><h3>⭐ Puntuación</h3><table class="score-t"><tr><td>Sin ayuda</td><td>100</td></tr><tr><td>Con pista 1</td><td>80</td></tr><tr><td>Con pista 2</td><td>60</td></tr><tr><td>Con pista 3</td><td>40</td></tr><tr><td>Viendo la solución</td><td>20</td></tr></table><p class="muted">Lo importante es aprender: usa las pistas sin miedo.</p></section>' +
      '<section class="pcard"><h3>📊 Tu progreso</h3><div class="kv"><span>Niveles completados</span><b>' + Object.keys(S.levelsDone).length + ' / ' + LEVELS.length + '</b></div><div class="kv"><span>XP</span><b>' + S.xp + '</b></div><div class="kv"><span>Medallas</span><b>' + Object.keys(S.medals).length + ' / ' + MEDALS.length + '</b></div><div class="kv"><span>Mejor racha</span><b>' + S.bestStreak + '</b></div></section>';
  }

  function heroArt() {
    return '<svg viewBox="0 0 360 230" class="hero-svg">' +
      '<rect x="110" y="40" width="140" height="120" rx="12" class="h-plc"/><text x="180" y="72" text-anchor="middle" class="h-t">PLC</text>' +
      '<g class="h-leds">' + [0, 1, 2, 3].map(function (i) { return '<circle cx="' + (132 + i * 18) + '" cy="96" r="5" class="h-led i' + i + '"/>'; }).join('') + '</g>' +
      '<g class="h-leds">' + [0, 1, 2, 3].map(function (i) { return '<circle cx="' + (132 + i * 18) + '" cy="124" r="5" class="h-led q q' + i + '"/>'; }).join('') + '</g>' +
      '<text x="122" y="100" text-anchor="end" class="h-s">I</text><text x="122" y="128" text-anchor="end" class="h-s">Q</text>' +
      '<path d="M30 100 H110" class="h-wire"/><path d="M250 124 H330" class="h-wire q"/>' +
      '<circle cx="30" cy="100" r="16" class="h-btn"/><circle cx="330" cy="124" r="18" class="h-motor"/><path d="M330 112 L334 124 L330 136 L326 124Z M318 124 L330 128 L342 124 L330 120Z" class="h-fan"/>' +
      '<rect x="40" y="186" width="280" height="22" rx="6" class="h-belt"/><rect x="70" y="170" width="26" height="16" rx="3" class="h-part"/><rect x="70" y="170" width="26" height="16" rx="3" class="h-part m"/></svg>';
  }

  /* ------------------------------ esqueleto de etapa ------------------------------ */
  function stageHead(li, si) {
    const lvl = LEVELS[li];
    let h = '<div class="stage-top"><div class="crumbs"><button class="linkbtn" data-home>⌂ Mapa</button><span>›</span><b>Nivel ' + lvl.id + ' · ' + esc(lvl.title) + '</b></div><div class="stepper">';
    lvl.stages.forEach(function (s, i) {
      const unl = stageUnlocked(li, i), done = !!S.done[s.id];
      h += '<button class="step-pill' + (i === si ? ' cur' : '') + (done ? ' done' : '') + (unl ? '' : ' locked') + '" data-s="' + i + '" title="' + esc(TYPE[s.type].label + ': ' + s.title) + '">' +
        (done ? '✓' : unl ? TYPE[s.type].icon : '🔒') + '</button>';
    });
    h += '</div></div>';
    return h;
  }
  function bindHead(li) {
    const m = $('#main');
    $('[data-home]', m).addEventListener('click', showHome);
    $$('.step-pill', m).forEach(function (b) {
      b.addEventListener('click', function () {
        const si = Number(b.getAttribute('data-s'));
        if (!stageUnlocked(li, si)) { toast('🔒 Completa las etapas anteriores primero.', 'warn'); return; }
        openStage(li, si);
      });
    });
  }
  function exHead(st) {
    return '<div class="ex-head"><span class="type-badge t-' + st.type + '">' + TYPE[st.type].icon + ' ' + TYPE[st.type].label + '</span><h1>' + esc(st.title) + '</h1></div>';
  }

  function openStage(li, si) {
    cleanup();
    current = { li: li, si: si };
    const st = LEVELS[li].stages[si];
    renderSidebar(li);
    renderTop();
    $('#main').scrollTop = 0;
    window.scrollTo(0, 0);
    switch (st.type) {
      case 'intro': renderIntro(li, si, st); break;
      case 'concept': renderConcept(li, si, st); break;
      case 'quiz': renderQuiz(li, si, st); break;
      default: renderWorkbench(li, si, st);
    }
    bindHead(li);
  }

  function nextStage() {
    const lvl = LEVELS[current.li];
    if (current.si + 1 < lvl.stages.length) openStage(current.li, current.si + 1);
    else if (current.li + 1 < LEVELS.length && levelUnlocked(current.li + 1)) openStage(current.li + 1, 0);
    else showHome();
  }

  /* ------------------------------ completar etapas ------------------------------ */
  function completeStage(st, opts) {
    opts = opts || {};
    const li = current.li;
    const lvl = LEVELS[li];
    const firstTime = !S.done[st.id];
    S.done[st.id] = true;
    const gained = [];
    let xpGain = 0;
    if (opts.score !== undefined) {
      const prev = S.scores[st.id] || 0;
      if (opts.score > prev) { xpGain += opts.score - prev; S.scores[st.id] = opts.score; }
      if (firstTime) {
        if (opts.noHelp) { S.streak += 1; S.bestStreak = Math.max(S.bestStreak, S.streak); } else S.streak = 0;
      }
      if (EXERCISE.indexOf(st.type) >= 0) award('first', gained);
      if (st.type === 'challenge' && opts.noHelp) award('bug', gained);
      if (st.type === 'quiz' && opts.noHelp) award('quiz', gained);
      if (S.streak >= 5) award('streak', gained);
    }
    if (st.unlock === 'debug' && !S.flags.debug) { S.flags.debug = true; S.debugOn = false; toast('🔧 <b>Modo DEBUG desbloqueado.</b> Lo encontrarás en el simulador.', 'ok'); }
    let levelDone = false;
    if ((st.type === 'test' || st.type === 'quiz') && !S.levelsDone[lvl.id]) {
      S.levelsDone[lvl.id] = true;
      levelDone = true;
      xpGain += 100;
      if (LEVEL_MEDAL[lvl.id]) award(LEVEL_MEDAL[lvl.id], gained);
      const ex = lvl.stages.filter(function (s) { return EXERCISE.indexOf(s.type) >= 0 || s.type === 'interact' || s.type === 'quiz'; });
      if (ex.every(function (s) { return !S.hintUse[s.id]; })) award('autodidact', gained);
      if (ex.every(function (s) { return S.scores[s.id] === 100; })) award('perfect', gained);
    }
    S.xp += xpGain;
    save();
    renderTop();
    renderSidebar(li);
    return { xp: xpGain, medals: gained, levelDone: levelDone };
  }

  function successModal(st, res, score, extraHtml) {
    const stars = score >= 100 ? 3 : score >= 60 ? 2 : 1;
    let h = '<div class="success-burst">' + (res.levelDone ? '🎉' : '✅') + '</div><h2>' + (res.levelDone ? '¡Nivel ' + LEVELS[current.li].id + ' completado!' : '¡Correcto!') + '</h2>';
    if (score !== undefined) {
      h += '<div class="stars">' + [1, 2, 3].map(function (i) { return '<span class="' + (i <= stars ? 'on' : '') + '">★</span>'; }).join('') + '</div>';
      h += '<p class="center"><b>' + score + ' puntos</b>' + (res.xp ? ' · <span class="xp-gain">+' + res.xp + ' XP</span>' : '') + '</p>';
    }
    if (st.success) h += '<div class="why-works"><b>¿Por qué funciona?</b>' + st.success + '</div>';
    if (extraHtml) h += extraHtml;
    if (res.medals.length) {
      h += '<div class="new-medals">' + res.medals.map(function (m) { return '<div class="medal got pop"><div class="m-ico">' + m.icon + '</div><b>Nueva medalla: ' + esc(m.name) + '</b><small>' + esc(m.desc) + '</small></div>'; }).join('') + '</div>';
    }
    if (res.levelDone && current.li + 1 < LEVELS.length) h += '<p class="center unlock-msg">🔓 Has desbloqueado el <b>Nivel ' + LEVELS[current.li + 1].id + ': ' + esc(LEVELS[current.li + 1].title) + '</b></p>';
    if (res.levelDone && current.li + 1 >= LEVELS.length) h += '<p class="center unlock-msg">Has completado <b>PLC Academy</b>. Sigue practicando en el 🧪 Laboratorio libre.</p>';
    modal(h, [{ label: 'Quedarme aquí' }, { label: 'Continuar →', primary: true, onClick: nextStage }], { cls: 'success' });
  }

  /* ------------------------------ INTRO ------------------------------ */
  function renderIntro(li, si, st) {
    $('#main').innerHTML = stageHead(li, si) + '<div class="center-wrap fade-in"><article class="story-card"><span class="type-badge t-intro">📖 Nivel ' + LEVELS[li].id + '</span><h1>' + esc(st.title) + '</h1><div class="story-body">' + st.html + '</div><div class="card-actions"><button class="btn primary big" id="goBtn">Empezar →</button></div></article></div>';
    $('#goBtn').addEventListener('click', function () { completeStage(st); nextStage(); });
    levelPanel(li, si);
  }

  /* Panel derecho genérico: conceptos del nivel */
  function levelPanel(li, si) {
    const lvl = LEVELS[li];
    let h = '<section class="pcard"><h3>' + lvl.icon + ' Nivel ' + lvl.id + '</h3><p class="muted">' + esc(lvl.short) + '</p><div class="kv"><span>Progreso del nivel</span><b>' + levelDoneCount(li) + ' / ' + lvl.stages.length + '</b></div></section>';
    const concepts = lvl.stages.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s.type === 'concept'; });
    if (concepts.length) {
      h += '<section class="pcard"><h3>📚 Conceptos de este nivel</h3><ul class="concept-list">' + concepts.map(function (x) {
        const seen = !!S.done[x.s.id];
        return '<li class="' + (seen ? 'seen' : '') + (x.i === si ? ' cur' : '') + '"><button class="linkbtn" data-c="' + x.i + '"' + (stageUnlocked(li, x.i) ? '' : ' disabled') + '>' + (seen ? '✓ ' : '○ ') + esc(x.s.title) + '</button></li>';
      }).join('') + '</ul></section>';
    }
    $('#panel').innerHTML = h;
    $$('[data-c]', $('#panel')).forEach(function (b) { b.addEventListener('click', function () { openStage(li, Number(b.getAttribute('data-c'))); }); });
  }

  /* ------------------------------ CONCEPTO ------------------------------ */
  function renderConcept(li, si, st) {
    const seen = !!S.done[st.id];
    let h = stageHead(li, si) + '<div class="center-wrap fade-in"><article class="concept-card">';
    h += '<div class="new-badge">💡 NUEVO CONCEPTO</div><h1>' + esc(st.title) + '</h1><div class="concept-body">' + st.html + '</div>';
    if (st.visual) h += '<div class="concept-visual">' + st.visual + '</div>';
    h += '<div class="try" id="tryBox" hidden></div>';
    h += '<div class="card-actions"><button class="btn primary big" id="cBtn">Entendido → Probar</button></div></article></div>';
    $('#main').innerHTML = h;
    const btn = $('#cBtn'), box = $('#tryBox');
    let ready = false, revealed = false;
    function reveal() {
      revealed = true;
      box.hidden = false;
      if (st.demo) {
        box.innerHTML = '<div class="try-h">🧪 Pruébalo</div><p class="try-prompt">' + (st.demo.prompt || '') + '</p><div class="demo"></div>';
        live.demos.push(PLC.MiniDemo($('.demo', box), st.demo));
        ready = true;
      } else if (st.quiz) {
        const q = st.quiz;
        box.innerHTML = '<div class="try-h">❓ Comprueba que lo has entendido</div><p class="q">' + q.q + '</p><div class="opts">' +
          q.options.map(function (o, i) { return '<button class="opt" data-o="' + i + '">' + o + '</button>'; }).join('') + '</div><div class="q-fb"></div>';
        $$('.opt', box).forEach(function (b) {
          b.addEventListener('click', function () {
            const i = Number(b.getAttribute('data-o'));
            const fb = $('.q-fb', box);
            if (i === q.answer) {
              b.classList.add('right');
              $$('.opt', box).forEach(function (x) { x.disabled = true; });
              fb.innerHTML = '<div class="fb ok">✅ ¡Exacto! ' + q.explain + '</div>';
              ready = true; btn.disabled = false;
            } else {
              b.classList.add('wrong'); b.disabled = true;
              fb.innerHTML = '<div class="fb bad">❌ No exactamente. Vuelve a leer la explicación de arriba e inténtalo otra vez.</div>';
            }
          });
        });
      } else ready = true;
      btn.innerHTML = 'Siguiente →';
      btn.disabled = !ready && !seen;
      if (seen && st.quiz) { btn.disabled = false; }
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    btn.addEventListener('click', function () {
      if (!revealed) { reveal(); return; }
      if (!ready && !seen) return;
      completeStage(st);
      nextStage();
    });
    levelPanel(li, si);
  }

  /* ------------------------------ PRUEBA DE PREGUNTAS ------------------------------ */
  function renderQuiz(li, si, st) {
    let qi = 0, wrong = 0;
    $('#main').innerHTML = stageHead(li, si) + '<div class="center-wrap fade-in"><article class="concept-card quiz-card"><span class="type-badge t-quiz">🏁 Prueba final</span><h1>' + esc(st.title) + '</h1><div class="quiz-prog"></div><div id="qBox"></div></article></div>';
    function draw() {
      const q = st.questions[qi];
      $('.quiz-prog').innerHTML = st.questions.map(function (x, i) { return '<span class="' + (i < qi ? 'done' : i === qi ? 'cur' : '') + '"></span>'; }).join('');
      $('#qBox').innerHTML = '<p class="q"><b>Pregunta ' + (qi + 1) + ' de ' + st.questions.length + '.</b> ' + q.q + '</p><div class="opts">' +
        q.options.map(function (o, i) { return '<button class="opt" data-o="' + i + '">' + o + '</button>'; }).join('') + '</div><div class="q-fb"></div><div class="card-actions"><button class="btn primary" id="qNext" hidden>Siguiente →</button></div>';
      $$('.opt', $('#qBox')).forEach(function (b) {
        b.addEventListener('click', function () {
          const i = Number(b.getAttribute('data-o'));
          const fb = $('.q-fb');
          if (i === q.answer) {
            b.classList.add('right');
            $$('.opt').forEach(function (x) { x.disabled = true; });
            fb.innerHTML = '<div class="fb ok">✅ Correcto. ' + q.explain + '</div>';
            $('#qNext').hidden = false;
            $('#qNext').focus();
          } else {
            wrong += 1;
            b.classList.add('wrong'); b.disabled = true;
            fb.innerHTML = '<div class="fb bad">❌ No es correcto. ' + q.explain.split('.')[0] + '… ¡piénsalo otra vez!</div>';
          }
        });
      });
      $('#qNext').addEventListener('click', function () {
        qi += 1;
        if (qi < st.questions.length) draw();
        else {
          const score = Math.max(20, 100 - wrong * 20);
          const res = completeStage(st, { score: score, noHelp: wrong === 0 });
          successModal(st, res, score, '<p class="center">Has acertado ' + st.questions.length + ' preguntas con ' + wrong + ' fallo' + (wrong === 1 ? '' : 's') + '.</p>');
        }
      });
    }
    draw();
    levelPanel(li, si);
  }

  /* ------------------------------ BANCO DE TRABAJO (editor + simulador) ------------------------------ */
  function initialProgram(li, si) {
    const st = LEVELS[li].stages[si];
    if (st.initial === 'previous') {
      for (let k = si - 1; k >= 0; k--) {
        const p = LEVELS[li].stages[k];
        if (EXERCISE.indexOf(p.type) >= 0) return S.programs[p.id] || p.solution || PLC.emptyProgram();
      }
    }
    return st.initial || st.program || PLC.emptyProgram();
  }

  function symbolsCard(io) {
    const kind = { button: 'Pulsador', switch: 'Interruptor', sensor: 'Sensor', estop: 'Seta emergencia (NC)', lamp: 'Lámpara', motor: 'Motor', pump: 'Bomba', buzzer: 'Sirena', valve: 'Electroválvula' };
    let h = '<section class="pcard"><h3>🏷 Tabla de símbolos</h3><table class="sym-t">';
    io.inputs.forEach(function (d) { h += '<tr><td><code>' + d.addr + '</code></td><td><b>' + esc(d.name) + '</b></td><td>' + (kind[d.kind] || '') + '</td></tr>'; });
    io.outputs.forEach(function (d) { h += '<tr><td><code>' + d.addr + '</code></td><td><b>' + esc(d.name) + '</b></td><td>' + (kind[d.kind] || '') + '</td></tr>'; });
    (io.memories || []).forEach(function (d) { h += '<tr><td><code>' + d.addr + '</code></td><td><b>' + esc(d.name) + '</b></td><td>Memoria</td></tr>'; });
    (io.timers || []).forEach(function (d) { h += '<tr><td><code>' + d.addr + '</code></td><td><b>' + esc(d.name) + '</b></td><td>Temporizador</td></tr>'; });
    (io.counters || []).forEach(function (d) { h += '<tr><td><code>' + d.addr + '</code></td><td><b>' + esc(d.name) + '</b></td><td>Contador</td></tr>'; });
    h += '</table>';
    if (io.inputs.some(function (d) { return d.wiring === 'NC'; })) h += '<p class="muted small">⚠ La seta está cableada NC: su señal vale 1 cuando NO está pulsada.</p>';
    h += '<p class="muted small">Teclas <kbd>1</kbd>–<kbd>9</kbd>: accionar entradas. Mayús+clic en un pulsador lo deja enclavado.</p></section>';
    return h;
  }

  function hintHtml(hint) {
    if (typeof hint === 'string') return '<div>' + hint + '</div>';
    return '<div>' + hint.text + '</div>' + (hint.program ? '<div class="hint-ladder" data-hintprog></div>' : '');
  }

  function renderWorkbench(li, si, st) {
    const isEx = EXERCISE.indexOf(st.type) >= 0;
    const isInteract = st.type === 'interact';
    const isExample = st.type === 'example';
    const lvlTools = toolsFor(li);
    const memo = {};

    // ----- centro -----
    let h = stageHead(li, si) + '<div class="bench fade-in">' + exHead(st);
    h += '<section class="card"><div class="card-h"><h3>🪜 Programa <small>Ladder</small></h3><span class="card-h-r">' + debugToggle() + '</span></div><div id="editorBox"></div></section>';
    h += '<section class="card"><div class="card-h"><h3>🏭 Simulador</h3></div><div id="simBox"></div></section>';
    if (!isEx && !isInteract) h += '<div class="card-actions"><button class="btn primary big" id="nextBtn">Siguiente →</button></div>';
    h += '</div>';
    $('#main').innerHTML = h;

    // ----- panel derecho -----
    let p = '';
    p += '<section class="pcard task"><h3>' + (isExample ? '🔍 Qué observar' : isInteract ? '🧭 Misión' : st.type === 'challenge' ? '🐞 El problema' : '📋 Tarea') + '</h3><div class="task-body">' + (st.html || '') + '</div>';
    if (st.steps) p += '<ol class="steps" id="stepsList"></ol>';
    p += '</section>';
    if (isEx) {
      p += '<button class="btn primary big wide check" id="checkBtn">✔ Comprobar programa</button>';
      p += '<section class="pcard feedback" id="feedback" hidden></section>';
    }
    p += '<section class="pcard debug" id="debugCard" hidden><h3>🔧 DEBUG <small>estado interno del PLC</small></h3><div data-dbgdata></div><div class="dbg-log-h">Registro del ciclo de scan</div><div class="dbg-log" data-dbglog></div></section>';
    if (isEx || isInteract) p += '<section class="pcard hints" id="hintsCard"></section>';
    p += symbolsCard(st.io);
    $('#panel').innerHTML = p;

    // ----- editor -----
    const extra = [];
    if (isEx) extra.push({ label: '⟲ Reiniciar ejercicio', title: 'Volver al programa inicial del ejercicio', onClick: function () {
      confirmBox('<h2>¿Reiniciar el ejercicio?</h2><p>Se perderán los cambios de tu programa.</p>', 'Reiniciar', function () {
        editor.setProgram(initialProgram(li, si)); onProgramChange(editor.getProgram());
      });
    } });
    if (isExample) extra.push({ label: '⟲ Restaurar ejemplo', onClick: function () { editor.setProgram(st.program); } });
    const editor = new PLC.LadderEditor($('#editorBox'), {
      io: st.io, tools: isInteract ? [] : lvlTools.tools, locked: lvlTools.locked, readonly: isInteract,
      extraActions: extra,
      onChange: function (prog) { onProgramChange(prog); }
    });
    live.editor = editor;
    const saved = isEx ? S.programs[st.id] : null;
    editor.setProgram(saved || (isEx ? initialProgram(li, si) : st.program));

    // ----- simulador -----
    const dbg = new PLC.DebugPanel($('#debugCard'), st.io);
    live.dbg = dbg;
    let lastDbg = 0, lastSteps = 0;
    const sim = new PLC.Simulator($('#simBox'), {
      io: st.io, scene: st.scene, debug: debugUnlocked() && S.debugOn,
      getProgram: function () { return editor.getProgram(); },
      onFrame: function (engine, s) {
        editor.updateLive(engine);
        const now = performance.now();
        if (S.debugOn && debugUnlocked() && now - lastDbg > 120) { lastDbg = now; dbg.render(s.engine, s, editor.getProgram()); }
        if (st.steps && now - lastSteps > 150) { lastSteps = now; evalSteps(); }
      },
      onLog: function (log) { if (S.debugOn) dbg.renderLog(log); },
      onRung: function (i) { editor.highlightRung(i); }
    });
    live.sim = sim;
    setDebugVisible(S.debugOn && debugUnlocked());
    bindDebugToggle(function (on) { sim.setDebug(on); setDebugVisible(on, true); if (on) { dbg.render(sim.engine, sim, editor.getProgram()); dbg.renderLog(sim.log); } });

    // ----- pasos guiados -----
    const liveDone = {};
    function evalSteps() {
      if (!st.steps) return;
      const prog = editor.getProgram();
      const ctx = { sim: sim, engine: sim.running ? sim.engine : null, world: sim.world, memo: memo };
      let html = '', firstOpen = -1, allDone = true;
      st.steps.forEach(function (step, i) {
        let ok;
        if (step.final) ok = !!S.done[st.id];
        else if (step.live) {
          if (!liveDone[i] && (!isInteract || i === 0 || liveDone[i - 1])) { try { if (step.live(ctx)) liveDone[i] = true; } catch (e) { /* nada */ } }
          ok = !!liveDone[i];
        } else ok = step.check(prog, PLC.find);
        if (!ok && firstOpen < 0) firstOpen = i;
        if (!ok) allDone = false;
        html += '<li class="' + (ok ? 'ok' : i === firstOpen ? 'cur' : '') + '"><span class="st-ico">' + (ok ? '✓' : i + 1) + '</span><span>' + step.text + '</span></li>';
      });
      const list = $('#stepsList');
      if (list && list.innerHTML !== html) list.innerHTML = html;
      const tgt = firstOpen >= 0 && st.steps[firstOpen].target ? [st.steps[firstOpen].target] : [];
      if (JSON.stringify(tgt) !== JSON.stringify(editor.targets)) editor.setTargets(tgt);
      if (isInteract && allDone && !memo.completed) {
        memo.completed = true;
        const hu = S.hintUse[st.id] || 0;
        const score = SCORE[hu];
        const res = completeStage(st, { score: score, noHelp: hu === 0 });
        setTimeout(function () { successModal(st, res, score); }, 500);
      }
    }
    evalSteps();

    function onProgramChange(prog) {
      if (isEx) { S.programs[st.id] = PLC.clone(prog); save(); }
      evalSteps();
      if (sim.stepMode) sim.stop();
    }

    // ----- ayudas -----
    if (isEx || isInteract) renderHints(st, editor);

    // ----- comprobar -----
    if (isEx) {
      let fails = 0;
      $('#checkBtn').addEventListener('click', function () {
        const btn = $('#checkBtn');
        btn.disabled = true; btn.innerHTML = '⏳ Probando tu programa…';
        setTimeout(function () {
          let res;
          try { res = PLC.Validator.run(st, editor.getProgram()); } catch (e) { console.error(e); res = { ok: false, fail: { title: 'Error interno al comprobar.', why: String(e) }, passed: [], warnings: [] }; }
          btn.disabled = false; btn.innerHTML = '✔ Comprobar programa';
          const fb = $('#feedback');
          if (res.ok) {
            fb.hidden = false;
            fb.className = 'pcard feedback ok';
            fb.innerHTML = '<h3>✅ ¡Funciona!</h3><ul class="tests">' + res.passed.map(function (n) { return '<li class="ok">✓ ' + esc(n) + '</li>'; }).join('') + '</ul>' + warningsHtml(res.warnings);
            const hu = S.hintUse[st.id] || 0;
            const score = SCORE[hu];
            const r = completeStage(st, { score: score, noHelp: hu === 0 });
            evalSteps();
            successModal(st, r, score);
          } else {
            fails += 1;
            fb.hidden = false;
            fb.className = 'pcard feedback bad shake-in';
            const f = res.fail || {};
            let fh = '<h3>❌ ' + esc(f.title || 'Todavía no funciona') + '</h3>';
            if (f.why) fh += '<div class="fb-why"><b>¿Por qué?</b><p>' + f.why + '</p></div>';
            if (f.hint) fh += '<div class="fb-hint"><b>💡 Pista</b><p>' + f.hint + '</p></div>';
            if (res.failedTest || res.passed.length) {
              fh += '<div class="fb-tests"><b>Pruebas del profesor</b><ul class="tests">' + res.passed.map(function (n) { return '<li class="ok">✓ ' + esc(n) + '</li>'; }).join('') +
                (res.failedTest ? '<li class="bad">✗ ' + esc(res.failedTest) + (f.at ? ' <small>(a los ' + f.at + ' s de prueba)</small>' : '') + '</li>' : '') + '</ul></div>';
            }
            fh += warningsHtml(res.warnings);
            if (fails >= 2 && (S.hintUse[st.id] || 0) < 3) fh += '<p class="fb-nudge">¿Atascado/a? No pasa nada: pide una <b>pista</b> más abajo. 👇</p>';
            fb.innerHTML = fh;
            if (fails >= 2) { const hc = $('#hintsCard'); if (hc) hc.classList.add('pulse'); }
            fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 60);
      });
    }

    const nb = $('#nextBtn');
    if (nb) nb.addEventListener('click', function () { completeStage(st); nextStage(); });
  }

  function warningsHtml(w) {
    if (!w || !w.length) return '';
    return '<div class="fb-warn"><b>⚠ Avisos sobre tu programa</b><ul>' + w.map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join('') + '</ul></div>';
  }

  function renderHints(st, editor) {
    const card = $('#hintsCard');
    const hints = st.hints || [];
    function draw() {
      const used = S.hintUse[st.id] || 0;
      let h = '<h3>💡 Ayuda <small>puntuación máxima: <b>' + SCORE[used] + '</b></small></h3>';
      for (let i = 0; i < Math.min(used, hints.length); i++) h += '<div class="hint shown"><span class="hint-n">Pista ' + (i + 1) + '</span>' + hintHtml(hints[i]) + '</div>';
      if (used < hints.length) {
        const labels = ['Pista 1: una pequeña ayuda', 'Pista 2: qué concepto usar', 'Pista 3: cómo resolverlo'];
        h += '<button class="btn ghost wide hint-btn" id="hintBtn"><span>💡 ' + labels[used] + '</span><small>máx. ' + SCORE[used + 1] + '</small></button>';
      }
      if (st.solution) {
        h += used >= 4 ? '<p class="muted small">Has visto la solución completa. Estúdiala, ejecútala y pulsa Comprobar.</p>'
          : '<button class="btn ghost wide hint-btn danger-txt" id="solBtn"><span>👁 Ver la solución completa</span><small>máx. 20</small></button>';
      }
      card.innerHTML = h;
      card.querySelectorAll('[data-hintprog]').forEach(function (el, k) {
        const hint = hints.filter(function (x) { return typeof x !== 'string' && x.program; })[k];
        if (hint) { const ed = new PLC.LadderEditor(el, { io: st.io, readonly: true }); ed.setProgram(hint.program); }
      });
      const hb = $('#hintBtn');
      if (hb) hb.addEventListener('click', function () {
        S.hintUse[st.id] = Math.max(S.hintUse[st.id] || 0, used + 1);
        save(); card.classList.remove('pulse'); draw();
      });
      const sb = $('#solBtn');
      if (sb) sb.addEventListener('click', function () {
        confirmBox('<h2>¿Ver la solución completa?</h2><p>Tu puntuación máxima en este ejercicio bajará a <b>20 puntos</b>. Antes puedes probar con las pistas.</p><p>La solución se cargará en el editor (tu programa actual se sustituirá).</p>', 'Ver solución', function () {
          S.hintUse[st.id] = 4; save();
          editor.setProgram(st.solution, true);
          S.programs[st.id] = PLC.clone(st.solution);
          save(); draw();
          toast('Solución cargada. Ejecútala para ver cómo funciona y pulsa <b>✔ Comprobar</b>.', 'info');
        });
      });
    }
    draw();
  }

  /* ------------------------------ DEBUG ------------------------------ */
  function debugToggle() {
    if (!debugUnlocked()) return '<button class="btn sm ghost dbg-toggle locked" disabled title="Se desbloquea en el nivel 6">🔒 DEBUG</button>';
    return '<button class="btn sm dbg-toggle' + (S.debugOn ? ' on' : '') + '" id="dbgToggle" title="Mostrar el estado interno del PLC y ejecutar paso a paso">🔧 DEBUG ' + (S.debugOn ? 'ON' : 'OFF') + '</button>';
  }
  function bindDebugToggle(cb) {
    const b = $('#dbgToggle');
    if (!b) return;
    b.addEventListener('click', function () {
      S.debugOn = !S.debugOn; save();
      b.classList.toggle('on', S.debugOn);
      b.innerHTML = '🔧 DEBUG ' + (S.debugOn ? 'ON' : 'OFF');
      cb(S.debugOn);
    });
  }
  function setDebugVisible(on, scroll) {
    const c = $('#debugCard');
    if (!c) return;
    c.hidden = !on;
    if (on && scroll) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ------------------------------ LABORATORIO LIBRE ------------------------------ */
  const H = PLC.H;
  const LAB = {
    panel: { name: 'Panel de mando', io: H.io([H.btn('I0.0', 'PULSADOR_1'), H.btn('I0.1', 'PULSADOR_2', 'red'), H.sw('I0.2', 'SELECTOR_1'), H.sw('I0.3', 'SELECTOR_2'), H.sens('I0.4', 'SENSOR_1'), H.sens('I0.5', 'SENSOR_2')], [H.motor('Q0.0', 'MOTOR'), H.lamp('Q0.1', 'LUZ_VERDE', 'green'), H.lamp('Q0.2', 'LUZ_AMBAR', 'amber'), H.lamp('Q0.3', 'LUZ_ROJA', 'red'), H.buzzer('Q0.4', 'SIRENA')]) },
    conveyor: { name: 'Línea de clasificación', io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red'), H.sens('I0.2', 'FOTOCELULA'), H.sens('I0.3', 'SENSOR_METAL'), H.sens('I0.4', 'CIL_FUERA'), H.sens('I0.5', 'CIL_DENTRO'), H.sens('I0.6', 'SENSOR_FINAL'), H.sens('I0.7', 'ENTRADA')], [H.motor('Q0.0', 'CINTA'), H.valve('Q0.1', 'CILINDRO'), H.lamp('Q0.2', 'LUZ', 'green')]), scene: { type: 'conveyor', motor: 'Q0.0', types: ['metal', 'plastic'], sensors: [{ addr: 'I0.7', x: 20, kind: 'photo' }, { addr: 'I0.2', x: 420, kind: 'photo' }, { addr: 'I0.3', x: 420, kind: 'inductive' }, { addr: 'I0.6', x: 600, kind: 'photo' }], cylinder: { out: 'Q0.1', x: 420, ext: 'I0.4', ret: 'I0.5' }, feeder: true } },
    door: { name: 'Puerta automática', io: H.io([H.sens('I0.0', 'PRESENCIA'), H.sens('I0.1', 'FC_ABIERTA'), H.sens('I0.2', 'FC_CERRADA'), H.btn('I0.3', 'PULSADOR')], [H.motor('Q0.0', 'MOTOR_ABRIR'), H.motor('Q0.1', 'MOTOR_CERRAR'), H.lamp('Q0.2', 'LUZ', 'amber')]), scene: { type: 'axis', skin: 'door', plus: 'Q0.0', minus: 'Q0.1', limMax: 'I0.1', limMin: 'I0.2', presence: 'I0.0', speed: 0.5 } },
    lift: { name: 'Montacargas', io: H.io([H.btn('I0.0', 'LLAMADA_P0'), H.btn('I0.1', 'LLAMADA_P1'), H.sens('I0.2', 'FC_P0'), H.sens('I0.3', 'FC_P1')], [H.motor('Q0.0', 'SUBIR'), H.motor('Q0.1', 'BAJAR'), H.lamp('Q0.2', 'LUZ', 'amber')]), scene: { type: 'axis', skin: 'lift', plus: 'Q0.0', minus: 'Q0.1', limMax: 'I0.3', limMin: 'I0.2', speed: 0.5 } },
    drill: { name: 'Taladro', io: H.io([H.btn('I0.0', 'START'), H.sens('I0.1', 'ARRIBA'), H.sens('I0.2', 'ABAJO')], [H.motor('Q0.0', 'BAJAR'), H.motor('Q0.1', 'SUBIR'), H.motor('Q0.2', 'HUSILLO')]), scene: { type: 'axis', skin: 'drill', plus: 'Q0.0', minus: 'Q0.1', limMax: 'I0.2', limMin: 'I0.1', spindle: 'Q0.2', speed: 0.5 } },
    tank: { name: 'Depósito', io: H.io([H.sw('I0.0', 'AUTOMATICO'), H.sens('I0.2', 'NIVEL_BAJO'), H.sens('I0.3', 'NIVEL_ALTO'), H.sens('I0.4', 'REBOSE')], [H.pump('Q0.0', 'BOMBA'), H.valve('Q0.1', 'VALVULA_VACIADO'), H.lamp('Q0.2', 'ALARMA', 'red')]), scene: { type: 'tank', pump: 'Q0.0', valve: 'Q0.1', level: 40, consume: false, sensors: [{ addr: 'I0.2', level: 20 }, { addr: 'I0.3', level: 80 }, { addr: 'I0.4', level: 95 }] } },
    traffic: { name: 'Semáforo', io: H.io([H.sw('I0.0', 'MARCHA'), H.btn('I0.1', 'PULSADOR_PEATON')], [H.lamp('Q0.0', 'ROJO', 'red'), H.lamp('Q0.1', 'AMBAR', 'amber'), H.lamp('Q0.2', 'VERDE', 'green')]), scene: { type: 'traffic', red: 'Q0.0', yellow: 'Q0.1', green: 'Q0.2' } }
  };
  let labKey = 'panel';
  function openLab(key) {
    cleanup();
    current = { li: -1, si: -1 };
    labKey = key || labKey;
    const cfg = LAB[labKey];
    renderSidebar('lab');
    renderTop();
    const tools = toolsFor(maxUnlockedLevel());
    let h = '<div class="bench fade-in"><div class="stage-top"><div class="crumbs"><button class="linkbtn" data-home>⌂ Mapa</button><span>›</span><b>🧪 Laboratorio libre</b></div></div>';
    h += '<div class="ex-head"><span class="type-badge t-lab">🧪 Sin pruebas, sin puntos</span><h1>Laboratorio libre</h1></div>';
    h += '<div class="lab-select">' + Object.keys(LAB).map(function (k) { return '<button class="chip' + (k === labKey ? ' on' : '') + '" data-lab="' + k + '">' + esc(LAB[k].name) + '</button>'; }).join('') + '</div>';
    h += '<section class="card"><div class="card-h"><h3>🪜 Programa <small>Ladder</small></h3><span class="card-h-r">' + debugToggle() + '</span></div><div id="editorBox"></div></section>';
    h += '<section class="card"><div class="card-h"><h3>🏭 Simulador</h3></div><div id="simBox"></div></section></div>';
    $('#main').innerHTML = h;
    $('[data-home]').addEventListener('click', showHome);
    $$('[data-lab]', $('#main')).forEach(function (b) { b.addEventListener('click', function () { openLab(b.getAttribute('data-lab')); }); });
    $('#panel').innerHTML = '<section class="pcard"><h3>🧪 Experimenta</h3><p>Aquí puedes programar lo que quieras, sin pruebas ni puntuación. Elige una máquina arriba.</p><p class="muted">Tienes disponibles las herramientas de los niveles que has desbloqueado. Tus programas se guardan automáticamente.</p></section>' +
      '<section class="pcard debug" id="debugCard" hidden><h3>🔧 DEBUG</h3><div data-dbgdata></div><div class="dbg-log-h">Registro del ciclo de scan</div><div class="dbg-log" data-dbglog></div></section>' + symbolsCard(cfg.io);
    const id = 'lab-' + labKey;
    const editor = new PLC.LadderEditor($('#editorBox'), {
      io: cfg.io, tools: tools.tools, locked: tools.locked,
      extraActions: [{ label: '🗑 Vaciar', onClick: function () { confirmBox('<h2>¿Vaciar el programa?</h2>', 'Vaciar', function () { editor.setProgram(PLC.emptyProgram()); S.programs[id] = PLC.emptyProgram(); save(); }); } }],
      onChange: function (p) { S.programs[id] = PLC.clone(p); save(); }
    });
    live.editor = editor;
    editor.setProgram(S.programs[id] || PLC.emptyProgram());
    const dbg = new PLC.DebugPanel($('#debugCard'), cfg.io);
    let lastDbg = 0;
    const sim = new PLC.Simulator($('#simBox'), {
      io: cfg.io, scene: cfg.scene, debug: debugUnlocked() && S.debugOn,
      getProgram: function () { return editor.getProgram(); },
      onFrame: function (engine, s) {
        editor.updateLive(engine);
        const now = performance.now();
        if (S.debugOn && debugUnlocked() && now - lastDbg > 120) { lastDbg = now; dbg.render(s.engine, s, editor.getProgram()); }
      },
      onLog: function (log) { if (S.debugOn) dbg.renderLog(log); },
      onRung: function (i) { editor.highlightRung(i); }
    });
    live.sim = sim;
    setDebugVisible(S.debugOn && debugUnlocked());
    bindDebugToggle(function (on) { sim.setDebug(on); setDebugVisible(on, true); });
  }

  /* ------------------------------ arranque ------------------------------ */
  $('#brand').addEventListener('click', function (e) { e.preventDefault(); showHome(); });
  $('#menuBtn').addEventListener('click', function () { document.body.classList.toggle('drawer'); });
  renderTop();
  showHome();
  if (UNLOCK_ALL) toast('👩‍🏫 Modo profesor: todos los niveles desbloqueados (no se guarda como progreso real).', 'info');
})();
