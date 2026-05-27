import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStore, useTranslatorStore } from '../../store';
import { useToastStore } from '../../store';
import { ichigoLogin as ichigoLoginApi, ApiError } from '../../services/api/pipelineApi';
import { performIchigoLogout } from '../translator/ichigoLogout';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const IchigoSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const ichigoEmail = useAuthStore(s => s.ichigoEmail);
  const setIchigoEmail = useAuthStore(s => s.setIchigoEmail);
  const ichigoToken = useAuthStore(s => s.ichigoToken);
  const loginIchigoStore = useAuthStore(s => s.loginIchigo);

  const ocrEngine = useTranslatorStore(s => s.ocrEngine);
  const setOcrEngine = useTranslatorStore(s => s.setOcrEngine);

  const [ichigoPassword, setIchigoPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (!isOpen) return null;

  const handleIchigoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const { accessToken } = await ichigoLoginApi(ichigoEmail, ichigoPassword);
      loginIchigoStore(ichigoEmail, accessToken);
      if (ocrEngine !== 'ICHIGO') setOcrEngine('ICHIGO');
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Falha no login: verifique suas credenciais.';
      useToastStore.getState().addToast(message, 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm overflow-hidden p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><XMarkIcon className="w-5 h-5"/></button>
        <h3 className="text-xl font-bold text-white mb-4">Login Ichigo</h3>
        {!ichigoToken ? (
          <form onSubmit={handleIchigoLogin} className="space-y-4">
            <input type="email" placeholder="Email" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" value={ichigoEmail} onChange={e => setIchigoEmail(e.target.value)} />
            <input type="password" placeholder="Senha" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" value={ichigoPassword} onChange={e => setIchigoPassword(e.target.value)} />
            <button type="submit" disabled={isLoggingIn} className="w-full bg-indigo-600 text-white p-2 rounded">{isLoggingIn ? 'Entrando...' : 'Entrar'}</button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="text-green-400 text-sm">Logado como: {ichigoEmail}</div>
            <button onClick={performIchigoLogout} className="w-full border border-red-500 text-red-400 p-2 rounded">Sair</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IchigoSettingsModal;
