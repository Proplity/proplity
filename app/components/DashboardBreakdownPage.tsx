import { useState } from 'react';
import {
  ArrowLeft,
  Home,
  Users,
  DollarSign,
  AlertCircle,
  UserX,
  MoreVertical,
  Power,
  PowerOff,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Download,
  Search,
  Filter,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export type BreakdownType = 'properties' | 'tenants' | 'rent' | 'maintenance' | 'renewals';

interface DashboardBreakdownPageProps {
  breakdownType: BreakdownType;
  onBack: () => void;
}

interface PropertyStatus {
  [key: string]: 'Active' | 'Inactive' | 'Partial';
}

const propertyData = [
  {
    id: 'lekki-phase-1',
    name: 'Lekki Phase 1 Complex',
    location: 'Lekki, Lagos',
    type: 'Apartment',
    units: '12',
    occupancy: '11/12',
    defaultStatus: 'Active' as const,
  },
  {
    id: 'maitama-residences',
    name: 'Maitama Residences',
    location: 'Maitama, Abuja',
    type: 'Detached',
    units: '4',
    occupancy: '4/4',
    defaultStatus: 'Active' as const,
  },
  {
    id: 'wuse-2-towers',
    name: 'Wuse 2 Towers',
    location: 'Wuse 2, Abuja',
    type: 'Apartment',
    units: '6',
    occupancy: '5/6',
    defaultStatus: 'Active' as const,
  },
  {
    id: 'ikeja-gra-flats',
    name: 'Ikeja GRA Flats',
    location: 'Ikeja, Lagos',
    type: 'Flat',
    units: '8',
    occupancy: '7/8',
    defaultStatus: 'Active' as const,
  },
  {
    id: 'vi-luxury-suites',
    name: 'VI Luxury Suites',
    location: 'Victoria Island, Lagos',
    type: 'Penthouse',
    units: '2',
    occupancy: '2/2',
    defaultStatus: 'Active' as const,
  },
  {
    id: 'surulere-annex',
    name: 'Surulere Annex',
    location: 'Surulere, Lagos',
    type: 'Flat',
    units: '6',
    occupancy: '4/6',
    defaultStatus: 'Partial' as const,
  },
  {
    id: 'ajah-estate',
    name: 'Ajah Estate',
    location: 'Ajah, Lagos',
    type: 'Terrace',
    units: '4',
    occupancy: '3/4',
    defaultStatus: 'Partial' as const,
  },
  {
    id: 'gwarinpa-courts',
    name: 'Gwarinpa Courts',
    location: 'Gwarinpa, Abuja',
    type: 'Apartment',
    units: '10',
    occupancy: '10/10',
    defaultStatus: 'Active' as const,
  },
];

const activeTenants = [
  [
    'Adewale Johnson',
    'Lekki Phase 1',
    'Apt 203',
    'Jan 2025',
    'Dec 2025',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paid</span>,
  ],
  [
    'Chidinma Okafor',
    'Maitama Residences',
    'Unit 5B',
    'Mar 2025',
    'Feb 2026',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paid</span>,
  ],
  [
    'Ibrahim Musa',
    'Wuse 2 Towers',
    'Apt 14',
    'Jun 2024',
    'May 2025',
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Pending</span>,
  ],
  [
    'Blessing Eze',
    'Ikeja GRA Flats',
    'Flat 8',
    'Sep 2024',
    'Aug 2025',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paid</span>,
  ],
  [
    'Funmi Adeyemi',
    'VI Luxury Suites',
    'Apt 12A',
    'Apr 2025',
    'Mar 2026',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paid</span>,
  ],
  [
    'Yemi Oladipo',
    'Surulere Annex',
    'Unit 7',
    'Jul 2024',
    'Jun 2025',
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Overdue</span>,
  ],
  [
    'Tunde Bakare',
    'Ajah Estate',
    'Flat 3C',
    'Aug 2024',
    'Jul 2025',
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Pending</span>,
  ],
  [
    'Ngozi Chukwu',
    'Gwarinpa Courts',
    'Apt 401',
    'Feb 2025',
    'Jan 2026',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paid</span>,
  ],
  [
    'Emeka Nwosu',
    'Lekki Phase 1',
    'Apt 107',
    'May 2024',
    'Apr 2025',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paid</span>,
  ],
  [
    'Aisha Bello',
    'Ajah Estate',
    'Flat 1A',
    'Jun 2024',
    'May 2025',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paid</span>,
  ],
  [
    'Chidi Amaechi',
    'Wuse 2 Towers',
    'Apt 06',
    'Oct 2024',
    'Sep 2025',
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Pending</span>,
  ],
  [
    'Ola Martins',
    'Gwarinpa Courts',
    'Apt 203',
    'Jan 2025',
    'Dec 2025',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Paid</span>,
  ],
];

const evictedTenants = [
  [
    'Kola Adeyemi',
    'Surulere Annex',
    'Unit 3',
    'Feb 14, 2026',
    'Non-payment of rent',
    '₦1,800,000',
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Vacated</span>,
  ],
  [
    'Musa Garba',
    'Wuse 2 Towers',
    'Apt 09',
    'Jan 03, 2026',
    'Property damage',
    '₦450,000',
    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
      Legal Action
    </span>,
  ],
  [
    'Sade Akinwale',
    'Ajah Estate',
    'Flat 2B',
    'Dec 20, 2025',
    'Lease violation',
    '₦0',
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Settled</span>,
  ],
  [
    'Emeka Obi',
    'Ikeja GRA Flats',
    'Flat 5',
    'Nov 11, 2025',
    'Non-payment of rent',
    '₦2,700,000',
    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
      Legal Action
    </span>,
  ],
  [
    'Halima Usman',
    'Lekki Phase 1',
    'Apt 108',
    'Oct 05, 2025',
    'Subletting without consent',
    '₦0',
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Settled</span>,
  ],
];

const rentRows = [
  [
    'Adewale Johnson',
    'Lekki Phase 1, Apt 203',
    '₦850,000',
    'Bank Transfer',
    '2 hrs ago',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Issued</span>,
  ],
  [
    'Chidinma Okafor',
    'Maitama, Unit 5B',
    '₦1,200,000',
    'Bank Transfer',
    '5 hrs ago',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Issued</span>,
  ],
  [
    'Ibrahim Musa',
    'Wuse 2, Apt 14',
    '₦650,000',
    'Mobile Money',
    '1 day ago',
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Pending</span>,
  ],
  [
    'Blessing Eze',
    'Ikeja GRA, Flat 8',
    '₦900,000',
    'Bank Transfer',
    '2 days ago',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Issued</span>,
  ],
  [
    'Funmi Adeyemi',
    'VI, Apt 12A',
    '₦2,500,000',
    'Bank Transfer',
    '3 days ago',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Issued</span>,
  ],
  [
    'Ngozi Chukwu',
    'Gwarinpa, Apt 401',
    '₦750,000',
    'Card',
    '4 days ago',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Issued</span>,
  ],
  [
    'Emeka Nwosu',
    'Lekki Phase 1, Apt 107',
    '₦850,000',
    'Bank Transfer',
    '5 days ago',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Issued</span>,
  ],
  [
    'Aisha Bello',
    'Ajah Estate, Flat 1A',
    '₦700,000',
    'Mobile Money',
    '6 days ago',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Issued</span>,
  ],
];

// ── Rent chart data ──────────────────────────────────────────────────────────
const rentTrend = [
  { month: 'Jan', collected: 9400000, expected: 10200000 },
  { month: 'Feb', collected: 10100000, expected: 10200000 },
  { month: 'Mar', collected: 9800000, expected: 10200000 },
  { month: 'Apr', collected: 11200000, expected: 11500000 },
  { month: 'May', collected: 11800000, expected: 12000000 },
  { month: 'Jun', collected: 12400000, expected: 12800000 },
];

const rentByProperty = [
  { name: 'VI Luxury Suites', amount: 2500000, fill: '#6366f1' },
  { name: 'Maitama Residences', amount: 1200000, fill: '#3b82f6' },
  { name: 'Ikeja GRA Flats', amount: 900000, fill: '#10b981' },
  { name: 'Lekki Phase 1', amount: 850000, fill: '#f59e0b' },
  { name: 'Lekki Ph.1 #107', amount: 850000, fill: '#f97316' },
  { name: 'Gwarinpa Courts', amount: 750000, fill: '#8b5cf6' },
  { name: 'Ajah Estate', amount: 700000, fill: '#ec4899' },
  { name: 'Wuse 2 Towers', amount: 650000, fill: '#14b8a6' },
];

const paymentMethods = [
  { name: 'Bank Transfer', value: 6, fill: '#3b82f6' },
  { name: 'Mobile Money', value: 2, fill: '#10b981' },
  { name: 'Card', value: 1, fill: '#f59e0b' },
];

const rentStatus = [
  { name: 'Collected', value: 8550000, fill: '#10b981' },
  { name: 'Pending', value: 650000, fill: '#f59e0b' },
];

function fmtNaira(v: number) {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  return `₦${(v / 1_000).toFixed(0)}K`;
}

const maintenanceRows = [
  [
    '#MR-041',
    'Lekki Phase 1, Apt 203',
    'AC unit not cooling',
    'Adewale Johnson',
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">High</span>,
    '3',
  ],
  [
    '#MR-042',
    'Wuse 2, Apt 14',
    'Leaking roof',
    'Ibrahim Musa',
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">High</span>,
    '5',
  ],
  [
    '#MR-043',
    'Surulere, Unit 7',
    'Broken door lock',
    'Yemi Oladipo',
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Medium</span>,
    '2',
  ],
  [
    '#MR-044',
    'Ajah, Flat 3C',
    'Plumbing issue',
    'Tunde Bakare',
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Medium</span>,
    '7',
  ],
  [
    '#MR-045',
    'Ikeja GRA, Flat 8',
    'Electrical fault',
    'Blessing Eze',
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">High</span>,
    '1',
  ],
  [
    '#MR-046',
    'VI, Apt 12A',
    'Paint peeling',
    'Funmi Adeyemi',
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Low</span>,
    '10',
  ],
  [
    '#MR-047',
    'Gwarinpa, Apt 401',
    'Gate motor fault',
    'Ngozi Chukwu',
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Medium</span>,
    '4',
  ],
];

const renewalsRows = [
  [
    'Funmi Adeyemi',
    'VI, Apt 12A',
    'Apt 12A',
    '₦2,500,000/yr',
    'May 15, 2026',
    '15',
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Contacted</span>,
    <button className="text-xs font-medium text-blue-600 hover:underline">Send Reminder</button>,
  ],
  [
    'Yemi Oladipo',
    'Surulere, Unit 7',
    'Unit 7',
    '₦900,000/yr',
    'May 28, 2026',
    '28',
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Pending</span>,
    <button className="text-xs font-medium text-blue-600 hover:underline">Contact Now</button>,
  ],
  [
    'Tunde Bakare',
    'Ajah, Flat 3C',
    'Flat 3C',
    '₦700,000/yr',
    'June 5, 2026',
    '36',
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Pending</span>,
    <button className="text-xs font-medium text-blue-600 hover:underline">Contact Now</button>,
  ],
  [
    'Adewale Johnson',
    'Lekki Phase 1',
    'Apt 203',
    '₦850,000/yr',
    'July 1, 2026',
    '62',
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Not Started</span>,
    <button className="text-xs font-medium text-blue-600 hover:underline">Contact Now</button>,
  ],
  [
    'Ngozi Chukwu',
    'Gwarinpa Courts',
    'Apt 401',
    '₦750,000/yr',
    'July 15, 2026',
    '76',
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Renewed</span>,
    <button className="cursor-default text-xs font-medium text-gray-400">Done</button>,
  ],
  [
    'Emeka Nwosu',
    'Lekki Phase 1',
    'Apt 107',
    '₦850,000/yr',
    'Aug 1, 2026',
    '93',
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Not Started</span>,
    <button className="text-xs font-medium text-blue-600 hover:underline">Contact Now</button>,
  ],
  [
    'Chidinma Okafor',
    'Maitama Residences',
    'Unit 5B',
    '₦1,200,000/yr',
    'Aug 20, 2026',
    '112',
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Not Started</span>,
    <button className="text-xs font-medium text-blue-600 hover:underline">Contact Now</button>,
  ],
  [
    'Blessing Eze',
    'Ikeja GRA Flats',
    'Flat 8',
    '₦900,000/yr',
    'Sep 1, 2026',
    '124',
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Not Started</span>,
    <button className="text-xs font-medium text-blue-600 hover:underline">Contact Now</button>,
  ],
  [
    'Aisha Bello',
    'Ajah Estate',
    'Flat 1A',
    '₦700,000/yr',
    'Sep 15, 2026',
    '138',
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Not Started</span>,
    <button className="text-xs font-medium text-blue-600 hover:underline">Contact Now</button>,
  ],
];

const PAGE_CONFIG: Record<
  BreakdownType,
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
    accentColor: string;
  }
