export interface Employee {
  id: number;
  name: string;
  nip: string | null;
  position: string;
  category: 'ASN' | 'P3K';
  division: string;
  education: string | null;
  religion: string | null;
  phone: string | null;
  email: string | null;
  doc_ktp: string | null;
  doc_sk_pangkat: string | null;
  doc_sk_berkala: string | null;
  doc_sk_jabatan: string | null;
  created_at: string;
}

export interface Stats {
  total: number;
  asn: number;
  p3k: number;
}
