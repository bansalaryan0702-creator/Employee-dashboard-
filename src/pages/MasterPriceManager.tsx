import { useState, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, FileText, Plus, Edit, Trash2, Save, X, Search, Download, RefreshCw, Check, AlertCircle } from 'lucide-react';

type MasterPrice = {
  id: string;
  productName: string;
  purchasePrice: number;
  tax: number;
  mrp: number;
  category?: string;
  updatedAt?: number;
};

export default function MasterPriceManager({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [items, setItems] = useState<MasterPrice[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [newRow, setNewRow] = useState({ productName: '', purchasePrice: '', tax: '', mrp: '', category: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/master-prices');
      if (r.ok) setItems(await r.json());
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addManual = async () => {
    if (!newRow.productName.trim()) return;
    const r = await fetch('/api/master-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: newRow.productName.trim(),
        purchasePrice: Number(newRow.purchasePrice) || 0,
        tax: Number(newRow.tax) || 0,
        mrp: Number(newRow.mrp) || 0,
        category: newRow.category.trim()
      })
    });
    if (r.ok) {
      const created = await r.json();
      setItems([...items, created]);
      setNewRow({ productName: '', purchasePrice: '', tax: '', mrp: '', category: '' });
    }
  };

  const startEdit = (it: MasterPrice) => {
    setEditingId(it.id);
    setEditRow({ ...it });
  };
  const saveEdit = async () => {
    if (!editingId) return;
    const r = await fetch(`/api/master-prices/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: editRow.productName,
        purchasePrice: Number(editRow.purchasePrice) || 0,
        tax: Number(editRow.tax) || 0,
        mrp: Number(editRow.mrp) || 0,
        category: editRow.category
      })
    });
    if (r.ok) {
      const updated = await r.json();
      setItems(items.map(x => x.id === editingId ? updated : x));
      setEditingId(null);
    }
  };
  const remove = async (id: string) => {
    await fetch(`/api/master-prices/${id}`, { method: 'DELETE' });
    setItems(items.filter(x => x.id !== id));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setPreviewRows(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/master-prices/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Upload failed');
      setPreviewRows(j.rows || []);
      setSelectedPreview(new Set((j.rows || []).map((_: any, i: number) => i)));
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const savePreview = async () => {
    if (!previewRows) return;
    const toSave = previewRows.filter((_, i) => selectedPreview.has(i));
    if (toSave.length === 0) return;
    const r = await fetch('/api/master-prices/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: toSave })
    });
    if (r.ok) {
      await load();
      setPreviewRows(null);
    }
  };

  const filtered = items.filter(it =>
    it.productName.toLowerCase().includes(search.toLowerCase()) ||
    (it.category || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`${isEmbedded ? '' : 'max-w-7xl mx-auto p-6'}`}>
      {!isEmbedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Master Price</h1>
          <p className="text-sm text-slate-500 mt-1">Manage purchase price, tax and MRP for all products. Catalogue generator will auto-fill from here.</p>
        </div>
      )}
      {isEmbedded && (
        <div className="mb-4">
          <p className="text-sm text-slate-500">Add purchase price, tax and MRP. Upload PDF (with OCR) or Excel to bulk import. Prices auto-fill in catalogue.</p>
        </div>
      )}

      {/* Upload */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Upload size={16} /> Upload Price List</h3>
            <p className="text-xs text-slate-500 mt-1">Supports .xlsx, .xls, .pdf (scanned PDFs use OCR). Columns: Product Name, Purchase Price, Tax%, MRP</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf" className="hidden" onChange={handleUpload} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300">
              {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Parsing...' : 'Upload PDF / Excel'}
            </button>
            <button onClick={load} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw size={14} /></button>
          </div>
        </div>
        {previewRows && (
          <div className="mt-5 border border-amber-200 rounded-lg overflow-hidden bg-amber-50/50">
            <div className="p-3 flex justify-between items-center bg-amber-100 border-b border-amber-200">
              <span className="text-sm font-medium text-amber-900">Preview {previewRows.length} rows — {selectedPreview.size} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedPreview(new Set(previewRows.map((_,i)=>i)))} className="text-xs px-3 py-1 bg-white border rounded">Select All</button>
                <button onClick={() => setSelectedPreview(new Set())} className="text-xs px-3 py-1 bg-white border rounded">Deselect All</button>
                <button onClick={() => setPreviewRows(null)} className="text-xs px-3 py-1 bg-white border rounded flex items-center gap-1"><X size={12}/>Close</button>
                <button onClick={savePreview} disabled={selectedPreview.size===0} className="text-xs px-4 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-gray-300 flex items-center gap-1"><Save size={12}/>Save Selected</button>
              </div>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-white sticky top-0">
                  <tr className="text-left text-slate-500">
                    <th className="p-2 w-8"><input type="checkbox" checked={selectedPreview.size===previewRows.length} onChange={e=> setSelectedPreview(e.target.checked ? new Set(previewRows.map((_,i)=>i)) : new Set())} /></th>
                    <th className="p-2">Product</th><th className="p-2">Purchase</th><th className="p-2">Tax%</th><th className="p-2">MRP</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r,i)=>(
                    <tr key={i} className={`border-t ${selectedPreview.has(i) ? 'bg-blue-50' : 'bg-white'}`}>
                      <td className="p-2"><input type="checkbox" checked={selectedPreview.has(i)} onChange={e=>{ const s=new Set(selectedPreview); if(e.target.checked) s.add(i); else s.delete(i); setSelectedPreview(s); }} /></td>
                      <td className="p-2">
                        <input value={r.productName} onChange={e=>{ const copy=[...previewRows]; copy[i].productName=e.target.value; setPreviewRows(copy);}} className="w-full border rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="p-2"><input type="number" value={r.purchasePrice} onChange={e=>{ const c=[...previewRows]; c[i].purchasePrice=Number(e.target.value)||0; setPreviewRows(c);}} className="w-24 border rounded px-2 py-1" /></td>
                      <td className="p-2"><input type="number" value={r.tax} onChange={e=>{ const c=[...previewRows]; c[i].tax=Number(e.target.value)||0; setPreviewRows(c);}} className="w-20 border rounded px-2 py-1" /></td>
                      <td className="p-2"><input type="number" value={r.mrp} onChange={e=>{ const c=[...previewRows]; c[i].mrp=Number(e.target.value)||0; setPreviewRows(c);}} className="w-24 border rounded px-2 py-1" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add manual */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2"><Plus size={14}/> Add Product Price</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input placeholder="Product Name *" value={newRow.productName} onChange={e=>setNewRow({...newRow, productName:e.target.value})} className="border rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <input placeholder="Purchase Price" type="number" value={newRow.purchasePrice} onChange={e=>setNewRow({...newRow, purchasePrice:e.target.value})} className="border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Tax %" type="number" value={newRow.tax} onChange={e=>setNewRow({...newRow, tax:e.target.value})} className="border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="MRP" type="number" value={newRow.mrp} onChange={e=>setNewRow({...newRow, mrp:e.target.value})} className="border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Category (optional)" value={newRow.category} onChange={e=>setNewRow({...newRow, category:e.target.value})} className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={addManual} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2"><Plus size={14}/>Add</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Search product..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64" />
          </div>
          <span className="text-sm text-slate-500">{filtered.length} products</span>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-slate-600">
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Purchase</th>
                <th className="p-3 font-medium">Tax%</th>
                <th className="p-3 font-medium">MRP</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No prices yet. Add manually or upload PDF/Excel.</td></tr>
              ) : filtered.map(it => (
                <tr key={it.id} className="border-t hover:bg-slate-50">
                  {editingId === it.id ? (
                    <>
                      <td className="p-2"><input value={editRow.productName} onChange={e=>setEditRow({...editRow, productName:e.target.value})} className="w-full border rounded px-2 py-1" /></td>
                      <td className="p-2"><input type="number" value={editRow.purchasePrice} onChange={e=>setEditRow({...editRow, purchasePrice:e.target.value})} className="w-24 border rounded px-2 py-1" /></td>
                      <td className="p-2"><input type="number" value={editRow.tax} onChange={e=>setEditRow({...editRow, tax:e.target.value})} className="w-20 border rounded px-2 py-1" /></td>
                      <td className="p-2"><input type="number" value={editRow.mrp} onChange={e=>setEditRow({...editRow, mrp:e.target.value})} className="w-24 border rounded px-2 py-1" /></td>
                      <td className="p-2"><input value={editRow.category || ''} onChange={e=>setEditRow({...editRow, category:e.target.value})} className="w-full border rounded px-2 py-1" /></td>
                      <td className="p-2 flex gap-1">
                        <button onClick={saveEdit} className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"><Check size={14}/></button>
                        <button onClick={()=>setEditingId(null)} className="p-1.5 bg-white border rounded hover:bg-gray-50"><X size={14}/></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 font-medium text-slate-900">{it.productName}</td>
                      <td className="p-3">₹{it.purchasePrice}</td>
                      <td className="p-3">{it.tax}%</td>
                      <td className="p-3 font-semibold text-emerald-600">₹{it.mrp}</td>
                      <td className="p-3 text-slate-500">{it.category || '-'}</td>
                      <td className="p-3 flex gap-1">
                        <button onClick={()=>startEdit(it)} className="p-1.5 bg-white border rounded hover:bg-blue-50 text-slate-600"><Edit size={14}/></button>
                        <button onClick={()=>remove(it.id)} className="p-1.5 bg-white border rounded hover:bg-red-50 text-red-600"><Trash2 size={14}/></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
