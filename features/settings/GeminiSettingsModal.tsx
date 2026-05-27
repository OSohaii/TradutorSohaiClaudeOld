import React from 'react';
import { XMarkIcon, CommandLineIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const GeminiSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const geminiApiKey = useAuthStore(s => s.geminiApiKey);
  const setGeminiApiKey = useAuthStore(s => s.setGeminiApiKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm p-6 relative animate-fade-in-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><XMarkIcon className="w-5 h-5"/></button>
        <div className="flex items-center gap-2 mb-4">
          <CommandLineIcon className="w-6 h-6 text-orange-400" />
          <h3 className="text-xl font-bold text-white">Google Gemini API</h3>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Insira sua propria chave do <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a> para usar sua quota.
          Se deixado em branco, o servidor usa a chave padrao (quando configurada).
          Sua chave fica apenas no seu navegador e e enviada ao backend somente no momento da traducao.
        </p>

        <div className="space-y-2 mb-4">
          <label className="text-xs font-medium text-slate-300">API Key (opcional - BYOK)</label>
          <input
            type="password"
            placeholder="AIzaSy..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
            value={geminiApiKey}
            onChange={e => setGeminiApiKey(e.target.value)}
          />
        </div>

        <button onClick={onClose} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 rounded-lg transition-colors shadow-lg shadow-orange-900/20">
          Salvar Chave
        </button>
      </div>
    </div>
  );
};

export default GeminiSettingsModal;
