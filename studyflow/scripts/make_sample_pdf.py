"""Genera PDF de prova per a les proves automàtiques (contingut d'exemple, no real).

- e2e/fixtures/apunts-dret-administratiu.pdf : PDF amb text seleccionable, títols i numeració.
- e2e/fixtures/escanejat.pdf                 : PDF només amb imatge (sense text), per provar la detecció d'escanejats.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'e2e', 'fixtures')
os.makedirs(OUT, exist_ok=True)

FONT, BOLD = 'Helvetica', 'Helvetica-Bold'
for name, path in [('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'), ('DejaVuB', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')]:
    if os.path.exists(path):
        pdfmetrics.registerFont(TTFont(name, path))
if 'DejaVu' in pdfmetrics.getRegisteredFontNames():
    FONT, BOLD = 'DejaVu', 'DejaVuB'

CONTENT = [
    ('h1', 'Tema 1. L’acte administratiu'),
    ('h2', '1.1. Concepte i elements'),
    ('p', 'L’acte administratiu és una declaració de voluntat, de judici, de coneixement o de desig realitzada per l’Administració en exercici d’una potestat administrativa diferent de la reglamentària.'),
    ('p', 'La competència és la titularitat d’una potestat administrativa que l’ordenament atribueix a un òrgan determinat.'),
    ('p', 'La motivació és l’expressió de les raons de fet i de dret que justifiquen la decisió adoptada per l’òrgan administratiu.'),
    ('p', 'Els elements de l’acte administratiu són els següents:'),
    ('li', 'a) El subjecte, que ha de ser un òrgan competent.'),
    ('li', 'b) L’objecte, que ha de ser lícit, possible i determinat.'),
    ('li', 'c) La causa o finalitat d’interès públic.'),
    ('li', 'd) La forma, que normalment és escrita.'),
    ('h2', '1.2. Eficàcia i notificació'),
    ('p', 'La notificació és el mitjà a través del qual l’Administració comunica l’acte a les persones interessades. D’acord amb l’article 40 de la Llei 39/2015, la notificació s’ha de cursar dins el termini de 10 dies a partir de la data en què l’acte s’hagi dictat.'),
    ('p', 'L’eficàcia és la capacitat de l’acte per produir els efectes jurídics que li són propis. Els actes produeixen efectes des de la data en què es dictin, llevat que s’hi disposi una altra cosa.'),
    ('p', 'La publicació és la forma de comunicació substitutiva de la notificació quan l’acte té per destinatari una pluralitat indeterminada de persones.'),
    ('p', 'Per exemple, una convocatòria de proves selectives es publica al diari oficial perquè té una pluralitat indeterminada de destinataris.'),
    ('h2', '1.3. Invalidesa dels actes'),
    ('p', 'La nul·litat de ple dret és la forma més greu d’invalidesa, que no es pot convalidar i que es pot declarar en qualsevol moment.'),
    ('p', 'L’anul·labilitat és la invalidesa que afecta els actes que incorren en qualsevol infracció de l’ordenament jurídic, inclosa la desviació de poder.'),
    ('p', 'Segons l’article 47 de la Llei 39/2015, són nuls de ple dret, entre d’altres:'),
    ('li', '1. Els actes que lesionin els drets i les llibertats susceptibles d’empara constitucional.'),
    ('li', '2. Els actes dictats per un òrgan manifestament incompetent.'),
    ('li', '3. Els actes que tinguin un contingut impossible.'),
    ('p', 'El recurs d’alçada s’ha d’interposar en el termini d’1 mes si l’acte és exprés. No obstant això, si l’acte no és exprés, es pot interposar en qualsevol moment.'),
    ('h1', 'Tema 2. El procediment administratiu'),
    ('h2', '2.1. Iniciació'),
    ('p', 'La iniciació d’ofici és la que acorda l’òrgan competent per pròpia iniciativa, per ordre superior, per petició raonada d’altres òrgans o per denúncia.'),
    ('p', 'La sol·licitud és l’escrit mitjançant el qual una persona interessada demana l’inici d’un procediment.'),
    ('p', 'L’esmena és el tràmit que permet a la persona interessada corregir els defectes de la sol·licitud. El termini per esmenar és de 10 dies hàbils, d’acord amb l’article 68 de la Llei 39/2015.'),
    ('h2', '2.2. Instrucció'),
    ('p', 'La instrucció és la fase del procediment en què es determinen, es coneixen i es comproven les dades necessàries per dictar la resolució.'),
    ('p', 'El tràmit d’audiència és el dret de les persones interessades a examinar l’expedient i presentar al·legacions abans de la proposta de resolució. El termini d’audiència no pot ser inferior a 10 dies ni superior a 15 dies.'),
    ('p', 'La prova és l’activitat que té per objecte acreditar els fets rellevants per a la decisió del procediment.'),
    ('h2', '2.3. Finalització'),
    ('p', 'La resolució és l’acte que posa fi al procediment i decideix totes les qüestions plantejades per les persones interessades.'),
    ('p', 'El desistiment és la renúncia de la persona interessada a la seva sol·licitud, sense renunciar al dret en què es fonamenta.'),
    ('p', 'La caducitat és la forma de finalització del procediment per inactivitat de la persona interessada durant 3 mesos, quan aquesta inactivitat li és imputable.'),
    ('p', 'El silenci administratiu és la manca de resolució expressa dins el termini màxim establert. El termini màxim per resoldre és de 3 mesos quan la norma no en fixa cap altre.'),
]

def wrap(text, font, size, width, c):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if c.stringWidth(t, font, size) > width:
            lines.append(cur); cur = w
        else:
            cur = t
    if cur: lines.append(cur)
    return lines

def make_text_pdf(path):
    c = canvas.Canvas(path, pagesize=A4)
    W, H = A4
    margin, y, page = 60, A4[1] - 70, 1
    def footer():
        c.setFont(FONT, 8); c.drawString(margin, 30, 'Apunts d’exemple per a proves — StudyFlow'); c.drawRightString(W - margin, 30, str(page))
    def newpage():
        nonlocal y, page
        footer(); c.showPage(); page += 1; y = H - 70
    c.setFont(BOLD, 20); c.drawString(margin, y, 'Dret Administratiu I — Apunts'); y -= 40
    for kind, text in CONTENT:
        if kind == 'h1':
            if y < H - 200: newpage()
            font, size, gap, indent = BOLD, 16, 12, 0
        elif kind == 'h2':
            font, size, gap, indent = BOLD, 13, 8, 0
        elif kind == 'li':
            font, size, gap, indent = FONT, 10.5, 2, 18
        else:
            font, size, gap, indent = FONT, 10.5, 6, 0
        lines = wrap(text, font, size, W - 2 * margin - indent, c)
        if y - len(lines) * (size + 4) < 60: newpage()
        c.setFont(font, size)
        for ln in lines:
            c.drawString(margin + indent, y, ln); y -= size + 4
        y -= gap
    footer(); c.save()

def make_scanned_pdf(path):
    # Simula un escanejat: només formes gràfiques, cap text seleccionable
    c = canvas.Canvas(path, pagesize=A4)
    for p in range(2):
        for i in range(25):
            c.setFillGray(0.2); c.rect(60, 760 - i * 26, 300 + (i * 37) % 170, 9, fill=1, stroke=0)
        c.showPage()
    c.save()

make_text_pdf(os.path.join(OUT, 'apunts-dret-administratiu.pdf'))
make_scanned_pdf(os.path.join(OUT, 'escanejat.pdf'))
print('PDF generats a', os.path.abspath(OUT))
