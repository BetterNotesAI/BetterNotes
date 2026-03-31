/**
 * Ejemplos de uso de las tablas de exámenes desde el frontend
 * Este archivo demuestra patrones comunes de integración
 */

import { createClient } from '@/lib/supabase/client';
import type {
  Exam,
  ExamQuestion,
  ExamLevel,
  CreateExamPayload,
} from './_types';
import {
  calculateExamStats,
  validateAnswer,
  formatScorePercentage,
  getLetterGrade,
  formatExamDate,
} from './_utils';

const supabase = createClient();

// ============================================================
// 1. Crear un nuevo examen
// ============================================================

export async function createNewExam(payload: {
  title: string;
  subject: string;
  level: ExamLevel;
  questionCount: number;
}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('exams')
      .insert({
        user_id: user.id,
        title: payload.title,
        subject: payload.subject,
        level: payload.level,
        question_count: payload.questionCount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as Exam;
  } catch (error) {
    console.error('Error creating exam:', error);
    throw error;
  }
}

// ============================================================
// 2. Cargar preguntas para un examen
// ============================================================

export async function loadExamQuestions(examId: string) {
  try {
    const { data, error } = await supabase
      .from('exam_questions')
      .select()
      .eq('exam_id', examId)
      .order('question_number', { ascending: true });

    if (error) throw error;
    return data as ExamQuestion[];
  } catch (error) {
    console.error('Error loading questions:', error);
    throw error;
  }
}

// ============================================================
// 3. Añadir preguntas a un examen
// ============================================================

export async function addQuestionsToExam(
  examId: string,
  questions: Array<{
    question_number: number;
    type: 'multiple_choice' | 'true_false' | 'fill_in';
    question: string;
    options?: string[];
    correct_answer: string;
    explanation?: string;
  }>
) {
  try {
    const { data, error } = await supabase
      .from('exam_questions')
      .insert(
        questions.map((q) => ({
          exam_id: examId,
          question_number: q.question_number,
          type: q.type,
          question: q.question,
          options: q.options || null,
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
        }))
      )
      .select();

    if (error) throw error;
    return data as ExamQuestion[];
  } catch (error) {
    console.error('Error adding questions:', error);
    throw error;
  }
}

// ============================================================
// 4. Responder una pregunta
// ============================================================

export async function answerQuestion(
  questionId: string,
  userAnswer: string
) {
  try {
    const { data, error } = await supabase
      .from('exam_questions')
      .update({
        user_answer: userAnswer,
      })
      .eq('id', questionId)
      .select()
      .single();

    if (error) throw error;
    return data as ExamQuestion;
  } catch (error) {
    console.error('Error saving answer:', error);
    throw error;
  }
}

// ============================================================
// 5. Validar respuesta (sin enviar a BD)
// ============================================================

export function checkAnswer(
  question: ExamQuestion,
  userAnswer: string
): { isCorrect: boolean; explanation: string } {
  const isCorrect = validateAnswer(
    userAnswer,
    question.correct_answer,
    question.type
  );

  return {
    isCorrect,
    explanation: question.explanation || 'No explanation available',
  };
}

// ============================================================
// 6. Completar examen y calcular puntuación
// ============================================================

export async function submitExam(examId: string) {
  try {
    // Cargar todas las preguntas
    const { data: questions, error: loadError } = await supabase
      .from('exam_questions')
      .select()
      .eq('exam_id', examId);

    if (loadError) throw loadError;

    // Calcular estadísticas
    const stats = calculateExamStats(questions as ExamQuestion[]);
    const score = stats.score_percentage;

    // Actualizar examen con resultado
    const { data, error } = await supabase
      .from('exams')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        score: score,
      })
      .eq('id', examId)
      .select()
      .single();

    if (error) throw error;

    return {
      exam: data as Exam,
      stats: stats,
      grade: getLetterGrade(score),
    };
  } catch (error) {
    console.error('Error submitting exam:', error);
    throw error;
  }
}

// ============================================================
// 7. Listar exámenes del usuario
// ============================================================

export async function listUserExams() {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select()
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Exam[];
  } catch (error) {
    console.error('Error loading exams:', error);
    throw error;
  }
}

// ============================================================
// 8. Listar solo exámenes pendientes
// ============================================================

export async function listPendingExams() {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select()
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Exam[];
  } catch (error) {
    console.error('Error loading pending exams:', error);
    throw error;
  }
}

// ============================================================
// 9. Obtener detalle completo de un examen
// ============================================================

export async function getExamDetail(examId: string) {
  try {
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select()
      .eq('id', examId)
      .single();

    if (examError) throw examError;

    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select()
      .eq('exam_id', examId)
      .order('question_number', { ascending: true });

    if (questionsError) throw questionsError;

    return {
      exam: exam as Exam,
      questions: questions as ExamQuestion[],
    };
  } catch (error) {
    console.error('Error loading exam detail:', error);
    throw error;
  }
}

// ============================================================
// 10. Obtener estadísticas después de completar
// ============================================================

export async function getCompletedExamStats(examId: string) {
  try {
    const { data: questions, error } = await supabase
      .from('exam_questions')
      .select()
      .eq('exam_id', examId);

    if (error) throw error;

    const stats = calculateExamStats(questions as ExamQuestion[]);
    const grade = getLetterGrade(stats.score_percentage);

    return {
      totalQuestions: stats.total_questions,
      correctAnswers: stats.correct_answers,
      wrongAnswers: stats.wrong_answers,
      unanswered: stats.unanswered,
      scorePercentage: formatScorePercentage(stats.score_percentage),
      grade: grade,
    };
  } catch (error) {
    console.error('Error calculating stats:', error);
    throw error;
  }
}

// ============================================================
// 11. Ejemplo de componente React usando los helpers
// ============================================================

export const ExamExampleComponent = {
  /**
   * Hook para cargar un examen
   */
  useExamDetail: async (examId: string) => {
    return await getExamDetail(examId);
  },

  /**
   * Hook para enviar respuesta a una pregunta
   */
  useAnswerQuestion: async (questionId: string, answer: string) => {
    return await answerQuestion(questionId, answer);
  },

  /**
   * Hook para completar examen
   */
  useSubmitExam: async (examId: string) => {
    return await submitExam(examId);
  },
};

// ============================================================
// EJEMPLOS DE USO EN COMPONENTES
// ============================================================

/*

// Crear examen
const exam = await createNewExam({
  title: 'Biology Midterm',
  subject: 'Biology 101',
  level: 'intermediate',
  questionCount: 20,
});

// Añadir preguntas
await addQuestionsToExam(exam.id, [
  {
    question_number: 1,
    type: 'multiple_choice',
    question: 'What is photosynthesis?',
    options: ['Process A', 'Process B', 'Process C'],
    correct_answer: 'Process B',
    explanation: 'Explanation...',
  },
  {
    question_number: 2,
    type: 'true_false',
    question: 'The Earth is flat.',
    correct_answer: 'false',
    explanation: 'The Earth is approximately spherical.',
  },
]);

// Cargar preguntas
const questions = await loadExamQuestions(exam.id);

// Responder pregunta
const answered = await answerQuestion(questions[0].id, 'Process B');

// Validar respuesta
const check = checkAnswer(questions[0], 'Process B');
console.log(check.isCorrect); // true
console.log(check.explanation); // 'Explanation...'

// Completar examen
const result = await submitExam(exam.id);
console.log(result.grade); // 'A'
console.log(result.stats.score_percentage); // 95

// Listar exámenes
const allExams = await listUserExams();
const pending = await listPendingExams();

*/
