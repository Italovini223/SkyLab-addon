
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SimData, SimBriefOFP, FlightLog, CompanyConfig, Aircraft, RosterFlight, Transaction, FlightEvents, PilotStats, LicenseCategory } from './types';
import { 
  Layout, Plane, CreditCard, Activity, Settings, 
  CloudDownload, MapPin, Gauge, ShoppingCart, Wrench, AlertTriangle, 
  CheckCircle, Globe, Award, List, Upload, Building2, ChevronRight, 
  TrendingUp, TrendingDown, DollarSign, Calendar, Clock, Navigation,
  Package, FileText, User, Coffee, ShieldCheck, History, BarChart3, X, Info
} from 'lucide-react';

// Constantes de Negócio
const TICKET_PRICE = 165;
const FUEL_PRICE_LB = 0.88;
const AIRPORT_FEE_PER_NM = 4.5;
const DUTY_LIMIT_MS = 12 * 60 * 60 * 1000;
const FATIGUE_PENALTY = 0.20;

const REAL_AIRLINES: any = {
  "Brasil": [
    { name: "Azul Linhas Aéreas", hub: "SBKP", logo: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Azul_Linhas_A%C3%A9reas_Brasileiras_logo.png" },
    { name: "GOL Linhas Aéreas", hub: "SBGR", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Gol_Linhas_Aereas_Logo.svg/1280px-Gol_Linhas_Aereas_Logo.svg.png" },
    { name: "LATAM Brasil", hub: "SBGR", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LATAM_Logo.svg/2560px-LATAM_Logo.svg.png" }
  ],
  "USA": [
    { name: "Delta Air Lines", hub: "KATL", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Delta_logo.svg/2560px-Delta_logo.svg.png" },
    { name: "American Airlines", hub: "KDFW", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/American_Airlines_logo_2013.svg/2560px-American_Airlines_logo_2013.svg.png" }
  ]
};

const MARKET_CANDIDATES: Aircraft[] = [
  { id: 'm1', model: 'A320neo', icaoType: 'A20N', livery: 'Standard', registration: 'PR-XBI', location: 'SBGR', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 50, status: 'active', maxPax: 174, emptyWeight: 90000, category: 'SingleAisle' },
  { id: 'm2', model: '737-800', icaoType: 'B738', livery: 'Standard', registration: 'PR-GUM', location: 'SBSP', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 45, status: 'active', maxPax: 186, emptyWeight: 91000, category: 'SingleAisle' },
  { id: 'm3', model: 'C208 Grand Caravan', icaoType: 'C208', livery: 'Standard', registration: 'PS-CNT', location: 'SBMT', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 30, status: 'active', maxPax: 9, emptyWeight: 4500, category: 'Turboprop' },
  { id: 'm4', model: 'A350-900', icaoType: 'A359', livery: 'Standard', registration: 'PR-AOW', location: 'SBGR', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 100, status: 'active', maxPax: 334, emptyWeight: 250000, category: 'Widebody' },
];

const AIRPORTS_BY_REGION: Record<string, string[]> = {
  "Brasil": ["SBGR", "SBSP", "SBGL", "SBRJ", "SBKP", "SBCF", "SBPA", "SBCT", "SBRF", "SBSV", "SBFZ", "SBBE"],
  "USA": ["KATL", "KLAX", "KORD", "KDFW", "KJFK", "KSFO", "KSEA", "KMIA", "KEWR", "KCLT", "KPHX", "KMCO"]
};

// Componente de Notificação Customizado
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

const ToastContainer: React.FC<{ toasts: Toast[], remove: (id: string) => void }> = ({ toasts, remove }) => {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col space-y-4 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-center space-x-4 p-4 rounded-2xl shadow-2xl glass-card animate-toast-in border-l-4 w-80 ${
          t.type === 'success' ? 'border-emerald-500' : 
          t.type === 'error' ? 'border-red-500' : 
          t.type === 'warning' ? 'border-yellow-500' : 'border-blue-500'
        }`}>
          <div className={`${
            t.type === 'success' ? 'text-emerald-500' : 
            t.type === 'error' ? 'text-red-500' : 
            t.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
          }`}>
            {t.type === 'success' && <CheckCircle size={20} />}
            {t.type === 'error' && <AlertTriangle size={20} />}
            {t.type === 'warning' && <AlertTriangle size={20} />}
            {t.type === 'info' && <Info size={20} />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-200">{t.message}</p>
          </div>
          <button onClick={() => remove(t.id)} className="text-slate-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

const App: React.FC = () => {
  // Estados de Navegação
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pilot_area' | 'accounting' | 'hangar' | 'market'>('dashboard');
  const [pilotSubTab, setPilotSubTab] = useState<'roster' | 'licenses' | 'management'>('roster');
  
  // Estados de Negócio
  const [company, setCompany] = useState<CompanyConfig>(() => {
    const saved = localStorage.getItem('skyLink_company_config');
    return saved ? JSON.parse(saved) : { setupComplete: false, balance: 150000, reputation: 5.0 };
  });

  const [pilotStats, setPilotStats] = useState<PilotStats>(() => {
    const saved = localStorage.getItem('skyLink_pilot_stats');
    return saved ? JSON.parse(saved) : { totalHours: 0, totalFlights: 0, rank: 'Cadete', licenses: ['Light'], avgLandingRate: 0 };
  });

  const [fleet, setFleet] = useState<Aircraft[]>(() => {
    const saved = localStorage.getItem('skyLink_fleet');
    return saved ? JSON.parse(saved) : [];
  });

  const [roster, setRoster] = useState<RosterFlight[]>(() => {
    const saved = localStorage.getItem('skyLink_roster');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('skyLink_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [simData, setSimData] = useState<SimData>({
    altitude: 0, groundSpeed: 0, totalFuel: 0, onGround: true,
    verticalSpeed: 0, enginesRunning: false, parkingBrake: true, gearDown: true,
    latitude: 0, longitude: 0, connected: false
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>('');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [tempConfig, setTempConfig] = useState<Partial<CompanyConfig>>({ type: 'real', country: 'Brasil' });
  const [rosterLegsCount, setRosterLegsCount] = useState(1);
  const [dutyTimer, setDutyTimer] = useState<string>("00:00:00");

  const initialFuelRef = useRef<number>(0);
  const isFlyingRef = useRef<boolean>(false);
  const eventsTracked = useRef<FlightEvents>({});

  // Notificação Logic
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [{ id, type, message }, ...prev]);
    setTimeout(() => removeToast(id), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Persistência
  useEffect(() => {
    localStorage.setItem('skyLink_company_config', JSON.stringify(company));
    localStorage.setItem('skyLink_pilot_stats', JSON.stringify(pilotStats));
    localStorage.setItem('skyLink_fleet', JSON.stringify(fleet));
    localStorage.setItem('skyLink_roster', JSON.stringify(roster));
    localStorage.setItem('skyLink_transactions', JSON.stringify(transactions));
  }, [company, pilotStats, fleet, roster, transactions]);

  // Duty Clock
  useEffect(() => {
    if (!company.dutyStartTime) return;
    const interval = setInterval(() => {
      const diff = Date.now() - company.dutyStartTime!;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setDutyTimer(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [company.dutyStartTime]);

  // IPC Event Listener
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onSimData((data: SimData) => setSimData(data));
      window.electronAPI.onFlightEvent((type: Toast['type'], data: { message: string }) => {
        addToast(type, data.message);
      });
    }
  }, [addToast]);

  const recordTransaction = useCallback((description: string, amount: number, type: 'credit' | 'debit', category: Transaction['category']) => {
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      description,
      amount,
      type,
      category
    };
    setTransactions(prev => [newTransaction, ...prev]);
    setCompany(prev => ({ ...prev, balance: type === 'credit' ? prev.balance + amount : prev.balance - amount }));
  }, []);

  const generateRoster = () => {
    if (fleet.length === 0) {
      addToast('warning', "Frota Vazia! Adquira uma aeronave primeiro.");
      return;
    }
    const aircraft = fleet[0];
    let currentLoc = aircraft.location;
    const newRoster: RosterFlight[] = [];
    const regionAirports = AIRPORTS_BY_REGION[company.country] || AIRPORTS_BY_REGION["Brasil"];

    for (let i = 0; i < rosterLegsCount; i++) {
      let dest = regionAirports[Math.floor(Math.random() * regionAirports.length)];
      while (dest === currentLoc) dest = regionAirports[Math.floor(Math.random() * regionAirports.length)];
      const pax = Math.floor(aircraft.maxPax * (0.5 + Math.random() * 0.5));
      const dist = Math.floor(100 + Math.random() * 900);
      newRoster.push({
        id: Math.random().toString(36).substr(2, 9),
        flightNumber: `${company.name.substring(0,3).toUpperCase()}${Math.floor(1000+Math.random()*8999)}`,
        origin: currentLoc, destination: dest, distance: dist, departureTime: `${10+i}:00`,
        status: i === 0 ? 'current' : 'pending', pax, cargoWeight: Math.floor(pax*45 + Math.random()*1000),
        minFuel: Math.floor(dist * 12 + 3000), events: {}
      });
      currentLoc = dest;
    }
    if (!company.dutyStartTime) setCompany(prev => ({ ...prev, dutyStartTime: Date.now() }));
    setRoster(newRoster);
    setSelectedAircraftId(aircraft.id);
    addToast('info', "Nova Escala de Voos gerada com sucesso!");
  };

  const finalizeFlight = useCallback((finalFuel: number, finalVS: number) => {
    const currentLeg = roster.find(l => l.status === 'current');
    if (!currentLeg || !selectedAircraftId) return;

    const fuelUsed = Math.max(0, initialFuelRef.current - finalFuel);
    const aircraft = fleet.find(a => a.id === selectedAircraftId)!;
    const dutyElapsed = company.dutyStartTime ? Date.now() - company.dutyStartTime : 0;
    const isFatigued = dutyElapsed > DUTY_LIMIT_MS;
    
    let revenue = currentLeg.pax * TICKET_PRICE;
    if (isFatigued) revenue *= (1 - FATIGUE_PENALTY);
    const fuelCost = fuelUsed * FUEL_PRICE_LB;
    const airportFees = currentLeg.distance * AIRPORT_FEE_PER_NM;
    const totalProfit = revenue - fuelCost - airportFees;

    recordTransaction(`Voo ${currentLeg.flightNumber}: Receita de Passagens`, revenue, 'credit', 'flight_revenue');
    recordTransaction(`Custo Combustível ${currentLeg.flightNumber}`, fuelCost, 'debit', 'fuel');
    recordTransaction(`Taxas Aeroporto ${currentLeg.destination}`, airportFees, 'debit', 'airport_fees');

    // Update Pilot Stats
    const duration = eventsTracked.current.engineShutdown && eventsTracked.current.engineStart ? (eventsTracked.current.engineShutdown - eventsTracked.current.engineStart) : 3600000;
    const hours = duration / 3600000;
    
    setPilotStats(prev => ({
      ...prev,
      totalHours: prev.totalHours + hours,
      totalFlights: prev.totalFlights + 1,
      rank: prev.totalHours > 200 ? "Capitão Sênior" : prev.totalHours > 100 ? "Capitão" : prev.totalHours > 20 ? "Primeiro Oficial" : "Cadete"
    }));

    const updatedRoster = roster.map(l => {
      if (l.id === currentLeg.id) return { ...l, status: 'completed' as const, events: { ...eventsTracked.current, engineShutdown: Date.now() } };
      return l;
    });

    const currentIdx = roster.findIndex(l => l.id === currentLeg.id);
    if (updatedRoster[currentIdx + 1]) updatedRoster[currentIdx + 1].status = 'current';

    setRoster(updatedRoster);
    setFleet(prev => prev.map(a => a.id === selectedAircraftId ? { ...a, location: currentLeg.destination, totalCycles: a.totalCycles + 1 } : a));
    eventsTracked.current = {};
    
    addToast('success', `Voo ${currentLeg.flightNumber} finalizado! Lucro Líquido: $${totalProfit.toLocaleString()}`);
  }, [roster, fleet, selectedAircraftId, recordTransaction, company.dutyStartTime, addToast]);

  useEffect(() => {
    if (!simData.connected) return;
    if (simData.enginesRunning && !eventsTracked.current.engineStart && simData.onGround) eventsTracked.current.engineStart = Date.now();
    if (!simData.onGround && !isFlyingRef.current) {
      isFlyingRef.current = true;
      initialFuelRef.current = simData.totalFuel;
      eventsTracked.current.takeoff = Date.now();
    }
    if (simData.onGround && isFlyingRef.current && !eventsTracked.current.landing) eventsTracked.current.landing = Date.now();
    if (simData.onGround && isFlyingRef.current && !simData.enginesRunning && simData.parkingBrake) {
      isFlyingRef.current = false;
      eventsTracked.current.engineShutdown = Date.now();
      finalizeFlight(simData.totalFuel, simData.verticalSpeed);
    }
  }, [simData, finalizeFlight]);

  // ONBOARDING GATE
  if (!company.setupComplete) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6">
        <ToastContainer toasts={toasts} remove={removeToast} />
        <div className="max-w-xl w-full glass p-10 rounded-3xl border-slate-800 border space-y-8 animate-in fade-in zoom-in duration-300">
           <div className="text-center">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/20">
               <Building2 size={32} />
             </div>
             <h1 className="text-3xl font-bold">Inicie sua Jornada</h1>
             <p className="text-slate-500 mt-2">Escolha o modelo de operação da sua companhia</p>
           </div>
           {onboardingStep === 1 ? (
             <div className="space-y-4">
                <button onClick={() => { setTempConfig({ ...tempConfig, type: 'real' }); setOnboardingStep(2); }} className="w-full p-6 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                   <div><p className="font-bold text-lg">Modo Real</p><p className="text-sm text-slate-500">Operar como uma companhia aérea estabelecida.</p></div>
                   <ChevronRight className="text-slate-700 group-hover:text-blue-500" />
                </button>
                <button onClick={() => { setTempConfig({ ...tempConfig, type: 'virtual' }); setOnboardingStep(2); }} className="w-full p-6 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                   <div><p className="font-bold text-lg">Modo Virtual</p><p className="text-sm text-slate-500">Crie sua marca e hubs do zero.</p></div>
                   <ChevronRight className="text-slate-700 group-hover:text-blue-500" />
                </button>
             </div>
           ) : (
             <div className="space-y-6">
               {tempConfig.type === 'real' ? (
                 <>
                   <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none" onChange={(e) => setTempConfig({ ...tempConfig, country: e.target.value })}>
                     <option value="Brasil">Brasil</option><option value="USA">USA</option>
                   </select>
                   <div className="grid grid-cols-1 gap-2">
                     {REAL_AIRLINES[tempConfig.country || 'Brasil'].map((air: any) => (
                       <button key={air.name} onClick={() => setTempConfig({ ...tempConfig, name: air.name, logo: air.logo, hub: air.hub })} className={`p-4 border rounded-xl flex items-center space-x-4 transition-all ${tempConfig.name === air.name ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800'}`}>
                          <img src={air.logo} className="h-6 w-auto grayscale" alt="" />
                          <span className="font-bold">{air.name}</span>
                       </button>
                     ))}
                   </div>
                 </>
               ) : (
                 <div className="space-y-4">
                   <input className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none" placeholder="Nome da Companhia" onChange={(e) => setTempConfig({ ...tempConfig, name: e.target.value })} />
                   <input className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none uppercase" placeholder="HUB ICAO (Ex: SBGR)" onChange={(e) => setTempConfig({ ...tempConfig, hub: e.target.value })} />
                 </div>
               )}
               <div className="flex space-x-4">
                 <button onClick={() => setOnboardingStep(1)} className="flex-1 py-4 bg-slate-900/50 rounded-xl font-bold">Voltar</button>
                 <button onClick={() => { 
                    setCompany({ ...tempConfig, setupComplete: true, balance: 150000, reputation: 5.0 } as CompanyConfig); 
                    recordTransaction("Injeção Capital Inicial", 150000, 'credit', 'purchase');
                    addToast('success', "Companhia criada com sucesso! Bem-vindo comandante.");
                 }} disabled={!tempConfig.name} className="flex-2 w-full py-4 bg-blue-600 rounded-xl font-bold disabled:opacity-30">Confirmar</button>
               </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-200 overflow-hidden">
      <ToastContainer toasts={toasts} remove={removeToast} />
      
      {/* SIDEBAR */}
      <aside className="w-64 glass border-r border-slate-800/50 flex flex-col p-6 space-y-6">
        <div className="flex items-center space-x-3 px-2 mb-4">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
            <Plane className="text-white" size={20} />
          </div>
          <h1 className="text-lg font-bold italic tracking-tighter">SkyLink<span className="text-blue-500">OCC</span></h1>
        </div>
        
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
            <Layout size={18}/><span>Dashboard</span>
          </button>
          
          <div className="py-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase px-3 mb-2 tracking-widest opacity-50">Operacional</p>
            <button onClick={() => { setActiveTab('pilot_area'); setPilotSubTab('roster'); }} className={`flex items-center space-x-3 w-full p-3 rounded-xl mb-1 transition-all ${activeTab === 'pilot_area' && pilotSubTab === 'roster' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
              <Calendar size={18}/><span>Escala de Voos</span>
            </button>
            <button onClick={() => { setActiveTab('pilot_area'); setPilotSubTab('licenses'); }} className={`flex items-center space-x-3 w-full p-3 rounded-xl mb-1 transition-all ${activeTab === 'pilot_area' && pilotSubTab === 'licenses' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
              <ShieldCheck size={18}/><span>Licenças</span>
            </button>
            <button onClick={() => { setActiveTab('pilot_area'); setPilotSubTab('management'); }} className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all ${activeTab === 'pilot_area' && pilotSubTab === 'management' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
              <User size={18}/><span>Logbook Piloto</span>
            </button>
          </div>

          <div className="py-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase px-3 mb-2 tracking-widest opacity-50">Corporativo</p>
            <button onClick={() => setActiveTab('accounting')} className={`flex items-center space-x-3 w-full p-3 rounded-xl mb-1 transition-all ${activeTab === 'accounting' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
              <DollarSign size={18}/><span>Financeiro</span>
            </button>
            <button onClick={() => setActiveTab('hangar')} className={`flex items-center space-x-3 w-full p-3 rounded-xl mb-1 transition-all ${activeTab === 'hangar' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
              <Wrench size={18}/><span>Frota</span>
            </button>
            <button onClick={() => setActiveTab('market')} className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all ${activeTab === 'market' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
              <ShoppingCart size={18}/><span>Mercado</span>
            </button>
          </div>
        </nav>

        {company.dutyStartTime && (
          <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50 mt-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Jornada</span>
              <Coffee size={12} className="text-blue-500" />
            </div>
            <p className="text-lg font-mono font-bold text-blue-400">{dutyTimer}</p>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">SimConnect</span>
            <div className={`w-2 h-2 rounded-full ${simData.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          </div>
          <button onClick={() => {
            if(!simData.connected) addToast('info', 'Tentando conectar ao simulador...');
            setSimData(s => ({ ...s, connected: !s.connected }));
          }} className="w-full py-2 bg-slate-800 rounded-xl text-[10px] font-bold hover:bg-slate-700 transition-colors">
            {simData.connected ? 'ESTABELECIDO' : 'RECONECTAR'}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
        <header className="flex justify-between items-center mb-10">
           <div className="flex items-center space-x-5">
             {company.logo ? (
                <div className="p-2 glass rounded-2xl">
                  <img src={company.logo} className="h-8 w-auto" alt="Logo" />
                </div>
             ) : (
                <div className="p-3 bg-blue-600 rounded-2xl"><Building2 size={24} /></div>
             )}
             <div>
                <h2 className="text-2xl font-bold uppercase tracking-tight leading-none">{company.name}</h2>
                <p className="text-slate-500 text-xs font-medium mt-1 uppercase tracking-widest">Base Principal: <span className="text-blue-500">{company.hub}</span></p>
             </div>
           </div>
           <div className="flex items-center space-x-6">
              <div className="px-6 py-3 rounded-2xl glass-card border-emerald-500/20 border-l-4 text-right">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Patrimônio</p>
                <p className="text-xl font-mono text-emerald-400 font-bold tracking-tighter">${company.balance.toLocaleString()}</p>
              </div>
           </div>
        </header>

        {/* RENDER CONTENT BASED ON ACTIVE TAB */}
        {activeTab === 'dashboard' && (
           <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {[
                   { label: 'Total Horas', value: `${Math.floor(pilotStats.totalHours)}h`, icon: Clock, color: 'text-blue-500' },
                   { label: 'Voos Concluídos', value: pilotStats.totalFlights, icon: Plane, color: 'text-emerald-500' },
                   { label: 'Patente', value: pilotStats.rank, icon: Award, color: 'text-yellow-500' },
                   { label: 'Frota Ativa', value: fleet.length, icon: List, color: 'text-slate-500' }
                 ].map((stat, i) => (
                   <div key={i} className="glass-card p-6 rounded-3xl group hover:border-blue-500/30 transition-all">
                     <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{stat.label}</p>
                        <stat.icon className={`${stat.color} opacity-60 group-hover:opacity-100 transition-opacity`} size={20} />
                     </div>
                     <p className="text-3xl font-mono font-bold tracking-tighter">{stat.value}</p>
                   </div>
                 ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 glass-card p-8 rounded-3xl">
                    <div className="flex items-center justify-between mb-6">
                       <h3 className="text-lg font-bold flex items-center space-x-2"><Activity size={18} className="text-blue-500"/> <span>Monitoramento Operacional</span></h3>
                       <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${simData.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{simData.connected ? 'Ativo' : 'Offline'}</span>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-8">
                       <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800/50 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Altitude</p>
                          <p className="text-xl font-mono font-bold tracking-tighter">{simData.altitude.toLocaleString()} FT</p>
                       </div>
                       <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800/50 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Ground Speed</p>
                          <p className="text-xl font-mono font-bold tracking-tighter">{simData.groundSpeed} KTS</p>
                       </div>
                       <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800/50 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">VS Rate</p>
                          <p className={`text-xl font-mono font-bold tracking-tighter ${simData.verticalSpeed > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                             {simData.verticalSpeed > 0 ? '+' : ''}{simData.verticalSpeed} FPM
                          </p>
                       </div>
                    </div>

                    <div className="bg-slate-900/30 p-10 rounded-3xl border border-slate-800/50 flex flex-col items-center justify-center text-center">
                       <Plane size={48} className={`mb-6 ${simData.connected ? 'text-blue-500 animate-pulse' : 'text-slate-800'}`} />
                       <h4 className="text-xl font-bold uppercase tracking-tight">Telemetria MSFS</h4>
                       <p className="text-slate-500 text-sm mt-2 max-w-sm">Os eventos de decolagem, pouso e lucro operacional são registrados automaticamente através do link SimConnect.</p>
                    </div>
                 </div>

                 <div className="glass-card p-8 rounded-3xl">
                    <h3 className="text-lg font-bold mb-6 flex items-center space-x-2"><TrendingUp size={18} className="text-emerald-500"/> <span>Últimos Resultados</span></h3>
                    <div className="space-y-4">
                       {transactions.slice(0, 5).map(t => (
                          <div key={t.id} className="flex justify-between items-center p-4 bg-slate-900/30 rounded-2xl border border-slate-800/30">
                             <div>
                                <p className="text-xs font-bold text-slate-200 line-clamp-1">{t.description}</p>
                                <p className="text-[9px] text-slate-500 font-mono mt-1">{new Date(t.timestamp).toLocaleDateString()}</p>
                             </div>
                             <p className={`font-mono text-xs font-bold ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {t.type === 'credit' ? '+' : '-'}${t.amount.toLocaleString()}
                             </p>
                          </div>
                       ))}
                       {transactions.length === 0 && <p className="text-center text-slate-700 py-10 font-bold uppercase text-[10px]">Sem dados financeiros</p>}
                    </div>
                    <button onClick={() => setActiveTab('accounting')} className="w-full mt-6 py-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl text-[10px] font-bold uppercase transition-all">Ver Relatório Completo</button>
                 </div>
              </div>
           </div>
        )}

        {/* ÁREA DO PILOTO - ESCALA */}
        {activeTab === 'pilot_area' && pilotSubTab === 'roster' && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-400">
              <section className="glass-card p-8 rounded-3xl">
                 <div className="flex justify-between mb-10 items-center">
                    <div className="flex items-center space-x-4">
                       <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500 shadow-inner"><Navigation size={24}/></div>
                       <div>
                          <h3 className="text-xl font-bold">Gerenciamento de Escala</h3>
                          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-medium">Fluxo operacional e despacho de voos</p>
                       </div>
                    </div>
                    <div className="flex space-x-3 items-center bg-slate-950 p-2 rounded-2xl border border-slate-800/50">
                       <span className="text-[10px] font-bold text-slate-500 px-3 uppercase tracking-wider">Pernas:</span>
                       <select value={rosterLegsCount} onChange={e=>setRosterLegsCount(Number(e.target.value))} className="bg-slate-900 border-slate-800 border px-4 py-2 rounded-xl text-xs font-bold outline-none cursor-pointer">
                          {[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n} Voos</option>)}
                       </select>
                       <button onClick={generateRoster} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-lg shadow-blue-600/20">Gerar Rota</button>
                    </div>
                 </div>

                 <div className="space-y-4">
                    {roster.length === 0 ? (
                       <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center">
                          <Calendar size={48} className="text-slate-800 mb-4 opacity-20" />
                          <p className="text-slate-600 font-bold uppercase tracking-widest text-sm">Escala Diária Vazia</p>
                          <p className="text-slate-700 text-xs mt-1">Configure suas pernas e clique em "Gerar Rota" acima.</p>
                       </div>
                    ) : roster.map((f, i) => (
                       <div key={f.id} className={`p-6 rounded-3xl border transition-all ${f.status === 'current' ? 'border-blue-500/50 bg-blue-500/5 shadow-2xl shadow-blue-500/5 ring-1 ring-blue-500/20' : 'border-slate-800 opacity-60'}`}>
                          <div className="flex justify-between items-center">
                             <div className="flex items-center space-x-12">
                                <div className="min-w-24">
                                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Identificador</p>
                                   <p className="text-xl font-mono font-black text-blue-500">{f.flightNumber}</p>
                                </div>
                                <div className="flex items-center space-x-8 px-10 border-l border-slate-800/50">
                                   <div className="text-center">
                                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Origem</p>
                                      <p className="text-2xl font-bold tracking-tighter">{f.origin}</p>
                                   </div>
                                   <div className="flex flex-col items-center">
                                      <span className="text-[10px] text-slate-600 font-bold italic mb-1">{f.distance}NM</span>
                                      <Plane size={18} className="rotate-90 text-slate-700" />
                                   </div>
                                   <div className="text-center">
                                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Destino</p>
                                      <p className="text-2xl font-bold tracking-tighter">{f.destination}</p>
                                   </div>
                                </div>
                                <div className="grid grid-cols-3 gap-8 text-[10px] uppercase font-bold text-slate-500 border-l border-slate-800/50 pl-10">
                                   <div><p className="mb-1 opacity-50">Pax</p><p className="text-white text-xs">{f.pax}</p></div>
                                   <div><p className="mb-1 opacity-50">Cargo</p><p className="text-white text-xs">{f.cargoWeight} LB</p></div>
                                   <div><p className="mb-1 opacity-50">Block Fuel</p><p className="text-emerald-500 text-xs">{f.minFuel} LB</p></div>
                                </div>
                             </div>
                             <div className="flex items-center space-x-3">
                                {f.status === 'current' ? (
                                   <>
                                      <button onClick={() => {
                                         addToast('info', 'Abrindo SimBrief Dispatcher...');
                                         window.open(`https://www.simbrief.com/system/dispatch.php?orig=${f.origin}&dest=${f.destination}&type=${fleet[0]?.icaoType || 'A20N'}&callsign=${f.flightNumber}&airline=${company.name.substring(0,3)}`, '_blank');
                                      }} className="bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl text-[10px] font-bold hover:bg-slate-800 transition-colors uppercase tracking-wider">SimBrief</button>
                                      <button onClick={()=>setActiveTab('dashboard')} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase transition-all shadow-xl shadow-blue-600/20">Acompanhar Voo</button>
                                   </>
                                ) : f.status === 'completed' ? (
                                   <div className="text-emerald-500 bg-emerald-500/10 px-5 py-3 rounded-2xl border border-emerald-500/20 text-[10px] font-bold flex items-center space-x-2 tracking-widest uppercase">
                                      <CheckCircle size={14}/> <span>LOG ENVIADO</span>
                                   </div>
                                ) : (
                                   <div className="text-slate-700 font-bold uppercase tracking-widest text-[10px] bg-slate-900/50 px-5 py-3 rounded-2xl border border-slate-800/50">Em Espera</div>
                                )}
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </section>
           </div>
        )}

        {/* ÁREA DO PILOTO - LICENÇAS */}
        {activeTab === 'pilot_area' && pilotSubTab === 'licenses' && (
           <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {(['Light', 'Turboprop', 'SingleAisle', 'Widebody'] as LicenseCategory[]).map(cat => (
                    <div key={cat} className={`glass-card p-8 rounded-3xl border transition-all ${pilotStats.licenses.includes(cat) ? 'border-blue-500/50 bg-blue-500/5 shadow-lg shadow-blue-500/5' : 'border-slate-800/50 opacity-60'}`}>
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-xl ${pilotStats.licenses.includes(cat) ? 'bg-blue-600 text-white shadow-blue-600/20' : 'bg-slate-800 text-slate-500'}`}>
                          <ShieldCheck size={28} />
                       </div>
                       <h4 className="text-xl font-bold mb-1 tracking-tight">{cat}</h4>
                       <p className="text-[10px] text-slate-500 mb-8 uppercase font-bold tracking-widest opacity-60">Habilitação Ativa</p>
                       {pilotStats.licenses.includes(cat) ? (
                          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-widest"><CheckCircle size={14}/> <span>Certificado</span></div>
                       ) : (
                          <button onClick={() => addToast('warning', 'Módulo de Check-ride em desenvolvimento para esta categoria.')} className="w-full py-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-bold uppercase hover:bg-slate-800 transition-colors tracking-widest">Solicitar Check</button>
                       )}
                    </div>
                 ))}
              </div>
              <div className="glass-card p-8 rounded-3xl border-blue-500/20 bg-blue-900/5">
                 <div className="flex items-start space-x-4">
                    <Award className="text-blue-500 mt-1" size={24} />
                    <div>
                       <h4 className="text-lg font-bold">Progressão de Carreira</h4>
                       <p className="text-sm text-slate-500 leading-relaxed mt-2">
                          As licenças permitem a operação de aeronaves mais complexas e maiores ganhos em voos intercontinentais. 
                          O desbloqueio ocorre através de voos de avaliação (check-ride) onde a suavidade no toque (landing rate) e o 
                          cumprimento de regras IFR são auditados pela SkyLink.
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* ÁREA DO PILOTO - LOGBOOK / MANAGEMENT */}
        {activeTab === 'pilot_area' && pilotSubTab === 'management' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4">
              <div className="lg:col-span-1 space-y-6">
                 <div className="glass-card p-10 rounded-3xl border-slate-800/50 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12 scale-150"><Award size={120} /></div>
                    <div className="w-28 h-28 bg-slate-900 rounded-full mb-8 flex items-center justify-center border-4 border-blue-600/30 relative shadow-2xl">
                       <User size={56} className="text-blue-500" />
                       <div className="absolute -bottom-2 bg-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase shadow-lg">Comandante</div>
                    </div>
                    <h3 className="text-2xl font-bold uppercase tracking-tight">{company.name.split(' ')[0]} Pilot</h3>
                    <p className="text-blue-500 font-bold text-xs uppercase tracking-widest mt-3 opacity-80">{pilotStats.rank}</p>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full mt-10 overflow-hidden shadow-inner">
                       <div className="h-full bg-gradient-to-r from-blue-700 to-blue-400" style={{width: `${(pilotStats.totalHours % 50) * 2}%`}}></div>
                    </div>
                    <p className="text-[10px] text-slate-600 font-bold uppercase mt-3 tracking-widest">Experiência para Próxima Patente</p>
                 </div>

                 <div className="glass-card p-8 rounded-3xl border-slate-800/50">
                    <div className="flex items-center justify-between mb-6">
                       <h4 className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center space-x-2"><Coffee size={14}/> <span>Conditioning</span></h4>
                       <span className="text-emerald-500 font-mono font-bold text-sm tracking-tighter">Ready (94%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden mb-6 shadow-inner">
                       <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{width: '94%'}}></div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight italic opacity-70">
                       Voe com responsabilidade. Jornadas excedendo 12 horas geram multas de fadiga (-20% de lucro) por regulação de segurança.
                    </p>
                 </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                 <div className="glass-card p-8 rounded-3xl border-slate-800/50 min-h-[400px]">
                    <div className="flex items-center justify-between mb-10">
                       <h4 className="text-xl font-bold flex items-center space-x-3"><History size={22} className="text-blue-500" /> <span>Logbook de Operações</span></h4>
                       <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-500 bg-slate-900/50 px-4 py-2 rounded-xl">
                          <BarChart3 size={14}/> <span>Filtro: Recentes</span>
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                       {pilotStats.totalFlights === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 opacity-30 grayscale">
                             <FileText size={48} className="mb-4" />
                             <p className="text-xs font-bold uppercase tracking-widest">Sem Registros Ativos</p>
                          </div>
                       ) : (
                          <div className="space-y-3">
                             {[...Array(pilotStats.totalFlights > 5 ? 5 : pilotStats.totalFlights)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-5 bg-slate-900/30 border border-slate-800/30 rounded-2xl hover:border-slate-700 transition-colors group">
                                   <div className="flex items-center space-x-5">
                                      <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"><Plane size={20}/></div>
                                      <div>
                                         <p className="font-bold text-sm tracking-tight">Voo SKY-{3200 + i}</p>
                                         <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">{company.hub} → XXXX</p>
                                      </div>
                                   </div>
                                   <div className="text-right">
                                      <p className="font-mono text-sm font-bold tracking-tighter">{(1.5).toFixed(1)}h</p>
                                      <div className="flex items-center justify-end space-x-1 mt-1">
                                         <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Smooth</span>
                                         <p className="text-[10px] text-emerald-500/70 font-bold font-mono">-142 FPM</p>
                                      </div>
                                   </div>
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="glass-card p-6 rounded-3xl border-slate-800/50 flex items-center justify-between">
                       <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-wider">Média Landing</p>
                          <p className="text-2xl font-mono font-bold text-emerald-400 tracking-tighter">-120 <span className="text-xs font-normal text-slate-600">FPM</span></p>
                       </div>
                       <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500"><TrendingDown size={20}/></div>
                    </div>
                    <div className="glass-card p-6 rounded-3xl border-slate-800/50 flex items-center justify-between">
                       <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-wider">On-Time Performance</p>
                          <p className="text-2xl font-mono font-bold text-blue-400 tracking-tighter">98.5%</p>
                       </div>
                       <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500"><CheckCircle size={20}/></div>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* FINANCEIRO */}
        {activeTab === 'accounting' && (
           <div className="space-y-8 animate-in slide-in-from-right-4 duration-400">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {[
                    { label: 'Receita Total', value: transactions.filter(t=>t.type==='credit').reduce((a,b)=>a+b.amount,0), color: 'text-emerald-400', border: 'border-emerald-500/10' },
                    { label: 'Custos Totais', value: -transactions.filter(t=>t.type==='debit').reduce((a,b)=>a+b.amount,0), color: 'text-red-400', border: 'border-red-500/10' },
                    { label: 'Saldo Bancário', value: company.balance, color: 'text-blue-400', border: 'border-blue-500/20' }
                 ].map((box, i) => (
                    <div key={i} className={`glass-card p-10 rounded-3xl border-l-4 ${box.border}`}>
                       <p className="text-xs text-slate-500 font-bold uppercase mb-3 tracking-widest">{box.label}</p>
                       <p className={`text-4xl font-mono font-bold tracking-tighter ${box.color}`}>
                          ${box.value.toLocaleString()}
                       </p>
                    </div>
                 ))}
              </div>

              <section className="glass-card p-10 rounded-3xl border-slate-800/50">
                 <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xl font-bold flex items-center space-x-3"><BarChart3 size={24} className="text-slate-500"/> <span>DRE - Fluxo de Caixa</span></h3>
                    <button onClick={() => addToast('info', 'Exportando relatório em PDF...')} className="text-[10px] font-bold text-blue-500 border border-blue-500/30 px-5 py-2 rounded-xl hover:bg-blue-500/10 transition-colors uppercase tracking-widest">Exportar Dados</button>
                 </div>
                 
                 <div className="divide-y divide-slate-800/50">
                    {transactions.map(t => (
                       <div key={t.id} className="flex justify-between items-center py-6 hover:bg-slate-900/10 px-4 rounded-2xl transition-colors">
                          <div className="flex items-center space-x-6">
                             <div className={`p-3 rounded-2xl ${t.type === 'credit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                {t.type === 'credit' ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                             </div>
                             <div>
                                <p className="font-bold text-sm tracking-tight text-slate-100">{t.description}</p>
                                <div className="flex space-x-4 items-center mt-1.5">
                                   <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${t.category === 'flight_revenue' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-slate-800 text-slate-600'}`}>
                                      {t.category.replace('_', ' ')}
                                   </span>
                                   <span className="text-[10px] text-slate-600 font-mono flex items-center space-x-1">
                                      <Clock size={10} /> <span>{new Date(t.timestamp).toLocaleString()}</span>
                                   </span>
                                </div>
                             </div>
                          </div>
                          <p className={`font-mono font-bold text-xl tracking-tighter ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                             {t.type === 'credit' ? '+' : '-'}${t.amount.toLocaleString()}
                          </p>
                       </div>
                    ))}
                    {transactions.length === 0 && (
                       <div className="py-24 text-center text-slate-700 font-bold uppercase tracking-widest text-xs flex flex-col items-center">
                          <DollarSign size={48} className="mb-4 opacity-10" />
                          <span>Nenhuma Movimentação Financeira</span>
                       </div>
                    )}
                 </div>
              </section>
           </div>
        )}

        {/* MERCADO */}
        {activeTab === 'market' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in zoom-in-95 duration-400">
              {MARKET_CANDIDATES.map(p => {
                 const price = p.category === 'Widebody' ? 320000000 : p.category === 'SingleAisle' ? 85000000 : 1200000;
                 return (
                    <div key={p.id} className="glass-card p-8 rounded-3xl border-slate-800/50 hover:border-blue-500/40 transition-all flex flex-col group overflow-hidden">
                       <div className="w-full h-44 bg-slate-900 rounded-2xl mb-8 flex items-center justify-center border border-slate-800/50 group-hover:scale-[1.03] transition-transform shadow-inner relative">
                          <Plane size={56} className="text-slate-800 group-hover:text-blue-500/20 transition-colors" />
                          <div className="absolute top-4 right-4"><span className="text-[9px] font-black bg-blue-600 text-white px-3 py-1 rounded-full shadow-lg">NEW</span></div>
                       </div>
                       <h4 className="text-xl font-bold tracking-tight">{p.model}</h4>
                       <div className="flex space-x-2 mt-2 mb-8">
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-slate-800/50 rounded-lg text-slate-500 tracking-wider border border-slate-700/30">{p.icaoType}</span>
                          <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-blue-500/10 rounded-lg text-blue-500 tracking-wider border border-blue-500/10">{p.category}</span>
                       </div>
                       <div className="mt-auto">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 opacity-60">Preço de Aquisição</p>
                          <p className="text-3xl font-mono font-bold text-emerald-400 tracking-tighter mb-8">${price.toLocaleString()}</p>
                          <button onClick={()=>{ 
                             if(company.balance < price) {
                                addToast('error', "Saldo insuficiente para esta aquisição!");
                                return;
                             }
                             setFleet([...fleet, {...p, id: Math.random().toString(36).substr(2,9)}]); 
                             recordTransaction(`Aquisição Aeronave: ${p.model}`, price, 'debit', 'purchase'); 
                             addToast('success', `${p.model} adicionado à frota com sucesso!`);
                          }} className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-xs shadow-xl shadow-blue-600/20 uppercase tracking-widest transition-all">Comprar</button>
                       </div>
                    </div>
                 );
              })}
           </div>
        )}

        {/* FROTA (HANGAR) */}
        {activeTab === 'hangar' && (
           <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-left-4">
              {fleet.length === 0 ? (
                 <div className="py-48 text-center glass-card rounded-3xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center opacity-50">
                    <Plane size={64} className="text-slate-800 mb-8" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-lg">Sua Frota está Vazia</p>
                    <button onClick={()=>setActiveTab('market')} className="mt-4 text-blue-500 font-bold underline hover:text-blue-400">Visitar Mercado de Aeronaves</button>
                 </div>
              ) : fleet.map(a => (
                 <div key={a.id} className="glass-card p-10 rounded-3xl border-slate-800/50 flex justify-between items-center hover:bg-slate-900/20 transition-all border-l-8 border-l-blue-600 shadow-xl group">
                    <div className="flex items-center space-x-10">
                       <div className="p-5 bg-slate-950 rounded-2xl text-slate-600 group-hover:text-blue-500 transition-colors shadow-inner"><Plane size={36}/></div>
                       <div>
                          <h4 className="text-3xl font-bold tracking-tighter leading-none">{a.model}</h4>
                          <p className="text-sm text-slate-500 font-mono mt-2 font-black uppercase tracking-widest opacity-60">
                             {a.registration} <span className="mx-2">|</span> Categoria: {a.category}
                          </p>
                       </div>
                    </div>
                    <div className="flex space-x-16">
                       <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-widest">Localização</p>
                          <p className="font-bold tracking-tighter text-2xl text-slate-200">{a.location}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-widest">Ciclos</p>
                          <p className="font-bold tracking-tighter text-2xl text-slate-200">{a.totalCycles}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-widest">Manutenção</p>
                          <p className="font-bold tracking-tighter text-2xl text-emerald-500">{a.condition}%</p>
                       </div>
                       <div className="flex items-center ml-10">
                          <button onClick={() => addToast('info', 'Painel de Manutenção em desenvolvimento.')} className="p-4 bg-slate-900 hover:bg-slate-800 rounded-2xl transition-all text-slate-600 hover:text-white shadow-xl border border-slate-800/50 group-hover:border-blue-500/20"><Settings size={22}/></button>
                       </div>
                    </div>
                 </div>
              ))}
           </div>
        )}
      </main>
    </div>
  );
};

export default App;
