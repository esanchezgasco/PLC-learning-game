/* =========================================================================
 * PLC Academy — Editor visual de Ladder (lenguaje de contactos)
 * ========================================================================= */
(function (root) {
  'use strict';
  const PLC = (root.PLC = root.PLC || {});
  const CW = 100, RH = 84, RX = 14, WY = 46;

  const TOOL_ORDER = ['NO', 'NC', 'WIRE', 'OUT', 'SET', 'RST', 'TON', 'TOF', 'CTU', 'CTD', 'CMP'];
  const TOOL_LABEL = { NO: 'NO', NC: 'NC', WIRE: 'Cable', OUT: 'Bobina', SET: 'Set', RST: 'Reset', TON: 'TON', TOF: 'TOF', CTU: 'CTU', CTD: 'CTD', CMP: 'Comparar' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Iconos pequeños para la paleta */
  function toolIcon(t) {
    const w = 'class="ic-w"';
    switch (t) {
      case 'NO': return '<svg viewBox="0 0 44 24"><line x1="0" y1="12" x2="16" y2="12" ' + w + '/><line x1="16" y1="4" x2="16" y2="20" ' + w + '/><line x1="28" y1="4" x2="28" y2="20" ' + w + '/><line x1="28" y1="12" x2="44" y2="12" ' + w + '/></svg>';
      case 'NC': return '<svg viewBox="0 0 44 24"><line x1="0" y1="12" x2="16" y2="12" ' + w + '/><line x1="16" y1="4" x2="16" y2="20" ' + w + '/><line x1="28" y1="4" x2="28" y2="20" ' + w + '/><line x1="28" y1="12" x2="44" y2="12" ' + w + '/><line x1="13" y1="21" x2="31" y2="3" ' + w + '/></svg>';
      case 'WIRE': return '<svg viewBox="0 0 44 24"><line x1="0" y1="12" x2="44" y2="12" ' + w + '/></svg>';
      case 'OUT': case 'SET': case 'RST':
        return '<svg viewBox="0 0 44 24"><line x1="0" y1="12" x2="12" y2="12" ' + w + '/><path d="M17 3 Q9 12 17 21" ' + w + ' fill="none"/><path d="M27 3 Q35 12 27 21" ' + w + ' fill="none"/><line x1="32" y1="12" x2="44" y2="12" ' + w + '/>' +
          (t !== 'OUT' ? '<text x="22" y="16.5" text-anchor="middle" class="ic-t">' + (t === 'SET' ? 'S' : 'R') + '</text>' : '') + '</svg>';
      default:
        return '<svg viewBox="0 0 44 24"><line x1="0" y1="12" x2="8" y2="12" ' + w + '/><rect x="8" y="2" width="28" height="20" rx="3" ' + w + ' fill="none"/><line x1="36" y1="12" x2="44" y2="12" ' + w + '/><text x="22" y="15.5" text-anchor="middle" class="ic-t sm">' + (t === 'CMP' ? '≥' : t) + '</text></svg>';
    }
  }

  function addrOptions(io, type) {
    const el = PLC.ELEMENTS[type];
    const areas = el ? el.areas : [];
    const groups = [];
    const named = function (list, a) { const d = (list || []).find(function (x) { return x.addr === a; }); return d ? d.name : ''; };
    if (areas.indexOf('I') >= 0) groups.push({ label: 'Entradas (I)', items: (io.inputs || []).map(function (d) { return { addr: d.addr, name: d.name }; }) });
    if (areas.indexOf('Q') >= 0) groups.push({ label: 'Salidas (Q)', items: (io.outputs || []).map(function (d) { return { addr: d.addr, name: d.name }; }) });
    if (areas.indexOf('M') >= 0) {
      const items = [];
      for (let i = 0; i < 8; i++) { const a = 'M0.' + i; items.push({ addr: a, name: named(io.memories, a) }); }
      groups.push({ label: 'Memorias / marcas (M)', items: items });
    }
    if (areas.indexOf('T') >= 0) {
      const items = [];
      for (let i = 0; i < 8; i++) { const a = 'T' + i; items.push({ addr: a, name: named(io.timers, a) }); }
      groups.push({ label: 'Temporizadores (T)', items: items });
    }
    if (areas.indexOf('C') >= 0) {
      const items = [];
      for (let i = 0; i < 8; i++) { const a = 'C' + i; items.push({ addr: a, name: named(io.counters, a) }); }
      groups.push({ label: 'Contadores (C)', items: items });
    }
    return groups;
  }

  function fmtSec(ms) { return (ms / 1000).toFixed(1) + 's'; }

  /* ===================================================================== */
  function LadderEditor(rootEl, opts) {
    this.root = rootEl;
    this.opts = Object.assign({ io: { inputs: [], outputs: [] }, tools: TOOL_ORDER, locked: {}, readonly: false }, opts || {});
    this.io = this.opts.io;
    this.program = PLC.emptyProgram();
    this.sel = null;
    this.tool = null;
    this.undo = [];
    this.live = [];
    this.targets = [];
    this.activeRung = -1;
    this.build();
  }

  LadderEditor.prototype.build = function () {
    const self = this;
    const ro = this.opts.readonly;
    this.root.classList.add('ladder-editor');
    if (ro) this.root.classList.add('readonly');
    let h = '';
    if (!ro) {
      h += '<div class="lad-toolbar"><div class="palette" data-palette></div><div class="lad-actions">' +
        '<button class="btn sm ghost" data-act="undo" title="Deshacer (Ctrl+Z)">↶ Deshacer</button>' +
        '<button class="btn sm ghost" data-act="addrung" title="Añadir un segmento nuevo">＋ Segmento</button>' +
        '<span data-extra></span></div></div>';
      h += '<div class="lad-props" data-props></div>';
    }
    h += '<div class="lad-rungs" data-rungs></div>';
    this.root.innerHTML = h;
    this.rungsEl = this.root.querySelector('[data-rungs]');
    if (!ro) {
      this.paletteEl = this.root.querySelector('[data-palette]');
      this.propsEl = this.root.querySelector('[data-props]');
      this.renderPalette();
      this.root.querySelector('[data-act="undo"]').addEventListener('click', function () { self.doUndo(); });
      this.root.querySelector('[data-act="addrung"]').addEventListener('click', function () { self.addRung(); });
      const extra = this.root.querySelector('[data-extra]');
      (this.opts.extraActions || []).forEach(function (a) {
        const b = document.createElement('button');
        b.className = 'btn sm ghost';
        b.innerHTML = a.label;
        b.title = a.title || '';
        b.addEventListener('click', a.onClick);
        extra.appendChild(b);
      });
      this.rungsEl.addEventListener('click', function (e) { self.onClick(e); });
      this.rungsEl.addEventListener('dragover', function (e) {
        const hit = e.target.closest && e.target.closest('[data-hit]');
        if (hit) { e.preventDefault(); self.rungsEl.querySelectorAll('.hit.drop').forEach(function (x) { x.classList.remove('drop'); }); hit.classList.add('drop'); }
      });
      this.rungsEl.addEventListener('dragleave', function (e) {
        const hit = e.target.closest && e.target.closest('[data-hit]');
        if (hit) hit.classList.remove('drop');
      });
      this.rungsEl.addEventListener('drop', function (e) {
        const hit = e.target.closest && e.target.closest('[data-hit]');
        if (!hit) return;
        e.preventDefault();
        const t = e.dataTransfer.getData('text/plain');
        const p = hit.getAttribute('data-hit').split(',').map(Number);
        if (PLC.ELEMENTS[t]) self.place(t, p[0], p[1], p[2]);
      });
      this.keyHandler = function (e) {
        if (!document.body.contains(self.root)) { document.removeEventListener('keydown', self.keyHandler); return; }
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
        if ((e.key === 'Delete' || e.key === 'Backspace') && self.sel) { e.preventDefault(); self.deleteSelected(); }
        else if (e.key === 'Escape') { self.setTool(null); self.select(null); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); self.doUndo(); }
      };
      document.addEventListener('keydown', this.keyHandler);
    }
  };

  LadderEditor.prototype.destroy = function () {
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
  };

  LadderEditor.prototype.renderPalette = function () {
    const self = this;
    const allowed = this.opts.tools;
    let h = '<span class="pal-hint">Paleta:</span>';
    TOOL_ORDER.forEach(function (t) {
      const ok = allowed.indexOf(t) >= 0;
      const lockLvl = self.opts.locked[t];
      if (!ok && !lockLvl) return;
      h += '<button class="tool' + (ok ? '' : ' locked') + (self.tool === t ? ' active' : '') + '" data-tool="' + t + '" ' + (ok ? 'draggable="true"' : 'disabled') +
        ' title="' + esc(ok ? PLC.ELEMENTS[t].name + ': ' + PLC.ELEMENTS[t].desc : 'Se desbloquea en el nivel ' + lockLvl) + '">' +
        toolIcon(t) + '<span>' + (ok ? TOOL_LABEL[t] : '🔒') + '</span></button>';
    });
    h += '<button class="tool eraser' + (self.tool === 'ERASE' ? ' active' : '') + '" data-tool="ERASE" title="Borrar: haz clic en un elemento para eliminarlo"><svg viewBox="0 0 44 24"><path d="M14 18 L26 6 L34 14 L22 26Z" class="ic-w" fill="none"/></svg><span>Borrar</span></button>';
    this.paletteEl.innerHTML = h;
    this.paletteEl.querySelectorAll('[data-tool]').forEach(function (b) {
      b.addEventListener('click', function () {
        const t = b.getAttribute('data-tool');
        self.setTool(self.tool === t ? null : t);
        if (self.tool && self.tool !== 'ERASE' && self.sel && !self.cellAt(self.sel)) {
          // si hay una celda vacía seleccionada, colocar directamente
          self.place(self.tool, self.sel.ri, self.sel.r, self.sel.c);
        }
      });
      b.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', b.getAttribute('data-tool')); });
    });
  };

  LadderEditor.prototype.setTool = function (t) {
    this.tool = t;
    if (this.paletteEl) {
      this.paletteEl.querySelectorAll('[data-tool]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tool') === t); });
    }
    this.root.classList.toggle('placing', !!t);
  };

  LadderEditor.prototype.setTools = function (tools, locked) {
    this.opts.tools = tools;
    this.opts.locked = locked || {};
    if (this.paletteEl) this.renderPalette();
  };

  LadderEditor.prototype.setProgram = function (prog, keepUndo) {
    this.program = PLC.normalizeProgram(PLC.clone(prog));
    if (!keepUndo) this.undo = [];
    this.sel = null;
    this.render();
  };
  LadderEditor.prototype.getProgram = function () { return this.program; };

  LadderEditor.prototype.pushUndo = function () {
    this.undo.push(JSON.stringify(this.program));
    if (this.undo.length > 60) this.undo.shift();
  };
  LadderEditor.prototype.doUndo = function () {
    if (!this.undo.length) { this.toast('No hay nada que deshacer.'); return; }
    this.program = JSON.parse(this.undo.pop());
    this.sel = null;
    this.render();
    this.changed();
  };
  LadderEditor.prototype.changed = function () { if (this.opts.onChange) this.opts.onChange(this.program); };
  LadderEditor.prototype.toast = function (msg, kind) { if (PLC.ui && PLC.ui.toast) PLC.ui.toast(msg, kind); };

  LadderEditor.prototype.cellAt = function (s) {
    const rg = this.program.rungs[s.ri];
    return rg && rg.cells[s.r] ? rg.cells[s.r][s.c] : null;
  };

  /* --------------------------- edición --------------------------- */
  LadderEditor.prototype.onClick = function (e) {
    if (this.opts.readonly) return;
    const lk = e.target.closest('[data-link]');
    if (lk) {
      const p = lk.getAttribute('data-link').split(',').map(Number);
      this.pushUndo();
      const rg = this.program.rungs[p[0]];
      rg.links[p[1]][p[2]] = !rg.links[p[1]][p[2]];
      this.render(); this.changed();
      return;
    }
    const rt = e.target.closest('[data-rt]');
    if (rt) { this.rungTool(rt.getAttribute('data-rt'), Number(rt.getAttribute('data-ri'))); return; }
    const hit = e.target.closest('[data-hit]');
    if (!hit) { return; }
    const p = hit.getAttribute('data-hit').split(',').map(Number);
    if (this.tool === 'ERASE') {
      const s = { ri: p[0], r: p[1], c: p[2] };
      if (this.cellAt(s)) { this.pushUndo(); this.program.rungs[p[0]].cells[p[1]][p[2]] = null; this.sel = null; this.render(); this.changed(); }
      return;
    }
    if (this.tool) { this.place(this.tool, p[0], p[1], p[2]); return; }
    const same = this.sel && this.sel.ri === p[0] && this.sel.r === p[1] && this.sel.c === p[2];
    this.select(same ? null : { ri: p[0], r: p[1], c: p[2] });
  };

  LadderEditor.prototype.nextFree = function (area) {
    const used = {};
    PLC.find.all(this.program).forEach(function (x) { if (x.cell.addr && x.cell.addr[0] === area && PLC.isBox(x.cell.type)) used[x.cell.addr] = true; });
    for (let i = 0; i < 8; i++) if (!used[area + i]) return area + i;
    return area + '0';
  };

  LadderEditor.prototype.defaultCell = function (type, prev, ri) {
    const io = this.io;
    const el = PLC.ELEMENTS[type];
    const spec = { type: type };
    const keep = prev && prev.addr && el.areas.indexOf(prev.addr[0]) >= 0 && !(PLC.isBox(type) && !PLC.isBox(prev.type));
    const rg = this.program.rungs[ri];
    const inRung = {};
    if (rg) PLC.find.all({ rungs: [rg] }).forEach(function (x) { if (x.cell.addr) inRung[x.cell.addr] = true; });
    const driven = {};
    PLC.find.cells(this.program, { type: ['OUT', 'SET'] }).forEach(function (x) { driven[x.cell.addr] = true; });
    const pick = function (list, used) {
      const free = (list || []).find(function (d) { return !used[d.addr]; });
      return free ? free.addr : (list && list[0] ? list[0].addr : null);
    };
    if (el.kind === 'contact') spec.addr = keep ? prev.addr : (pick(io.inputs, inRung) || 'I0.0');
    else if (el.kind === 'coil') spec.addr = keep ? prev.addr : (pick(io.outputs, type === 'OUT' ? driven : {}) || 'Q0.0');
    else if (el.kind === 'timer') { spec.addr = keep ? prev.addr : this.nextFree('T'); spec.pt = prev && prev.pt ? prev.pt : 3; }
    else if (el.kind === 'counter') { spec.addr = keep ? prev.addr : this.nextFree('C'); spec.pv = prev && prev.pv ? prev.pv : 5; }
    else if (el.kind === 'compare') {
      const firstC = PLC.find.cells(this.program, { type: ['CTU', 'CTD'] })[0];
      spec.addr = firstC ? firstC.cell.addr : 'C0'; spec.op = '>='; spec.value = 5;
    }
    return PLC.makeCell(spec);
  };

  LadderEditor.prototype.place = function (type, ri, r, c) {
    const rg = this.program.rungs[ri];
    if (!rg) return;
    const OC = rg.cols - 1;
    if (PLC.isCoil(type) && c !== OC) {
      this.toast('Las bobinas van siempre en la <b>última columna</b>, pegadas al carril derecho. La he colocado allí.', 'info');
      c = OC;
    } else if (!PLC.isCoil(type) && c === OC) {
      this.toast('La última columna es solo para <b>bobinas</b>. Coloca contactos, cables y bloques más a la izquierda.', 'warn');
      return;
    }
    this.pushUndo();
    const prev = rg.cells[r][c];
    rg.cells[r][c] = this.defaultCell(type, prev, ri);
    this.sel = { ri: ri, r: r, c: c };
    this.render();
    this.changed();
  };

  LadderEditor.prototype.deleteSelected = function () {
    if (!this.sel) return;
    const s = this.sel;
    if (!this.cellAt(s)) return;
    this.pushUndo();
    this.program.rungs[s.ri].cells[s.r][s.c] = null;
    this.render();
    this.changed();
  };

  LadderEditor.prototype.select = function (s) {
    this.sel = s;
    this.rungsEl.querySelectorAll('.cell.sel').forEach(function (x) { x.classList.remove('sel'); });
    if (s) {
      const g = this.rungsEl.querySelector('[data-cell="' + s.ri + ',' + s.r + ',' + s.c + '"]');
      if (g) g.classList.add('sel');
    }
    this.renderProps();
  };

  LadderEditor.prototype.addRung = function () {
    this.pushUndo();
    this.program.rungs.push(PLC.emptyRung(1, PLC.DEFAULT_COLS));
    this.render();
    this.changed();
    const last = this.rungsEl.lastElementChild;
    if (last && last.scrollIntoView) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  LadderEditor.prototype.rungTool = function (act, ri) {
    const rungs = this.program.rungs;
    const rg = rungs[ri];
    if (!rg) return;
    if (act === 'addrow') {
      if (rg.rows >= PLC.MAX_ROWS) { this.toast('Máximo ' + PLC.MAX_ROWS + ' filas por segmento.', 'warn'); return; }
      this.pushUndo();
      rg.rows += 1; rg.cells.push(new Array(rg.cols).fill(null)); rg.links.push(new Array(rg.cols).fill(false));
    } else if (act === 'delrow') {
      if (rg.rows <= 1) return;
      this.pushUndo();
      rg.rows -= 1; rg.cells.pop(); rg.links.pop();
      if (this.sel && this.sel.ri === ri && this.sel.r >= rg.rows) this.sel = null;
    } else if (act === 'up' && ri > 0) {
      this.pushUndo(); rungs.splice(ri - 1, 0, rungs.splice(ri, 1)[0]); this.sel = null;
    } else if (act === 'down' && ri < rungs.length - 1) {
      this.pushUndo(); rungs.splice(ri + 1, 0, rungs.splice(ri, 1)[0]); this.sel = null;
    } else if (act === 'del') {
      this.pushUndo();
      if (rungs.length === 1) rungs[0] = PLC.emptyRung();
      else rungs.splice(ri, 1);
      this.sel = null;
    } else return;
    this.render();
    this.changed();
  };

  /* --------------------------- propiedades --------------------------- */
  LadderEditor.prototype.renderProps = function () {
    if (!this.propsEl) return;
    const self = this;
    const s = this.sel;
    const cell = s ? this.cellAt(s) : null;
    if (!s) {
      this.propsEl.innerHTML = '<span class="props-tip">' + (this.tool ? (this.tool === 'ERASE' ? '🧽 Haz clic en un elemento para borrarlo.' : '✋ Haz clic en una celda del segmento para colocar <b>' + PLC.ELEMENTS[this.tool].name + '</b>. <kbd>Esc</kbd> para cancelar.') :
        '👆 Elige un elemento en la paleta y haz clic en una celda (o arrástralo). Haz clic en un elemento para editarlo.') + '</span>';
      return;
    }
    if (!cell) {
      const rg = this.program.rungs[s.ri];
      this.propsEl.innerHTML = '<span class="props-tip">Celda vacía' + (s.c === rg.cols - 1 ? ' (columna de bobinas)' : '') + '. Elige un elemento en la paleta para colocarlo aquí.</span>';
      return;
    }
    const el = PLC.ELEMENTS[cell.type];
    let h = '<span class="props-type">' + toolIcon(cell.type) + '<b>' + esc(el.name) + '</b></span>';
    if (el.areas.length) {
      h += '<label>' + (cell.type === 'CMP' ? 'Valor' : 'Dirección') + ' <select data-p="addr">';
      addrOptions(this.io, cell.type).forEach(function (g) {
        if (!g.items.length) return;
        h += '<optgroup label="' + esc(g.label) + '">';
        g.items.forEach(function (it) {
          h += '<option value="' + it.addr + '"' + (it.addr === cell.addr ? ' selected' : '') + '>' + it.addr + (it.name ? ' — ' + esc(it.name) : '') + '</option>';
        });
        h += '</optgroup>';
      });
      h += '</select></label>';
    }
    if (el.kind === 'timer') h += '<label>Tiempo PT <input type="number" min="0" step="0.5" value="' + (cell.pt || 0) + '" data-p="pt"> s</label>';
    if (el.kind === 'counter') h += '<label>Objetivo PV <input type="number" min="0" step="1" value="' + (cell.pv || 0) + '" data-p="pv"></label>';
    if (el.kind === 'compare') {
      h += '<label><select data-p="op">' + PLC.COMPARE_OPS.map(function (o) { return '<option' + (o === cell.op ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>';
      h += '<label><input type="number" step="1" value="' + (cell.value || 0) + '" data-p="value"></label>';
    }
    h += '<button class="btn sm danger" data-p="del" title="Eliminar (Supr)">🗑</button>';
    h += '<span class="props-desc">' + esc(el.desc) + '</span>';
    this.propsEl.innerHTML = h;
    this.propsEl.querySelectorAll('[data-p]').forEach(function (inp) {
      const k = inp.getAttribute('data-p');
      if (k === 'del') { inp.addEventListener('click', function () { self.deleteSelected(); }); return; }
      inp.addEventListener('change', function () {
        self.pushUndo();
        let v = inp.value;
        if (k === 'pt' || k === 'value') v = Math.max(k === 'pt' ? 0 : -9999, parseFloat(v) || 0);
        if (k === 'pv') v = Math.max(0, parseInt(v, 10) || 0);
        cell[k] = v;
        const keepSel = self.sel;
        self.render();
        self.sel = keepSel;
        self.select(keepSel);
        self.changed();
      });
    });
  };

  /* --------------------------- dibujo --------------------------- */
  LadderEditor.prototype.symbol = function (addr) { return PLC.symbolName(this.io, addr); };

  LadderEditor.prototype.cellSVG = function (rg, ri, r, c) {
    const x = RX + c * CW, y = r * RH, wy = y + WY;
    const cell = rg.cells[r][c];
    const OC = rg.cols - 1;
    const key = ri + ',' + r + ',' + c;
    const L = function (kind) { return 'data-l="' + kind + '|' + key + '"'; };
    let h = '';
    if (!cell) {
      if (r === 0 && c < OC) h += '<line ' + L('in') + ' class="w" x1="' + x + '" y1="' + wy + '" x2="' + (x + CW) + '" y2="' + wy + '"/>';
      else if (r === 0 && c === OC) h += '<line class="w ghost" x1="' + x + '" y1="' + wy + '" x2="' + (x + CW) + '" y2="' + wy + '"/>';
    } else {
      const t = cell.type;
      const sym = this.symbol(cell.addr);
      const addrTxt = '<text ' + L('ab') + ' class="addr" x="' + (x + CW / 2) + '" y="' + (y + 18) + '" text-anchor="middle">' + esc(cell.addr || '') + '</text>';
      const symTxt = sym ? '<text class="sym" x="' + (x + CW / 2) + '" y="' + (y + 78) + '" text-anchor="middle">' + esc(sym.length > 13 ? sym.slice(0, 12) + '…' : sym) + '</text>' : '';
      if (t === 'NO' || t === 'NC') {
        h += '<line ' + L('in') + ' class="w" x1="' + x + '" y1="' + wy + '" x2="' + (x + 38) + '" y2="' + wy + '"/>';
        h += '<line ' + L('out') + ' class="w" x1="' + (x + 62) + '" y1="' + wy + '" x2="' + (x + CW) + '" y2="' + wy + '"/>';
        h += '<rect ' + L('cl') + ' class="cfill" x="' + (x + 40) + '" y="' + (wy - 13) + '" width="20" height="26"/>';
        h += '<line class="bar" x1="' + (x + 38) + '" y1="' + (wy - 15) + '" x2="' + (x + 38) + '" y2="' + (wy + 15) + '"/>';
        h += '<line class="bar" x1="' + (x + 62) + '" y1="' + (wy - 15) + '" x2="' + (x + 62) + '" y2="' + (wy + 15) + '"/>';
        if (t === 'NC') h += '<line class="bar slash" x1="' + (x + 33) + '" y1="' + (wy + 15) + '" x2="' + (x + 67) + '" y2="' + (wy - 15) + '"/>';
        h += addrTxt + symTxt;
      } else if (t === 'WIRE') {
        h += '<line ' + L('in') + ' class="w" x1="' + x + '" y1="' + wy + '" x2="' + (x + CW) + '" y2="' + wy + '"/>';
      } else if (PLC.isCoil(t)) {
        h += '<line ' + L('in') + ' class="w" x1="' + x + '" y1="' + wy + '" x2="' + (x + 36) + '" y2="' + wy + '"/>';
        h += '<line ' + L('in') + ' class="w" x1="' + (x + 64) + '" y1="' + wy + '" x2="' + (x + CW) + '" y2="' + wy + '"/>';
        h += '<circle ' + L('in') + ' class="coilfill" cx="' + (x + 50) + '" cy="' + wy + '" r="13"/>';
        h += '<path class="bar" d="M' + (x + 44) + ' ' + (wy - 15) + ' Q' + (x + 33) + ' ' + wy + ' ' + (x + 44) + ' ' + (wy + 15) + '" fill="none"/>';
        h += '<path class="bar" d="M' + (x + 56) + ' ' + (wy - 15) + ' Q' + (x + 67) + ' ' + wy + ' ' + (x + 56) + ' ' + (wy + 15) + '" fill="none"/>';
        if (t !== 'OUT') h += '<text class="coil-letter" x="' + (x + 50) + '" y="' + (wy + 5) + '" text-anchor="middle">' + (t === 'SET' ? 'S' : 'R') + '</text>';
        h += addrTxt + symTxt;
      } else {
        // bloques: temporizadores, contadores, comparador
        h += '<line ' + L('in') + ' class="w" x1="' + x + '" y1="' + wy + '" x2="' + (x + 10) + '" y2="' + wy + '"/>';
        h += '<line ' + L('out') + ' class="w" x1="' + (x + 90) + '" y1="' + wy + '" x2="' + (x + CW) + '" y2="' + wy + '"/>';
        h += '<rect ' + L('bx') + ' class="box" x="' + (x + 10) + '" y="' + (y + 24) + '" width="80" height="56" rx="5"/>';
        if (t === 'CMP') {
          h += '<text class="box-title" x="' + (x + 50) + '" y="' + (y + 38) + '" text-anchor="middle">CMP</text>';
          h += '<text class="box-txt" x="' + (x + 50) + '" y="' + (y + 54) + '" text-anchor="middle">' + esc(cell.addr) + ' ' + esc(cell.op) + ' ' + esc(cell.value) + '</text>';
          h += '<text ' + L('tx') + ' class="box-live" x="' + (x + 50) + '" y="' + (y + 70) + '" text-anchor="middle"></text>';
          h += '<text class="addr" x="' + (x + CW / 2) + '" y="' + (y + 18) + '" text-anchor="middle">comparar</text>';
        } else {
          const timer = t === 'TON' || t === 'TOF';
          h += '<text class="box-title" x="' + (x + 50) + '" y="' + (y + 38) + '" text-anchor="middle">' + t + '</text>';
          h += '<text class="box-txt" x="' + (x + 50) + '" y="' + (y + 54) + '" text-anchor="middle">' + (timer ? 'PT ' + (cell.pt || 0) + 's' : 'PV ' + (cell.pv || 0)) + '</text>';
          h += '<text ' + L('tx') + ' class="box-live" x="' + (x + 50) + '" y="' + (y + 70) + '" text-anchor="middle">' + (timer ? 'ET 0.0s' : 'CV ' + (t === 'CTD' ? (cell.pv || 0) : 0)) + '</text>';
          h += addrTxt;
          if (timer) h += '<rect ' + L('pb') + ' class="pbar" x="' + (x + 14) + '" y="' + (y + 74) + '" width="0" height="3"/>';
        }
      }
    }
    // zona de clic
    const isTarget = this.targets.some(function (tg) { return tg.ri === ri && tg.r === r && tg.c === c; });
    h = '<g class="cell' + (c === OC ? ' coilcol' : '') + (isTarget ? ' target' : '') + '" data-cell="' + key + '">' +
      '<rect class="hit" data-hit="' + key + '" x="' + (x + 2) + '" y="' + (y + 4) + '" width="' + (CW - 4) + '" height="' + (RH - 6) + '" rx="6"/>' + h + '</g>';
    return h;
  };

  LadderEditor.prototype.rungSVG = function (rg, ri) {
    const W = RX * 2 + rg.cols * CW, H = rg.rows * RH + 4;
    const ro = this.opts.readonly;
    let h = '<svg class="rung-svg" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px;min-width:' + Math.round(W * (ro ? 0.42 : 0.7)) + 'px">';
    // carriles
    h += '<line class="rail on" x1="' + RX + '" y1="6" x2="' + RX + '" y2="' + (H - 6) + '"/>';
    h += '<line class="rail" x1="' + (RX + rg.cols * CW) + '" y1="6" x2="' + (RX + rg.cols * CW) + '" y2="' + (H - 6) + '"/>';
    for (let r = 0; r < rg.rows; r++) for (let c = 0; c < rg.cols; c++) h += this.cellSVG(rg, ri, r, c);
    // uniones verticales
    for (let r = 1; r < rg.rows; r++) {
      for (let b = 1; b < rg.cols; b++) {
        const x = RX + b * CW, y1 = (r - 1) * RH + WY, y2 = r * RH + WY;
        if (rg.links[r][b]) h += '<line data-l="lk|' + ri + ',' + r + ',' + b + '" class="w link" x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '"/>';
        if (!ro) h += '<circle class="lhot' + (rg.links[r][b] ? ' on' : '') + '" data-link="' + ri + ',' + r + ',' + b + '" cx="' + x + '" cy="' + ((y1 + y2) / 2) + '" r="8"><title>' + (rg.links[r][b] ? 'Quitar unión' : 'Unir con la fila de arriba') + '</title></circle>';
      }
    }
    h += '</svg>';
    return h;
  };

  LadderEditor.prototype.render = function () {
    const self = this;
    const ro = this.opts.readonly;
    let h = '';
    this.program.rungs.forEach(function (rg, ri) {
      h += '<div class="rung' + (ri === self.activeRung ? ' active-rung' : '') + '" data-ri="' + ri + '">';
      h += '<div class="rung-head"><span class="rung-num">Segmento ' + (ri + 1) + '</span>' + (rg.comment ? '<span class="rung-comment">' + esc(rg.comment) + '</span>' : '');
      if (!ro) {
        h += '<span class="rung-tools">' +
          '<button data-rt="addrow" data-ri="' + ri + '" title="Añadir una rama (fila) para hacer un paralelo / OR">＋ Rama</button>' +
          (rg.rows > 1 ? '<button data-rt="delrow" data-ri="' + ri + '" title="Quitar la última rama">− Rama</button>' : '') +
          '<button data-rt="up" data-ri="' + ri + '" title="Subir segmento">↑</button>' +
          '<button data-rt="down" data-ri="' + ri + '" title="Bajar segmento">↓</button>' +
          '<button data-rt="del" data-ri="' + ri + '" title="Eliminar segmento">🗑</button></span>';
      }
      h += '</div><div class="rung-body">' + self.rungSVG(rg, ri) + '</div></div>';
    });
    this.rungsEl.innerHTML = h;
    // referencias para la animación en vivo
    this.live = [];
    this.rungsEl.querySelectorAll('[data-l]').forEach(function (el) {
      const parts = el.getAttribute('data-l').split('|');
      const p = parts[1].split(',').map(Number);
      const rg = self.program.rungs[p[0]];
      const cell = parts[0] === 'lk' ? null : rg.cells[p[1]][p[2]];
      self.live.push({ el: el, kind: parts[0], ri: p[0], r: p[1], c: p[2], cell: cell });
    });
    if (this.sel) {
      const g = this.rungsEl.querySelector('[data-cell="' + this.sel.ri + ',' + this.sel.r + ',' + this.sel.c + '"]');
      if (g) g.classList.add('sel'); else this.sel = null;
    }
    this.renderProps();
    if (this.lastEngine) this.updateLive(this.lastEngine);
  };

  LadderEditor.prototype.setTargets = function (targets) {
    this.targets = targets || [];
    const self = this;
    this.rungsEl.querySelectorAll('.cell.target').forEach(function (g) { g.classList.remove('target'); });
    this.targets.forEach(function (t) {
      const g = self.rungsEl.querySelector('[data-cell="' + t.ri + ',' + t.r + ',' + t.c + '"]');
      if (g) g.classList.add('target');
    });
  };

  LadderEditor.prototype.highlightRung = function (i) {
    this.activeRung = i;
    this.rungsEl.querySelectorAll('.rung').forEach(function (el, k) { el.classList.toggle('active-rung', k === i); });
  };

  /* Animación en vivo: flujo de corriente, contactos cerrados, tiempos… */
  LadderEditor.prototype.updateLive = function (engine) {
    this.lastEngine = engine;
    const tr = engine ? engine.traces : null;
    for (let i = 0; i < this.live.length; i++) {
      const L = this.live[i];
      const t = tr && tr[L.ri];
      let on = false;
      switch (L.kind) {
        case 'in': on = !!(t && t.cellIn[L.r][L.c]); break;
        case 'out': on = !!(t && t.cellOut[L.r][L.c]); break;
        case 'lk': on = !!(t && t.nodes[L.c] && t.nodes[L.c][L.r]); break;
        case 'cl': if (engine) { const b = engine.bit(L.cell.addr); on = L.cell.type === 'NC' ? !b : b; } break;
        case 'ab': on = !!(engine && L.cell.addr && engine.bit(L.cell.addr)); break;
        case 'bx': {
          if (!engine) break;
          const c = L.cell;
          if (c.type === 'CMP') on = engine.compare(engine.numeric(c.addr), c.op, Number(c.value) || 0);
          else on = engine.bit(c.addr);
          if (c.type === 'TON' || c.type === 'TOF') {
            const tm = engine.T[c.addr];
            L.el.classList.toggle('run', !!(tm && tm.et > 0 && tm.et < tm.pt && (c.type === 'TON' ? tm.in : !tm.in && tm.q)));
          }
          break;
        }
        case 'tx': {
          const c = L.cell;
          let txt = '';
          if (c.type === 'TON' || c.type === 'TOF') txt = 'ET ' + fmtSec(engine && engine.T[c.addr] ? engine.T[c.addr].et : 0);
          else if (c.type === 'CTU' || c.type === 'CTD') txt = 'CV ' + (engine && engine.C[c.addr] ? engine.C[c.addr].cv : (c.type === 'CTD' ? c.pv : 0));
          else if (c.type === 'CMP') txt = engine ? '= ' + (Math.round(engine.numeric(c.addr) * 10) / 10) : '';
          if (L.el.textContent !== txt) L.el.textContent = txt;
          continue;
        }
        case 'pb': {
          const tm = engine && engine.T[L.cell.addr];
          const f = tm && tm.pt > 0 ? tm.et / tm.pt : 0;
          L.el.setAttribute('width', (72 * f).toFixed(1));
          continue;
        }
      }
      if (L.el.classList.contains('on') !== on) L.el.classList.toggle('on', on);
    }
  };

  PLC.LadderEditor = LadderEditor;
  PLC.TOOL_ORDER = TOOL_ORDER;
  PLC.toolIcon = toolIcon;
  PLC.esc = esc;
})(typeof window !== 'undefined' ? window : globalThis);
