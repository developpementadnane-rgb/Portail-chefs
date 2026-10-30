import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Eye, EyeOff, Mail } from 'lucide-react';
import { registerChef, sendVerificationPin, verifyEmailPin } from '../lib/authService';

export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    cin: '',
    can: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    referenceCode: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Verification step: shown either right after a successful
  // registration, or when Login.tsx redirects here because the chef
  // tried to log in on an account whose e-mail was never confirmed
  // (?verify=1&email=...).
  const [verifyEmail, setVerifyEmail] = useState<string | null>(searchParams.get('verify') === '1' ? searchParams.get('email') : null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return Math.min(strength, 5);
  };

  const getPasswordStrengthLabel = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return { label: 'Faible', color: 'bg-red-500', width: '20%' };
      case 2:
        return { label: 'Faible', color: 'bg-orange-500', width: '40%' };
      case 3:
        return { label: 'Moyen', color: 'bg-orange-500', width: '60%' };
      case 4:
        return { label: 'Bon', color: 'bg-green-500', width: '80%' };
      case 5:
        return { label: 'Très fort', color: 'bg-green-600', width: '100%' };
      default:
        return { label: '', color: '', width: '0%' };
    }
  };

  const passwordStrength = calculatePasswordStrength(formData.password);
  const strengthInfo = getPasswordStrengthLabel(passwordStrength);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validation
      if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.password) {
        setError('Tous les champs requis doivent être remplis');
        return;
      }

      if (!formData.cin.trim() || !formData.can.trim()) {
        setError('CIN et CAN sont obligatoires');
        return;
      }

      if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        setError('Adresse e-mail invalide');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Les mots de passe ne correspondent pas');
        return;
      }

      if (formData.password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères');
        return;
      }

      if (!/^[0-9]{3}-[0-9]{3}\/[0-9]{2}$/.test(formData.referenceCode.trim())) {
        setError('Code de vérification invalide (format attendu : 123-456/78)');
        return;
      }

      // Register chef with CIN as identifier (trim all fields)
      const { data, error: regError } = await registerChef({
        cin: formData.cin.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dateOfBirth: formData.dateOfBirth,
        can: formData.can.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        email: formData.email.trim(),
        referenceCode: formData.referenceCode.trim(),
      });

      if (regError) {
        setError(regError);
        return;
      }

      if (data) {
        // Account created but not usable yet: send the confirmation
        // PIN and switch to the verification step instead of going
        // straight to /login (server/routes/auth.ts's login route
        // refuses accounts with an unverified email).
        const { error: pinError } = await sendVerificationPin(formData.email.trim(), formData.firstName.trim());
        if (pinError) {
          setError(`Compte créé, mais l'envoi du code de confirmation a échoué : ${pinError}. Réessayez depuis la page de connexion.`);
          return;
        }
        setVerifyEmail(formData.email.trim().toLowerCase());
        setResendCooldown(60);
      }
    } catch (err) {
      setError('Erreur lors de la création du compte');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmail) return;
    setPinError('');
    setIsVerifying(true);
    try {
      const { error: verifyError } = await verifyEmailPin(verifyEmail, pin);
      if (verifyError) {
        setPinError(verifyError);
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setPinError('Impossible de vérifier le code');
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendPin = async () => {
    if (!verifyEmail || resendCooldown > 0) return;
    setPinError('');
    const { error: resendError } = await sendVerificationPin(verifyEmail, formData.firstName.trim());
    if (resendError) {
      setPinError(resendError);
      return;
    }
    setResendCooldown(60);
  };

  if (verifyEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-xl p-8 animate-fade-in text-center">
            <Mail className="mx-auto mb-4 text-shm-red" size={40} />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirmez votre e-mail</h1>
            <p className="text-gray-600 mb-6">
              Un code à 6 chiffres a été envoyé à <strong>{verifyEmail}</strong>. Il expire dans 5 minutes.
            </p>

            {success ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-left">
                  <p className="text-green-700 text-sm font-semibold">E-mail confirmé !</p>
                  <p className="text-green-600 text-sm">Redirection vers la connexion...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyPin} className="space-y-4">
                {pinError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-left">
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                    <p className="text-red-700 text-sm">{pinError}</p>
                  </div>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-3xl tracking-[0.5em] font-bold px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
                  required
                />
                <button
                  type="submit"
                  disabled={isVerifying || pin.length !== 6}
                  className="w-full bg-gradient-to-r from-shm-red to-shm-purple text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? 'Vérification...' : 'Confirmer'}
                </button>
                <button
                  type="button"
                  onClick={handleResendPin}
                  disabled={resendCooldown > 0}
                  className="text-sm text-shm-red hover:text-shm-purple disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Renvoyer le code (${resendCooldown}s)` : 'Renvoyer le code'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fa9ce189e82c94247a809e38e319392c1%2Ff8865e41e45c4ddf97ad76d8d6891080?format=webp&width=120&height=120"
              alt="SHM Logo"
              className="w-24 h-24 mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Créer un compte</h1>
            <p className="text-gray-600">Inscrivez-vous en tant que chef SHM</p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 animate-slide-down">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-green-700 text-sm font-semibold">Compte créé avec succès!</p>
                <p className="text-green-600 text-sm">Redirection vers la connexion...</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-slide-down">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Dupont"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Jean"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de naissance
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
              />
            </div>

            {/* CIN and CAN Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CIN (Carte Nationale) *
                </label>
                <input
                  type="text"
                  name="cin"
                  value={formData.cin}
                  onChange={handleChange}
                  placeholder="Numéro CIN"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CAN (Code Carte) *
                </label>
                <input
                  type="text"
                  name="can"
                  value={formData.can}
                  onChange={handleChange}
                  placeholder="Code CAN"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse e-mail *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="chef@exemple.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Un code de confirmation à 6 chiffres y sera envoyé</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+212 6XX XXX XXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
              />
            </div>

            {/* Reference code (chef_whitelist) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code de vérification *
              </label>
              <input
                type="text"
                name="referenceCode"
                value={formData.referenceCode}
                onChange={handleChange}
                placeholder="123-456/78"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
              />
              <p className="text-xs text-gray-500 mt-1">Code remis par la cellule des projets (en séance ou par message)</p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-gray-600 hover:text-gray-900"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum 8 caractères</p>
              
              {formData.password && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">Force du mot de passe:</span>
                    <span className={`text-xs font-semibold ${
                      passwordStrength <= 1 ? 'text-red-600' :
                      passwordStrength === 2 ? 'text-orange-600' :
                      passwordStrength === 3 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {strengthInfo.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${strengthInfo.color} transition-all duration-300`}
                      style={{ width: strengthInfo.width }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    <p className={/[a-z]/.test(formData.password) ? 'text-green-600' : ''}>
                      {/[a-z]/.test(formData.password) ? '✓' : '○'} Minuscules
                    </p>
                    <p className={/[A-Z]/.test(formData.password) ? 'text-green-600' : ''}>
                      {/[A-Z]/.test(formData.password) ? '✓' : '○'} Majuscules
                    </p>
                    <p className={/[0-9]/.test(formData.password) ? 'text-green-600' : ''}>
                      {/[0-9]/.test(formData.password) ? '✓' : '○'} Chiffres
                    </p>
                    <p className={/[^a-zA-Z0-9]/.test(formData.password) ? 'text-green-600' : ''}>
                      {/[^a-zA-Z0-9]/.test(formData.password) ? '✓' : '○'} Caractères spéciaux
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2 text-gray-600 hover:text-gray-900"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {formData.password && formData.confirmPassword && (
                <div className="mt-1">
                  {formData.password === formData.confirmPassword ? (
                    <p className="text-xs text-green-600">✓ Les mots de passe correspondent</p>
                  ) : (
                    <p className="text-xs text-red-600">✗ Les mots de passe ne correspondent pas</p>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-shm-red to-shm-purple text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Création en cours...' : 'Créer un compte'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <p className="text-gray-600 text-sm">
              Vous avez déjà un compte ?{' '}
              <Link
                to="/login"
                className="font-semibold text-shm-red hover:text-shm-purple transition-colors"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
