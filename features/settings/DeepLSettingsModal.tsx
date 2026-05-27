import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DeepLSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const deepLKey = useAuthStore(s => s.deepLKey);
  const setDeepLKey = useAuthStore(s => s.setDeepLKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><XMarkIcon className="w-5 h-5"/></button>
        <h3 className="text-xl font-bold text-white mb-4">Configurar DeepL</h3>
        <input type="password" placeholder="API Key" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white mb-4" value={deepLKey} onChange={e => setDeepLKey(e.target.value)} />
        <button onClick={onClose} className="w-full bg-blue-600 text-white p-2 rounded">Salvar</button>
      </div>
    </div>
  );
};

export default DeepLSettingsModal;
