
export type ShiftType = 'A' | 'B' | 'C' | 'Xa' | 'Xb' | 'Xc';
export type ShiftSymbol = 'X' | 'O' | '特' | '婚' | '產' | '年' | '喪';

// Union for cell content
export type CellData = ShiftType[] | ShiftSymbol;

// New type for the selected tool in UI
export type Tool = ShiftSymbol | string | 'eraser' | null;

export interface Employee {
  id: string;
  name: string;
  // dateKey -> array of shifts (e.g. ['A', 'B']) OR single symbol string
  shifts: Record<string, CellData>; 
  
  // Track which dates were manually modified by the user
  // dateKey -> true
  manualEntries?: Record<string, boolean>;

  // Custom target override (optional). If null, use calculated default.
  customTarget?: number;
  
  // Stats for display
  generatedShiftCount: number; // Actual shifts assigned (A=1, B=1...)
  targetDeduction: number; // Points to deduct from target based on symbols
  deficit?: number; // Internal use for sorting
}

export enum ThursdayScenario {
  A = 'A', // A=5, B=5
  B = 'B', // A=5, B=4
  C = 'C', // A=4, B=4
}

export interface SchedulingConfig {
  year: number;
  month: number;
  staffIds: string[];
  
  // Daily Requirements
  reqStandardA: number;
  reqStandardB: number;
  reqStandardC: number;
  reqSaturdayA: number;
  
  // Thursday Logic (Auto-selected usually, but kept in config if we want to force it per week)
  thursdayMode: 'Auto' | ThursdayScenario;

  // Year Holiday Date Range (YYYY-MM-DD)
  yearHolidayStart: string;
  yearHolidayEnd: string;

  // Jan 1st Configuration
  jan1WorkDay: boolean;
}

export interface ScheduleResult {
  employees: Employee[];
  warnings: string[];
  stats: {
    totalDemand: number;
    totalCapacity: number;
    suggestedSpecialLeaves: number;
  };
  usedThursdayScenario: ThursdayScenario;
  usedTuesdayReduction: boolean;
}

export interface BackupData {
  config: SchedulingConfig;
  employees: Employee[];
  stats?: {
      totalDemand: number;
      totalCapacity: number;
      suggestedSpecialLeaves: number;
  };
  activeThursdayScenario?: ThursdayScenario;
  usedTuesdayReduction?: boolean;
  version: string;
  timestamp: number;
}
