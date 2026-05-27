import React from 'react';
import {
  XMarkIcon,
  SparklesIcon,
  KeyIcon,
  ChatBubbleLeftRightIcon,
  AdjustmentsHorizontalIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore, useTranslatorStore } from '../../store';
import Toggle from '../../components/ui/Toggle';

const TORII_TRANSLATORS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Rapido)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Equilibrado)' },
  { id: 'google_translate', name: 'Google Translate (Basico)' },
  { id: 'gpt-4o', name: 'GPT-4o (Premium)' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const ToriiSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const toriiApiKey = useAuthStore(s => s.toriiApiKey);
  const setToriiApiKey = useAuthStore(s => s.setToriiApiKey);
  const toriiSaveKey = useAuthStore(s => s.toriiSaveKey);
  const setToriiSaveKey = useAuthStore(s => s.setToriiSaveKey);

  const toriiInternalTrans = useTranslatorStore(s => s.toriiInternalTrans);
  const setToriiInternalTrans = useTranslatorStore(s => s.setToriiInternalTrans);
  const toriiStrokeDisabled = useTranslatorStore(s => s.toriiStrokeDisabled);
  const setToriiStrokeDisabled = useTranslatorStore(s => s.setToriiStrokeDisabled);
  const toriiInpaintOnly = useTranslatorStore(s => s.toriiInpaintOnly);
  const setToriiInpaintOnly = useTranslatorStore(s => s.setToriiInpaintOnly);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm overflow-hidden relative animate-fade-in-up">
        <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
          <h3 className="text-white font-bold flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-pink-400" />
            Configurar Torii
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><XMarkIcon className="w-5 h-5"/></button>
        </div>

        <div className="p-5 space-y-5">
          {/* API Key */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Torii API Key</label>
            <div className="relative">
              <input type="password" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-pink-500 focus:outline-none pl-9" value={toriiApiKey} onChange={e => setToriiApiKey(e.target.value)} placeholder="sk-..." />
              <KeyIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          {/* Internal Translator */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
              Modelo de Traducao (Interno)
            </label>
            <select
              value={toriiInternalTrans}
              onChange={(e) => setToriiInternalTrans(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2.5 focus:ring-pink-500 focus:outline-none"
            >
              {TORII_TRANSLATORS.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Advanced Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-700/50">
            <Toggle
              label={<span className="flex items-center gap-2"><AdjustmentsHorizontalIcon className="w-4 h-4 text-slate-500"/> Apenas Limpeza (Inpaint Only)</span>}
              checked={toriiInpaintOnly}
              onChange={() => setToriiInpaintOnly(!toriiInpaintOnly)}
              colorClass="bg-pink-600"
            />

            <Toggle
              label={<span className="flex items-center gap-2"><CpuChipIcon className="w-4 h-4 text-slate-500"/> Desativar Borda (Stroke Disabled)</span>}
              checked={toriiStrokeDisabled}
              onChange={() => setToriiStrokeDisabled(!toriiStrokeDisabled)}
              colorClass="bg-pink-600"
            />

            <Toggle
              label="Salvar Chave no Navegador"
              checked={toriiSaveKey}
              onChange={() => setToriiSaveKey(!toriiSaveKey)}
              colorClass="bg-green-600"
            />
          </div>

          <button onClick={onClose} className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-pink-900/20">
            Salvar Configuracoes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToriiSettingsModal;
