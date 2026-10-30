import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Calendar, Lightbulb, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

interface Stats {
  members: number;
  reports: number;
  sessions: number;
  ideas: number;
}

interface Activity {
  id: string;
  type: 'report' | 'session' | 'idea' | 'member';
  title: string;
  date: string;
  icon: React.FC<any>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({
    members: 0,
    reports: 0,
    sessions: 0,
    ideas: 0,
  });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch members count
        const { count: membersCount, error: membersError } = await supabase
          .from('member_profiles')
          .select('*', { count: 'exact', head: true });

        // Fetch reports count
        const { count: reportsCount, error: reportsError } = await supabase
          .from('reports')
          .select('*', { count: 'exact', head: true });

        // Fetch sessions count
        const { count: sessionsCount, error: sessionsError } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true });

        // Fetch ideas count
        const { count: ideasCount, error: ideasError } = await supabase
          .from('ideas')
          .select('*', { count: 'exact', head: true });

        // Update stats
        setStats({
          members: membersCount || 0,
          reports: reportsCount || 0,
          sessions: sessionsCount || 0,
          ideas: ideasCount || 0,
        });

        // Fetch recent activity (last 4 entries across all tables)
        const activities: Activity[] = [];

        // Get recent reports
        const { data: reportsData, error: reportsDataError } = await supabase
          .from('reports')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(2);

        console.log('[DEBUG] Reports data:', reportsData, 'error:', reportsDataError);

        if (reportsData && !reportsDataError) {
          reportsData.forEach((report) => {
            activities.push({
              id: `report-${report.id}`,
              type: 'report',
              title: `Rapport: ${report.title}`,
              date: formatDate(report.created_at),
              icon: FileText,
            });
          });
        }

        // Get recent sessions
        const { data: sessionsData, error: sessionsDataError } = await supabase
          .from('sessions')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(1);

        if (sessionsData && !sessionsDataError) {
          sessionsData.forEach((session) => {
            activities.push({
              id: `session-${session.id}`,
              type: 'session',
              title: `Séance: ${session.title}`,
              date: formatDate(session.created_at),
              icon: Calendar,
            });
          });
        }

        // Get recent ideas
        const { data: ideasData, error: ideasDataError } = await supabase
          .from('ideas')
          .select('id, title, submitted_at')
          .order('submitted_at', { ascending: false })
          .limit(1);

        console.log('[DEBUG] Ideas data:', ideasData, 'error:', ideasDataError);

        if (ideasData && !ideasDataError) {
          ideasData.forEach((idea) => {
            activities.push({
              id: `idea-${idea.id}`,
              type: 'idea',
              title: `Idée: ${idea.title}`,
              date: formatDate(idea.submitted_at),
              icon: Lightbulb,
            });
          });
        }

        // Get recent members
        const { data: membersData, error: membersDataError } = await supabase
          .from('member_profiles')
          .select('id, first_name, last_name, created_at')
          .order('created_at', { ascending: false })
          .limit(1);

        console.log('[DEBUG] Members data:', membersData, 'error:', membersDataError);

        if (membersData && !membersDataError) {
          membersData.forEach((member) => {
            activities.push({
              id: `member-${member.id}`,
              type: 'member',
              title: `Nouveau membre: ${member.first_name || ''} ${member.last_name || ''}`,
              date: formatDate(member.created_at),
              icon: Users,
            });
          });
        }

        // Sort by date and limit to 4
        setRecentActivity(activities.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        }).slice(0, 4));
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('Error fetching dashboard data:', msg);
        setError(`Erreur lors du chargement du tableau de bord: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription for updates
    const subscription = supabase
      .channel('dashboard_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'member_profiles' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ideas' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `Il y a ${diffDays} jours`;
    } else {
      return date.toLocaleDateString('fr-FR');
    }
  };

  const statCards = [
    {
      icon: Users,
      label: 'Nombre total de membres',
      value: stats.members,
      color: 'from-blue-500 to-blue-600',
      route: '/members',
    },
    {
      icon: FileText,
      label: 'Rapports enregistrés',
      value: stats.reports,
      color: 'from-orange-500 to-orange-600',
      route: '/reports',
    },
    {
      icon: Calendar,
      label: 'Séances organisées',
      value: stats.sessions,
      color: 'from-green-500 to-green-600',
      route: '/sessions',
    },
    {
      icon: Lightbulb,
      label: 'Idées proposées',
      value: stats.ideas,
      color: 'from-yellow-500 to-yellow-600',
      route: '/ideas',
    },
  ];

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

          {/* Page Title */}
          <div className="mb-8">
            <h1 className="section-title">Tableau de Bord</h1>
            <p className="text-gray-600">Bienvenue sur le portail de supervision des chefs SHM</p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red"></div>
              <p className="ml-2 text-gray-600">Chargement des données...</p>
            </div>
          )}

          {!isLoading && (
            <>
              {/* Statistics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map(({ icon: Icon, label, value, color, route }) => (
                  <button
                    key={label}
                    onClick={() => navigate(route)}
                    className="stat-card group hover:scale-105 cursor-pointer text-left transition-transform"
                  >
                    <div className={`bg-gradient-to-br ${color} p-4 rounded-lg mb-4 inline-block`}>
                      <Icon className="text-white" size={24} />
                    </div>
                    <p className="text-gray-600 text-sm font-medium mb-2">{label}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    <div className="flex items-center gap-1 mt-2 text-green-600 text-xs">
                      <TrendingUp size={14} />
                      <span>Mise à jour en temps réel</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow-md p-6 shm-glow">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="bg-shm-red/10 p-2 rounded-lg">
                    <TrendingUp className="text-shm-red" size={24} />
                  </div>
                  Activité Récente
                </h2>

                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map(({ id, type, title, date, icon: Icon }) => (
                      <div
                        key={id}
                        className="flex items-start gap-4 pb-4 border-b border-gray-200 last:border-0 hover:bg-gray-50 p-2 rounded transition-colors"
                      >
                        <div className="bg-gray-100 p-3 rounded-lg flex-shrink-0 mt-1">
                          <Icon className="text-shm-red" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm line-clamp-2">
                            {title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">Aucune activité récente</p>
                )}

                <button className="w-full mt-4 text-shm-red hover:text-shm-purple font-semibold text-sm py-2 transition-colors">
                  Voir toute l'activité →
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
