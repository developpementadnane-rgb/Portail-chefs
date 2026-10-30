import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface Report {
  id: string;
  title: string | null;
  location: string | null;
  time: string | null;
  objective: string | null;
  participants_boys: number | null;
  participants_girls: number | null;
  leaders_count: number | null;
  responsible: string | null;
  category: string | null;
  beneficiary: string | null;
  description_original: string | null;
  description_reformulated: string | null;
  evaluation_positive: string | null;
  evaluation_negative: string | null;
  recommendations: string | null;
  pdf_url: string | null;
  created_at: string;
  unit_logo: string | null;
}

const fields: { key: keyof Report; label: string }[] = [
  { key: 'location', label: 'Lieu' },
  { key: 'time', label: 'Heure' },
  { key: 'objective', label: 'Objectif' },
  { key: 'participants_boys', label: 'Participants garçons' },
  { key: 'participants_girls', label: 'Participants filles' },
  { key: 'leaders_count', label: 'Nombre de chefs' },
  { key: 'responsible', label: 'Responsable' },
  { key: 'category', label: 'Catégorie' },
  { key: 'beneficiary', label: 'Bénéficiaire' },
  { key: 'description_original', label: 'Description originale' },
  { key: 'description_reformulated', label: 'Description reformulée' },
  { key: 'evaluation_positive', label: 'Évaluation positive' },
  { key: 'evaluation_negative', label: 'Évaluation négative' },
  { key: 'recommendations', label: 'Recommandations' },
  { key: 'unit_logo', label: 'Logo de l’unité' },
];

export default function ReportView() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) return;
      try {
        setIsLoading(true);
        setError(null);
        const { data, error: queryError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', reportId)
          .maybeSingle();
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

  const handleDownload = async () => {
    if (!report?.pdf_url) return;
    setIsDownloading(true);
    try {
      const response = await fetch(report.pdf_url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `rapport-${report.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatValue = (value: Report[keyof Report]) => value === null || value === '' ? '—' : String(value);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => {}} userName="Chef Principal" />
      <main className="flex-1 container mx-auto px-4 py-8">
        <button onClick={() => navigate('/reports')} className="mb-6 flex items-center gap-2 text-shm-red hover:text-shm-purple transition-colors font-semibold"><ArrowLeft size={20} />Retour aux rapports</button>
        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-700 text-sm font-medium">{error}</p></div>}
        {isLoading && <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red" /><p className="ml-2 text-gray-600">Chargement du rapport...</p></div>}
        {!isLoading && !error && !report && <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl mx-auto"><div className="flex gap-4 items-start"><AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} /><div><h2 className="text-lg font-bold text-gray-900 mb-2">Rapport introuvable</h2><p className="text-gray-600">Aucune information n’est disponible pour cet identifiant.</p></div></div></div>}
        {report && <article className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-gray-200 pb-6">
            <div><h1 className="text-3xl font-bold text-gray-900">{report.title || 'Rapport sans titre'}</h1><p className="text-sm text-gray-500 mt-2">Créé le {new Date(report.created_at).toLocaleString('fr-FR')}</p></div>
            {report.pdf_url && <div className="flex gap-2"><a href={report.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 border border-shm-red text-shm-red rounded-lg hover:bg-red-50"><ExternalLink size={18} />Ouvrir le PDF</a><button onClick={handleDownload} disabled={isDownloading} className="flex items-center gap-2 bg-gradient-to-r from-shm-red to-shm-purple text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all disabled:opacity-50"><Download size={18} />{isDownloading ? 'Téléchargement...' : 'Télécharger'}</button></div>}
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">{fields.map((field) => <div key={field.key}><dt className="text-sm font-medium text-gray-500">{field.label}</dt><dd className="mt-1 text-gray-900 whitespace-pre-line break-words">{formatValue(report[field.key])}</dd></div>)}</dl>
          {!report.pdf_url && <p className="mt-8 p-4 bg-gray-50 rounded-lg text-gray-500">Aucun lien PDF disponible pour ce rapport.</p>}
        </article>}
      </main>
      <Footer />
    </div>
  );
}
