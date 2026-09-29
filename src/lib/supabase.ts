import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CafeMenuRow {
  id: string;
  customer_name: string;
  phone: string | null;
  drink_name: string;
  size: string;
  options: string[] | null;
  quantity: number;
  requests: string | null;
  total_price: number;
  order_status: string;
  created_at: string;
}

export type CafeMenuInsert = Omit<CafeMenuRow, 'id' | 'created_at'>;

const STORAGE_URL_KEY = 'cafe_supabase_url';
const STORAGE_KEY_KEY = 'cafe_supabase_anon_key';

/**
 * Supabase 접속 정보를 가져옵니다. (.env 우선 -> 로컬스토리지 fallback)
 */
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) || '' : '';
  const localAnonKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) || '' : '';

  return {
    url: (envUrl || localUrl || '').trim(),
    anonKey: (envAnonKey || localAnonKey || '').trim(),
  };
}

/**
 * 로컬스토리지에 Supabase 접속 정보 저장
 */
export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  }
  supabaseInstance = null; // 인스턴스 재생성 유도
}

/**
 * 저장된 Supabase 접속 정보 삭제
 */
export function clearSupabaseCredentials() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_KEY_KEY);
  }
  supabaseInstance = null;
}

let supabaseInstance: SupabaseClient | null = null;

/**
 * Supabase 클라이언트 싱글톤 인스턴스 반환
 */
export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();

  if (!url || !anonKey) {
    return null;
  }

  // URL 유효성 검사 (http 또는 https로 시작)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, anonKey);
    } catch (err) {
      console.error('Supabase 클라이언트 생성 실패:', err);
      return null;
    }
  }

  return supabaseInstance;
}

/**
 * Supabase 연결 상태 테스트
 */
export async function testSupabaseConnection(customUrl?: string, customKey?: string): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    let client: SupabaseClient;
    if (customUrl && customKey) {
      client = createClient(customUrl.trim(), customKey.trim());
    } else {
      const activeClient = getSupabaseClient();
      if (!activeClient) {
        return { success: false, message: 'Supabase URL과 Anon Key가 입력되지 않았습니다.' };
      }
      client = activeClient;
    }

    const { data, error, count } = await client
      .from('cafe_menu')
      .select('id', { count: 'exact' })
      .limit(1);

    if (error) {
      // 테이블이 존재하지 않는 경우
      if (error.code === '42P01') {
        return { 
          success: false, 
          message: 'cafe_menu 테이블이 존재하지 않습니다. 제공된 SQL 스크립트를 Supabase SQL Editor에서 실행해주세요.' 
        };
      }
      // RLS 권한 에러 등
      return { success: false, message: `조회 실패: ${error.message}` };
    }

    return { 
      success: true, 
      message: `성공적으로 Supabase에 연결되었습니다! (기존 주문: ${count ?? (data?.length || 0)}건)`,
      count: count ?? (data?.length || 0)
    };
  } catch (err: any) {
    return { success: false, message: `연결 오류: ${err?.message || '알 수 없는 오류'}` };
  }
}

/**
 * 주문 목록 조회
 */
export async function fetchCafeOrders(): Promise<{ orders: CafeMenuRow[]; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { orders: [], error: new Error('Supabase가 연결되어 있지 않습니다.') };
  }

  try {
    const { data, error } = await client
      .from('cafe_menu')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { orders: (data as CafeMenuRow[]) || [], error: null };
  } catch (err: any) {
    return { orders: [], error: err };
  }
}

/**
 * 신규 주문 삽입
 */
export async function insertCafeOrder(order: CafeMenuInsert): Promise<{ data: CafeMenuRow | null; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: new Error('Supabase가 연결되어 있지 않습니다.') };
  }

  try {
    const { data, error } = await client
      .from('cafe_menu')
      .insert([order])
      .select()
      .single();

    if (error) throw error;
    return { data: data as CafeMenuRow, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * 주문 상태 변경 (접수완료 -> 제조중 -> 준비완료 -> 수령완료)
 */
export async function updateCafeOrderStatus(orderId: string, status: string): Promise<{ success: boolean; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: new Error('Supabase가 연결되어 있지 않습니다.') };
  }

  try {
    const { error } = await client
      .from('cafe_menu')
      .update({ order_status: status })
      .eq('id', orderId);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * 주문 삭제
 */
export async function deleteCafeOrder(orderId: string): Promise<{ success: boolean; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: new Error('Supabase가 연결되어 있지 않습니다.') };
  }

  try {
    const { error } = await client
      .from('cafe_menu')
      .delete()
      .eq('id', orderId);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}
