'use client';

import dynamic from 'next/dynamic';

const XmlReader = dynamic(() => import('@/components/XmlReader'), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-gray-500">Đang tải công cụ...</div>
});
import Link from 'next/link';

export default function XMLCheckerPage() {
  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-cyan-50/50 to-transparent -z-10"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-200/20 blur-[120px] rounded-full -z-10 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-200/20 blur-[100px] rounded-full -z-10"></div>

      <div className="w-full py-8">
        <div className="text-center mb-6 space-y-4 px-[30px]">

          <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-tight italic py-2">
            Công cụ <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600 pr-2">Kiểm tra lỗi</span>
          </h1>
          <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto italic">
            Tải lên hồ sơ XML và hệ thống sẽ tự động phát hiện các lỗi logic, quy tắc bảo hiểm.
          </p>
        </div>

        <XmlReader />
      </div>

      <footer className="py-12 text-center">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
          &copy; 2026 XML Reader System • Powered by PCNTT-BVĐKLS
        </p>
      </footer>
    </main>
  );
}
