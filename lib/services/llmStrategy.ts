import { StrategyJson, StrategyJsonSchema } from './strategySchema';

const SYSTEM_PROMPT = `
You are an LLM used only to translate a user's natural-language description of a trading strategy into a strict, structured JSON strategy definition.

What You Do
- Convert plain English strategy explanations into structured data
- Normalize vague human language into explicit trading rules
- Infer reasonable defaults when missing (within constraints)
- Output valid JSON only

What You Must NEVER Do
- Do NOT simulate trades
- Do NOT calculate indicators
- Do NOT optimize parameters
- Do NOT explain your reasoning
- Do NOT output text outside JSON
- Do NOT invent indicators, operators, or data sources

Allowed Concepts
Indicators: SMA, EMA, RSI
Operators: >, <, cross_above, cross_below
Defaults:
- RSI period defaults to 14 if not specified
- Symbol defaults to BTCUSDT if not specified
- Timeframe defaults to 1h if not specified

Logic Rules
- entry.all: ALL conditions must be true (AND)
- entry.any: ANY condition true (OR)
- exit.all / exit.any similarly

Risk Controls
- stopLossPct, takeProfitPct (percentages, fixed numbers)

Output: JSON only in this shape:
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "entry": {
    "all": [
      {
        "left": { "indicator": "EMA", "period": 20 },
        "operator": "cross_above",
        "right": { "indicator": "EMA", "period": 50 }
      }
    ]
  },
  "exit": {
    "any": [
      {
        "left": { "indicator": "RSI", "period": 14 },
        "operator": ">",
        "value": 70
      }
    ]
  },
  "risk": {
    "stopLossPct": 2,
    "takeProfitPct": 4
  }
}

If the input is too vague to convert safely, output:
{ "error": "Strategy description is too vague to convert into rules" }
`;

export async function compileStrategyWithGemini(userText: string): Promise<StrategyJson | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: 'GEMINI_API_KEY is not configured on the server' };
  }

  // Gemini 1.5 generateContent API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: {
      role: 'system',
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userText }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  } as const;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { error: `Gemini request failed with status ${res.status}` };
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  console.log('Gemini Raw Response:', text);
  if (!text) {
    return { error: 'Gemini returned no content' };
  }

  // Ensure it's JSON and validate
  try {
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);
    if (parsed && typeof parsed === 'object' && parsed.error) {
      return { error: String(parsed.error) };
    }
    const validated = StrategyJsonSchema.parse(parsed);
    return validated;
  } catch (e: any) {
    return { error: `Invalid JSON from LLM: ${e?.message || 'parse error'}` };
  }
}
