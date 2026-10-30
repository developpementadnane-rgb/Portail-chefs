import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

interface DailyReport {
  id: string;
  report_date: string | null;
  patrol_id: number | null;
  morning_program_rating: string | null;
  evening_program_rating: string | null;
  night_program_rating: string | null;
  nutrition_rating: string | null;
  relationships_rating: string | null;
  general_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Patrol {
  id: number;
  name: string;
}

const availableDates = Array.from({ length: 13 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 6, 27 + index));
  return date.toISOString().slice(0, 10);
});

export default function DailyReports() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [patrolId, setPatrolId] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [{ data, error: queryError }, { data: patrolData, error: patrolError }] = await Promise.all([
          supabase.from('daily_camp_reports').select('*'),
          supabase.from('patrols').select('id, name').order('name'),
        ]);

        if (queryError || patrolError) {
          const queryFailure = queryError || patrolError;
          setError(`[${queryFailure.code}] ${queryFailure.message}`);
          return;
        }

        setReports(data || []);
        setPatrols(patrolData || []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue';
        setError(`Erreur lors du chargement des rapports: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();

    return reports
      .filter((report) => {
        const matchesSearch =
          !normalizedSearch ||
          report.general_notes?.toLowerCase().includes(normalizedSearch) ||
          report.report_date?.includes(normalizedSearch);
        const matchesDate = !filterDate || report.report_date === filterDate;
        const matchesPatrol = !patrolId || String(report.patrol_id) === patrolId;
        return matchesSearch && matchesDate && matchesPatrol;
      })
      .sort((first, second) => {
        const firstDate = first.report_date || first.created_at;
        const secondDate = second.report_date || second.created_at;
        return sortOrder === 'asc'
          ? firstDate.localeCompare(secondDate)
          : secondDate.localeCompare(firstDate);
      });
  }, [filterDate, patrolId, reports, searchTerm, sortOrder]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Rapports Quotidiens</h1>
              <p className="text-gray-600 mt-1">Consultez les rapports quotidiens enregistrés</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="mb-6 flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((open) => !open)}
                  aria-label="Afficher les filtres"
                  aria-expanded={isFilterOpen}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    isFilterOpen || filterDate || patrolId || sortOrder !== 'desc'
                      ? 'border-shm-red bg-red-50 text-shm-red'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <SlidersHorizontal size={20} />
                </button>
              </div>
              {isFilterOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ordre</label>
                    <select
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value as 'desc' | 'asc')}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
                    >
                      <option value="desc">Plus récents</option>
                      <option value="asc">Plus anciens</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <select
                      value={filterDate}
                      onChange={(event) => setFilterDate(event.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
                    >
                      <option value="">Toutes les dates</option>
                      {availableDates.map((date) => (
                        <option key={date} value={date}>{formatDate(date)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Patrouille</label>
                    <select
                      value={patrolId}
                      onChange={(event) => setPatrolId(event.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
                    >
                      <option value="">Toutes les patrouilles</option>
                      {patrols.map((patrol) => (
                        <option key={patrol.id} value={patrol.id}>{patrol.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red" />
                <p className="ml-2 text-gray-600">Chargement des rapports...</p>
              </div>
            )}
            {!isLoading && (
              <div className="space-y-4">
                {filteredReports.length > 0 ? filteredReports.map((report) => (
                  <article key={report.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Rapport du {formatDate(report.report_date)}</h2>
                        <p className="text-sm text-gray-500 mt-1">Enregistré le {new Date(report.created_at).toLocaleString('fr-FR')}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Patrouille : {patrols.find((patrol) => patrol.id === report.patrol_id)?.name || 'Non affectée'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
                      <div><p className="text-gray-600 mb-1">Matin</p><p className="text-gray-700">{report.morning_program_rating || '—'}</p></div>
                      <div><p className="text-gray-600 mb-1">Après-midi</p><p className="text-gray-700">{report.evening_program_rating || '—'}</p></div>
                      <div><p className="text-gray-600 mb-1">Soir</p><p className="text-gray-700">{report.night_program_rating || '—'}</p></div>
                      <div><p className="text-gray-600 mb-1">Alimentation</p><p className="text-gray-700">{report.nutrition_rating || '—'}</p></div>
                      <div><p className="text-gray-600 mb-1">Chefs</p><p className="text-gray-700">{report.relationships_rating || '—'}</p></div>
                    </div>
                    <button
                      onClick={() => navigate(`/daily-reports/${report.id}`)}
                      className="mt-4 text-shm-red hover:text-red-700 font-semibold"
                    >
                      Afficher plus →
                    </button>
                  </article>
                )) : (
                  <div className="bg-white rounded-lg shadow-md p-8 text-center"><p className="text-gray-500">Aucun rapport trouvé</p></div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
