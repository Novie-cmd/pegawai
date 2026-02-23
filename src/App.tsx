import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  LayoutDashboard,
  Building2,
  Phone,
  Mail,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Employee, Stats } from './types';

const RELIGIONS = ['Islam', 'Kristen Protestan', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'];
const EDUCATIONS = ['SD', 'SMP', 'SMA/SMK', 'D3', 'D4/S1', 'S2', 'S3'];

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, asn: 0, p3k: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'ASN' | 'P3K'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees'>('dashboard');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    nip: '',
    position: '',
    category: 'ASN',
    division: '',
    education: '',
    religion: '',
    phone: '',
    email: ''
  });

  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    doc_ktp: null,
    doc_sk_pangkat: null,
    doc_sk_berkala: null,
    doc_sk_jabatan: null
  });

  const fetchData = async () => {
    try {
      const [empRes, statsRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/employees/stats')
      ]);
      const empData = await empRes.json();
      const statsData = await statsRes.json();
      setEmployees(empData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (employee?: Employee) => {
    setError(null);
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        nip: employee.nip || '',
        position: employee.position,
        category: employee.category,
        division: employee.division,
        education: employee.education || '',
        religion: employee.religion || '',
        phone: employee.phone || '',
        email: employee.email || ''
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        name: '',
        nip: '',
        position: '',
        category: 'ASN',
        division: '',
        education: '',
        religion: '',
        phone: '',
        email: ''
      });
    }
    setFiles({
      doc_ktp: null,
      doc_sk_pangkat: null,
      doc_sk_berkala: null,
      doc_sk_jabatan: null
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : '/api/employees';
    const method = editingEmployee ? 'PUT' : 'POST';

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      // Convert empty NIP to null-like behavior for the backend
      if (key === 'nip' && !value) {
        data.append(key, '');
      } else {
        data.append(key, value as string);
      }
    });
    
    Object.entries(files).forEach(([key, file]) => {
      if (file) data.append(key, file as Blob);
    });

    try {
      const res = await fetch(url, {
        method,
        body: data
      });
      
      const result = await res.json();
      
      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        setError(result.error || 'Terjadi kesalahan saat menyimpan data.');
      }
    } catch (err) {
      console.error('Error saving employee:', err);
      setError('Gagal menghubungi server. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Apakah Anda yakin ingin menghapus data pegawai ini?')) {
      try {
        const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
        if (res.ok) fetchData();
      } catch (error) {
        console.error('Error deleting employee:', error);
      }
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (emp.nip && emp.nip.includes(searchTerm)) ||
                         emp.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || emp.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-20 hidden md:block">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">KESBANGPOL</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Database Pegawai</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab('employees')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'employees' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Users size={20} />
              <span>Data Pegawai</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'dashboard' ? 'Ringkasan Statistik' : 'Manajemen Pegawai'}
            </h2>
            <p className="text-slate-500 text-sm">Badan Kesatuan Bangsa dan Politik Dalam Negeri</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-indigo-200"
          >
            <UserPlus size={18} />
            <span>Tambah Pegawai</span>
          </button>
        </header>

        {activeTab === 'dashboard' ? (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Total Pegawai', value: stats.total, icon: Users, color: 'bg-blue-500' },
                { label: 'Pegawai ASN', value: stats.asn, icon: CheckCircle2, color: 'bg-emerald-500' },
                { label: 'P3K Paruh Waktu', value: stats.p3k, icon: AlertCircle, color: 'bg-amber-500' },
              ].map((stat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={stat.label} 
                  className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl ${stat.color} text-white`}>
                      <stat.icon size={24} />
                    </div>
                  </div>
                  <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Recent Activity or Chart Placeholder */}
            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold mb-6">Distribusi Pegawai per Bidang</h3>
              <div className="space-y-4">
                {['Sekretariat', 'Bidang Ideologi & Wawasan Kebangsaan', 'Bidang Politik Dalam Negeri', 'Bidang Ketahanan Ekonomi, Sosial & Budaya', 'Bidang Kewaspadaan Nasional'].map((division) => {
                  const count = employees.filter(e => e.division === division).length;
                  const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={division}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">{division}</span>
                        <span className="font-semibold">{count} Pegawai</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className="bg-indigo-500 h-full rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari nama, NIP, atau jabatan..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter size={18} className="text-slate-400" />
                <select 
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as any)}
                >
                  <option value="ALL">Semua Kategori</option>
                  <option value="ASN">ASN</option>
                  <option value="P3K">P3K Paruh Waktu</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="px-6 py-4">Nama / NIP</th>
                    <th className="px-6 py-4">Jabatan / Bidang</th>
                    <th className="px-6 py-4">Kategori</th>
                    <th className="px-6 py-4">Kontak</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{emp.name}</div>
                        <div className="text-xs text-slate-500">{emp.nip || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700">{emp.position}</div>
                        <div className="text-xs text-slate-500">{emp.division}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          emp.category === 'ASN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {emp.category === 'ASN' ? 'ASN' : 'P3K Paruh Waktu'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {emp.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Phone size={12} /> {emp.phone}
                            </div>
                          )}
                          {emp.email && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Mail size={12} /> {emp.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => handleOpenModal(emp)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(emp.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        Tidak ada data pegawai ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingEmployee ? 'Edit Data Pegawai' : 'Tambah Pegawai Baru'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
                      <AlertCircle size={18} />
                      {error}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">NIP (Opsional)</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.nip}
                        onChange={(e) => setFormData({...formData, nip: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pendidikan Terakhir</label>
                      <select 
                        required
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.education}
                        onChange={(e) => setFormData({...formData, education: e.target.value})}
                      >
                        <option value="">Pilih Pendidikan</option>
                        {EDUCATIONS.map(edu => <option key={edu} value={edu}>{edu}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Agama</label>
                      <select 
                        required
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.religion}
                        onChange={(e) => setFormData({...formData, religion: e.target.value})}
                      >
                        <option value="">Pilih Agama</option>
                        {RELIGIONS.map(rel => <option key={rel} value={rel}>{rel}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jabatan</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.position}
                        onChange={(e) => setFormData({...formData, position: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kategori</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                      >
                        <option value="ASN">ASN</option>
                        <option value="P3K">P3K Paruh Waktu</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bidang / Unit Kerja</label>
                      <select 
                        required
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.division}
                        onChange={(e) => setFormData({...formData, division: e.target.value})}
                      >
                        <option value="">Pilih Bidang</option>
                        <option value="Sekretariat">Sekretariat</option>
                        <option value="Bidang Ideologi & Wawasan Kebangsaan">Bidang Ideologi & Wawasan Kebangsaan</option>
                        <option value="Bidang Politik Dalam Negeri">Bidang Politik Dalam Negeri</option>
                        <option value="Bidang Ketahanan Ekonomi, Sosial & Budaya">Bidang Ketahanan Ekonomi, Sosial & Budaya</option>
                        <option value="Bidang Kewaspadaan Nasional">Bidang Kewaspadaan Nasional</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">No. Telepon</label>
                      <input 
                        type="tel" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                      <input 
                        type="email" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Document Upload Section */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Upload size={16} />
                      Upload Dokumen (PDF)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { id: 'doc_ktp', label: 'KTP' },
                        { id: 'doc_sk_pangkat', label: 'SK Pangkat Terakhir' },
                        { id: 'doc_sk_berkala', label: 'SK Berkala Terakhir' },
                        { id: 'doc_sk_jabatan', label: 'SK Jabatan' },
                      ].map((doc) => (
                        <div key={doc.id} className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{doc.label}</label>
                          <div className="relative">
                            <input 
                              type="file" 
                              accept=".pdf"
                              className="hidden"
                              id={doc.id}
                              onChange={(e) => setFiles({...files, [doc.id]: e.target.files?.[0] || null})}
                            />
                            <label 
                              htmlFor={doc.id}
                              className={`flex items-center justify-between px-4 py-2 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                                files[doc.id] ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                              }`}
                            >
                              <span className="text-xs text-slate-600 truncate max-w-[150px]">
                                {files[doc.id] ? files[doc.id]?.name : 'Pilih File...'}
                              </span>
                              <FileText size={14} className={files[doc.id] ? 'text-indigo-500' : 'text-slate-400'} />
                            </label>
                            {editingEmployee && (editingEmployee as any)[doc.id] && (
                              <a 
                                href={`/uploads/${(editingEmployee as any)[doc.id]}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1 rounded-full shadow-sm hover:bg-emerald-600 transition-all"
                                title="Lihat Dokumen Saat Ini"
                              >
                                <Download size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50 shrink-0">
                  <button 
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      editingEmployee ? 'Simpan Perubahan' : 'Tambah Pegawai'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
