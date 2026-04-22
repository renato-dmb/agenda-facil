import { NextResponse } from 'next/server';
import { botCall } from '@/lib/bot-client';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await botCall('POST', '/api/bot/appointments', body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
