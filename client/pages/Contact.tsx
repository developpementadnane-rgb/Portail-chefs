import { useState } from 'react';
import { Phone, Mail, MessageCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface ContactPerson {
  name: string;
  role: string;
  phone: string;
  whatsappLink: string;
  description: string;
}

const contactTeam: ContactPerson[] = [
  {
    name: 'Walid',
    role: 'Responsable du Projet',
    phone: '+212 646 610 766',
    whatsappLink: 'https://wa.me/212646610766',
    description: 'Direction générale et coordination du projet SHM',
  },
  {
    name: 'Adnane',
    role: 'Développement, Problèmes et Réclamations',
    phone: '+212 675 202 336',
    whatsappLink: 'https://wa.me/212675202336',
    description: 'Assistance technique, résolution des problèmes et support utilisateur',
  },
];

export default function Contact() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} userName="Chef Principal" />

      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Nous Contacter</h1>
          <p className="text-xl text-gray-600">
            Entrez en contact avec notre équipe pour toute question ou assistance
          </p>
        </div>

        {/* Contact Methods */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Comment nous joindre?</h2>
          <div className="space-y-4 text-gray-700">
            <p>
              Vous pouvez nous contacter via WhatsApp pour un support rapide et direct. Choisissez
              le contact approprié selon votre question :
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>
                <strong>Responsable du projet:</strong> Coordination générale et questions stratégiques
              </li>
              <li>
                <strong>Développement:</strong> Problèmes techniques, bugs, suggestions d'amélioration
              </li>
            </ul>
          </div>
        </div>

        {/* Team Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Notre Équipe</h2>
          <div className="space-y-4">
            {contactTeam.map((contact, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  {/* Info */}
                  <div className="md:col-span-2">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {contact.name}
                    </h3>
                    <p className="text-shm-red font-semibold text-sm mb-2">
                      {contact.role}
                    </p>
                    <p className="text-gray-600 mb-4">
                      {contact.description}
                    </p>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone size={18} className="text-shm-red" />
                      <span className="font-semibold">{contact.phone}</span>
                    </div>
                  </div>

                  {/* Contact Buttons */}
                  <div className="flex flex-col gap-3">
                    <a
                      href={contact.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
                      <MessageCircle size={20} />
                      WhatsApp
                    </a>
                    <a
                      href={`tel:${contact.phone.replace(/\s/g, '')}`}
                      className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
                      <Phone size={20} />
                      Appeler
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Questions Fréquentes</h2>
          <div className="space-y-6">
            {[
              {
                q: "Quel est le meilleur moyen de nous contacter?",
                a: "WhatsApp est le moyen le plus rapide. Vous recevrez une réponse rapide de notre équipe.",
              },
              {
                q: "Quels sont les horaires de disponibilité?",
                a: "Notre équipe est disponible pendant les heures de bureau. Vous pouvez nous laisser un message et nous répondrons dès que possible.",
              },
              {
                q: "Où puis-je signaler un bug ou un problème?",
                a: "Contactez Adnane directement via WhatsApp avec une description détaillée du problème.",
              },
              {
                q: "Comment puis-je proposer une nouvelle fonctionnalité?",
                a: "Vous pouvez utiliser la boîte à idées dans le portail ou contacter directement Walid avec votre suggestion.",
              },
            ].map((item, idx) => (
              <div key={idx}>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {item.q}
                </h3>
                <p className="text-gray-600">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
