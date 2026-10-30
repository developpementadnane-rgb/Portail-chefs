import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const user = localStorage.getItem('user');
    
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="shm-gradient text-white text-6xl font-bold rounded-lg p-8 inline-flex mb-6 w-32 h-32 items-center justify-center animate-pulse">
          SHM
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Portail des Chefs</h1>
        <p className="text-gray-600">Redirection en cours...</p>
      </div>
    </div>
  );
}
