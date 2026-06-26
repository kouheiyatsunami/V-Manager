'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Search, Users, Trophy, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  
  useEffect(() => {
    if (!isOpen) return;
    // 検索用マスターデータを先行取得
    supabase.from('teams').select('*').then(({ data }) => data && setTeams(data));
    supabase.from('tournaments').select('*').then(({ data }) => data && setTournaments(data));
    supabase.from('match_details').select('*').then(({ data }) => data && setMatches(data));
  }, [isOpen]);

  if (!isOpen) return null;

  // 横断フィルタリングロジック
  const filteredTeams = query ? teams.filter(t => t.team_name?.includes(query) || t.university_name?.includes(query)) : [];
  const filteredTournaments = query ? tournaments.filter(t => t.name?.includes(query)) : [];
  const filteredMatches = query ? matches.filter(m => 
    m.team_a_name?.includes(query) || 
    m.team_b_name?.includes(query) || 
    m.tournament_name?.includes(query) ||
    m.venue?.includes(query)
  ) : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b flex items-center space-x-3">
          <Search size={20} className="text-gray-400 shrink-0" />
          <input 
            type="text" 
            autoFocus
            placeholder="チーム名、大学名、大会名、試合を検索..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full text-sm focus:outline-none text-gray-800"
          />
          <button type="button" onClick={onClose} aria-label="閉じる" title="閉じる" className="p-1 text-gray-400 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          {!query && <div className="text-center py-8 text-xs text-gray-400 font-medium">キーワードを入力してください</div>}
          
          {query && filteredTeams.length === 0 && filteredTournaments.length === 0 && filteredMatches.length === 0 && (
            <div className="text-center py-8 text-xs text-gray-400 font-medium">該当する結果が見つかりません</div>
          )}

          {/* チーム結果 */}
          {filteredTeams.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-400 px-2 mb-1 flex items-center uppercase tracking-wider"><Users size={12} className="mr-1"/> チーム ({filteredTeams.length})</div>
              <div className="space-y-1">
                {filteredTeams.map(t => (
                  <Link href={`/team/${t.id}`} key={t.id} onClick={onClose} className="flex items-center p-2 rounded-lg hover:bg-gray-50 text-sm font-bold text-gray-800">
                    {t.logo_url && <img src={t.logo_url} alt="" className="w-5 h-5 rounded-full object-contain bg-white border mr-2"/>}
                    {t.team_name} <span className="text-[10px] text-gray-400 font-normal ml-2">({t.university_name})</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 大会結果 */}
          {filteredTournaments.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-400 px-2 mb-1 flex items-center uppercase tracking-wider"><Trophy size={12} className="mr-1"/> 大会 ({filteredTournaments.length})</div>
              <div className="space-y-1">
                {filteredTournaments.map(t => (
                  <div key={t.id} className="p-2 rounded-lg hover:bg-gray-50 text-sm font-bold text-gray-800 flex justify-between items-center">
                    <span>{t.year}年度 {t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 試合結果 */}
          {filteredMatches.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-400 px-2 mb-1 flex items-center uppercase tracking-wider"><Calendar size={12} className="mr-1"/> 試合・対戦カード ({filteredMatches.length})</div>
              <div className="space-y-1">
                {filteredMatches.map(m => (
                  <Link href={`/match/${m.id}`} key={m.id} onClick={onClose} className="block p-2 rounded-lg hover:bg-gray-50 text-xs border border-gray-100">
                    <div className="text-[9px] text-gray-400 font-medium mb-1">{m.tournament_name} ・ {m.match_date}</div>
                    <div className="flex justify-between items-center font-bold text-gray-800 text-sm">
                      <span>{m.team_a_name} vs {m.team_b_name}</span>
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                        {m.status === 'finished' ? `${m.team_a_sets}-${m.team_b_sets}` : m.start_time || '予定'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}