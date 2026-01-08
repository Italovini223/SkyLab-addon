
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SimData, SimBriefOFP, FlightLog, CompanyConfig, Aircraft, RosterFlight, Transaction, FlightEvents } from './types';
import { 
  Layout, Plane, CreditCard, Activity, Settings, 
  CloudDownload, MapPin, Gauge, ShoppingCart, Wrench, AlertTriangle, 
  CheckCircle, Globe, Award, List, Upload, Building2, ChevronRight, 
  TrendingUp, TrendingDown, DollarSign, Calendar, Clock, Navigation,
  Package, FileText, User, Coffee
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
  { id: 'm1', model: 'A320neo', icaoType: 'A20N', livery: 'Standard', registration: 'PR-XBI', location: 'SBGR', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 50, status: 'active', maxPax: 174, emptyWeight: 90000 },
  { id: 'm2', model: '737-800', icaoType: 'B738', livery: 'Standard', registration: 'PR-GUM', location: 'SBSP', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 45, status: 'active', maxPax: 186, emptyWeight: 91000 },
  { id: 'm3', model: 'C208 Grand Caravan', icaoType: 'C208', livery: 'Standard', registration: 'PS-CNT', location: 'SBMT', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 30, status: 'active', maxPax: 9, emptyWeight: 4500 },
];

