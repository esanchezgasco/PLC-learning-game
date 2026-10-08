/* NIVEL 2 — Lógica de contactos */
(function () {
  'use strict';
  const H = PLC.H, A = PLC.art;

  PLC.registerLevel({
    id: 2,
    icon: '⚡',
    title: 'Lógica de contactos',
    short: 'Contactos NO y NC, bobina, AND, OR y NOT',
    tools: ['NC', 'WIRE'],
    stages: [
      {
        type: 'intro', title: 'Las máquinas toman decisiones',
        html: '<p>Una prensa no debe bajar si alguien tiene la mano dentro. Una cinta debe pararse si pulsas PARO. Estas decisiones se construyen combinando <b>contactos</b>.</p>' +
          '<p>En este nivel aprenderás las tres operaciones lógicas básicas: <b>AND</b> (y), <b>OR</b> (o) y <b>NOT</b> (no). Con ellas se programa casi todo.</p>'
      },
      {
        type: 'concept', title: 'Contacto normalmente abierto (NO)',
        html: '<p>Un contacto <b>normalmente abierto (NO)</b> permite el paso de la señal cuando la entrada está <b>activa</b>.</p><div class="mini-table"><div>Si <code>I0.0 = 1</code> → el contacto se <b>cierra</b> y pasa la corriente.</div><div>Si <code>I0.0 = 0</code> → el contacto permanece <b>abierto</b>.</div></div>',
        demo: { io: H.io([H.btn('I0.0', 'PULSADOR')], [H.lamp('Q0.0', 'LAMPARA')]), program: H.P(H.R('NO(I0.0) OUT(Q0.0)')), prompt: 'Pulsa: el contacto NO se cierra (se rellena de verde) y la corriente pasa.' }
      },
      {
        type: 'concept', title: 'Contacto normalmente cerrado (NC)',
        html: '<p>Un contacto <b>normalmente cerrado (NC)</b> funciona al revés: deja pasar la corriente cuando la entrada vale <b>0</b>, y la corta cuando vale 1. Se dibuja con una barra cruzada <code>─┤/├─</code>.</p><div class="mini-table"><div>Si <code>I0.0 = 0</code> → cerrado, pasa la corriente.</div><div>Si <code>I0.0 = 1</code> → se abre y corta.</div></div>',
        demo: { io: H.io([H.btn('I0.0', 'PULSADOR')], [H.lamp('Q0.0', 'LAMPARA')]), program: H.P(H.R('NC(I0.0) OUT(Q0.0)')), prompt: 'Sin pulsar, la lámpara ya está encendida. Pulsa y se apaga.' }
      },
      {
        type: 'concept', title: 'La bobina',
        html: '<p>La <b>bobina</b> <code>─( )─</code> va siempre al final del segmento, junto al carril derecho. Escribe en su dirección el resultado del segmento:</p><div class="mini-table"><div>Llega corriente → la dirección vale <b>1</b>.</div><div>No llega corriente → vale <b>0</b>.</div></div><p>Puede ser una salida (<code>Q</code>) o una memoria interna (<code>M</code>), que verás más adelante.</p>',
        quiz: { q: 'Si no llega corriente a la bobina Q0.0, ¿cuánto vale Q0.0?', options: ['0 (apagada)', '1 (encendida)', 'Depende del color'], answer: 0, explain: 'Una bobina normal copia el resultado: sin corriente, la salida se apaga.' }
      },
      {
        type: 'concept', title: 'AND: contactos en serie',
        html: '<p>Si pones dos contactos <b>uno detrás de otro</b> (en serie), la corriente solo pasa si <b>los dos</b> están cerrados. Eso es un <b>AND</b> (“y”).</p>' +
          A.truth(['A (I0.0)', 'B (I0.1)', 'Salida'], [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 1]]),
        demo: { io: H.io([H.btn('I0.0', 'A'), H.sw('I0.1', 'B')], [H.lamp('Q0.0', 'LAMPARA')]), program: H.P(H.R('NO(I0.0) NO(I0.1) OUT(Q0.0)')), prompt: 'Activa el interruptor B y después pulsa A. Solo con los dos se enciende.' }
      },
      {
        type: 'concept', title: 'OR: contactos en paralelo',
        html: '<p>Si pones dos contactos <b>uno encima de otro</b> (en paralelo), la corriente pasa si <b>cualquiera</b> de los dos está cerrado. Eso es un <b>OR</b> (“o”).</p>' +
          A.truth(['A (I0.0)', 'B (I0.1)', 'Salida'], [[0, 0, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]]) +
          '<p class="tip">🛠 <b>En el editor:</b> pulsa <b>＋ Rama</b> en el segmento para añadir una fila debajo. Coloca allí el segundo contacto y haz clic en el punto <b>●</b> que hay entre las dos filas para <b>unirlas</b>.</p>',
        demo: { io: H.io([H.btn('I0.0', 'A'), H.btn('I0.1', 'B')], [H.lamp('Q0.0', 'LAMPARA')]), program: H.P(H.R('NO(I0.0) OUT(Q0.0)\nNO(I0.1) |')), prompt: 'Pulsa A o pulsa B (teclas 1 y 2): con cualquiera se enciende. Fíjate en la unión vertical.' }
      },
      {
        type: 'concept', title: 'NOT: la negación',
        html: '<p><b>NOT</b> significa “lo contrario”. En Ladder, un NOT es simplemente un <b>contacto NC</b>: deja pasar cuando la entrada NO está activa.</p><p>Uso típico: un botón de <b>PARO</b>. Mientras no lo pulsas, deja pasar; al pulsarlo, corta.</p>',
        quiz: { q: '¿Qué contacto usarías para que una lámpara esté encendida cuando un botón NO está pulsado?', options: ['Un contacto NC', 'Un contacto NO', 'Dos contactos NO en serie'], answer: 0, explain: 'El contacto NC (normalmente cerrado) deja pasar la corriente cuando su entrada vale 0.' }
      },
      {
        type: 'example', title: 'Ejemplo: NO y NC con el mismo botón',
        html: '<p>Dos segmentos usan el mismo botón:</p><ul><li>Segmento 1: contacto <b>NO</b> → la luz de <b>TRABAJO</b> se enciende al pulsar.</li><li>Segmento 2: contacto <b>NC</b> → la luz de <b>REPOSO</b> está encendida mientras NO pulsas.</li></ul><p>Ejecuta el PLC y pulsa el botón. Fíjate en qué contactos se rellenan de verde: un contacto <b>cerrado</b> se rellena aunque no le llegue corriente.</p>',
        io: H.io([H.btn('I0.0', 'PULSADOR')], [H.lamp('Q0.0', 'LUZ_TRABAJO', 'green'), H.lamp('Q0.1', 'LUZ_REPOSO', 'red')]),
        program: H.P(H.R('# Luz de trabajo: encendida al pulsar\nNO(I0.0) OUT(Q0.0)'), H.R('# Luz de reposo: encendida si NO se pulsa\nNC(I0.0) OUT(Q0.1)'))
      },
      {
        type: 'guided', title: 'Motor con dos condiciones (AND)',
        html: '<p>Un taladro solo debe girar si se pulsa <b>MARCHA</b> <u>y</u> el <b>PROTECTOR</b> transparente está cerrado (el interruptor PROTECTOR vale 1 cuando está cerrado).</p>',
        io: H.io([H.btn('I0.0', 'MARCHA'), H.sw('I0.1', 'PROTECTOR')], [H.motor('Q0.0', 'MOTOR')]),
        steps: [
          { text: 'Coloca un <b>contacto NO</b> con <code>I0.0 — MARCHA</code> en la primera celda del segmento 1.', check: H.has({ type: 'NO', addr: 'I0.0' }), target: { ri: 0, r: 0, c: 0 } },
          { text: 'A su derecha, otro <b>contacto NO</b> con <code>I0.1 — PROTECTOR</code>. Dos contactos seguidos = AND.', check: H.has({ type: 'NO', addr: 'I0.1' }), target: { ri: 0, r: 0, c: 1 } },
          { text: 'En la última columna, una <b>bobina</b> con <code>Q0.0 — MOTOR</code>.', check: H.has({ type: 'OUT', addr: 'Q0.0' }), target: { ri: 0, r: 0, c: 7 } },
          { text: 'Ejecuta el PLC: cierra el PROTECTOR (tecla 2) y mantén MARCHA (tecla 1). El motor gira.', live: function (c) { return !!c.world.outputs['Q0.0']; } },
          { text: 'Pulsa <b>✔ Comprobar</b>.', check: function () { return false; }, final: true }
        ],
        tests: [
          { name: 'Solo MARCHA → motor parado', steps: [{ press: 'MARCHA' }, { expect: { MOTOR: 0 }, fail: { title: 'El motor gira con el protector abierto.', why: 'Con un AND, TODAS las condiciones deben cumplirse. Si el motor gira solo con MARCHA, falta la condición del PROTECTOR.', hint: 'Pon el contacto PROTECTOR en serie (a continuación) con MARCHA.' } }] },
          { name: 'Solo PROTECTOR → motor parado', steps: [{ set: { PROTECTOR: 1 } }, { expect: { MOTOR: 0 }, fail: { title: 'El motor gira sin pulsar MARCHA.', why: 'El motor solo debe girar con las dos condiciones a la vez.', hint: 'Revisa que MARCHA también esté en serie.' } }] },
          { name: 'MARCHA y PROTECTOR → motor gira', steps: [{ set: { PROTECTOR: 1 } }, { press: 'MARCHA' }, { expect: { MOTOR: 1 }, fail: { title: 'El motor no gira con las dos condiciones cumplidas.', why: 'Con MARCHA pulsado y el PROTECTOR cerrado, la corriente debería atravesar los dos contactos.', hint: 'Comprueba que ambos contactos sean NO y estén en la misma fila que la bobina.' } }, { release: 'MARCHA' }, { expect: { MOTOR: 0 } }] }
        ],
        hints: ['Las dos condiciones deben cumplirse a la vez.', 'Dos contactos NO en serie (uno detrás de otro) forman un AND.', { text: 'MARCHA (NO) → PROTECTOR (NO) → bobina MOTOR:', program: H.P(H.R('NO(I0.0) NO(I0.1) OUT(Q0.0)')) }],
        solution: H.P(H.R('NO(I0.0) NO(I0.1) OUT(Q0.0)')),
        success: '<p>Has creado una <b>condición AND</b>. Muchas seguridades industriales funcionan así: varias condiciones en serie, y si falla una, la máquina no arranca.</p>'
      },
      {
        type: 'free', title: 'Un botón de parada (NOT)',
        html: '<p>Una cinta funciona mientras el selector <b>MARCHA</b> está activado. Pero si alguien pulsa <b>PARO</b>, debe detenerse inmediatamente (y volver a moverse al soltarlo).</p><ul class="goals"><li>MARCHA activado → CINTA en marcha</li><li>PARO pulsado → CINTA parada</li></ul>',
        io: H.io([H.sw('I0.0', 'MARCHA'), H.btn('I0.1', 'PARO', 'red')], [H.motor('Q0.0', 'CINTA')]),
        tests: [
          { name: 'MARCHA activado → cinta en marcha', steps: [{ set: { MARCHA: 1 } }, { expect: { CINTA: 1 }, fail: { title: 'La cinta no arranca con MARCHA activado.', why: 'Con MARCHA activado y sin pulsar PARO, la corriente debería llegar hasta la bobina.', hint: 'El contacto de PARO debe ser NC: así deja pasar la corriente mientras NO lo pulsas.' } }] },
          { name: 'PARO detiene la cinta', steps: [{ set: { MARCHA: 1 } }, { press: 'PARO' }, { expect: { CINTA: 0 }, fail: { title: 'La cinta no se para al pulsar PARO.', why: 'Mientras pulsas PARO su señal I0.1 vale 1. Para que corte la corriente justo en ese momento, el contacto debe abrirse cuando vale 1.', hint: 'Usa un contacto NC para PARO, en serie con MARCHA.' } }, { release: 'PARO' }, { expect: { CINTA: 1 } }] },
          { name: 'Sin MARCHA la cinta no se mueve', steps: [{ set: { MARCHA: 0 } }, { expect: { CINTA: 0 } }] }
        ],
        hints: ['PARO debe <i>cortar</i> la corriente cuando se pulsa.', 'Necesitas un NOT: un <b>contacto NC</b> con PARO, en serie con MARCHA.', { text: 'MARCHA (NO) → PARO (NC) → CINTA:', program: H.P(H.R('NO(I0.0) NC(I0.1) OUT(Q0.0)')) }],
        solution: H.P(H.R('NO(I0.0) NC(I0.1) OUT(Q0.0)')),
        success: '<p>Has usado la negación (NOT) con un contacto NC. Es la forma más habitual de programar un botón de parada.</p>'
      },
      {
        type: 'free', title: 'Lógica OR: luz desde dos sitios',
        html: '<p>En un pasillo hay dos pulsadores, uno en cada extremo. La <b>LUZ</b> debe encenderse mientras se pulse <b>cualquiera</b> de los dos.</p><ul class="goals"><li>PULSADOR_A → luz</li><li>PULSADOR_B → luz</li><li>Ninguno → apagada</li></ul><p class="tip">Recuerda: <b>＋ Rama</b> añade una fila; el punto <b>●</b> une las filas.</p>',
        io: H.io([H.btn('I0.0', 'PULSADOR_A'), H.btn('I0.1', 'PULSADOR_B')], [H.lamp('Q0.0', 'LUZ')]),
        tests: [
          { name: 'PULSADOR_A enciende la luz', steps: [{ press: 'PULSADOR_A' }, { expect: { LUZ: 1 }, fail: { title: 'La luz no se enciende con el PULSADOR_A.', why: 'Cualquiera de los dos pulsadores debe poder encender la luz.', hint: 'Comprueba que PULSADOR_A (I0.0) esté en un camino que llegue a la bobina.' } }] },
          { name: 'PULSADOR_B enciende la luz', steps: [{ press: 'PULSADOR_B' }, { expect: { LUZ: 1 }, fail: { title: 'La luz no se enciende con el PULSADOR_B.', why: 'Si pones los dos contactos en serie, harías un AND (harían falta los dos). Para un OR, el segundo contacto debe ir en una rama en paralelo, unida a la línea principal.', hint: 'Añade una rama (＋ Rama), coloca PULSADOR_B en la fila de abajo y une las filas con el punto ● a la derecha del contacto.' } }] },
          { name: 'Sin pulsar → luz apagada', steps: [{ wait: 100 }, { expect: { LUZ: 0 } }] },
          { name: 'Los dos a la vez → luz encendida', steps: [{ press: 'PULSADOR_A' }, { press: 'PULSADOR_B' }, { expect: { LUZ: 1 } }] }
        ],
        hints: ['Con uno cualquiera de los dos debe bastar.', 'Necesitas un <b>OR</b>: dos contactos <b>en paralelo</b>.', { text: 'PULSADOR_A en la fila de arriba, PULSADOR_B en la rama de abajo y una unión ● justo a la derecha:', program: H.P(H.R('NO(I0.0) OUT(Q0.0)\nNO(I0.1) |')) }],
        solution: H.P(H.R('NO(I0.0) OUT(Q0.0)\nNO(I0.1) |')),
        success: '<p>Has construido tu primer <b>paralelo (OR)</b>. La unión vertical ● junta las dos ramas: si cualquiera lleva corriente, la corriente sigue hacia la bobina.</p>'
      },
      {
        type: 'test', title: 'Prueba final: prensa segura',
        html: '<p>Programa una <b>prensa industrial</b> con estas normas de seguridad:</p><ul class="goals"><li>La <b>PRENSA</b> solo baja si se pulsan <b>MANO_IZQ</b> y <b>MANO_DER</b> a la vez (mando a dos manos).</li><li>Pero <b>nunca</b> si la <b>PUERTA_ABIERTA</b> está activa o la <b>BARRERA</b> de luz detecta una mano.</li><li>La luz de <b>AVISO</b> se enciende si la puerta está abierta <b>o</b> la barrera detecta algo.</li></ul><p class="tip">Para pulsar dos botones a la vez usa las teclas <kbd>1</kbd> y <kbd>2</kbd>, o Mayús+clic para dejar un botón enclavado.</p>',
        io: H.io([H.btn('I0.0', 'MANO_IZQ'), H.btn('I0.1', 'MANO_DER'), H.sens('I0.2', 'PUERTA_ABIERTA'), H.sens('I0.3', 'BARRERA')], [H.motor('Q0.0', 'PRENSA'), H.lamp('Q0.1', 'AVISO', 'amber')]),
        tests: [
          { name: 'Dos manos → la prensa baja', steps: [{ press: 'MANO_IZQ' }, { press: 'MANO_DER' }, { expect: { PRENSA: 1, AVISO: 0 }, fail: { title: 'La prensa no baja con las dos manos pulsadas (y todo seguro).', why: 'Con las dos manos, la puerta cerrada y la barrera libre, la corriente debe llegar a PRENSA.', hint: 'MANO_IZQ y MANO_DER en serie (NO), seguidos de PUERTA_ABIERTA y BARRERA como contactos NC.' } }] },
          { name: 'Una sola mano no basta', steps: [{ press: 'MANO_IZQ' }, { expect: { PRENSA: 0 }, fail: { title: '¡Peligro! La prensa baja con una sola mano.', why: 'El mando a dos manos obliga a tener las dos manos fuera de la zona de peligro.', hint: 'Los dos botones deben ir en serie (AND), no en paralelo.' } }, { release: 'MANO_IZQ' }, { press: 'MANO_DER' }, { expect: { PRENSA: 0 } }] },
          { name: 'Puerta abierta → bloqueo y aviso', steps: [{ set: { PUERTA_ABIERTA: 1 } }, { press: 'MANO_IZQ' }, { press: 'MANO_DER' }, { expect: { PRENSA: 0 }, fail: { title: '¡Peligro! La prensa baja con la puerta abierta.', why: 'PUERTA_ABIERTA vale 1 cuando la puerta está abierta. Debe cortar la corriente justo en ese caso.', hint: 'Usa un contacto NC con PUERTA_ABIERTA en serie.' } }, { expect: { AVISO: 1 }, fail: { title: 'La luz de AVISO no se enciende con la puerta abierta.', why: 'El aviso debe encenderse si la puerta está abierta O la barrera detecta algo.', hint: 'Haz un OR (paralelo) con PUERTA_ABIERTA y BARRERA hacia la bobina AVISO.' } }] },
          { name: 'Barrera → bloqueo y aviso', steps: [{ set: { BARRERA: 1 } }, { press: 'MANO_IZQ' }, { press: 'MANO_DER' }, { expect: { PRENSA: 0 }, fail: { title: '¡Peligro! La prensa baja con una mano dentro de la barrera.', why: 'Si la barrera de luz detecta algo (BARRERA = 1), la prensa debe quedar bloqueada.', hint: 'Añade BARRERA como contacto NC en serie.' } }, { expect: { AVISO: 1 }, fail: { title: 'La luz de AVISO no se enciende cuando la barrera detecta algo.', why: 'El aviso es un OR de PUERTA_ABIERTA y BARRERA.', hint: 'Revisa la rama en paralelo del segmento de AVISO.' } }] },
          { name: 'Todo seguro → sin aviso', steps: [{ wait: 100 }, { expect: { AVISO: 0, PRENSA: 0 } }] }
        ],
        hints: ['Son dos segmentos: uno para la PRENSA y otro para el AVISO.', 'PRENSA = MANO_IZQ <b>AND</b> MANO_DER <b>AND NOT</b> PUERTA_ABIERTA <b>AND NOT</b> BARRERA. AVISO = PUERTA_ABIERTA <b>OR</b> BARRERA.', { text: 'Así quedan los dos segmentos:', program: H.P(H.R('NO(I0.0) NO(I0.1) NC(I0.2) NC(I0.3) OUT(Q0.0)'), H.R('NO(I0.2) OUT(Q0.1)\nNO(I0.3) |')) }],
        solution: H.P(H.R('# Prensa: dos manos y todo seguro\nNO(I0.0) NO(I0.1) NC(I0.2) NC(I0.3) OUT(Q0.0)'), H.R('# Aviso: puerta abierta O barrera\nNO(I0.2) OUT(Q0.1)\nNO(I0.3) |')),
        success: '<p>¡Nivel superado! Has combinado <b>AND</b>, <b>OR</b> y <b>NOT</b> en un caso real de seguridad. Con estas tres operaciones se construye la lógica de casi cualquier máquina.</p>'
      }
    ]
  });
})();
