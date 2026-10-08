/* =========================================================================
 * PLC Academy — Escenas físicas (fábrica virtual)
 * Cada escena tiene un MODELO (física, sin DOM, usable en las pruebas
 * automáticas) y una VISTA (SVG animado).
 * ========================================================================= */
(function (root) {
  'use strict';
  const PLC = (root.PLC = root.PLC || {});
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  let uidN = 0;
  const uid = function () { uidN += 1; return 'sc' + uidN; };

  /* ======================= MODELOS ======================= */

  /* ---- Cinta transportadora con sensores, cilindro y cajas ---- */
  function Conveyor(cfg) {
    this.cfg = Object.assign({
      length: 640, speed: 90, partW: 40, sensors: [], cylinder: null,
      feeder: true, types: ['plastic'], autoFeed: false, feedInterval: 4500
    }, cfg);
    this.parts = [];
    this.binSide = 0; this.binEnd = 0;
    this.sideTypes = { metal: 0, plastic: 0 };
    this.endTypes = { metal: 0, plastic: 0 };
    this.cylPos = 0;
    this.offset = 0;
    this.running = false;
    this.autoFeed = !!this.cfg.autoFeed;
    this.feedTimer = this.cfg.feedInterval - 600;
    this.nextId = 1;
    this.feedCount = 0;
    const self = this;
    (this.cfg.initialParts || []).forEach(function (p) {
      self.parts.push({ id: self.nextId++, x: p.x || 0, type: p.type || 'plastic', state: 'belt', drop: 0 });
    });
  }
  Conveyor.prototype.spawn = function (type) {
    const w = this.cfg.partW;
    type = type || this.cfg.types[0];
    if (this.parts.some(function (p) { return p.state === 'belt' && p.x < w + 24; })) return false;
    this.parts.push({ id: this.nextId++, x: 0, type: type, state: 'belt', drop: 0 });
    return true;
  };
  Conveyor.prototype.onBelt = function (x, metalOnly) {
    const w = this.cfg.partW;
    return this.parts.some(function (p) {
      return p.state === 'belt' && p.x <= x && p.x + w >= x && (!metalOnly || p.type === 'metal');
    });
  };
  Conveyor.prototype.sensor = function (addr) {
    const s = this.cfg.sensors.find(function (k) { return k.addr === addr; });
    if (s) return this.onBelt(s.x, s.kind === 'inductive');
    const cy = this.cfg.cylinder;
    if (cy) {
      if (addr === cy.ext) return this.cylPos >= 0.97;
      if (addr === cy.ret) return this.cylPos <= 0.03;
    }
    return undefined;
  };
  Conveyor.prototype.update = function (dt, out) {
    const cfg = this.cfg, w = cfg.partW, self = this;
    this.running = !!out[cfg.motor];
    const dx = this.running ? cfg.speed * dt / 1000 : 0;
    this.offset = (this.offset + dx) % 40;
    const cy = cfg.cylinder;
    if (cy) {
      const target = !!out[cy.out];
      this.cylExtending = target;
      this.cylPos = clamp(this.cylPos + (target ? 1 : -1) * (cy.speed || 2) * dt / 1000, 0, 1);
      if (this.cylPos > 0.6) {
        this.parts.forEach(function (p) {
          if (p.state === 'belt' && p.x < cy.x + 30 && p.x + w > cy.x - 30) {
            p.state = 'pushed'; p.drop = 0;
            self.binSide += 1; self.sideTypes[p.type] += 1;
          }
        });
      }
    }
    this.parts.forEach(function (p) {
      if (p.state === 'belt') {
        p.x += dx;
        if (p.x > cfg.length - w / 2) {
          p.state = 'end'; p.drop = 0;
          self.binEnd += 1; self.endTypes[p.type] += 1;
        }
      } else {
        p.drop += dt / (p.state === 'pushed' ? 450 : 350);
      }
    });
    this.parts = this.parts.filter(function (p) { return p.state === 'belt' || p.drop < 1; });
    if (this.autoFeed) {
      this.feedTimer += dt;
      if (this.feedTimer >= cfg.feedInterval) {
        const types = cfg.types;
        const t = types[Math.floor(Math.random() * types.length)];
        if (this.spawn(t)) { this.feedTimer = 0; this.feedCount += 1; }
      }
    }
  };

  /* ---- Eje lineal genérico: puerta, taladro, montacargas ---- */
  function Axis(cfg) {
    this.cfg = Object.assign({ speed: 0.5, start: 0, skin: 'door' }, cfg);
    this.pos = this.cfg.start;
    this.dir = 0;
    this.conflict = false;
    this.spin = false;
    this.angle = 0;
    this.hole = 0;
  }
  Axis.prototype.sensor = function (addr) {
    if (addr === this.cfg.limMax) return this.pos >= 0.99;
    if (addr === this.cfg.limMin) return this.pos <= 0.01;
    return undefined;
  };
  Axis.prototype.update = function (dt, out) {
    const p = !!out[this.cfg.plus], m = !!out[this.cfg.minus];
    this.conflict = p && m;
    this.dir = this.conflict ? 0 : p ? 1 : m ? -1 : 0;
    this.pos = clamp(this.pos + this.dir * this.cfg.speed * dt / 1000, 0, 1);
    this.spin = this.cfg.spindle ? !!out[this.cfg.spindle] : false;
    if (this.spin) this.angle = (this.angle + dt * 0.9) % 360;
    if (this.spin && this.pos > 0.6) this.hole = clamp(this.hole + dt / 2500, 0, 1);
  };

  /* ---- Depósito con bomba, válvula y sensores de nivel ---- */
  function Tank(cfg) {
    this.cfg = Object.assign({ level: 30, fillRate: 12, drainRate: 6, valveRate: 10, sensors: [] }, cfg);
    this.level = this.cfg.level;
    this.consume = !!this.cfg.consume;
    this.pumping = false;
    this.draining = false;
    this.angle = 0;
  }
  Tank.prototype.sensor = function (addr) {
    const s = this.cfg.sensors.find(function (k) { return k.addr === addr; });
    if (s) return this.level >= s.level;
    return undefined;
  };
  Tank.prototype.update = function (dt, out) {
    const c = this.cfg;
    let d = 0;
    this.pumping = !!out[c.pump];
    this.draining = !!(c.valve && out[c.valve]);
    if (this.pumping) { d += c.fillRate; this.angle = (this.angle + dt * 0.8) % 360; }
    if (this.draining) d -= c.valveRate;
    if (this.consume) d -= c.drainRate;
    this.level = clamp(this.level + d * dt / 1000, 0, 100);
  };

  /* ---- Semáforo (solo vista) ---- */
  function Traffic(cfg) { this.cfg = cfg; }
  Traffic.prototype.update = function () {};

  const MODELS = { conveyor: Conveyor, axis: Axis, tank: Tank, traffic: Traffic };

  /* ======================= VISTAS ======================= */
  function svgEl(container, html, viewBox, cls) {
    container.innerHTML = '<svg class="scene-svg ' + (cls || '') + '" viewBox="' + viewBox + '" preserveAspectRatio="xMidYMid meet">' + html + '</svg>';
    return container.querySelector('svg');
  }
  function q(svg, sel) { return svg.querySelector(sel); }
  function lbl(world, addr) {
    const n = PLC.symbolName(world.io, addr);
    return n ? n + ' · ' + addr : addr;
  }

  /* ---- Vista de la cinta ---- */
  function ConveyorView(container, model, world) {
    const c = model.cfg, id = uid();
    const X0 = 30, BY = 95, BH = 60, L = c.length;
    const sx = function (x) { return X0 + x; };
    let h = '';
    h += '<defs><pattern id="' + id + 'p" width="40" height="60" patternUnits="userSpaceOnUse">' +
      '<rect width="40" height="60" class="belt-bg"/><path d="M8 6 L22 30 L8 54" class="belt-chev"/></pattern>' +
      '<linearGradient id="' + id + 'm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3e8ef"/><stop offset="1" stop-color="#7d8794"/></linearGradient>' +
      '<linearGradient id="' + id + 'k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb35c"/><stop offset="1" stop-color="#e2731b"/></linearGradient></defs>';
    // estructura
    h += '<rect x="' + (X0 - 14) + '" y="' + (BY - 8) + '" width="' + (L + 28) + '" height="' + (BH + 16) + '" rx="12" class="belt-frame"/>';
    h += '<rect x="' + X0 + '" y="' + BY + '" width="' + L + '" height="' + BH + '" fill="url(#' + id + 'p)" class="belt" data-belt/>';
    h += '<circle cx="' + X0 + '" cy="' + (BY + BH / 2) + '" r="10" class="roller"/><circle cx="' + (X0 + L) + '" cy="' + (BY + BH / 2) + '" r="10" class="roller"/>';
    // motor
    h += '<g transform="translate(' + (X0 + L - 120) + ',' + (BY + BH + 34) + ')"><rect x="-26" y="-14" width="52" height="28" rx="6" class="motor-body" data-motor/>' +
      '<g data-fan><path d="M0 -9 L3 0 L0 9 L-3 0Z M-9 0 L0 3 L9 0 L0 -3Z" class="fan"/></g>' +
      '<text x="0" y="28" class="scene-lbl" text-anchor="middle">' + lbl(world, c.motor) + '</text></g>';
    // caja final
    h += '<g><rect x="' + (X0 + L + 18) + '" y="150" width="62" height="78" rx="6" class="bin"/>' +
      '<text x="' + (X0 + L + 49) + '" y="244" class="scene-lbl" text-anchor="middle">Caja final: <tspan data-binend>0</tspan></text></g>';
    // cilindro y caja lateral
    if (c.cylinder) {
      const cx = sx(c.cylinder.x);
      h += '<rect x="' + (cx - 44) + '" y="176" width="88" height="56" rx="6" class="bin"/>' +
        '<text x="' + cx + '" y="246" class="scene-lbl" text-anchor="middle">Caja lateral: <tspan data-binside>0</tspan></text>';
      h += '<rect x="' + (cx - 18) + '" y="4" width="36" height="42" rx="5" class="cyl-body"/>' +
        '<rect x="' + (cx - 4) + '" y="46" width="8" height="12" class="cyl-rod" data-rod/>' +
        '<rect x="' + (cx - 28) + '" y="52" width="56" height="9" rx="3" class="cyl-head" data-head/>' +
        '<text x="' + (cx + 26) + '" y="16" class="scene-lbl">' + lbl(world, c.cylinder.out) + '</text>';
      if (c.cylinder.ext || c.cylinder.ret) {
        let t = '';
        if (c.cylinder.ret) t += '<circle cx="' + (cx + 31) + '" cy="28" r="4" class="led" data-cret/><text x="' + (cx + 39) + '" y="31" class="scene-lbl sm">dentro · ' + c.cylinder.ret + '</text>';
        if (c.cylinder.ext) t += '<circle cx="' + (cx + 31) + '" cy="40" r="4" class="led" data-cext/><text x="' + (cx + 39) + '" y="43" class="scene-lbl sm">fuera · ' + c.cylinder.ext + '</text>';
        h += t;
      }
    }
    // sensores
    c.sensors.forEach(function (s, i) {
      const x = sx(s.x);
      const nearCyl = c.cylinder && Math.abs(s.x - c.cylinder.x) < 40;
      if (s.kind === 'inductive') {
        h += '<g><rect x="' + (x + 12) + '" y="' + (BY + BH + 2) + '" width="22" height="11" rx="3" class="ind-body"/>' +
          '<circle cx="' + (x + 40) + '" cy="' + (BY + BH + 8) + '" r="4" class="led" data-s="' + i + '"/>' +
          '<text x="' + (x + 48) + '" y="' + (BY + BH + 12) + '" class="scene-lbl sm">' + lbl(world, s.addr) + '</text></g>';
      } else {
        const left = x < 170;
        const lx = left ? x + 12 : (nearCyl ? x - 34 : x - 12);
        h += '<g><line x1="' + x + '" y1="' + (BY - 6) + '" x2="' + x + '" y2="' + (BY + BH + 6) + '" class="beam" data-beam="' + i + '"/>' +
          '<rect x="' + (x - 7) + '" y="' + (BY - 20) + '" width="14" height="14" rx="3" class="photo-body"/>' +
          '<rect x="' + (x - 7) + '" y="' + (BY + BH + 6) + '" width="14" height="10" rx="2" class="photo-refl"/>' +
          '<circle cx="' + x + '" cy="' + (BY - 26) + '" r="4" class="led" data-s="' + i + '"/>' +
          '<text x="' + lx + '" y="' + (BY - 12) + '" class="scene-lbl sm" text-anchor="' + (left ? 'start' : 'end') + '">' + lbl(world, s.addr) + '</text></g>';
      }
    });
    h += '<g data-parts></g>';
    h += '<text x="' + X0 + '" y="20" class="scene-title">CINTA TRANSPORTADORA</text>';
    container.classList.add('scene-wrap');
    const holder = document.createElement('div');
    container.innerHTML = '';
    container.appendChild(holder);
    const svg = svgEl(holder, h, '0 0 ' + (X0 + L + 90) + ' 252');
    // controles de la escena (alimentador)
    if (c.feeder) {
      const bar = document.createElement('div');
      bar.className = 'scene-controls';
      let bh = '';
      c.types.forEach(function (t) {
        bh += '<button class="btn sm ghost" data-spawn="' + t + '">＋ Pieza ' + (t === 'metal' ? 'metálica' : 'de plástico') + '</button>';
      });
      bh += '<label class="toggle"><input type="checkbox" data-auto ' + (model.autoFeed ? 'checked' : '') + '> Alimentador automático</label>';
      bar.innerHTML = bh;
      container.appendChild(bar);
      bar.addEventListener('click', function (e) {
        const b = e.target.closest('[data-spawn]');
        if (b && !model.spawn(b.getAttribute('data-spawn'))) b.classList.add('shake'), setTimeout(function () { b.classList.remove('shake'); }, 400);
      });
      const auto = bar.querySelector('[data-auto]');
      auto.addEventListener('change', function () { model.autoFeed = auto.checked; model.feedTimer = model.cfg.feedInterval - 300; });
    }
    const pat = svg.querySelector('#' + id + 'p');
    const partsG = q(svg, '[data-parts]');
    const fan = q(svg, '[data-fan]');
    const motor = q(svg, '[data-motor]');
    const rod = q(svg, '[data-rod]'), head = q(svg, '[data-head]');
    const cret = q(svg, '[data-cret]'), cext = q(svg, '[data-cext]');
    const binSide = q(svg, '[data-binside]'), binEnd = q(svg, '[data-binend]');
    const partEls = {};
    let fanA = 0;
    return {
      update: function () {
        pat.setAttribute('patternTransform', 'translate(' + model.offset.toFixed(1) + ',0)');
        motor.classList.toggle('on', model.running);
        if (model.running) fanA = (fanA + 18) % 360;
        fan.setAttribute('transform', 'rotate(' + fanA + ')');
        if (rod) {
          const ext = 12 + model.cylPos * 66;
          rod.setAttribute('height', ext.toFixed(1));
          head.setAttribute('y', (46 + ext - 5).toFixed(1));
          head.classList.toggle('on', !!model.cylExtending);
        }
        if (cret) cret.classList.toggle('on', model.cylPos <= 0.03);
        if (cext) cext.classList.toggle('on', model.cylPos >= 0.97);
        if (binSide) binSide.textContent = model.binSide;
        binEnd.textContent = model.binEnd;
        c.sensors.forEach(function (s, i) {
          const on = model.onBelt(s.x, s.kind === 'inductive');
          const led = q(svg, '[data-s="' + i + '"]');
          if (led) led.classList.toggle('on', on);
          const beam = q(svg, '[data-beam="' + i + '"]');
          if (beam) beam.classList.toggle('cut', on);
        });
        const seen = {};
        model.parts.forEach(function (p) {
          seen[p.id] = true;
          let el = partEls[p.id];
          if (!el) {
            el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            el.innerHTML = '<rect x="0" y="0" width="' + c.partW + '" height="40" rx="' + (p.type === 'metal' ? 4 : 10) + '" fill="url(#' + id + (p.type === 'metal' ? 'm' : 'k') + ')" class="part"/>' +
              '<text x="' + (c.partW / 2) + '" y="25" text-anchor="middle" class="part-lbl">' + (p.type === 'metal' ? 'M' : 'P') + '</text>';
            partsG.appendChild(el);
            partEls[p.id] = el;
          }
          let x = X0 + p.x, y = BY + 10, sc = 1;
          if (p.state === 'pushed') { y = BY + 10 + p.drop * 112; sc = 1 - p.drop * 0.15; }
          if (p.state === 'end') { x = X0 + L - c.partW / 2 + p.drop * 40; y = BY + 10 + p.drop * 90; sc = 1 - p.drop * 0.2; }
          el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + sc.toFixed(2) + ')');
        });
        Object.keys(partEls).forEach(function (k) {
          if (!seen[k]) { partEls[k].remove(); delete partEls[k]; }
        });
      }
    };
  }

  /* ---- Vista de puerta automática ---- */
  function DoorView(container, model, world) {
    const c = model.cfg;
    let h = '';
    h += '<text x="20" y="22" class="scene-title">PUERTA AUTOMÁTICA</text>';
    h += '<rect x="0" y="196" width="400" height="8" class="floor"/>';
    h += '<rect x="20" y="40" width="60" height="156" class="wall"/><rect x="320" y="40" width="60" height="156" class="wall"/>';
    h += '<rect x="80" y="40" width="240" height="22" class="header"/>';
    h += '<g data-radar><path d="M200 62 L160 120 L240 120 Z" class="radar"/></g><rect x="190" y="58" width="20" height="8" rx="2" class="photo-body"/>';
    h += '<g data-person opacity="0"><circle cx="200" cy="120" r="12" class="person"/><path d="M184 196 L190 150 Q200 136 210 150 L216 196 Z" class="person"/></g>';
    h += '<rect x="80" y="62" width="120" height="134" class="panel-glass" data-pl/><rect x="200" y="62" width="120" height="134" class="panel-glass" data-pr/>';
    h += '<g transform="translate(200,51)"><text data-arrow class="arrow" text-anchor="middle" y="5"></text></g>';
    h += '<circle cx="30" cy="30" r="5" class="led" data-lmax/><text x="40" y="34" class="scene-lbl sm">' + lbl(world, c.limMax) + '</text>';
    h += '<circle cx="230" cy="30" r="5" class="led" data-lmin/><text x="240" y="34" class="scene-lbl sm">' + lbl(world, c.limMin) + '</text>';
    h += '<text x="200" y="218" class="scene-lbl" text-anchor="middle" data-warn></text>';
    const svg = svgEl(container, h, '0 0 400 224');
    if (c.presence) {
      svg.style.cursor = 'pointer';
      svg.addEventListener('click', function () { world.user[c.presence] = !world.user[c.presence]; });
    }
    const pl = q(svg, '[data-pl]'), pr = q(svg, '[data-pr]'), person = q(svg, '[data-person]'), radar = q(svg, '[data-radar]');
    const arrow = q(svg, '[data-arrow]'), lmax = q(svg, '[data-lmax]'), lmin = q(svg, '[data-lmin]'), warn = q(svg, '[data-warn]');
    return {
      update: function () {
        const off = model.pos * 112;
        pl.setAttribute('x', (80 - off).toFixed(1));
        pr.setAttribute('x', (200 + off).toFixed(1));
        const pres = c.presence ? !!world.user[c.presence] : false;
        person.setAttribute('opacity', pres ? 1 : 0);
        radar.classList.toggle('on', pres);
        arrow.textContent = model.conflict ? '⚠' : model.dir > 0 ? '◀ ▶' : model.dir < 0 ? '▶ ◀' : '';
        arrow.classList.toggle('bad', model.conflict);
        lmax.classList.toggle('on', model.pos >= 0.99);
        lmin.classList.toggle('on', model.pos <= 0.01);
        warn.textContent = model.conflict ? '¡Abrir y cerrar a la vez! Falta un enclavamiento.' : (c.presence ? 'Haz clic en la escena para que se acerque/aleje una persona' : '');
        warn.classList.toggle('bad', model.conflict);
      }
    };
  }

  /* ---- Vista de taladro ---- */
  function DrillView(container, model, world) {
    const c = model.cfg;
    let h = '<text x="14" y="22" class="scene-title">TALADRO VERTICAL</text>';
    h += '<rect x="40" y="30" width="16" height="190" class="wall"/><rect x="20" y="220" width="260" height="10" class="floor"/>';
    h += '<rect x="110" y="196" width="100" height="24" rx="3" class="workpiece"/><rect x="152" y="196" width="16" height="0" class="hole" data-hole/>';
    h += '<g data-head><rect x="56" y="0" width="40" height="14" class="cyl-rod"/><rect x="96" y="-16" width="128" height="46" rx="8" class="motor-body" data-mb/>' +
      '<rect x="154" y="30" width="12" height="44" class="drill-bit"/><g data-bitlines><line x1="154" y1="38" x2="166" y2="44" class="bit-line"/><line x1="154" y1="52" x2="166" y2="58" class="bit-line"/><line x1="154" y1="66" x2="166" y2="72" class="bit-line"/></g>' +
      '<text x="160" y="10" text-anchor="middle" class="scene-lbl sm" data-spinlbl>HUSILLO</text></g>';
    h += '<circle cx="70" cy="40" r="5" class="led" data-lmin/><text x="80" y="44" class="scene-lbl sm">' + lbl(world, c.limMin) + '</text>';
    h += '<circle cx="70" cy="130" r="5" class="led" data-lmax/><text x="80" y="134" class="scene-lbl sm">' + lbl(world, c.limMax) + '</text>';
    h += '<text x="240" y="60" class="arrow" data-arrow text-anchor="middle"></text>';
    h += '<text x="150" y="246" class="scene-lbl" text-anchor="middle" data-warn></text>';
    const svg = svgEl(container, h, '0 0 300 252');
    const head = q(svg, '[data-head]'), hole = q(svg, '[data-hole]'), bl = q(svg, '[data-bitlines]'), mb = q(svg, '[data-mb]');
    const lmin = q(svg, '[data-lmin]'), lmax = q(svg, '[data-lmax]'), arrow = q(svg, '[data-arrow]'), warn = q(svg, '[data-warn]');
    return {
      update: function () {
        const y = 46 + model.pos * 92;
        head.setAttribute('transform', 'translate(0,' + y.toFixed(1) + ')');
        hole.setAttribute('height', (model.hole * 22).toFixed(1));
        bl.setAttribute('transform', 'translate(0,' + (model.spin ? (model.angle % 14) - 7 : 0).toFixed(1) + ')');
        mb.classList.toggle('on', model.spin);
        lmin.classList.toggle('on', model.pos <= 0.01);
        lmax.classList.toggle('on', model.pos >= 0.99);
        arrow.textContent = model.conflict ? '⚠' : model.dir > 0 ? '▼' : model.dir < 0 ? '▲' : '';
        warn.textContent = model.conflict ? '¡Subir y bajar a la vez! Falta un enclavamiento.' : '';
        warn.classList.toggle('bad', model.conflict);
      }
    };
  }

  /* ---- Vista de montacargas ---- */
  function LiftView(container, model, world) {
    const c = model.cfg;
    let h = '<text x="14" y="22" class="scene-title">MONTACARGAS</text>';
    h += '<rect x="96" y="30" width="100" height="216" class="shaft"/>';
    h += '<line x1="30" y1="116" x2="96" y2="116" class="floor-line"/><line x1="196" y1="116" x2="270" y2="116" class="floor-line"/>';
    h += '<line x1="30" y1="240" x2="96" y2="240" class="floor-line"/><line x1="196" y1="240" x2="270" y2="240" class="floor-line"/>';
    h += '<text x="34" y="108" class="scene-lbl">PLANTA 1</text><text x="34" y="232" class="scene-lbl">PLANTA 0</text>';
    h += '<circle cx="214" cy="100" r="5" class="led" data-lmax/><text x="222" y="104" class="scene-lbl sm">' + c.limMax + '</text>';
    h += '<circle cx="214" cy="224" r="5" class="led" data-lmin/><text x="222" y="228" class="scene-lbl sm">' + c.limMin + '</text>';
    h += '<g data-cab><line x1="146" y1="-120" x2="146" y2="0" class="cable" data-cable/><rect x="104" y="0" width="84" height="76" rx="6" class="cabin"/><rect x="118" y="20" width="56" height="40" rx="3" class="cargo"/></g>';
    h += '<text x="146" y="44" class="arrow" data-arrow text-anchor="middle"></text>';
    h += '<rect x="96" y="22" width="100" height="10" class="header"/>';
    h += '<text x="146" y="262" class="scene-lbl" text-anchor="middle" data-warn></text>';
    const svg = svgEl(container, h, '0 0 290 268');
    const cab = q(svg, '[data-cab]'), cable = q(svg, '[data-cable]'), lmin = q(svg, '[data-lmin]'), lmax = q(svg, '[data-lmax]'), arrow = q(svg, '[data-arrow]'), warn = q(svg, '[data-warn]');
    return {
      update: function () {
        const y = 164 - model.pos * 124;
        cab.setAttribute('transform', 'translate(0,' + y.toFixed(1) + ')');
        cable.setAttribute('y1', (32 - y).toFixed(1));
        lmin.classList.toggle('on', model.pos <= 0.01);
        lmax.classList.toggle('on', model.pos >= 0.99);
        arrow.textContent = model.conflict ? '⚠' : model.dir > 0 ? '▲' : model.dir < 0 ? '▼' : '';
        warn.textContent = model.conflict ? '¡Subir y bajar a la vez!' : '';
        warn.classList.toggle('bad', model.conflict);
      }
    };
  }

  /* ---- Vista de depósito ---- */
  function TankView(container, model, world) {
    const c = model.cfg, id = uid();
    let h = '<defs><linearGradient id="' + id + 'w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fc3ff"/><stop offset="1" stop-color="#1f6fd1"/></linearGradient></defs>';
    h += '<text x="14" y="22" class="scene-title">DEPÓSITO</text>';
    h += '<path d="M40 236 L40 36 L150 36 L150 40" class="pipe"/>';
    h += '<g transform="translate(40,236)"><circle r="18" class="motor-body" data-pump/><g data-imp><path d="M0 -12 L4 0 L0 12 L-4 0Z M-12 0 L0 4 L12 0 L0 -4Z" class="fan"/></g></g>';
    h += '<text x="40" y="264" class="scene-lbl" text-anchor="middle">' + lbl(world, c.pump) + '</text>';
    h += '<rect x="146" y="40" width="8" height="0" class="stream" data-stream/>';
    h += '<rect x="110" y="40" width="120" height="200" rx="8" class="tank"/>';
    h += '<rect x="112" y="238" width="116" height="0" fill="url(#' + id + 'w)" data-water class="water"/>';
    c.sensors.forEach(function (s, i) {
      const y = 240 - s.level * 2;
      h += '<line x1="222" y1="' + y + '" x2="240" y2="' + y + '" class="sensor-line"/><circle cx="246" cy="' + y + '" r="5" class="led" data-ls="' + i + '"/>' +
        '<text x="256" y="' + (y + 4) + '" class="scene-lbl sm">' + lbl(world, s.addr) + '</text>';
    });
    h += '<path d="M200 240 L200 252 L300 252" class="pipe"/><g transform="translate(250,252)"><path d="M-8 -8 L8 8 M-8 8 L8 -8" class="tvalve" data-valve/></g>';
    h += '<text x="170" y="140" class="tank-level" text-anchor="middle" data-lvl>0%</text>';
    const holder = document.createElement('div');
    container.innerHTML = '';
    container.appendChild(holder);
    const svg = svgEl(holder, h, '0 0 380 272');
    const bar = document.createElement('div');
    bar.className = 'scene-controls';
    bar.innerHTML = '<label class="toggle"><input type="checkbox" data-cons ' + (model.consume ? 'checked' : '') + '> Consumo de agua (la fábrica gasta agua)</label>';
    container.appendChild(bar);
    const cons = bar.querySelector('[data-cons]');
    cons.addEventListener('change', function () { model.consume = cons.checked; });
    const water = q(svg, '[data-water]'), lvl = q(svg, '[data-lvl]'), imp = q(svg, '[data-imp]'), pump = q(svg, '[data-pump]'), stream = q(svg, '[data-stream]'), valve = q(svg, '[data-valve]');
    return {
      update: function () {
        const hh = model.level * 1.98;
        water.setAttribute('height', hh.toFixed(1));
        water.setAttribute('y', (238 - hh).toFixed(1));
        lvl.textContent = Math.round(model.level) + '%';
        imp.setAttribute('transform', 'rotate(' + model.angle.toFixed(0) + ')');
        pump.classList.toggle('on', model.pumping);
        stream.setAttribute('height', model.pumping ? Math.max(0, 238 - hh - 40).toFixed(1) : 0);
        valve.classList.toggle('on', model.draining || model.consume);
        cons.checked = model.consume;
        c.sensors.forEach(function (s, i) { q(svg, '[data-ls="' + i + '"]').classList.toggle('on', model.level >= s.level); });
      }
    };
  }

  /* ---- Vista de semáforo ---- */
  function TrafficView(container, model, world) {
    const c = model.cfg;
    let h = '<text x="10" y="20" class="scene-title">SEMÁFORO</text>';
    h += '<rect x="76" y="200" width="12" height="60" class="pole"/>';
    h += '<rect x="48" y="30" width="68" height="176" rx="14" class="tl-box"/>';
    h += '<circle cx="82" cy="66" r="22" class="tl red" data-r/><circle cx="82" cy="118" r="22" class="tl yellow" data-y/><circle cx="82" cy="170" r="22" class="tl green" data-g/>';
    const svg = svgEl(container, h, '0 0 164 264');
    const r = q(svg, '[data-r]'), y = q(svg, '[data-y]'), g = q(svg, '[data-g]');
    return {
      update: function () {
        r.classList.toggle('on', !!world.outputs[c.red]);
        y.classList.toggle('on', !!world.outputs[c.yellow]);
        g.classList.toggle('on', !!world.outputs[c.green]);
      }
    };
  }

  const VIEWS = {
    conveyor: ConveyorView,
    tank: TankView,
    traffic: TrafficView,
    axis: function (container, model, world) {
      const s = model.cfg.skin;
      if (s === 'drill') return DrillView(container, model, world);
      if (s === 'lift') return LiftView(container, model, world);
      return DoorView(container, model, world);
    }
  };

  PLC.Scenes = {
    create: function (cfg) {
      const M = MODELS[cfg.type];
      if (!M) throw new Error('Escena desconocida: ' + cfg.type);
      const m = new M(cfg);
      m.type = cfg.type;
      return m;
    },
    view: function (container, model, world) {
      const V = VIEWS[model.type];
      return V ? V(container, model, world) : { update: function () {} };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
