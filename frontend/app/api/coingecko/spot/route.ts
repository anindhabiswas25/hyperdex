import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=euro-coin,usd-coin&vs_currencies=usd&include_24hr_vol=true&include_market_cap=true&precision=full',
    { next: { revalidate: 30 } },
  );

  const data = await res.json();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
