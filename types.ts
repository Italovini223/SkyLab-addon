
export interface SimData {
  altitude: number;
  groundSpeed: number;
  totalFuel: number;
  onGround: boolean;
  verticalSpeed: number;
  enginesRunning: boolean;
  parkingBrake: boolean;
  gearDown: boolean;
  connected: boolean;
}

export type CompanyType = 'real' | 'virtual';

export interface CompanyConfig {
  name: string;
  type: CompanyType;
  country: string;
  logo: string;
  hub: string;
  balance: number;
  reputation: number;
  setupComplete: boolean;
}

export interface License {
  type: string; // 'SingleEngine', 'MultiEngine', 'Jet'
  aircraftModels: string[];
  status: 'locked' | 'unlocked';
}

export interface Aircraft {
  id: string;
  model: string;
  livery: string;
  registration: string;
  location: string;
  totalHours: number;
  totalCycles: number;
  condition: number;
  type: 'owned' | 'leased';
  nextMaintenanceDue: number;
  status: 'active' | 'maintenance' | 'flying' | 'checkride';
}

export interface SimBriefOFP {
  origin: string;
  destination: string;
  paxCount: number;
  blockFuel: number;
  callsign: string;
  aircraft: string;
  plannedEte: number;
  plannedDeparture: number; // timestamp
}

export interface FlightLog {
  id: string;
  origin: string;
  destination: string;
  fuelUsed: number;
  pax: number;
  revenue: number;
  expenses: number;
  profit: number;
  landingRate: number;
  timestamp: number;
  aircraftId: string;
  type: 'regular' | 'checkride';
}
