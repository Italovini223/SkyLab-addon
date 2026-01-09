
import React, { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import { 
  SimData, CompanyConfig, Aircraft, RosterFlight, Transaction, 
  PilotStats, LicenseCategory, Toast, ToastType 
} from './types';
import { 
  Layout, Plane, Activity, Settings, Wrench, AlertTriangle, 
  CheckCircle, Award, List, Building2, ChevronRight, 
  TrendingUp, TrendingDown, DollarSign, Calendar, Clock, Navigation,
  User, Coffee, ShieldCheck, History, BarChart3, X, Info, ShoppingCart
} from 'lucide-react';

// --- CONSTANTES DE NEGÓCIO ---
const TICKET_PRICE = 165;
const FUEL_PRICE_LB = 0.88;
const AIRPORT_FEE_PER_NM = 4.5;
const DUTY_LIMIT_MS = 12 * 60 * 60 * 1000;
const FATIGUE_PENALTY = 0.20;

// Estrutura de Rotas Reais Sugeridas (Exemplo para expansão)
const REAL_WORLD_ROUTES: Record<string, string[]> = {
  "SBKP": ["SBRJ", "SBCF", "SBGL", "SBCG", "SBPA", "SBFL", "SBCT", "SBBR", "SBCY", "SBGO", "SBFZ", "SBRF"],
  "SBGR": ["SBSP", "SBRJ", "SBGL", "SBCF", "SBPA", "SBCT", "SBRF", "SBSV", "SBFZ", "SBBE", "SBBR", "SBCG"],
  "SBSP": ["SBGR", "SBRJ", "SBCF", "SBCG", "SBPA", "SBCT", "SBBR", "SBCY", "SBGO", "SBGL"],
  "SBRJ": ["SBSP", "SBGR", "SBKP", "SBCF", "SBBR", "SBCT"],
  "SBGL": ["SBGR", "SBKP", "SBCF", "SBRF", "SBSV", "SBPA", "SBCT"],
  "KATL": ["KJFK", "KLAX", "KORD", "KDFW", "KMIA", "KMCO", "KCLT", "KSFO", "KSEA"],
  "KLAX": ["KATL", "KORD", "KJFK", "KSFO", "KSEA", "KPHX", "KLAS", "KDEN"],
  "KJFK": ["KLAX", "KORD", "KATL", "KSFO", "KMIA", "KBOS", "KIAD"]
};

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
  { id: 'm2', model: '737-800', icaoType: 'B738', livery: 'Standard', registration: 'PR-GUM', location: 'SBGR', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 45, status: 'active', maxPax: 186, emptyWeight: 91000, category: 'SingleAisle' },
  { id: 'm3', model: 'C208 Grand Caravan', icaoType: 'C208', livery: 'Standard', registration: 'PS-CNT', location: 'SBKP', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 30, status: 'active', maxPax: 9, emptyWeight: 4500, category: 'Turboprop' },
  { id: 'm4', model: 'A350-900', icaoType: 'A359', livery: 'Standard', registration: 'PR-AOW', location: 'SBGR', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 100, status: 'active', maxPax: 334, emptyWeight: 250000, category: 'Widebody' },
];

const AIRPORTS_BY_REGION: Record<string, string[]> = {
  "Brasil": ["SBGR", "SBSP", "SBGL", "SBRJ", "SBKP", "SBCF", "SBPA", "SBCT", "SBRF", "SBSV", "SBFZ", "SBBE"],
  "USA": ["KATL", "KLAX", "KORD", "KDFW", "KJFK", "KSFO", "KSEA", "KMIA", "KEWR", "KCLT", "KPHX", "KMCO"]
};

