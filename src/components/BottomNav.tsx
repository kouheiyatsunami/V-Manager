'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function BottomNav() {
  const pathname = usePathname();
  
  // 各タブの「最後に開いていたパス」を記憶するステート
  const [lastPaths, setLastPaths] = useState({
    matches: '/',
    results: '/results',
    settings: '/settings'
  });

  // 初回マウント時にSessionStorageから復元
  useEffect(() => {
    setLastPaths({
      matches: sessionStorage.getItem('last_path_matches') || '/',
      results: sessionStorage.getItem('last_path_results') || '/results',
      settings: sessionStorage.getItem('last_path_settings') || '/settings'
    });
  }, []);

  // 画面遷移（パス変更）を検知して記憶をアップデート
  useEffect(() => {
    if (pathname === '/' || pathname.startsWith('/match/') || pathname.startsWith('/team/')) {
      setLastPaths(prev => ({ ...prev, matches: pathname }));
      sessionStorage.setItem('last_path_matches', pathname);
    } else if (pathname.startsWith('/results')) {
      setLastPaths(prev => ({ ...prev, results: pathname }));
      sessionStorage.setItem('last_path_results', pathname);
    } else if (pathname.startsWith('/settings')) {
      setLastPaths(prev => ({ ...prev, settings: pathname }));
      sessionStorage.setItem('last_path_settings', pathname);
    }
  }, [pathname]);

  // 現在どのタブの領域にいるかを判定
  const isActiveMatches = pathname === '/' || pathname.startsWith('/match/') || pathname.startsWith('/team/');
  const isActiveResults = pathname.startsWith('/results');
  const isActiveSettings = pathname.startsWith('/settings');

  return (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center pb-safe z-50">
      
      {/* ★マジックポイント: 
        自分がアクティブではない時 ＝ 最後に記憶した詳細ページへ復帰する (lastPaths)
        自分がすでにアクティブな時 ＝ トップ一覧へ戻る ('/') 
      */}
      <Link href={isActiveMatches ? '/' : lastPaths.matches} className={`flex flex-col items-center py-3 w-full transition-colors ${isActiveMatches ? 'text-cyan-600' : 'text-gray-400 hover:text-gray-600'}`}>
        <Home size={24} />
        <span className="text-[10px] font-bold mt-1">Matches</span>
      </Link>
      
      <Link href={isActiveResults ? '/results' : lastPaths.results} className={`flex flex-col items-center py-3 w-full transition-colors ${isActiveResults ? 'text-cyan-600' : 'text-gray-400 hover:text-gray-600'}`}>
        <Trophy size={24} />
        <span className="text-[10px] font-bold mt-1">Results</span>
      </Link>
      
      <Link href={isActiveSettings ? '/settings' : lastPaths.settings} className={`flex flex-col items-center py-3 w-full transition-colors ${isActiveSettings ? 'text-cyan-600' : 'text-gray-400 hover:text-gray-600'}`}>
        <Settings size={24} />
        <span className="text-[10px] font-bold mt-1">Settings</span>
      </Link>
      
    </div>
  );
}