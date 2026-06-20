import React, { useState, useEffect, useRef } from 'react';

// --- Mock Data ---
const STATUS_STEPS = ["Draft", "Pending", "Bought", "Settled"];
const STATUS_INDEX = { "Draft": 0, "Pending": 1, "Bought": 2, "Settled": 3 };

const MOCK_ORDERS = [
  {
    id: "KTM-8472",
    date: "16 Jun 2026",
    type: "catalog",
    name: "Keychron K3 Pro Low Profile Wireless Mechanical Keyboard",
    qty: 1,
    status: "Draft",
    price_jpy: 17600,
    price_idr_estimate: 1850000,
    price_idr_final: null,
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=200"
  },
  {
    id: "KTM-8470",
    date: "15 Jun 2026",
    type: "custom",
    name: "Amazon JP: Artbook 'Cyberpunk 2077' Complete Edition",
    qty: 2,
    status: "Pending",
    price_jpy: 4500,
    price_idr_estimate: 550000,
    price_idr_final: null,
    image: null
  },
  {
    id: "KTM-8455",
    date: "10 Jun 2026",
    type: "catalog",
    name: "Tokyo Banana Original (8pcs)",
    qty: 3,
    status: "Bought",
    price_jpy: 1166,
    price_idr_estimate: 145000,
    price_idr_final: null,
    image: "https://images.unsplash.com/photo-1588632668582-ea3017a42bbd?auto=format&fit=crop&q=80&w=200"
  },
  {
    id: "KTM-8412",
    date: "28 May 2026",
    type: "catalog",
    name: "Sony WH-1000XM5 Headphones",
    qty: 1,
    status: "Settled",
    price_jpy: 49800,
    price_idr_estimate: 5200000,
    price_idr_final: 5250000, // Slightly different final price
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=200"
  },
  {
    id: "KTM-8399",
    date: "20 May 2026",
    type: "catalog",
    name: "Uniqlo U AIRism Cotton Oversized T-Shirt",
    qty: 1,
    status: "Cancelled",
    price_jpy: 1990,
    price_idr_estimate: 245000,
    price_idr_final: null,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=200"
  }
];

