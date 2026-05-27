import React, { useState, useEffect } from 'react';
import {
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  SparklesIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const ONBOARDING_KEY = 'mangalens-onboarding-done';

interface OnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const steps = [
  {
    icon: ArrowUpTrayIcon,
    title: 'Arraste ou selecione suas paginas de manga',
    description: 'Faca upload de imagens JPG/PNG diretamente ou arraste para a janela.',
  },
  {
    icon: Cog6ToothIcon,
    title: 'Escolha o engine de OCR e traducao',
    description: 'Configure Gemini, GPT-4o, Torii ou outros engines na sidebar.',
  },
  {
    icon: SparklesIcon,
    title: 'Veja a traducao aplicada nos baloes',
    description: 'O texto e detectado e traduzido automaticamente sobre a imagem.',
  },
  {
    icon: PencilSquareIcon,
    title: 'Edite baloes, salve na biblioteca, exporte',
    description: 'Ajuste texto, fontes, posicao e exporte a pagina traduzida.',
  },
];

const OnboardingModal: React.FC<OnboardingModalProps> = ({ forceOpen, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setCurrentStep(0);
      return;
    }
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);
    setCurrentStep(0);
    onClose?.();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[90vw] max-w-md p-6 relative">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Step content */}
        <div className="flex flex-col items-center text-center pt-4 pb-6 px-4">
          <div className="bg-indigo-600/20 p-4 rounded-2xl mb-4">
            <Icon className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
          <p className="text-sm text-slate-400">{step.description}</p>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mb-4">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                idx === currentStep ? 'bg-indigo-500' : 'bg-slate-600 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              currentStep === 0
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Anterior
          </button>

          {isLast ? (
            <button
              onClick={handleDismiss}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Comecar
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Proximo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
