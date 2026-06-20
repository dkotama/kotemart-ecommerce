import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#F9F9F7] flex flex-col justify-center items-center p-4 text-[#1A1D23]">
      {/* Injecting DM Sans font to perfectly match the DESIGN.md typography */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
      `}} />

      {/* Branding Header */}
      <div className="mb-10 text-center">
        <h1 className="text-[2.5rem] font-bold leading-[1.15] tracking-[-0.03em] text-[#1A1D23]">
          Kotemart
        </h1>
        <p className="text-[0.6875rem] font-semibold leading-[1.3] tracking-[0.1em] uppercase text-[#1A8F89] mt-2">
          Jastip Catalog
        </p>
      </div>

      {/* Login Card */}
      <div 
        className="w-full max-w-[400px] bg-[#FFFFFF] rounded-[10px] p-8"
        style={{ boxShadow: '0 1px 3px rgba(26, 29, 35, 0.06), 0 1px 2px rgba(26, 29, 35, 0.04)' }}
      >
        <div className="text-center mb-8">
          <h2 className="text-[1.75rem] font-semibold leading-[1.25] tracking-[-0.02em] text-[#1A1D23] mb-3">
            Masuk
          </h2>
          <p className="text-[0.9375rem] leading-[1.55] text-[#5B606D]">
            Login aman menggunakan akun Google. Tidak perlu mendaftar manual.
          </p>
        </div>

        {/* Primary Action Button (button-primary style from DESIGN.md) */}
        <button 
          onClick={() => console.log('Initiate Google OAuth2 Flow')}
          className="w-full h-[44px] flex items-center justify-center gap-3 bg-[#0F726E] hover:bg-[#0A5D59] text-[#FFFFFF] rounded-[6px] px-[12px] transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A8F89] focus:ring-offset-2 focus:ring-offset-[#FFFFFF]"
        >
          {/* Pure White Google SVG to maintain the technical aesthetic */}
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="currentColor"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
          </svg>
          <span className="text-[0.6875rem] font-semibold leading-[1.3] tracking-[0.1em] uppercase">
            Login dengan Google
          </span>
        </button>

        {/* Divider & Privacy Context */}
        <div className="mt-8 flex items-center justify-center">
          <div className="h-[1px] w-full bg-[#E8E9ED]"></div>
          <span className="px-3 text-[#5B606D] text-[0.6875rem] font-semibold tracking-[0.1em] uppercase bg-[#FFFFFF]">
            Private
          </span>
          <div className="h-[1px] w-full bg-[#E8E9ED]"></div>
        </div>
        
        <p className="mt-5 text-[0.8125rem] leading-[1.5] text-[#5B606D] text-center">
          Katalog jastip ini bersifat tertutup. Hanya pembeli yang telah dikonfirmasi oleh admin yang dapat melakukan pemesanan.
        </p>
      </div>
    </div>
  );
}