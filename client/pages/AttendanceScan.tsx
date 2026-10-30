import { useEffect, useMemo, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, CheckCircle2, XCircle, Loader2, WifiOff } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { parseMemberBadge, type ParsedMemberBadge } from '../lib/memberBadge';
import { getCachedMembers, type CachedMember } from '../lib/offline/membersCache';
import { getCachedSessions, type CachedSession } from '../lib/offline/sessionsCache';
import { queueAttendance, flushQueue } from '../lib/offline/syncQueue';

type ScanState = 'idle' | 'scanning' | 'confirming' | 'saving' | 'success' | 'error';

/**
 * New attendance flow: the CHEF scans a member's own personal badge
 * (generated once by the members portal at registration) instead of the
 * old chef-generated QR/PIN/TOTP challenge.
 *
 * Fully offline-first, like the rest of the attendance system: member
 * lookup happens against the LOCAL cache (membersCache.ts, already
 * downloaded at login / team-passphrase redemption -- see
 * OfflineAccess.tsx), and the resulting attendance fact is queued
 * locally (syncQueue.ts) rather than sent directly to the server. If a
 * connection is available, a sync is attempted immediately after; if
 * not, the action stays safely queued and goes out automatically the
 * next time the app detects connectivity (see OfflineSyncProvider),
 * or manually from the "espace de stockage" screen.
 */
