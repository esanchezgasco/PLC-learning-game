/* NIVEL 5 — Contadores */
(function () {
  'use strict';
  const H = PLC.H;
  const ioCount = H.io([H.btn('I0.0', 'SENSOR_PIEZA'), H.btn('I0.1', 'RESET', 'blue')], [H.lamp('Q0.0', 'LUZ_LOTE', 'green')], { counters: [H.mem('C0', 'PIEZAS')] });
  const countSol = H.P(H.R('# Contar piezas: lote de 5\nNO(I0.0) CTU(C0,5) OUT(Q0.0)'), H.R('# Reiniciar el contador\nNO(I0.1) R(C0)'));
  const countTests = [
    { name: 'Cuatro piezas: aún no', steps: H.repeat(4, { pulse: 'SENSOR_PIEZA', ms: 150 }).concat([{ expect: { LUZ_LOTE: 0 }, fail: { title: 'La luz se enciende antes de tiempo.', why: 'Con 4 piezas el contador vale CV = 4, menor que PV = 5.', hint: 'Revisa el valor objetivo PV del contador (5).' } }]) },
    { name: 'Quinta pieza: lote completo', steps: H.repeat(5, { pulse: 'SENSOR_PIEZA', ms: 150 }).concat([{ expect: { LUZ_LOTE: 1 }, fail: { title: 'La luz no se enciende con 5 piezas.', why: 'Cuando CV llega a PV (5), la salida del CTU se activa.', hint: 'SENSOR_PIEZA (NO) → CTU C0 con PV = 5 → LUZ_LOTE.' } }]) },
    { name: 'RESET reinicia la cuenta', steps: H.repeat(5, { pulse: 'SENSOR_PIEZA', ms: 150 }).concat([{ pulse: 'RESET' }, { expect: { LUZ_LOTE: 0 }, fail: { title: 'Tras pulsar RESET, la luz sigue encendida.', why: 'RESET debe poner el valor actual del contador a 0 (CV = 0).', hint: 'Segmento: RESET (NO) → bobina (R) con la dirección del contador (C0).' } }], H.repeat(5, { pulse: 'SENSOR_PIEZA', ms: 150 }), [{ expect: { LUZ_LOTE: 1 }, fail: { title: 'Después del RESET el contador no vuelve a contar bien.', why: '', hint: '' } }]) }
  ];

  PLC.registerLevel({
    id: 5,
    icon: '🔢',
    title: 'Contadores',
    short: 'CTU, CTD, valor actual, valor objetivo, reset y comparadores',
    tools: ['CTU', 'CTD', 'CMP'],
    stages: [
      {
        type: 'intro', title: '¿Cuántas piezas llevamos?',
        html: '<p>Llenar una caja con 10 piezas, avisar cuando quedan pocas, parar tras un lote… Las fábricas <b>cuentan</b> todo el tiempo.</p><p>En este nivel aprenderás a usar <b>contadores</b> y a <b>comparar</b> valores.</p>'
      },
      {
        type: 'concept', title: 'El contador',
        html: '<p>Un <b>contador</b> cuenta eventos: piezas, pulsaciones, ciclos…</p><p>Cuenta en cada <b>flanco de subida</b>: el instante en que su entrada pasa de <b>0 a 1</b>. Si la entrada se queda a 1, no sigue contando: hace falta que vuelva a 0 y suba otra vez.</p>' +
          PLC.art.timing([{ name: 'Entrada', on: [[1, 2], [3, 6], [7, 8]] }], 9) + '<p class="muted">En este cronograma el contador cuenta 3 (tres subidas), aunque el segundo pulso sea largo.</p>',
        quiz: { q: 'Mantienes pulsado durante 10 s el botón conectado a un contador. ¿Cuánto cuenta?', options: ['1', '10', 'Muchísimo'], answer: 0, explain: 'Solo cuenta el flanco de subida (de 0 a 1): una pulsación = 1, dure lo que dure.' }
      },
      {
        type: 'concept', title: 'CTU: contador ascendente',
        html: '<p>El <b>CTU</b> (<i>Count Up</i>) suma 1 en cada flanco de subida. Su salida Q se activa cuando el valor actual llega al objetivo.</p><p>Se llama <code>C0</code>, <code>C1</code>… y se puede leer con contactos, como los temporizadores.</p>',
        demo: { io: H.io([H.btn('I0.0', 'PULSO'), H.btn('I0.1', 'RESET', 'blue')], [H.lamp('Q0.0', 'LISTO', 'green')]), program: H.P(H.R('NO(I0.0) CTU(C0,3) OUT(Q0.0)'), H.R('NO(I0.1) R(C0)')), prompt: 'Pulsa PULSO 3 veces (mira CV). Luego RESET.' }
      },
      {
        type: 'concept', title: 'Valor actual (CV) y valor objetivo (PV)',
        html: '<ul><li><b>CV</b> (<i>Current Value</i>): lo que lleva contado.</li><li><b>PV</b> (<i>Preset Value</i>): el objetivo que tú programas.</li></ul><p>En un CTU, la salida se activa cuando <b>CV ≥ PV</b>, y sigue contando por encima.</p>',
        quiz: { q: 'Un CTU tiene PV = 10 y CV = 7. ¿Está activa su salida?', options: ['No, todavía faltan 3', 'Sí'], answer: 0, explain: 'La salida del CTU se activa cuando CV llega a PV (10).' }
      },
      {
        type: 'concept', title: 'Reset del contador',
        html: '<p>Un contador no se pone a cero solo. Para reiniciarlo se usa una bobina <b>RESET</b> <code>(R)</code> con su dirección, por ejemplo <code>(R) C0</code>.</p><p>En un CTU, el reset pone <b>CV = 0</b> y su salida se apaga.</p>',
        quiz: { q: '¿Qué pasa con un CTU que ha llegado a su PV si nunca lo reseteas?', options: ['Su salida sigue activa y CV sigue subiendo', 'Vuelve a 0 automáticamente', 'Se borra el programa'], answer: 0, explain: 'El contador conserva su valor hasta que una bobina (R) lo reinicia.' }
      },
      {
        type: 'concept', title: 'CTD: contador descendente',
        html: '<p>El <b>CTD</b> (<i>Count Down</i>) empieza en <b>PV</b> y <b>resta 1</b> en cada flanco. Su salida se activa cuando <b>CV llega a 0</b>.</p><p>En un CTD, el reset <code>(R)</code> lo <b>recarga</b>: vuelve a CV = PV. Ideal para “quedan X piezas”.</p>',
        demo: { io: H.io([H.btn('I0.0', 'SACAR'), H.btn('I0.1', 'RECARGAR', 'blue')], [H.lamp('Q0.0', 'VACIO', 'red')]), program: H.P(H.R('NO(I0.0) CTD(C0,3) OUT(Q0.0)'), H.R('NO(I0.1) R(C0)')), prompt: 'Pulsa SACAR 3 veces: CV baja 3 → 2 → 1 → 0 y se enciende VACIO.' }
      },
      {
        type: 'concept', title: 'Comparadores',
        html: '<p>El bloque <b>CMP</b> compara un valor con un número y deja pasar la corriente si la comparación es cierta. Puede comparar el <b>CV de un contador</b> o el <b>tiempo ET de un temporizador</b> (en segundos).</p><p>Operadores: <code>&gt;=</code> <code>&gt;</code> <code>=</code> <code>&lt;=</code> <code>&lt;</code> <code>&lt;&gt;</code> (distinto).</p><p>Ejemplo: <code>C0 &gt;= 3</code> → “llevo 3 piezas o más”.</p>',
        demo: { io: H.io([H.btn('I0.0', 'PULSO'), H.btn('I0.1', 'RESET', 'blue')], [H.lamp('Q0.0', 'AVISO_3', 'amber')]), program: H.P(H.R('NO(I0.0) CTU(C0,10)'), H.R('CMP(C0,>=,3) OUT(Q0.0)'), H.R('NO(I0.1) R(C0)')), prompt: 'Pulsa 3 veces: el comparador C0 ≥ 3 se cumple aunque el contador (PV = 10) no haya terminado.' }
      },
      {
        type: 'example', title: 'Ejemplo: contar piezas en la cinta',
        html: '<p>Una cinta lleva piezas delante de un <b>sensor</b>. Cada pieza que pasa suma 1 al contador C0. Con 3 piezas se enciende <b>LOTE_LISTO</b>.</p><ol><li>Ejecuta el PLC y activa <b>MARCHA</b>.</li><li>Añade piezas con los botones de la escena (o activa el alimentador automático).</li><li>Mira cómo sube CV. Usa <b>RESET</b> para reiniciar.</li></ol>',
        io: H.io([H.sw('I0.0', 'MARCHA'), H.sens('I0.2', 'SENSOR_PIEZA'), H.btn('I0.3', 'RESET', 'blue')], [H.motor('Q0.0', 'CINTA'), H.lamp('Q0.1', 'LOTE_LISTO', 'green')]),
        scene: { type: 'conveyor', motor: 'Q0.0', sensors: [{ addr: 'I0.2', x: 330, kind: 'photo' }], feeder: true },
        program: H.P(H.R('# La cinta gira con MARCHA\nNO(I0.0) OUT(Q0.0)'), H.R('# Contar piezas\nNO(I0.2) CTU(C0,3) OUT(Q0.1)'), H.R('# Reiniciar la cuenta\nNO(I0.3) R(C0)'))
      },
      {
        type: 'guided', title: 'Cuenta piezas por lotes',
        html: '<p>Cada vez que pase una pieza por el sensor (simúlalo pulsando <b>SENSOR_PIEZA</b>), aumenta el contador. Cuando hayan pasado <b>5 piezas</b>, se enciende <b>LUZ_LOTE</b>. El botón <b>RESET</b> reinicia la cuenta.</p>',
        io: ioCount,
        steps: [
          { text: 'Contacto NO <code>SENSOR_PIEZA</code> en el segmento 1.', check: H.has({ type: 'NO', addr: 'I0.0' }), target: { ri: 0, r: 0, c: 0 } },
          { text: 'A su derecha, un bloque <b>CTU</b> (C0). En sus propiedades pon <b>PV = 5</b>.', check: H.has({ type: 'CTU', pv: 5 }), target: { ri: 0, r: 0, c: 1 } },
          { text: 'Bobina <code>LUZ_LOTE</code> al final del segmento 1.', check: H.rungWith([{ type: 'CTU' }, { type: 'OUT', addr: 'Q0.0' }]), target: { ri: 0, r: 0, c: 7 } },
          { text: '＋ Segmento: contacto NO <code>RESET</code> → bobina <b>(R)</b> con dirección <code>C0</code>.', check: H.rungWith([{ type: 'NO', addr: 'I0.1' }, { type: 'RST', addr: 'C0' }]) },
          { text: 'Ejecuta y pulsa SENSOR_PIEZA 5 veces mirando el valor CV.', live: function (c) { return !!c.world.outputs['Q0.0']; } }
        ],
        tests: countTests,
        hints: ['Cada pulsación del sensor es una pieza: necesitas contar.', 'Usa un <b>CTU</b> con PV = 5 y una bobina <b>(R) C0</b> para el reset.', { text: 'Así:', program: countSol }],
        solution: countSol,
        success: '<p>¡Bien! El CTU se encarga de detectar los flancos: una pieza = un pulso = +1.</p>'
      },
      {
        type: 'challenge', title: 'RETO: el contador no se reinicia',
        html: '<p class="challenge-tag">🐞 RETO DE DIAGNÓSTICO</p><p>El encargado de turno se queja:</p><blockquote>«Cuando se completa el lote pulso RESET… ¡y la luz no se apaga! El contador no se reinicia.»</blockquote><p>Encuentra el fallo. Pista: observa el valor CV mientras pulsas RESET.</p>',
        io: ioCount,
        initial: H.P(H.R('# Contar piezas: lote de 5\nNO(I0.0) CTU(C0,5) OUT(Q0.0)'), H.R('# Reiniciar el contador\nNO(I0.1) R(C1)')),
        tests: countTests,
        hints: ['El segmento de RESET se ejecuta (la bobina se pone verde), pero el contador no cambia.', 'Mira bien la <b>dirección</b> de la bobina (R).', 'La bobina (R) resetea C1, pero el contador que cuenta las piezas es C0.'],
        solution: countSol,
        success: '<p>Exacto: la bobina reseteaba <code>C1</code>, un contador que no existe en el programa. Un solo carácter mal puesto y la máquina no funciona: por eso un buen técnico revisa siempre las direcciones.</p>'
      },
      {
        type: 'free', title: 'Detén la cinta tras 10 piezas',
        html: '<p>Una cinta llena cajas de 10 piezas:</p><ul class="goals"><li><b>START</b> arranca la cinta (sigue al soltarlo); <b>STOP</b> la para.</li><li>Cada pieza que pasa por el <b>SENSOR</b> suma 1.</li><li>Cuando hayan pasado <b>10 piezas</b>, la cinta se detiene y <b>no puede arrancar</b> hasta pulsar <b>RESET</b>.</li></ul>',
        io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red'), H.sens('I0.2', 'SENSOR'), H.btn('I0.3', 'RESET', 'blue')], [H.motor('Q0.0', 'CINTA')], { counters: [H.mem('C0', 'PIEZAS')] }),
        scene: { type: 'conveyor', motor: 'Q0.0', sensors: [{ addr: 'I0.2', x: 330, kind: 'photo' }], feeder: true, autoFeed: false },
        tests: [
          { name: 'START arranca la cinta', steps: [{ pulse: 'START' }, { wait: 300 }, { expect: { CINTA: 1 }, fail: { title: 'La cinta no se mantiene en marcha tras START.', why: '', hint: 'START/STOP con auto-retención, como en el nivel 3.' } }] },
          { name: 'Se para tras 10 piezas', steps: [{ pulse: 'START' }].concat(H.repeat(9, { pulse: 'SENSOR', ms: 150 }), [
            { expect: { CINTA: 1 }, fail: { title: 'La cinta se ha parado antes de las 10 piezas.', why: '', hint: 'Revisa el PV del contador (10).' } },
            { pulse: 'SENSOR', ms: 150 },
            { expect: { CINTA: 0 }, fail: { title: 'La cinta no se detiene tras 10 piezas.', why: 'Cuando el contador llega a 10, su salida (contacto C0) se activa. Hay que usarla para cortar el segmento de la cinta.', hint: 'Añade un contacto NC de C0 en serie en el segmento de la cinta.' } },
            { pulse: 'START' },
            { expect: { CINTA: 0 }, fail: { title: 'La cinta vuelve a arrancar sin hacer RESET.', why: 'Mientras el contador esté completo (C0 = 1), START no debería poder arrancarla.', hint: 'El contacto NC de C0 debe estar en serie con TODO el segmento (también con la auto-retención).' } },
            { pulse: 'RESET' }, { pulse: 'START' },
            { expect: { CINTA: 1 }, fail: { title: 'Tras RESET la cinta no puede volver a arrancar.', why: 'RESET debe poner el contador a 0.', hint: 'RESET (NO) → (R) C0.' } }
          ]) },
          { name: 'STOP la detiene', steps: [{ pulse: 'START' }, { wait: 300 }, { pulse: 'STOP' }, { expect: { CINTA: 0 } }] }
        ],
        hints: ['Hay tres partes: marcha/paro de la cinta, el contador de piezas y el reset.', 'La cinta lleva un contacto <b>NC C0</b> en serie: cuando el contador termina, corta la corriente.', { text: 'Solución:', program: H.P(H.R('NO(I0.0) NC(I0.1) NC(C0) OUT(Q0.0)\nNO(Q0.0) |'), H.R('NO(I0.2) CTU(C0,10)'), H.R('NO(I0.3) R(C0)')) }],
        solution: H.P(H.R('# Cinta: marcha/paro, bloqueada si el lote está completo\nNO(I0.0) NC(I0.1) NC(C0) OUT(Q0.0)\nNO(Q0.0) |'), H.R('# Contar piezas\nNO(I0.2) CTU(C0,10)'), H.R('# Nuevo lote\nNO(I0.3) R(C0)')),
        success: '<p>¡Muy bien! El contacto <b>C0</b> sirve como una condición más: “lote completo”.</p>'
      },
      {
        type: 'test', title: 'Prueba final: dispensador de piezas',
        html: '<p>Un dispensador guarda <b>6 piezas</b>. Usa un contador <b>CTD</b>:</p><ul class="goals"><li>Cada vez que sale una pieza (<b>PIEZA_SALE</b>) quedan una menos.</li><li><b>LUZ_RESERVA</b> se enciende cuando quedan <b>2 o menos</b> (usa un comparador).</li><li><b>LUZ_VACIO</b> se enciende cuando no queda ninguna.</li><li><b>RECARGA</b> vuelve a llenarlo (6 piezas).</li></ul>',
        io: H.io([H.btn('I0.0', 'PIEZA_SALE'), H.btn('I0.1', 'RECARGA', 'blue')], [H.lamp('Q0.0', 'LUZ_VACIO', 'red'), H.lamp('Q0.1', 'LUZ_RESERVA', 'amber')], { counters: [H.mem('C0', 'QUEDAN')] }),
        requires: [{ check: function (p, F) { return F.has(p, { type: 'CTD' }); }, fail: { title: 'Este ejercicio pide un contador descendente (CTD).', why: 'Queremos contar "cuántas quedan": empezar en 6 e ir bajando.', hint: 'Coloca un bloque CTD con PV = 6.' } }, { check: function (p, F) { return F.has(p, { type: 'CMP' }); }, fail: { title: 'Falta un comparador para la reserva.', why: 'La luz de reserva depende de cuántas quedan (CV ≤ 2): eso es una comparación.', hint: 'Usa un bloque CMP: C0 <= 2.' } }],
        tests: [
          { name: 'Lleno: sin luces', steps: [{ wait: 100 }, { expect: { LUZ_VACIO: 0, LUZ_RESERVA: 0 }, fail: { title: 'Hay luces encendidas con el dispensador lleno.', why: 'Al empezar, el CTD vale CV = PV = 6.', hint: 'Comprueba PV = 6 y el comparador C0 <= 2.' } }] },
          { name: 'Reserva con 2 o menos', steps: H.repeat(3, { pulse: 'PIEZA_SALE', ms: 150 }).concat([{ expect: { LUZ_RESERVA: 0 }, fail: { title: 'La reserva se enciende con 3 piezas.', why: 'Quedan 3: aún no es reserva.', hint: 'El comparador debe ser C0 <= 2.' } }, { pulse: 'PIEZA_SALE', ms: 150 }, { expect: { LUZ_RESERVA: 1 }, fail: { title: 'La reserva no se enciende con 2 piezas.', why: 'Quedan 2 → la comparación C0 <= 2 es cierta.', hint: 'CMP(C0 <= 2) → LUZ_RESERVA.' } }]) },
          { name: 'Vacío con 0', steps: H.repeat(5, { pulse: 'PIEZA_SALE', ms: 150 }).concat([{ expect: { LUZ_VACIO: 0 } }, { pulse: 'PIEZA_SALE', ms: 150 }, { expect: { LUZ_VACIO: 1 }, fail: { title: 'LUZ_VACIO no se enciende al sacar la última pieza.', why: 'La salida del CTD se activa cuando CV llega a 0.', hint: 'PIEZA_SALE → CTD C0 (PV 6) → LUZ_VACIO.' } }]) },
          { name: 'RECARGA', steps: H.repeat(6, { pulse: 'PIEZA_SALE', ms: 150 }).concat([{ pulse: 'RECARGA' }, { expect: { LUZ_VACIO: 0, LUZ_RESERVA: 0 }, fail: { title: 'RECARGA no rellena el dispensador.', why: 'En un CTD, la bobina (R) recarga el valor: CV vuelve a PV.', hint: 'RECARGA (NO) → (R) C0.' } }]) }
        ],
        hints: ['Tres segmentos: el CTD, la reserva y la recarga.', 'CTD C0 con PV = 6. La reserva usa un <b>CMP C0 <= 2</b>. La recarga, una bobina <b>(R) C0</b>.', { text: 'Solución:', program: H.P(H.R('NO(I0.0) CTD(C0,6) OUT(Q0.0)'), H.R('CMP(C0,<=,2) OUT(Q0.1)'), H.R('NO(I0.1) R(C0)')) }],
        solution: H.P(H.R('# Quedan piezas: cuenta atrás\nNO(I0.0) CTD(C0,6) OUT(Q0.0)'), H.R('# Reserva: quedan 2 o menos\nCMP(C0,<=,2) OUT(Q0.1)'), H.R('# Recargar\nNO(I0.1) R(C0)')),
        success: '<p>¡Nivel 5 superado! Contadores y comparadores te permiten tomar decisiones basadas en <b>números</b>, no solo en sí/no.</p>'
      }
    ]
  });
})();
