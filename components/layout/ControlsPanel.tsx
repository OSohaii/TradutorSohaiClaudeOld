import React, { useMemo, useState } from 'react';
import {
  LanguageIcon,
  SwatchIcon,
  Cog6ToothIcon,
  BookmarkSquareIcon,
  ViewfinderCircleIcon,
  ChatBubbleLeftRightIcon,
  ListBulletIcon,
  BoldIcon,
  ItalicIcon,
  MinusCircleIcon,
  PlusCircleIcon,
  SparklesIcon,
  UserCircleIcon,
  CommandLineIcon,
  DocumentPlusIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

import Toggle from '../ui/Toggle';
import { AVAILABLE_FONTS, FontGroup } from '../MangaViewer';
import {
  useAuthStore,
  useFontsStore,
  useTranslatorStore,
  EngineId,
} from '../../store';
import type { ModalOpeners } from './types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ControlsPanelProps {
  /** Translation pipeline handlers (owned by App via useTranslatePipeline). */
  handleTranslateAll: () => Promise<void> | void;
  handleTranslateImage: (id: string) => Promise<void> | void;
  handleTranslateOnly: (id: string) => Promise<void> | void;
  handleCancelOcr: (id: string) => void;
  retryImage: (id: string) => Promise<void> | void;
  totalCost: number;
  displayedTotalTokens: number;

  /** Single bag of callbacks for opening settings / library modals. */
  modalOpeners: ModalOpeners;
}

// ─── Tab definition ───────────────────────────────────────────────────────────

type TabId = 'translation' | 'style' | 'advanced' | 'library';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  {
    id: 'translation',
    label: 'Tradução',
    icon: <LanguageIcon className="w-4 h-4" />,
  },
  {
    id: 'style',
    label: 'Estilo',
    icon: <SwatchIcon className="w-4 h-4" />,
  },
  {
    id: 'advanced',
    label: 'Avançado',
    icon: <Cog6ToothIcon className="w-4 h-4" />,
  },
  {
    id: 'library',
    label: 'Biblioteca',
    icon: <BookmarkSquareIcon className="w-4 h-4" />,
  },
];

// ─── Section label helper ─────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
    {children}
  </p>
);

// ─── Tab: Tradução ────────────────────────────────────────────────────────────

