'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Star, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'group' | 'court'>('court');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [favoriteMatches, setFavoriteMatches] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const getJSTDateString = (dateObj: Date = new Date()) => {
    const jstDate = new Date(dateObj.getTime() + (9 * 60 * 60 * 1000));
    return jstDate.toISOString().split('T')[0];
  };

  useEffect(() => {
    const today = getJSTDateString();
    setCurrentDate(sessionStorage.getItem('matches_date') || today);
    setViewMode((sessionStorage.getItem('matches_viewMode') as 'group' | 'court') || 'court');
    const savedCollapsed = sessionStorage.getItem('matches_collapsed');
    if (savedCollapsed) setCollapsedGroups(JSON.parse(savedCollapsed));
    const savedTeams = localStorage.getItem('favorite_teams');
    if (savedTeams) setFavoriteTeams(JSON.parse(savedTeams));
    const savedMatches = localStorage.getItem('favorite_matches');
    if (savedMatches) setFavoriteMatches(JSON.parse(savedMatches));
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const handleHashChange = () => {
      if (window.location.hash === '#today') {
        setCurrentDate(getJSTDateString());
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    sessionStorage.setItem('matches_date', currentDate);
    sessionStorage.setItem('matches_viewMode', viewMode);
    sessionStorage.setItem('matches_collapsed', JSON.stringify(collapsedGroups));
  }, [currentDate, viewMode, collapsedGroups, isMounted]);

  const getDisplayName = (id: string, name: string, placeholder: string) => {
    if (id) return name;
    if (placeholder && placeholder.startsWith('{')) {
      try { return JSON.parse(placeholder).label; } catch (e) { return '未定'; }
    }
    return placeholder || '未定';
  };

  const fetchMatches = async (date: string) => {
    const { data, error } = await supabase.from('match_details').select('*').eq('match_date', date).order('match_order');
    if (data) {
      const formattedMatches = data.map(m => ({
        ...m,
        team_a_name: getDisplayName(m.team_a_id, m.team_a_name, m.team_a_placeholder),
        team_b_name: getDisplayName(m.team_b_id, m.team_b_name, m.team_b_placeholder),
      }));
      setMatches(formattedMatches);

      let hasUpdate = false;
      for (const m of data) {
        if (m.status === 'finished') continue;
        for (const teamKey of ['a', 'b']) {
          const teamId = m[`team_${teamKey}_id`];
          const ph = m[`team_${teamKey}_placeholder`];
          if (ph && ph.startsWith('{')) {
            try {
              const rule = JSON.parse(ph);
              let targetId = null;
              if (rule.type === 'group') {
                const { data: std } = await supabase.from('group_standings').select('*').eq('group_id', rule.refId);
                if (std && std.length >= parseInt(rule.arg)) targetId = std[parseInt(rule.arg) - 1].team_id;
              } else if (rule.type === 'match') {
                const { data: refM } = await supabase.from('matches').select('*').eq('id', rule.refId).single();
                if (refM && refM.status === 'finished') {
                  const aWin = refM.team_a_sets > refM.team_b_sets;
                  targetId = rule.arg === 'winner' ? (aWin ? refM.team_a_id : refM.team_b_id) : (aWin ? refM.team_b_id : refM.team_a_id);
                }
              }
              if (targetId && targetId !== teamId) {
                const updateObj = teamKey === 'a' ? { team_a_id: targetId } : { team_b_id: targetId };
                await supabase.from('matches').update(updateObj).eq('id', m.id);
                hasUpdate = true;
              }
            } catch (e) {}
          }
        }
      }
      if (hasUpdate) fetchMatches(date);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isMounted || !currentDate) return;
    fetchMatches(currentDate);
    const channel = supabase.channel('matches_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchMatches(currentDate))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentDate, isMounted]);

  const toggleMatchFavorite = (matchId: string) => {
    let favs = [...favoriteMatches];
    if (favs.includes(matchId)) favs = favs.filter(id => id !== matchId);
    else favs.push(matchId);
    setFavoriteMatches(favs);
    localStorage.setItem('favorite_matches', JSON.stringify(favs));
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const changeDate = (days: number) => {
    const [year, month, day] = currentDate.split('-').map(Number);
    const safeDate = new Date(year, month - 1, day + days);
    const newY = safeDate.getFullYear();
    const newM = String(safeDate.getMonth() + 1).padStart(2, '0');
    const newD = String(safeDate.getDate()).padStart(2, '0');
    setCurrentDate(`${newY}-${newM}-${newD}`);
  };

  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const swipeThreshold = window.innerWidth / 2;
    if (touchStartX.current - touchEndX > swipeThreshold) changeDate(1);
    if (touchEndX - touchStartX.current > swipeThreshold) changeDate(-1);
  };

  const groupedMatches = matches.reduce((acc: any, match) => {
    const isFav = favoriteTeams.includes(match.team_a_id) || favoriteTeams.includes(match.team_b_id) || favoriteMatches.includes(match.id);
    if (isFav) {
      if (!acc['⭐ お気に入り']) acc['⭐ お気に入り'] = [];
      acc['⭐ お気に入り'].push(match);
    }
    const key = viewMode === 'court' ? match.court : match.group_name;
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {});

  if (!isMounted) return <div className="min-h-screen bg-[#f2f4f5]"></div>;

  const todayStr = getJSTDateString();
  const isToday = currentDate === todayStr;

  return (
    <div 
      className="min-h-screen bg-[#f2f4f5] pb-28 font-sans overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ★ 修正: 日付とトグルを1つのコンテナにまとめ、top-0 で固定 */}
      <div className="sticky top-0 z-40 bg-[#f2f4f5] border-b border-gray-200 shadow-sm">
        <div id={isToday ? "today" : undefined} className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center scroll-mt-20">
          <div className="flex items-center space-x-1">
            <button onClick={() => changeDate(-1)} aria-label="前日へ" className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
          </div>
          <div className="flex flex-col items-center relative">
            <label htmlFor="date-picker" className="sr-only">日付を選択</label>
            <input
              id="date-picker"
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="text-sm font-bold text-gray-800 bg-transparent text-center focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
            <button onClick={() => setCurrentDate(getJSTDateString())} className="text-xs bg-cyan-50 text-cyan-600 font-bold px-2.5 py-1.5 rounded-lg border border-cyan-100 active:scale-95 transition-transform">今日</button>
          </div>
          <button onClick={() => changeDate(1)} aria-label="翌日へ" className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight size={20}/></button>
        </div>

        <div className="flex justify-center px-4 py-2.5 bg-white">
          <div className="bg-gray-200 p-1 rounded-xl flex space-x-1 w-full max-w-sm">
            <button onClick={() => setViewMode('court')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'court' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              コート別
            </button>
            <button onClick={() => setViewMode('group')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'group' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              グループ別
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-4 px-2 lg:px-4 space-y-5">
        {loading ? (
          <div className="text-center text-gray-500 py-10">読み込み中...</div>
        ) : Object.keys(groupedMatches).length === 0 ? (
          <div className="text-center text-gray-400 py-10">この日の試合はありません</div>
        ) : (
          Object.keys(groupedMatches).sort((a, b) => {
            if (a === '⭐ お気に入り') return -1;
            if (b === '⭐ お気に入り') return 1;
            return a.localeCompare(b);
          }).map((groupKey) => {
            const isCollapsed = collapsedGroups[groupKey];
            const groupMatches = groupedMatches[groupKey];
            const firstMatch = groupMatches[0];
            const tournamentName = firstMatch?.tournament_name;
            const tournamentId = firstMatch?.tournament_id;

            return (
              <div key={groupKey} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${groupKey === '⭐ お気に入り' ? 'border-orange-200 shadow-orange-100' : 'border-gray-200'}`}>
                <div onClick={() => toggleGroup(groupKey)} className={`px-4 py-3 border-b flex flex-col cursor-pointer transition-colors ${groupKey === '⭐ お気に入り' ? 'bg-orange-50/50 border-orange-100 hover:bg-orange-50' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                  {tournamentName && groupKey !== '⭐ お気に入り' && (
                    <div className="mb-1">
                      <Link 
                        href="/results" 
                        onClick={(e) => { e.stopPropagation(); sessionStorage.setItem('results_tourneyId', tournamentId); }}
                        className="text-[10px] text-gray-400 font-bold hover:text-cyan-600 hover:underline uppercase tracking-wider"
                      >
                        {tournamentName}
                      </Link>
                    </div>
                  )}
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-4 rounded-full ${groupKey === '⭐ お気に入り' ? 'bg-orange-400' : 'bg-cyan-500'}`}></div>
                      <h2 className="text-[15px] font-bold text-gray-900">{groupKey}</h2>
                    </div>
                    {isCollapsed ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronUp size={18} className="text-gray-400" />}
                  </div>
                </div>
                
                {!isCollapsed && (
                  <div className="flex flex-col divide-y divide-gray-100">
                    {groupMatches.map((match: any) => {
                      const isTeamAWon = match.status === 'finished' && match.team_a_sets > match.team_b_sets;
                      const isTeamBWon = match.status === 'finished' && match.team_b_sets > match.team_a_sets;
                      const isMatchFav = favoriteMatches.includes(match.id);

                      return (
                        <Link href={`/match/${match.id}`} key={match.id} className="flex px-4 py-3 items-center hover:bg-gray-50 transition-colors group">
                          <div className="w-16 shrink-0 flex flex-col items-center justify-center space-y-1">
                            {match.status === 'live' && <span className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded animate-pulse">LIVE</span>}
                            {match.status === 'finished' && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 border px-2 py-0.5 rounded">終了</span>}
                            {match.status === 'scheduled' && <span className="text-xs text-gray-500 font-medium">{match.start_time}</span>}
                            <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">
                              {viewMode === 'court' ? `第${match.match_order}試合` : `${match.court} 第${match.match_order}試合`}
                            </span>
                          </div>

                          <div className="flex-1 flex items-center justify-center space-x-2 md:space-x-4 ml-2">
                            <div className={`flex-1 text-right text-sm md:text-base truncate ${isTeamAWon ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{match.team_a_name}</div>
                            <div className={`w-14 shrink-0 text-center rounded text-sm py-1 ${match.status === 'live' ? 'text-orange-500 font-bold bg-orange-50' : 'text-gray-900 font-bold bg-gray-100'}`}>
                              {match.status === 'scheduled' ? '-' : `${match.team_a_sets} - ${match.team_b_sets}`}
                            </div>
                            <div className={`flex-1 text-left text-sm md:text-base truncate ${isTeamBWon ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{match.team_b_name}</div>
                          </div>
                          
                          <button onClick={(e) => { e.preventDefault(); toggleMatchFavorite(match.id); }} aria-label="試合をお気に入り" className="w-8 flex justify-end pl-2">
                            <Star size={18} className={`transition-colors ${isMatchFav ? 'text-orange-400' : 'text-gray-300 hover:text-orange-400'}`} fill={isMatchFav ? 'currentColor' : 'none'} />
                          </button>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}