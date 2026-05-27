import React, { useState, useMemo } from 'react';
import {
  BookOpenIcon,
  PlusIcon,
  TrashIcon,
  FolderIcon,
  DocumentIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  XMarkIcon,
  PencilIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  BookmarkIcon,
  ClockIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { BookOpenIcon as BookOpenSolid } from '@heroicons/react/24/solid';
import { Chapter } from '../types/library';
import { ProcessedImage } from '../types';
import {
  createManga,
  createChapter,
  pageToProcessedImage,
  getLibraryStats,
} from '../services/libraryService';
import { useLibraryStore } from '../store';
import { useToastStore } from '../store';

interface LibraryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentHistory: ProcessedImage[];
  onLoadChapter: (images: ProcessedImage[]) => void;
}

type ViewMode = 'list' | 'manga' | 'chapter';

const LibraryManager: React.FC<LibraryManagerProps> = ({
  isOpen,
  onClose,
  currentHistory,
  onLoadChapter,
}) => {
  // ---- Library data: lives in zustand, hydrated from libraryService ----
  // Pre-Phase-2b this was a `useState(loadLibrary)` + `useEffect(() => saveLibrary)`,
  // which gave each component its own copy and meant App.tsx never saw
  // changes the user made here. Now the store is the single source of
  // truth, and any subscriber re-renders together.
  const library = useLibraryStore();
  const stats = useMemo(() => getLibraryStats(library), [library]);

  // ---- UI state ----
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Selection by ID (not object) so the rendered manga/chapter is
  // always derived from the live library, never a stale snapshot. This
  // also fixes a latent bug where deleting/editing inside a chapter
  // left stale data in `selectedManga`/`selectedChapter` until the
  // next manual refresh.
  const [selectedMangaId, setSelectedMangaId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const selectedManga = useMemo(
    () => library.mangas.find(m => m.id === selectedMangaId) ?? null,
    [library.mangas, selectedMangaId],
  );
  const selectedChapter = useMemo(
    () => selectedManga?.chapters.find(c => c.id === selectedChapterId) ?? null,
    [selectedManga, selectedChapterId],
  );

  // Form states
  const [showNewMangaForm, setShowNewMangaForm] = useState(false);
  const [showNewChapterForm, setShowNewChapterForm] = useState(false);
  const [newMangaTitle, setNewMangaTitle] = useState('');
  const [newChapterNumber, setNewChapterNumber] = useState(1);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit states
  const [editingMangaId, setEditingMangaId] = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Filtrar mangás
  const filteredMangas = library.mangas.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Criar novo mangá
  const handleCreateManga = () => {
    if (!newMangaTitle.trim()) return;
    library.addManga(createManga(newMangaTitle.trim()));
    setNewMangaTitle('');
    setShowNewMangaForm(false);
  };

  // Criar novo capítulo
  const handleCreateChapter = () => {
    if (!selectedManga) return;
    const chapter = createChapter(newChapterNumber, newChapterTitle.trim() || undefined);
    library.addChapter(selectedManga.id, chapter);
    // selectedManga is derived from the store, so no manual refresh needed.
    setNewChapterNumber(prev => prev + 1);
    setNewChapterTitle('');
    setShowNewChapterForm(false);
  };

  // Salvar histórico atual em um capítulo
  const handleSaveToChapter = async (chapter: Chapter) => {
    if (!selectedManga || currentHistory.length === 0) return;

    const doneImages = currentHistory.filter(img => img.status === 'done');
    if (doneImages.length === 0) {
      useToastStore.getState().addToast('Nao ha paginas traduzidas para salvar.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await library.addPagesToChapter(selectedManga.id, chapter.id, doneImages);
      useToastStore.getState().addToast(`${doneImages.length} pagina(s) salva(s) com sucesso!`, 'success');
    } catch (e) {
      console.error('Erro ao salvar:', e);
      useToastStore.getState().addToast('Erro ao salvar paginas.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Carregar capítulo no visualizador
  const handleLoadChapter = async (chapter: Chapter) => {
    setIsSaving(true); // Reusar para mostrar loading
    try {
      const images = await Promise.all(chapter.pages.map(pageToProcessedImage));
      onLoadChapter(images);
      onClose();
    } catch (e) {
      console.error('Erro ao carregar capítulo:', e);
      useToastStore.getState().addToast('Erro ao carregar capitulo.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Deletar mangá
  const handleDeleteManga = (mangaId: string, mangaTitle: string) => {
    if (!window.confirm(`Deletar "${mangaTitle}" e todos os capítulos?`)) return;

    library.deleteManga(mangaId);
    if (selectedMangaId === mangaId) {
      setSelectedMangaId(null);
      setSelectedChapterId(null);
      setViewMode('list');
    }
  };

  // Deletar capítulo
  const handleDeleteChapter = (chapter: Chapter) => {
    if (!selectedManga) return;
    if (!window.confirm(`Deletar Capítulo ${chapter.number}?`)) return;

    library.deleteChapter(selectedManga.id, chapter.id);
    if (selectedChapterId === chapter.id) {
      setSelectedChapterId(null);
      setViewMode('manga');
    }
  };

  // Salvar edição de título
  const handleSaveEdit = () => {
    if (editingMangaId) {
      library.updateManga(editingMangaId, { title: editTitle });
      setEditingMangaId(null);
    } else if (editingChapterId && selectedManga) {
      library.updateChapter(selectedManga.id, editingChapterId, { title: editTitle });
      setEditingChapterId(null);
    }
    setEditTitle('');
  };

  // Navegar para mangá
  const openManga = (mangaId: string) => {
    const manga = library.mangas.find(m => m.id === mangaId);
    if (!manga) return;
    setSelectedMangaId(mangaId);
    setViewMode('manga');
    setNewChapterNumber(manga.chapters.length + 1);
  };

  // Navegar para capítulo
  const openChapter = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setViewMode('chapter');
  };

  // Voltar
  const goBack = () => {
    if (viewMode === 'chapter') {
      setSelectedChapterId(null);
      setViewMode('manga');
    } else if (viewMode === 'manga') {
      setSelectedMangaId(null);
      setViewMode('list');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-fade-in-up">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center gap-3">
            {viewMode !== 'list' && (
              <button
                onClick={goBack}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <BookOpenSolid className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">
                  {viewMode === 'list' && 'Minha Biblioteca'}
                  {viewMode === 'manga' && selectedManga?.title}
                  {viewMode === 'chapter' && `Capítulo ${selectedChapter?.number}`}
                </h2>
                <p className="text-xs text-slate-400">
                  {viewMode === 'list' &&
                    `${stats.totalMangas} mangás • ${stats.totalChapters} capítulos • ${stats.totalPages} páginas`}
                  {viewMode === 'manga' && `${selectedManga?.chapters.length || 0} capítulos`}
                  {viewMode === 'chapter' && `${selectedChapter?.pages.length || 0} páginas`}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Lista de Mangás */}
          {viewMode === 'list' && (
            <>
              {/* Search & Actions */}
              <div className="p-4 border-b border-slate-800 flex gap-3">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar mangá..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setShowNewMangaForm(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Novo Mangá</span>
                </button>
              </div>

              {/* New Manga Form */}
              {showNewMangaForm && (
                <div className="p-4 bg-slate-800/50 border-b border-slate-700 animate-fade-in">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Nome do mangá..."
                      value={newMangaTitle}
                      onChange={e => setNewMangaTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateManga()}
                      autoFocus
                      className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={handleCreateManga}
                      disabled={!newMangaTitle.trim()}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Criar
                    </button>
                    <button
                      onClick={() => {
                        setShowNewMangaForm(false);
                        setNewMangaTitle('');
                      }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Manga Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredMangas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <BookOpenIcon className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Biblioteca vazia</p>
                    <p className="text-sm">Crie seu primeiro mangá para começar!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredMangas.map(manga => (
                      <div
                        key={manga.id}
                        className="group relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-indigo-500/50 transition-all cursor-pointer hover:shadow-xl hover:shadow-indigo-500/10"
                        onClick={() => openManga(manga.id)}
                      >
                        {/* Cover */}
                        <div className="aspect-[2/3] bg-gradient-to-br from-slate-700 to-slate-800 relative overflow-hidden">
                          {manga.coverUrl ? (
                            <img
                              src={manga.coverUrl}
                              alt={manga.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookmarkIcon className="w-12 h-12 text-slate-600" />
                            </div>
                          )}

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ChevronRightIcon className="w-10 h-10 text-white" />
                          </div>

                          {/* Chapter Count Badge */}
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
                            {manga.chapters.length} cap.
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-3">
                          {editingMangaId === manga.id ? (
                            <input
                              type="text"
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onBlur={handleSaveEdit}
                              onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                              onClick={e => e.stopPropagation()}
                              autoFocus
                              className="w-full bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-white text-sm focus:outline-none"
                            />
                          ) : (
                            <h3 className="text-white font-medium text-sm truncate">
                              {manga.title}
                            </h3>
                          )}
                          <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            {new Date(manga.updatedAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setEditingMangaId(manga.id);
                              setEditTitle(manga.title);
                            }}
                            className="p-1.5 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteManga(manga.id, manga.title);
                            }}
                            className="p-1.5 bg-slate-800/90 hover:bg-red-600 rounded-lg text-slate-300 hover:text-white"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Lista de Capítulos */}
          {viewMode === 'manga' && selectedManga && (
            <>
              {/* Actions */}
              <div className="p-4 border-b border-slate-800 flex gap-3 flex-wrap">
                <button
                  onClick={() => setShowNewChapterForm(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  Novo Capítulo
                </button>

                {currentHistory.filter(img => img.status === 'done').length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800 px-3 py-2 rounded-lg">
                    <PhotoIcon className="w-4 h-4" />
                    {currentHistory.filter(img => img.status === 'done').length} página(s) prontas
                    para salvar
                  </div>
                )}
              </div>

              {/* New Chapter Form */}
              {showNewChapterForm && (
                <div className="p-4 bg-slate-800/50 border-b border-slate-700 animate-fade-in">
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-slate-400 text-sm">Nº:</label>
                      <input
                        type="number"
                        value={newChapterNumber}
                        onChange={e => setNewChapterNumber(parseInt(e.target.value) || 1)}
                        className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Título (opcional)..."
                      value={newChapterTitle}
                      onChange={e => setNewChapterTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateChapter()}
                      className="flex-1 min-w-[200px] bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={handleCreateChapter}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                    >
                      Criar
                    </button>
                    <button
                      onClick={() => {
                        setShowNewChapterForm(false);
                        setNewChapterTitle('');
                      }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Chapter List */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedManga.chapters.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <FolderIcon className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Nenhum capítulo</p>
                    <p className="text-sm">Crie um capítulo e salve suas traduções!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedManga.chapters.map(chapter => (
                      <div
                        key={chapter.id}
                        className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-indigo-500/50 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => openChapter(chapter.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-700 rounded-lg">
                                <DocumentIcon className="w-5 h-5 text-indigo-400" />
                              </div>
                              <div>
                                <h4 className="text-white font-medium">
                                  Capítulo {chapter.number}
                                  {chapter.title && (
                                    <span className="text-slate-400 ml-2">- {chapter.title}</span>
                                  )}
                                </h4>
                                <p className="text-slate-500 text-sm">
                                  {chapter.pages.length} páginas •{' '}
                                  {new Date(chapter.updatedAt).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {currentHistory.filter(img => img.status === 'done').length > 0 && (
                              <button
                                onClick={() => handleSaveToChapter(chapter)}
                                disabled={isSaving}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                {isSaving ? 'Salvando...' : 'Salvar Aqui'}
                              </button>
                            )}
                            {chapter.pages.length > 0 && (
                              <button
                                onClick={() => handleLoadChapter(chapter)}
                                disabled={isSaving}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <BookOpenIcon className="w-4 h-4" />
                                {isSaving ? 'Carregando...' : 'Abrir'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteChapter(chapter)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Preview de páginas */}
                        {chapter.pages.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                            {chapter.pages.slice(0, 6).map((page, idx) => (
                              <div
                                key={page.id}
                                className="flex-shrink-0 w-12 h-16 bg-slate-900 rounded-lg overflow-hidden border border-slate-700"
                              >
                                <img
                                  src={page.thumbnailUrl || page.imageUrl}
                                  alt={`Página ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                            {chapter.pages.length > 6 && (
                              <div className="flex-shrink-0 w-12 h-16 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                                +{chapter.pages.length - 6}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Visualização de Capítulo */}
          {viewMode === 'chapter' && selectedChapter && (
            <>
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <div>
                  {selectedChapter.title && (
                    <p className="text-slate-400 text-sm">{selectedChapter.title}</p>
                  )}
                </div>
                <button
                  onClick={() => handleLoadChapter(selectedChapter)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <BookOpenIcon className="w-5 h-5" />
                  {isSaving ? 'Carregando...' : 'Abrir no Visualizador'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {selectedChapter.pages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <PhotoIcon className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Nenhuma página</p>
                    <p className="text-sm">Traduza páginas e salve neste capítulo.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {selectedChapter.pages.map((page, idx) => (
                      <div
                        key={page.id}
                        className="aspect-[2/3] bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-colors relative group"
                      >
                        <img
                          src={page.thumbnailUrl || page.imageUrl}
                          alt={page.fileName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-white text-xs text-center">{idx + 1}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LibraryManager;
