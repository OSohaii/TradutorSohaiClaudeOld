import React from 'react';
import { useSessionStore } from '../../store';

const BatchProgressBar: React.FC = () => {
  const history = useSessionStore((s) => s.history);

  const processingCount = history.filter((img) => img.status === 'processing').length;
  const totalCount = history.length;

  if (processingCount === 0) return null;

  const doneCount = totalCount - processingCount;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-300 font-medium">
          Traduzindo {processingCount}/{totalCount}...
        </span>
        <span className="text-xs text-slate-500">{percent}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default BatchProgressBar;
