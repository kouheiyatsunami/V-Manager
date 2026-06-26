'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Star, ShieldAlert, PlusCircle, Settings as SettingsIcon, LogOut, Search, Filter, MapPin, Users, CalendarPlus, X, ChevronDown, ChevronUp, GraduationCap, UploadCloud } from 'lucide-react';

const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? '00' : '30';
  return `${h.toString().padStart(2, '0')}:${m}`;
});

export default function SettingsPage() {
  const { isAdmin, requireAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'admin'>('general');

  const [teams, setTeams] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('すべて');
  const [filterRegion, setFilterRegion] = useState('すべて');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTId, setSelectedTId] = useState('');
  
  // ★大会作成用ステート拡張
  const [newTourneyName, setNewTourneyName] = useState('');
  const [newTourneyYear, setNewTourneyYear] = useState(new Date().getFullYear());
  const [tourneyType, setTourneyType] = useState('2'); // 1: KSのみ, 2: GS+KS, 3: GSのみ
  const [groupCount, setGroupCount] = useState(8);
  
  const [masterVenues, setMasterVenues] = useState<string[]>([]);
  const [newVenueInput, setNewVenueInput] = useState('');
  const [masterCourts, setMasterCourts] = useState<string[]>([]);
  const [newCourtInput, setNewCourtInput] = useState('');

  const [groups, setGroups] = useState<any[]>([]);
  const [groupTeams, setGroupTeams] = useState<any[]>([]);
  const [assignTeam, setAssignTeam] = useState('');
  const [assignGroup, setAssignGroup] = useState('');
  const [tournamentMatches, setTournamentMatches] = useState<any[]>([]);

  // チーム編集・ロゴ
  const [selectedEditTeamId, setSelectedEditTeamId] = useState('');
  const [teamForm, setTeamForm] = useState({ university_name: '', team_name: '', university_type: '国立', prefecture: '山梨県', city: '中央市', logo_url: '', historical_results: '' });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formMatch, setFormMatch] = useState({
    date: new Date().toISOString().split('T')[0], time: '', venue: '', court: '', order: '1',
    stage: 'group', groupId: '', teamA: '', teamB: ''
  });

  const [ksRuleA, setKsRuleA] = useState({ type: 'group', refId: '', arg: '1' });
  const [ksRuleB, setKsRuleB] = useState({ type: 'group', refId: '', arg: '2' });

  const [collapsed, setCollapsed] = useState({ master: true, teamManage: false, assign: true, match: false, create: true });
  const toggleSection = (sec: keyof typeof collapsed) => setCollapsed(prev => ({ ...prev, [sec]: !prev[sec] }));

  // ★修正: app_settingsからの取得を削除
  const fetchInitialData = async () => {
    supabase.from('teams').select('*').order('university_name').then(({ data }) => { if (data) setTeams(data); });
    supabase.from('tournaments').select('*').order('year', { ascending: false }).then(({ data }) => {
      if (data) { setTournaments(data); if (data.length > 0) setSelectedTId(data[0].id); }
    });
  };

  useEffect(() => {
    fetchInitialData();
    const saved = localStorage.getItem('favorite_teams');
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!selectedTId) return;
    const fetchAdminData = async () => {
      const { data: t } = await supabase.from('tournaments').select('*').eq('id', selectedTId).single();
      const { data: g } = await supabase.from('groups').select('*').eq('tournament_id', selectedTId).order('name');
      const { data: tm } = await supabase.from('matches').select('*').eq('tournament_id', selectedTId).order('match_date').order('court').order('match_order');
      
      // ★修正: 対象の大会情報(tournamentsテーブル)から会場・コートをセット
      if (t) {
        const vOpts = t.venues || [];
        const cOpts = t.courts || [];
        setMasterVenues(vOpts);
        setMasterCourts(cOpts);
        
        if (t.main_venue) {
          setFormMatch(p => ({ ...p, venue: t.main_venue }));
        } else if (vOpts.length > 0) {
          setFormMatch(p => ({ ...p, venue: vOpts[0] }));
        }
      }
      
      if (g && g.length > 0) { setGroups(g); setFormMatch(p => ({ ...p, groupId: g[0].id })); } else { setGroups([]); setFormMatch(p => ({ ...p, groupId: '' })); }
      if (tm) setTournamentMatches(tm); else setTournamentMatches([]);
      const { data: gt } = await supabase.from('group_teams').select('*');
      if (gt) setGroupTeams(gt);
    };
    fetchAdminData();
  }, [selectedTId]);

  // ★ ロゴのアップロード処理
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file);
    if (uploadError) {
      alert(`アップロード失敗: ${uploadError.message}`);
    } else {
      const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
      setTeamForm(prev => ({ ...prev, logo_url: data.publicUrl }));
    }
    setUploadingLogo(false);
  };

  const handleSaveTeamForm = async () => {
    if (!teamForm.university_name) return alert('大学名を入力してください');
    const finalTeamName = teamForm.team_name || teamForm.university_name;

    if (selectedEditTeamId) {
      await supabase.from('teams').update({ ...teamForm, team_name: finalTeamName }).eq('id', selectedEditTeamId);
      alert('チーム情報を更新しました');
    } else {
      await supabase.from('teams').insert({ ...teamForm, team_name: finalTeamName });
      alert('新しいチームを登録しました');
    }
    setSelectedEditTeamId('');
    setTeamForm({ university_name: '', team_name: '', university_type: '国立', prefecture: '山梨県', city: '中央市', logo_url: '', historical_results: '' });
    fetchInitialData();
  };

  const handleSelectEditTeam = (id: string) => {
    if(!id) {
      setSelectedEditTeamId(''); setTeamForm({ university_name: '', team_name: '', university_type: '国立', prefecture: '山梨県', city: '中央市', logo_url: '', historical_results: '' });
      return;
    }
    const t = teams.find(item => item.id === id);
    if(t) {
      setSelectedEditTeamId(id);
      setTeamForm({ university_name: t.university_name, team_name: t.team_name || '', university_type: t.university_type || '国立', prefecture: t.prefecture || '', city: t.city || '', logo_url: t.logo_url || '', historical_results: t.historical_results || '' });
    }
  };

  const toggleFavorite = (teamId: string) => {
    const newFavs = favorites.includes(teamId) ? favorites.filter(id => id !== teamId) : [...favorites, teamId];
    setFavorites(newFavs); localStorage.setItem('favorite_teams', JSON.stringify(newFavs));
  };
  const getRegion = (pref: string) => {
    if (!pref) return 'その他';
    if (['北海道'].includes(pref)) return '北海道';
    if (['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'].includes(pref)) return '東北';
    if (['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'].includes(pref)) return '関東';
    if (['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県'].includes(pref)) return '甲信越';
    return 'その他';
  };
  const filteredTeams = teams.filter(team => {
    const matchSearch = team.university_name.includes(searchQuery);
    const matchType = filterType === 'すべて' || team.university_type === filterType;
    const matchRegion = filterRegion === 'すべて' || getRegion(team.prefecture) === filterRegion;
    const matchFav = showOnlyFavorites ? favorites.includes(team.id) : true;
    return matchSearch && matchType && matchRegion && matchFav;
  });

  // ★ 大会タイプに応じた自動生成
  const handleCreateTournament = async () => {
    if (!newTourneyName) return alert('大会名を入力してください');
    // ★修正: main_venueの初期化を削除（DBのデフォルト配列に依存）
    const { data, error } = await supabase.from('tournaments').insert({ name: newTourneyName, year: newTourneyYear, is_active: false }).select().single();
    if (!error && data) {
      if (groupCount > 0) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const groupNames = Array.from({length: groupCount}, (_, i) => `Group ${letters[i]}`);
        await supabase.from('groups').insert(groupNames.map(name => ({ tournament_id: data.id, name: name })));
      }
      alert('新しい大会を作成しました！');
      setTournaments([data, ...tournaments]); setSelectedTId(data.id); setNewTourneyName('');
    }
  };

  // ★修正: 操作対象の大会に対して設定を保存するように変更
  const handleSaveSettings = async () => {
    if (!selectedTId) return alert('大会が選択されていません');
    const { error } = await supabase.from('tournaments').update({ venues: masterVenues, courts: masterCourts }).eq('id', selectedTId);
    if (error) {
      alert(`保存エラー: ${error.message}`);
    } else {
      alert('選択中の大会に設定を保存しました');
    }
  };

  const handleAssignTeam = async () => {
    if (!assignTeam || !assignGroup) return alert('選択してください');
    const { data: exist } = await supabase.from('group_teams').select('*').eq('team_id', assignTeam).eq('group_id', assignGroup).maybeSingle();
    if (exist) return alert('登録済みです');
    await supabase.from('group_teams').insert({ group_id: assignGroup, team_id: assignTeam });
    const { data: gt } = await supabase.from('group_teams').select('*'); if (gt) setGroupTeams(gt);
    alert('登録完了しました');
  };

  const handleSaveMatch = async () => {
    const { data: dup } = await supabase.from('matches').select('id').eq('match_date', formMatch.date).eq('court', formMatch.court).eq('match_order', parseInt(formMatch.order)).maybeSingle();
    if (dup) return alert('⚠️ エラー：同じ日程・コート・試合順の試合が既に存在します！');

    let teamAId = null; let teamBId = null;
    let placeA = null; let placeB = null;

    if (formMatch.stage === 'group') {
      if (!formMatch.teamA || !formMatch.teamB || formMatch.teamA === formMatch.teamB) return alert('異なる2チームを選択してください');
      teamAId = formMatch.teamA; teamBId = formMatch.teamB;
    } else {
      // ★ チーム直接指定か、プレースホルダーかを判定
      if (ksRuleA.type === 'team') { teamAId = ksRuleA.refId; } 
      else {
        if (!ksRuleA.refId) return alert('対戦相手Aのルールを設定してください');
        placeA = JSON.stringify({ ...ksRuleA, label: ksRuleA.type === 'group' ? `${groups.find(g => g.id === ksRuleA.refId)?.name || ''} ${ksRuleA.arg}位` : `試合:${tournamentMatches.find(m=>m.id===ksRuleA.refId)?.court || ''}第${tournamentMatches.find(m=>m.id===ksRuleA.refId)?.match_order || ''} ${ksRuleA.arg === 'winner' ? '勝者' : '敗者'}` });
      }
      
      if (ksRuleB.type === 'team') { teamBId = ksRuleB.refId; } 
      else {
        if (!ksRuleB.refId) return alert('対戦相手Bのルールを設定してください');
        placeB = JSON.stringify({ ...ksRuleB, label: ksRuleB.type === 'group' ? `${groups.find(g => g.id === ksRuleB.refId)?.name || ''} ${ksRuleB.arg}位` : `試合:${tournamentMatches.find(m=>m.id===ksRuleB.refId)?.court || ''}第${tournamentMatches.find(m=>m.id===ksRuleB.refId)?.match_order || ''} ${ksRuleB.arg === 'winner' ? '勝者' : '敗者'}` });
      }
    }

    await supabase.from('matches').insert({
      tournament_id: selectedTId, group_id: formMatch.stage === 'group' ? formMatch.groupId : null, stage: formMatch.stage,
      team_a_id: teamAId, team_b_id: teamBId,
      team_a_placeholder: placeA, team_b_placeholder: placeB, match_date: formMatch.date, start_time: formMatch.time,
      venue: formMatch.venue || masterVenues[0], court: formMatch.court || masterCourts[0], match_order: parseInt(formMatch.order), status: 'scheduled'
    });

    alert('試合をスケジュールに登録しました！');
    setFormMatch(prev => {
      let nextTime = prev.time;
      if (nextTime) {
        let [h, m] = nextTime.split(':').map(Number);
        m += 30; h += 1; if (m >= 60) { h += 1; m -= 60; }
        nextTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }
      return { ...prev, order: (parseInt(prev.order) + 1).toString(), time: nextTime, teamA: '', teamB: '' };
    });
    supabase.from('matches').select('*').eq('tournament_id', selectedTId).order('match_date').order('court').order('match_order').then(({ data: tm }) => { if (tm) setTournamentMatches(tm); });
  };

  const teamsInSelectedGroup = groupTeams.filter(gt => gt.group_id === formMatch.groupId).map(gt => teams.find(t => t.id === gt.team_id)).filter(Boolean);
  const selectedTourney = tournaments.find(t => t.id === selectedTId);

  return (
    <div className="min-h-screen bg-[#f2f4f5] font-sans pb-28">
      <div className="bg-white border-b border-gray-200 sticky top-15 z-40 shadow-sm flex px-2 pt-2">
        <button onClick={() => setActiveTab('general')} className="flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors">一般設定</button>
        <button onClick={() => { if (isAdmin) setActiveTab('admin'); else requireAdmin(() => setActiveTab('admin')); }} className="flex-1 py-3 text-sm font-bold border-b-2 flex items-center justify-center"><ShieldAlert size={16} className="mr-1.5" /> 管理者</button>
      </div>

      <main className="max-w-2xl mx-auto mt-4 px-4">
        {activeTab === 'general' ? (
         <div className="space-y-4 animate-in fade-in">
            {/* 検索・フィルタリングUI */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 space-y-3">
              <div className="flex items-center justify-end mb-1">
                <label className="flex items-center text-xs font-bold text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={showOnlyFavorites} onChange={(e) => setShowOnlyFavorites(e.target.checked)} className="mr-1.5 accent-orange-500" />
                  お気に入りのみ表示
                </label>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input type="text" placeholder="大学名で検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-100 rounded-lg py-2 pl-9 text-sm focus:outline-none" />
              </div>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <Filter size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <select aria-label="大学種別" value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg py-1.5 pl-7 pr-3 text-xs text-gray-700">
                    <option value="すべて">全区分</option>
                    <option value="国立">国立</option>
                    <option value="公立">公立</option>
                    <option value="私立">私立</option>
                  </select>
                </div>
                <div className="flex-1 relative">
                  <MapPin size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <select aria-label="地方" value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg py-1.5 pl-7 pr-3 text-xs text-gray-700">
                    <option value="すべて">全地方</option>
                    <option value="北海道">北海道</option>
                    <option value="東北">東北</option>
                    <option value="関東">関東</option>
                    <option value="甲信越">甲信越</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
              </div>
            </div>

            {/* お気に入りチーム一覧 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-bold text-gray-800 flex items-center"><Star size={18} className="mr-2 text-orange-400" fill="currentColor" /> チーム一覧</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {filteredTeams.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">該当するチームがありません</div>
                ) : (
                  filteredTeams.map(team => (
                    <button key={team.id} onClick={() => toggleFavorite(team.id)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 text-left">
                      <div>
                        <div className="font-bold text-sm text-gray-800">{team.team_name || team.university_name}</div>
                        <div className="text-[10px] text-gray-500">{team.university_name} ・ {team.university_type || '大学'} ・ {getRegion(team.prefecture)}</div>
                      </div>
                      <Star size={20} className={favorites.includes(team.id) ? 'text-orange-400' : 'text-gray-300'} fill={favorites.includes(team.id) ? 'currentColor' : 'none'} />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-10">
            <div className="sticky top-30 z-30 bg-[#f2f4f5] pt-0 pb-1 rounded-2xl">
              <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 w-full max-w-lg ml-2">
                  <span className="text-xs font-bold text-gray-500 shrink-0">対象大会:</span>
                  <select aria-label="操作対象" value={selectedTId} onChange={e => setSelectedTId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-3 text-sm font-bold text-cyan-700">
                    {tournaments.map(t => <option key={t.id} value={t.id}>{t.year}年度 {t.name}</option>)}
                  </select>
                </div>
                <button onClick={() => { logout(); setActiveTab('general'); }} aria-label="ログアウト" className="text-xs font-bold text-gray-400 p-2"><LogOut size={16} /></button>
              </div>
            </div>

            {/* 大学・チームの管理（ロゴ画像アップロード追加） */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div onClick={() => toggleSection('teamManage')} className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100">
                <h2 className="font-bold text-gray-700 flex items-center text-sm"><GraduationCap size={16} className="mr-1.5" /> 大学・チーム情報の登録と編集</h2>
                {collapsed.teamManage ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronUp size={18} className="text-gray-400" />}
              </div>
              {!collapsed.teamManage && (
                <div className="p-4 space-y-4">
                  <div className="relative">
                    <label htmlFor="selectTeam" className="text-[10px] font-bold text-gray-500 block mb-1">既存チームの編集 (新規作成時は未選択)</label>
                    <select id="selectTeam" value={selectedEditTeamId} onChange={e => handleSelectEditTeam(e.target.value)} className="w-full border p-2 rounded text-sm bg-gray-50 font-bold">
                      <option value="">＋ 新規チームを登録する</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label htmlFor="tUniv" className="text-[10px] font-bold text-gray-500 block mb-1">大学名</label><input id="tUniv" type="text" placeholder="例: 山梨大学" value={teamForm.university_name} onChange={e=>setTeamForm({...teamForm, university_name: e.target.value})} className="w-full border rounded p-2 text-sm"/></div>
                    <div><label htmlFor="tName" className="text-[10px] font-bold text-gray-500 block mb-1">チーム名</label><input id="tName" type="text" placeholder="例: 山梨大学B" value={teamForm.team_name} onChange={e=>setTeamForm({...teamForm, team_name: e.target.value})} className="w-full border rounded p-2 text-sm"/></div>
                    <div><label htmlFor="tType" className="text-[10px] font-bold text-gray-500 block mb-1">大学種別</label><select id="tType" value={teamForm.university_type} onChange={e=>setTeamForm({...teamForm, university_type: e.target.value})} className="w-full border rounded p-2 text-sm"><option value="国立">国立</option><option value="公立">公立</option><option value="私立">私立</option></select></div>
                    <div><label htmlFor="tPref" className="text-[10px] font-bold text-gray-500 block mb-1">都道府県</label><input id="tPref" type="text" placeholder="山梨県" value={teamForm.prefecture} onChange={e=>setTeamForm({...teamForm, prefecture: e.target.value})} className="w-full border rounded p-2 text-sm"/></div>
                    <div><label htmlFor="tCity" className="text-[10px] font-bold text-gray-500 block mb-1">市区町村</label><input id="tCity" type="text" placeholder="例: 中央市" value={teamForm.city} onChange={e=>setTeamForm({...teamForm, city: e.target.value})} className="w-full border rounded p-2 text-sm"/></div>
                    {/* ★ ロゴ画像アップロードUI */}
                    <div className="col-span-2">
                      <label htmlFor="logoUploadInput" className="text-[10px] font-bold text-gray-500 block mb-1">ロゴ画像</label>
                      <div className="flex items-center space-x-3">
                        {teamForm.logo_url ? <img src={teamForm.logo_url} alt="Logo" className="w-12 h-12 object-contain border rounded p-1 bg-gray-50" /> : <div className="w-12 h-12 border border-dashed rounded flex items-center justify-center text-gray-300"><UploadCloud size={20}/></div>}
                        <div className="flex-1">
                          <input id="logoUploadInput" aria-label="ロゴ画像をアップロード" title="ロゴ画像をアップロード" type="file" accept="image/*" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" />
                          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo} className="bg-gray-100 border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-200">
                            {uploadingLogo ? 'アップロード中...' : '画像を選択してアップロード'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button onClick={handleSaveTeamForm} className="w-full bg-cyan-600 text-white py-2 rounded font-bold text-sm">{selectedEditTeamId ? 'チーム情報を更新する' : '新チームとして登録する'}</button>
                </div>
              )}
            </div>

            {/* マスター設定 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div onClick={() => toggleSection('master')} className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center cursor-pointer">
                <h2 className="font-bold text-gray-700 flex items-center text-sm"><SettingsIcon size={16} className="mr-1.5" /> 会場・コートのマスター設定</h2>
                {collapsed.master ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronUp size={18} className="text-gray-400" />}
              </div>
              {!collapsed.master && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">登録済みの会場</label>
                    <div className="flex flex-wrap gap-2 mb-2">{masterVenues.map((v, i) => (<span key={i} className="bg-gray-100 text-xs px-3 py-1 rounded-full flex items-center">{v} <button aria-label="削除" onClick={() => setMasterVenues(masterVenues.filter((_, idx)=>idx!==i))} className="ml-2 text-gray-400"><X size={12}/></button></span>))}</div>
                    <div className="flex space-x-2"><input aria-label="新規会場名" type="text" value={newVenueInput} onChange={e=>setNewVenueInput(e.target.value)} className="flex-1 border rounded p-1 text-sm"/><button onClick={()=>{if(newVenueInput){setMasterVenues([...masterVenues, newVenueInput]); setNewVenueInput('');}}} className="bg-cyan-600 text-white px-3 rounded text-xs font-bold">追加</button></div>
                  </div>
                  <div className="border-t pt-3">
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">登録済みのコート</label>
                    <div className="flex flex-wrap gap-2 mb-2">{masterCourts.map((c, i) => (<span key={i} className="bg-gray-100 text-xs px-3 py-1 rounded-full flex items-center">{c} <button aria-label="削除" onClick={() => setMasterCourts(masterCourts.filter((_, idx)=>idx!==i))} className="ml-2 text-gray-400"><X size={12}/></button></span>))}</div>
                    <div className="flex space-x-2"><input aria-label="新規コート名" type="text" value={newCourtInput} onChange={e=>setNewCourtInput(e.target.value)} className="flex-1 border rounded p-1 text-sm"/><button onClick={()=>{if(newCourtInput){setMasterCourts([...masterCourts, newCourtInput]); setNewCourtInput('');}}} className="bg-cyan-600 text-white px-3 rounded text-xs font-bold">追加</button></div>
                  </div>
                  <button onClick={handleSaveSettings} className="w-full bg-gray-800 text-white py-2 rounded text-sm font-bold mt-2">設定を保存</button>
                </div>
              )}
            </div>

            {/* チーム分け */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div onClick={() => toggleSection('assign')} className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center cursor-pointer">
                <h2 className="font-bold text-gray-700 flex items-center text-sm"><Users size={16} className="mr-1.5" /> 参加チームのグループ分け</h2>
                {collapsed.assign ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronUp size={18} className="text-gray-400" />}
              </div>
              {!collapsed.assign && (
                <div className="p-4 flex space-x-2">
                  <select aria-label="チーム" value={assignTeam} onChange={e => setAssignTeam(e.target.value)} className="flex-1 border rounded p-2 text-sm"><option value="">チームを選択...</option>{teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}</select>
                  <select aria-label="グループ" value={assignGroup} onChange={e => setAssignGroup(e.target.value)} className="w-32 border rounded p-2 text-sm"><option value="">グループ</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                  <button onClick={handleAssignTeam} className="bg-cyan-600 text-white px-4 rounded text-sm font-bold">登録</button>
                </div>
              )}
            </div>

            {/* 試合登録（チーム直接指定の追加） */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
              <div onClick={() => toggleSection('match')} className="px-5 py-3 border-b border-orange-100 bg-orange-50/50 flex justify-between items-center cursor-pointer">
                <h2 className="font-bold text-orange-800 flex items-center text-sm"><CalendarPlus size={16} className="mr-1.5" /> 試合スケジュールの登録</h2>
                {collapsed.match ? <ChevronDown size={18} className="text-orange-400" /> : <ChevronUp size={18} className="text-orange-400" />}
              </div>
              {!collapsed.match && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-4">
                    <div><label htmlFor="mDate" className="text-[10px] font-bold text-gray-500 block mb-1">日付</label><input id="mDate" type="date" value={formMatch.date} onChange={e => setFormMatch({...formMatch, date: e.target.value})} className="w-full border rounded-lg p-2 text-sm" /></div>
                    <div><label htmlFor="mTime" className="text-[10px] font-bold text-gray-500 block mb-1">開始時刻</label><select id="mTime" value={formMatch.time} onChange={e => setFormMatch({...formMatch, time: e.target.value})} className="w-full border rounded-lg p-2 text-sm"><option value="">未定</option>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label htmlFor="mVenue" className="text-[10px] font-bold text-gray-500 block mb-1">会場</label><select id="mVenue" value={formMatch.venue} onChange={e => setFormMatch({...formMatch, venue: e.target.value})} className="w-full border rounded-lg p-2 text-sm">{masterVenues.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                    <div><label htmlFor="mCourt" className="text-[10px] font-bold text-gray-500 block mb-1">コート</label><select id="mCourt" value={formMatch.court} onChange={e => setFormMatch({...formMatch, court: e.target.value})} className="w-full border rounded-lg p-2 text-sm">{masterCourts.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="col-span-2"><label htmlFor="mOrder" className="text-[10px] font-bold text-gray-500 block mb-1">試合順</label><select id="mOrder" value={formMatch.order} onChange={e => setFormMatch({...formMatch, order: e.target.value})} className="w-full border rounded-lg p-2 text-sm">{Array.from({length: 10}, (_, i) => i + 1).map(o => <option key={o} value={o}>第{o}試合</option>)}</select></div>
                  </div>

                  <div className="pt-2">
                    <div className="flex space-x-4 mb-4">
                      <label className="flex items-center text-sm font-bold text-gray-700 cursor-pointer"><input type="radio" name="stage" value="group" checked={formMatch.stage === 'group'} onChange={() => setFormMatch({...formMatch, stage: 'group'})} className="mr-2 accent-orange-500" /> グループ</label>
                      <label className="flex items-center text-sm font-bold text-gray-700 cursor-pointer"><input type="radio" name="stage" value="knockout" checked={formMatch.stage === 'knockout'} onChange={() => setFormMatch({...formMatch, stage: 'knockout'})} className="mr-2 accent-orange-500" /> ノックアウト・単発</label>
                    </div>

                    {formMatch.stage === 'group' ? (
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                        <select aria-label="グループ" value={formMatch.groupId} onChange={e => setFormMatch({...formMatch, groupId: e.target.value, teamA: '', teamB: ''})} className="w-full border p-2 rounded-lg text-sm font-bold text-cyan-700"><option value="">グループを選択</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                        <div className="flex items-center space-x-2">
                          <select aria-label="Team A" value={formMatch.teamA} onChange={e => setFormMatch({...formMatch, teamA: e.target.value})} className="flex-1 border p-2 rounded text-sm"><option value="" disabled>Team A</option>{teamsInSelectedGroup.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}</select>
                          <span className="text-[10px] font-bold text-gray-400">VS</span>
                          <select aria-label="Team B" value={formMatch.teamB} onChange={e => setFormMatch({...formMatch, teamB: e.target.value})} className="flex-1 border p-2 rounded text-sm"><option value="" disabled>Team B</option>{teamsInSelectedGroup.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}</select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <label className="text-xs font-bold text-gray-600 block mb-2">対戦相手 A</label>
                          <div className="flex space-x-2">
                            <select aria-label="Aのタイプ" value={ksRuleA.type} onChange={e=>setKsRuleA({...ksRuleA, type: e.target.value, arg: e.target.value === 'group' ? '1' : e.target.value === 'team' ? 'direct' : 'winner', refId: ''})} className="border p-2 rounded text-sm"><option value="team">チーム直接指定</option><option value="group">グループ順位</option><option value="match">試合の勝敗</option></select>
                            {ksRuleA.type === 'team' ? (
                              <select aria-label="Aのチーム" value={ksRuleA.refId} onChange={e=>setKsRuleA({...ksRuleA, refId: e.target.value})} className="border p-2 rounded text-sm flex-1"><option value="">チーム...</option>{teams.map(t=><option key={t.id} value={t.id}>{t.team_name}</option>)}</select>
                            ) : ksRuleA.type === 'group' ? (
                              <><select aria-label="Aのグループ" value={ksRuleA.refId} onChange={e=>setKsRuleA({...ksRuleA, refId: e.target.value})} className="border p-2 rounded text-sm flex-1"><option value="">グループ...</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><select aria-label="Aの順位" value={ksRuleA.arg} onChange={e=>setKsRuleA({...ksRuleA, arg: e.target.value})} className="border p-2 rounded text-sm w-16"><option value="1">1位</option><option value="2">2位</option><option value="3">3位</option></select></>
                            ) : (
                              <><select aria-label="Aの試合" value={ksRuleA.refId} onChange={e=>setKsRuleA({...ksRuleA, refId: e.target.value})} className="border p-2 rounded text-sm flex-1"><option value="">試合...</option>{tournamentMatches.map(m=><option key={m.id} value={m.id}>{m.match_date} {m.court} 第{m.match_order}試合</option>)}</select><select aria-label="Aの勝敗" value={ksRuleA.arg} onChange={e=>setKsRuleA({...ksRuleA, arg: e.target.value})} className="border p-2 rounded text-sm w-20"><option value="winner">勝者</option><option value="loser">敗者</option></select></>
                            )}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <label className="text-xs font-bold text-gray-600 block mb-2">対戦相手 B</label>
                          <div className="flex space-x-2">
                            <select aria-label="Bのタイプ" value={ksRuleB.type} onChange={e=>setKsRuleB({...ksRuleB, type: e.target.value, arg: e.target.value === 'group' ? '1' : e.target.value === 'team' ? 'direct' : 'winner', refId: ''})} className="border p-2 rounded text-sm"><option value="team">チーム直接指定</option><option value="group">グループ順位</option><option value="match">試合の勝敗</option></select>
                            {ksRuleB.type === 'team' ? (
                              <select aria-label="Bのチーム" value={ksRuleB.refId} onChange={e=>setKsRuleB({...ksRuleB, refId: e.target.value})} className="border p-2 rounded text-sm flex-1"><option value="">チーム...</option>{teams.map(t=><option key={t.id} value={t.id}>{t.team_name}</option>)}</select>
                            ) : ksRuleB.type === 'group' ? (
                              <><select aria-label="Bのグループ" value={ksRuleB.refId} onChange={e=>setKsRuleB({...ksRuleB, refId: e.target.value})} className="border p-2 rounded text-sm flex-1"><option value="">グループ...</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><select aria-label="Bの順位" value={ksRuleB.arg} onChange={e=>setKsRuleB({...ksRuleB, arg: e.target.value})} className="border p-2 rounded text-sm w-16"><option value="1">1位</option><option value="2">2位</option><option value="3">3位</option></select></>
                            ) : (
                              <><select aria-label="Bの試合" value={ksRuleB.refId} onChange={e=>setKsRuleB({...ksRuleB, refId: e.target.value})} className="border p-2 rounded text-sm flex-1"><option value="">試合...</option>{tournamentMatches.map(m=><option key={m.id} value={m.id}>{m.match_date} {m.court} 第{m.match_order}試合</option>)}</select><select aria-label="Bの勝敗" value={ksRuleB.arg} onChange={e=>setKsRuleB({...ksRuleB, arg: e.target.value})} className="border p-2 rounded text-sm w-20"><option value="winner">勝者</option><option value="loser">敗者</option></select></>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={handleSaveMatch} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg shadow-sm mt-4">この試合を登録する</button>
                </div>
              )}
            </div>

            {/* ★ 大会タイプの選択とグループ数設定 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden opacity-80">
              <div onClick={() => toggleSection('create')} className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center cursor-pointer">
                <h2 className="font-bold text-gray-700 flex items-center text-sm"><PlusCircle size={16} className="mr-1.5" /> 新しい大会を作成</h2>
                {collapsed.create ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronUp size={18} className="text-gray-400" />}
              </div>
              {!collapsed.create && (
                <div className="p-4 space-y-4">
                  <div className="flex space-x-2">
                    <input aria-label="大会名" type="text" value={newTourneyName} onChange={e => setNewTourneyName(e.target.value)} placeholder="例: 第70回 東医体" className="flex-1 border border-gray-300 rounded-lg py-2 px-3 text-sm" />
                    <input aria-label="開催年" type="number" value={newTourneyYear} onChange={e => setNewTourneyYear(Number(e.target.value))} className="w-20 border border-gray-300 rounded-lg py-2 px-3 text-sm" />
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">大会の形式</label>
                    <select aria-label="大会タイプ" value={tourneyType} onChange={e => {
                      const v = e.target.value;
                      setTourneyType(v);
                      if (v === '1') setGroupCount(0);
                      if (v === '2') setGroupCount(8);
                      if (v === '3') setGroupCount(1);
                    }} className="w-full border rounded p-2 text-sm mb-2">
                      <option value="1">Type 1: トーナメント・単発試合のみ</option>
                      <option value="2">Type 2: グループリーグ ＋ トーナメント</option>
                      <option value="3">Type 3: グループリーグのみ</option>
                    </select>
                    {tourneyType !== '1' && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-600">生成するグループ数:</span>
                        <input aria-label="グループ数" type="number" min="1" max="26" value={groupCount} onChange={e => setGroupCount(Number(e.target.value))} className="w-16 border rounded p-1 text-sm text-center" />
                      </div>
                    )}
                  </div>
                  <button onClick={handleCreateTournament} className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm font-bold">大会を作成</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}