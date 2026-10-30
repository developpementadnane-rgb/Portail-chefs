import { useEffect, useRef, useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { apiRequest } from "../lib/api";

interface MarketplaceKeyResponse {
  key: string;
  expiresAt: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expirée";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

export default function MarketplaceKeyCard() {
  const [key, setKey] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();

  async function loadKey() {
    try {
      const data = await apiRequest<MarketplaceKeyResponse>("/api/marketplace-key");
      setKey(data.key);
      setExpiresAt(data.expiresAt);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  useEffect(() => {
    loadKey();
    // Revérifie régulièrement : la clé change automatiquement toutes les 24h,
    // ce polling se contente de rafraîchir l'affichage après expiration.
    const interval = setInterval(loadKey, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleCopy() {
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 shm-glow mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-3">
        <div className="bg-shm-red/10 p-2 rounded-lg">
          <KeyRound className="text-shm-red" size={24} />
        </div>
        Clé secrète pour la marketplace
      </h2>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!error && !key && <p className="text-gray-500 text-sm">Chargement...</p>}

      {!error && key && (
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-gray-100 rounded-lg px-4 py-3 font-mono text-sm text-gray-900 overflow-x-auto whitespace-nowrap">
            {key}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-2 bg-shm-red hover:bg-shm-purple text-white font-semibold text-sm px-4 py-3 rounded-lg transition-colors"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      )}

      {!error && expiresAt && (
        <p className="text-xs text-gray-500 mt-3">
          Renouvelée automatiquement toutes les 24h · expire dans{" "}
          {formatRemaining(new Date(expiresAt).getTime() - Date.now())}
        </p>
      )}
    </div>
  );
}
