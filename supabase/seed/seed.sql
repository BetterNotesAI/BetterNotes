insert into public.templates (slug, name, description, latex_template, preview_image_path, is_active)
values
  (
    'landscape-3-columns',
    'Landscape 3 columns (Maths)',
    'Compact 3-column landscape layout ideal for formulas and derivations.',
    '\\documentclass[10pt,landscape]{article}
\\usepackage[a4paper,margin=1.2cm]{geometry}
\\usepackage{multicol}
\\usepackage{amsmath,amssymb}
\\usepackage{titlesec}
\\setlength{\\parindent}{0pt}
\\begin{document}
\\begin{center}\\Large\\textbf{{{TITLE}}}\\end{center}
\\vspace{0.2cm}
\\textbf{Prompt:} {PROMPT}\\\\
\\textbf{Summary:} {SUMMARY}
\\begin{multicols}{3}
{SECTIONS}
\\end{multicols}
\\vspace{0.2cm}
\\textbf{Key Equations}
\\[
{EQUATIONS}
\\]
\\end{document}',
    'templates/landscape-3-columns.png',
    true
  ),
  (
    'portrait-2-columns',
    'Portrait 2 columns (QFT/QED cheat-sheet)',
    'Classic portrait format with two balanced columns and equation block.',
    '\\documentclass[10pt]{article}
\\usepackage[a4paper,margin=1.5cm]{geometry}
\\usepackage{multicol}
\\usepackage{amsmath,amssymb}
\\setlength{\\parindent}{0pt}
\\begin{document}
\\begin{center}\\Large\\textbf{{{TITLE}}}\\end{center}
\\vspace{0.2cm}
\\textbf{Prompt:} {PROMPT}\\\\
\\textbf{Summary:} {SUMMARY}
\\begin{multicols}{2}
{SECTIONS}
\\end{multicols}
\\vspace{0.2cm}
\\textbf{Key Equations}
\\[
{EQUATIONS}
\\]
\\end{document}',
    'templates/portrait-2-columns.png',
    true
  ),
  (
    'cornell-notes',
    'Cornell Notes System',
    'Guided Cornell note-taking with cue and summary areas.',
    '\\documentclass[11pt]{article}
\\usepackage[a4paper,margin=1.8cm]{geometry}
\\usepackage{array}
\\setlength{\\parindent}{0pt}
\\begin{document}
\\begin{center}\\Large\\textbf{{{TITLE}}}\\end{center}
\\vspace{0.3cm}
\\textbf{Prompt:} {PROMPT}\\\\
\\textbf{Summary:} {SUMMARY}
\\vspace{0.4cm}
{SECTIONS}
\\vspace{0.6cm}
\\textbf{Equations / Key expressions}
\\[
{EQUATIONS}
\\]
\\end{document}',
    'templates/cornell-notes.png',
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  latex_template = excluded.latex_template,
  preview_image_path = excluded.preview_image_path,
  is_active = excluded.is_active;
