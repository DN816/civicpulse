"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyReportPhoto = classifyReportPhoto;
exports.fetchImageAsBase64 = fetchImageAsBase64;
const genai_1 = require("@google/genai");
async function classifyReportPhoto(photoUrl, description) {
    const ai = new genai_1.GoogleGenAI({});
    const prompt = `
You are a civic issue classifier. Look at this photo and return a JSON object only.
No preamble. No markdown. No explanation. Only the JSON object.

The JSON must have exactly these fields:
- is_civic_issue: boolean — true only if the photo clearly shows a real civic infrastructure problem
- category: string — one of exactly: "Pothole / road damage", "Water leakage / pipeline issue", "Damaged streetlight", "Waste management", "Drainage / waterlogging", "Public property damage", "Illegal construction / encroachment", "Other"
- severity: string — one of exactly: "Low", "Medium", "High"
- classifier_confidence: number — your confidence from 0.0 to 1.0
- needs_clarification: boolean — true only if confidence is below 0.7 and a single question would help
- clarification_question: string or null — if needs_clarification is true, write one short question with two or three answer options separated by " / ". Null if needs_clarification is false.

${description ? `The citizen also wrote: "${description}"` : ''}
`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            prompt,
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: await fetchImageAsBase64(photoUrl)
                }
            }
        ]
    });
    const text = response.text ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
}
async function fetchImageAsBase64(url) {
    if (url.startsWith('data:image/')) {
        return url.split(',')[1];
    }
    const fetch = (await Promise.resolve().then(() => require('node-fetch'))).default;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'CivicPulse-Bot/1.0 (contact@example.com)'
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.buffer();
    return buffer.toString('base64');
}
//# sourceMappingURL=gemini.js.map