import {
  Users,
  Building2,
  DollarSign,
  Activity,
  AlertCircle,
  Clock,
  CheckCircle,
} from 'lucide-react';

export const mockAdminPlatformStats = [
  {
    icon: Users,
    bg: 'bg-blue-50',
    color: 'text-blue-600',
    value: '12,847',
    label: 'Total Users',
    trend: '+18% this month',
    breakdown: 'users' as const,
  },
  {
    icon: Building2,
    bg: 'bg-purple-50',
    color: 'text-purple-600',
    value: '5,421',
    label: 'Properties Listed',
    trend: '+12% this month',
    breakdown: 'properties' as const,
  },
  {
    icon: DollarSign,
    bg: 'bg-green-50',
    color: 'text-green-600',
    value: '₦2.4B',
    label: 'Total Transactions',
    trend: '+24% this month',
    breakdown: 'transactions' as const,
  },
  {
    icon: Activity,
    bg: 'bg-orange-50',
    color: 'text-orange-600',
    value: '99.7%',
    label: 'System Uptime',
    trend: 'Above SLA',
    breakdown: 'uptime' as const,
  },
];

export const mockAdminSystemHealth = [
  {
    label: 'API Response Time',
    value: '124ms',
    status: 'good',
    color: 'green',
  },
  {
    label: 'Database Load',
    value: '47%',
    status: 'good',
    color: 'green',
  },
  {
    label: 'Active Sessions',
    value: '3,421',
    status: 'good',
    color: 'green',
  },
  {
    label: 'Error Rate',
    value: '0.02%',
    status: 'good',
    color: 'green',
  },
];

export const mockAdminUserActivity = [
  {
    type: 'Property Manager',
    count: 1247,
    percentage: 45,
    color: 'blue',
  },
  {
    type: 'Landlord',
    count: 892,
    percentage: 32,
    color: 'purple',
  },
  { type: 'Tenant', count: 8421, percentage: 68, color: 'green' },
  {
    type: 'Service Provider',
    count: 287,
    percentage: 15,
    color: 'orange',
  },
];

export const mockAdminAiPerformance = [
  {
    feature: 'AI Assistant Queries',
    resolved: '94%',
    total: '18.4K',
    color: 'blue',
  },
  {
    feature: 'Property Verification',
    accuracy: '98%',
    total: '1.2K',
    color: 'green',
  },
  {
    feature: 'Payment Prediction',
    accuracy: '91%',
    total: '3.8K',
    color: 'purple',
  },
  {
    feature: 'Maintenance Triage',
    accuracy: '96%',
    total: '2.1K',
    color: 'orange',
  },
];

export const mockAdminRecentIssues = [
  {
    severity: 'low',
    title: 'Slow API response in Lagos region',
    status: 'Resolved',
    time: '2h ago',
    icon: AlertCircle,
  },
  {
    severity: 'medium',
    title: 'Payment gateway timeout spike',
    status: 'Investigating',
    time: '5h ago',
    icon: AlertCircle,
  },
  {
    severity: 'low',
    title: 'Email delivery delay',
    status: 'Resolved',
    time: '1d ago',
    icon: AlertCircle,
  },
];
