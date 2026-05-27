import React from 'react';

export interface ToggleProps {
  label: string | React.ReactNode;
  checked: boolean;
  onChange: () => void;
  colorClass?: string;
}

const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange, colorClass = "bg-indigo-600" }) => (
  <div className="flex items-center justify-between cursor-pointer" onClick={onChange}>
    <label className="text-xs font-medium text-slate-300 pointer-events-none">{label}</label>
    <div className={`w-9 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${checked ? colorClass : 'bg-slate-700'}`}>
      <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${checked ? 'translate-x-4' : ''}`}></div>
    </div>
  </div>
);

export default Toggle;
