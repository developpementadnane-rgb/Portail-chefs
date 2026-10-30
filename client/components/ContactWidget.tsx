import { useState } from 'react';
import { MessageCircle, X, Phone } from 'lucide-react';

interface Contact {
  name: string;
  role: string;
  phone: string;
  whatsappLink: string;
}

const contacts: Contact[] = [
  {
    name: 'Walid',
    role: 'Responsable du projet',
    phone: '+212 646 610 766',
    whatsappLink: 'https://wa.me/212646610766',
  },
  {
    name: 'Adnane',
    role: 'Développement, problèmes et réclamations',
    phone: '+212 675 202 336',
    whatsappLink: 'https://wa.me/212675202336',
  },
];

export default function ContactWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Contact Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 bg-gradient-to-r from-green-400 to-green-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow z-40"
          aria-label="Ouvrir les contacts"
          title="Nous contacter"
        >
          <Phone size={24} />
        </button>
      )}

      {/* Contact Window */}
      {isOpen && (
        <div className="fixed bottom-6 left-6 w-96 max-h-96 bg-white rounded-lg shadow-2xl flex flex-col z-50 animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-400 to-green-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div>
              <h3 className="font-bold">Nous Contacter</h3>
              <p className="text-xs opacity-90">Équipe SHM</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {contacts.map((contact, idx) => (
              <a
                key={idx}
                href={contact.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-lg p-4 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {contact.name}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {contact.role}
                    </p>
                    <p className="text-sm text-green-600 font-medium mt-2">
                      {contact.phone}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <MessageCircle className="text-green-600" size={24} />
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Info Footer */}
          <div className="border-t border-gray-200 bg-gray-50 p-3 rounded-b-lg text-center">
            <p className="text-xs text-gray-600">
              Cliquez sur un contact pour ouvrir WhatsApp
            </p>
          </div>
        </div>
      )}
    </>
  );
}
