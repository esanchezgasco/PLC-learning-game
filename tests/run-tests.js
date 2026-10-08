/* =========================================================================
 * Pruebas automáticas de PLC Academy (Node, sin dependencias)
 *   node tests/run-tests.js
 * Comprueba:
 *   - el motor del PLC (AND, OR, NOT, auto-retención, TON, TOF, CTU, CTD…)
 *   - que la SOLUCIÓN de cada ejercicio pasa todas sus pruebas
 *   - que el programa INICIAL de cada ejercicio NO las pasa
 *   - que los programas de los retos (con fallos) NO las pasan
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { console: console, Math: Math, Date: Date, JSON: JSON };
ctx.globalThis = ctx;
vm.createContext(ctx);

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/app\.js|sim\.js|editor\.js/.test(s));
// el editor define utilidades (esc) que no usan DOM al cargarse
scripts.splice(scripts.indexOf('js/art.js'), 0, 'js/editor.js');
scripts.forEach((s) => vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s }));
const PLC = ctx.PLC;

let failures = 0, passes = 0;
function ok(cond, msg) {
  if (cond) { passes++; } else { failures++; console.log('  ✗ ' + msg); }
}

/* ------------------------- Motor del PLC ------------------------- */
console.log('Motor del PLC');
function sim(prog, steps) {
  const e = new PLC.Engine();
  const out = [];
  steps.forEach((s) => { e.scan(prog, s.in || {}, s.dt || 20); out.push(Object.assign({}, e.Q, e.M)); });
  return { e, out };
}
{
  const p = PLC.program('NO(I0.0) NO(I0.1) OUT(Q0.0)');
  const r = sim(p, [{ in: { 'I0.0': 1 } }, { in: { 'I0.0': 1, 'I0.1': 1 } }]);
  ok(!r.out[0]['Q0.0'] && r.out[1]['Q0.0'], 'AND');
}
{
  const p = PLC.program('NO(I0.0) OUT(Q0.0)\nNO(I0.1) |');
  const r = sim(p, [{ in: {} }, { in: { 'I0.1': 1 } }, { in: { 'I0.0': 1 } }]);
  ok(!r.out[0]['Q0.0'] && r.out[1]['Q0.0'] && r.out[2]['Q0.0'], 'OR');
}
{
  const p = PLC.program('NO(I0.0) NC(I0.1) OUT(Q0.0)\nNO(Q0.0) |');
  const r = sim(p, [{ in: { 'I0.0': 1 } }, { in: {} }, { in: {} }, { in: { 'I0.1': 1 } }, { in: {} }]);
  ok(r.out[0]['Q0.0'] && r.out[2]['Q0.0'] && !r.out[3]['Q0.0'] && !r.out[4]['Q0.0'], 'auto-retención');
}
{
  const p = PLC.program('NO(I0.0) TON(T0,1) OUT(Q0.0)');
  const steps = []; for (let i = 0; i < 60; i++) steps.push({ in: { 'I0.0': 1 } });
  const r = sim(p, steps);
  ok(!r.out[40]['Q0.0'] && r.out[55]['Q0.0'], 'TON 1 s');
}
{
  const p = PLC.program('NO(I0.0) TOF(T0,1) OUT(Q0.0)');
  const steps = [{ in: { 'I0.0': 1 } }]; for (let i = 0; i < 60; i++) steps.push({ in: {} });
  const r = sim(p, steps);
  ok(r.out[0]['Q0.0'] && r.out[40]['Q0.0'] && !r.out[58]['Q0.0'], 'TOF 1 s');
}
{
  const p = PLC.program('NO(I0.0) CTU(C0,3) OUT(Q0.0)', 'NO(I0.1) R(C0)');
  const st = []; for (let i = 0; i < 3; i++) { st.push({ in: { 'I0.0': 1 } }); st.push({ in: {} }); }
  st.push({ in: { 'I0.1': 1 } }); st.push({ in: {} });
  const r = sim(p, st);
  ok(!r.out[3]['Q0.0'] && r.out[4]['Q0.0'] && !r.out[7]['Q0.0'] && r.e.C.C0.cv === 0, 'CTU + RESET');
}
{
  const p = PLC.program('NO(I0.0) CTD(C0,2) OUT(Q0.0)', 'CMP(C0,<=,1) OUT(Q0.1)');
  const r = sim(p, [{ in: {} }, { in: { 'I0.0': 1 } }, { in: {} }, { in: { 'I0.0': 1 } }]);
  ok(!r.out[0]['Q0.1'] && r.out[1]['Q0.1'] && !r.out[1]['Q0.0'] && r.out[3]['Q0.0'], 'CTD + CMP');
}
{
  const p = PLC.program('NO(I0.0) S(M0.0)', 'NO(I0.1) R(M0.0)');
  const r = sim(p, [{ in: { 'I0.0': 1 } }, { in: {} }, { in: { 'I0.1': 1 } }]);
  ok(r.out[1]['M0.0'] && !r.out[2]['M0.0'], 'SET / RESET');
}
{
  const p = PLC.program('NO(I0.0) OUT(Q0.0)\n|> OUT(Q0.1)');
  const r = sim(p, [{ in: { 'I0.0': 1 } }]);
  ok(r.out[0]['Q0.0'] && r.out[0]['Q0.1'], 'bobinas en paralelo');
}

/* ------------------------- Ejercicios ------------------------- */
const EX_TYPES = ['guided', 'free', 'challenge', 'test'];
PLC.LEVELS.forEach((lvl) => {
  console.log('Nivel ' + lvl.id + ' — ' + lvl.title);
  lvl.stages.forEach((st, i) => {
    if (EX_TYPES.indexOf(st.type) < 0) return;
    const label = '  [' + st.type + '] ' + st.title;
    ok(!!st.solution, label + ': falta la solución');
    if (!st.solution) return;
    let res;
    try { res = PLC.Validator.run(st, st.solution); } catch (e) { ok(false, label + ': error ' + e.stack); return; }
    ok(res.ok, label + ': la solución falla → ' + (res.failedTest || '') + ' · ' + (res.fail && res.fail.title));
    if (res.ok && res.warnings.length) console.log('    ⚠ avisos en la solución: ' + res.warnings.map((w) => w.text).join(' | '));
    let initial = st.initial;
    if (initial === 'previous') {
      const prev = lvl.stages.slice(0, i).reverse().find((s) => EX_TYPES.indexOf(s.type) >= 0);
      initial = prev && prev.solution;
    }
    initial = initial || PLC.emptyProgram();
    const r2 = PLC.Validator.run(st, initial);
    ok(!r2.ok, label + ': el programa inicial ya aprueba (no debería)');
    if (st.type === 'challenge') console.log('    reto · fallo detectado: ' + (r2.fail && r2.fail.title));
    (st.wrong || []).forEach((w, k) => {
      const r3 = PLC.Validator.run(st, w);
      ok(!r3.ok, label + ': la solución incorrecta #' + (k + 1) + ' aprueba');
    });
  });
});

console.log('\n' + passes + ' comprobaciones correctas, ' + failures + ' fallos');
process.exit(failures ? 1 : 0);
