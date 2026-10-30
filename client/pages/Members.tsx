import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2, Search, WifiOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { API_BASE_URL } from '../lib/apiConfig';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import {
  getCachedMembers,
  searchCachedMembers,
  getMembersLastSyncedAt,
  hasAnyOfflineAccess,
  type CachedMember,
} from '../lib/offline';

type Member = CachedMember;

const columns: { key: keyof Member; label: string }[] = [
  { key: 'last_name', label: 'Nom' },
  { key: 'first_name', label: 'Prénom' },
  { key: 'generated_id', label: 'ID' },
  { key: 'patrol_name', label: 'Patrouille' },
  { key: 'role_name', label: 'Rôle' },
];

const formatValue = (value: Member[keyof Member]) => {
  if (value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  return String(value);
};

export default function Members() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Tracks whether the list currently on screen came from the local
  // offline cache rather than a live Supabase query — drives the
  // "hors ligne" banner below. Distinct from useOnlineStatus's
  // navigator.onLine because a Supabase query can fail even while
  // navigator.onLine is true (e.g. connected to Wi-Fi with no real
  // route out), so we track this from the actual fetch outcome.
  const [isShowingOfflineData, setIsShowingOfflineData] = useState(false);
  const [offlineSyncedAt, setOfflineSyncedAt] = useState<Date | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: queryError } = await supabase
          .from('member_profiles')
          .select('*')
          .order('first_name', { ascending: true })
          .order('last_name', { ascending: true });

        if (queryError) {
          throw queryError;
        }

        setMembers(data || []);
        setIsShowingOfflineData(false);
      } catch (fetchError) {
        // Network/Supabase failure: fall back to the offline cache,
        // but only if this device currently has SOME form of offline
        // access — either personal device trust (a chef who logged in
        // online before) or the shared team passphrase (see
        // client/lib/offline/accessMode.ts, which checks both). A
        // device with neither gets the plain error message instead of
        // stale cached data it was never authorized to keep showing.
        const trusted = await hasAnyOfflineAccess();

        if (!trusted) {
          const message = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue';
          setError(`Erreur lors du chargement des membres: ${message}`);
          setIsLoading(false);
          return;
        }

        const cached = await getCachedMembers();
        const lastSynced = await getMembersLastSyncedAt();
        setMembers(cached);
        setIsShowingOfflineData(true);
        setOfflineSyncedAt(lastSynced);

        if (cached.length === 0) {
          setError(
            "Aucune donnée hors ligne disponible pour l'instant. Connectez-vous à Internet une première fois pour télécharger la liste des membres.",
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();

    // Realtime subscription only makes sense online; if it can't
    // connect it simply won't fire, which is fine — offline reads
    // already come from the local cache above, not from waiting on
    // this subscription.
    const subscription = supabase.channel('members_updates').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'member_profiles' },
      () => fetchMembers()
    ).subscribe();
    return () => { subscription.unsubscribe(); };
  }, []);

  const filteredMembers = useMemo(() => {
    if (isShowingOfflineData) {
      return searchCachedMembers(members, searchTerm);
    }
    const normalizedSearch = searchTerm.toLowerCase();
    return members.filter((member) =>
      !normalizedSearch ||
      (member.first_name || '').toLowerCase().includes(normalizedSearch) ||
      (member.last_name || '').toLowerCase().includes(normalizedSearch) ||
      (member.patrol_name || '').toLowerCase().includes(normalizedSearch)
    );
  }, [members, searchTerm, isShowingOfflineData]);

  const handleQuickDelete = async (member: Member) => {
    const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'ce membre';
    if (!window.confirm(`Supprimer définitivement ${fullName} ? Cette action est irréversible (fiche, compte de connexion et historique de présence).`)) {
      return;
    }
    setDeletingId(member.id);
    try {
      await apiRequest(`${API_BASE_URL}/api/members/${member.id}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer ce membre');
    } finally {
      setDeletingId(null);
    }
  };

  const renderValue = (member: Member, key: keyof Member) => {
    const value = member[key];
    if ((key === 'pdf_url' || key === 'qr_code_url') && typeof value === 'string' && value) {
      return <a href={value} target="_blank" rel="noreferrer" className="text-shm-red hover:text-red-700 underline">Ouvrir</a>;
    }
    return formatValue(value);
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
                Mode hors ligne — données{' '}
                {offlineSyncedAt
                  ? `synchronisées le ${offlineSyncedAt.toLocaleString('fr-FR')}`
                  : 'locales'}
                .
              </p>
            </div>
          )}
          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-700 text-sm font-medium">{error}</p></div>}
          <div className="mb-8"><h1 className="section-title">Gestion des Membres</h1><p className="text-gray-600">{filteredMembers.length} membre{filteredMembers.length !== 1 ? 's' : ''} au total</p></div>
          <div className="mb-6 relative"><Search className="absolute left-3 top-3 text-gray-400" size={20} /><input type="text" placeholder="Rechercher par nom, prénom ou patrouille..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red" /></div>
          {isLoading && <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red" /><p className="ml-2 text-gray-600">Chargement des membres...</p></div>}
          {!isLoading && <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {filteredMembers.length > 0 ? <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-100 border-b border-gray-200"><tr>{columns.map((column) => <th key={column.key} className="px-6 py-3 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">{column.label}</th>)}<th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th></tr></thead><tbody className="divide-y divide-gray-200">{filteredMembers.map((member) => <tr key={member.id} className="hover:bg-gray-50 transition-colors">{columns.map((column) => <td key={column.key} className="px-6 py-4 text-sm text-gray-600 align-top">{renderValue(member, column.key)}</td>)}<td className="px-6 py-4"><div className="flex items-center gap-1"><button onClick={() => navigate(`/members/${member.id}`)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Afficher plus" aria-label={`Afficher plus pour ${member.first_name || ''} ${member.last_name || ''}`}><Eye size={18} /></button><button onClick={() => navigate(`/members/${member.id}?edit=1`)} disabled={isShowingOfflineData} title={isShowingOfflineData ? 'Connexion requise pour modifier' : 'Modifier'} aria-label={`Modifier ${member.first_name || ''} ${member.last_name || ''}`} className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><Pencil size={18} /></button><button onClick={() => handleQuickDelete(member)} disabled={isShowingOfflineData || deletingId === member.id} title={isShowingOfflineData ? 'Connexion requise pour supprimer' : 'Supprimer'} aria-label={`Supprimer ${member.first_name || ''} ${member.last_name || ''}`} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed">{deletingId === member.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}</button></div></td></tr>)}</tbody></table></div> : <div className="px-6 py-12 text-center"><p className="text-gray-500 text-sm">{searchTerm ? 'Aucun membre ne correspond à votre recherche' : 'Aucun membre enregistré'}</p></div>}
          </div>}
        </main>
      </div>
      <Footer />
    </div>
  );
}
