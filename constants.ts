
export const STEP_TITLES = [
  "Definição do Galpão", // Step 1
  "Infraestrutura de Iluminação", // Step 2
  "Layout de Armazenagem", // Step 3 (Now includes height)
  "Requisito Luminotécnico", // Step 4 (Was 5)
  "Resumo Técnico" // Step 5 (Was 6)
];

// Silicon Brand Colors for Canvas
export const PALLET_COLOR = "rgba(240, 50, 0, 0.25)"; // #F03200 with low opacity
export const PALLET_STROKE = "#F03200"; // Silicon Orange

export const MEZZANINE_COLOR = "rgba(66, 192, 181, 0.25)"; // Silicon Teal low opacity
export const MEZZANINE_STROKE = "#42C0B5"; // Silicon Teal

export const LIGHTING_COLOR = "#42C0B5"; // Silicon Teal (LED Subbrand)
// Changed from White to a dark/strong color for visibility on white background, 
// and logic in 3D usually handles its own colors.
export const FIXTURE_COLOR = "#F03200"; // Silicon Orange for high contrast on white floor
export const FIXTURE_GLOW = "rgba(246, 200, 71, 0.8)"; // Stronger Yellow Glow
export const WALL_COLOR = "#1f2937"; // Gray-800
export const DIMENSION_COLOR = "#7F3F98"; // Silicon Purple
