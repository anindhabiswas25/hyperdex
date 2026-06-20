import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_DAYS = new Set(['1', '7', '30', '365', 'max']);

export async function GET(req: NextRequest) {
  const days = req.nextUrl.searchParams.get('days') ?? '1';
  if (!ALLOWED_DAYS.has(days)) {
    return NextResponse.json({ error: 'invalid days param' }, { status: 400 });
  }

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/euro-coin/market_chart?vs_currency=usd&days=${days}`,
    { next: { revalidate: 60 } },
  );

  const data = await res.json();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
