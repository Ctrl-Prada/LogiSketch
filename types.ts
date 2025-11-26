
export enum LightingOrientation {
  Longitudinal = 'LONGITUDINAL', // Parallel to Length
  Transversal = 'TRANSVERSAL',   // Parallel to Width
}

export enum LightingMode {
  Quantity = 'QUANTITY',
  Distance = 'DISTANCE',
}

export interface LightingConfig {
  isActive: boolean;
  orientation: LightingOrientation;
  mode: LightingMode;
  value: number; // Quantity of profiles or Distance between them
  offset: number; // Distance from first wall
  fixtureQty: number; // Legacy total
  fixturesPerProfile: number; // New: Quantity per profile line
}

export type ObjectType = 'RACK' | 'MEZZANINE';

export interface RackBlock {
  id: string;
  type: ObjectType;
  x: number; // Distance from Left Wall (meters)
  y: number; // Distance from Top Wall (meters)
  width: number; // Dimension of the block itself
  depth: number; // Dimension of the block itself
  height: number; // Specific height of this block (Thickness for mezzanine)
  elevation: number; // Height from ground (0 for racks)
  label: string;
}

export interface StorageConfig {
  isActive: boolean;
  racks: RackBlock[];
}

export interface ProjectData {
  projectName: string; // New field
  // Step 1 (Merged)
  width: number;
  length: number;
  ceilingHeight: number;
  // Step 2
  lighting: LightingConfig;
  // Step 3
  storage: StorageConfig;
  // Step 4
  luxRequired: number;
  // Step 5
  observations: string;
}

export const DEFAULT_PROJECT: ProjectData = {
  projectName: "Novo Projeto",
  width: 0,
  length: 0,
  ceilingHeight: 0,
  lighting: {
    isActive: true,
    orientation: LightingOrientation.Longitudinal,
    mode: LightingMode.Distance,
    value: 5,
    offset: 2,
    fixtureQty: 0, 
    fixturesPerProfile: 0,
  },
  storage: {
    isActive: false,
    racks: [],
  },
  luxRequired: 300,
  observations: "",
};

// --- SPORTS MODULE TYPES ---

export type SportsObjectType = 'POST' | 'COVERING';

export interface SportsObject {
  id: string;
  type: SportsObjectType;
  x: number;
  y: number;
  width: number; // For posts: Diameter/Size. For Covering: Width
  depth: number;
  height: number; // Post height or Covering thickness
  elevation: number; // For Covering: Height from ground
  label: string;
}

export interface SportsProjectData {
  width: number;
  length: number;
  objects: SportsObject[];
  observations: string;
}

export const DEFAULT_SPORTS_PROJECT: SportsProjectData = {
  width: 40,
  length: 20,
  objects: [],
  observations: ""
};