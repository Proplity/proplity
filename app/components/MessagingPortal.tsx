import { useState } from 'react';
import { Send, Search, Paperclip, Phone, Video, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConversations, useMessages, useSendMessage } from '@/hooks/useConversations';
import type { Conversation } from '@/lib/api/types';

interface MessagingPortalProps {
  onBack?: () => void;
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
];

const TYPE_LABEL: Record<Conversation['type'], string> = {
  DIRECT: 'Direct message',
  MAINTENANCE_THREAD: 'Maintenance',
  LEASE_THREAD: 'Lease',
  COMMUNITY_DISCUSSION: 'Community board',
  SUPPORT: 'Support',
};

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// A conversation has no single "the other person" in general (a
// MAINTENANCE_THREAD can have tenant + vendor + manager + landlord all at
// once) -- resolves to a real display name/subtitle instead of the mock's
// flat participantName/propertyTitle fields.
function describe(conv: Conversation, selfId: string | undefined) {
  const others = conv.participants.filter((p) => p.userId !== selfId);
  const name = conv.title || others.map((p) => p.user.name).join(', ') || 'Conversation';
  const subtitle =
    conv.maintenanceRequest?.title ??
    conv.lease?.unit.property.name ??
    conv.property?.name ??
    TYPE_LABEL[conv.type];
  return { name, subtitle, others };
}

export function MessagingPortal({ onBack }: MessagingPortalProps) {
  const auth = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: conversations,
    loading: conversationsLoading,
    refetch: refetchConversations,
  } = useConversations();
  const {
    data: messages,
    loading: messagesLoading,
    refetch: refetchMessages,
  } = useMessages(selectedId);
  const { submit: sendMessage, submitting } = useSendMessage(selectedId ?? '');

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  const filtered = conversations.filter((conv) => {
    const { name } = describe(conv, auth.user?.id);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelect = (id: string) => {
    setSelectedId(id);
    // Refetch the list shortly after opening -- GET .../messages marks the
    // conversation read server-side, so this picks up the updated
    // unreadCount badge without a full page reload.
    setTimeout(refetchConversations, 300);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedId) return;
    try {
      await sendMessage({ body: messageText.trim() });
      setMessageText('');
      refetchMessages();
      refetchConversations();
    } catch {
      // error surfaced via the hook's `error` state if needed later
    }
  };

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

          <div className="flex-1 overflow-y-auto">
            {conversationsLoading && (
              <p className="p-4 text-sm text-gray-500">Loading conversations…</p>
            )}
            {filtered.map((conv, index) => {
              const { name, subtitle } = describe(conv, auth.user?.id);
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className={`w-full border-b border-gray-200 p-4 text-left transition-colors hover:bg-gray-50 ${
                    selectedId === conv.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-12 w-12 ${AVATAR_COLORS[index % AVATAR_COLORS.length]} flex flex-shrink-0 items-center justify-center rounded-full`}
                    >
                      <span className="font-semibold text-white">{initials(name)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        <span className="text-xs text-gray-500">
                          {new Date(
                            conv.lastMessage?.createdAt ?? conv.updatedAt,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mb-1 text-xs text-gray-500">{subtitle}</p>
                      <div className="flex items-center justify-between">
                        <p className="flex-1 truncate text-sm text-gray-600">
                          {conv.lastMessage?.body ?? 'No messages yet'}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {!conversationsLoading && filtered.length === 0 && (
              <p className="p-4 text-sm text-gray-400">
                {conversations.length === 0
                  ? 'No conversations yet.'
                  : 'No conversations match your search.'}
              </p>
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedConv ? (
          <div className="flex flex-1 flex-col">
            {/* Chat Header */}
            <div className="border-b border-gray-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500">
                    <span className="text-sm font-semibold text-white">
                      {initials(describe(selectedConv, auth.user?.id).name)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{describe(selectedConv, auth.user?.id).name}</p>
                    <p className="text-xs text-gray-500">
                      {describe(selectedConv, auth.user?.id).subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-lg p-2 hover:bg-gray-100" title="Voice call">
                    <Phone className="h-5 w-5 text-gray-600" />
                  </button>
                  <button className="rounded-lg p-2 hover:bg-gray-100" title="Video call">
                    <Video className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {messagesLoading && messages.length === 0 && (
                <p className="text-sm text-gray-500">Loading messages…</p>
              )}
              {messages.map((message) => {
                const isMe = message.senderId === auth.user?.id;
                const sender = selectedConv.participants.find(
                  (p) => p.userId === message.senderId,
                )?.user;
                const senderLabel = isMe
                  ? null
                  : (sender?.name ??
                    (message.senderType === 'AI_ASSISTANT' ? 'AI Assistant' : 'System'));
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md rounded-lg p-4 ${isMe ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white'}`}
                    >
                      {senderLabel && (
                        <p className="mb-1 text-xs font-semibold text-gray-500">{senderLabel}</p>
                      )}
                      <p className="text-sm">{message.body}</p>
                      <p className={`mt-2 text-xs ${isMe ? 'text-blue-100' : 'text-gray-500'}`}>
                        {new Date(message.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              {!messagesLoading && messages.length === 0 && (
                <p className="text-center text-sm text-gray-400">No messages yet. Say hello!</p>
              )}
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
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={submitting || !messageText.trim()}
                  className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
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
