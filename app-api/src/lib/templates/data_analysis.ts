import { TemplateDefinition } from './types';

export const dataAnalysis: TemplateDefinition = {
  id: 'data_analysis',
  displayName: 'Data Analysis Report',
  description: 'Statistics or machine learning report with Python code listings, results tables, and mathematical formulations.',
  isPro: true,

  preamble: `\\documentclass[11pt]{article}
\\usepackage[english]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{geometry}
\\geometry{a4paper,left=25mm,right=25mm,top=25mm,bottom=25mm}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{float}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage{multirow}
\\usepackage{xcolor}
\\usepackage{listings}
\\usepackage{hyperref}
\\hypersetup{colorlinks=true,linkcolor=blue,urlcolor=blue}
\\usepackage{titlesec}
\\titleformat{\\section}{\\large\\bfseries}{\\thesection.}{0.5em}{}
\\titleformat{\\subsection}{\\bfseries}{\\thesubsection.}{0.5em}{}
\\definecolor{codegray}{rgb}{0.5,0.5,0.5}
\\definecolor{codepurple}{rgb}{0.58,0,0.82}
\\definecolor{codegreen}{rgb}{0,0.6,0}
\\definecolor{backcolor}{rgb}{0.97,0.97,0.97}
\\lstdefinestyle{pythonstyle}{
  backgroundcolor=\\color{backcolor},
  commentstyle=\\color{codegreen},
  keywordstyle=\\color{blue},
  numberstyle=\\tiny\\color{codegray},
  stringstyle=\\color{codepurple},
  basicstyle=\\ttfamily\\footnotesize,
  breakatwhitespace=false,breaklines=true,
  captionpos=b,keepspaces=true,
  numbers=left,numbersep=5pt,showspaces=false,
  showstringspaces=false,showtabs=false,tabsize=2,
  language=Python
}
\\lstset{style=pythonstyle}
\\setlength{\\parindent}{1em}
\\setlength{\\parskip}{3pt}`,

  styleGuide: `You are generating a DATA ANALYSIS REPORT for a statistics, data science, or ML course/project.

STRUCTURE (in order):
1. \\title{...} \\author{...} \\date{...} \\maketitle
2. \\begin{abstract} — dataset, methods, key findings with numbers \\end{abstract}
3. \\section{Introduction} — problem statement, dataset description, objectives
4. \\section{Exploratory Data Analysis} — descriptive statistics, distribution analysis
5. \\section{Methods} — statistical tests, model descriptions, mathematical formulations
6. \\section{Results} — tables of metrics, model performance, hypothesis test results
7. \\section{Discussion} — interpretation, limitations, comparison with baseline
8. \\section{Conclusion}

CONTENT RULES:
- Use lstlisting for Python/R code snippets with the pythonstyle (already defined)
- Use booktabs for results tables
- Include statistical formulas: hypothesis tests, confidence intervals, loss functions, metrics
- Include realistic numerical results (e.g., accuracy = 94.2%, p-value = 0.023)
- Use align* for multi-line math derivations
- End with: \\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}`,

  structureTemplate: `\\begin{document}
% FILL: \\title{Analysis Title}
% FILL: \\author{Author Name}
% FILL: \\date{\\today}
\\maketitle

\\begin{abstract}
% FILL: Dataset description, methods used, and 2-3 key numerical findings
\\end{abstract}

\\section{Introduction}
% FILL: Problem statement and motivation
% FILL: Dataset description: source, size, features, target variable
% FILL: Objectives of the analysis

\\section{Exploratory Data Analysis}
% FILL: Descriptive statistics (mean, std, quartiles)
% FILL: Table of key statistics with booktabs
% FILL: Notable patterns or distributions in the data

\\section{Methods}
% FILL: Statistical or ML method with mathematical formulation
% FILL: Loss function or test statistic with align*
% FILL: Python code snippet with \\begin{lstlisting}[caption={...}] ... \\end{lstlisting}
% FILL: Cross-validation or experimental setup

\\section{Results}
% FILL: Table of performance metrics (accuracy, F1, p-value, R², etc.)
% FILL: Key numerical result highlighted
% FILL: Second code snippet if needed (e.g., evaluation)

\\section{Discussion}
% FILL: Interpretation of results
% FILL: Comparison with baseline or related work
% FILL: Limitations of the approach

\\section{Conclusion}
% FILL: Summary of findings
% FILL: Practical implications and future directions

\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,

  structureExample: `\\begin{document}
\\title{Predicting Student Performance: A Machine Learning Approach}
\\author{A. Researcher}
\\date{\\today}
\\maketitle

\\begin{abstract}
We apply logistic regression and random forests to predict student pass/fail from demographic and academic features. Our best model achieves AUC = 0.89 on the held-out test set.
\\end{abstract}

\\section{Methods}
The logistic regression loss is:
\\[ \\mathcal{L} = -\\frac{1}{n}\\sum_{i=1}^n \\left[y_i\\log(\\hat{p}_i) + (1-y_i)\\log(1-\\hat{p}_i)\\right] \\]

\\begin{lstlisting}[caption={Model training in Python}]
from sklearn.linear_model import LogisticRegression
model = LogisticRegression(C=1.0, max_iter=1000)
model.fit(X_train, y_train)
print(f"AUC: {roc_auc_score(y_test, model.predict_proba(X_test)[:,1]):.3f}")
\\end{lstlisting}

\\section{Results}
\\begin{table}[H]
\\centering
\\begin{tabular}{lcccc}
\\toprule
Model & Accuracy & Precision & Recall & AUC \\\\
\\midrule
Logistic Regression & 0.872 & 0.881 & 0.863 & 0.891 \\\\
Random Forest & 0.894 & 0.901 & 0.887 & 0.921 \\\\
\\bottomrule
\\end{tabular}
\\caption{Model comparison on test set.}
\\end{table}
\\begin{flushright}\\footnotesize \\textit{made with BetterNotes-AI}\\end{flushright}
\\end{document}`,
};
