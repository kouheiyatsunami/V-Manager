'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAdmin: boolean;
  showLogin: boolean;
  setShowLogin: (show: boolean) => void;
  login: (password: string) => boolean;
  logout: () => void;
  requireAdmin: (callback: () => void) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // 起動時にローカルストレージを確認（1日間の有効期限チェック）
  useEffect(() => {
    const stored = localStorage.getItem('admin_auth');
    if (stored) {
      const { expires } = JSON.parse(stored);
      if (new Date().getTime() < expires) {
        setIsAdmin(true);
      } else {
        localStorage.removeItem('admin_auth'); // 期限切れ
      }
    }
  }, []);

  const login = (password: string) => {
    if (password === 'ADMIN1234') {
      // 1日後（24時間後）の時間を計算して保存
      const expires = new Date().getTime() + 24 * 60 * 60 * 1000;
      localStorage.setItem('admin_auth', JSON.stringify({ expires }));
      setIsAdmin(true);
      setShowLogin(false);
      
      // ログイン前にやろうとしていた操作（編集ボタンを押す等）があれば、自動で実行する
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('admin_auth');
    setIsAdmin(false);
  };

  // 「管理者権限が必要なアクション」をラップする関数
  // ログインしていればそのまま実行、していなければモーダルを表示
  const requireAdmin = (action: () => void) => {
    if (isAdmin) {
      action();
    } else {
      setPendingAction(() => action);
      setShowLogin(true);
    }
  };

  return (
    <AuthContext.Provider value={{ isAdmin, showLogin, setShowLogin, login, logout, requireAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);