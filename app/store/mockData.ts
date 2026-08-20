import { Zap, Droplets, Lock, Car, Wind, Wifi, Maximize2, Home } from 'lucide-react';

export interface Property {
  id: number;
  title: string;
  location: string;
  price: string;
  bedrooms: number;
  bathrooms: number;
  sqft: string;
  status: string;
  verified: boolean;
  trustScore: number;
  features: string[];
  agent: string;
  image: string;
  neighborhood: {
    safety: number;
    accessibility: number;
    powerReliability: number;
    waterSupply: number;
  };
}

export const mockProperties: Property[] = [
  {
    id: 1,
    title: '3 Bedroom Flat',
    location: 'Lekki Phase 1, Lagos',
    price: '₦1,200,000/year',
    bedrooms: 3,
    bathrooms: 2,
    sqft: '1,200 sq ft',
    status: 'available',
    verified: true,
    trustScore: 95,
    features: ['24/7 Power', 'Borehole', 'Security', 'Parking'],
    agent: 'Verified Landlord',
    image: 'bg-gradient-to-br from-blue-100 to-blue-200',
    neighborhood: {
      safety: 9,
      accessibility: 8,
      powerReliability: 7,
      waterSupply: 9,
    },
  },
  {
    id: 2,
    title: '2 Bedroom Apartment',
    location: 'Ikeja Gra, Lagos',
    price: '₦850,000/year',
    bedrooms: 2,
    bathrooms: 2,
    sqft: '950 sq ft',
    status: 'available',
    verified: true,
    trustScore: 92,
    features: ['24/7 Power', 'Water treatment', 'Gym', 'Parking'],
    agent: 'Verified Landlord',
    image: 'bg-gradient-to-br from-green-100 to-green-200',
    neighborhood: {
      safety: 8,
      accessibility: 9,
      powerReliability: 8,
      waterSupply: 8,
    },
  },
  {
    id: 3,
    title: 'Self Contain Apartment',
    location: 'Yaba, Lagos',
    price: '₦400,000/year',
    bedrooms: 1,
    bathrooms: 1,
    sqft: '450 sq ft',
    status: 'available',
    verified: false,
    trustScore: 84,
    features: ['Security', 'Parking'],
    agent: 'Agent Properties',
    image: 'bg-gradient-to-br from-purple-100 to-purple-200',
    neighborhood: {
      safety: 7,
      accessibility: 9,
      powerReliability: 5,
      waterSupply: 7,
    },
  },
  {
    id: 4,
    title: '4 Bedroom Terraced Duplex',
    location: 'Victoria Island, Lagos',
    price: '₦3,500,000/year',
    bedrooms: 4,
    bathrooms: 4,
    sqft: '2,800 sq ft',
    status: 'available',
    verified: true,
    trustScore: 97,
    features: ['24/7 Power', 'Swimming Pool', 'Gym', 'Security', 'Parking'],
    agent: 'Verified Developer',
    image: 'bg-gradient-to-br from-orange-100 to-orange-200',
    neighborhood: {
      safety: 9,
      accessibility: 9,
      powerReliability: 9,
      waterSupply: 9,
    },
  },
];

export const mockDashboardStats = [
  { label: 'Total Properties', value: '12', change: '+2 new this month', color: 'blue' },
  { label: 'Occupied Units', value: '42/48', change: '87.5% occupancy rate', color: 'green' },
  { label: 'Rent Collected', value: '₦4.8M', change: '92% of current month', color: 'purple' },
  { label: 'Pending Maintenance', value: '5', change: '2 assigned, 3 open', color: 'orange' },
];

export const mockRecentPayments = [
  {
    id: 1,
    tenant: 'Chinedu Okafor',
    property: 'Highland Park, Unit 4B',
    amount: '₦350,000',
    date: 'Oct 15, 2026',
    status: 'completed',
  },
  {
    id: 2,
    tenant: 'Fatima Bello',
    property: 'Sterling Apartments, Unit 2A',
    amount: '₦180,000',
    date: 'Oct 14, 2026',
    status: 'completed',
  },
  {
    id: 3,
    tenant: 'Oluwaseun Ajayi',
    property: 'Oakwood Villa, Unit 12',
    amount: '₦220,000',
    date: 'Oct 12, 2026',
    status: 'pending',
  },
  {
    id: 4,
    tenant: 'Emeka Nwosu',
    property: 'Highland Park, Unit 3A',
    amount: '₦350,000',
    date: 'Oct 10, 2026',
    status: 'completed',
  },
];

export const mockUpcomingRenewals = [
  {
    id: 1,
    tenant: 'Amina Yusuf',
    property: 'Sterling Apartments, Unit 5C',
    expiryDate: 'Nov 30, 2026',
    daysLeft: 44,
    amount: '₦1.8M/year',
    status: 'contacted',
  },
  {
    id: 2,
    tenant: 'Tunde Bakare',
    property: 'Highland Park, Unit 1A',
    expiryDate: 'Dec 15, 2026',
    daysLeft: 59,
    amount: '₦3.5M/year',
    status: 'pending',
  },
  {
    id: 3,
    tenant: 'Sarah Connor',
    property: 'Oakwood Villa, Unit 4',
    expiryDate: 'Jan 05, 2027',
    daysLeft: 80,
    amount: '₦2.2M/year',
    status: 'pending',
  },
];

