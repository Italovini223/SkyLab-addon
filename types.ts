
export interface SimData {
  altitude: number;
  groundSpeed: number;
  indicatedAirspeed?: number;
  totalFuel: number;
  onGround: boolean;
  verticalSpeed: number;
  enginesRunning: boolean;
  parkingBrake: boolean;
  gearDown: boolean;
  latitude: number;
  longitude: number;
  connected: boolean;
  grossWeight?: number;
}

export type CompanyType = 'real' | 'virtual';
export type LicenseCategory = 'Light' | 'Turboprop' | 'SingleAisle' | 'Widebody';

export interface CompanyConfig {
  name: string;
  type: CompanyType;
  country: string;
  logo: string;
  hub: string;
  balance: number;
  reputation: number;
  setupComplete: boolean;
  dutyStartTime?: number;
  simBriefUsername?: string;
}

export interface LoggedFlight {
  id: string;
  date: string;
  route: string;
  aircraft: string;
  duration: string;
  landingRate: number;
  status: 'Perfect' | 'Good' | 'Hard';
}

export interface PilotStats {
  totalHours: number;
  totalFlights: number;
  rank: string;
  licenses: LicenseCategory[];
  avgLandingRate: number;
  logbook: LoggedFlight[];
}

export interface Aircraft {
  id: string;
  model: string;
  icaoType: string;
  livery: string;
  registration: string;
  location: string;
  totalHours: number;
  totalCycles: number;
  condition: number;
  type: 'owned' | 'leased';
  nextMaintenanceDue: number;
  status: 'active' | 'maintenance' | 'flying' | 'checkride';
  maxPax: number;
  emptyWeight: number;
  category: LicenseCategory;
}

export interface RosterFlight {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  distance: number;
  departureTime: string;
  status: 'pending' | 'current' | 'completed';
  pax: number;
  cargoWeight: number;
  minFuel: number;
  events: any;
}

export interface Transaction {
  id: string;
  timestamp: number;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category: 'flight_revenue' | 'fuel' | 'airport_fees' | 'maintenance' | 'purchase' | 'investment';
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export interface SimBriefOFP {
  origin: string;
  destination: string;
  paxCount: number;
  blockFuel: number;
  callsign: string;
  aircraft: string;
  plannedEte: number;
  plannedDeparture: number;
}

declare global {
  interface Window {
    electronAPI: {
      onSimData: (callback: (data: SimData) => void) => void;
      onFlightEvent: (callback: (type: ToastType, data: { message: string }) => void) => void;
      getInitialState: () => Promise<any>;
      setupCompany: (company: CompanyConfig) => Promise<boolean>;
      recordTransaction: (tx: Transaction) => Promise<boolean>;
      buyAircraft: (aircraft: Aircraft, transaction: Transaction) => Promise<boolean>;
      updateRoster: (roster: RosterFlight[]) => Promise<boolean>;
      finalizeFlight: (roster: RosterFlight[], txs: Transaction[], pilot: PilotStats) => Promise<boolean>;
    };
  }
}
