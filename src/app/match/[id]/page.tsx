'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, Plus, Minus, Edit, Save, MapPin, Hash, RefreshCcw, ChevronDown, Calendar, Star, Trash2, Trophy } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import Link from 'next/link';

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? '00' : '30';
  return `${h.toString().padStart(2, '0')}:${m}`;
});
const ORDER_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;
  const { requireAdmin } = useAuth();

  const [match, setMatch] = useState<any>(null);
  const [sets, setSets] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isMatchInfoEditing, setIsMatchInfoEditing] = useState(false);
  const [isFavoriteMatch, setIsFavoriteMatch] = useState(false);

  const [editDate, setEditDate] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editCourt, setEditCourt] = useState('');
  const [editOrder, setEditOrder] = useState('1');
  const [editStartTime, setEditStartTime] = useState('');
  const [editTeamA, setEditTeamA] = useState('');
  const [editTeamB, setEditTeamB] = useState('');
  const [editTourneyId, setEditTourneyId] = useState('');

  const [masterVenues, setMasterVenues] = useState<string[]>([]);
  const [masterCourts, setMasterCourts] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('favorite_matches');
    if (saved) setIsFavoriteMatch(JSON.parse(saved).includes(matchId));

    supabase.from('teams').select('*').order('university_name').then(({data}) => { if (data) setTeams(data); });
    supabase.from('tournaments').select('*').order('year', {ascending: false}).then(({data}) => { if (data) setTournaments(data); });
  }, [matchId]);

  const toggleMatchFavorite = () => {
    const saved = localStorage.getItem('favorite_matches');
    let favs = saved ? JSON.parse(saved) : [];
    if (favs.includes(matchId)) {
      favs = favs.filter((id: string) => id !== matchId);
      setIsFavoriteMatch(false);
    } else {
      favs.push(matchId);
      setIsFavoriteMatch(true);
    }
    localStorage.setItem('favorite_matches', JSON.stringify(favs));
  };

  const fetchMatchData = useCallback(async () => {
    const { data: matchData } = await supabase.from('match_details').select('*').eq('id', matchId).single();
    
    if (matchData) {
      let vOpts: string[] = [];
      let cOpts: string[] = [];
      
      if (matchData.tournament_id) {
        const { data: tData } = await supabase.from('tournaments').select('venues, courts').eq('id', matchData.tournament_id).single();
        if (tData) {
          vOpts = tData.venues || [];
          cOpts = tData.courts || [];
        }
      }
      setMasterVenues(vOpts);
      setMasterCourts(cOpts);

      const getDisplayInfo = (id: string, name: string, ph: string, logo: string) => {
        if (id) return { name, link: `/team/${id}`, logo };
        if (ph && ph.startsWith('{')) {
          try { 
            const rule = JSON.parse(ph);
            if (rule.type === 'match') return { name: rule.label, link: `/match/${rule.refId}`, logo: null };
            return { name: rule.label, link: null, logo: null }; 
          } catch (e) {}
        }
        return { name: ph || '未定', link: null, logo: null };
      };
      
      matchData.teamAInfo = getDisplayInfo(matchData.team_a_id, matchData.team_a_name, matchData.team_a_placeholder, matchData.team_a_logo);
      matchData.teamBInfo = getDisplayInfo(matchData.team_b_id, matchData.team_b_name, matchData.team_b_placeholder, matchData.team_b_logo);

      setMatch(matchData);
      if (!isMatchInfoEditing) {
        setEditDate(matchData.match_date || new Date().toISOString().split('T')[0]);
        setEditVenue(matchData.venue || vOpts[0] || '');
        setEditCourt(matchData.court || cOpts[0] || '');
        setEditOrder(matchData.match_order?.toString() || '1');
        setEditStartTime(matchData.start_time || '');
        setEditTeamA(matchData.team_a_id || '');
        setEditTeamB(matchData.team_b_id || '');
        setEditTourneyId(matchData.tournament_id || '');
      }
    }

    const { data: setsData } = await supabase.from('match_sets').select('*').eq('match_id', matchId).order('set_number');
    if (setsData && setsData.length > 0) {
      setSets(setsData);
      setCurrentSetNumber((prev) => {
        if (prev === 1 && setsData.length === 1) return 1;
        if (setsData.length > prev && setsData[setsData.length - 1].set_number > prev) return setsData[setsData.length - 1].set_number;
        return prev;
      });
    } else {
      const { data: newSet } = await supabase.from('match_sets').insert({ match_id: matchId, set_number: 1 }).select().single();
      if (newSet) { setSets([newSet]); setCurrentSetNumber(1); }
    }
  }, [matchId, isMatchInfoEditing]);

  useEffect(() => {
    fetchMatchData();
    const channel = supabase.channel(`match_${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_sets', filter: `match_id=eq.${matchId}` }, fetchMatchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, fetchMatchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId, fetchMatchData]);

  const startNextMatchAutomatically = async (venue: string, court: string, currentOrder: number) => {
    const { data: nextMatch } = await supabase.from('matches').select('id').eq('venue', venue).eq('court', court).eq('match_order', currentOrder + 1).eq('status', 'scheduled').single();
    if (nextMatch) await supabase.from('matches').update({ status: 'live' }).eq('id', nextMatch.id);
  };

  const updateScore = async (teamA_points: number, teamB_points: number) => {
    const targetSet = sets.find(s => s.set_number === currentSetNumber);
    if (!targetSet) return;

    let finalA = teamA_points; let finalB = teamB_points;
    if (finalA > 25 && finalA - finalB > 2) finalA = Math.max(25, finalB + 2);
    if (finalB > 25 && finalB - finalA > 2) finalB = Math.max(25, finalA + 2);

    let setWinner = null;
    if (finalA >= 25 && finalA - finalB >= 2) setWinner = 'a';
    if (finalB >= 25 && finalB - finalA >= 2) setWinner = 'b';
    const isSetFinished = setWinner !== null;

    await supabase.from('match_sets').update({ team_a_points: finalA, team_b_points: finalB, is_finished: isSetFinished }).eq('id', targetSet.id);

    const { data: updatedSets } = await supabase.from('match_sets').select('*').eq('match_id', matchId);
    let aSetsCount = 0; let bSetsCount = 0;
    let s1Winner = null; let s2Winner = null;

    updatedSets?.forEach(s => {
      if (s.is_finished) {
        const aWin = s.team_a_points >= 25 && s.team_a_points - s.team_b_points >= 2;
        const bWin = s.team_b_points >= 25 && s.team_b_points - s.team_a_points >= 2;
        if (aWin) { aSetsCount++; if (s.set_number === 1) s1Winner = 'a'; if (s.set_number === 2) s2Winner = 'a'; }
        if (bWin) { bSetsCount++; if (s.set_number === 1) s1Winner = 'b'; if (s.set_number === 2) s2Winner = 'b'; }
      }
    });

    const isMatchFinished = aSetsCount >= 2 || bSetsCount >= 2;
    await supabase.from('matches').update({ team_a_sets: aSetsCount, team_b_sets: bSetsCount, status: isMatchFinished ? 'finished' : 'live' }).eq('id', matchId);

    const decidedInTwo = s1Winner && s2Winner && s1Winner === s2Winner;
    if (decidedInTwo) {
      await supabase.from('match_sets').delete().gt('set_number', 2).eq('match_id', matchId);
    } else if (isSetFinished && !isMatchFinished && targetSet.set_number === (updatedSets?.length || 1) && targetSet.set_number < 3) {
      await supabase.from('match_sets').insert({ match_id: matchId, set_number: targetSet.set_number + 1 });
    }

    if (isMatchFinished && match.status !== 'finished') {
      await startNextMatchAutomatically(match.venue, match.court, match.match_order);
    }
    fetchMatchData();
  };

  const saveMatchInfo = async () => {
    const { data: duplicate } = await supabase.from('matches').select('id')
      .eq('match_date', editDate).eq('court', editCourt).eq('match_order', parseInt(editOrder))
      .neq('id', matchId).maybeSingle();

    if (duplicate) {
      alert(`エラー：${editDate} の ${editCourt} 第${editOrder}試合には重複があります。`);
      return;
    }

    await supabase.from('matches').update({
      match_date: editDate, venue: editVenue, court: editCourt,
      match_order: parseInt(editOrder), start_time: editStartTime,
      team_a_id: editTeamA || null, team_b_id: editTeamB || null,
      tournament_id: editTourneyId || null
    }).eq('id', matchId);
    
    setIsMatchInfoEditing(false);
    fetchMatchData();
  };

  const handleDeleteMatch = async () => {
    if (confirm('本当にこの試合を削除しますか？')) {
      await supabase.from('matches').delete().eq('id', matchId);
      alert('試合を削除しました。');
      router.push('/');
    }
  };

  if (!match) return <div className="min-h-screen bg-[#f2f4f5] flex items-center justify-center text-gray-500">読み込み中...</div>;

  const activeSet = sets.find(s => s.set_number === currentSetNumber) || sets[0];
  const getBgGradient = () => {
    if (match.status === 'live') return 'from-orange-600 to-red-800';
    if (match.status === 'finished') return 'from-slate-700 to-slate-900';
    return 'from-cyan-600 to-[#1a2530]';
  };

  return (
    <div className="min-h-screen bg-[#f2f4f5] font-sans pb-28">
      <header className="bg-linear-to-r from-cyan-500 to-cyan-600 text-white p-4 sticky top-0 z-50 flex items-center shadow-md">
        <button onClick={() => router.back()} aria-label="戻る" className="p-1 -ml-1 hover:bg-white/20 rounded-full">
          <ChevronLeft size={28} />
        </button>
        <div className="ml-2 flex-1 flex flex-col justify-center">
          {/* 大会名表示を追加 */}
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded w-fit mb-0.5 font-bold">{match.tournament_name || '無所属'}</span>
          <h1 className="text-sm font-bold truncate">{match.teamAInfo.name} vs {match.teamBInfo.name}</h1>
        </div>
        <button onClick={toggleMatchFavorite} aria-label="この試合をお気に入り" className="p-2 hover:bg-white/20 rounded-full ml-auto">
          <Star size={24} className={isFavoriteMatch ? 'text-orange-400' : 'text-white/50'} fill={isFavoriteMatch ? 'currentColor' : 'none'} />
        </button>
      </header>

      <div className="bg-white px-4 py-4 border-b border-gray-200 text-sm shadow-sm relative z-10">
        {isMatchInfoEditing ? (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <h3 className="font-bold text-gray-700">試合情報の編集</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* 大会名編集を追加 */}
              <div className="col-span-2 relative">
                <label htmlFor="editTourney" className="text-[10px] font-bold text-gray-500 mb-1 block">所属大会</label>
                <select id="editTourney" value={editTourneyId} onChange={e => setEditTourneyId(e.target.value)} className="w-full appearance-none border rounded-lg py-2 pl-3 text-sm">{tournaments.map(t => <option key={t.id} value={t.id}>{t.year}年度 : {t.name}</option>)}</select>
                <ChevronDown size={14} className="absolute right-2 bottom-3 text-gray-400 pointer-events-none"/>
              </div>
              <div>
                <label htmlFor="editDate" className="text-[10px] font-bold text-gray-500 mb-1 block">日付</label>
                <input id="editDate" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full border py-2 px-3 rounded-lg text-sm" />
              </div>
              <div className="relative">
                <label htmlFor="editStartTime" className="text-[10px] font-bold text-gray-500 mb-1 block">予定時刻</label>
                <select id="editStartTime" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="w-full appearance-none border rounded-lg py-2 pl-3 text-sm focus:ring-2 focus:ring-cyan-500"><option value="">未定</option>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <ChevronDown size={14} className="absolute right-2 bottom-3 text-gray-400 pointer-events-none"/>
              </div>
              <div className="relative">
                <label htmlFor="editTeamA" className="text-[10px] font-bold text-gray-500 mb-1 block">Team A</label>
                <select id="editTeamA" value={editTeamA} onChange={e => setEditTeamA(e.target.value)} className="w-full appearance-none border rounded-lg py-2 pl-3 text-sm">{teams.map(t => <option key={t.id} value={t.id}>{t.team_name || t.university_name}</option>)}</select>
                <ChevronDown size={14} className="absolute right-2 bottom-3 text-gray-400 pointer-events-none"/>
              </div>
              <div className="relative">
                <label htmlFor="editTeamB" className="text-[10px] font-bold text-gray-500 mb-1 block">Team B</label>
                <select id="editTeamB" value={editTeamB} onChange={e => setEditTeamB(e.target.value)} className="w-full appearance-none border rounded-lg py-2 pl-3 text-sm">{teams.map(t => <option key={t.id} value={t.id}>{t.team_name || t.university_name}</option>)}</select>
                <ChevronDown size={14} className="absolute right-2 bottom-3 text-gray-400 pointer-events-none"/>
              </div>
              <div className="relative col-span-2">
                <label htmlFor="editVenue" className="text-[10px] font-bold text-gray-500 mb-1 block">会場</label>
                <select id="editVenue" value={editVenue} onChange={e => setEditVenue(e.target.value)} className="w-full appearance-none border rounded-lg py-2 pl-3 text-sm">{masterVenues.map(v => <option key={v} value={v}>{v}</option>)}</select>
                <ChevronDown size={14} className="absolute right-2 bottom-3 text-gray-400 pointer-events-none"/>
              </div>
              <div className="relative">
                <label htmlFor="editCourt" className="text-[10px] font-bold text-gray-500 mb-1 block">コート</label>
                <select id="editCourt" value={editCourt} onChange={e => setEditCourt(e.target.value)} className="w-full appearance-none border rounded-lg py-2 pl-3 text-sm">{masterCourts.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <ChevronDown size={14} className="absolute right-2 bottom-3 text-gray-400 pointer-events-none"/>
              </div>
              <div className="relative">
                <label htmlFor="editOrder" className="text-[10px] font-bold text-gray-500 mb-1 block">試合順</label>
                <select id="editOrder" value={editOrder} onChange={e => setEditOrder(e.target.value)} className="w-full appearance-none border rounded-lg py-2 pl-3 text-sm">{ORDER_OPTIONS.map(o => <option key={o} value={o}>第{o}試合</option>)}</select>
                <ChevronDown size={14} className="absolute right-2 bottom-3 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            <div className="flex space-x-2 mt-3">
              <button onClick={saveMatchInfo} aria-label="保存" className="flex-1 bg-cyan-600 text-white py-2.5 rounded-lg font-bold flex items-center justify-center"><Save size={18} className="mr-2" /> 保存</button>
              <button onClick={handleDeleteMatch} aria-label="削除" className="bg-white border border-red-200 text-red-500 py-2.5 px-4 rounded-lg font-bold"><Trash2 size={18} /></button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-start">
            <div className="space-y-1.5 text-gray-600">
              <div className="flex items-center font-medium"><Trophy size={16} className="mr-1.5 text-cyan-600"/> {match.tournament_name || '未所属大会'}</div>
              <div className="flex items-center font-medium"><Calendar size={16} className="mr-1.5 text-cyan-600"/> {match.match_date}</div>
              <div className="flex items-center font-medium"><MapPin size={16} className="mr-1.5 text-cyan-600"/> {match.venue} / {match.court}</div>
              <div className="flex items-center font-medium"><Hash size={16} className="mr-1.5 text-cyan-600"/> 第{match.match_order}試合 <span className="ml-2 text-gray-400 text-xs">(予定: {match.start_time})</span></div>
            </div>
            <button onClick={() => requireAdmin(() => setIsMatchInfoEditing(true))} aria-label="試合情報を編集" className="text-cyan-600 p-2.5 rounded-full bg-cyan-50"><Edit size={18} /></button>
          </div>
        )}
      </div>

      <div className={`bg-linear-to-b ${getBgGradient()} text-white pt-6 pb-6 px-4 rounded-b-3xl shadow-lg`}>
        <div className="flex justify-between items-center max-w-md mx-auto">
          {/* ロゴの表示対応 */}
          {match.teamAInfo.link ? (
            <Link href={match.teamAInfo.link} className="flex flex-col items-center flex-1 hover:opacity-80 transition-opacity">
              {match.teamAInfo.logo ? <img src={match.teamAInfo.logo} alt="Logo" className="w-14 h-14 rounded-full bg-white object-contain p-1 mb-2 shadow-md"/> : <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-black text-xl mb-2">{match.teamAInfo.name.substring(0,1)}</div>}
              <span className="text-sm font-bold text-center leading-tight underline decoration-white/40 underline-offset-4">{match.teamAInfo.name}</span>
            </Link>
          ) : (
            <div className="flex flex-col items-center flex-1">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center font-black text-xl mb-2 text-white/40">?</div>
              <span className="text-sm font-bold text-center leading-tight">{match.teamAInfo.name}</span>
            </div>
          )}

          <div className="flex flex-col items-center px-2 w-40 shrink-0">
            <span className={`text-xs font-bold px-4 py-1.5 rounded-full mb-2 ${match.status === 'live' ? 'bg-orange-500 text-white animate-pulse' : match.status === 'finished' ? 'bg-slate-500/80 text-white' : 'bg-white/20'}`}>{match.status === 'live' ? '🔴 LIVE' : match.status === 'finished' ? '試合終了' : '予定'}</span>
            <div className="text-6xl font-black tabular-nums tracking-tighter whitespace-nowrap mt-1">{match.status === 'finished' ? `${match.team_a_sets} - ${match.team_b_sets}` : `${activeSet?.team_a_points || 0} - ${activeSet?.team_b_points || 0}`}</div>
            <span className="text-xs text-white/70 mt-2 font-medium">{match.status === 'finished' ? 'FINAL SCORE' : `第${currentSetNumber}セット ${activeSet?.is_finished ? '(終了)' : ''}`}</span>
          </div>

          {match.teamBInfo.link ? (
            <Link href={match.teamBInfo.link} className="flex flex-col items-center flex-1 hover:opacity-80 transition-opacity">
              {match.teamBInfo.logo ? <img src={match.teamBInfo.logo} alt="Logo" className="w-14 h-14 rounded-full bg-white object-contain p-1 mb-2 shadow-md"/> : <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-black text-xl mb-2">{match.teamBInfo.name.substring(0,1)}</div>}
              <span className="text-sm font-bold text-center leading-tight underline decoration-white/40 underline-offset-4">{match.teamBInfo.name}</span>
            </Link>
          ) : (
            <div className="flex flex-col items-center flex-1">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center font-black text-xl mb-2 text-white/40">?</div>
              <span className="text-sm font-bold text-center leading-tight">{match.teamBInfo.name}</span>
            </div>
          )}
        </div>

        <div className="max-w-md mx-auto mt-6 bg-white/10 rounded-xl border border-white/20 overflow-hidden backdrop-blur-md">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="bg-black/30 text-[10px] text-white/70 uppercase tracking-wider">
                <th className="py-2 text-left pl-4 w-1/3">Team</th>
                <th className="py-2 font-bold w-12">Sets</th>
                {sets.map(s => <th key={s.id} className="py-2 font-medium w-12">S{s.set_number}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr>
                <td className="py-2.5 text-left pl-4 font-bold text-xs truncate max-w-30">{match.teamAInfo.name}</td>
                <td className="py-2.5 font-black bg-black/20">{match.team_a_sets}</td>
                {sets.map(s => <td key={s.id} className={`py-2.5 ${s.is_finished && s.team_a_points > s.team_b_points ? 'font-bold' : 'text-white/50'}`}>{s.team_a_points}</td>)}
              </tr>
              <tr>
                <td className="py-2.5 text-left pl-4 font-bold text-xs truncate max-w-30">{match.teamBInfo.name}</td>
                <td className="py-2.5 font-black bg-black/20">{match.team_b_sets}</td>
                {sets.map(s => <td key={s.id} className={`py-2.5 ${s.is_finished && s.team_b_points > s.team_a_points ? 'font-bold' : 'text-white/50'}`}>{s.team_b_points}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="max-w-md mx-auto mt-6 px-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-[11px] font-black text-gray-400 ml-1">SCORE CONTROLLER</h2>
          <button onClick={() => requireAdmin(() => setIsEditingMode(!isEditingMode))} className={`px-4 py-2 rounded-full text-xs font-bold ${isEditingMode ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600'}`}>{isEditingMode ? '編集中を終了' : 'スコア入力 / 編集'}</button>
        </div>
        {isEditingMode && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border flex flex-col">
            <div className="flex space-x-2 mb-4 pb-2 overflow-x-auto border-b">
              {sets.map(s => (
                <button key={s.id} onClick={() => { setCurrentSetNumber(s.set_number); }} aria-label={`第${s.set_number}セットを選択`} className={`px-4 py-1.5 rounded-full font-bold text-xs ${currentSetNumber === s.set_number ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-500'}`}>第{s.set_number}セット {s.is_finished ? '✓' : ''}</button>
              ))}
            </div>
            <div className="flex justify-between items-center mb-5">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-gray-600 mb-2 truncate w-24 text-center">{match.teamAInfo.name}</span>
                <button onClick={() => updateScore((activeSet?.team_a_points || 0) + 1, activeSet?.team_b_points || 0)} aria-label="1点追加" className="w-24 h-24 bg-cyan-50 text-cyan-600 rounded-3xl flex flex-col items-center justify-center hover:bg-cyan-100 active:scale-95"><Plus size={36} /><span className="font-bold text-sm">+1</span></button>
              </div>
              <div className="flex flex-col items-center justify-center mt-6">
                <div className="flex space-x-8">
                  <button onClick={() => updateScore(Math.max(0, (activeSet?.team_a_points || 0) - 1), activeSet?.team_b_points || 0)} aria-label="1点減らす" className="text-gray-400 hover:text-red-500 bg-gray-50 p-3 rounded-full shadow-sm active:scale-90"><Minus size={22} /></button>
                  <button onClick={() => updateScore(activeSet?.team_a_points || 0, Math.max(0, (activeSet?.team_b_points || 0) - 1))} aria-label="1点減らす" className="text-gray-400 hover:text-red-500 bg-gray-50 p-3 rounded-full shadow-sm active:scale-90"><Minus size={22} /></button>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-gray-600 mb-2 truncate w-24 text-center">{match.teamBInfo.name}</span>
                <button onClick={() => updateScore(activeSet?.team_a_points || 0, (activeSet?.team_b_points || 0) + 1)} aria-label="1点追加" className="w-24 h-24 bg-cyan-50 text-cyan-600 rounded-3xl flex flex-col items-center justify-center hover:bg-cyan-100 active:scale-95"><Plus size={36} /><span className="font-bold text-sm">+1</span></button>
              </div>
            </div>
            <div className="pt-4 border-t grid grid-cols-3 gap-2">
              <button onClick={() => updateScore(10, activeSet?.team_b_points || 0)} className="bg-orange-50 text-orange-600 py-2.5 rounded-xl text-xs font-bold truncate px-1">10点</button>
              <button onClick={() => updateScore(0, 0)} className="bg-gray-100 text-gray-600 py-2.5 rounded-xl text-xs font-bold"><RefreshCcw size={14} className="inline mr-1" /> Reset</button>
              <button onClick={() => updateScore(activeSet?.team_a_points || 0, 10)} className="bg-orange-50 text-orange-600 py-2.5 rounded-xl text-xs font-bold truncate px-1">10点</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => updateScore(25, activeSet?.team_b_points || 0)} aria-label="25点取得" className="bg-red-50 text-red-600 py-2.5 rounded-xl text-[11px] font-bold truncate px-1">
                25点 (取得)
              </button>
              <button onClick={() => updateScore(activeSet?.team_a_points || 0, 25)} aria-label="25点取得" className="bg-red-50 text-red-600 py-2.5 rounded-xl text-[11px] font-bold truncate px-1">
                25点 (取得)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}