// src/App.tsx

import React, { useState, useEffect } from 'react';
import { api, ApiError } from './lib/api';
import type { User, Shipment, DashboardStats } from './types';

// Icons
import {
  Loader2, Ship, Package, Clock, CheckCircle2, AlertCircle,
  Plus, Search, ChevronRight, Wallet, User as UserIcon,
  LogOut, LayoutDashboard, PlusCircle, Calculator, Settings,
  Menu, X, Bell, Building2, Eye, EyeOff, Mail, Lock, ArrowLeft
} from 'lucide-react';

type View = 'dashboard' | 'create' | 'detail' | 'settings';
type AuthScreen = 'welcome' | 'login' | 'register' | 'verify';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('welcome');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get<{ user: User }>('/auth/me');
      if (response.data?.user) {
        setUser(response.data.user);
      }
    } catch {
      // Not authenticated
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setAuthScreen('welcome');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthContainer
        screen={authScreen}
        onScreenChange={setAuthScreen}
        onLoginSuccess={(user) => setUser(user)}
        pendingEmail={pendingEmail}
        setPendingEmail={setPendingEmail}
      />
    );
  }

  return (
    <AppContainer
      user={user}
      currentView={currentView}
      selectedShipmentId={selectedShipmentId}
      onNavigate={setCurrentView}
      onViewShipment={(id) => { setSelectedShipmentId(id); setCurrentView('detail'); }}
      onLogout={handleLogout}
    />
  );
}

// ============================================
// AUTH CONTAINER
// ============================================

interface AuthContainerProps {
  screen: AuthScreen;
  onScreenChange: (screen: AuthScreen) => void;
  onLoginSuccess: (user: User) => void;
  pendingEmail: string;
  setPendingEmail: (email: string) => void;
}

function AuthContainer({ screen, onScreenChange, onLoginSuccess, pendingEmail, setPendingEmail }: AuthContainerProps) {
  if (screen === 'welcome') {
    return <WelcomeScreen onLogin={() => onScreenChange('login')} onRegister={() => onScreenChange('register')} />;
  }
  if (screen === 'login') {
    return (
      <LoginScreen
        onSuccess={onLoginSuccess}
        onRegister={() => onScreenChange('register')}
        onNeedsVerification={(email) => { setPendingEmail(email); onScreenChange('verify'); }}
      />
    );
  }
  if (screen === 'register') {
    return (
      <RegisterScreen
        onSuccess={(email) => { setPendingEmail(email); onScreenChange('verify'); }}
        onLogin={() => onScreenChange('login')}
      />
    );
  }
  if (screen === 'verify') {
    return (
      <VerifyScreen
        email={pendingEmail}
        onSuccess={onLoginSuccess}
        onBack={() => onScreenChange('login')}
      />
    );
  }
  return null;
}

// ============================================
// WELCOME SCREEN
// ============================================

function WelcomeScreen({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
        <span className="text-white text-3xl font-bold">⚡</span>
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">E-Trans</h1>
      <p className="text-slate-400 mb-8">Transit & Dédouanement</p>
      
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={onRegister}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl"
        >
          Créer mon entreprise
        </button>
        <button
          onClick={onLogin}
          className="w-full py-3 bg-slate-800 text-white font-medium rounded-xl border border-slate-700"
        >
          J'ai déjà un compte
        </button>
      </div>
      
      <p className="text-slate-500 text-xs mt-8">© 2026 E-Trans v3.0.0</p>
    </div>
  );
}

// ============================================
// LOGIN SCREEN
// ============================================

interface LoginScreenProps {
  onSuccess: (user: User) => void;
  onRegister: () => void;
  onNeedsVerification: (email: string) => void;
}