const AIRPORTS_BY_REGION: Record<string, string[]> = {
  "Brasil": ["SBGR", "SBSP", "SBGL", "SBRJ", "SBKP", "SBCF", "SBPA", "SBCT", "SBRF", "SBSV", "SBFZ", "SBBE"],
  "USA": ["KATL", "KLAX", "KORD", "KDFW", "KJFK", "KSFO", "KSEA", "KMIA", "KEWR", "KCLT", "KPHX", "KMCO"]
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'flight' | 'accounting' | 'hangar' | 'market' | 'roster'>('dashboard');
  
  const [company, setCompany] = useState<CompanyConfig>(() => {
    const saved = localStorage.getItem('skyLink_company_config');
    return saved ? JSON.parse(saved) : { setupComplete: false, balance: 150000, reputation: 5.0 };
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
    localStorage.setItem('skyLink_fleet', JSON.stringify(fleet));
    localStorage.setItem('skyLink_roster', JSON.stringify(roster));
    localStorage.setItem('skyLink_transactions', JSON.stringify(transactions));
  }, [company, fleet, roster, transactions]);

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

    recordTransaction(`Flight ${currentLeg.flightNumber} Profit`, revenue, 'credit', 'flight_revenue');
    recordTransaction(`Fuel Bill ${currentLeg.flightNumber}`, fuelCost, 'debit', 'fuel');
    recordTransaction(`Airport Fees ${currentLeg.destination}`, airportFees, 'debit', 'airport_fees');

    const updatedRoster = roster.map(l => {
      if (l.id === currentLeg.id) return { ...l, status: 'completed' as const, events: { ...eventsTracked.current, engineShutdown: Date.now() } };
      return l;
    });

    const currentIdx = roster.findIndex(l => l.id === currentLeg.id);
    if (updatedRoster[currentIdx + 1]) updatedRoster[currentIdx + 1].status = 'current';

    setRoster(updatedRoster);
    setFleet(prev => prev.map(a => a.id === selectedAircraftId ? { ...a, location: currentLeg.destination, totalCycles: a.totalCycles + 1 } : a));
    eventsTracked.current = {};
    alert(`Flight Complete: ${currentLeg.flightNumber}`);
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

  // ONBOARDING VIEW
  if (!company.setupComplete) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-xl w-full glass p-10 rounded-3xl border-slate-800 border space-y-8 animate-in fade-in zoom-in duration-300">
           <div className="text-center">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/20">
               <Building2 size={32} />
             </div>
             <h1 className="text-3xl font-bold">Início da Jornada</h1>
             <p className="text-slate-500 mt-2">Fundação da sua Companhia Aérea Virtual</p>
           </div>
           {onboardingStep === 1 ? (
             <div className="space-y-4">
                <button onClick={() => { setTempConfig({ ...tempConfig, type: 'real' }); setOnboardingStep(2); }} className="w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                   <div><p className="font-bold text-lg">Modo Real</p><p className="text-sm text-slate-500">Opere uma empresa que já existe no mundo real.</p></div>
                   <ChevronRight className="text-slate-700 group-hover:text-blue-500" />
                </button>
                <button onClick={() => { setTempConfig({ ...tempConfig, type: 'virtual' }); setOnboardingStep(2); }} className="w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                   <div><p className="font-bold text-lg">Modo Virtual</p><p className="text-sm text-slate-500">Crie sua própria marca do zero.</p></div>
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
                 <button onClick={() => setOnboardingStep(1)} className="flex-1 py-4 bg-slate-900 rounded-xl font-bold">Voltar</button>
                 <button onClick={() => { setCompany({ ...tempConfig, setupComplete: true, balance: 150000, reputation: 5.0 } as CompanyConfig); recordTransaction("Capital Inicial", 150000, 'credit', 'purchase'); }} disabled={!tempConfig.name} className="flex-2 w-full py-4 bg-blue-600 rounded-xl font-bold disabled:opacity-30">Finalizar Setup</button>
               </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden">
      <aside className="w-64 glass border-r border-slate-800 flex flex-col p-6 space-y-6">
        <div className="flex items-center space-x-3 px-2 mb-4">
          <Plane className="text-blue-500" />
          <h1 className="text-lg font-bold italic tracking-tighter">SkyLink<span className="text-blue-500">OCC</span></h1>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Layout size={18}/><span>Dashboard</span></button>
          <button onClick={() => setActiveTab('roster')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'roster' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Calendar size={18}/><span>Área do Piloto</span></button>
          <button onClick={() => setActiveTab('accounting')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'accounting' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><DollarSign size={18}/><span>Financeiro</span></button>
          <button onClick={() => setActiveTab('hangar')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'hangar' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Wrench size={18}/><span>Frota</span></button>
          <button onClick={() => setActiveTab('market')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'market' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><ShoppingCart size={18}/><span>Mercado</span></button>
        </nav>
        {company.dutyStartTime && (
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Jornada (Duty)</span>
            <p className="text-lg font-mono font-bold text-blue-400">{dutyTimer}</p>
          </div>
        )}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase">SimConnect</span>
            <div className={`w-2 h-2 rounded-full ${simData.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
          <button onClick={() => setSimData(s => ({ ...s, connected: !s.connected }))} className="w-full py-2 bg-slate-800 rounded text-[10px] font-bold">{simData.connected ? 'ONLINE' : 'OFFLINE'}</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 relative">
        <header className="flex justify-between items-center mb-8">
           <div className="flex items-center space-x-4">
             {company.logo && <img src={company.logo} className="h-10 w-auto" alt="" />}
             <div><h2 className="text-2xl font-bold uppercase tracking-tight">{company.name}</h2><p className="text-slate-500 text-sm">Base: {company.hub}</p></div>
           </div>
           <div className="glass px-6 py-3 rounded-2xl border-emerald-500/20 border text-right">
             <p className="text-[10px] text-slate-500 font-bold uppercase">Saldo</p>
             <p className="text-lg font-mono text-emerald-400 font-bold">${company.balance.toLocaleString()}</p>
           </div>
        </header>

        {activeTab === 'roster' && (
          <div className="space-y-6 animate-in fade-in duration-300">
             <section className="glass p-8 rounded-3xl border-slate-800">
                <div className="flex justify-between mb-8">
                   <div className="flex items-center space-x-4"><Navigation className="text-blue-500" /><div><h3 className="text-xl font-bold">Gerenciamento de Escala</h3><p className="text-xs text-slate-500">Controle de pernas e despacho operacional</p></div></div>
                   <div className="flex space-x-3 items-center">
                      <select value={rosterLegsCount} onChange={e=>setRosterLegsCount(Number(e.target.value))} className="bg-slate-900 border-slate-800 border px-3 py-1 rounded-lg text-sm">
                        {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} Pernas</option>)}
                      </select>
                      <button onClick={generateRoster} className="bg-blue-600 px-6 py-2 rounded-xl text-xs font-bold uppercase">Gerar Escala</button>
                   </div>
                </div>
                <div className="space-y-4">
                   {roster.map((f, i) => (
                      <div key={f.id} className={`p-6 rounded-3xl border transition-all ${f.status === 'current' ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20' : 'border-slate-800 opacity-60'}`}>
                         <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-8">
                               <div><p className="text-[10px] text-slate-500 font-bold">Voo</p><p className="text-xl font-mono font-black">{f.flightNumber}</p></div>
                               <div className="flex items-center space-x-4">
                                  <div className="text-center font-bold text-lg">{f.origin}</div>
                                  <Plane size={14} className="rotate-90 text-slate-700" />
                                  <div className="text-center font-bold text-lg">{f.destination}</div>
                               </div>
                               <div className="flex space-x-6 text-[10px] uppercase font-bold text-slate-500 border-l border-slate-800 pl-8">
                                  <div><p>Pax</p><p className="text-white text-xs">{f.pax}</p></div>
                                  <div><p>Cargo</p><p className="text-white text-xs">{f.cargoWeight} Lbs</p></div>
                                  <div><p>Fuel Req</p><p className="text-emerald-500 text-xs">{f.minFuel} Lbs</p></div>
                               </div>
                            </div>
                            <div className="flex space-x-2">
                               {f.status === 'current' ? (
                                  <>
                                     <button onClick={() => window.open(`https://www.simbrief.com/system/dispatch.php?orig=${f.origin}&dest=${f.destination}&type=${fleet[0]?.icaoType || 'A20N'}&callsign=${f.flightNumber}&airline=${company.name.substring(0,3)}`, '_blank')} className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-[10px] font-bold">SimBrief Dispatch</button>
                                     <button onClick={() => window.open('https://www.simbrief.com/system/dispatch.php?briefing=1', '_blank')} className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-[10px] font-bold">View PDF</button>
                                     <button onClick={()=>setActiveTab('flight')} className="bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-bold uppercase">Voo em Progresso</button>
                                  </>
                               ) : f.status === 'completed' ? (
                                  <div className="text-emerald-500 text-[10px] font-bold flex items-center space-x-1"><CheckCircle size={12}/> <span>Finalizado</span></div>
                               ) : <span>Pending</span>}
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </section>
          </div>
        )}

        {activeTab === 'accounting' && (
           <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="glass p-8 rounded-3xl border-emerald-500/10"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Total Receitas</p><p className="text-3xl font-mono text-emerald-400 font-bold">${transactions.filter(t=>t.type==='credit').reduce((a,b)=>a+b.amount,0).toLocaleString()}</p></div>
                 <div className="glass p-8 rounded-3xl border-red-500/10"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Total Despesas</p><p className="text-3xl font-mono text-red-400 font-bold">-${transactions.filter(t=>t.type==='debit').reduce((a,b)=>a+b.amount,0).toLocaleString()}</p></div>
                 <div className="glass p-8 rounded-3xl border-blue-500/10"><p className="text-xs text-slate-500 font-bold uppercase mb-2">Balanço</p><p className="text-3xl font-mono text-blue-400 font-bold">${(transactions.filter(t=>t.type==='credit').reduce((a,b)=>a+b.amount,0) - transactions.filter(t=>t.type==='debit').reduce((a,b)=>a+b.amount,0)).toLocaleString()}</p></div>
              </div>
              <section className="glass p-8 rounded-3xl border-slate-800">
                 <h3 className="text-xl font-bold mb-6">Transações</h3>
                 <div className="divide-y divide-slate-800">
                    {transactions.map(t => (
                       <div key={t.id} className="flex justify-between items-center py-4">
                          <div><p className="font-bold text-sm">{t.description}</p><p className="text-[10px] text-slate-500">{new Date(t.timestamp).toLocaleString()}</p></div>
                          <p className={`font-mono font-bold ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>{t.type==='credit'?'+':'-'}${t.amount.toLocaleString()}</p>
                       </div>
                    ))}
                 </div>
              </section>
           </div>
        )}

        {activeTab === 'flight' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
             <div className="grid grid-cols-4 gap-4">
               <div className="glass p-6 rounded-2xl text-center"><p className="text-xs text-slate-500 uppercase">Altitude</p><p className="text-2xl font-mono font-bold">{simData.altitude} FT</p></div>
               <div className="glass p-6 rounded-2xl text-center"><p className="text-xs text-slate-500 uppercase">GS</p><p className="text-2xl font-mono font-bold">{simData.groundSpeed} KTS</p></div>
               <div className="glass p-6 rounded-2xl text-center"><p className="text-xs text-slate-500 uppercase">VS</p><p className="text-2xl font-mono font-bold">{simData.verticalSpeed} FPM</p></div>
               <div className="glass p-6 rounded-2xl text-center"><p className="text-xs text-slate-500 uppercase">Status</p><p className={`text-xl font-bold ${simData.connected ? 'text-emerald-500':'text-red-500'}`}>{simData.connected ? 'LIVE':'OFFLINE'}</p></div>
             </div>
             <div className="glass p-12 rounded-3xl flex flex-col items-center justify-center space-y-6">
                <Activity size={64} className={simData.connected ? 'text-blue-500 animate-pulse' : 'text-slate-700'} />
                <h4 className="text-2xl font-bold uppercase tracking-tighter text-center">Monitoramento Operacional Ativo</h4>
                <p className="text-slate-500 max-w-md text-center">Registrando eventos OOOI automaticamente. Finalize o voo no destino desligando motores e parking brake.</p>
             </div>
          </div>
        )}

        {activeTab === 'market' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95">
             {MARKET_CANDIDATES.map(p => (
                <div key={p.id} className="glass p-8 rounded-3xl border-slate-800 flex flex-col">
                   <div className="w-full h-40 bg-slate-900 rounded-2xl mb-6 flex items-center justify-center border border-slate-800"><Plane size={48} className="text-slate-800" /></div>
                   <h4 className="text-xl font-bold">{p.model}</h4>
                   <p className="text-2xl font-mono font-bold text-emerald-400 mb-6">${p.model.includes('A320') ? '45,000,000' : '1,500,000'}</p>
                   <button onClick={()=>{ setFleet([...fleet, {...p, id: Math.random().toString(36).substr(2,9)}]); recordTransaction(`Purchase ${p.model}`, 1500000, 'debit', 'purchase'); }} className="w-full py-4 bg-blue-600 rounded-2xl font-bold text-xs">ADQUIRIR</button>
                </div>
             ))}
          </div>
        )}

        {activeTab === 'hangar' && (
           <div className="grid grid-cols-1 gap-6">
              {fleet.map(a => (
                 <div key={a.id} className="glass p-6 rounded-3xl border-slate-800 flex justify-between items-center">
                    <div><h4 className="text-xl font-bold">{a.model}</h4><p className="text-xs text-slate-500 uppercase font-mono">{a.registration} | Location: {a.location}</p></div>
                    <div className="flex space-x-8">
                       <div className="text-center"><p className="text-[10px] text-slate-500 font-bold uppercase">Cycles</p><p className="font-bold">{a.totalCycles}</p></div>
                       <div className="text-center"><p className="text-[10px] text-slate-500 font-bold uppercase">Condition</p><p className="font-bold text-emerald-500">{a.condition}%</p></div>
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