export const mockAvailablePropertiesForAddTenant = [
  {
    id: 1,
    name: 'Highland Park Residences - Unit 2A (Vacant)',
    address: '12 Admiralty Way, Lekki Phase 1',
    rentAmount: 2500000,
  },
  {
    id: 2,
    name: 'Sterling Apartments - Unit 5C (Vacant)',
    address: '8 Kingsway Road, Ikoyi',
    rentAmount: 1800000,
  },
  {
    id: 3,
    name: 'Oakwood Villa - Unit 4 (Vacant)',
    address: '15 Mobolaji Bank Anthony Way, Ikeja',
    rentAmount: 2200000,
  },
];

export const mockUsersData = [
  {
    id: '1',
    name: 'Alex Vance',
    email: 'manager@proplity.com',
    role: 'MANAGER',
    status: 'ACTIVE',
    properties: 12,
    joined: 'Jan 15, 2026',
  },
  {
    id: '2',
    name: 'Eleanor Sterling',
    email: 'landlord@proplity.com',
    role: 'LANDLORD',
    status: 'ACTIVE',
    properties: 5,
    joined: 'Feb 20, 2026',
  },
  {
    id: '3',
    name: 'Jordan Hayes',
    email: 'tenant@proplity.com',
    role: 'TENANT',
    status: 'ACTIVE',
    properties: 1,
    joined: 'Mar 10, 2026',
  },
  {
    id: '4',
    name: 'Apex Repairs',
    email: 'vendor@proplity.com',
    role: 'VENDOR',
    status: 'ACTIVE',
    properties: 0,
    joined: 'Apr 05, 2026',
  },
  {
    id: '5',
    name: 'Sarah Jenkins',
    email: 'sarah.j@email.com',
    role: 'TENANT',
    status: 'SUSPENDED',
    properties: 1,
    joined: 'May 12, 2026',
  },
];

export const mockPropertiesData = [
  {
    id: '1',
    name: 'Highland Park Residences',
    address: '12 Admiralty Way, Lekki Phase 1',
    manager: 'Alex Vance',
    units: 24,
    occupancy: '92%',
    status: 'Active',
  },
  {
    id: '2',
    name: 'Sterling Apartments',
    address: '8 Kingsway Road, Ikoyi',
    manager: 'Alex Vance',
    units: 10,
    occupancy: '80%',
    status: 'Active',
  },
  {
    id: '3',
    name: 'Oakwood Villa',
    address: '15 Mobolaji Bank Anthony Way, Ikeja',
    manager: 'Eleanor Sterling',
    units: 8,
    occupancy: '100%',
    status: 'Active',
  },
];

export const mockTransactionsData = [
  {
    id: 'TXN-901',
    sender: 'Jordan Hayes',
    receiver: 'Eleanor Sterling',
    amount: '₦3,500,000',
    type: 'Rent Payment',
    status: 'SUCCESS',
    date: 'Today, 10:24 AM',
  },
  {
    id: 'TXN-902',
    sender: 'Alex Vance',
    receiver: 'Apex Repairs',
    amount: '₦25,000',
    type: 'Maintenance Fee',
    status: 'SUCCESS',
    date: 'Yesterday, 4:15 PM',
  },
  {
    id: 'TXN-903',
    sender: 'Sarah Jenkins',
    receiver: 'Alex Vance',
    amount: '₦220,000',
    type: 'Rent Payment',
    status: 'FAILED',
    date: 'Oct 12, 2026',
  },
  {
    id: 'TXN-904',
    sender: 'Eleanor Sterling',
    receiver: 'Platform Admin',
    amount: '₦15,000',
    type: 'Subscription',
    status: 'SUCCESS',
    date: 'Oct 01, 2026',
  },
];

export const mockUptimeData = [
  { id: '1', service: 'Auth API Gateway', status: '99.98%', response: '142ms', load: '12%' },
  { id: '2', service: 'Prisma DB Pool', status: '100.00%', response: '48ms', load: '18%' },
  { id: '3', service: 'Paystack Hook API', status: '99.95%', response: '210ms', load: '8%' },
  { id: '4', service: 'WhatsApp Bot Handler', status: '99.80%', response: '320ms', load: '5%' },
];

export const mockConversations = [
  {
    id: '1',
    participant: { name: 'Alex Vance (Manager)', avatar: null, role: 'manager' },
    lastMessage: 'Let me look into the plumbing issue for you.',
    time: '2m ago',
    unread: true,
  },
  {
    id: '2',
    participant: { name: 'Apex Repairs (Plumber)', avatar: null, role: 'vendor' },
    lastMessage: 'I will be there by 10 AM tomorrow.',
    time: '1h ago',
    unread: false,
  },
  {
    id: '3',
    participant: { name: 'Jordan Hayes (Tenant)', avatar: null, role: 'tenant' },
    lastMessage: 'Has the invoice for October been confirmed?',
    time: '1d ago',
    unread: false,
  },
];

export const mockMessages = [
  { id: '1', senderId: 'tenant', text: 'Hello, the kitchen sink is leaking.', time: '10:00 AM' },
  {
    id: '2',
    senderId: 'manager',
    text: 'Hi Jordan, I will dispatch a plumber immediately.',
    time: '10:05 AM',
  },
  { id: '3', senderId: 'vendor', text: 'Job accepted. I will head out shortly.', time: '10:15 AM' },
];

