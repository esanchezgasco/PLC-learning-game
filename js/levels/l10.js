/* NIVEL 10 — Reto final: la fábrica completa */
(function () {
  'use strict';
  const H = PLC.H, A = PLC.art;

  const io = H.io(
    [H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red'), H.estop('I0.2', 'SETA'), H.btn('I0.3', 'REARME', 'blue'),
      H.sens('I0.4', 'ENTRADA'), H.sens('I0.5', 'FOTOCELULA'), H.sens('I0.6', 'METAL'), H.sens('I0.7', 'FINAL'), H.sens('I1.0', 'CIL_DENTRO')],
    [H.motor('Q0.0', 'CINTA'), H.valve('Q0.1', 'CILINDRO'), H.lamp('Q0.2', 'LUZ_VERDE', 'green'), H.lamp('Q0.3', 'LUZ_AMBAR', 'amber'), H.lamp('Q0.4', 'LUZ_ROJA', 'red')],
    { memories: [H.mem('M0.0', 'EMERGENCIA'), H.mem('M0.1', 'EN_MARCHA')], timers: [H.mem('T0', 'PARPADEO_ON'), H.mem('T1', 'PARPADEO_OFF')], counters: [H.mem('C0', 'METALICAS'), H.mem('C1', 'PLASTICOS'), H.mem('C2', 'TOTAL')] }
  );
  const scene = { type: 'conveyor', motor: 'Q0.0', types: ['metal', 'plastic'], sensors: [{ addr: 'I0.4', x: 20, kind: 'photo' }, { addr: 'I0.5', x: 420, kind: 'photo' }, { addr: 'I0.6', x: 420, kind: 'inductive' }, { addr: 'I0.7', x: 600, kind: 'photo' }], cylinder: { out: 'Q0.1', x: 420, ret: 'I1.0' }, feeder: true };

  const R = {
    seg: H.R('# 1 · SEGURIDAD: seta pulsada (señal a 0) → EMERGENCIA\nNC(I0.2) S(M0.0)'),
    rearme: H.R('# 1 · Rearme: solo con la seta desenclavada\nNO(I0.3) NO(I0.2) R(M0.0)'),
    marcha: H.R('# 2 · MARCHA / PARO (bloqueado por la emergencia)\nNO(I0.0) NC(I0.1) NC(M0.0) OUT(M0.1)\nNO(M0.1) |'),
    blink0: H.R('# Intermitencia 0,5 s (encendido)\nNO(M0.0) NC(T1) TON(T0,0.5)'),
    blink1: H.R('# Intermitencia 0,5 s (apagado)\nNO(T0) TON(T1,0.5)'),
    cintaSimple: H.R('# 3 · CINTA\nNO(M0.1) OUT(Q0.0)'),
    cinta: H.R('# 3 · CINTA: en marcha, cilindro dentro y sin pieza metálica en la estación\nNO(M0.1) NO(I1.0) NC(I0.5) OUT(Q0.0)\n. . | NC(I0.6) |'),
    cil: H.R('# 3 · CILINDRO: pieza metálica en la estación\nNO(M0.1) NO(I0.5) NO(I0.6) OUT(Q0.1)'),
    c0: H.R('# 4 · CONTAR metálicas\nNO(I0.5) NO(I0.6) CTU(C0,999)'),
    c1: H.R('# 4 · CONTAR plásticos\nNO(I0.7) CTU(C1,999)'),
    c2: H.R('# 4 · CONTAR todas las piezas que entran\nNO(I0.4) CTU(C2,999)'),
    verde: H.R('# 5 · SEÑALIZACIÓN: verde = en marcha\nNO(M0.1) OUT(Q0.2)'),
    ambar: H.R('# 5 · ámbar = pieza metálica identificada\nNO(I0.5) NO(I0.6) OUT(Q0.3)'),
    roja: H.R('# 5 · roja intermitente = emergencia\nNO(M0.0) NC(T0) OUT(Q0.4)')
  };
  const part1 = H.P(R.seg, R.rearme, R.marcha, R.cintaSimple, R.verde, R.blink0, R.blink1, R.roja);
  const part2 = H.P(R.seg, R.rearme, R.marcha, R.cinta, R.cil, R.c0, R.c1, R.verde, R.ambar, R.blink0, R.blink1, R.roja);
  const full = H.P(R.seg, R.rearme, R.marcha, R.cinta, R.cil, R.c0, R.c1, R.c2, R.verde, R.ambar, R.blink0, R.blink1, R.roja);
  const cnt = function (a, n) { return function (c) { return c.cv(a) === n; }; };

  const safetyTests = [
    { name: 'Marcha y paro', steps: [{ pulse: 'START' }, { expect: { CINTA: 1, LUZ_VERDE: 1, LUZ_ROJA: 0 }, fail: { title: 'START no pone la fábrica en marcha (CINTA y LUZ_VERDE).', hint: 'START, NC STOP, NC EMERGENCIA → EN_MARCHA con auto-retención. CINTA y LUZ_VERDE dependen de EN_MARCHA.' } }, { pulse: 'STOP' }, { expect: { CINTA: 0, LUZ_VERDE: 0 }, fail: { title: 'STOP no detiene la fábrica.' } }] },
    { name: 'Emergencia: todo se para y la luz roja parpadea', steps: [
      { pulse: 'START' }, { set: { SETA: 1 } },
      { expect: { CINTA: 0, LUZ_VERDE: 0 }, fail: { title: 'Con la seta pulsada la fábrica no se para.', why: 'La seta está cableada NC: pulsada → I0.2 = 0.', hint: 'NC SETA → (S) EMERGENCIA, y NC EMERGENCIA en el segmento de marcha.' } },
      { until: { LUZ_ROJA: 1 }, timeout: 1200, fail: { title: 'La LUZ_ROJA no se enciende con la emergencia.' } },
      { until: { LUZ_ROJA: 0 }, timeout: 1200, fail: { title: 'La LUZ_ROJA no parpadea.', hint: 'Intermitencia con dos TON de 0,5 s; LUZ_ROJA = EMERGENCIA y NC T0.' } },
      { until: { LUZ_ROJA: 1 }, timeout: 1200, fail: { title: 'La LUZ_ROJA no parpadea de forma continua.' } },
      { set: { SETA: 0 } }, { wait: 1200 }, { pulse: 'START' },
      { expect: { CINTA: 0 }, fail: { title: '¡La fábrica arranca sin rearmar!', why: 'Tras desenclavar la seta hay que pulsar REARME y después START.', hint: 'La EMERGENCIA debe quedar memorizada (SET) hasta el REARME.' } },
      { pulse: 'REARME' }, { during: { LUZ_ROJA: 0 }, ms: 1500, fail: { title: 'La luz roja sigue tras el rearme.' } },
      { pulse: 'START' }, { expect: { CINTA: 1 }, fail: { title: 'Tras rearmar, START no vuelve a poner en marcha la fábrica.' } }
    ] },
    { name: 'No se rearma con la seta pulsada', steps: [{ set: { SETA: 1 } }, { wait: 200 }, { pulse: 'REARME' }, { wait: 200 }, { set: { SETA: 0 } }, { pulse: 'START' }, { expect: { CINTA: 0 }, fail: { title: 'El rearme ha funcionado con la seta todavía pulsada.', hint: 'REARME y SETA (NO, es decir, seta OK) → (R) EMERGENCIA.' } }] }
  ];
  const sortTests = [
    { name: 'Pieza metálica → caja lateral', steps: [
      { pulse: 'START' }, { spawn: 'metal' },
      { until: { CILINDRO: 1 }, timeout: 8000, fail: { title: 'El cilindro no empuja la pieza metálica.', hint: 'CILINDRO = EN_MARCHA · FOTOCELULA · METAL.' } },
      { expect: { CINTA: 0, LUZ_AMBAR: 1 }, fail: { title: 'Con la pieza metálica en la estación, la cinta debe pararse y la LUZ_AMBAR encenderse.' } },
      { until: { CINTA: 1 }, timeout: 3000, fail: { title: 'La cinta no continúa tras expulsar la pieza.', hint: 'La cinta necesita CIL_DENTRO y que no haya pieza metálica en la estación.' } },
      { check: H.bins(1, 0), fail: { title: 'La pieza metálica no ha llegado a la caja lateral.' } }, { check: cnt('C0', 1), fail: { title: 'C0 (METALICAS) no vale 1.' } }
    ] },
    { name: 'Pieza de plástico → caja final', steps: [{ pulse: 'START' }, { spawn: 'plastic' }, { during: { CILINDRO: 0 }, ms: 8500, fail: { title: 'El cilindro empuja una pieza de plástico.' } }, { check: H.bins(0, 1), fail: { title: 'La pieza de plástico no ha llegado a la caja final.' } }, { check: cnt('C1', 1), fail: { title: 'C1 (PLASTICOS) no vale 1.' } }] },
    { name: 'Emergencia con el cilindro fuera', steps: [{ pulse: 'START' }, { spawn: 'metal' }, { until: { CILINDRO: 1 }, timeout: 8000 }, { set: { SETA: 1 } }, { expect: { CILINDRO: 0, CINTA: 0 }, fail: { title: 'Con la emergencia, el cilindro debe retirarse y todo pararse.', hint: 'El cilindro debe depender de EN_MARCHA, que se suelta con la emergencia.' } }] }
  ];

  PLC.registerLevel({
    id: 10,
    icon: '🏆',
    title: 'Reto final: la fábrica completa',
    short: 'Programa una fábrica entera usando todo lo aprendido',
    tools: [],
    stages: [
      {
        type: 'intro', title: 'Tu primera fábrica',
        html: '<p>Ha llegado el momento. La empresa te encarga programar <b>una línea de producción completa</b>. Una cinta recibe piezas y el sistema debe:</p><ol><li><b>Detectar</b> cada pieza que entra.</li><li><b>Identificarla</b> (metálica o plástico).</li><li><b>Transportarla</b>.</li><li><b>Clasificarla</b> (metálicas a la caja lateral).</li><li><b>Contarla</b>.</li><li><b>Detenerse</b> ante una emergencia.</li><li><b>Mostrar alarmas</b>.</li><li><b>Reiniciarse</b> correctamente.</li></ol><p>Lo harás por partes, como los profesionales.</p>'
      },
      {
        type: 'concept', title: 'Organizar un programa grande',
        html: '<p>Un programa industrial se ordena siempre por bloques, de arriba a abajo:</p><ol><li><b>Seguridad</b>: emergencias y rearme.</li><li><b>Modos</b>: marcha, paro…</li><li><b>Proceso</b>: secuencias, cinta, cilindros…</li><li><b>Conteo y datos</b>.</li><li><b>Señalización</b>: luces y alarmas.</li></ol><p>Usa los comentarios de los segmentos para saber dónde está cada cosa.</p>',
        quiz: { q: '¿Qué bloque se programa primero (arriba)?', options: ['La seguridad', 'Las luces', 'Los contadores'], answer: 0, explain: 'La seguridad va primero: así, en el mismo ciclo de scan, todo lo demás ya sabe si hay emergencia.' }
      },
      {
        type: 'concept', title: 'La seguridad tiene prioridad',
        html: '<p>La emergencia debe <b>cortar todo</b>: motores, cilindros… La forma más limpia es que todo el proceso dependa de una memoria <b>EN_MARCHA</b>, y que la EMERGENCIA la suelte.</p><p>Así, con un solo contacto NC de EMERGENCIA en la marcha, toda la fábrica se detiene.</p>',
        quiz: { q: 'Si todo el proceso depende de EN_MARCHA, ¿qué ocurre al activarse la EMERGENCIA?', options: ['EN_MARCHA se suelta y todo se para', 'Solo se para la cinta', 'Nada'], answer: 0, explain: 'Un único punto de control hace que la parada sea total y fiable.' }
      },
      {
        type: 'concept', title: 'Probar por partes',
        html: '<p>Nadie escribe 13 segmentos de golpe y espera que funcionen. Los profesionales <b>prueban cada bloque</b> antes de seguir: primero la seguridad, luego la marcha, luego el proceso…</p><p>Usa <b>▶ EJECUTAR</b> y <b>🔧 DEBUG</b> después de cada paso. Tu programa se guarda y pasa de una parte a la siguiente.</p>',
        quiz: { q: '¿Cuál es la mejor forma de programar algo grande?', options: ['Por partes, probando cada una', 'Todo de golpe y probar al final', 'Copiar sin entender'], answer: 0, explain: 'Probar por partes hace que los errores sean pequeños y fáciles de encontrar.' }
      },
      {
        type: 'example', title: 'Ejemplo: estructura de un programa industrial',
        html: '<p>Así queda organizado un programa real (un depósito con seguridad). Fíjate en los comentarios: <b>1 · SEGURIDAD</b>, <b>2 · MARCHA</b>, <b>3 · PROCESO</b>, <b>4 · SEÑALIZACIÓN</b>.</p><p>Pruébalo: START llena el depósito con histéresis; la SETA lo para todo; tras desenclavarla, REARME y START.</p>',
        io: H.io([H.estop('I0.0', 'SETA'), H.btn('I0.1', 'REARME', 'blue'), H.btn('I0.2', 'START'), H.btn('I0.3', 'STOP', 'red'), H.sens('I0.4', 'NIVEL_BAJO'), H.sens('I0.5', 'NIVEL_ALTO')], [H.pump('Q0.0', 'BOMBA'), H.lamp('Q0.1', 'LUZ_VERDE', 'green'), H.lamp('Q0.2', 'LUZ_ROJA', 'red')], { memories: [H.mem('M0.0', 'EMERGENCIA'), H.mem('M0.1', 'EN_MARCHA')] }),
        scene: { type: 'tank', pump: 'Q0.0', level: 35, consume: true, sensors: [{ addr: 'I0.4', level: 20 }, { addr: 'I0.5', level: 80 }] },
        program: H.P(
          H.R('# 1 · SEGURIDAD: seta pulsada → EMERGENCIA\nNC(I0.0) S(M0.0)'),
          H.R('# 1 · Rearme\nNO(I0.1) NO(I0.0) R(M0.0)'),
          H.R('# 2 · MARCHA / PARO\nNO(I0.2) NC(I0.3) NC(M0.0) OUT(M0.1)\nNO(M0.1) |'),
          H.R('# 3 · PROCESO: bomba con histéresis\nNO(M0.1) NC(I0.4) NC(I0.5) OUT(Q0.0)\n. | NO(Q0.0) |'),
          H.R('# 4 · SEÑALIZACIÓN\nNO(M0.1) OUT(Q0.1)'),
          H.R('NO(M0.0) OUT(Q0.2)')
        )
      },
      {
        type: 'guided', title: 'Parte 1: seguridad, marcha y señalización',
        html: '<p>Empieza por la base de la fábrica. Tienes los segmentos vacíos con sus comentarios: rellénalos.</p><ul class="goals"><li><b>SETA</b> (cableada NC) pulsada → <b>EMERGENCIA</b> (memorizada).</li><li><b>REARME</b> borra la emergencia, solo con la seta desenclavada.</li><li><b>START/STOP</b> → <b>EN_MARCHA</b>, bloqueada por la emergencia.</li><li><b>CINTA</b> y <b>LUZ_VERDE</b> con EN_MARCHA.</li><li><b>LUZ_ROJA</b> parpadeando (0,5 s) durante la emergencia.</li></ul>',
        io: io,
        scene: scene,
        initial: H.P(H.R('# 1 · SEGURIDAD: seta pulsada → EMERGENCIA (M0.0)\n.'), H.R('# 1 · Rearme\n.'), H.R('# 2 · MARCHA / PARO → EN_MARCHA (M0.1)\n.'), H.R('# 3 · CINTA\n.'), H.R('# 5 · SEÑALIZACIÓN\n.')),
        steps: [
          { text: 'Seguridad: contacto <b>NC</b> <code>SETA</code> → <b>(S)</b> <code>EMERGENCIA</code>.', check: H.rungWith([{ type: 'NC', addr: 'I0.2' }, { type: 'SET', addr: 'M0.0' }]), target: { ri: 0, r: 0, c: 0 } },
          { text: 'Rearme: <code>REARME</code> (NO) y <code>SETA</code> (NO = seta OK) → <b>(R)</b> <code>EMERGENCIA</code>.', check: H.rungWith([{ type: 'NO', addr: 'I0.3' }, { type: 'NO', addr: 'I0.2' }, { type: 'RST', addr: 'M0.0' }]), target: { ri: 1, r: 0, c: 0 } },
          { text: 'Marcha: <code>START</code> · NC <code>STOP</code> · NC <code>EMERGENCIA</code> → <code>EN_MARCHA</code>, con auto-retención.', check: function (p, F) { return H.rungWith([{ type: 'NO', addr: 'I0.0' }, { type: 'NC', addr: 'I0.1' }, { type: 'NC', addr: 'M0.0' }, { type: 'OUT', addr: 'M0.1' }])(p) && F.branchWith(p, { type: 'NO', addr: 'M0.1' }); }, target: { ri: 2, r: 0, c: 0 } },
          { text: '<code>EN_MARCHA</code> → <code>CINTA</code>, y otro segmento <code>EN_MARCHA</code> → <code>LUZ_VERDE</code>.', check: function (p, F) { return F.has(p, { type: 'OUT', addr: 'Q0.0' }) && F.has(p, { type: 'OUT', addr: 'Q0.2' }); } },
          { text: 'Intermitencia: <code>EMERGENCIA</code> · NC <code>T1</code> → TON <code>T0</code> 0,5 s; <code>T0</code> → TON <code>T1</code> 0,5 s; <code>EMERGENCIA</code> · NC <code>T0</code> → <code>LUZ_ROJA</code>.', check: function (p, F) { return F.has(p, { type: 'TON', addr: 'T0' }) && F.has(p, { type: 'TON', addr: 'T1' }) && F.has(p, { type: 'OUT', addr: 'Q0.4' }); } },
          { text: 'Prueba: START, pulsa la SETA, desenclávala, REARME y START.', live: function (c) { if (c.engine && c.engine.M['M0.0']) c.memo.em = true; return !!c.memo.em && !!c.engine && !!c.engine.M['M0.1']; } }
        ],
        tests: safetyTests,
        hints: ['La seta está cableada NC: “pulsada” es un 0 → contacto NC para activar la emergencia; “OK” es un 1 → contacto NO para el rearme.', 'Emergencia con (S)/(R). Marcha con auto-retención y NC EMERGENCIA. Parpadeo con dos TON de 0,5 s que se reinician mutuamente.', { text: 'Solución de la parte 1:', program: part1 }],
        solution: part1,
        success: '<p>La base de tu fábrica es segura. Este programa pasa a la parte 2.</p>'
      },
      {
        type: 'free', title: 'Parte 2: clasificación y conteo',
        html: '<p>Continúa con tu programa de la parte 1. Ahora la cinta transporta piezas metálicas y de plástico (usa los botones de la escena o el alimentador automático):</p><ul class="goals"><li>La <b>CINTA</b> se para si hay una pieza <b>metálica</b> en la estación (FOTOCELULA y METAL), y solo se mueve con el cilindro dentro (<b>CIL_DENTRO</b>).</li><li>El <b>CILINDRO</b> empuja las piezas metálicas a la caja lateral.</li><li><b>LUZ_AMBAR</b>: pieza metálica identificada en la estación.</li><li>Cuenta metálicas en <b>C0</b> y plásticos (al pasar por FINAL) en <b>C1</b>.</li><li>La emergencia debe seguir parándolo todo, también el cilindro.</li></ul>',
        io: io,
        scene: scene,
        initial: 'previous',
        tests: sortTests.concat([safetyTests[0]]),
        hints: ['Sustituye el segmento de la CINTA y añade cilindro, luz ámbar y contadores.', 'CINTA = EN_MARCHA · CIL_DENTRO · (NC FOTOCELULA o NC METAL). CILINDRO = EN_MARCHA · FOTOCELULA · METAL.', { text: 'Segmentos nuevos:', program: H.P(R.cinta, R.cil, R.c0, R.c1, R.ambar) }],
        solution: part2,
        success: '<p>¡La fábrica ya clasifica y cuenta! Solo queda la prueba final.</p>'
      },
      {
        type: 'test', title: 'Prueba final: la fábrica completa',
        html: '<p>Último paso. Además de todo lo anterior, la dirección quiere saber <b>cuántas piezas entran</b> en la línea:</p><ul class="goals"><li>Cuenta en <b>C2</b> cada pieza detectada por el sensor <b>ENTRADA</b>.</li></ul><p>Tu programa se someterá a la batería de pruebas completa: producción mixta, emergencias en plena producción, rearme y conteo. ¡Suerte!</p>',
        io: io,
        scene: scene,
        initial: 'previous',
        tests: safetyTests.concat(sortTests, [
          { name: 'Producción mixta y conteo total', steps: [
            { pulse: 'START' }, { spawn: 'metal' }, { wait: 1600 }, { spawn: 'plastic' }, { wait: 1600 }, { spawn: 'metal' }, { wait: 1600 }, { spawn: 'plastic' }, { wait: 14000 },
            { check: H.bins(2, 2), fail: function (c) { return { title: 'Clasificación incorrecta: caja lateral ' + c.scene.binSide + ', caja final ' + c.scene.binEnd + ' (se esperaba 2 y 2).' }; } },
            { check: function (c) { return c.cv('C0') === 2 && c.cv('C1') === 2; }, fail: function (c) { return { title: 'Contadores incorrectos: C0 = ' + c.cv('C0') + ', C1 = ' + c.cv('C1') + ' (se esperaba 2 y 2).' }; } },
            { check: cnt('C2', 4), fail: function (c) { return { title: 'El contador total C2 vale ' + c.cv('C2') + ' y deberían ser 4 piezas.', hint: 'ENTRADA (NO) → CTU C2.' }; } }
          ] },
          { name: 'Emergencia en plena producción y reinicio', steps: [
            { pulse: 'START' }, { spawn: 'plastic' }, { wait: 1600 }, { spawn: 'metal' }, { wait: 2000 },
            { set: { SETA: 1 } }, { expect: { CINTA: 0, CILINDRO: 0 }, fail: { title: 'La emergencia no detiene la producción.' } },
            { wait: 3000 }, { set: { SETA: 0 } }, { wait: 500 }, { pulse: 'REARME' }, { pulse: 'START' },
            { expect: { CINTA: 1 }, fail: { title: 'La fábrica no se reinicia tras rearme + START.' } },
            { wait: 12000 },
            { check: H.bins(1, 1), fail: function (c) { return { title: 'Tras la emergencia las piezas no terminan bien clasificadas (lateral ' + c.scene.binSide + ', final ' + c.scene.binEnd + ').' }; } },
            { check: function (c) { return c.cv('C0') === 1 && c.cv('C1') === 1 && c.cv('C2') === 2; }, fail: { title: 'Los contadores no son correctos después de la emergencia.', why: 'Una emergencia no debe borrar ni duplicar la cuenta de piezas.' } }
          ] }
        ]),
        hints: ['Solo te falta un contador… pero repasa también que todo lo demás siga funcionando.', 'ENTRADA (NO) → CTU C2.', { text: 'Programa completo:', program: full }],
        solution: full,
        success: '<p>🏆 <b>¡ENHORABUENA!</b> Has programado una fábrica completa: detección, identificación, transporte, clasificación, conteo, emergencia, alarmas y rearme. Has pasado de no saber qué era un PLC a pensar como un <b>programador de automatización</b>.</p>'
      }
    ]
  });
})();
