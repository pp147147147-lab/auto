
import { Employee, SchedulingConfig, ThursdayScenario, CellData, ShiftSymbol, ScheduleResult, ShiftType } from './types';
import { SYMBOL_DEDUCTIONS, WEEKDAYS } from './constants';

export const LUNAR_HOLIDAYS: Record<string, string> = {
    '2024-6-10': '端午節',
    '2025-5-31': '端午節',
    '2026-6-19': '端午節',
    '2027-6-9': '端午節',
    '2028-5-28': '端午節',
    '2029-6-16': '端午節',
    '2030-6-5': '端午節',

    '2024-9-17': '中秋節',
    '2025-10-6': '中秋節',
    '2026-9-25': '中秋節',
    '2027-9-15': '中秋節',
    '2028-10-3': '中秋節',
    '2029-9-22': '中秋節',
    '2030-9-12': '中秋節',
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const isYearHoliday = (year: number, month: number, day: number, startStr?: string, endStr?: string, jan1WorkDay: boolean = false): boolean => {
  if (month === 0 && day === 1 && !jan1WorkDay) return true;

  if (!startStr || !endStr) return false;
  
  const current = new Date(year, month, day);
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  current.setHours(0,0,0,0);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);

  return current.getTime() >= start.getTime() && current.getTime() <= end.getTime();
};

export const getSpecialHolidayName = (year: number, month: number, day: number, jan1WorkDay: boolean = false): string | null => {
    const m = month + 1;
    const dateStr = `${year}-${m}-${day}`;
    
    if (m === 1 && day === 1 && jan1WorkDay) return "元旦";
    
    if (m === 2 && day === 28) return "和平紀念日";
    if (m === 4 && day === 4) return "兒童節";
    if (m === 4 && day === 5) return "清明節";
    if (m === 5 && day === 1) return "勞動節";
    if (m === 9 && day === 28) return "教師節";
    if (m === 10 && day === 10) return "國慶日";
    if (m === 10 && day === 25) return "台灣光復節";
    if (m === 12 && day === 25) return "行憲紀念日";

    if (LUNAR_HOLIDAYS[dateStr]) return LUNAR_HOLIDAYS[dateStr];

    return null;
}

export const getMonthlySpecialHolidays = (year: number, month: number, jan1WorkDay: boolean = false): string[] => {
  const daysInMonth = getDaysInMonth(year, month);
  const holidays: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (month === 0 && d === 1 && !jan1WorkDay) {
        holidays.push(`${d}號 元旦 (休診)`);
        continue;
    }
    
    const name = getSpecialHolidayName(year, month, d, jan1WorkDay);
    if (name) {
      holidays.push(`${d}號 ${name}`);
    }
  }
  return holidays;
};

export const calculateBaseTarget = (year: number, month: number, holidayStart?: string, holidayEnd?: string, jan1WorkDay: boolean = false): number => {
  const daysInMonth = getDaysInMonth(year, month);
  let deductions = 0;
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (isWeekend) {
        deductions++;
    }

    if (isYearHoliday(year, month, d, holidayStart, holidayEnd, jan1WorkDay)) {
        if (!isWeekend) {
            deductions++;
        }
    }

    if (getSpecialHolidayName(year, month, d, jan1WorkDay) !== null) {
        deductions++;
    }
  }
  
  const calculatedDays = daysInMonth - deductions;
  return Math.max(0, calculatedDays * 2);
};

const getDeduction = (cellData: CellData): number => {
  if (Array.isArray(cellData)) return 0;
  return SYMBOL_DEDUCTIONS[cellData as ShiftSymbol] || 0;
};

const isABCShift = (cell: CellData | undefined): boolean => {
  return Array.isArray(cell) && cell.length === 3 && cell.includes('A') && cell.includes('B') && cell.includes('C');
};

