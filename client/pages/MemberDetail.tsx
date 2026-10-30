import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, WifiOff, Pencil, Trash2, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCachedMemberById } from '../lib/offline';
import { apiRequest } from '../lib/api';
import { API_BASE_URL } from '../lib/apiConfig';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

interface Member {
  id: string;
  generated_id: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  age: number | null;
  gender: string | null;
  patrol_name: string | null;
  role_name: string | null;
  is_high_patrol: boolean | null;
  user_phone: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_relationship: string | null;
  guardian_cin: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  home_phone: string | null;
  additional_info: string | null;
  pdf_url: string | null;
  qr_code_url: string | null;
  documents_generated_at: string | null;
  created_at: string;
  updated_at: string;
  // Present only when the member came from the offline cache (see
  // membersCache.ts) -- not part of member_profiles itself.
  payment_completed?: boolean;
  documents_completed?: boolean;
}

const fields: { key: keyof Member; label: string }[] = [
  { key: 'id', label: 'ID' }, { key: 'generated_id', label: 'Identifiant généré' }, { key: 'birth_date', label: 'Date de naissance' }, { key: 'age', label: 'Âge' }, { key: 'gender', label: 'Genre' }, { key: 'patrol_name', label: 'Patrouille' }, { key: 'role_name', label: 'Rôle' }, { key: 'is_high_patrol', label: 'Haute patrouille' }, { key: 'user_phone', label: 'Téléphone membre' }, { key: 'guardian_first_name', label: 'Prénom responsable' }, { key: 'guardian_last_name', label: 'Nom responsable' }, { key: 'guardian_relationship', label: 'Lien responsable' }, { key: 'guardian_cin', label: 'CIN responsable' }, { key: 'father_phone', label: 'Téléphone père' }, { key: 'mother_phone', label: 'Téléphone mère' }, { key: 'home_phone', label: 'Téléphone domicile' }, { key: 'additional_info', label: 'Informations complémentaires' }, { key: 'payment_completed', label: 'Cotisation payée' }, { key: 'documents_completed', label: 'Papiers fournis' }, { key: 'pdf_url', label: 'PDF' }, { key: 'qr_code_url', label: 'QR Code' }, { key: 'documents_generated_at', label: 'Documents générés le' }, { key: 'created_at', label: 'Créé le' }, { key: 'updated_at', label: 'Mis à jour le' },
];

// Keep in sync with the `updateSchema` allow-list in
// server/routes/members.ts -- these are the only fields the "Modifier"
// form exposes because they're the only ones the server accepts.
const EDITABLE_FIELDS: { key: keyof Member; label: string; type: 'text' | 'date' | 'textarea' | 'checkbox' }[] = [
  { key: 'first_name', label: 'Prénom', type: 'text' },
  { key: 'last_name', label: 'Nom', type: 'text' },
  { key: 'birth_date', label: 'Date de naissance', type: 'date' },
  { key: 'gender', label: 'Genre', type: 'text' },
  { key: 'is_high_patrol', label: 'Haute patrouille', type: 'checkbox' },
  { key: 'user_phone', label: 'Téléphone membre', type: 'text' },
  { key: 'guardian_first_name', label: 'Prénom responsable', type: 'text' },
  { key: 'guardian_last_name', label: 'Nom responsable', type: 'text' },
  { key: 'guardian_relationship', label: 'Lien responsable', type: 'text' },
  { key: 'guardian_cin', label: 'CIN responsable', type: 'text' },
  { key: 'father_phone', label: 'Téléphone père', type: 'text' },
  { key: 'mother_phone', label: 'Téléphone mère', type: 'text' },
  { key: 'home_phone', label: 'Téléphone domicile', type: 'text' },
  { key: 'additional_info', label: 'Informations complémentaires', type: 'textarea' },
];

