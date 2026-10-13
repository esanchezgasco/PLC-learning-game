# StudyFlow

Aplicació web per estudiar una assignatura a partir dels PDF dels apunts. Funciona en local i no necessita cap compte.

Segueix el cicle **Llegir → practicar amb ajuda → recordar sense ajuda → corregir errors → repassar**:

1. Crees una assignatura i hi puges un o més PDF.
2. Se n'extreu el text, es detecten els temes i els apartats, i en revises l'estructura.
3. Per a cada apartat es genera la teoria i un qüestionari de pràctica. Durant la pràctica pots consultar la teoria.
4. L'examen global del tema amaga la teoria. La nota i la correcció només es mostren quan el lliures.
5. Es mostren els resultats per apartat i per concepte, i es fa un repàs espaiat dels errors.

Tot funciona **sense IA**. La IA (Claude, opcional) es pot activar des del servidor per generar teoria i preguntes i per avaluar respostes obertes.

## Instal·lació i execució

Requisits: Node.js 20 o superior (provat amb Node 22).

```bash
cd studyflow
npm install
npm run dev          # desenvolupament → http://localhost:5173
```

Producció (un sol procés que serveix l'app i l'API d'IA):

```bash
npm run build
npm start            # → http://localhost:8787  (port configurable amb PORT)
```

> Si serveixes `dist/` com a fitxers estàtics des d'un altre servidor, l'app funciona igual, però sense IA.

### Variables d'entorn (opcionals)

Copia `.env.example` a `.env`. Si no hi poses cap clau, l'app funciona en mode local.

| Variable | Per a què serveix | Valor per defecte |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clau de l'API d'Anthropic. Només la fa servir el servidor. | — |
| `AI_PROVIDER` | `anthropic` o `openai-compatible` | `anthropic` |
| `AI_MODEL` | Model per defecte | `claude-opus-5-5` |
| `AI_ALLOWED_MODELS` | Models que l'usuari pot triar a la configuració | `claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5` |
| `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_MODEL` | Proveïdor alternatiu compatible amb `/chat/completions` | — |
| `AI_MAX_INPUT_CHARS` | Mida màxima de cada petició | `60000` |
| `AI_MAX_OUTPUT_TOKENS` | Màxim de tokens de sortida | `16000` |
| `AI_RATE_LIMIT_PER_MIN` / `AI_MAX_REQUESTS_PER_DAY` | Límits de peticions i control de cost | `10` / `200` |
| `PORT` | Port de `npm start` | `8787` |

## Proves

```bash
npm test             # Vitest: pipeline amb un PDF real, correcció, repàs, domini, qualitat, API d'IA sense clau
npm run test:e2e     # Playwright (Chromium): flux complet al navegador
npm run typecheck
npm run make-sample-pdf   # regenera els PDF de prova (cal Python i reportlab)
```

## Arquitectura

- **React 19 + TypeScript + Vite + Tailwind CSS 4**, amb rutes de React Router.
- **PDF.js** (`pdfjs-dist`) extreu el text línia a línia, amb la mida i el gruix de la font, i també mostra les pàgines originals.
- **Tesseract.js** fa l'OCR opcional al navegador. Només es carrega quan el demanes.
- **IndexedDB (Dexie)** desa els PDF, les pàgines, els temes, els apartats, les preguntes, els intents, el repàs, el progrés i la configuració.
- **La lògica pura** és a `src/lib`, no depèn del navegador i té proves:
  - `structure.ts`: detecció de títols per numeració, paraules clau, font i majúscules, i filtratge de capçaleres i peus.
  - `theory.ts`: teoria extractiva (definicions, enumeracions, normativa, terminis, excepcions, exemples).
  - `questions.ts`: generació de preguntes. Cada pregunta queda vinculada a la frase i la pàgina d'origen.
  - `quality.ts`: controls de qualitat de les preguntes.
  - `grading.ts`: correcció de les respostes.
  - `exam.ts`: construcció d'exàmens equilibrats.
  - `srs.ts`: repàs espaiat amb el sistema de Leitner.
  - `mastery.ts`: nivell de domini per concepte.
- **Serveis** (`src/services`): processament de PDF, operacions d'estudi, client d'IA, còpies de seguretat i dades de demostració.
- **Servidor d'IA** (`server/ai-handler.mjs`): és un middleware de Vite en desenvolupament i de `server/server.mjs` en producció. Té aquestes rutes:
  - `/api/ai/status`
  - `/api/ai/theory`
  - `/api/ai/questions`
  - `/api/ai/grade`

  Fa servir el SDK oficial d'Anthropic, aplica límits de mida i de peticions, estima el cost i tradueix els errors a missatges clars. Les claus no arriben mai al navegador.

### Garanties de qualitat del contingut

- **Teoria sense IA.** Organitza el text literal del PDF i no hi afegeix informació. Cada bloc indica d'on surt: «Text del PDF», «Reorganització automàtica», «IA · explicació complementària», «IA · no verificable», «Editat per tu» o «Demostració».
- **Preguntes generades localment.** Surten de frases literals del document i porten la justificació, el fragment i la pàgina. Quan es desen, es comprova que el fragment hi aparegui.
- **Preguntes generades per IA.** Si la cita no es troba al document, la pregunta queda marcada «per revisar» i no surt als exàmens.
- **Teoria generada per IA.** Si un bloc que la IA declara «textual» no porta una cita verificable, es reclassifica com a «no verificable».
- **Controls de qualitat.** Detecten:
  - opcions duplicades o massa semblants (possibles dues respostes correctes)
  - preguntes sense criteris o sense justificació
  - enunciats massa curts
  - preguntes duplicades
- **Preguntes obertes.** Es corregeixen amb criteris explícits, i la correcció sempre es presenta com a **orientativa**.
- **Regenerar un qüestionari** arxiva les preguntes anteriors. Cada resposta guarda una còpia de la pregunta, de manera que l'historial es conserva.

## Funcionalitats

- Assignatures: crear, editar i eliminar (amb confirmació). Cada assignatura té un color.
- Documents:
  - pujada múltiple (també arrossegant els fitxers)
  - nom, mida, pàgines i estat del processament
  - tornar a processar i eliminar
  - si l'extracció falla, el document no es dona per processat i el PDF es conserva
- PDF escanejats: es detecten (estat «Sense text (escanejat)») i es pot aplicar OCR al navegador, amb confirmació.
- Revisió de l'estructura:
  - canviar el nivell (tema, apartat o ignorar) i el títol
  - afegir títols des de la vista prèvia del text
  - restablir la detecció
  - cada tema i apartat queda relacionat amb el document i les pàgines
- Teoria per apartat:
  - objectius, definicions, llistes, normativa, exemples, quadre de conceptes, excepcions, terminis, resum i conceptes clau
  - les referències de pàgina obren la pàgina original del PDF
  - editor manual de la teoria
- Pràctica:
  - una pregunta cada vegada, amb la teoria visible al costat (en mòbil, amb un botó)
  - formats: test de 4 opcions, vertader o fals, completar, resposta curta, relacionar, diferències i cas pràctic (el cas pràctic només a la demo o amb IA)
  - correcció immediata amb explicació, resposta esperada, fragment i pàgina
  - es poden repetir les preguntes fallades
- Examen global:
  - es poden configurar el nombre de preguntes (20 per defecte), la durada i la dificultat
  - s'amaguen la teoria i el menú
  - es pot navegar entre preguntes, amb indicador de contestades i pendents i marques per revisar
  - es lliura amb confirmació, o automàticament quan s'acaba el temps
  - si tanques la pàgina, l'examen en curs es pot reprendre
  - les preguntes es reparteixen entre apartats i dificultats, i es prioritzen les no practicades i les no vistes en exàmens anteriors
  - si no hi ha prou preguntes, se'n fan menys i s'avisa
- Resultats:
  - nota sobre 10, percentatge, correctes, incorrectes i en blanc
  - resultats per apartat
  - correcció pregunta a pregunta (amb filtre «només errors»)
  - conceptes no dominats i recomanacions de repàs
  - historial i gràfic de l'evolució de les notes
- Domini per concepte (No assolit / En procés / Assolit / Ben dominat). Es calcula només a partir de les respostes. Per arribar a «Assolit» cal haver encertat sense apunts.
- Repàs pendent:
  - prioritza les fallades, els conceptes febles, els temes estudiats fa temps i els temes sense l'examen superat
  - sessions de repàs, o només dels errors
  - es poden configurar els intervals, el llindar de les preguntes obertes, la mida de la sessió i els dies a partir dels quals un tema es considera «estudiat fa temps»
- Progrés: percentatge llegit, practicat i d'exàmens superats, millor i última nota, intents, fallades, última data d'estudi i repàs pendent.
- Dades:
  - exportar en JSON (amb els PDF o sense) i els resultats en CSV
  - importar una còpia
  - eliminar-ho tot (cal escriure una confirmació)
  - es demana al navegador que l'emmagatzematge sigui persistent
  - pàgina de privacitat que explica què es desa en local i què s'envia a fora
- Demostració: una assignatura **fictícia** («Planetologia de Zèfir») identificada com a tal a tot arreu.
- Interfície en català, mode clar i fosc, i disseny adaptat a mòbil, tauleta i ordinador.

## Limitacions conegudes

- **La generació local és extractiva.** Només troba bé definicions explícites («X és…», «X: …», «S'entén per…»), enumeracions, xifres i referències normatives. Amb textos narratius sense aquestes estructures surten poques preguntes. No genera casos pràctics ni explicacions noves; per a això cal la IA.
- **La detecció de títols és heurística.** En PDF amb maquetació complexa (dues columnes, taules, títols com a imatge) cal revisar l'estructura a mà. Les taules del PDF s'extreuen com a text pla.
- **OCR:**
  - la primera vegada es descarreguen els models d'idioma des d'un CDN públic
  - pot ser lent en documents llargs
  - no s'ha provat en aquest entorn, que no té accés a aquest CDN; el codi existeix però **no està verificat**
- **IA:**
  - les crides reals a Claude **no s'han provat** perquè no hi havia cap clau API
  - les rutes, els límits, els errors sense clau i la verificació de cites sí que tenen proves
  - el camí OpenAI-compatible és mínim
  - el cost és una estimació a partir dels preus públics
- **Límit de mida.** Els apartats molt llargs poden superar `AI_MAX_INPUT_CHARS`. L'app ho avisa, però no els divideix automàticament.
- **Respostes obertes en mode local.** Es corregeixen per paraules clau (amb tolerància a la flexió). És una aproximació i es mostra com a orientativa.
- **Distractors de «Quin element NO forma part…».** Es prenen d'altres apartats. Aquestes preguntes porten un avís perquè comprovis que el distractor no pertanyi també a la llista.
- **Les dades viuen en un sol navegador.** No hi ha sincronització entre dispositius; per moure-les cal exportar i importar.
- **Mida del codi.** El paquet principal pesa uns 900 kB, sobretot per PDF.js. Es podria dividir en trossos més petits.

## Pendent

- Dividir automàticament els apartats llargs abans d'enviar-los a la IA.
- Suport específic per a taules del PDF i documents a dues columnes.
- Proves de la IA amb una clau real i proves visuals de regressió.
- Notificacions de repàs i sincronització opcional entre dispositius.
