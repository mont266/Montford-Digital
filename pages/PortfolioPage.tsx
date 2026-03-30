import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Project } from '../components/Portfolio';

const PortfolioPage: React.FC = () => {
  const [portfolioItems, setPortfolioItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Project | null>(null);
  const [formData, setFormData] = useState<Partial<Project>>({
    title: '',
    category: '',
    description: '',
    detailedDescription: '',
    imageSrc: '',
    tags: [],
    links: { webapp: '', android: '', ios: '' },
    isPlaceholder: false,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchPortfolioItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;

      if (data) {
        const formattedItems: Project[] = data.map((item: any) => ({
          id: item.id,
          imageSrc: item.image_src,
          title: item.title,
          category: item.category,
          description: item.description || '',
          detailedDescription: item.detailed_description || '',
          tags: item.tags || [],
          links: {
            webapp: item.link_webapp || '',
            android: item.link_android || '',
            ios: item.link_ios || '',
          },
          isPlaceholder: item.is_placeholder,
        }));
        setPortfolioItems(formattedItems);
      }
    } catch (err: any) {
      console.error('Error fetching portfolio items:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioItems();
  }, []);

  const handleOpenModal = (item?: Project) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        category: item.category,
        description: item.description,
        detailedDescription: item.detailedDescription,
        imageSrc: item.imageSrc,
        tags: item.tags,
        links: {
          webapp: item.links?.webapp || '',
          android: item.links?.android || '',
          ios: item.links?.ios || '',
        },
        isPlaceholder: item.isPlaceholder,
      });
    } else {
      setEditingItem(null);
      setFormData({
        title: '',
        category: '',
        description: '',
        detailedDescription: '',
        imageSrc: '',
        tags: [],
        links: { webapp: '', android: '', ios: '' },
        isPlaceholder: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('link_')) {
      const linkType = name.split('_')[1];
      setFormData(prev => ({
        ...prev,
        links: { ...prev.links, [linkType]: value }
      }));
    } else if (name === 'tags') {
      setFormData(prev => ({ ...prev, tags: value.split(',').map(t => t.trim()).filter(t => t) }));
    } else if (name === 'isPlaceholder') {
      setFormData(prev => ({ ...prev, isPlaceholder: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `portfolio/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file);

      if (uploadError) {
        // If bucket doesn't exist, we might need to create it or use a different approach.
        // For now, let's assume 'public-assets' exists or we handle it.
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, imageSrc: publicUrlData.publicUrl }));
    } catch (err: any) {
      console.error('Error uploading image:', err);
      alert(`Failed to upload image: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      title: formData.title,
      category: formData.category,
      description: formData.description,
      detailed_description: formData.detailedDescription,
      image_src: formData.imageSrc,
      tags: formData.tags,
      link_webapp: formData.links?.webapp || null,
      link_android: formData.links?.android || null,
      link_ios: formData.links?.ios || null,
      is_placeholder: formData.isPlaceholder,
    };

    try {
      if (editingItem && editingItem.id) {
        const { error } = await supabase
          .from('portfolio_items')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('portfolio_items')
          .insert([{ ...payload, order_index: portfolioItems.length }]);
        if (error) throw error;
      }
      
      await fetchPortfolioItems();
      handleCloseModal();
    } catch (err: any) {
      console.error('Error saving portfolio item:', err);
      alert(`Failed to save item: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this portfolio item?')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchPortfolioItems();
    } catch (err: any) {
      console.error('Error deleting item:', err);
      alert(`Failed to delete item: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Portfolio Management</h2>
        <button
          onClick={() => handleOpenModal()}
          className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          + Add Item
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md">{error}</div>}

      {loading && !isModalOpen ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolioItems.map((item) => (
            <div key={item.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
              <div className="h-48 relative">
                <img src={item.imageSrc} alt={item.title} className={`w-full h-full object-cover ${item.isPlaceholder ? 'filter grayscale' : ''}`} />
                {item.isPlaceholder && (
                  <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                    <span className="text-white font-bold">Placeholder</span>
                  </div>
                )}
              </div>
              <div className="p-4 flex-grow flex flex-col">
                <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
                <p className="text-cyan-400 text-sm mb-2">{item.category}</p>
                <p className="text-slate-400 text-sm flex-grow line-clamp-2">{item.description}</p>
                
                <div className="mt-4 flex justify-end gap-2 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => item.id && handleDelete(item.id)}
                    className="text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 px-3 py-1 rounded text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-2xl my-8 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">{editingItem ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Category *</label>
                  <input
                    type="text"
                    name="category"
                    required
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Short Description</label>
                <textarea
                  name="description"
                  rows={2}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Detailed Description</label>
                <textarea
                  name="detailedDescription"
                  rows={4}
                  value={formData.detailedDescription}
                  onChange={handleChange}
                  className="w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Image Source URL *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="imageSrc"
                    required
                    value={formData.imageSrc}
                    onChange={handleChange}
                    className="flex-grow bg-slate-700 border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploadingImage}
                    />
                    <button
                      type="button"
                      disabled={uploadingImage}
                      className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-md transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      {uploadingImage ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
                {formData.imageSrc && (
                  <div className="mt-2 h-32 w-48 rounded overflow-hidden border border-slate-600">
                    <img src={formData.imageSrc} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags?.join(', ')}
                  onChange={handleChange}
                  className="w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="React, Node.js, Design"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Web App Link</label>
                  <input
                    type="url"
                    name="link_webapp"
                    value={formData.links?.webapp}
                    onChange={handleChange}
                    className="w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Android Link</label>
                  <input
                    type="url"
                    name="link_android"
                    value={formData.links?.android}
                    onChange={handleChange}
                    className="w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">iOS Link</label>
                  <input
                    type="url"
                    name="link_ios"
                    value={formData.links?.ios}
                    onChange={handleChange}
                    className="w-full bg-slate-700 border-slate-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  id="isPlaceholder"
                  name="isPlaceholder"
                  checked={formData.isPlaceholder}
                  onChange={handleChange}
                  className="h-4 w-4 text-cyan-500 focus:ring-cyan-500 border-slate-600 rounded bg-slate-700"
                />
                <label htmlFor="isPlaceholder" className="ml-2 block text-sm text-slate-300">
                  Is Placeholder (Coming Soon)
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingImage}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioPage;
