import { useState } from 'react';
import { X, Send, Bot, User } from 'lucide-react';
import {
  mockAiInitialMessages,
  mockAiQuickActions as quickActions,
  getMockAiResponse,
} from '../store/aiAssistantData';

// The assistant has no backend: every answer is canned text with made-up
// figures (ISS-045). It is hidden unless this build-time flag is "true", and
// even then it says so on screen, so nobody mistakes it for their own data.
export const aiAssistantDemoEnabled = process.env.NEXT_PUBLIC_AI_ASSISTANT_DEMO === 'true';

export function AIAssistant({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(mockAiInitialMessages);

  const handleSendMessage = (override?: string) => {
    const text = (override ?? message).trim();
    if (!text) return;

    const newUserMessage = {
      id: messages.length + 1,
      sender: 'user',
      text,
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
        text: getMockAiResponse(text),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const handleQuickAction = (query: string) => {
    handleSendMessage(query);
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

      <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
        Demo only: these answers are samples, not your real rent, tenant or maintenance data.
      </p>

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
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
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
            onClick={() => handleSendMessage()}
            disabled={!message.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-500">
          Sample assistant • Not connected to your data yet
        </p>
      </div>
    </div>
  );
}
