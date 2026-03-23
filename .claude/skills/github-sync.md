# Skill: github-sync
**Cuándo usar:** Al completar un milestone o fase. Ejecutada por el director como parte de `milestone-complete` o `phase-complete`.

**Nota:** Esta skill solo hace commit. El push a origin lo realiza el usuario manualmente.

---

## Protocolo de commit

### Paso 1 — Verificar estado
```bash
git status
git diff --stat HEAD 2>/dev/null
```

### Paso 2 — Staging
```bash
# Añadir todos los cambios del milestone (revisar antes de hacer add -A)
git add .
git status
```

### Paso 3 — Construir el mensaje de commit

**Formato Conventional Commits:**
```
<tipo>(<scope>): <título imperativo, < 72 chars>

<cuerpo: qué se hizo y por qué>

<footer: referencias si aplica>
```

**Tipos para BetterNotes:**
- `feat`: nueva funcionalidad visible para el usuario
- `fix`: corrección de bug
- `ux`: mejoras de interfaz o experiencia sin nueva funcionalidad
- `refactor`: cambios de código sin cambio de comportamiento
- `docs`: documentación del proyecto (.claude/)
- `chore`: configuración, dependencias, CI

**Ejemplos reales:**
```
feat(workspace): add animated blobs to home dashboard

Matches landing page visual style with animate-blob1/2/3.
Uses same AppBackground component pattern already established.

feat(auth): implement guest mode with Supabase anonymous auth

Allows unauthenticated users to try the product.
Limits: 1 document, max 3 messages. Shows registration modal on limit.
Guest document recoverable if user registers immediately.
```

### Paso 4 — Commit
```bash
git commit -m "[mensaje]"
```

### Paso 5 — Confirmar al director
```bash
git log --oneline -3
```
Reportar el hash del commit al director para que lo incluya en el briefing al usuario.

---

## Si el push falla
- Verificar remote: `git remote -v`
- Si hay conflictos: escalar al director, no resolver automáticamente
- El push a origin lo realiza el usuario manualmente cuando lo considere oportuno.
- No ejecutar `git push` en ningún caso desde esta skill.