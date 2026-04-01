/**
 * Utilidades y helpers para exámenes
 */

import { ExamStats, ExamQuestion } from './_types';

/**
 * Calcula estadísticas de un examen completado
 */
export function calculateExamStats(questions: ExamQuestion[]): ExamStats {
  const totalQuestions = questions.length;
  const correctAnswers = questions.filter((q) => q.is_correct === true).length;
  const partialAnswers = questions.filter(
    (q) => !q.is_correct && q.partial_score != null && q.partial_score > 0.01 && q.partial_score < 0.99
  ).length;
  const wrongAnswers = questions.filter(
    (q) => q.is_correct === false && !(q.partial_score != null && q.partial_score > 0.01)
  ).length;
  const unanswered = questions.filter((q) => q.user_answer === null).length;

  let totalPoints = 0;
  for (const q of questions) {
    if (q.is_correct === null) continue;
    if (q.partial_score != null) totalPoints += q.partial_score;
    else totalPoints += q.is_correct ? 1 : 0;
  }
  const scorePercentage = totalQuestions > 0 ? Math.round((totalPoints / totalQuestions) * 100) : 0;

  return {
    total_questions: totalQuestions,
    correct_answers: correctAnswers,
    partial_answers: partialAnswers,
    wrong_answers: wrongAnswers,
    unanswered,
    score_percentage: scorePercentage,
  };
}

/**
 * Valida una respuesta contra la respuesta correcta
 * Normaliza espacios en blanco y es case-insensitive para fill_in
 */
export function validateAnswer(
  userAnswer: string,
  correctAnswer: string,
  questionType: string
): boolean {
  if (!userAnswer) return false;

  const normalize = (str: string) => str.trim().toLowerCase();

  if (questionType === 'fill_in') {
    return normalize(userAnswer) === normalize(correctAnswer);
  }

  // Para multiple_choice y true_false, comparación exacta
  return userAnswer === correctAnswer;
}

/**
 * Formatea un número como porcentaje
 */
export function formatScorePercentage(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Determina la calificación letra basada en el porcentaje
 */
export function getLetterGrade(scorePercentage: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (scorePercentage >= 90) return 'A';
  if (scorePercentage >= 80) return 'B';
  if (scorePercentage >= 70) return 'C';
  if (scorePercentage >= 60) return 'D';
  return 'F';
}

/**
 * Obtiene el color de badges basado en la calificación
 */
export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return 'text-green-400';
    case 'B':
      return 'text-blue-400';
    case 'C':
      return 'text-yellow-400';
    case 'D':
      return 'text-orange-400';
    case 'F':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Formatea una fecha para mostrar cuándo se completó un examen
 */
export function formatExamDate(date: string | null): string {
  if (!date) return 'Not started';

  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
