import { useState } from 'react';
import { X, Send, Bot, User, Sparkles, FileText, DollarSign, Wrench } from 'lucide-react';

export function AIAssistant({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Hello! I'm your Proplity AI Assistant. I can help you with tenant queries, rent tracking, maintenance requests, and property insights. How can I assist you today?",
      timestamp: '10:30 AM',
    },
  ]);

  const quickActions = [
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

  const handleSendMessage = () => {
    if (!message.trim()) return;

    const newUserMessage = {
      id: messages.length + 1,
      sender: 'user',
      text: message,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages([...messages, newUserMessage]);
    setMessage('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        id: messages.length + 2,
        sender: 'ai',
        text: getAIResponse(message),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const getAIResponse = (query: string) => {
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
  };

  const handleQuickAction = (query: string) => {
    setMessage(query);
    handleSendMessage();
  };

  return (
    <div className="flex h-full w-96 flex-col border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-600 to-green-500 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-white">
              <h3 className="font-semibold">Proplity AI</h3>
              <p className="text-xs text-blue-50">Always here to help</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <p className="mb-2 text-xs font-medium text-gray-600">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => handleQuickAction(action.query)}
                className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <Icon className="h-5 w-5 text-blue-600" />
                <span className="text-center text-xs">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                msg.sender === 'ai' ? 'bg-blue-100' : 'bg-green-100'
              }`}
            >
              {msg.sender === 'ai' ? (
                <Bot className="h-4 w-4 text-blue-600" />
              ) : (
                <User className="h-4 w-4 text-green-600" />
              )}
            </div>
            <div className={`flex-1 ${msg.sender === 'user' ? 'flex justify-end' : ''}`}>
              <div
                className={`inline-block max-w-[80%] rounded-lg p-3 ${
                  msg.sender === 'ai' ? 'bg-gray-100 text-gray-800' : 'bg-blue-600 text-white'
                }`}
              >
                <p className="text-sm whitespace-pre-line">{msg.text}</p>
                <p
                  className={`mt-1 text-xs ${
                    msg.sender === 'ai' ? 'text-gray-500' : 'text-blue-100'
                  }`}
                >
                  {msg.timestamp}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-gray-50 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask me anything..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={!message.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-500">
          Powered by AI • Available 24/7 • WhatsApp integration coming soon
        </p>
      </div>
    </div>
  );
}
