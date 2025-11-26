
import React from 'react';
import { ChevronLeft, Construction, Cone } from 'lucide-react';

interface SportsAppProps {
    onBack: () => void;
}

export default function SportsApp({ onBack }: SportsAppProps) {
  return (
    <div className="min-h-screen bg-silicon-dark font-sans flex flex-col items-center justify-center relative overflow-hidden">
       {/* Background Elements matching Brand */}
       <div className="fixed inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-silicon-teal/10 rounded-full blur-[120px]"></div>
           <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-silicon-purple/10 rounded-full blur-[120px]"></div>
       </div>

       {/* Navigation */}
       <button 
         onClick={onBack}
         className="absolute top-8 left-8 text-white/50 hover:text-white flex items-center gap-2 transition-colors z-20"
       >
         <ChevronLeft size={20} />
         <span className="text-sm font-bold uppercase tracking-wider">Voltar ao Início</span>
       </button>

       {/* Main Content */}
       <div className="z-10 flex flex-col items-center text-center p-8 max-w-2xl animate-fade-in">
          <div className="relative mb-8">
             <div className="absolute inset-0 bg-silicon-teal/20 blur-xl rounded-full"></div>
             <div className="relative p-8 bg-silicon-surface border border-gray-800 rounded-3xl shadow-2xl flex items-center justify-center">
                 <Construction className="w-16 h-16 text-silicon-teal" strokeWidth={1.5} />
             </div>
             {/* Decorative Badge */}
             <div className="absolute -top-2 -right-2 bg-silicon-orange text-white text-[10px] font-bold px-2 py-1 rounded-full border border-silicon-dark">
                BETA
             </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Módulo <span className="text-transparent bg-clip-text bg-gradient-to-r from-silicon-teal to-silicon-purple">Esportivo</span>
          </h1>
          
          <div className="space-y-4 text-gray-400 text-lg leading-relaxed max-w-lg">
            <p>
              Estamos trabalhando duro para trazer a melhor experiência de projetos esportivos para o <strong className="text-white">Schema</strong>.
            </p>
            <p className="text-sm border-t border-gray-800 pt-4 mt-4">
              Em breve você poderá projetar campos de futebol, quadras poliesportivas e arenas com a mesma precisão do módulo industrial.
            </p>
          </div>

          <div className="mt-12 flex gap-4">
             <button 
               onClick={onBack}
               className="px-8 py-3 bg-silicon-input border border-gray-700 hover:border-silicon-teal text-white rounded-lg font-bold text-sm transition-all hover:shadow-[0_0_20px_rgba(66,192,181,0.2)]"
             >
               Voltar para Projetos Industriais
             </button>
          </div>
       </div>

       {/* Footer Branding */}
       <div className="absolute bottom-8 text-center text-gray-700 text-xs">
           Schema Sports • Silicon Group Engineering
       </div>
    </div>
  );
}