export const recalculateEmployeeStats = (emp: Employee, targetYear: number, targetMonth: number): Employee => {
  let shiftCount = 0;
  let deduction = 0;
  
  Object.entries(emp.shifts).forEach(([dateKey, cell]) => {
    const parts = dateKey.split('-');
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);

    if (y === targetYear && m === targetMonth) {
      if (Array.isArray(cell)) {
        const workShifts = cell.filter(s => ['A', 'B', 'C'].includes(s));
        shiftCount += workShifts.length;
      } else {
        deduction += getDeduction(cell);
      }
    }
  });

  return {
    ...emp,
    generatedShiftCount: shiftCount,
    targetDeduction: deduction
  };
};

export const getDailyRequirements = (
  date: Date, 
  config: SchedulingConfig, 
  scenario: ThursdayScenario,
  useTuesdayReduction: boolean = false
) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dow = date.getDay();
  
  if (isYearHoliday(year, month, day, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) {
     return { A: 0, B: 0, C: 0, total: 0 };
  }

  if (dow === 0) { 
    return { A: 0, B: 0, C: 0, total: 0 };
  }
  
  if (dow === 6) { 
    return { A: config.reqSaturdayA, B: 0, C: 0, total: config.reqSaturdayA };
  }
  
  if (dow === 4) { 
    let reqA = 0, reqB = 0;
    switch (scenario) {
      case ThursdayScenario.A: reqA = 5; reqB = 5; break;
      case ThursdayScenario.B: reqA = 5; reqB = 4; break;
      case ThursdayScenario.C: reqA = 4; reqB = 4; break;
    }
    return { A: reqA, B: reqB, C: 0, total: reqA + reqB };
  }
  
  let stdB = config.reqStandardB;
  let stdC = config.reqStandardC;

  if (dow === 2 && useTuesdayReduction) {
      stdB = 4;
      stdC = 4;
  }

  return {
    A: config.reqStandardA,
    B: stdB,
    C: stdC,
    total: config.reqStandardA + stdB + stdC
  };
};

export const calculateOverviewStats = (
    config: SchedulingConfig, 
    employees: Employee[],
    activeScenario: ThursdayScenario,
    useTuesdayReduction: boolean
) => {
    const { year, month } = config;
    const daysInMonth = getDaysInMonth(year, month);
    const baseTarget = calculateBaseTarget(year, month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay);
    
    let totalDemand = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const req = getDailyRequirements(date, config, activeScenario, useTuesdayReduction);
        totalDemand += req.total;
    }

    let totalCapacity = 0;
    employees.forEach(e => {
        const effectiveTarget = (e.customTarget ?? baseTarget) - e.targetDeduction;
        totalCapacity += Math.max(0, effectiveTarget);
    });

    const surplus = totalCapacity - totalDemand;
    const suggestedSpecialLeaves = Math.max(0, Math.floor(surplus / 2));

    return {
        totalDemand,
        totalCapacity,
        suggestedSpecialLeaves
    };
};

export const validateSchedule = (
  employees: Employee[], 
  config: SchedulingConfig,
  activeScenario: ThursdayScenario,
  activeTuesdayReduction: boolean
): string[] => {
  const warnings: string[] = [];
  const daysInMonth = getDaysInMonth(config.year, config.month);
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(config.year, config.month, d);
    const dateKey = `${config.year}-${config.month}-${d}`;
    const req = getDailyRequirements(date, config, activeScenario, activeTuesdayReduction);
    
    let countA = 0, countB = 0, countC = 0;
    
    employees.forEach(emp => {
      const cell = emp.shifts[dateKey];
      if (Array.isArray(cell)) {
        if (cell.includes('A')) countA++;
        if (cell.includes('B')) countB++;
        if (cell.includes('C')) countC++;
      }
    });

    if (countA !== req.A) warnings.push(`${d}號 (週${WEEKDAYS[date.getDay()]}): A班 ${countA}人 (應為 ${req.A})`);
    if (countB !== req.B) warnings.push(`${d}號 (週${WEEKDAYS[date.getDay()]}): B班 ${countB}人 (應為 ${req.B})`);
    if (countC !== req.C) warnings.push(`${d}號 (週${WEEKDAYS[date.getDay()]}): C班 ${countC}人 (應為 ${req.C})`);
  }
  
  return warnings;
};

