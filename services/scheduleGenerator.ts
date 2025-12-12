
import { Employee, SchedulingConfig, ThursdayScenario, CellData, ShiftSymbol, ScheduleResult, ShiftType } from '../types';
import { SYMBOL_DEDUCTIONS, WEEKDAYS } from '../constants';

// --- Holidays & Constants ---

export const LUNAR_HOLIDAYS: Record<string, string> = {
    // Dragon Boat Festival (5/5 Lunar)
    '2024-6-10': '端午節',
    '2025-5-31': '端午節',
    '2026-6-19': '端午節',
    '2027-6-9': '端午節',
    '2028-5-28': '端午節',
    '2029-6-16': '端午節',
    '2030-6-5': '端午節',

    // Mid-Autumn Festival (8/15 Lunar)
    '2024-9-17': '中秋節',
    '2025-10-6': '中秋節',
    '2026-9-25': '中秋節',
    '2027-9-15': '中秋節',
    '2028-10-3': '中秋節',
    '2029-9-22': '中秋節',
    '2030-9-12': '中秋節',
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

// Helper to check if a specific date is a "Year Holiday" based on config range
// NOW INCLUDES 1/1 as a fixed Full Holiday (Optionally configurable)
const isYearHoliday = (year: number, month: number, day: number, startStr?: string, endStr?: string, jan1WorkDay: boolean = false): boolean => {
  // Jan 1st Logic:
  // If jan1WorkDay is FALSE (default), then 1/1 is a holiday (No Work).
  // If jan1WorkDay is TRUE, then 1/1 is a working day (treated as Special Holiday below), so return false here.
  if (month === 0 && day === 1 && !jan1WorkDay) return true;

  if (!startStr || !endStr) return false;
  
  const current = new Date(year, month, day);
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  // Normalize time to compare dates only
  current.setHours(0,0,0,0);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);

  return current.getTime() >= start.getTime() && current.getTime() <= end.getTime();
};

// Helper to define "Work Day Holidays" (Normal attendance but target reduced)
// Returns the name of the holiday if it is one, otherwise null
export const getSpecialHolidayName = (year: number, month: number, day: number, jan1WorkDay: boolean = false): string | null => {
    // Month is 0-indexed
    const m = month + 1;
    const dateStr = `${year}-${m}-${day}`;
    
    // Fixed Holidays
    // If 1/1 is set to Work Day, it appears here to reduce target.
    if (m === 1 && day === 1 && jan1WorkDay) return "元旦";
    
    if (m === 2 && day === 28) return "和平紀念日";
    if (m === 4 && day === 4) return "兒童節";
    if (m === 4 && day === 5) return "清明節";
    if (m === 5 && day === 1) return "勞動節";
    if (m === 9 && day === 28) return "教師節";
    if (m === 10 && day === 10) return "國慶日";
    if (m === 10 && day === 25) return "台灣光復節";
    if (m === 12 && day === 25) return "行憲紀念日";

    // Lunar Holidays
    if (LUNAR_HOLIDAYS[dateStr]) return LUNAR_HOLIDAYS[dateStr];

    return null;
}

export const getMonthlySpecialHolidays = (year: number, month: number, jan1WorkDay: boolean = false): string[] => {
  const daysInMonth = getDaysInMonth(year, month);
  const holidays: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    // Check Full Holidays (1/1 if not working)
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

// Formula Updated: Total Days - Weekends - YearHolidays - SpecialHolidays
// Each category is subtracted independently. Overlaps result in double/triple deduction.
export const calculateBaseTarget = (year: number, month: number, holidayStart?: string, holidayEnd?: string, jan1WorkDay: boolean = false): number => {
  const daysInMonth = getDaysInMonth(year, month);
  let deductions = 0;
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // 1. Subtract Weekends (Sat & Sun)
    if (isWeekend) {
        deductions++;
    }

    // 2. Subtract Year Holidays (Range inputs + 1/1 if applicable)
    // Rule: "Year Holiday overlapping with weekends DOES NOT count" (Only count 1-5 part)
    if (isYearHoliday(year, month, d, holidayStart, holidayEnd, jan1WorkDay)) {
        if (!isWeekend) {
            deductions++;
        }
    }

    // 3. Subtract Special Holidays (Fixed dates like 2/28)
    // Rule: Included in formula separately, so it stacks with weekend deduction.
    if (getSpecialHolidayName(year, month, d, jan1WorkDay) !== null) {
        deductions++;
    }
  }
  
  const calculatedDays = daysInMonth - deductions;
  // Ensure we don't return negative targets
  return Math.max(0, calculatedDays * 2);
};

