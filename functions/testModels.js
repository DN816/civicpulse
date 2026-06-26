const { GoogleGenAI } = require('@google/genai');

async function testModels() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: 'civicpulse-2e523',
    location: 'us-central1'
  });

  const models = [
    'gemini-1.5-pro',
    'gemini-1.5-pro-001',
    'gemini-1.5-pro-002',
    'gemini-1.5-pro-preview-0409',
    'gemini-1.5-flash',
    'gemini-pro'
  ];

  for (const m of models) {
    try {
      console.log(`Testing ${m}...`);
      await ai.models.generateContent({
        model: m,
        contents: 'hello'
      });
      console.log(`✅ ${m} SUCCESS!`);
      break;
    } catch (e) {
      console.log(`❌ ${m} FAILED: ${e.message}`);
    }
  }
}

testModels();
