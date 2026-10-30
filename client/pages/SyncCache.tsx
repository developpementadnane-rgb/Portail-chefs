import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, UploadCloud, CheckCircle2, Clock, WifiOff } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { getQueueLength, flushQueue, type FlushSummary } from '../lib/offline/syncQueue';
import { getCachedMembers, getMembersLastSyncedAt, downloadMembersForOffline } from '../lib/offline/membersCache';
import { getCachedSessions, getSessionsLastSyncedAt, downloadRelevantSessionsForOffline } from '../lib/offline/sessionsCache';

/**
 * "Espace de stockage" -- lets a chef (or a team-passphrase device in
 * the field) see what's saved locally and what's still waiting to
 * reach the server, plus force a sync manually as a fallback when the
 * automatic reconnect sync (OfflineSyncProvider.tsx) hasn't yet fired
 * for any reason. Reads the SAME local IndexedDB store the rest of
 * the offline system already writes to (client/lib/offline/*).
 */
export default function SyncCache() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [membersSyncedAt, setMembersSyncedAt] = useState<Date | null>(null);
  const [sessionsSyncedAt, setSessionsSyncedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<FlushSummary | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queue, members, sessions, membersSync, sessionsSync] = await Promise.all([
        getQueueLength(),
        getCachedMembers(),
        getCachedSessions(),
        getMembersLastSyncedAt(),
        getSessionsLastSyncedAt(),
      ]);
      setQueueLength(queue);
      setMemberCount(members.length);
      setSessionCount(sessions.length);
      setMembersSyncedAt(membersSync);
      setSessionsSyncedAt(sessionsSync);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [load]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await flushQueue();
      setLastResult(result);
    } finally {
      setSyncing(false);
      await load();
    }
  };

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // "Actualiser" above only re-reads what's already in IndexedDB --
  // it can't fix an empty/stale cache by itself. This button forces
  // a fresh download from the server, same calls runInitialSync
  // makes at login (see orchestrator.ts), useful as a manual retry
  // when that hasn't happened yet for any reason.
  const handleDownloadNow = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const [members, sessions] = await Promise.all([
        downloadMembersForOffline(),
        downloadRelevantSessionsForOffline(),
      ]);
      if (members.error || sessions.error) {
        setDownloadError(members.error || sessions.error);
      }
    } finally {
      setDownloading(false);
      await load();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="section-title">Espace de stockage</h1>
              <span
                className={`inline-flex items-center gap-1.5 mt-1 rounded-full px-3 py-1 text-xs font-bold ${
                  isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isOnline ? 'Connecté' : 'Hors ligne'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Actualiser
              </button>
              <button
                onClick={handleDownloadNow}
                disabled={downloading || !isOnline}
                title={!isOnline ? 'Connexion requise pour télécharger' : undefined}
                className="flex items-center gap-2 bg-shm-red text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UploadCloud size={16} className={downloading ? 'animate-pulse' : ''} />
                {downloading ? 'Téléchargement...' : 'Télécharger membres/séances'}
              </button>
            </div>
          </div>

          {downloadError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium">{downloadError}</p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">Présences en attente d'envoi</h2>
                <p className="text-sm text-gray-500">
                  {queueLength === 0
                    ? 'Tout est synchronisé.'
                    : `${queueLength} présence${queueLength > 1 ? 's' : ''} enregistrée${queueLength > 1 ? 's' : ''} localement, pas encore envoyée${queueLength > 1 ? 's' : ''}.`}
                </p>
              </div>
              {queueLength === 0 ? (
                <CheckCircle2 className="text-emerald-500" size={28} />
              ) : (
                <Clock className="text-amber-500" size={28} />
              )}
            </div>

            {!isOnline && queueLength > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 mb-4">
                <WifiOff size={14} />
                Pas de connexion pour le moment — l'envoi se fera automatiquement dès le retour du réseau.
              </p>
            )}

            <button
              onClick={handleSyncNow}
              disabled={syncing || queueLength === 0}
              className="w-full flex items-center justify-center gap-2 bg-shm-red text-white font-semibold py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UploadCloud size={18} className={syncing ? 'animate-pulse' : ''} />
              {syncing ? 'Envoi en cours...' : 'Synchroniser maintenant'}
            </button>

            {lastResult && (
              <div className="mt-4 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                <span>Envoyées: {lastResult.accepted}</span>
                <span>Déjà connues: {lastResult.duplicates}</span>
                <span>Remplacées: {lastResult.superseded}</span>
                <span>En erreur: {lastResult.errors}</span>
                {lastResult.networkFailure && <span className="text-amber-600">Aucune connexion au moment de l'envoi</span>}
              </div>
            )}

            {(membersSyncedAt || sessionsSyncedAt) && (
              <p className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
                {memberCount} membre{memberCount > 1 ? 's' : ''} et {sessionCount} séance{sessionCount > 1 ? 's' : ''} disponibles hors-ligne
                {membersSyncedAt ? ` — dernière mise à jour ${membersSyncedAt.toLocaleString('fr-FR')}` : ''}.
              </p>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
