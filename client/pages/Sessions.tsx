import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit, Calendar, MapPin, X, WifiOff } from 'lucide-react';
import SessionForm5W from '../components/SessionForm5W';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { getCachedSessions, getSessionsLastSyncedAt, hasAnyOfflineAccess, type CachedSession } from '../lib/offline';

type Session = CachedSession;

export default function Sessions() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isShowingOfflineData, setIsShowingOfflineData] = useState(false);
  const [offlineSyncedAt, setOfflineSyncedAt] = useState<Date | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setIsLoading(true);
        console.log('[DEBUG] Fetching sessions from Supabase...');
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: false });

        console.log('[DEBUG] Sessions response - data:', data, 'error:', error);

        if (error) {
          console.error('[ERROR] Supabase error:', error.message, error.code);
          throw error;
        }

        console.log('[DEBUG] Sessions loaded:', data?.length || 0, 'items');
        setSessions(data || []);
        setIsShowingOfflineData(false);
        setOfflineNotice(null);
      } catch (error) {
        console.error('[ERROR] Failed to fetch sessions:', error);

        // Offline fallback, same access-agnostic pattern as
        // Members.tsx: works whether this device has personal device
        // trust or the shared team passphrase. Per the v2.0 strategy,
        // only the sessions relevant to the device's 10-day trust
        // window were ever cached (see client/lib/offline/sessionsCache.ts) —
        // this is intentionally NOT the full session history.
        const trusted = await hasAnyOfflineAccess();

        if (!trusted) {
          setSessions([]);
          setIsLoading(false);
          return;
        }

        const cached = await getCachedSessions();
        const lastSynced = await getSessionsLastSyncedAt();
        setSessions(cached);
        setIsShowingOfflineData(true);
        setOfflineSyncedAt(lastSynced);
        setOfflineNotice(
          cached.length === 0
            ? "Aucune séance en cache pour la période en cours. Elles seront disponibles après une prochaine connexion."
            : null,
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('sessions_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSessions((prev) => [payload.new as Session, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSessions((prev) =>
              prev.map((s) => (s.id === payload.new.id ? (payload.new as Session) : s))
            );
          } else if (payload.eventType === 'DELETE') {
            setSessions((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const filteredSessions = sessions.filter(
    (session) =>
      (session.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.target_audience || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSessionStatus = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 7) return { text: 'Récente', color: 'bg-green-100 text-green-700' };
    if (diffDays < 30) return { text: 'En cours', color: 'bg-blue-100 text-blue-700' };
    return { text: 'Archivée', color: 'bg-gray-100 text-gray-700' };
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} userName="Chef Principal" />

      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 container mx-auto px-4 py-8">
          {isShowingOfflineData && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <WifiOff className="text-amber-600 flex-shrink-0" size={20} />
              <p className="text-sm text-amber-800">
                Mode hors ligne — séances de la période en cours uniquement
                {offlineSyncedAt ? `, synchronisées le ${offlineSyncedAt.toLocaleString('fr-FR')}` : ''}.
                L'ajout et l'historique complet nécessitent une connexion.
              </p>
            </div>
          )}
          {offlineNotice && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm">{offlineNotice}</p>
            </div>
          )}

          {showForm && !isShowingOfflineData && (
            <div className="mb-8 bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Ajouter une Séance (5W)</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              <SessionForm5W
                onSuccess={() => {
                  setShowForm(false);
                  // Refresh the sessions list
                  const fetchSessions = async () => {
                    const { data } = await supabase
                      .from('sessions')
                      .select('*')
                      .order('created_at', { ascending: false });
                    setSessions(data || []);
                  };
                  fetchSessions();
                }}
              />
            </div>
          )}

          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="section-title">Séances Organisées</h1>
              <p className="text-gray-600">
                {filteredSessions.length} séance{filteredSessions.length !== 1 ? 's' : ''} au total
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              disabled={isShowingOfflineData}
              title={isShowingOfflineData ? 'Nécessite une connexion Internet' : undefined}
              className="bg-gradient-to-r from-shm-red to-shm-purple text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <Plus size={20} />
              {showForm ? 'Masquer le formulaire' : 'Programmer une Séance'}
            </button>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher par titre, lieu ou responsable..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red"></div>
              <p className="ml-2 text-gray-600">Chargement des séances...</p>
            </div>
          )}

          {/* Sessions List */}
          {!isLoading && (
            <div className="space-y-4">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => {
                  const status = getSessionStatus(session.created_at);
                  return (
                    <div
                      key={session.id}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {session.title || 'Séance sans titre'}
                            </h3>
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${status.color}`}>
                              {status.text}
                            </span>
                          </div>
                          {(session.objective || session.methodology) && (
                            <p className="text-gray-600 text-sm mb-3">
                              {session.objective || session.methodology}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar size={16} className="text-shm-red" />
                              <span>{formatDate(session.date_time || session.created_at)}</span>
                            </div>
                            {session.location && (
                              <div className="flex items-center gap-1">
                                <MapPin size={16} className="text-shm-red" />
                                <span>{session.location}</span>
                              </div>
                            )}
                            {session.target_audience && (
                              <div className="text-gray-600">
                                Public: <strong>{session.target_audience}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                        <button
                          disabled={isShowingOfflineData}
                          title={isShowingOfflineData ? 'Nécessite une connexion Internet' : undefined}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          disabled={isShowingOfflineData}
                          title={isShowingOfflineData ? 'Nécessite une connexion Internet' : undefined}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-lg shadow-md px-6 py-12 text-center">
                  <p className="text-gray-500 text-sm">
                    {searchTerm ? 'Aucune séance ne correspond à votre recherche' : 'Aucune séance enregistrée'}
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
