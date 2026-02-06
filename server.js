import express from 'express';

const app = express();
const port = Number(process.env.PORT || 8787);
const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.error('Missing GROQ_API_KEY in environment variables.');
}

app.use(express.json({ limit: '1mb' }));

app.post('/api/chat', async (req, res) => {
  try {
    if (!groqApiKey) {
      return res.status(500).json({ error: 'Missing GROQ_API_KEY.' });
    }

    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages must be an array.' });
    }

    const systemPrompt = {
      role: 'system',
      content:
        'You are a friendly, human-like assistant for a health monitoring dashboard. Keep replies concise, empathetic, and helpful. Avoid medical diagnosis. If asked for medical advice, suggest consulting a professional.',
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [systemPrompt, ...messages],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: errorText || 'Groq API error.' });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content ?? '';
    return res.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Chat server listening on http://localhost:${port}`);
});
