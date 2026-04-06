import React, { useState, memo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Package, Plus, Minus, Search, Trash2,
  Loader2, AlertTriangle, EyeOff, Eye,
  Shirt, Bookmark, QrCode, Bell, BellOff,
  Camera, Image as ImageIcon // Added Camera and Image icon
} from 'lucide-react';

// --- SUB-COMPONENT: STOCK CARD ---
const StockCard = memo(({ item, size, isActuallyLow, toggleSizeVisibility, updateStock }) => {
  const isHidden = item.hidden_sizes?.includes(size);
  const count = item.sizes[size];

  return (
    <div 
      className={`p-5 rounded-[2.5rem] border-2 transition-all flex flex-col justify-between gap-4 
      ${isHidden ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 shadow-sm'}`}
    >
      <div className="flex justify-between items-center">
        <span className={`text-[11px] font-black uppercase ${isHidden ? 'text-slate-400' : 'text-slate-900'}`}>
          {size}
        </span>
        <button
          onClick={() => toggleSizeVisibility(item.id, size)}
          className={`p-2 rounded-xl transition-all ${
            isHidden ? 'bg-slate-200 text-slate-500' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-90'
          }`}
        >
          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <div className="text-center">
        <span className={`text-4xl font-black tracking-tighter block ${
          isActuallyLow && !isHidden ? 'text-amber-600' : 'text-slate-900'
        }`}>
          {count}
        </span>
        <p className="text-[8px] font-black uppercase text-slate-400">In Stock</p>
      </div>

      <div className="flex items-center justify-between bg-slate-100/50 rounded-2xl p-1.5">
        <button 
          onClick={() => updateStock(item.id, size, -1)} 
          className="w-9 h-9 flex items-center justify-center bg-white rounded-xl shadow-sm hover:text-red-500 transition-all active:scale-90"
        >
          <Minus size={14} />
        </button>
        <button 
          onClick={() => updateStock(item.id, size, 1)} 
          className="w-9 h-9 flex items-center justify-center bg-white rounded-xl shadow-sm hover:text-emerald-500 transition-all active:scale-90"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
});

// --- MAIN COMPONENT ---
const AdminInventory = () => {
  const { 
    items = [], 
    addItem, 
    updateStock, 
    deleteItem, 
    toggleSizeVisibility, 
    toggleLowStock 
  } = useApp();

  const [newItemName, setNewItemName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [useSizes, setUseSizes] = useState(true);
  
  // New States for Image Upload
  const [imagePreview, setImagePreview] = useState(null);
  const [base64Image, setBase64Image] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setBase64Image(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredItems = Array.isArray(items)
    ? items.filter(item => item.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setIsRegistering(true);
    try {
      const defaultSizes = useSizes
        ? { S: 0, M: 0, L: 0, XL: 0, XXL: 0 }
        : { "ONE-SIZE": 0 };

      const result = await addItem({
        name: newItemName,
        sizes: defaultSizes,
        category: useSizes ? 'Apparel' : 'Accessory',
        description: '',
        image_url: base64Image, // Save the uploaded image
        is_scannable: true
      });

      if (result && result.success) {
        setNewItemName('');
        setImagePreview(null);
        setBase64Image('');
      } else {
        alert(`Registration failed: ${result?.error || 'Unknown Error'}`);
      }
    } catch (err) {
      alert("Network error. Check if your server is running.");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 text-left animate-in fade-in duration-700">
      
      {/* --- HEADER SECTION --- */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-emerald-950 tracking-tighter uppercase leading-none">
            Inventory <span className="text-emerald-500">Node</span>
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-2">Control stock levels and public store visibility.</p>
        </div>

        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm self-start lg:self-center">
          <QrCode className="text-emerald-500" size={18} />
          <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
            Scanner Integration Active
          </span>
        </div>
      </header>

      {/* --- ACTION GRID --- */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white p-6 md:p-8 rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-100">
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              
              {/* IMAGE UPLOAD PREVIEW */}
              <label className="relative group w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-emerald-400 transition-all shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <Camera className="text-slate-300 group-hover:text-emerald-500 transition-colors" size={24} />
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>

              <div className="relative flex-1 w-full">
                <Package className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input
                  type="text"
                  placeholder="Item Name (e.g., Varsity Hoodie 2026)"
                  className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-3xl outline-none font-bold text-slate-800 transition-all shadow-inner"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={isRegistering || !newItemName.trim()}
                className="w-full md:w-auto px-8 py-5 bg-emerald-950 text-white font-black rounded-3xl hover:bg-black transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-950/20 disabled:opacity-50"
              >
                {isRegistering ? <Loader2 className="animate-spin mx-auto" size={20} /> : "Create Listing"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 px-2">
              <span className="text-[10px] font-black uppercase text-slate-400">Inventory Type:</span>
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setUseSizes(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${useSizes ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <Shirt size={14} /> Apparel
                </button>
                <button
                  type="button"
                  onClick={() => setUseSizes(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${!useSizes ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <Bookmark size={14} /> One-Size
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="xl:col-span-4 bg-emerald-950 p-8 rounded-[3rem] flex flex-col justify-center relative overflow-hidden group">
          <Search className="absolute -right-6 -bottom-6 text-emerald-900/40 w-32 h-32 group-hover:scale-110 transition-transform duration-500" />
          <div className="relative z-10">
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Quick Search</p>
            <input
              type="text"
              placeholder="Filter by name..."
              className="w-full p-5 bg-emerald-900/40 border-2 border-emerald-800 focus:border-emerald-400 rounded-2xl text-white font-bold placeholder:text-emerald-700 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* --- PRODUCT LIST --- */}
      <div className="space-y-8">
        {filteredItems.map((item) => {
          const sizeKeys = Object.keys(item.sizes || {});
          const isActuallyLow = item.is_low_stock === true || Number(item.is_low_stock) === 1;

          return (
            <div 
              key={item.id} 
              className={`bg-white p-6 md:p-10 rounded-[3.5rem] border-2 flex flex-col xl:flex-row gap-10 hover:border-emerald-200 transition-all shadow-sm 
              ${isActuallyLow ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100'}`}
            >
              {/* Product Identity Column */}
              <div className="xl:w-64 flex-shrink-0 flex flex-col justify-between border-b xl:border-b-0 xl:border-r border-slate-100 pb-6 xl:pb-0 xl:pr-10">
                <div className="space-y-4">
                  {/* PRODUCT IMAGE THUMBNAIL */}
                  <div className="w-full aspect-square bg-slate-50 rounded-[2rem] overflow-hidden border border-slate-100 flex items-center justify-center shadow-inner">
                    {item.image_url ? (
                      <img src={item.image_url} className="w-full h-full object-cover" alt={item.name} />
                    ) : (
                      <ImageIcon className="text-slate-200" size={48} />
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${isActuallyLow ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">SKU: {item.id}</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight break-words">
                      {item.name}
                    </h3>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-4">
                  <button
                    onClick={() => toggleLowStock(item.id, isActuallyLow)}
                    className={`flex items-center gap-2 text-[10px] font-black uppercase transition-colors px-4 py-2 rounded-xl border w-fit ${
                      isActuallyLow
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-slate-50 text-slate-400 border-slate-100 hover:text-emerald-600'
                    }`}
                  >
                    {isActuallyLow ? <BellOff size={14} /> : <Bell size={14} />}
                    {isActuallyLow ? "Disable Alert" : "Mark Low Stock"}
                  </button>

                  <button
                    onClick={() => { if (window.confirm(`Permanently delete ${item.name}?`)) deleteItem(item.id) }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-300 hover:text-red-500 transition-colors w-fit px-4"
                  >
                    <Trash2 size={14} /> Remove Listing
                  </button>
                </div>
              </div>

              {/* Grid of Sizes */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 self-start">
                {sizeKeys.map((size) => (
                  <StockCard 
                    key={`${item.id}-${size}`}
                    item={item}
                    size={size}
                    isActuallyLow={isActuallyLow}
                    toggleSizeVisibility={toggleSizeVisibility}
                    updateStock={updateStock}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="py-32 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-200">
          <AlertTriangle className="mx-auto text-slate-200 mb-4" size={48} />
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No matching inventory found</p>
        </div>
      )}
    </div>
  );
};

export default AdminInventory;