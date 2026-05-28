import React, { useState, useMemo } from 'react';
import {
  XMarkIcon,
  CommandLineIcon,
  SparklesIcon,
  LanguageIcon,
  UserCircleIcon,
  KeyIcon,
  FolderPlusIcon,
  MagnifyingGlassIcon,
  SwatchIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  AdjustmentsHorizontalIcon,
  CpuChipIcon,
  Cog8ToothIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

import { useAuthStore, useTranslatorStore, useFontsStore, StoredFont } from '../../store';
import { useToastStore } from '../../store';
import Toggle from '../../components/ui/Toggle';
import { AVAILABLE_FONTS, FontOption, FontGroup } from '../../components/MangaViewer';
import { fileToBase64 } from '../translator/useTranslatePipeline';
import { ichigoLogin as ichigoLoginApi, ApiError } from '../../services/api/pipelineApi';
import { performIchigoLogout } from '../translator/ichigoLogout';

const TORII_TRANSLATORS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Rápido)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Equilibrado)' },
  { id: 'google_translate', name: 'Google Translate (Básico)' },
  { id: 'gpt-4o', name: 'GPT-4o (Premium)' },
];

type TabId = 'geral' | 'ichigo' | 'torii' | 'apis' | 'fontes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabId;
}

const UnifiedSettingsModal: React.FC<Props> = ({ isOpen, onClose, initialTab = 'geral' }) => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Auth store
  const geminiApiKey = useAuthStore(s => s.geminiApiKey);
  const setGeminiApiKey = useAuthStore(s => s.setGeminiApiKey);
  const openaiApiKey = useAuthStore(s => s.openaiApiKey);
  const setOpenaiApiKey = useAuthStore(s => s.setOpenaiApiKey);
  const deepLKey = useAuthStore(s => s.deepLKey);
  const setDeepLKey = useAuthStore(s => s.setDeepLKey);
  
  const ichigoEmail = useAuthStore(s => s.ichigoEmail);
  const setIchigoEmail = useAuthStore(s => s.setIchigoEmail);
  const ichigoToken = useAuthStore(s => s.ichigoToken);
  const loginIchigoStore = useAuthStore(s => s.loginIchigo);
  
  const toriiApiKey = useAuthStore(s => s.toriiApiKey);
  const setToriiApiKey = useAuthStore(s => s.setToriiApiKey);
  const toriiSaveKey = useAuthStore(s => s.toriiSaveKey);
  const setToriiSaveKey = useAuthStore(s => s.setToriiSaveKey);

  // Translator store
  const ocrEngine = useTranslatorStore(s => s.ocrEngine);
  const setOcrEngine = useTranslatorStore(s => s.setOcrEngine);
  
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
  
  // Ichigo Auth Local State
  const [ichigoPassword, setIchigoPassword] = useState('');
  const [isIchigoLoggingIn, setIsIchigoLoggingIn] = useState(false);

  // Sync initialTab when modal opens
  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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
      useToastStore.getState().addToast('Arquivo de fonte inválido ou corrompido.', 'error');
    } finally {
      setFontLoading(false);
    }
  };

  const handleIchigoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsIchigoLoggingIn(true);
    try {
      const { accessToken } = await ichigoLoginApi(ichigoEmail, ichigoPassword);
      loginIchigoStore(ichigoEmail, accessToken);
      if (ocrEngine !== 'ICHIGO') setOcrEngine('ICHIGO');
      useToastStore.getState().addToast('Login realizado com sucesso.', 'success');
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Falha no login: verifique suas credenciais.';
      useToastStore.getState().addToast(message, 'error');
    } finally {
      setIsIchigoLoggingIn(false);
    }
  };

  const TABS = [
    { id: 'geral', label: 'Geral', icon: <Cog8ToothIcon className="w-5 h-5" /> },
    { id: 'apis', label: 'Integrações API', icon: <CommandLineIcon className="w-5 h-5" /> },
    { id: 'ichigo', label: 'Ichigo Engine', icon: <UserCircleIcon className="w-5 h-5" /> },
    { id: 'torii', label: 'Torii Inpaint', icon: <SparklesIcon className="w-5 h-5" /> },
    { id: 'fontes', label: 'Gerenciador de Fontes', icon: <SwatchIcon className="w-5 h-5" /> },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 md:p-4 animate-fade-in">
      <div className="bg-slate-900 md:rounded-xl md:border border-slate-700 w-full h-full md:max-w-4xl md:h-[85vh] flex flex-col md:flex-row overflow-hidden relative shadow-2xl">
        
        {/* Mobile Header / Desktop Close Button */}
        <div className="md:hidden flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900">
          <h3 className="text-white font-bold text-lg">Configurações</h3>
          <button onClick={onClose} className="text-slate-400 p-2">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-slate-950/50 md:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex-shrink-0 flex md:flex-col overflow-x-auto md:overflow-y-auto no-scrollbar">
          <div className="md:p-4 hidden md:flex justify-between items-center pb-6">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <WrenchScrewdriverIcon className="w-5 h-5 text-indigo-400" />
              Configurações
            </h3>
          </div>
          <div className="flex md:flex-col gap-1 p-2 md:p-3">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`flex items-center gap-3 px-4 py-3 md:py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap md:whitespace-normal flex-shrink-0 ${
                    isActive
                      ? 'bg-indigo-600/10 text-indigo-400'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 md:bg-slate-900/50 relative">
          
          <div className="hidden md:flex absolute top-4 right-4 z-10">
            <button onClick={onClose} className="text-slate-400 hover:text-white p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            
            {/* --- GERAL TAB --- */}
            {activeTab === 'geral' && (
              <div className="max-w-xl space-y-6 animate-fade-in-up">
                <h4 className="text-xl font-bold text-white mb-6">Comportamento</h4>
                <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-5 space-y-5">
                  <Toggle
                    label={
                      <span className="flex items-center gap-2">
                        <LanguageIcon className={`w-4 h-4 ${autoTranslate ? 'text-indigo-400' : 'text-slate-500'}`} />
                        Auto-traduzir ao fazer upload
                      </span>
                    }
                    checked={autoTranslate}
                    onChange={() => setAutoTranslate(!autoTranslate)}
                    colorClass="bg-indigo-600"
                  />
                  <div className="border-t border-slate-700/50 pt-5">
                    <Toggle
                      label={
                        <span className="flex items-center gap-2">
                          <SparklesIcon className={`w-4 h-4 ${useToriiForCleaning ? 'text-pink-400' : 'text-slate-500'}`} />
                          Limpar com Torii (Inpaint)
                        </span>
                      }
                      checked={useToriiForCleaning}
                      onChange={() => setUseToriiForCleaning(!useToriiForCleaning)}
                      colorClass="bg-pink-600"
                    />
                    <p className="text-xs text-slate-500 mt-2 ml-6">
                      Usa o Torii exclusivamente para a etapa de Inpainting (limpeza de balões), ignorando o modelo de tradução selecionado se não for o Torii. Exige API Key do Torii configurada.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* --- APIS TAB --- */}
            {activeTab === 'apis' && (
              <div className="max-w-2xl space-y-6 animate-fade-in-up">
                <h4 className="text-xl font-bold text-white mb-6">Integrações API (BYOK)</h4>
                
                {/* Gemini */}
                <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CommandLineIcon className="w-6 h-6 text-orange-400" />
                      <h4 className="text-base font-bold text-white">Google Gemini</h4>
                    </div>
                    {geminiApiKey && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-medium">Configurado</span>}
                  </div>
                  <p className="text-xs text-slate-400">
                    Chave do <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a> para OCR avançado e tradução contextual.
                  </p>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-orange-500 focus:outline-none pl-10"
                      value={geminiApiKey}
                      onChange={e => setGeminiApiKey(e.target.value)}
                    />
                    <KeyIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>

                {/* OpenAI */}
                <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="w-6 h-6 text-emerald-400" />
                      <h4 className="text-base font-bold text-white">OpenAI</h4>
                    </div>
                    {openaiApiKey && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-medium">Configurado</span>}
                  </div>
                  <p className="text-xs text-slate-400">
                    Chave da <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">OpenAI Platform</a> para OCR e tradução via GPT-4o.
                  </p>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="sk-proj-..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-10"
                      value={openaiApiKey}
                      onChange={e => setOpenaiApiKey(e.target.value)}
                    />
                    <KeyIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>

                {/* DeepL */}
                <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LanguageIcon className="w-6 h-6 text-blue-400" />
                      <h4 className="text-base font-bold text-white">DeepL</h4>
                    </div>
                    {deepLKey && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-medium">Configurado</span>}
                  </div>
                  <p className="text-xs text-slate-400">
                    Chave da API do DeepL para tradução neural de alta qualidade.
                  </p>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="DeepL Auth Key..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none pl-10"
                      value={deepLKey}
                      onChange={e => setDeepLKey(e.target.value)}
                    />
                    <KeyIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            )}

            {/* --- ICHIGO TAB --- */}
            {activeTab === 'ichigo' && (
              <div className="max-w-md space-y-6 animate-fade-in-up">
                <h4 className="text-xl font-bold text-white mb-6">Conta Ichigo</h4>
                
                <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-6 shadow-inner">
                  {!ichigoToken ? (
                    <form onSubmit={handleIchigoLogin} className="space-y-5">
                      <div className="text-center pb-2">
                        <UserCircleIcon className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">Faça login com sua conta Ichigo para acessar a engine de tradução oficial.</p>
                      </div>
                      <div className="space-y-4">
                        <input 
                          type="email" 
                          placeholder="Email" 
                          required
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                          value={ichigoEmail} 
                          onChange={e => setIchigoEmail(e.target.value)} 
                        />
                        <input 
                          type="password" 
                          placeholder="Senha" 
                          required
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                          value={ichigoPassword} 
                          onChange={e => setIchigoPassword(e.target.value)} 
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isIchigoLoggingIn} 
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {isIchigoLoggingIn ? 'Autenticando...' : 'Fazer Login'}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-6 text-center">
                      <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
                        <UserCircleIcon className="w-8 h-8 text-green-400" />
                      </div>
                      <div>
                        <h5 className="text-white font-medium text-lg">Autenticado</h5>
                        <p className="text-green-400 text-sm mt-1">{ichigoEmail}</p>
                      </div>
                      <button 
                        onClick={performIchigoLogout} 
                        className="w-full border border-red-500/50 hover:bg-red-500/10 text-red-400 p-3 rounded-lg font-medium transition-colors"
                      >
                        Desconectar Conta
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- TORII TAB --- */}
            {activeTab === 'torii' && (
              <div className="max-w-xl space-y-6 animate-fade-in-up">
                <h4 className="text-xl font-bold text-white mb-6">Configuração Torii</h4>
                
                <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-6 space-y-6">
                  {/* API Key */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Torii API Key</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-pink-500 focus:outline-none pl-10" 
                        value={toriiApiKey} 
                        onChange={e => setToriiApiKey(e.target.value)} 
                        placeholder="sk-..." 
                      />
                      <KeyIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                    </div>
                    {toriiApiKey && <p className="text-xs text-green-400 mt-1">✓ Chave informada</p>}
                  </div>

                  {/* Internal Translator */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <ChatBubbleLeftRightIcon className="w-4 h-4 text-slate-400" />
                      Modelo de Tradução (Interno Torii)
                    </label>
                    <select
                      value={toriiInternalTrans}
                      onChange={(e) => setToriiInternalTrans(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-3 focus:ring-2 focus:ring-pink-500 focus:outline-none"
                    >
                      {TORII_TRANSLATORS.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Advanced Toggles */}
                  <div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <Toggle
                      label={<span className="flex items-center gap-2 text-sm"><AdjustmentsHorizontalIcon className="w-4 h-4 text-slate-400"/> Apenas Limpeza (Inpaint Only)</span>}
                      checked={toriiInpaintOnly}
                      onChange={() => setToriiInpaintOnly(!toriiInpaintOnly)}
                      colorClass="bg-pink-600"
                    />

                    <Toggle
                      label={<span className="flex items-center gap-2 text-sm"><CpuChipIcon className="w-4 h-4 text-slate-400"/> Desativar Borda de Texto (Stroke Disabled)</span>}
                      checked={toriiStrokeDisabled}
                      onChange={() => setToriiStrokeDisabled(!toriiStrokeDisabled)}
                      colorClass="bg-pink-600"
                    />

                    <Toggle
                      label={<span className="text-sm">Salvar Chave no Navegador</span>}
                      checked={toriiSaveKey}
                      onChange={() => setToriiSaveKey(!toriiSaveKey)}
                      colorClass="bg-green-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* --- FONTES TAB --- */}
            {activeTab === 'fontes' && (
              <div className="max-w-3xl space-y-6 animate-fade-in-up">
                <h4 className="text-xl font-bold text-white mb-6">Gerenciador de Fontes</h4>
                
                {/* Search & Preview */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Buscar fonte..."
                      value={fontSearch}
                      onChange={(e) => setFontSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <MagnifyingGlassIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg flex-1">
                    <SwatchIcon className="w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={fontPreviewText}
                      onChange={(e) => setFontPreviewText(e.target.value)}
                      className="bg-transparent border-none text-slate-300 text-sm w-full focus:ring-0 placeholder-slate-600 p-0"
                      placeholder="Texto para pré-visualizar..."
                    />
                  </div>
                </div>

                {/* Upload Box */}
                <label className={`
                  flex flex-col items-center justify-center w-full h-32 md:h-40 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-800/20
                  hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all group ${isFontLoading ? 'opacity-50 pointer-events-none' : ''}
                `}>
                  <div className="flex flex-col items-center justify-center py-4">
                    {isFontLoading ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
                        <span className="text-sm text-indigo-400">Processando arquivo...</span>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-slate-800 rounded-full mb-3 group-hover:bg-indigo-500/20 transition-colors">
                          <FolderPlusIcon className="w-6 h-6 text-indigo-400" />
                        </div>
                        <p className="text-sm text-slate-300 font-medium">Clique para instalar fonte local</p>
                        <p className="text-xs text-slate-500 mt-1">Suporta arquivos .ttf, .otf, .woff</p>
                      </>
                    )}
                  </div>
                  <input type="file" className="hidden" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} disabled={isFontLoading} />
                </label>

                {/* Custom Fonts */}
                <div className="space-y-4 pt-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    Instaladas
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-xs">{filteredCustomFonts.length}</span>
                  </h4>
                  {filteredCustomFonts.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-800/20 rounded-xl border border-slate-800 border-dashed">
                      {fontSearch ? 'Nenhuma fonte encontrada na busca.' : 'Nenhuma fonte personalizada instalada.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredCustomFonts.map((font, idx) => (
                        <div key={idx} className="group relative bg-slate-800/40 rounded-xl border border-slate-700 p-4 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all flex justify-between items-center shadow-sm">
                          <div className="min-w-0 flex-1 pr-4">
                            <span className="text-xs font-bold text-indigo-400 block mb-1 truncate">{font.name}</span>
                            <p className="text-xl text-white truncate" style={{ fontFamily: font.value }}>
                              {fontPreviewText || font.name}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFont(idx)}
                            className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                            title="Remover fonte"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* System Fonts */}
                <div className="space-y-4 pt-6 border-t border-slate-800">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Biblioteca Padrão</h4>
                  {filteredSystemFonts.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">Nenhuma fonte encontrada.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredSystemFonts.map((item, idx) => {
                        if ('group' in item) {
                          return (
                            <div key={idx} className="space-y-3 col-span-1 md:col-span-2 mt-2">
                              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">{item.group}</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {item.options.map((opt, optIdx) => (
                                  <div key={`${idx}-${optIdx}`} className="bg-slate-800/40 rounded-xl border border-slate-700 p-4">
                                    <span className="text-xs font-medium text-slate-400 block mb-1">{opt.name}</span>
                                    <p className="text-xl text-white truncate" style={{ fontFamily: opt.value }}>
                                      {fontPreviewText || opt.name}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="bg-slate-800/40 rounded-xl border border-slate-700 p-4">
                            <span className="text-xs font-medium text-slate-400 block mb-1">{item.name}</span>
                            <p className="text-xl text-white truncate" style={{ fontFamily: item.value }}>
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
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedSettingsModal;
