import { useState, useEffect } from 'react';
import { User, Phone, Mail, IdCard, Calendar, MapPin, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentChef } from '../lib/authService';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import BadgeKeyFingerprint from '../components/BadgeKeyFingerprint';

interface ChefProfile {
  id: string;
  cin: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  can: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export default function Account() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<ChefProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const currentChef = getCurrentChef();
        
        if (!currentChef || !currentChef.cin) {
          setError('Aucun utilisateur connecté');
          return;
        }

        const { data, error: queryError } = await supabase
          .from('user_chefs')
          .select('*')
          .eq('cin', currentChef.cin)
          .single();

        if (queryError) throw queryError;
        if (data) {
          setProfile(data);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Impossible de charger le profil');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const profileFields = [
    {
      label: 'Nom',
      value: profile?.last_name || '-',
      icon: User,
    },
    {
      label: 'Prénom',
      value: profile?.first_name || '-',
      icon: User,
    },
    {
      label: 'Numéro CIN',
      value: profile?.cin || '-',
      icon: IdCard,
    },
    {
      label: 'CAN (Code Interne)',
      value: profile?.can || '-',
      icon: IdCard,
    },
    {
      label: 'Date de naissance',
      value: profile?.date_of_birth
        ? new Date(profile.date_of_birth).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '-',
      icon: Calendar,
    },
    {
      label: 'Téléphone',
      value: profile?.phone || '-',
      icon: Phone,
    },
    {
      label: 'Email',
      value: profile?.email || '-',
      icon: Mail,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} userName="Chef Principal" />

      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="section-title">Mon Compte</h1>
            <p className="text-gray-600">Visualisez et gérez votre profil</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red"></div>
              <p className="ml-2 text-gray-600">Chargement du profil...</p>
            </div>
          )}

          {/* Profile Card */}
          {!isLoading && profile && (
            <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl">
              {/* Profile Header */}
              <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-200">
                <div className="bg-gradient-to-br from-shm-red to-shm-purple p-4 rounded-full flex items-center justify-center">
                  <User className="text-white" size={40} />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    {profile.first_name} {profile.last_name}
                  </h2>
                  <p className="text-gray-600 mt-1">Chef SHM</p>
                </div>
              </div>

              {/* Profile Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profileFields.map((field) => {
                  const Icon = field.icon;
                  return (
                    <div
                      key={field.label}
                      className="bg-gray-50 rounded-lg p-4 flex items-start gap-4"
                    >
                      <div className="bg-shm-red/10 p-3 rounded-lg flex-shrink-0">
                        <Icon className="text-shm-red" size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 font-medium">
                          {field.label}
                        </p>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                          {field.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Info Box */}
              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>ℹ️ Informations:</strong> Pour modifier ces données, veuillez contacter l'administrateur du système.
                </p>
              </div>
            </div>
          )}

          {/* Shared team passphrase management */}
          {!isLoading && profile && (
            <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl mt-8">
              <div className="flex items-center gap-3 mb-2">
                <KeyRound className="text-shm-red" size={22} />
                <h2 className="text-xl font-semibold text-gray-900">Accès terrain hors ligne</h2>
              </div>
              <p className="text-sm text-gray-600">
                Une clé fixe donne accès aux membres et au scan de présence sur les appareils de
                terrain sans connexion internet, sans compte individuel. Elle est fixée dans
                l'application et ne se change pas depuis cet écran.
              </p>
            </div>
          )}

          {/* Diagnostic point 1 : empreinte non réversible de la clé QR,
              à comparer avec celle affichée sur le site des membres pour
              confirmer (ou écarter) un désaccord de clé entre les deux
              déploiements, sans jamais exposer la clé elle-même. */}
          <BadgeKeyFingerprint />
        </main>
      </div>

      <Footer />
    </div>
  );
}
