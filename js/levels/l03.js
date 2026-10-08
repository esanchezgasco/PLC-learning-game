/* NIVEL 3 — Auto-retención */
(function () {
  'use strict';
  const H = PLC.H;
  const startStop = 'NO(I0.0) NC(I0.1) OUT(Q0.0)\nNO(Q0.0) |';

  function startStopTests(out) {
    return [
      { name: 'START arranca', steps: [{ press: 'START' }, { expect: (function () { const o = {}; o[out] = 1; return o; })(), fail: { title: 'No arranca al pulsar START.', why: 'Al pulsar START, la corriente debe llegar hasta la bobina ' + out + '.', hint: 'START debe ser un contacto NO y STOP un contacto NC, en serie con la bobina.' } }, { release: 'START' }] },
      { name: 'Sigue en marcha al soltar START', steps: [{ pulse: 'START' }, { wait: 1000 }, { expect: (function () { const o = {}; o[out] = 1; return o; })(), fail: { title: 'El motor no permanece encendido.', why: 'El contacto de START solamente está activo mientras mantienes pulsado el botón. Cuando lo sueltas, la corriente deja de llegar a la bobina.', hint: 'Necesitas una auto-retención: un contacto NO de la propia salida en paralelo con START, unido a la línea principal con ●.' } }] },
      { name: 'STOP lo detiene', steps: [{ pulse: 'START' }, { wait: 500 }, { pulse: 'STOP' }, { wait: 200 }, { expect: (function () { const o = {}; o[out] = 0; return o; })(), fail: { title: 'No se para al pulsar STOP.', why: 'STOP debe cortar la corriente de TODO el segmento, también la que llega por la rama de auto-retención.', hint: 'Coloca STOP (NC) en serie DESPUÉS de la unión del paralelo, no dentro de la rama de START.' } }, { wait: 1000 }, { expect: (function () { const o = {}; o[out] = 0; return o; })(), fail: { title: 'Vuelve a arrancar solo después de STOP.', why: 'Tras soltar STOP, nada debería volver a activar la salida hasta pulsar START.', hint: 'Revisa que la auto-retención pase también por STOP.' } }] },
      { name: 'STOP tiene prioridad sobre START', steps: [{ press: 'STOP' }, { pulse: 'START' }, { expect: (function () { const o = {}; o[out] = 0; return o; })(), fail: { title: 'Arranca aunque STOP está pulsado.', why: 'Por seguridad, si se pulsan START y STOP a la vez, debe ganar STOP.', hint: 'STOP (NC) en serie con todo el segmento.' } }] }
    ];
  }

  PLC.registerLevel({
    id: 3,
    icon: '🔁',
    title: 'Auto-retención',
    short: 'Memoria, auto-retención, START/STOP, SET y RESET',
    tools: ['SET', 'RST'],
    stages: [
      {
        type: 'intro', title: 'El problema del pulsador',
        html: '<p>Los pulsadores industriales son <b>momentáneos</b>: solo dan señal mientras los mantienes pulsados. Si al soltar START el motor se apagara, el operario tendría que quedarse todo el día con el dedo en el botón.</p>' +
          '<p>Necesitamos que el PLC <b>recuerde</b> que se pulsó START. En este nivel aprenderás a darle <b>memoria</b>.</p>' +
          PLC.art.flow([{ icon: 'button', label: 'START', sub: 'un instante' }, { icon: 'plc', label: 'PLC', sub: 'lo recuerda' }, { icon: 'motor', label: 'Motor', sub: 'sigue girando' }])
      },
      {
        type: 'concept', title: 'Memoria',
        html: '<p>Para recordar algo, el PLC usa <b>memorias internas</b> (también llamadas <b>marcas</b>): bits como <code>M0.0</code>, <code>M0.1</code>… que no están conectados a nada físico.</p><p>Se usan igual que una salida: puedes escribirlas con una bobina y leerlas con contactos. Una salida <code>Q</code> también “recuerda” su último valor y se puede leer con un contacto.</p>',
        visual: '<div class="mini-table"><div><code>M0.0</code> → memoria interna (no se ve fuera)</div><div><code>Q0.0</code> → salida (mueve algo real)</div></div>',
        quiz: { q: '¿Dónde está conectada físicamente la memoria M0.0?', options: ['En ningún sitio: es un bit interno del PLC', 'A un pulsador', 'A un motor'], answer: 0, explain: 'Las marcas M son variables internas: sirven para recordar estados dentro del programa.' }
      },
      {
        type: 'concept', title: 'Auto-retención',
        html: '<p>El truco más famoso de la automatización: poner un contacto de la <b>propia salida</b> en <b>paralelo</b> con START.</p><ol><li>Pulsas START → la corriente llega a la bobina MOTOR.</li><li>El contacto MOTOR (abajo) se cierra.</li><li>Sueltas START → la corriente sigue llegando… ¡por la rama del MOTOR!</li></ol><p>La salida se “sujeta” a sí misma: es una <b>auto-retención</b>.</p>',
        demo: { io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red')], [H.motor('Q0.0', 'MOTOR')]), program: H.P(H.R(startStop)), prompt: 'Pulsa START un instante y suéltalo: mira cómo la corriente pasa ahora por la rama de abajo.' }
      },
      {
        type: 'concept', title: 'START / STOP',
        html: '<p>Para poder parar, se añade <b>STOP</b> como contacto <b>NC</b> en serie, <b>después</b> de la unión del paralelo. Al pulsar STOP se corta todo y la auto-retención “se suelta”.</p><p>Si pulsas los dos a la vez, gana STOP: es lo seguro.</p>',
        quiz: { q: 'En un circuito START/STOP, ¿dónde va el contacto NC de STOP?', options: ['En serie, después de la unión del paralelo (START || MOTOR)', 'En paralelo con START', 'Dentro de la rama de auto-retención solamente'], answer: 0, explain: 'Así STOP corta tanto la corriente de START como la de la auto-retención.' }
      },
      {
        type: 'concept', title: 'Bobinas SET y RESET',
        html: '<p>Otra forma de recordar: las bobinas <b>SET</b> <code>(S)</code> y <b>RESET</b> <code>(R)</code>.</p><ul><li><code>(S)</code>: si le llega corriente, pone su dirección a 1… y <b>se queda a 1</b> aunque la corriente desaparezca.</li><li><code>(R)</code>: si le llega corriente, la pone a 0.</li></ul><p>Si en el mismo ciclo se activan las dos, gana la que está <b>más abajo</b> en el programa (se ejecuta la última).</p>',
        demo: { io: H.io([H.btn('I0.0', 'ENCENDER'), H.btn('I0.1', 'APAGAR', 'red')], [H.lamp('Q0.0', 'LUZ')]), program: H.P(H.R('NO(I0.0) S(Q0.0)'), H.R('NO(I0.1) R(Q0.0)')), prompt: 'Pulsa ENCENDER un instante: la luz se queda encendida. APAGAR la resetea.' }
      },
      {
        type: 'example', title: 'Ejemplo: motor con marcha y paro',
        html: '<p>El circuito clásico START/STOP con auto-retención.</p><ol><li>Ejecuta el PLC.</li><li>Pulsa START un instante: el motor arranca y <b>sigue</b> al soltar.</li><li>Pulsa STOP: se para.</li></ol><p>Observa por qué rama circula la corriente en cada momento.</p>',
        io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red')], [H.motor('Q0.0', 'MOTOR')]),
        program: H.P(H.R('# Marcha/paro con auto-retención\n' + startStop))
      },
      {
        type: 'guided', title: 'Construye un START / STOP',
        html: '<p>Construye tú el circuito de marcha y paro del motor. Sigue los pasos: las celdas que tienes que usar parpadean.</p>',
        io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red')], [H.motor('Q0.0', 'MOTOR')]),
        steps: [
          { text: 'Contacto <b>NO</b> con <code>START</code> en la primera celda.', check: H.has({ type: 'NO', addr: 'I0.0' }), target: { ri: 0, r: 0, c: 0 } },
          { text: 'Contacto <b>NC</b> con <code>STOP</code> en la segunda celda.', check: H.has({ type: 'NC', addr: 'I0.1' }), target: { ri: 0, r: 0, c: 1 } },
          { text: '<b>Bobina</b> <code>MOTOR</code> en la última columna.', check: H.has({ type: 'OUT', addr: 'Q0.0' }), target: { ri: 0, r: 0, c: 7 } },
          { text: 'Pulsa <b>＋ Rama</b> y coloca un contacto <b>NO</b> con <code>MOTOR (Q0.0)</code> en la primera celda de la fila nueva.', check: function (p) { return p.rungs.some(function (rg) { return rg.rows > 1 && rg.cells[1][0] && rg.cells[1][0].type === 'NO' && rg.cells[1][0].addr === 'Q0.0'; }); }, target: { ri: 0, r: 1, c: 0 } },
          { text: 'Haz clic en el punto <b>●</b> entre las filas, justo a la derecha del contacto MOTOR, para unir la rama (antes de STOP).', check: function (p) { return p.rungs.some(function (rg) { return rg.rows > 1 && rg.links[1][1]; }); } },
          { text: 'Ejecuta y prueba: START un instante… ¡el motor sigue girando!', live: function (c) { return !!c.world.outputs['Q0.0'] && !c.world.user['I0.0']; } }
        ],
        tests: startStopTests('MOTOR'),
        hints: ['El motor debe seguir encendido aunque sueltes START.', 'Necesitas una <b>auto-retención</b>: un contacto del propio MOTOR en paralelo con START.', { text: 'Así queda el circuito:', program: H.P(H.R(startStop)) }],
        solution: H.P(H.R(startStop)),
        success: '<p>¡Has construido el circuito más usado de la industria! Cuando sueltas START, la corriente llega a la bobina por el contacto del propio MOTOR.</p>'
      },
      {
        type: 'challenge', title: 'RETO: la bomba no se queda encendida',
        html: '<p class="challenge-tag">🐞 RETO DE DIAGNÓSTICO</p><p>Un compañero ha programado el arranque de una bomba de agua, pero el operario se queja:</p><blockquote>«La bomba arranca, pero en cuanto suelto START se apaga.»</blockquote><p><b>Encuentra el problema y arréglalo.</b> Ejecuta el programa y observa bien por dónde circula la corriente.</p>',
        io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red')], [H.pump('Q0.0', 'BOMBA')]),
        initial: H.P(H.R('# Marcha/paro de la bomba\nNO(I0.0) NC(I0.1) OUT(Q0.0)\nNO(Q0.0)')),
        tests: startStopTests('BOMBA'),
        hints: ['Ejecuta el programa con la bomba encendida y mira la rama de abajo: ¿la corriente sale de ella hacia la derecha?', 'Una rama en paralelo solo sirve si está <b>unida</b> con la fila de arriba.', 'Haz clic en el punto ● entre las dos filas, a la derecha del contacto BOMBA (Q0.0).'],
        solution: H.P(H.R('# Marcha/paro de la bomba\n' + startStop)),
        success: '<p>Bien visto: la rama de auto-retención estaba “al aire”, sin unir. Un fallo muy típico en la vida real.</p>'
      },
      {
        type: 'free', title: 'SET y RESET: alarma de puerta',
        html: '<p>Cuando el <b>SENSOR_PUERTA</b> detecte que se abre la puerta, aunque sea un instante, la <b>ALARMA</b> debe encenderse y <b>quedarse encendida</b> hasta que alguien pulse <b>RECONOCER</b>.</p><p>Esta vez usa las bobinas <b>SET</b> y <b>RESET</b>.</p>',
        io: H.io([H.sens('I0.0', 'SENSOR_PUERTA'), H.btn('I0.1', 'RECONOCER', 'blue')], [H.lamp('Q0.0', 'ALARMA', 'red')]),
        requires: [{ check: function (p, F) { return F.has(p, { type: 'SET' }) && F.has(p, { type: 'RST' }); }, fail: { title: 'Este ejercicio es para practicar SET y RESET.', why: 'La auto-retención también funcionaría, pero aquí queremos que uses las bobinas (S) y (R).', hint: 'Usa (S) ALARMA con el sensor y (R) ALARMA con RECONOCER.' } }],
        tests: [
          { name: 'La puerta se abre un instante → alarma', steps: [{ pulse: 'SENSOR_PUERTA', ms: 300 }, { expect: { ALARMA: 1 }, fail: { title: 'La alarma no se enciende al abrir la puerta.', why: 'Cuando SENSOR_PUERTA vale 1, debe llegar corriente a una bobina SET de la ALARMA.', hint: 'Segmento: SENSOR_PUERTA (NO) → (S) ALARMA.' } }, { wait: 2000 }, { expect: { ALARMA: 1 }, fail: { title: 'La alarma se apaga sola.', why: 'Una bobina normal se apaga cuando deja de llegar corriente. La SET, en cambio, mantiene el 1.', hint: 'Usa (S) en lugar de ( ).' } }] },
          { name: 'RECONOCER apaga la alarma', steps: [{ pulse: 'SENSOR_PUERTA', ms: 300 }, { pulse: 'RECONOCER' }, { expect: { ALARMA: 0 }, fail: { title: 'RECONOCER no apaga la alarma.', why: 'RECONOCER debe activar una bobina RESET con la dirección de la ALARMA.', hint: 'Segmento: RECONOCER (NO) → (R) ALARMA (Q0.0).' } }, { wait: 500 }, { expect: { ALARMA: 0 } }] }
        ],
        hints: ['La alarma debe “recordar” que la puerta se abrió.', 'Una bobina <b>(S)</b> mantiene su dirección a 1; una <b>(R)</b> la devuelve a 0.', { text: 'Dos segmentos:', program: H.P(H.R('NO(I0.0) S(Q0.0)'), H.R('NO(I0.1) R(Q0.0)')) }],
        solution: H.P(H.R('# Puerta abierta → activar alarma\nNO(I0.0) S(Q0.0)'), H.R('# Reconocer → apagar alarma\nNO(I0.1) R(Q0.0)')),
        success: '<p>Las bobinas SET/RESET son muy cómodas para alarmas, avisos y, más adelante, para las etapas de una secuencia.</p>'
      },
      {
        type: 'test', title: 'Prueba final: cinta con luces piloto',
        html: '<p>Programa una cinta transportadora con su cuadro de mando:</p><ul class="goals"><li><b>START</b> arranca la <b>CINTA</b> y <b>sigue</b> al soltarlo.</li><li><b>STOP</b> la para (y tiene prioridad).</li><li><b>LUZ_VERDE</b> encendida mientras la cinta está en marcha.</li><li><b>LUZ_ROJA</b> encendida mientras la cinta está parada.</li></ul>',
        io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red')], [H.motor('Q0.0', 'CINTA'), H.lamp('Q0.1', 'LUZ_VERDE', 'green'), H.lamp('Q0.2', 'LUZ_ROJA', 'red')]),
        tests: [
          { name: 'Al inicio: parada, luz roja', steps: [{ wait: 100 }, { expect: { CINTA: 0, LUZ_VERDE: 0 } }, { expect: { LUZ_ROJA: 1 }, fail: { title: 'La LUZ_ROJA no está encendida con la cinta parada.', why: 'La luz roja debe indicar "cinta parada": es lo contrario de la cinta.', hint: 'Usa un contacto NC de CINTA (Q0.0) hacia la bobina LUZ_ROJA.' } }] },
          { name: 'START: en marcha, luz verde', steps: [{ pulse: 'START' }, { wait: 1000 }, { expect: { CINTA: 1 }, fail: { title: 'La cinta no permanece en marcha tras soltar START.', why: 'START solo dura un instante: la cinta necesita una auto-retención.', hint: 'Contacto NO de CINTA en paralelo con START.' } }, { expect: { LUZ_VERDE: 1, LUZ_ROJA: 0 }, fail: { title: 'Las luces piloto no indican "en marcha".', why: 'Con la cinta en marcha: verde encendida, roja apagada.', hint: 'LUZ_VERDE con contacto NO de CINTA; LUZ_ROJA con contacto NC de CINTA.' } }] },
          { name: 'STOP: parada, luz roja', steps: [{ pulse: 'START' }, { wait: 300 }, { pulse: 'STOP' }, { wait: 300 }, { expect: { CINTA: 0, LUZ_VERDE: 0, LUZ_ROJA: 1 } }] },
          { name: 'STOP tiene prioridad', steps: [{ press: 'STOP' }, { pulse: 'START' }, { expect: { CINTA: 0 }, fail: { title: 'La cinta arranca con STOP pulsado.', why: 'STOP debe ganar siempre.', hint: 'STOP (NC) en serie con todo el segmento de la cinta.' } }] }
        ],
        hints: ['Son tres segmentos: CINTA, LUZ_VERDE y LUZ_ROJA.', 'La cinta es un START/STOP con auto-retención. Las luces dependen del estado de la cinta (contactos de Q0.0).', { text: 'Solución completa:', program: H.P(H.R(startStop), H.R('NO(Q0.0) OUT(Q0.1)'), H.R('NC(Q0.0) OUT(Q0.2)')) }],
        solution: H.P(H.R('# Cinta: marcha/paro\n' + startStop), H.R('# Piloto verde: en marcha\nNO(Q0.0) OUT(Q0.1)'), H.R('# Piloto rojo: parada\nNC(Q0.0) OUT(Q0.2)')),
        success: '<p>¡Nivel 3 superado! Ya sabes dar memoria al PLC. Fíjate en que las luces leen el estado de la salida Q0.0 con contactos: <b>una salida también se puede leer</b>.</p>'
      }
    ]
  });
})();
