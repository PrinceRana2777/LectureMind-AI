export type Subject = 'Physics' | 'Chemistry' | 'Biology' | 'Mathematics' | 'General';
export type ProcessingStatus = 'uploading' | 'processing' | 'completed' | 'error';
export type SourceType = 'file' | 'youtube';

export interface KeyTopic {
  timestamp: string;
  topic: string;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Doubt {
  timestamp: string;
  reason: string;
}

export interface Lecture {
  id: string;
  userId: string;
  title: string;
  subject: Subject;
  status: ProcessingStatus;
  sourceType: SourceType;
  videoUrl?: string;
  thumbnailUrl?: string;
  transcript?: string;
  summary?: string;
  detailedNotes?: string;
  keyTopics?: KeyTopic[];
  flashcards?: Flashcard[];
  quiz?: QuizQuestion[];
  doubts?: Doubt[];
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: any;
}
