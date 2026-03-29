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
  Upload,
  Printer,
  FileBarChart,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Employee, Stats } from './types';
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logout, 
  uploadFile, 
  handleFirestoreError, 
  OperationType,
  testConnection
} from './lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

const RELIGIONS = ['Islam', 'Kristen Protestan', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'];
const EDUCATIONS = ['SD', 'SMP', 'SMA/SMK', 'D3', 'D4/S1', 'S2', 'S3'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, asn: 0, p3k: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'ASN' | 'P3K'>('ALL');
  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [reportType, setReportType] = useState<'ALL' | 'SALARY' | 'PROMOTION'>('ALL');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  const getNextSalaryDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    date.setFullYear(date.getFullYear() + 2);
    return date;
  };

  const getNextPromotionDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    date.setFullYear(date.getFullYear() + 4);
    return date;
  };

  const isDueThisMonth = (date: Date | null, month: number, year: number) => {
    if (!date) return false;
    return date.getMonth() + 1 === month && date.getFullYear() === year;
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'reports'>('dashboard');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [appLogo, setAppLogo] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/popup-blocked') {
        setLoginError('Popup diblokir oleh browser. Silakan izinkan popup untuk situs ini.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setLoginError('Domain ini belum terdaftar di Firebase Authorized Domains. Silakan hubungi admin.');
      } else {
        setLoginError('Gagal masuk dengan Google. Silakan coba lagi.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        testConnection();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setEmployees([]);
      setStats({ total: 0, asn: 0, p3k: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'employees'), orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const empData: Employee[] = [];
      let asnCount = 0;
      let p3kCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const employee = { 
          id: doc.id, 
          ...data,
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
        } as unknown as Employee;
        
        empData.push(employee);
        if (employee.category === 'ASN') asnCount++;
        if (employee.category === 'P3K') p3kCount++;
      });

      setEmployees(empData);
      setStats({ total: empData.length, asn: asnCount, p3k: p3kCount });
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employees');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'app'), (doc) => {
      if (doc.exists()) {
        setAppLogo(doc.data().logo_url);
      }
    }, (error) => {
      console.error("Error fetching settings:", error);
    });
    return () => unsubscribe();
  }, []);

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
    email: '',
    last_salary_periodic_date: '',
    last_promotion_date: ''
  });

  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    doc_ktp: null,
    doc_sk_pangkat: null,
    doc_sk_berkala: null,
    doc_sk_jabatan: null
  });

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
        email: employee.email || '',
        last_salary_periodic_date: employee.last_salary_periodic_date || '',
        last_promotion_date: employee.last_promotion_date || ''
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
        email: '',
        last_salary_periodic_date: '',
        last_promotion_date: ''
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
    if (!user) return;
    setIsSaving(true);
    setError(null);
    
    try {
      const uploadedFiles: { [key: string]: string | null } = {};
      
      // Prepare upload promises
      const uploadPromises = Object.entries(files).map(async ([key, file]) => {
        if (file) {
          const f = file as File;
          const path = `employees/${Date.now()}_${f.name}`;
          try {
            const url = await uploadFile(f, path);
            return { key, url };
          } catch (uploadErr) {
            console.error(`Error uploading ${key}:`, uploadErr);
            throw new Error(`Gagal mengunggah dokumen ${key}. Silakan coba lagi.`);
          }
        } else if (editingEmployee) {
          return { key, url: (editingEmployee as any)[key] || null };
        } else {
          return { key, url: null };
        }
      });

      const results = await Promise.all(uploadPromises);
      results.forEach(({ key, url }) => {
        uploadedFiles[key] = url;
      });

      const employeeData = {
        ...formData,
        ...uploadedFiles,
        updated_at: serverTimestamp(),
      };

      if (editingEmployee) {
        const docRef = doc(db, 'employees', String(editingEmployee.id));
        await updateDoc(docRef, employeeData);
      } else {
        await addDoc(collection(db, 'employees'), {
          ...employeeData,
          created_at: serverTimestamp(),
        });
      }
      
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Submit error:", err);
      if (err.message && err.message.includes('Gagal mengunggah dokumen')) {
        setError(err.message);
      } else {
        try {
          handleFirestoreError(err, editingEmployee ? OperationType.UPDATE : OperationType.CREATE, 'employees');
        } catch (e) {
          // If handleFirestoreError throws, it's already logged
        }
        setError('Gagal menyimpan data ke Firebase. Silakan periksa koneksi dan izin Anda.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!user) return;
    if (confirm('Apakah Anda yakin ingin menghapus data pegawai ini?')) {
      try {
        await deleteDoc(doc(db, 'employees', String(id)));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `employees/${id}`);
      }
    }
  };

  const filteredEmployees = employees.filter(emp => {
    if (!emp) return false;
    const name = emp.name || '';
    const nip = emp.nip || '';
    const position = emp.position || '';
    
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         nip.includes(searchTerm) ||
                         position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || emp.category === filterCategory;
    const matchesDivision = filterDivision === 'ALL' || emp.division === filterDivision;
    return matchesSearch && matchesCategory && matchesDivision;
  });

  const filteredReportEmployees = employees.filter(emp => {
    if (!emp) return false;
    const name = emp.name || '';
    const nip = emp.nip || '';
    const position = emp.position || '';
    
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         nip.includes(searchTerm) ||
                         position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || emp.category === filterCategory;
    const matchesDivision = filterDivision === 'ALL' || emp.division === filterDivision;

    if (reportType === 'SALARY') {
      const nextDate = getNextSalaryDate(emp.last_salary_periodic_date);
      return matchesSearch && matchesCategory && matchesDivision && isDueThisMonth(nextDate, reportMonth, reportYear);
    }

    if (reportType === 'PROMOTION') {
      const nextDate = getNextPromotionDate(emp.last_promotion_date);
      return matchesSearch && matchesCategory && matchesDivision && isDueThisMonth(nextDate, reportMonth, reportYear);
    }

    return matchesSearch && matchesCategory && matchesDivision;
  });

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center space-y-8"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto overflow-hidden">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
            ) : (
              <Building2 size={40} />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">KESBANGPOL</h1>
            <p className="text-slate-500 mt-2">Silakan masuk untuk mengakses Database Pegawai</p>
          </div>
          {loginError && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{loginError}</span>
            </div>
          )}
          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 px-6 py-4 rounded-2xl font-bold transition-all group disabled:opacity-50"
          >
            {isLoggingIn ? (
              <div className="w-6 h-6 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
            ) : (
              <LogIn className="text-slate-400 group-hover:text-indigo-600" size={24} />
            )}
            <span>{isLoggingIn ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
          </button>
          <p className="text-xs text-slate-400">Hanya akun terdaftar yang dapat mengelola data.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-20 hidden md:block print:hidden">
        <div className="p-6 border-bottom border-slate-100 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white overflow-hidden">
              {appLogo ? (
                <img src={appLogo} alt="Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
              ) : (
                <Building2 size={24} />
              )}
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">KESBANGPOL</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Database Pegawai</p>
            </div>
          </div>

          <nav className="space-y-1 flex-1">
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
            <button 
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <FileBarChart size={20} />
              <span>Laporan</span>
            </button>
          </nav>

          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-4 px-2">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt={user.displayName || 'User'} 
                className="w-8 h-8 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 truncate">{user.displayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium"
            >
              <LogOut size={20} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-8 print:ml-0 print:p-0">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 print:hidden">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'dashboard' ? 'Ringkasan Statistik' : 
               activeTab === 'employees' ? 'Manajemen Pegawai' : 
               'Laporan Detail Pegawai'}
            </h2>
            <p className="text-slate-500 text-sm">Badan Kesatuan Bangsa dan Politik Dalam Negeri</p>
          </div>
          {activeTab === 'dashboard' || activeTab === 'employees' ? (
            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-indigo-200"
            >
              <UserPlus size={18} />
              <span>Tambah Pegawai</span>
            </button>
          ) : activeTab === 'reports' ? (
            <button 
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-slate-200 print:hidden"
            >
              <Printer size={18} />
              <span>Cetak Laporan</span>
            </button>
          ) : null}
        </header>

        {activeTab === 'dashboard' ? (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Total Pegawai', value: stats?.total || 0, icon: Users, color: 'bg-blue-500' },
                { label: 'Pegawai ASN', value: stats?.asn || 0, icon: CheckCircle2, color: 'bg-emerald-500' },
                { label: 'P3K Paruh Waktu', value: stats?.p3k || 0, icon: AlertCircle, color: 'bg-amber-500' },
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
                  <p className="text-3xl font-bold text-slate-800 mt-1">{String(stat.value)}</p>
                </motion.div>
              ))}
            </div>

            {/* Connectivity Test */}
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-amber-600" size={20} />
                <div>
                  <p className="text-sm font-bold text-amber-800">Status Database Firebase</p>
                  <p className="text-xs text-amber-700">Data sekarang tersimpan secara real-time di cloud.</p>
                </div>
              </div>
              <button 
                onClick={testConnection}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Cek Koneksi
              </button>
            </div>

            {/* Recent Activity or Chart Placeholder */}
            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold mb-6">Distribusi Pegawai per Bidang</h3>
              <div className="space-y-4">
                {['Sekretariat', 'Bidang Ideologi & Wawasan Kebangsaan', 'Bidang Politik Dalam Negeri', 'Bidang Kewaspadaan Nasional'].map((division) => {
                  const count = (employees || []).filter(e => e && e.division === division).length;
                  const total = stats?.total || 0;
                  const percentage = total > 0 ? (count / total) * 100 : 0;
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
        ) : activeTab === 'employees' ? (
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
                        <div className="font-semibold text-slate-800">{String(emp.name || '')}</div>
                        <div className="text-xs text-slate-500">{String(emp.nip || '-')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700">{String(emp.position || '')}</div>
                        <div className="text-xs text-slate-500">{String(emp.division || '')}</div>
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
        ) : activeTab === 'reports' ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 print:p-0 print:border-none print:shadow-none">
            {/* Print Header */}
            <div className="hidden print:block mb-8 text-center border-b-2 border-slate-800 pb-4">
              <h1 className="text-xl font-bold uppercase">Laporan Data Pegawai</h1>
              {reportType === 'SALARY' && <p className="text-sm font-bold">Estimasi Kenaikan Gaji Berkala - {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][reportMonth - 1]} {reportYear}</p>}
              {reportType === 'PROMOTION' && <p className="text-sm font-bold">Estimasi Kenaikan Pangkat - {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][reportMonth - 1]} {reportYear}</p>}
              <p className="text-sm">Badan Kesatuan Bangsa dan Politik Dalam Negeri</p>
              <p className="text-[10px] mt-1 italic">Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-4 print:hidden">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Cari di laporan..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
              >
                <option value="ALL">Semua Kategori</option>
                <option value="ASN">ASN</option>
                <option value="P3K">P3K Paruh Waktu</option>
              </select>
              <select 
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
              >
                <option value="ALL">Semua Bidang</option>
                <option value="Sekretariat">Sekretariat</option>
                <option value="Bidang Ideologi & Wawasan Kebangsaan">Bidang Ideologi & Wawasan Kebangsaan</option>
                <option value="Bidang Politik Dalam Negeri">Bidang Politik Dalam Negeri</option>
                <option value="Bidang Kewaspadaan Nasional">Bidang Kewaspadaan Nasional</option>
              </select>

              <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                <select 
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                >
                  <option value="ALL">Semua Data</option>
                  <option value="SALARY">Kenaikan Gaji Berkala</option>
                  <option value="PROMOTION">Kenaikan Pangkat</option>
                </select>

                {reportType !== 'ALL' && (
                  <>
                    <select 
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(parseInt(e.target.value))}
                    >
                      {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <select 
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={reportYear}
                      onChange={(e) => setReportYear(parseInt(e.target.value))}
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border-collapse border border-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-200 px-2 py-2 text-center">No</th>
                    <th className="border border-slate-200 px-2 py-2">Nama Lengkap</th>
                    <th className="border border-slate-200 px-2 py-2">NIP</th>
                    <th className="border border-slate-200 px-2 py-2">Jabatan</th>
                    <th className="border border-slate-200 px-2 py-2">Bidang</th>
                    <th className="border border-slate-200 px-2 py-2">Kategori</th>
                    {reportType === 'SALARY' && <th className="border border-slate-200 px-2 py-2">Tgl Gaji Terakhir</th>}
                    {reportType === 'SALARY' && <th className="border border-slate-200 px-2 py-2">Estimasi Gaji Berikutnya</th>}
                    {reportType === 'PROMOTION' && <th className="border border-slate-200 px-2 py-2">Tgl Pangkat Terakhir</th>}
                    {reportType === 'PROMOTION' && <th className="border border-slate-200 px-2 py-2">Estimasi Pangkat Berikutnya</th>}
                    {reportType === 'ALL' && (
                      <>
                        <th className="border border-slate-200 px-2 py-2">Pendidikan</th>
                        <th className="border border-slate-200 px-2 py-2">Agama</th>
                        <th className="border border-slate-200 px-2 py-2">Kontak</th>
                      </>
                    )}
                    <th className="border border-slate-200 px-2 py-2 text-center">Dokumen</th>
                    <th className="border border-slate-200 px-2 py-2 text-center print:hidden">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReportEmployees.map((emp, index) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-2 py-2 text-center">{index + 1}</td>
                      <td className="border border-slate-200 px-2 py-2 font-semibold">{emp.name}</td>
                      <td className="border border-slate-200 px-2 py-2">{emp.nip || '-'}</td>
                      <td className="border border-slate-200 px-2 py-2">{emp.position}</td>
                      <td className="border border-slate-200 px-2 py-2">{emp.division}</td>
                      <td className="border border-slate-200 px-2 py-2">{emp.category === 'ASN' ? 'ASN' : 'P3K'}</td>
                      
                      {reportType === 'SALARY' && (
                        <>
                          <td className="border border-slate-200 px-2 py-2">
                            {emp.last_salary_periodic_date ? new Date(emp.last_salary_periodic_date).toLocaleDateString('id-ID') : '-'}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 font-bold text-indigo-600">
                            {getNextSalaryDate(emp.last_salary_periodic_date)?.toLocaleDateString('id-ID') || '-'}
                          </td>
                        </>
                      )}

                      {reportType === 'PROMOTION' && (
                        <>
                          <td className="border border-slate-200 px-2 py-2">
                            {emp.last_promotion_date ? new Date(emp.last_promotion_date).toLocaleDateString('id-ID') : '-'}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 font-bold text-indigo-600">
                            {getNextPromotionDate(emp.last_promotion_date)?.toLocaleDateString('id-ID') || '-'}
                          </td>
                        </>
                      )}

                      {reportType === 'ALL' && (
                        <>
                          <td className="border border-slate-200 px-2 py-2">{emp.education || '-'}</td>
                          <td className="border border-slate-200 px-2 py-2">{emp.religion || '-'}</td>
                          <td className="border border-slate-200 px-2 py-2">
                            <div className="text-[9px]">
                              {emp.phone && <div>{emp.phone}</div>}
                              {emp.email && <div className="truncate max-w-[100px]">{emp.email}</div>}
                            </div>
                          </td>
                        </>
                      )}
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <div className="flex justify-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${emp.doc_ktp ? 'bg-emerald-500' : 'bg-slate-200'}`} title="KTP" />
                          <div className={`w-2 h-2 rounded-full ${emp.doc_sk_pangkat ? 'bg-emerald-500' : 'bg-slate-200'}`} title="SK Pangkat" />
                          <div className={`w-2 h-2 rounded-full ${emp.doc_sk_berkala ? 'bg-emerald-500' : 'bg-slate-200'}`} title="SK Berkala" />
                          <div className={`w-2 h-2 rounded-full ${emp.doc_sk_jabatan ? 'bg-emerald-500' : 'bg-slate-200'}`} title="SK Jabatan" />
                        </div>
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center print:hidden">
                        <button 
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setIsDetailModalOpen(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredReportEmployees.length === 0 && (
                    <tr>
                      <td colSpan={reportType === 'ALL' ? 11 : 10} className="px-6 py-12 text-center text-slate-400 italic">
                        Tidak ada data pegawai yang sesuai dengan kriteria laporan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 hidden print:block">
              <div className="flex justify-end">
                <div className="text-center w-64">
                  <p className="mb-16">Kepala Badan Kesbangpol,</p>
                  <p className="font-bold underline">( ............................................ )</p>
                  <p>NIP. ............................................</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
                      <span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
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
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Gaji Berkala Terakhir</label>
                      <input 
                        type="date" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.last_salary_periodic_date}
                        onChange={(e) => setFormData({...formData, last_salary_periodic_date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Kenaikan Pangkat Terakhir</label>
                      <input 
                        type="date" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={formData.last_promotion_date}
                        onChange={(e) => setFormData({...formData, last_promotion_date: e.target.value})}
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
                        { id: 'doc_sk_jabatan', label: 'SK Jabatan (Opsional)' },
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
                          href={(editingEmployee as any)[doc.id]} 
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

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <h3 className="text-xl font-bold text-slate-800">Detail Pegawai</h3>
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto max-h-[70vh] space-y-8">
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                    <Users size={48} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-2xl font-bold text-slate-800">{selectedEmployee.name}</h4>
                    <p className="text-slate-500 font-medium">{selectedEmployee.position}</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                      selectedEmployee.category === 'ASN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedEmployee.category === 'ASN' ? 'ASN' : 'P3K Paruh Waktu'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informasi Dasar</h5>
                    <div className="space-y-3">
                      <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-sm text-slate-500">NIP</span>
                        <span className="text-sm font-semibold text-slate-800">{selectedEmployee.nip || '-'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-sm text-slate-500">Bidang</span>
                        <span className="text-sm font-semibold text-slate-800">{selectedEmployee.division}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-sm text-slate-500">Pendidikan</span>
                        <span className="text-sm font-semibold text-slate-800">{selectedEmployee.education || '-'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-sm text-slate-500">Agama</span>
                        <span className="text-sm font-semibold text-slate-800">{selectedEmployee.religion || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kontak</h5>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Phone size={16} className="text-slate-400" />
                        <span>{selectedEmployee.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Mail size={16} className="text-slate-400" />
                        <span className="truncate">{selectedEmployee.email || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dokumen Terlampir</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { id: 'doc_ktp', label: 'KTP' },
                      { id: 'doc_sk_pangkat', label: 'SK Pangkat' },
                      { id: 'doc_sk_berkala', label: 'SK Berkala' },
                      { id: 'doc_sk_jabatan', label: 'SK Jabatan' },
                    ].map((doc) => {
                      const fileName = (selectedEmployee as any)[doc.id];
                      return (
                        <div key={doc.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                          fileName ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'
                        }`}>
                          <div className="flex items-center gap-3">
                            <FileText size={20} className={fileName ? 'text-emerald-600' : 'text-slate-400'} />
                            <span className={`text-sm font-medium ${fileName ? 'text-emerald-900' : 'text-slate-500'}`}>{doc.label}</span>
                          </div>
                          {fileName ? (
                            <a 
                              href={fileName} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-2 bg-white text-emerald-600 rounded-xl shadow-sm hover:bg-emerald-100 transition-all"
                            >
                              <Download size={16} />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Belum Ada</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50">
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
