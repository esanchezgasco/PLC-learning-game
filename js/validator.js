/* =========================================================================
 * PLC Academy — Corrector automático de ejercicios
 * Ejecuta el programa del jugador en un PLC virtual "sin pantalla", con
 * tiempo simulado, y comprueba su comportamiento con pruebas escritas en
 * cada nivel. Cuando algo falla devuelve una explicación tipo profesor.
 *
 * Pasos disponibles en una prueba:
 *   { press: 'START' } { release: 'START' } { set: { START: 1 } }
 *   { pulse: 'START', ms: 200 }   pulsar y soltar
 *   { wait: 1500 }                esperar (ms)
 *   { expect: { MOTOR: 1 }, fail } comprobar ahora
 *   { during: { MOTOR: 0 }, ms: 2000, fail }  debe mantenerse todo el rato
 *   { until: { MOTOR: 1 }, timeout: 4000, fail }  esperar a que ocurra
 *   { spawn: 'metal' }            añadir pieza en la cinta
 *   { do: ctx => ... }            modificar la escena
 *   { check: ctx => bool, fail }  comprobación libre
 * Nota: press/release/set indican la actuación física (pulsado/no pulsado);
 * para entradas cableadas NC la señal en el PLC es la contraria.
 * ========================================================================= */
(function (root) {
  'use strict';
  const PLC = (root.PLC = root.PLC || {});
  const DT = 20;
  const SETTLE = 3;
  const MAX_TIME = 180000;

  function resolver(io) {
    const lists = [io.inputs || [], io.outputs || [], io.memories || [], io.timers || [], io.counters || []];
    return function (key) {
      if (/^[IQM]\d+\.\d$/.test(key) || /^[TC]\d+$/.test(key)) return key;
      for (let i = 0; i < lists.length; i++) {
        const d = lists[i].find(function (x) { return x.name === key; });
        if (d) return d.addr;
      }
      throw new Error('Nombre desconocido en la prueba: ' + key);
    };
  }

  function stateWord(addr, v) {
    const a = addr[0];
    if (a === 'Q') return v ? 'ENCENDIDA (1)' : 'APAGADA (0)';
    return v ? 'ACTIVADA (1)' : 'DESACTIVADA (0)';
  }

  function Abort(fail) { this.fail = fail; }

  function runTest(test, ex, prog) {
    const io = ex.io;
    const R = resolver(io);
    const engine = new PLC.Engine();
    const world = new PLC.World(io, ex.scene);
    let t = 0;
    const ctx = {
      engine: engine, world: world, scene: world.scene,
      q: function (k) { const a = R(k); return a[0] === 'I' ? !!world.readInputs()[a] : engine.bit(a); },
      cv: function (a) { return engine.C[a] ? engine.C[a].cv : 0; },
      time: function () { return t; }
    };
    if (test.setup) test.setup(ctx);
    const invariants = (ex.invariants || []).concat(test.invariants || []);

    function tick() {
      world.update(DT);
      const out = engine.scan(prog, world.readInputs(), DT);
      world.applyOutputs(out);
      t += DT;
      if (t > MAX_TIME) throw new Abort({ title: 'La prueba ha durado demasiado.', why: '', hint: '' });
      for (let i = 0; i < invariants.length; i++) {
        if (!invariants[i].check(ctx)) throw new Abort(invariants[i].fail);
      }
    }
    function ticks(n) { for (let i = 0; i < n; i++) tick(); }
    function waitMs(ms) { ticks(Math.max(1, Math.round(ms / DT))); }
    function actuate(key, v) {
      const a = R(key);
      world.user[a] = !!v;
    }
    function mismatch(state) {
      const keys = Object.keys(state);
      for (let i = 0; i < keys.length; i++) {
        const a = R(keys[i]);
        const want = !!state[keys[i]];
        const got = a[0] === 'I' ? !!world.readInputs()[a] : engine.bit(a);
        if (want !== got) return { key: keys[i], addr: a, want: want, got: got };
      }
      return null;
    }
    function failFor(step, mm) {
      let f = step.fail;
      if (typeof f === 'function') f = f(ctx, mm);
      f = Object.assign({}, f || {});
      if (!f.title && mm) {
        const name = PLC.symbolName(io, mm.addr);
        f.title = (name ? name + ' (' + mm.addr + ')' : mm.addr) + ' debería estar ' + stateWord(mm.addr, mm.want) + ', pero está ' + stateWord(mm.addr, mm.got) + '.';
      }
      if (!f.title) f.title = 'El comportamiento no es el esperado.';
      if (f.why === undefined) f.why = test.why || '';
      if (f.hint === undefined) f.hint = test.hint || '';
      f.at = (t / 1000).toFixed(1);
      return f;
    }

    tick();
    const steps = test.steps || [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.press) { actuate(s.press, 1); ticks(SETTLE); }
      else if (s.release) { actuate(s.release, 0); ticks(SETTLE); }
      else if (s.set) { Object.keys(s.set).forEach(function (k) { actuate(k, s.set[k]); }); ticks(SETTLE); }
      else if (s.pulse) { actuate(s.pulse, 1); waitMs(s.ms || 200); actuate(s.pulse, 0); ticks(SETTLE); }
      else if (s.wait !== undefined) { waitMs(s.wait); }
      else if (s.spawn) { world.scene.spawn(s.spawn); ticks(1); }
      else if (s.do) { s.do(ctx); ticks(1); }
      else if (s.expect) { const mm = mismatch(s.expect); if (mm) throw new Abort(failFor(s, mm)); }
      else if (s.during) {
        const n = Math.max(1, Math.round(s.ms / DT));
        for (let k = 0; k < n; k++) {
          const mm = mismatch(s.during);
          if (mm) throw new Abort(failFor(s, mm));
          tick();
        }
      } else if (s.until) {
        const n = Math.max(1, Math.round((s.timeout || 5000) / DT));
        let ok = false;
        for (let k = 0; k < n; k++) {
          if (!mismatch(s.until)) { ok = true; break; }
          tick();
        }
        if (ok) ticks(2); // dejar que el resto del programa reaccione (siguiente ciclo)
        if (!ok) {
          const mm = mismatch(s.until);
          const f = failFor(s, mm);
          if (!s.fail || !s.fail.title) {
            const name = PLC.symbolName(io, mm.addr);
            f.title = (name ? name + ' (' + mm.addr + ')' : mm.addr) + ' nunca llegó a estar ' + stateWord(mm.addr, mm.want) + '.';
          }
          throw new Abort(f);
        }
      } else if (s.check) {
        if (!s.check(ctx)) throw new Abort(failFor(s, null));
      }
    }
  }

  /* Salidas que las pruebas esperan ver encendidas */
  function expectedOn(ex) {
    const R = resolver(ex.io);
    const set = {};
    (ex.tests || []).forEach(function (t) {
      (t.steps || []).forEach(function (s) {
        [s.expect, s.during, s.until].forEach(function (st) {
          if (!st) return;
          Object.keys(st).forEach(function (k) { if (st[k]) { const a = R(k); if (a[0] === 'Q' || a[0] === 'M') set[a] = true; } });
        });
      });
    });
    return Object.keys(set);
  }

  function run(ex, prog) {
    const io = ex.io;
    const warnings = PLC.diagnose(prog, io);
    const result = { ok: false, passed: [], failedTest: null, fail: null, warnings: warnings };

    // 1) ¿Hay bobinas para las salidas que deben encenderse?
    const written = {};
    PLC.find.cells(prog, { type: ['OUT', 'SET'] }).forEach(function (x) { written[x.cell.addr] = true; });
    const missing = expectedOn(ex).filter(function (a) { return a[0] === 'Q' && !written[a]; });
    if (missing.length) {
      const a = missing[0];
      const n = PLC.symbolName(io, a);
      result.fail = {
        title: 'Nada en tu programa controla ' + (n ? n + ' (' + a + ')' : a) + '.',
        why: 'Para que el PLC encienda una salida, el programa necesita una bobina (o una bobina SET) con esa dirección. Sin bobina, la salida nunca cambia.',
        hint: 'Añade una bobina ( ) con la dirección ' + a + ' en la última columna de un segmento.'
      };
      return result;
    }

    // 2) Requisitos estáticos propios del ejercicio
    const reqs = ex.requires || [];
    for (let i = 0; i < reqs.length; i++) {
      if (!reqs[i].check(prog, PLC.find)) { result.fail = Object.assign({}, reqs[i].fail); return result; }
    }

    // 3) Pruebas de comportamiento
    const tests = ex.tests || [];
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      try {
        runTest(test, ex, prog);
        result.passed.push(test.name);
      } catch (e) {
        if (e instanceof Abort) {
          result.failedTest = test.name;
          result.fail = e.fail;
          return result;
        }
        throw e;
      }
    }
    result.ok = true;
    return result;
  }

  PLC.Validator = { run: run, runTest: runTest, DT: DT };
})(typeof window !== 'undefined' ? window : globalThis);