export default function AttendanceScan() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<CachedSession[]>([]);
  const [members, setMembers] = useState<CachedMember[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [state, setState] = useState<ScanState>('idle');
  const [badge, setBadge] = useState<ParsedMemberBadge | null>(null);
  const [matchedMember, setMatchedMember] = useState<CachedMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastConfirmedName, setLastConfirmedName] = useState<string | null>(null);
  const [wasQueuedOnly, setWasQueuedOnly] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    // Both reads are local-first (IndexedDB) -- this screen works
    // fully offline as long as an initial sync has happened once
    // while online (see runInitialSync / runReconnectSync).
    getCachedSessions().then(setSessions);
    getCachedMembers().then(setMembers);
  }, []);

  const startScanning = () => {
    setError(null);
    setBadge(null);
    setMatchedMember(null);
    setState('scanning');
  };

  useEffect(() => {
    if (state !== 'scanning' || !videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => handleDecoded(result.data),
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
      },
    );
    scannerRef.current = scanner;

    scanner.start().catch((err) => {
      console.error('Camera error:', err);
      setError(
        "Impossible d'accéder à la caméra. Vérifiez que l'autorisation caméra est bien accordée à l'application dans les paramètres du téléphone.",
      );
      setState('error');
    });

    return () => {
      scanner.stop();
      scanner.destroy();
      if (scannerRef.current === scanner) scannerRef.current = null;
    };
  }, [state]);

  const stopScanning = () => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
  };

  const handleDecoded = async (raw: string) => {
    // Decryption is async (Web Crypto) -- see badgeCrypto.ts.
    const parsed = await parseMemberBadge(raw);
    if (!parsed.valid || !parsed.generatedId) {
      // Keep scanning silently on a non-badge QR (or a badge that
      // failed to decrypt -- wrong key, tampered, unrelated QR)
      // instead of interrupting with an error on every frame.
      return;
    }

    const member = members.find(
      (m) => (m.generated_id || '').trim().toLowerCase() === parsed.generatedId!.trim().toLowerCase(),
    );

    if (!member) {
      stopScanning();
      setError(
        "Ce badge ne correspond à aucun membre dans le cache local. Reconnectez-vous à internet une fois pour mettre à jour la liste des membres.",
      );
      setState('error');
      return;
    }

    stopScanning();
    setBadge(parsed);
    setMatchedMember(member);
    setState('confirming');
  };

  useEffect(() => {
    return () => stopScanning();
  }, []);

  const handleValidate = async () => {
    if (!matchedMember || !selectedSessionId) return;
    setState('saving');
    setError(null);

    try {
      await queueAttendance({
        sessionId: selectedSessionId,
        memberId: matchedMember.id,
        status: 'present',
        recordedVia: 'chef_badge_scan',
      });

      // Opportunistic immediate sync -- a no-op if offline (the queue
      // entry simply stays and goes out later, see module docstring
      // in syncQueue.ts).
      const summary = await flushQueue();
      const wentThroughNow = summary.accepted > 0 || summary.duplicates > 0;

      setLastConfirmedName(`${matchedMember.first_name} ${matchedMember.last_name}`);
      setWasQueuedOnly(!wentThroughNow);
      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la présence");
      setState('error');
    }
  };

  const handleReject = () => {
    setBadge(null);
    setMatchedMember(null);
    startScanning();
  };

  const handleScanAnother = () => {
    setBadge(null);
    setMatchedMember(null);
    setLastConfirmedName(null);
    startScanning();
  };

  const genderLabel = useMemo(() => {
    if (matchedMember?.gender === 'male') return 'ذكر';
    if (matchedMember?.gender === 'female') return 'أنثى';
    return '';
  }, [matchedMember]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-xl">
          <div className="mb-6">
            <h1 className="section-title">Scanner la présence</h1>
            <p className="text-gray-600 text-sm">Scannez le badge personnel du membre pour enregistrer sa présence.</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Séance</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
            >
              <option value="">-- Choisir une séance --</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title || 'Séance'} {session.date_time ? `— ${new Date(session.date_time).toLocaleDateString('fr-FR')}` : ''}
                </option>
              ))}
            </select>
            {sessions.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">
                Aucune séance en cache. Connectez-vous une fois à internet pour les télécharger.
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            {state === 'idle' && (
              <button
                onClick={startScanning}
                disabled={!selectedSessionId}
                className="w-full flex items-center justify-center gap-2 bg-shm-red text-white font-semibold py-4 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Camera size={20} />
                Démarrer le scan
              </button>
            )}

            {!selectedSessionId && state === 'idle' && (
              <p className="text-xs text-amber-600 mt-3 text-center">Choisissez d'abord une séance ci-dessus.</p>
            )}

            {state === 'scanning' && (
              <div>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-lg bg-black aspect-square object-cover"
                />
                <button
                  onClick={() => {
                    stopScanning();
                    setState('idle');
                  }}
                  className="mt-4 w-full text-gray-600 font-medium py-2"
                >
                  Annuler
                </button>
              </div>
            )}

            {state === 'confirming' && matchedMember && (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">Voici la personne devant vous :</p>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mb-5">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {matchedMember.first_name} {matchedMember.last_name}
                  </h2>
                  <span className="inline-block mt-2 px-4 py-1 rounded-full bg-red-50 text-shm-red font-bold">
                    {matchedMember.generated_id}
                  </span>
                  {genderLabel && <p className="text-gray-500 text-sm mt-2">{genderLabel}</p>}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleReject}
                    className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 font-semibold py-3 rounded-lg"
                  >
                    <XCircle size={18} />
                    Ce n'est pas la bonne personne
                  </button>
                  <button
                    onClick={handleValidate}
                    className="flex-1 flex items-center justify-center gap-2 bg-shm-red text-white font-semibold py-3 rounded-lg"
                  >
                    <CheckCircle2 size={18} />
                    Confirmer la présence
                  </button>
                </div>
              </div>
            )}

            {state === 'saving' && (
              <div className="flex flex-col items-center py-8 gap-3 text-gray-600">
                <Loader2 className="animate-spin" size={28} />
                Enregistrement en cours...
              </div>
            )}

            {state === 'success' && (
              <div className="text-center py-6">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={48} />
                <p className="font-semibold text-gray-900">Présence enregistrée pour {lastConfirmedName}</p>
                {wasQueuedOnly && (
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-600">
                    <WifiOff size={14} />
                    Pas de connexion — sera envoyé automatiquement dès que possible.
                  </p>
                )}
                <button
                  onClick={handleScanAnother}
                  className="mt-5 w-full bg-shm-red text-white font-semibold py-3 rounded-lg"
                >
                  Scanner un autre membre
                </button>
              </div>
            )}

            {state === 'error' && (
              <div className="text-center py-6">
                <XCircle className="mx-auto text-red-500 mb-3" size={40} />
                <p className="text-red-600 text-sm mb-5">{error}</p>
                <button onClick={startScanning} className="w-full bg-shm-red text-white font-semibold py-3 rounded-lg">
                  Réessayer
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
