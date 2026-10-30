import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function About() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => {}} userName="Chef Principal" />

      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">À propos</h1>
          <p className="text-xl text-gray-600">
            Découvrez la mission et la vision du portail numérique SHM
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-12">
          {/* Mission Section */}
          <section className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="bg-gradient-to-br from-shm-red to-shm-purple p-3 rounded-lg">
                <span className="text-white text-xl">🎯</span>
              </div>
              Notre Mission
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Le Portail Numérique des Scouts Hassania Marocains (SHM) est une plateforme moderne
              conçue pour digitaliser et optimiser la gestion des activités scoutes. Notre mission
              est de simplifier l'administration des troupes, faciliter la coordination entre les
              chefs et améliorer la qualité des activités pédagogiques à travers une solution
              numérique intégrée et accessible.
            </p>
          </section>

          {/* Vision Section */}
          <section className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="bg-gradient-to-br from-shm-red to-shm-purple p-3 rounded-lg">
                <span className="text-white text-xl">🌟</span>
              </div>
              Notre Vision
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Transformer la gestion administrative scoute en créant un écosystème numérique
              moderne qui permet à chaque chef de se concentrer sur l'essentiel : l'éducation et
              l'engagement des jeunes. Nous aspirons à être le pilier de la digitalisation des
              Scouts Hassania Marocains et à servir de modèle dans le mouvement scout régional.
            </p>
          </section>

          {/* Features Section */}
          <section className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="bg-gradient-to-br from-shm-red to-shm-purple p-3 rounded-lg">
                <span className="text-white text-xl">✨</span>
              </div>
              Fonctionnalités Principales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Gestion des Membres', desc: 'Suivi complet des informations des scouts et chefs' },
                { title: 'Programmation de Séances', desc: 'Planification et organisation des activités scoutes' },
                { title: 'Rapports de Séances', desc: 'Documentation et archivage des activités réalisées' },
                { title: 'Boîte à Idées', desc: 'Collecte et gestion des propositions d\'amélioration' },
                { title: 'Dashboard en Temps Réel', desc: 'Vue d\'ensemble des activités et statistiques' },
                { title: 'Système de Supervision', desc: 'Outils de pilotage pour les responsables' },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Technology Section */}
          <section className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="bg-gradient-to-br from-shm-red to-shm-purple p-3 rounded-lg">
                <span className="text-white text-xl">⚙️</span>
              </div>
              Technologie
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Le portail est construit avec des technologies modernes et fiables :
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {['React', 'TypeScript', 'Supabase', 'TailwindCSS', 'Vite', 'Node.js'].map((tech) => (
                <div
                  key={tech}
                  className="bg-gradient-to-br from-shm-red/10 to-shm-purple/10 border border-shm-red/20 rounded-lg p-3 text-center"
                >
                  <p className="text-sm font-semibold text-gray-900">{tech}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-gradient-to-r from-shm-red to-shm-purple text-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold mb-4">Questions ou Suggestions?</h2>
            <p className="mb-6">
              N'hésitez pas à nous contacter. Notre équipe est disponible pour vous aider.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-white text-shm-red font-semibold py-2 px-6 rounded-lg hover:shadow-lg transition-all"
            >
              Nous Contacter
              <ArrowRight size={18} />
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
