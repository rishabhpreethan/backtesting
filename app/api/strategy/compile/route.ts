import { NextRequest, NextResponse } from 'next/server';
import { compileStrategyWithGemini } from '@/lib/services/llmStrategy';
import { StrategyJsonSchema } from '@/lib/services/strategySchema';
import { mapStrategyJsonToInternal } from '@/lib/services/strategyMapper';

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: 'Missing strategy text' }, { status: 400 });
    }

    const compiled = await compileStrategyWithGemini(text);
    if ('error' in compiled) {
      console.error('LLM Compile Error:', compiled.error);
      return NextResponse.json({ success: false, error: compiled.error }, { status: 400 });
    }

    // Validate again on server (belt-and-suspenders)
    try {
      const validated = StrategyJsonSchema.parse(compiled);
      const strategy = mapStrategyJsonToInternal(validated);

      return NextResponse.json({
        success: true,
        data: {
          strategy,
          symbol: validated.symbol,
          timeframe: validated.timeframe,
        },
      }, { status: 200 });
    } catch (validationErr: any) {
      console.error('Schema Validation Error:', validationErr);
      return NextResponse.json({ success: false, error: 'Internal validation failed' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Compile strategy error', err?.message || err);
    return NextResponse.json({ success: false, error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
