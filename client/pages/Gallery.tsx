import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Video as VideoIcon } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { API_BASE_URL } from '../lib/apiConfig';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

interface MediaItem {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  description: string | null;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024; // doit correspondre à server/routes/gallery.ts

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDay(items: MediaItem[]): { day: string; items: MediaItem[] }[] {
  const groups = new Map<string, MediaItem[]>();
  for (const item of items) {
    const key = new Date(item.created_at).toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, items]) => ({ day: dayLabel(items[0].created_at), items }));
}

export default function Gallery() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<{ media: MediaItem[] }>(`${API_BASE_URL}/api/gallery`);
      setMedia(data.media || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger la galerie');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError('Fichier trop volumineux (50 Mo maximum).');
      e.target.value = '';
      return;
    }

    setUploading(true);
    setError('');
    try {
      const mediaDataUrl = await fileToDataUrl(file);
      await apiRequest(`${API_BASE_URL}/api/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaDataUrl, description: description.trim() || null }),
      });
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi du fichier");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    const auteur = [item.first_name, item.last_name].filter(Boolean).join(' ') || 'cet auteur';
    if (!window.confirm(`Supprimer définitivement cette publication de ${auteur} ?`)) return;
    setDeletingId(item.id);
    try {
      await apiRequest(`${API_BASE_URL}/api/gallery/${item.id}`, { method: 'DELETE' });
      setMedia((prev) => prev.filter((m) => m.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer cette publication');
    } finally {
      setDeletingId(null);
    }
  };

  const groups = groupByDay(media);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Galerie partagée</h1>
              <span className="text-xs text-gray-400">Vous pouvez modérer (supprimer) toute publication, membre ou chef.</span>
            </div>

            {/* Upload */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ajouter une description (facultatif)..."
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-shm-red"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
                id="gallery-file-input"
              />
              <label
                htmlFor="gallery-file-input"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white cursor-pointer ${uploading ? 'bg-gray-400' : 'bg-shm-red hover:opacity-90'}`}
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                {uploading ? 'Envoi en cours...' : 'Ajouter une photo ou vidéo'}
              </label>
              <p className="text-xs text-gray-400 mt-2">Formats acceptés : JPEG, PNG, WEBP, GIF, MP4, MOV, WEBM — 50 Mo maximum</p>
            </div>

            {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            {loading && (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 size={20} className="animate-spin mr-2" /> Chargement...
              </div>
            )}

            {!loading && groups.length === 0 && !error && (
              <p className="text-center text-gray-400 py-12">Aucune publication pour le moment.</p>
            )}

            {groups.map((group) => (
              <section key={group.day} className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 mb-3">{group.day}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {group.items.map((item) => (
                    <div key={item.id} className="relative group rounded-lg overflow-hidden bg-white shadow-sm border border-gray-200">
                      {item.media_type === 'video' ? (
                        <video src={item.media_url} controls className="w-full h-36 object-cover bg-black" />
                      ) : (
                        <img src={item.media_url} alt={item.description || ''} className="w-full h-36 object-cover" loading="lazy" />
                      )}
                      <div className="p-2">
                        {item.description && <p className="text-xs text-gray-700 line-clamp-2">{item.description}</p>}
                        <p className="text-[11px] text-gray-400 mt-1">
                          {[item.first_name, item.last_name].filter(Boolean).join(' ') || 'Inconnu'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        title="Supprimer (modération)"
                        className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
                      >
                        {deletingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                      {item.media_type === 'video' && (
                        <span className="absolute top-1.5 left-1.5 bg-black/50 text-white rounded-full p-1">
                          <VideoIcon size={12} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