> = {
  properties: {
    title: 'Total Properties',
    subtitle: 'All properties under your management portfolio',
    icon: Home,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    stat: '8',
    statLabel: 'Properties',
    trend: '+3 this quarter',
    trendUp: true,
    accentColor: 'blue',
  },
  tenants: {
    title: 'Active Tenants',
    subtitle: 'All current and past tenants across your portfolio',
    icon: Users,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    stat: '187',
    statLabel: 'Active Tenants',
    trend: '+12 this month',
    trendUp: true,
    accentColor: 'green',
  },
  rent: {
    title: 'Rent Collected — This Month',
    subtitle: 'All rent payments received and pending for the current month',
    icon: DollarSign,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    stat: '₦12.4M',
    statLabel: 'Collected',
    trend: '+8% vs last month',
    trendUp: true,
    accentColor: 'emerald',
  },
  maintenance: {
    title: 'Pending Maintenance Requests',
    subtitle: 'Open maintenance tickets requiring attention',
    icon: AlertCircle,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    stat: '7',
    statLabel: 'Open Requests',
    trend: '-3 since last week',
    trendUp: false,
    accentColor: 'orange',
  },
  renewals: {
    title: 'Upcoming Lease Renewals',
    subtitle: 'Leases expiring in the next 6 months requiring follow-up',
    icon: Home,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    stat: '9',
    statLabel: 'Renewals Due',
    trend: '2 urgent',
    trendUp: false,
    accentColor: 'purple',
  },
};