const TranslationTab: React.FC = () => {
  const ocrEngine = useTranslatorStore(s => s.ocrEngine);
  const setOcrEngine = useTranslatorStore(s => s.setOcrEngine);
  const transEngine = useTranslatorStore(s => s.transEngine);
  const setTransEngine = useTranslatorStore(s => s.setTransEngine);
  const sourceLanguage = useTranslatorStore(s => s.sourceLanguage);
  const setSourceLanguage = useTranslatorStore(s => s.setSourceLanguage);
  const targetLanguage = useTranslatorStore(s => s.targetLanguage);
  const setTargetLanguage = useTranslatorStore(s => s.setTargetLanguage);
  const setTargetLangCode = useTranslatorStore(s => s.setTargetLangCode);

  const isFullGeminiOcr =
    ocrEngine === 'GEMINI_PRO_FULL' ||
    ocrEngine === 'GEMINI_FLASH_FULL' ||
    ocrEngine === 'GEMINI_3_FLASH_FULL' ||
    ocrEngine === 'GEMINI_35_FLASH_FULL';

  return (
    <div className="space-y-5">
      {/* Engines */}
      <div>
        <SectionLabel>Engines</SectionLabel>
        <div className="space-y-3">
          {/* OCR Engine */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400 flex items-center gap-1.5">
              <ViewfinderCircleIcon className="w-3.5 h-3.5" />
              OCR Engine
            </label>
            <select
              id="cp-ocr-engine"
              value={ocrEngine}
              onChange={e => setOcrEngine(e.target.value as EngineId)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="GEMINI_FLASH">Gemini 2.5 Flash</option>
              <option value="GEMINI_FLASH_FULL">Gemini 2.5 Flash (Full)</option>
              <option value="GEMINI_35_FLASH">Gemini 3.5 Flash</option>
              <option value="GEMINI_35_FLASH_FULL">Gemini 3.5 Flash (Full)</option>
              <option value="GEMINI_3_FLASH">Gemini 3 Flash</option>
              <option value="GEMINI_3_FLASH_FULL">Gemini 3 Flash (Full)</option>
              <option value="GEMINI_PRO">Gemini 3.1 Pro</option>
              <option value="GEMINI_PRO_FULL">Gemini 3.1 Pro (Full)</option>
              <option value="GPT4O">GPT-4o</option>
              <option value="GPT4O_MINI">GPT-4o Mini</option>
              <option value="ICHIGO">Ichigo</option>
              <option value="TORII">Torii (Full)</option>
            </select>
          </div>

          {/* Translation Engine */}
          <div className={`space-y-1 transition-opacity ${isFullGeminiOcr ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
            <label className="text-xs text-slate-400 flex items-center gap-1.5">
              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
              Tradutor
            </label>
            <select
              id="cp-trans-engine"
              value={transEngine}
              onChange={e => setTransEngine(e.target.value as EngineId)}
              disabled={isFullGeminiOcr}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer disabled:cursor-not-allowed"
            >
              {isFullGeminiOcr ? (
                <option>Integrado (Full)</option>
              ) : (
                <>
                  <option value="GEMINI_35_FLASH">Gemini 3.5 Flash</option>
                  <option value="GEMINI_PRO">Gemini 3.1 Pro</option>
                  <option value="GEMINI_FLASH">Gemini 2.5 Flash</option>
                  <option value="GPT4O">GPT-4o</option>
                  <option value="GPT4O_MINI">GPT-4o Mini</option>
                  <option value="DEEPL">DeepL</option>
                  <option value="GOOGLE">Google</option>
                  <option value="TORII">Torii</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Languages */}
      <div>
        <SectionLabel>Idiomas</SectionLabel>
        <div className="space-y-3">
          {/* Source */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400 flex items-center gap-1.5">
              <LanguageIcon className="w-3.5 h-3.5" />
              Origem
            </label>
            <select
              id="cp-source-lang"
              value={sourceLanguage}
              onChange={e => setSourceLanguage(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="Japanese">Japanese</option>
              <option value="Korean">Korean</option>
              <option value="Chinese (Simplified)">Chinese (Simplified)</option>
              <option value="Chinese (Traditional)">Chinese (Traditional)</option>
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
            </select>
          </div>

          {/* Target */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400 flex items-center gap-1.5">
              <LanguageIcon className="w-3.5 h-3.5" />
              Alvo
            </label>
            <select
              id="cp-target-lang"
              value={targetLanguage}
              onChange={e => {
                const val = e.target.value;
                setTargetLanguage(val);
                const codeMap: Record<string, string> = {
                  'Portugues (Brasil)': 'pt-BR',
                  'English': 'en',
                  'Spanish': 'es',
                  'French': 'fr',
                  'Japanese': 'ja',
                  'Korean': 'ko',
                };
                setTargetLangCode(codeMap[val] || 'pt-BR');
              }}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="Portugues (Brasil)">Portugues (Brasil)</option>
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="Japanese">Japanese</option>
              <option value="Korean">Korean</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Estilo ──────────────────────────────────────────────────────────────

const StyleTab: React.FC = () => {
  const targetFont = useTranslatorStore(s => s.targetFont);
  const setTargetFont = useTranslatorStore(s => s.setTargetFont);
  const targetBold = useTranslatorStore(s => s.targetBold);
  const setTargetBold = useTranslatorStore(s => s.setTargetBold);
  const targetItalic = useTranslatorStore(s => s.targetItalic);
  const setTargetItalic = useTranslatorStore(s => s.setTargetItalic);
  const globalBubbleScale = useTranslatorStore(s => s.globalBubbleScale);
  const setGlobalBubbleScale = useTranslatorStore(s => s.setGlobalBubbleScale);
  const customFonts = useFontsStore(s => s.customFonts);

  const availableFontsForSelector = useMemo(() => {
    if (customFonts.length === 0) return AVAILABLE_FONTS;
    const customGroup: FontGroup = {
      group: 'Fontes Personalizadas',
      type: 'group',
      options: customFonts,
    };
    return [customGroup, ...AVAILABLE_FONTS];
  }, [customFonts]);

  return (
    <div className="space-y-5">
      {/* Font */}
      <div>
        <SectionLabel>Tipografia</SectionLabel>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 flex items-center gap-1.5">
              <ListBulletIcon className="w-3.5 h-3.5" />
              Fonte
            </label>
            <select
              id="cp-font"
              value={targetFont}
              onChange={e => setTargetFont(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              {availableFontsForSelector.map((font, idx) => {
                if ('group' in font) {
                  return (
                    <optgroup key={idx} label={font.group}>
                      {font.options.map((opt, subIdx) => (
                        <option key={`${idx}-${subIdx}`} value={opt.value}>
                          {opt.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                }
                return (
                  <option key={idx} value={font.value}>
                    {font.name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Bold / Italic */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Estilo</label>
            <div className="flex gap-2">
              <button
                id="cp-bold-toggle"
                onClick={() => setTargetBold(!targetBold)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                  targetBold
                    ? 'bg-slate-600 border-slate-500 text-white shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
                title="Negrito"
              >
                <BoldIcon className="w-3.5 h-3.5" />
                Negrito
              </button>
              <button
                id="cp-italic-toggle"
                onClick={() => setTargetItalic(!targetItalic)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                  targetItalic
                    ? 'bg-slate-600 border-slate-500 text-white shadow-sm'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
                title="Itálico"
              >
                <ItalicIcon className="w-3.5 h-3.5" />
                Itálico
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Bubble Scale */}
      <div>
        <SectionLabel>Balões</SectionLabel>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Tamanho dos Balões</span>
            <span className="text-indigo-400 font-mono font-semibold">
              {Math.round(globalBubbleScale * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="cp-scale-minus"
              onClick={() => setGlobalBubbleScale(Math.max(0.5, globalBubbleScale - 0.1))}
              className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
              title="Diminuir"
            >
              <MinusCircleIcon className="w-5 h-5" />
            </button>
            <input
              id="cp-scale-slider"
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={globalBubbleScale}
              onChange={e => setGlobalBubbleScale(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <button
              id="cp-scale-plus"
              onClick={() => setGlobalBubbleScale(Math.min(1.5, globalBubbleScale + 0.1))}
              className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
              title="Aumentar"
            >
              <PlusCircleIcon className="w-5 h-5" />
            </button>
          </div>
          {/* Scale presets */}
          <div className="flex gap-1 pt-0.5">
            {[0.75, 1.0, 1.25].map(preset => (
              <button
                key={preset}
                onClick={() => setGlobalBubbleScale(preset)}
                className={`flex-1 py-1 rounded text-[10px] font-mono border transition-all ${
                  Math.abs(globalBubbleScale - preset) < 0.01
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
              >
                {Math.round(preset * 100)}%
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Avançado ────────────────────────────────────────────────────────────

interface AdvancedTabProps {
  modalOpeners: ModalOpeners;
}

const AdvancedTab: React.FC<AdvancedTabProps> = ({ modalOpeners }) => {
  const ocrEngine = useTranslatorStore(s => s.ocrEngine);
  const transEngine = useTranslatorStore(s => s.transEngine);
  const useToriiForCleaning = useTranslatorStore(s => s.useToriiForCleaning);
  const setUseToriiForCleaning = useTranslatorStore(s => s.setUseToriiForCleaning);
  const autoTranslate = useTranslatorStore(s => s.autoTranslate);
  const setAutoTranslate = useTranslatorStore(s => s.setAutoTranslate);
  const toriiApiKey = useAuthStore(s => s.toriiApiKey);
  const ichigoToken = useAuthStore(s => s.ichigoToken);
  const geminiApiKey = useAuthStore(s => s.geminiApiKey);
  const deepLKey = useAuthStore(s => s.deepLKey);
  const openaiApiKey = useAuthStore(s => s.openaiApiKey);

  const showToriiCleaning = ocrEngine !== 'TORII' && transEngine !== 'TORII';

  return (
    <div className="space-y-5">
      {/* Toggles */}
      <div>
        <SectionLabel>Automação</SectionLabel>
        <div className="space-y-3">
          {/* Auto-translate */}
          <Toggle
            label={
              <span className="flex items-center gap-1.5 text-xs" title="Traduzir automaticamente ao fazer upload">
                <LanguageIcon className={`w-3.5 h-3.5 ${autoTranslate ? 'text-indigo-400' : 'text-slate-500'}`} />
                Auto-traduzir
              </span>
            }
            checked={autoTranslate}
            onChange={() => setAutoTranslate(!autoTranslate)}
            colorClass="bg-indigo-600"
          />

          {/* Torii Cleaning */}
          {showToriiCleaning && (
            <Toggle
              label={
                <span className="flex items-center gap-1.5 text-xs" title="Usa Torii apenas para limpar balões">
                  <SparklesIcon className={`w-3.5 h-3.5 ${useToriiForCleaning ? 'text-pink-400' : 'text-slate-500'}`} />
                  Limpar com Torii
                </span>
              }
              checked={useToriiForCleaning}
              onChange={() => {
                setUseToriiForCleaning(!useToriiForCleaning);
                if (!useToriiForCleaning && !toriiApiKey) modalOpeners.torii();
              }}
              colorClass="bg-pink-600"
            />
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* BYOK Keys Grid */}
      <div>
        <SectionLabel>API Keys (BYOK)</SectionLabel>
        <div className="grid grid-cols-4 gap-2">
          <button
            id="cp-key-ichigo"
            onClick={modalOpeners.ichigo}
            className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border transition-all ${
              ichigoToken
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600'
            }`}
            title="Ichigo"
          >
            <UserCircleIcon className="w-5 h-5" />
            <span className="text-[9px] font-medium">Ichigo</span>
          </button>

          <button
            id="cp-key-torii"
            onClick={modalOpeners.torii}
            className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border transition-all ${
              toriiApiKey
                ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600'
            }`}
            title="Torii"
          >
            <SparklesIcon className="w-5 h-5" />
            <span className="text-[9px] font-medium">Torii</span>
          </button>

          <button
            id="cp-key-deepl"
            onClick={modalOpeners.deepl}
            className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border transition-all ${
              deepLKey
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600'
            }`}
            title="DeepL"
          >
            <LanguageIcon className="w-5 h-5" />
            <span className="text-[9px] font-medium">DeepL</span>
          </button>

          <button
            id="cp-key-gemini"
            onClick={modalOpeners.gemini}
            className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border transition-all ${
              geminiApiKey
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600'
            }`}
            title="Google Gemini Key (BYOK)"
          >
            <CommandLineIcon className="w-5 h-5" />
            <span className="text-[9px] font-medium">Gemini</span>
          </button>

          <button
            id="cp-key-openai"
            onClick={modalOpeners.openai}
            className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border transition-all ${
              openaiApiKey
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600'
            }`}
            title="OpenAI Key (BYOK)"
          >
            <SparklesIcon className="w-5 h-5" />
            <span className="text-[9px] font-medium">OpenAI</span>
          </button>

          <button
            id="cp-key-fonts"
            onClick={modalOpeners.fonts}
            className="p-2.5 rounded-xl flex flex-col items-center gap-1 border bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600 transition-all"
            title="Gerenciar Fontes"
          >
            <DocumentPlusIcon className="w-5 h-5" />
            <span className="text-[9px] font-medium">Fontes</span>
          </button>

          <button
            id="cp-key-settings"
            onClick={modalOpeners.settings}
            className="p-2.5 rounded-xl flex flex-col items-center gap-1 border bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-indigo-400 hover:border-slate-600 transition-all"
            title="Configurações"
          >
            <Cog6ToothIcon className="w-5 h-5" />
            <span className="text-[9px] font-medium">Config</span>
          </button>

          <button
            id="cp-key-onboarding"
            onClick={modalOpeners.onboarding}
            className="p-2.5 rounded-xl flex flex-col items-center gap-1 border bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-amber-400 hover:border-slate-600 transition-all"
            title="Tutorial"
          >
            <QuestionMarkCircleIcon className="w-5 h-5" />
            <span className="text-[9px] font-medium">Tutorial</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Biblioteca ──────────────────────────────────────────────────────────

interface LibraryTabProps {
  modalOpeners: ModalOpeners;
}

const LibraryTab: React.FC<LibraryTabProps> = ({ modalOpeners }) => (
  <div className="flex flex-col items-center justify-center gap-6 h-full py-8">
    <div className="bg-gradient-to-tr from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 p-6 rounded-2xl">
      <BookmarkSquareIcon className="w-12 h-12 text-indigo-400" />
    </div>
    <div className="text-center space-y-1">
      <p className="text-sm font-semibold text-slate-200">Minha Biblioteca</p>
      <p className="text-xs text-slate-500">Acesse seus capítulos salvos</p>
    </div>
    <button
      id="cp-library-open"
      onClick={modalOpeners.library}
      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/25 text-sm"
    >
      <BookmarkSquareIcon className="w-4 h-4" />
      Abrir Biblioteca
    </button>
  </div>
);

// ─── ControlsPanel ────────────────────────────────────────────────────────────

/**
 * Right-panel replacement for `<Sidebar embedded hideHistory />`.
 *
 * Organises all controls into 4 tabs:
 *  - Tradução  — OCR engine, translator engine, source/target language
 *  - Estilo    — Font, bold/italic, bubble scale
 *  - Avançado  — Torii cleaning, auto-translate, BYOK key grid
 *  - Biblioteca — Library modal launcher
 *
 * Reads Zustand stores directly (same pattern as Sidebar) so the parent only
 * needs to inject pipeline handlers and modal openers.
 */
const ControlsPanel: React.FC<ControlsPanelProps> = ({
  modalOpeners,
  // Pipeline props are accepted for interface parity with sidebarProps; the
  // individual tabs that need them receive modalOpeners. Future tabs that need
  // pipeline handlers can be wired through additional props.
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('translation');

  return (
    <div className="h-full w-full bg-slate-900 border-l border-slate-800 flex flex-col">
      {/* ── Tab Bar ── */}
      <div className="flex border-b border-slate-800 bg-slate-900 flex-shrink-0">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`cp-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-[10px] font-medium border-b-2 transition-all ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
              title={tab.label}
            >
              {tab.icon}
              <span className="leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'translation' && <TranslationTab />}
        {activeTab === 'style' && <StyleTab />}
        {activeTab === 'advanced' && <AdvancedTab modalOpeners={modalOpeners} />}
        {activeTab === 'library' && <LibraryTab modalOpeners={modalOpeners} />}
      </div>
    </div>
  );
};

export default ControlsPanel;
