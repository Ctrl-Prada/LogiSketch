
import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  Download, 
  Warehouse, 
  Lightbulb, 
  Package, 
  Sun,
  Plus,
  Trash2,
  ArrowRightLeft,
  Zap,
  RotateCw,
  Box,
  Layout,
  Layers,
  ChevronLeft
} from 'lucide-react';
import { 
  ProjectData, 
  DEFAULT_PROJECT, 
  LightingOrientation, 
  LightingMode, 
  RackBlock,
  ObjectType
} from '../types';
import { STEP_TITLES } from '../constants';
import { WarehouseCanvas, CanvasHandle } from './WarehouseCanvas';

const DarkInput = ({ label, value, onChange, placeholder, type = "text" }: any) => {
  const [localVal, setLocalVal] = useState(value === 0 ? '' : value?.toString() || '');
  
  useEffect(() => {
      // If it's a number prop but string input
      if (typeof value === 'number') {
        const parsedLocal = parseFloat(localVal.replace(',', '.'));
        if (parsedLocal !== value) {
            if (value === 0 && (localVal === '' || localVal === '0')) return;
            setLocalVal(value === 0 ? '' : value?.toString());
        }
      } else {
          // String input (Project Name)
          if (localVal !== value) {
              setLocalVal(value || '');
          }
      }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      
      // If the parent expects a number (based on initial value type check usually, but here we simplify)
      // We'll rely on the onChange handler passed to parse it if needed, or if it's text just pass it.
      
      // Heuristic: If label implies text or value is string in parent
      const isText = typeof value === 'string';

      if (isText) {
          setLocalVal(val);
          onChange(e); // Pass event back
      } else {
        // Number logic
        if (/^[\d.,]*$/.test(val)) {
            setLocalVal(val);
            const normalized = val.replace(',', '.');
            const parsed = parseFloat(normalized);
            
            if (!isNaN(parsed)) {
                onChange({ target: { value: parsed } }); 
            } else if (val === '') {
                onChange({ target: { value: 0 } });
            }
        }
      }
  };

  return (
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-1 tracking-wide">{label}</label>
        <input
          type="text"
          inputMode={typeof value === 'number' ? "decimal" : "text"}
          value={localVal}
          onChange={handleChange}
          className="block w-full rounded-lg bg-silicon-input border border-gray-700 text-white placeholder-gray-500 focus:border-silicon-orange focus:ring-1 focus:ring-silicon-orange sm:text-sm p-3 transition-colors"
          placeholder={placeholder}
        />
      </div>
  );
};

interface IndustrialAppProps {
    onBack: () => void;
}

export default function IndustrialApp({ onBack }: IndustrialAppProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<ProjectData>(DEFAULT_PROJECT);
  const canvasRef = useRef<CanvasHandle>(null);
  
  // State for Summary View Mode (2D or 3D)
  const [summaryViewMode, setSummaryViewMode] = useState<'2D' | '3D'>('2D');
  
  // Rack/Mezzanine State
  const [inputMode, setInputMode] = useState<ObjectType>('RACK');
  const [newRackDims, setNewRackDims] = useState({ w: 1.2, d: 1.0, h: 2.0 }); // h is height for rack
  const [newMezzDims, setNewMezzDims] = useState({ w: 5.0, d: 5.0, el: 3.0 }); // el is elevation for mezzanine

  const totalSteps = 5; 

  const nextStep = () => {
    if (currentStep === 1) {
       if (data.length > data.width) {
         setData(prev => ({
           ...prev,
           width: prev.length,
           length: prev.width,
         }));
       }
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDownload = () => {
    if (canvasRef.current) {
      canvasRef.current.downloadImage();
    }
  };

  // Reset Project State instead of reloading window
  const handleNewProject = () => {
      setData(DEFAULT_PROJECT);
      setCurrentStep(1);
      setSummaryViewMode('2D');
      setNewRackDims({ w: 1.2, d: 1.0, h: 2.0 });
      setNewMezzDims({ w: 5.0, d: 5.0, el: 3.0 });
      setInputMode('RACK');
  };

  // --- Logic for Racks ---

  const handleAddObject = () => {
      const isMezzanine = inputMode === 'MEZZANINE';
      const w = isMezzanine ? newMezzDims.w : newRackDims.w;
      const d = isMezzanine ? newMezzDims.d : newRackDims.d;
      const h = isMezzanine ? 0.2 : newRackDims.h; // Mezzanine fixed thickness
      const el = isMezzanine ? newMezzDims.el : 0; // Rack on floor

      if (w <= 0 || d <= 0) return;

      const newBlock: RackBlock = {
          id: Math.random().toString(36).substr(2, 9),
          type: inputMode,
          x: 1, 
          y: 1, 
          width: Number(w),
          depth: Number(d),
          height: Number(h),
          elevation: Number(el),
          label: isMezzanine ? `M${data.storage.racks.filter(r=>r.type === 'MEZZANINE').length + 1}` : `B${data.storage.racks.filter(r=>r.type === 'RACK').length + 1}`
      };

      setData({
          ...data,
          storage: {
              ...data.storage,
              isActive: true,
              racks: [...data.storage.racks, newBlock]
          }
      });
  };

  const handleRackMove = (id: string, x: number, y: number) => {
      setData(prev => ({
          ...prev,
          storage: {
              ...prev.storage,
              racks: prev.storage.racks.map(r => 
                  r.id === id ? { ...r, x, y } : r
              )
          }
      }));
  };

  const removeRack = (id: string) => {
      setData(prev => ({
          ...prev,
          storage: {
              ...prev.storage,
              racks: prev.storage.racks.filter(r => r.id !== id),
              isActive: prev.storage.racks.length > 1 
          }
      }));
  };

  const updateRackLabel = (id: string, newLabel: string) => {
    setData(prev => ({
        ...prev,
        storage: {
            ...prev.storage,
            racks: prev.storage.racks.map(r => 
                r.id === id ? { ...r, label: newLabel } : r
            )
        }
    }));
  };

  const resetStorage = () => {
      setData({
          ...data,
          storage: { ...data.storage, racks: [], isActive: false }
      });
  };

  const handleSwapDims = () => {
      if (inputMode === 'MEZZANINE') {
          setNewMezzDims({ ...newMezzDims, w: newMezzDims.d, d: newMezzDims.w });
      } else {
          setNewRackDims({ ...newRackDims, w: newRackDims.d, d: newRackDims.w });
      }
  };
  
  const handleSwapStep1 = () => {
      setData({ ...data, width: data.length, length: data.width });
  };

  // --- Step Renderers ---

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-silicon-input rounded-lg border border-gray-700">
            <Warehouse className="w-6 h-6 text-silicon-orange" />
        </div>
        <h3 className="text-xl font-bold text-white">Dados do Projeto</h3>
      </div>
      
      {/* Project Name Input */}
      <div className="mb-4">
         <DarkInput 
            label="NOME DO PROJETO"
            value={data.projectName}
            onChange={(e: any) => setData({ ...data, projectName: e.target.value })}
            placeholder="Ex: Galpão Logístico Alpha"
         />
      </div>

      <div className="flex items-center gap-2">
          <div className="flex-1">
             <DarkInput 
                label="MAIOR DIMENSÃO (m)"
                value={data.width || ''}
                onChange={(e: any) => setData({ ...data, width: Number(e.target.value) })}
                placeholder="Ex: 100"
            />
          </div>
          <div className="flex-1">
            <DarkInput 
                label="MENOR DIMENSÃO (m)"
                value={data.length || ''}
                onChange={(e: any) => setData({ ...data, length: Number(e.target.value) })}
                placeholder="Ex: 50"
            />
          </div>
      </div>
      <div className="pt-2">
         <DarkInput 
            label="PÉ DIREITO (m)"
            value={data.ceilingHeight || ''}
            onChange={(e: any) => setData({ ...data, ceilingHeight: Number(e.target.value) })}
            placeholder="Ex: 12"
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
       <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-silicon-input rounded-lg border border-gray-700">
            <Lightbulb className="w-6 h-6 text-silicon-orange" /> 
        </div>
        <h3 className="text-xl font-bold text-white">Infraestrutura</h3>
      </div>

      <div className="flex items-center gap-3 mb-6 p-3 bg-silicon-input rounded-lg border border-gray-700">
         <input 
            type="checkbox"
            id="hasLighting"
            checked={data.lighting.isActive}
            onChange={(e) => setData({ ...data, lighting: { ...data.lighting, isActive: e.target.checked } })}
            className="h-5 w-5 text-silicon-orange focus:ring-silicon-orange bg-black border-gray-600 rounded cursor-pointer"
         />
         <label htmlFor="hasLighting" className="text-sm font-medium text-white cursor-pointer select-none">
             Definir Perfilados / Eletrocalhas
         </label>
      </div>
      
      {data.lighting.isActive ? (
        <div className="animate-fade-in space-y-5 border-l-2 border-silicon-teal pl-4">
          <div className="bg-silicon-input/50 p-4 rounded-lg border border-silicon-teal/30">
              <DarkInput 
                 label="LUMINÁRIAS POR PERFILADO (Sugestão)"
                 value={data.lighting.fixturesPerProfile || ''}
                 onChange={(e: any) => setData({ ...data, lighting: { ...data.lighting, fixturesPerProfile: Number(e.target.value) } })}
                 placeholder="Ex: 5"
              />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide">ORIENTAÇÃO DOS PERFILADOS</label>
            <div className="flex gap-4">
              <button
                onClick={() => setData({ ...data, lighting: { ...data.lighting, orientation: LightingOrientation.Longitudinal } })}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                  data.lighting.orientation === LightingOrientation.Longitudinal
                    ? 'bg-silicon-sub-led text-white shadow-lg shadow-purple-900/50'
                    : 'bg-silicon-input border border-gray-700 text-gray-400 hover:border-silicon-teal hover:text-white'
                }`}
              >
                Longitudinal (// Eixo X)
              </button>
              <button
                 onClick={() => setData({ ...data, lighting: { ...data.lighting, orientation: LightingOrientation.Transversal } })}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                  data.lighting.orientation === LightingOrientation.Transversal
                    ? 'bg-silicon-sub-led text-white shadow-lg shadow-purple-900/50'
                    : 'bg-silicon-input border border-gray-700 text-gray-400 hover:border-silicon-teal hover:text-white'
                }`}
              >
                Transversal (// Eixo Y)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide">ESPAÇAMENTO</label>
            <select
              value={data.lighting.mode}
              onChange={(e) => setData({ ...data, lighting: { ...data.lighting, mode: e.target.value as LightingMode } })}
              className="block w-full rounded-lg bg-silicon-input border border-gray-700 text-white focus:border-silicon-teal focus:ring-1 focus:ring-silicon-teal p-3 text-sm"
            >
              <option value={LightingMode.Quantity}>Por Quantidade Total de Linhas</option>
              <option value={LightingMode.Distance}>Por Distância entre Linhas</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <DarkInput
                label={data.lighting.mode === LightingMode.Quantity ? 'QTD. LINHAS' : 'DISTÂNCIA (m)'}
                value={data.lighting.value}
                onChange={(e: any) => setData({ ...data, lighting: { ...data.lighting, value: Number(e.target.value) } })}
            />
             <DarkInput
                label="DISTÂNCIA DA PAREDE (m)"
                value={data.lighting.offset}
                onChange={(e: any) => setData({ ...data, lighting: { ...data.lighting, offset: Number(e.target.value) } })}
            />
          </div>
        </div>
      ) : (
          <div className="text-sm text-gray-400 italic bg-silicon-input border border-dashed border-gray-700 p-4 rounded-lg flex gap-2">
              <span className="text-silicon-orange">•</span> Opção "Sem Perfilado" selecionada. Não será gerada sugestão de layout luminotécnico.
          </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-silicon-input rounded-lg border border-gray-700">
            <Package className="w-6 h-6 text-silicon-orange" /> 
        </div>
        <h3 className="text-xl font-bold text-white">Layout</h3>
      </div>
      
      {/* Input Mode Switcher */}
      <div className="flex gap-2 bg-black/30 p-1 rounded-lg border border-gray-800">
           <button 
             onClick={() => setInputMode('RACK')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${inputMode === 'RACK' ? 'bg-silicon-orange text-white shadow' : 'text-gray-400 hover:text-white'}`}
           >
              <Box size={14} /> Objetos
           </button>
           <button 
             onClick={() => setInputMode('MEZZANINE')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${inputMode === 'MEZZANINE' ? 'bg-silicon-teal text-white shadow' : 'text-gray-400 hover:text-white'}`}
           >
              <Layers size={14} /> Mezanino
           </button>
      </div>

      {/* Input Controls */}
      <div className={`p-4 rounded-xl border shadow-lg ${inputMode === 'MEZZANINE' ? 'bg-silicon-input border-silicon-teal/30' : 'bg-silicon-input border-gray-700'}`}>
          <div className={`text-xs font-bold uppercase mb-3 tracking-widest ${inputMode === 'MEZZANINE' ? 'text-silicon-teal' : 'text-silicon-orange'}`}>
             {inputMode === 'MEZZANINE' ? 'Adicionar Mezanino' : 'Adicionar Objeto'}
          </div>
          <div className="flex gap-2 items-end">
              <div className="w-20">
                  <DarkInput 
                      label="LARG."
                      value={inputMode === 'MEZZANINE' ? newMezzDims.w : newRackDims.w}
                      onChange={(e: any) => inputMode === 'MEZZANINE' ? setNewMezzDims({...newMezzDims, w: Number(e.target.value)}) : setNewRackDims({...newRackDims, w: Number(e.target.value)})}
                  />
              </div>
              <button 
                  onClick={handleSwapDims}
                  title="Inverter Dimensões"
                  className="mb-[2px] p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-600"
              >
                  <ArrowRightLeft className="w-4 h-4" />
              </button>
              <div className="w-20">
                   <DarkInput 
                      label="COMP."
                      value={inputMode === 'MEZZANINE' ? newMezzDims.d : newRackDims.d}
                      onChange={(e: any) => inputMode === 'MEZZANINE' ? setNewMezzDims({...newMezzDims, d: Number(e.target.value)}) : setNewRackDims({...newRackDims, d: Number(e.target.value)})}
                  />
              </div>
              <div className="w-20">
                   <DarkInput 
                      label={inputMode === 'MEZZANINE' ? 'ELEV.(Chão)' : 'ALTURA'}
                      value={inputMode === 'MEZZANINE' ? newMezzDims.el : newRackDims.h}
                      onChange={(e: any) => inputMode === 'MEZZANINE' ? setNewMezzDims({...newMezzDims, el: Number(e.target.value)}) : setNewRackDims({...newRackDims, h: Number(e.target.value)})}
                  />
              </div>
              <button 
                onClick={handleAddObject}
                className={`flex-1 text-white p-2.5 rounded-lg flex items-center justify-center shadow-lg transition-all hover:scale-105 h-[46px] ${inputMode === 'MEZZANINE' ? 'bg-silicon-teal hover:bg-teal-600 shadow-teal-900/20' : 'bg-silicon-orange hover:bg-red-600 shadow-orange-900/20'}`}
              >
                  <Plus className="w-5 h-5" /> Adicionar
              </button>
          </div>
          {inputMode === 'MEZZANINE' && (
              <p className="text-[10px] text-gray-400 mt-2 italic">* Espessura padrão do mezanino: 0.2m</p>
          )}
      </div>

      <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Itens: {data.storage.racks.length}</span>
            {data.storage.racks.length > 0 && (
                <button 
                    onClick={resetStorage}
                    className="text-red-500 text-xs hover:text-red-400 transition-colors"
                >
                    Limpar Tudo
                </button>
            )}
          </div>
          
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {data.storage.racks.length === 0 && (
                  <li className="text-xs text-gray-600 text-center p-6 border border-dashed border-gray-800 rounded-lg">
                      Nenhum objeto adicionado.
                  </li>
              )}
              {data.storage.racks.map((rack, idx) => (
                  <li key={rack.id} className={`text-xs bg-silicon-input p-3 rounded-lg border flex justify-between items-center group transition-colors ${rack.type === 'MEZZANINE' ? 'border-silicon-teal/30 hover:border-silicon-teal/50' : 'border-gray-700 hover:border-silicon-orange/50'}`}>
                      <div className="flex flex-col flex-1 mr-4">
                        <input 
                            value={rack.label}
                            onChange={(e) => updateRackLabel(rack.id, e.target.value)}
                            className={`font-bold text-sm bg-transparent border-b border-transparent focus:border-gray-500 focus:outline-none w-full ${rack.type === 'MEZZANINE' ? 'text-silicon-teal' : 'text-white'}`}
                        />
                        <span className="text-gray-500 mt-1">Pos: {rack.x.toFixed(2)}m, {rack.y.toFixed(2)}m</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-gray-300 font-mono">{rack.width}x{rack.depth}m</span>
                            <span className={`${rack.type === 'MEZZANINE' ? 'text-silicon-teal' : 'text-silicon-orange'} text-[10px]`}>
                                {rack.type === 'MEZZANINE' ? `Elev: ${rack.elevation}m` : `H: ${rack.height}m`}
                            </span>
                        </div>
                        <button 
                            onClick={() => removeRack(rack.id)}
                            className="text-gray-600 hover:text-red-500 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                  </li>
              ))}
          </ul>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-silicon-input rounded-lg border border-gray-700">
            <Sun className="w-6 h-6 text-silicon-orange" /> 
        </div>
        <h3 className="text-xl font-bold text-white">Luminotécnica</h3>
      </div>
      <DarkInput
        label="ILUMINÂNCIA DESEJADA (Lux)"
        value={data.luxRequired}
        onChange={(e: any) => setData({ ...data, luxRequired: Number(e.target.value) })}
        placeholder="Ex: 300"
      />
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-6">
        <div className="bg-silicon-input p-6 rounded-xl border border-gray-700 text-sm text-gray-300 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-xl text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-silicon-yellow" /> Resumo do Projeto
                </h3>
                
                {/* 3D TOGGLE BUTTON */}
                <div className="flex bg-black/40 rounded-lg p-1 border border-gray-700">
                    <button 
                        onClick={() => setSummaryViewMode('2D')}
                        className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-colors ${summaryViewMode === '2D' ? 'bg-silicon-orange text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Layout size={12} /> 2D
                    </button>
                    <button 
                        onClick={() => setSummaryViewMode('3D')}
                        className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-colors ${summaryViewMode === '3D' ? 'bg-silicon-orange text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Box size={12} /> 3D
                    </button>
                </div>
            </div>

            {/* Project Name Display */}
            <div className="border-b border-gray-700 pb-4 mb-2">
                <p className="text-xs text-gray-500 uppercase font-bold">Projeto</p>
                <p className="text-2xl text-silicon-orange font-bold truncate">{data.projectName}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/50 p-3 rounded border border-gray-800">
                    <p className="text-xs text-gray-500 uppercase font-bold">Dimensões</p>
                    <p className="text-lg text-white font-semibold">{data.width}m x {data.length}m</p>
                </div>
                <div className="bg-black/50 p-3 rounded border border-gray-800">
                    <p className="text-xs text-gray-500 uppercase font-bold">Pé Direito</p>
                    <p className="text-lg text-white font-semibold">{data.ceilingHeight}m</p>
                </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
                <p className="font-semibold text-silicon-teal mb-2 uppercase text-xs tracking-wider">Iluminação</p>
                <div className="space-y-1 pl-2 border-l border-silicon-teal/30">
                    {data.lighting.isActive ? (
                        <>
                        {data.lighting.fixturesPerProfile > 0 && (
                            <p className="text-white font-bold">Luminárias/Perfil: {data.lighting.fixturesPerProfile}</p>
                        )}
                        <p>Orientação: <span className="text-white">{data.lighting.orientation}</span></p>
                        <p>Modo: <span className="text-white">{data.lighting.mode === 'QUANTITY' ? 'Por Quantidade' : 'Por Distância'}</span></p>
                        <p>Valor: <span className="text-white">{data.lighting.value}</span> | Offset: <span className="text-white">{data.lighting.offset}m</span></p>
                        </>
                    ) : (
                        <p className="text-gray-500 italic">Sem perfilado (Nenhuma sugestão gerada).</p>
                    )}
                </div>
            </div>
            
            {data.storage.isActive && (
                <div className="border-t border-gray-700 pt-4">
                    <p className="font-semibold text-silicon-orange mb-2 uppercase text-xs tracking-wider">Armazenagem</p>
                    <div className="space-y-1 pl-2 border-l border-silicon-orange/30">
                        <p>Racks: <span className="text-white">{data.storage.racks.filter(r => r.type === 'RACK').length}</span></p>
                        <p>Mezaninos: <span className="text-white">{data.storage.racks.filter(r => r.type === 'MEZZANINE').length}</span></p>
                    </div>
                </div>
            )}
            
            <div className="border-t border-gray-700 pt-4">
                <p className="text-gray-400">Lux Alvo: <span className="text-silicon-yellow font-bold text-lg">{data.luxRequired} lux</span></p>
            </div>

            <div className="border-t border-gray-700 pt-4">
                <p className="font-semibold text-gray-400 mb-2 uppercase text-xs tracking-wider">Observações</p>
                <textarea
                  value={data.observations}
                  onChange={(e) => setData({...data, observations: e.target.value})}
                  className="w-full h-24 bg-black/30 border border-gray-700 rounded-lg p-3 text-white text-xs focus:ring-1 focus:ring-silicon-orange"
                  placeholder="Insira observações relevantes para o projeto..."
                />
            </div>
        </div>
        <button
            onClick={handleDownload}
            className="w-full flex justify-center items-center gap-2 py-4 px-6 rounded-lg shadow-lg text-sm font-bold text-white bg-silicon-gradient hover:opacity-90 transition-opacity transform active:scale-[0.99]"
        >
            <Download className="w-5 h-5" /> BAIXAR IMAGEM + RESUMO
        </button>
    </div>
  );
  
  // Decide View Mode based on Step
  const canvasViewMode = currentStep === 1 ? '3D' : (currentStep === 5 ? summaryViewMode : '2D');

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-silicon-dark font-sans">
      
      {/* Left Panel: Controls - Widened to 480px */}
      <div className="w-full lg:w-[480px] bg-silicon-surface border-r border-gray-800 flex flex-col h-screen shadow-2xl z-20">
        <div className="p-8 border-b border-gray-800 bg-silicon-gradient relative overflow-hidden">
             {/* Back Button */}
             <button 
                onClick={onBack}
                className="absolute top-4 left-4 z-20 text-white/80 hover:text-white transition-colors"
                title="Voltar ao Menu"
            >
                <ChevronLeft size={20} />
            </button>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
            <div className="relative z-10 pt-4">
                <h1 className="text-3xl font-bold flex items-center gap-2 text-white tracking-tight">
                    <span className="w-3 h-3 rounded-full bg-white animate-pulse"></span>
                    Schema
                </h1>
                <p className="text-white/80 text-xs mt-1 font-medium tracking-widest uppercase">Industrial Builder</p>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
           {/* Progress Indicator */}
           {currentStep <= totalSteps ? (
             <div className="mb-8">
                <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                    <span>Etapa {currentStep} / {totalSteps}</span>
                    <span className="text-silicon-orange">{Math.round((currentStep / totalSteps) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-silicon-gradient h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(240,50,0,0.5)]" style={{ width: `${(currentStep / totalSteps) * 100}%` }}></div>
                </div>
                <h2 className="text-2xl font-bold text-white mt-6 leading-tight">{STEP_TITLES[currentStep - 1]}</h2>
             </div>
           ) : null}

           {/* Step Content */}
           <div className="animate-fade-in">
             {currentStep === 1 && renderStep1()}
             {currentStep === 2 && renderStep2()}
             {currentStep === 3 && renderStep3()}
             {currentStep === 4 && renderStep4()}
             {currentStep === 5 && renderSummary()}
           </div>
        </div>

        {/* Navigation Buttons */}
        <div className="p-6 border-t border-gray-800 bg-silicon-surface flex justify-between items-center">
            {currentStep > 1 && (
                 <button 
                 onClick={prevStep}
                 className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
               >
                 <ArrowLeft className="w-4 h-4" /> Voltar
               </button>
            )}
            {currentStep === 1 && <div />} 

            {currentStep < totalSteps ? (
                <button 
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white bg-silicon-orange hover:bg-[#D02B00] transition-colors shadow-lg shadow-orange-900/30"
              >
                Próximo <ArrowRight className="w-4 h-4" />
              </button>
            ) : null }

             {currentStep === totalSteps && (
                <button 
                    onClick={handleNewProject}
                    className="flex items-center gap-2 px-5 py-2.5 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                    Novo Projeto
                </button>
             )}

        </div>
      </div>

      {/* Right Panel: Visualization */}
      <div 
        className="w-full lg:w-full bg-[#0a0a0a] relative overflow-hidden flex flex-col"
        style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a1a 1px, transparent 1px)',
            backgroundSize: '40px 40px'
        }}
      >
        <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center p-8">
            <WarehouseCanvas 
                ref={canvasRef}
                data={data} 
                width={900} 
                height={700}
                isInteractive={currentStep === 3}
                viewMode={canvasViewMode}
                onRackMove={handleRackMove}
            />
        </div>
      </div>
    </div>
  );
}