export function DashboardBreakdownPage({ breakdownType, onBack }: DashboardBreakdownPageProps) {
  const [tenantTab, setTenantTab] = useState<'active' | 'evicted'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyStatuses, setPropertyStatuses] = useState<PropertyStatus>(() => {
    const initial: PropertyStatus = {};
    propertyData.forEach((p) => {
      initial[p.id] = p.defaultStatus;
    });
    return initial;
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const config = PAGE_CONFIG[breakdownType];
  const Icon = config.icon;

  const handleTogglePropertyStatus = (propertyId: string) => {
    setPropertyStatuses((prev) => ({
      ...prev,
      [propertyId]: prev[propertyId] === 'Active' ? 'Inactive' : 'Active',
    }));
    setOpenDropdown(null);
    const property = propertyData.find((p) => p.id === propertyId);
    const newStatus = propertyStatuses[propertyId] === 'Active' ? 'Inactive' : 'Active';
    alert(
      `Property "${property?.name}" has been ${newStatus === 'Active' ? 'activated' : 'deactivated'}.`,
    );
  };

  const handleEditProperty = (propertyId: string) => {
    const property = propertyData.find((p) => p.id === propertyId);
    setOpenDropdown(null);
    alert(`Edit property: ${property?.name}\n\nThis would open a property editor form.`);
  };

  const handleDeleteProperty = (propertyId: string) => {
    const property = propertyData.find((p) => p.id === propertyId);
    setOpenDropdown(null);
    if (
      confirm(
        `Are you sure you want to delete "${property?.name}"?\n\nThis action cannot be undone.`,
      )
    ) {
      alert(`Property "${property?.name}" deleted successfully.`);
    }
  };

  const renderSummaryCards = () => {
    if (breakdownType === 'properties') {
      const active = Object.values(propertyStatuses).filter((s) => s === 'Active').length;
      const partial = Object.values(propertyStatuses).filter((s) => s === 'Partial').length;
      const inactive = Object.values(propertyStatuses).filter((s) => s === 'Inactive').length;
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Active',
              value: active,
              color: 'bg-green-50 border-green-200 text-green-700',
            },
            {
              label: 'Partially Occupied',
              value: partial,
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Inactive',
              value: inactive,
              color: 'bg-gray-50 border-gray-200 text-gray-600',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'tenants') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Paid This Month',
              value: '9',
              color: 'bg-green-50 border-green-200 text-green-700',
            },
            {
              label: 'Pending Payment',
              value: '2',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Overdue',
              value: '1',
              color: 'bg-red-50 border-red-200 text-red-700',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'rent') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Total Collected',
              value: '₦8.55M',
              color: 'bg-green-50 border-green-200 text-green-700',
            },
            {
              label: 'Pending',
              value: '₦650K',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Receipts Issued',
              value: '7/8',
              color: 'bg-blue-50 border-blue-200 text-blue-700',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'maintenance') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'High Priority',
              value: '3',
              color: 'bg-red-50 border-red-200 text-red-700',
            },
            {
              label: 'Medium Priority',
              value: '3',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Low Priority',
              value: '1',
              color: 'bg-gray-50 border-gray-200 text-gray-600',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'renewals') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Urgent (< 30 days)',
              value: '2',
              color: 'bg-red-50 border-red-200 text-red-700',
            },
            {
              label: 'Contacted',
              value: '1',
              color: 'bg-blue-50 border-blue-200 text-blue-700',
            },
            {
              label: 'Already Renewed',
              value: '1',
              color: 'bg-green-50 border-green-200 text-green-700',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderTable = () => {
    if (breakdownType === 'properties') {
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {['Property', 'Location', 'Type', 'Units', 'Occupancy', 'Status', 'Actions'].map(
                (col) => (
                  <th
                    key={col}
                    className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {propertyData
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.location.toLowerCase().includes(searchQuery.toLowerCase()),
              )
              .map((property) => {
                const status = propertyStatuses[property.id];
                const isInactive = status === 'Inactive';
                return (
                  <tr
                    key={property.id}
                    className={`transition-colors hover:bg-gray-50 ${isInactive ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                          <Home className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{property.name}</p>
                          {isInactive && (
                            <p className="text-xs text-gray-400 italic">Deactivated</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                      {property.location}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{property.type}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                      {property.units}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                      {property.occupancy}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : status === 'Inactive'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdown(openDropdown === property.id ? null : property.id);
                          }}
                          className="rounded-lg p-1.5 transition-colors hover:bg-gray-200"
                        >
                          <MoreVertical className="h-4 w-4 text-gray-500" />
                        </button>
                        {openDropdown === property.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenDropdown(null)}
                            />
                            <div className="absolute top-9 right-0 z-20 min-w-[190px] rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
                              <button
                                onClick={() => handleTogglePropertyStatus(property.id)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50"
                              >
                                {status === 'Active' ? (
                                  <>
                                    <PowerOff className="h-4 w-4 text-orange-500" />
                                    <span>Deactivate Property</span>
                                  </>
                                ) : (
                                  <>
                                    <Power className="h-4 w-4 text-green-600" />
                                    <span>Activate Property</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleEditProperty(property.id)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50"
                              >
                                <Edit className="h-4 w-4 text-blue-500" />
                                <span>Edit Property</span>
                              </button>
                              <div className="my-1 border-t border-gray-100" />
                              <button
                                onClick={() => handleDeleteProperty(property.id)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Delete Property</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'tenants') {
      const rows = tenantTab === 'active' ? activeTenants : evictedTenants;
      const columns =
        tenantTab === 'active'
          ? ['Tenant', 'Property', 'Unit', 'Lease Start', 'Lease End', 'Rent Status']
          : ['Tenant', 'Property', 'Unit', 'Eviction Date', 'Reason', 'Arrears Owed', 'Status'];

      return (
        <table className="w-full text-sm">
          <thead
            className={`sticky top-0 z-10 ${tenantTab === 'evicted' ? 'bg-red-50' : 'bg-gray-50'}`}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`border-b px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase ${
                    tenantTab === 'evicted'
                      ? 'border-red-100 text-red-500'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows
              .filter((row) => (row[0] as string).toLowerCase().includes(searchQuery.toLowerCase()))
              .map((row, i) => (
                <tr
                  key={i}
                  className={`transition-colors ${tenantTab === 'evicted' ? 'hover:bg-red-50/40' : 'hover:bg-gray-50'}`}
                >
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'rent') {
      const columns = ['Tenant', 'Property', 'Amount', 'Payment Method', 'Date', 'Receipt'];
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {columns.map((col) => (
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
            {rentRows
              .filter((row) => (row[0] as string).toLowerCase().includes(searchQuery.toLowerCase()))
              .map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'maintenance') {
      const columns = ['Request ID', 'Property', 'Issue', 'Reported By', 'Priority', 'Days Open'];
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {columns.map((col) => (
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
            {maintenanceRows
              .filter(
                (row) =>
                  (row[2] as string).toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (row[1] as string).toLowerCase().includes(searchQuery.toLowerCase()),
              )
              .map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'renewals') {
      const columns = [
        'Tenant',
        'Property',
        'Unit',
        'Current Rent',
        'Lease End',
        'Days Left',
        'Contact Status',
        'Action',
      ];
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {columns.map((col) => (
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
            {renewalsRows
              .filter((row) => (row[0] as string).toLowerCase().includes(searchQuery.toLowerCase()))
              .map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>

      {/* Hero Row */}
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

      {/* Summary cards */}
      {renderSummaryCards()}

      {/* ── Rent charts (only on rent breakdown) ── */}
      {breakdownType === 'rent' && (
        <div className="space-y-6">
          {/* Row 1 — collection trend + per-property bar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Area chart: collected vs expected */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Collection Trend</h3>
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <TrendingUp className="h-3.5 w-3.5" /> +8% vs last month
                </span>
              </div>
              <p className="mb-4 text-xs text-gray-500">Collected vs. expected · Jan–Jun 2026</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={rentTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradExpected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e0e7ff" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#e0e7ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtNaira} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip formatter={(v: number) => fmtNaira(v)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="expected"
                    name="Expected"
                    stroke="#818cf8"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    fill="url(#gradExpected)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Collected"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#gradCollected)"
                    dot={{ r: 4, fill: '#10b981' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Horizontal bar: rent per property */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Rent by Property</h3>
              <p className="mb-4 text-xs text-gray-500">This month's payments per property</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={rentByProperty}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 4, bottom: 0 }}
                  barSize={14}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtNaira} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip formatter={(v: number) => fmtNaira(v)} />
                  <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                    {rentByProperty.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2 — payment method donut + collection status donut */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Donut: payment methods */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Payment Methods</h3>
              <p className="mb-4 text-xs text-gray-500">
                Distribution for this month's transactions
              </p>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {paymentMethods.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v} payment${v !== 1 ? 's' : ''}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {paymentMethods.map((m) => (
                    <div key={m.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ background: m.fill }}
                        />
                        <span className="text-sm text-gray-700">{m.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Donut: collection status */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Collection Status</h3>
              <p className="mb-4 text-xs text-gray-500">Collected vs. still pending · this month</p>
              <div className="flex items-center gap-6">
                <div className="relative flex-shrink-0">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={rentStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        dataKey="value"
                        paddingAngle={3}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {rentStatus.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtNaira(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">93%</p>
                      <p className="text-xs text-gray-400">rate</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {rentStatus.map((s) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ background: s.fill }}
                        />
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {fmtNaira(s.value)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        style={{ width: '93%' }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">₦8.55M of ₦9.2M expected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
        {/* Table toolbar */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-4">
          {/* Tenant tabs (only for tenants page) */}
          {breakdownType === 'tenants' ? (
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setTenantTab('active')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tenantTab === 'active'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Active
                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                  12
                </span>
              </button>
              <button
                onClick={() => setTenantTab('evicted')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tenantTab === 'evicted'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserX className="h-3.5 w-3.5" />
                Evicted
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                  5
                </span>
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-gray-700">
              {breakdownType === 'properties'
                ? `${propertyData.length} properties`
                : breakdownType === 'rent'
                  ? `${rentRows.length} transactions`
                  : breakdownType === 'maintenance'
                    ? `${maintenanceRows.length} open requests`
                    : `${renewalsRows.length} upcoming renewals`}
            </p>
          )}

          <div className="flex items-center gap-2">
            {/* Search */}
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

        {/* Table */}
        <div className="overflow-x-auto">{renderTable()}</div>
      </div>
    </div>
  );
}
