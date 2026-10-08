/* NIVEL 4 — Temporizadores */
(function () {
  'use strict';
  const H = PLC.H, A = PLC.art;
  const delayedStart = H.P(
    H.R('# Memoria: se ha pedido la marcha\nNO(I0.0) NC(I0.1) OUT(M0.0)\nNO(M0.0) |'),
    H.R('# Tras 3 s, arranca el motor\nNO(M0.0) TON(T0,3) OUT(Q0.0)')
  );

  PLC.registerLevel({
    id: 4,
    icon: '⏱️',
    title: 'Temporizadores',
    short: 'TON, TOF, tiempo de activación y desactivación',
    tools: ['TON', 'TOF'],
    stages: [
      {
        type: 'intro', title: 'El tiempo también es una condición',
        html: '<p>Una alarma que avisa antes de que arranque una cinta, una luz de escalera que se apaga sola, un secador que sigue un poco más… En la industria, <b>esperar</b> es parte del trabajo.</p><p>Para medir el tiempo, el PLC usa <b>temporizadores</b>.</p>'
      },
      {
        type: 'concept', title: 'Temporización',
        html: '<p>Un <b>temporizador</b> es un bloque que mide el tiempo. Tiene:</p><ul><li><b>IN</b>: su entrada (la corriente que le llega por la izquierda).</li><li><b>PT</b>: el tiempo programado (<i>preset</i>), por ejemplo 3 s.</li><li><b>ET</b>: el tiempo que lleva contado (<i>elapsed</i>).</li><li><b>Q</b>: su salida (deja pasar la corriente hacia la derecha cuando toca).</li></ul><p>Cada temporizador tiene un nombre: <code>T0</code>, <code>T1</code>…</p>',
        quiz: { q: '¿Qué indica PT en un temporizador?', options: ['El tiempo programado (preset)', 'El tiempo que ya ha pasado', 'El número de piezas'], answer: 0, explain: 'PT es el tiempo que tú programas. ET es el tiempo que va contando.' }
      },
      {
        type: 'concept', title: 'TON: tiempo de activación',
        html: '<p><b>TON</b> = retardo a la <b>conexión</b>. Cuando IN se activa, empieza a contar. Si IN sigue activa durante todo el tiempo PT, su salida Q se activa.</p><p>Si IN se apaga antes de tiempo, ET vuelve a 0 y no pasa nada.</p>' +
          A.timing([{ name: 'IN', on: [[1, 2], [3, 8]] }, { name: 'Q', on: [[6, 8]], cls: 'q' }], 9, [{ from: 3, to: 6, label: 'PT = 3 s' }]),
        demo: { io: H.io([H.btn('I0.0', 'PULSADOR')], [H.lamp('Q0.0', 'LAMPARA')]), program: H.P(H.R('NO(I0.0) TON(T0,2) OUT(Q0.0)')), prompt: 'Mantén pulsado 2 segundos. Prueba también a soltar antes: ET vuelve a 0.' }
      },
      {
        type: 'concept', title: 'TOF: tiempo de desactivación',
        html: '<p><b>TOF</b> = retardo a la <b>desconexión</b>. Su salida Q se activa <b>en cuanto</b> IN se activa. Cuando IN se apaga, Q <b>sigue activa</b> durante el tiempo PT y luego se apaga.</p>' +
          A.timing([{ name: 'IN', on: [[1, 3]] }, { name: 'Q', on: [[1, 6]], cls: 'q' }], 9, [{ from: 3, to: 6, label: 'PT = 3 s' }]),
        demo: { io: H.io([H.btn('I0.0', 'PULSADOR')], [H.lamp('Q0.0', 'LAMPARA')]), program: H.P(H.R('NO(I0.0) TOF(T0,3) OUT(Q0.0)')), prompt: 'Pulsa un instante: la lámpara se enciende y se queda 3 s más.' }
      },
      {
        type: 'concept', title: 'Contactos de temporizador',
        html: '<p>Puedes leer un temporizador en cualquier parte del programa con un contacto: <code>─┤ T0 ├─</code> vale 1 cuando la salida Q de T0 está activa.</p><p>Así un mismo temporizador puede controlar varias cosas.</p><p class="tip">Importante: cada temporizador debe aparecer <b>una sola vez</b> como bloque.</p>',
        quiz: { q: 'Tienes un TON T1 de 5 s. ¿Cuándo se cierra un contacto NO de T1?', options: ['Cuando su entrada lleva 5 s activa', 'Nada más activarse su entrada', 'Nunca'], answer: 0, explain: 'El contacto T1 copia la salida Q del temporizador: se activa al cumplirse el tiempo.' }
      },
      {
        type: 'example', title: 'Ejemplo: retardo de arranque',
        html: '<p>Mantén pulsado <b>MARCHA</b>: el bloque TON empieza a contar (mira el valor <b>ET</b> y la barrita bajo el bloque). A los 3 s, el motor arranca.</p><p>Suelta antes de tiempo y verás cómo ET vuelve a cero.</p>',
        io: H.io([H.btn('I0.0', 'MARCHA')], [H.motor('Q0.0', 'MOTOR')]),
        program: H.P(H.R('# Mantener MARCHA 3 s para arrancar\nNO(I0.0) TON(T0,3) OUT(Q0.0)'))
      },
      {
        type: 'guided', title: 'Espera 3 segundos y enciende el motor',
        html: '<p><b>Objetivo:</b> cuando pulses START (aunque sea un instante), el PLC espera <b>3 segundos</b> y enciende el MOTOR. STOP lo detiene todo.</p><p>Como START solo dura un instante, primero guardaremos la orden en una memoria con auto-retención y esa memoria activará el temporizador.</p>',
        io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red')], [H.motor('Q0.0', 'MOTOR')], { memories: [H.mem('M0.0', 'PETICION_MARCHA')] }),
        steps: [
          { text: 'Segmento 1: <code>START</code> (NO) → <code>STOP</code> (NC) → bobina <code>M0.0 — PETICION_MARCHA</code>.', check: H.rungWith([{ type: 'NO', addr: 'I0.0' }, { type: 'NC', addr: 'I0.1' }, { type: 'OUT', addr: 'M0.0' }]), target: { ri: 0, r: 0, c: 0 } },
          { text: 'Auto-retención: ＋ Rama, contacto NO <code>M0.0</code> debajo de START y unión ●.', check: function (p, F) { return F.branchWith(p, { type: 'NO', addr: 'M0.0' }); } },
          { text: 'Pulsa <b>＋ Segmento</b>. Coloca un contacto NO <code>M0.0</code>, luego un bloque <b>TON</b> (T0) con <b>PT = 3</b> s.', check: H.rungWith([{ type: 'NO', addr: 'M0.0' }, { type: 'TON', pt: 3 }]) },
          { text: 'Termina el segmento 2 con la bobina <code>MOTOR</code>.', check: H.rungWith([{ type: 'TON' }, { type: 'OUT', addr: 'Q0.0' }]) },
          { text: 'Ejecuta: pulsa START y mira contar ET hasta 3 s.', live: function (c) { return !!c.world.outputs['Q0.0']; } }
        ],
        tests: [
          { name: 'Espera 3 s antes de arrancar', steps: [{ pulse: 'START' }, { during: { MOTOR: 0 }, ms: 2400, fail: { title: 'El motor arranca demasiado pronto.', why: 'Debe esperar 3 segundos desde que se pulsa START.', hint: 'El motor debe ir DESPUÉS del bloque TON, y el TON con PT = 3 s.' } }, { until: { MOTOR: 1 }, timeout: 1000, fail: { title: 'El motor nunca arranca.', why: 'START solo está activo un instante. Si el temporizador depende directamente de START, se reinicia al soltarlo y nunca llega a 3 s.', hint: 'Guarda la orden en la memoria M0.0 con auto-retención y usa M0.0 como entrada del TON.' } }] },
          { name: 'Sigue en marcha', steps: [{ pulse: 'START' }, { wait: 6000 }, { expect: { MOTOR: 1 }, fail: { title: 'El motor no se mantiene en marcha.', why: 'Una vez pasados los 3 s, el motor debe seguir encendido hasta pulsar STOP.', hint: 'La memoria M0.0 debe tener auto-retención.' } }] },
          { name: 'STOP lo detiene todo', steps: [{ pulse: 'START' }, { wait: 4000 }, { pulse: 'STOP' }, { expect: { MOTOR: 0 }, fail: { title: 'STOP no para el motor.', why: 'Al pulsar STOP se suelta la memoria; el TON pierde su entrada, se reinicia y su salida se apaga.', hint: 'STOP (NC) en serie en el segmento de la memoria M0.0.' } }, { wait: 4000 }, { expect: { MOTOR: 0 } }] }
        ],
        hints: ['Recuerda que el motor debe arrancar aunque hayas soltado START hace rato.', 'Necesitas una <b>memoria con auto-retención</b> (M0.0) y un temporizador <b>TON</b> de 3 s.', { text: 'Dos segmentos:', program: delayedStart }],
        solution: delayedStart,
        success: '<p>Has combinado <b>memoria + temporizador</b>. Esta es la estructura de muchos arranques industriales con preaviso.</p>'
      },
      {
        type: 'free', title: 'Enciende la luz durante 5 segundos',
        html: '<p>Una luz de escalera: cuando pulses el <b>PULSADOR</b>, la <b>LUZ_ESCALERA</b> se enciende al momento y se apaga sola unos <b>5 segundos</b> después.</p>',
        io: H.io([H.btn('I0.0', 'PULSADOR')], [H.lamp('Q0.0', 'LUZ_ESCALERA')]),
        tests: [
          { name: 'Se enciende al pulsar', steps: [{ pulse: 'PULSADOR' }, { expect: { LUZ_ESCALERA: 1 }, fail: { title: 'La luz no se enciende al pulsar.', why: 'Debe encenderse en cuanto pulsas, sin esperar.', hint: 'El TON retrasa el encendido; el TOF lo enciende al momento y retrasa el apagado.' } }] },
          { name: 'Sigue encendida unos segundos', steps: [{ pulse: 'PULSADOR' }, { wait: 3800 }, { expect: { LUZ_ESCALERA: 1 }, fail: { title: 'La luz se apaga demasiado pronto.', why: 'Tiene que durar unos 5 segundos.', hint: 'Revisa el tiempo PT del temporizador (5 s).' } }] },
          { name: 'Se apaga sola', steps: [{ pulse: 'PULSADOR' }, { wait: 5600 }, { expect: { LUZ_ESCALERA: 0 }, fail: { title: 'La luz no se apaga sola (o tarda demasiado).', why: 'Pasados unos 5 segundos debe apagarse sin que nadie haga nada.', hint: 'Usa un TOF de 5 s: mantiene la salida activa PT segundos después de soltar.' } }] }
        ],
        hints: ['La luz se enciende <i>al instante</i>, pero se apaga <i>con retraso</i>.', 'El temporizador con retardo a la <b>desconexión</b> es el <b>TOF</b>.', { text: 'Un solo segmento:', program: H.P(H.R('NO(I0.0) TOF(T0,5) OUT(Q0.0)')) }],
        solution: H.P(H.R('# Luz de escalera\nNO(I0.0) TOF(T0,5) OUT(Q0.0)')),
        success: '<p>¡Exacto! El TOF es perfecto para “mantener un rato más”: luces, ventiladores, secadores…</p>'
      },
      {
        type: 'test', title: 'Prueba final: secador de manos',
        html: '<p>Programa un secador de manos automático:</p><ul class="goals"><li>Cuando el sensor detecta <b>MANOS</b>, el <b>SECADOR</b> se enciende.</li><li>Al retirar las manos, el secador sigue <b>3 s</b> más y se apaga.</li><li>Si las manos están más de <b>10 s seguidos</b>, se enciende la luz de <b>AVISO</b> (posible objeto atascado). Se apaga al retirarlas.</li></ul>',
        io: H.io([H.sens('I0.0', 'MANOS')], [H.motor('Q0.0', 'SECADOR'), H.lamp('Q0.1', 'AVISO', 'amber')]),
        tests: [
          { name: 'Secador con retardo de 3 s', steps: [{ set: { MANOS: 1 } }, { expect: { SECADOR: 1 }, fail: { title: 'El secador no se enciende al detectar las manos.', why: 'Debe encenderse al momento.', hint: 'Un TOF activa su salida en cuanto su entrada se activa.' } }, { set: { MANOS: 0 } }, { wait: 2500 }, { expect: { SECADOR: 1 }, fail: { title: 'El secador se para demasiado pronto.', why: 'Debe seguir 3 segundos después de retirar las manos.', hint: 'TOF con PT = 3 s.' } }, { wait: 1000 }, { expect: { SECADOR: 0 }, fail: { title: 'El secador no se apaga a los 3 s.', why: '', hint: 'Revisa el PT del TOF.' } }] },
          { name: 'Aviso a los 10 s', steps: [{ set: { MANOS: 1 } }, { during: { AVISO: 0 }, ms: 9400, fail: { title: 'El AVISO se enciende antes de 10 s.', why: '', hint: 'TON con PT = 10 s para el aviso.' } }, { until: { AVISO: 1 }, timeout: 1000, fail: { title: 'El AVISO no se enciende tras 10 s con las manos.', why: 'Un TON de 10 s alimentado por MANOS activa su salida a los 10 s.', hint: 'Segundo segmento: MANOS (NO) → TON T1 10 s → AVISO.' } }, { set: { MANOS: 0 } }, { expect: { AVISO: 0 }, fail: { title: 'El AVISO no se apaga al retirar las manos.', why: 'El TON se reinicia en cuanto su entrada se apaga.', hint: 'Usa un TON (no un TOF) para el aviso.' } }] },
          { name: 'Usos cortos no avisan', steps: [{ set: { MANOS: 1 } }, { wait: 6000 }, { set: { MANOS: 0 } }, { wait: 300 }, { set: { MANOS: 1 } }, { during: { AVISO: 0 }, ms: 8000, fail: { title: 'El AVISO salta sumando dos usos distintos.', why: 'Las manos deben estar 10 s SEGUIDOS. El TON debe reiniciarse al retirar las manos.', hint: 'Alimenta el TON directamente con MANOS.' } }] }
        ],
        hints: ['Necesitas dos temporizadores distintos (T0 y T1), uno para cada salida.', 'Secador: retardo al apagar → <b>TOF</b> de 3 s. Aviso: retardo al encender → <b>TON</b> de 10 s.', { text: 'Dos segmentos:', program: H.P(H.R('NO(I0.0) TOF(T0,3) OUT(Q0.0)'), H.R('NO(I0.0) TON(T1,10) OUT(Q0.1)')) }],
        solution: H.P(H.R('# Secador: sigue 3 s tras retirar las manos\nNO(I0.0) TOF(T0,3) OUT(Q0.0)'), H.R('# Aviso: manos más de 10 s seguidos\nNO(I0.0) TON(T1,10) OUT(Q0.1)')),
        success: '<p>¡Nivel 4 superado! Ya distingues el <b>TON</b> (espera antes de encender) del <b>TOF</b> (espera antes de apagar).</p>'
      }
    ]
  });
})();
