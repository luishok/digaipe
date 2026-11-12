"""Recorta y reduce las capturas para el manual impreso.

Lee img/<fuente>.png y escribe img/recortes/<nombre>.png. Las anotaciones del .tex usan
coordenadas en píxeles del recorte ORIGINAL (antes de reducir), así que reducir no las afecta.
Imprime el tamaño original de cada recorte, que es el que va en \\begin{captura}{...}{ancho}{alto}.

Uso: python C:/Users/fj/WebstormProjects/digaipe2/manuals/usuario/capturas/recortar.py
"""
from pathlib import Path
from PIL import Image

IMG = Path('C:/Users/fj/WebstormProjects/digaipe2/manuals/usuario/img')
OUT = IMG / 'recortes'
ANCHO_MAX = 1900  # ~290 ppp a lo ancho de la página

# nombre: (fuente, (x1, y1, x2, y2) o None para la imagen completa)
RECORTES = {
    'login': ('login', None),
    'inicio': ('inicio-admin', None),
    'menu-admisiones': ('menu-admisiones', (0, 0, 2732, 1000)),
    'admin-inicio': ('admin-inicio', (0, 0, 2732, 1100)),
    'usuarios-form': ('admin-usuarios', (0, 560, 2732, 1700)),
    'usuarios-tabla': ('admin-usuarios', (0, 1700, 2732, 3180)),
    'admin-procesos': ('admin-procesos', (1700, 350, 3300, 1200)),
    'admin-borrador': ('admin-eliminar-borrador', (0, 1200, 2732, 1900)),
    'auditoria': ('auditoria', (0, 330, 2732, 2000)),
    'procesos-crear': ('procesos-lista', (0, 390, 2732, 1100)),
    'procesos-fechas': ('procesos-fechas', (0, 390, 2732, 1450)),
    'carga-archivos': ('cargar-archivos-listos', (0, 280, 2732, 1180)),
    'carga-errores': ('cargar-con-error', (0, 1340, 2732, 2560)),
    'carga-guardado': ('cargar-guardado', (0, 1210, 2732, 1720)),
    'aspirantes': ('aspirantes', (0, 360, 2978, 1340)),
    'carreras-subir': ('carreras-subir', None),
    'modalidades': ('modalidades', (0, 0, 2732, 1300)),
    'planilla-lista': ('planilla-lista', (0, 240, 2732, 1300)),
    'planilla-detalle': ('planilla-generada', (0, 500, 2732, 2380)),
    'revision': ('revision-matricular', (0, 390, 2732, 2500)),
    'revision-devuelto': ('revision-devuelto', (0, 1030, 2732, 2390)),
    'estadisticas-form': ('estadisticas-vacio', (0, 380, 2732, 3000)),
    'estadisticas-resultado': ('estadisticas-estadisticas', (0, 2880, 2732, 4100)),
    'auditor-inicio': ('inicio-auditor', None),
}

OUT.mkdir(exist_ok=True)
for nombre, (fuente, caja) in RECORTES.items():
    im = Image.open(IMG / f'{fuente}.png').convert('RGB')
    if caja:
        im = im.crop(caja)
    w, h = im.size
    if w > ANCHO_MAX:
        im = im.resize((ANCHO_MAX, round(h * ANCHO_MAX / w)), Image.LANCZOS)
    im.save(OUT / f'{nombre}.png', optimize=True)
    print(f'{nombre:24s} {w}x{h}')

# Imágenes sin recorte que también van al manual (solo se reducen).
for fuente in ['planilla-pdf-1', 'reporte-pdf-1', 'auditor-revision', 'carreras', 'inicio-carga',
               'inicio-planillas', 'inicio-revision', 'inicio-estadisticas']:
    im = Image.open(IMG / f'{fuente}.png').convert('RGB')
    w, h = im.size
    if w > ANCHO_MAX:
        im = im.resize((ANCHO_MAX, round(h * ANCHO_MAX / w)), Image.LANCZOS)
    im.save(OUT / f'{fuente}.png', optimize=True)
    print(f'{fuente:24s} {w}x{h}')
