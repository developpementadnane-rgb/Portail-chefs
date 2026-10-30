import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

interface Report {
  id: string;
  title: string | null;
  location: string | null;
  time: string | null;
  objective: string | null;
  responsible: string | null;
  category: string | null;
  beneficiary: string | null;
  description_original: string | null;
  description_reformulated: string | null;
  pdf_url: string | null;
  created_at: string;
}

export default function Reports() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('[DEBUG] Fetching reports from Supabase...');
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .order('created_at', { ascending: false });

        console.log('[DEBUG] Reports response - data:', data, 'error:', error);

        if (error) {
          const errorMsg = `[${error.code}] ${error.message}`;
          console.error('[ERROR] Supabase error:', errorMsg);
          setError(errorMsg);
          throw error;
        }
        setReports(data || []);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('[ERROR] Failed to fetch reports:', msg);
        setError(`Erreur lors du chargement des rapports: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('reports_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReports((prev) => [payload.new as Report, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReports((prev) =>
              prev.map((r) => (r.id === payload.new.id ? (payload.new as Report) : r))
            );
          } else if (payload.eventType === 'DELETE') {
            setReports((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const filteredReports = reports.filter(
    (report) =>
      (report.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.responsible || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} userName="Chef Principal" />

      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Header */}
          <div className="mb-8">
            <h1 className="section-title">Rapports Enregistrés</h1>
            <p className="text-gray-600">
              {filteredReports.length} rapport{filteredReports.length !== 1 ? 's' : ''} au total
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher par titre, patrouille ou activité..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red"></div>
              <p className="ml-2 text-gray-600">Chargement des rapports...</p>
            </div>
          )}

          {/* Reports List */}
          {!isLoading && (
            <div className="space-y-4">
              {filteredReports.length > 0 ? (
                filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {report.title || 'Rapport sans titre'}
                        </h3>
                        <div className="flex gap-4 mt-2 text-sm text-gray-600">
                          {report.location && (
                            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                              {report.location}
                            </span>
                          )}
                          {report.category && (
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full">
                              {report.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <time className="text-xs text-gray-500">
                        {formatDate(report.created_at)}
                      </time>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                      {report.description_reformulated || report.description_original || report.objective || 'Aucune description disponible'}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/reports/${report.id}`)}
                        className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Afficher plus"
                      >
                        <Eye size={18} />
                        <span>Afficher plus</span>
                      </button>
                      <button
                        onClick={() => {
                          if (report.pdf_url) {
                            const link = document.createElement('a');
                            link.href = report.pdf_url;
                            link.download = `rapport-${report.id}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Télécharger le PDF"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg shadow-md px-6 py-12 text-center">
                  <p className="text-gray-500 text-sm">
                    {searchTerm ? 'Aucun rapport ne correspond à votre recherche' : 'Aucun rapport enregistré'}
                  </p>
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
