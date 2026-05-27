import React, { useState, useMemo } from 'react';
import {
  XMarkIcon,
  CommandLineIcon,
  SparklesIcon,
  LanguageIcon,
  UserCircleIcon,
  KeyIcon,
  DocumentPlusIcon,
  FolderPlusIcon,
  MagnifyingGlassIcon,
  SwatchIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  AdjustmentsHorizontalIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore, useTranslatorStore, useFontsStore, StoredFont } from '../../store';
import { useToastStore } from '../../store';
import Toggle from '../../components/ui/Toggle';
import { AVAILABLE_FONTS, FontOption, FontGroup } from '../../components/MangaViewer';
import { fileToBase64 } from '../translator/useTranslatePipeline';

const TORII_TRANSLATORS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Rapido)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Equilibrado)' },
  { id: 'google_translate', name: 'Google Translate (Basico)' },
  { id: 'gpt-4o', name: 'GPT-4o (Premium)' },
];

type TabId = 'engines' | 'fontes' | 'preferencias';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenIchigoLogin?: () => void;
}

const SettingsPanel: React.FC<Props> = ({ isOpen, onClose, onOpenIchigoLogin }) => {
  const [activeTab, setActiveTab] = useState<TabId>('engines');

  // Auth store
  const geminiApiKey = useAuthStore(s => s.geminiApiKey);
  const setGeminiApiKey = useAuthStore(s => s.setGeminiApiKey);
  const openaiApiKey = useAuthStore(s => s.openaiApiKey);
  const setOpenaiApiKey = useAuthStore(s => s.setOpenaiApiKey);
  const deepLKey = useAuthStore(s => s.deepLKey);
  const setDeepLKey = useAuthStore(s => s.setDeepLKey);
  const ichigoEmail = useAuthStore(s => s.ichigoEmail);
  const ichigoToken = useAuthStore(s => s.ichigoToken);
  const toriiApiKey = useAuthStore(s => s.toriiApiKey);
  const setToriiApiKey = useAuthStore(s => s.setToriiApiKey);
  const toriiSaveKey = useAuthStore(s => s.toriiSaveKey);
  const setToriiSaveKey = useAuthStore(s => s.setToriiSaveKey);

  // Translator store
  const toriiInternalTrans = useTranslatorStore(s => s.toriiInternalTrans);
  const setToriiInternalTrans = useTranslatorStore(s => s.setToriiInternalTrans);
  const toriiStrokeDisabled = useTranslatorStore(s => s.toriiStrokeDisabled);
  const setToriiStrokeDisabled = useTranslatorStore(s => s.setToriiStrokeDisabled);
  const toriiInpaintOnly = useTranslatorStore(s => s.toriiInpaintOnly);
  const setToriiInpaintOnly = useTranslatorStore(s => s.setToriiInpaintOnly);
  const useToriiForCleaning = useTranslatorStore(s => s.useToriiForCleaning);
  const setUseToriiForCleaning = useTranslatorStore(s => s.setUseToriiForCleaning);
  const autoTranslate = useTranslatorStore(s => s.autoTranslate);
  const setAutoTranslate = useTranslatorStore(s => s.setAutoTranslate);

  // Fonts store
  const customFonts = useFontsStore(s => s.customFonts);
  const isFontLoading = useFontsStore(s => s.isLoading);
  const addFont = useFontsStore(s => s.addFont);
  const removeFont = useFontsStore(s => s.removeFont);
  const setFontLoading = useFontsStore(s => s.setLoading);

  const [fontSearch, setFontSearch] = useState('');
  const [fontPreviewText, setFontPreviewText] = useState('The quick brown fox jumps over the lazy dog');

  const filteredSystemFonts = useMemo(() => {
    if (!fontSearch) return AVAILABLE_FONTS;
    const search = fontSearch.toLowerCase();
    return AVAILABLE_FONTS.reduce<(FontOption | FontGroup)[]>((acc, item) => {
      if ('group' in item) {
        const matchingOptions = item.options.filter(opt => opt.name.toLowerCase().includes(search));
        if (matchingOptions.length > 0) {
          acc.push({ ...item, options: matchingOptions });
        }
      } else {
        if (item.name.toLowerCase().includes(search)) {
          acc.push(item);
        }
      }
      return acc;
    }, []);
  }, [fontSearch]);

  const filteredCustomFonts = useMemo(() => {
    if (!fontSearch) return customFonts;
    return customFonts.filter(f => f.name.toLowerCase().includes(fontSearch.toLowerCase()));
  }, [customFonts, fontSearch]);

  if (!isOpen) return null;

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setFontLoading(true);
    const file = e.target.files[0];
    const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9 ]/g, '');
    try {
      const base64Data = await fileToBase64(file);
      const newFont: StoredFont = {
        name: fontName,
        value: `"${fontName}", sans-serif`,
        data: base64Data,
      };
      await addFont(newFont);
    } catch (err) {
      console.error('Erro ao carregar fonte:', err);
      useToastStore.getState().addToast('Arquivo de fonte invalido ou corrompido.', 'error');
    } finally {
      setFontLoading(false);
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'engines', label: 'Engines' },
    { id: 'fontes', label: 'Fontes' },
    { id: 'preferencias', label: 'Preferencias' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden relative shadow-2xl">

        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 flex-shrink-0">
          <h3 className="text-white font-bold text-lg">Configuracoes</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
          <div className="flex bg-slate-800 p-1 rounded-lg">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/50">

          {/* Engines Tab */}
          {activeTab === 'engines' && (
            <div className="space-y-6">
              {/* Gemini */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CommandLineIcon className="w-5 h-5 text-orange-400" />
                  <h4 className="text-sm font-bold text-white">Google Gemini</h4>
                  {geminiApiKey && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Configurado</span>}
                </div>
                <p className="text-[10px] text-slate-400">
                  Chave do <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a> para OCR e traducao.
                </p>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  value={geminiApiKey}
                  onChange={e => setGeminiApiKey(e.target.value)}
                />
              </div>

              {/* OpenAI */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white">OpenAI</h4>
                  {openaiApiKey && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Configurado</span>}
                </div>
                <p className="text-[10px] text-slate-400">
                  Chave da <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">OpenAI Platform</a> para GPT-4o.
                </p>
                <input
                  type="password"
                  placeholder="sk-..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  value={openaiApiKey}
                  onChange={e => setOpenaiApiKey(e.target.value)}
                />
              </div>

              {/* DeepL */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <LanguageIcon className="w-5 h-5 text-blue-400" />
                  <h4 className="text-sm font-bold text-white">DeepL</h4>
                  {deepLKey && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Configurado</span>}
                </div>
                <input
                  type="password"
                  placeholder="API Key..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={deepLKey}
                  onChange={e => setDeepLKey(e.target.value)}
                />
              </div>

              {/* Ichigo */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <UserCircleIcon className="w-5 h-5 text-green-400" />
                  <h4 className="text-sm font-bold text-white">Ichigo</h4>
                  {ichigoToken && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Logado</span>}
                </div>
                <p className="text-[10px] text-slate-400">
                  {ichigoToken ? `Logado como: ${ichigoEmail}` : 'Faca login para usar o motor Ichigo.'}
                </p>
                {!ichigoToken && onOpenIchigoLogin && (
                  <button
                    onClick={() => { onClose(); onOpenIchigoLogin(); }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Fazer Login
                  </button>
                )}
              </div>

              {/* Torii */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-pink-400" />
                  <h4 className="text-sm font-bold text-white">Torii</h4>
                  {toriiApiKey && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Configurado</span>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">API Key</label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="sk-..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-pink-500 focus:outline-none pl-9"
                      value={toriiApiKey}
                      onChange={e => setToriiApiKey(e.target.value)}
                    />
                    <KeyIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>
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
              </div>
            </div>
          )}

          {/* Fontes Tab */}
          {activeTab === 'fontes' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Buscar fonte..."
                    value={fontSearch}
                    onChange={(e) => setFontSearch(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-indigo-500"
                  />
                  <MagnifyingGlassIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Preview Input */}
              <div className="flex items-center gap-2 px-2 py-2 bg-slate-800/30 border border-slate-800 rounded-lg">
                <SwatchIcon className="w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={fontPreviewText}
                  onChange={(e) => setFontPreviewText(e.target.value)}
                  className="bg-transparent border-none text-slate-400 text-xs w-full focus:ring-0 placeholder-slate-600"
                  placeholder="Digite um texto para pre-visualizar..."
                />
              </div>

              {/* Upload Box */}
              <label className={`
                flex flex-col items-center justify-center w-full h-28 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer
                hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all group ${isFontLoading ? 'opacity-50 pointer-events-none' : ''}
              `}>
                <div className="flex flex-col items-center justify-center py-4">
                  {isFontLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
                      <span className="text-xs text-indigo-400">Processando...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-2 bg-slate-800 rounded-full mb-2 group-hover:bg-slate-700 transition-colors">
                        <FolderPlusIcon className="w-5 h-5 text-indigo-400" />
                      </div>
                      <p className="text-xs text-slate-300 font-medium">Clique para adicionar fonte</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Suporta .ttf, .otf, .woff</p>
                    </>
                  )}
                </div>
                <input type="file" className="hidden" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} disabled={isFontLoading} />
              </label>

              {/* Custom Fonts List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instaladas ({filteredCustomFonts.length})</h4>
                {filteredCustomFonts.length === 0 ? (
                  <div className="text-center py-6 text-slate-600 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                    {fontSearch ? 'Nenhuma fonte encontrada na busca.' : 'Nenhuma fonte personalizada instalada.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredCustomFonts.map((font, idx) => (
                      <div key={idx} className="group relative bg-slate-800 rounded-lg border border-slate-700 p-3 hover:border-indigo-500/50 transition-colors flex justify-between items-center">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-indigo-400 block">{font.name}</span>
                          <p className="text-lg text-white truncate" style={{ fontFamily: font.value }}>
                            {fontPreviewText || font.name}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFont(idx)}
                          className="p-2 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Remover fonte"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* System Fonts */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Biblioteca do Sistema</h4>
                {filteredSystemFonts.length === 0 ? (
                  <div className="text-center py-6 text-slate-600">Nenhuma fonte encontrada.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredSystemFonts.map((item, idx) => {
                      if ('group' in item) {
                        return (
                          <div key={idx} className="space-y-2">
                            <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider px-1">{item.group}</h5>
                            {item.options.map((opt, optIdx) => (
                              <div key={`${idx}-${optIdx}`} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
                                <span className="text-[10px] font-bold text-slate-500">{opt.name}</span>
                                <p className="text-base text-white truncate" style={{ fontFamily: opt.value }}>
                                  {fontPreviewText || opt.name}
                                </p>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
                          <span className="text-[10px] font-bold text-slate-500">{item.name}</span>
                          <p className="text-base text-white truncate" style={{ fontFamily: item.value }}>
                            {fontPreviewText || item.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preferencias Tab */}
          {activeTab === 'preferencias' && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-4">
                <h4 className="text-sm font-bold text-white">Comportamento</h4>
                <Toggle
                  label={
                    <span className="flex items-center gap-1.5">
                      <LanguageIcon className={`w-3.5 h-3.5 ${autoTranslate ? 'text-indigo-400' : 'text-slate-500'}`} />
                      Auto-traduzir ao fazer upload
                    </span>
                  }
                  checked={autoTranslate}
                  onChange={() => setAutoTranslate(!autoTranslate)}
                  colorClass="bg-indigo-600"
                />
                <Toggle
                  label={
                    <span className="flex items-center gap-1.5">
                      <SparklesIcon className={`w-3.5 h-3.5 ${useToriiForCleaning ? 'text-pink-400' : 'text-slate-500'}`} />
                      Limpar com Torii (Inpaint)
                    </span>
                  }
                  checked={useToriiForCleaning}
                  onChange={() => setUseToriiForCleaning(!useToriiForCleaning)}
                  colorClass="bg-pink-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