// --- CONTEXTO DE ESTADO (STORE/VIEWMODEL) ---
interface AppContextType {
  company: CompanyConfig;
  pilotStats: PilotStats;
  fleet: Aircraft[];
  roster: RosterFlight[];
  transactions: Transaction[];
  simData: SimData;
  activeTab: string;
  pilotSubTab: string;
  toasts: Toast[];
  setActiveTab: (tab: string) => void;
  setPilotSubTab: (tab: string) => void;
  notify: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
  recordTransaction: (description: string, amount: number, type: 'credit' | 'debit', category: Transaction['category']) => void;
  updateCompany: (config: Partial<CompanyConfig>) => void;
  updatePilotStats: (stats: Partial<PilotStats>) => void;
  addToFleet: (aircraft: Aircraft) => void;
  generateRoster: (legs: number) => void;
  finalizeFlight: (finalFuel: number, finalVS: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore deve ser usado dentro de AppProvider");
  return context;
};

// --- COMPONENTES DA UI ---

const NotificationComponent: React.FC = () => {
  const { toasts, removeToast } = useAppStore();
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
            t.type === 'warning' ? 'text-yellow-500' : 'border-blue-500'
          }`}>
            {t.type === 'success' && <CheckCircle size={20} />}
            {t.type === 'error' && <AlertTriangle size={20} />}
            {t.type === 'warning' && <AlertTriangle size={20} />}
            {t.type === 'info' && <Info size={20} />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-200">{t.message}</p>
          </div>
          <button onClick={() => removeToast(t.id)} className="text-slate-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

const SidebarComponent: React.FC = () => {
  const { activeTab, setActiveTab, pilotSubTab, setPilotSubTab, simData, company, notify } = useAppStore();
  
  const [dutyTime, setDutyTime] = useState("00:00:00");

  useEffect(() => {
    if (!company.dutyStartTime) return;
    const interval = setInterval(() => {
      const diff = Date.now() - company.dutyStartTime!;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setDutyTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [company.dutyStartTime]);

  return (
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
          <p className="text-lg font-mono font-bold text-blue-400">{dutyTime}</p>
        </div>
      )}

      <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">SimConnect</span>
          <div className={`w-2 h-2 rounded-full ${simData.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        </div>
        <button className="w-full py-2 bg-slate-800 rounded-xl text-[10px] font-bold hover:bg-slate-700 transition-colors uppercase">
          {simData.connected ? 'Conectado' : 'Reconectar'}
        </button>
      </div>
    </aside>
  );
};

const FlightCardComponent: React.FC<{ flight: RosterFlight, aircraft?: Aircraft }> = ({ flight, aircraft }) => {
  const { notify, company, setActiveTab } = useAppStore();
  
  return (
    <div className={`p-6 rounded-3xl border transition-all ${flight.status === 'current' ? 'border-blue-500/50 bg-blue-500/5 shadow-2xl shadow-blue-500/5 ring-1 ring-blue-500/20' : 'border-slate-800 opacity-60'}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-12">
          <div className="min-w-24">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Identificador</p>
            <p className="text-xl font-mono font-black text-blue-500">{flight.flightNumber}</p>
          </div>
          <div className="flex items-center space-x-8 px-10 border-l border-slate-800/50">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Origem</p>
              <p className="text-2xl font-bold tracking-tighter">{flight.origin}</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-600 font-bold italic mb-1">{flight.distance}NM</span>
              <Plane size={18} className="rotate-90 text-slate-700" />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Destino</p>
              <p className="text-2xl font-bold tracking-tighter">{flight.destination}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-8 text-[10px] uppercase font-bold text-slate-500 border-l border-slate-800/50 pl-10">
            <div><p className="mb-1 opacity-50">Pax</p><p className="text-white text-xs">{flight.pax}</p></div>
            <div><p className="mb-1 opacity-50">Cargo</p><p className="text-white text-xs">{flight.cargoWeight} LB</p></div>
            <div><p className="mb-1 opacity-50">Block Fuel</p><p className="text-emerald-500 text-xs">{flight.minFuel} LB</p></div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {flight.status === 'current' ? (
            <>
              <button onClick={() => {
                notify('info', 'Abrindo SimBrief Dispatcher...');
                window.open(`https://www.simbrief.com/system/dispatch.php?orig=${flight.origin}&dest=${flight.destination}&type=${aircraft?.icaoType || 'A20N'}&callsign=${flight.flightNumber}&airline=${company.name.substring(0,3)}`, '_blank');
              }} className="bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl text-[10px] font-bold hover:bg-slate-800 transition-colors uppercase tracking-wider">SimBrief</button>
              <button onClick={()=>setActiveTab('dashboard')} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase transition-all shadow-xl shadow-blue-600/20">Monitorar</button>
            </>
          ) : flight.status === 'completed' ? (
            <div className="text-emerald-500 bg-emerald-500/10 px-5 py-3 rounded-2xl border border-emerald-500/20 text-[10px] font-bold flex items-center space-x-2 tracking-widest uppercase">
              <CheckCircle size={14}/> <span>FINALIZADO</span>
            </div>
          ) : (
            <div className="text-slate-700 font-bold uppercase tracking-widest text-[10px] bg-slate-900/50 px-5 py-3 rounded-2xl border border-slate-800/50">Em Espera</div>
          )}
        </div>
      </div>
    </div>
  );
};

