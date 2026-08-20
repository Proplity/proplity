export interface Conversation {
  id: number;
  participantName: string;
  participantRole: string;
  propertyTitle: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatar: string;
}

export interface Message {
  id: number;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export const conversations: Conversation[] = [
  {
    id: 1,
    participantName: 'Property Manager - John Doe',
    participantRole: 'Property Manager',
    propertyTitle: 'Lekki Phase 1, Apt 203',
    lastMessage: 'Your maintenance request has been assigned to a vendor',
    lastMessageTime: '10:30 AM',
    unreadCount: 2,
    avatar: 'bg-blue-600',
  },
  {
    id: 2,
    participantName: 'Landlord - Mrs. Adeyemi',
    participantRole: 'Landlord',
    propertyTitle: 'Maitama Apartments, Unit 5B',
    lastMessage: 'The lease renewal documents are ready',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    avatar: 'bg-purple-600',
  },
  {
    id: 3,
    participantName: 'AquaFix Plumbers',
    participantRole: 'Service Provider',
    propertyTitle: 'Lekki Phase 1, Apt 203',
    lastMessage: 'I will be there tomorrow at 2 PM',
    lastMessageTime: '2 days ago',
    unreadCount: 0,
    avatar: 'bg-orange-600',
  },
];

export const messages: Message[] = [
  {
    id: 1,
    senderId: 'other',
    senderName: 'Property Manager',
    senderRole: 'manager',
    content:
      'Hello! I received your application for the Lekki Phase 1 apartment. Your documents look good.',
    timestamp: '9:15 AM',
    isRead: true,
  },
  {
    id: 2,
    senderId: 'me',
    senderName: 'You',
    senderRole: 'tenant',
    content: 'Thank you! When can I schedule a viewing?',
    timestamp: '9:20 AM',
    isRead: true,
  },
  {
    id: 3,
    senderId: 'other',
    senderName: 'Property Manager',
    senderRole: 'manager',
    content: 'I have availability this Thursday or Friday afternoon. Which works better for you?',
    timestamp: '9:25 AM',
    isRead: true,
  },
  {
    id: 4,
    senderId: 'me',
    senderName: 'You',
    senderRole: 'tenant',
    content: 'Friday at 2 PM would be perfect!',
    timestamp: '9:30 AM',
    isRead: true,
  },
  {
    id: 5,
    senderId: 'other',
    senderName: 'Property Manager',
    senderRole: 'manager',
    content:
      "Great! I've scheduled the viewing for Friday, May 16 at 2:00 PM. I'll send you the exact location and my contact details.",
    timestamp: '10:30 AM',
    isRead: false,
  },
  {
    id: 6,
    senderId: 'other',
    senderName: 'Property Manager',
    senderRole: 'manager',
    content: 'Also, please bring a valid ID for verification purposes.',
    timestamp: '10:31 AM',
    isRead: false,
  },
];