function LoginScreen({ onSuccess, onRegister, onNeedsVerification }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post<{ user: User }>('/auth/login', { email, password });
      if (response.data?.user) {
        onSuccess(response.data.user);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          onNeedsVerification(email);
        } else {
          setError(err.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mb-6">
        <span className="text-white text-2xl font-bold">⚡</span>
      </div>
      
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-lg">
        <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Connexion</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-10 pr-12 py-2.5"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Pas encore de compte ?{' '}
          <button onClick={onRegister} className="text-blue-600 font-medium">S'inscrire</button>
        </p>
      </div>
    </div>
  );
}

// ============================================
// REGISTER SCREEN
// ============================================

interface RegisterScreenProps {
  onSuccess: (email: string) => void;
  onLogin: () => void;
}

function RegisterScreen({ onSuccess, onLogin }: RegisterScreenProps) {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (companyName.length < 2) {
        setError('Nom entreprise requis');
        return;
      }
      setStep(2);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/register', { companyName, name, email, password });
      onSuccess(email);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          {step > 1 && (
            <button onClick={() => setStep(1)} className="p-1">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
          )}
          <h2 className="text-xl font-bold text-slate-900">
            {step === 1 ? 'Créer votre entreprise' : 'Votre compte'}
          </h2>
        </div>
        
        {/* Progress */}
        <div className="h-1 bg-slate-100 rounded-full mb-6">
          <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: step === 1 ? '50%' : '100%' }} />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 ? (
            <div>
              <label className="block text-sm text-slate-600 mb-1">Nom de l'entreprise</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: EMERGENCE TRANSIT"
                  className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5"
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Nom complet</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Mot de passe (min 8 caractères)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
                  required
                  minLength={8}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : step === 1 ? 'Continuer' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Déjà un compte ?{' '}
          <button onClick={onLogin} className="text-blue-600 font-medium">Se connecter</button>
        </p>
      </div>
    </div>
  );
}

// ============================================
// VERIFY SCREEN
// ============================================

interface VerifyScreenProps {
  email: string;
  onSuccess: (user: User) => void;
  onBack: () => void;
}

function VerifyScreen({ email, onSuccess, onBack }: VerifyScreenProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (code.length !== 6) return;
    
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post<{ user: User }>('/auth/verify-email', { email, code });
      if (response.data?.user) {
        onSuccess(response.data.user);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-lg text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="text-blue-600" size={28} />
        </div>
        
        <h2 className="text-xl font-bold text-slate-900 mb-2">Vérifiez votre email</h2>
        <p className="text-slate-500 text-sm mb-6">
          Entrez le code à 6 chiffres envoyé à<br />
          <strong>{email}</strong>
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full text-center text-2xl font-mono tracking-widest border border-slate-300 rounded-lg py-3 mb-4"
          maxLength={6}
        />

        <button
          onClick={handleVerify}
          disabled={isLoading || code.length !== 6}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Vérifier'}
        </button>

        <button onClick={onBack} className="mt-4 text-sm text-slate-500">
          Retour à la connexion
        </button>
      </div>
    </div>
  );
}

// ============================================
// APP CONTAINER
// ============================================

interface AppContainerProps {
  user: User;
  currentView: View;
  selectedShipmentId: string | null;
  onNavigate: (view: View) => void;
  onViewShipment: (id: string) => void;
  onLogout: () => void;
}