const solveStandardDay = (availableStaff: number, reqA: number, reqB: number, reqC: number) => {
  const possibleSolutions = [];
  const maxABC = Math.min(availableStaff, reqA, reqB, reqC);

  for (let k = 0; k <= maxABC; k++) {
    const numABC = k;
    const numBC = reqC - numABC; 
    
    if (numBC < 0) continue;
    
    const totalB = numABC + numBC;
    if (totalB !== reqB) continue;
    
    const numA = reqA - numABC;
    if (numA < 0) continue;

    const staffNeeded = numABC + numBC + numA;
    if (staffNeeded <= availableStaff) {
      possibleSolutions.push({ numABC, numBC, numA, staffNeeded });
    }
  }
  return possibleSolutions.sort((a, b) => b.staffNeeded - a.staffNeeded);
};

const solveThursday = (scenario: ThursdayScenario) => {
  switch (scenario) {
    case ThursdayScenario.A: return { numAB: 5, numA: 0, cost: 10 };
    case ThursdayScenario.B: return { numAB: 4, numA: 1, cost: 9 };
    case ThursdayScenario.C: return { numAB: 4, numA: 0, cost: 8 };
  }
};

const shuffle = <T>(array: T[]): T[] => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

const pickBestCandidates = (
  pool: Employee[], 
  countNeeded: number, 
  cost: number, 
  baseTarget: number,
  filterFn?: (e: Employee) => boolean
): Employee[] => {
  const eligible = filterFn ? pool.filter(filterFn) : pool;

  const withDeficit = eligible.map(e => {
    const target = (e.customTarget ?? baseTarget) - e.targetDeduction;
    const current = e.generatedShiftCount;
    const deficit = target - current;
    return { ...e, deficit };
  });

  const tier1 = withDeficit.filter(e => e.deficit >= cost);
  const tier2 = withDeficit.filter(e => e.deficit < cost);

  shuffle(tier1);
  shuffle(tier2);

  tier1.sort((a, b) => b.deficit - a.deficit);
  tier2.sort((a, b) => b.deficit - a.deficit);

  const sortedCandidates = [...tier1, ...tier2];

  return sortedCandidates.slice(0, countNeeded);
};

const applyShifts = (
    employees: Employee[], 
    candidates: Employee[], 
    dateKey: string, 
    shift: ShiftType[], 
    cost: number
) => {
    candidates.forEach(c => {
        const realEmp = employees.find(e => e.id === c.id);
        if (realEmp) {
            realEmp.shifts[dateKey] = shift;
            realEmp.generatedShiftCount += cost;
        }
    });
};

