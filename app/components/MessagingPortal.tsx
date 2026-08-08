import { useState } from 'react';
import { Send, Search, Paperclip, Phone, Video, MoreVertical, ArrowLeft } from 'lucide-react';

interface Message {
  id: number;
  senderId: string;
  senderName: string;
  senderRole: 'tenant' | 'manager' | 'landlord' | 'vendor';
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface Conversation {
  id: number;
  participantName: string;
  participantRole: string;
  propertyTitle?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatar: string;
}

interface MessagingPortalProps {
  currentUserRole: string;
  onBack?: () => void;
}

export function MessagingPortal({ currentUserRole, onBack }: MessagingPortalProps) {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const conversations: Conversation[] = [
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

  const messages: Message[] = [
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

  const handleSendMessage = () => {
    if (messageText.trim()) {
      // Simulate sending message
      console.log('Sending:', messageText);
      setMessageText('');
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="rounded-lg p-2 hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">Messages</h1>
            <p className="text-sm text-gray-600">
              Stay connected with landlords, tenants, and service providers
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations List */}
        <div className="flex w-96 flex-col border-r border-gray-200 bg-white">
          {/* Search */}
          <div className="border-b border-gray-200 p-4">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full border-b border-gray-200 p-4 text-left transition-colors hover:bg-gray-50 ${
                  selectedConversation === conv.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-12 w-12 ${conv.avatar} flex flex-shrink-0 items-center justify-center rounded-full`}
                  >
                    <span className="font-semibold text-white">
                      {conv.participantName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="truncate text-sm font-semibold">{conv.participantName}</p>
                      <span className="text-xs text-gray-500">{conv.lastMessageTime}</span>
                    </div>
                    {conv.propertyTitle && (
                      <p className="mb-1 text-xs text-gray-500">{conv.propertyTitle}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="flex-1 truncate text-sm text-gray-600">{conv.lastMessage}</p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        {selectedConversation ? (
          <div className="flex flex-1 flex-col">
            {/* Chat Header */}
            <div className="border-b border-gray-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 ${selectedConv?.avatar} flex items-center justify-center rounded-full`}
                  >
                    <span className="text-sm font-semibold text-white">
                      {selectedConv?.participantName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{selectedConv?.participantName}</p>
                    {selectedConv?.propertyTitle && (
                      <p className="text-xs text-gray-500">{selectedConv.propertyTitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-lg p-2 hover:bg-gray-100" title="Voice call">
                    <Phone className="h-5 w-5 text-gray-600" />
                  </button>
                  <button className="rounded-lg p-2 hover:bg-gray-100" title="Video call">
                    <Video className="h-5 w-5 text-gray-600" />
                  </button>
                  <button className="rounded-lg p-2 hover:bg-gray-100" title="More options">
                    <MoreVertical className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md ${message.senderId === 'me' ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white'} rounded-lg p-4`}
                  >
                    {message.senderId !== 'me' && (
                      <p className="mb-1 text-xs font-semibold text-gray-500">
                        {message.senderName}
                      </p>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <p
                      className={`mt-2 text-xs ${message.senderId === 'me' ? 'text-blue-100' : 'text-gray-500'}`}
                    >
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="border-t border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <button className="rounded-lg p-2 hover:bg-gray-100" title="Attach file">
                  <Paperclip className="h-5 w-5 text-gray-600" />
                </button>
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700"
                  title="Send message"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">Press Enter to send</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-200">
                <Send className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-700">Select a Conversation</h3>
              <p className="text-gray-500">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