export const mockAllPayments = [
  {
    id: '1',
    billingFor: 'Rent - October 2026',
    amount: '₦350,000',
    date: 'Oct 01, 2026',
    invoiceNo: 'INV-10294',
    status: 'completed',
  },
  {
    id: '2',
    billingFor: 'Rent - September 2026',
    amount: '₦350,000',
    date: 'Sep 01, 2026',
    invoiceNo: 'INV-09183',
    status: 'completed',
  },
  {
    id: '3',
    billingFor: 'Estate Dues - Q3 2026',
    amount: '₦45,000',
    date: 'Jul 15, 2026',
    invoiceNo: 'INV-07204',
    status: 'completed',
  },
];

export const mockJobs = [
  {
    id: 1,
    title: 'Kitchen Sink Leaking',
    property: 'Highland Park, Unit 4B',
    tenant: 'Jordan Hayes',
    date: 'Today',
    priority: 'high',
    status: 'assigned',
  },
  {
    id: 2,
    title: 'AC Servicing',
    property: 'Sterling Apartments, Unit 2A',
    tenant: 'Fatima Bello',
    date: 'Tomorrow',
    priority: 'medium',
    status: 'pending',
  },
  {
    id: 3,
    title: 'Electrical Socket Replacement',
    property: 'Oakwood Villa, Unit 12',
    tenant: 'Oluwaseun Ajayi',
    date: 'Oct 20',
    priority: 'low',
    status: 'completed',
  },
];

export const mockTenantPaymentHistory = [
  {
    id: 1,
    period: 'October 2026',
    amount: '₦350,000',
    dueDate: 'Oct 01, 2026',
    paidDate: 'Oct 01, 2026',
    invoiceId: 'INV-202610-01',
    status: 'Paid',
  },
  {
    id: 2,
    period: 'September 2026',
    amount: '₦350,000',
    dueDate: 'Sep 01, 2026',
    paidDate: 'Sep 02, 2026',
    invoiceId: 'INV-202609-01',
    status: 'Paid',
  },
  {
    id: 3,
    period: 'August 2026',
    amount: '₦350,000',
    dueDate: 'Aug 01, 2026',
    paidDate: 'Aug 01, 2026',
    invoiceId: 'INV-202608-01',
    status: 'Paid',
  },
];

export const mockAllRequests = [
  {
    id: '1',
    title: 'Water heater not heating',
    category: 'Plumbing',
    date: 'Oct 14, 2026',
    status: 'completed',
    description: 'The water heater in the master bathroom is not heating the water at all.',
  },
  {
    id: '2',
    title: 'Living room light switch broken',
    category: 'Electrical',
    date: 'Oct 15, 2026',
    status: 'in-progress',
    description:
      'Main light switch near the entrance makes a clicking noise but light does not turn on.',
  },
];

export const mockTenants = [
  {
    id: 1,
    name: 'Jordan Hayes',
    email: 'tenant@proplity.com',
    phone: '+234 804 444 5555',
    property: 'Highland Park Residences',
    unit: '4B',
    leaseStart: 'Jan 01, 2026',
    leaseEnd: 'Dec 31, 2026',
    rentAmount: '₦3,500,000/year',
    status: 'Active',
    paymentHistory: 'Excellent',
  },
  {
    id: 2,
    name: 'Fatima Bello',
    email: 'fatima.b@email.com',
    phone: '+234 802 222 3333',
    property: 'Sterling Apartments',
    unit: '2A',
    leaseStart: 'Feb 15, 2026',
    leaseEnd: 'Feb 14, 2027',
    rentAmount: '₦1,800,000/year',
    status: 'Active',
    paymentHistory: 'Good',
  },
  {
    id: 3,
    name: 'Oluwaseun Ajayi',
    email: 'seun.ajayi@email.com',
    phone: '+234 805 111 2222',
    property: 'Oakwood Villa',
    unit: '12',
    leaseStart: 'May 01, 2026',
    leaseEnd: 'Apr 30, 2027',
    rentAmount: '₦2,200,000/year',
    status: 'Pending',
    paymentHistory: 'N/A',
  },
];

