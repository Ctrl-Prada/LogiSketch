
import React, { useState } from 'react';
import { Factory, Circle, Trophy, ArrowRight, Construction } from 'lucide-react';
import IndustrialApp from './components/IndustrialApp';
import SportsApp from './components/SportsApp';

type AppMode = 'HOME' | 'INDUSTRIAL' | 'SPORTS';

export default function App() {
  const [mode, setMode] = useState<AppMode>('HOME');

  if (mode === 'INDUSTRIAL') {
    return <IndustrialApp onBack={() => setMode('HOME')} />;
  }

  if (mode === 'SPORTS') {
     return <SportsApp onBack={() => setMode('HOME')} />;
  }

  return (
    <div className="min-h-screen bg-silicon-dark font-sans flex flex-col">
       {/* Background Elements */}
       <div className="fixed inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-silicon-orange/10 rounded-full blur-[120px]"></div>
           <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-silicon-purple/10 rounded-full blur-[120px]"></div>
       </div>

       {/* Header */}
       <header className="p-8 flex justify-between items-center relative z-10">
           <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-silicon-orange animate-pulse"></div>
               <h1 className="text-2xl font-bold text-white tracking-tight">Schema</h1>
           </div>
           
       </header>

       {/* Main Content */}
       <main className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
           <div className="text-center mb-16 max-w-2xl">
               <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                   Selecione o seu <br/>
                   <span className="text-transparent bg-clip-text bg-silicon-gradient">Tipo de Projeto</span>
               </h2>
               <p className="text-gray-400 text-lg">
                   Ferramenta profissional para desenho técnico e luminotécnico. 
                   Escolha abaixo a categoria para iniciar o esboço.
               </p>
           </div>

           <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl justify-center">
               
               {/* Industrial Card */}
               <button 
                 onClick={() => setMode('INDUSTRIAL')}
                 className="group relative flex-1 bg-silicon-surface border border-gray-800 rounded-3xl p-8 text-left hover:border-silicon-orange transition-all duration-300 hover:shadow-[0_0_30px_rgba(240,50,0,0.15)] flex flex-col items-center justify-center min-h-[320px]"
               >
                   <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1">
                       <ArrowRight className="text-silicon-orange" />
                   </div>
                   
                   <div className="mb-8 p-6 rounded-2xl bg-black/40 border border-gray-800 group-hover:border-silicon-orange/50 transition-colors">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:text-silicon-orange transition-colors">
                            <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                            <path d="M17 18h1" />
                            <path d="M12 18h1" />
                            <path d="M7 18h1" />
                        </svg>
                   </div>
                   
                   <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-silicon-orange transition-colors">Industrial</h3>
                   <p className="text-gray-500 text-sm text-center px-4">
                       Galpões logísticos, fábricas e áreas de armazenamento vertical.
                   </p>
               </button>

               {/* Sports Card */}
               <button 
                 onClick={() => setMode('SPORTS')}
                 className="group relative flex-1 bg-silicon-surface border border-gray-800 rounded-3xl p-8 text-left hover:border-silicon-teal transition-all duration-300 hover:shadow-[0_0_30px_rgba(66,192,181,0.15)] flex flex-col items-center justify-center min-h-[320px]"
               >
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1">
                       <ArrowRight className="text-silicon-teal" />
                   </div>

                   <div className="mb-8 p-6 rounded-2xl bg-black/40 border border-gray-800 group-hover:border-silicon-teal/50 transition-colors">
                        <Circle className="w-16 h-16 text-white group-hover:text-silicon-teal transition-colors" strokeWidth={1.5} />
                   </div>
                   
                   <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-silicon-teal transition-colors">Esportivo</h3>
                   <p className="text-gray-500 text-sm text-center px-4">
                       Quadras poliesportivas, campos de futebol e arenas.
                   </p>
               </button>

           </div>
       </main>
       
       <footer className="p-8 text-center text-gray-600 text-xs relative z-10">
           © {new Date().getFullYear()} Silicon Group. Todos os direitos reservados.
       </footer>
    </div>
  );
}