export default function App() {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Calculate total to pay for 'Settled' orders
  const totalToPay = MOCK_ORDERS
    .filter(o => o.status === 'Settled')
    .reduce((sum, o) => sum + (o.price_idr_final * o.qty), 0);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-[#F9F9F7] text-[#1A1D23] font-sans pb-24">
      {/* Font Injections: DM Sans for UI, JetBrains Mono for Pricing/IDs */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
      `}} />

      {/* --- Navigation Bar --- */}
      <nav className="bg-[#FFFFFF] border-b border-[#E8E9ED] px-4 md:px-6 py-4 sticky top-0 z-20">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col cursor-pointer" onClick={() => console.log('Go to catalog')}>
              <span className="text-[1.25rem] font-bold tracking-[-0.01em] leading-tight text-[#1A1D23]">Kotemart</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#1A8F89] hidden sm:block pointer-events-none">
              Pesanan Saya
            </button>
            
            {/* User Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-[#1A8F89] flex items-center justify-center text-[#FFFFFF] text-[0.6875rem] font-bold focus:outline-none focus:ring-2 focus:ring-[#1A8F89] focus:ring-offset-2 transition-transform hover:scale-105"
              >
                US
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#FFFFFF] border border-[#E8E9ED] rounded-[6px] shadow-[0_4px_16px_rgba(26,29,35,0.08)] py-1 z-30 overflow-hidden">
                  <button 
                    onClick={() => {
                      console.log('Logout triggered');
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-[0.8125rem] text-[#D1453B] hover:bg-[#FDF3E7] transition-colors font-semibold flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* --- Main Content Area --- */}
      <main className="max-w-[800px] mx-auto px-4 md:px-6 pt-[32px] md:pt-[48px]">
        
        <div className="mb-[32px] md:mb-[48px]">
          <h1 className="text-[2.5rem] font-bold leading-[1.15] tracking-[-0.03em] text-[#1A1D23]">
            Pesanan Saya
          </h1>
          <p className="text-[1.125rem] leading-[1.6] text-[#5B606D] mt-2">
            Pantau status pesanan jastip Anda. Harga final akan muncul ketika barang berhasil dibeli (Settled).
          </p>
        </div>

        {/* --- Payment Summary Card --- */}
        {totalToPay > 0 && (
          <div className="mb-[32px] bg-[#FFFFFF] border border-[#E8E9ED] rounded-[10px] p-[24px] shadow-[0_1px_3px_rgba(26,29,35,0.06),0_1px_2px_rgba(26,29,35,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-[24px]">
            <div>
              <h2 className="text-[0.9375rem] font-semibold leading-[1.55] text-[#5B606D] mb-1">Total Tagihan (Belum Dibayar)</h2>
              <span className="text-[2rem] font-bold leading-[1.2] tracking-[-0.02em] text-[#1A1D23]">
                Rp {totalToPay.toLocaleString('id-ID')}
              </span>
              <p className="text-[0.8125rem] text-[#5B606D] mt-2">Total dari pesanan dengan status <span className="font-semibold text-[#1E6B3F]">Settled</span>.</p>
            </div>
            
            <div className="bg-[#F9F9F7] border border-[#E8E9ED] rounded-[6px] p-[16px] w-full md:w-[320px] shrink-0">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#5B606D] mb-4">Transfer ke Bank Berikut</h3>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[0.8125rem] text-[#5B606D]">Bank BCA</span>
                <span className="font-mono text-[1rem] font-bold text-[#1A1D23]">123 456 7890</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[0.8125rem] text-[#5B606D]">Atas Nama</span>
                <span className="text-[0.8125rem] font-semibold text-[#1A1D23]">Darma Kotama</span>
              </div>
              <div className="mt-4 pt-4 border-t border-[#E8E9ED]">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText("1234567890");
                    }}
                    className="w-full text-center text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#1A8F89] hover:text-[#0F726E] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Salin No. Rekening
                  </button>
              </div>
            </div>
          </div>
        )}

        {/* --- Orders List --- */}
        <div className="flex flex-col gap-[12px]">
          {MOCK_ORDERS.map((order) => {
            const currentStepIdx = STATUS_INDEX[order.status] || 0; // Default to 0 for cancelled
            
            return (
              <div 
                key={order.id}
                className={`bg-[#FFFFFF] border rounded-[10px] p-[16px] transition-shadow hover:shadow-[0_2px_8px_rgba(26,29,35,0.06)] ${order.status === 'Cancelled' ? 'border-[#F5C2C0] bg-[#FDEDEC]/30' : 'border-[#E8E9ED]'}`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center gap-[16px]">
                  
                  {/* Left: Image & Info (Flex Grow) */}
                  <div className="flex items-start gap-[12px] w-full md:flex-1">
                    {/* Image */}
                    <div className={`w-[56px] h-[56px] md:w-[64px] md:h-[64px] shrink-0 bg-[#F1F2F5] rounded-[6px] border border-[#E8E9ED] overflow-hidden flex items-center justify-center ${order.status === 'Cancelled' ? 'opacity-50 grayscale' : ''}`}>
                      {order.image ? (
                        <img src={order.image} alt={order.name} className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-6 h-6 text-[#5B606D] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-grow min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`font-mono text-[0.75rem] font-semibold ${order.status === 'Cancelled' ? 'text-[#A6312A]' : 'text-[#1A1D23]'}`}>
                          {order.id}
                        </span>
                        <span className={`px-[6px] py-[2px] rounded-[3px] text-[0.625rem] font-semibold uppercase tracking-[0.1em] ${order.type === 'custom' ? 'bg-[#E8E9ED] text-[#1A1D23]' : 'bg-[#D5EDEB] text-[#0F726E]'}`}>
                          {order.type === 'custom' ? 'Custom' : 'Catalog'}
                        </span>
                        <span className="text-[0.6875rem] text-[#5B606D] hidden sm:block">{order.date}</span>
                      </div>
                      <h3 className={`text-[0.9375rem] font-semibold leading-[1.3] text-[#1A1D23] line-clamp-1 mb-1 ${order.status === 'Cancelled' ? 'line-through opacity-70' : ''}`}>
                        {order.name}
                      </h3>
                      <p className="text-[0.8125rem] text-[#5B606D]">Qty: {order.qty}</p>
                    </div>
                  </div>

                  {/* Middle: Stepper / Status (Fixed Width) */}
                  <div className="w-full md:w-[200px] lg:w-[240px] shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#E8E9ED]">
                    {order.status === 'Cancelled' ? (
                        <div className="flex items-center gap-1.5 text-[#D1453B]">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-[0.75rem] font-semibold uppercase tracking-[0.05em]">Dibatalkan</span>
                        </div>
                    ) : (
                        <div className="relative w-full">
                          <div className="flex items-center justify-between w-full relative z-10">
                            {STATUS_STEPS.map((step, idx) => {
                              const isActive = idx <= currentStepIdx;
                              return (
                                <div key={step} className="flex flex-col items-center gap-1.5 w-1/4">
                                  <div className={`w-[10px] h-[10px] rounded-full border-[1.5px] z-10 bg-[#FFFFFF] ${isActive ? 'border-[#1A8F89] ring-2 ring-[#1A8F89] bg-[#1A8F89]' : 'border-[#E8E9ED]'}`} />
                                  <span className={`text-[0.5625rem] font-semibold uppercase tracking-[0.05em] ${isActive ? 'text-[#1A1D23]' : 'text-[#5B606D] opacity-60'}`}>
                                    {step}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                          {/* Progress Line */}
                          <div className="absolute top-[4.5px] left-[12.5%] right-[12.5%] h-[1.5px] bg-[#E8E9ED] z-0">
                            <div className="h-full bg-[#1A8F89] transition-all" style={{ width: `${(currentStepIdx / (STATUS_STEPS.length - 1)) * 100}%` }} />
                          </div>
                        </div>
                    )}
                  </div>

                  {/* Right: Prices (Fixed Width) */}
                  <div className="w-full md:w-[130px] shrink-0 flex flex-row md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 border-[#E8E9ED] pt-3 md:pt-0">
                    <span className={`font-mono text-[0.75rem] text-[#5B606D] md:mb-1 ${order.status === 'Cancelled' ? 'opacity-60' : ''}`}>
                      ¥ {(order.price_jpy * order.qty).toLocaleString('ja-JP')}
                    </span>
                    <div className="flex flex-col items-end">
                      {order.status === 'Cancelled' ? (
                        <>
                          <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-[#5B606D] mb-0.5">Dibatalkan</span>
                          <span className="text-[1rem] font-bold text-[#5B606D] line-through">
                            Rp {(order.price_idr_estimate * order.qty).toLocaleString('id-ID')}
                          </span>
                        </>
                      ) : order.status === 'Settled' ? (
                        <>
                          <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-[#1E6B3F] mb-0.5">Final</span>
                          <span className="text-[1.125rem] font-bold text-[#1A1D23]">
                            Rp {(order.price_idr_final * order.qty).toLocaleString('id-ID')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-[#8B5E0A] mb-0.5">Est</span>
                          <span className="text-[1.125rem] font-bold text-[#1A8F89]">
                            Rp {(order.price_idr_estimate * order.qty).toLocaleString('id-ID')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}