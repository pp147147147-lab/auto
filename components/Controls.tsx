
import React, { useState } from 'react';
import { Settings, Calendar, Users, Calculator, ChevronDown, ChevronUp, Printer, Trash2, PenTool, Eraser, RotateCcw, MousePointer2 } from 'lucide-react';
import { SchedulingConfig, ThursdayScenario, Employee, ShiftSymbol, Tool, ShiftType } from '../types';
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

  // 'X' is now considered a shift tool for positional placement
  const shiftTools: string[] = ['A', 'B', 'C', 'X'];
  const symbols: ShiftSymbol[] = ['O', '特', '婚', '產', '年', '喪'];

  return (
    <div className="bg-white border-b border-gray-200 shadow-md transition-all duration-300 print:hidden relative z-50">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6">
        
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <Calendar className="w-8 h-8 text-indigo-600" />
                排班小幫手 ShiftFlow
            </h1>
            <div className="flex gap-4">
                 <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 text-base font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    title="列印 / 匯出 PDF"
                >
                    <Printer className="w-5 h-5" />
                    <span>列印/PDF</span>
                </button>
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    {isOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </button>
            </div>
        </div>

        {isOpen && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-top-4">
            
            {/* Left Column: Settings */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Date & Target */}
                <div className="space-y-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="text-base font-bold text-gray-600 uppercase flex items-center gap-2 tracking-wider">
                        📅 日期與目標
                    </h3>
                    <div className="flex gap-3">
                        <div className="relative w-full">
                            <input 
                                type="number"
                                value={config.year}
                                onChange={(e) => setConfig({...config, year: parseInt(e.target.value) || 0})}
                                className="block w-full rounded-md border-gray-300 py-2.5 px-4 text-base focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="年份"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">年</span>
                        </div>
                        <select 
                            value={config.month}
                            onChange={(e) => setConfig({...config, month: parseInt(e.target.value)})}
                            className="block w-full rounded-md border-gray-300 py-2.5 px-4 text-base focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {Array.from({length: 12}, (_, i) => (
                                <option key={i} value={i}>{i + 1}月</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Year Holiday Range Inputs */}
                    <div className="space-y-2">
                        <label className="text-sm text-gray-500">年假日期 (扣除目標):</label>
                        <div className="flex gap-2">
                             <input 
                                type="date"
                                value={config.yearHolidayStart || ''}
                                onChange={(e) => setConfig({...config, yearHolidayStart: e.target.value})}
                                className="block w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <span className="text-gray-400 self-center">~</span>
                            <input 
                                type="date"
                                value={config.yearHolidayEnd || ''}
                                onChange={(e) => setConfig({...config, yearHolidayEnd: e.target.value})}
                                className="block w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        {/* New Checkbox for Jan 1 */}
                        <div className="flex items-center gap-2 mt-2">
                            <input 
                                type="checkbox"
                                id="jan1WorkDay"
                                checked={config.jan1WorkDay}
                                onChange={(e) => setConfig({...config, jan1WorkDay: e.target.checked})}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <label htmlFor="jan1WorkDay" className="text-sm text-gray-600 select-none cursor-pointer">
                                1/1 元旦為工作日 (不休診)
                            </label>
                        </div>
                    </div>
                    
                    <div className="text-base space-y-2 text-gray-600">
                        <div className="flex justify-between items-center bg-white px-4 py-3 rounded border border-gray-200">
                            <span>個人目標</span>
                            <span className="font-bold text-indigo-600 text-lg">{baseTarget} 節</span>
                        </div>
                         <div className="flex justify-between text-xs text-gray-400 px-1">
                            <span>公式:</span>
                            <span>(天-六日-年假-特殊)*{TARGET_MULTIPLIER}</span>
                        </div>
                    </div>
                    
                    {/* Special Holidays List */}
                     {monthlyHolidays.length > 0 && (
                        <div className="mt-2 bg-purple-50 p-3 rounded border border-purple-100">
                             <span className="text-xs text-purple-600 font-bold block mb-1">本月特殊節日 (扣目標):</span>
                             <div className="flex flex-wrap gap-2">
                                {monthlyHolidays.map((h, i) => (
                                    <span key={i} className="text-xs bg-white border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                                        {h}
                                    </span>
                                ))}
                             </div>
                        </div>
                    )}
                </div>

                {/* 2. Manpower Settings (New) */}
                <div className="space-y-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="text-base font-bold text-gray-600 uppercase flex items-center gap-2 tracking-wider">
                        👥 人力需求設定
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-2 rounded border border-gray-200">
                            <label className="text-xs text-gray-500 block mb-1 font-bold">平日早班 (A)</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="0" max="20"
                                    value={config.reqStandardA}
                                    onChange={(e) => setConfig({...config, reqStandardA: parseInt(e.target.value) || 0})}
                                    className="block w-full border-0 border-b border-gray-200 focus:ring-0 focus:border-indigo-500 p-1 text-center font-bold text-gray-700"
                                />
                                <span className="text-xs text-gray-400">人</span>
                            </div>
                        </div>
                        <div className="bg-white p-2 rounded border border-gray-200">
                            <label className="text-xs text-gray-500 block mb-1 font-bold">平日午班 (B)</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="0" max="20"
                                    value={config.reqStandardB}
                                    onChange={(e) => setConfig({...config, reqStandardB: parseInt(e.target.value) || 0})}
                                    className="block w-full border-0 border-b border-gray-200 focus:ring-0 focus:border-indigo-500 p-1 text-center font-bold text-gray-700"
                                />
                                <span className="text-xs text-gray-400">人</span>
                            </div>
                        </div>
                         <div className="bg-white p-2 rounded border border-gray-200">
                            <label className="text-xs text-gray-500 block mb-1 font-bold">平日晚班 (C)</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="0" max="20"
                                    value={config.reqStandardC}
                                    onChange={(e) => setConfig({...config, reqStandardC: parseInt(e.target.value) || 0})}
                                    className="block w-full border-0 border-b border-gray-200 focus:ring-0 focus:border-indigo-500 p-1 text-center font-bold text-gray-700"
                                />
                                <span className="text-xs text-gray-400">人</span>
                            </div>
                        </div>
                        <div className="bg-white p-2 rounded border border-gray-200 bg-green-50/50">
                            <label className="text-xs text-green-700 block mb-1 font-bold">週六早班 (A)</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="0" max="20"
                                    value={config.reqSaturdayA}
                                    onChange={(e) => setConfig({...config, reqSaturdayA: parseInt(e.target.value) || 0})}
                                    className="block w-full border-0 border-b border-gray-200 focus:ring-0 focus:border-indigo-500 p-1 text-center font-bold text-gray-700 bg-transparent"
                                />
                                <span className="text-xs text-gray-400">人</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Stats Dashboard */}
                <div className="space-y-4 p-5 bg-indigo-50 rounded-xl border border-indigo-100">
                    <h3 className="text-base font-bold text-indigo-600 uppercase flex items-center gap-2 tracking-wider">
                        📊 總覽數據
                    </h3>
                    {stats ? (
                        <div className="space-y-3 text-sm">
                             <div className="flex justify-between">
                                <span className="text-gray-600">總需求:</span>
                                <span className="font-bold text-gray-900 text-base">{stats.totalDemand}</span>
                             </div>
                             <div className="flex justify-between">
                                <span className="text-gray-600">總人力:</span>
                                <span className="font-bold text-gray-900 text-base">{stats.totalCapacity}</span>
                             </div>
                             <div className={`flex justify-between pt-3 border-t border-indigo-200 ${stats.totalCapacity > stats.totalDemand ? 'text-green-600' : 'text-red-500'}`}>
                                <div className="flex flex-col">
                                    <span className="font-medium">{stats.totalCapacity > stats.totalDemand ? '過剩 (可用特休)' : '不足 (需加班)'}:</span>
                                    {stats.totalCapacity > stats.totalDemand && (
                                        <span className="text-xs font-normal opacity-80">(建議約 {stats.suggestedSpecialLeaves} 人排休)</span>
                                    )}
                                </div>
                                <span className="font-bold text-lg">{stats.totalCapacity - stats.totalDemand}</span>
                             </div>
                             
                             <div className="flex flex-col gap-2 mt-3">
                                 {usedTuesdayReduction && (
                                     <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-1 rounded text-center font-bold">
                                         週二減員模式 (ON)
                                     </span>
                                 )}
                                 <span className="inline-block bg-white text-indigo-700 border border-indigo-200 text-xs px-2 py-1 rounded text-center font-medium">
                                     {activeScenario ? SCENARIO_DESCRIPTIONS[activeScenario] : '尚未排班'}
                                 </span>
                             </div>
                        </div>
                    ) : (
                        <div className="text-sm text-center py-6 text-gray-400 italic">請執行排班以查看數據</div>
                    )}
                </div>

                {/* 4. Actions & Thursday */}
                <div className="space-y-4 p-5 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-between">
                    <div>
                        <h3 className="text-base font-bold text-gray-600 uppercase flex items-center gap-2 tracking-wider mb-3">
                            ⚙️ 設定與執行
                        </h3>
                        
                        <div className="mb-4">
                            <label className="text-xs text-gray-500 mb-1 block">週四排班模式</label>
                            <select 
                                value={config.thursdayMode}
                                onChange={(e) => setConfig({...config, thursdayMode: e.target.value as any})}
                                className="block w-full rounded-md border-gray-300 py-2.5 px-4 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="Auto">自動 (Auto)</option>
                                {Object.entries(SCENARIO_DESCRIPTIONS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <button 
                            onClick={onGenerate}
                            className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-sm hover:bg-indigo-700 font-bold flex items-center justify-center gap-2 text-base transition-all transform active:scale-95"
                        >
                            <Calculator className="w-5 h-5" />
                            開始自動排班
                        </button>
                    </div>
                    
                    <button 
                        onClick={onOpenClearModal}
                        className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-lg shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 font-medium flex items-center justify-center gap-2 text-base transition-all"
                        title="管理資料 / 清除"
                    >
                        <Trash2 className="w-5 h-5" />
                        清除 / 管理資料
                    </button>
                </div>
            </div>

            {/* Right Column: Tools & Staff */}
            <div className="lg:col-span-4 grid grid-rows-[auto_1fr] gap-6">
                
                {/* Symbol Picker */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                     <h3 className="text-base font-bold text-gray-600 uppercase flex items-center gap-2 tracking-wider mb-4">
                        <PenTool className="w-5 h-5" /> 編輯工具箱
                    </h3>
                    
                    <div className="space-y-5">
                        {/* Shifts */}
                        <div>
                            <span className="text-xs text-gray-400 mb-2 block">編輯工具</span>
                            <div className="flex gap-2">
                                {/* Pointer Tool */}
                                <button
                                    onClick={() => setSelectedSymbol(null)}
                                    className={`w-12 h-12 rounded-lg text-lg font-bold flex items-center justify-center border transition-all shadow-sm
                                        ${selectedSymbol === null 
                                            ? 'ring-2 ring-indigo-500 ring-offset-1 z-10 bg-indigo-50 border-indigo-500 text-indigo-700' 
                                            : 'hover:scale-105 hover:border-gray-400 bg-white border-gray-200 text-gray-700'}
                                    `}
                                    title="選取 / 點擊切換班別 (A+B)"
                                >
                                    <MousePointer2 className="w-6 h-6" />
                                </button>
                                <div className="w-px bg-gray-300 mx-1 h-12"></div>

                                {shiftTools.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSelectedSymbol(selectedSymbol === s ? null : s)}
                                        className={`w-12 h-12 rounded-lg text-lg font-bold flex items-center justify-center border transition-all shadow-sm
                                            ${selectedSymbol === s 
                                                ? 'ring-2 ring-indigo-500 ring-offset-1 z-10 bg-indigo-50 border-indigo-500 text-indigo-700' 
                                                : 'hover:scale-105 hover:border-gray-400 bg-white border-gray-200 text-gray-700'}
                                        `}
                                    >
                                        {s}
                                    </button>
                                ))}
                                <div className="w-px bg-gray-300 mx-1 h-12"></div>
                                <button
                                    onClick={() => setSelectedSymbol(selectedSymbol === 'eraser' ? null : 'eraser')}
                                    className={`w-12 h-12 rounded-lg text-sm flex items-center justify-center border transition-all shadow-sm
                                        ${selectedSymbol === 'eraser' 
                                            ? 'ring-2 ring-red-500 ring-offset-1 bg-red-50 border-red-500 text-red-600' 
                                            : 'hover:bg-gray-100 bg-white border-gray-200 text-gray-500'}
                                    `}
                                    title="橡皮擦 (清除單格)"
                                >
                                    <Eraser className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Special Symbols */}
                        <div>
                            <span className="text-xs text-gray-400 mb-2 block">特殊假別 (影響目標)</span>
                            <div className="flex flex-wrap gap-2">
                                {symbols.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSelectedSymbol(selectedSymbol === s ? null : s)}
                                        className={`w-10 h-10 rounded-lg text-sm font-bold flex items-center justify-center border transition-all shadow-sm
                                            ${selectedSymbol === s 
                                                ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110 z-10' 
                                                : 'hover:scale-105 hover:border-gray-400'}
                                            ${CELL_STYLES[s] || 'bg-white'}
                                        `}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-5 pt-3 border-t border-gray-200 text-sm text-gray-600 flex items-center gap-2">
                        <PenTool className="w-4 h-4" />
                        <span className="font-medium">目前工具：</span>
                        <span className="text-indigo-600 font-bold text-base">
                            {selectedSymbol === 'eraser' 
                                ? "橡皮擦" 
                                : selectedSymbol 
                                    ? selectedSymbol
                                    : "選取 (點擊切換)"}
                        </span>
                    </div>
                </div>

                {/* Staff List */}
                 <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 flex flex-col max-h-[350px]">
                     <div className="flex justify-between items-center mb-3">
                        <h3 className="text-base font-bold text-gray-600 uppercase flex items-center gap-2 tracking-wider">
                            <Users className="w-5 h-5" /> 員工設定
                        </h3>
                        <button onClick={addStaff} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline px-2 py-1 rounded hover:bg-indigo-50 transition-colors">
                            + 新增員工
                        </button>
                     </div>
                     
                     <div className="overflow-y-auto flex-1 space-y-3 pr-1 custom-scrollbar">
                        {employees.map((emp, idx) => {
                            return (
                                <div key={emp.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm group hover:border-indigo-300 transition-colors">
                                    <button 
                                        onClick={() => removeStaff(idx)} 
                                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                        title="刪除員工"
                                    >
                                        ×
                                    </button>
                                    <input 
                                        className="flex-1 text-base border-0 border-b border-transparent focus:border-indigo-300 focus:ring-0 p-0 font-medium text-gray-700 bg-transparent" 
                                        value={emp.name} 
                                        onChange={(e) => updateStaffName(idx, e.target.value)}
                                        placeholder="員工姓名"
                                    />
                                    <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold">目標</span>
                                        <input 
                                            className="w-12 text-sm text-center border-none bg-transparent p-0 font-bold text-indigo-600 focus:ring-0 placeholder-gray-300"
                                            placeholder={baseTarget.toString()}
                                            value={emp.customTarget ?? ''}
                                            onChange={(e) => updateStaffTarget(idx, e.target.value)}
                                        />
                                    </div>
                                </div>
                            );
                        })}
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