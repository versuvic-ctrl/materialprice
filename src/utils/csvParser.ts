interface CorrosionRating {
  concentrations: {
    concentration_1?: {
      chemical: string;
      value: string;
    };
    concentration_2?: {
      chemical: string;
      value: string;
    };
    concentration_3?: {
      chemical: string;
      value: string;
    };
  };
  temperature: string;
  rating: string;
  cell_class: string[];
}

interface CorrosionDataEntry {
  chemical: string;
  chemical_url: string;
  chemical_formulas: { [key: string]: string };
  material: string;
  corrosion_ratings: CorrosionRating[];
}

interface ChemicalLink {
  name: string;
  url: string;
  letter: string;
}

interface AlleimaCorrosionData {
  chemical_links: ChemicalLink[];
  symbol_clarification: { [key: string]: string };
  corrosion_data: CorrosionDataEntry[];
}

interface CSVRow {
  chemical: string;
  chemical_url: string;
  chemical_formulas: string;
  material: string;
  table_index: string;
  temperature: string;
  rating: string;
  cell_class: string;
  concentration_1_chemical: string;
  concentration_1_value: string;
  concentration_2_chemical: string;
  concentration_2_value: string;
  concentration_3_chemical: string;
  concentration_3_value: string;
}

// Symbol clarification 정의 (JSON에서 가져온 것과 동일)
const SYMBOL_CLARIFICATION = {
  "0": "Corrosion rate less than 0.1 mm/year. The material is corrosion proof.",
  "1": "Corrosion rate 0.1—1.0 mm/year. The material is not corrosion proof, but useful in certain cases.",
  "2": "Corrosion rate over 1.0 mm/year. Serious corrosion. The material is not usable.",
  "p, P": "Risk (severe risk) of pitting and crevice corrosion.",
  "c, C": "Risk (Severe risk) of crevice corrosion. Used when there is a risk of localised corrosion only if crevices are present. Under more severe conditions, when there is also a risk of pitting corrosion, the symbols p or P are used instead.",
  "s, S": "Risk (Severe risk) of stress corrosion cracking.",
  "ig": "Risk of intergranular corrosion.",
  "BP": "Boiling solution.",
  "ND": "No data. (Used only where there are no actual data to estimate the risk of localised corrosion instead of p or s)."
};

export function parseCSV(csvText: string): string[][] {
  const lines = csvText.split('\n');
  const result: string[][] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    let inBraces = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"' && !inBraces) {
        inQuotes = !inQuotes;
      } else if (char === '{' && !inQuotes) {
        inBraces = true;
        current += char;
      } else if (char === '}' && !inQuotes) {
        inBraces = false;
        current += char;
      } else if (char === ',' && !inQuotes && !inBraces) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current) {
      row.push(current.trim());
    }
    
    result.push(row);
  }
  
  return result;
}

export function csvToAlleimaData(csvText: string): AlleimaCorrosionData {
  const rows = parseCSV(csvText);
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  // 화학물질별로 그룹화
  const chemicalGroups = new Map<string, CSVRow[]>();
  const chemicalLinks = new Set<ChemicalLink>();
  
  for (const row of dataRows) {
    if (row.length < headers.length) continue;
    
    const csvRow: CSVRow = {
      chemical: row[0] || '',
      chemical_url: row[1] || '',
      chemical_formulas: row[2] || '',
      material: row[3] || '',
      table_index: row[4] || '',
      temperature: row[5] || '',
      rating: row[6] || '',
      cell_class: row[7] || '',
      concentration_1_chemical: row[8] || '',
      concentration_1_value: row[9] || '',
      concentration_2_chemical: row[10] || '',
      concentration_2_value: row[11] || '',
      concentration_3_chemical: row[12] || '',
      concentration_3_value: row[13] || ''
    };
    
    // 화학물질 링크 수집
    if (csvRow.chemical && csvRow.chemical_url) {
      chemicalLinks.add({
        name: csvRow.chemical,
        url: csvRow.chemical_url,
        letter: csvRow.chemical.charAt(0).toUpperCase()
      });
    }
    
    // 화학물질별로 그룹화
    const key = `${csvRow.chemical}_${csvRow.material}`;
    if (!chemicalGroups.has(key)) {
      chemicalGroups.set(key, []);
    }
    chemicalGroups.get(key)!.push(csvRow);
  }
  
  // CorrosionDataEntry 생성
  const corrosionData: CorrosionDataEntry[] = [];
  
  for (const [key, rows] of chemicalGroups) {
    if (rows.length === 0) continue;
    
    const firstRow = rows[0];
    let chemical_formulas: { [key: string]: string } = {};
    
    // chemical_formulas 파싱
    try {
      if (firstRow.chemical_formulas) {
        chemical_formulas = JSON.parse(firstRow.chemical_formulas);
      }
    } catch (e) {
      console.warn('Failed to parse chemical_formulas:', firstRow.chemical_formulas);
    }
    
    // corrosion_ratings 생성
    const corrosionRatings: CorrosionRating[] = rows.map(row => {
      const concentrations: any = {};
      
      if (row.concentration_1_chemical && row.concentration_1_value) {
        concentrations.concentration_1 = {
          chemical: row.concentration_1_chemical,
          value: row.concentration_1_value
        };
      }
      
      if (row.concentration_2_chemical && row.concentration_2_value) {
        concentrations.concentration_2 = {
          chemical: row.concentration_2_chemical,
          value: row.concentration_2_value
        };
      }
      
      if (row.concentration_3_chemical && row.concentration_3_value) {
        concentrations.concentration_3 = {
          chemical: row.concentration_3_chemical,
          value: row.concentration_3_value
        };
      }
      
      return {
        concentrations,
        temperature: row.temperature,
        rating: row.rating,
        cell_class: row.cell_class ? row.cell_class.split(',').map(c => c.trim()) : []
      };
    });
    
    corrosionData.push({
      chemical: firstRow.chemical,
      chemical_url: firstRow.chemical_url,
      chemical_formulas,
      material: firstRow.material,
      corrosion_ratings: corrosionRatings
    });
  }
  
  return {
    chemical_links: Array.from(chemicalLinks).sort((a, b) => a.name.localeCompare(b.name)),
    symbol_clarification: SYMBOL_CLARIFICATION,
    corrosion_data: corrosionData
  };
}

export async function loadCorrosionDataFromCSV(): Promise<AlleimaCorrosionData> {
  try {
    const response = await fetch('/src/data/alleima_corrosion_data_full.csv');
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    }
    const csvText = await response.text();
    return csvToAlleimaData(csvText);
  } catch (error) {
    console.error('Error loading CSV data:', error);
    throw error;
  }
}