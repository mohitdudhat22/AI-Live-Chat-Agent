import { Message } from '../page';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex flex-col gap-1 ${
        isUser
          ? 'items-end'
          : 'items-start'
      }`}
    >
      <div className="flex items-center gap-2">
        {!isUser && (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 border border-gray-300">
            <span className="text-lg" title="AI">🤖</span>
          </span>
        )}
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 border transition-all
            ${
              isUser
                ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                : 'bg-white text-gray-900 border-gray-200 shadow-md'
            }
          `}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
        {isUser && (  
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 border border-blue-300">
            <span className="text-lg" title="You">🧑</span>
          </span>
        )}
      </div>
      <div
        className={`ml-12 mr-12 text-xs ${
          isUser ? 'text-blue-300 text-right' : 'text-gray-400 text-left'
        }`}
      >
        {isUser ? 'You' : 'AI Agent'} • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