const calculateDayPriority = (
    d: number, 
    year: number, 
    month: number, 
    employees: Employee[], 
    config: SchedulingConfig, 
    scenario: ThursdayScenario, 
    useTueReduction: boolean
) => {
    const date = new Date(year, month, d);
    const dateKey = `${year}-${month}-${d}`;
    
    if (isYearHoliday(year, month, d, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) return 9999;
    if (date.getDay() === 0) return 9999;

    const available = employees.filter(e => !e.shifts[dateKey]).length;
    
    const req = getDailyRequirements(date, config, scenario, useTueReduction);
    const demand = req.total;

    return (available * 100) - demand;
}

const checkConsecutiveABC = (emp: Employee, year: number, month: number, d: number, force: boolean): boolean => {
    if (force) return true;

    const prev1 = emp.shifts[`${year}-${month}-${d-1}`];
    const prev2 = emp.shifts[`${year}-${month}-${d-2}`];
    const next1 = emp.shifts[`${year}-${month}-${d+1}`];
    const next2 = emp.shifts[`${year}-${month}-${d+2}`];

    if (isABCShift(prev1) && isABCShift(prev2)) return false;
    if (isABCShift(next1) && isABCShift(next2)) return false;
    if (isABCShift(prev1) && isABCShift(next1)) return false;

    return true;
};

export const generateSchedule = (config: SchedulingConfig, currentEmployees: Employee[]): ScheduleResult => {
  const { year, month, staffIds, thursdayMode } = config;
  const daysInMonth = getDaysInMonth(year, month);
  const baseTarget = calculateBaseTarget(year, month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay);
  let warnings: string[] = [];

  const employees: Employee[] = staffIds.map(id => {
    const existing = currentEmployees.find(e => e.id === id);
    return {
      id,
      name: existing ? existing.name : `員工 ${id}`,
      shifts: existing ? { ...existing.shifts } : {}, 
      manualEntries: existing ? { ...existing.manualEntries } : {},
      customTarget: existing?.customTarget,
      generatedShiftCount: 0,
      targetDeduction: 0,
    };
  });

  employees.forEach(e => {
    Object.keys(e.shifts).forEach(dateKey => {
      const [y, m] = dateKey.split('-').map(Number);
      if (y === year && m === month) {
         if (!e.manualEntries?.[dateKey]) {
             delete e.shifts[dateKey];
         }
      }
    });
    const cleanEmp = recalculateEmployeeStats(e, year, month);
    e.generatedShiftCount = cleanEmp.generatedShiftCount;
    e.targetDeduction = cleanEmp.targetDeduction;
  });

  let absTotalCapacity = 0;
  employees.forEach(e => {
      absTotalCapacity += Math.max(0, (e.customTarget ?? baseTarget) - e.targetDeduction);
  });

  let baseDemand = 0;
  let thursdayCount = 0;
  let tuesdayCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (isYearHoliday(year, month, d, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) continue; 
    const dow = date.getDay();
    if (dow === 0) continue; 
    
    if (dow === 6) baseDemand += config.reqSaturdayA;
    else if (dow === 4) { 
        thursdayCount++; 
        baseDemand += 10; 
    } 
    else {
        baseDemand += (config.reqStandardA + config.reqStandardB + config.reqStandardC);
        if (dow === 2) tuesdayCount++;
    }
  }

  let selectedScenario = ThursdayScenario.A;
  let useTuesdayReduction = false;
  
  if (thursdayMode === 'Auto') {
      const gap = baseDemand - absTotalCapacity;
      if (gap <= 0) {
          selectedScenario = ThursdayScenario.A;
      } else {
          const saveB = thursdayCount * 1;
          const saveC = thursdayCount * 2;
          if (gap <= saveB) selectedScenario = ThursdayScenario.B;
          else if (gap <= saveC) selectedScenario = ThursdayScenario.C;
          else {
              selectedScenario = ThursdayScenario.C;
              const remainingGap = gap - saveC;
              if (remainingGap > 0) useTuesdayReduction = true;
          }
      }
  } else {
      selectedScenario = thursdayMode;
  }
  
  const finalThuCost = selectedScenario === ThursdayScenario.A ? 10 : selectedScenario === ThursdayScenario.B ? 9 : 8;
  let finalTueCost = config.reqStandardA + config.reqStandardB + config.reqStandardC;
  if (useTuesdayReduction) {
      finalTueCost = config.reqStandardA + 4 + 4; 
  }
  const standardCost = config.reqStandardA + config.reqStandardB + config.reqStandardC;
  
  let finalTotalDemand = 0;
  for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      if (isYearHoliday(year, month, d, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) continue; 
      const dow = date.getDay();
      if (dow === 0) continue;
      
      if (dow === 6) finalTotalDemand += config.reqSaturdayA;
      else if (dow === 4) finalTotalDemand += finalThuCost;
      else if (dow === 2) finalTotalDemand += finalTueCost;
      else finalTotalDemand += standardCost;
  }

  const surplus = absTotalCapacity - finalTotalDemand;
  const suggestedSpecialLeaves = Math.max(0, Math.floor(surplus / 2)); 

  const daysToSchedule = [];
  for (let d = 1; d <= daysInMonth; d++) {
      const priority = calculateDayPriority(d, year, month, employees, config, selectedScenario, useTuesdayReduction);
      if (priority < 9000) {
          daysToSchedule.push({ day: d, priority });
      }
  }
  
  daysToSchedule.sort((a, b) => a.priority - b.priority);

  for (const { day } of daysToSchedule) {
    const date = new Date(year, month, day);
    const dow = date.getDay();
    const dateKey = `${year}-${month}-${day}`;
    
    const availableStaff = employees.filter(e => !e.shifts[dateKey]); 
    const staffPool = [...availableStaff];

    if (dow === 6) {
      const candidates = pickBestCandidates(staffPool, config.reqSaturdayA, 1, baseTarget);
      applyShifts(employees, candidates, dateKey, ['A'], 1);
    } 
    else if (dow === 4) {
      const { numAB, numA } = solveThursday(selectedScenario);
      let assignedForDay = new Set<string>();

      const candidatesAB = pickBestCandidates(staffPool, numAB, 2, baseTarget);
      applyShifts(employees, candidatesAB, dateKey, ['A', 'B'], 2);
      candidatesAB.forEach(c => assignedForDay.add(c.id));

      const poolForA = staffPool.filter(e => !assignedForDay.has(e.id));
      const candidatesA = pickBestCandidates(poolForA, numA, 1, baseTarget);
      applyShifts(employees, candidatesA, dateKey, ['A'], 1);
    } 
    else {
      let reqB = config.reqStandardB;
      let reqC = config.reqStandardC;
      
      if (dow === 2 && useTuesdayReduction) {
          reqB = 4; reqC = 4;
      }

      const isCriticalDay = staffPool.length <= 5; 

      const solutions = solveStandardDay(staffPool.length, config.reqStandardA, reqB, reqC);
      const bestSol = solutions.find(s => s.staffNeeded <= staffPool.length);
      
      if (bestSol) {
        const { numABC, numBC, numA } = bestSol;
        const assignedForDay = new Set<string>();
        
        const poolForABC = staffPool.filter(emp => {
           return checkConsecutiveABC(emp, year, month, day, isCriticalDay);
        });

        let candidatesABC = pickBestCandidates(poolForABC, numABC, 3, baseTarget);
        
        if (!isCriticalDay && numABC === 5 && candidatesABC.length === 5) {
            const candidate = candidatesABC[4];
            if (candidate && (candidate.deficit ?? 0) <= 0) candidatesABC.pop();
        }

        applyShifts(employees, candidatesABC, dateKey, ['A', 'B', 'C'], 3);
        candidatesABC.forEach(c => assignedForDay.add(c.id));

        const poolForBC = staffPool.filter(e => !assignedForDay.has(e.id));
        let candidatesBC = pickBestCandidates(poolForBC, numBC, 2, baseTarget);
        
        if (!isCriticalDay && numBC === 5 && candidatesBC.length === 5) {
            const candidate = candidatesBC[4];
            if (candidate && (candidate.deficit ?? 0) <= 0) candidatesBC.pop();
        }

        applyShifts(employees, candidatesBC, dateKey, ['B', 'C'], 2);
        candidatesBC.forEach(c => assignedForDay.add(c.id));

        const poolForA = staffPool.filter(e => !assignedForDay.has(e.id));
        const candidatesA = pickBestCandidates(poolForA, numA, 1, baseTarget);
        applyShifts(employees, candidatesA, dateKey, ['A'], 1);
      }
    }
  }
  
  employees.forEach(e => {
      const stats = recalculateEmployeeStats(e, year, month);
      e.generatedShiftCount = stats.generatedShiftCount;
      e.targetDeduction = stats.targetDeduction;
  });
  
  warnings = validateSchedule(employees, config, selectedScenario, useTuesdayReduction);

  return {
    employees,
    warnings,
    stats: {
      totalDemand: finalTotalDemand,
      totalCapacity: absTotalCapacity,
      suggestedSpecialLeaves
    },
    usedThursdayScenario: selectedScenario,
    usedTuesdayReduction: useTuesdayReduction
  };
};
