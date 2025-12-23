
import React, { useState } from 'react';
import { Calendar, Users, Calculator, ChevronDown, ChevronUp, Printer, Trash2, Eraser, MousePointer2, PenTool } from 'lucide-react';
import { SchedulingConfig, ThursdayScenario, Employee, ShiftSymbol, Tool } from '../types';
import { SCENARIO_DESCRIPTIONS, CELL_STYLES, TARGET_MULTIPLIER } from '../constants';
import { getMonthlySpecialHolidays } from '../services/scheduleGenerator';

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
  // 預設設為 false，讓畫面一進來是收納狀態，方便排班
  const [isOpen, setIsOpen] = useState(false); 
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
    <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50 print:hidden transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
        
        {/* Top Navigation Bar: Title + Toolbox + Global Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* 標題區域 */}
            <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h1 className="text-lg font-black text-gray-800 whitespace-nowrap tracking-tight">
                    ShiftFlow
                </h1>
            </div>

            {/* 編輯工具箱 (膠囊設計) */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 p-0.5 rounded-full shadow-inner">
                    
                    {/* 第一組：選取與橡皮擦 */}
                    <div className="flex items-center gap-0.5 pr-1.5 mr-1 border-r border-gray-300">
                        <button
                            onClick={() => setSelectedSymbol(null)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                                ${selectedSymbol === null 
                                    ? 'bg-indigo-600 text-white shadow-md scale-105' 
                                    : 'text-gray-400 hover:bg-gray-200'}
                            `}
                            title="選取模式"
                        >
                            <MousePointer2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setSelectedSymbol(selectedSymbol === 'eraser' ? null : 'eraser')}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                                ${selectedSymbol === 'eraser' 
                                    ? 'bg-red-500 text-white shadow-md scale-105' 
                                    : 'text-gray-400 hover:bg-gray-200'}
                            `}
                            title="橡皮擦"
                        >
                            <Eraser className="w-4 h-4" />
                        </button>
                    </div>

                    {/* 第二組：ABC 班別 (黑色字體) */}
                    <div className="flex items-center gap-1 pr-1.5 mr-1 border-r border-gray-300">
                        {shiftTools.map(s => (
                            <button
                                key={s}
                                onClick={() => setSelectedSymbol(selectedSymbol === s ? null : s)}
                                className={`w-8 h-8 rounded-full text-[11px] font-black flex items-center justify-center border transition-all
                                    ${selectedSymbol === s 
                                        ? 'border-indigo-600 bg-white text-indigo-700 ring-2 ring-indigo-500/10 scale-105 shadow-sm' 
                                        : 'border-transparent text-gray-900 hover:bg-white'}
                                `}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* 第三組：特殊假別 (色彩區分) */}
                    <div className="flex items-center gap-1 pr-1">
                        {symbols.map(s => (
                            <button
                                key={s}
                                onClick={() => setSelectedSymbol(selectedSymbol === s ? null : s)}
                                className={`w-8 h-8 rounded-full text-[10px] font-black flex items-center justify-center border transition-all
                                    ${selectedSymbol === s 
                                        ? 'ring-2 ring-indigo-400 scale-125 z-10 shadow-lg' 
                                        : 'hover:scale-105 border-transparent'}
                                    ${CELL_STYLES[s] || 'bg-white'}
                                `}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 功能按鈕區 */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 rounded-full border border-gray-200 shadow-sm"
                    >
                        <Printer className="w-4 h-4 text-gray-400" />
                        <span>列印</span>
                    </button>
                    <button 
                        onClick={() => setIsOpen(!isOpen)}
                        className={`p-1.5 rounded-full transition-all border ${isOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-600'}`}
                    >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>

        {/* 可摺疊的詳細設定區域 (保留您原本的所有重要功能佈局) */}
        {isOpen && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-4">
                
                {/* 1 & 2 & 3 設定區域 */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* 1. 日期與目標 (含年假日期) */}
                    <div className="space-y-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-600 uppercase flex items-center gap-2 tracking-wider">
                            📅 日期與目標
                        </h3>
                        <div className="flex gap-3">
                            <input 
                                type="number"
                                value={config.year}
                                onChange={(e) => setConfig({...config, year: parseInt(e.target.value) || 0})}
                                className="block w-full rounded-md border-gray-300 py-2 px-4 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <select 
                                value={config.month}
                                onChange={(e) => setConfig({...config, month: parseInt(e.target.value)})}
                                className="block w-full rounded-md border-gray-300 py-2 px-4 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {Array.from({length: 12}, (_, i) => (
                                    <option key={i} value={i}>{i + 1}月</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-xs text-gray-500">年假日期 (扣除目標):</label>
                            <div className="flex gap-2">
                                <input 
                                    type="date"
                                    value={config.yearHolidayStart || ''}
                                    onChange={(e) => setConfig({...config, yearHolidayStart: e.target.value})}
                                    className="block w-full rounded-md border-gray-300 py-2 px-3 text-sm"
                                />
                                <span className="text-gray-400 self-center">~</span>
                                <input 
                                    type="date"
                                    value={config.yearHolidayEnd || ''}
                                    onChange={(e) => setConfig({...config, yearHolidayEnd: e.target.value})}
                                    className="block w-full rounded-md border-gray-300 py-2 px-3 text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <input 
                                    type="checkbox"
                                    id="jan1WorkDay"
                                    checked={config.jan1WorkDay}
                                    onChange={(e) => setConfig({...config, jan1WorkDay: e.target.checked})}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <label htmlFor="jan1WorkDay" className="text-xs text-gray-600 cursor-pointer">
                                    1/1 元旦為工作日 (不休診)
                                </label>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center bg-white px-4 py-3 rounded border border-gray-200">
                            <span className="text-sm font-bold text-gray-500">個人目標</span>
                            <span className="font-black text-indigo-600 text-lg">{baseTarget} 節</span>
                        </div>
                    </div>

                    {/* 2. 人力需求設定 */}
                    <div className="space-y-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-600 uppercase flex items-center gap-2 tracking-wider">
                            👥 人力需求設定
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {['A', 'B', 'C'].map(shift => (
                                <div key={shift} className="bg-white p-2 rounded border border-gray-200">
                                    <label className="text-[10px] text-gray-400 block mb-1 font-bold uppercase">平日 {shift} 班</label>
                                    <input 
                                        type="number" min="0"
                                        value={(config as any)[`reqStandard${shift}`]}
                                        onChange={(e) => setConfig({...config, [`reqStandard${shift}`]: parseInt(e.target.value) || 0})}
                                        className="block w-full border-0 border-b border-gray-200 text-center font-bold text-gray-700"
                                    />
                                </div>
                            ))}
                            <div className="bg-green-50/50 p-2 rounded border border-gray-200">
                                <label className="text-[10px] text-green-700 block mb-1 font-bold uppercase">週六 A 班</label>
                                <input 
                                    type="number" min="0"
                                    value={config.reqSaturdayA}
                                    onChange={(e) => setConfig({...config, reqSaturdayA: parseInt(e.target.value) || 0})}
                                    className="block w-full border-0 border-b border-gray-200 text-center font-bold text-green-700 bg-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. 總覽數據 (統計) */}
                    <div className="p-5 bg-indigo-50 rounded-xl border border-indigo-100">
                        <h3 className="text-sm font-bold text-indigo-600 uppercase flex items-center gap-2 tracking-wider mb-4">
                            📊 統計概況
                        </h3>
                        {stats ? (
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between"><span className="text-gray-500">總需求:</span><span className="font-bold">{stats.totalDemand}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">總人力:</span><span className="font-bold">{stats.totalCapacity}</span></div>
                                <div className={`flex justify-between pt-2 border-t border-indigo-200 mt-2 font-black ${stats.totalCapacity >= stats.totalDemand ? 'text-green-600' : 'text-red-500'}`}>
                                    <span>{stats.totalCapacity >= stats.totalDemand ? '盈餘' : '缺口'}:</span>
                                    <span className="text-sm">{stats.totalCapacity - stats.totalDemand}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-2 italic">
                                    {activeScenario && `模式: ${SCENARIO_DESCRIPTIONS[activeScenario]}`}
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-center py-6 text-gray-400 italic">尚未排班</div>
                        )}
                    </div>

                    {/* 4. 設定與執行 (自動排班與清除按鈕) */}
                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-gray-600 uppercase mb-3 tracking-wider">⚙️ 設定與執行</h3>
                            <select 
                                value={config.thursdayMode}
                                onChange={(e) => setConfig({...config, thursdayMode: e.target.value as any})}
                                className="block w-full rounded-md border-gray-300 py-2 px-4 text-xs mb-4"
                            >
                                <option value="Auto">自動模式 (Auto)</option>
                                {Object.entries(SCENARIO_DESCRIPTIONS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <button 
                                onClick={onGenerate}
                                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
                            >
                                <Calculator className="w-5 h-5" />
                                開始自動排班
                            </button>
                        </div>
                        <button 
                            onClick={onOpenClearModal}
                            className="w-full mt-4 py-2 text-xs font-bold text-red-400 hover:text-red-600 border border-dashed border-red-200 rounded-lg"
                        >
                            <Trash2 className="w-4 h-4 inline mr-1" /> 重設資料
                        </button>
                    </div>
                </div>

                {/* 右側：員工設定 (名單) */}
                <div className="lg:col-span-4 flex flex-col">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col flex-1 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Users className="w-4 h-4" /> 員工設定
                            </h3>
                            <button onClick={addStaff} className="text-xs font-bold text-indigo-600 hover:underline">+ 新增</button>
                        </div>
                        <div className="overflow-y-auto space-y-2 pr-1 custom-scrollbar max-h-[400px]">
                            {employees.map((emp, idx) => (
                                <div key={emp.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                    <button onClick={() => removeStaff(idx)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                    <input 
                                        className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm font-bold text-gray-700" 
                                        value={emp.name} 
                                        onChange={(e) => updateStaffName(idx, e.target.value)}
                                    />
                                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100">
                                        <span className="text-[9px] text-gray-400 font-bold">目標</span>
                                        <input 
                                            className="w-8 text-xs text-center border-none bg-transparent p-0 font-black text-indigo-600 focus:ring-0"
                                            value={emp.customTarget ?? ''}
                                            placeholder={baseTarget.toString()}
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
