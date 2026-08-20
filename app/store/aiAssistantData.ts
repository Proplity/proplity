import { DollarSign, Wrench, FileText, Sparkles } from 'lucide-react';

export const mockAiInitialMessages = [
  {
    id: 1,
    sender: 'ai',
    text: "Hello! I'm your Proplity AI Assistant. I can help you with tenant queries, rent tracking, maintenance requests, and property insights. How can I assist you today?",
    timestamp: '10:30 AM',
  },
];

export const mockAiQuickActions = [
  {
    icon: DollarSign,
    label: 'Check Rent Status',
    query: 'Show me rent collection status for this month',
  },
  {
    icon: Wrench,
    label: 'Maintenance Overview',
    query: 'Show pending maintenance requests',
  },
  {
    icon: FileText,
    label: 'Generate Report',
    query: 'Generate monthly performance report',
  },
  {
    icon: Sparkles,
    label: 'AI Insights',
    query: 'What are my top AI insights?',
  },
];

export function getMockAiResponse(query: string) {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('rent') && lowerQuery.includes('status')) {
    return 'Based on current data:\n\n✅ Rent collected: ₦12.4M (82% of expected)\n⏳ Pending: ₦2.8M from 12 tenants\n⚠️ Overdue: ₦650K from 1 tenant (Tunde Bakare)\n\nI recommend sending personalized reminders to the 12 pending tenants. Would you like me to draft those messages?';
  }

  if (lowerQuery.includes('maintenance')) {
    return 'You have 7 pending maintenance requests:\n\n🔴 2 High Priority (Water pipe leak, Electrical fault)\n🟡 3 Medium Priority (AC issues, Door locks)\n🟢 2 Low Priority (Paint touch-ups)\n\nRecommended action: Assign the high-priority requests to John Electricals (95% reliability score) and AquaFix Plumbers.';
  }

  if (lowerQuery.includes('report')) {
    return 'I can generate the following reports:\n\n1. Monthly Rent Collection Summary\n2. Tenant Payment History\n3. Maintenance Cost Analysis\n4. Occupancy Rate Trends\n5. Property Performance Dashboard\n\nWhich report would you like me to generate?';
  }

  if (lowerQuery.includes('insight')) {
    return '🎯 Top AI Insights:\n\n1. Rent collection improved by 12% since implementing AI reminders\n2. 3 tenants predicted to pay late - send early reminders\n3. Property occupancy at 94% - highest in 6 months\n4. Maintenance resolution time reduced by 30%\n5. Tunde Bakare shows high risk score - consider payment plan';
  }

  return "I understand you're asking about property management. I can help with:\n\n• Rent tracking and collection\n• Tenant management\n• Maintenance requests\n• Payment predictions\n• Property insights\n\nCould you provide more details about what you need?";
}
