/* =========================================================================
 * PLC Academy — Simulador: PLC virtual, dispositivos de campo, escena,
 * bucle de ejecución, modo paso a paso (DEBUG) y mini-demos.
 * ========================================================================= */
(function (root) {
  'use strict';
  const PLC = (root.PLC = root.PLC || {});
  const esc = function (s) { return PLC.esc(s); };
  const SCAN_MS = 50;
  const STEP_MS = 100;

  function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }

  /* ----------------------- Dispositivos de entrada ----------------------- */
  function inputDevice(d, i) {
    const key = i < 9 ? '<kbd>' + (i + 1) + '</kbd>' : '';
    const kind = d.kind || 'button';
    let vis = '';
    if (kind === 'button') vis = '<div class="pb pb-' + (d.color || 'green') + '"><div class="pb-cap"></div></div>';
    else if (kind === 'switch') vis = '<div class="sw"><div class="sw-knob"></div></div>';
    else if (kind === 'estop') vis = '<div class="estop"><div class="estop-cap"></div></div>';
    else vis = '<div class="sens"><div class="sens-body"></div><div class="sens-wave"></div></div>';
    const tip = kind === 'button' ? 'Pulsador: mantén pulsado (o tecla ' + (i + 1) + '). Mayús+clic lo deja enclavado.' :
      kind === 'switch' ? 'Interruptor/selector: clic para cambiar de posición' :
        kind === 'estop' ? 'Seta de emergencia: clic para pulsar / desenclavar' : 'Sensor: clic para simular que detecta / deja de detectar';
    return '<div class="dev dev-in k-' + kind + '" data-in="' + d.addr + '" title="' + esc(tip) + '">' + vis +
      '<div class="dev-txt"><b>' + esc(d.name) + '</b><span>' + d.addr + (d.wiring === 'NC' ? ' · NC' : '') + ' ' + key + '</span></div>' +
      '<div class="dev-sig" title="Señal que llega al borne del PLC"><i class="led" data-sig="' + d.addr + '"></i></div></div>';
  }

  /* ----------------------- Dispositivos de salida ----------------------- */
  function outputDevice(d) {
    const kind = d.kind || 'lamp';
    let vis = '';
    if (kind === 'lamp') vis = '<div class="lamp lamp-' + (d.color || 'yellow') + '"><div class="lamp-glass"></div></div>';
    else if (kind === 'motor' || kind === 'pump') vis = '<div class="motor"><svg viewBox="-20 -20 40 40"><circle r="17" class="m-ring"/><g class="m-fan"><path d="M0 -12 L4 0 L0 12 L-4 0Z M-12 0 L0 4 L12 0 L0 -4Z"/></g></svg></div>';
    else if (kind === 'buzzer') vis = '<div class="buzzer">🔔</div>';
    else if (kind === 'valve' || kind === 'cylinder') vis = '<div class="valve"><svg viewBox="0 0 40 30"><rect x="2" y="8" width="26" height="14" rx="2" class="v-body"/><rect class="v-rod" x="28" y="13" width="10" height="4"/></svg></div>';
    else vis = '<div class="lamp lamp-blue"><div class="lamp-glass"></div></div>';
    return '<div class="dev dev-out k-' + kind + '" data-out="' + d.addr + '">' + vis +
      '<div class="dev-txt"><b>' + esc(d.name) + '</b><span>' + d.addr + '</span></div></div>';
  }

  /* ===================================================================== */
  function Simulator(rootEl, opts) {
    this.root = rootEl;
    this.opts = Object.assign({ compact: false, debug: false }, opts || {});
    this.io = this.opts.io;
    this.world = new PLC.World(this.io, this.opts.scene);
    this.engine = new PLC.Engine();
    this.running = false;
    this.stepMode = false;
    this.phase = 0;      // 0 = siguiente fase es "leer entradas"
    this.acc = 0;
    this.last = 0;
    this.latched = {};
    this.log = [];
    this.build();
    const self = this;
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
    if (this.opts.compact) this.start();
  }

  Simulator.prototype.build = function () {
    const self = this;
    const io = this.io;
    const c = this.opts.compact;
    let h = '<div class="sim' + (c ? ' compact' : '') + '">';
    if (!c) {
      h += '<div class="sim-toolbar">' +
        '<button class="btn run" data-act="run">▶ EJECUTAR PLC</button>' +
        '<div class="scan-cycle" title="Ciclo de scan del PLC"><span data-ph="0">① Leer entradas</span><span data-ph="1">② Ejecutar programa</span><span data-ph="2">③ Escribir salidas</span></div>' +
        '<span class="scan-info" data-info>PLC en STOP</span><span class="spacer"></span>' +
        '<span class="dbg-btns" data-dbg><button class="btn sm amber" data-act="step" title="Ejecutar una fase del ciclo de scan">⏭ Paso</button>' +
        '<button class="btn sm amber" data-act="scan" title="Completar el ciclo de scan actual">⏩ Scan</button></span>' +
        '<button class="btn sm ghost" data-act="reset" title="Reiniciar la simulación (PLC y máquina)">↺ Reiniciar</button></div>';
      if (this.opts.scene) h += '<div class="sim-scene" data-scene></div>';
    }
    h += '<div class="sim-io">';
    h += '<div class="io-col"><div class="io-h">Entradas · campo</div>' + io.inputs.map(inputDevice).join('') + '</div>';
    if (!c) {
      h += '<div class="plc-rack"><div class="plc-brand"><span>PLC</span><small>CPU virtual</small></div>' +
        '<div class="plc-status"><span><i class="led" data-run-led></i>RUN</span><span><i class="led red" data-stop-led></i>STOP</span></div>' +
        '<div class="plc-io"><div><div class="plc-io-h">ENTRADAS</div>' +
        io.inputs.map(function (d) { return '<div class="plc-pin"><i class="led" data-ileds="' + d.addr + '"></i>' + d.addr + '</div>'; }).join('') +
        '</div><div><div class="plc-io-h">SALIDAS</div>' +
        io.outputs.map(function (d) { return '<div class="plc-pin"><i class="led amber" data-qleds="' + d.addr + '"></i>' + d.addr + '</div>'; }).join('') +
        '</div></div><div class="plc-scan" data-scancount>scan 0</div></div>';
    }
    h += '<div class="io-col"><div class="io-h">Salidas · campo</div>' + io.outputs.map(outputDevice).join('') + '</div>';
    h += '</div>';
    if (!c) h += '<div class="sim-hint" data-hint>Pulsa <b>▶ EJECUTAR PLC</b> para poner el PLC en marcha. Luego acciona los pulsadores, interruptores y sensores.</div>';
    h += '</div>';
    this.root.innerHTML = h;
    this.$ = function (s) { return self.root.querySelector(s); };
    if (!c) {
      this.$('[data-act="run"]').addEventListener('click', function () { self.running && !self.stepMode ? self.stop() : self.start(); });
      this.$('[data-act="reset"]').addEventListener('click', function () { self.reset(); });
      this.$('[data-act="step"]').addEventListener('click', function () { self.step(); });
      this.$('[data-act="scan"]').addEventListener('click', function () { self.stepScan(); });
      this.setDebug(this.opts.debug);
      this.mountScene();
    }
    // entradas
    this.root.querySelectorAll('[data-in]').forEach(function (el) {
      const addr = el.getAttribute('data-in');
      const d = io.inputs.find(function (x) { return x.addr === addr; });
      const kind = d.kind || 'button';
      if (kind === 'button') {
        el.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          if (e.shiftKey) { self.latched[addr] = !self.latched[addr]; self.world.user[addr] = self.latched[addr]; return; }
          self.latched[addr] = false;
          self.world.user[addr] = true;
          self.press(addr);
          const up = function () { if (!self.latched[addr]) self.world.user[addr] = false; window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
          window.addEventListener('pointerup', up);
          window.addEventListener('pointercancel', up);
        });
      } else {
        el.addEventListener('click', function () { self.world.user[addr] = !self.world.user[addr]; self.press(addr); });
      }
    });
    {
      this.keyDown = function (e) {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.repeat || e.ctrlKey || e.metaKey) return;
        const n = parseInt(e.key, 10);
        if (!n || n > io.inputs.length) return;
        const d = io.inputs[n - 1];
        if ((d.kind || 'button') === 'button') self.world.user[d.addr] = true;
        else self.world.user[d.addr] = !self.world.user[d.addr];
        self.press(d.addr);
      };
      this.keyUp = function (e) {
        const n = parseInt(e.key, 10);
        if (!n || n > io.inputs.length) return;
        const d = io.inputs[n - 1];
        if ((d.kind || 'button') === 'button' && !self.latched[d.addr]) self.world.user[d.addr] = false;
      };
      window.addEventListener('keydown', this.keyDown);
      window.addEventListener('keyup', this.keyUp);
    }
  };

  Simulator.prototype.press = function (addr) {
    if (!this.running && !this.opts.compact) {
      const hint = this.$('[data-hint]');
      if (hint) {
        hint.innerHTML = '⚠️ El PLC está en <b>STOP</b>: la entrada ' + addr + ' cambia en el borne, pero el programa no se ejecuta. Pulsa <b>▶ EJECUTAR PLC</b>.';
        hint.classList.add('warn');
      }
    }
    if (this.opts.onInput) this.opts.onInput(addr);
  };

  Simulator.prototype.mountScene = function () {
    const el = this.$('[data-scene]');
    if (el && this.world.scene) this.sceneView = PLC.Scenes.view(el, this.world.scene, this.world);
    else this.sceneView = null;
  };

  Simulator.prototype.setDebug = function (on) {
    this.opts.debug = !!on;
    const d = this.$('[data-dbg]');
    if (d) d.style.display = on ? '' : 'none';
    if (!on && this.stepMode) { this.stepMode = false; this.phase = 0; this.highlightPhase(-1); }
    this.updateUI();
  };

  Simulator.prototype.program = function () { return this.opts.getProgram ? this.opts.getProgram() : PLC.emptyProgram(); };

  Simulator.prototype.start = function () {
    if (this.stepMode) {
      // salir del paso a paso y continuar en automático
      if (this.phase !== 0) this.finishScan(STEP_MS);
      this.stepMode = false;
      this.highlightPhase(-1);
      if (this.opts.onRung) this.opts.onRung(-1);
    } else if (!this.running) {
      this.engine.reset();
      this.addLog('▶ PLC en RUN: el programa empieza a ejecutarse cíclicamente.');
    }
    this.running = true;
    this.acc = 0;
    const hint = this.$('[data-hint]');
    if (hint) { hint.classList.remove('warn'); hint.innerHTML = '🟢 PLC en <b>RUN</b>. Acciona las entradas y observa cómo la corriente (en verde) recorre el programa.'; }
    if (this.opts.onRun) this.opts.onRun(true);
    this.updateUI();
  };

  Simulator.prototype.stop = function () {
    this.running = false;
    this.stepMode = false;
    this.phase = 0;
    this.world.clearOutputs();
    this.engine.traces = [];
    this.highlightPhase(-1);
    this.addLog('■ PLC en STOP: todas las salidas se apagan.');
    const hint = this.$('[data-hint]');
    if (hint) { hint.classList.remove('warn'); hint.innerHTML = 'PLC en <b>STOP</b>. Pulsa <b>▶ EJECUTAR PLC</b> para ponerlo en marcha.'; }
    if (this.opts.onRun) this.opts.onRun(false);
    if (this.opts.onRung) this.opts.onRung(-1);
    this.updateUI();
    this.frame();
  };

  Simulator.prototype.reset = function () {
    const wasRunning = this.running && !this.stepMode;
    this.running = false; this.stepMode = false; this.phase = 0;
    this.world.reset();
    this.engine.reset();
    this.latched = {};
    this.mountScene();
    this.highlightPhase(-1);
    if (this.opts.onRung) this.opts.onRung(-1);
    this.log = [];
    this.addLog('↺ Simulación reiniciada.');
    if (wasRunning || this.opts.compact) this.start(); else this.stop();
  };

  Simulator.prototype.tick = function (dt) {
    this.world.update(dt);
    const out = this.engine.scan(this.program(), this.world.readInputs(), dt);
    this.world.applyOutputs(out);
  };

  /* ---------------- Paso a paso: el ciclo de scan desglosado ---------------- */
  Simulator.prototype.step = function () {
    const prog = this.program();
    if (!this.running || !this.stepMode) {
      if (!this.running) this.engine.reset();
      this.running = true;
      this.stepMode = true;
      this.phase = 0;
      this.addLog('⏸ Modo paso a paso: cada clic en ⏭ ejecuta una fase del ciclo de scan.');
      if (this.opts.onRun) this.opts.onRun(true);
    }
    const n = prog.rungs.length;
    const scanNo = pad(this.engine.scanCount + 1, 3);
    if (this.phase === 0) {
      this.engine.beginScan(prog, this.world.readInputs(), STEP_MS);
      const ins = this.io.inputs.map(function (d) { return d.addr + '=' + (this.engine.I[d.addr] ? 1 : 0); }, this).join('  ');
      this.addLog('SCAN ' + scanNo + ' → ① Leer entradas: ' + ins, 'ph0');
      this.highlightPhase(0);
      if (this.opts.onRung) this.opts.onRung(-1);
      this.phase = 1;
    } else if (this.phase <= n) {
      const i = this.phase - 1;
      this.engine.execRung(prog, i);
      const coils = [];
      const rg = prog.rungs[i];
      for (let r = 0; r < rg.rows; r++) {
        const c = rg.cells[r][rg.cols - 1];
        if (c && c.addr) coils.push(c.addr + '=' + (this.engine.bit(c.addr) ? 1 : 0));
      }
      this.addLog('SCAN ' + scanNo + ' → ② Ejecutar segmento ' + (i + 1) + (coils.length ? ': ' + coils.join('  ') : ''), 'ph1');
      this.highlightPhase(1);
      if (this.opts.onRung) this.opts.onRung(i);
      this.phase += 1;
      if (n === 0) this.phase = n + 1;
    } else {
      this.finishScan(STEP_MS);
      const outs = this.io.outputs.map(function (d) { return d.addr + '=' + (this.engine.Q[d.addr] ? 1 : 0); }, this).join('  ');
      this.addLog('SCAN ' + scanNo + ' → ③ Escribir salidas: ' + outs, 'ph2');
      this.highlightPhase(2);
      if (this.opts.onRung) this.opts.onRung(-1);
    }
    this.updateUI();
    this.frame();
  };

  Simulator.prototype.finishScan = function (dt) {
    const prog = this.program();
    for (let i = this.phase - 1; i < prog.rungs.length; i++) if (i >= 0) this.engine.execRung(prog, i);
    const out = this.engine.endScan();
    this.world.applyOutputs(out);
    this.world.update(dt);
    this.phase = 0;
  };

  Simulator.prototype.stepScan = function () {
    do { this.step(); } while (this.phase !== 0);
  };

  Simulator.prototype.highlightPhase = function (p) {
    this.root.querySelectorAll('[data-ph]').forEach(function (el) { el.classList.toggle('on', Number(el.getAttribute('data-ph')) === p); });
  };

  Simulator.prototype.addLog = function (txt, cls) {
    this.log.push({ txt: txt, cls: cls || '' });
    if (this.log.length > 60) this.log.shift();
    if (this.opts.onLog) this.opts.onLog(this.log);
  };

  /* ---------------------------- bucle ---------------------------- */
  Simulator.prototype.loop = function (t) {
    if (this.destroyed) return;
    const self = this;
    const dtReal = this.last ? Math.min(200, t - this.last) : 16;
    this.last = t;
    if (this.running && !this.stepMode) {
      this.acc += dtReal;
      let n = 0;
      while (this.acc >= SCAN_MS && n < 8) { this.tick(SCAN_MS); this.acc -= SCAN_MS; n++; }
      if (n === 8) this.acc = 0;
      this.cycleVis = ((this.cycleVis || 0) + dtReal / 400) % 3;
      this.highlightPhase(Math.floor(this.cycleVis));
    } else if (!this.running) {
      this.world.clearOutputs();
      this.world.update(dtReal);
    }
    this.frame();
    this.raf = requestAnimationFrame(function (tt) { self.loop(tt); });
  };

  Simulator.prototype.frame = function () {
    const self = this, w = this.world, e = this.engine;
    const inputs = w.readInputs();
    this.root.querySelectorAll('[data-sig]').forEach(function (el) { el.classList.toggle('on', !!inputs[el.getAttribute('data-sig')]); });
    this.root.querySelectorAll('[data-in]').forEach(function (el) {
      const a = el.getAttribute('data-in');
      el.classList.toggle('act', !!w.user[a] || (w.scene && w.scene.sensor && !!w.scene.sensor(a, w)));
      el.classList.toggle('latched', !!self.latched[a]);
    });
    this.root.querySelectorAll('[data-out]').forEach(function (el) { el.classList.toggle('on', !!w.outputs[el.getAttribute('data-out')]); });
    if (!this.opts.compact) {
      this.root.querySelectorAll('[data-ileds]').forEach(function (el) { el.classList.toggle('on', self.running && !!e.I[el.getAttribute('data-ileds')]); });
      this.root.querySelectorAll('[data-qleds]').forEach(function (el) { el.classList.toggle('on', self.running && !!e.Q[el.getAttribute('data-qleds')]); });
      const sc = this.$('[data-scancount]');
      if (sc) sc.textContent = 'ciclos: ' + e.scanCount;
    }
    if (this.sceneView) this.sceneView.update();
    if (this.opts.onFrame) this.opts.onFrame(this.running ? e : null, this);
  };

  Simulator.prototype.updateUI = function () {
    if (this.opts.compact) return;
    const run = this.$('[data-act="run"]');
    if (this.stepMode) { run.innerHTML = '▶ CONTINUAR'; run.classList.remove('stop'); }
    else if (this.running) { run.innerHTML = '■ DETENER PLC'; run.classList.add('stop'); }
    else { run.innerHTML = '▶ EJECUTAR PLC'; run.classList.remove('stop'); }
    this.$('[data-run-led]').classList.toggle('on', this.running);
    this.$('[data-stop-led]').classList.toggle('on', !this.running);
    this.$('[data-info]').textContent = this.stepMode ? 'PASO A PASO · ciclo ' + (this.engine.scanCount + 1) : this.running ? 'RUN · ciclo de ' + SCAN_MS + ' ms' : 'PLC en STOP';
    this.root.querySelector('.sim').classList.toggle('running', this.running);
  };

  Simulator.prototype.destroy = function () {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    if (this.keyDown) { window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); }
  };

  /* ===================== Panel de DEBUG ===================== */
  function DebugPanel(el, io) { this.el = el; this.io = io; this.lastHtml = ''; }
  DebugPanel.prototype.render = function (engine, sim, program) {
    const io = this.io;
    const e = engine || (sim && sim.engine);
    const b = function (v) { return '<span class="bit ' + (v ? 'on' : '') + '">' + (v ? 1 : 0) + '</span>'; };
    let h = '';
    if (sim) {
      const ph = sim.stepMode ? (sim.phase === 0 ? 'Siguiente: ① leer entradas' : sim.phase <= program.rungs.length ? 'Siguiente: ② segmento ' + sim.phase : 'Siguiente: ③ escribir salidas') : (sim.running ? 'RUN continuo' : 'STOP');
      h += '<div class="dbg-scan">SCAN <b>' + pad(e.scanCount, 3) + '</b> · ' + ph + '</div>';
    }
    h += '<table class="dbg-t"><tr><th colspan="3">Entradas (imagen del PLC)</th></tr>';
    io.inputs.forEach(function (d) { h += '<tr><td>' + d.addr + '</td><td>' + esc(d.name) + '</td><td>' + b(e.I[d.addr]) + '</td></tr>'; });
    h += '<tr><th colspan="3">Salidas</th></tr>';
    io.outputs.forEach(function (d) { h += '<tr><td>' + d.addr + '</td><td>' + esc(d.name) + '</td><td>' + b(e.Q[d.addr]) + '</td></tr>'; });
    const mems = {};
    (io.memories || []).forEach(function (m) { mems[m.addr] = m; });
    PLC.find.all(program).forEach(function (x) { if (x.cell.addr && x.cell.addr[0] === 'M' && !mems[x.cell.addr]) mems[x.cell.addr] = { addr: x.cell.addr, name: '' }; });
    const mk = Object.keys(mems).sort();
    if (mk.length) {
      h += '<tr><th colspan="3">Memorias / estados internos</th></tr>';
      mk.forEach(function (a) { h += '<tr class="' + (e.M[a] ? 'hl' : '') + '"><td>' + a + '</td><td>' + esc(mems[a].name) + '</td><td>' + b(e.M[a]) + '</td></tr>'; });
    }
    const tk = Object.keys(e.T).sort();
    if (tk.length) {
      h += '<tr><th colspan="3">Temporizadores</th></tr>';
      tk.forEach(function (a) { const t = e.T[a]; h += '<tr><td>' + a + '</td><td>' + t.type + ' · ET ' + (t.et / 1000).toFixed(1) + ' / PT ' + (t.pt / 1000).toFixed(1) + ' s</td><td>' + b(t.q) + '</td></tr>'; });
    }
    const ck = Object.keys(e.C).sort();
    if (ck.length) {
      h += '<tr><th colspan="3">Contadores</th></tr>';
      ck.forEach(function (a) { const k = e.C[a]; h += '<tr><td>' + a + '</td><td>' + k.type + ' · CV ' + k.cv + ' / PV ' + k.pv + '</td><td>' + b(k.q) + '</td></tr>'; });
    }
    h += '</table>';
    if (h !== this.lastHtml) { this.el.querySelector('[data-dbgdata]').innerHTML = h; this.lastHtml = h; }
  };
  DebugPanel.prototype.renderLog = function (log) {
    const l = this.el.querySelector('[data-dbglog]');
    if (!l) return;
    l.innerHTML = log.slice(-14).map(function (x) { return '<div class="' + x.cls + '">' + esc(x.txt) + '</div>'; }).join('');
    l.scrollTop = l.scrollHeight;
  };

  /* ===================== Mini demo (para las tarjetas de concepto) ===================== */
  function MiniDemo(el, cfg) {
    el.innerHTML = '<div class="mini-ladder"></div><div class="mini-sim"></div>';
    const ed = cfg.program ? new PLC.LadderEditor(el.querySelector('.mini-ladder'), { io: cfg.io, readonly: true }) : null;
    if (ed) ed.setProgram(cfg.program);
    else el.querySelector('.mini-ladder').remove();
    const prog = cfg.program || PLC.emptyProgram();
    const sim = new Simulator(el.querySelector('.mini-sim'), {
      io: cfg.io, compact: true, getProgram: function () { return prog; },
      onFrame: function (engine) { if (ed) ed.updateLive(engine); }
    });
    return { destroy: function () { sim.destroy(); if (ed) ed.destroy(); }, sim: sim, editor: ed };
  }

  PLC.Simulator = Simulator;
  PLC.DebugPanel = DebugPanel;
  PLC.MiniDemo = MiniDemo;
  PLC.SCAN_MS = SCAN_MS;
})(typeof window !== 'undefined' ? window : globalThis);
