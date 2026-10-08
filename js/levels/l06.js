/* NIVEL 6 — Sensores y actuadores: la fábrica virtual */
(function () {
  'use strict';
  const H = PLC.H, A = PLC.art;
  const station = { type: 'conveyor', motor: 'Q0.0', sensors: [{ addr: 'I0.2', x: 420, kind: 'photo' }], cylinder: { out: 'Q0.1', x: 420 }, feeder: true };
  const marcha = 'NO(I0.0) NC(I0.1) OUT(M0.0)\nNO(M0.0) |';

  PLC.registerLevel({
    id: 6,
    icon: '🏭',
    title: 'Sensores y actuadores',
    short: 'Fábrica virtual: fotocélulas, inductivos, cilindros, alarmas y modo DEBUG',
    tools: [],
    stages: [
      {
        type: 'intro', title: 'Bienvenido/a a la fábrica virtual',
        html: '<p>Hasta ahora has trabajado con botones y lámparas. A partir de aquí, tu PLC controla una <b>fábrica de verdad</b> (virtual): cintas transportadoras con piezas que se mueven, sensores que las detectan y cilindros que las empujan.</p><p>Los sensores ya no los activas tú: <b>los activan las piezas</b>. Tu programa tiene que reaccionar a lo que ocurre.</p>' +
          A.flow([{ icon: 'sensor', label: 'Sensor', sub: 've la pieza' }, { icon: 'plc', label: 'PLC', sub: 'decide' }, { icon: 'cylinder', label: 'Cilindro', sub: 'la empuja' }])
      },
      {
        type: 'concept', title: 'Sensor de presencia (inductivo)',
        html: '<p>Un sensor <b>inductivo</b> detecta objetos <b>metálicos</b> cercanos sin tocarlos. Da 1 cuando hay metal delante.</p><p>Muy útil para <b>identificar</b> piezas: si da 1, la pieza es de metal; si no, es de otro material.</p>',
        visual: A.devices([{ icon: 'sensor', label: 'Inductivo', sub: 'metal → 1' }, { icon: 'sensor', label: 'Capacitivo', sub: 'casi todo → 1' }]),
        quiz: { q: 'Una pieza de plástico pasa delante de un sensor inductivo. ¿Qué señal da?', options: ['0: el inductivo solo detecta metal', '1: detecta cualquier cosa'], answer: 0, explain: 'Los inductivos detectan materiales metálicos. Por eso sirven para clasificar.' }
      },
      {
        type: 'concept', title: 'Sensor fotoeléctrico',
        html: '<p>Una <b>fotocélula</b> (sensor fotoeléctrico) lanza un haz de luz. Cuando un objeto <b>corta el haz</b>, el sensor cambia de estado. En nuestra fábrica, da <b>1</b> cuando hay una pieza delante.</p><p>Detecta cualquier material y desde lejos: es el sensor más habitual en cintas transportadoras.</p>',
        quiz: { q: 'La fotocélula de una cinta da 1. ¿Qué significa?', options: ['Hay una pieza cortando el haz', 'La cinta está en marcha', 'El sensor está roto'], answer: 0, explain: 'El sensor informa de que hay algo delante. Lo que hagamos con esa información es cosa del programa.' }
      },
      {
        type: 'concept', title: 'Finales de carrera',
        html: '<p>Un <b>final de carrera</b> es un interruptor que se activa cuando una pieza móvil llega a una posición: el cilindro ha salido del todo, la puerta está abierta, el ascensor está en la planta…</p><p>Le dicen al PLC <b>dónde está</b> la máquina. Los usarás mucho en el próximo nivel.</p>',
        quiz: { q: '¿Para qué sirve un final de carrera en un cilindro?', options: ['Para saber si el cilindro ha llegado a su posición', 'Para mover el cilindro', 'Para contar piezas'], answer: 0, explain: 'Es un sensor de posición: confirma que el movimiento ha terminado.' }
      },
      {
        type: 'concept', title: 'Cilindro neumático',
        html: '<p>Un <b>cilindro neumático</b> empuja con aire comprimido. El PLC activa una <b>electroválvula</b> con una salida Q: entra aire y el vástago <b>sale</b>.</p><p>Nuestros cilindros son <b>monoestables</b>: si la salida se apaga, un muelle los devuelve dentro.</p>',
        visual: A.flow([{ icon: 'plc', label: 'Q0.1 = 1' }, { icon: 'cylinder', label: 'Vástago sale' }]),
        quiz: { q: 'Si la salida del cilindro se apaga, ¿qué hace un cilindro monoestable?', options: ['Vuelve dentro (muelle)', 'Se queda fuera para siempre'], answer: 0, explain: 'El muelle lo retrae cuando deja de llegar aire.' }
      },
      {
        type: 'concept', title: 'Señalización y alarmas',
        html: '<p>Las <b>balizas</b> (luces) y <b>sirenas</b> informan a las personas: verde = funcionando, ámbar = aviso, rojo = alarma.</p><p>Una alarma normalmente se <b>memoriza</b> (SET) y se apaga cuando un operario la <b>reconoce</b> (RESET): así nadie se pierde un problema que ocurrió un instante.</p>',
        visual: A.devices([{ icon: 'lamp', label: 'Baliza' }, { icon: 'alarm', label: 'Sirena' }]),
        quiz: { q: '¿Por qué se memoriza una alarma con SET?', options: ['Para que no se pierda aunque el problema dure solo un instante', 'Para que suene más fuerte', 'Porque es obligatorio usar SET'], answer: 0, explain: 'Si el fallo desaparece solo, el operario debe enterarse igualmente. La alarma se queda hasta que la reconoce.' }
      },
      {
        type: 'concept', title: '🔧 Nuevo: el modo DEBUG', unlock: 'debug',
        html: '<p>Cuando algo no funciona, un buen técnico <b>no adivina: observa</b>.</p><p>Desde ahora tienes el botón <b>🔧 DEBUG</b> en el simulador. Muestra en tiempo real el valor de cada entrada, salida, memoria, temporizador y contador.</p><p>Y con <b>⏭ Paso</b> puedes ejecutar el ciclo de scan <b>fase a fase</b>: leer entradas → ejecutar cada segmento → escribir salidas. ¡Úsalo en los retos!</p>',
        visual: '<div class="dbg-sample"><div>SCAN 001 → ① Leer entradas: I0.0=1 I0.1=0</div><div>SCAN 001 → ② Ejecutar segmento 1: Q0.0=1</div><div>SCAN 001 → ③ Escribir salidas: Q0.0=1</div></div>',
        quiz: { q: '¿Qué hace el botón ⏭ Paso del modo DEBUG?', options: ['Ejecuta una sola fase del ciclo de scan', 'Borra el programa', 'Salta al siguiente nivel'], answer: 0, explain: 'Te permite ver el PLC “a cámara lenta”: cada clic, una fase del ciclo.' }
      },
      {
        type: 'example', title: 'Ejemplo: cinta, fotocélula y expulsor',
        html: '<ol><li>Ejecuta el PLC y activa <b>MARCHA</b>.</li><li>Añade una pieza: la cinta la lleva hasta la <b>fotocélula</b> y se para sola (contacto NC de la fotocélula).</li><li>Pulsa <b>EXPULSAR</b>: el cilindro empuja la pieza a la caja lateral y la cinta sigue.</li></ol><p>Activa también <b>🔧 DEBUG</b> para ver los valores.</p>',
        io: H.io([H.sw('I0.0', 'MARCHA'), H.sens('I0.2', 'FOTOCELULA'), H.btn('I0.4', 'EXPULSAR', 'blue')], [H.motor('Q0.0', 'CINTA'), H.valve('Q0.1', 'CILINDRO'), H.lamp('Q0.2', 'LUZ_PIEZA', 'amber')]),
        scene: station,
        program: H.P(H.R('# Cinta: con MARCHA y sin pieza en la fotocélula\nNO(I0.0) NC(I0.2) OUT(Q0.0)'), H.R('# Luz: hay pieza\nNO(I0.2) OUT(Q0.2)'), H.R('# Expulsor manual\nNO(I0.4) OUT(Q0.1)'))
      },
      {
        type: 'guided', title: 'La cinta se para cuando llega una pieza',
        html: '<p>La memoria <b>EN_MARCHA</b> (M0.0) ya está programada con START/STOP, y el expulsor manual también. Te falta la <b>cinta</b>:</p><ul class="goals"><li>Gira cuando el sistema está EN_MARCHA…</li><li>…excepto si hay una pieza delante de la FOTOCELULA.</li></ul>',
        io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red'), H.sens('I0.2', 'FOTOCELULA'), H.btn('I0.4', 'EXPULSAR', 'blue')], [H.motor('Q0.0', 'CINTA'), H.valve('Q0.1', 'CILINDRO')], { memories: [H.mem('M0.0', 'EN_MARCHA')] }),
        scene: station,
        initial: H.P(H.R('# Memoria de marcha\n' + marcha), H.R('# Expulsor manual\nNO(I0.4) OUT(Q0.1)')),
        steps: [
          { text: 'Pulsa <b>＋ Segmento</b> para añadir el segmento de la cinta.', check: function (p) { return p.rungs.length >= 3; } },
          { text: 'Coloca un contacto NO <code>EN_MARCHA (M0.0)</code> y la bobina <code>CINTA (Q0.0)</code>.', check: H.rungWith([{ type: 'NO', addr: 'M0.0' }, { type: 'OUT', addr: 'Q0.0' }]) },
          { text: 'Añade en serie un contacto <b>NC</b> <code>FOTOCELULA (I0.2)</code>: cuando haya pieza, cortará la corriente.', check: H.rungWith([{ type: 'NC', addr: 'I0.2' }, { type: 'OUT', addr: 'Q0.0' }]) },
          { text: 'Ejecuta, pulsa START y añade una pieza: la cinta se para sola en la fotocélula.', live: function (c) { return c.sim.running && c.world.scene && c.world.scene.onBelt(420) && !c.world.outputs['Q0.0'] && !!c.engine && !!c.engine.M['M0.0']; } },
          { text: 'Pulsa EXPULSAR: la pieza cae a la caja y la cinta continúa.', live: function (c) { return c.world.scene && c.world.scene.binSide > 0; } }
        ],
        tests: [
          { name: 'La cinta se para con la pieza y sigue al retirarla', steps: [
            { pulse: 'START' }, { expect: { CINTA: 1 }, fail: { title: 'La cinta no arranca con START.', why: 'La memoria EN_MARCHA se activa con START; la cinta debe depender de ella.', hint: 'Contacto NO EN_MARCHA (M0.0) → bobina CINTA.' } },
            { spawn: 'plastic' },
            { until: { FOTOCELULA: 1 }, timeout: 8000, fail: { title: 'La pieza nunca llega a la fotocélula.', why: 'La cinta debe estar girando para llevarla.', hint: '' } },
            { wait: 60 }, { expect: { CINTA: 0 }, fail: { title: 'La cinta no se para cuando la pieza llega a la fotocélula.', why: 'La fotocélula vale 1 cuando hay pieza. Para que la cinta se pare, ese 1 debe CORTAR la corriente.', hint: 'Añade un contacto NC de FOTOCELULA en serie con la cinta.' } },
            { pulse: 'EXPULSAR', ms: 800 },
            { until: { CINTA: 1 }, timeout: 1500, fail: { title: 'La cinta no vuelve a arrancar tras retirar la pieza.', why: 'Si la cinta depende de START (que ya no está pulsado), se queda parada.', hint: 'Usa la memoria EN_MARCHA (M0.0) para mandar la cinta, no START.' } },
            { check: H.bins(1, 0), fail: { title: 'La pieza no ha llegado a la caja lateral.' } }
          ] },
          { name: 'STOP para la cinta', steps: [{ pulse: 'START' }, { wait: 500 }, { pulse: 'STOP' }, { expect: { CINTA: 0 } }] }
        ],
        hints: ['La cinta tiene dos condiciones: el sistema en marcha Y no hay pieza.', '“No hay pieza” = contacto <b>NC</b> de la fotocélula.', { text: 'El segmento que falta:', program: H.P(H.R('NO(M0.0) NC(I0.2) OUT(Q0.0)')) }],
        solution: H.P(H.R('# Memoria de marcha\n' + marcha), H.R('# Expulsor manual\nNO(I0.4) OUT(Q0.1)'), H.R('# Cinta: en marcha y sin pieza delante\nNO(M0.0) NC(I0.2) OUT(Q0.0)')),
        success: '<p>¡Tu primera máquina reacciona sola a un sensor! Fíjate en la idea: la <b>memoria EN_MARCHA</b> recuerda la orden del operario, y la cinta combina esa orden con lo que ven los sensores.</p>'
      },
      {
        type: 'challenge', title: 'RETO: la cinta no arranca',
        html: '<p class="challenge-tag">🐞 RETO DE DIAGNÓSTICO</p><p><b>Cinta de alimentación.</b> Funcionamiento correcto: cuando hay una pieza delante del <b>SENSOR_ENTRADA</b>, la cinta arranca y la lleva hasta el <b>SENSOR_FINAL</b>, donde se detiene.</p><blockquote>La cinta transportadora se ha detenido.<br>Hay una pieza delante del sensor.<br>El motor no funciona.<br><b>Encuentra el problema.</b></blockquote><p>Usa <b>🔧 DEBUG</b>: mira el valor de cada entrada y qué contacto corta la corriente.</p>',
        io: H.io([H.sens('I0.2', 'SENSOR_ENTRADA'), H.sens('I0.3', 'SENSOR_FINAL')], [H.motor('Q0.0', 'CINTA')]),
        scene: { type: 'conveyor', motor: 'Q0.0', sensors: [{ addr: 'I0.2', x: 20, kind: 'photo' }, { addr: 'I0.3', x: 600, kind: 'photo' }], feeder: true, initialParts: [{ x: 0, type: 'metal' }] },
        initial: H.P(H.R('# Cinta de alimentación\nNO(I0.2) NO(I0.3) OUT(Q0.0)\nNO(Q0.0) |')),
        tests: [
          { name: 'Pieza en la entrada → la cinta arranca', steps: [{ wait: 300 }, { expect: { CINTA: 1 }, fail: { title: 'La cinta sigue parada aunque hay una pieza delante del sensor de entrada.', why: 'SENSOR_ENTRADA vale 1, pero la corriente no consigue llegar a la bobina CINTA: algún contacto del segmento está abierto.', hint: 'Ejecuta con 🔧 DEBUG: mira cuánto vale cada entrada y qué contacto NO se rellena de verde. ¿Debería dejar pasar la corriente en esta situación?' } }] },
          { name: 'Lleva la pieza hasta el final y se para', steps: [{ until: { SENSOR_FINAL: 1 }, timeout: 9000, fail: { title: 'La pieza no llega al sensor final.', why: 'La cinta debe seguir girando aunque la pieza ya no esté en la entrada.', hint: 'La auto-retención (contacto CINTA en paralelo) mantiene la cinta en marcha.' } }, { wait: 100 }, { expect: { CINTA: 0 }, fail: { title: 'La cinta no se para al llegar al final.', why: 'Cuando la pieza llega, SENSOR_FINAL pasa a valer 1 y eso debe cortar la corriente.', hint: '¿Qué tipo de contacto corta la corriente cuando su entrada vale 1?' } }] }
        ],
        hints: ['Activa 🔧 DEBUG y mira cuánto vale cada entrada. Luego mira en el segmento qué contacto está abierto (no relleno de verde).', 'SENSOR_FINAL vale 0 porque no hay pieza al final. ¿Qué tipo de contacto deja pasar la corriente con un 0?', 'Cambia el contacto de SENSOR_FINAL (I0.3) de NO a <b>NC</b>.'],
        solution: H.P(H.R('# Cinta de alimentación\nNO(I0.2) NC(I0.3) OUT(Q0.0)\nNO(Q0.0) |')),
        success: '<p>¡Avería resuelta! El sensor final estaba como contacto NO: exigía una pieza al final para arrancar… justo al revés. Observar los valores con DEBUG es la forma profesional de encontrar fallos.</p>'
      },
      {
        type: 'free', title: 'Alarma de atasco',
        html: '<p>Si una pieza se queda atascada delante de la <b>FOTOCELULA</b> más de <b>5 segundos</b>:</p><ul class="goals"><li>Se activa la <b>ALARMA</b> (sirena) y se queda activa aunque se quite el atasco.</li><li>La <b>BALIZA</b> roja se enciende mientras haya alarma.</li><li>La <b>CINTA</b> (que gira con el selector MARCHA) se para mientras haya alarma.</li><li><b>RECONOCER</b> apaga la alarma.</li></ul><p class="muted">Aquí la fotocélula la activas tú: haz clic en ella para simular la pieza atascada.</p>',
        io: H.io([H.sw('I0.0', 'MARCHA'), H.sens('I0.2', 'FOTOCELULA'), H.btn('I0.3', 'RECONOCER', 'blue')], [H.motor('Q0.0', 'CINTA'), H.buzzer('Q0.1', 'ALARMA'), H.lamp('Q0.2', 'BALIZA', 'red')]),
        tests: [
          { name: 'Funcionamiento normal', steps: [{ set: { MARCHA: 1 } }, { expect: { CINTA: 1 }, fail: { title: 'La cinta no gira con MARCHA.', why: '', hint: 'MARCHA (NO) → NC ALARMA → CINTA.' } }, { set: { FOTOCELULA: 1 } }, { wait: 3000 }, { expect: { ALARMA: 0, CINTA: 1 }, fail: { title: 'La alarma salta antes de tiempo.', why: 'Una pieza pasando delante de la fotocélula es normal: solo es atasco si se queda más de 5 s.', hint: 'Usa un TON de 5 s con la FOTOCELULA.' } }] },
          { name: 'Atasco de más de 5 s', steps: [{ set: { MARCHA: 1, FOTOCELULA: 1 } }, { during: { ALARMA: 0 }, ms: 4400 }, { until: { ALARMA: 1 }, timeout: 1000, fail: { title: 'La alarma no salta tras 5 s de atasco.', why: '', hint: 'FOTOCELULA (NO) → TON T0 5 s → (S) ALARMA.' } }, { expect: { BALIZA: 1, CINTA: 0 }, fail: { title: 'Con la alarma activa, la baliza debe encenderse y la cinta pararse.', why: '', hint: 'BALIZA con contacto NO de ALARMA; en la CINTA, un contacto NC de ALARMA.' } }, { set: { FOTOCELULA: 0 } }, { wait: 500 }, { expect: { ALARMA: 1 }, fail: { title: 'La alarma se apaga sola al quitar el atasco.', why: 'Una alarma debe quedar memorizada hasta que alguien la reconozca.', hint: 'Activa la alarma con una bobina (S).' } }, { pulse: 'RECONOCER' }, { expect: { ALARMA: 0, BALIZA: 0, CINTA: 1 }, fail: { title: 'RECONOCER no restablece el sistema.', why: '', hint: 'RECONOCER (NO) → (R) ALARMA.' } }] }
        ],
        hints: ['Combina un temporizador (para los 5 s) con SET/RESET (para memorizar).', 'FOTOCELULA → TON 5 s → (S) ALARMA. RECONOCER → (R) ALARMA. La cinta y la baliza leen el contacto de ALARMA.', { text: 'Solución:', program: H.P(H.R('NO(I0.0) NC(Q0.1) OUT(Q0.0)'), H.R('NO(I0.2) TON(T0,5) S(Q0.1)'), H.R('NO(I0.3) R(Q0.1)'), H.R('NO(Q0.1) OUT(Q0.2)')) }],
        solution: H.P(H.R('# Cinta: con MARCHA y sin alarma\nNO(I0.0) NC(Q0.1) OUT(Q0.0)'), H.R('# Atasco: pieza más de 5 s\nNO(I0.2) TON(T0,5) S(Q0.1)'), H.R('# Reconocer alarma\nNO(I0.3) R(Q0.1)'), H.R('# Baliza\nNO(Q0.1) OUT(Q0.2)')),
        success: '<p>Has creado una <b>alarma industrial</b> completa: detección temporizada, memorización, señalización y reconocimiento.</p>'
      },
      {
        type: 'test', title: 'Prueba final: estación de expulsión automática',
        html: '<p>Automatiza la estación completa:</p><ul class="goals"><li><b>START</b>/<b>STOP</b> ponen el sistema en marcha (memoria EN_MARCHA).</li><li>En marcha, la <b>CINTA</b> gira mientras no haya pieza en la <b>FOTOCELULA</b>.</li><li>Cuando llega una pieza (y el sistema está en marcha), el <b>CILINDRO</b> la empuja automáticamente a la caja lateral.</li><li><b>LUZ_PIEZA</b> se enciende mientras haya una pieza en la fotocélula.</li></ul>',
        io: H.io([H.btn('I0.0', 'START'), H.btn('I0.1', 'STOP', 'red'), H.sens('I0.2', 'FOTOCELULA')], [H.motor('Q0.0', 'CINTA'), H.valve('Q0.1', 'CILINDRO'), H.lamp('Q0.2', 'LUZ_PIEZA', 'amber')], { memories: [H.mem('M0.0', 'EN_MARCHA')] }),
        scene: station,
        tests: [
          { name: 'Ciclo automático con una pieza', steps: [
            { pulse: 'START' }, { expect: { CINTA: 1 }, fail: { title: 'La cinta no arranca con START (o no sigue al soltarlo).', why: '', hint: 'Memoria EN_MARCHA con auto-retención; la cinta depende de ella.' } },
            { spawn: 'plastic' }, { until: { FOTOCELULA: 1 }, timeout: 8000 }, { wait: 60 },
            { expect: { CINTA: 0 }, fail: { title: 'La cinta no se para al llegar la pieza.', why: '', hint: 'Contacto NC de FOTOCELULA en serie con la cinta.' } },
            { expect: { CILINDRO: 1 }, fail: { title: 'El cilindro no empuja la pieza.', why: 'Con el sistema en marcha y una pieza en la fotocélula, la salida del cilindro debe activarse.', hint: 'EN_MARCHA (NO) → FOTOCELULA (NO) → CILINDRO.' } },
            { expect: { LUZ_PIEZA: 1 }, fail: { title: 'LUZ_PIEZA no se enciende con la pieza delante.', why: '', hint: 'FOTOCELULA (NO) → LUZ_PIEZA.' } },
            { until: { FOTOCELULA: 0 }, timeout: 2000 }, { until: { CINTA: 1 }, timeout: 1500, fail: { title: 'La cinta no continúa después de expulsar la pieza.' } },
            { check: H.bins(1, 0), fail: { title: 'La pieza no ha terminado en la caja lateral.' } }
          ] },
          { name: 'Sin START no se mueve nada', steps: [{ spawn: 'plastic' }, { wait: 5000 }, { expect: { CINTA: 0, CILINDRO: 0 }, fail: { title: 'La máquina funciona sin pulsar START.' } }] },
          { name: 'STOP detiene la estación', steps: [{ pulse: 'START' }, { wait: 300 }, { pulse: 'STOP' }, { spawn: 'plastic' }, { wait: 3000 }, { expect: { CINTA: 0 } }] }
        ],
        hints: ['Cuatro segmentos: memoria de marcha, cinta, cilindro y luz.', 'Cinta = EN_MARCHA y NO fotocélula. Cilindro = EN_MARCHA y fotocélula. Luz = fotocélula.', { text: 'Solución:', program: H.P(H.R(marcha), H.R('NO(M0.0) NC(I0.2) OUT(Q0.0)'), H.R('NO(M0.0) NO(I0.2) OUT(Q0.1)'), H.R('NO(I0.2) OUT(Q0.2)')) }],
        solution: H.P(H.R('# Memoria de marcha\n' + marcha), H.R('# Cinta\nNO(M0.0) NC(I0.2) OUT(Q0.0)'), H.R('# Cilindro expulsor\nNO(M0.0) NO(I0.2) OUT(Q0.1)'), H.R('# Luz de pieza\nNO(I0.2) OUT(Q0.2)')),
        success: '<p>¡Nivel 6 superado! Tu estación funciona sola: la pieza llega, se detecta, se expulsa y la cinta continúa. Eso es <b>automatización</b>.</p>'
      }
    ]
  });
})();
