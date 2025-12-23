
import React, { useState } from 'react';
import { Calendar, Users, Calculator, ChevronDown, ChevronUp, Printer, Trash2, Eraser, MousePointer2 } from 'lucide-react';
import { SchedulingConfig, ThursdayScenario, Employee, ShiftSymbol, Tool } from './types';
import { SCENARIO_DESCRIPTIONS, CELL_STYLES, TARGET_MULTIPLIER } from './constants';
import { getMonthlySpecialHolidays } from './scheduleGenerator';

interface ControlsProps {
  config: SchedulingConfig;
  setConfig: React.Dispatch<React.SetStateAction<SchedulingConfig>>;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  onGenerate: () => void;
  baseTarget: number;
  stats?: {
      totalDemand: number;
      totalCapacity: number;
      suggestedSpecialLeaves: number;
  };
  selectedSymbol: Tool;
  setSelectedSymbol: (s: Tool) => void;
  onOpenClearModal: () => void;
  activeScenario?: ThursdayScenario;
  usedTuesdayReduction?: boolean;
}

const Controls: React.FC<ControlsProps> = ({ 
    config, setConfig, employees, setEmployees, onGenerate, baseTarget, stats,
    selectedSymbol, setSelectedSymbol, onOpenClearModal, activeScenario, usedTuesdayReduction
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const monthlyHolidays = getMonthlySpecialHolidays(config.year, config.month, config.jan1WorkDay);

  const updateStaffName = (index: number, newName: string) => {
    const updated = [...employees];
    updated[index].name = newName;
    setEmployees(updated);
  };
  
  const updateStaffTarget = (index: number, val: string) => {
    const updated = [...employees];
    updated[index].customTarget = val === '' ? undefined : parseInt(val);
    setEmployees(updated);
  };

  const addStaff = () => {
      const newId = (Math.max(...employees.map(e => parseInt(e.id) || 0)) + 1).toString();
      setEmployees([...employees, { 
          id: newId, 
          name: `員工 ${newId}`, 
          shifts: {}, 
          generatedShiftCount: 0,
          targetDeduction: 0
      }]);
      setConfig(prev => ({ ...prev, staffIds: [...prev.staffIds, newId] }));
  };
  
  const removeStaff = (index: number) => {
      if (employees.length <= 1) return;
      const toRemove = employees[index];
      const updated = employees.filter((_, i) => i !== index);
      setEmployees(updated);
      setConfig(prev => ({ ...prev, staffIds: prev.staffIds.filter(id => id !== toRemove.id) }));
  };

  const handlePrint = () => {
      window.print();
  };

  const shiftTools: string[] = ['A', 'B', 'C', 'X'];
  const symbols: ShiftSymbol[] = ['O', '特', '婚', '產', '年', '喪'];

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm transition-all duration-300 print:hidden relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left side: App Title */}
            <div className="flex items-center">
                <h1 className="text-xl xl:text-2xl font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                    <Calendar className="w-6 h-6 text-indigo-600" />
                    ShiftFlow
                </h1>
            </div>

            {/* Right side: Toolbox + Print + Expand */}
            <div className="flex flex-col md:flex-row items-center gap-3 lg:gap-4">
                
                {/* Compact Pill Toolbox Bar - Positioned to the left of buttons */}
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 p-1 rounded-2xl shadow-sm overflow-x-auto scrollbar-hide">
                    
                    {/* Mode Group: Select & Eraser */}
                    <div className="flex items-center gap-1 pr-1.5 mr-1 border-r border-gray-100">
                        <button
                            onClick={() => setSelectedSymbol(null)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200
                                ${selectedSymbol === null 
                                    ? 'bg-indigo-600 text-white shadow-md scale-105' 
                                    : 'text-gray-400 hover:bg-gray-50'}
                            `}
                            title="選取模式"
                        >
                            <MousePointer2 className="w-4.5 h-4.5" />
                        </button>
                        <button
                            onClick={() => setSelectedSymbol(selectedSymbol === 'eraser' ? null : 'eraser')}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border border-transparent
                                ${selectedSymbol === 'eraser' 
                                    ? 'bg-white border-red-500 text-red-500 shadow-sm scale-105' 
                                    : 'text-gray-400 hover:bg-gray-50'}
                            `}
                            title="橡皮擦"
                        >
                            <Eraser className="w-4.5 h-4.5" />
                        </button>
                    </div>

                    {/* Shifts Group: A, B, C, X */}
                    <div className="flex items-center gap-1 pr-1.5 mr-1 border-r border-gray-100">
                        {shiftTools.map(s => (
                            <button
                                key={s}
                                onClick={() => setSelectedSymbol(selectedSymbol === s ? null : s)}
                                className={`w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center border transition-all duration-200
                                    ${selectedSymbol === s 
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10 scale-105' 
                                        : 'border-gray-100 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'}
                                `}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Special Group: O, 特, 婚, 產, 年, 喪 */}
                    <div className="flex items-center gap-1">
                        {symbols.map(s => (
                            <button
                                key={s}
                                onClick={() => setSelectedSymbol(selectedSymbol === s ? null : s)}
                                className={`w-9 h-9 rounded-xl text-[10px] font-bold flex items-center justify-center border transition-all duration-200
                                    ${selectedSymbol === s 
                                        ? 'ring-2 ring-indigo-400 scale-110 z-10' 
                                        : 'hover:border-gray-300'}
                                    ${CELL_STYLES[s] || 'bg-white border-gray-100'}
                                `}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-200 rounded-xl transition-all border border-gray-200"
                    >
                        <Printer className="w-4 h-4" />
                        <span>列印/PDF</span>
                    </button>
                    <button 
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-gray-100"
                    >
                        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>

        {/* Expandable Configuration Section */}
        {isOpen && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-4 mt-6 pt-6 border-t border-gray-100">
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Date & Target */}
                    <div className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                        <h3 className="text-sm font-black text-gray-400 uppercase flex items-center gap-2 tracking-[0.2em]">
                            📅 日期與目標
                        </h3>
                        <div className="flex gap-3">
                            <div className="relative w-full">
                                <input 
                                    type="number"
                                    value={config.year}
                                    onChange={(e) => setConfig({...config, year: parseInt(e.target.value) || 0})}
                                    className="block w-full rounded-xl border-gray-200 py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold text-gray-700"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold pointer-events-none">年</span>
                            </div>
                            <select 
                                value={config.month}
                                onChange={(e) => setConfig({...config, month: parseInt(e.target.value)})}
                                className="block w-full rounded-xl border-gray-200 py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold text-gray-700"
                            >
                                {Array.from({length: 12}, (_, i) => (
                                    <option key={i} value={i}>{i + 1}月</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">年假日期 (目標扣除)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="date"
                                    value={config.yearHolidayStart || ''}
                                    onChange={(e) => setConfig({...config, yearHolidayStart: e.target.value})}
                                    className="block w-full rounded-xl border-gray-200 py-2 px-3 text-xs focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                />
                                <span className="text-gray-300 self-center">~</span>
                                <input 
                                    type="date"
                                    value={config.yearHolidayEnd || ''}
                                    onChange={(e) => setConfig({...config, yearHolidayEnd: e.target.value})}
                                    className="block w-full rounded-xl border-gray-200 py-2 px-3 text-xs focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <input 
                                    type="checkbox"
                                    id="jan1WorkDay"
                                    checked={config.jan1WorkDay}
                                    onChange={(e) => setConfig({...config, jan1WorkDay: e.target.checked})}
                                    className="rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <label htmlFor="jan1WorkDay" className="text-xs text-gray-500 font-bold select-none cursor-pointer">
                                    1/1 元旦不休診
                                </label>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm">
                            <span className="text-xs font-bold text-gray-400 uppercase">個人基準目標</span>
                            <span className="font-black text-indigo-600 text-xl">{baseTarget} 節</span>
                        </div>
                    </div>

                    {/* 2. Manpower Needs */}
                    <div className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                        <h3 className="text-sm font-black text-gray-400 uppercase flex items-center gap-2 tracking-[0.2em]">
                            👥 人力需求
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                                <label className="text-[9px] text-gray-400 block mb-1 font-black uppercase">平日早 A</label>
                                <input 
                                    type="number" min="0" max="20"
                                    value={config.reqStandardA}
                                    onChange={(e) => setConfig({...config, reqStandardA: parseInt(e.target.value) || 0})}
                                    className="block w-full border-0 border-b border-gray-100 focus:ring-0 focus:border-indigo-500 p-1 text-center font-black text-gray-700 text-lg"
                                />
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                                <label className="text-[9px] text-gray-400 block mb-1 font-black uppercase">平日中 B</label>
                                <input 
                                    type="number" min="0" max="20"
                                    value={config.reqStandardB}
                                    onChange={(e) => setConfig({...config, reqStandardB: parseInt(e.target.value) || 0})}
                                    className="block w-full border-0 border-b border-gray-100 focus:ring-0 focus:border-indigo-500 p-1 text-center font-black text-gray-700 text-lg"
                                />
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                                <label className="text-[9px] text-gray-400 block mb-1 font-black uppercase">平日晚 C</label>
                                <input 
                                    type="number" min="0" max="20"
                                    value={config.reqStandardC}
                                    onChange={(e) => setConfig({...config, reqStandardC: parseInt(e.target.value) || 0})}
                                    className="block w-full border-0 border-b border-gray-100 focus:ring-0 focus:border-indigo-500 p-1 text-center font-black text-gray-700 text-lg"
                                />
                            </div>
                            <div className="bg-green-50 p-2 rounded-xl border border-green-100 shadow-sm">
                                <label className="text-[9px] text-green-600 block mb-1 font-black uppercase">週六早 A</label>
                                <input 
                                    type="number" min="0" max="20"
                                    value={config.reqSaturdayA}
                                    onChange={(e) => setConfig({...config, reqSaturdayA: parseInt(e.target.value) || 0})}
                                    className="block w-full border-0 border-b border-green-200 focus:ring-0 focus:border-green-500 p-1 text-center font-black text-green-700 text-lg bg-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Stats Overview */}
                    <div className="space-y-4 p-5 bg-indigo-600 rounded-2xl border border-indigo-700 text-white shadow-xl shadow-indigo-100">
                        <h3 className="text-sm font-black text-indigo-200 uppercase flex items-center gap-2 tracking-[0.2em]">
                            📊 統計概況
                        </h3>
                        {stats ? (
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-indigo-200 font-bold">總需求:</span>
                                    <span className="font-black text-lg">{stats.totalDemand}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-indigo-200 font-bold">總人力:</span>
                                    <span className="font-black text-lg">{stats.totalCapacity}</span>
                                </div>
                                <div className="flex justify-between items-center pt-3 border-t border-indigo-500/50">
                                    <span className="font-bold">{stats.totalCapacity > stats.totalDemand ? '休假盈餘' : '人力缺口'}:</span>
                                    <span className="font-black text-2xl">{Math.abs(stats.totalCapacity - stats.totalDemand)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-center py-6 text-indigo-300 italic font-bold">尚未產生排班</div>
                        )}
                    </div>

                    {/* 4. Core Actions */}
                    <div className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between">
                        <div>
                            <div className="mb-4">
                                <label className="text-[10px] text-gray-400 mb-1 block font-black uppercase tracking-wider">週四排班模式</label>
                                <select 
                                    value={config.thursdayMode}
                                    onChange={(e) => setConfig({...config, thursdayMode: e.target.value as any})}
                                    className="block w-full rounded-xl border-gray-200 py-3 px-4 text-sm font-bold text-gray-700 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm"
                                >
                                    <option value="Auto">✨ 自動偵測模式</option>
                                    {Object.entries(SCENARIO_DESCRIPTIONS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                onClick={onGenerate}
                                className="w-full bg-indigo-600 text-white px-4 py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-lg uppercase tracking-wider"
                            >
                                <Calculator className="w-6 h-6" />
                                開始自動排班
                            </button>
                        </div>
                        
                        <button 
                            onClick={onOpenClearModal}
                            className="w-full mt-4 text-red-400 hover:text-red-600 text-[10px] font-black uppercase flex items-center justify-center gap-1.5 py-2 transition-colors border border-dashed border-red-100 rounded-lg hover:border-red-200"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            重設目前月份班表
                        </button>
                    </div>
                </div>

                {/* Right Column: Staff Settings */}
                <div className="lg:col-span-4 flex flex-col">
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-col flex-1 shadow-sm">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Users className="w-5 h-5" /> 員工設定
                            </h3>
                            <button onClick={addStaff} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-black hover:bg-indigo-100 transition-colors">
                                + 新增員工
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto space-y-2.5 pr-1 custom-scrollbar max-h-[500px]">
                            {employees.map((emp, idx) => (
                                <div key={emp.id} className="flex items-center gap-3 bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 group transition-all hover:border-indigo-200 hover:bg-white hover:shadow-md">
                                    <button 
                                        onClick={() => removeStaff(idx)} 
                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                        title="刪除"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <input 
                                        className="flex-1 text-sm bg-transparent border-none focus:ring-0 p-0 font-bold text-gray-700" 
                                        value={emp.name} 
                                        onChange={(e) => updateStaffName(idx, e.target.value)}
                                        placeholder="員工姓名"
                                    />
                                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-gray-100 shadow-inner">
                                        <span className="text-[9px] text-gray-400 font-black uppercase">目標</span>
                                        <input 
                                            className="w-10 text-sm text-center border-none bg-transparent p-0 font-black text-indigo-600 focus:ring-0"
                                            placeholder={baseTarget.toString()}
                                            value={emp.customTarget ?? ''}
                                            onChange={(e) => updateStaffTarget(idx, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Controls;
