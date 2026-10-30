import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IdCard, Lock, AlertCircle, Eye, EyeOff, WifiOff } from 'lucide-react';
import { loginChef } from '../lib/authService';
import { runInitialSync } from '../lib/offline';

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  cin?: string;
  password?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cin, setCin] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleFieldChange = (field: keyof FieldErrors, value: string) => {
    if (field === 'firstName') setFirstName(value);
    if (field === 'lastName') setLastName(value);
    if (field === 'cin') setCin(value);
    if (field === 'password') setPassword(value);

    // Supprimer l'erreur du champ quand l'utilisateur le modifie
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsLoading(true);

    try {
      // Normalisation: trim automatique de tous les champs
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const trimmedCin = cin.trim();
      const trimmedPassword = password;

      console.log('[DEBUG LOGIN] Données après normalisation:');
      console.log('  firstName:', `"${trimmedFirstName}"`);
      console.log('  lastName:', `"${trimmedLastName}"`);
      console.log('  cin:', `"${trimmedCin}"`);

      // Validation des champs requis
      const newFieldErrors: FieldErrors = {};

      if (!trimmedFirstName) {
        newFieldErrors.firstName = 'Le prénom est requis';
      }
      if (!trimmedLastName) {
        newFieldErrors.lastName = 'Le nom est requis';
      }
      if (!trimmedCin) {
        newFieldErrors.cin = 'Le CIN est requis';
      }
      if (!trimmedPassword) {
        newFieldErrors.password = 'Le mot de passe est requis';
      }

      if (Object.keys(newFieldErrors).length > 0) {
        setFieldErrors(newFieldErrors);
        setIsLoading(false);
        return;
      }

      console.log('[DEBUG LOGIN] Validation OK - appel du service loginChef...');

      const { data, error: authError, errorCode, email: unverifiedEmail } = await loginChef(
        trimmedCin,
        trimmedPassword,
        trimmedFirstName,
        trimmedLastName,
        rememberMe
      );

      console.log('[DEBUG LOGIN] Réponse du service:');
      console.log('  error:', authError);
      console.log('  data:', data);

      if (authError) {
        if (errorCode === 'EMAIL_NOT_VERIFIED' && unverifiedEmail) {
          navigate(`/signup?verify=1&email=${encodeURIComponent(unverifiedEmail)}`);
          setIsLoading(false);
          return;
        }
        setError(authError);
        console.log('[DEBUG LOGIN] Erreur d\'authentification:', authError);
        setIsLoading(false);
        return;
      }

      if (data) {
        console.log('[DEBUG LOGIN] Vérification du nom/prénom...');
        console.log('  Formulaire - firstName:', `"${trimmedFirstName}"`, '| lastName:', `"${trimmedLastName}"`);
        console.log('  BD - first_name:', `"${data.first_name}"`, '| last_name:', `"${data.last_name}"`);

        // Verify name matches (case-insensitive and trimmed)
        if (
          data.first_name.trim().toLowerCase() !==
            trimmedFirstName.toLowerCase() ||
          data.last_name.trim().toLowerCase() !== trimmedLastName.toLowerCase()
        ) {
          const newErrors: FieldErrors = {};
          if (
            data.first_name.trim().toLowerCase() !==
            trimmedFirstName.toLowerCase()
          ) {
            newErrors.firstName = 'Le prénom ne correspond pas au CIN';
          }
          if (
            data.last_name.trim().toLowerCase() !==
            trimmedLastName.toLowerCase()
          ) {
            newErrors.lastName = 'Le nom ne correspond pas au CIN';
          }
          setFieldErrors(newErrors);
          console.log('[DEBUG LOGIN] Erreur: nom/prénom ne correspondent pas');
          setIsLoading(false);
          return;
        }

        console.log('[DEBUG LOGIN] Authentification réussie! Redirection...');

        // Kick off the initial offline sync (member roster + relevant
        // sessions) in the background. Deliberately not awaited: the
        // chef shouldn't wait on a full member-list download before
        // seeing the dashboard, and if it fails (e.g. flaky network
        // right after login) the app still works normally online —
        // it'll just retry on the next reconnect (see
        // client/App.tsx's 'online' listener).
        runInitialSync().catch((syncError) => {
          console.warn('[offline] Initial sync failed, will retry on next reconnect:', syncError);
        });

        navigate('/dashboard');
      }
    } catch (err) {
      setError('Erreur de connexion. Veuillez réessayer.');
      console.error('[ERROR LOGIN]', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fa9ce189e82c94247a809e38e319392c1%2Ff8865e41e45c4ddf97ad76d8d6891080?format=webp&width=120&height=120"
              alt="SHM Logo"
              className="w-24 h-24 mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Portail des Chefs
            </h1>
            <p className="text-gray-600">Connexion à votre compte</p>
          </div>

          {/* General Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-slide-down">
              <AlertCircle
                className="text-red-600 flex-shrink-0 mt-0.5"
                size={20}
              />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) =>
                    handleFieldChange('lastName', e.target.value)
                  }
                  placeholder="Dupont"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
                    fieldErrors.lastName
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-shm-red'
                  }`}
                  required
                />
                {fieldErrors.lastName && (
                  <p className="text-red-500 text-xs mt-1">
                    {fieldErrors.lastName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) =>
                    handleFieldChange('firstName', e.target.value)
                  }
                  placeholder="Jean"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
                    fieldErrors.firstName
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-shm-red'
                  }`}
                  required
                />
                {fieldErrors.firstName && (
                  <p className="text-red-500 text-xs mt-1">
                    {fieldErrors.firstName}
                  </p>
                )}
              </div>
            </div>

            {/* CIN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numéro CIN *
              </label>
              <div className="relative">
                <IdCard
                  className="absolute left-3 top-3 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  value={cin}
                  onChange={(e) => handleFieldChange('cin', e.target.value)}
                  placeholder="Votre numéro CIN"
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
                    fieldErrors.cin
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-shm-red'
                  }`}
                  required
                />
              </div>
              {fieldErrors.cin && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.cin}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe *
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-3 text-gray-400"
                  size={20}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) =>
                    handleFieldChange('password', e.target.value)
                  }
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
                    fieldErrors.password
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-shm-red'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-600 hover:text-gray-900 transition-colors"
                  aria-label={
                    showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-shm-red focus:ring-shm-red"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600 select-none">
                Se souvenir de moi (rester connecté 21 jours)
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-shm-red to-shm-purple text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 space-y-4">
            <div className="text-center text-xs text-gray-500">
              <p>Vous avez oublié votre mot de passe?</p>
              <p className="mt-1">Contactez votre administrateur SHM</p>
            </div>

            <div className="pt-4 border-t border-gray-200 text-center">
              <p className="text-gray-600 text-sm">
                Nouveau chef ?{' '}
                <Link
                  to="/signup"
                  className="font-semibold text-shm-red hover:text-shm-purple transition-colors"
                >
                  Créer un compte
                </Link>
              </p>
              </div>

            {/* Accès hors ligne — bouton pleine largeur, bien visible,
                pas juste un petit lien texte : sur le terrain (camp,
                sans réseau, situation parfois pressée), ce chemin doit
                être trouvable en un coup d'œil, pas caché en bas de
                page en petit texte gris. */}
            <Link
              to="/offline-access"
              className="flex items-center justify-center gap-2 w-full bg-white border-2 border-shm-red/30 text-shm-red font-semibold py-2.5 px-4 rounded-lg hover:bg-shm-red/5 hover:border-shm-red transition-all duration-200"
            >
              <WifiOff size={18} />
              Sur le terrain, sans connexion ?
            </Link>
          </div>
      </div>
    </div>
    </div>
  );
}
