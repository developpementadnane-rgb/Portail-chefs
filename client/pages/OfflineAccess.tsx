import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, WifiOff, AlertCircle, ShieldCheck } from 'lucide-react';
import { unlockFieldAccess } from '../lib/offline/teamAccess';
import { runReconnectSync } from '../lib/offline/orchestrator';

/**
 * Field-access entry point for the hardcoded field key (see
 * client/lib/offline/teamAccess.ts). Deliberately NOT a login form:
 * no CIN, no name, no individual identity is asked for or recorded
 * here — the key alone is the credential, by design.
 *
 * Purely local check, on purpose: the whole point of this screen is
 * to work with ZERO connectivity, so there is no server round-trip
 * here at all (contrast with a real chef login, which needs
 * Supabase). If a connection happens to be available right now, an
 * opportunistic sync is kicked off afterwards to refresh the local
 * cache, but that's a bonus, never a requirement to get in.
 */
export default function OfflineAccess() {
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!unlockFieldAccess(key)) {
      setError('Clé incorrecte');
      return;
    }

    if (navigator.onLine) {
      runReconnectSync().catch((syncError) => {
        console.warn('[offline] Post field-key sync failed, will retry on reconnect:', syncError);
      });
    }

    navigate('/attendance-scan');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-shm-red/5 to-shm-purple/5 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-center mb-4">
            <div className="bg-shm-red/10 p-3 rounded-full">
              <WifiOff className="text-shm-red" size={28} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-center text-gray-900 mb-2">
            Accès terrain hors ligne
          </h1>
          <p className="text-center text-sm text-gray-600 mb-6">
            Entrez la clé d'équipe pour accéder aux membres et au scan de présence sans compte individuel.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="field-key" className="block text-sm font-medium text-gray-700 mb-1">
                Clé d'équipe
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  id="field-key"
                  type="text"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="SHM-xxxx-xxxx-xxxx-xxxx"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
                  required
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-shm-red to-shm-purple text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all duration-200"
            >
              Accéder
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
            <ShieldCheck className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-blue-800">
              Ce mode donne accès aux membres et à la présence pour toute l'équipe, sans identifier
              individuellement qui a effectué chaque action. Pour un accès personnel et un suivi
              individuel, utilisez plutôt votre compte chef.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <p className="text-gray-600 text-sm">
              Vous avez un compte ?{' '}
              <Link to="/login" className="font-semibold text-shm-red hover:text-shm-purple transition-colors">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
