'use client';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Lock } from 'lucide-react';

export default function LoginModal() {
  const { showLogin, setShowLogin, login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (!showLogin) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      setPassword('');
      setError(false);
    } else {
      setError(true);
    }
  };

  const closeModal = () => {
    setShowLogin(false);
    setPassword('');
    setError(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
        <div className="bg-cyan-600 p-4 text-white flex justify-between items-center">
          <div className="flex items-center font-bold">
            <Lock size={18} className="mr-2" /> 管理者ログイン
          </div>
          <button onClick={closeModal} aria-label="閉じる" className="text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            試合情報やスコアを編集するには、運営者用パスワードを入力してください。
          </p>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              className={`w-full border py-2.5 px-3 rounded-lg text-sm focus:ring-2 focus:outline-none ${error ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-cyan-500'}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-1.5 font-bold">パスワードが間違っています。</p>}
          </div>
          <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2.5 rounded-lg transition-colors">
            ログインして続行
          </button>
        </form>
      </div>
    </div>
  );
}