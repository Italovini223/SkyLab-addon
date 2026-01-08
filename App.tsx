
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SimData, SimBriefOFP, FlightLog, CompanyConfig, Aircraft, License } from './types';
import { fetchSimBriefData } from './services/simBriefService';
import { 
  Layout, Plane, CreditCard, Activity, Settings, Database, 
  CloudDownload, MapPin, Gauge, ShoppingCart, Wrench, AlertTriangle, 
  CheckCircle, Globe, Award, List, Upload, Building2, ChevronRight
} from 'lucide-react';

const TICKET_PRICE = 165;
const FUEL_PRICE_LB = 0.88;
const AIRPORT_FEE_PER_NM = 4.5;
const HARD_LANDING_THRESHOLD = -500;
const MAINTENANCE_COST = 12000;
const CANCELLATION_PENALTY = 5000;

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
  { id: 'm1', model: 'A320neo', livery: 'Company Standard', registration: 'PR-XBI', location: 'SBGR', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 50, status: 'active' },
  { id: 'm2', model: '737-800', livery: 'Company Standard', registration: 'PR-GUM', location: 'SBSP', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 45, status: 'active' },
  { id: 'm3', model: 'C208 Grand Caravan', livery: 'Company Standard', registration: 'PS-CNT', location: 'SBMT', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 30, status: 'active' },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'flight' | 'finances' | 'hangar' | 'market' | 'licenses'>('dashboard');
  
  // Persisted State
  const [company, setCompany] = useState<CompanyConfig>(() => {
    const saved = localStorage.getItem('skyLink_company_config');
    return saved ? JSON.parse(saved) : { setupComplete: false, balance: 100000, reputation: 5.0 };
  });

  const [fleet, setFleet] = useState<Aircraft[]>(() => {
    const saved = localStorage.getItem('skyLink_fleet');
    return saved ? JSON.parse(saved) : [];
  });

  const [licenses, setLicenses] = useState<License[]>(() => {
    const saved = localStorage.getItem('skyLink_licenses');
    return saved ? JSON.parse(saved) : [
      { type: 'SingleEngine', status: 'unlocked', aircraftModels: ['C208', 'C172'] },
      { type: 'Jet', status: 'locked', aircraftModels: ['A320', 'B738', 'B737'] }
    ];
  });

  const [flightLogs, setFlightLogs] = useState<FlightLog[]>(() => {
    const saved = localStorage.getItem('skyLink_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // Transient State
  const [simData, setSimData] = useState<SimData>({
    altitude: 0, groundSpeed: 0, totalFuel: 0, onGround: true,
    verticalSpeed: 0, enginesRunning: false, parkingBrake: true, gearDown: true, connected: false
  });
  const [currentOFP, setCurrentOFP] = useState<SimBriefOFP | null>(null);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [simBriefUser, setSimBriefUser] = useState('');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [tempConfig, setTempConfig] = useState<Partial<CompanyConfig>>({ type: 'real', country: 'Brasil' });

  const initialFuelRef = useRef<number>(0);
  const isFlyingRef = useRef<boolean>(false);
  const landingVSRef = useRef<number>(0);

  // Persistence Sync
  useEffect(() => localStorage.setItem('skyLink_company_config', JSON.stringify(company)), [company]);
  useEffect(() => localStorage.setItem('skyLink_fleet', JSON.stringify(fleet)), [fleet]);
  useEffect(() => localStorage.setItem('skyLink_logs', JSON.stringify(flightLogs)), [flightLogs]);
  useEffect(() => localStorage.setItem('skyLink_licenses', JSON.stringify(licenses)), [licenses]);

  const selectedAircraft = useMemo(() => fleet.find(a => a.id === selectedAircraftId), [fleet, selectedAircraftId]);

  // Status computation for UI
  const flightStatus = useMemo(() => {
    if (!simData.connected) return "OFFLINE";
    if (simData.onGround) return simData.enginesRunning ? "TAXI / ENGINES ON" : "PARKED";
    if (simData.altitude > 500 && !simData.gearDown) return "CLIMBING";
    if (simData.gearDown && simData.altitude < 2000) return "FINAL APPROACH";
    return "EN ROUTE";
  }, [simData]);

  const handleOnboardingSubmit = () => {
    const finalConfig = { ...tempConfig, setupComplete: true, balance: 150000, reputation: 5.0 } as CompanyConfig;
    setCompany(finalConfig);
  };

  const buyAircraft = (plane: Aircraft, price: number) => {
    if (company.balance < price) return alert("Saldo Insuficiente!");
    const newPlane = { ...plane, id: Math.random().toString(36).substr(2, 9), status: 'active' as const };
    setFleet(prev => [...prev, newPlane]);
    setCompany(prev => ({ ...prev, balance: prev.balance - price }));
    alert(`Aeronave adquirida com sucesso.`);
  };

  const cancelFlight = () => {
    if (currentOFP) {
      if (confirm("Cancelar este voo? Uma multa de realocação de passageiros de $5,000 será aplicada.")) {
        setCompany(prev => ({ ...prev, balance: prev.balance - CANCELLATION_PENALTY }));
        setCurrentOFP(null);
        setSelectedAircraftId('');
      }
    }
  };

  const finalizeFlight = useCallback((finalFuel: number, finalVS: number) => {
    if (!currentOFP || !selectedAircraft) return;

    const isCheckride = selectedAircraft.status === 'checkride';
    const fuelUsed = Math.max(0, initialFuelRef.current - finalFuel);
    const distanceEstimate = currentOFP.plannedEte / 3600 * 450; // simple mock
    const revenue = isCheckride ? 0 : currentOFP.paxCount * TICKET_PRICE;
    let expenses = (fuelUsed * FUEL_PRICE_LB) + (distanceEstimate * AIRPORT_FEE_PER_NM);
    
    if (finalVS < HARD_LANDING_THRESHOLD) {
      expenses += 5000;
      alert("Pouso Duro detectado. Taxa de inspeção de danos aplicada.");
    }

    const profit = revenue - expenses;

    // Type Rating Unlock logic
    if (isCheckride && finalVS > -400) {
      setLicenses(prev => prev.map(l => l.aircraftModels.some(m => selectedAircraft.model.includes(m)) ? { ...l, status: 'unlocked' } : l));
      alert("Type Rating desbloqueado com sucesso!");
    }

    setFleet(prev => prev.map(a => a.id === selectedAircraftId ? {
      ...a,
      location: currentOFP.destination,
      totalHours: a.totalHours + (currentOFP.plannedEte / 3600),
      totalCycles: a.totalCycles + 1,
      status: 'active'
    } : a));

    setFlightLogs(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      origin: currentOFP.origin,
      destination: currentOFP.destination,
      pax: currentOFP.paxCount,
      fuelUsed: Math.round(fuelUsed),
      revenue: Math.round(revenue),
      expenses: Math.round(expenses),
      profit: Math.round(profit),
      landingRate: Math.round(finalVS),
      timestamp: Date.now(),
      aircraftId: selectedAircraftId,
      type: isCheckride ? 'checkride' : 'regular'
    }, ...prev]);

    setCompany(prev => ({ ...prev, balance: prev.balance + profit }));
    setCurrentOFP(null);
    setSelectedAircraftId('');
  }, [currentOFP, selectedAircraft, selectedAircraftId]);

  useEffect(() => {
    if (!simData.connected) return;
    if (!simData.onGround && !isFlyingRef.current) {
      isFlyingRef.current = true;
      initialFuelRef.current = simData.totalFuel;
    }
    if (simData.onGround && isFlyingRef.current && landingVSRef.current === 0) {
      landingVSRef.current = simData.verticalSpeed;
    }
    if (simData.onGround && isFlyingRef.current && !simData.enginesRunning && simData.parkingBrake) {
      isFlyingRef.current = false;
      finalizeFlight(simData.totalFuel, landingVSRef.current);
      landingVSRef.current = 0;
    }
  }, [simData, finalizeFlight]);

  // ONBOARDING VIEW
  if (!company.setupComplete) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6 overflow-hidden">
        <div className="max-w-xl w-full glass p-10 rounded-3xl border-slate-800 border space-y-8 animate-in fade-in zoom-in duration-300">
           <div className="text-center">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/20">
               <Building2 size={32} />
             </div>
             <h1 className="text-3xl font-bold">Fundação da Companhia</h1>
             <p className="text-slate-500 mt-2">Configure os dados iniciais da sua operação aérea.</p>
           </div>

           {onboardingStep === 1 && (
             <div className="space-y-4">
                <button onClick={() => { setTempConfig({ ...tempConfig, type: 'real' }); setOnboardingStep(2); }} className="w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group">
                   <div className="text-left">
                     <p className="font-bold text-lg">Companhia Real</p>
                     <p className="text-sm text-slate-500">Use dados e logos de uma empresa existente.</p>
                   </div>
                   <ChevronRight className="text-slate-700 group-hover:text-blue-500" />
                </button>
                <button onClick={() => { setTempConfig({ ...tempConfig, type: 'virtual' }); setOnboardingStep(2); }} className="w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group">
                   <div className="text-left">
                     <p className="font-bold text-lg">Companhia Virtual</p>
                     <p className="text-sm text-slate-500">Crie seu próprio nome, logo e identidade.</p>
                   </div>
                   <ChevronRight className="text-slate-700 group-hover:text-blue-500" />
                </button>
             </div>
           )}

           {onboardingStep === 2 && (
             <div className="space-y-6 animate-in slide-in-from-right-4">
               {tempConfig.type === 'real' ? (
                 <>
                   <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-500 uppercase">País de Operação</label>
                     <select 
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none"
                      onChange={(e) => setTempConfig({ ...tempConfig, country: e.target.value })}
                     >
                       <option value="Brasil">Brasil</option>
                       <option value="USA">USA</option>
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-500 uppercase">Selecione a Empresa</label>
                     <div className="grid grid-cols-1 gap-2">
                       {REAL_AIRLINES[tempConfig.country || 'Brasil'].map((air: any) => (
                         <button 
                          key={air.name}
                          onClick={() => setTempConfig({ ...tempConfig, name: air.name, logo: air.logo, hub: air.hub })}
                          className={`p-4 border rounded-xl flex items-center space-x-4 transition-all ${tempConfig.name === air.name ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 hover:border-slate-700'}`}
                         >
                            <img src={air.logo} className="h-6 w-auto grayscale" />
                            <span className="font-bold">{air.name}</span>
                         </button>
                       ))}
                     </div>
                   </div>
                 </>
               ) : (
                 <>
                   <div className="space-y-4">
                     <div>
                       <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Nome da Companhia</label>
                       <input 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500" 
                        placeholder="Ex: SkyHigh VA"
                        onChange={(e) => setTempConfig({ ...tempConfig, name: e.target.value })}
                       />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Código ICAO da Sede (HUB)</label>
                       <input 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 uppercase" 
                        placeholder="Ex: SBGR"
                        onChange={(e) => setTempConfig({ ...tempConfig, hub: e.target.value })}
                       />
                     </div>
                     <div className="border-2 border-dashed border-slate-800 p-8 rounded-2xl text-center">
                        <Upload className="mx-auto text-slate-700 mb-2" />
                        <p className="text-sm text-slate-500">Upload do Logo (PNG)</p>
                     </div>
                   </div>
                 </>
               )}
               <div className="flex space-x-4 pt-4">
                 <button onClick={() => setOnboardingStep(1)} className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold">Voltar</button>
                 <button 
                  onClick={handleOnboardingSubmit}
                  disabled={!tempConfig.name}
                  className="flex-2 w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 rounded-xl font-bold shadow-lg shadow-blue-500/20"
                 >
                   Finalizar Setup
                 </button>
               </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  // MAIN APP VIEW
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 glass border-r border-slate-800 flex flex-col p-6 space-y-6">
        <div className="flex items-center space-x-3 px-2 mb-4">
          <img src={company.logo} className="h-8 w-auto" alt="Logo" />
          <h1 className="text-lg font-bold tracking-tight">{company.name.split(' ')[0]}<span className="text-blue-500">VA</span></h1>
        </div>

        <nav className="flex-1 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Layout size={20}/><span>Dashboard</span></button>
          <button onClick={() => setActiveTab('flight')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'flight' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Activity size={20}/><span>Live Monitor</span></button>
          <button onClick={() => setActiveTab('hangar')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'hangar' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Wrench size={20}/><span>Hangar</span></button>
          <button onClick={() => setActiveTab('market')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'market' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><ShoppingCart size={20}/><span>Mercado</span></button>
          <button onClick={() => setActiveTab('licenses')} className={`flex items-center space-x-3 w-full p-3 rounded-lg ${activeTab === 'licenses' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Award size={20}/><span>Licenças</span></button>
        </nav>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-bold">SIM STATUS</span>
            <div className={`w-2 h-2 rounded-full ${simData.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
          <button onClick={() => setSimData(s => ({ ...s, connected: !s.connected }))} className="w-full py-2 bg-slate-800 rounded text-[10px] font-bold">
            {simData.connected ? 'DESCONECTAR' : 'CONECTAR MSFS'}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 relative">
        <header className="flex justify-between items-center mb-8">
           <div>
             <h2 className="text-3xl font-bold tracking-tight">Status: <span className="text-blue-500">{flightStatus}</span></h2>
             <p className="text-slate-500">Reputação: {company.reputation.toFixed(1)}/5.0 • Hub: {company.hub}</p>
           </div>
           <div className="glass px-6 py-3 rounded-2xl border-emerald-500/20 border">
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Saldo Caixa</p>
             <p className="text-xl font-mono text-emerald-400 font-bold">${company.balance.toLocaleString()}</p>
           </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="glass p-8 rounded-3xl">
                <h3 className="text-xl font-bold mb-6 flex items-center space-x-3"><CloudDownload className="text-blue-500" /><span>Escala de Voo</span></h3>
                <div className="flex space-x-4 mb-6">
                  <input value={simBriefUser} onChange={e => setSimBriefUser(e.target.value)} placeholder="SimBrief User" className="flex-1 bg-slate-900 border-slate-800 border p-3 rounded-xl" />
                  <button onClick={async () => {
                    setIsImporting(true);
                    try { const d = await fetchSimBriefData(simBriefUser); setCurrentOFP(d as any); } catch(e) { alert("Erro ao importar"); } finally { setIsImporting(false); }
                  }} className="bg-blue-600 px-8 rounded-xl font-bold">{isImporting ? '...' : 'Importar OFP'}</button>
                </div>
                {currentOFP && (
                  <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
                    <div className="flex justify-between items-center mb-6">
                       <div className="text-center"><p className="text-xs text-slate-500">DE</p><p className="text-3xl font-bold">{currentOFP.origin}</p></div>
                       <ChevronRight className="text-slate-800" size={32} />
                       <div className="text-center"><p className="text-xs text-slate-500">PARA</p><p className="text-3xl font-bold">{currentOFP.destination}</p></div>
                    </div>
                    <div className="space-y-3">
                       <label className="text-xs font-bold text-slate-500">AERONAVE DISPONÍVEL NESTA LOCALIZAÇÃO:</label>
                       {fleet.filter(a => a.location === currentOFP.origin).map(a => (
                         <button 
                          key={a.id} 
                          onClick={() => setSelectedAircraftId(a.id)}
                          className={`w-full p-4 rounded-xl border text-left ${selectedAircraftId === a.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800'}`}
                         >
                            <p className="font-bold">{a.model} ({a.registration})</p>
                            <p className="text-xs text-slate-500">{a.livery} • Condição: {a.condition}%</p>
                         </button>
                       ))}
                       {fleet.filter(a => a.location === currentOFP.origin).length === 0 && <p className="text-red-500 text-xs italic font-bold">Nenhuma aeronave disponível em {currentOFP.origin}!</p>}
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <div className="glass p-6 rounded-3xl">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">Métricas Rápidas</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Vôos Realizados</span>
                    <span className="font-bold">{flightLogs.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Lucratividade</span>
                    <span className="font-bold text-emerald-500">+18.5%</span>
                  </div>
                </div>
              </div>
              {currentOFP && (
                <button onClick={cancelFlight} className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-bold flex items-center justify-center space-x-2">
                  <AlertTriangle size={18} /><span>Cancelar Planejamento</span>
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'licenses' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
             <h3 className="text-2xl font-bold">Centro de Treinamento e Licenças</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {licenses.map(lic => (
                  <div key={lic.type} className={`glass p-8 rounded-3xl border ${lic.status === 'unlocked' ? 'border-emerald-500/20' : 'border-slate-800 opacity-70'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{lic.type} Rating</p>
                        <h4 className="text-2xl font-bold">{lic.status === 'unlocked' ? 'Habilitado' : 'Bloqueado'}</h4>
                      </div>
                      <Award size={40} className={lic.status === 'unlocked' ? 'text-emerald-500' : 'text-slate-700'} />
                    </div>
                    <div className="space-y-2 mb-8">
                       <p className="text-xs text-slate-400">Modelos Cobertos:</p>
                       <div className="flex flex-wrap gap-2">
                         {lic.aircraftModels.map(m => <span key={m} className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">{m}</span>)}
                       </div>
                    </div>
                    {lic.status === 'locked' && (
                      <button className="w-full py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-700">INICIAR VOO DE CHECK</button>
                    )}
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'flight' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass p-6 rounded-2xl"><p className="text-xs text-slate-500 mb-1">ALTITUDE</p><p className="text-2xl font-mono font-bold">{simData.altitude.toLocaleString()} FT</p></div>
              <div className="glass p-6 rounded-2xl"><p className="text-xs text-slate-500 mb-1">GND SPEED</p><p className="text-2xl font-mono font-bold">{simData.groundSpeed} KTS</p></div>
              <div className="glass p-6 rounded-2xl"><p className="text-xs text-slate-500 mb-1">VS RATE</p><p className="text-2xl font-mono font-bold">{simData.verticalSpeed} FPM</p></div>
              <div className="glass p-6 rounded-2xl"><p className="text-xs text-slate-500 mb-1">TREM DE POUSO</p><p className={`text-2xl font-mono font-bold ${simData.gearDown ? 'text-emerald-500' : 'text-slate-600'}`}>{simData.gearDown ? 'DOWN' : 'UP'}</p></div>
            </div>
            
            <div className="glass p-10 rounded-3xl flex flex-col items-center justify-center space-y-6">
               <div className={`p-8 rounded-full ${simData.connected ? 'bg-blue-600/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'} border-4 animate-pulse`}>
                  <Activity size={48} className={simData.connected ? 'text-blue-500' : 'text-red-500'} />
               </div>
               <div className="text-center">
                 <h4 className="text-xl font-bold">{simData.connected ? 'Monitoramento Ativo' : 'Simulador Desconectado'}</h4>
                 <p className="text-slate-500 max-w-sm mt-2">Status atual: {flightStatus}. O registro de voo é automático após desligar motores e acionar freio de estacionamento no destino.</p>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
