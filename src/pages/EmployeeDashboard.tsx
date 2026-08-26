import { Link } from "react-router-dom";
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, List, LogOut, CheckCircle2, Search, Calendar, Edit, Download, Undo, IndianRupee, Box, Tag, BookOpen, ShoppingBag, ShoppingCart, FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import PrintFieldLogo from '../components/PrintFieldLogo';
import AutocompleteInput from '../components/AutocompleteInput';
import { downloadTicketPdf, downloadCartPdf } from '../utils/generatePdf';

type OrderItem = {
  id: string;
  productName: string;
  description: string;
  vendorName: string;
  quantity: number | '';
  selectedSize?: string;
  price: number | '';
  purchasePrice?: number;
  gstRate: number;
};

type Ticket = {
  id: string;
  ticketNumber?: number;
  customerName: string;
  purchaseOrderNumber?: string;
  requesterName?: string;
  requesterPhone?: string;
  ticketDate: string;
  handoverDate: string;
  items: Array<{ id: string, productName: string, description?: string, vendorName?: string, quantity: number, price: number, gstRate?: number }>;
  employeeId: string;
  employeeName: string;
  status?: "pending" | "done";
  delayReason?: string;
  newHandoverDate?: string;
};

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [handoverDate, setHandoverDate] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ id: uuidv4(), productName: '', description: '', vendorName: '', quantity: 1, price: 0, purchasePrice: 0, gstRate: 5 }]);
  const [productsList, setProductsList] = useState<string[]>([]);
  const [customersList, setCustomersList] = useState<string[]>([]);
  const [vendorsList, setVendorsList] = useState<string[]>([]);
  const [catalogueItems, setCatalogueItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  
  // My Tickets Tab States
  const [activeTab, setActiveTab] = useState<'raise' | 'mine' | 'catalogue'>('raise');
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
    const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueCategory, setCatalogueCategory] = useState('');
  const [catalogueMinPrice, setCatalogueMinPrice] = useState('');
  const [catalogueMaxPrice, setCatalogueMaxPrice] = useState('');
  const [catalogueSelectedIds, setCatalogueSelectedIds] = useState<Set<string>>(new Set());

  // Cart Tab States
  const [cart, setCart] = useState<any[]>([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [sizeModalItem, setSizeModalItem] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');


  const handleAddToCartClick = (item: any) => {
    if (item.sizes && item.sizes.length > 0) {
      setSizeModalItem(item);
      setSelectedSize(item.sizes[0]);
    } else {
      addToCart(item);
    }
  };

  const confirmAddToCartWithSize = () => {
    if (!sizeModalItem) return;
    addToCart({ ...sizeModalItem, selectedSize });
    setSizeModalItem(null);
    setSelectedSize('');
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.selectedSize === item.selectedSize);
      if (existing) {
        return prev;
      }
      return [...prev, {
        id: item.id,
        name: item.name + (item.selectedSize ? ` - Size: ${item.selectedSize}` : ''),
        description: item.description || '',
        category: item.category || '',
        purchasePrice: item.purchasePrice || 0,
        price: item.sellingPrice !== undefined ? item.sellingPrice : (item.price || 0),
        gstRate: item.gstRate || 0,
        imageUrl: item.imageUrl,
        quantity: 1,
        selectedSize: item.selectedSize
      }];
    });
    setSuccessMsg(`Added "${item.brandName ? `${item.brandName} ${item.name}` : item.name}" to cart!`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const updateCartItemPrice = (id: string, price: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, price: price } : item));
  };

  const updateCartItemQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleExportCartPdf = () => {
    if (cart.length === 0) return;
    downloadCartPdf(cart, user, false);
    setCart([]);
  };

  useEffect(() => {
    if (activeTab === 'raise') {
      fetchProducts();
      fetchCatalogue();
      fetchCustomers();
      fetchVendors();
    } else if (activeTab === 'mine') {
      fetchMyTickets();
    } else if (activeTab === 'catalogue') {
      fetchCatalogue();
    }
  }, [activeTab]);

  const fetchMyTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const text = await res.text();
        try {
          if (text && !text.trim().startsWith('<')) {
            const allTickets: Ticket[] = JSON.parse(text);
            setMyTickets(allTickets.filter(t => t.employeeId === user?.id));
          } else {
            console.warn("Backend returned HTML instead of JSON for tickets.");
          }
        } catch (e) {
          console.warn("Backend returned invalid JSON for tickets.", e);
        }
      }
    } catch (err) { console.warn(err); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const text = await res.text();
        try {
          if (text && !text.trim().startsWith('<')) {
            setProductsList(JSON.parse(text));
          } else {
            console.warn("Backend returned HTML instead of JSON for products.");
          }
        } catch (e) {
          console.warn("Backend returned invalid JSON for products", e);
        }
      }
    } catch (err) { console.warn(err); }
  };

  
  const catalogueCategories = Array.from(new Set(catalogueItems.map(item => item.category || 'Uncategorized'))).sort();
  
  const filteredCatalogueItems = catalogueItems.filter(item => {
    const searchMatch = String(item.name || '').toLowerCase().includes(catalogueSearch.toLowerCase()) || 
                       String(item.category || '').toLowerCase().includes(catalogueSearch.toLowerCase()) ||
                       String(item.description || '').toLowerCase().includes(catalogueSearch.toLowerCase());
    
    const categoryMatch = !catalogueCategory || catalogueCategory === (item.category || 'Uncategorized');
    
    const itemPrice = item.sellingPrice !== undefined ? item.sellingPrice : (item.price || 0);
    const minMatch = !catalogueMinPrice || itemPrice >= parseFloat(catalogueMinPrice);
    const maxMatch = !catalogueMaxPrice || itemPrice <= parseFloat(catalogueMaxPrice);
    
    return searchMatch && categoryMatch && minMatch && maxMatch;
  });

  const handleSelectAllCatalogue = () => {
    if (catalogueSelectedIds.size === filteredCatalogueItems.length && filteredCatalogueItems.length > 0) {
      setCatalogueSelectedIds(new Set());
    } else {
      setCatalogueSelectedIds(new Set(filteredCatalogueItems.map(i => i.id)));
    }
  };

  const toggleCatalogueSelect = (id: string) => {
    setCatalogueSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelectedCatalogueToCart = () => {
    const selected = filteredCatalogueItems.filter(i => catalogueSelectedIds.has(i.id));
    selected.forEach(item => addToCart(item));
    setCatalogueSelectedIds(new Set());
  };

  const fetchCatalogue = async () => {
    try {
      const res = await fetch('/api/catalogue-items');
      if (res.ok) {
        const text = await res.text();
        try {
          if (text && !text.trim().startsWith('<')) {
            const data = JSON.parse(text);
            setCatalogueItems(data);
            const catNames = data.map((item: any) => item.name);
            setProductsList(prev => {
              const combined = [...new Set([...prev, ...catNames])];
              return combined;
            });
          } else {
            console.warn("Backend returned HTML instead of JSON for catalogue items.");
          }
        } catch (e) {
          console.warn("Backend returned invalid JSON for catalogue items", e);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch catalogue items:", err);
    }
  };
  
  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const text = await res.text();
        try {
          if (text && !text.trim().startsWith('<')) {
            setCustomersList(JSON.parse(text));
          } else {
            console.warn("Backend returned HTML instead of JSON for customers.");
          }
        } catch (e) {
          console.warn("Backend returned invalid JSON for customers", e);
        }
      }
    } catch (err) { console.warn(err); }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/vendors');
      if (res.ok) {
        const text = await res.text();
        try {
          if (text && !text.trim().startsWith('<')) {
            setVendorsList(JSON.parse(text));
          } else {
            console.warn("Backend returned HTML instead of JSON for vendors.");
          }
        } catch (e) {
          console.warn("Backend returned invalid JSON for vendors", e);
        }
      }
    } catch (err) { console.warn(err); }
  };

  const handleBlur = async (type: 'product' | 'vendor' | 'customer', value: string) => {
    const cleanName = value.trim();
    if (!cleanName) return;

    try {
      if (type === 'vendor' && !vendorsList.some(v => v.toLowerCase() === cleanName.toLowerCase())) {
        await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName }) });
        setVendorsList(prev => [...prev, cleanName]);
      } else if (type === 'customer' && !customersList.some(c => c.toLowerCase() === cleanName.toLowerCase())) {
        await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName }) });
        setCustomersList(prev => [...prev, cleanName]);
      }
    } catch (err) {
      console.error(`Failed to dynamically add ${type}`, err);
    }
  };

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) return;
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProductName }),
      });
      if (res.ok) {
        setNewProductName('');
        setIsAddingProduct(false);
        fetchProducts();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add product');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to add product');
    }
  };

  const currentFormattedDate = format(new Date(), 'yyyy-MM-dd');

  const addItem = () => {
    const newId = uuidv4();
    setItems([...items, { id: newId, productName: '', description: '', vendorName: '', quantity: 1, price: 0, gstRate: 5 }]);
    setTimeout(() => document.getElementById(`product-${newId}`)?.focus(), 50);
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.defaultPrevented) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
      if (target.getAttribute('type') === 'submit') return;
      
      e.preventDefault();
      const form = target.closest('form');
      if (!form) return;
      
      const focusable = Array.from(form.querySelectorAll<HTMLElement>('input, select, textarea, button[type="submit"]'))
        .filter(el => !el.hidden && !(el as any).disabled && el.tabIndex !== -1);
      
      const index = focusable.indexOf(target);
      if (index > -1 && index < focusable.length - 1) {
        focusable[index + 1].focus();
      }
    } else if (e.key === 'Escape') {
      if (e.defaultPrevented) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') return;
      
      e.preventDefault();
      const form = target.closest('form');
      if (!form) return;
      
      const focusable = Array.from(form.querySelectorAll<HTMLElement>('input, select, textarea, button[type="submit"]'))
        .filter(el => !el.hidden && !(el as any).disabled && el.tabIndex !== -1);
      
      const index = focusable.indexOf(target);
      if (index > 0) {
        focusable[index - 1].focus();
      }
    }
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        if (field === 'quantity' || field === 'price' || field === 'gstRate') {
          value = value === '' ? '' : Number(value);
        }
        let updated = { ...item, [field]: value };
        if (field === 'productName') {
          const match = catalogueItems.find(c => String(c.name || '').toLowerCase() === value.trim().toLowerCase());
          if (match) {
            updated.price = match.sellingPrice !== undefined ? match.sellingPrice : (match.price !== undefined ? match.price : 0);
            updated.purchasePrice = match.purchasePrice !== undefined ? match.purchasePrice : 0;
            if (match.description) {
              updated.description = match.description;
            }
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');

    const ticketPayload: any = {
      customerName,
      purchaseOrderNumber,
      requesterName,
      requesterPhone,
      handoverDate,
      items: items.map(item => ({
        ...item,
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0
      }))
    };

    if (!editingTicketId) {
      ticketPayload.ticketDate = new Date().toISOString();
      ticketPayload.employeeId = user?.id;
      ticketPayload.employeeName = user?.username;
    }

    try {
      const url = editingTicketId ? `/api/tickets/${editingTicketId}` : '/api/tickets';
      const method = editingTicketId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketPayload),
      });

      if (res.ok) {
        setSuccessMsg(editingTicketId ? 'Ticket updated successfully!' : 'Ticket raised successfully!');
        setCustomerName('');
        setPurchaseOrderNumber('');
        setRequesterName('');
        setRequesterPhone('');
        setHandoverDate('');
        setItems([{ id: uuidv4(), productName: '', description: '', vendorName: '', quantity: 1, price: 0, gstRate: 5 }]);
        setEditingTicketId(null);
        fetchProducts(); 
        fetchCustomers();
        fetchVendors();
      }
    } catch (error) {
      console.error("Failed to submit ticket", error);
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: "pending" | "done") => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchMyTickets();
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchMyTickets();
      }
    } catch (error) {
      console.error("Failed to delete ticket", error);
    }
  };

  const handleEditClick = (ticket: Ticket) => {
    setCustomerName(ticket.customerName || '');
    setPurchaseOrderNumber(ticket.purchaseOrderNumber || '');
    setRequesterName(ticket.requesterName || '');
    setRequesterPhone(ticket.requesterPhone || '');
    setHandoverDate(ticket.handoverDate || '');
    setItems(ticket.items.map(i => ({
      ...i, 
      id: String(i.id || uuidv4()), 
      description: i.description || '', 
      vendorName: i.vendorName || '', 
      quantity: i.quantity, 
      price: i.price, 
      purchasePrice: (i as any).purchasePrice || 0,
      gstRate: i.gstRate || 5
    })));
    setEditingTicketId(ticket.id);
    setActiveTab('raise');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setCustomerName('');
    setPurchaseOrderNumber('');
    setRequesterName('');
    setRequesterPhone('');
    setHandoverDate('');
    setItems([{ id: uuidv4(), productName: '', description: '', vendorName: '', quantity: 1, price: 0, gstRate: 5 }]);
    setEditingTicketId(null);
  };

  const filteredTickets = myTickets.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchText = String(t.customerName || '').toLowerCase().includes(term) ||
                      String(t.purchaseOrderNumber || '').toLowerCase().includes(term) ||
                      String(t.requesterName || '').toLowerCase().includes(term);
    const matchDate = searchDate ? t.handoverDate === searchDate || t.ticketDate.startsWith(searchDate) : true;
    return matchText && matchDate;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10 animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <div className="flex items-center">
            <PrintFieldLogo layout="horizontal" iconSize="md" />
            <span className="ml-3.5 bg-emerald-50 text-emerald-700 text-[10px] px-2.5 py-1 rounded-md font-semibold font-mono tracking-wider border border-emerald-100">
              EMPLOYEE PORTAL
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-gray-700 font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Hi, {user?.username}
            </span>
            <button
              onClick={logout}
              className="flex items-center text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className={`${activeTab === 'catalogue' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300`}>
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('raise')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === 'raise'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm border border-gray-200'
            }`}
          >
            Raise Ticket
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === 'mine'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm border border-gray-200'
            }`}
          >
            My Tickets
          </button>
          <button
            onClick={() => setActiveTab('catalogue')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              activeTab === 'catalogue'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm border border-gray-200'
            }`}
          >
            Catalogue
          </button>
        </div>

        {activeTab === 'raise' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
              {editingTicketId ? 'Edit Job Ticket' : 'Raise New Job Ticket'}
            </h2>
            
            {successMsg && (
              <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2" /> {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer / Company Name</label>
                <AutocompleteInput
                  value={customerName}
                  onChange={setCustomerName}
                  options={customersList}
                  placeholder="e.g. Acme Corp"
                  onBlur={() => handleBlur('customer', customerName)}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order Number</label>
                <input
                  type="text"
                  value={purchaseOrderNumber}
                  onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                  placeholder="e.g. PO-12345 (Optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Date (Today)</label>
                <input
                  type="text"
                  readOnly
                  value={currentFormattedDate}
                  className="w-full px-4 py-2 border rounded-lg border-gray-300 bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requester Name</label>
                <input
                  type="text"
                  required
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                  placeholder="Name of the person requesting"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requester Phone Number</label>
                <input
                  type="tel"
                  required
                  value={requesterPhone}
                  onChange={(e) => setRequesterPhone(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                  placeholder="e.g. +1 234 567 8900"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-lg font-medium text-gray-800">Order Items</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingProduct(!isAddingProduct)}
                    className="flex items-center text-sm bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 transition"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Product
                  </button>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Row
                  </button>
                </div>
              </div>

              {isAddingProduct && (
                <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200 flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">New Product Name</label>
                    <input
                      type="text"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 border-gray-300 text-sm"
                      placeholder="Enter product name..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateProduct}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                  >
                    Save Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingProduct(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b grid grid-cols-12 gap-2 text-sm font-semibold text-gray-600 p-3 hidden md:grid">
                  <div className="col-span-5">Product Name</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-center">Price</div>
                  <div className="col-span-2 text-center">GST Rate</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <div key={item.id} className="p-3 border-b last:border-b-0 border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start md:items-center mb-4">
                        <div className="col-span-1 md:col-span-5 relative">
                          <label className="text-xs text-gray-500 mb-1 block md:hidden">Product Name</label>
                          <AutocompleteInput
                            id={`product-${item.id}`}
                            value={item.productName}
                            onChange={(val) => updateItem(item.id, 'productName', val)}
                            options={productsList}
                            placeholder="Type or select product..."
                            onBlur={() => handleBlur('product', item.productName)}
                            required
                          />
                        </div>
                        
                        <div className="col-span-1 md:col-span-2">
                           <label className="text-xs text-gray-500 mb-1 block md:hidden">Quantity</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.valueAsNumber || 1)}
                            onFocus={(e) => e.target.select()}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div className="col-span-1 md:col-span-2 border-l-0">
                           <label className="text-xs text-gray-500 mb-1 block md:hidden">Price</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">₹</span>
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => updateItem(item.id, 'price', e.target.valueAsNumber || 0)}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-lg font-mono text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 border-l-0">
                          <label className="text-xs text-gray-500 mb-1 block md:hidden">GST Rate</label>
                          <select
                            value={item.gstRate}
                            onChange={(e) => updateItem(item.id, 'gstRate', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                          >
                            <option value={5}>5% GST</option>
                            <option value={18}>18% GST</option>
                          </select>
                        </div>

                        <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center mt-2 md:mt-0">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                            className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed p-2 rounded-full hover:bg-red-50 transition"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {/* Sub-row for Description and Outsource Vendor */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="col-span-1 md:col-span-6">
                           <label className="text-xs text-gray-500 mb-1 block">Description</label>
                           <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                              placeholder="Product details, configuration, notes..."
                            />
                        </div>
                        <div className="col-span-1 md:col-span-5 relative">
                          <label className="text-xs text-gray-500 mb-1 block">Outsource Vendor (Optional)</label>
                          <AutocompleteInput
                            value={item.vendorName}
                            onChange={(val) => updateItem(item.id, 'vendorName', val)}
                            options={vendorsList}
                            placeholder="Vendor if outsourced..."
                            onBlur={() => handleBlur('vendor', item.vendorName)}
                            className="text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.defaultPrevented) {
                                e.preventDefault();
                                addItem();
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Handover / Delivery Date</label>
              <input
                type="date"
                required
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                className="w-full md:w-1/3 px-4 py-2 border rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="pt-6 flex justify-end gap-3">
              {editingTicketId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || items.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition"
              >
                {submitting ? 'Submitting...' : editingTicketId ? 'Update Ticket' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
        )}

        {activeTab === 'mine' && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
              <h2 className="text-2xl font-bold text-gray-800">My Raised Tickets</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search company, PO, name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full sm:w-40 pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm text-gray-600"
                    title="Filter by handover date"
                  />
                  {searchDate && (
                    <button
                      onClick={() => setSearchDate('')}
                      className="absolute right-2 top-2.5 text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No tickets found</h3>
                  <p className="text-gray-500 text-sm">
                    {searchTerm || searchDate 
                      ? "Try adjusting your search filters or clearing the date." 
                      : "You haven't raised any tickets yet."}
                  </p>
                </div>
              ) : (
                filteredTickets.sort((a, b) => new Date(b.ticketDate).getTime() - new Date(a.ticketDate).getTime()).map(ticket => (
                  <div key={ticket.id} className="bg-white min-w-full overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                    {/* Ticket Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b flex flex-wrap gap-4 justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                          <span className="text-gray-500">#{ticket.ticketNumber || ticket.id.substring(0, 6)}</span>
                          {ticket.customerName || <span className="italic text-gray-400">No Company Name</span>}
                          {ticket.purchaseOrderNumber && (
                            <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2 py-0.5 rounded">PO: {ticket.purchaseOrderNumber}</span>
                          )}
                          {ticket.status === 'done' ? (
                            <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-200">Done</span>
                          ) : (
                            <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200">Pending</span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Raised on {format(parseISO(ticket.ticketDate), 'MMM d, yyyy h:mm a')}
                        </p>
                        {(ticket.requesterName || ticket.requesterPhone) && (
                          <p className="text-xs text-gray-500 mt-1">
                            Requested by: <span className="font-medium text-gray-700">{ticket.requesterName}</span> {ticket.requesterPhone && `(${ticket.requesterPhone})`}
                          </p>
                        )}
                        {ticket.delayReason && (
                          <div className="mt-2 text-xs bg-red-50 text-red-700 p-2 rounded border border-red-100">
                            <span className="font-semibold block">Delayed:</span> {ticket.delayReason}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block">Handover Date</span>
                          {ticket.newHandoverDate ? (
                            <div className="flex flex-col items-end">
                              <span className="text-xs line-through text-gray-400">{format(parseISO(ticket.handoverDate), 'MMM d, yyyy')}</span>
                              <span className="text-sm font-semibold text-red-600">{format(parseISO(ticket.newHandoverDate), 'MMM d, yyyy')}</span>
                            </div>
                          ) : (
                            <span className="font-bold text-blue-600">{format(parseISO(ticket.handoverDate), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => downloadTicketPdf(ticket)}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-600 hover:text-green-600 hover:border-green-400 rounded text-xs font-medium transition-colors"
                            title="Download as PDF"
                          >
                            <Download className="h-3 w-3" /> PDF
                          </button>
                          <button
                            onClick={() => handleUpdateTicketStatus(ticket.id, ticket.status === 'done' ? 'pending' : 'done')}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-600 hover:text-amber-600 hover:border-amber-400 rounded text-xs font-medium transition-colors"
                            title={ticket.status === 'done' ? "Mark as Undone" : "Mark as Done"}
                          >
                            {ticket.status === 'done' ? <><Undo className="h-3 w-3" /> Undone</> : <><CheckCircle2 className="h-3 w-3" /> Done</>}
                          </button>
                          <button
                            onClick={() => handleEditClick(ticket)}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-400 rounded text-xs font-medium transition-colors"
                          >
                            <Edit className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTicket(ticket.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-400 rounded text-xs font-medium transition-colors"
                            title="Delete Ticket"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Ticket Items */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Unit</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GST</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 pb-2">
                          {ticket.items.map((item, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2 whitespace-normal text-gray-800 font-medium">
                                {item.productName}
                                {(item.description || item.vendorName) && (
                                  <div className="text-xs text-gray-500 font-normal mt-1 space-y-0.5">
                                    {item.description && <span className="block">{item.description}</span>}
                                    {item.vendorName && <span className="block text-indigo-500">Outsourced: {item.vendorName}</span>}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-center text-gray-600 align-top">{item.quantity}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-right text-gray-600 align-top">
                                <div className="font-semibold text-emerald-600">
                                  ₹{Number(item.price).toFixed(2)}
                                </div>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-right text-gray-600 align-top">{item.gstRate || 5}%</td>
                              <td className="px-4 py-2 whitespace-nowrap text-right text-gray-800 font-medium align-top">₹{(item.quantity * Number(item.price) * (1 + (item.gstRate || 5) / 100)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50/80">
                          <tr>
                             <td colSpan={4} className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Grand Total</td>
                             <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-bold text-gray-900 border-t border-gray-200">
                               ₹{ticket.items.reduce((sum, item) => sum + (item.quantity * Number(item.price) * (1 + (item.gstRate || 5) / 100)), 0).toFixed(2)}
                             </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'catalogue' && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Catalogue Items</h2>
                <p className="text-sm text-gray-500 mt-1">Browse product designs, add to cart for custom quotes, or copy directly to ticket drafts.</p>
              </div>
              <div className="flex flex-col w-full md:w-auto gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-grow md:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search catalogue..."
                      value={catalogueSearch}
                      onChange={(e) => setCatalogueSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <select
                    value={catalogueCategory}
                    onChange={(e) => setCatalogueCategory(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">All Categories</option>
                    {catalogueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Price Range:</label>
                    <input
                      type="number"
                      placeholder="Min"
                      value={catalogueMinPrice}
                      onChange={(e) => setCatalogueMinPrice(e.target.value)}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={catalogueMaxPrice}
                      onChange={(e) => setCatalogueMaxPrice(e.target.value)}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Catalogue Items */}
              <div className="lg:col-span-12">
                <div className="flex justify-between items-center mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="selectAllCatalogue"
                      checked={filteredCatalogueItems.length > 0 && catalogueSelectedIds.size === filteredCatalogueItems.length}
                      onChange={handleSelectAllCatalogue}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="selectAllCatalogue" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                      Select All ({filteredCatalogueItems.length} items)
                    </label>
                  </div>
                  
                  {catalogueSelectedIds.size > 0 && (
                    <button 
                      onClick={addSelectedCatalogueToCart}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <ShoppingCart size={14} />
                      Add Selected ({catalogueSelectedIds.size}) to Cart
                    </button>
                  )}
                </div>

                {filteredCatalogueItems.length === 0 ? (
                  <div className="py-12 text-center bg-gray-50 border border-gray-200 border-dashed rounded-lg">
                    <Box className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">No catalogue items found</h3>
                    <p className="text-gray-500 mt-1">Try adjusting your filters or search term.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCatalogueItems.map((item) => (
                        <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full">
                          <div className="h-44 bg-gray-50 flex items-center justify-center relative border-b border-gray-100">
                            <div 
                              className="absolute top-3 left-3 z-10 bg-white/90 rounded p-1.5 shadow-sm border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCatalogueSelect(item.id);
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={catalogueSelectedIds.has(item.id)}
                                onChange={() => {}} 
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer pointer-events-none"
                              />
                            </div>
                            {item.imageUrl ? (
                              <img src={item.imageUrl?.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}` : item.imageUrl} alt={item.brandName ? `${item.brandName} ${item.name}` : item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Box className="w-12 h-12 text-gray-300" />
                            )}
                            {item.category && (
                              <span className="absolute top-3 right-3 bg-slate-900/80 text-white text-[10px] uppercase font-bold px-2 py-1 rounded tracking-wider">
                                {item.category}
                              </span>
                            )}
                          </div>
                          <div className="p-4 flex flex-col flex-grow">
                            <h3 className="font-semibold text-gray-800 text-base line-clamp-1">{item.brandName ? `${item.brandName} ${item.name}` : item.name}</h3>
                            <p className="text-gray-500 text-xs mt-1 mb-4 flex-grow line-clamp-3 leading-relaxed">
                              {item.description || 'No description provided.'}
                            </p>
                            
                            <div className="pt-3 border-t border-gray-100 flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col text-left">
                                  <span className="text-[10px] text-slate-500 flex items-center">
                                    Cost: <IndianRupee size={10} className="ml-0.5 mr-0.5" />{(item.purchasePrice || 0).toFixed(2)}
                                  </span>
                                  <span className="font-bold text-emerald-600 text-sm flex items-center mt-0.5">
                                    <IndianRupee size={12} className="mr-0.5" />
                                    {(item.sellingPrice || item.price || 0).toFixed(2)}
                                    {item.gstRate ? ` + ${item.gstRate}% GST` : ''}
                                  </span>
                                </div>
                                
                                {cart.some(c => c.id === item.id) && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <ShoppingCart size={10} />
                                    In Cart
                                  </span>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAddToCartClick(item)}
                                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                                >
                                  <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Cart Button */}
        {cart.length > 0 && activeTab === 'catalogue' && (
          <button
            onClick={() => setIsCartModalOpen(true)}
            className="fixed bottom-6 left-6 z-40 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg shadow-blue-600/30 transition-transform hover:scale-105 flex items-center justify-center cursor-pointer group"
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {cart.length}
            </span>
            <span className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              View Quote Cart
            </span>
          </button>
        )}

        {/* Cart Modal */}
        {isCartModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Quote Cart</h2>
                    <p className="text-sm text-gray-500">{cart.length} items selected</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={clearCart}
                    className="text-sm font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setIsCartModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">Your cart is empty</h3>
                    <p className="text-gray-500 mt-1">Browse the catalogue to add items.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cart.map((item, index) => (
                      <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-start gap-4 relative">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="absolute top-3 right-3 text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                        
                        {item.imageUrl ? (
                          <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-100 shrink-0 bg-gray-50">
                            <img src={item.imageUrl?.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}` : item.imageUrl} alt={item.brandName ? `${item.brandName} ${item.name}` : item.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-lg border border-gray-100 shrink-0 bg-gray-50 flex items-center justify-center">
                            <Box className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0 pr-8">
                          <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">{item.brandName ? `${item.brandName} ${item.name}` : item.name}</h4>
                          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mt-1">{item.category}</p>
                          
                          <div className="mt-3 grid grid-cols-2 gap-3 items-center">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500 font-medium">Purchase Price</span>
                              <span className="text-sm font-semibold text-gray-900 flex items-center mt-0.5">
                                <IndianRupee size={12} className="mr-0.5" />
                                {(item.purchasePrice || 0).toFixed(2)}
                              </span>
                            </div>
                            
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500 font-medium">Selling Price</span>
                              <div className="relative flex items-center w-full mt-0.5">
                                <span className="absolute left-2 text-gray-500 text-xs font-semibold">₹</span>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => updateCartItemPrice(item.id, e.target.valueAsNumber || 0)}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full bg-blue-50/50 border border-blue-200 rounded-md px-2 pl-6 py-1.5 text-sm font-semibold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-white">
                <div className="flex items-center justify-between max-w-md mx-auto gap-4">
                  <p className="text-xs text-gray-500 flex-1">
                    Export your custom quote to a PDF document to share with clients.
                  </p>
                  <button
                    onClick={handleExportCartPdf}
                    disabled={cart.length === 0}
                    className="flex-shrink-0 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    <FileDown size={18} /> 
                    Export as PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Size Selection Modal */}
        {sizeModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Select Size</h3>
                <p className="text-sm text-gray-500 mt-1">{sizeModalItem.name}</p>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {sizeModalItem.sizes.map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${selectedSize === size ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
                <button
                  onClick={() => { setSizeModalItem(null); setSelectedSize(''); }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddToCartWithSize}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