export const mockReportData = {
  location: 'Lekki Phase 1, Lagos',
  generatedDate: 'October 16, 2026',
  security: {
    rating: 8.5,
    status: 'Excellent',
    features: [
      { name: '24/7 Security Personnel', available: true },
      { name: 'CCTV Surveillance', available: true },
      { name: 'Gated Community', available: true },
      { name: 'Security Patrol', available: true },
      { name: 'Access Control System', available: true },
    ],
    crimeRate: 'Low',
    policePresence: 'High',
    emergencyResponse: '5-10 minutes average',
    recentIncidents: 2,
    notes:
      "Lekki Phase 1 is one of Lagos's most secure residential areas with multiple layers of security including estate gates, street gates, and private security patrols.",
  },
  electricity: {
    rating: 7.5,
    status: 'Good',
    reliability: '85%',
    averageHoursPerDay: 20,
    powerOutages: '2-3 times per week',
    alternativePower: true,
    generatorBackup: 'Yes - Estate-wide',
    inverterCompatibility: 'High',
    phcnReliability: 'Moderate',
    prepaidMeter: true,
    averageMonthlyCost: '₦25,000 - ₦35,000',
    notes:
      'Power supply is generally stable with estate generators providing backup during PHCN outages. Most properties have individual prepaid meters.',
  },
  water: {
    rating: 6.8,
    status: 'Moderate',
    source: 'Borehole with treatment',
    quality: 'Needs Filtration for Drinking',
    supplyType: 'Central Estate Tank',
    notes:
      'Water is supplied from boreholes. Most properties run automated filtration systems. Drinking directly from the tap is not recommended.',
  },
  roadNetwork: {
    rating: 8.0,
    status: 'Very Good',
    mainRoadCondition: 'Excellent',
    internalRoadsCondition: 'Good',
    trafficLevel: 'Moderate',
    peakHourTraffic: 'Heavy (7-9 AM, 5-8 PM)',
    drainage: 'Adequate',
    streetLighting: 'Excellent',
    parking: 'Available',
    publicTransport: 'Limited - Mostly private cars and ride-hailing',
    notes:
      'Well-maintained tarred roads throughout. Main roads can experience heavy traffic during rush hours. Internal roads are well-lit and have proper drainage systems.',
  },
  flooding: {
    rating: 6.5,
    status: 'Moderate Risk',
    floodProne: 'Low to Moderate',
    rainySeasonRisk: 'Moderate',
    drainageSystem: 'Good',
    historicalFlooding: [
      { year: '2024', severity: 'Minor', duration: '2-3 hours' },
      { year: '2023', severity: 'Minor', duration: '1-2 hours' },
    ],
    mitigationMeasures: [
      'Regular drainage cleaning',
      'Sand bags available during rainy season',
      'Elevated building foundations',
    ],
    notes:
      'Some low-lying areas may experience minor flooding during heavy rainfall, but this typically drains within a few hours. The estate has good drainage infrastructure.',
  },
  amenities: {
    schools: ['Corona School', 'Greensprings School', 'Lekki British School'],
    hospitals: ['Reddington Hospital', 'Lagoon Hospital', 'Chevron Clinic'],
    shopping: ['Circle Mall', 'Palms Shopping Mall', 'Shoprite Lekki'],
    restaurants: ['Numerous options along Admiralty Way'],
    recreation: ['Lekki Conservation Centre', 'Elegushi Beach', 'La Campagne Tropicana'],
  },
  demographics: {
    population: 'High density',
    averageAge: '30-45 years',
    familyFriendly: 'Very High',
    expatCommunity: 'Significant',
    noiseLevel: 'Low to Moderate',
  },
};

export const mockMonthlyRevenue = [
  { name: 'Jan', revenue: 4200000 },
  { name: 'Feb', revenue: 4500000 },
  { name: 'Mar', revenue: 5100000 },
  { name: 'Apr', revenue: 4900000 },
  { name: 'May', revenue: 5800000 },
  { name: 'Jun', revenue: 6200000 },
];

export const mockUserGrowth = [
  { name: 'Jan', managers: 45, landlords: 90, tenants: 320, vendors: 30 },
  { name: 'Feb', managers: 52, landlords: 98, tenants: 360, vendors: 35 },
  { name: 'Mar', managers: 58, landlords: 104, tenants: 410, vendors: 38 },
  { name: 'Apr', managers: 64, landlords: 110, tenants: 450, vendors: 42 },
  { name: 'May', managers: 72, landlords: 122, tenants: 510, vendors: 48 },
  { name: 'Jun', managers: 80, landlords: 135, tenants: 580, vendors: 52 },
];

export const mockPropertyByState = [
  { name: 'Lagos', value: 65 },
  { name: 'Abuja', value: 20 },
  { name: 'Rivers', value: 10 },
  { name: 'Oyo', value: 5 },
];

export const mockMaintenanceStats = [
  { name: 'Plumbing', count: 45 },
  { name: 'Electrical', count: 32 },
  { name: 'HVAC', count: 18 },
  { name: 'Appliance', count: 22 },
  { name: 'Cleaning', count: 12 },
  { name: 'Other', count: 8 },
];

export const mockAvailableProperties = [
  {
    id: 1,
    title: '3 Bedroom Flat',
    location: 'Lekki Phase 1, Lagos',
    unit: 'Apt 203',
    rent: '₦850,000/yr',
    status: 'vacant',
    bedrooms: 3,
    bathrooms: 2,
  },
  {
    id: 2,
    title: '2 Bedroom Apartment',
    location: 'Maitama, Abuja',
    unit: 'Unit 5B',
    rent: '₦1,200,000/yr',
    status: 'vacant',
    bedrooms: 2,
    bathrooms: 2,
  },
  {
    id: 3,
    title: '4 Bedroom Duplex',
    location: 'Ikeja GRA, Lagos',
    unit: 'Flat 8',
    rent: '₦900,000/yr',
    status: 'vacant',
    bedrooms: 4,
    bathrooms: 3,
  },
  {
    id: 4,
    title: '1 Bedroom Studio',
    location: 'Surulere, Lagos',
    unit: 'Unit 3',
    rent: '₦550,000/yr',
    status: 'vacant',
    bedrooms: 1,
    bathrooms: 1,
  },
  {
    id: 5,
    title: '3 Bedroom Terrace',
    location: 'Gwarinpa, Abuja',
    unit: 'House 12',
    rent: '₦750,000/yr',
    status: 'vacant',
    bedrooms: 3,
    bathrooms: 2,
  },
];

export const mockMonthlyRevenueAdmin = [
  { month: 'Jan', revenue: 184000000, subscriptions: 12400000 },
  { month: 'Feb', revenue: 201000000, subscriptions: 13800000 },
  { month: 'Mar', revenue: 197000000, subscriptions: 14200000 },
  { month: 'Apr', revenue: 228000000, subscriptions: 15600000 },
  { month: 'May', revenue: 241000000, subscriptions: 16900000 },
  { month: 'Jun', revenue: 267000000, subscriptions: 18200000 },
];

