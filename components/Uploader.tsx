import React, { useState } from 'react';
import { ArrowUpTrayIcon, 
  DocumentDuplicateIcon, 
  GlobeAltIcon, 
  CheckCircleIcon, 
  XMarkIcon, 
  FunnelIcon, 
  CodeBracketIcon, 
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { fetchImageViaProxy } from '../services/api/pipelineApi';
import { useToastStore } from '../store';

interface UploaderProps {
  onFilesSelect: (files: File[]) => void;
  isProcessing: boolean;
}

const Uploader: React.FC<UploaderProps> = ({ onFilesSelect, isProcessing }) => {
  const [urlInput, setUrlInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [scannedImages, setScannedImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState(false);
  
  // Manual HTML Import State
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualHtml, setManualHtml] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files);
      onFilesSelect(fileList);
    }
  };

  // Helper function to download a single URL to a File object via BFF
  const downloadImage = async (url: string): Promise<File | null> => {
    try {
      const { base64, contentType, filename } = await fetchImageViaProxy(url);

      // Convert base64 to blob
      const byteString = atob(base64);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: contentType });
      return new File([blob], filename, { type: contentType });
    } catch (error: any) {
      console.error("Falha ao baixar via BFF:", url, error);
      return null;
    }
  };

  /**
   * Validates that a URL string only uses http/https schemes and is well-formed.
   * Blocks javascript:, data:, vbscript:, file:, ftp: and any other dangerous
   * scheme that could be abused via injected HTML.
   *
   * Returns the normalized URL string when safe, or null when the URL should
   * be discarded.
   */
  const sanitizeImageUrl = (rawUrl: string, baseUrl: string): string | null => {
    if (!rawUrl) return null;

    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    // Reject obvious dangerous schemes early (cheap fast-path).
    const lower = trimmed.toLowerCase();
    const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:', 'blob:'];
    if (DANGEROUS_SCHEMES.some(scheme => lower.startsWith(scheme))) {
      return null;
    }

    let resolved: URL;
    try {
      // The URL constructor handles protocol-relative (//), absolute (/path),
      // and fully qualified URLs correctly when given a base. This replaces
      // the previous error-prone string concatenation.
      resolved = new URL(trimmed, baseUrl);
    } catch {
      return null;
    }

    // Allow http/https only. The URL constructor would happily produce
    // file://, javascript:, data:, blob: etc otherwise.
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }

    return resolved.toString();
  };

  const extractImagesFromHtml = (htmlContent: string, baseUrl: string): string[] => {
    try {
      // Validate baseUrl up-front; bail if it isn't http(s) so resolution
      // below stays predictable.
      let normalizedBase: string;
      try {
        const baseParsed = new URL(baseUrl);
        if (baseParsed.protocol !== 'http:' && baseParsed.protocol !== 'https:') {
          return [];
        }
        normalizedBase = baseParsed.toString();
      } catch {
        return [];
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Find images
      const imgElements = Array.from(doc.querySelectorAll('img'));
      const foundUrls = new Set<string>();
      const MAX_URLS = 500; // Hard cap to prevent DoS from malicious HTML.

      for (const img of imgElements) {
        if (foundUrls.size >= MAX_URLS) break;

        // Check src, data-src, data-lazy-src (common in manga readers)
        const candidates = [
          img.getAttribute('src'),
          img.getAttribute('data-src'),
          img.getAttribute('data-lazy-src'),
        ].filter((s): s is string => Boolean(s));

        for (const candidate of candidates) {
          const sanitized = sanitizeImageUrl(candidate, normalizedBase);
          if (!sanitized) continue;

          // Simple filtering to avoid icons, tracking pixels, etc. Same
          // pattern as before, but applied AFTER scheme validation.
          if (/icon|logo|avatar|tracker|pixel|spacer|clear/i.test(sanitized)) continue;

          foundUrls.add(sanitized);
          break; // One src per <img> is enough.
        }
      }
      return Array.from(foundUrls);
    } catch (e: unknown) {
      console.error("Erro ao processar HTML", e);
      return [];
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsFetching(true);
    setScannedImages([]);
    setScanMode(false);
    setShowManualInput(false);
    
    let targetUrl: string = urlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    // Check if it looks like a direct image file
    const isDirectImage = /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(targetUrl);

    if (isDirectImage) {
      // Direct download mode
      const file = await downloadImage(targetUrl);
      if (file) {
        onFilesSelect([file]);
        setUrlInput('');
      } else {
        useToastStore.getState().addToast('Nao foi possivel carregar a imagem. Tente salvar manualmente.', 'error');
      }
      setIsFetching(false);
    } else {
      // Website Scraping Mode
      try {
        // Use allorigins to get the HTML content
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl);
        
        // Cast to any first to handle unknown from response.json(), then validate
        const json = (await response.json()) as any;
        const contents = json?.contents;
        const htmlContent = typeof contents === 'string' ? contents : '';
        
        if (!htmlContent) throw new Error("Sem conteúdo");

        const urls = extractImagesFromHtml(htmlContent, targetUrl);

        if (urls.length === 0) {
          if (window.confirm("Nenhuma imagem encontrada. O site pode estar protegido por CAPTCHA. Deseja tentar o modo manual?")) {
            setShowManualInput(true);
          }
        } else {
          setScannedImages(urls);
          // Auto select all by default if count is reasonable, else let user choose
          setSelectedImages(new Set(urls.length < 50 ? urls : []));
          setScanMode(true);
        }

      } catch (error: any) {
        console.error(error);
        if (window.confirm("Erro ao ler o site automaticamente. Isso geralmente acontece com sites protegidos por CAPTCHA/Cloudflare.\n\nDeseja tentar o método manual (Copiar/Colar HTML)?")) {
           setShowManualInput(true);
        }
      } finally {
        setIsFetching(false);
      }
    }
  };

  const handleManualHtmlSubmit = () => {
    if (!manualHtml.trim()) return;
    
    const baseUrl = urlInput.trim() || 'https://example.com';
    const urls = extractImagesFromHtml(manualHtml, baseUrl);
    
    if (urls.length > 0) {
      setScannedImages(urls);
      setSelectedImages(new Set(urls.length < 50 ? urls : []));
      setScanMode(true);
      setShowManualInput(false);
      setManualHtml('');
    } else {
      useToastStore.getState().addToast('Nenhuma imagem encontrada no HTML colado. Verifique se copiou o codigo fonte correto.', 'warning');
    }
  };

  const toggleImageSelection = (imgUrl: string) => {
    const newSet = new Set(selectedImages);
    if (newSet.has(imgUrl)) {
      newSet.delete(imgUrl);
    } else {
      newSet.add(imgUrl);
    }
    setSelectedImages(newSet);
  };

  const handleImportSelected = async () => {
    if (selectedImages.size === 0) return;

    setIsFetching(true);
    const files: File[] = [];
    const urlsToProcess = Array.from(selectedImages);

    // Process in batches to not freeze UI too much
    for (const url of urlsToProcess) {
      const file = await downloadImage(url as string);
      if (file) files.push(file);
    }

    setIsFetching(false);
    
    if (files.length > 0) {
      onFilesSelect(files);
      setScanMode(false);
      setScannedImages([]);
      setUrlInput('');
    } else {
      useToastStore.getState().addToast('Falha ao baixar as imagens selecionadas.', 'error');
    }
  };

  // --- Render Scan/Scrape Results ---
  if (scanMode) {
    return (
      <div className="w-full h-full flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <div>
            <h3 className="text-white font-medium flex items-center gap-2">
              <GlobeAltIcon className="w-5 h-5 text-indigo-400"/>
              Imagens Encontradas ({scannedImages.length})
            </h3>
            <p className="text-xs text-slate-400">Selecione as páginas para traduzir</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setSelectedImages(new Set(scannedImages))}
              className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              Todas
            </button>
            <button 
              onClick={() => setSelectedImages(new Set())}
              className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              Nenhuma
            </button>
            <button 
              onClick={() => setScanMode(false)}
              className="p-1.5 text-slate-400 hover:text-white"
              title="Cancelar"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {scannedImages.map((imgUrl, idx) => {
              const isSelected = selectedImages.has(imgUrl);
              return (
                <div 
                  key={idx} 
                  onClick={() => toggleImageSelection(imgUrl)}
                  className={`
                    relative group aspect-[2/3] rounded-lg overflow-hidden cursor-pointer border-2 transition-all
                    ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-700 hover:border-slate-500'}
                  `}
                >
                  <img
                    src={imgUrl}
                    alt={`scan-${idx}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {isSelected && <CheckCircleIcon className="w-8 h-8 text-indigo-400 bg-white rounded-full" />}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-1 truncate text-center">
                    {imgUrl.split('/').pop()?.substring(0, 15)}...
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center">
          <span className="text-sm text-slate-400">
            {selectedImages.size} selecionadas
          </span>
          <button
            onClick={handleImportSelected}
            disabled={selectedImages.size === 0 || isFetching}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isFetching ? (
               <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
               <ArrowUpTrayIcon className="w-4 h-4" />
            )}
            Importar e Traduzir
          </button>
        </div>
      </div>
    );
  }

  // --- Default Upload View ---
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      
      {/* File Upload Area */}
      <div className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 transition-all p-8 text-center group relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
            <div className="relative bg-slate-900 rounded-full p-4 mb-4">
              <DocumentDuplicateIcon className="w-12 h-12 text-indigo-400" />
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Carregar do Dispositivo</h3>
          <p className="text-slate-400 mb-6 max-w-sm text-sm">
            Arraste arquivos ou clique para selecionar. <br/>
            <span className="text-indigo-400 font-medium">Suporta múltiplos arquivos.</span>
          </p>

          <label className={`
            relative inline-flex items-center px-6 py-3 overflow-hidden text-sm font-medium text-white 
            bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 
            cursor-pointer transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}>
            <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
            <span>Selecionar Arquivos</span>
            <input 
              type="file" 
              multiple
              accept="image/png, image/jpeg, image/jpg, image/webp" 
              onChange={handleInputChange}
              disabled={isProcessing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-px bg-slate-700 flex-1"></div>
        <span className="text-slate-500 text-sm font-medium">OU EXTRAIR DA WEB</span>
        <div className="h-px bg-slate-700 flex-1"></div>
      </div>

      {/* URL Input Area */}
      {!showManualInput ? (
        <div className="flex flex-col gap-2">
            <form onSubmit={handleUrlSubmit} className="w-full bg-slate-800/30 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center">
              <div className="p-2 bg-slate-800 rounded-lg text-slate-400 hidden sm:block">
                <GlobeAltIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 w-full">
                 <input 
                  type="text" 
                  placeholder="Cole o link da imagem ou site de mangá..." 
                  className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 placeholder-slate-500"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isProcessing || isFetching}
                 />
              </div>
              <button 
                type="submit"
                disabled={!urlInput || isProcessing || isFetching}
                className={`
                  w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-slate-700 rounded-lg border border-slate-600 
                  hover:bg-slate-600 hover:text-white focus:ring-4 focus:outline-none focus:ring-slate-700
                  transition-all flex items-center justify-center
                  disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]
                `}
              >
                {isFetching ? (
                  <div className="flex items-center gap-2">
                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     <span>Buscando...</span>
                  </div>
                ) : (
                  <>
                    <FunnelIcon className="w-4 h-4 mr-2" />
                    Escanear
                  </>
                )}
              </button>
            </form>
            
            <div className="flex justify-between items-start px-1">
              <p className="text-xs text-slate-500 max-w-[70%]">
                 Funciona com links diretos ou sites simples.
              </p>
              <button 
                onClick={() => setShowManualInput(true)} 
                className="text-xs text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1"
              >
                <CodeBracketIcon className="w-3 h-3" />
                Problemas com CAPTCHA?
              </button>
            </div>
        </div>
      ) : (
        /* Manual HTML Input Mode (CAPTCHA Bypass) */
        <div className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 animate-fade-in-down">
           <div className="flex justify-between items-center mb-3">
             <h3 className="text-white font-medium flex items-center gap-2">
               <CodeBracketIcon className="w-5 h-5 text-indigo-400" />
               Modo Manual (Burlar CAPTCHA)
             </h3>
             <button onClick={() => setShowManualInput(false)} className="text-slate-400 hover:text-white">
               <XMarkIcon className="w-5 h-5" />
             </button>
           </div>
           
           <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 mb-4 text-sm text-slate-300 space-y-2">
              <p>Se o scanner automático falhar por causa do Cloudflare/CAPTCHA:</p>
              <ol className="list-decimal list-inside space-y-1 ml-1 text-slate-400">
                <li className="flex items-center gap-2">
                   Abra o site: 
                   {urlInput ? (
                     <a href={urlInput.startsWith('http') ? urlInput : `https://${urlInput}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                       {urlInput} <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                     </a>
                   ) : <span className="text-slate-600">(Insira a URL acima primeiro)</span>}
                </li>
                <li>Resolva o CAPTCHA e espere o capítulo carregar.</li>
                <li>Clique com botão direito na página → <strong>Exibir Código Fonte</strong> (ou Ctrl+U).</li>
                <li>Copie todo o código (Ctrl+A, Ctrl+C) e cole abaixo.</li>
              </ol>
           </div>

           <textarea
             className="w-full h-32 bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none mb-3"
             placeholder="Cole o HTML da página aqui (<html>...</html>)"
             value={manualHtml}
             onChange={(e) => setManualHtml(e.target.value)}
           ></textarea>
           
           <div className="flex justify-end gap-2">
             <button 
               onClick={() => setShowManualInput(false)}
               className="px-4 py-2 text-slate-300 hover:text-white text-sm"
             >
               Cancelar
             </button>
             <button 
               onClick={handleManualHtmlSubmit}
               disabled={!manualHtml.trim()}
               className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
             >
               <FunnelIcon className="w-4 h-4" />
               Processar HTML
             </button>
           </div>
        </div>
      )}

    </div>
  );
};

export default Uploader;