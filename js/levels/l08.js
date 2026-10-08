/* NIVEL 8 — Estados y máquinas */
(function () {
  'use strict';
  const H = PLC.H, A = PLC.art;

  const doorIO = H.io(
    [H.sens('I0.0', 'PRESENCIA'), H.sens('I0.1', 'FC_ABIERTA'), H.sens('I0.2', 'FC_CERRADA')],
    [H.motor('Q0.0', 'MOTOR_ABRIR'), H.motor('Q0.1', 'MOTOR_CERRAR')],
    { memories: [H.mem('M0.0', 'CERRADA'), H.mem('M0.1', 'ABRIENDO'), H.mem('M0.2', 'ABIERTA'), H.mem('M0.3', 'CERRANDO')] }
  );
  const doorScene = { type: 'axis', skin: 'door', plus: 'Q0.0', minus: 'Q0.1', limMax: 'I0.1', limMin: 'I0.2', presence: 'I0.0', speed: 0.5, start: 0 };
  const D = {
    init: H.R('# Estado inicial: si no hay ningún estado activo → CERRADA\nNC(M0.0) NC(M0.1) NC(M0.2) NC(M0.3) S(M0.0)'),
    t1: H.R('# CERRADA → ABRIENDO: alguien se acerca\nNO(M0.0) NO(I0.0) S(M0.1)\n|> R(M0.0)'),
    t2: H.R('# ABRIENDO → ABIERTA: final de carrera\nNO(M0.1) NO(I0.1) S(M0.2)\n|> R(M0.1)'),
    t3: H.R('# ABIERTA → CERRANDO: 3 s sin nadie\nNO(M0.2) NC(I0.0) TON(T0,3) S(M0.3)\n|> R(M0.2)'),
    t4: H.R('# CERRANDO → CERRADA: final de carrera\nNO(M0.3) NO(I0.2) S(M0.0)\n|> R(M0.3)'),
    a1: H.R('# Acción: abrir\nNO(M0.1) OUT(Q0.0)'),
    a2: H.R('# Acción: cerrar\nNO(M0.3) OUT(Q0.1)')
  };

  const coffeeIO = H.io([H.btn('I0.0', 'MONEDA', 'blue'), H.btn('I0.1', 'BOTON_CAFE')], [H.lamp('Q0.0', 'LUZ_LISTO', 'green'), H.pump('Q0.1', 'BOMBA_CAFE'), H.lamp('Q0.2', 'LUZ_SERVIDO', 'blue')], { memories: [H.mem('M0.0', 'REPOSO'), H.mem('M0.1', 'LISTO'), H.mem('M0.2', 'PREPARANDO'), H.mem('M0.3', 'SERVIDO')] });
  const coffeeSol = H.P(
    H.R('# Estado inicial\nNC(M0.0) NC(M0.1) NC(M0.2) NC(M0.3) S(M0.0)'),
    H.R('# REPOSO → LISTO: moneda\nNO(M0.0) NO(I0.0) S(M0.1)\n|> R(M0.0)'),
    H.R('# LISTO → PREPARANDO: botón\nNO(M0.1) NO(I0.1) S(M0.2)\n|> R(M0.1)'),
    H.R('# PREPARANDO → SERVIDO: 4 s\nNO(M0.2) TON(T0,4) S(M0.3)\n|> R(M0.2)'),
    H.R('# SERVIDO → REPOSO: 3 s\nNO(M0.3) TON(T1,3) S(M0.0)\n|> R(M0.3)'),
    H.R('# Acciones\nNO(M0.1) OUT(Q0.0)'), H.R('NO(M0.2) OUT(Q0.1)'), H.R('NO(M0.3) OUT(Q0.2)')
  );

  const liftIO = H.io([H.btn('I0.0', 'LLAMADA_P0'), H.btn('I0.1', 'LLAMADA_P1'), H.sens('I0.2', 'FC_P0'), H.sens('I0.3', 'FC_P1')], [H.motor('Q0.0', 'SUBIR'), H.motor('Q0.1', 'BAJAR'), H.lamp('Q0.2', 'LUZ_MOVIMIENTO', 'amber')], { memories: [H.mem('M0.0', 'EN_P0'), H.mem('M0.1', 'SUBIENDO'), H.mem('M0.2', 'EN_P1'), H.mem('M0.3', 'BAJANDO')] });
  const liftSol = H.P(
    H.R('# Estado inicial\nNC(M0.0) NC(M0.1) NC(M0.2) NC(M0.3) S(M0.0)'),
    H.R('# EN_P0 → SUBIENDO\nNO(M0.0) NO(I0.1) S(M0.1)\n|> R(M0.0)'),
    H.R('# SUBIENDO → EN_P1\nNO(M0.1) NO(I0.3) S(M0.2)\n|> R(M0.1)'),
    H.R('# EN_P1 → BAJANDO\nNO(M0.2) NO(I0.0) S(M0.3)\n|> R(M0.2)'),
    H.R('# BAJANDO → EN_P0\nNO(M0.3) NO(I0.2) S(M0.0)\n|> R(M0.3)'),
    H.R('# Acciones\nNO(M0.1) OUT(Q0.0)'), H.R('NO(M0.3) OUT(Q0.1)'), H.R('NO(M0.1) OUT(Q0.2)\nNO(M0.3) |')
  );

  PLC.registerLevel({
    id: 8,
    icon: '🔀',
    title: 'Estados y máquinas',
    short: 'Estados, transiciones, condiciones y máquinas de estados',
    tools: [],
    stages: [
      {
        type: 'intro', title: 'Pensar en estados',
        html: '<p>Una puerta automática puede estar <b>cerrada</b>, <b>abriéndose</b>, <b>abierta</b> o <b>cerrándose</b>. En cada situación hace una cosa distinta y reacciona a cosas distintas.</p><p>Esta forma de pensar se llama <b>máquina de estados</b>, y es la herramienta favorita de los programadores de PLC para máquinas complejas.</p>' +
          A.states([{ name: 'CERRADA', cond: 'presencia' }, { name: 'ABRIENDO', cond: 'FC abierta' }, { name: 'ABIERTA', cond: '3 s sin nadie' }, { name: 'CERRANDO', cond: 'FC cerrada' }])
      },
      {
        type: 'concept', title: 'Estado',
        html: '<p>Un <b>estado</b> es la situación en la que está la máquina: qué está haciendo <b>ahora</b>.</p><p>Como en las secuencias, cada estado se guarda en una memoria (<code>M0.0</code> = CERRADA…) y solo hay <b>uno activo</b> a la vez.</p>',
        quiz: { q: 'La puerta está ABRIENDO. ¿Puede estar también ABIERTA?', options: ['No: solo hay un estado activo a la vez', 'Sí, a veces'], answer: 0, explain: 'Un estado describe la situación actual. Si hubiera dos a la vez, la máquina no sabría qué hacer.' }
      },
      {
        type: 'concept', title: 'Transición',
        html: '<p>Una <b>transición</b> es el cambio de un estado a otro. Se programa igual que en las secuencias: <code>estado actual + condición → (S) nuevo estado, (R) estado actual</code>.</p><p>La diferencia: desde un estado puede haber <b>varias</b> transiciones posibles a estados distintos.</p>',
        quiz: { q: '¿Qué hace el segmento de una transición?', options: ['Activa el nuevo estado y desactiva el actual', 'Enciende el motor', 'Cuenta piezas'], answer: 0, explain: 'SET del nuevo estado y RESET del actual, en el mismo segmento.' }
      },
      {
        type: 'concept', title: 'Condición',
        html: '<p>La <b>condición</b> es lo que tiene que ocurrir para cambiar de estado: un sensor, un final de carrera, un botón, un tiempo, un contador…</p><p>Puede combinar varias cosas con AND, OR y NOT. Ejemplo: “han pasado 3 s <b>y</b> no hay nadie”.</p>',
        quiz: { q: 'En la puerta, ¿cuál es la condición para pasar de ABRIENDO a ABIERTA?', options: ['Que se active el final de carrera FC_ABIERTA', 'Que pasen 3 segundos', 'Que alguien se acerque'], answer: 0, explain: 'Sabemos que la puerta está totalmente abierta gracias al final de carrera.' }
      },
      {
        type: 'concept', title: 'Máquina de estados',
        html: '<p>Para programar una máquina de estados sigue siempre este orden:</p><ol><li><b>Estado inicial</b>: si no hay ninguno activo, activa el de reposo.</li><li><b>Transiciones</b>: un segmento por cada flecha del diagrama.</li><li><b>Acciones</b>: cada salida, con los estados en los que debe estar activa.</li></ol>',
        visual: A.states([{ name: 'APAGADA', cond: 'pulsador' }, { name: 'ENCENDIDA', cond: '4 s' }], { h: 160 }),
        quiz: { q: '¿Qué segmento va primero?', options: ['El del estado inicial', 'Las acciones', 'Da igual, no hay estado inicial'], answer: 0, explain: 'Así, al arrancar el PLC (todas las memorias a 0), la máquina entra en su estado de reposo.' }
      },
      {
        type: 'concept', title: 'Enclavamiento',
        html: '<p>Algunas salidas <b>nunca</b> pueden activarse a la vez: abrir y cerrar, subir y bajar… Si ocurriera, el motor se quemaría o la máquina se rompería.</p><p>Con una máquina de estados bien hecha esto no pasa: ABRIR solo se activa en ABRIENDO y CERRAR solo en CERRANDO, y nunca hay dos estados a la vez. Esto se llama <b>enclavamiento</b>.</p>',
        quiz: { q: '¿Por qué una máquina de estados ayuda a no activar ABRIR y CERRAR a la vez?', options: ['Porque cada salida pertenece a un estado y solo hay uno activo', 'Porque los motores no se pueden romper', 'No ayuda'], answer: 0, explain: 'Un solo estado activo = una sola orden de movimiento.' }
      },
      {
        type: 'example', title: 'Ejemplo: luz de garaje',
        html: '<p>Una máquina de dos estados: <b>APAGADA</b> y <b>ENCENDIDA</b>.</p><ul><li>APAGADA + PULSADOR → ENCENDIDA.</li><li>ENCENDIDA + 4 s → APAGADA.</li></ul><p>Activa 🔧 DEBUG y mira cómo cambia el estado activo.</p>',
        io: H.io([H.btn('I0.0', 'PULSADOR')], [H.lamp('Q0.0', 'LUZ')], { memories: [H.mem('M0.0', 'APAGADA'), H.mem('M0.1', 'ENCENDIDA')] }),
        program: H.P(H.R('# Estado inicial\nNC(M0.0) NC(M0.1) S(M0.0)'), H.R('# APAGADA → ENCENDIDA\nNO(M0.0) NO(I0.0) S(M0.1)\n|> R(M0.0)'), H.R('# ENCENDIDA → APAGADA (4 s)\nNO(M0.1) TON(T0,4) S(M0.0)\n|> R(M0.1)'), H.R('# Acción\nNO(M0.1) OUT(Q0.0)'))
      },
      {
        type: 'guided', title: 'Programa una puerta automática',
        html: '<p>Estados: <b>CERRADA → ABRIENDO → ABIERTA → CERRANDO → CERRADA</b>.</p><p>Ya tienes el estado inicial, la primera transición y las acciones. Completa las transiciones que faltan.</p><p class="muted">Haz clic sobre la escena para que se acerque o se aleje una persona (sensor PRESENCIA).</p>',
        io: doorIO,
        scene: doorScene,
        invariants: [H.noBoth('MOTOR_ABRIR', 'MOTOR_CERRAR', '¡Abrir y cerrar a la vez!')],
        initial: H.P(D.init, D.t1, D.a1, D.a2),
        steps: [
          { text: 'ABRIENDO → ABIERTA: <code>ABRIENDO (M0.1)</code> y <code>FC_ABIERTA (I0.1)</code> → (S) <code>ABIERTA</code>, (R) <code>ABRIENDO</code>.', check: H.rungWith([{ type: 'NO', addr: 'M0.1' }, { type: 'NO', addr: 'I0.1' }, { type: 'SET', addr: 'M0.2' }, { type: 'RST', addr: 'M0.1' }]) },
          { text: 'ABIERTA → CERRANDO: <code>ABIERTA</code>, <code>PRESENCIA</code> en <b>NC</b> y un <b>TON T0 de 3 s</b> → (S) <code>CERRANDO</code>, (R) <code>ABIERTA</code>.', check: H.rungWith([{ type: 'NO', addr: 'M0.2' }, { type: 'TON', pt: 3 }, { type: 'SET', addr: 'M0.3' }, { type: 'RST', addr: 'M0.2' }]) },
          { text: 'CERRANDO → CERRADA: <code>CERRANDO</code> y <code>FC_CERRADA</code> → (S) <code>CERRADA</code>, (R) <code>CERRANDO</code>.', check: H.rungWith([{ type: 'NO', addr: 'M0.3' }, { type: 'NO', addr: 'I0.2' }, { type: 'SET', addr: 'M0.0' }, { type: 'RST', addr: 'M0.3' }]) },
          { text: 'Ejecuta y prueba un ciclo completo de la puerta.', live: function (c) { return !!c.engine && !!c.engine.M['M0.3'] && c.sim.running; } }
        ],
        tests: [
          { name: 'Abre, espera 3 s y cierra', steps: [
            { set: { PRESENCIA: 1 } }, { expect: { MOTOR_ABRIR: 1 }, fail: { title: 'La puerta no empieza a abrirse con alguien delante.' } },
            { until: { FC_ABIERTA: 1 }, timeout: 3000 }, { wait: 40 },
            { expect: { MOTOR_ABRIR: 0 }, fail: { title: 'El motor sigue abriendo con la puerta ya abierta.', why: 'Al llegar a FC_ABIERTA hay que pasar al estado ABIERTA, que no mueve el motor.', hint: 'Transición ABRIENDO → ABIERTA con FC_ABIERTA.' } },
            { set: { PRESENCIA: 0 } },
            { during: { MOTOR_CERRAR: 0 }, ms: 2600, fail: { title: 'La puerta se cierra antes de 3 s.', hint: 'TON T0 de 3 s en la transición ABIERTA → CERRANDO.' } },
            { until: { MOTOR_CERRAR: 1 }, timeout: 800, fail: { title: 'La puerta no se cierra tras 3 s sin nadie.', hint: 'ABIERTA, NC PRESENCIA, TON 3 s → (S) CERRANDO, (R) ABIERTA.' } },
            { until: { FC_CERRADA: 1 }, timeout: 3000 }, { wait: 40 },
            { expect: { MOTOR_CERRAR: 0 }, fail: { title: 'El motor sigue cerrando con la puerta ya cerrada.', hint: 'Transición CERRANDO → CERRADA con FC_CERRADA.' } },
            { set: { PRESENCIA: 1 } }, { expect: { MOTOR_ABRIR: 1 }, fail: { title: 'Tras un ciclo, la puerta no vuelve a abrirse.', why: 'Al cerrar debe volver al estado CERRADA, desde donde puede abrir de nuevo.' } }
          ] },
          { name: 'Con alguien delante sigue abierta', steps: [{ set: { PRESENCIA: 1 } }, { until: { FC_ABIERTA: 1 }, timeout: 3000 }, { during: { MOTOR_CERRAR: 0 }, ms: 6000, fail: { title: '¡La puerta se cierra con una persona delante!', why: 'El tiempo de 3 s solo debe contar cuando NO hay nadie.', hint: 'Pon un contacto NC de PRESENCIA antes del TON.' } }] }
        ],
        hints: ['Cada flecha del diagrama es un segmento: estado actual + condición → (S) siguiente, (R) actual.', 'Condiciones: FC_ABIERTA; 3 s sin PRESENCIA (NC PRESENCIA + TON 3 s); FC_CERRADA.', { text: 'Los tres segmentos:', program: H.P(D.t2, D.t3, D.t4) }],
        solution: H.P(D.init, D.t1, D.t2, D.t3, D.t4, D.a1, D.a2),
        success: '<p>¡Tu puerta automática funciona! 💡 <b>Mejora opcional:</b> en la vida real, si alguien aparece mientras la puerta se CIERRA, debe volver a ABRIENDO. ¿Sabrías añadir esa transición?</p>'
      },
      {
        type: 'free', title: 'Máquina de café',
        html: '<p>Programa una máquina de café con 4 estados:</p>' + A.states([{ name: 'REPOSO', cond: 'moneda' }, { name: 'LISTO', cond: 'botón' }, { name: 'PREPARANDO', cond: '4 s' }, { name: 'SERVIDO', cond: '3 s' }], { h: 200 }) +
          '<ul class="goals"><li>LISTO → <b>LUZ_LISTO</b></li><li>PREPARANDO → <b>BOMBA_CAFE</b> (4 s)</li><li>SERVIDO → <b>LUZ_SERVIDO</b> (3 s)</li><li>Sin moneda, el botón no hace nada.</li></ul>',
        io: coffeeIO,
        tests: [
          { name: 'Sin moneda no hay café', steps: [{ pulse: 'BOTON_CAFE' }, { during: { BOMBA_CAFE: 0, LUZ_LISTO: 0 }, ms: 1000, fail: { title: '¡Café gratis! La máquina funciona sin moneda.', hint: 'El botón solo debe actuar en el estado LISTO.' } }] },
          { name: 'Ciclo completo', steps: [
            { pulse: 'MONEDA' }, { expect: { LUZ_LISTO: 1 }, fail: { title: 'Tras echar la moneda no se enciende LUZ_LISTO.', hint: 'REPOSO + MONEDA → LISTO; LISTO → LUZ_LISTO.' } },
            { pulse: 'BOTON_CAFE' }, { expect: { BOMBA_CAFE: 1, LUZ_LISTO: 0 }, fail: { title: 'Al pulsar el botón no empieza a preparar.' } },
            { during: { BOMBA_CAFE: 1 }, ms: 3300, fail: { title: 'La bomba no funciona 4 s.' } },
            { until: { LUZ_SERVIDO: 1 }, timeout: 900, fail: { title: 'No pasa a SERVIDO tras 4 s.' } }, { expect: { BOMBA_CAFE: 0 } },
            { during: { LUZ_SERVIDO: 1 }, ms: 2500 }, { until: { LUZ_SERVIDO: 0 }, timeout: 1000, fail: { title: 'No vuelve a REPOSO tras 3 s.' } },
            { pulse: 'BOTON_CAFE' }, { during: { BOMBA_CAFE: 0 }, ms: 800, fail: { title: 'Hace otro café sin moneda.', why: 'Después de SERVIDO hay que volver a REPOSO, no a LISTO.' } },
            { pulse: 'MONEDA' }, { expect: { LUZ_LISTO: 1 } }
          ] }
        ],
        hints: ['Sigue el orden: estado inicial, transiciones, acciones.', 'Cuatro transiciones: MONEDA, BOTON_CAFE, TON 4 s (T0) y TON 3 s (T1).', { text: 'Solución:', program: coffeeSol }],
        solution: coffeeSol,
        success: '<p>¡Café servido! ☕ Las máquinas expendedoras, los lavavajillas o las lavadoras funcionan con máquinas de estados como esta.</p>'
      },
      {
        type: 'test', title: 'Prueba final: montacargas de dos plantas',
        html: '<p>Un montacargas con dos plantas:</p>' + A.states([{ name: 'EN_P0', cond: 'llamada P1' }, { name: 'SUBIENDO', cond: 'FC_P1' }, { name: 'EN_P1', cond: 'llamada P0' }, { name: 'BAJANDO', cond: 'FC_P0' }], { h: 200 }) +
          '<ul class="goals"><li>Empieza en la planta 0.</li><li>Las llamadas solo cuentan con la cabina parada.</li><li><b>LUZ_MOVIMIENTO</b> encendida al subir o bajar.</li><li>Nunca SUBIR y BAJAR a la vez.</li></ul>',
        io: liftIO,
        scene: { type: 'axis', skin: 'lift', plus: 'Q0.0', minus: 'Q0.1', limMax: 'I0.3', limMin: 'I0.2', speed: 0.5, start: 0 },
        invariants: [H.noBoth('SUBIR', 'BAJAR', '¡SUBIR y BAJAR se han activado a la vez!')],
        tests: [
          { name: 'Funcionamiento completo', steps: [
            { pulse: 'LLAMADA_P0' }, { during: { SUBIR: 0, BAJAR: 0 }, ms: 800, fail: { title: 'La cabina se mueve al llamarla desde la planta en la que ya está.' } },
            { pulse: 'LLAMADA_P1' }, { expect: { SUBIR: 1, LUZ_MOVIMIENTO: 1 }, fail: { title: 'La cabina no sube al llamarla desde la planta 1.', hint: 'EN_P0 + LLAMADA_P1 → SUBIENDO. SUBIENDO → SUBIR y LUZ_MOVIMIENTO.' } },
            { until: { FC_P1: 1 }, timeout: 3000 }, { wait: 40 }, { expect: { SUBIR: 0, LUZ_MOVIMIENTO: 0 }, fail: { title: 'La cabina no se para en la planta 1.', hint: 'SUBIENDO + FC_P1 → EN_P1.' } },
            { pulse: 'LLAMADA_P1' }, { during: { SUBIR: 0, BAJAR: 0 }, ms: 800 },
            { pulse: 'LLAMADA_P0' }, { expect: { BAJAR: 1, LUZ_MOVIMIENTO: 1 }, fail: { title: 'La cabina no baja al llamarla desde la planta 0.' } },
            { wait: 400 }, { pulse: 'LLAMADA_P1' }, { expect: { BAJAR: 1, SUBIR: 0 }, fail: { title: 'Una llamada durante el movimiento cambia la dirección.', why: 'Mientras está BAJANDO, solo cuenta el final de carrera FC_P0.', hint: 'Las transiciones con llamadas deben partir de los estados de planta (EN_P0 / EN_P1).' } },
            { until: { FC_P0: 1 }, timeout: 3000 }, { wait: 40 }, { expect: { BAJAR: 0, LUZ_MOVIMIENTO: 0 }, fail: { title: 'La cabina no se para en la planta 0.' } }
          ] }
        ],
        hints: ['Cuatro estados, cuatro transiciones y tres acciones. Empieza por el estado inicial (EN_P0).', 'LUZ_MOVIMIENTO = SUBIENDO <b>OR</b> BAJANDO (paralelo hacia una bobina).', { text: 'Solución:', program: liftSol }],
        solution: liftSol,
        success: '<p>¡Nivel 8 superado! Ya piensas como un programador de máquinas: <b>estados, transiciones y acciones</b>.</p>'
      }
    ]
  });
})();