export const mockUserGrowthAdmin = [
  { month: 'Jan', managers: 980, landlords: 710, tenants: 6800, vendors: 210 },
  { month: 'Feb', managers: 1040, landlords: 760, tenants: 7200, vendors: 228 },
  { month: 'Mar', managers: 1100, landlords: 800, tenants: 7650, vendors: 245 },
  { month: 'Apr', managers: 1160, landlords: 840, tenants: 7980, vendors: 261 },
  { month: 'May', managers: 1205, landlords: 870, tenants: 8210, vendors: 275 },
  { month: 'Jun', managers: 1247, landlords: 892, tenants: 8421, vendors: 287 },
];

export const mockPropertyByStateAdmin = [
  { name: 'Lagos', value: 3241, color: '#3b82f6' },
  { name: 'Abuja', value: 1182, color: '#8b5cf6' },
  { name: 'Rivers', value: 421, color: '#10b981' },
  { name: 'Oyo', value: 312, color: '#f59e0b' },
  { name: 'Others', value: 265, color: '#6b7280' },
];

export const mockMaintenanceStatsAdmin = [
  { month: 'Jan', open: 142, resolved: 118, avgDays: 4.2 },
  { month: 'Feb', open: 131, resolved: 124, avgDays: 3.9 },
  { month: 'Mar', open: 158, resolved: 141, avgDays: 4.1 },
  { month: 'Apr', open: 121, resolved: 130, avgDays: 3.6 },
  { month: 'May', open: 114, resolved: 122, avgDays: 3.4 },
  { month: 'Jun', open: 98, resolved: 119, avgDays: 3.1 },
];

export const mockLandlordFeatureProperties = [
  {
    name: 'Lekki Phase 1 Complex',
    location: 'Lekki, Lagos',
    units: 12,
    revenue: '₦1,440,000',
    status: 'Fully Occupied',
  },
  {
    name: 'Maitama Residences',
    location: 'Maitama, Abuja',
    units: 8,
    revenue: '₦960,000',
    status: 'Fully Occupied',
  },
  {
    name: 'GRA Ikeja Flats',
    location: 'Ikeja GRA, Lagos',
    units: 6,
    revenue: '₦900,000',
    status: '1 Vacant',
  },
  {
    name: 'Victoria Island Studio',
    location: 'VI, Lagos',
    units: 4,
    revenue: '₦520,000',
    status: 'Fully Occupied',
  },
];

export const mockLandlordDashboardProperties = [
  {
    id: 1,
    name: 'Lekki Phase 1 Complex',
    units: 8,
    occupied: 7,
    revenue: '₦6.8M',
    performance: 95,
  },
  {
    id: 2,
    name: 'Maitama Apartments',
    units: 4,
    occupied: 4,
    revenue: '₦4.8M',
    performance: 100,
  },
  {
    id: 3,
    name: 'Ikeja GRA Estate',
    units: 6,
    occupied: 5,
    revenue: '₦5.4M',
    performance: 88,
  },
];

export const mockAllPaymentsDetailed = [
  {
    id: 'PAY-2026-010',
    date: 'May 1, 2026',
    period: 'May 2026',
    amount: '₦850,000',
    method: 'Bank Transfer',
    ref: 'TRF202605010023',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2026-009',
    date: 'Apr 1, 2026',
    period: 'April 2026',
    amount: '₦850,000',
    method: 'Bank Transfer',
    ref: 'TRF202604010041',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2026-008',
    date: 'Mar 1, 2026',
    period: 'March 2026',
    amount: '₦850,000',
    method: 'Mobile Money',
    ref: 'MOB202603010087',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2026-007',
    date: 'Feb 1, 2026',
    period: 'February 2026',
    amount: '₦850,000',
    method: 'Bank Transfer',
    ref: 'TRF202602010019',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2026-006',
    date: 'Jan 5, 2026',
    period: 'January 2026',
    amount: '₦850,000',
    method: 'Card',
    ref: 'CRD202601050055',
    status: 'late',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-012',
    date: 'Dec 1, 2025',
    period: 'December 2025',
    amount: '₦850,000',
    method: 'Bank Transfer',
    ref: 'TRF202512010032',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-011',
    date: 'Nov 1, 2025',
    period: 'November 2025',
    amount: '₦850,000',
    method: 'Bank Transfer',
    ref: 'TRF202511010014',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-010',
    date: 'Oct 3, 2025',
    period: 'October 2025',
    amount: '₦850,000',
    method: 'Mobile Money',
    ref: 'MOB202510030091',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-009',
    date: 'Sep 1, 2025',
    period: 'September 2025',
    amount: '₦850,000',
    method: 'Bank Transfer',
    ref: 'TRF202509010078',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-008',
    date: 'Aug 1, 2025',
    period: 'August 2025',
    amount: '₦850,000',
    method: 'Bank Transfer',
    ref: 'TRF202508010091',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-007',
    date: 'Jul 1, 2025',
    period: 'July 2025',
    amount: '₦850,000',
    method: 'Bank Transfer',
    ref: 'TRF202507010023',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-006',
    date: 'Jun 2, 2025',
    period: 'June 2025',
    amount: '₦850,000',
    method: 'Card',
    ref: 'CRD202506020045',
    status: 'late',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-005',
    date: 'May 1, 2025',
    period: 'May 2025',
    amount: '₦850,000',
    method: 'Bank Transfer',
    ref: 'TRF202505010067',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-004',
    date: 'Apr 1, 2025',
    period: 'April 2025',
    amount: '₦750,000',
    method: 'Bank Transfer',
    ref: 'TRF202504010089',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-003',
    date: 'Mar 1, 2025',
    period: 'March 2025',
    amount: '₦750,000',
    method: 'Mobile Money',
    ref: 'MOB202503010012',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-002',
    date: 'Feb 3, 2025',
    period: 'February 2025',
    amount: '₦750,000',
    method: 'Bank Transfer',
    ref: 'TRF202502030034',
    status: 'late',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2025-001',
    date: 'Jan 1, 2025',
    period: 'January 2025',
    amount: '₦750,000',
    method: 'Bank Transfer',
    ref: 'TRF202501010056',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2024-012',
    date: 'Dec 1, 2024',
    period: 'December 2024',
    amount: '₦750,000',
    method: 'Card',
    ref: 'CRD202412010078',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2024-011',
    date: 'Nov 1, 2024',
    period: 'November 2024',
    amount: '₦750,000',
    method: 'Bank Transfer',
    ref: 'TRF202411010090',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-2024-010',
    date: 'Oct 1, 2024',
    period: 'October 2024',
    amount: '₦750,000',
    method: 'Bank Transfer',
    ref: 'TRF202410010012',
    status: 'completed',
    property: 'Lekki Phase 1, Apt 203',
    receipt: true,
  },
  {
    id: 'PAY-PEND-001',
    date: 'Jun 1, 2026',
    period: 'June 2026',
    amount: '₦850,000',
    method: '—',
    ref: '—',
    status: 'upcoming',
    property: 'Lekki Phase 1, Apt 203',
    receipt: false,
  },
];

