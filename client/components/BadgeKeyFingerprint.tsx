import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { getKeyFingerprint } from '../lib/badgeCrypto';

/**
 * Affiche une empreinte NON RÉVERSIBLE de VITE_BADGE_ENCRYPTION_KEY,
 * jamais la clé elle-même. À comparer avec la même empreinte affichée
 * sur le site des membres (composant identique) : si elles diffèrent,
 * les deux déploiements n'utilisent pas la même clé -- c'est la cause
 * du point 1 (QR illisibles). Si elles sont identiques, la clé n'est
 * pas le problème.
 */
export default function BadgeKeyFingerprint() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    getKeyFingerprint().then(setFingerprint);
  }, []);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-2xl mt-4 flex items-center gap-3">
      <Fingerprint size={18} className="text-gray-400 flex-shrink-0" />
      <p className="text-xs text-gray-500">
        Empreinte de la clé QR de ce site : <code className="font-mono font-semibold text-gray-700">{fingerprint ?? '...'}</code>
        {' '}— comparez avec la même empreinte sur le site des membres. Différente = clés désynchronisées (point 1).
      </p>
    </div>
  );
}
