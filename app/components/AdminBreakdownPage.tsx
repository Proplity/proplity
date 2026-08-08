import { useState } from 'react';
import {
  ArrowLeft,
  Users,
  Building2,
  DollarSign,
  Activity,
  TrendingUp,
  TrendingDown,
  Search,
  Download,
  Filter,
  Shield,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react';

export type AdminBreakdownType = 'users' | 'properties' | 'transactions' | 'uptime';

interface AdminBreakdownPageProps {
  breakdownType: AdminBreakdownType;
  onBack: () => void;
}

const usersData = [
  {
    name: 'Adewale Johnson',
    email: 'adewale@email.com',
    role: 'Property Manager',
    plan: 'Pro',
    joined: 'Jan 12, 2026',
    status: 'Active',
    properties: 8,
  },
  {
    name: 'Chidinma Okafor',
    email: 'chidinma@email.com',
    role: 'Tenant',
    plan: 'Free',
    joined: 'Jan 18, 2026',
    status: 'Active',
    properties: 0,
  },
  {
    name: 'Emeka Nwosu',
    email: 'emeka@email.com',
    role: 'Landlord',
    plan: 'Basic',
    joined: 'Feb 2, 2026',
    status: 'Active',
    properties: 3,
  },
  {
    name: 'Funmi Adeyemi',
    email: 'funmi@email.com',
    role: 'Tenant',
    plan: 'Free',
    joined: 'Feb 14, 2026',
    status: 'Active',
    properties: 0,
  },
  {
    name: 'Halima Usman',
    email: 'halima@email.com',
    role: 'Service Provider',
    plan: 'Free',
    joined: 'Mar 1, 2026',
    status: 'Active',
    properties: 0,
  },
  {
    name: 'Ibrahim Musa',
    email: 'ibrahim@email.com',
    role: 'Property Manager',
    plan: 'Enterprise',
    joined: 'Mar 5, 2026',
    status: 'Active',
    properties: 24,
  },
  {
    name: 'Kola Adeyemi',
    email: 'kola@email.com',
    role: 'Tenant',
    plan: 'Free',
    joined: 'Mar 20, 2026',
    status: 'Suspended',
    properties: 0,
  },
  {
    name: 'Musa Garba',
    email: 'musa@email.com',
    role: 'Landlord',
    plan: 'Basic',
    joined: 'Apr 3, 2026',
    status: 'Active',
    properties: 5,
  },
  {
    name: 'Ngozi Chukwu',
    email: 'ngozi@email.com',
    role: 'Tenant',
    plan: 'Free',
    joined: 'Apr 10, 2026',
    status: 'Active',
    properties: 0,
  },
  {
    name: 'Sade Akinwale',
    email: 'sade@email.com',
    role: 'Service Provider',
    plan: 'Free',
    joined: 'Apr 22, 2026',
    status: 'Active',
    properties: 0,
  },
  {
    name: 'Tunde Bakare',
    email: 'tunde@email.com',
    role: 'Property Manager',
    plan: 'Pro',
    joined: 'May 1, 2026',
    status: 'Active',
    properties: 12,
  },
  {
    name: 'Yemi Oladipo',
    email: 'yemi@email.com',
    role: 'Tenant',
    plan: 'Free',
    joined: 'May 14, 2026',
    status: 'Inactive',
    properties: 0,
  },
];

const propertiesData = [
  {
    name: 'Lekki Phase 1 Complex',
    manager: 'Adewale Johnson',
    location: 'Lekki, Lagos',
    type: 'Apartment',
    units: 12,
    listed: 'Jan 15, 2026',
    status: 'Verified',
    views: 4821,
  },
  {
    name: 'Maitama Residences',
    manager: 'Ibrahim Musa',
    location: 'Maitama, Abuja',
    type: 'Detached',
    units: 4,
    listed: 'Feb 2, 2026',
    status: 'Verified',
    views: 2103,
  },
  {
    name: 'Wuse 2 Towers',
    manager: 'Ibrahim Musa',
    location: 'Wuse 2, Abuja',
    type: 'Apartment',
    units: 6,
    listed: 'Feb 10, 2026',
    status: 'Verified',
    views: 1891,
  },
  {
    name: 'Ikeja GRA Flats',
    manager: 'Tunde Bakare',
    location: 'Ikeja, Lagos',
    type: 'Flat',
    units: 8,
    listed: 'Feb 28, 2026',
    status: 'Verified',
    views: 3204,
  },
  {
    name: 'VI Luxury Suites',
    manager: 'Adewale Johnson',
    location: 'Victoria Island, Lagos',
    type: 'Penthouse',
    units: 2,
    listed: 'Mar 5, 2026',
    status: 'Verified',
    views: 7641,
  },
  {
    name: 'Surulere Annex',
    manager: 'Tunde Bakare',
    location: 'Surulere, Lagos',
    type: 'Flat',
    units: 6,
    listed: 'Mar 12, 2026',
    status: 'Pending Review',
    views: 892,
  },
  {
    name: 'Ajah Estate',
    manager: 'Emeka Nwosu',
    location: 'Ajah, Lagos',
    type: 'Terrace',
    units: 4,
    listed: 'Mar 22, 2026',
    status: 'Verified',
    views: 1204,
  },
  {
    name: 'Gwarinpa Courts',
    manager: 'Ibrahim Musa',
    location: 'Gwarinpa, Abuja',
    type: 'Apartment',
    units: 10,
    listed: 'Apr 1, 2026',
    status: 'Verified',
    views: 2847,
  },
  {
    name: 'Banana Island Mansion',
    manager: 'Musa Garba',
    location: 'Banana Island, Lagos',
    type: 'Detached',
    units: 1,
    listed: 'Apr 15, 2026',
    status: 'Pending Review',
    views: 512,
  },
  {
    name: 'Jabi Lake Towers',
    manager: 'Tunde Bakare',
    location: 'Jabi, Abuja',
    type: 'Apartment',
    units: 16,
    listed: 'May 2, 2026',
    status: 'Flagged',
    views: 301,
  },
];

const transactionsData = [
  {
    ref: 'TXN-78821',
    tenant: 'Adewale Johnson',
    property: 'Lekki Phase 1, Apt 203',
    amount: '₦850,000',
    type: 'Rent',
    method: 'Bank Transfer',
    date: 'Jun 24, 2026',
    status: 'Completed',
  },
  {
    ref: 'TXN-78820',
    tenant: 'Chidinma Okafor',
    property: 'Maitama, Unit 5B',
    amount: '₦1,200,000',
    type: 'Rent',
    method: 'Bank Transfer',
    date: 'Jun 23, 2026',
    status: 'Completed',
  },
  {
    ref: 'TXN-78819',
    tenant: 'Ibrahim Musa',
    property: 'Wuse 2, Apt 14',
    amount: '₦650,000',
    type: 'Rent',
    method: 'Mobile Money',
    date: 'Jun 22, 2026',
    status: 'Pending',
  },
  {
    ref: 'TXN-78818',
    tenant: 'Blessing Eze',
    property: 'Ikeja GRA, Flat 8',
    amount: '₦900,000',
    type: 'Rent',
    method: 'Bank Transfer',
    date: 'Jun 22, 2026',
    status: 'Completed',
  },
  {
    ref: 'TXN-78817',
    tenant: 'Funmi Adeyemi',
    property: 'VI, Apt 12A',
    amount: '₦2,500,000',
    type: 'Rent',
    method: 'Bank Transfer',
    date: 'Jun 21, 2026',
    status: 'Completed',
  },
  {
    ref: 'TXN-78816',
    tenant: 'Kola Adeyemi',
    property: 'Surulere, Unit 3',
    amount: '₦600,000',
    type: 'Rent',
    method: 'Card',
    date: 'Jun 20, 2026',
    status: 'Failed',
  },
  {
    ref: 'TXN-78815',
    tenant: 'Ngozi Chukwu',
    property: 'Gwarinpa, Apt 401',
    amount: '₦750,000',
    type: 'Rent',
    method: 'Card',
    date: 'Jun 19, 2026',
    status: 'Completed',
  },
  {
    ref: 'TXN-78814',
    tenant: 'Emeka Nwosu',
    property: 'Ajah, Flat 1A',
    amount: '₦700,000',
    type: 'Rent',
    method: 'Bank Transfer',
    date: 'Jun 18, 2026',
    status: 'Completed',
  },
  {
    ref: 'SUB-0092',
    tenant: 'Ibrahim Musa',
    property: 'Platform Subscription',
    amount: '₦45,000',
    type: 'Subscription',
    method: 'Card',
    date: 'Jun 17, 2026',
    status: 'Completed',
  },
  {
    ref: 'SUB-0091',
    tenant: 'Adewale Johnson',
    property: 'Platform Subscription',
    amount: '₦25,000',
    type: 'Subscription',
    method: 'Card',
    date: 'Jun 15, 2026',
    status: 'Completed',
  },
];

const uptimeData = [
  {
    service: 'Web App',
    uptime: '99.98%',
    incidents: 0,
    avgResponse: '87ms',
    status: 'Operational',
    lastChecked: '1 min ago',
  },
  {
    service: 'REST API',
    uptime: '99.91%',
    incidents: 1,
    avgResponse: '124ms',
    status: 'Operational',
    lastChecked: '1 min ago',
  },
  {
    service: 'Auth Service',
    uptime: '100%',
    incidents: 0,
    avgResponse: '43ms',
    status: 'Operational',
    lastChecked: '30s ago',
  },
  {
    service: 'Payment Gateway',
    uptime: '99.72%',
    incidents: 2,
    avgResponse: '210ms',
    status: 'Degraded',
    lastChecked: '1 min ago',
  },
  {
    service: 'SMS/Notifications',
    uptime: '99.85%',
    incidents: 1,
    avgResponse: '380ms',
    status: 'Operational',
    lastChecked: '2 min ago',
  },
  {
    service: 'AI Assistant',
    uptime: '99.60%',
    incidents: 1,
    avgResponse: '1.2s',
    status: 'Operational',
    lastChecked: '1 min ago',
  },
  {
    service: 'File Storage',
    uptime: '100%',
    incidents: 0,
    avgResponse: '52ms',
    status: 'Operational',
    lastChecked: '30s ago',
  },
  {
    service: 'Database (Primary)',
    uptime: '100%',
    incidents: 0,
    avgResponse: '18ms',
    status: 'Operational',
    lastChecked: '30s ago',
  },
  {
    service: 'Database (Replica)',
    uptime: '99.95%',
    incidents: 0,
    avgResponse: '22ms',
    status: 'Operational',
    lastChecked: '30s ago',
  },
  {
    service: 'Email Service',
    uptime: '99.40%',
    incidents: 3,
    avgResponse: '480ms',
    status: 'Operational',
    lastChecked: '1 min ago',
  },
];

const PAGE_CONFIG: Record<
  AdminBreakdownType,
  {
    title: string;
    subtitle: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    stat: string;
    statLabel: string;
    trend: string;
    trendUp: boolean;
  }
> = {
  users: {
    title: 'Total Users',
    subtitle: 'All registered users across the platform by role and status',
    icon: Users,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    stat: '12,847',
    statLabel: 'Registered Users',
    trend: '+18% this month',
    trendUp: true,
  },
  properties: {
    title: 'Properties Listed',
    subtitle: 'All property listings on the platform with verification status',
    icon: Building2,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    stat: '5,421',
    statLabel: 'Properties',
    trend: '+12% this month',
    trendUp: true,
  },
  transactions: {
    title: 'Total Transactions',
    subtitle: 'Platform-wide payment activity and transaction ledger',
    icon: DollarSign,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    stat: '₦2.4B',
    statLabel: 'Total Volume',
    trend: '+24% this month',
    trendUp: true,
  },
  uptime: {
    title: 'System Uptime',
    subtitle: 'Live service health and infrastructure monitoring',
    icon: Activity,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    stat: '99.7%',
    statLabel: 'Overall Uptime',
    trend: 'Above SLA target',
    trendUp: true,
  },
};

export function AdminBreakdownPage({ breakdownType, onBack }: AdminBreakdownPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const config = PAGE_CONFIG[breakdownType];
  const Icon = config.icon;

  const renderSummaryCards = () => {
    if (breakdownType === 'users') {
      const byRole = [
        {
          label: 'Property Managers',
          value: '1,247',
          color: 'bg-blue-50 border-blue-200 text-blue-700',
        },
        {
          label: 'Landlords',
          value: '892',
          color: 'bg-purple-50 border-purple-200 text-purple-700',
        },
        {
          label: 'Tenants',
          value: '8,421',
          color: 'bg-green-50 border-green-200 text-green-700',
        },
        {
          label: 'Service Providers',
          value: '2,287',
          color: 'bg-orange-50 border-orange-200 text-orange-700',
        },
      ];
      return (
        <div className="mb-6 grid grid-cols-4 gap-4">
          {byRole.map((c) => (
            <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-sm">{c.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'properties') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Verified',
              value: '4,891',
              color: 'bg-green-50 border-green-200 text-green-700',
            },
            {
              label: 'Pending Review',
              value: '412',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Flagged',
              value: '118',
              color: 'bg-red-50 border-red-200 text-red-700',
            },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-sm">{c.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'transactions') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Completed',
              value: '₦2.31B',
              color: 'bg-green-50 border-green-200 text-green-700',
            },
            {
              label: 'Pending',
              value: '₦62M',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Failed',
              value: '₦27M',
              color: 'bg-red-50 border-red-200 text-red-700',
            },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-sm">{c.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'uptime') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Operational',
              value: '9/10',
              color: 'bg-green-50 border-green-200 text-green-700',
            },
            {
              label: 'Degraded',
              value: '1/10',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Total Incidents (30d)',
              value: '8',
              color: 'bg-orange-50 border-orange-200 text-orange-700',
            },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-sm">{c.label}</p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderTable = () => {
    if (breakdownType === 'users') {
      const filtered = usersData.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.role.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {['User', 'Role', 'Plan', 'Properties', 'Joined', 'Status'].map((col) => (
                <th
                  key={col}
                  className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((u, i) => (
              <tr key={i} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <span className="text-xs font-semibold text-blue-700">
                        {u.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.role === 'Property Manager'
                        ? 'bg-blue-100 text-blue-700'
                        : u.role === 'Landlord'
                          ? 'bg-purple-100 text-purple-700'
                          : u.role === 'Tenant'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{u.plan}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{u.properties}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{u.joined}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.status === 'Active'
                        ? 'bg-green-100 text-green-700'
                        : u.status === 'Suspended'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'properties') {
      const filtered = propertiesData.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.manager.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {[
                'Property',
                'Manager',
                'Location',
                'Type',
                'Units',
                'Listed',
                'Views',
                'Status',
              ].map((col) => (
                <th
                  key={col}
                  className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p, i) => (
              <tr key={i} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50">
                      <Building2 className="h-4 w-4 text-purple-500" />
                    </div>
                    <p className="font-medium text-gray-800">{p.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{p.manager}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{p.location}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{p.type}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{p.units}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{p.listed}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                  {p.views.toLocaleString()}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      p.status === 'Verified'
                        ? 'bg-green-100 text-green-700'
                        : p.status === 'Pending Review'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'transactions') {
      const filtered = transactionsData.filter(
        (t) =>
          t.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.tenant.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.property.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {[
                'Reference',
                'User',
                'Property / Description',
                'Amount',
                'Type',
                'Method',
                'Date',
                'Status',
              ].map((col) => (
                <th
                  key={col}
                  className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((t, i) => (
              <tr key={i} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap text-gray-500">
                  {t.ref}
                </td>
                <td className="px-4 py-3.5 font-medium whitespace-nowrap text-gray-800">
                  {t.tenant}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{t.property}</td>
                <td className="px-4 py-3.5 font-semibold whitespace-nowrap text-gray-900">
                  {t.amount}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      t.type === 'Rent'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{t.method}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{t.date}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      t.status === 'Completed'
                        ? 'text-green-700'
                        : t.status === 'Pending'
                          ? 'text-yellow-700'
                          : 'text-red-700'
                    }`}
                  >
                    {t.status === 'Completed' ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : t.status === 'Pending' ? (
                      <Clock className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'uptime') {
      const filtered = uptimeData.filter((s) =>
        s.service.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {[
                'Service',
                'Uptime (30d)',
                'Incidents',
                'Avg Response',
                'Status',
                'Last Checked',
              ].map((col) => (
                <th
                  key={col}
                  className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((s, i) => (
              <tr key={i} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${s.status === 'Operational' ? 'bg-green-500' : 'bg-yellow-500'}`}
                    />
                    <span className="font-medium text-gray-800">{s.service}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-semibold whitespace-nowrap text-gray-900">
                  {s.uptime}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`font-medium ${s.incidents === 0 ? 'text-green-600' : s.incidents >= 3 ? 'text-red-600' : 'text-yellow-600'}`}
                  >
                    {s.incidents}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap text-gray-600">
                  {s.avgResponse}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.status === 'Operational'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs whitespace-nowrap text-gray-500">
                  {s.lastChecked}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  };

  const rowCount = {
    users: usersData.length,
    properties: propertiesData.length,
    transactions: transactionsData.length,
    uptime: uptimeData.length,
  }[breakdownType];

  const rowLabel = {
    users: 'users shown',
    properties: 'listings shown',
    transactions: 'transactions shown',
    uptime: 'services monitored',
  }[breakdownType];

  return (
    <div className="space-y-6 p-6">
      {/* Back nav */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin Dashboard
      </button>

      {/* Hero row */}
      <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-6">
        <div
          className={`h-14 w-14 rounded-xl ${config.iconBg} flex flex-shrink-0 items-center justify-center`}
        >
          <Icon className={`h-7 w-7 ${config.iconColor}`} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{config.title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{config.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">{config.stat}</p>
          <p className="text-sm text-gray-500">{config.statLabel}</p>
          <div
            className={`mt-1 flex items-center justify-end gap-1 text-sm font-medium ${config.trendUp ? 'text-green-600' : 'text-red-500'}`}
          >
            {config.trendUp ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {config.trend}
          </div>
        </div>
      </div>

      {/* Summary KPI cards */}
      {renderSummaryCards()}

      {/* Table card */}
      <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700">
            {rowCount} {rowLabel}
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-52 rounded-lg border border-gray-200 py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">{renderTable()}</div>
      </div>
    </div>
  );
}
