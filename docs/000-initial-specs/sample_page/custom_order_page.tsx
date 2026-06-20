import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [isGateOpen, setIsGateOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const userMenuRef = useRef(null);

  const [formData, setFormData] = useState({
    url: '',
    name: '',
    qty: 1,
    notes: ''
  });

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

  const handleQtyChange = (delta) => {
    const newQty = formData.qty + delta;
    if (newQty >= 1 && newQty <= 20) {
      setFormData({ ...formData, qty: newQty });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isGateOpen) return;
    
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
      setFormData({ url: '', name: '', qty: 1, notes: '' });
      
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000);
    }, 800);
  };

  const marketplaceLogos = (
    <>
      <svg className="h-[20px] w-[100px] shrink-0" viewBox="0 0 100 30" fill="currentColor">
        <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="24" letterSpacing="-1">amazon</text>
        <path d="M0,26 Q50,34 100,26 Q50,30 0,26" />
      </svg>
      <svg className="h-[20px] w-[100px] shrink-0" viewBox="0 0 100 30" fill="currentColor">
        <text x="0" y="24" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="26" letterSpacing="-2">Y!</text>
        <text x="26" y="22" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="16">JAPAN</text>
      </svg>
      <svg className="h-[18px] w-[90px] shrink-0" viewBox="0 0 100 30" fill="currentColor">
        <text x="0" y="24" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="24" letterSpacing="-1">Rakuten</text>
      </svg>
      <svg className="h-[20px] w-[90px] shrink-0" viewBox="0 0 100 30" fill="currentColor">
        <text x="0" y="24" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="24" letterSpacing="-1">mercari</text>
      </svg>
      <svg className="h-[16px] w-[120px] shrink-0" viewBox="0 0 120 30" fill="currentColor">
        <text x="0" y="24" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="22" letterSpacing="1">ZOZOTOWN</text>
      </svg>
      <svg className="h-[18px] w-[80px] shrink-0" viewBox="0 0 80 30" fill="currentColor">
        <text x="0" y="24" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="20" letterSpacing="0">UNIQLO</text>
      </svg>
      <svg className="h-[18px] w-[60px] shrink-0" viewBox="0 0 80 30" fill="currentColor">
        <text x="0" y="24" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="20">駿河屋</text>
      </svg>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F9F9F7] text-[#1A1D23] font-sans pb-24">
      {/* Font Injections */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }

        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        .animate-scroll {
          animation: scroll 35s linear infinite;
        }
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
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
                <p className="text-[0.8125rem] text-[#8B5E0A] opacity-80 mt-0.5">Kami tidak menerima pesanan baru saat ini. Form Custom Order dinonaktifkan.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {/* Marquee Header for Supported Marketplaces */}
      <div className="w-full overflow-hidden bg-[#FFFFFF] border-b border-[#E8E9ED] py-[16px] flex group relative">
        <div className="absolute left-0 top-0 bottom-0 w-[40px] bg-gradient-to-r from-[#FFFFFF] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-[40px] bg-gradient-to-l from-[#FFFFFF] to-transparent z-10 pointer-events-none"></div>
        <div className="flex whitespace-nowrap animate-scroll group-hover:[animation-play-state:paused]">
          <div className="flex items-center gap-[64px] px-[32px] text-[#5B606D] opacity-60 transition-opacity duration-300 group-hover:opacity-100">
            {marketplaceLogos}
          </div>
        </div>
        <div className="flex whitespace-nowrap animate-scroll group-hover:[animation-play-state:paused]">
          <div className="flex items-center gap-[64px] px-[32px] text-[#5B606D] opacity-60 transition-opacity duration-300 group-hover:opacity-100">
            {marketplaceLogos}
          </div>
        </div>
      </div>

      {}
      <main className="max-w-[1000px] mx-auto px-4 md:px-6 pt-[24px] md:pt-[40px]">
        
        <button 
          onClick={() => console.log('Go back')}
          className="flex items-center gap-2 text-[#5B606D] hover:text-[#1A8F89] transition-colors mb-[24px] group w-fit focus:outline-none focus:ring-2 focus:ring-[#1A8F89] rounded-[4px]"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-[0.8125rem] font-semibold leading-[1.3] uppercase tracking-[0.1em]">Kembali ke Katalog</span>
        </button>

        <div className="mb-[32px] md:mb-[40px]">
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-block bg-[#E8E9ED] text-[#1A1D23] rounded-full px-[8px] py-[4px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em]">
              Custom Order
            </span>
          </div>
          <h1 className="text-[2.5rem] font-bold leading-[1.15] tracking-[-0.03em] text-[#1A1D23]">
            Request Barang
          </h1>
          <p className="text-[1.125rem] leading-[1.6] text-[#5B606D] mt-2 max-w-2xl">
            Tidak menemukan barang yang dicari di katalog? Masukkan detail barang atau link toko online Jepang di sini.
          </p>
        </div>

        {}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[32px] items-start">
          
          {/* Left: Form Area (Takes up 2 columns on desktop) */}
          <div className="lg:col-span-2">
            
            {showSuccess && (
              <div className="mb-[24px] bg-[#D9EDE2] border border-[#2E8B57] rounded-[6px] p-[16px] flex items-start gap-3">
                <svg className="w-5 h-5 text-[#1E6B3F] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <h4 className="text-[0.9375rem] font-semibold text-[#1E6B3F]">Request Berhasil Dikirim</h4>
                  <p className="text-[0.8125rem] text-[#1E6B3F] mt-1 opacity-90">Pesanan custom Anda telah masuk sebagai Draft. Silakan cek halaman "Pesanan Saya" untuk melihat update estimasi harga dari admin.</p>
                </div>
              </div>
            )}

            <form 
              onSubmit={handleSubmit}
              className={`bg-[#FFFFFF] border border-[#E8E9ED] rounded-[10px] p-[24px] shadow-[0_1px_3px_rgba(26,29,35,0.06),0_1px_2px_rgba(26,29,35,0.04)] ${!isGateOpen ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <div className="flex flex-col gap-[20px]">
                
                {/* Product URL */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="url" className="text-[0.9375rem] font-semibold text-[#1A1D23]">
                    Link Produk (Opsional tapi disarankan)
                  </label>
                  <input 
                    type="url" 
                    id="url"
                    disabled={!isGateOpen}
                    value={formData.url}
                    onChange={(e) => setFormData({...formData, url: e.target.value})}
                    placeholder="https://www.amazon.co.jp/..." 
                    className="w-full h-[44px] px-[12px] bg-[#FFFFFF] border border-[#E8E9ED] rounded-[6px] text-[0.9375rem] text-[#1A1D23] placeholder-[#5B606D] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] focus:border-[#1A8F89] transition-shadow disabled:bg-[#F1F2F5] disabled:text-[#5B606D]"
                  />
                  <p className="text-[0.75rem] text-[#5B606D]">Masukkan link dari Amazon JP, Yahoo Auction, Rakuten, dll.</p>
                </div>

                {/* Product Name/Desc */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="name" className="text-[0.9375rem] font-semibold text-[#1A1D23]">
                    Nama / Detail Barang <span className="text-[#D1453B]">*</span>
                  </label>
                  <textarea 
                    id="name"
                    required
                    disabled={!isGateOpen}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Contoh: UNIQLO U AIRism Oversized T-Shirt, Warna Hitam, Size L" 
                    className="w-full min-h-[100px] p-[12px] bg-[#FFFFFF] border border-[#E8E9ED] rounded-[6px] text-[0.9375rem] text-[#1A1D23] placeholder-[#5B606D] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] focus:border-[#1A8F89] transition-shadow resize-y disabled:bg-[#F1F2F5] disabled:text-[#5B606D]"
                  />
                </div>

                {/* Grid for Qty & Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[20px] items-end">
                  
                  {/* Quantity */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[0.9375rem] font-semibold text-[#1A1D23]">
                      Kuantitas
                    </label>
                    <div className="flex items-center h-[44px] bg-[#FFFFFF] border border-[#E8E9ED] rounded-[6px] overflow-hidden w-[140px]">
                      <button 
                        type="button"
                        onClick={() => handleQtyChange(-1)}
                        disabled={formData.qty <= 1 || !isGateOpen}
                        className="w-[44px] h-full flex items-center justify-center text-[#5B606D] hover:bg-[#F1F2F5] hover:text-[#1A1D23] disabled:opacity-50 disabled:hover:bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#1A8F89]"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                      </button>
                      <div className="flex-1 h-full flex items-center justify-center font-mono text-[0.9375rem] font-semibold text-[#1A1D23] border-l border-r border-[#E8E9ED]">
                        {formData.qty}
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleQtyChange(1)}
                        disabled={formData.qty >= 20 || !isGateOpen}
                        className="w-[44px] h-full flex items-center justify-center text-[#5B606D] hover:bg-[#F1F2F5] hover:text-[#1A1D23] disabled:opacity-50 disabled:hover:bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#1A8F89]"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Notes */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="notes" className="text-[0.9375rem] font-semibold text-[#1A1D23]">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input 
                    type="text" 
                    id="notes"
                    disabled={!isGateOpen}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Misal: Boleh second kalau yang baru kosong" 
                    className="w-full h-[44px] px-[12px] bg-[#FFFFFF] border border-[#E8E9ED] rounded-[6px] text-[0.9375rem] text-[#1A1D23] placeholder-[#5B606D] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] focus:border-[#1A8F89] transition-shadow disabled:bg-[#F1F2F5] disabled:text-[#5B606D]"
                  />
                </div>

                {/* Submit Action */}
                <div className="pt-[16px] border-t border-[#E8E9ED] mt-[8px]">
                  <button 
                    type="submit"
                    disabled={!isGateOpen || isSubmitting}
                    className="w-full sm:w-auto min-w-[200px] h-[44px] px-[24px] bg-[#0F726E] hover:bg-[#0A5D59] text-[#FFFFFF] rounded-[6px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all focus:ring-2 focus:ring-[#1A8F89] focus:ring-offset-2 disabled:bg-[#F1F2F5] disabled:text-[#5B606D] disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    )}
                    {isGateOpen ? (isSubmitting ? 'Mengirim...' : 'Kirim Request') : 'Jastip Ditutup'}
                  </button>
                </div>

              </div>
            </form>
          </div>

          {/* Right: Info Area (Takes up 1 column on desktop) */}
          <div className="lg:col-span-1">
            <div className="bg-[#F1F2F5] border border-[#E8E9ED] rounded-[10px] p-[24px] sticky top-[100px]">
              <h3 className="text-[1.125rem] font-semibold leading-[1.3] tracking-[-0.01em] text-[#1A1D23] mb-[16px]">
                Cara Kerja Custom Order
              </h3>
              
              <div className="flex flex-col gap-[16px]">
                <div className="flex items-start gap-3">
                  <div className="w-[24px] h-[24px] shrink-0 rounded-full bg-[#1A1D23] text-[#FFFFFF] flex items-center justify-center font-mono text-[0.75rem] font-bold mt-0.5">1</div>
                  <div>
                    <h4 className="text-[0.9375rem] font-semibold text-[#1A1D23]">Isi Form Request</h4>
                    <p className="text-[0.8125rem] text-[#5B606D] mt-1">Berikan detail atau link produk selengkap mungkin agar admin mudah mencarinya.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-[24px] h-[24px] shrink-0 rounded-full bg-[#E8E9ED] text-[#1A1D23] flex items-center justify-center font-mono text-[0.75rem] font-bold mt-0.5">2</div>
                  <div>
                    <h4 className="text-[0.9375rem] font-semibold text-[#1A1D23]">Admin Mengecek Harga</h4>
                    <p className="text-[0.8125rem] text-[#5B606D] mt-1">Request Anda akan berstatus Draft. Admin akan mengecek ketersediaan dan memasukkan estimasi harga.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-[24px] h-[24px] shrink-0 rounded-full bg-[#E8E9ED] text-[#1A1D23] flex items-center justify-center font-mono text-[0.75rem] font-bold mt-0.5">3</div>
                  <div>
                    <h4 className="text-[0.9375rem] font-semibold text-[#1A1D23]">Muncul di Pesanan Saya</h4>
                    <p className="text-[0.8125rem] text-[#5B606D] mt-1">Estimasi IDR akan muncul di halaman Pesanan Saya. Setelah dibeli, harga final akan dikonfirmasi.</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-[24px] pt-[20px] border-t border-[#E8E9ED]">
                <p className="text-[0.8125rem] text-[#5B606D] flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#D4890B] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Admin berhak menolak pesanan custom yang tidak memungkinkan untuk dibawa (ukuran terlalu besar, barang terlarang, dsb).
                </p>
              </div>

            </div>
          </div>

        </div>

      </main>
    </div>
  );
}