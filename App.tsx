
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SimData, SimBriefOFP, FlightLog, CompanyConfig, Aircraft, RosterFlight, Transaction, FlightEvents, PilotStats, LicenseCategory } from './types';
import { 
  Layout, Plane, CreditCard, Activity, Settings, 
  CloudDownload, MapPin, Gauge, ShoppingCart, Wrench, AlertTriangle, 
  CheckCircle, Globe, Award, List, Upload, Building2, ChevronRight, 
  TrendingUp, TrendingDown, DollarSign, Calendar, Clock, Navigation,
  Package, FileText, User, Coffee, ShieldCheck, History, BarChart3
} from 'lucide-react';

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

const RANKS = ["Cadete", "Primeiro Oficial", "Capitão", "Capitão Sênior"];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pilot_area' | 'accounting' | 'hangar' | 'market'>('dashboard');
  const [pilotSubTab, setPilotSubTab] = useState<'roster' | 'licenses' | 'management'>('roster');
  
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

  const [selectedAircraftId, setSelectedAircraftId] = useState<string>('');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [tempConfig, setTempConfig] = useState<Partial<CompanyConfig>>({ type: 'real', country: 'Brasil' });
  const [rosterLegsCount, setRosterLegsCount] = useState(1);
  const [dutyTimer, setDutyTimer] = useState<string>("00:00:00");

  const initialFuelRef = useRef<number>(0);
  const isFlyingRef = useRef<boolean>(false);
  const eventsTracked = useRef<FlightEvents>({});

  // Persistence
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
    if (fleet.length === 0) return alert("Adquira uma aeronave primeiro!");
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

    recordTransaction(`Voo ${currentLeg.flightNumber}: Passagens`, revenue, 'credit', 'flight_revenue');
    recordTransaction(`Consumo Combustível ${currentLeg.flightNumber}`, fuelCost, 'debit', 'fuel');
    recordTransaction(`Taxas Aeroportuárias ${currentLeg.destination}`, airportFees, 'debit', 'airport_fees');

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
    alert(`LOG DE VOO PROCESSADO: ${currentLeg.flightNumber}. Receita Líquida Estimada: $${(revenue - fuelCost - airportFees).toLocaleString()}`);
  }, [roster, fleet, selectedAircraftId, recordTransaction, company.dutyStartTime]);

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

  // ONBOARDING
  if (!company.setupComplete) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-xl w-full glass p-10 rounded-3xl border-slate-800 border space-y-8 animate-in fade-in zoom-in duration-300">
           <div className="text-center">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/20">
               <Building2 size={32} />
             </div>
             <h1 className="text-3xl font-bold">Configuração Inicial</h1>
             <p className="text-slate-500 mt-2">Defina as bases da sua operação</p>
           </div>
           {onboardingStep === 1 ? (
             <div className="space-y-4">
                <button onClick={() => { setTempConfig({ ...tempConfig, type: 'real' }); setOnboardingStep(2); }} className="w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                   <div><p className="font-bold text-lg">Modo Real</p><p className="text-sm text-slate-500">Operar como uma companhia existente (GOL, Azul, Delta...).</p></div>
                   <ChevronRight className="text-slate-700 group-hover:text-blue-500" />
                </button>
                <button onClick={() => { setTempConfig({ ...tempConfig, type: 'virtual' }); setOnboardingStep(2); }} className="w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                   <div><p className="font-bold text-lg">Modo Virtual</p><p className="text-sm text-slate-500">Marca própria e hubs personalizados.</p></div>
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
                   <input className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none uppercase" placeholder="HUB ICAO" onChange={(e) => setTempConfig({ ...tempConfig, hub: e.target.value })} />
                 </div>
               )}
               <div className="flex space-x-4">
                 <button onClick={() => setOnboardingStep(1)} className="flex-1 py-4 bg-slate-900 rounded-xl font-bold">Voltar</button>
                 <button onClick={() => { setCompany({ ...tempConfig, setupComplete: true, balance: 150000, reputation: 5.0 } as CompanyConfig); recordTransaction("Injeção Capital Inicial", 150000, 'credit', 'purchase'); }} disabled={!tempConfig.name} className="flex-2 w-full py-4 bg-blue-600 rounded-xl font-bold disabled:opacity-30">Confirmar</button>
               </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 glass border-r border-slate-800 flex flex-col p-6 space-y-6">
        <div className="flex items-center space-x-3 px-2 mb-4">
          <Plane className="text-blue-500" />
          <h1 className="text-lg font-bold italic tracking-tighter">SkyLink<span className="text-blue-500">OCC</span></h1>
        </div>
        
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <Layout size={18}/><span>Dashboard</span>
          </button>
          
          <div className="py-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase px-3 mb-2 tracking-widest">Operacional</p>
            <button onClick={() => { setActiveTab('pilot_area'); setPilotSubTab('roster'); }} className={`flex items-center space-x-3 w-full p-3 rounded-lg mb-1 ${activeTab === 'pilot_area' && pilotSubTab === 'roster' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
              <Calendar size={18}/><span>Escala de Voos</span>
            </button>
            <button onClick={() => { setActiveTab('pilot_area'); setPilotSubTab('licenses'); }} className={`flex items-center space-x-3 w-full p-3 rounded-lg mb-1 ${activeTab === 'pilot_area' && pilotSubTab === 'licenses' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
              <ShieldCheck size={18}/><span>Licenças</span>
            </button>
            <button onClick={() => { setActiveTab('pilot_area'); setPilotSubTab('management'); }} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'pilot_area' && pilotSubTab === 'management' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
              <User size={18}/><span>Perfil Piloto</span>
            </button>
          </div>

          <div className="py-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase px-3 mb-2 tracking-widest">Corporativo</p>
            <button onClick={() => setActiveTab('accounting')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'accounting' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
              <DollarSign size={18}/><span>Financeiro</span>
            </button>
            <button onClick={() => setActiveTab('hangar')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'hangar' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
              <Wrench size={18}/><span>Frota</span>
            </button>
            <button onClick={() => setActiveTab('market')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'market' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
              <ShoppingCart size={18}/><span>Mercado</span>
            </button>
          </div>
        </nav>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 mt-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase">SimConnect</span>
            <div className={`w-2 h-2 rounded-full ${simData.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          </div>
          <button onClick={() => setSimData(s => ({ ...s, connected: !s.connected }))} className="w-full py-2 bg-slate-800 rounded text-[10px] font-bold hover:bg-slate-700 transition-colors">
            {simData.connected ? 'ONLINE' : 'OFFLINE'}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <header className="flex justify-between items-center mb-8">
           <div className="flex items-center space-x-4">
             {company.logo && <img src={company.logo} className="h-10 w-auto" alt="" />}
             <div>
                <h2 className="text-2xl font-bold uppercase tracking-tight">{company.name}</h2>
                <p className="text-slate-500 text-sm">Base Operacional: {company.hub}</p>
             </div>
           </div>
           <div className="flex space-x-4">
              <div className="glass px-6 py-3 rounded-2xl border-emerald-500/20 border text-right">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Balanço Financeiro</p>
                <p className="text-lg font-mono text-emerald-400 font-bold">${company.balance.toLocaleString()}</p>
              </div>
           </div>
        </header>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
              <div className="glass p-6 rounded-3xl border-slate-800">
                <p className="text-xs text-slate-500 font-bold uppercase mb-4">Total de Horas</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-mono font-bold">{Math.floor(pilotStats.totalHours)}<span className="text-lg text-slate-500 font-normal">.{(pilotStats.totalHours % 1).toFixed(1).split('.')[1]}h</span></p>
                  <Clock className="text-blue-500" size={24} />
                </div>
              </div>
              <div className="glass p-6 rounded-3xl border-slate-800">
                <p className="text-xs text-slate-500 font-bold uppercase mb-4">Voos Concluídos</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-mono font-bold">{pilotStats.totalFlights}</p>
                  <Plane className="text-emerald-500" size={24} />
                </div>
              </div>
              <div className="glass p-6 rounded-3xl border-slate-800">
                <p className="text-xs text-slate-500 font-bold uppercase mb-4">Patente Atual</p>
                <div className="flex items-end justify-between">
                  <p className="text-lg font-bold">{pilotStats.rank}</p>
                  <Award className="text-yellow-500" size={24} />
                </div>
              </div>
              <div className="glass p-6 rounded-3xl border-slate-800">
                <p className="text-xs text-slate-500 font-bold uppercase mb-4">Aeronaves na Frota</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-mono font-bold">{fleet.length}</p>
                  <List className="text-slate-500" size={24} />
                </div>
              </div>
           </div>
        )}

        {/* PILOT AREA (ESCALE) */}
        {activeTab === 'pilot_area' && pilotSubTab === 'roster' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
             <section className="glass p-8 rounded-3xl border-slate-800">
                <div className="flex justify-between mb-8 items-center">
                   <div className="flex items-center space-x-4">
                      <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><Navigation /></div>
                      <div>
                        <h3 className="text-xl font-bold">Escala de Voos</h3>
                        <p className="text-xs text-slate-500">Planeje sua jornada de trabalho diária</p>
                      </div>
                   </div>
                   <div className="flex space-x-3 items-center bg-slate-900 p-2 rounded-2xl border border-slate-800">
                      <span className="text-xs font-bold text-slate-500 px-2 uppercase">Pernas:</span>
                      <select value={rosterLegsCount} onChange={e=>setRosterLegsCount(Number(e.target.value))} className="bg-slate-950 border-slate-800 border px-3 py-1 rounded-lg text-sm">
                        {[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                      <button onClick={generateRoster} className="bg-blue-600 px-6 py-2 rounded-xl text-xs font-bold uppercase hover:bg-blue-700 transition-all">GERAR ROTA</button>
                   </div>
                </div>
                <div className="space-y-4">
                   {roster.length === 0 ? (
                      <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center">
                         <Calendar size={40} className="text-slate-800 mb-4" />
                         <p className="text-slate-500">Nenhum voo na escala. Gere uma nova jornada acima.</p>
                      </div>
                   ) : roster.map((f, i) => (
                      <div key={f.id} className={`p-6 rounded-3xl border transition-all ${f.status === 'current' ? 'border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/5' : 'border-slate-800 opacity-60'}`}>
                         <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-12">
                               <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Flight</p><p className="text-xl font-mono font-black text-blue-500">{f.flightNumber}</p></div>
                               <div className="flex items-center space-x-6">
                                  <div className="text-center font-bold text-2xl tracking-tighter">{f.origin}</div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-[10px] text-slate-600 font-bold italic">{f.distance}NM</span>
                                    <Plane size={16} className="rotate-90 text-slate-700 my-1" />
                                  </div>
                                  <div className="text-center font-bold text-2xl tracking-tighter">{f.destination}</div>
                               </div>
                               <div className="flex space-x-8 text-[10px] uppercase font-bold text-slate-500 border-l border-slate-800 pl-8">
                                  <div><p>PAX</p><p className="text-white text-xs">{f.pax}</p></div>
                                  <div><p>Carga</p><p className="text-white text-xs">{f.cargoWeight} LB</p></div>
                                  <div><p>Fuel Req</p><p className="text-emerald-500 text-xs">{f.minFuel} LB</p></div>
                               </div>
                            </div>
                            <div className="flex space-x-2">
                               {f.status === 'current' ? (
                                  <>
                                     <button onClick={() => window.open(`https://www.simbrief.com/system/dispatch.php?orig=${f.origin}&dest=${f.destination}&type=${fleet[0]?.icaoType || 'A20N'}&callsign=${f.flightNumber}&airline=${company.name.substring(0,3)}`, '_blank')} className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl text-[10px] font-bold hover:bg-slate-800">SimBrief Dispatch</button>
                                     <button onClick={() => window.open('https://www.simbrief.com/system/dispatch.php?briefing=1', '_blank')} className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl text-[10px] font-bold hover:bg-slate-800">PDF Briefing</button>
                                     <button onClick={()=>setActiveTab('dashboard')} className="bg-blue-600 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase hover:bg-blue-700 shadow-xl shadow-blue-500/20">Monitorar Voo</button>
                                  </>
                               ) : f.status === 'completed' ? (
                                  <div className="text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 text-[10px] font-bold flex items-center space-x-1"><CheckCircle size={14}/> <span>CHEGADA CONFIRMADA</span></div>
                               ) : <span className="text-slate-700 text-[10px] font-bold">EM ESPERA</span>}
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </section>
          </div>
        )}

        {/* PILOT AREA (LICENSES) */}
        {activeTab === 'pilot_area' && pilotSubTab === 'licenses' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(['Light', 'Turboprop', 'SingleAisle', 'Widebody'] as LicenseCategory[]).map(cat => (
                   <div key={cat} className={`glass p-8 rounded-3xl border ${pilotStats.licenses.includes(cat) ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-800 opacity-60'}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${pilotStats.licenses.includes(cat) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                         <ShieldCheck size={24} />
                      </div>
                      <h4 className="text-xl font-bold mb-2">{cat}</h4>
                      <p className="text-xs text-slate-500 mb-6 uppercase tracking-wider">Habilitação de Categoria</p>
                      {pilotStats.licenses.includes(cat) ? (
                         <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase"><CheckCircle size={14}/> <span>Ativa</span></div>
                      ) : (
                         <button className="w-full py-3 bg-slate-800 rounded-xl text-xs font-bold uppercase hover:bg-slate-700">Realizar Check de Voo</button>
                      )}
                   </div>
                ))}
             </div>
             <section className="glass p-8 rounded-3xl border-slate-800 bg-blue-900/5">
                <h4 className="text-lg font-bold mb-4">Sobre as Licenças</h4>
                <p className="text-sm text-slate-500 leading-relaxed">As licenças são necessárias para operar aeronaves de maior porte. Para desbloquear uma nova categoria, você deve realizar um voo de check-ride com um instrutor virtual (IA) mantendo os parâmetros de voo dentro das tolerâncias (pouso suave e sem excesso de velocidade).</p>
             </section>
          </div>
        )}

        {/* PILOT AREA (PROFILE/MANAGEMENT) */}
        {activeTab === 'pilot_area' && pilotSubTab === 'management' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right-4">
             <div className="lg:col-span-1 space-y-6">
                <div className="glass p-8 rounded-3xl border-slate-800 flex flex-col items-center text-center">
                   <div className="w-24 h-24 bg-slate-800 rounded-full mb-6 flex items-center justify-center border-4 border-blue-500/20"><User size={48} className="text-blue-500" /></div>
                   <h3 className="text-2xl font-bold uppercase">Cmte. {company.name.split(' ')[0]}</h3>
                   <p className="text-blue-500 font-bold text-xs uppercase tracking-widest mt-2">{pilotStats.rank}</p>
                   <div className="w-full h-1 bg-slate-800 rounded-full mt-8 overflow-hidden"><div className="h-full bg-blue-600" style={{width: `${(pilotStats.totalHours % 50) * 2}%`}}></div></div>
                   <p className="text-[10px] text-slate-600 font-bold uppercase mt-2">Progresso para Próxima Patente</p>
                </div>
                <div className="glass p-6 rounded-3xl border-slate-800">
                   <h4 className="text-xs text-slate-500 font-bold uppercase mb-4 flex items-center space-x-2"><Coffee size={14}/> <span>Status de Fadiga</span></h4>
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold">Resistência Física</span>
                      <span className="text-emerald-500 font-mono font-bold">94%</span>
                   </div>
                   <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{width: '94%'}}></div></div>
                   <p className="text-[10px] text-slate-500 mt-4 leading-tight italic">O descanso é essencial. Jornadas acima de 12 horas reduzem a eficiência e o lucro operacional por voo em 20%.</p>
                </div>
             </div>
             <div className="lg:col-span-2 space-y-6">
                <div className="glass p-8 rounded-3xl border-slate-800">
                   <h4 className="text-xl font-bold mb-6 flex items-center space-x-3"><History size={20} className="text-blue-500" /> <span>Logbook Pessoal</span></h4>
                   <div className="space-y-4">
                      {pilotStats.totalFlights === 0 ? (
                         <div className="py-12 text-center text-slate-700 font-bold uppercase tracking-widest">Nenhum Registro de Voo Encontrado</div>
                      ) : (
                         <div className="flex flex-col space-y-3">
                            {[1, 2, 3].map(i => (
                               <div key={i} className="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800 rounded-2xl">
                                  <div className="flex items-center space-x-4">
                                     <div className="w-10 h-10 bg-blue-500/5 rounded-xl flex items-center justify-center text-blue-500"><Plane size={18}/></div>
                                     <div><p className="font-bold text-sm">Voo SKY482{i}</p><p className="text-[10px] text-slate-500">SBGR → SBSP</p></div>
                                  </div>
                                  <div className="text-right">
                                     <p className="font-mono text-xs font-bold">1.2h</p>
                                     <p className="text-[10px] text-emerald-500 font-bold uppercase">-145 FPM</p>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="glass p-6 rounded-3xl border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Média de Pouso</p>
                      <p className="text-2xl font-mono font-bold text-emerald-400">-120<span className="text-sm font-normal text-slate-500"> FPM</span></p>
                   </div>
                   <div className="glass p-6 rounded-3xl border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Pontualidade (OTP)</p>
                      <p className="text-2xl font-mono font-bold text-blue-400">98.5%</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* ACCOUNTING TAB */}
        {activeTab === 'accounting' && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="glass p-8 rounded-3xl border-emerald-500/10"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Créditos (Receitas)</p><p className="text-3xl font-mono text-emerald-400 font-bold">${transactions.filter(t=>t.type==='credit').reduce((a,b)=>a+b.amount,0).toLocaleString()}</p></div>
                 <div className="glass p-8 rounded-3xl border-red-500/10"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Débitos (Custos)</p><p className="text-3xl font-mono text-red-400 font-bold">-${transactions.filter(t=>t.type==='debit').reduce((a,b)=>a+b.amount,0).toLocaleString()}</p></div>
                 <div className="glass p-8 rounded-3xl border-blue-500/10"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Patrimônio Líquido</p><p className="text-3xl font-mono text-blue-400 font-bold">${company.balance.toLocaleString()}</p></div>
              </div>
              <section className="glass p-8 rounded-3xl border-slate-800">
                 <h3 className="text-xl font-bold mb-6 flex items-center space-x-3"><BarChart3 size={20} className="text-slate-500"/> <span>DRE - Demonstrativo de Resultados</span></h3>
                 <div className="divide-y divide-slate-800/50">
                    {transactions.map(t => (
                       <div key={t.id} className="flex justify-between items-center py-5">
                          <div>
                            <p className="font-bold text-sm tracking-tight">{t.description}</p>
                            <div className="flex space-x-3 items-center mt-1">
                               <span className={`text-[9px] font-bold uppercase px-2 py-[2px] rounded-full border ${t.category === 'flight_revenue' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-slate-700 text-slate-500'}`}>{t.category}</span>
                               <span className="text-[10px] text-slate-600 font-mono">{new Date(t.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                          <p className={`font-mono font-bold text-lg ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>{t.type==='credit'?'+':'-'}${t.amount.toLocaleString()}</p>
                       </div>
                    ))}
                    {transactions.length === 0 && <div className="py-20 text-center text-slate-700 font-bold uppercase">Nenhuma transação financeira registrada</div>}
                 </div>
              </section>
           </div>
        )}

        {/* MARKET TAB */}
        {activeTab === 'market' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in zoom-in-95 duration-300">
              {MARKET_CANDIDATES.map(p => {
                 const price = p.category === 'Widebody' ? 320000000 : p.category === 'SingleAisle' ? 85000000 : 1200000;
                 return (
                    <div key={p.id} className="glass p-8 rounded-3xl border-slate-800 hover:border-blue-500/50 transition-all flex flex-col group">
                       <div className="w-full h-40 bg-slate-900 rounded-2xl mb-6 flex items-center justify-center border border-slate-800 group-hover:scale-[1.02] transition-transform"><Plane size={48} className="text-slate-800 group-hover:text-blue-500/40 transition-colors" /></div>
                       <h4 className="text-xl font-bold">{p.model}</h4>
                       <div className="flex space-x-2 mt-1 mb-6">
                          <span className="text-[9px] font-bold uppercase px-2 py-1 bg-slate-800 rounded-md text-slate-500">{p.icaoType}</span>
                          <span className="text-[9px] font-bold uppercase px-2 py-1 bg-blue-500/10 rounded-md text-blue-500">{p.category}</span>
                       </div>
                       <p className="text-2xl font-mono font-bold text-emerald-400 mb-6">${price.toLocaleString()}</p>
                       <button onClick={()=>{ 
                          if(company.balance < price) return alert("Capital Insuficiente");
                          setFleet([...fleet, {...p, id: Math.random().toString(36).substr(2,9)}]); 
                          recordTransaction(`Aquisição Aeronave: ${p.model}`, price, 'debit', 'purchase'); 
                       }} className="w-full py-4 bg-blue-600 rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-700 uppercase">Comprar</button>
                    </div>
                 );
              })}
           </div>
        )}

        {/* HANGAR TAB */}
        {activeTab === 'hangar' && (
           <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-left-4 duration-300">
              {fleet.length === 0 ? (
                 <div className="py-40 text-center glass rounded-3xl border-2 border-dashed border-slate-800 flex flex-col items-center">
                    <Plane size={48} className="text-slate-800 mb-6" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest">Sua Frota está Vazia</p>
                    <button onClick={()=>setActiveTab('market')} className="mt-4 text-blue-500 font-bold underline">Visitar Mercado de Aeronaves</button>
                 </div>
              ) : fleet.map(a => (
                 <div key={a.id} className="glass p-8 rounded-3xl border-slate-800 flex justify-between items-center hover:bg-slate-900/40 transition-colors">
                    <div className="flex items-center space-x-8">
                       <div className="p-4 bg-slate-800 rounded-2xl text-slate-500"><Plane size={32}/></div>
                       <div>
                          <h4 className="text-2xl font-bold">{a.model}</h4>
                          <p className="text-sm text-slate-500 font-mono mt-1 font-bold">{a.registration} | Categoria: {a.category}</p>
                       </div>
                    </div>
                    <div className="flex space-x-12">
                       <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Localização</p>
                          <p className="font-bold tracking-tighter text-lg">{a.location}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Ciclos</p>
                          <p className="font-bold tracking-tighter text-lg">{a.totalCycles}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Condição</p>
                          <p className="font-bold tracking-tighter text-lg text-emerald-500">{a.condition}%</p>
                       </div>
                       <div className="flex items-center ml-8">
                          <button className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors text-slate-500 hover:text-white"><Settings size={18}/></button>
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