export const mockServiceProviderFeatureJobs = [
  {
    title: 'AC Repair & Servicing',
    property: 'Lekki Phase 1 Complex',
    priority: 'High',
    status: 'In Progress',
  },
  {
    title: 'Plumbing — Burst Pipe',
    property: 'GRA Ikeja Flat 4A',
    priority: 'Urgent',
    status: 'Assigned',
  },
  {
    title: 'Electrical — Power Fault',
    property: 'Maitama Residences',
    priority: 'Medium',
    status: 'Completed',
  },
];

export const mockVendorDashboardJobs = [
  {
    id: 1,
    title: 'Broken Water Pipe',
    property: 'Lekki Phase 1, Apt 203',
    category: 'Plumbing',
    priority: 'high',
    status: 'assigned',
    assignedDate: '2 hours ago',
    estimatedPay: '₦20,000',
    propertyManager: 'Proplity Management',
    contactPhone: '+234 803 456 7890',
    scheduledDate: 'Today, 2:00 PM',
  },
  {
    id: 2,
    title: 'AC Repair',
    property: 'Maitama, Unit 5B',
    category: 'HVAC',
    priority: 'medium',
    status: 'in_progress',
    assignedDate: '1 day ago',
    estimatedPay: '₦15,000',
    propertyManager: 'Proplity Management',
    contactPhone: '+234 805 123 4567',
    scheduledDate: 'Tomorrow, 10:00 AM',
  },
  {
    id: 3,
    title: 'Door Lock Replacement',
    property: 'Ikeja GRA, Flat 8',
    category: 'General',
    priority: 'low',
    status: 'completed',
    assignedDate: '3 days ago',
    completedDate: '1 day ago',
    estimatedPay: '₦8,000',
    actualPay: '₦8,000',
    propertyManager: 'Proplity Management',
    contactPhone: '+234 809 876 5432',
    invoiceStatus: 'pending',
  },
  {
    id: 4,
    title: 'Electrical Wiring',
    property: 'Wuse 2, Apt 14',
    category: 'Electrical',
    priority: 'high',
    status: 'completed',
    assignedDate: '1 week ago',
    completedDate: '5 days ago',
    estimatedPay: '₦18,000',
    actualPay: '₦18,000',
    propertyManager: 'Proplity Management',
    contactPhone: '+234 802 345 6789',
    invoiceStatus: 'paid',
  },
];

export const mockTenantFeaturePaymentHistory = [
  { month: 'May 2026', amount: '₦70,833', status: 'Paid' },
  { month: 'April 2026', amount: '₦70,833', status: 'Paid' },
  { month: 'March 2026', amount: '₦70,833', status: 'Paid' },
];

