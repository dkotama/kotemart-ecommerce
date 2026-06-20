import React, { useState, useEffect, useRef } from 'react';

// --- Mock Data ---
const MOCK_PRODUCT = {
  id: "p1",
  name: "Keychron K3 Pro Low Profile Wireless Mechanical Keyboard",
  category: "Elektronik",
  price_jpy: 17600,
  price_idr: 1850000,
  description: "Keychron K3 Pro adalah keyboard mekanis nirkabel low-profile dengan QMK/VIA custom keys. Desain ultra-slim 75% layout, sangat cocok untuk produktivitas dan gaming ringan. \n\nFitur Utama:\n- Koneksi Bluetooth 5.1 & Kabel Type-C\n- Hot-swappable (opsional)\n- Baterai tahan lama\n- Dukungan Mac & Windows\n\nBarang dijamin 100% original dari Keychron Japan.",
  images: [
    "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1601445638532-3c6f6c3aa831?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1618384841597-1990c1d4bde1?auto=format&fit=crop&q=80&w=1000"
  ]
};

export default function App() {
  const [isGateOpen, setIsGateOpen] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQtyChange = (delta) => {
    const newQty = qty + delta;
    if (newQty >= 1 && newQty <= 10) {
      setQty(newQty);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9F7] text-[#1A1D23] font-sans pb-24">
      {}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
      `}} />

      {}
      <nav className="bg-[#FFFFFF] border-b border-[#E8E9ED] px-4 md:px-6 py-4 sticky top-0 z-20">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col cursor-pointer" onClick={() => console.log('Go to catalog')}>
              <span className="text-[1.25rem] font-bold tracking-[-0.01em] leading-tight text-[#1A1D23]">Kotemart</span>
            </div>
            
            <div className="hidden md:flex items-center gap-1 ml-4 bg-[#F1F2F5] p-1 rounded-[6px]">
              <button 
                onClick={() => setIsGateOpen(true)}
                className={`px-3 py-1.5 rounded-[4px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-colors ${isGateOpen ? 'bg-[#FFFFFF] text-[#1A1D23] shadow-sm' : 'text-[#5B606D] hover:text-[#1A1D23]'}`}
              >
                Gate Open
              </button>
              <button 
                onClick={() => setIsGateOpen(false)}
                className={`px-3 py-1.5 rounded-[4px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-colors ${!isGateOpen ? 'bg-[#FFFFFF] text-[#1A1D23] shadow-sm' : 'text-[#5B606D] hover:text-[#1A1D23]'}`}
              >
                Gate Closed
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#5B606D] hover:text-[#1A8F89] transition-colors hidden sm:block">
              Pesanan Saya
            </button>
            
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

      {}
      {!isGateOpen && (
        <div className="w-full bg-[#FDF3E7] border-l-[4px] border-l-[#D1453B] py-[12px] px-4 md:px-6 shadow-sm">
          <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#D1453B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-[0.9375rem] font-semibold text-[#8B5E0A] leading-tight">Jastip sedang tutup</p>
                <p className="text-[0.8125rem] text-[#8B5E0A] opacity-80 mt-0.5">Kami tidak menerima pesanan baru saat ini. Anda tidak dapat menambahkan pesanan.</p>
              </div>
            </div>
            <button className="whitespace-nowrap shrink-0 h-[44px] px-[12px] bg-[#FFFFFF] border border-[#E8E9ED] hover:bg-[#F1F2F5] text-[#1A1D23] rounded-[6px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all focus:ring-2 focus:ring-[#1A8F89] focus:ring-offset-2 focus:ring-offset-[#FDF3E7]">
              Hubungi Admin
            </button>
          </div>
        </div>
      )}

      {}
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 pt-[24px] md:pt-[40px]">
        
        {/* Back Link */}
        <button 
          onClick={() => console.log('Go back to catalog')}
          className="flex items-center gap-2 text-[#5B606D] hover:text-[#1A8F89] transition-colors mb-[24px] group w-fit focus:outline-none focus:ring-2 focus:ring-[#1A8F89] rounded-[4px]"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-[0.8125rem] font-semibold leading-[1.3] uppercase tracking-[0.1em]">Kembali ke Katalog</span>
        </button>

        {}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[40px] lg:gap-[64px]">
          
          {/* Left Column: Image Gallery */}
          <div className="flex flex-col gap-[16px]">
            {/* Main Image */}
            <div className="w-full aspect-[4/3] sm:aspect-square bg-[#F1F2F5] rounded-[4px] border border-[#E8E9ED] overflow-hidden shadow-[0_1px_3px_rgba(26,29,35,0.06),0_1px_2px_rgba(26,29,35,0.04)]">
              <img 
                src={MOCK_PRODUCT.images[activeImageIndex]} 
                alt={`${MOCK_PRODUCT.name} view ${activeImageIndex + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Thumbnail Strip */}
            <div className="grid grid-cols-4 gap-[12px] sm:gap-[16px]">
              {MOCK_PRODUCT.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative aspect-square bg-[#F1F2F5] rounded-[4px] overflow-hidden border transition-all focus:outline-none ${
                    activeImageIndex === idx 
                      ? 'border-[#1A8F89] ring-2 ring-[#1A8F89] ring-offset-2' 
                      : 'border-[#E8E9ED] hover:border-[#5B606D]'
                  }`}
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Product Info & Actions */}
          <div className="flex flex-col">
            {}
            <div className="mb-[24px]">
              <span className="inline-block bg-[#F1F2F5] text-[#5B606D] rounded-full px-[8px] py-[4px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] mb-[12px]">
                {MOCK_PRODUCT.category}
              </span>
              <h1 className="text-[1.75rem] font-semibold leading-[1.25] tracking-[-0.02em] text-[#1A1D23]">
                {MOCK_PRODUCT.name}
              </h1>
            </div>

            {}
            <div className="mb-[32px] p-[20px] bg-[#FFFFFF] rounded-[10px] border border-[#E8E9ED] shadow-[0_1px_3px_rgba(26,29,35,0.06),0_1px_2px_rgba(26,29,35,0.04)]">
              <div className="flex flex-col gap-1 mb-[12px]">
                {/* JPY Price */}
                <span className="font-mono text-[0.8125rem] leading-[1.6] text-[#5B606D]">
                  Harga Jepang: ¥ {MOCK_PRODUCT.price_jpy.toLocaleString('ja-JP')}
                </span>
                
                {/* IDR Estimate (price-lg) */}
                <div className="flex items-end gap-2">
                  <span className="text-[1.5rem] font-bold leading-[1.2] tracking-[-0.02em] text-[#1A8F89]">
                    Est. Rp {MOCK_PRODUCT.price_idr.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 pt-[12px] border-t border-[#E8E9ED]">
                <svg className="w-4 h-4 text-[#D4890B] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[0.8125rem] leading-[1.5] text-[#5B606D]">
                  Harga ini adalah estimasi. Harga final akan dikonfirmasi admin setelah barang berhasil dibeli di batch ini.
                </p>
              </div>
            </div>

            {}
            <div className="mb-[40px]">
              <h3 className="text-[0.9375rem] font-semibold leading-[1.55] text-[#1A1D23] mb-[12px]">
                Kuantitas Pesanan
              </h3>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[16px]">
                {/* Custom Number Input */}
                <div className="flex items-center h-[44px] bg-[#FFFFFF] border border-[#E8E9ED] rounded-[6px] overflow-hidden shrink-0">
                  <button 
                    onClick={() => handleQtyChange(-1)}
                    disabled={qty <= 1 || !isGateOpen}
                    className="w-[44px] h-full flex items-center justify-center text-[#5B606D] hover:bg-[#F1F2F5] hover:text-[#1A1D23] disabled:opacity-50 disabled:hover:bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#1A8F89]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                  </button>
                  
                  <div className="w-[48px] h-full flex items-center justify-center font-mono text-[0.9375rem] font-semibold text-[#1A1D23] border-l border-r border-[#E8E9ED]">
                    {qty}
                  </div>
                  
                  <button 
                    onClick={() => handleQtyChange(1)}
                    disabled={qty >= 10 || !isGateOpen}
                    className="w-[44px] h-full flex items-center justify-center text-[#5B606D] hover:bg-[#F1F2F5] hover:text-[#1A1D23] disabled:opacity-50 disabled:hover:bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#1A8F89]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>

                {/* Primary Action Button */}
                <button 
                  disabled={!isGateOpen}
                  className="flex-grow h-[44px] px-[24px] bg-[#0F726E] hover:bg-[#0A5D59] text-[#FFFFFF] rounded-[6px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all focus:ring-2 focus:ring-[#1A8F89] focus:ring-offset-2 disabled:bg-[#F1F2F5] disabled:text-[#5B606D] disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  {isGateOpen ? 'Tambah ke Pesanan' : 'Jastip Ditutup'}
                </button>
              </div>
              
              {!isGateOpen && (
                <p className="text-[0.8125rem] text-[#D1453B] mt-[12px]">
                  Pembukaan batch jastip sedang ditutup. Anda tidak dapat melakukan pemesanan saat ini.
                </p>
              )}
            </div>

            {}
            <div className="border-t border-[#E8E9ED] pt-[32px]">
              <h3 className="text-[1.25rem] font-semibold leading-[1.3] tracking-[-0.01em] text-[#1A1D23] mb-[16px]">
                Deskripsi Produk
              </h3>
              <div className="text-[0.9375rem] leading-[1.6] text-[#5B606D] whitespace-pre-wrap">
                {MOCK_PRODUCT.description}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}