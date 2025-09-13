import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface MaterialProperties {
  tensileStrength: string;
  yieldStrength: string;
  elongation: string;
  hardness: string;
  meltingPoint: string;
  density: string;
  thermalConductivity: string;
}

export const materialProperties: Record<string, MaterialProperties> = {
  "SUS304": {
    tensileStrength: "520-720",
    yieldStrength: "205",
    elongation: "40",
    hardness: "170",
    meltingPoint: "1400-1450",
    density: "8.0",
    thermalConductivity: "16.2"
  },
  "SUS316": {
    tensileStrength: "520-720",
    yieldStrength: "205",
    elongation: "40",
    hardness: "165",
    meltingPoint: "1375-1400",
    density: "8.0",
    thermalConductivity: "16.3"
  },
  "SS275": {
    tensileStrength: "400-510",
    yieldStrength: "275",
    elongation: "18-22",
    hardness: "116-149",
    meltingPoint: "1420-1460",
    density: "7.85",
    thermalConductivity: "50"
  }
};

export const getMaterialProperties = (materialName: string, grade?: string): MaterialProperties | null => {
  const propertyKey = Object.keys(materialProperties).find(key => 
    materialName.includes(key) || (grade && grade.includes(key))
  );
  return propertyKey ? materialProperties[propertyKey] : null;
};