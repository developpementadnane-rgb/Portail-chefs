import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center max-w-md">
        <div className="bg-red-50 p-8 rounded-lg inline-block mb-6">
          <AlertCircle className="text-red-600 mx-auto" size={64} />
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-3">404</h1>
        <p className="text-xl text-gray-600 mb-2">Page non trouvée</p>
        <p className="text-gray-500 mb-8 text-sm">
          La page que vous recherchez n'existe pas ou a été supprimée.
        </p>
        <div className="space-y-3">
          <Link
            to="/dashboard"
            className="inline-block w-full bg-gradient-to-r from-shm-red to-shm-purple text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition-all duration-200"
          >
            Retour au Dashboard
          </Link>
          <Link
            to="/login"
            className="inline-block w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Aller à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
