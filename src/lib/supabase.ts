import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 자재 가격 데이터 타입 정의
export interface MaterialPriceDB {
  id: number
  material_name: string
  price: number
  unit: string
  change_percent: number
  last_updated: string
  created_at: string
}

export interface MaterialHistoryDB {
  id: number
  material_name: string
  price: number
  date: string
  created_at: string
}

// 자재 가격 데이터 조회 함수
export async function getCurrentPricesFromDB() {
  const { data, error } = await supabase
    .from('material_prices')
    .select('*')
    .order('last_updated', { ascending: false })
  
  if (error) {
    console.error('Error fetching current prices:', error)
    return null
  }
  
  return data
}

// 자재 가격 히스토리 조회 함수
export async function getMaterialHistoryFromDB(materialName: string, period: string = '7d') {
  const daysAgo = period === '30d' ? 30 : period === '7d' ? 7 : 1
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysAgo)
  
  const { data, error } = await supabase
    .from('materialprice_kpi')
    .select('*')
    .eq('material_name', materialName)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true })
  
  if (error) {
    console.error('Error fetching material history:', error)
    return null
  }
  
  return data
}

// 자재 가격 데이터 삽입 함수
export async function insertMaterialPrice(materialData: Omit<MaterialPriceDB, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('material_prices')
    .insert([materialData])
    .select()
  
  if (error) {
    console.error('Error inserting material price:', error)
    return null
  }
  
  return data
}

// 자재 가격 히스토리 데이터 삽입 함수
export async function insertMaterialHistory(historyData: Omit<MaterialHistoryDB, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('materialprice_kpi')
    .insert([historyData])
    .select()
  
  if (error) {
    console.error('Error inserting material history:', error)
    return null
  }
  
  return data
}