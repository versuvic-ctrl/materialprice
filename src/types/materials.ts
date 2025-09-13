export interface Material {
  id: string;
  name: string;
  category: string;
  description?: string;
  properties: MaterialProperty[];
  prices: MaterialPrice[];
  history: MaterialHistory[];
}

export interface MaterialProperty {
  name: string;
  value: string | number;
  unit?: string;
}

export interface MaterialPrice {
  material?: string;
  size?: string;
  price: number;
  currency?: string;
  unit?: string;
  change?: string;
  date?: string;
}

export interface MaterialHistory {
  date: string;
  material?: string;
  price: number;
  volume?: number;
  supplier?: string;
}

export interface MaterialCategory {
  id: string;
  name: string;
  description?: string;
  materials: Material[];
}