/**
 * Types para la funcionalidad de exámenes (F4-M2)
 * Corresponden a las tablas: public.exams y public.exam_questions
 */

/**
 * Nivel de dificultad del examen
 * Formato: <tier>_<difficulty>
 */
export type ExamLevel =
  | 'secondary_basic'
  | 'secondary_intermediate'
  | 'secondary_advanced'
  | 'highschool_basic'
  | 'highschool_intermediate'
  | 'highschool_advanced'
  | 'university_basic'
  | 'university_intermediate'
  | 'university_advanced';

/**
 * Estado del examen
 */
export type ExamStatus = 'pending' | 'completed';

/**
 * Tipo de pregunta del examen
 */
export type ExamQuestionType = 'multiple_choice' | 'true_false' | 'fill_in' | 'flashcard';

/**
 * Opciones para una pregunta de opción múltiple
 * Array de strings con las opciones disponibles
 */
export type ExamOptions = string[] | null;

/**
 * Examen completo con metadatos
 * Corresponde a la tabla public.exams
 */
export interface Exam {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  level: ExamLevel;
  question_count: number;
  score: number | null;
  status: ExamStatus;
  grading_mode?: 'strict' | 'partial';
  created_at: string;
  completed_at: string | null;
  // Sharing
  is_published?: boolean;
  share_token?: string | null;
  shared_attempts?: number;
  source_exam_id?: string | null;
}

/**
 * Pregunta de examen con respuesta
 * Corresponde a la tabla public.exam_questions
 */
export interface ExamQuestion {
  id: string;
  exam_id: string;
  question_number: number;
  type: ExamQuestionType;
  question: string;
  options: ExamOptions;
  correct_answer: string;
  user_answer: string | null;
  is_correct: boolean | null;
  partial_score?: number | null;
  explanation: string | null;
  has_math?: boolean;
  answer_image_url?: string | null;
  created_at: string;
}

/**
 * Pregunta tal como se presenta al usuario durante el examen
 * (sin revelar la respuesta correcta)
 */
export interface ExamQuestionDisplay extends Omit<ExamQuestion, 'correct_answer' | 'explanation' | 'is_correct'> {
  // Solo incluye campos que el usuario debe ver durante el examen
}

/**
 * Pregunta con respuesta para la revisión posterior
 * (incluye respuesta correcta y explicación)
 */
export interface ExamQuestionReview extends ExamQuestion {
  // Todos los campos, incluyendo respuesta correcta y explicación
}

/**
 * Payload para crear un nuevo examen
 */
export interface CreateExamPayload {
  title: string;
  subject: string;
  level: ExamLevel;
  question_count: number;
  // questions se añaden después con insertExamQuestions
}

/**
 * Payload para crear una pregunta de examen
 */
export interface CreateExamQuestionPayload {
  exam_id: string;
  question_number: number;
  type: ExamQuestionType;
  question: string;
  options?: ExamOptions;
  correct_answer: string;
  explanation?: string;
}

/**
 * Payload para responder una pregunta
 */
export interface AnswerExamQuestionPayload {
  exam_id: string;
  question_id: string;
  user_answer: string;
}

/**
 * Payload para completar un examen
 */
export interface CompleteExamPayload {
  exam_id: string;
  score: number; // 0-100 o puntos totales
}

/**
 * Estadísticas de un examen completado
 */
export interface ExamStats {
  total_questions: number;
  correct_answers: number;
  partial_answers: number;
  wrong_answers: number;
  unanswered: number;
  score_percentage: number;
}
