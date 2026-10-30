import { useState } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { API_BASE_URL } from '../lib/apiConfig';
import { supabase } from '../lib/supabase';

interface SessionForm5WProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function SessionForm5W({ onSuccess, onCancel }: SessionForm5WProps) {
  const [formData, setFormData] = useState({
    title: '', // Quoi?
    location: '', // Où?
    date: '', // Quand?
    category: '', // Qui?
    objective: '', // Pourquoi?
    method: '', // Comment?
  });
  const [images, setImages] = useState<File[]>([]);
  const [preview, setPreview] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowedFormats = ['image/png', 'image/jpeg', 'image/jpg'];

    const validFiles = files.filter((file) => {
      if (!allowedFormats.includes(file.type)) {
        setError(`Format ${file.type} non autorisé. Seuls PNG, JPG et JPEG sont acceptés.`);
        return false;
      }
      return true;
    });

    if (images.length + validFiles.length > 3) {
      setError('Maximum 3 images autorisées');
      return;
    }

    setImages((prev) => [...prev, ...validFiles]);

    // Preview
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview((prev) => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      // Validation
      if (!formData.title || !formData.location || !formData.date) {
        setError('Les champs Quoi?, Où? et Quand? sont obligatoires');
        setIsLoading(false);
        return;
      }

      // Upload images to Supabase storage if any
      let imageUrls: string[] = [];
      if (images.length > 0) {
        for (const image of images) {
          const fileName = `${Date.now()}_${image.name}`;
          const { data, error: uploadError } = await supabase.storage
            .from('session-images')
            .upload(`sessions/${fileName}`, image);

          if (uploadError) throw uploadError;
          
          const { data: publicUrl } = supabase.storage
            .from('session-images')
            .getPublicUrl(`sessions/${fileName}`);
          
          imageUrls.push(publicUrl.publicUrl);
        }
      }

      await apiRequest(`${API_BASE_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          date_time: formData.date,
          location: formData.location,
          target_audience: formData.category,
          objective: formData.objective,
          methodology: formData.method,
          logos: imageUrls,
        }),
      });

      setSuccess(true);
      setFormData({
        title: '',
        location: '',
        date: '',
        category: '',
        objective: '',
        method: '',
      });
      setImages([]);
      setPreview([]);

      if (onSuccess) {
        setTimeout(() => onSuccess(), 2000);
      }
    } catch (err) {
      console.error('[ERROR] Failed to save session:', err);
      setError('Erreur lors de l\'enregistrement de la séance');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ajouter une Séance</h2>
        <p className="text-gray-600">Remplissez le formulaire selon la méthode 5W du Scoutisme</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm font-semibold">Séance enregistrée avec succès!</p>
          <p className="text-green-600 text-sm">Redirection en cours...</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Images Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Images / Logos (max 3)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleImageUpload}
              disabled={images.length >= 3}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="cursor-pointer">
              <Upload className="mx-auto mb-2 text-gray-400" size={24} />
              <p className="text-sm text-gray-600">
                PNG, JPG, JPEG ({images.length}/3)
              </p>
            </label>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              {preview.map((src, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={src}
                    alt={`Preview ${idx}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5W Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quoi? */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quoi? (ماذا؟) *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Titre de la séance pédagogique"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
            />
          </div>

          {/* Où? */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Où? (أين؟) *
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Lieu de la séance"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
            />
          </div>

          {/* Quand? */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quand? (متى؟) *
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
            />
          </div>

          {/* Qui? */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Qui? (من؟)
            </label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              placeholder="Catégorie ou groupe concerné"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
            />
          </div>
        </div>

        {/* Pourquoi? */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pourquoi? (لماذا؟)
          </label>
          <textarea
            name="objective"
            value={formData.objective}
            onChange={handleInputChange}
            placeholder="Objectif pédagogique de la séance"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
          />
        </div>

        {/* Comment? */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comment? (كيف؟)
          </label>
          <textarea
            name="method"
            value={formData.method}
            onChange={handleInputChange}
            placeholder="Description de la méthode, du déroulement et des étapes de la séance"
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shm-red"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-gradient-to-r from-shm-red to-shm-purple text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer la séance'}
          </button>
        </div>
      </form>
    </div>
  );
}