const OnboardingModal: React.FC = () => {
  const { updateCompany, recordTransaction, notify } = useAppStore();
  const [step, setStep] = useState(1);
  const [tempConfig, setTempConfig] = useState<Partial<CompanyConfig>>({ type: 'real', country: 'Brasil' });

  const finish = () => {
    // REGRA DE SALDO INICIAL: Preço da aeronave mais barata cadastrada (Turboprop/Cessna 208 = 1.200.000) somado a 300.000 de capital de giro.
    const CHEAPEST_AIRCRAFT_PRICE = 1200000;
    const INITIAL_WORKING_CAPITAL = 300000;
    const initialBalance = CHEAPEST_AIRCRAFT_PRICE + INITIAL_WORKING_CAPITAL;

    updateCompany({ ...tempConfig, setupComplete: true, balance: initialBalance, reputation: 5.0 }); 
    recordTransaction("Injeção Capital Inicial", initialBalance, 'credit', 'purchase');
    notify('success', "Bem-vindo ao comando, Comandante.");
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6">
      <div className="max-w-xl w-full glass p-10 rounded-3xl border-slate-800 border space-y-8 animate-in fade-in zoom-in duration-300">
         <div className="text-center">
           <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/20">
             <Building2 size={32} />
           </div>
           <h1 className="text-3xl font-bold">Fundar Companhia</h1>
           <p className="text-slate-500 mt-2">Escolha seu modelo de negócio</p>
         </div>
         {step === 1 ? (
           <div className="space-y-4">
              <button onClick={() => { setTempConfig({ ...tempConfig, type: 'real' }); setStep(2); }} className="w-full p-6 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                 <div><p className="font-bold text-lg">Modo Real</p><p className="text-sm text-slate-500">Operar como uma linha aérea real.</p></div>
                 <ChevronRight className="text-slate-700 group-hover:text-blue-500" />
              </button>
              <button onClick={() => { setTempConfig({ ...tempConfig, type: 'virtual' }); setStep(2); }} className="w-full p-6 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                 <div><p className="font-bold text-lg">Modo Virtual</p><p className="text-sm text-slate-500">Marca e hubs customizados.</p></div>
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
                 <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-60 pr-2">
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
                 <input className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none" placeholder="Nome da Empresa" onChange={(e) => setTempConfig({ ...tempConfig, name: e.target.value })} />
                 <input className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none uppercase" placeholder="Hub Principal (Ex: SBGR)" onChange={(e) => setTempConfig({ ...tempConfig, hub: e.target.value })} />
               </div>
             )}
             <div className="flex space-x-4">
               <button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-900/50 rounded-xl font-bold">Voltar</button>
               <button onClick={finish} disabled={!tempConfig.name} className="flex-2 w-full py-4 bg-blue-600 rounded-xl font-bold disabled:opacity-30">Confirmar</button>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

// --- VIEWS (MÓDULOS DA UI) ---

const DashboardView: React.FC = () => {
  const { pilotStats, fleet, simData, transactions } = useAppStore();
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Horas', value: `${Math.floor(pilotStats.totalHours)}h`, icon: Clock, color: 'text-blue-500' },
            { label: 'Pernas Voadas', value: pilotStats.totalFlights, icon: Plane, color: 'text-emerald-500' },
            { label: 'Patente', value: pilotStats.rank, icon: Award, color: 'text-yellow-500' },
            { label: 'Aeronaves', value: fleet.length, icon: List, color: 'text-slate-500' }
          ].map((stat, i) => (
            <div key={i} className="glass-card p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{stat.label}</p>
                <stat.icon className={`${stat.color} opacity-60`} size={20} />
              </div>
              <p className="text-3xl font-mono font-bold tracking-tighter">{stat.value}</p>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-8 rounded-3xl">
            <h3 className="text-lg font-bold flex items-center space-x-2 mb-6"><Activity size={18} className="text-blue-500"/> <span>Monitoramento de Voo</span></h3>
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800/50 text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Altitude</p>
                  <p className="text-xl font-mono font-bold">{simData.altitude.toLocaleString()} FT</p>
                </div>
                <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800/50 text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Velocidade (GS)</p>
                  <p className="text-xl font-mono font-bold">{simData.groundSpeed} KTS</p>
                </div>
                <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800/50 text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Razão de Subida</p>
                  <p className={`text-xl font-mono font-bold ${simData.verticalSpeed > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{simData.verticalSpeed} FPM</p>
                </div>
            </div>
            <div className="bg-slate-900/30 p-10 rounded-3xl border border-slate-800/50 flex flex-col items-center justify-center text-center">
                <Plane size={48} className={`mb-6 ${simData.connected ? 'text-blue-500 animate-pulse' : 'text-slate-800'}`} />
                <h4 className="text-xl font-bold uppercase">Status SimConnect</h4>
                <p className="text-slate-500 text-sm mt-2">{simData.connected ? 'Recebendo telemetria via bridge...' : 'Aguardando inicialização do simulador.'}</p>
            </div>
          </div>
          <div className="glass-card p-8 rounded-3xl">
            <h3 className="text-lg font-bold mb-6 flex items-center space-x-2"><TrendingUp size={18} className="text-emerald-500"/> <span>Ultimos Ganhos</span></h3>
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
            </div>
          </div>
      </div>
    </div>
  );
};

const PilotAreaView: React.FC = () => {
  const { pilotSubTab, roster, generateRoster, fleet, pilotStats, company, updateCompany, notify } = useAppStore();
  const [sbUser, setSbUser] = useState(company.simBriefUsername || '');
  
  const handleConnectSimBrief = () => {
    if (window.electronAPI && (window.electronAPI as any).connectSimBrief) {
      (window.electronAPI as any).connectSimBrief(sbUser);
    }
    updateCompany({ simBriefUsername: sbUser });
    notify('success', 'Usuário SimBrief vinculado com sucesso!');
  };

  if (pilotSubTab === 'roster') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4">
        <section className="glass-card p-8 rounded-3xl">
           <div className="flex justify-between mb-10 items-center">
              <div className="flex items-center space-x-4">
                 <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500 shadow-inner"><Navigation size={24}/></div>
                 <h3 className="text-xl font-bold">Despacho de Voos</h3>
              </div>
              <button onClick={() => generateRoster(1)} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-lg shadow-blue-600/20">Novo Plano</button>
           </div>
           <div className="space-y-4">
              {roster.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                   <p className="text-slate-600 font-bold uppercase">Sem voos planejados</p>
                </div>
              ) : roster.map(f => <FlightCardComponent key={f.id} flight={f} aircraft={fleet[0]} />)}
           </div>
        </section>
      </div>
    );
  }

  if (pilotSubTab === 'licenses') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-right-4">
         {['Light', 'Turboprop', 'SingleAisle', 'Widebody'].map(cat => (
            <div key={cat} className={`glass-card p-8 rounded-3xl border ${pilotStats.licenses.includes(cat as any) ? 'border-blue-500/50 bg-blue-500/5 shadow-lg shadow-blue-500/5' : 'border-slate-800/50 opacity-60'}`}>
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-xl ${pilotStats.licenses.includes(cat as any) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  <ShieldCheck size={28} />
               </div>
               <h4 className="text-xl font-bold mb-1">{cat}</h4>
               <p className="text-[10px] text-slate-500 mb-8 uppercase font-bold tracking-widest">Categoria: {pilotStats.licenses.includes(cat as any) ? 'Licenciado' : 'Bloqueado'}</p>
            </div>
         ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4">
       <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-10 rounded-3xl flex flex-col items-center text-center">
             <div className="w-28 h-28 bg-slate-900 rounded-full mb-8 flex items-center justify-center border-4 border-blue-600/30 relative">
                <User size={56} className="text-blue-500" />
                <div className="absolute -bottom-2 bg-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-400/20">{pilotStats.rank}</div>
             </div>
             <h3 className="text-2xl font-bold uppercase italic tracking-tighter">Pilot Command</h3>
             <p className="text-blue-500 font-bold text-xs uppercase mt-3 tracking-widest">{Math.floor(pilotStats.totalHours)} Horas Totais</p>
          </div>

          <div className="glass-card p-8 rounded-3xl border-slate-800/50">
             <h4 className="text-lg font-bold flex items-center space-x-2 mb-6">
                <Settings size={18} className="text-blue-500"/>
                <span>Configurações de Despacho</span>
             </h4>
             <div className="space-y-4">
                <div>
                   <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 block">SimBrief Username</label>
                   <input 
                      type="text" 
                      value={sbUser} 
                      onChange={(e) => setSbUser(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm font-mono"
                      placeholder="Username do SimBrief..."
                   />
                </div>
                <button 
                   onClick={handleConnectSimBrief}
                   className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                >
                   Vincular Conta
                </button>
                <p className="text-[9px] text-slate-600 uppercase tracking-widest text-center mt-2">ID para despacho operacional automático.</p>
             </div>
          </div>
       </div>

       <div className="lg:col-span-2 glass-card p-8 rounded-3xl min-h-[400px]">
          <h4 className="text-xl font-bold flex items-center space-x-3 mb-10"><History size={22} className="text-blue-500" /> <span>Logbook de Operações</span></h4>
          <div className="flex flex-col items-center justify-center py-20 opacity-30 grayscale">
             <List size={48} className="mb-4" />
             <p className="text-xs font-bold uppercase tracking-widest">Logs em tempo real via SimConnect</p>
          </div>
       </div>
    </div>
  );
};

// --- APP PROVIDER (STATE MANAGEMENT / REATIVIDADE) ---

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pilotSubTab, setPilotSubTab] = useState('roster');
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [company, setCompany] = useState<CompanyConfig>(() => {
    const saved = localStorage.getItem('skyLink_company_store');
    return saved ? JSON.parse(saved) : { setupComplete: false, balance: 150000, reputation: 5.0 };
  });

  const [pilotStats, setPilotStats] = useState<PilotStats>(() => {
    const saved = localStorage.getItem('skyLink_pilot_store');
    return saved ? JSON.parse(saved) : { totalHours: 0, totalFlights: 0, rank: 'Cadete', licenses: ['Light'], avgLandingRate: 0 };
  });

  const [fleet, setFleet] = useState<Aircraft[]>(() => {
    const saved = localStorage.getItem('skyLink_fleet_store');
    return saved ? JSON.parse(saved) : [];
  });

  const [roster, setRoster] = useState<RosterFlight[]>(() => {
    const saved = localStorage.getItem('skyLink_roster_store');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('skyLink_tx_store');
    return saved ? JSON.parse(saved) : [];
  });

  const [simData, setSimData] = useState<SimData>({
    altitude: 0, groundSpeed: 0, totalFuel: 0, onGround: true,
    verticalSpeed: 0, enginesRunning: false, parkingBrake: true, gearDown: true,
    latitude: 0, longitude: 0, connected: false
  });

  const initialFuelRef = useRef<number>(0);
  const isFlyingRef = useRef<boolean>(false);
  const eventsTracked = useRef<any>({});

  // Persistência
  useEffect(() => {
    localStorage.setItem('skyLink_company_store', JSON.stringify(company));
    localStorage.setItem('skyLink_pilot_store', JSON.stringify(pilotStats));
    localStorage.setItem('skyLink_fleet_store', JSON.stringify(fleet));
    localStorage.setItem('skyLink_roster_store', JSON.stringify(roster));
    localStorage.setItem('skyLink_tx_store', JSON.stringify(transactions));
  }, [company, pilotStats, fleet, roster, transactions]);

  // IPC
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onSimData((data: SimData) => setSimData(data));
      window.electronAPI.onFlightEvent((type: ToastType, data: { message: string }) => {
        notify(type, data.message);
      });
    }
  }, []);

  const notify = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [{ id, type, message }, ...prev]);
    setTimeout(() => removeToast(id), 5000);
  }, []);

  const removeToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const recordTransaction = useCallback((description: string, amount: number, type: 'credit' | 'debit', category: Transaction['category']) => {
    const newTx: Transaction = { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), description, amount, type, category };
    setTransactions(prev => [newTx, ...prev]);
    setCompany(prev => ({ ...prev, balance: type === 'credit' ? prev.balance + amount : prev.balance - amount }));
  }, []);

  const updateCompany = (config: Partial<CompanyConfig>) => setCompany(prev => ({ ...prev, ...config }));
  const updatePilotStats = (stats: Partial<PilotStats>) => setPilotStats(prev => ({ ...prev, ...stats }));
  const addToFleet = (aircraft: Aircraft) => setFleet(prev => [...prev, aircraft]);

  // --- LÓGICA DE GERAÇÃO DE ESCALA ATUALIZADA (DINAMISMO E ROTAS REAIS) ---
  const generateRoster = (legs: number) => {
    if (fleet.length === 0) return notify('warning', "Sem aeronaves disponíveis no hangar.");
    
    // Seleciona a aeronave ativa atual (neste escopo assume-se a primeira)
    const aircraft = fleet[0]; 
    
    // 1. DETERMINAÇÃO DA ORIGEM (Dinamismo Total - Fim do SBMT fixo)
    let origin = aircraft.location || company.hub;

    // Regra de Continuidade: se já existe escala planejada, começa onde a última perna termina
    if (roster.length > 0) {
      origin = roster[roster.length - 1].destination;
    } else if (pilotStats.totalFlights === 0 && company.setupComplete) {
      // Regra Virtual/Início: Se for o primeiro voo da empresa, usa o HUB configurado
      origin = company.hub;
    }

    const newFlights: RosterFlight[] = [];
    let movingLoc = origin;

    for (let i = 0; i < legs; i++) {
      // 2. BUSCA DE DESTINOS (Lógica Sequential e getRandomRoute)
      let dest = "";
      const suggested = REAL_WORLD_ROUTES[movingLoc];
      
      if (suggested && suggested.length > 0) {
        // Seleciona um destino real do banco de dados para a origem atual
        dest = suggested[Math.floor(Math.random() * suggested.length)];
      } else {
        // Fallback: seleciona um aeroporto aleatório da região se não houver rota real mapeada
        const regionAirports = AIRPORTS_BY_REGION[company.country || "Brasil"];
        dest = regionAirports[Math.floor(Math.random() * regionAirports.length)];
        while (dest === movingLoc) {
          dest = regionAirports[Math.floor(Math.random() * regionAirports.length)];
        }
      }
      
      const pax = Math.floor(aircraft.maxPax * (0.6 + Math.random() * 0.4));
      newFlights.push({
        id: Math.random().toString(36).substr(2, 9),
        flightNumber: `${company.name.substring(0,2).toUpperCase()}${Math.floor(1000 + Math.random() * 8999)}`,
        origin: movingLoc, 
        destination: dest, 
        distance: 250, 
        departureTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: (roster.length === 0 && i === 0) ? 'current' : 'pending', 
        pax, 
        cargoWeight: Math.floor(Math.random() * 3000) + 2000, 
        minFuel: 10000, 
        events: {}
      });

      // Atualiza o cursor de localização para a próxima perna da escala
      movingLoc = dest;
    }

    // 3. PERSISTÊNCIA / PRÉ-RESERVA (Reserva a localização futura no banco de dados)
    // Atualizamos a localização da aeronave para o destino final da nova escala gerada
    setFleet(prev => prev.map(a => a.id === aircraft.id ? { ...a, location: movingLoc } : a));

    if (!company.dutyStartTime) updateCompany({ dutyStartTime: Date.now() });
    setRoster(prev => [...prev, ...newFlights]);
    notify('success', `Escala operacional gerada partindo de ${origin}. Aeronave pré-posicionada em ${movingLoc}.`);
  };

  const finalizeFlight = useCallback((finalFuel: number, finalVS: number) => {
    const currentLeg = roster.find(l => l.status === 'current');
    if (!currentLeg) return;

    const fuelUsed = Math.max(0, initialFuelRef.current - finalFuel);
    const revenue = currentLeg.pax * TICKET_PRICE;
    const fuelCost = fuelUsed * FUEL_PRICE_LB;
    const totalProfit = revenue - fuelCost;

    recordTransaction(`Voo ${currentLeg.flightNumber}: Receita`, revenue, 'credit', 'flight_revenue');
    recordTransaction(`Combustível ${currentLeg.flightNumber}`, fuelCost, 'debit', 'fuel');
    
    // Atualização do Logbook e Estatísticas
    updatePilotStats({ 
      totalFlights: pilotStats.totalFlights + 1,
      totalHours: pilotStats.totalHours + 1.2,
      rank: pilotStats.totalHours > 200 ? 'Comandante Master' : pilotStats.totalHours > 50 ? 'Primeiro Oficial' : 'Cadete'
    });

    // A localização já foi "pré-reservada" em generateRoster, mas garantimos aqui a atualização final se necessário
    setFleet(prev => prev.map(a => ({ ...a, location: currentLeg.destination })));

    const updatedRoster = roster.map(l => l.id === currentLeg.id ? { ...l, status: 'completed' as const } : l);
    // Definir o próximo voo pendente como 'current' se houver
    const nextPending = updatedRoster.find(l => l.status === 'pending');
    if (nextPending) nextPending.status = 'current';

    setRoster(updatedRoster);
    notify('success', `Pouso em ${currentLeg.destination} concluído! Lucro: $${totalProfit.toLocaleString()}`);
  }, [roster, pilotStats, recordTransaction, notify]);

  // Lógica de monitoramento SimConnect
  useEffect(() => {
    if (!simData.connected) return;
    if (!simData.onGround && !isFlyingRef.current) {
      isFlyingRef.current = true;
      initialFuelRef.current = simData.totalFuel;
      eventsTracked.current.takeoff = Date.now();
    }
    if (simData.onGround && isFlyingRef.current) {
      isFlyingRef.current = false;
      finalizeFlight(simData.totalFuel, simData.verticalSpeed);
    }
  }, [simData, finalizeFlight]);

  const store = {
    company, pilotStats, fleet, roster, transactions, simData, activeTab, pilotSubTab, toasts,
    setActiveTab, setPilotSubTab, notify, removeToast, recordTransaction, 
    updateCompany, updatePilotStats, addToFleet, generateRoster, finalizeFlight
  };

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
};

// --- MAIN LAYOUT (CONTROLLER) ---

const MainLayout: React.FC = () => {
  const { company, activeTab, setActiveTab, transactions, recordTransaction, addToFleet, notify, fleet } = useAppStore();

  if (!company.setupComplete) return <OnboardingModal />;

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-200 overflow-hidden">
      <NotificationComponent />
      <SidebarComponent />
      
      <main className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
        <header className="flex justify-between items-center mb-10">
           <div className="flex items-center space-x-5">
             <div className="p-3 bg-blue-600 rounded-2xl"><Building2 size={24} /></div>
             <div>
                <h2 className="text-2xl font-bold uppercase tracking-tight leading-none">{company.name}</h2>
                <p className="text-slate-500 text-xs font-medium mt-1 uppercase">Hub: <span className="text-blue-500">{company.hub}</span></p>
             </div>
           </div>
           <div className="px-6 py-3 rounded-2xl glass-card border-emerald-500/20 border-l-4 text-right">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Patrimônio</p>
              <p className="text-xl font-mono text-emerald-400 font-bold tracking-tighter">${company.balance.toLocaleString()}</p>
           </div>
        </header>

        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'pilot_area' && <PilotAreaView />}
        
        {activeTab === 'accounting' && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {[
                  { label: 'Receita Operacional', value: transactions.filter(t=>t.type==='credit').reduce((a,b)=>a+b.amount,0), color: 'text-emerald-400', border: 'border-emerald-500/10' },
                  { label: 'Custos e Despesas', value: -transactions.filter(t=>t.type==='debit').reduce((a,b)=>a+b.amount,0), color: 'text-red-400', border: 'border-red-500/10' },
                  { label: 'Lucro Líquido', value: company.balance, color: 'text-blue-400', border: 'border-blue-500/20' }
               ].map((box, i) => (
                  <div key={i} className={`glass-card p-10 rounded-3xl border-l-4 ${box.border}`}>
                     <p className="text-xs text-slate-500 font-bold uppercase mb-3 tracking-widest">{box.label}</p>
                     <p className={`text-4xl font-mono font-bold tracking-tighter ${box.color}`}>${box.value.toLocaleString()}</p>
                  </div>
               ))}
            </div>
            <section className="glass-card p-10 rounded-3xl border-slate-800/50">
               <h3 className="text-xl font-bold mb-10">DRE - Fluxo de Caixa</h3>
               <div className="divide-y divide-slate-800/50">
                  {transactions.map(t => (
                     <div key={t.id} className="flex justify-between items-center py-6">
                        <div>
                          <p className="font-bold text-sm">{t.description}</p>
                          <p className="text-[10px] text-slate-600 font-mono mt-1">{new Date(t.timestamp).toLocaleString()}</p>
                        </div>
                        <p className={`font-mono font-bold text-xl ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                           {t.type === 'credit' ? '+' : '-'}${t.amount.toLocaleString()}
                        </p>
                     </div>
                  ))}
               </div>
            </section>
          </div>
        )}

        {activeTab === 'market' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in zoom-in-95">
             {MARKET_CANDIDATES.map(p => {
                const price = p.category === 'Widebody' ? 320000000 : p.category === 'SingleAisle' ? 85000000 : 1200000;
                return (
                   <div key={p.id} className="glass-card p-8 rounded-3xl border-slate-800/50 hover:border-blue-500/40 transition-all flex flex-col group">
                      <div className="w-full h-44 bg-slate-900 rounded-2xl mb-8 flex items-center justify-center border border-slate-800/50 relative">
                         <Plane size={56} className="text-slate-800 group-hover:text-blue-500/20 transition-colors" />
                      </div>
                      <h4 className="text-xl font-bold tracking-tight">{p.model}</h4>
                      <p className="text-3xl font-mono font-bold text-emerald-400 tracking-tighter my-6">${price.toLocaleString()}</p>
                      <button onClick={()=>{ 
                         if(company.balance < price) return notify('error', "Saldo insuficiente!");
                         addToFleet({...p, id: Math.random().toString(36).substr(2,9)});
                         recordTransaction(`Aquisição Aeronave: ${p.model}`, price, 'debit', 'purchase'); 
                         notify('success', `${p.model} comprado com sucesso.`);
                      }} className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-xs uppercase shadow-xl shadow-blue-600/20">Adquirir</button>
                   </div>
                );
             })}
          </div>
        )}

        {activeTab === 'hangar' && (
           <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-left-4">
              {fleet.length === 0 ? (
                 <div className="py-48 text-center glass-card rounded-3xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center opacity-50">
                    <Plane size={64} className="text-slate-800 mb-8" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-lg">Sem aeronaves ativas</p>
                    <button onClick={()=>setActiveTab('market')} className="mt-4 text-blue-500 font-bold underline">Ir ao Mercado</button>
                 </div>
              ) : fleet.map(a => (
                 <div key={a.id} className="glass-card p-10 rounded-3xl border-slate-800/50 flex justify-between items-center hover:bg-slate-900/20 transition-all border-l-8 border-l-blue-600 shadow-xl group">
                    <div className="flex items-center space-x-10">
                       <div className="p-5 bg-slate-950 rounded-2xl text-slate-600 group-hover:text-blue-500 transition-colors"><Plane size={36}/></div>
                       <div>
                          <h4 className="text-3xl font-bold tracking-tighter">{a.model}</h4>
                          <p className="text-sm text-slate-500 font-mono mt-2 uppercase tracking-widest opacity-60">{a.registration} | {a.category}</p>
                       </div>
                    </div>
                    <div className="flex space-x-16">
                       <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Localização</p>
                          <p className="font-bold tracking-tighter text-2xl">{a.location}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Ciclos</p>
                          <p className="font-bold tracking-tighter text-2xl">{a.totalCycles}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Condição</p>
                          <p className="font-bold tracking-tighter text-2xl text-emerald-500">{a.condition}%</p>
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

const App: React.FC = () => {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
};

export default App;
