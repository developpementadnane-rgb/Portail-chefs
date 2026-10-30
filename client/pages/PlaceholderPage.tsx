import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="section-title">{title}</h1>
            <p className="text-gray-600">{description}</p>
          </div>

          {/* Placeholder Content */}
          <div className="bg-white rounded-lg shadow-md p-12 text-center shm-glow">
            <div className="bg-blue-50 p-8 rounded-lg inline-block mb-6">
              <Lightbulb className="text-blue-600" size={64} />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Cette page est en construction
            </h2>
            
            <p className="text-gray-600 max-w-lg mx-auto mb-8">
              Les fonctionnalités pour cette section seront bientôt disponibles. 
              Continuez à explorer le portail et revenez plus tard pour voir les mises à jour.
            </p>

            <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <p className="text-sm text-blue-900">
                <strong>💡 Conseil:</strong> Pour contribuer au développement de cette section,
                veuillez nous envoyer vos suggestions via la boîte à idées.
              </p>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