export default function MemberDetail() {
  const navigate = useNavigate();
  const { memberId } = useParams<{ memberId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === '1');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadMember = async () => {
    if (!memberId) return;
    setIsLoading(true);
    setError(null);
    setIsFromCache(false);

    // Online-first: try Supabase directly for the freshest data.
    try {
      const { data, error: queryError } = await supabase.from('member_profiles').select('*').eq('id', memberId).maybeSingle();
      if (!queryError && data) {
        setMember(data);
        setIsLoading(false);
        return;
      }
    } catch {
      // Network failure (offline) -- fall through to the local cache below.
    }

    // Offline (or Supabase unreachable): fall back to the locally
    // cached copy of this member, same cache Members.tsx already
    // uses for the list. Without this, this detail page was the
    // only place in the app with zero offline support.
    try {
      const cached = await getCachedMemberById(memberId);
      if (cached) {
        setMember(cached);
        setIsFromCache(true);
      } else {
        setError('Membre introuvable en cache hors-ligne. Connectez-vous une fois en ligne pour synchroniser ses informations.');
      }
    } catch (cacheError) {
      const message = cacheError instanceof Error ? cacheError.message : 'Erreur inconnue';
      setError(`Erreur lors du chargement du membre: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMember();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const renderValue = (key: keyof Member, value: Member[keyof Member]) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if ((key === 'pdf_url' || key === 'qr_code_url') && typeof value === 'string') return <a href={value} target="_blank" rel="noreferrer" className="text-shm-red hover:text-red-700 underline">Ouvrir le fichier</a>;
    return String(value);
  };

  const handleDelete = async () => {
    if (!member) return;
    setIsDeleting(true);
    try {
      await apiRequest(`${API_BASE_URL}/api/members/${member.id}`, { method: 'DELETE' });
      navigate('/members');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer ce membre');
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <button onClick={() => navigate('/members')} className="mb-6 flex items-center gap-2 text-shm-red hover:text-red-700 font-semibold">
              <ArrowLeft size={20} />Retour aux membres
            </button>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-shm-red" />
                <p className="ml-2 text-gray-600">Chargement du membre...</p>
              </div>
            )}

            {!isLoading && !error && !member && (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500">Membre introuvable</p>
              </div>
            )}

            {member && (
              <article className="bg-white rounded-lg shadow-md p-8">
                <div className="mb-6 pb-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{member.first_name || '—'} {member.last_name || ''}</h1>
                    {isFromCache && (
                      <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                        <WifiOff size={14} />Données hors-ligne (dernière synchro locale)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      disabled={isFromCache}
                      title={isFromCache ? 'Connexion requise pour modifier' : undefined}
                      className="flex items-center gap-2 border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Pencil size={16} />Modifier
                    </button>
                    <button
                      onClick={() => setIsDeleting(true)}
                      disabled={isFromCache}
                      title={isFromCache ? 'Connexion requise pour supprimer' : undefined}
                      className="flex items-center gap-2 border border-red-200 text-red-600 font-semibold px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />Supprimer
                    </button>
                  </div>
                </div>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fields.map((field) => (
                    <div key={field.key}>
                      <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
                      <dd className="mt-1 text-gray-900 whitespace-pre-line break-words">{renderValue(field.key, member[field.key])}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            )}
          </div>
        </main>
      </div>
      <Footer />

      {isEditing && member && (
        <EditMemberModal
          member={member}
          onClose={() => {
            setIsEditing(false);
            if (searchParams.get('edit')) {
              searchParams.delete('edit');
              setSearchParams(searchParams, { replace: true });
            }
          }}
          onSaved={() => {
            setIsEditing(false);
            if (searchParams.get('edit')) {
              searchParams.delete('edit');
              setSearchParams(searchParams, { replace: true });
            }
            loadMember();
          }}
        />
      )}

      {isDeleting && member && (
        <ConfirmDeleteModal
          member={member}
          onClose={() => setIsDeleting(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {};
    for (const field of EDITABLE_FIELDS) {
      const raw = member[field.key];
      initial[field.key] = field.type === 'checkbox' ? Boolean(raw) : (raw as string) ?? '';
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string | boolean | null> = {};
      for (const field of EDITABLE_FIELDS) {
        const value = values[field.key];
        payload[field.key] = field.type === 'checkbox' ? Boolean(value) : (value === '' ? null : value);
      }
      await apiRequest(`${API_BASE_URL}/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Modifier {member.first_name} {member.last_name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {EDITABLE_FIELDS.map((field) => (
            <label key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : field.type === 'checkbox' ? 'flex items-center gap-2' : ''}>
              {field.type === 'checkbox' ? (
                <>
                  <input
                    type="checkbox"
                    checked={Boolean(values[field.key])}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                    className="w-5 h-5 accent-shm-red"
                  />
                  <span className="font-medium text-gray-700 text-sm">{field.label}</span>
                </>
              ) : (
                <>
                  <span className="block text-sm font-medium text-gray-700 mb-1">{field.label}</span>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={(values[field.key] as string) ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shm-red"
                    />
                  ) : (
                    <input
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={(values[field.key] as string) ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shm-red"
                    />
                  )}
                </>
              )}
            </label>
          ))}
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-shm-red text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  member,
  onClose,
  onConfirm,
}: {
  member: Member;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const expected = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const matches = confirmText.trim().toLowerCase() === expected.toLowerCase() && expected.length > 0;

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-red-700">Supprimer ce membre ?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Cette action est <strong>irréversible</strong>. Elle supprime définitivement la fiche de{' '}
          <strong>{expected || 'ce membre'}</strong>, son compte de connexion sur l'app membre, et son historique de présence.
        </p>
        <p className="text-sm text-gray-600 mb-2">
          Tapez le nom complet <strong>{expected}</strong> pour confirmer :
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-red-400"
          placeholder={expected}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!matches || deleting}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            {deleting ? 'Suppression...' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  );
}
