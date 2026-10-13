// Dades de demostració. El contingut és FICTICI i està identificat com a tal:
// no prové de cap PDF de l'usuari ni descriu fets reals.
import { db, updateSettings } from '../db/db';
import { buildExtractiveTheory } from '../lib/theory';
import { generateLocalQuestions, topicContext } from '../lib/questions';
import { checkQuestions } from '../lib/quality';
import { uid } from '../lib/text';
import type { Question, Section, TheoryContent } from '../types';

const DEMO_SECTIONS: { title: string; text: string }[] = [
  {
    title: '1. Els cossos del sistema de Zèfir',
    text: `El sistema de Zèfir és un sistema planetari imaginari creat per a aquesta demostració.
Un planeta lumínic és un cos celeste que emet llum pròpia de color blau durant la nit zefiriana.
Un planeta opac és un cos celeste que no emet llum i només reflecteix la llum de l'estrella Àlia.
Una lluna errant és un satèl·lit que canvia de planeta cada 40 anys zefirians.
L'estrella Àlia és el centre del sistema i té una temperatura superficial de 7.000 graus.
Els cossos del sistema es classifiquen en tres grups:
- Planetes lumínics, com Brisa i Nimbe.
- Planetes opacs, com Roca Gran i Pedra Petita.
- Llunes errants, com Viatgera.
No obstant això, el planeta Nimbe deixa d'emetre llum durant 3 dies cada any, excepte quan Viatgera l'acompanya.`,
  },
  {
    title: '2. Els cicles de Zèfir',
    text: `El cicle llarg és el període de 12 anys zefirians en què tots els planetes s'alineen amb l'estrella Àlia.
El cicle curt és el període de 90 dies en què Brisa completa una volta al voltant d'Àlia.
L'eclipsi doble és el fenomen en què dues llunes errants tapen alhora la llum d'Àlia.
La nit zefiriana és el període en què cap planeta lumínic és visible des de Roca Gran.
Per exemple, durant l'eclipsi doble de l'any 300 la nit zefiriana va durar 5 dies.
Les fases del cicle llarg són les següents:
- Fase d'aproximació.
- Fase d'alineació.
- Fase de dispersió.`,
  },
  {
    title: '3. L’observatori de Roca Gran',
    text: `L'observatori de Roca Gran és la institució fictícia que registra els fenòmens del sistema de Zèfir.
Un registre lumínic és l'anotació de la intensitat de llum d'un planeta lumínic durant una nit.
Un registre d'òrbita és l'anotació de la posició d'una lluna errant respecte al seu planeta.
Segons el Reglament fictici de l'observatori, els registres s'han de revisar en el termini de 15 dies.
L'observatori té 4 telescopis principals i un arxiu central.
Els requisits per publicar una observació són:
- Disposar de dos registres independents.
- Indicar la data zefiriana.
- Obtenir la validació de l'arxiu central.`,
  },
];

function markDemo(t: TheoryContent): TheoryContent {
  return {
    ...t,
    generator: 'demo',
    objectives: { ...t.objectives, origin: 'demo' },
    summary: { ...t.summary, origin: 'demo' },
    keyConcepts: { ...t.keyConcepts, origin: 'demo' },
    blocks: [
      { kind: 'note', id: uid('b'), text: 'Contingut FICTICI de demostració. No prové de cap PDF ni descriu fets reals.', origin: 'demo', pages: [] },
      ...t.blocks.map((b) => ({ ...b, origin: 'demo' as const })),
    ],
  };
}

export async function seedDemo(): Promise<string> {
  const now = Date.now();
  const subjectId = uid('sub');
  const topicId = uid('t');
  const sections: Section[] = DEMO_SECTIONS.map((s, i) => ({
    id: uid('s'),
    topicId,
    subjectId,
    title: s.title,
    order: i + 1,
    sourceText: s.text,
    theory: markDemo(buildExtractiveTheory(s.title, s.text)),
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  }));
  const inputs = sections.map((s) => ({ id: s.id, subjectId, topicId, title: s.title, sourceText: s.sourceText }));
  const generated = inputs.flatMap((s) => generateLocalQuestions(s, topicContext(inputs, s.id)));
  const { questions } = checkQuestions(generated, Object.fromEntries(sections.map((s) => [s.id, s.sourceText])));
  // Cas pràctic d'exemple (redactat manualment)
  const caseQ: Question = {
    id: uid('q'),
    subjectId,
    topicId,
    sectionId: sections[2].id,
    type: 'case',
    prompt:
      'Cas pràctic (fictici): una astrònoma de l’observatori de Roca Gran vol publicar una observació de Brisa. Té un únic registre lumínic i ha indicat la data zefiriana. Pot publicar-la? Justifica-ho.',
    answer: 'No pot publicar-la encara: li falta un segon registre independent i la validació de l’arxiu central.',
    criteria: [
      { text: 'Conclou que no la pot publicar', keywords: ['no'] },
      { text: 'Assenyala que calen dos registres independents', keywords: ['dos registres', 'registres independents', 'segon registre'] },
      { text: 'Esmenta la validació de l’arxiu central', keywords: ['validació', 'arxiu central'] },
    ],
    explanation: 'Els requisits per publicar són: dos registres independents, indicar la data zefiriana i obtenir la validació de l’arxiu central. Només en compleix un.',
    source: { sectionId: sections[2].id, pages: [], excerpt: 'Els requisits per publicar una observació són:', verified: true },
    difficulty: 'hard',
    concept: 'requisits per publicar una observació',
    template: 'case-demo',
    pool: 'exam',
    origin: 'demo',
    needsReview: false,
    flags: [],
    generation: 1,
    createdAt: now,
  };
  const all = [...questions.map((q) => ({ ...q, origin: 'demo' as const })), caseQ];
  await db.transaction('rw', [db.subjects, db.topics, db.sections, db.questions, db.settings], async () => {
    await db.subjects.add({
      id: subjectId,
      name: 'Demostració: Planetologia de Zèfir',
      description: 'Assignatura de demostració amb contingut fictici per provar l’aplicació. Es pot eliminar sense cap risc.',
      color: '#7c3aed',
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.topics.add({ id: topicId, subjectId, title: 'Tema de demostració: el sistema de Zèfir', order: 1, isDemo: true, createdAt: now });
    await db.sections.bulkAdd(sections);
    await db.questions.bulkAdd(all);
  });
  await updateSettings({ demoSeeded: true });
  return subjectId;
}
