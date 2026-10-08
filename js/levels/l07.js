/* NIVEL 7 — Secuencias */
(function () {
  'use strict';
  const H = PLC.H, A = PLC.art;

  const seqIO = H.io(
    [H.btn('I0.0', 'START'), H.sens('I0.2', 'FOTOCELULA'), H.sens('I0.4', 'CIL_FUERA'), H.sens('I0.5', 'CIL_DENTRO')],
    [H.motor('Q0.0', 'CINTA'), H.valve('Q0.1', 'CILINDRO')],
    { memories: [H.mem('M0.1', 'E1_CINTA'), H.mem('M0.2', 'E2_EXPULSAR'), H.mem('M0.3', 'E3_ESPERA'), H.mem('M0.4', 'E4_RETROCESO')], timers: [H.mem('T0', 'ESPERA_1S')] }
  );
  const seqScene = { type: 'conveyor', motor: 'Q0.0', sensors: [{ addr: 'I0.2', x: 420, kind: 'photo' }], cylinder: { out: 'Q0.1', x: 420, ext: 'I0.4', ret: 'I0.5' }, feeder: true };
  const R = {
    start: H.R('# Inicio: START con todo en reposo → Etapa 1\nNO(I0.0) NC(M0.1) NC(M0.2) NC(M0.3) NC(M0.4) S(M0.1)'),
    t12: H.R('# Etapa 1 → 2: llega una pieza\nNO(M0.1) NO(I0.2) S(M0.2)\n|> R(M0.1)'),
    t23: H.R('# Etapa 2 → 3: cilindro fuera\nNO(M0.2) NO(I0.4) S(M0.3)\n|> R(M0.2)'),
    t34: H.R('# Etapa 3 → 4: espera 1 s\nNO(M0.3) TON(T0,1) S(M0.4)\n|> R(M0.3)'),
    t41: H.R('# Etapa 4 → 1: cilindro dentro\nNO(M0.4) NO(I0.5) S(M0.1)\n|> R(M0.4)'),
    aCinta: H.R('# Acción: cinta (etapa 1)\nNO(M0.1) OUT(Q0.0)'),
    aCil: H.R('# Acción: cilindro (etapas 2 y 3)\nNO(M0.2) OUT(Q0.1)\nNO(M0.3) |')
  };
  const seqSolution = H.P(R.start, R.t12, R.t23, R.t34, R.t41, R.aCinta, R.aCil);
  const cycle = [
    { until: { CILINDRO: 1 }, timeout: 8000, fail: { title: 'El cilindro no sale cuando llega la pieza.', why: 'En la etapa 1, al detectar la pieza (FOTOCELULA), se pasa a la etapa 2, que activa el cilindro.', hint: 'Revisa la transición 1 → 2 y la acción del cilindro.' } },
    { expect: { CINTA: 0 }, fail: { title: 'La cinta sigue girando mientras el cilindro empuja.' } },
    { until: { CIL_FUERA: 1 }, timeout: 2000 },
    { during: { CILINDRO: 1 }, ms: 750, fail: { title: 'El cilindro no espera fuera 1 segundo.', why: 'Tras llegar al final de carrera CIL_FUERA, la etapa 3 mantiene el cilindro fuera durante 1 s.', hint: 'La acción del cilindro debe estar activa en las etapas 2 Y 3 (paralelo).' } },
    { until: { CILINDRO: 0 }, timeout: 1000, fail: { title: 'El cilindro no vuelve a entrar después de la espera.', why: 'La etapa 3 debe terminar a los 1 s: el TON T0 activa la transición a la etapa 4.', hint: 'Segmento: E3_ESPERA → TON T0 (1 s) → (S) E4_RETROCESO y (R) E3_ESPERA.' } },
    { until: { CIL_DENTRO: 1 }, timeout: 2000 },
    { until: { CINTA: 1 }, timeout: 1000, fail: { title: 'La cinta no vuelve a arrancar con el cilindro dentro.', why: 'En la etapa 4, cuando el cilindro está dentro (CIL_DENTRO), se vuelve a la etapa 1.', hint: 'Segmento: E4_RETROCESO y CIL_DENTRO → (S) E1_CINTA y (R) E4_RETROCESO.' } }
  ];
  const seqTests = [
    { name: 'Ciclo completo con una pieza', steps: [{ pulse: 'START' }, { expect: { CINTA: 1, CILINDRO: 0 }, fail: { title: 'START no inicia la secuencia (la cinta no gira).' } }, { spawn: 'plastic' }].concat(cycle, [{ check: H.bins(1, 0), fail: { title: 'La pieza no ha llegado a la caja lateral.' } }]) },
    { name: 'La secuencia se repite con otra pieza', steps: [{ pulse: 'START' }, { spawn: 'plastic' }].concat(cycle, [{ spawn: 'plastic' }], cycle, [{ check: H.bins(2, 0), fail: { title: 'La segunda pieza no se ha procesado bien.' } }]) }
  ];
  const seqInv = [H.noBoth('CINTA', 'CILINDRO', 'La cinta y el cilindro se han activado a la vez.')];

  const lampIO = H.io([H.btn('I0.0', 'START')], [H.lamp('Q0.0', 'LUZ_1', 'green'), H.lamp('Q0.1', 'LUZ_2', 'amber'), H.lamp('Q0.2', 'LUZ_3', 'red')], { memories: [H.mem('M0.1', 'PASO_1'), H.mem('M0.2', 'PASO_2'), H.mem('M0.3', 'PASO_3')] });
  const lampSol = H.P(
    H.R('# Inicio\nNO(I0.0) NC(M0.1) NC(M0.2) NC(M0.3) S(M0.1)'),
    H.R('# Paso 1 → 2 (2 s)\nNO(M0.1) TON(T0,2) S(M0.2)\n|> R(M0.1)'),
    H.R('# Paso 2 → 3 (2 s)\nNO(M0.2) TON(T1,2) S(M0.3)\n|> R(M0.2)'),
    H.R('# Paso 3 → fin (2 s)\nNO(M0.3) TON(T2,2) R(M0.3)'),
    H.R('NO(M0.1) OUT(Q0.0)'), H.R('NO(M0.2) OUT(Q0.1)'), H.R('NO(M0.3) OUT(Q0.2)')
  );

  const drillIO = H.io([H.btn('I0.0', 'START'), H.sens('I0.1', 'ARRIBA'), H.sens('I0.2', 'ABAJO')], [H.motor('Q0.0', 'BAJAR'), H.motor('Q0.1', 'SUBIR'), H.motor('Q0.2', 'HUSILLO')], { memories: [H.mem('M0.1', 'E1_BAJANDO'), H.mem('M0.2', 'E2_TALADRANDO'), H.mem('M0.3', 'E3_SUBIENDO')] });
  const drillSol = H.P(
    H.R('# Inicio: START con el taladro arriba y en reposo\nNO(I0.0) NO(I0.1) NC(M0.1) NC(M0.2) NC(M0.3) S(M0.1)'),
    H.R('# Etapa 1 → 2: abajo\nNO(M0.1) NO(I0.2) S(M0.2)\n|> R(M0.1)'),
    H.R('# Etapa 2 → 3: 2 s taladrando\nNO(M0.2) TON(T0,2) S(M0.3)\n|> R(M0.2)'),
    H.R('# Etapa 3 → reposo: arriba\nNO(M0.3) NO(I0.1) R(M0.3)'),
    H.R('# Acciones\nNO(M0.1) OUT(Q0.0)'),
    H.R('NO(M0.3) OUT(Q0.1)'),
    H.R('NO(M0.1) OUT(Q0.2)\nNO(M0.2) |\nNO(M0.3) |')
  );

  PLC.registerLevel({
    id: 7,
    icon: '🪜',
    title: 'Secuencias',
    short: 'Etapas, transiciones y acciones: la máquina paso a paso',
    tools: [],
    stages: [
      {
        type: 'intro', title: 'Primero esto, luego aquello',
        html: '<p>Muchas máquinas trabajan <b>por pasos</b>, siempre en el mismo orden:</p><ol><li>Pulsar START.</li><li>Encender la cinta.</li><li>Detectar la pieza.</li><li>Parar la cinta.</li><li>Activar el cilindro.</li><li>Esperar.</li><li>Retraer el cilindro.</li><li>Volver a encender la cinta.</li></ol><p>Esto es una <b>secuencia</b>. En este nivel aprenderás a programarla de forma ordenada, para que nunca se líe.</p>'
      },
      {
        type: 'concept', title: 'Programación secuencial',
        html: '<p>En una secuencia, la máquina está siempre en <b>una etapa</b> (paso) concreta y solo pasa a la siguiente cuando se cumple una condición.</p>' +
          A.states([{ name: 'E1 CINTA', cond: 'pieza' }, { name: 'E2 EXPULSAR', cond: 'cil. fuera' }, { name: 'E3 ESPERA', cond: '1 s' }, { name: 'E4 RETROCESO', cond: 'cil. dentro' }], { h: 240 }),
        quiz: { q: 'En una secuencia bien hecha, ¿cuántas etapas están activas a la vez?', options: ['Una', 'Todas', 'Depende del día'], answer: 0, explain: 'Una etapa cada vez: así la máquina siempre sabe exactamente en qué punto está.' }
      },
      {
        type: 'concept', title: 'Etapas con memorias',
        html: '<p>Cada etapa se guarda en una <b>memoria</b>: <code>M0.1</code> = etapa 1, <code>M0.2</code> = etapa 2…</p><p>Si la memoria vale 1, esa etapa está activa. Se activan y desactivan con bobinas <b>SET</b> y <b>RESET</b>.</p>',
        quiz: { q: 'Si M0.3 (etapa 3) vale 1, ¿qué significa?', options: ['La máquina está en la etapa 3', 'Ya se han hecho 3 piezas', 'Hay 3 errores'], answer: 0, explain: 'Cada memoria representa una etapa. Valor 1 = etapa activa.' }
      },
      {
        type: 'concept', title: 'Transiciones',
        html: '<p>Una <b>transición</b> es el paso de una etapa a la siguiente. Su segmento tiene siempre la misma forma:</p><p><code>etapa actual (NO) + condición (NO) → (S) etapa siguiente</code> y en paralelo <code>(R) etapa actual</code>.</p><p class="tip">🛠 Para poner dos bobinas en paralelo: ＋ Rama, coloca la segunda bobina en la fila de abajo y une con el punto ● de la <b>última frontera</b> (justo antes de la columna de bobinas).</p>',
        demo: { io: H.io([H.btn('I0.0', 'SIGUIENTE')], [H.lamp('Q0.0', 'ETAPA_1', 'green'), H.lamp('Q0.1', 'ETAPA_2', 'amber')], { memories: [H.mem('M0.1', 'ETAPA_1'), H.mem('M0.2', 'ETAPA_2')] }), program: H.P(H.R('NC(M0.1) NC(M0.2) S(M0.1)'), H.R('NO(M0.1) NO(I0.0) S(M0.2)\n|> R(M0.1)'), H.R('NO(M0.1) OUT(Q0.0)'), H.R('NO(M0.2) OUT(Q0.1)')), prompt: 'Pulsa SIGUIENTE: la etapa 1 se apaga y se activa la 2 en el mismo ciclo.' }
      },
      {
        type: 'concept', title: 'Acciones',
        html: '<p>Las <b>acciones</b> son las salidas que se activan en cada etapa. Se programan aparte, al final: <code>etapa (NO) → ( salida )</code>.</p><p>Si una salida debe activarse en <b>varias etapas</b>, pon esas etapas <b>en paralelo</b> hacia una sola bobina (nunca dos bobinas iguales).</p>',
        quiz: { q: 'El cilindro debe estar activo en las etapas 2 y 3. ¿Cómo lo programas?', options: ['Contactos E2 y E3 en paralelo → una bobina CILINDRO', 'Dos bobinas CILINDRO, una por etapa', 'E2 y E3 en serie'], answer: 0, explain: 'Paralelo (OR) hacia una única bobina. Dos bobinas iguales se pisan entre sí.' }
      },
      {
        type: 'concept', title: 'La etapa inicial',
        html: '<p>¿Cómo empieza la secuencia? Con START, pero <b>solo si no hay ninguna etapa activa</b> (la máquina está en reposo):</p><p><code>START + NC E1 + NC E2 + … → (S) E1</code></p><p>Así, pulsar START a mitad de ciclo no lía la secuencia.</p>',
        quiz: { q: '¿Por qué ponemos contactos NC de todas las etapas en el segmento de inicio?', options: ['Para que START solo funcione con la máquina en reposo', 'Para que la máquina vaya más rápido', 'Porque sobran contactos'], answer: 0, explain: 'Si la secuencia ya está en marcha, START no debe hacer nada.' }
      },
      {
        type: 'example', title: 'Ejemplo: secuencia de dos luces',
        html: '<p>START activa la etapa 1 (LUZ_1 durante 2 s). Después pasa a la etapa 2 (LUZ_2 durante 2 s) y termina.</p><p>Activa 🔧 DEBUG para ver las memorias de etapa cambiar.</p>',
        io: H.io([H.btn('I0.0', 'START')], [H.lamp('Q0.0', 'LUZ_1', 'green'), H.lamp('Q0.1', 'LUZ_2', 'amber')], { memories: [H.mem('M0.1', 'ETAPA_1'), H.mem('M0.2', 'ETAPA_2')] }),
        program: H.P(H.R('# Inicio\nNO(I0.0) NC(M0.1) NC(M0.2) S(M0.1)'), H.R('# Etapa 1 → 2 (2 s)\nNO(M0.1) TON(T0,2) S(M0.2)\n|> R(M0.1)'), H.R('# Etapa 2 → fin (2 s)\nNO(M0.2) TON(T1,2) R(M0.2)'), H.R('# Acciones\nNO(M0.1) OUT(Q0.0)'), H.R('NO(M0.2) OUT(Q0.1)'))
      },
      {
        type: 'guided', title: 'La secuencia de la estación de expulsión',
        html: '<p>Vamos a construir la secuencia de 8 pasos de la introducción. Ya tienes hecho el inicio, las transiciones 1→2 y 2→3, y las acciones. Te faltan las transiciones <b>3→4</b> (espera de 1 s) y <b>4→1</b> (volver a la cinta).</p>',
        io: seqIO,
        scene: seqScene,
        invariants: seqInv,
        initial: H.P(R.start, R.t12, R.t23, R.aCinta, R.aCil),
        steps: [
          { text: 'Añade un segmento: <code>E3_ESPERA (M0.3)</code> → <b>TON T0</b> de <b>1 s</b> → <b>(S)</b> <code>E4_RETROCESO (M0.4)</code>.', check: H.rungWith([{ type: 'NO', addr: 'M0.3' }, { type: 'TON', pt: 1 }, { type: 'SET', addr: 'M0.4' }]) },
          { text: 'En ese segmento: ＋ Rama, una bobina <b>(R)</b> <code>E3_ESPERA (M0.3)</code> en la fila de abajo, y une con el ● de la última frontera.', check: H.rungWith([{ type: 'SET', addr: 'M0.4' }, { type: 'RST', addr: 'M0.3' }]) },
          { text: 'Otro segmento: <code>E4_RETROCESO (M0.4)</code> y <code>CIL_DENTRO (I0.5)</code> → <b>(S)</b> <code>E1_CINTA (M0.1)</code> y <b>(R)</b> <code>E4_RETROCESO (M0.4)</code>.', check: H.rungWith([{ type: 'NO', addr: 'M0.4' }, { type: 'NO', addr: 'I0.5' }, { type: 'SET', addr: 'M0.1' }, { type: 'RST', addr: 'M0.4' }]) },
          { text: 'Ejecuta, pulsa START, añade piezas y observa el ciclo completo.', live: function (c) { return c.world.scene && c.world.scene.binSide > 0 && !!c.world.outputs['Q0.0']; } }
        ],
        tests: seqTests,
        hints: ['Cada transición: etapa actual + condición → SET de la siguiente y RESET de la actual.', 'La condición de 3→4 es un tiempo (TON de 1 s alimentado por E3). La de 4→1 es el final de carrera CIL_DENTRO.', { text: 'Los dos segmentos que faltan:', program: H.P(R.t34, R.t41) }],
        solution: seqSolution,
        success: '<p>¡Secuencia completa! Fíjate en la estructura: <b>inicio → transiciones → acciones</b>. Con este patrón puedes programar secuencias de 5, 10 o 50 pasos sin perderte.</p>'
      },
      {
        type: 'free', title: 'Secuencia de tres luces',
        html: '<p>Al pulsar <b>START</b>:</p><ol><li><b>LUZ_1</b> encendida 2 s,</li><li>después <b>LUZ_2</b> encendida 2 s,</li><li>después <b>LUZ_3</b> encendida 2 s,</li><li>y todo se apaga hasta el próximo START.</li></ol><p>Nunca debe haber dos luces encendidas a la vez. Usa las memorias PASO_1, PASO_2 y PASO_3.</p>',
        io: lampIO,
        invariants: [{ check: function (c) { return (c.q('LUZ_1') ? 1 : 0) + (c.q('LUZ_2') ? 1 : 0) + (c.q('LUZ_3') ? 1 : 0) <= 1; }, fail: { title: 'Hay dos luces encendidas a la vez.', why: 'En una secuencia solo hay una etapa activa: cada luz pertenece a una etapa.', hint: 'En cada transición, SET de la siguiente etapa y RESET de la actual en el mismo segmento.' } }],
        tests: [
          { name: 'La secuencia completa', steps: [
            { pulse: 'START' }, { expect: { LUZ_1: 1 }, fail: { title: 'LUZ_1 no se enciende con START.', hint: 'START (y ninguna etapa activa) → (S) PASO_1; PASO_1 → LUZ_1.' } },
            { wait: 1500 }, { expect: { LUZ_1: 1 }, fail: { title: 'LUZ_1 se apaga antes de 2 s.' } },
            { wait: 600 }, { expect: { LUZ_2: 1 }, fail: { title: 'A los 2 s no se pasa a LUZ_2.', hint: 'PASO_1 → TON 2 s → (S) PASO_2 y (R) PASO_1.' } },
            { wait: 2000 }, { expect: { LUZ_3: 1 }, fail: { title: 'A los 4 s no se pasa a LUZ_3.' } },
            { wait: 2000 }, { expect: { LUZ_1: 0, LUZ_2: 0, LUZ_3: 0 }, fail: { title: 'Al final de la secuencia no se apaga todo.', hint: 'PASO_3 → TON 2 s → (R) PASO_3.' } },
            { wait: 1000 }, { pulse: 'START' }, { expect: { LUZ_1: 1 }, fail: { title: 'La secuencia no se puede repetir con un nuevo START.' } }
          ] }
        ],
        hints: ['Es igual que el ejemplo de dos luces, pero con tres etapas.', 'Cada etapa tiene su TON de 2 s (T0, T1, T2) que activa la transición a la siguiente.', { text: 'Solución:', program: lampSol }],
        solution: lampSol,
        success: '<p>Has hecho una secuencia temporizada. Un semáforo funciona exactamente así.</p>'
      },
      {
        type: 'challenge', title: 'RETO: el cilindro sale y no vuelve',
        html: '<p class="challenge-tag">🐞 RETO DE DIAGNÓSTICO</p><p>La estación de expulsión tiene un problema:</p><blockquote>«La pieza llega, el cilindro sale y la empuja… pero el cilindro se queda fuera para siempre y la cinta no vuelve a arrancar.»</blockquote><p>Usa 🔧 DEBUG para ver en qué etapa se queda atascada la secuencia y qué condición no se cumple.</p>',
        io: seqIO,
        scene: seqScene,
        invariants: seqInv,
        initial: H.P(R.start, R.t12, R.t23, H.R('# Etapa 3: temporizador de espera\nNO(M0.3) TON(T0,1)'), H.R('# Etapa 3 → 4: fin de la espera\nNO(M0.3) NO(T1) S(M0.4)\n|> R(M0.3)'), R.t41, R.aCinta, R.aCil),
        tests: seqTests,
        hints: ['Con DEBUG verás que la secuencia se queda en la etapa 3 (E3_ESPERA = 1). ¿Qué condición falta para salir de ella?', 'Mira el temporizador de la etapa 3 y el contacto que usa la transición 3 → 4. ¿Son el mismo?', 'La transición usa el contacto T1, pero el temporizador que cuenta es T0. Cambia el contacto a T0.'],
        solution: H.P(R.start, R.t12, R.t23, H.R('# Etapa 3: temporizador de espera\nNO(M0.3) TON(T0,1)'), H.R('# Etapa 3 → 4: fin de la espera\nNO(M0.3) NO(T0) S(M0.4)\n|> R(M0.3)'), R.t41, R.aCinta, R.aCil),
        success: '<p>¡Bien diagnosticado! La transición esperaba a <code>T1</code>, un temporizador que no existe. En una secuencia, si una transición no se cumple nunca, la máquina se queda “colgada” en esa etapa: lo primero es mirar <b>qué etapa está activa</b>.</p>'
      },
      {
        type: 'test', title: 'Prueba final: taladro automático',
        html: '<p>Programa el ciclo de un taladro vertical. Al pulsar <b>START</b> (con el taladro <b>ARRIBA</b>):</p><ol><li><b>Etapa 1:</b> BAJAR con el HUSILLO girando, hasta el final de carrera <b>ABAJO</b>.</li><li><b>Etapa 2:</b> taladrar 2 s (solo HUSILLO).</li><li><b>Etapa 3:</b> SUBIR con el HUSILLO girando hasta <b>ARRIBA</b>.</li><li>Reposo: todo parado.</li></ol><p>¡Nunca BAJAR y SUBIR a la vez!</p>',
        io: drillIO,
        scene: { type: 'axis', skin: 'drill', plus: 'Q0.0', minus: 'Q0.1', limMax: 'I0.2', limMin: 'I0.1', spindle: 'Q0.2', speed: 0.5, start: 0 },
        invariants: [H.noBoth('BAJAR', 'SUBIR', '¡BAJAR y SUBIR se han activado a la vez! El motor se rompería.')],
        tests: [
          { name: 'Ciclo de taladrado', steps: [
            { pulse: 'START' }, { expect: { BAJAR: 1, HUSILLO: 1, SUBIR: 0 }, fail: { title: 'Al pulsar START no empieza a bajar con el husillo girando.', hint: 'Inicio: START y ARRIBA (y ninguna etapa) → (S) E1. Acciones: E1 → BAJAR y HUSILLO.' } },
            { until: { ABAJO: 1 }, timeout: 4000 }, { wait: 40 },
            { expect: { BAJAR: 0 }, fail: { title: '¡El taladro sigue bajando con el final de carrera ABAJO activado!', why: 'Al llegar ABAJO hay que pasar a la etapa 2 (que no activa BAJAR).', hint: 'Transición 1 → 2: E1 y ABAJO → (S) E2 y (R) E1.' } },
            { during: { HUSILLO: 1, SUBIR: 0, BAJAR: 0 }, ms: 1700, fail: { title: 'No taladra 2 s abajo.', why: 'La etapa 2 mantiene solo el HUSILLO durante 2 s.', hint: 'E2 → TON 2 s → (S) E3 y (R) E2. El HUSILLO se activa en E1, E2 y E3 (paralelo).' } },
            { until: { SUBIR: 1 }, timeout: 800, fail: { title: 'No empieza a subir tras 2 s.' } },
            { until: { ARRIBA: 1 }, timeout: 4000 }, { wait: 100 },
            { expect: { SUBIR: 0, HUSILLO: 0, BAJAR: 0 }, fail: { title: 'Al volver arriba no se para todo.', hint: 'Transición 3 → reposo: E3 y ARRIBA → (R) E3.' } }
          ] },
          { name: 'Se puede repetir el ciclo', steps: [{ pulse: 'START' }, { until: { ABAJO: 1 }, timeout: 4000 }, { until: { ARRIBA: 1 }, timeout: 8000 }, { wait: 300 }, { pulse: 'START' }, { expect: { BAJAR: 1 }, fail: { title: 'El segundo ciclo no arranca.' } }] }
        ],
        hints: ['Tres etapas (M0.1, M0.2, M0.3), tres transiciones y tres acciones.', 'El HUSILLO gira en las tres etapas: E1, E2 y E3 en paralelo hacia una sola bobina.', { text: 'Solución:', program: drillSol }],
        solution: drillSol,
        success: '<p>¡Nivel 7 superado! Has programado una máquina secuencial real con finales de carrera, temporización y una acción compartida entre etapas.</p>'
      }
    ]
  });
})();
