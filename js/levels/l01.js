/* NIVEL 1 — Primer contacto con un PLC */
(function () {
  'use strict';
  const H = PLC.H, A = PLC.art;
  const ioBtnLamp = H.io([H.btn('I0.0', 'PULSADOR')], [H.lamp('Q0.0', 'LAMPARA', 'yellow')]);

  PLC.registerLevel({
    id: 1,
    icon: '🔌',
    title: 'Primer contacto con un PLC',
    short: 'Qué es un PLC, entradas, salidas y el ciclo de scan',
    tools: ['NO', 'OUT'],
    stages: [
      {
        type: 'intro', title: 'Bienvenido/a a la planta',
        html: '<p>Hoy empiezas como <b>aprendiz de automatización</b>. En una fábrica, nadie enciende y apaga cada motor a mano: las máquinas las controla un <b>PLC</b>.</p>' +
          '<p>En este nivel vas a descubrir qué es un PLC, cómo <b>“ve”</b> lo que pasa en la máquina y cómo <b>actúa</b> sobre ella. No necesitas saber nada de programación: iremos paso a paso.</p>' +
          A.flow([{ icon: 'button', label: 'Pulsador', sub: 'entrada' }, { icon: 'plc', label: 'PLC', sub: 'decide' }, { icon: 'motor', label: 'Motor', sub: 'salida' }], { arrows: ['señal', 'orden'] }) +
          '<p class="muted">Consejo: cada concepto nuevo aparece explicado justo antes de usarlo. Lee, pulsa <b>Entendido → Probar</b> y juega con él.</p>'
      },
      {
        type: 'concept', title: '¿Qué es un PLC?',
        html: '<p>Un <b>PLC</b> (Controlador Lógico Programable) es un <b>ordenador industrial</b>, muy robusto, que controla máquinas.</p><p>Hace siempre tres cosas: <b>lee</b> señales, <b>decide</b> según su programa y <b>actúa</b>.</p>',
        visual: A.plcBox(),
        quiz: { q: '¿Dónde encontrarías un PLC?', options: ['Controlando una cinta transportadora de una fábrica', 'Editando fotos en un portátil', 'Dentro del mando de la televisión'], answer: 0, explain: 'Los PLC están en fábricas, depuradoras, ascensores, semáforos… allí donde haya máquinas que automatizar.' }
      },
      {
        type: 'concept', title: 'Entradas (I)',
        html: '<p>Las <b>entradas</b> son las señales que <b>llegan</b> al PLC: pulsadores, interruptores, sensores…</p><p>Cada entrada tiene una <b>dirección</b>, por ejemplo <code>I0.0</code> (I de <i>Input</i>). Solo puede valer <b>1</b> (hay señal) o <b>0</b> (no hay señal).</p>',
        visual: '<div class="mini-table"><div><code>I0.0 = 0</code> → botón sin pulsar</div><div><code>I0.0 = 1</code> → botón pulsado</div></div>',
        demo: { io: H.io([H.btn('I0.0', 'PULSADOR')], []), prompt: 'Mantén pulsado el botón y mira el piloto de señal: I0.0 pasa de 0 a 1.' }
      },
      {
        type: 'concept', title: 'Salidas (Q)',
        html: '<p>Las <b>salidas</b> son las órdenes que el PLC <b>envía</b>: encender una lámpara, arrancar un motor, abrir una válvula…</p><p>Se escriben con <code>Q</code>, por ejemplo <code>Q0.0</code>. También valen 1 (activada) o 0 (apagada). <b>Las decide el programa</b>, no tú.</p>',
        visual: '<div class="mini-table"><div><code>Q0.0 = 1</code> → lámpara encendida</div><div><code>Q0.0 = 0</code> → lámpara apagada</div></div>',
        demo: { io: ioBtnLamp, program: H.P(H.R('NO(I0.0) OUT(Q0.0)')), prompt: 'Pulsa el botón: el PLC lee I0.0 y decide encender Q0.0.' }
      },
      {
        type: 'concept', title: 'Sensores',
        html: '<p>Un <b>sensor</b> detecta algo <b>automáticamente</b>, sin que nadie lo pulse: una pieza que pasa, el nivel del agua, una puerta abierta…</p><p>Como informa al PLC, se conecta a una <b>entrada</b>.</p>',
        visual: A.devices([{ icon: 'sensor', label: 'Fotoeléctrico', sub: 'detecta objetos' }, { icon: 'sensor', label: 'Inductivo', sub: 'detecta metal' }, { icon: 'switch', label: 'Final de carrera', sub: 'detecta posición' }]),
        quiz: { q: 'Un sensor detecta una caja en la cinta. ¿Dónde lo conectas?', options: ['A una entrada (I)', 'A una salida (Q)'], answer: 0, explain: 'El sensor informa al PLC, así que la señal va del sensor hacia el PLC: es una entrada.' }
      },
      {
        type: 'concept', title: 'Actuadores',
        html: '<p>Un <b>actuador</b> es lo que hace el trabajo: motores, lámparas, cilindros, alarmas…</p><p>Reciben órdenes del PLC, así que se conectan a las <b>salidas</b>.</p>',
        visual: A.devices([{ icon: 'motor', label: 'Motor' }, { icon: 'lamp', label: 'Lámpara' }, { icon: 'cylinder', label: 'Cilindro' }, { icon: 'alarm', label: 'Alarma' }]),
        quiz: { q: 'El motor que mueve una cinta transportadora es…', options: ['Un actuador, conectado a una salida (Q)', 'Un sensor, conectado a una entrada (I)'], answer: 0, explain: 'El motor obedece al PLC: es un actuador y va en una salida.' }
      },
      {
        type: 'concept', title: 'Entrada o salida: la diferencia',
        html: '<p>Una regla sencilla para no confundirte:</p>',
        visual: '<table class="cmp-table"><tr><th>ENTRADA (I)</th><th>SALIDA (Q)</th></tr><tr><td>Informa al PLC</td><td>Obedece al PLC</td></tr><tr><td>Pulsador, interruptor, sensor</td><td>Motor, lámpara, cilindro, alarma</td></tr><tr><td>El mundo → PLC</td><td>PLC → el mundo</td></tr></table>',
        quiz: { q: 'Una lámpara piloto del cuadro eléctrico, ¿es entrada o salida?', options: ['Entrada', 'Salida'], answer: 1, explain: 'La lámpara no le cuenta nada al PLC: es el PLC quien la enciende. Es una salida.' }
      },
      {
        type: 'concept', title: 'El ciclo del PLC (scan)',
        html: '<p>El PLC trabaja en un <b>bucle sin fin</b>, muchas veces por segundo:</p><ol><li><b>Lee</b> todas las entradas (hace una “foto”).</li><li><b>Ejecuta</b> el programa de arriba a abajo usando esa foto.</li><li><b>Escribe</b> el resultado en las salidas.</li></ol><p>Y vuelta a empezar. Es el <b>ciclo de scan</b>.</p>',
        visual: A.scanCycle(),
        quiz: { q: '¿Qué hace el PLC al principio de cada ciclo?', options: ['Leer las entradas', 'Escribir las salidas', 'Borrar el programa'], answer: 0, explain: 'Primero lee las entradas, luego ejecuta el programa y por último escribe las salidas.' }
      },
      {
        type: 'concept', title: 'Tu primer programa: el lenguaje de contactos',
        html: '<p>Los PLC se programan a menudo en <b>Ladder</b> (lenguaje de contactos), que parece un esquema eléctrico. La “corriente” sale del carril izquierdo y va hacia la derecha.</p>' +
          '<ul><li><code>─┤ ├─</code> es un <b>contacto</b>: una <i>condición</i> (¿está activa I0.0?).</li><li><code>─( )─</code> es una <b>bobina</b>: una <i>acción</i> (activa Q0.0).</li></ul><p>Si la corriente consigue llegar a la bobina, la salida se activa.</p>',
        demo: { io: ioBtnLamp, program: H.P(H.R('NO(I0.0) OUT(Q0.0)')), prompt: 'Pulsa y mira cómo la corriente (en verde) cruza el contacto y llega a la bobina.' }
      },
      {
        type: 'example', title: 'Ejemplo: Pulsador → PLC → Motor',
        html: '<p>Este programa ya está hecho. Sirve para que veas un PLC funcionando de verdad.</p><ol><li>Pulsa <b>▶ EJECUTAR PLC</b>.</li><li>Mantén pulsado <b>MARCHA</b> (clic sostenido o tecla <kbd>1</kbd>).</li><li>Observa: el LED <code>I0.0</code> del PLC se enciende, la corriente cruza el contacto, la bobina <code>Q0.0</code> se activa y el motor gira.</li></ol>',
        io: H.io([H.btn('I0.0', 'MARCHA')], [H.motor('Q0.0', 'MOTOR')]),
        program: H.P(H.R('# Si MARCHA está pulsado, el motor gira\nNO(I0.0) OUT(Q0.0)'))
      },
      {
        type: 'interact', title: 'Pulsa el botón para encender la lámpara',
        html: '<p>Tu primera misión: hacer que el PLC encienda la lámpara. El programa ya está escrito; tú manejas la máquina.</p>',
        io: ioBtnLamp,
        program: H.P(H.R('NO(I0.0) OUT(Q0.0)')),
        steps: [
          { text: 'Pon el PLC en marcha con <b>▶ EJECUTAR PLC</b>.', live: function (c) { return c.sim.running && !c.sim.stepMode; } },
          { text: 'Mantén pulsado el <b>PULSADOR</b> (clic sostenido o tecla <kbd>1</kbd>).', live: function (c) { return !!c.engine && !!c.engine.I['I0.0']; } },
          { text: 'Mira la <b>LAMPARA</b>: ¡se enciende! El PLC ha obedecido.', live: function (c) { return !!c.world.outputs['Q0.0']; } },
          { text: 'Suelta el pulsador: la lámpara se apaga.', live: function (c) { return c.sim.running && !c.world.outputs['Q0.0'] && !c.world.user['I0.0']; } }
        ],
        hints: ['Primero el PLC tiene que estar en RUN: busca el botón verde ▶ EJECUTAR PLC.', 'El pulsador solo da señal mientras lo mantienes pulsado: no sueltes el ratón (o mantén la tecla 1).', 'Pulsa ▶ EJECUTAR PLC, después mantén pulsado el botón verde PULSADOR del panel de entradas.']
      },
      {
        type: 'free', title: 'Tu primer programa',
        html: '<p>El programa tiene el contacto del <b>INTERRUPTOR</b> (<code>I0.0</code>), pero le falta la acción.</p><p><b>Objetivo:</b> que la <b>LAMPARA</b> (<code>Q0.0</code>) se encienda cuando el interruptor esté activado.</p>',
        io: H.io([H.sw('I0.0', 'INTERRUPTOR')], [H.lamp('Q0.0', 'LAMPARA', 'yellow')]),
        initial: H.P(H.R('NO(I0.0)')),
        tests: [
          { name: 'Interruptor activado → lámpara encendida', steps: [
            { set: { INTERRUPTOR: 1 } },
            { expect: { LAMPARA: 1 }, fail: { title: 'La lámpara no se enciende al activar el interruptor.', why: 'La corriente cruza el contacto, pero no llega a ninguna bobina con la dirección Q0.0.', hint: 'Revisa que la bobina tenga la dirección Q0.0 (LAMPARA).' } }
          ] },
          { name: 'Interruptor desactivado → lámpara apagada', steps: [
            { set: { INTERRUPTOR: 1 } }, { set: { INTERRUPTOR: 0 } },
            { expect: { LAMPARA: 0 }, fail: { title: 'La lámpara sigue encendida con el interruptor desactivado.', why: 'Una bobina normal copia el resultado del segmento: si no llega corriente, debe apagarse.', hint: 'Usa una bobina normal ( ), no una SET.' } }
          ] }
        ],
        hints: [
          'Al contacto le falta su acción: algo que se active cuando le llegue la corriente.',
          'Necesitas una <b>bobina</b> ( ) con la dirección <code>Q0.0</code>.',
          { text: 'Elige <b>Bobina</b> en la paleta y haz clic en la última columna del segmento 1. Comprueba en las propiedades que la dirección es <code>Q0.0 — LAMPARA</code>.', program: H.P(H.R('NO(I0.0) OUT(Q0.0)')) }
        ],
        solution: H.P(H.R('NO(I0.0) OUT(Q0.0)')),
        success: '<p>Has escrito tu primer programa de PLC. Se lee así: <i>“si el INTERRUPTOR está activado, enciende la LAMPARA”</i>.</p>'
      },
      {
        type: 'free', title: 'Desde cero: el timbre',
        html: '<p>Ahora el programa está vacío. Construye tú todo el segmento.</p><p><b>Objetivo:</b> mientras se pulsa el botón <b>TIMBRE</b> (<code>I0.0</code>), suena el <b>ZUMBADOR</b> (<code>Q0.0</code>).</p>',
        io: H.io([H.btn('I0.0', 'TIMBRE')], [H.buzzer('Q0.0', 'ZUMBADOR')]),
        tests: [
          { name: 'Pulsar TIMBRE hace sonar el zumbador', steps: [
            { press: 'TIMBRE' }, { expect: { ZUMBADOR: 1 }, fail: { title: 'El zumbador no suena al pulsar TIMBRE.', why: 'La corriente tiene que pasar por un contacto del botón TIMBRE (I0.0) y llegar a la bobina Q0.0.', hint: 'Comprueba las direcciones: contacto I0.0 y bobina Q0.0.' } }
          ] },
          { name: 'Soltar TIMBRE lo apaga', steps: [
            { pulse: 'TIMBRE' }, { expect: { ZUMBADOR: 0 } }
          ] }
        ],
        hints: [
          'Un segmento tiene dos partes: la condición (a la izquierda) y la acción (a la derecha).',
          'Necesitas un <b>contacto NO</b> con <code>I0.0</code> y una <b>bobina</b> con <code>Q0.0</code>.',
          { text: 'Coloca un contacto NO en la primera celda (dirección I0.0) y una bobina en la última columna (dirección Q0.0).', program: H.P(H.R('NO(I0.0) OUT(Q0.0)')) }
        ],
        solution: H.P(H.R('NO(I0.0) OUT(Q0.0)')),
        success: '<p>¡Perfecto! Fíjate en que no hace falta que el contacto y la bobina estén pegados: las celdas vacías de la línea principal conducen la corriente.</p>'
      },
      {
        type: 'quiz', title: 'Prueba final del nivel 1',
        questions: [
          { q: '¿Qué es <code>I0.2</code>?', options: ['Una entrada', 'Una salida', 'Un temporizador'], answer: 0, explain: 'La letra I indica entrada (Input).' },
          { q: '¿Cuál de estos es un actuador?', options: ['Un sensor fotoeléctrico', 'Un pulsador', 'Un cilindro neumático'], answer: 2, explain: 'El cilindro realiza un trabajo (empujar): es un actuador. Sensores y pulsadores son entradas.' },
          { q: '¿Cuál es el orden del ciclo de scan?', options: ['Leer entradas → Ejecutar programa → Escribir salidas', 'Escribir salidas → Leer entradas → Ejecutar programa', 'Ejecutar programa → Leer entradas → Escribir salidas'], answer: 0, explain: 'El PLC siempre lee primero, luego piensa y por último actúa.' },
          { q: 'En Ladder, <code>─┤ ├─</code> representa…', options: ['Una condición (contacto)', 'Una acción (bobina)', 'Un cable roto'], answer: 0, explain: 'El contacto es la condición; la bobina ( ) es la acción.' },
          { q: 'Un sensor de nivel de un depósito se conecta a…', options: ['Una salida (Q)', 'Una entrada (I)'], answer: 1, explain: 'Todo sensor informa al PLC: es una entrada.' }
        ]
      }
    ]
  });
})();
