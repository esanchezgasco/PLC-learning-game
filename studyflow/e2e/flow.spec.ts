import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const PDF = path.resolve('e2e/fixtures/apunts-dret-administratiu.pdf');
const SCANNED = path.resolve('e2e/fixtures/escanejat.pdf');

/** Respon la pregunta visible amb una resposta qualsevol (o la correcta si se sap). */
async function answerVisible(page: Page, scope = page.locator('main')) {
  const radio = scope.locator('input[type=radio]');
  if (await radio.count()) return radio.first().check();
  const tf = scope.getByRole('radio', { name: 'Vertader' });
  if (await tf.count()) return tf.click();
  const selects = scope.locator('select[aria-label^="Definició per a"]');
  if (await selects.count()) {
    const n = await selects.count();
    for (let i = 0; i < n; i++) await selects.nth(i).selectOption({ index: 1 });
    return;
  }
  const txt = scope.getByLabel('Resposta');
  if (await txt.count()) return txt.first().fill('notificació termini');
}

async function createSubjectWithPdf(page: Page, name: string) {
  await page.goto('/assignatures');
  await page.getByRole('button', { name: '+ Nova assignatura' }).click();
  await page.getByLabel('Nom').fill(name);
  await page.getByRole('button', { name: 'Desa' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByTestId('pdf-input').setInputFiles(PDF);
  await expect(page.getByText('Text extret', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/pàgines/).first()).toBeVisible();
}

test('flux complet: PDF → estructura → teoria → pràctica → examen → resultats → progrés → persistència', async ({ page }) => {
  await page.goto('/');
  // Demostració creada automàticament i identificada com a fictícia
  await expect(page.getByText('Demostració: Planetologia de Zèfir').first()).toBeVisible();

  await createSubjectWithPdf(page, 'Dret Administratiu (prova)');

  // Revisió de l'estructura detectada
  await page.getByRole('link', { name: /Revisa l’estructura i crea els temes/ }).click();
  await expect(page.getByRole('heading', { name: 'Revisa l’estructura detectada' })).toBeVisible();
  const titles = await page.locator('input[aria-label="Títol"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(titles.some((t) => t.startsWith('Tema 1'))).toBe(true);
  expect(titles.some((t) => t.startsWith('2.3'))).toBe(true);
  // ignora el títol del document (no és un tema)
  const docTitleIdx = titles.findIndex((t) => t.startsWith('Dret Administratiu I'));
  if (docTitleIdx >= 0) await page.locator('select[aria-label^="Nivell de"]').nth(docTitleIdx).selectOption('0');
  await page.getByRole('button', { name: 'Crea els temes i el material d’estudi' }).click();
  await expect(page.getByText('Temes creats', { exact: true })).toBeVisible({ timeout: 30_000 });

  // Tema 1
  await page.getByRole('link', { name: /Tema 1\. L’acte administratiu/ }).click();
  await expect(page.getByRole('heading', { name: /Tema 1/ })).toBeVisible();
  await page.getByRole('link', { name: /1\.2\. Eficàcia i notificació/ }).first().click();

  // Teoria: definicions, normativa i referència a la pàgina del PDF
  await expect(page.getByText('Definició · notificació')).toBeVisible();
  await expect(page.getByText('Llei 39/2015').first()).toBeVisible();
  await expect(page.getByText('Text del PDF').first()).toBeVisible();
  await page.getByRole('button', { name: /^p\. \d+$/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Tanca' }).click();

  // Pràctica amb la teoria visible al costat
  await page.getByRole('button', { name: 'Comença la pràctica' }).click();
  await expect(page.getByText(/Pregunta 1 de \d+/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Teoria de l’apartat' })).toBeVisible();
  for (let k = 0; k < 30; k++) {
    if (await page.getByText('Pràctica completada').isVisible()) break;
    await answerVisible(page);
    await page.getByRole('button', { name: 'Comprova' }).click();
    await expect(page.getByText('Explicació', { exact: true })).toBeVisible();
    const next = page.getByRole('button', { name: /Següent pregunta|Mostra el resultat/ });
    await next.click();
  }
  await expect(page.getByText('Pràctica completada')).toBeVisible();

  // Examen sense teoria
  await page.getByRole('button', { name: 'Torna al tema' }).click();
  await page.getByRole('link', { name: /Comença l’examen|Repeteix l’examen/ }).click();
  await page.getByLabel('Nombre de preguntes').fill('10');
  await page.getByRole('button', { name: 'Comença l’examen' }).click();
  await expect(page.getByText('Examen sense teoria')).toBeVisible();
  // la navegació lateral i la teoria no són accessibles
  await expect(page.getByRole('navigation', { name: 'Navegació principal' })).toHaveCount(0);
  await expect(page.getByText('Teoria de l’apartat')).toHaveCount(0);
  await expect(page.getByText('Explicació', { exact: true })).toHaveCount(0);
  const total = await page.getByRole('list', { name: 'Navegació de preguntes' }).getByRole('listitem').count();
  expect(total).toBeGreaterThan(5);
  for (let k = 0; k < total - 1; k++) {
    await answerVisible(page);
    await page.getByRole('button', { name: 'Següent ›' }).click();
  }
  await expect(page.getByText(`${total - 1}/${total} contestades`)).toBeVisible();
  await page.getByRole('button', { name: 'Lliura l’examen' }).first().click();
  await expect(page.getByText(/1 preguntes sense contestar/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Lliura' }).click();

  // Resultats
  await expect(page.getByRole('heading', { name: 'Resultats de l’examen' })).toBeVisible();
  await expect(page.getByText(/\/ 10/)).toBeVisible();
  await expect(page.getByText('Resultats per apartat')).toBeVisible();
  await expect(page.getByText('En blanc', { exact: true })).toBeVisible();
  await expect(page.getByText('Correcció pregunta a pregunta')).toBeVisible();
  const firstExamUrl = page.url();

  // Repetir examen amb preguntes noves
  await page.getByRole('link', { name: 'Repeteix amb preguntes noves' }).click();
  await page.getByLabel('Nombre de preguntes').fill('10');
  await page.getByRole('button', { name: 'Comença l’examen' }).click();
  await page.getByRole('button', { name: 'Lliura l’examen' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lliura' }).click();
  await expect(page.getByRole('heading', { name: 'Resultats de l’examen' })).toBeVisible();
  expect(page.url()).not.toBe(firstExamUrl);

  // Progrés
  await page.goto('/progres');
  await page.getByLabel('Assignatura').selectOption({ label: 'Dret Administratiu (prova)' });
  await expect(page.getByRole('link', { name: /Tema 1\. L’acte administratiu/ })).toBeVisible();
  await expect(page.getByText('Evolució de les notes d’examen')).toBeVisible();

  // Repàs
  await page.goto('/repas');
  await expect(page.getByRole('heading', { name: 'Repàs pendent' })).toBeVisible();

  // Persistència: tornar a obrir l'aplicació
  await page.reload();
  await page.goto('/assignatures');
  await expect(page.getByRole('link', { name: 'Dret Administratiu (prova)' })).toBeVisible();
  await page.getByRole('link', { name: 'Dret Administratiu (prova)' }).click();
  await expect(page.getByText(/Examen (no )?superat/).first()).toBeVisible();
});

test('PDF escanejat: es detecta i no es dona per processat', async ({ page }) => {
  await page.goto('/assignatures');
  await page.getByRole('button', { name: '+ Nova assignatura' }).click();
  await page.getByLabel('Nom').fill('Escanejats');
  await page.getByRole('button', { name: 'Desa' }).click();
  await page.getByTestId('pdf-input').setInputFiles(SCANNED);
  await expect(page.getByText('Sense text (escanejat)')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Aplica OCR' })).toBeVisible();
  await expect(page.getByText('Text extret', { exact: true })).toHaveCount(0);
});

test('demostració i mode sense IA', async ({ page }) => {
  await page.goto('/assignatures');
  await page.getByRole('link', { name: 'Demostració: Planetologia de Zèfir' }).click();
  await page.getByRole('link', { name: /Tema de demostració/ }).click();
  await expect(page.getByText('Tema de demostració', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Teoria' }).first().click();
  await expect(page.getByText(/Contingut FICTICI de demostració/)).toBeVisible();
  await expect(page.getByText(/IA no disponible/)).toBeVisible();
  await page.goto('/configuracio');
  await expect(page.getByText('No configurada')).toBeVisible();
  await expect(page.getByText(/No hi ha cap clau API al servidor/)).toBeVisible();
});
