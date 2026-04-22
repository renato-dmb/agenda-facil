import { NextResponse } from 'next/server';
import { botCall } from '@/lib/bot-client';

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await botCall('POST', `/api/bot/appointments/${id}/cancel`);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
