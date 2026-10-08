/* =========================================================================
 * PLC Academy — Motor del PLC virtual
 * -------------------------------------------------------------------------
 * Modelo de programa (Ladder / lenguaje de contactos):
 *   program = { rungs: [ rung, ... ] }
 *   rung    = { id, rows, cols, cells[r][c], links[r][b], comment }
 *     - cells[r][c]  : null (vacío) o un elemento { id, type, addr, ... }
 *     - la última columna (cols-1) está reservada para bobinas
 *     - links[r][b]  : unión vertical entre la fila r-1 y la fila r en la
 *                      frontera b (b = 1..cols-1; la frontera b está entre
 *                      la columna b-1 y la columna b)
 *     - en la fila 0 las celdas vacías conducen (línea principal)
 * ========================================================================= */
(function (root) {
  'use strict';
  const PLC = (root.PLC = root.PLC || {});

  const DEFAULT_COLS = 8;
  const MAX_ROWS = 5;
  let idCounter = 0;
  function newId() {
    idCounter += 1;
    return 'c' + Date.now().toString(36) + '_' + idCounter.toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }

  /* ---------------------------------------------------------------------
   * Catálogo de elementos
   * ------------------------------------------------------------------- */
  const ELEMENTS = {
    NO:   { kind: 'contact', name: 'Contacto NO', desc: 'Deja pasar la corriente cuando su dirección vale 1.', areas: ['I', 'Q', 'M', 'T', 'C'] },
    NC:   { kind: 'contact', name: 'Contacto NC', desc: 'Deja pasar la corriente cuando su dirección vale 0 (es un NOT).', areas: ['I', 'Q', 'M', 'T', 'C'] },
    WIRE: { kind: 'wire',    name: 'Cable',        desc: 'Un tramo de cable: conecta celdas de una rama.', areas: [] },
    TON:  { kind: 'timer',   name: 'Temporizador TON', desc: 'Retardo a la conexión: su salida se activa cuando la entrada lleva PT segundos activa.', areas: ['T'] },
    TOF:  { kind: 'timer',   name: 'Temporizador TOF', desc: 'Retardo a la desconexión: su salida sigue activa PT segundos después de que la entrada se apague.', areas: ['T'] },
    CTU:  { kind: 'counter', name: 'Contador CTU', desc: 'Cuenta hacia arriba en cada flanco 0→1. Salida activa cuando CV ≥ PV.', areas: ['C'] },
    CTD:  { kind: 'counter', name: 'Contador CTD', desc: 'Cuenta hacia abajo desde PV en cada flanco 0→1. Salida activa cuando CV llega a 0.', areas: ['C'] },
    CMP:  { kind: 'compare', name: 'Comparador', desc: 'Compara un valor (contador o tiempo) con un número. Deja pasar si la comparación es cierta.', areas: ['C', 'T'] },
    OUT:  { kind: 'coil',    name: 'Bobina', desc: 'Escribe en su dirección el resultado del segmento: 1 si le llega corriente, 0 si no.', areas: ['Q', 'M'] },
    SET:  { kind: 'coil',    name: 'Bobina SET (S)', desc: 'Si le llega corriente pone su dirección a 1, y se queda a 1 aunque la corriente desaparezca.', areas: ['Q', 'M'] },
    RST:  { kind: 'coil',    name: 'Bobina RESET (R)', desc: 'Si le llega corriente pone su dirección a 0 (o reinicia un temporizador/contador).', areas: ['Q', 'M', 'T', 'C'] }
  };
  const COMPARE_OPS = ['>=', '>', '=', '<=', '<', '<>'];

  function isCoil(type) { return !!ELEMENTS[type] && ELEMENTS[type].kind === 'coil'; }
  function isBox(type) { const k = ELEMENTS[type] && ELEMENTS[type].kind; return k === 'timer' || k === 'counter' || k === 'compare'; }
  function areaOf(addr) { return addr ? addr[0] : ''; }

  function make2D(rows, cols, value) {
    const a = [];
    for (let r = 0; r < rows; r++) a.push(new Array(cols).fill(value));
    return a;
  }

  function makeCell(spec) {
    const cell = { id: newId(), type: spec.type };
    if (spec.addr !== undefined) cell.addr = spec.addr;
    if (spec.pt !== undefined) cell.pt = spec.pt;
    if (spec.pv !== undefined) cell.pv = spec.pv;
    if (spec.op !== undefined) cell.op = spec.op;
    if (spec.value !== undefined) cell.value = spec.value;
    return cell;
  }

  function emptyRung(rows, cols) {
    rows = rows || 1; cols = cols || DEFAULT_COLS;
    return { id: newId(), rows, cols, cells: make2D(rows, cols, null), links: make2D(rows, cols, false), comment: '' };
  }
  function emptyProgram() { return { rungs: [emptyRung()] }; }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Asegura que un programa (por ejemplo cargado de localStorage) es válido */
  function normalizeProgram(p) {
    if (!p || !Array.isArray(p.rungs)) return emptyProgram();
    const out = { rungs: [] };
    p.rungs.forEach(function (r) {
      const rows = Math.max(1, Math.min(MAX_ROWS, r.rows | 0 || 1));
      const cols = Math.max(4, r.cols | 0 || DEFAULT_COLS);
      const rung = emptyRung(rows, cols);
      rung.id = r.id || rung.id;
      rung.comment = r.comment || '';
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const c = r.cells && r.cells[i] && r.cells[i][j];
          if (c && ELEMENTS[c.type]) rung.cells[i][j] = Object.assign({ id: newId() }, c);
          rung.links[i][j] = !!(r.links && r.links[i] && r.links[i][j]);
        }
      }
      out.rungs.push(rung);
    });
    if (!out.rungs.length) out.rungs.push(emptyRung());
    return out;
  }

  /* ---------------------------------------------------------------------
   * Mini-lenguaje para escribir programas en los niveles
   *   rung(`
   *     # Comentario opcional
   *     NO(I0.0) NC(I0.1) OUT(Q0.0)
   *     NO(Q0.0) |
   *   `)
   * Tokens: NO(a) NC(a) - (cable) . (vacío) TON(T0,3) TOF(T0,3)
   *         CTU(C0,10) CTD(C0,5) CMP(C0,>=,5) OUT(a) S(a) R(a)
   *         |  unión vertical en la frontera actual con la fila de arriba
   *         |> unión vertical justo antes de la columna de bobinas
   * ------------------------------------------------------------------- */
  function parseToken(tok) {
    if (tok === '.') return null;
    if (tok === '-') return { type: 'WIRE' };
    const m = /^([A-Z]+)\((.*)\)$/.exec(tok);
    if (!m) throw new Error('Token no válido: ' + tok);
    const t = m[1];
    const args = m[2].split(',').map(function (s) { return s.trim(); });
    switch (t) {
      case 'NO': case 'NC': return { type: t, addr: args[0] };
      case 'OUT': return { type: 'OUT', addr: args[0] };
      case 'S': case 'SET': return { type: 'SET', addr: args[0] };
      case 'R': case 'RST': return { type: 'RST', addr: args[0] };
      case 'TON': case 'TOF': return { type: t, addr: args[0], pt: parseFloat(args[1]) };
      case 'CTU': case 'CTD': return { type: t, addr: args[0], pv: parseInt(args[1], 10) };
      case 'CMP': return { type: 'CMP', addr: args[0], op: args[1], value: parseFloat(args[2]) };
      default: throw new Error('Elemento desconocido: ' + t);
    }
  }

  function rung(text, opts) {
    opts = opts || {};
    let lines = String(text).split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    let comment = opts.comment || '';
    if (lines.length && lines[0][0] === '#') { comment = lines[0].replace(/^#\s*/, ''); lines = lines.slice(1); }
    const cols = opts.cols || DEFAULT_COLS;
    const rows = Math.max(1, lines.length);
    const rg = emptyRung(rows, cols);
    rg.comment = comment;
    lines.forEach(function (line, r) {
      const toks = line.split(/\s+/);
      let c = 0;
      toks.forEach(function (tok) {
        if (tok === '|') { if (r > 0) rg.links[r][c] = true; return; }
        if (tok === '|>') { if (r > 0) rg.links[r][cols - 1] = true; return; }
        const spec = parseToken(tok);
        if (spec && isCoil(spec.type)) { rg.cells[r][cols - 1] = makeCell(spec); return; }
        if (c >= cols - 1) throw new Error('Demasiados elementos en la fila: ' + line);
        if (spec) rg.cells[r][c] = makeCell(spec);
        c += 1;
      });
    });
    return rg;
  }

  function program() {
    const rungs = Array.prototype.slice.call(arguments);
    return { rungs: rungs.map(function (r) { return typeof r === 'string' ? rung(r) : r; }) };
  }

  /* ---------------------------------------------------------------------
   * Utilidades de consulta sobre programas (para checklists y diagnósticos)
   * ------------------------------------------------------------------- */
  function allCells(prog) {
    const out = [];
    (prog.rungs || []).forEach(function (rg, ri) {
      for (let r = 0; r < rg.rows; r++) {
        for (let c = 0; c < rg.cols; c++) {
          const cell = rg.cells[r][c];
          if (cell) out.push({ cell: cell, ri: ri, r: r, c: c, rung: rg });
        }
      }
    });
    return out;
  }
  function matches(cell, pred) {
    if (typeof pred === 'function') return pred(cell);
    if (pred.type) {
      const types = Array.isArray(pred.type) ? pred.type : [pred.type];
      if (types.indexOf(cell.type) < 0) return false;
    }
    if (pred.addr !== undefined && cell.addr !== pred.addr) return false;
    if (pred.pt !== undefined && Math.abs((cell.pt || 0) - pred.pt) > 1e-6) return false;
    if (pred.pv !== undefined && cell.pv !== pred.pv) return false;
    return true;
  }
  const find = {
    all: allCells,
    cells: function (prog, pred) { return allCells(prog).filter(function (x) { return matches(x.cell, pred || {}); }); },
    has: function (prog, pred) { return find.cells(prog, pred).length > 0; },
    count: function (prog, pred) { return find.cells(prog, pred).length; },
    anyLink: function (prog) {
      return (prog.rungs || []).some(function (rg) { return rg.links.some(function (row, r) { return r > 0 && row.some(Boolean); }); });
    },
    /* ¿Hay algún segmento que contenga todos los elementos indicados? */
    rungWith: function (prog, preds) {
      return (prog.rungs || []).some(function (rg) {
        const cells = allCells({ rungs: [rg] });
        return preds.every(function (p) { return cells.some(function (x) { return matches(x.cell, p); }); });
      });
    },
    /* ¿Hay un contacto en una rama (fila > 0) unida a la fila superior? */
    branchWith: function (prog, pred) {
      return (prog.rungs || []).some(function (rg) {
        for (let r = 1; r < rg.rows; r++) {
          const hasCell = rg.cells[r].some(function (c) { return c && matches(c, pred); });
          const linked = rg.links[r].some(Boolean);
          if (hasCell && linked) return true;
        }
        return false;
      });
    }
  };

  /* ---------------------------------------------------------------------
   * Diagnóstico estático: avisos tipo "profesor"
   * ------------------------------------------------------------------- */
  function diagnose(prog, io) {
    const warnings = [];
    const sym = function (a) { return PLC.symbolName ? PLC.symbolName(io, a) : a; };
    const outCount = {};
    const boxCount = {};
    (prog.rungs || []).forEach(function (rg, ri) {
      const n = ri + 1;
      let hasCoil = false, hasBox = false, hasAny = false;
      for (let r = 0; r < rg.rows; r++) {
        let minC = Infinity, maxC = -1;
        for (let c = 0; c < rg.cols; c++) {
          const cell = rg.cells[r][c];
          if (!cell) continue;
          hasAny = true;
          if (isCoil(cell.type)) {
            hasCoil = true;
            if (cell.type === 'OUT') outCount[cell.addr] = (outCount[cell.addr] || 0) + 1;
          } else {
            if (isBox(cell.type)) hasBox = true;
            if (c < minC) minC = c;
            if (c > maxC) maxC = c;
            if ((cell.type === 'TON' || cell.type === 'TOF' || cell.type === 'CTU' || cell.type === 'CTD')) {
              boxCount[cell.addr] = (boxCount[cell.addr] || 0) + 1;
            }
          }
        }
        if (r > 0 && maxC >= 0) {
          // ¿la rama está unida por la derecha?
          let rightLink = !!rg.cells[r][rg.cols - 1];
          for (let b = maxC + 1; b < rg.cols; b++) {
            if (rg.links[r][b]) rightLink = true;
          }
          if (!rightLink) {
            warnings.push({ type: 'branch-open', rung: n, text: 'En el segmento ' + n + ' hay una rama (fila ' + (r + 1) + ') que no está unida por la derecha. Usa el punto de unión ● para cerrarla; si no, esa rama no hace nada.' });
          }
          // ¿la rama recibe corriente por la izquierda?
          let leftOk = minC === 0;
          for (let b = 1; b <= minC; b++) if (rg.links[r][b]) leftOk = true;
          if (!leftOk) {
            warnings.push({ type: 'branch-nopower', rung: n, text: 'En el segmento ' + n + ' la rama de la fila ' + (r + 1) + ' no recibe corriente por la izquierda: une su inicio con la fila de arriba (●) o empieza la rama en la primera columna.' });
          }
        }
      }
      if (hasAny && !hasCoil && !hasBox) {
        warnings.push({ type: 'no-coil', rung: n, text: 'El segmento ' + n + ' no tiene ninguna bobina: sus contactos no controlan nada.' });
      }
    });
    Object.keys(outCount).forEach(function (a) {
      if (outCount[a] > 1) warnings.push({ type: 'double-coil', text: 'La bobina ' + a + ' (' + sym(a) + ') aparece ' + outCount[a] + ' veces. En un PLC solo cuenta la última que se ejecuta: junta las condiciones en paralelo en una sola bobina.' });
    });
    Object.keys(boxCount).forEach(function (a) {
      if (boxCount[a] > 1) warnings.push({ type: 'double-box', text: 'El bloque ' + a + ' se usa ' + boxCount[a] + ' veces. Cada temporizador o contador debe aparecer una sola vez como bloque (puedes leer su estado con contactos ' + a + ').' });
    });
    return warnings;
  }

  /* ---------------------------------------------------------------------
   * El PLC
   * ------------------------------------------------------------------- */
  function Engine() { this.reset(); }

  Engine.prototype.reset = function () {
    this.I = {}; this.Q = {}; this.M = {}; this.T = {}; this.C = {};
    this.edges = {};
    this.scanCount = 0;
    this.time = 0;
    this.dt = 0;
    this.traces = [];
  };

  Engine.prototype.bit = function (addr) {
    if (!addr) return false;
    switch (addr[0]) {
      case 'I': return !!this.I[addr];
      case 'Q': return !!this.Q[addr];
      case 'M': return !!this.M[addr];
      case 'T': return !!(this.T[addr] && this.T[addr].q);
      case 'C': return !!(this.C[addr] && this.C[addr].q);
      default: return false;
    }
  };

  Engine.prototype.setBit = function (addr, v) {
    if (!addr) return;
    if (addr[0] === 'Q') this.Q[addr] = !!v;
    else if (addr[0] === 'M') this.M[addr] = !!v;
  };

  Engine.prototype.numeric = function (op) {
    if (typeof op === 'number') return op;
    if (!op) return 0;
    if (op[0] === 'C') return this.C[op] ? this.C[op].cv : 0;
    if (op[0] === 'T') return this.T[op] ? this.T[op].et / 1000 : 0;
    const n = parseFloat(op);
    return isNaN(n) ? 0 : n;
  };

  Engine.prototype.prepare = function (prog) {
    const self = this;
    allCells(prog).forEach(function (x) {
      const cell = x.cell;
      if (!cell.addr) return;
      if (cell.type === 'TON' || cell.type === 'TOF') {
        const pt = Math.max(0, (Number(cell.pt) || 0) * 1000);
        let t = self.T[cell.addr];
        if (!t || t.type !== cell.type) t = self.T[cell.addr] = { type: cell.type, pt: pt, et: 0, q: false, in: false };
        t.pt = pt;
      } else if (cell.type === 'CTU' || cell.type === 'CTD') {
        const pv = Math.max(0, Number(cell.pv) | 0);
        let k = self.C[cell.addr];
        if (!k || k.type !== cell.type) k = self.C[cell.addr] = { type: cell.type, pv: pv, cv: cell.type === 'CTD' ? pv : 0, q: false };
        k.pv = pv;
        k.q = k.type === 'CTU' ? k.cv >= k.pv : k.cv <= 0;
      }
    });
  };

  Engine.prototype.compare = function (a, op, b) {
    switch (op) {
      case '>': return a > b;
      case '>=': return a >= b - 1e-9;
      case '<': return a < b;
      case '<=': return a <= b + 1e-9;
      case '=': case '==': return Math.abs(a - b) < 1e-9;
      case '<>': case '!=': return Math.abs(a - b) >= 1e-9;
      default: return false;
    }
  };

  Engine.prototype.evalCell = function (cell, pin) {
    switch (cell.type) {
      case 'NO': return pin && this.bit(cell.addr);
      case 'NC': return pin && !this.bit(cell.addr);
      case 'WIRE': return pin;
      case 'TON': {
        const t = this.T[cell.addr]; if (!t) return false;
        if (pin) t.et = Math.min(t.pt, t.et + this.dt); else t.et = 0;
        t.in = pin; t.q = pin && t.et >= t.pt;
        return t.q;
      }
      case 'TOF': {
        const t = this.T[cell.addr]; if (!t) return false;
        if (pin) { t.et = 0; t.q = true; }
        else if (t.q) { t.et = Math.min(t.pt, t.et + this.dt); if (t.et >= t.pt) t.q = false; }
        t.in = pin;
        return t.q;
      }
      case 'CTU': case 'CTD': {
        const k = this.C[cell.addr]; if (!k) return false;
        const prev = !!this.edges[cell.id];
        this.edges[cell.id] = pin;
        if (pin && !prev) {
          if (k.type === 'CTU') k.cv = Math.min(9999, k.cv + 1);
          else k.cv = Math.max(0, k.cv - 1);
        }
        k.q = k.type === 'CTU' ? k.cv >= k.pv : k.cv <= 0;
        return k.q;
      }
      case 'CMP': return pin && this.compare(this.numeric(cell.addr), cell.op, Number(cell.value) || 0);
      default: return pin;
    }
  };

  Engine.prototype.evalCoil = function (cell, pin) {
    const a = cell.addr;
    if (!a) return;
    if (cell.type === 'OUT') this.setBit(a, pin);
    else if (cell.type === 'SET') { if (pin) this.setBit(a, true); }
    else if (cell.type === 'RST') {
      if (!pin) return;
      if (a[0] === 'T') { const t = this.T[a]; if (t) { t.et = 0; t.q = false; } }
      else if (a[0] === 'C') {
        const k = this.C[a];
        if (k) { k.cv = k.type === 'CTD' ? k.pv : 0; k.q = k.type === 'CTU' ? k.cv >= k.pv : k.cv <= 0; }
      } else this.setBit(a, false);
    }
  };

  function mergeLinks(vals, links, b) {
    const R = vals.length;
    let start = 0;
    for (let r = 1; r <= R; r++) {
      if (r === R || !links[r][b]) {
        if (r - start > 1) {
          let any = false;
          for (let k = start; k < r; k++) any = any || vals[k];
          for (let k = start; k < r; k++) vals[k] = any;
        }
        start = r;
      }
    }
  }

  Engine.prototype.evalRung = function (rg) {
    const R = rg.rows, C = rg.cols, OC = C - 1;
    const cellIn = make2D(R, C, false), cellOut = make2D(R, C, false);
    const nodes = [new Array(R).fill(true)];
    for (let c = 0; c < OC; c++) {
      const next = new Array(R);
      for (let r = 0; r < R; r++) {
        const cell = rg.cells[r][c];
        const pin = nodes[c][r];
        let pout;
        if (!cell) pout = r === 0 ? pin : false;
        else if (isCoil(cell.type)) pout = pin; // no debería ocurrir
        else pout = this.evalCell(cell, pin);
        cellIn[r][c] = pin; cellOut[r][c] = pout; next[r] = pout;
      }
      mergeLinks(next, rg.links, c + 1);
      nodes.push(next);
    }
    for (let r = 0; r < R; r++) {
      const cell = rg.cells[r][OC];
      const pin = nodes[OC][r];
      cellIn[r][OC] = pin;
      if (cell) {
        if (isCoil(cell.type)) { this.evalCoil(cell, pin); cellOut[r][OC] = pin; }
        else cellOut[r][OC] = this.evalCell(cell, pin);
      }
    }
    return { cellIn: cellIn, cellOut: cellOut, nodes: nodes };
  };

  /* Ciclo de scan dividido en fases (para el modo paso a paso) */
  Engine.prototype.beginScan = function (prog, inputs, dt) {
    this.dt = dt;
    this.time += dt;
    this.I = Object.assign({}, inputs || {});
    this.prepare(prog);
    this.traces = new Array(prog.rungs.length);
  };
  Engine.prototype.execRung = function (prog, i) {
    this.traces[i] = this.evalRung(prog.rungs[i]);
  };
  Engine.prototype.endScan = function () {
    this.scanCount += 1;
    return Object.assign({}, this.Q);
  };
  Engine.prototype.scan = function (prog, inputs, dt) {
    this.beginScan(prog, inputs, dt);
    for (let i = 0; i < prog.rungs.length; i++) this.execRung(prog, i);
    return this.endScan();
  };

  /* ---------------------------------------------------------------------
   * Mundo: une el panel de mando (pulsadores…), la escena física y el PLC
   * ------------------------------------------------------------------- */
  function World(io, sceneCfg) {
    this.io = io || { inputs: [], outputs: [] };
    this.sceneCfg = sceneCfg || null;
    this.reset();
  }
  World.prototype.reset = function () {
    this.user = {};      // actuación física del usuario (pulsado / girado)
    this.outputs = {};   // salidas físicas (lo que el PLC escribió)
    this.time = 0;
    this.scene = this.sceneCfg && PLC.Scenes ? PLC.Scenes.create(this.sceneCfg) : null;
    const self = this;
    (this.io.inputs || []).forEach(function (d) { if (d.initial) self.user[d.addr] = true; });
  };
  World.prototype.inputDef = function (addr) {
    return (this.io.inputs || []).find(function (d) { return d.addr === addr; });
  };
  /* Valor físico de una entrada (lo que llega al borne del PLC) */
  World.prototype.inputValue = function (def) {
    let v = !!this.user[def.addr];
    if (this.scene && this.scene.sensor) {
      const s = this.scene.sensor(def.addr, this);
      if (s !== undefined) v = v || !!s;
    }
    if (def.wiring === 'NC') v = !v;
    return v;
  };
  World.prototype.readInputs = function () {
    const o = {};
    const self = this;
    (this.io.inputs || []).forEach(function (d) { o[d.addr] = self.inputValue(d); });
    return o;
  };
  World.prototype.applyOutputs = function (Q) { this.outputs = Object.assign({}, Q); };
  World.prototype.clearOutputs = function () { this.outputs = {}; };
  World.prototype.update = function (dt) {
    this.time += dt;
    if (this.scene && this.scene.update) this.scene.update(dt, this.outputs, this);
  };

  /* Nombres simbólicos */
  function symbolName(io, addr) {
    if (!io || !addr) return '';
    const lists = [io.inputs, io.outputs, io.memories, io.timers, io.counters];
    for (let i = 0; i < lists.length; i++) {
      const l = lists[i] || [];
      for (let j = 0; j < l.length; j++) if (l[j].addr === addr) return l[j].name;
    }
    return '';
  }

  PLC.DEFAULT_COLS = DEFAULT_COLS;
  PLC.MAX_ROWS = MAX_ROWS;
  PLC.ELEMENTS = ELEMENTS;
  PLC.COMPARE_OPS = COMPARE_OPS;
  PLC.isCoil = isCoil;
  PLC.isBox = isBox;
  PLC.areaOf = areaOf;
  PLC.newId = newId;
  PLC.makeCell = makeCell;
  PLC.emptyRung = emptyRung;
  PLC.emptyProgram = emptyProgram;
  PLC.normalizeProgram = normalizeProgram;
  PLC.clone = clone;
  PLC.rung = rung;
  PLC.program = program;
  PLC.find = find;
  PLC.diagnose = diagnose;
  PLC.Engine = Engine;
  PLC.World = World;
  PLC.symbolName = symbolName;
  PLC.make2D = make2D;
})(typeof window !== 'undefined' ? window : globalThis);
