'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Trophy, ChevronDown, CalendarDays, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function ResultsPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'GS' | 'KS'>('GS');
  const [isInitialized, setIsInitialized] = useState(false);

  const [standings, setStandings] = useState<any[]>([]);
  const [ksMatches, setKsMatches] = useState<any[]>([]);
  const [gsMatches, setGsMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedTourneyId = sessionStorage.getItem('results_tourneyId');
    const savedTab = sessionStorage.getItem('results_activeTab') as 'GS' | 'KS';
    if (savedTab) setActiveTab(savedTab);

    supabase.from('tournaments').select('*').order('year', { ascending: false }).then(({ data }) => {
      if (data && data.length > 0) {
        setTournaments(data);
        if (savedTourneyId && data.some(t => t.id === savedTourneyId)) {
          setSelectedTournamentId(savedTourneyId);
        } else {
          const activeTournament = data.find(t => t.is_active) || data[0];
          setSelectedTournamentId(activeTournament.id);
        }
      } else {
        setLoading(false);
      }
      setIsInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (isInitialized && selectedTournamentId) sessionStorage.setItem('results_tourneyId', selectedTournamentId);
  }, [selectedTournamentId, isInitialized]);

  useEffect(() => {
    if (isInitialized) sessionStorage.setItem('results_activeTab', activeTab);
  }, [activeTab, isInitialized]);

  useEffect(() => {
    if (!selectedTournamentId) return;
    const fetchData = async () => {
      setLoading(true);
      const { data: stData } = await supabase.from('group_standings').select('*').eq('tournament_id', selectedTournamentId);
      if (stData) setStandings(stData);

      const { data: gsData } = await supabase.from('match_details').select('*').eq('tournament_id', selectedTournamentId).eq('stage', 'group').eq('status', 'finished');
      if (gsData) setGsMatches(gsData);

      const { data: ksData } = await supabase.from('match_details').select('*').eq('tournament_id', selectedTournamentId).eq('stage', 'knockout').order('match_date').order('match_order');
      
      if (ksData) {
        let hasUpdate = false;
        for (const m of ksData) {
          if (m.status === 'finished') continue;
          for (const teamKey of ['a', 'b']) {
            const teamId = m[`team_${teamKey}_id`];
            const ph = m[`team_${teamKey}_placeholder`];
            
            if (ph) { 
              const phStr = typeof ph === 'string' ? ph : JSON.stringify(ph);
              if (phStr.startsWith('{')) {
                try {
                  const rule = JSON.parse(phStr);
                  let targetId = null;
                  
                  if (rule.type === 'group') {
                    const allInGroup = stData?.filter(s => s.group_id === rule.refId) || [];
                    const sortedGroup = allInGroup.sort((a, b) => {
                      if (b.wins !== a.wins) return b.wins - a.wins;
                      if (b.set_won_ratio !== a.set_won_ratio) return b.set_won_ratio - a.set_won_ratio;
                      if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
                      const h2h = gsData?.find(gm => (gm.team_a_id === a.team_id && gm.team_b_id === b.team_id) || (gm.team_a_id === b.team_id && gm.team_b_id === a.team_id));
                      if (h2h) {
                        const aWon = (h2h.team_a_id === a.team_id && h2h.team_a_sets > h2h.team_b_sets) || (h2h.team_b_id === a.team_id && h2h.team_b_sets > h2h.team_a_sets);
                        return aWon ? -1 : 1;
                      }
                      return 0;
                    });
                    if (sortedGroup.length >= parseInt(rule.arg)) {
                      targetId = sortedGroup[parseInt(rule.arg) - 1].team_id;
                    }
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
        }

        if (hasUpdate) {
          fetchData();
          return;
        }

        const formattedKs = ksData.map(m => {
          let aRule = null, bRule = null;
          try { if (typeof m.team_a_placeholder === 'string' && m.team_a_placeholder.startsWith('{')) aRule = JSON.parse(m.team_a_placeholder); } catch(e){}
          try { if (typeof m.team_b_placeholder === 'string' && m.team_b_placeholder.startsWith('{')) bRule = JSON.parse(m.team_b_placeholder); } catch(e){}

          return {
            ...m,
            team_a_name: m.team_a_id ? m.team_a_name : (aRule ? aRule.label : (m.team_a_placeholder || '未定')),
            team_b_name: m.team_b_id ? m.team_b_name : (bRule ? bRule.label : (m.team_b_placeholder || '未定')),
            aRule,
            bRule,
            isThirdPlace: (aRule?.arg === 'loser' || bRule?.arg === 'loser')
          };
        });

        const getMatchDepth = (matchId: string, visited = new Set<string>()): number => {
          if (visited.has(matchId)) return 0;
          visited.add(matchId);
          const parentMatch = formattedKs.find(m => m.aRule?.refId === matchId || m.bRule?.refId === matchId);
          if (!parentMatch) return 0;
          return getMatchDepth(parentMatch.id, new Set(visited)) + 1;
        };
        formattedKs.forEach(m => { m.depth = getMatchDepth(m.id); });

        formattedKs.forEach(m => { m.treeOrder = m.match_order; });
        const finals = formattedKs.filter(m => m.depth === 0 && !m.isThirdPlace);

        const assignTreeOrder = (matchId: string, currentOrder: number, step: number) => {
          const match = formattedKs.find(m => m.id === matchId);
          if (!match) return;
          match.treeOrder = currentOrder;
          if (match.aRule?.type === 'match') assignTreeOrder(match.aRule.refId, currentOrder - step, step / 2);
          if (match.bRule?.type === 'match') assignTreeOrder(match.bRule.refId, currentOrder + step, step / 2);
        };
        finals.forEach((f, index) => assignTreeOrder(f.id, index * 1000, 500));

        setKsMatches(formattedKs);
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedTournamentId]);

  const groupedStandings = standings?.reduce((acc: any, team) => {
    const group = team.group_name;
    if (!acc[group]) acc[group] = [];
    acc[group].push(team);
    return acc;
  }, {});

  const maxDepth = Math.max(...ksMatches.map(m => m.depth || 0), 0);
  const ksColumns = [];
  if (ksMatches.length > 0) {
    for (let i = maxDepth; i >= 0; i--) {
      ksColumns.push({
        depth: i,
        matches: ksMatches.filter(m => m.depth === i).sort((a, b) => (a.treeOrder || 0) - (b.treeOrder || 0))
      });
    }
  }

  const getRoundName = (depth: number) => {
    if (depth === 0) return '決勝・3位決定戦';
    if (depth === 1) return '準決勝';
    if (depth === 2) return '準々決勝';
    return `Round of ${Math.pow(2, depth + 1)}`;
  };

  const maxMatchesInCol = Math.max(...ksColumns.map(c => c.matches.filter(m => !m.isThirdPlace).length), 1);
  const dynamicMinHeight = Math.max(650, maxMatchesInCol * 120); 

  return (
    <div className="min-h-screen bg-[#f2f4f5] text-gray-900 font-sans pb-28">
      <div className="bg-white border-b border-gray-200 sticky top-15 z-40 shadow-sm">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center text-cyan-600 font-bold whitespace-nowrap">
            <CalendarDays size={18} className="mr-2" />
            <span className="text-sm">シーズン選択</span>
          </div>
          <div className="relative w-full sm:max-w-120">
            <select aria-label="大会年度" value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg py-2 pl-3 pr-6 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-cyan-500 focus:outline-none shadow-sm break-all">
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.year}年度 : {t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex px-2 pt-2">
          <button onClick={() => setActiveTab('GS')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'GS' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>グループステージ</button>
          <button onClick={() => setActiveTab('KS')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'KS' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>トーナメント表</button>
        </div>
      </div>

      <main className="max-w-full mx-auto mt-4 px-2 lg:px-4 space-y-6">
        {loading ? (
          <div className="text-center py-10 text-gray-500 font-bold animate-pulse">読み込み中...</div>
        ) : activeTab === 'GS' ? (
          Object.keys(groupedStandings || {}).length === 0 ? (
            <div className="text-center py-10 text-gray-400 font-bold">データがありません</div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {Object.keys(groupedStandings || {}).sort().map((groupName) => (
                <div key={groupName} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
                  <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center space-x-3">
                    <div className="w-6 h-6 rounded bg-linear-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-sm">
                      <span className="text-white text-[10px] font-black">{groupName.replace('Group ', '')}</span>
                    </div>
                    <h2 className="text-[15px] font-bold text-gray-900">{groupName}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="text-[11px] text-gray-400 bg-gray-50/50 border-b border-gray-100 uppercase">
                        <tr>
                          <th className="px-3 py-2.5 w-8 text-center font-bold">#</th>
                          <th className="px-3 py-2.5 font-bold">チーム</th>
                          <th className="px-2 py-2.5 text-center font-bold">試</th>
                          <th className="px-2 py-2.5 text-center font-bold">勝</th>
                          <th className="px-2 py-2.5 text-center font-bold">敗</th>
                          <th className="px-2 py-2.5 text-center font-bold">S率</th>
                          <th className="px-2 py-2.5 text-center font-bold">得失</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {groupedStandings[groupName]
                          .sort((a: any, b: any) => {
                            if (b.wins !== a.wins) return b.wins - a.wins;
                            if (b.set_won_ratio !== a.set_won_ratio) return b.set_won_ratio - a.set_won_ratio;
                            if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
                            const h2h = gsMatches.find(m => 
                              (m.team_a_id === a.team_id && m.team_b_id === b.team_id) || 
                              (m.team_a_id === b.team_id && m.team_b_id === a.team_id)
                            );
                            if (h2h) {
                              const aWon = (h2h.team_a_id === a.team_id && h2h.team_a_sets > h2h.team_b_sets) ||
                                           (h2h.team_b_id === a.team_id && h2h.team_b_sets > h2h.team_a_sets);
                              return aWon ? -1 : 1;
                            }
                            return 0;
                          })
                          .map((team: any, index: number) => {
                            const isTopTwo = index < 2;
                            return (
                              <tr key={team.team_id} className={`hover:bg-gray-50 transition-colors ${isTopTwo ? 'bg-cyan-50/30' : ''}`}>
                                <td className="px-3 py-3 text-center">
                                  <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full mx-auto ${isTopTwo ? 'bg-cyan-100 text-cyan-600' : 'text-gray-400'}`}>{index + 1}</span>
                                </td>
                                <td className="px-3 py-3 font-bold text-[13px]"><Link href={`/team/${team.team_id}`} className="text-cyan-600 hover:text-cyan-800 transition-colors">{team.team_name || team.university_name}</Link></td>
                                <td className="px-2 py-3 text-center text-gray-500">{team.matches_played}</td>
                                <td className="px-2 py-3 text-center font-bold text-cyan-600">{team.wins}</td>
                                <td className="px-2 py-3 text-center text-gray-500">{team.losses}</td>
                                <td className="px-2 py-3 text-center text-gray-500 font-medium">{team.set_won_ratio.toFixed(3)}</td>
                                <td className="px-2 py-3 text-center font-medium">
                                  <span className={team.point_diff > 0 ? 'text-orange-500 font-bold' : team.point_diff < 0 ? 'text-gray-400' : 'text-gray-500'}>{team.point_diff > 0 ? `+${team.point_diff}` : team.point_diff}</span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          ksMatches.length === 0 ? (
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trophy size={32} /></div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">トーナメント表</h3>
              <p className="text-sm text-gray-500">登録されたノックアウトステージの試合がありません。</p>
            </div>
          ) : (
            <>
              {/* 修正: style={{}} を避け、styleタグを使って動的な高さを注入 */}
              <style>{`.bracket-container { min-height: ${dynamicMinHeight}px; }`}</style>
              <div className="w-full overflow-x-auto pb-8 custom-scrollbar">
                <div className="flex flex-row space-x-12 min-w-max p-2 px-6 relative h-[105vh] bracket-container">
                  {ksColumns.map((col) => {
                    const finalMatches = col.matches.filter(m => !m.isThirdPlace);
                    const thirdPlaceMatches = col.matches.filter(m => m.isThirdPlace);

                    return (
                      <div key={col.depth} className="flex flex-col w-64 h-full relative pt-10">
                        <div className="absolute top-0 w-full text-center bg-gray-800 text-white rounded-full py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm z-10">
                          {getRoundName(col.depth)}
                        </div>
                        
                        <div className="flex flex-col flex-1 w-full relative">
                          {finalMatches.map((match) => {
                            const isFinished = match.status === 'finished';
                            const isAWin = isFinished && match.team_a_sets > match.team_b_sets;
                            const isBWin = isFinished && match.team_b_sets > match.team_a_sets;
                            
                            return (
                              <div key={match.id} className="flex-1 flex flex-col justify-center relative w-full py-1">
                                <Link href={`/match/${match.id}`} className="block relative bg-white rounded-xl shadow-sm border border-gray-200 p-3 m-1 hover:shadow-md hover:border-cyan-400 transition-all z-20 group">
                                  <div className="flex justify-between items-center text-[10px] text-gray-400 mb-2 border-b border-gray-100 pb-1">
                                    <span className="flex items-center"><Calendar size={10} className="mr-1"/>{match.match_date} - {match.court}</span>
                                    {match.status === 'live' && <span className="text-orange-500 font-bold animate-pulse bg-orange-50 px-1.5 rounded">LIVE</span>}
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-sm">
                                      <span className={`truncate mr-2 ${isAWin ? 'font-black text-gray-900' : 'font-medium text-gray-600'}`}>{match.team_a_name}</span>
                                      <span className={`font-mono font-bold w-6 text-center rounded text-xs py-0.5 ${isAWin ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-50 text-gray-500'}`}>{isFinished ? match.team_a_sets : '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                      <span className={`truncate mr-2 ${isBWin ? 'font-black text-gray-900' : 'font-medium text-gray-600'}`}>{match.team_b_name}</span>
                                      <span className={`font-mono font-bold w-6 text-center rounded text-xs py-0.5 ${isBWin ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-50 text-gray-500'}`}>{isFinished ? match.team_b_sets : '-'}</span>
                                    </div>
                                  </div>
                                </Link>
                              </div>
                            );
                          })}
                        </div>

                        {thirdPlaceMatches.length > 0 && (
                          <div className="absolute -bottom-4 w-full flex flex-col justify-end pb-2">
                            <div className="text-[10px] text-center text-gray-400 font-bold mb-1.5 uppercase tracking-widest border-t border-dashed pt-2">3位決定戦</div>
                            {thirdPlaceMatches.map((match) => {
                              const isFinished = match.status === 'finished';
                              const isAWin = isFinished && match.team_a_sets > match.team_b_sets;
                              const isBWin = isFinished && match.team_b_sets > match.team_a_sets;
                              return (
                                <Link href={`/match/${match.id}`} key={match.id} className="block relative bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-3 hover:shadow-md hover:border-cyan-400 transition-all z-20 group">
                                  <div className="flex justify-between items-center text-[10px] text-gray-400 mb-2 border-b border-gray-200 pb-1">
                                    <span className="flex items-center"><Calendar size={10} className="mr-1"/>{match.match_date}</span>
                                    {match.status === 'live' && <span className="text-orange-500 font-bold animate-pulse">LIVE</span>}
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-sm">
                                      <span className={`truncate mr-2 ${isAWin ? 'font-black text-gray-900' : 'font-medium text-gray-600'}`}>{match.team_a_name}</span>
                                      <span className={`font-mono font-bold w-6 text-center rounded text-xs py-0.5 ${isAWin ? 'bg-cyan-100 text-cyan-800' : 'bg-white border text-gray-500'}`}>{isFinished ? match.team_a_sets : '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                      <span className={`truncate mr-2 ${isBWin ? 'font-black text-gray-900' : 'font-medium text-gray-600'}`}>{match.team_b_name}</span>
                                      <span className={`font-mono font-bold w-6 text-center rounded text-xs py-0.5 ${isBWin ? 'bg-cyan-100 text-cyan-800' : 'bg-white border text-gray-500'}`}>{isFinished ? match.team_b_sets : '-'}</span>
                                    </div>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}