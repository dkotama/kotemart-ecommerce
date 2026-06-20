import React, { useState, useMemo, useEffect, useRef } from 'react';

// --- Mock Data ---
const CATEGORIES = ["Semua", "Elektronik", "Figure", "Snack", "Pakaian"];
const MOCK_PRODUCTS = [
  {
    id: "p1",
    name: "Keychron K3 Pro Low Profile",
    category: "Elektronik",
    price_jpy: 17600,
    price_idr: 1850000,
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "p2",
    name: "Gundam Aerial Rebuild HG 1/144",
    category: "Figure",
    price_jpy: 1870,
    price_idr: 225000,
    image: "https://images.unsplash.com/photo-1612404730960-5c71577fca11?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "p3",
    name: "Tokyo Banana Original (8pcs)",
    category: "Snack",
    price_jpy: 1166,
    price_idr: 145000,
    image: "https://images.unsplash.com/photo-1588632668582-ea3017a42bbd?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "p4",
    name: "Sony WH-1000XM5 Headphones",
    category: "Elektronik",
    price_jpy: 49800,
    price_idr: 5200000,
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "p5",
    name: "Uniqlo U AIRism Cotton Oversized T-Shirt",
    category: "Pakaian",
    price_jpy: 1990,
    price_idr: 245000,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "p6",
    name: "Nintendo Switch Pro Controller",
    category: "Elektronik",
    price_jpy: 7678,
    price_idr: 880000,
    image: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?auto=format&fit=crop&q=80&w=800"
  }
];

