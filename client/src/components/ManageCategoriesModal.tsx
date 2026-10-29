import React, { useState, useEffect, useRef } from 'react';
import { X, Settings, Edit2, Trash2, EyeOff, Eye, Upload, Link as LinkIcon, Image as ImageIcon, Plus, Check, Utensils } from 'lucide-react';
import { categoryApi } from '../services/api';

interface CategoryMeta {
  name: string;
  image: string | null;
  isHidden: boolean;
  mealType?: string;
}

interface MealCategoryMeta {
  name: string;
  isHidden: boolean;
}

interface ManageCategoriesModalProps {
  onClose: () => void;
  onUpdate: () => void; // Triggered when a change is made so parent can refresh products
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ onClose, onUpdate }) => {
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [mealCategories, setMealCategories] = useState<MealCategoryMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMealFilter, setSelectedMealFilter] = useState<string>('All');

  // Meal Category Add / Edit State
  const [newMealName, setNewMealName] = useState('');
  const [addingMeal, setAddingMeal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);
  const [editMealValue, setEditMealValue] = useState('');

  // Food Category Edit State
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMealType, setEditMealType] = useState('Lunch');
  const [editImageMode, setEditImageMode] = useState<'url' | 'upload'>('url');
  const [editImage, setEditImage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [catData, mealData] = await Promise.all([
        categoryApi.getMetas(),
        categoryApi.getMeals()
      ]);
      setCategories(Array.isArray(catData) ? catData : []);
      setMealCategories(Array.isArray(mealData) ? mealData : [
        { name: 'Breakfast', isHidden: false },
        { name: 'Lunch', isHidden: false },
        { name: 'Dinner', isHidden: false }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Meal Category Handlers ---
  const handleAddMealCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newMealName.trim();
    if (!trimmed) return;
    if (mealCategories.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Meal category "${trimmed}" already exists!`);
      return;
    }
    setAddingMeal(true);
    try {
      await categoryApi.addMeal(trimmed);
      setNewMealName('');
      await fetchAllData();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to add meal category');
    } finally {
      setAddingMeal(false);
    }
  };

  const handleStartEditMeal = (meal: MealCategoryMeta) => {
    setEditingMeal(meal.name);
    setEditMealValue(meal.name);
  };

  const handleSaveEditMeal = async (oldName: string) => {
    const trimmed = editMealValue.trim();
    if (!trimmed) return;
    try {
      await categoryApi.updateMeal(oldName, { newName: trimmed });
      if (selectedMealFilter === oldName) {
        setSelectedMealFilter(trimmed);
      }
      setEditingMeal(null);
      setEditMealValue('');
      await fetchAllData();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to update meal category');
    }
  };

  const handleToggleHideMeal = async (meal: MealCategoryMeta) => {
    try {
      await categoryApi.updateMeal(meal.name, { isHidden: !meal.isHidden });
      await fetchAllData();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to update meal category visibility');
    }
  };

  const handleDeleteMeal = async (mealName: string) => {
    if (mealCategories.length <= 1) {
      alert('At least one Meal Category is required.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Meal Category "${mealName}"?`)) return;
    try {
      await categoryApi.deleteMeal(mealName);
      if (selectedMealFilter === mealName) {
        setSelectedMealFilter('All');
      }
      await fetchAllData();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to delete meal category');
    }
  };

  // --- Food Category Handlers ---
  const handleToggleHide = async (cat: CategoryMeta) => {
    try {
      await categoryApi.updateMeta(cat.name, { isHidden: !cat.isHidden });
      await fetchAllData();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to update visibility');
    }
  };

  const handleQuickMealChange = async (cat: CategoryMeta, newMeal: string) => {
    try {
      setCategories(prev => prev.map(c => c.name === cat.name ? { ...c, mealType: newMeal } : c));
      await categoryApi.updateMeta(cat.name, { mealType: newMeal });
      await fetchAllData();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to update meal category');
      fetchAllData();
    }
  };

  const handleDelete = async (catName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${catName}"?\nThis category and all food items inside it will be permanently deleted.`)) return;
    try {
      setCategories(prev => prev.filter(c => c.name !== catName));
      await categoryApi.deleteMeta(catName);
      await fetchAllData();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to delete category');
      fetchAllData();
    }
  };

  const handleStartEdit = (cat: CategoryMeta) => {
    setEditingCategory(cat.name);
    setEditName(cat.name);
    setEditMealType(cat.mealType || mealCategories[0]?.name || 'Lunch');
    setEditImage(cat.image || '');
    setEditImageMode('url');
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditName('');
    setEditImage('');
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB');
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditImage(event.target?.result as string);
      setUploadingImage(false);
    };
    reader.onerror = () => {
      alert('Failed to read image file');
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editName.trim()) return;
    try {
      await categoryApi.updateMeta(editingCategory, {
        newName: editName.trim(),
        image: editImage.trim() || null,
        mealType: editMealType
      });
      setEditingCategory(null);
      await fetchAllData();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to save category');
    }
  };

  const filteredCategories = selectedMealFilter === 'All'
    ? categories
    : categories.filter(c => (c.mealType || 'Lunch') === selectedMealFilter);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#4C1D95] p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/15 backdrop-blur-sm rounded-xl">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-lg leading-tight">Manage Categories</h2>
              <p className="text-violet-200 text-xs font-medium">Add & edit Meal Categories and Food Categories</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-[#F9FAFB]">
          
          {/* SECTION 1: INDIVIDUAL MEAL CATEGORIES MANAGEMENT */}
          <div className="bg-white rounded-2xl border border-[#D1D5DB] p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#F5F3FF] text-[#4C1D95] rounded-lg">
                  <Utensils size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-[#111827] uppercase tracking-wider">Meal Categories</h3>
                  <p className="text-[11px] text-[#4B5563] font-medium">Add, rename, hide, or delete individual meal categories</p>
                </div>
              </div>

              {/* Add New Meal Category Form */}
              <form onSubmit={handleAddMealCategory} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  placeholder="New Meal Category (e.g. Snacks)"
                  className="bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-1.5 text-xs font-bold text-[#111827] outline-none w-48 sm:w-52"
                />
                <button
                  type="submit"
                  disabled={addingMeal || !newMealName.trim()}
                  className="px-3 py-1.5 bg-[#4C1D95] hover:bg-[#5B21B6] disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </form>
            </div>

            {/* Individual Meal Categories List */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {mealCategories.map(meal => {
                const isEditingThisMeal = editingMeal === meal.name;
                return (
                  <div
                    key={meal.name}
                    className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 transition-all ${
                      isEditingThisMeal
                        ? 'border-[#4C1D95] bg-[#F5F3FF]/40 ring-2 ring-[#4C1D95]/10'
                        : 'border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#4C1D95]/50'
                    }`}
                  >
                    {isEditingThisMeal ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={editMealValue}
                          onChange={(e) => setEditMealValue(e.target.value)}
                          className="flex-1 bg-white border-2 border-[#4C1D95] rounded-lg px-2.5 py-1 text-xs font-extrabold text-[#111827] outline-none min-w-0"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditMeal(meal.name);
                            if (e.key === 'Escape') setEditingMeal(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditMeal(meal.name)}
                          title="Save Meal Category"
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingMeal(null)}
                          title="Cancel"
                          className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-extrabold text-xs truncate ${meal.isHidden ? 'text-gray-400 line-through' : 'text-[#111827]'}`}>
                            {meal.name}
                          </span>
                          {meal.isHidden && (
                            <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                              Hidden
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleHideMeal(meal)}
                            title={meal.isHidden ? 'Unhide Meal Category' : 'Hide Meal Category'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              meal.isHidden
                                ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                : 'bg-white text-gray-500 hover:bg-orange-50 hover:text-orange-600 border border-gray-200'
                            }`}
                          >
                            {meal.isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditMeal(meal)}
                            title="Edit Meal Category Name"
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMeal(meal.name)}
                            title="Delete Meal Category"
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: FOOD CATEGORIES LIST WITH INDIVIDUAL MEAL CATEGORY OPTION */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-[#111827] uppercase tracking-wider">
                Food Categories ({filteredCategories.length})
              </h3>

              {/* Filter by Meal Category */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedMealFilter('All')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    selectedMealFilter === 'All'
                      ? 'bg-[#4C1D95] text-white shadow-xs'
                      : 'bg-white text-[#4B5563] border border-[#D1D5DB] hover:border-[#4C1D95]'
                  }`}
                >
                  All
                </button>
                {mealCategories.map(meal => (
                  <button
                    key={meal.name}
                    type="button"
                    onClick={() => setSelectedMealFilter(meal.name)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      selectedMealFilter === meal.name
                        ? 'bg-[#4C1D95] text-white shadow-xs'
                        : 'bg-white text-[#4B5563] border border-[#D1D5DB] hover:border-[#4C1D95]'
                    }`}
                  >
                    {meal.name}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-10 text-[#4B5563] text-sm font-bold animate-pulse">Loading categories...</div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-10 text-[#4B5563] text-sm font-bold bg-white rounded-2xl border border-[#D1D5DB]">
                No food categories found.
              </div>
            ) : (
              filteredCategories.map(cat => {
                const isEditing = editingCategory === cat.name;

                return (
                  <div
                    key={cat.name}
                    className={`bg-white rounded-2xl border transition-all ${
                      isEditing
                        ? 'border-[#4C1D95] shadow-md ring-2 ring-[#4C1D95]/10 p-4'
                        : 'border-[#D1D5DB] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#4C1D95]'
                    }`}
                  >
                    {!isEditing ? (
                      <>
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                            {cat.image ? (
                              <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={20} className="text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-extrabold text-sm ${cat.isHidden ? 'text-gray-400 line-through' : 'text-[#111827]'}`}>
                                {cat.name}
                              </p>
                              {cat.isHidden && (
                                <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Hidden
                                </span>
                              )}
                            </div>

                            {/* Individual Meal Category Selector right on the Category row */}
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-bold text-[#6B7280] uppercase">Meal:</span>
                              <select
                                value={cat.mealType || 'Lunch'}
                                onChange={(e) => handleQuickMealChange(cat, e.target.value)}
                                className="bg-[#F5F3FF] border border-[#DDD6FE] text-[#4C1D95] text-[11px] font-extrabold rounded-lg px-2 py-0.5 outline-none focus:border-[#4C1D95] cursor-pointer"
                              >
                                {mealCategories.map(m => (
                                  <option key={m.name} value={m.name}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleHide(cat)}
                            title={cat.isHidden ? 'Unhide' : 'Hide'}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                              cat.isHidden
                                ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                : 'bg-gray-50 text-gray-500 hover:bg-orange-50 hover:text-orange-600'
                            }`}
                          >
                            {cat.isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            title="Edit Category & Meal Category"
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat.name)}
                            title="Delete"
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        {/* Name Edit */}
                        <div>
                          <label className="block text-[10px] font-bold text-[#4B5563] uppercase tracking-wider mb-1">
                            Category Name
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border-2 border-[#4C1D95] rounded-xl px-3 py-2 text-sm font-bold text-[#111827] outline-none"
                          />
                        </div>

                        {/* Individual Meal Category Option in Edit Mode */}
                        <div>
                          <label className="block text-[10px] font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
                            Meal Category
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {mealCategories.map(meal => (
                              <button
                                key={meal.name}
                                type="button"
                                onClick={() => setEditMealType(meal.name)}
                                className={`w-full px-2 py-2 rounded-xl font-extrabold text-xs transition-all border cursor-pointer truncate ${
                                  editMealType === meal.name
                                    ? 'bg-[#4C1D95] text-white border-[#4C1D95] shadow-sm'
                                    : 'bg-[#F9FAFB] text-[#4B5563] border-[#D1D5DB] hover:border-[#4C1D95]'
                                }`}
                              >
                                {meal.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Image Edit */}
                        <div className="bg-[#F9FAFB] p-3 rounded-xl border border-[#D1D5DB]">
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-[10px] font-bold text-[#4B5563] uppercase tracking-wider">
                              Category Image
                            </label>

                            <div className="flex bg-[#FFFFFF] p-0.5 rounded-lg border border-[#D1D5DB] text-[10px]">
                              <button
                                type="button"
                                onClick={() => setEditImageMode('upload')}
                                className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                  editImageMode === 'upload'
                                    ? 'bg-[#4C1D95] text-white shadow-xs'
                                    : 'text-[#4B5563] hover:text-[#111827]'
                                }`}
                              >
                                <Upload size={10} /> <span>Upload</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditImageMode('url')}
                                className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                  editImageMode === 'url'
                                    ? 'bg-[#4C1D95] text-white shadow-xs'
                                    : 'text-[#4B5563] hover:text-[#111827]'
                                }`}
                              >
                                <LinkIcon size={10} /> <span>URL</span>
                              </button>
                            </div>
                          </div>

                          {editImageMode === 'upload' ? (
                            <div>
                              <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                className="hidden"
                                onChange={handleImageFileChange}
                              />
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-2 bg-white border border-[#D1D5DB] hover:border-[#4C1D95] rounded-lg text-xs font-bold text-[#4B5563] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                disabled={uploadingImage}
                              >
                                <Upload size={14} />
                                <span>{uploadingImage ? 'Processing...' : 'Choose File from Device'}</span>
                              </button>
                            </div>
                          ) : (
                            <input
                              type="url"
                              value={editImage}
                              onChange={(e) => setEditImage(e.target.value)}
                              placeholder="Paste image URL here..."
                              className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-lg px-3 py-2 text-xs font-medium outline-none transition-colors"
                            />
                          )}

                          {editImage && (
                            <div className="mt-3 flex items-start gap-3">
                              <img
                                src={editImage}
                                alt="Preview"
                                className="w-12 h-12 rounded-lg object-cover border border-[#D1D5DB] shadow-sm bg-white"
                              />
                              <div className="flex-1">
                                <p className="text-[10px] text-green-600 font-bold mb-1">✓ Image Preview Ready</p>
                                <button
                                  type="button"
                                  onClick={() => setEditImage('')}
                                  className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
                                >
                                  Remove Image
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="px-4 py-2 bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold rounded-xl transition-colors shadow-md cursor-pointer"
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
