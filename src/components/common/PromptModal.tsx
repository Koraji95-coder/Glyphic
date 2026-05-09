// src/components/common/PromptModal.tsx
import { useEffect, useState } from 'react';
import { usePromptModalStore } from '../../stores/promptModalStore';

export function PromptModal() {
  const { isOpen, config, closePrompt } = usePromptModalStore();
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (config?.defaultValue) setInputValue(config.defaultValue);
  }, [config]);

  if (!isOpen || !config) return null;

  const handleConfirm = () => {
    if (config.isConfirm) {
      config.onConfirm(true);
    } else {
      config.onConfirm(inputValue.trim());
    }
    closePrompt();
  };

  const handleCancel = () => {
    config.onCancel?.();
    closePrompt();
  };

  return (
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/70">
      <div className="bg-(--bg-card) rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-(--text-primary)">{config.title}</h2>
          
          {!config.isConfirm && (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={config.placeholder}
              className="w-full mt-4 px-4 py-3 bg-(--bg-input) border border-(--border) rounded-xl focus:outline-none focus:border-(--accent) text-(--text-primary)"
            />
          )}

          {config.isConfirm && (
            <p className="mt-4 text-(--text-secondary)">This action cannot be undone.</p>
          )}
        </div>

        <div className="flex border-t border-(--border)">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-4 text-(--text-secondary) hover:bg-(--bg-hover) font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-4 text-white font-medium transition-colors bg-(--accent) hover:brightness-110"
          >
            {config.confirmLabel || (config.isConfirm ? 'Delete' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}