function AppContainer({ user, currentView, selectedShipmentId, onNavigate, onViewShipment, onLogout }: AppContainerProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">⚡</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-semibold text-slate-900">E-Trans</span>
              <span className="text-slate-400 text-sm ml-2">{user.company.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-slate-100">
              <Bell size={20} className="text-slate-600" />
            </button>
            <div className="relative">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium"
              >
                {user.name.charAt(0)}
              </button>
              
              {mobileMenuOpen && (
                <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <button
                    onClick={() => { onNavigate('settings'); setMobileMenuOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Paramètres
                  </button>
                  <button
                    onClick={onLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pb-20 md:pb-6">
        {currentView === 'dashboard' && (
          <Dashboard onViewShipment={onViewShipment} onCreateShipment={() => onNavigate('create')} />
        )}
        {currentView === 'create' && (
          <CreateForm onSuccess={() => onNavigate('dashboard')} onCancel={() => onNavigate('dashboard')} />
        )}
        {currentView === 'settings' && (
          <SettingsScreen user={user} onLogout={onLogout} onBack={() => onNavigate('dashboard')} />
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden safe-bottom">
        <div className="flex">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Accueil' },
            { id: 'create', icon: PlusCircle, label: 'Nouveau' },
            { id: 'settings', icon: Settings, label: 'Paramètres' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as View)}
              className={`flex-1 flex flex-col items-center py-2 ${
                currentView === item.id ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <item.icon size={20} />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ============================================
// DASHBOARD
// ============================================

interface DashboardProps {
  onViewShipment: (id: string) => void;
  onCreateShipment: () => void;
}

function Dashboard({ onViewShipment, onCreateShipment }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, shipmentsRes] = await Promise.all([
        api.get<{ stats: DashboardStats }>('/shipments/stats'),
        api.get<{ shipments: Shipment[] }>('/shipments?limit=10'),
      ]);
      
      if (statsRes.data?.stats) setStats(statsRes.data.stats);
      if (shipmentsRes.data?.shipments) setShipments(shipmentsRes.data.shipments);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (n: number) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}Md`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return n.toString();
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
              <div className="h-8 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-sm text-slate-500">Vue d'ensemble</p>
        </div>
        <button
          onClick={onCreateShipment}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Nouveau dossier</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Ship size={20} />} label="En cours" value={stats?.shipments.inProgress || 0} color="blue" />
        <StatCard icon={<Clock size={20} />} label="En attente" value={stats?.shipments.pending || 0} color="amber" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Livrés" value={stats?.shipments.delivered || 0} color="green" />
        <StatCard icon={<Wallet size={20} />} label="Solde" value={`${formatAmount(stats?.finance.balance || 0)}`} color="violet" sub="GNF" />
      </div>

      {/* Recent Shipments */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Dossiers récents</h2>
        </div>

        {shipments.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="mx-auto text-slate-300 mb-3" size={48} />
            <p className="text-slate-500">Aucun dossier</p>
            <button onClick={onCreateShipment} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              Créer le premier
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {shipments.map((s) => (
              <button
                key={s.id}
                onClick={() => onViewShipment(s.id)}
                className="w-full p-4 hover:bg-slate-50 text-left flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{s.clientName}</p>
                  <p className="text-sm text-slate-500 font-mono">{s.trackingNumber}</p>
                  <p className="text-sm text-slate-600">{s.description}</p>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    green: 'bg-green-100 text-green-600',
    violet: 'bg-violet-100 text-violet-600',
  };
  
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ============================================
// CREATE FORM (Simplified)
// ============================================

interface CreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function CreateForm({ onSuccess, onCancel }: CreateFormProps) {
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !description.trim()) {
      setError('Client et description requis');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await api.post('/shipments', { clientName, description, blNumber: blNumber || undefined });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Nouveau dossier</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 border border-slate-200 space-y-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Nom du client *</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Ex: SOGECO SARL"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Description marchandise *</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: OIGNONS"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">N° BL</label>
          <input
            type="text"
            value={blNumber}
            onChange={(e) => setBlNumber(e.target.value)}
            placeholder="Ex: MEDU09243710"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// SETTINGS SCREEN
// ============================================

interface SettingsScreenProps {
  user: User;
  onLogout: () => void;
  onBack: () => void;
}

function SettingsScreen({ user, onLogout, onBack }: SettingsScreenProps) {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Paramètres</h1>
      </div>

      {/* User Card */}
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">{user.name}</h2>
            <p className="text-sm text-slate-500">{user.email}</p>
            <p className="text-xs text-slate-400">{user.company.name}</p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full p-4 bg-white rounded-xl border border-red-200 text-red-600 flex items-center justify-center gap-2"
      >
        <LogOut size={20} />
        <span className="font-medium">Déconnexion</span>
      </button>

      <p className="text-center text-xs text-slate-400 py-4">E-Trans v3.0.0</p>
    </div>
  );
}