// Calculate how many points a symbol deducts
const getDeduction = (cellData: CellData): number => {
  if (Array.isArray(cellData)) return 0; // It's a shift, no deduction
  return SYMBOL_DEDUCTIONS[cellData as ShiftSymbol] || 0;
};

// Helper to check if a shift is exactly A+B+C
const isABCShift = (cell: CellData | undefined): boolean => {
  return Array.isArray(cell) && cell.length === 3 && cell.includes('A') && cell.includes('B') && cell.includes('C');
};

// Recalculate stats for a single employee based on their shifts FOR A SPECIFIC MONTH
export const recalculateEmployeeStats = (emp: Employee, targetYear: number, targetMonth: number): Employee => {
  let shiftCount = 0;
  let deduction = 0;
  
  Object.entries(emp.shifts).forEach(([dateKey, cell]) => {
    // Parse the key "YYYY-M-D"
    const parts = dateKey.split('-');
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);

    // Only count stats for the requested month
    if (y === targetYear && m === targetMonth) {
      if (Array.isArray(cell)) {
        // Only count valid working shifts (A, B, C). Positional X (Xa, Xb, Xc) do NOT count as working shifts.
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

// Get daily requirements based on scenario and reduction tier
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
  
  // If it's a Year Holiday based on range (OR 1/1 if configured), no shifts required
  if (isYearHoliday(year, month, day, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) {
     return { A: 0, B: 0, C: 0, total: 0 };
  }

  if (dow === 0) { // Sunday
    return { A: 0, B: 0, C: 0, total: 0 };
  }
  
  if (dow === 6) { // Saturday
    return { A: config.reqSaturdayA, B: 0, C: 0, total: config.reqSaturdayA };
  }
  
  if (dow === 4) { // Thursday
    let reqA = 0, reqB = 0;
    switch (scenario) {
      case ThursdayScenario.A: reqA = 5; reqB = 5; break;
      case ThursdayScenario.B: reqA = 5; reqB = 4; break;
      case ThursdayScenario.C: reqA = 4; reqB = 4; break;
    }
    return { A: reqA, B: reqB, C: 0, total: reqA + reqB };
  }
  
  // Standard Day
  let stdB = config.reqStandardB;
  let stdC = config.reqStandardC;

  // Tuesday Reduction Tier
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

/**
 * Calculates Overview Stats independently of the generator
 */
export const calculateOverviewStats = (
    config: SchedulingConfig, 
    employees: Employee[],
    activeScenario: ThursdayScenario,
    useTuesdayReduction: boolean
) => {
    const { year, month } = config;
    const daysInMonth = getDaysInMonth(year, month);
    const baseTarget = calculateBaseTarget(year, month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay);
    
    // 1. Calculate Total Demand
    let totalDemand = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const req = getDailyRequirements(date, config, activeScenario, useTuesdayReduction);
        totalDemand += req.total;
    }

    // 2. Calculate Total Capacity
    let totalCapacity = 0;
    employees.forEach(e => {
        // IMPORTANT: Must ensure employee stats (targetDeduction) are up to date before calling this,
        // or recalculate them here transiently. Since we call this in App.tsx after recalculateEmployeeStats, we can use e.targetDeduction.
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

/**
 * Validates the entire schedule and returns warnings
 */
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
    
    // Count shifts for this day
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


// --- SOLVER & HELPERS ---

const solveStandardDay = (availableStaff: number, reqA: number, reqB: number, reqC: number) => {
  const possibleSolutions = [];
  
  // Calculate max possible ABC combinations
  // Typically limited by total staff or the minimum required for any shift
  const maxABC = Math.min(availableStaff, reqA, reqB, reqC);

  for (let k = 0; k <= maxABC; k++) {
    const numABC = k;
    const numBC = reqC - numABC; // Remainder for C must be BC
    
    // Check validity
    if (numBC < 0) continue;
    
    // Check B requirement
    const totalB = numABC + numBC;
    if (totalB !== reqB) continue;
    
    // Fill remaining with A
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
            // NOTE: Shifts assigned by Auto-Generator are NOT marked as manualEntries.
            // If there was a manual entry there before, this overwrites it (default behavior of Auto-Gen).
        }
    });
};

/**
 * Calculates priority score for each day.
 * Lower Score = Higher Priority (Process these days first).
 * Score = AvailableStaffCount * 100 - DailyDemand
 */
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
    
    // If holiday/sunday, lowest priority (score 9999)
    if (isYearHoliday(year, month, d, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) return 9999;
    if (date.getDay() === 0) return 9999;

    // Available Staff: Those who don't have a shift already assigned (e.g. Symbol or Manual Shift)
    // NOTE: If user manually assigned 'A', this employee is busy/not available for auto-assignment logic
    // unless we specifically want to overwrite. The current logic in `generateSchedule` filters `e.shifts[dateKey]`
    // so manual entries are preserved and respected as "busy".
    const available = employees.filter(e => !e.shifts[dateKey]).length;
    
    // Demand
    const req = getDailyRequirements(date, config, scenario, useTueReduction);
    const demand = req.total;

    // Score: Fewer staff + Higher Demand = Lower Score
    return (available * 100) - demand;
}

/**
 * Checks consecutive ABC shifts logic.
 * Now checks BOTH previous days AND next days because we are jumping around the calendar.
 */
const checkConsecutiveABC = (emp: Employee, year: number, month: number, d: number, force: boolean): boolean => {
    if (force) return true; // If forced (critical day), ignore consecutive rule

    const prev1 = emp.shifts[`${year}-${month}-${d-1}`];
    const prev2 = emp.shifts[`${year}-${month}-${d-2}`];
    const next1 = emp.shifts[`${year}-${month}-${d+1}`];
    const next2 = emp.shifts[`${year}-${month}-${d+2}`];

    // Case 1: ABC - ABC - [Current]
    if (isABCShift(prev1) && isABCShift(prev2)) return false;

    // Case 2: [Current] - ABC - ABC
    if (isABCShift(next1) && isABCShift(next2)) return false;

    // Case 3: ABC - [Current] - ABC
    if (isABCShift(prev1) && isABCShift(next1)) return false;

    return true;
};


// --- MAIN GENERATOR ---

export const generateSchedule = (config: SchedulingConfig, currentEmployees: Employee[]): ScheduleResult => {
  const { year, month, staffIds, thursdayMode } = config;
  const daysInMonth = getDaysInMonth(year, month);
  const baseTarget = calculateBaseTarget(year, month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay);
  let warnings: string[] = [];

  // 1. Initialize & Clean
  // We want to KEEP existing manual entries (Symbols AND Manual Shifts)
  const employees: Employee[] = staffIds.map(id => {
    const existing = currentEmployees.find(e => e.id === id);
    return {
      id,
      name: existing ? existing.name : `員工 ${id}`,
      // Keep existing shifts and manual flags
      shifts: existing ? { ...existing.shifts } : {}, 
      manualEntries: existing ? { ...existing.manualEntries } : {},
      customTarget: existing?.customTarget,
      generatedShiftCount: 0,
      targetDeduction: 0,
    };
  });

  // Pre-process: Clear ONLY auto-generated shifts from the current month
  // to prepare for regeneration, BUT keep manual entries.
  employees.forEach(e => {
    Object.keys(e.shifts).forEach(dateKey => {
      const [y, m] = dateKey.split('-').map(Number);
      if (y === year && m === month) {
         // If it's NOT marked as manual, it's auto-generated (or legacy). 
         // Since we are regenerating, we wipe non-manual data for this month.
         if (!e.manualEntries?.[dateKey]) {
             delete e.shifts[dateKey];
         }
      }
    });
    // Recalculate stats based on what remains (Manual entries)
    const cleanEmp = recalculateEmployeeStats(e, year, month);
    e.generatedShiftCount = cleanEmp.generatedShiftCount;
    e.targetDeduction = cleanEmp.targetDeduction;
  });

  // 2. Ladder Reduction - Determine Strategy
  let totalCapacity = 0;
  employees.forEach(e => {
    const effectiveTarget = (e.customTarget ?? baseTarget) - e.targetDeduction;
    // Capacity is remaining target needed
    totalCapacity += Math.max(0, effectiveTarget - e.generatedShiftCount); 
    // ^ logic adjusted: capacity should be total potential, but here we are summing how much *more* they can do.
    // Actually, simple totalCapacity logic:
    // totalCapacity = Sum(Target - Deduction)
  });
  
  // Re-calc absolute total capacity for scenario logic
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
    
    // Dynamic demand based on config
    if (dow === 6) baseDemand += config.reqSaturdayA;
    else if (dow === 4) { 
        thursdayCount++; 
        // Approx cost for Thu A scenario (Max)
        baseDemand += 10; 
    } 
    else {
        // Standard Day Demand (Dynamic from config)
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
  // Tuesday cost approximation
  let finalTueCost = config.reqStandardA + config.reqStandardB + config.reqStandardC;
  if (useTuesdayReduction) {
      finalTueCost = config.reqStandardA + 4 + 4; // reduced to 4/4
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

  // 3. PRIORITY QUEUE GENERATION (Hardest Days First)
  // Calculate priority for each day
  const daysToSchedule = [];
  for (let d = 1; d <= daysInMonth; d++) {
      const priority = calculateDayPriority(d, year, month, employees, config, selectedScenario, useTuesdayReduction);
      // Only schedule valid working days
      if (priority < 9000) {
          daysToSchedule.push({ day: d, priority });
      }
  }
  
  // Sort: Lower priority score comes first
  daysToSchedule.sort((a, b) => a.priority - b.priority);

  // 4. PROCESS DAYS
  for (const { day } of daysToSchedule) {
    const date = new Date(year, month, day);
    const dow = date.getDay();
    const dateKey = `${year}-${month}-${day}`;
    
    // Identify available staff: Filter out those who ALREADY have a shift (Manual Entry)
    const availableStaff = employees.filter(e => !e.shifts[dateKey]); 
    const staffPool = [...availableStaff];

    if (dow === 6) {
      // Saturday - Dynamic Config
      const candidates = pickBestCandidates(staffPool, config.reqSaturdayA, 1, baseTarget);
      applyShifts(employees, candidates, dateKey, ['A'], 1);
    } 
    else if (dow === 4) {
      // Thursday
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
      // Standard Day
      let reqB = config.reqStandardB;
      let reqC = config.reqStandardC;
      
      if (dow === 2 && useTuesdayReduction) {
          reqB = 4; reqC = 4;
      }

      // Check if this is a "Critical Day" where we MUST use all available staff
      const isCriticalDay = staffPool.length <= 5; 

      // UPDATED: Pass config.reqStandardA to solver
      const solutions = solveStandardDay(staffPool.length, config.reqStandardA, reqB, reqC);
      const bestSol = solutions.find(s => s.staffNeeded <= staffPool.length);
      
      if (bestSol) {
        const { numABC, numBC, numA } = bestSol;
        const assignedForDay = new Set<string>();
        
        // 1. Assign ABC (Cost 3)
        // Pass 'isCriticalDay' as 'force' param to checkConsecutiveABC
        const poolForABC = staffPool.filter(emp => {
           return checkConsecutiveABC(emp, year, month, day, isCriticalDay);
        });

        let candidatesABC = pickBestCandidates(poolForABC, numABC, 3, baseTarget);
        
        // Dynamic Stop logic - Only apply if strict standard A=5
        if (!isCriticalDay && numABC === 5 && candidatesABC.length === 5) {
            // Fix for TS2532: Safely check deficit
            const candidate = candidatesABC[4];
            if (candidate && (candidate.deficit ?? 0) <= 0) candidatesABC.pop();
        }

        applyShifts(employees, candidatesABC, dateKey, ['A', 'B', 'C'], 3);
        candidatesABC.forEach(c => assignedForDay.add(c.id));

        // 2. Assign BC (Cost 2)
        const poolForBC = staffPool.filter(e => !assignedForDay.has(e.id));
        let candidatesBC = pickBestCandidates(poolForBC, numBC, 2, baseTarget);
        
        if (!isCriticalDay && numBC === 5 && candidatesBC.length === 5) {
            // Fix for TS2532: Safely check deficit
            const candidate = candidatesBC[4];
            if (candidate && (candidate.deficit ?? 0) <= 0) candidatesBC.pop();
        }

        applyShifts(employees, candidatesBC, dateKey, ['B', 'C'], 2);
        candidatesBC.forEach(c => assignedForDay.add(c.id));

        // 3. Assign A (Cost 1)
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
