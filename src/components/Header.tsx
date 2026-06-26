'use client';
import { useState } from 'react';
import { Search, Lock, Unlock, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SearchModal from './SearchModal';
import Link from 'next/link';

export default function Header() {
  const { isAdmin, setShowLogin, logout } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <header className="bg-linear-to-r from-cyan-600 to-blue-800 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
        <Link href="/#today" className="flex items-center space-x-2.5 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-sm shrink-0">
            <Activity size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight leading-tight">V-Manager</h1>
        </Link>
        
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => setIsSearchOpen(true)} 
            className="p-2 hover:bg-white/20 rounded-full transition-colors" 
            aria-label="検索"
          >
            <Search size={22} />
          </button>
          <button 
            onClick={() => isAdmin ? logout() : setShowLogin(true)} 
            className="p-2 hover:bg-white/20 rounded-full transition-colors" 
            aria-label={isAdmin ? "ログアウト" : "管理者ログイン"}
          >
            {isAdmin ? <Unlock size={20} className="text-orange-300" /> : <Lock size={20} />}
          </button>
        </div>
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}