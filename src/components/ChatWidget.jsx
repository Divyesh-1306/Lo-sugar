import { useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I can help explain the live readings and trends. What do you want to know?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const sendMessage = async () => {
    if (!canSend) return;

    const userMessage = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);
    scrollToEnd();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await response.json();
      const reply = response.ok ? data.reply : 'Sorry, I could not respond right now.';

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      scrollToEnd();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I could not connect to the server.' },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-4 w-[320px] sm:w-[360px] rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Live Assistant</div>
              <div className="text-xs text-slate-500">Human-like replies, real-time help</div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-slate-500 hover:text-slate-700"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto px-4 py-3 text-sm">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-2xl px-3 py-2 ${
                    message.role === 'user'
                      ? 'ml-auto bg-slate-900 text-white'
                      : 'mr-auto bg-slate-100 text-slate-900'
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {isSending && (
                <div className="mr-auto rounded-2xl bg-slate-100 px-3 py-2 text-slate-600">
                  Typing...
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <div className="border-t border-slate-100 px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    sendMessage();
                  }
                }}
                className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Ask about the live data..."
              />
              <button
                onClick={sendMessage}
                disabled={!canSend}
                className="rounded-full bg-slate-900 p-2 text-white disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800"
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