export const mockTenantMaintenanceRequests = [
  {
    id: 'MR-031',
    title: 'AC Maintenance',
    category: 'HVAC',
    description:
      'The air conditioning unit in the master bedroom has stopped cooling properly. It runs but blows warm air.',
    status: 'completed',
    priority: 'medium',
    submittedDate: 'May 28, 2026',
    resolvedDate: 'May 31, 2026',
    assignedVendor: 'CoolBreeze AC Techs',
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      { time: 'May 28, 2026 10:00am', text: 'Request submitted', by: 'You' },
      {
        time: 'May 28, 2026 11:30am',
        text: 'Assigned to CoolBreeze AC Techs',
        by: 'Manager',
      },
      {
        time: 'May 31, 2026 2:00pm',
        text: 'Work completed and confirmed',
        by: 'CoolBreeze AC Techs',
      },
    ],
  },
  {
    id: 'MR-032',
    title: 'Bathroom Faucet Leak',
    category: 'Plumbing',
    description:
      'The bathroom faucet in the main bathroom is leaking constantly. Water is dripping even when fully closed.',
    status: 'in_progress',
    priority: 'high',
    submittedDate: 'Jun 1, 2026',
    resolvedDate: null,
    assignedVendor: 'AquaFix Plumbers',
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      { time: 'Jun 1, 2026 9:00am', text: 'Request submitted', by: 'You' },
      {
        time: 'Jun 1, 2026 10:15am',
        text: 'Classified as High Priority Plumbing',
        by: 'AI System',
      },
      {
        time: 'Jun 1, 2026 11:00am',
        text: 'Assigned to AquaFix Plumbers',
        by: 'Manager',
      },
      {
        time: 'Jun 2, 2026 8:00am',
        text: 'Vendor en route to property',
        by: 'AquaFix Plumbers',
      },
    ],
  },
  {
    id: 'MR-028',
    title: 'Kitchen Light Flickering',
    category: 'Electrical',
    description:
      'The kitchen ceiling light flickers intermittently. It has been happening for the past 2 weeks.',
    status: 'completed',
    priority: 'low',
    submittedDate: 'May 10, 2026',
    resolvedDate: 'May 13, 2026',
    assignedVendor: 'PowerLine Electricals',
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      { time: 'May 10, 2026', text: 'Request submitted', by: 'You' },
      {
        time: 'May 11, 2026',
        text: 'Assigned to PowerLine Electricals',
        by: 'Manager',
      },
      {
        time: 'May 13, 2026',
        text: 'Faulty bulb socket replaced, issue resolved',
        by: 'PowerLine Electricals',
      },
    ],
  },
  {
    id: 'MR-025',
    title: 'Gate Intercom Not Working',
    category: 'General',
    description:
      'The intercom at the main gate is not functioning. I cannot hear or speak to visitors.',
    status: 'completed',
    priority: 'medium',
    submittedDate: 'Apr 20, 2026',
    resolvedDate: 'Apr 22, 2026',
    assignedVendor: 'FixIt Pro Services',
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      { time: 'Apr 20, 2026', text: 'Request submitted', by: 'You' },
      {
        time: 'Apr 22, 2026',
        text: 'Intercom unit replaced and tested',
        by: 'FixIt Pro Services',
      },
    ],
  },
  {
    id: 'MR-033',
    title: 'Broken Window Hinge',
    category: 'General',
    description:
      'The window hinge in the second bedroom is broken. The window cannot stay open and slams shut.',
    status: 'new',
    priority: 'low',
    submittedDate: 'Jun 3, 2026',
    resolvedDate: null,
    assignedVendor: null,
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      {
        time: 'Jun 3, 2026 8:45am',
        text: 'Request submitted, awaiting assignment',
        by: 'You',
      },
    ],
  },
];

export const mockTenantManagementTenants = [
  {
    id: 1,
    name: 'Adewale Johnson',
    email: 'adewale.j@email.com',
    phone: '+234 803 456 7890',
    property: 'Lekki Phase 1, Apt 203',
    rentAmount: '₦850,000',
    rentStatus: 'paid',
    nextDue: 'Oct 15, 2026',
    leaseEnd: 'Apr 15, 2027',
    paymentHistory: 'Excellent',
    riskScore: 'low',
    avatar: 'bg-blue-500',
  },
  {
    id: 2,
    name: 'Chidinma Okafor',
    email: 'chidinma.o@email.com',
    phone: '+234 805 123 4567',
    property: 'Maitama, Unit 5B',
    rentAmount: '₦1,200,000',
    rentStatus: 'paid',
    nextDue: 'Sep 22, 2026',
    leaseEnd: 'Mar 22, 2027',
    paymentHistory: 'Excellent',
    riskScore: 'low',
    avatar: 'bg-green-500',
  },
  {
    id: 3,
    name: 'Ibrahim Musa',
    email: 'ibrahim.m@email.com',
    phone: '+234 809 876 5432',
    property: 'Wuse 2, Apt 14',
    rentAmount: '₦650,000',
    rentStatus: 'due',
    nextDue: 'Apr 25, 2026',
    leaseEnd: 'Oct 25, 2026',
    paymentHistory: 'Good',
    riskScore: 'medium',
    avatar: 'bg-orange-500',
  },
  {
    id: 4,
    name: 'Blessing Eze',
    email: 'blessing.e@email.com',
    phone: '+234 802 345 6789',
    property: 'Ikeja GRA, Flat 8',
    rentAmount: '₦900,000',
    rentStatus: 'paid',
    nextDue: 'Nov 10, 2026',
    leaseEnd: 'May 10, 2027',
    paymentHistory: 'Excellent',
    riskScore: 'low',
    avatar: 'bg-purple-500',
  },
  {
    id: 5,
    name: 'Tunde Bakare',
    email: 'tunde.b@email.com',
    phone: '+234 807 654 3210',
    property: 'Ajah, Flat 3C',
    rentAmount: '₦550,000',
    rentStatus: 'overdue',
    nextDue: 'Apr 10, 2026',
    leaseEnd: 'Oct 10, 2026',
    paymentHistory: 'Fair',
    riskScore: 'high',
    avatar: 'bg-red-500',
  },
];

export const mockSimilarProperties = [
  {
    id: 2,
    title: '2 Bedroom Luxury Apartment',
    price: '₦1,200,000/year',
    beds: 2,
    baths: 2,
    sqft: '950 sq ft',
    bg: 'from-green-500 to-green-700',
  },
  {
    id: 3,
    title: '3 Bedroom Modern Flat',
    price: '₦900,000/year',
    beds: 3,
    baths: 2,
    sqft: '1,200 sq ft',
    bg: 'from-blue-500 to-blue-700',
  },
  {
    id: 1,
    title: '4 Bedroom Duplex',
    price: '₦1,500,000/year',
    beds: 4,
    baths: 3,
    sqft: '1,800 sq ft',
    bg: 'from-purple-500 to-purple-700',
  },
];

