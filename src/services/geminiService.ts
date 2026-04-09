import { GoogleGenAI, Type } from "@google/genai";
import { Lecture, Subject } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function getYouTubeId(url: string): string | null {
  const regExp = /(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export async function processYouTubeLecture(url: string, title: string): Promise<Partial<Lecture>> {
  const videoId = getYouTubeId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');

  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const model = "gemini-3-flash-preview";
  
  // In a real production app, we would use a tool to fetch the transcript or audio.
  // For this demo, we'll use Gemini's ability to reason about public content if possible,
  // or simulate the extraction based on the URL.
  // Note: Gemini 3 can use urlContext if configured, but here we'll prompt it to 
  // "imagine" or "simulate" based on the title and URL for the sake of the demo UI.
  
  const prompt = `
    You are an expert JEE and NEET study assistant. 
    Analyze this YouTube lecture: ${normalizedUrl} (Title: ${title}).
    
    1. Detect the subject (Physics, Chemistry, Biology, Mathematics).
    2. Generate a clean, student-friendly transcript with timestamps.
    3. Create a concise summary.
    4. Generate detailed study notes. 
       - Use LaTeX for all mathematical equations and chemical reactions (e.g., $E=mc^2$).
       - Structure with clear headings and bullet points.
    5. Extract key topics with timestamps.
    6. Generate 5 flashcards (Question/Answer).
    7. Generate a 5-question MCQ quiz with options, correct answers, and explanations.
    8. Identify potentially confusing segments (doubts) based on topic shifts or complex concepts.

    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          transcript: { type: Type.STRING },
          summary: { type: Type.STRING },
          detailedNotes: { type: Type.STRING },
          keyTopics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: { type: Type.STRING },
                topic: { type: Type.STRING }
              }
            }
          },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING }
              }
            }
          },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              }
            }
          },
          doubts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: { type: Type.STRING },
                reason: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const result = JSON.parse(response.text);
  return {
    ...result,
    status: 'completed',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    videoUrl: normalizedUrl,
    sourceType: 'youtube'
  };
}

export async function processLecture(file: File, title: string): Promise<Partial<Lecture>> {
  // In a real app, we'd send the file to Gemini. 
  // Since we are in a browser environment, we can use the File API.
  
  const model = "gemini-3-flash-preview";
  
  // Convert file to base64
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  const prompt = `
    You are an expert JEE and NEET study assistant. 
    Analyze this lecture recording (audio/video).
    
    1. Detect the subject (Physics, Chemistry, Biology, Mathematics).
    2. Generate a clean, student-friendly transcript with timestamps.
    3. Create a concise summary.
    4. Generate detailed study notes. 
       - Use LaTeX for all mathematical equations and chemical reactions (e.g., $E=mc^2$).
       - Structure with clear headings and bullet points.
    5. Extract key topics with timestamps.
    6. Generate 5 flashcards (Question/Answer).
    7. Generate a 5-question MCQ quiz with options, correct answers, and explanations.
    8. Identify potentially confusing segments (doubts) based on topic shifts or complex concepts.

    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Data, mimeType: file.type } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          transcript: { type: Type.STRING },
          summary: { type: Type.STRING },
          detailedNotes: { type: Type.STRING },
          keyTopics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: { type: Type.STRING },
                topic: { type: Type.STRING }
              }
            }
          },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING }
              }
            }
          },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              }
            }
          },
          doubts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: { type: Type.STRING },
                reason: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const result = JSON.parse(response.text);
  return {
    ...result,
    status: 'completed'
  };
}
