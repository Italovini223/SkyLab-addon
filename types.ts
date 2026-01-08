
export interface SimData {
  altitude: number;
  groundSpeed: number;
  totalFuel: number;
  onGround: boolean;
  verticalSpeed: number;
  enginesRunning: boolean;
  parkingBrake: boolean;
  gearDown: boolean;
  latitude: number;
  longitude: number;
  connected: boolean;
}

export type CompanyType = 'real' | 'virtual';
export type LicenseCategory = 'Light' | 'Turboprop' | 'SingleAisle' | 'Widebody';

export interface FlightEvents {
  engineStart?: number;
  takeoff?: number;
  landing?: number;
  engineShutdown?: number;
}

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
}

export interface PilotStats {
  totalHours: number;
  totalFlights: number;
  rank: string;
  licenses: LicenseCategory[];
  avgLandingRate: number;
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
  emptyWeight: number; // Lbs
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
  cargoWeight: number; // Lbs
  minFuel: number; // Lbs
  events: FlightEvents;
}

export interface Transaction {
  id: string;
  timestamp: number;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category: 'flight_revenue' | 'fuel' | 'airport_fees' | 'maintenance' | 'purchase' | 'penalty';
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
  duration: number; // Milliseconds
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