export const mockInvoiceJobDetails = {
  jobTitle: 'Broken Water Pipe',
  property: 'Lekki Phase 1, Apt 203',
  completedDate: 'May 4, 2026',
  propertyManager: 'Proplity Management',
  estimatedCost: 20000,
};

export const mockInvoiceVendorInfo = {
  name: 'AquaFix Plumbers',
  businessId: 'RC123456',
  phone: '+234 901 234 5678',
  email: 'contact@aquafixplumbers.com',
  address: 'Shop 12, Lekki Plaza, Lagos',
  accountNumber: '0123456789',
  accountName: 'AquaFix Plumbers Ltd',
  bankName: 'Access Bank',
};

export const mockPublicPropertyDetails: Record<number, any> = {
  1: {
    title: '3 Bedroom Luxury Apartment',
    location: 'Block 15, Lekki Phase 1, Lagos State',
    price: '₦1,200,000',
    freq: 'year',
    beds: 3,
    baths: 2,
    sqft: '1,200 sq ft',
    trustScore: 95,
    verified: true,
    rating: 4.8,
    reviews: 14,
    badge: 'Available',
    images: [
      'bg-gradient-to-br from-slate-300 to-slate-500',
      'bg-gradient-to-br from-stone-300 to-stone-500',
      'bg-gradient-to-br from-zinc-300 to-zinc-500',
      'bg-gradient-to-br from-neutral-300 to-neutral-500',
    ],
    description:
      'Beautiful 3-bedroom apartment in the heart of Lekki Phase 1. Features modern finishes, spacious rooms, and excellent security. Close to schools, shopping centres, and major roads. The apartment boasts floor-to-ceiling windows, Italian tiles, and a fully fitted kitchen.',
    amenities: [
      { icon: Zap, label: '360° Virtual Tours' },
      { icon: Droplets, label: 'Swimming Pool' },
      { icon: Lock, label: 'Security/CCTV' },
      { icon: Car, label: 'Parking Space' },
      { icon: Wind, label: 'Air Conditioning' },
      { icon: Wifi, label: 'High-Speed WiFi' },
    ],
  },
  2: {
    title: '2 Bedroom Modern Flat',
    location: 'Plot 43, Maitama District, Abuja',
    price: '₦900,000',
    freq: 'year',
    beds: 2,
    baths: 2,
    sqft: '950 sq ft',
    trustScore: 92,
    verified: true,
    rating: 4.5,
    reviews: 9,
    badge: 'Available',
    images: [
      'bg-gradient-to-br from-green-300 to-green-600',
      'bg-gradient-to-br from-emerald-300 to-emerald-500',
      'bg-gradient-to-br from-teal-300 to-teal-500',
      'bg-gradient-to-br from-cyan-300 to-cyan-500',
    ],
    description:
      'Modern 2-bedroom flat in the prestigious Maitama district. Features a well-fitted kitchen, spacious living area, and a serene environment perfect for professionals.',
    amenities: [
      { icon: Zap, label: 'Generator' },
      { icon: Droplets, label: 'Water Tank' },
      { icon: Lock, label: 'Gated Estate' },
      { icon: Car, label: 'Parking Space' },
      { icon: Wifi, label: 'High-Speed WiFi' },
      { icon: Maximize2, label: 'Spacious Rooms' },
    ],
  },
  3: {
    title: '4 Bedroom Duplex',
    location: 'Ikeja GRA, Lagos',
    price: '₦1,800,000',
    freq: 'year',
    beds: 4,
    baths: 3,
    sqft: '1,800 sq ft',
    trustScore: 97,
    verified: true,
    rating: 4.9,
    reviews: 22,
    badge: 'Available',
    images: [
      'bg-gradient-to-br from-purple-300 to-purple-600',
      'bg-gradient-to-br from-violet-300 to-violet-500',
      'bg-gradient-to-br from-fuchsia-300 to-fuchsia-500',
      'bg-gradient-to-br from-pink-300 to-pink-500',
    ],
    description:
      'Stunning 4-bedroom duplex in the quiet and secure Ikeja GRA neighbourhood. Features a private swimming pool, landscaped garden, and top-of-the-range finishes throughout.',
    amenities: [
      { icon: Droplets, label: 'Swimming Pool' },
      { icon: Zap, label: '24/7 Power Supply' },
      { icon: Home, label: 'Garden' },
      { icon: Lock, label: 'Security/CCTV' },
      { icon: Car, label: 'Parking Space' },
      { icon: Wind, label: 'Air Conditioning' },
    ],
  },
};

export const mockViewingAvailableDates = [
  {
    date: '2026-05-14',
    day: 'Wednesday',
    slots: ['10:00 AM', '2:00 PM', '4:00 PM'],
  },
  {
    date: '2026-05-15',
    day: 'Thursday',
    slots: ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM'],
  },
  {
    date: '2026-05-16',
    day: 'Friday',
    slots: ['10:00 AM', '2:00 PM', '4:00 PM', '6:00 PM'],
  },
  {
    date: '2026-05-17',
    day: 'Saturday',
    slots: ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM'],
  },
  {
    date: '2026-05-18',
    day: 'Sunday',
    slots: ['10:00 AM', '12:00 PM', '2:00 PM'],
  },
];

export const mockUserPropertyAddress = 'Lekki Phase 1, Apt 203';
