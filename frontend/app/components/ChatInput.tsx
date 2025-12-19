'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

const MAX_MESSAGE_LENGTH = 5000;
const MAX_MESSAGE_LENGTH_WARNING = 4000;

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (input.trim() && !disabled && input.trim().length <= MAX_MESSAGE_LENGTH) {
      onSendMessage(input.trim());
      setInput('');
      // Reset height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = '48px';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea for better UI
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setInput(value);
    }
  };

  const isOverLimit = input.trim().length > MAX_MESSAGE_LENGTH;
  const isNearLimit = input.trim().length > MAX_MESSAGE_LENGTH_WARNING;
  const charCount = input.trim().length;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2 w-full">
        <div className="flex-1 relative flex">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={"Type your message..."}
            disabled={disabled}
            rows={1}
            spellCheck={true}
            className={`block w-full resize-none rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 scrollbar-hide font-sans text-base transition-all leading-6
              ${isOverLimit
                ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20'
                : isNearLimit
                  ? 'border-yellow-500 bg-yellow-50 focus:border-yellow-500 focus:ring-yellow-500/20'
                  : 'border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500/20'
              }
            `}
            style={{
              minHeight: '48px',
              maxHeight: '120px',
              overflow: 'hidden',
              resize: 'none'
            }}
          />
          <div className="absolute bottom-2 right-2 select-none pointer-events-none">
            <span className={`text-xs font-mono ${isOverLimit ? 'text-red-600'
                            : isNearLimit ? 'text-yellow-600'
                            : 'text-gray-500'
            }`}>
              {charCount} / {MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </div>
        <div className="flex flex-col h-full">
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim() || isOverLimit}
            className="rounded-xl bg-blue-600 p-3 h-full font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center"
            style={{ height: "100%" }}
          >
            Sends
          </button>
        </div>
      </div>
      {isOverLimit && (
        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
          Message is too long. Maximum length is {MAX_MESSAGE_LENGTH} characters.
        </div>
      )}
      {isNearLimit && !isOverLimit && (
        <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
          Message is getting long ({charCount} characters).
        </div>
      )}
    </div>
  );
}

