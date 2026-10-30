import { useEffect, useMemo, useState } from 'react';
import { Search, X, Save, Loader2, CheckCircle2, WifiOff } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { getCachedMembers, type CachedMember } from '../lib/offline/membersCache';
import { queueMembershipUpdate, flushMembershipQueue } from '../lib/offline/membershipQueue';

type MembershipRow = CachedMember;

export default function MembershipManage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [members, setMembers] = useState<MembershipRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<MembershipRow | null>(null);

  // Local-first, like AttendanceScan.tsx: reads the offline cache
  // (populated at login / team-passphrase redemption) so this screen
  // works fully offline.
  const loadMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const cached = await getCachedMembers();
      setMembers(cached);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return members;
    return members.filter(
      (m) =>
        (m.first_name || '').toLowerCase().includes(term) ||
        (m.last_name || '').toLowerCase().includes(term) ||
        (m.generated_id || '').toLowerCase().includes(term),
    );
  }, [members, searchTerm]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="section-title">Gestion de l'adhésion</h1>
            <p className="text-gray-600">Recherchez un membre pour modifier son statut de paiement et de papiers.</p>
          </div>

          <div className="mb-6 relative max-w-lg">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher par nom, prénom ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
            />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red" />
              <p className="ml-2 text-gray-600">Chargement...</p>
            </div>
          ) : searchTerm.trim() === '' ? (
            <p className="text-gray-400 text-sm">Tapez un nom, prénom ou ID pour trouver un membre.</p>
          ) : filteredMembers.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun membre ne correspond à cette recherche.</p>
          ) : (
            <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelected(member)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 text-left"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-xs text-gray-400">{member.generated_id}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className={member.payment_completed ? 'text-emerald-600' : 'text-gray-300'}>Payé</span>
                    <span className="text-gray-300">·</span>
                    <span className={member.documents_completed ? 'text-emerald-600' : 'text-gray-300'}>Papiers</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
      <Footer />

      {selected && (
        <MembershipEditModal
          member={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            loadMembers();
          }}
        />
      )}
    </div>
  );
}

function MembershipEditModal({
  member,
  onClose,
  onSaved,
}: {
  member: MembershipRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paymentCompleted, setPaymentCompleted] = useState(member.payment_completed);
  const [documentsCompleted, setDocumentsCompleted] = useState(member.documents_completed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasQueuedOnly, setWasQueuedOnly] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await queueMembershipUpdate({
        memberId: member.id,
        paymentCompleted,
        documentsCompleted,
      });

      // Opportunistic immediate sync -- a no-op if offline (stays
      // queued locally and goes out later, same pattern as attendance
      // in AttendanceScan.tsx / syncQueue.ts).
      const summary = await flushMembershipQueue();
      setWasQueuedOnly(summary.succeeded === 0);

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {member.first_name} {member.last_name}
            </h2>
            <p className="text-xs text-gray-400">{member.generated_id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={paymentCompleted}
              onChange={(e) => setPaymentCompleted(e.target.checked)}
              className="w-5 h-5 accent-shm-red"
            />
            <span className="font-medium text-gray-800">A payé sa cotisation</span>
          </label>

          <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={documentsCompleted}
              onChange={(e) => setDocumentsCompleted(e.target.checked)}
              className="w-5 h-5 accent-shm-red"
            />
            <span className="font-medium text-gray-800">A fourni ses papiers</span>
          </label>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {wasQueuedOnly && !error && (
          <p className="mb-4 flex items-center gap-1.5 text-xs text-amber-600">
            <WifiOff size={14} />
            Pas de connexion — sera envoyé automatiquement dès que possible.
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-shm-red text-white font-semibold py-3 rounded-lg disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
