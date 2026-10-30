import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!email) {
        setError('Veuillez entrer votre adresse email');
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message || 'Erreur lors de l\'envoi du lien');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Erreur lors de l\'envoi du lien de réinitialisation');
      console.error(err);
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Mot de passe oublié</h1>
            <p className="text-gray-600">Réinitialisez votre mot de passe</p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                <CheckCircle className="text-green-600 mx-auto mb-3" size={48} />
                <h2 className="text-lg font-semibold text-green-900 mb-2">Lien envoyé!</h2>
                <p className="text-green-700 text-sm mb-4">
                  Consultez votre email pour le lien de réinitialisation de mot de passe.
                </p>
                <p className="text-green-600 text-xs">
                  Le lien expirera dans 24 heures.
                </p>
              </div>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-slide-down">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adresse email
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Entrez l'email associé à votre compte. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="chef@shm.org"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-shm-red focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-shm-red to-shm-purple text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
                </button>
              </form>

              {/* Back to Login */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 text-shm-red hover:text-shm-purple transition-colors text-sm font-semibold"
                >
                  <ArrowLeft size={16} />
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
