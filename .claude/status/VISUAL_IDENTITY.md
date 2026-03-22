# BetterNotes — Visual Identity Reference

**Versión:** 1.0 | **Fecha:** 2026-03-19 | **Fuente:** Análisis rama main (v1)
**Propósito:** Referencia canónica para reimplementar el diseño en v2 (F2-M2+)

---

## 1. Paleta de colores

| Token | Valor | Uso |
|-------|-------|-----|
| Background | `#0a0a0a` | Fondo base landing + app |
| Foreground | `#ededed` | Texto primario |
| Text secondary | `white/70` = rgba(255,255,255,0.70) | Subtítulos, labels |
| Text hint | `white/60` = rgba(255,255,255,0.60) | Texto faint |
| Card fill | `rgba(255,255,255,0.05)` | Relleno containers |
| Glass accent | `rgba(255,255,255,0.10)` | Overlays, hovers |
| Border | `rgba(255,255,255,0.15)` | Bordes cards |
| Indigo | `#6366f1` (indigo-500) | Blob 1, gradiente hero |
| Fuchsia | `#d946ef` (fuchsia-500) | Blob 2, gradiente hero |
| Emerald | `#34d399` (emerald-400) | Blob 3, badge activo |
| CTA primario | `#ffffff` bg + `#0a0a0a` text | Botón "Get started" |
| Destructivo | `#dc2626` | Borrar, errores |

### CSS Custom Properties (globals.css)
```css
.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
  --card: rgba(255,255,255,0.05);
  --muted: #262626;
  --muted-foreground: #a3a3a3;
  --border: rgba(255,255,255,0.15);
  --primary: #ffffff;
  --primary-foreground: #0a0a0a;
  --accent: rgba(255,255,255,0.1);
  --destructive: #dc2626;
}
```

---

## 2. Tipografía

- **Font principal:** Geist Sans (Google Fonts vía Next.js, variable `--font-geist-sans`)
- **Font mono:** Geist Mono (variable `--font-geist-mono`)

| Contexto | Clase Tailwind | Peso |
|----------|---------------|------|
| Hero H1 desktop | `text-6xl font-semibold tracking-tight` | 600 |
| Hero H1 mobile | `text-4xl font-semibold tracking-tight` | 600 |
| H2 secciones | `text-xl font-semibold` | 600 |
| Body | `text-sm` o `text-base` | 400 |
| Navbar/botones | `text-sm font-semibold` | 600 |
| Badges/labels | `text-xs` | 400-600 |
| **Gradiente hero** | `bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-emerald-400 bg-clip-text text-transparent` | — |

---

## 3. Backgrounds

### Landing (Background.tsx)
```tsx
// Base
<div className="absolute inset-0 bg-neutral-950" />

// Gradientes radiales
<div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_20%,rgba(99,102,241,0.35),transparent_60%),radial-gradient(900px_500px_at_20%_70%,rgba(236,72,153,0.30),transparent_60%),radial-gradient(900px_500px_at_80%_75%,rgba(34,197,94,0.18),transparent_60%)]" />

// Blobs animados
<div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/25 blur-3xl animate-blob1" />
<div className="absolute top-40 -left-20 h-[520px] w-[520px] rounded-full bg-fuchsia-500/20 blur-3xl animate-blob2" />
<div className="absolute top-56 -right-24 h-[520px] w-[520px] rounded-full bg-emerald-400/15 blur-3xl animate-blob3" />

// Grid sutil
<div className="absolute inset-0 opacity-[0.09] bg-[linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:56px_56px]" />

// Grain
<div className="absolute inset-0 opacity-[0.18] mix-blend-overlay bg-[url('data:image/svg+xml,...feTurbulence baseFrequency=0.9...')]" />
```

### App interna (AppBackground.tsx)
- Mismo patrón pero sin blobs, gradientes más suaves (0.22/0.18/0.12), grid 64px opacity-0.06, grain opacity-0.16

### Animaciones CSS (globals.css)
```css
@keyframes blob1 { 0%{transform:translate(-50%,0) scale(1)} 33%{transform:translate(-45%,20px) scale(1.05)} 66%{transform:translate(-55%,-10px) scale(0.98)} 100%{...} }
@keyframes blob2 { /* translate + scale, 16s */ }
@keyframes blob3 { /* translate + scale, 18s */ }

.animate-blob1 { animation: blob1 14s ease-in-out infinite; }
.animate-blob2 { animation: blob2 16s ease-in-out infinite; }
.animate-blob3 { animation: blob3 18s ease-in-out infinite; }
```

---

## 4. Sistema de componentes (Glassmorphism)

