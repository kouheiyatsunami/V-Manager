'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, MapPin, Building, History, Calendar, Star, TrendingUp, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';

// 再利用可能な試合カードコンポーネント
const MatchCard = ({ match, teamId }: { match: any, teamId: string }) => {
  const isTeamA = match.team_a_id === teamId;
  const opponentName = isTeamA ? match.team_b_name : match.team_a_name;
  const mySets = isTeamA ? match.team_a_sets : match.team_b_sets;
  const opSets = isTeamA ? match.team_b_sets : match.team_a_sets;
  const isWin = match.status === 'finished' && mySets > opSets;
  const stageName = match.stage === 'group' ? `${match.group_name}` : match.stage || 'ノックアウト';

  return (
    <Link href={`/match/${match.id}`} className="block bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{stageName}</span>
        <span className="text-[10px] text-gray-400 font-medium flex items-center"><Calendar size={10} className="mr-1"/>{match.match_date}</span>
      </div>
      <div className="flex items-center">
        <div className="w-12 shrink-0 flex flex-col items-center justify-center mr-2">
          {match.status === 'live' && <span className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded animate-pulse shadow-sm mb-1">LIVE</span>}
          {match.status === 'finished' && <span className={`text-[10px] font-bold px-2 py-0.5 rounded mb-1 ${isWin ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'}`}>{isWin ? '勝利' : '敗北'}</span>}
          {match.status === 'scheduled' && <span className="text-xs text-gray-400 font-medium">{match.start_time}</span>}
        </div>
        <div className="flex-1 flex items-center justify-between bg-gray-50/50 rounded-lg p-2 border border-gray-100">
          <div className="text-[13px] font-bold text-gray-800 flex items-center truncate">
            <span className="text-[10px] text-gray-400 mr-1.5 font-normal">vs</span>
            <span className="truncate">{opponentName}</span>
          </div>
          <div className={`text-sm font-black tracking-wider shrink-0 ml-2 ${match.status === 'live' ? 'text-orange-500' : 'text-gray-800'}`}>
            {match.status === 'scheduled' ? '-' : `${mySets} - ${opSets}`}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { requireAdmin } = useAuth(); // ★追加: 管理者権限の呼び出し

  const [universityInfo, setUniversityInfo] = useState<any>(null);
  const [universityTeams, setUniversityTeams] = useState<any[]>([]);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  
  const [calculatedResults, setCalculatedResults] = useState<{year: number, tName: string, result: string}[]>([]);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'matches'>('overview');
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [editHistoryText, setEditHistoryText] = useState('');

  const getDynamicGradient = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      'from-rose-700 to-red-950',      // 赤・ローズ系
      'from-orange-600 to-amber-950',  // オレンジ系
      'from-amber-600 to-orange-950',  // アンバー系
      'from-lime-700 to-emerald-950',  // ライム系
      'from-emerald-700 to-teal-950',  // 緑系
      'from-cyan-700 to-slate-900',    // シアン系
      'from-blue-700 to-indigo-950',   // 青系
      'from-violet-700 to-purple-950', // 紫系
      'from-fuchsia-700 to-pink-950',  // ピンク・フクシア系
      'from-slate-700 to-zinc-950'     // モノトーン系
    ];
    return gradients[Math.abs(hash) % gradients.length];
  };

  useEffect(() => {
    const fetchTeamData = async () => {
      const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).single();
      if (teamData) {
        setUniversityInfo(teamData);
        const { data: uTeams } = await supabase.from('teams').select('*').eq('university_name', teamData.university_name).order('team_name');
        const teamsList = uTeams || [];
        setUniversityTeams(teamsList);

        if (teamsList.length > 0) {
          const ids = teamsList.map(t => t.id);
          const { data: matchData } = await supabase.from('match_details')
            .select('*')
            .or(`team_a_id.in.(${ids.join(',')}),team_b_id.in.(${ids.join(',')})`)
            .order('match_date', { ascending: true })
            .order('start_time', { ascending: true });
          
          const mData = matchData || [];
          setAllMatches(mData);

          const currentYear = new Date().getFullYear();
          const targetYears = [currentYear, currentYear - 1, currentYear - 2];
          
          const tourneyGroups: Record<string, any[]> = {};
          mData.forEach(m => {
            if (!m.tournament_id) return;
            if (!tourneyGroups[m.tournament_id]) tourneyGroups[m.tournament_id] = [];
            tourneyGroups[m.tournament_id].push(m);
          });

          const tourneyIds = Object.keys(tourneyGroups);
          if (tourneyIds.length > 0) {
            const { data: tMaster } = await supabase.from('tournaments').select('*').in('id', tourneyIds);
            const { data: standings } = await supabase.from('group_standings').select('*').in('tournament_id', tourneyIds).in('team_id', ids);
            const resultsList: {year: number, tName: string, result: string}[] = [];

            tMaster?.forEach(t => {
              if (!targetYears.includes(t.year)) return;
              
              const tName = t.name;
              let finalResult = '';

              if (tName.includes('医歯薬')) {
                const myStanding = standings?.find(s => s.tournament_id === t.id);
                if (myStanding) {
                  const allInGroup = standings?.filter(s => s.group_id === myStanding.group_id) || [];
                  const rank = allInGroup.sort((a,b) => b.wins - a.wins || b.point_diff - a.point_diff).findIndex(s => s.team_id === myStanding.team_id) + 1;
                  finalResult = `${myStanding.group_name} ${rank}位`;
                } else {
                  finalResult = '記録なし';
                }
              }
              else if (tName.includes('東日本') || tName.includes('東医体') || tName.includes('医科リーグ')) {
                const myMatches = tourneyGroups[t.id];
                const ksMatches = myMatches.filter(m => m.stage === 'knockout');
                
                if (ksMatches.length === 0) {
                  const gsMatches = myMatches.filter(m => m.stage === 'group');
                  finalResult = gsMatches.length > 0 ? 'グループリーグ敗退' : '記録なし';
                } else {
                  let ksWins = 0;
                  ksMatches.forEach(m => {
                    const isTeamA = ids.includes(m.team_a_id);
                    const mySets = isTeamA ? m.team_a_sets : m.team_b_sets;
                    const opSets = isTeamA ? m.team_b_sets : m.team_a_sets;
                    if (m.status === 'finished' && mySets > opSets) ksWins++;
                  });

                  if (ksWins === 0) finalResult = 'ベスト16 (1回戦敗退)';
                  else if (ksWins === 1) finalResult = 'ベスト8';
                  else if (ksWins === 2) finalResult = 'ベスト4';
                  else if (ksWins >= 3) finalResult = '優勝 または 準優勝';
                  else finalResult = '決勝トーナメント進出';
                }
              }

              if (finalResult && finalResult !== '記録なし') {
                resultsList.push({ year: t.year, tName: tName, result: finalResult });
              }
            });

            resultsList.sort((a, b) => b.year - a.year);
            setCalculatedResults(resultsList);
          }
        }
      }
      setLoading(false);
    };

    fetchTeamData();
    const saved = localStorage.getItem('favorite_teams');
    if (saved) setIsFavorite(JSON.parse(saved).includes(teamId));
  }, [teamId]);

  const toggleFavorite = () => {
    const saved = localStorage.getItem('favorite_teams');
    let favs = saved ? JSON.parse(saved) : [];
    if (favs.includes(teamId)) { favs = favs.filter((id: string) => id !== teamId); setIsFavorite(false); } 
    else { favs.push(teamId); setIsFavorite(true); }
    localStorage.setItem('favorite_teams', JSON.stringify(favs));
  };

  // ★追加: 手動入力成績の保存処理
  const handleSaveHistory = async () => {
    const { error } = await supabase
      .from('teams')
      .update({ historical_results: editHistoryText })
      .eq('university_name', universityInfo.university_name); // 同じ大学の全チームを一括更新

    if (error) {
      alert(`保存エラー: ${error.message}`);
    } else {
      setUniversityInfo({ ...universityInfo, historical_results: editHistoryText });
      setIsEditingHistory(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#f2f4f5] flex items-center justify-center text-gray-500 font-bold animate-pulse">読み込み中...</div>;
  if (!universityInfo) return <div className="min-h-screen bg-[#f2f4f5] flex items-center justify-center">大学が見つかりません。</div>;

  return (
    <div className="min-h-screen bg-[#f2f4f5] font-sans pb-28">
      <div className={`bg-linear-to-b ${getDynamicGradient(universityInfo.university_name)} text-white pt-4 pb-0 relative`}>
        <div className="px-4 flex items-center justify-between mb-4">
          <button onClick={() => router.back()} aria-label="戻る" className="p-2 hover:bg-white/20 rounded-full -ml-2"><ChevronLeft size={28} /></button>
          <button onClick={toggleFavorite} aria-label="お気に入り" className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <Star size={24} className={isFavorite ? 'text-orange-400' : 'text-white/50 hover:text-orange-400'} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        
        <div className="px-6 flex items-center space-x-4 mb-6">
          {universityInfo.logo_url ? (
            <img src={universityInfo.logo_url} alt="Logo" className="w-20 h-20 bg-white border-2 border-white/20 rounded-2xl object-contain p-2 shadow-lg shrink-0" />
          ) : (
            <div className="w-20 h-20 bg-white/10 border-2 border-white/20 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg shrink-0">
              {universityInfo.university_name.substring(0, 1)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tight">{universityInfo.university_name}</h1>
            <span className="inline-block mt-1 px-2.5 py-0.5 bg-white/20 rounded-full text-[10px] font-bold tracking-wider">{universityInfo.university_type || '大学'}</span>
          </div>
        </div>

        <div className="flex px-4 mt-auto border-b border-white/10">
          <button onClick={() => setActiveTab('overview')} className={`pb-3 px-4 text-sm font-bold transition-all ${activeTab === 'overview' ? 'border-b-4 border-orange-500 text-white' : 'text-white/60 border-b-4 border-transparent hover:text-white'}`}>概要</button>
          <button onClick={() => setActiveTab('matches')} className={`pb-3 px-4 text-sm font-bold transition-all ${activeTab === 'matches' ? 'border-b-4 border-orange-500 text-white' : 'text-white/60 border-b-4 border-transparent hover:text-white'}`}>試合一覧</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-4 px-4 space-y-4">
        {activeTab === 'overview' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-6">
            <div>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center"><Building size={14} className="mr-1.5"/> 基本情報</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">大学区分</span><span className="font-bold">{universityInfo.university_type || '-'}</span></div>
                <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">所在地</span><span className="font-bold flex items-center"><MapPin size={14} className="mr-1 text-cyan-600"/>{universityInfo.prefecture ? `${universityInfo.prefecture} ${universityInfo.city || ''}` : '-'}</span></div>
                <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">登録チーム数</span><span className="font-bold">{universityTeams.length} チーム</span></div>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center"><TrendingUp size={14} className="mr-1.5"/> 自動算出成績 (過去3年)</h3>
              {calculatedResults.length > 0 ? (
                <div className="space-y-2">
                  {calculatedResults.map((res, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-100 p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-cyan-700 mr-2">{res.year}年</span>
                        <span className="text-xs font-medium text-gray-600">{res.tName}</span>
                      </div>
                      <span className="text-sm font-black text-gray-800">{res.result}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg text-center border border-gray-100">データ不足のため自動算出できません</p>
              )}
            </div>

            {/* ★修正: 編集機能を組み込んだ特筆すべき成績セクション */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center">
                  <History size={14} className="mr-1.5"/> 過去の特筆すべき成績 (手動入力)
                </h3>
                {!isEditingHistory && (
                  <button onClick={() => requireAdmin(() => { setIsEditingHistory(true); setEditHistoryText(universityInfo.historical_results || ''); })} className="text-cyan-600 hover:bg-cyan-50 p-1.5 rounded transition-colors flex items-center text-[10px] font-bold">
                    <Edit2 size={12} className="mr-1" /> 編集
                  </button>
                )}
              </div>
              
              {isEditingHistory ? (
                <div className="space-y-2 animate-in fade-in">
                  <textarea 
                    value={editHistoryText} 
                    onChange={e => setEditHistoryText(e.target.value)} 
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-30 focus:outline-none focus:ring-2 focus:ring-cyan-500" 
                    placeholder="例: 2025年 東医体 ベスト8&#13;&#10;2024年 秋季リーグ 1部昇格"
                  ></textarea>
                  <div className="flex space-x-2">
                    <button onClick={handleSaveHistory} className="flex-1 bg-cyan-600 text-white font-bold py-2.5 rounded-lg text-sm">保存</button>
                    <button onClick={() => setIsEditingHistory(false)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-200">キャンセル</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                  {universityInfo.historical_results || '記録なし'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {universityTeams.map(team => {
              const teamMatches = allMatches.filter(m => m.team_a_id === team.id || m.team_b_id === team.id);
              const upcoming = teamMatches.filter(m => m.status !== 'finished');
              const past = teamMatches.filter(m => m.status === 'finished').reverse();

              if (teamMatches.length === 0) return null;

              return (
                <div key={team.id} className="animate-in fade-in">
                  <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center border-b pb-2">
                    {team.team_name}
                  </h2>
                  
                  {upcoming.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-[11px] font-bold text-cyan-600 mb-3 ml-1 uppercase tracking-widest">Upcoming Matches</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {upcoming.map(m => <MatchCard key={m.id} match={m} teamId={team.id} />)}
                      </div>
                    </div>
                  )}

                  {past.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-bold text-gray-400 mb-3 ml-1 uppercase tracking-widest">Past Matches</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {past.map(m => <MatchCard key={m.id} match={m} teamId={team.id} />)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {allMatches.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-500">この大学が参加する試合はまだ登録されていません。</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}