export default function App() {
  const [isGateOpen, setIsGateOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

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

  const filteredProducts = useMemo(() => {
    let result = activeCategory === "Semua" 
      ? MOCK_PRODUCTS 
      : MOCK_PRODUCTS.filter(p => p.category === activeCategory);

    // Search text filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(query));
    }

    // Sort processing
    let sortedResult = [...result];
    switch (sortBy) {
      case 'price_asc':
        sortedResult.sort((a, b) => a.price_idr - b.price_idr);
        break;
      case 'price_desc':
        sortedResult.sort((a, b) => b.price_idr - a.price_idr);
        break;
      case 'name_asc':
        sortedResult.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break; // Default to newest / original array order
    }

    return sortedResult;
  }, [activeCategory, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#F9F9F7] text-[#1A1D23] font-sans pb-20">
      {/* Font Injections: DM Sans for UI, JetBrains Mono for Pricing */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
      `}} />

      {/* --- Navigation Bar --- */}
      <nav className="bg-[#FFFFFF] border-b border-[#E8E9ED] px-4 md:px-6 py-4 sticky top-0 z-20">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[1.25rem] font-bold tracking-[-0.01em] leading-tight text-[#1A1D23]">Kotemart</span>
            </div>
            
            <div className="hidden md:flex items-center gap-1 ml-4 bg-[#F1F2F5] p-1 rounded-[6px]">
              {/* DEV TOGGLE: Switch Gate State */}
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

      {/* --- Gate Closed Banner --- */}
      {!isGateOpen && (
        <div className="w-full bg-[#FDF3E7] border-l-[4px] border-l-[#D1453B] py-[12px] px-4 md:px-6 shadow-sm">
          <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#D1453B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-[0.9375rem] font-semibold text-[#8B5E0A] leading-tight">Jastip sedang tutup</p>
                <p className="text-[0.8125rem] text-[#8B5E0A] opacity-80 mt-0.5">Kami tidak menerima pesanan baru saat ini. Silakan hubungi admin untuk info batch selanjutnya.</p>
              </div>
            </div>
            
            <button className="whitespace-nowrap shrink-0 h-[44px] px-[12px] bg-[#FFFFFF] border border-[#E8E9ED] hover:bg-[#F1F2F5] text-[#1A1D23] rounded-[6px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all focus:ring-2 focus:ring-[#1A8F89] focus:ring-offset-2 focus:ring-offset-[#FDF3E7]">
              Hubungi Admin via Telegram
            </button>
          </div>
        </div>
      )}

      {/* --- Main Content Area --- */}
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 pt-[40px]">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-[40px]">
          <div>
            <h1 className="text-[2.5rem] font-bold leading-[1.15] tracking-[-0.03em] text-[#1A1D23]">
              Katalog Produk
            </h1>
            <p className="text-[1.125rem] leading-[1.6] text-[#5B606D] mt-2 max-w-2xl">
              Daftar produk estimasi untuk batch saat ini. Request produk lain di luar katalog menggunakan fitur Custom Order.
            </p>
          </div>

          {isGateOpen && (
             <button className="shrink-0 h-[44px] px-[16px] bg-[#FFFFFF] border border-[#E8E9ED] hover:bg-[#F1F2F5] text-[#1A1D23] rounded-[6px] text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all focus:ring-2 focus:ring-[#1A8F89] flex items-center gap-2">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
               </svg>
               Custom Order
             </button>
          )}
        </div>

        {/* --- Tools & Categories Bar --- */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6 justify-between items-start lg:items-center">
          
          {/* Categories Filter */}
          <div className="flex overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 gap-2 no-scrollbar shrink-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-[12px] py-[6px] rounded-full text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-colors ${
                  activeCategory === cat 
                    ? 'bg-[#1A1D23] text-[#FFFFFF]' 
                    : 'bg-[#E8E9ED] text-[#5B606D] hover:bg-[#D5EDEB] hover:text-[#0F726E]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search, Sort, View Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-grow sm:w-64">
              <svg className="w-4 h-4 text-[#5B606D] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                placeholder="Cari produk..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[36px] pl-9 pr-3 bg-[#FFFFFF] border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] text-[#1A1D23] placeholder-[#5B606D] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] focus:border-[#1A8F89] transition-shadow"
              />
            </div>

            <div className="flex items-center gap-3 justify-between sm:justify-start">
              {/* Sort Dropdown */}
              <div className="relative shrink-0">
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-[36px] appearance-none pl-3 pr-8 bg-[#FFFFFF] border border-[#E8E9ED] rounded-[6px] text-[0.8125rem] font-semibold text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1A8F89] focus:border-[#1A8F89] transition-shadow cursor-pointer"
                >
                  <option value="default">Terbaru</option>
                  <option value="price_asc">Harga: Rendah ke Tinggi</option>
                  <option value="price_desc">Harga: Tinggi ke Rendah</option>
                  <option value="name_asc">Nama: A - Z</option>
                </select>
                <svg className="w-4 h-4 text-[#5B606D] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-[#E8E9ED] rounded-[6px] p-0.5 shrink-0">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`w-8 h-8 flex items-center justify-center rounded-[4px] transition-all ${viewMode === 'grid' ? 'bg-[#FFFFFF] text-[#1A1D23] shadow-sm' : 'text-[#5B606D] hover:text-[#1A1D23]'}`}
                  aria-label="Grid View"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z"/></svg>
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`w-8 h-8 flex items-center justify-center rounded-[4px] transition-all ${viewMode === 'list' ? 'bg-[#FFFFFF] text-[#1A1D23] shadow-sm' : 'text-[#5B606D] hover:text-[#1A1D23]'}`}
                  aria-label="List View"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- Product Catalog Container --- */}
        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[24px]" : "flex flex-col gap-[12px]"}>
          {filteredProducts.map((product) => (
            <div 
              key={product.id} 
              className={`bg-[#FFFFFF] rounded-[10px] overflow-hidden group transition-shadow duration-150 ease-out cursor-pointer hover:shadow-[0_4px_12px_rgba(26,29,35,0.08),0_2px_4px_rgba(26,29,35,0.04)] shadow-[0_1px_3px_rgba(26,29,35,0.06),0_1px_2px_rgba(26,29,35,0.04)] focus-within:ring-2 focus-within:ring-[#1A8F89] focus-within:ring-offset-2 ${viewMode === 'list' ? 'flex flex-row items-stretch h-[96px] sm:h-[116px]' : 'flex flex-col'}`}
              tabIndex={0}
            >
              {/* Image Area */}
              <div className={`relative bg-[#F1F2F5] p-0 overflow-hidden shrink-0 ${viewMode === 'list' ? 'w-[96px] sm:w-[140px] border-r border-[#E8E9ED]' : 'w-full aspect-[4/3] border-b border-[#E8E9ED]'}`}>
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className={`w-full h-full object-cover ${viewMode === 'list' ? 'absolute inset-0' : 'rounded-t-[4px]'}`}
                  loading="lazy"
                />
                {/* Status/Category Badge Overlay */}
                <div className={`absolute top-[8px] left-[8px] bg-[#F1F2F5] text-[#5B606D] rounded-full text-[0.6875rem] font-semibold uppercase tracking-[0.1em] shadow-sm ${viewMode === 'list' ? 'hidden sm:block px-[8px] py-[4px]' : 'px-[8px] py-[4px]'}`}>
                  {product.category}
                </div>
              </div>

              {/* Content Area */}
              <div className={`flex flex-col flex-grow justify-center overflow-hidden ${viewMode === 'list' ? 'px-[12px] sm:px-[16px] py-[8px]' : 'p-[16px]'}`}>
                <h3 className={`font-semibold leading-[1.3] tracking-[-0.01em] text-[#1A1D23] ${viewMode === 'list' ? 'text-[0.9375rem] sm:text-[1.125rem] mb-[4px] line-clamp-1' : 'text-[1.25rem] mb-[8px] line-clamp-2'}`}>
                  {product.name}
                </h3>
                
                <div className={`flex ${viewMode === 'list' ? 'flex-col sm:flex-row sm:items-center gap-0 sm:gap-3' : 'flex-col gap-1 mt-[16px]'}`}>
                  {/* JPY Price in JetBrains Mono */}
                  <span className={`font-mono leading-[1.6] text-[#5B606D] ${viewMode === 'list' ? 'text-[0.75rem] sm:text-[0.8125rem]' : 'text-[0.8125rem]'}`}>
                    ¥ {product.price_jpy.toLocaleString('ja-JP')}
                  </span>
                  
                  {/* IDR Estimate in price-sm with Teal Tint */}
                  <div className="flex items-baseline gap-2">
                    <span className={`font-bold leading-[1.3] tracking-[-0.01em] text-[#1A8F89] ${viewMode === 'list' ? 'text-[0.875rem] sm:text-[0.9375rem]' : 'text-[0.9375rem]'}`}>
                      Est. Rp {product.price_idr.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Disclaimer Text */}
                <p className={`leading-[1.5] text-[#5B606D] ${viewMode === 'list' ? 'hidden sm:block text-[0.75rem] mt-[6px] pt-[6px] border-t border-[#E8E9ED] line-clamp-1' : 'text-[0.8125rem] mt-[12px] pt-[12px] border-t border-[#E8E9ED]'}`}>
                  Harga estimasi. Final konfirmasi setelah beli.
                </p>
              </div>
              
              {/* List View Extra Action Area */}
              {viewMode === 'list' && isGateOpen && (
                <div className="px-[12px] sm:px-[16px] flex items-center justify-center border-l border-[#E8E9ED] bg-[#F9F9F7] sm:bg-transparent shrink-0 w-[80px] sm:w-[120px]">
                  <button className="w-full h-[32px] sm:h-[36px] px-[8px] bg-[#0F726E] hover:bg-[#0A5D59] text-[#FFFFFF] rounded-[6px] text-[0.625rem] sm:text-[0.6875rem] font-semibold uppercase tracking-[0.1em] transition-all focus:ring-2 focus:ring-[#1A8F89] focus:ring-offset-2">
                    Pesan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-[64px] text-center border border-[#E8E9ED] border-dashed rounded-[10px] bg-[#FFFFFF] mt-8">
            <p className="text-[1.125rem] text-[#5B606D]">Belum ada produk di kategori ini.</p>
          </div>
        )}

      </main>
    </div>
  );
}