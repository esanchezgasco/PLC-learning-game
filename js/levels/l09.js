/* NIVEL 9 — Automatización industrial */
(function () {
  'use strict';
  const H = PLC.H, A = PLC.art;

  const tankIO = H.io([H.sw('I0.0', 'AUTOMATICO'), H.sens('I0.2', 'NIVEL_BAJO'), H.sens('I0.3', 'NIVEL_ALTO'), H.sens('I0.4', 'REBOSE')], [H.pump('Q0.0', 'BOMBA'), H.lamp('Q0.1', 'ALARMA', 'red')]);
  const tankScene = { type: 'tank', pump: 'Q0.0', level: 50, consume: true, sensors: [{ addr: 'I0.2', level: 20 }, { addr: 'I0.3', level: 80 }, { addr: 'I0.4', level: 95 }] };
  const tankSol = H.P(H.R('# Bomba: automático, histéresis entre NIVEL_BAJO y NIVEL_ALTO, sin rebose\nNO(I0.0) NC(I0.2) NC(I0.3) NC(I0.4) OUT(Q0.0)\n. | NO(Q0.0) |'), H.R('# Alarma de rebose\nNO(I0.4) OUT(Q0.1)'));

  const trafficSol = H.P(
    H.R('# Ciclo: verde 4 s\nNO(I0.0) NC(T2) TON(T0,4)'),
    H.R('# ámbar 1 s\nNO(T0) TON(T1,1)'),
    H.R('# rojo 3 s\nNO(T1) TON(T2,3)'),
    H.R('# VERDE\nNO(I0.0) NC(T0) OUT(Q0.2)'),
    H.R('# ÁMBAR\nNO(T0) NC(T1) OUT(Q0.1)'),
    H.R('# ROJO\nNO(T1) OUT(Q0.0)')
  );

  const secIO = H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red'), H.estop('I0.2', 'SETA'), H.btn('I0.3', 'REARME', 'blue')], [H.motor('Q0.0', 'MOTOR'), H.lamp('Q0.1', 'LUZ_EMERGENCIA', 'red')], { memories: [H.mem('M0.0', 'EMERGENCIA')] });
  const secSol = H.P(
    H.R('# Motor: marcha/paro, seta OK y sin emergencia\nNO(I0.0) NC(I0.1) NO(I0.2) NC(M0.0) OUT(Q0.0)\nNO(Q0.0) |'),
    H.R('# Seta pulsada (señal a 0) → emergencia\nNC(I0.2) S(M0.0)'),
    H.R('# Rearme: solo con la seta desenclavada\nNO(I0.3) NO(I0.2) R(M0.0)'),
    H.R('# Luz de emergencia\nNO(M0.0) OUT(Q0.1)')
  );

  const sortIO = H.io(
    [H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red'), H.sens('I0.2', 'FOTOCELULA'), H.sens('I0.3', 'SENSOR_METAL'), H.sens('I0.4', 'CIL_FUERA'), H.sens('I0.5', 'CIL_DENTRO'), H.sens('I0.6', 'SENSOR_FINAL')],
    [H.motor('Q0.0', 'CINTA'), H.valve('Q0.1', 'CILINDRO')],
    { memories: [H.mem('M0.0', 'EN_MARCHA')], counters: [H.mem('C0', 'METALICAS'), H.mem('C1', 'PLASTICOS')] }
  );
  const sortScene = { type: 'conveyor', motor: 'Q0.0', types: ['metal', 'plastic'], sensors: [{ addr: 'I0.2', x: 420, kind: 'photo' }, { addr: 'I0.3', x: 420, kind: 'inductive' }, { addr: 'I0.6', x: 600, kind: 'photo' }], cylinder: { out: 'Q0.1', x: 420, ext: 'I0.4', ret: 'I0.5' }, feeder: true };
  const sortSol = H.P(
    H.R('# Marcha / paro\nNO(I0.0) NC(I0.1) OUT(M0.0)\nNO(M0.0) |'),
    H.R('# Cinta: en marcha, cilindro dentro y sin pieza metálica en la estación\nNO(M0.0) NO(I0.5) NC(I0.2) OUT(Q0.0)\n. . | NC(I0.3) |'),
    H.R('# Cilindro: pieza metálica en la estación\nNO(M0.0) NO(I0.2) NO(I0.3) OUT(Q0.1)'),
    H.R('# Contar metálicas\nNO(I0.2) NO(I0.3) CTU(C0,999)'),
    H.R('# Contar plásticos (llegan al final)\nNO(I0.6) CTU(C1,999)')
  );
  const cnt = function (a, n) { return function (c) { return c.cv(a) === n; }; };

  PLC.registerLevel({
    id: 9,
    icon: '⚙️',
    title: 'Automatización industrial',
    short: 'Depósitos, bombas, semáforos, seguridad y clasificación de piezas',
    tools: [],
    stages: [
      {
        type: 'intro', title: 'Instalaciones reales',
        html: '<p>Ya tienes todas las herramientas: contactos, memorias, temporizadores, contadores, secuencias y estados. Ahora toca combinarlas en <b>instalaciones industriales</b> reales: un depósito de agua, un semáforo industrial, un sistema de seguridad y una línea de clasificación de piezas.</p>' +
          A.devices([{ icon: 'motor', label: 'Bomba' }, { icon: 'sensor', label: 'Nivel' }, { icon: 'alarm', label: 'Seguridad' }, { icon: 'cylinder', label: 'Clasificador' }])
      },
      {
        type: 'concept', title: 'Sensores de nivel',
        html: '<p>Un <b>sensor de nivel</b> (por ejemplo, una boya) da <b>1 cuando el líquido llega a su altura</b>.</p><p>Con dos sensores, <b>NIVEL_BAJO</b> y <b>NIVEL_ALTO</b>, sabemos si el depósito está casi vacío, a medias o lleno.</p>',
        visual: A.truth(['NIVEL_BAJO', 'NIVEL_ALTO', 'Depósito'], [[0, 0, 'casi vacío'], [1, 0, 'a medias'], [1, 1, 'lleno']]),
        quiz: { q: 'NIVEL_BAJO = 0. ¿Cómo está el depósito?', options: ['Casi vacío: el agua no llega al sensor bajo', 'Lleno', 'A medias'], answer: 0, explain: 'Si ni siquiera el sensor más bajo detecta agua, el depósito está casi vacío.' }
      },
      {
        type: 'concept', title: 'Bombas y válvulas',
        html: '<p>Una <b>bomba</b> mueve líquido (llena el depósito). Una <b>válvula</b> abre o cierra el paso. Ambas son actuadores: el PLC las controla con salidas.</p>',
        quiz: { q: 'Para llenar un depósito, ¿qué salida activas?', options: ['La bomba', 'El sensor de nivel', 'El final de carrera'], answer: 0, explain: 'Los sensores son entradas: solo informan. La bomba es la que hace el trabajo.' }
      },
      {
        type: 'concept', title: 'Control con histéresis',
        html: '<p>Si la bomba se encendiera solo con “NIVEL_BAJO = 0”, se apagaría nada más cubrir el sensor y volvería a encenderse un segundo después: ¡arranca-para sin parar!</p><p>La solución: <b>arrancar abajo y parar arriba</b>. Una auto-retención mantiene la bomba entre los dos sensores. A esa “zona muerta” se le llama <b>histéresis</b>.</p><p class="tip">La auto-retención va en paralelo <b>solo con NIVEL_BAJO</b>; NIVEL_ALTO va después, en serie, para pararla.</p>',
        quiz: { q: 'El depósito está a medias y la bomba está llenando. ¿Qué debe hacer?', options: ['Seguir llenando hasta NIVEL_ALTO', 'Parar inmediatamente', 'Encenderse y apagarse'], answer: 0, explain: 'Con histéresis, la bomba sigue hasta el nivel alto. Así no arranca y para continuamente.' }
      },
      {
        type: 'concept', title: 'Intermitencia: luces parpadeantes',
        html: '<p>Una alarma se ve mucho mejor si <b>parpadea</b>. Se hace con dos temporizadores que se reinician mutuamente:</p><ul><li>T0 (TON 0,5 s) arranca cuando T1 está apagado.</li><li>T1 (TON 0,5 s) arranca cuando T0 termina, y al terminar reinicia a T0.</li></ul><p>La luz se enciende mientras T0 no ha terminado: 0,5 s encendida, 0,5 s apagada.</p>',
        demo: { io: H.io([H.sw('I0.0', 'ALARMA_ACTIVA')], [H.lamp('Q0.0', 'BALIZA', 'red')]), program: H.P(H.R('NO(I0.0) NC(T1) TON(T0,0.5)'), H.R('NO(T0) TON(T1,0.5)'), H.R('NO(I0.0) NC(T0) OUT(Q0.0)')), prompt: 'Activa ALARMA_ACTIVA y mira la baliza parpadear.' }
      },
      {
        type: 'concept', title: 'Paro de emergencia y cableado de seguridad',
        html: '<p>La <b>seta de emergencia</b> se cablea siempre como <b>NC</b>: la señal vale <b>1 cuando NO está pulsada</b> y 0 cuando se pulsa.</p><p>¿Por qué? Si se rompe un cable, el PLC lee 0… y la máquina <b>se para</b>. Es un diseño <b>a prueba de fallos</b>.</p><p class="tip">Atención: como la señal ya está invertida, en el programa “máquina OK” es un contacto <b>NO</b> de la seta.</p>',
        quiz: { q: 'La seta está cableada NC. Si se corta el cable, el PLC lee…', options: ['0 → la máquina se para (seguro)', '1 → la máquina sigue funcionando'], answer: 0, explain: 'Con cableado NC, cualquier fallo del cable equivale a pulsar la emergencia.' }
      },
      {
        type: 'concept', title: 'Rearme',
        html: '<p>Después de una emergencia, la máquina <b>no puede volver a arrancar sola</b> al desenclavar la seta. Hace falta:</p><ol><li>Desenclavar la seta.</li><li>Pulsar <b>REARME</b> (se borra la emergencia).</li><li>Pulsar <b>START</b> de nuevo.</li></ol><p>La emergencia se guarda en una memoria con SET, y el rearme la borra con RESET, solo si la seta ya no está pulsada.</p>',
        quiz: { q: 'Se desenclava la seta de emergencia. ¿Qué debe hacer la máquina?', options: ['Nada hasta que se rearme y se pulse START', 'Arrancar sola donde lo dejó'], answer: 0, explain: 'Un rearranque inesperado podría herir a alguien que esté trabajando en la máquina.' }
      },
      {
        type: 'example', title: 'Ejemplo: depósito con histéresis',
        html: '<p>La bomba llena el depósito cuando baja de <b>NIVEL_BAJO</b> y para al llegar a <b>NIVEL_ALTO</b>. La fábrica consume agua (puedes activar/desactivar el consumo).</p><p>Fíjate en la rama BOMBA: es la que mantiene la bomba en marcha mientras el nivel sube entre los dos sensores.</p>',
        io: H.io([H.sens('I0.2', 'NIVEL_BAJO'), H.sens('I0.3', 'NIVEL_ALTO')], [H.pump('Q0.0', 'BOMBA')]),
        scene: { type: 'tank', pump: 'Q0.0', level: 45, consume: true, sensors: [{ addr: 'I0.2', level: 20 }, { addr: 'I0.3', level: 80 }] },
        program: H.P(H.R('# Bomba con histéresis\nNC(I0.2) NC(I0.3) OUT(Q0.0)\nNO(Q0.0) |'))
      },
      {
        type: 'guided', title: 'Depósito con alarma de rebose',
        html: '<p>Programa el control del depósito:</p><ul class="goals"><li>Solo funciona con el selector <b>AUTOMATICO</b>.</li><li>Histéresis: la <b>BOMBA</b> arranca por debajo de NIVEL_BAJO y para en NIVEL_ALTO.</li><li>Si se activa <b>REBOSE</b> (95 %), la bomba se para siempre y se enciende la <b>ALARMA</b>.</li></ul>',
        io: tankIO,
        scene: tankScene,
        steps: [
          { text: 'Segmento 1: <code>AUTOMATICO</code> (NO) → <code>NIVEL_BAJO</code> (NC) → bobina <code>BOMBA</code>.', check: H.rungWith([{ type: 'NO', addr: 'I0.0' }, { type: 'NC', addr: 'I0.2' }, { type: 'OUT', addr: 'Q0.0' }]) },
          { text: 'Añade en serie <code>NIVEL_ALTO</code> (NC) y <code>REBOSE</code> (NC).', check: H.rungWith([{ type: 'NC', addr: 'I0.3' }, { type: 'NC', addr: 'I0.4' }, { type: 'OUT', addr: 'Q0.0' }]) },
          { text: 'Histéresis: ＋ Rama y un contacto NO <code>BOMBA</code> justo <b>debajo de NIVEL_BAJO</b>, unido con ● a la izquierda y a la derecha.', check: H.parallel({ type: 'NO', addr: 'Q0.0' }) },
          { text: 'Segmento 2: <code>REBOSE</code> (NO) → <code>ALARMA</code>.', check: H.rungWith([{ type: 'NO', addr: 'I0.4' }, { type: 'OUT', addr: 'Q0.1' }]) },
          { text: 'Ejecuta con AUTOMATICO activado y observa un ciclo de llenado.', live: function (c) { return !!c.world.outputs['Q0.0'] && c.world.scene.level > 50; } }
        ],
        tests: [
          { name: 'Sin AUTOMATICO no hace nada', steps: [{ wait: 6000 }, { expect: { BOMBA: 0 } }] },
          { name: 'Histéresis', steps: [
            { set: { AUTOMATICO: 1 } }, { expect: { BOMBA: 0 }, fail: { title: 'La bomba arranca con el depósito a medias.', why: 'Solo debe arrancar cuando el nivel baja de NIVEL_BAJO.', hint: 'NIVEL_BAJO como contacto NC.' } },
            { until: { BOMBA: 1 }, timeout: 9000, fail: { title: 'La bomba no arranca cuando el nivel baja de NIVEL_BAJO.' } },
            { during: { BOMBA: 1 }, ms: 3000, fail: { title: 'La bomba se para nada más cubrir NIVEL_BAJO.', why: 'Sin histéresis, en cuanto el agua cubre el sensor bajo la bomba se para… y vuelve a arrancar. ¡Arranca-para continuo!', hint: 'Auto-retención: contacto BOMBA en paralelo SOLO con NIVEL_BAJO.' } },
            { until: { BOMBA: 0 }, timeout: 15000, fail: { title: 'La bomba no se para al llegar a NIVEL_ALTO.', hint: 'NIVEL_ALTO como contacto NC en serie, después del paralelo.' } },
            { check: function (c) { return c.scene.level >= 78; }, fail: { title: 'La bomba se ha parado antes de llenar el depósito.' } }
          ] },
          { name: 'Rebose', steps: [{ set: { AUTOMATICO: 1 } }, { until: { BOMBA: 1 }, timeout: 9000 }, { set: { REBOSE: 1 } }, { expect: { BOMBA: 0 }, fail: { title: '¡La bomba sigue funcionando con el depósito rebosando!', hint: 'REBOSE como contacto NC en serie con la bomba.' } }, { expect: { ALARMA: 1 }, fail: { title: 'La ALARMA no se enciende con el rebose.' } }] }
        ],
        hints: ['La bomba tiene cuatro condiciones en serie y una auto-retención.', 'AUTOMATICO · (NC NIVEL_BAJO <b>o</b> BOMBA) · NC NIVEL_ALTO · NC REBOSE.', { text: 'Solución:', program: tankSol }],
        solution: tankSol,
        success: '<p>¡Control de nivel profesional! Así funcionan los depósitos de agua de edificios, granjas y fábricas.</p>'
      },
      {
        type: 'free', title: 'Semáforo industrial',
        html: '<p>Un semáforo regula la salida de camiones de la fábrica. Mientras <b>MARCHA</b> esté activado, repite el ciclo:</p><ol><li><b>VERDE</b> 4 s</li><li><b>AMBAR</b> 1 s</li><li><b>ROJO</b> 3 s</li></ol><p>Con MARCHA desactivado, todo apagado. Nunca dos luces a la vez.</p>',
        io: H.io([H.sw('I0.0', 'MARCHA')], [H.lamp('Q0.0', 'ROJO', 'red'), H.lamp('Q0.1', 'AMBAR', 'amber'), H.lamp('Q0.2', 'VERDE', 'green')]),
        scene: { type: 'traffic', red: 'Q0.0', yellow: 'Q0.1', green: 'Q0.2' },
        invariants: [{ check: function (c) { return (c.q('ROJO') ? 1 : 0) + (c.q('AMBAR') ? 1 : 0) + (c.q('VERDE') ? 1 : 0) <= 1; }, fail: { title: 'Hay dos luces del semáforo encendidas a la vez.', why: 'Un semáforo con dos colores confunde a los conductores.', hint: 'Cada luz debe depender de una fase distinta del ciclo.' } }],
        tests: [
          { name: 'Ciclo verde → ámbar → rojo → verde', steps: [
            { set: { MARCHA: 1 } }, { expect: { VERDE: 1 }, fail: { title: 'No empieza en VERDE.' } },
            { wait: 3500 }, { expect: { VERDE: 1 }, fail: { title: 'El VERDE dura menos de 4 s.' } },
            { wait: 700 }, { expect: { AMBAR: 1 }, fail: { title: 'A los 4 s no pasa a ÁMBAR.' } },
            { wait: 1000 }, { expect: { ROJO: 1 }, fail: { title: 'El ÁMBAR no dura 1 s (o no pasa a ROJO).' } },
            { wait: 2400 }, { expect: { ROJO: 1 }, fail: { title: 'El ROJO dura menos de 3 s.' } },
            { wait: 800 }, { expect: { VERDE: 1 }, fail: { title: 'El ciclo no vuelve a empezar en VERDE.', hint: 'Cuando termina el rojo, hay que reiniciar los temporizadores (NC del último temporizador en la entrada del primero).' } },
            { set: { MARCHA: 0 } }, { expect: { VERDE: 0, AMBAR: 0, ROJO: 0 }, fail: { title: 'Con MARCHA desactivado, el semáforo no se apaga.' } }
          ] }
        ],
        hints: ['Puedes hacerlo con tres temporizadores encadenados: cada uno arranca cuando termina el anterior.', 'T0 (4 s) arranca con MARCHA y NC T2. T1 (1 s) con T0. T2 (3 s) con T1. VERDE = MARCHA y NC T0; ÁMBAR = T0 y NC T1; ROJO = T1.', { text: 'Solución:', program: trafficSol }],
        solution: trafficSol,
        success: '<p>¡Semáforo funcionando! Los temporizadores encadenados son una forma compacta de hacer ciclos que se repiten.</p>'
      },
      {
        type: 'challenge', title: 'RETO: el sistema de seguridad no deja arrancar',
        html: '<p class="challenge-tag">🐞 RETO DE DIAGNÓSTICO · 2 averías</p><p>Un técnico nuevo ha programado la seguridad de una máquina:</p><ul><li>START/STOP del MOTOR con auto-retención.</li><li>Si se pulsa la <b>SETA</b> (cableada NC), se activa la EMERGENCIA: el motor se para y se enciende LUZ_EMERGENCIA.</li><li>Tras desenclavar la seta, <b>REARME</b> borra la emergencia.</li></ul><blockquote>«La luz de emergencia está siempre encendida y el motor no arranca nunca, aunque nadie toca la seta.»</blockquote><p>Hay <b>dos</b> fallos. Recuerda cómo funciona el cableado NC.</p>',
        io: secIO,
        initial: H.P(
          H.R('# Motor: marcha/paro, seta OK y sin emergencia\nNO(I0.0) NC(I0.1) NC(I0.2) NC(M0.0) OUT(Q0.0)\nNO(Q0.0) |'),
          H.R('# Seta pulsada → emergencia\nNO(I0.2) S(M0.0)'),
          H.R('# Rearme: solo con la seta desenclavada\nNO(I0.3) NO(I0.2) R(M0.0)'),
          H.R('# Luz de emergencia\nNO(M0.0) OUT(Q0.1)')
        ),
        tests: [
          { name: 'Sin emergencia: el motor arranca', steps: [{ wait: 100 }, { expect: { LUZ_EMERGENCIA: 0 }, fail: { title: 'La luz de emergencia está encendida sin que nadie pulse la seta.', why: 'Nadie ha pulsado la seta y, aun así, la memoria EMERGENCIA se ha activado. El segmento que detecta la seta pulsada no está interpretando bien su señal.', hint: 'Recuerda que la seta está cableada NC. Mira en 🔧 DEBUG cuánto vale I0.2 sin pulsarla.' } }, { pulse: 'START' }, { expect: { MOTOR: 1 }, fail: { title: 'El motor no arranca aunque la seta está desenclavada.', why: 'Con la seta sin pulsar y sin emergencia, START debería arrancar el motor, pero algún contacto del segmento 1 corta la corriente.', hint: 'Ejecuta con 🔧 DEBUG, pulsa START y busca el contacto que no se rellena de verde. ¿Por qué está abierto?' } }] },
          { name: 'Emergencia y rearme', steps: [
            { pulse: 'START' }, { set: { SETA: 1 } }, { expect: { MOTOR: 0, LUZ_EMERGENCIA: 1 }, fail: { title: 'Al pulsar la seta no se activa la emergencia.' } },
            { set: { SETA: 0 } }, { expect: { LUZ_EMERGENCIA: 1 }, fail: { title: 'La emergencia se borra sola al desenclavar la seta.' } },
            { pulse: 'START' }, { expect: { MOTOR: 0 }, fail: { title: 'El motor arranca sin rearmar.' } },
            { pulse: 'REARME' }, { expect: { LUZ_EMERGENCIA: 0 }, fail: { title: 'REARME no borra la emergencia.' } },
            { pulse: 'START' }, { expect: { MOTOR: 1 }, fail: { title: 'Tras el rearme, el motor no arranca.' } }
          ] },
          { name: 'No se puede rearmar con la seta pulsada', steps: [{ set: { SETA: 1 } }, { pulse: 'REARME' }, { expect: { LUZ_EMERGENCIA: 1 }, fail: { title: 'Se ha podido rearmar con la seta todavía pulsada.' } }] }
        ],
        hints: ['Activa 🔧 DEBUG: ¿cuánto vale I0.2 con la seta SIN pulsar?', 'I0.2 vale 1 cuando todo está bien (cableado NC). Revisa los dos primeros segmentos: ¿qué contacto deja pasar con un 1 y cuál con un 0?', 'Segmento 1: la seta debe ser un contacto NO (pasa si OK). Segmento 2: la emergencia se activa con un contacto NC de la seta (pasa si está pulsada).'],
        solution: secSol,
        success: '<p>¡Las dos averías resueltas! El cableado NC de seguridad “invierte” la lógica: es uno de los errores más típicos al programar paros de emergencia.</p>'
      },
      {
        type: 'test', title: 'Prueba final: clasificación de piezas',
        html: '<p>Una línea separa las piezas <b>metálicas</b> de las de <b>plástico</b>:</p><ul class="goals"><li><b>START</b>/<b>STOP</b>: memoria EN_MARCHA.</li><li>En la estación hay una <b>FOTOCELULA</b> (cualquier pieza) y un <b>SENSOR_METAL</b> (inductivo).</li><li>Pieza <b>metálica</b> en la estación → la cinta se para y el <b>CILINDRO</b> la empuja a la caja lateral. La cinta solo vuelve a moverse con el cilindro dentro (<b>CIL_DENTRO</b>).</li><li>Pieza de <b>plástico</b> → sigue hasta la caja final.</li><li>Cuenta las metálicas en <b>C0</b> y las de plástico (al pasar por SENSOR_FINAL) en <b>C1</b>.</li></ul>',
        io: sortIO,
        scene: sortScene,
        tests: [
          { name: 'Una pieza metálica va a la caja lateral', steps: [
            { pulse: 'START' }, { expect: { CINTA: 1 }, fail: { title: 'La cinta no arranca con START.' } }, { spawn: 'metal' },
            { until: { CILINDRO: 1 }, timeout: 8000, fail: { title: 'El cilindro no empuja la pieza metálica.', hint: 'Cilindro = EN_MARCHA y FOTOCELULA y SENSOR_METAL.' } },
            { expect: { CINTA: 0 }, fail: { title: 'La cinta no se para mientras el cilindro empuja.' } },
            { until: { CINTA: 1 }, timeout: 3000, fail: { title: 'La cinta no vuelve a arrancar después de expulsar.', hint: 'Cinta = EN_MARCHA y CIL_DENTRO y NO(pieza metálica en la estación).' } },
            { check: H.bins(1, 0), fail: { title: 'La pieza metálica no ha llegado a la caja lateral.' } },
            { check: cnt('C0', 1), fail: { title: 'El contador C0 no vale 1 tras una pieza metálica.', hint: 'FOTOCELULA y SENSOR_METAL → CTU C0.' } }
          ] },
          { name: 'Una pieza de plástico sigue hasta el final', steps: [
            { pulse: 'START' }, { spawn: 'plastic' },
            { during: { CILINDRO: 0 }, ms: 8500, fail: { title: 'El cilindro empuja una pieza de plástico.', why: 'Solo hay que expulsar las metálicas: el sensor inductivo solo da 1 con metal.', hint: 'Añade SENSOR_METAL (NO) en serie con el cilindro.' } },
            { check: H.bins(0, 1), fail: { title: 'La pieza de plástico no ha llegado a la caja final.', hint: 'La cinta no debe pararse con piezas de plástico.' } },
            { check: cnt('C1', 1), fail: { title: 'El contador C1 no vale 1 tras una pieza de plástico.', hint: 'SENSOR_FINAL → CTU C1.' } }
          ] },
          { name: 'Producción mixta', steps: [
            { pulse: 'START' }, { spawn: 'metal' }, { wait: 1600 }, { spawn: 'plastic' }, { wait: 1600 }, { spawn: 'metal' }, { wait: 1600 }, { spawn: 'plastic' }, { wait: 14000 },
            { check: H.bins(2, 2), fail: function (c) { return { title: 'Clasificación incorrecta: caja lateral ' + c.scene.binSide + ', caja final ' + c.scene.binEnd + ' (se esperaba 2 y 2).' }; } },
            { check: function (c) { return c.cv('C0') === 2 && c.cv('C1') === 2; }, fail: function (c) { return { title: 'Contadores incorrectos: C0 = ' + c.cv('C0') + ', C1 = ' + c.cv('C1') + ' (se esperaba 2 y 2).' }; } }
          ] },
          { name: 'STOP', steps: [{ pulse: 'START' }, { wait: 200 }, { pulse: 'STOP' }, { spawn: 'plastic' }, { wait: 3000 }, { expect: { CINTA: 0 }, fail: { title: 'La cinta sigue con STOP.' } }] }
        ],
        hints: ['Cinco segmentos: marcha, cinta, cilindro y dos contadores.', 'Cinta: EN_MARCHA · CIL_DENTRO · (NC FOTOCELULA <b>o</b> NC SENSOR_METAL). Es decir: se para solo si hay pieza Y es metálica.', { text: 'Solución:', program: sortSol }],
        solution: sortSol,
        success: '<p>¡Nivel 9 superado! Tu línea detecta, identifica, clasifica y cuenta piezas. Solo queda el reto final…</p>'
      }
    ]
  });
})();
