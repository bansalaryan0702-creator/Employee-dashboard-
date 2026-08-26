import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2, Search, Users, Save, Trash2, Plus, Paperclip } from 'lucide-react';

interface Recipient {
  id: string;
  email: string;
  profile: string;
}

type ProfileType = 'Printfield' | 'Whitefield Stationers';

export default function BulkEmailSender() {
  const [profile, setProfile] = useState<ProfileType>('Printfield');
  const [recipientsInput, setRecipientsInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; type: string; base64: string; url?: string } | null>(null);
  
  const [savedRecipients, setSavedRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    fetchRecipients();
  }, []);

  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) { // 10MB limit
        setStatus({ type: 'error', message: 'Attachment size must be less than 25MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setAttachment({
          name: file.name,
          type: file.type,
          base64
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchRecipients = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/email-recipients');
      if (res.ok) {
        const data = await res.json();
        setSavedRecipients(data);
      }
    } catch (error) {
      console.error('Failed to fetch recipients', error);
    } finally {
      setFetching(false);
    }
  };

  const handleSaveRecipients = async () => {
    if (!recipientsInput.trim()) return;
    
    const emailList = recipientsInput.split(',').map(e => e.trim()).filter(e => e);
    if (emailList.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/email-recipients/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emailList, profile })
      });
      if (res.ok) {
        setStatus({ type: 'success', message: `Saved ${emailList.length} emails to ${profile}.` });
        setRecipientsInput('');
        fetchRecipients();
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to save recipients.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecipient = async (id: string) => {
    try {
      await fetch(`/api/email-recipients/${id}`, { method: 'DELETE' });
      setSavedRecipients(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to delete', error);
    }
  };

  const currentProfileRecipients = savedRecipients.filter(r => r.profile === profile);
  const filteredRecipients = currentProfileRecipients.filter(r => r.email.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSelectAll = () => {
    if (selectedIds.size === filteredRecipients.length) {
      setSelectedIds(new Set()); // Deselect all
    } else {
      setSelectedIds(new Set(filteredRecipients.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const sendEmail = async (to: string, subject: string, text: string, attach: any) => {
    const response = await fetch('/api/deliver-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, subject, text, profile, attachment: attach ? { name: attach.name, type: attach.type, url: attach.url } : null })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to send email');
    }
    return true;
  };

  const handleSendEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedIds.size === 0) {
      setStatus({ type: 'error', message: 'Please select at least one saved recipient email address.' });
      return;
    }
    
    if (!subject || !body) {
      setStatus({ type: 'error', message: 'Subject and body are required.' });
      return;
    }

    setLoading(true);

    let attachmentData = attachment;
    if (attachment && !attachment.url) {
      setStatus({ type: 'info', message: 'Uploading attachment...' });
      try {
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: attachment.name,
            fileType: attachment.type,
            base64Data: attachment.base64
          })
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          attachmentData = { ...attachment, url: data.url };
          setAttachment(attachmentData);
        } else {
          throw new Error('Upload failed');
        }
      } catch (err) {
        setStatus({ type: 'error', message: 'Failed to upload attachment.' });
        setLoading(false);
        return;
      }
    }

    setStatus({ type: 'info', message: `Sending emails to ${selectedIds.size} recipients...` });

    let successCount = 0;
    let failCount = 0;

    const emailsToSend = currentProfileRecipients.filter(r => selectedIds.has(r.id)).map(r => r.email);

    for (const email of emailsToSend) {
      try {
        await sendEmail(email, subject, body, attachmentData);
        successCount++;
      } catch (error) {
        console.error(`Failed to send to ${email}:`, error);
        failCount++;
      }
    }

    setLoading(false);
    
    if (failCount === 0) {
      setStatus({ type: 'success', message: `Successfully sent ${successCount} emails for ${profile}!` });
      setSubject('');
      setBody('');
      setAttachment(null);
    } else {
      setStatus({ type: 'error', message: `Sent ${successCount} emails, but failed to send ${failCount} emails.` });
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-5xl mx-auto mt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            Bulk Email Sender
          </h2>
          <p className="text-sm text-gray-500 mt-1">Send marketing or update emails via specific profiles.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex">
            <button 
              onClick={() => { setProfile('Printfield'); setSelectedIds(new Set()); setSearchQuery(''); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${profile === 'Printfield' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Printfield
            </button>
            <button 
              onClick={() => { setProfile('Whitefield Stationers'); setSelectedIds(new Set()); setSearchQuery(''); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${profile === 'Whitefield Stationers' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Whitefield
            </button>
          </div>
        </div>
      </div>
      
      {status && (
        <div className={`p-4 mb-6 rounded-md flex items-center gap-3 ${
          status.type === 'success' ? 'bg-green-50 text-green-800' :
          status.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
           status.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
           <Loader2 className="w-5 h-5 animate-spin" />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Recipient Management */}
        <div className="md:col-span-1 space-y-4 border-r border-gray-100 pr-4">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" /> Add New Recipients
            </h3>
            <textarea
              value={recipientsInput}
              onChange={(e) => setRecipientsInput(e.target.value)}
              disabled={loading}
              placeholder="client1@example.com, client2@example.com"
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 p-2 border"
            />
            <button
              onClick={handleSaveRecipients}
              disabled={loading || !recipientsInput.trim()}
              className="mt-3 w-full inline-flex justify-center items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Save to {profile}
            </button>
          </div>

          <div className="flex items-center justify-between mt-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Saved Recipients
            </h3>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {currentProfileRecipients.length}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="selectAll"
              checked={filteredRecipients.length > 0 && selectedIds.size === filteredRecipients.length}
              onChange={handleSelectAll}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="selectAll" className="text-sm text-gray-700 select-none cursor-pointer">
              Select All ({filteredRecipients.length})
            </label>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-md p-2 bg-white">
            {fetching ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : filteredRecipients.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No recipients found.</p>
            ) : (
              filteredRecipients.map(r => (
                <div key={r.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700 truncate">{r.email}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteRecipient(r.id)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove recipient"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Email Composition */}
        <div className="md:col-span-2 space-y-4">
          <form onSubmit={handleSendEmails} className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" /> Compose Message
              </h3>
              <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded-md">
                {selectedIds.size} recipient{selectedIds.size !== 1 && 's'} selected
              </span>
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700">Subject</label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading}
                placeholder={`Important Update from ${profile}`}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 p-2 border"
              />
            </div>
            
            <div>
              <label htmlFor="body" className="block text-sm font-medium text-gray-700">Message Body</label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={loading}
                placeholder="Type your message here..."
                rows={10}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 p-2 border"
              />
            </div>
            
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Attachment (Optional, Max 25MB)</label>
              <div className="mt-1 flex items-center">
                <label className="cursor-pointer bg-white border border-gray-300 rounded-md shadow-sm py-2 px-4 inline-flex items-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <Paperclip className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                </label>
                {attachment && (
                  <div className="ml-4 flex items-center text-sm text-gray-600">
                    <span className="truncate max-w-[200px]">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="ml-2 text-red-500 hover:text-red-700"
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading || selectedIds.size === 0}
                className="inline-flex items-center gap-2 px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send {selectedIds.size > 0 ? `to ${selectedIds.size} recipients` : ''}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
