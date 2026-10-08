# ⚡ PLC Academy — *Learn PLC by doing*

Juego educativo e interactivo para **aprender programación de PLC desde cero**, pensado para personas sin conocimientos previos de automatización.

El jugador avanza por **10 niveles**. En cada uno programa en **Ladder (lenguaje de contactos)** con un editor visual, ejecuta su programa en un **PLC virtual** y controla una **fábrica simulada**: cintas, sensores, cilindros, puertas, depósitos, semáforos…

## Cómo jugar

No necesita instalación ni dependencias: es HTML + CSS + JavaScript puro.

- **Opción 1:** abre `index.html` en el navegador.
- **Opción 2 (recomendada):** sirve la carpeta con un servidor local:

  ```bash
  python3 -m http.server 8080   # o: npm start
  # y abre http://localhost:8080
  ```

El progreso se guarda automáticamente en el navegador (`localStorage`).

> 👩‍🏫 **Modo profesor:** abre `index.html?profesor` para desbloquear todos los niveles (útil para revisar el contenido o usarlo en clase). En este modo, lo que se desbloquea no cuenta como progreso guardado.

## Niveles

| Nivel | Tema | Conceptos |
|---|---|---|
| 1 | Primer contacto con un PLC | Qué es un PLC, entradas (I), salidas (Q), sensores, actuadores, ciclo de scan, primer programa |
| 2 | Lógica de contactos | Contacto NO, contacto NC, bobina, AND (serie), OR (paralelo), NOT |
| 3 | Auto-retención | Memoria (marcas M), auto-retención, START/STOP, bobinas SET/RESET |
| 4 | Temporizadores | Temporización, TON (tiempo de activación), TOF (tiempo de desactivación), contactos de temporizador |
| 5 | Contadores | Flancos, CTU, CTD, valor actual (CV), valor objetivo (PV), reset, comparadores |
| 6 | Sensores y actuadores | Fábrica virtual: inductivo, fotocélula, finales de carrera, cilindro, alarmas · se desbloquea el **modo DEBUG** |
| 7 | Secuencias | Etapas con memorias, transiciones, acciones, etapa inicial |
| 8 | Estados y máquinas | Estados, transiciones, condiciones, máquina de estados, enclavamiento |
| 9 | Automatización industrial | Nivel y bombas, histéresis, intermitencia, paro de emergencia con cableado NC, rearme, clasificación |
| 10 | Reto final | Una fábrica completa: detectar, identificar, transportar, clasificar, contar, emergencia, alarmas y rearme |

Cada nivel sigue la misma estructura:

1. **Introducción** corta.
2. **Conceptos nuevos**, uno por tarjeta (“💡 NUEVO CONCEPTO”), cortos y visuales, con el botón **Entendido → Probar** que abre una mini-demo interactiva o una pregunta de comprobación.
3. **Ejemplo** ya programado para ejecutar y observar.
4. **Ejercicio guiado** con lista de pasos que se marcan solos (y celdas que parpadean).
5. **Ejercicio(s) libres** y, en varios niveles, **retos de diagnóstico** 🐞 (“la cinta no arranca, encuentra el fallo”).
6. **Prueba final**: al superarla se desbloquea el siguiente nivel.

## Funcionalidades

- **Editor Ladder visual:** contactos NO/NC, cables, bobinas, SET, RESET, TON, TOF, CTU, CTD y comparadores; entradas, salidas, memorias, temporizadores y contadores. Clic o arrastrar y soltar, ramas en paralelo con uniones ●, deshacer, propiedades editables. Las herramientas se desbloquean nivel a nivel.
- **PLC virtual:** ciclo de scan real (leer entradas → ejecutar segmentos → escribir salidas), imagen de entradas y salidas en un “rack” con LEDs.
- **▶ EJECUTAR PLC:** la corriente se ilumina en verde recorriendo el programa en tiempo real; los contactos cerrados se rellenan; los temporizadores muestran ET y los contadores CV.
- **Simulación de la máquina:** pulsadores (momentáneos, con teclas 1–9 y Mayús+clic para enclavar), selectores, sensores, seta de emergencia cableada NC, lámparas, motores, sirenas, válvulas… y escenas animadas (cinta con piezas metálicas y de plástico, cilindro expulsor, puerta automática, taladro, montacargas, depósito, semáforo).
- **🔧 Modo DEBUG:** tabla en vivo de entradas, salidas, memorias, temporizadores y contadores; ejecución **paso a paso** del ciclo de scan con registro (`SCAN 001 → ① Leer entradas…`).
- **Profesor virtual:** cada ejercicio se comprueba automáticamente ejecutando el programa del jugador con tiempo simulado. Si falla, en vez de “Incorrecto” explica **qué** ha fallado, **por qué** y da una **pista**; además avisa de errores típicos (ramas sin unir, bobinas duplicadas…).
- **Ayudas en 3 niveles + solución opcional**, con puntuación 100 / 80 / 60 / 40 / 20.
- **Gamificación ligera:** XP, nivel de jugador, racha, 13 medallas y porcentaje de progreso. Lo importante sigue siendo aprender.
- **🧪 Laboratorio libre** para experimentar sin pruebas con 7 máquinas distintas.

## Estructura del código

```
index.html            Página principal
css/styles.css        Estilos (tema industrial / HMI)
js/engine.js          Motor del PLC, modelo de programa, mini-lenguaje Ladder, diagnóstico
js/scenes.js          Física y vistas SVG de las máquinas (cinta, eje, depósito, semáforo)
js/validator.js       Corrector automático (pruebas de comportamiento con tiempo simulado)
js/editor.js          Editor visual de Ladder
js/sim.js             Simulador: rack PLC, dispositivos, bucle de scan, paso a paso, DEBUG
js/art.js             Ilustraciones (cronogramas, diagramas de estados, tablas de verdad…)
js/levels/l01…l10.js  Contenido de los niveles
js/app.js             Navegación, progreso, puntuación, ayudas, medallas, laboratorio
tests/run-tests.js    Pruebas automáticas (Node, sin dependencias)
```

Los programas de ejemplo y las soluciones se escriben con un mini-lenguaje legible:

```js
PLC.rung(`
  # Marcha/paro con auto-retención
  NO(I0.0) NC(I0.1) OUT(Q0.0)
  NO(Q0.0) |
`)
```

## Pruebas

```bash
npm test     # o: node tests/run-tests.js
```

Comprueban el motor del PLC (AND, OR, auto-retención, TON, TOF, CTU, CTD, comparadores, SET/RESET) y, para **cada ejercicio de cada nivel**, que la solución supera todas sus pruebas y que el programa inicial (y los programas con averías de los retos) no las supera.
