import { useEffect, useMemo, useState } from 'react';
import { Check, X, Filter } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { apiRequest } from '../lib/api';
import { API_BASE_URL } from '../lib/apiConfig';

type MembershipRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  generated_id: string | null;
  payment_completed: boolean;
  documents_completed: boolean;
};

type FilterKey = 'all' | 'both' | 'payment_only' | 'documents_only' | 'none';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'both', label: 'Payé + Papiers' },
  { key: 'payment_only', label: 'Payé, papiers manquants' },
  { key: 'documents_only', label: 'Papiers fournis, non payé' },
  { key: 'none', label: 'Aucun des deux' },
];

function matchesFilter(row: MembershipRow, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'both') return row.payment_completed && row.documents_completed;
  if (filter === 'payment_only') return row.payment_completed && !row.documents_completed;
  if (filter === 'documents_only') return !row.payment_completed && row.documents_completed;
  return !row.payment_completed && !row.documents_completed;
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-600">
      <Check size={16} />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-red-500">
      <X size={16} />
    </span>
  );
}

export default function MembershipList() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [members, setMembers] = useState<MembershipRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await apiRequest<{ members: MembershipRow[] }>(`${API_BASE_URL}/api/membership/list`);
        setMembers(result.members);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filteredMembers = useMemo(() => members.filter((m) => matchesFilter(m, filter)), [members, filter]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="section-title">Adhésion des membres</h1>
            <p className="text-gray-600">{filteredMembers.length} membre{filteredMembers.length !== 1 ? 's' : ''} affiché{filteredMembers.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  filter === f.key ? 'bg-shm-red text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {f.label}
              </button>
            ))}
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
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {filteredMembers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Nom</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Prénom</th>
                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Payé</th>
                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Papiers fournis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-800 font-medium">{member.last_name || '—'}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">{member.first_name || '—'}</td>
                          <td className="px-6 py-4 text-center"><StatusIcon ok={member.payment_completed} /></td>
                          <td className="px-6 py-4 text-center"><StatusIcon ok={member.documents_completed} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500 text-sm">Aucun membre ne correspond à ce filtre</p>
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
