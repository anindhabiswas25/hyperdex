'use client';

import Navbar from '@/components/Navbar';
import SwapCard from '@/components/swap/SwapCard';
import PriceChartPanel from '@/components/swap/PriceChartPanel';

export default function SwapPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream pb-20" style={{ paddingTop: '72px' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-10">

          {/* Two-column trading layout */}
          <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start pt-10">

            {/* LEFT — price chart */}
            <div className="flex-1 min-w-0">
              <PriceChartPanel />
            </div>

            {/* RIGHT — swap card (sticky) */}
            <div className="w-full lg:w-[400px] flex-shrink-0 lg:sticky lg:top-28">
              <SwapCard />
            </div>

          </div>
        </div>
      </main>
    </>
  );
}
