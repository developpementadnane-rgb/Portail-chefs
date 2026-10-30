import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { parseMemberBadge, type ParsedMemberBadge } from '../lib/memberBadge';

type ScanState = 'idle' | 'scanning' | 'result' | 'error';

/**
 * Emergency access page: a chef scans a member's personal badge and
 * immediately sees their decrypted details, full stop -- no session
 * selection, no attendance record written, no server round-trip.
 *
 * Deliberately NOT a second member-management screen: it reads
 * nothing from the local members cache and writes nothing anywhere.
 * The badge itself, decrypted on-device via badgeCrypto.ts (AES-256-GCM,
 * same key/format as the members portal's badge generator), is the
 * only source of truth here. That's what makes this work with zero
 * connectivity and even if the local members cache is stale or was
 * never populated for this member.
 */
export default function EmergencyAccess() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [state, setState] = useState<ScanState>('idle');
  const [badge, setBadge] = useState<ParsedMemberBadge | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  const startScanning = () => {
    setError(null);
    setBadge(null);
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
    if (!parsed.valid) {
      // Keep scanning silently on a non-badge QR (or a badge that
      // failed to decrypt) instead of interrupting on every frame.
      return;
    }

    stopScanning();
    setBadge(parsed);
    setState('result');
  };

  useEffect(() => {
    return () => stopScanning();
  }, []);

  const handleScanAnother = () => {
    setBadge(null);
    startScanning();
  };

  const guardianName = [badge?.guardianFirstName, badge?.guardianLastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-xl">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-shm-red" size={24} />
              <h1 className="section-title mb-0">Page d'urgence</h1>
            </div>
            <p className="text-gray-600 text-sm mt-1">
              Scannez le badge personnel d'un membre pour afficher immédiatement ses informations,
              sans connexion internet.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            {state === 'idle' && (
              <button
                onClick={startScanning}
                className="w-full flex items-center justify-center gap-2 bg-shm-red text-white font-semibold py-4 rounded-lg"
              >
                <Camera size={20} />
                Scanner un badge
              </button>
            )}

            {state === 'scanning' && (
              <div>
                <video ref={videoRef} className="w-full rounded-lg bg-black aspect-square object-cover" />
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

            {state === 'result' && badge && (
              <div>
                <div className="flex items-center gap-2 mb-4 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs font-semibold">
                  <AlertTriangle size={16} />
                  Usage d'urgence uniquement — ne remplace pas la fiche membre complète.
                </div>

                <div className="text-center mb-5">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {badge.firstName} {badge.lastName}
                  </h2>
                  <span className="inline-block mt-2 px-4 py-1 rounded-full bg-red-50 text-shm-red font-bold">
                    {badge.generatedId}
                  </span>
                </div>

                <dl className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                  <InfoRow label="Date de naissance" value={badge.birthDate} />
                  <InfoRow label="Tuteur/Parent" value={guardianName || null} />
                  <InfoRow label="Téléphone (1)" value={badge.guardianPhone} mono />
                  <InfoRow label="Téléphone (2)" value={badge.guardianPhone2} mono />
                  <InfoRow label="Informations médicales" value={badge.medicalInfo} />
                </dl>

                <button
                  onClick={handleScanAnother}
                  className="mt-6 w-full bg-shm-red text-white font-semibold py-3 rounded-lg"
                >
                  Scanner un autre badge
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

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className={`text-sm font-medium text-gray-900 text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
}
