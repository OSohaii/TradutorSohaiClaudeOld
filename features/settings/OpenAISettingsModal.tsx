import React from 'react';
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const OpenAISettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const openaiApiKey = useAuthStore(s => s.openaiApiKey);
  const setOpenaiApiKey = useAuthStore(s => s.setOpenaiApiKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm p-6 relative animate-fade-in-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><XMarkIcon className="w-5 h-5"/></button>
        <div className="flex items-center gap-2 mb-4">
          <SparklesIcon className="w-6 h-6 text-emerald-400" />
          <h3 className="text-xl font-bold text-white">OpenAI API</h3>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Insira sua chave da <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">OpenAI Platform</a> para usar GPT-4o e GPT-4o-mini como OCR e tradutor.
          Sua chave fica apenas no seu navegador e e enviada ao backend somente no momento da traducao.
        </p>

        <div className="space-y-2 mb-4">
          <label className="text-xs font-medium text-slate-300">API Key (BYOK)</label>
          <input
            type="password"
            placeholder="sk-..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={openaiApiKey}
            onChange={e => setOpenaiApiKey(e.target.value)}
          />
        </div>

        <button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors shadow-lg shadow-emerald-900/20">
          Salvar Chave
        </button>
      </div>
    </div>
  );
};

export default OpenAISettingsModal;
