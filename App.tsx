
import React, { useState, useEffect } from 'react';
import Controls from './components/Controls';
import RosterTable from './components/RosterTable';
import ClearModal from './components/ClearModal';
import { SchedulingConfig, Employee, ThursdayScenario, Tool, ShiftType, ShiftSymbol, BackupData } from './types';
import { generateSchedule, calculateBaseTarget, validateSchedule, recalculateEmployeeStats, calculateOverviewStats } from './services/scheduleGenerator';
import { AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'shiftflow_data_v1';

const App: React.FC = () => {
  const today = new Date();
  
  // -- State --
  // Initialize with 8 employees by default as requested
  const [employees, setEmployees] = useState<Employee[]>(
    Array.from({ length: 8 }).map((_, idx) => ({
      id: (idx + 1).toString(),
      name: `員工 ${idx + 1}`,
      shifts: {},
      manualEntries: {},
      generatedShiftCount: 0,
      targetDeduction: 0
    }))
  );

  const [config, setConfig] = useState<SchedulingConfig>({
    year: today.getFullYear(),
    month: today.getMonth(),
    staffIds: Array.from({ length: 8 }).map((_, idx) => (idx + 1).toString()),
    
    reqStandardA: 5,
    reqStandardB: 5,
    reqStandardC: 5,
    reqSaturdayA: 5,
    thursdayMode: 'Auto',
    yearHolidayStart: '', 
    yearHolidayEnd: '',
    jan1WorkDay: false
  });

  const [warnings, setWarnings] = useState<string[]>([]);
  const [baseTarget, setBaseTarget] = useState(0);
  const [stats, setStats] = useState<{totalDemand: number, totalCapacity: number, suggestedSpecialLeaves: number} | undefined>(undefined);
  const [activeThursdayScenario, setActiveThursdayScenario] = useState<ThursdayScenario>(ThursdayScenario.A);
  const [usedTuesdayReduction, setUsedTuesdayReduction] = useState(false);
  
  const [selectedSymbol, setSelectedSymbol] = useState<Tool>(null);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [gridKey, setGridKey] = useState(0);

  // -- Persistence --
  useEffect(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              if (parsed.config) {
                 const loadedConfig = parsed.config;
                 // Migration checks
                 if (loadedConfig.yearHolidayCount !== undefined) delete loadedConfig.yearHolidayCount;
                 if (loadedConfig.jan1WorkDay === undefined) loadedConfig.jan1WorkDay = false;
                 setConfig(loadedConfig);
              }
              if (parsed.employees) {
                  const loadedEmployees = parsed.employees.map((e: any) => ({
                      ...e,
                      manualEntries: e.manualEntries || {}
                  }));
                  setEmployees(loadedEmployees);
              }
              if (parsed.stats) setStats(parsed.stats);
              // Ensure type safety for enum from JSON
              if (parsed.activeThursdayScenario) setActiveThursdayScenario(parsed.activeThursdayScenario as ThursdayScenario);
              if (parsed.usedTuesdayReduction) setUsedTuesdayReduction(parsed.usedTuesdayReduction);
          } catch (e) {
              console.error("Failed to load saved data", e);
          }
      }
  }, []);

  useEffect(() => {
      const data = { config, employees, stats, activeThursdayScenario, usedTuesdayReduction };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [config, employees, stats, activeThursdayScenario, usedTuesdayReduction]);


  // -- Effects --
  useEffect(() => {
     setBaseTarget(calculateBaseTarget(config.year, config.month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay));

     const updatedEmployees = employees.map(emp => recalculateEmployeeStats(emp, config.year, config.month));
     setEmployees(updatedEmployees);

     const newStats = calculateOverviewStats(config, updatedEmployees, activeThursdayScenario, usedTuesdayReduction);
     setStats(newStats);

  }, [config.year, config.month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay, config.reqStandardA, config.reqStandardB, config.reqStandardC, config.reqSaturdayA]);

  useEffect(() => {
    const newWarnings = validateSchedule(employees, config, activeThursdayScenario, usedTuesdayReduction);
    setWarnings(newWarnings);
  }, [employees, config, activeThursdayScenario, usedTuesdayReduction]);

  // -- Handlers --

  const handleGenerate = () => {
    const result = generateSchedule(config, employees);
    
    setEmployees(result.employees);
    setWarnings(result.warnings);
    setStats(result.stats);
    setActiveThursdayScenario(result.usedThursdayScenario);
    setUsedTuesdayReduction(result.usedTuesdayReduction);
    setGridKey(prev => prev + 1);
  };

  const handleClear = (mode: 'generated' | 'all') => {
      const prefix = `${config.year}-${config.month}-`;
      
      const newEmployees = employees.map(emp => {
          const newShifts = { ...emp.shifts };
          const newManualEntries = { ...(emp.manualEntries || {}) };
          
          Object.keys(newShifts).forEach(key => {
              if (!key.startsWith(prefix)) return;
              
              const cellValue = newShifts[key];
              const isManual = newManualEntries[key];
              
              if (mode === 'all') {
                  delete newShifts[key];
                  delete newManualEntries[key];
              } else if (mode === 'generated') {
                  // Only delete if it's an array (shifts) AND NOT marked as manual
                  // This ensures manually entered A/B/C shifts (which have isManual=true) are PRESERVED
                  if (Array.isArray(cellValue) && !isManual) {
                      delete newShifts[key];
                  }
              }
          });
          
          return recalculateEmployeeStats({
              ...emp,
              shifts: newShifts,
              manualEntries: newManualEntries
          }, config.year, config.month);
      });
      
      setEmployees(newEmployees);
      setIsClearModalOpen(false);
      setGridKey(prev => prev + 1);
      
      if (mode === 'all') {
          const emptyStats = calculateOverviewStats(config, newEmployees, ThursdayScenario.A, false);
          setStats(emptyStats);
          setActiveThursdayScenario(ThursdayScenario.A);
          setUsedTuesdayReduction(false);
      }
  };

  const handleImport = (data: BackupData) => {
      if (confirm('匯入將會覆蓋目前的排班資料，確定要繼續嗎？')) {
          if (data.config) {
             const loadedConfig = data.config;
             if (loadedConfig.jan1WorkDay === undefined) loadedConfig.jan1WorkDay = false;
             setConfig(loadedConfig);
          }
          
          if (data.employees) {
             // Ensure manualEntries object exists even if missing in old files
             const safeEmployees = data.employees.map((e: any) => ({
                 ...e,
                 manualEntries: e.manualEntries || {}
             }));
             setEmployees(safeEmployees); 
          }
          
          if (data.stats) setStats(data.stats);
          if (data.activeThursdayScenario) setActiveThursdayScenario(data.activeThursdayScenario);
          if (data.usedTuesdayReduction !== undefined) setUsedTuesdayReduction(data.usedTuesdayReduction);
          
          setGridKey(prev => prev + 1); // Force redraw
      }
  };

  const handleCellClick = (empIndex: number, day: number, shiftClicked?: ShiftType) => {
      const dateKey = `${config.year}-${config.month}-${day}`;
      const newEmployees = [...employees];
      const emp = newEmployees[empIndex];
      const newShifts = { ...emp.shifts };
      const newManualEntries = { ...(emp.manualEntries || {}) };
      
      const currentVal = newShifts[dateKey];

      if (selectedSymbol === 'eraser') {
          if (Array.isArray(currentVal) && shiftClicked) {
              const newVal = currentVal.filter(s => {
                  if (shiftClicked === 'A') return s !== 'A' && s !== 'Xa';
                  if (shiftClicked === 'B') return s !== 'B' && s !== 'Xb';
                  if (shiftClicked === 'C') return s !== 'C' && s !== 'Xc';
                  return s !== shiftClicked;
              });
              
              if (newVal.length === 0) {
                  delete newShifts[dateKey];
                  delete newManualEntries[dateKey];
              } else {
                  newShifts[dateKey] = newVal;
                  newManualEntries[dateKey] = true;
              }
          } else {
              delete newShifts[dateKey];
              delete newManualEntries[dateKey];
          }
      } 
      else if (selectedSymbol && !['A', 'B', 'C', 'X'].includes(selectedSymbol)) {
          // Cast selectedSymbol to ShiftSymbol explicitly
          newShifts[dateKey] = selectedSymbol as ShiftSymbol;
          newManualEntries[dateKey] = true;
      }
      else {
          let targetShift: string | undefined = selectedSymbol ? selectedSymbol : shiftClicked;

          if (targetShift === 'X') {
              if (shiftClicked === 'A') targetShift = 'Xa';
              else if (shiftClicked === 'B') targetShift = 'Xb';
              else if (shiftClicked === 'C') targetShift = 'Xc';
          }
          
          const validShifts: string[] = ['A', 'B', 'C', 'Xa', 'Xb', 'Xc'];

          if (targetShift && validShifts.includes(targetShift)) {
              const finalShift = targetShift as ShiftType;
              let currentArr: ShiftType[] = [];
              if (Array.isArray(currentVal)) {
                  currentArr = [...currentVal];
              }

              if (currentArr.includes(finalShift)) {
                  currentArr = currentArr.filter(s => s !== finalShift);
              } else {
                  currentArr.push(finalShift);
                  if (finalShift === 'Xa') currentArr = currentArr.filter(s => s !== 'A');
                  if (finalShift === 'A') currentArr = currentArr.filter(s => s !== 'Xa');
                  if (finalShift === 'Xb') currentArr = currentArr.filter(s => s !== 'B');
                  if (finalShift === 'B') currentArr = currentArr.filter(s => s !== 'Xb');
                  if (finalShift === 'Xc') currentArr = currentArr.filter(s => s !== 'C');
                  if (finalShift === 'C') currentArr = currentArr.filter(s => s !== 'Xc');

                  const sortOrder: Record<string, number> = { 'A':1, 'Xa':1, 'B':2, 'Xb':2, 'C':3, 'Xc':3 };
                  currentArr.sort((a, b) => (sortOrder[a] || 99) - (sortOrder[b] || 99));
              }

              if (currentArr.length === 0) {
                  delete newShifts[dateKey];
                  delete newManualEntries[dateKey];
              } else {
                  newShifts[dateKey] = currentArr;
                  newManualEntries[dateKey] = true;
              }
          }
      }
      
      emp.shifts = newShifts;
      emp.manualEntries = newManualEntries;
      
      newEmployees[empIndex] = recalculateEmployeeStats(emp, config.year, config.month);
      setEmployees(newEmployees);

      const newStats = calculateOverviewStats(config, newEmployees, activeThursdayScenario, usedTuesdayReduction);
      setStats(newStats);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans print:bg-white print:h-auto print:block print:overflow-visible">
      <Controls 
        config={config} 
        setConfig={setConfig} 
        employees={employees}
        setEmployees={setEmployees}
        onGenerate={handleGenerate}
        baseTarget={baseTarget}
        stats={stats}
        selectedSymbol={selectedSymbol}
        setSelectedSymbol={setSelectedSymbol}
        onOpenClearModal={() => setIsClearModalOpen(true)}
        activeScenario={activeThursdayScenario}
        usedTuesdayReduction={usedTuesdayReduction}
        onImport={handleImport}
      />
      
      <ClearModal 
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClear}
        monthLabel={`${config.year}年${config.month + 1}月`}
      />
      
      {warnings.length > 0 && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 flex-shrink-0 print:hidden">
            <div className="flex items-start gap-2 max-w-7xl mx-auto">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700 max-h-20 overflow-y-auto w-full">
                    <p className="font-semibold">排班警告 ({warnings.length})：</p>
                    <ul className="list-disc pl-4 space-y-1">
                        {warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                        {warnings.length > 3 && <li>...以及其他 {warnings.length - 3} 個問題。</li>}
                    </ul>
                </div>
            </div>
          </div>
      )}

      <RosterTable 
        key={gridKey}
        year={config.year}
        month={config.month}
        employees={employees}
        baseTarget={baseTarget}
        onCellClick={handleCellClick}
        selectedSymbol={selectedSymbol}
        config={config}
        activeScenario={activeThursdayScenario}
        usedTuesdayReduction={usedTuesdayReduction}
      />
    </div>
  );
};

export default App;
