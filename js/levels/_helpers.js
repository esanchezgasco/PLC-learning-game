/* =========================================================================
 * PLC Academy — Ayudantes para escribir niveles
 * ========================================================================= */
(function (root) {
  'use strict';
  const PLC = (root.PLC = root.PLC || {});
  PLC.LEVELS = PLC.LEVELS || [];
  PLC.registerLevel = function (lvl) {
    PLC.LEVELS.push(lvl);
    PLC.LEVELS.sort(function (a, b) { return a.id - b.id; });
  };
  const F = function () { return PLC.find; };
  PLC.H = {
    btn: function (addr, name, color) { return { addr: addr, name: name, kind: 'button', color: color || 'green' }; },
    sw: function (addr, name) { return { addr: addr, name: name, kind: 'switch' }; },
    sens: function (addr, name, desc) { return { addr: addr, name: name, kind: 'sensor', desc: desc }; },
    estop: function (addr, name) { return { addr: addr, name: name, kind: 'estop', wiring: 'NC' }; },
    lamp: function (addr, name, color) { return { addr: addr, name: name, kind: 'lamp', color: color || 'yellow' }; },
    motor: function (addr, name) { return { addr: addr, name: name, kind: 'motor' }; },
    pump: function (addr, name) { return { addr: addr, name: name, kind: 'pump' }; },
    buzzer: function (addr, name) { return { addr: addr, name: name, kind: 'buzzer' }; },
    valve: function (addr, name) { return { addr: addr, name: name, kind: 'valve' }; },
    mem: function (addr, name) { return { addr: addr, name: name }; },
    io: function (inputs, outputs, extra) { return Object.assign({ inputs: inputs, outputs: outputs, memories: [], timers: [], counters: [] }, extra || {}); },
    P: function () { return PLC.program.apply(null, arguments); },
    R: function (t, o) { return PLC.rung(t, o); },
    has: function (pred) { return function (p) { return F().has(p, pred); }; },
    rungWith: function (preds) { return function (p) { return F().rungWith(p, preds); }; },
    repeat: function (n, step) { const a = []; for (let i = 0; i < n; i++) a.push(step); return a; },
    /* ¿Hay una rama con el elemento indicado unida a ambos lados (paralelo)? */
    parallel: function (pred) {
      return function (p) {
        return (p.rungs || []).some(function (rg) {
          for (let r = 1; r < rg.rows; r++) {
            for (let c = 0; c < rg.cols - 1; c++) {
              const cell = rg.cells[r][c];
              if (!cell || cell.type !== pred.type || (pred.addr && cell.addr !== pred.addr)) continue;
              const leftOk = c === 0 || rg.links[r][c];
              let rightOk = false;
              for (let b = c + 1; b < rg.cols; b++) if (rg.links[r][b]) rightOk = true;
              if (leftOk && rightOk) return true;
            }
          }
          return false;
        });
      };
    },
    /* comprobación sobre el número de piezas en las cajas de la cinta */
    bins: function (side, end, extra) {
      return function (ctx) {
        const s = ctx.scene;
        if (s.binSide !== side || s.binEnd !== end) return false;
        if (extra) return extra(ctx);
        return true;
      };
    },
    noBoth: function (a, b, msg) {
      return { check: function (ctx) { return !(ctx.q(a) && ctx.q(b)); }, fail: { title: msg || (a + ' y ' + b + ' se han activado a la vez.'), why: 'Dos órdenes contrarias a la vez pueden romper el motor o la máquina. En automatización esto se evita siempre.', hint: 'Asegúrate de que cada estado/etapa activa solo una de las dos salidas (enclavamiento).' } };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
