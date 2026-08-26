import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, ShoppingCart, Plus, Box, IndianRupee, LogOut } from 'lucide-react';
import PrintFieldLogo from '../components/PrintFieldLogo';

type CatalogueItem = {
  id: string;
  brandName?: string;
  name: string;
  description: string;
  price: number;
  purchasePrice?: number;
  sellingPrice?: number;
  gstRate?: number;
  category: string;
  imageUrl?: string;
  sizes?: string[];
};

export default function CataloguePortal() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CatalogueItem[]>([]);

  useEffect(() => {
    const loadCatalogue = async () => {
      try {
        const response = await fetch('/api/catalogue-items');
        if (response.ok) {
          const data = await response.json();
          setItems(data);
          localStorage.setItem('catalogue_items', JSON.stringify(data));
          return;
        }
      } catch (e) {
        console.error("Failed to fetch catalogue items from server, falling back to local storage", e);
      }

      // Fallback
      const saved = localStorage.getItem('catalogue_items');
      if (saved) {
        try {
          setItems(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load catalogue items from local storage", e);
        }
      }
    };

    loadCatalogue();
  }, []);

  const filteredItems = Array.isArray(items) ? items.filter(item => 
    String(item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <PrintFieldLogo layout="horizontal" iconSize="md" variant="dark" />
            <span className="ml-3.5 bg-indigo-50 text-[#2D1F66] text-[10px] px-2.5 py-1 rounded-md font-semibold font-mono tracking-wider border border-indigo-100">CATALOGUE PORTAL</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium">{user?.username} ({user?.role})</span>
            </div>
            <button 
              onClick={logout}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 mt-6">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Catalogue Portal</h1>
            <p className="text-slate-500 mt-1">Browse and request products</p>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search products..."
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors">
              <ShoppingCart className="w-4 h-4" />
              <span>Cart ({cart.length})</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
              <div className="h-48 bg-slate-100 flex items-center justify-center">
                {item.imageUrl ? (
                  <img src={item.imageUrl?.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}` : item.imageUrl} alt={item.brandName ? `${item.brandName} ${item.name}` : item.name} className="w-full h-full object-cover" />
                ) : (
                  <Box className="w-12 h-12 text-slate-300" />
                )}
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-lg text-slate-900 line-clamp-1">{item.brandName ? `${item.brandName} ${item.name}` : item.name}</h3>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2">
                    {item.category}
                  </span>
                </div>
                <p className="text-slate-500 text-sm mt-1 mb-4 flex-grow line-clamp-2">{item.description}</p>
                <div className="mt-auto flex justify-between items-center">
                  <div className="flex flex-col text-left">
                    <span className="text-xs text-slate-500 flex items-center">
                      Cost: <IndianRupee size={10} className="ml-0.5 mr-0.5" />{(item.purchasePrice || 0).toFixed(2)}
                    </span>
                    <span className="font-bold text-emerald-600 text-lg flex items-center">
                      <IndianRupee size={16} className="text-emerald-500 mr-0.5" />
                      {(item.sellingPrice || item.price || 0).toFixed(2)}
                      {item.gstRate ? <span className="text-xs text-emerald-600 ml-1"> + {item.gstRate}% GST</span> : null}
                    </span>
                  </div>
                  <button 
                    onClick={() => setCart([...cart, item])}
                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-full transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-lg border-dashed">
              <Box className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900">No items available</h3>
              <p className="text-slate-500 mt-1">The catalogue is currently empty or no items match your search.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
