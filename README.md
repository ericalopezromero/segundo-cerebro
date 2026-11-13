# Segundo cerebro

Web personal publicada con GitHub Pages. La web se actualiza sola cada vez que cambias algo en el repositorio.

## Cómo añadir contenido

**Diapositivas.** Cada carpeta dentro de `diapositivas/` es una asignatura. Para añadir una, arrastra la carpeta a *Add file → Upload files* (o créala con *Add file → Create new file* escribiendo `diapositivas/Nombre/archivo`). Las subcarpetas (temas) aparecen como apartados.

**Organización.** Igual que las diapositivas, con carpetas dentro de `organizacion/`.

**Recursos.** Enlaces: edita `recursos/enlaces.md` (un enlace por línea). Archivos (PDF, etc.): súbelos a `recursos/`, sueltos o en subcarpetas.

**Prompts.** Edita `prompts/prompts.md` (icono del lápiz en GitHub). Cada prompt empieza con `## Título` y debajo va el texto.

Tras subir o guardar, espera uno o dos minutos y recarga la web.

## Cambiar la contraseña

`python3 scripts/hash_password.py` y pega los dos valores que imprime en la parte de arriba de `app.js`.

## Aviso

La contraseña se comprueba en el navegador: sirve para que no entre cualquiera por casualidad, pero no es seguridad real. No subas información confidencial.
