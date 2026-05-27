import React, { useState, useMemo } from 'react';
import {
  XMarkIcon,
  DocumentPlusIcon,
  FolderPlusIcon,
  MagnifyingGlassIcon,
  SwatchIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useFontsStore, StoredFont } from '../../store';
import { useToastStore } from '../../store';
import { AVAILABLE_FONTS, FontOption, FontGroup } from '../../components/MangaViewer';
import { fileToBase64 } from '../translator/useTranslatePipeline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const FontManagerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const customFonts = useFontsStore(s => s.customFonts);
  const isFontLoading = useFontsStore(s => s.isLoading);
  const addFont = useFontsStore(s => s.addFont);
  const removeFont = useFontsStore(s => s.removeFont);
  const setFontLoading = useFontsStore(s => s.setLoading);

  const [activeFontTab, setActiveFontTab] = useState<'custom' | 'library'>('custom');
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

  const deleteCustomFont = (index: number) => {
    removeFont(index);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden relative animate-fade-in-up shadow-2xl">

        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <DocumentPlusIcon className="w-6 h-6 text-indigo-400" />
              Gerenciador de Fontes
            </h3>
            <p className="text-xs text-slate-400 mt-1">Adicione fontes personalizadas ou visualize as do sistema.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg"><XMarkIcon className="w-6 h-6"/></button>
        </div>

        {/* Tabs & Search */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => setActiveFontTab('custom')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeFontTab === 'custom' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Minhas Fontes
            </button>
            <button
              onClick={() => setActiveFontTab('library')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeFontTab === 'library' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Biblioteca do Sistema
            </button>
          </div>

          <div className="relative w-full sm:w-64">
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
        <div className="px-4 py-2 bg-slate-800/30 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <SwatchIcon className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={fontPreviewText}
              onChange={(e) => setFontPreviewText(e.target.value)}
              className="bg-transparent border-none text-slate-400 text-xs w-full focus:ring-0 placeholder-slate-600"
              placeholder="Digite um texto para pre-visualizar..."
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/50">

          {activeFontTab === 'custom' && (
            <div className="space-y-6">
              {/* Upload Box */}
              <label className={`
                flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer
                hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all group ${isFontLoading ? 'opacity-50 pointer-events-none' : ''}
              `}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isFontLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
                      <span className="text-xs text-indigo-400">Processando...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-slate-800 rounded-full mb-3 group-hover:bg-slate-700 transition-colors">
                        <FolderPlusIcon className="w-6 h-6 text-indigo-400" />
                      </div>
                      <p className="text-sm text-slate-300 font-medium">Clique para adicionar fonte</p>
                      <p className="text-xs text-slate-500 mt-1">Suporta .ttf, .otf, .woff</p>
                    </>
                  )}
                </div>
                <input type="file" className="hidden" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} disabled={isFontLoading} />
              </label>

              {/* Custom Fonts List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instaladas ({filteredCustomFonts.length})</h4>

                {filteredCustomFonts.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                    {fontSearch ? "Nenhuma fonte encontrada na busca." : "Nenhuma fonte personalizada instalada."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredCustomFonts.map((font, idx) => (
                      <div key={idx} className="group relative bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-indigo-500/50 transition-colors flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-indigo-400 block mb-1">{font.name}</span>
                            <p className="text-xl text-white break-words" style={{ fontFamily: font.value }}>
                              {fontPreviewText || font.name}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteCustomFont(idx)}
                            className="p-2 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Remover fonte"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeFontTab === 'library' && (
            <div className="space-y-6">
              {filteredSystemFonts.length === 0 ? (
                <div className="text-center py-8 text-slate-600">
                  Nenhuma fonte encontrada para "{fontSearch}".
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredSystemFonts.map((item, idx) => {
                    if ('group' in item) {
                      return (
                        <div key={idx} className="space-y-2">
                          <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider px-1">{item.group}</h5>
                          <div className="grid grid-cols-1 gap-2">
                            {item.options.map((opt, optIdx) => (
                              <div key={`${idx}-${optIdx}`} className="bg-slate-800 rounded-lg border border-slate-700 p-3 flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-500">{opt.name}</span>
                                </div>
                                <p className="text-lg text-white truncate" style={{ fontFamily: opt.value }}>
                                  {fontPreviewText || opt.name}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="bg-slate-800 rounded-lg border border-slate-700 p-3 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500">{item.name}</span>
                          {item.name === 'Anime Ace 2.0 BB' && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Padrao</span>}
                        </div>
                        <p className="text-lg text-white truncate" style={{ fontFamily: item.value }}>
                          {fontPreviewText || item.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-[10px] text-slate-500">
          <span>Armazenamento local (Browser)</span>
          <span>{customFonts.length} Customizada(s)</span>
        </div>
      </div>
    </div>
  );
};

export default FontManagerModal;
