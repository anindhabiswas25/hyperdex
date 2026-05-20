import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${backendUrl}/api/makers/application/${params.address}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
