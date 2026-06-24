import { GoogleGenAI } from '@google/genai';
import { fetchImageAsBase64 } from './gemini';

export interface ResolutionValidation {
  fix_appears_genuine: boolean;
  confidence: number;
  reasoning: string;
}

export async function compareBeforeAfterPhotos(
  beforePhotoUrl: string,
  afterPhotoUrl: string
): Promise<ResolutionValidation> {
  const ai = new GoogleGenAI({});

  const prompt = `
You are a civic issue resolution validator. You will see two photos:
1. A BEFORE photo showing a civic issue (pothole, leak, damage, etc.)
2. An AFTER photo showing the same location after a fix was attempted.

Compare the two photos and return a JSON object only.
No preamble. No markdown. No explanation. Only the JSON object.

The JSON must have exactly these fields:
- fix_appears_genuine: boolean — true if the after photo shows the issue has been meaningfully addressed
- confidence: number — your confidence from 0.0 to 1.0
- reasoning: string — brief explanation (max 100 words) of why you believe the fix is or is not genuine
`;

  const [beforeBase64, afterBase64] = await Promise.all([
    fetchImageAsBase64(beforePhotoUrl),
    fetchImageAsBase64(afterPhotoUrl),
  ]);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: beforeBase64,
        },
      },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: afterBase64,
        },
      },
    ],
  });

  const text = response.text ?? '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as ResolutionValidation;
}
