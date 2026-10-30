import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

interface DailyReport {
  id: string;
  report_date: string | null;
  morning_program_rating: string | null;
  evening_program_rating: string | null;
  night_program_rating: string | null;
  nutrition_rating: string | null;
  relationships_rating: string | null;
  general_notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function DailyReportDetail() {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) return;
      try {
        setIsLoading(true);
        setError(null);
        const { data, error: queryError } = await supabase.from('daily_camp_reports').select('*').eq('id', reportId).maybeSingle();
        if (queryError) {
          setError(`[${queryError.code}] ${queryError.message}`);
          return;
        }
        setReport(data);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue';
        setError(`Erreur lors du chargement du rapport: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, [reportId]);

  const formatDate = (dateString: string | null) => dateString ? new Date(dateString).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const ratingFields = report ? [
    ['Matin', report.morning_program_rating],
    ['Après-midi', report.evening_program_rating],
    ['Soir', report.night_program_rating],
    ['Alimentation', report.nutrition_rating],
    ['Relation avec les chefs', report.relationships_rating],
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <button onClick={() => navigate('/daily-reports')} className="mb-6 flex items-center gap-2 text-shm-red hover:text-red-700 font-semibold"><ArrowLeft size={20} />Retour aux rapports</button>
            {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-700 text-sm font-medium">{error}</p></div>}
            {isLoading && <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red" /><p className="ml-2 text-gray-600">Chargement du rapport...</p></div>}
            {!isLoading && !error && !report && <div className="bg-white rounded-lg shadow-md p-8 text-center"><p className="text-gray-500">Rapport introuvable</p></div>}
            {report && <article className="bg-white rounded-lg shadow-md p-8">
              <div className="mb-6 pb-6 border-b border-gray-200"><h1 className="text-3xl font-bold text-gray-900">Rapport du {formatDate(report.report_date)}</h1><p className="text-sm text-gray-500 mt-2">Créé le {new Date(report.created_at).toLocaleString('fr-FR')} · Mis à jour le {new Date(report.updated_at).toLocaleString('fr-FR')}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {ratingFields.map(([label, rating]) => <div key={label} className="bg-gray-50 rounded-lg p-6"><h2 className="text-lg font-semibold text-gray-900 mb-3">{label}</h2><p className="text-gray-700">{rating || '—'}</p></div>)}
              </div>
              <div className="bg-gray-50 rounded-lg p-6"><h2 className="font-semibold text-gray-900 mb-3">Remarques générales</h2><p className="text-gray-700 whitespace-pre-line">{report.general_notes || '—'}</p></div>
            </article>}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