### Regla base
- Border: `border border-white/20` (o `/15`)
- Fill: `bg-white/10` (hover: `bg-white/15`)
- Blur: `backdrop-blur`
- Shadow: `shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_60px_rgba(0,0,0,0.35)]`
- Radius: `rounded-2xl` (containers), `rounded-xl` (inputs, botones)

### Navbar (landing)
```
max-w-6xl px-4 py-5 flex items-center
Logo: /brand/logo.png 36x36 + "BetterNotes" font-semibold tracking-tight
Links: text-sm text-white/70 hover:text-white
Login btn: rounded-xl border-white/20 bg-white/10 px-3 py-2 text-sm backdrop-blur
CTA btn: rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-950
```

### Announce badge (hero)
```
inline-flex items-center gap-2 rounded-full border-white/20 bg-white/10 px-3 py-1 text-xs backdrop-blur
Dot: h-2 w-2 rounded-full bg-emerald-400
```

### Input/prompt box glassmorphism
```
max-w-3xl rounded-2xl border-white/20 bg-white/10 p-3 backdrop-blur shadow-[...]
Input interno: rounded-xl border-white/20 bg-black/20 text-sm placeholder:text-white/50
Botón: rounded-xl bg-white px-4 text-sm font-semibold text-neutral-950
```

### Template cards
```
rounded-2xl border-white/20 bg-white/10 p-4 hover:bg-white/15 backdrop-blur shadow-[...]
Imagen: aspect-[4/3] rounded-xl bg-white/5 border-white/10
Hover: group-hover:scale-105 transition-transform duration-300
```

### Dropdown menus
```
rounded-2xl border-white/15 bg-neutral-950/90 backdrop-blur p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)]
```

---

## 5. Sidebar (app interna)

- **Ancho expandido:** 160-320px (draggable)
- **Ancho colapsado:** 72px (solo iconos)
- **Auto-colapsa:** en rutas `/workspace/[id]`
- **Persistencia:** localStorage (`sidebar_collapsed`)
- **Fondo:** `bg-neutral-950/70 backdrop-blur-xl border-r border-white/8`
- **Nav items activos:** `bg-white/12 text-white font-medium rounded-xl`
- **Nav items inactivos:** `text-white/60 hover:bg-white/8 hover:text-white/90`
- **Sección Recent:** últimos 5 proyectos con icono y título truncado
- **Profile footer:** avatar gradiente + email + menú (Settings, Plans, ThemeToggle, Sign out)
- **Search hint:** `⌘K` button en la parte inferior

---

## 6. Assets visuales

| Asset | Ruta | Dimensiones | Uso |
|-------|------|-------------|-----|
| Logo | `/public/brand/logo.png` | 36×36px PNG | Navbar + Sidebar |
| Apple icon | `/app/apple-icon.png` | 180×180px | Favicon iOS |
| Template thumbs | `/public/templates/previews/*.png` | 4:3 ratio | Template cards |

---

## 7. Estructura de la landing (secciones)

```
[Header — sticky, z-10]
  max-w-6xl · Logo + nav links + auth CTAs

[Hero — relative z-10, max-w-4xl, text-center, pt-16 pb-10]
  1. Announce badge (emerald dot)
  2. H1: "Turn messy notes into clean LaTeX + PDF"
     └─ "clean LaTeX" en gradiente indigo→fuchsia→emerald
  3. Subtítulo: text-white/70
  4. Prompt box glassmorphism (max-w-3xl)
     [+attach] [input placeholder] [Build now →]

[Templates — max-w-6xl, pb-16 pt-6]
  Header: "Templates" + "View all →"
  Grid: lg:grid-cols-3 sm:grid-cols-2 gap-3
  Content: primeras 3 plantillas free con thumbnail

[Footer — max-w-6xl, pb-10, text-center]
  text-xs text-white/50: "© 2026 BetterNotes — MVP"

[Background — fixed, pointer-events-none, -z-10]
  Base + gradientes + blobs animados + grid + grain
```

---

## 8. Notas para F2-M2

### Recuperar exactamente
- Valores hex exactos (especialmente `#0a0a0a` y `#ededed`)
- Las 3 animaciones de blobs (keyframes + duraciones 14/16/18s)
- Sistema glassmorphism (opacidades, shadows)
- Logo PNG real (`/brand/logo.png` — ya está en main, copiar a v2)
- Gradiente del título hero

### Se puede simplificar inicialmente
- Grain texture (nice-to-have, puede diferirse)
- Sidebar draggable resize (click-to-toggle es suficiente para M2)
- Hover scale en cards (opacidad primero, luego transform)

### No necesita código de v1
- La lógica de negocio de v2 es superior (SSR auth, DB normalizada)
- Solo se reutilizan clases CSS y componentes visuales puros
