/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useId, useEffect, useCallback } from 'react';
import { 
  Coffee, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  ReceiptText, 
  Sparkles,
  ChevronDown,
  Database,
  RefreshCw,
  Trash2,
  CloudCheck,
  HardDrive
} from 'lucide-react';
import { SupabaseModal } from './components/SupabaseModal';
import { 
  getSupabaseClient,
  getSupabaseCredentials,
  fetchCafeOrders,
  insertCafeOrder,
  updateCafeOrderStatus,
  deleteCafeOrder,
  testSupabaseConnection,
  CafeMenuRow
} from './lib/supabase';

// ==========================================
// 1. 타입 정의 및 메뉴 데이터 상수
// ==========================================

/** 음료 메뉴 항목 인터페이스 */
interface BeverageItem {
  id: string;
  name: string;
  price: number;
}

/** 음료 목록 (드롭다운 옵션) */
const BEVERAGE_LIST: BeverageItem[] = [
  { id: 'americano', name: '아메리카노', price: 3500 },
  { id: 'latte', name: '카페라떼', price: 4000 },
  { id: 'mocha', name: '카페모카', price: 4500 },
  { id: 'vanilla', name: '바닐라라떼', price: 4500 },
  { id: 'greentea', name: '녹차라떼', price: 4500 },
];

/** 사이즈 옵션 (라디오 버튼) */
interface SizeOption {
  id: 'S' | 'M' | 'L';
  name: string;
  extraPrice: number;
}

const SIZE_OPTIONS: SizeOption[] = [
  { id: 'S', name: 'S', extraPrice: 0 },
  { id: 'M', name: 'M', extraPrice: 500 }, // 기본 선택
  { id: 'L', name: 'L', extraPrice: 1000 },
];

/** 추가 옵션 (체크박스) */
interface ExtraOption {
  id: string;
  name: string;
  price: number;
}

const EXTRA_OPTIONS: ExtraOption[] = [
  { id: 'extra_shot', name: '샷 추가', price: 500 },
  { id: 'extra_cream', name: '크림 추가', price: 500 },
  { id: 'extra_syrup', name: '시럽 추가', price: 300 },
  { id: 'decaf', name: '디카페인', price: 0 },
];

/** 주문 완료 데이터 인터페이스 */
interface OrderRecord {
  id: string;
  customerName: string;
  customerPhone: string;
  beverageName: string;
  sizeName: string;
  selectedOptionsText: string;
  quantity: number;
  totalPrice: number;
  requests: string;
  orderStatus: string;
  orderedAt: string;
  isSupabase: boolean;
}

export default function App() {
  // ==========================================
  // 2. 컴포넌트 상태(State) 관리
  // ==========================================

  // 1) 주문서 입력 폼 상태
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [selectedBeverageId, setSelectedBeverageId] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<'S' | 'M' | 'L'>('M'); // 기본값: M
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1); // 기본값: 1
  const [requests, setRequests] = useState<string>('');

  // 2) 유효성 검사 경고 및 주문 완료 메시지 상태
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 3) 주문 내역 목록 (게시판 형태 보관)
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  // 4) Supabase 연동 상태 관리
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

  // 폼 필드 접근성을 위한 고유 ID
  const nameId = useId();
  const phoneId = useId();
  const beverageId = useId();
  const quantityId = useId();
  const requestsId = useId();

  // ==========================================
  // 3. Supabase 데이터 조회 및 실시간 연동
  // ==========================================

  // 주문 목록 로드 함수
  const loadOrdersFromSupabase = useCallback(async () => {
    const creds = getSupabaseCredentials();
    if (!creds.url || !creds.anonKey) {
      setIsSupabaseConnected(false);
      return;
    }

    setIsLoadingOrders(true);
    const { orders: dbOrders, error } = await fetchCafeOrders();
    setIsLoadingOrders(false);

    if (error) {
      console.warn('Supabase 주문 로드 실패:', error.message);
      return;
    }

    const mapped: OrderRecord[] = dbOrders.map((row: CafeMenuRow) => {
      let timeText = '방금 전';
      if (row.created_at) {
        try {
          const date = new Date(row.created_at);
          timeText = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        } catch {
          timeText = row.created_at;
        }
      }

      return {
        id: row.id,
        customerName: row.customer_name,
        customerPhone: row.phone || '미입력',
        beverageName: row.drink_name,
        sizeName: row.size,
        selectedOptionsText: row.options && row.options.length > 0 ? row.options.join(', ') : '없음',
        quantity: row.quantity,
        totalPrice: row.total_price,
        requests: row.requests || '없음',
        orderStatus: row.order_status || '접수완료',
        orderedAt: timeText,
        isSupabase: true,
      };
    });

    setOrders(mapped);
    setIsSupabaseConnected(true);
  }, []);

  // 초기 접속 시 연결 여부 확인 및 실시간 리스너 등록
  useEffect(() => {
    let channel: any = null;

    const checkConnectionAndSubscribe = async () => {
      const creds = getSupabaseCredentials();
      if (!creds.url || !creds.anonKey) {
        setIsSupabaseConnected(false);
        return;
      }

      const res = await testSupabaseConnection();
      if (res.success) {
        setIsSupabaseConnected(true);
        await loadOrdersFromSupabase();

        // Supabase Realtime 구독 설정
        const client = getSupabaseClient();
        if (client) {
          try {
            channel = client
              .channel('cafe-orders-realtime')
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cafe_menu' },
                () => {
                  loadOrdersFromSupabase();
                }
              )
              .subscribe();
          } catch (e) {
            console.warn('Realtime 구독 실패:', e);
          }
        }
      } else {
        setIsSupabaseConnected(false);
      }
    };

    checkConnectionAndSubscribe();

    return () => {
      if (channel) {
        const client = getSupabaseClient();
        client?.removeChannel(channel);
      }
    };
  }, [loadOrdersFromSupabase]);

  // ==========================================
  // 4. 실시간 예상 금액 계산 로직
  // ==========================================
  const estimatedPrice = useMemo(() => {
    const beverage = BEVERAGE_LIST.find((item) => item.id === selectedBeverageId);
    const basePrice = beverage ? beverage.price : 0;

    if (!beverage) return 0;

    const size = SIZE_OPTIONS.find((item) => item.id === selectedSize);
    const sizePrice = size ? size.extraPrice : 0;

    const optionsPrice = selectedOptions.reduce((acc, optId) => {
      const opt = EXTRA_OPTIONS.find((item) => item.id === optId);
      return acc + (opt ? opt.price : 0);
    }, 0);

    const singleItemPrice = basePrice + sizePrice + optionsPrice;
    return singleItemPrice * Math.max(1, quantity);
  }, [selectedBeverageId, selectedSize, selectedOptions, quantity]);

  // ==========================================
  // 5. 이벤트 핸들러
  // ==========================================

  // 체크박스 토글 핸들러
  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  };

  // 수량 변경 핸들러 (최소 1, 최대 10)
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setQuantity(1);
    } else {
      const clampedVal = Math.min(10, Math.max(1, val));
      setQuantity(clampedVal);
    }
  };

  // 폼 초기화 (다시 작성 버튼)
  const handleReset = () => {
    setCustomerName('');
    setCustomerPhone('');
    setSelectedBeverageId('');
    setSelectedSize('M');
    setSelectedOptions([]);
    setQuantity(1);
    setRequests('');
    setValidationError(null);
    setConfirmationMessage(null);
  };

  // 주문 상태 변경 핸들러
  const handleUpdateStatus = async (orderId: string, currentStatus: string, isFromSupabase: boolean) => {
    const statusFlow = ['접수완료', '제조중', '준비완료', '수령완료'];
    const currentIndex = statusFlow.indexOf(currentStatus);
    const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];

    if (isFromSupabase && isSupabaseConnected) {
      const res = await updateCafeOrderStatus(orderId, nextStatus);
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, orderStatus: nextStatus } : o))
        );
      } else {
        alert('상태 변경에 실패했습니다: ' + (res.error?.message || ''));
      }
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, orderStatus: nextStatus } : o))
      );
    }
  };

  // 주문 삭제 핸들러
  const handleDeleteOrder = async (orderId: string, isFromSupabase: boolean) => {
    if (!confirm('해당 주문을 삭제하시겠습니까?')) return;

    if (isFromSupabase && isSupabaseConnected) {
      const res = await deleteCafeOrder(orderId);
      if (res.success) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        alert('주문 삭제 실패: ' + (res.error?.message || ''));
      }
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    }
  };

  // 주문하기 버튼 핸들러
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) 이름 필수 검증
    if (!customerName.trim()) {
      setValidationError('이름을 입력해주세요.');
      setConfirmationMessage(null);
      return;
    }

    // 2) 음료 선택 필수 검증
    if (!selectedBeverageId) {
      setValidationError('음료를 선택해주세요.');
      setConfirmationMessage(null);
      return;
    }

    setValidationError(null);

    const beverage = BEVERAGE_LIST.find((item) => item.id === selectedBeverageId);
    const beverageName = beverage ? beverage.name : '';

    const optionNames = selectedOptions
      .map((optId) => EXTRA_OPTIONS.find((item) => item.id === optId)?.name)
      .filter((n): n is string => Boolean(n));

    const optionsText = optionNames.length > 0 ? ` (${optionNames.join(', ')})` : '';

    setIsSubmitting(true);

    // Supabase 연동 상태인 경우 DB 저장 시도
    if (isSupabaseConnected) {
      const { data, error } = await insertCafeOrder({
        customer_name: customerName.trim(),
        phone: customerPhone.trim() || null,
        drink_name: beverageName,
        size: selectedSize,
        options: optionNames,
        quantity,
        requests: requests.trim() || null,
        total_price: estimatedPrice,
        order_status: '접수완료',
      });

      setIsSubmitting(false);

      if (error) {
        setValidationError(`Supabase DB 저장 실패: ${error.message}`);
        return;
      }

      if (data) {
        const successMsg = `${customerName.trim()}님, ${beverageName} ${selectedSize}사이즈${optionsText} ${quantity}잔, 총 ${estimatedPrice.toLocaleString()}원 주문이 Supabase DB에 저장되었습니다!`;
        setConfirmationMessage(successMsg);

        // 로컬 목록에 추가 (실시간 구독과 중복 방지를 위해 바로 반영)
        const newRecord: OrderRecord = {
          id: data.id,
          customerName: data.customer_name,
          customerPhone: data.phone || '미입력',
          beverageName: data.drink_name,
          sizeName: data.size,
          selectedOptionsText: data.options && data.options.length > 0 ? data.options.join(', ') : '없음',
          quantity: data.quantity,
          totalPrice: data.total_price,
          requests: data.requests || '없음',
          orderStatus: data.order_status || '접수완료',
          orderedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          isSupabase: true,
        };

        setOrders((prev) => [newRecord, ...prev.filter((o) => o.id !== data.id)]);
      }
    } else {
      // Supabase 미연동 시 로컬 상태에만 보관
      setIsSubmitting(false);

      const successMsg = `${customerName.trim()}님, ${beverageName} ${selectedSize}사이즈${optionsText} ${quantity}잔, 총 ${estimatedPrice.toLocaleString()}원 주문이 접수되었습니다! (로컬 보관)`;
      setConfirmationMessage(successMsg);

      const newRecord: OrderRecord = {
        id: `LOCAL-${Date.now().toString().slice(-6)}`,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || '미입력',
        beverageName,
        sizeName: selectedSize,
        selectedOptionsText: optionNames.length > 0 ? optionNames.join(', ') : '없음',
        quantity,
        totalPrice: estimatedPrice,
        requests: requests.trim() || '없음',
        orderStatus: '접수완료',
        orderedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        isSupabase: false,
      };

      setOrders((prev) => [newRecord, ...prev]);
    }
  };

  return (
    <main className="min-h-screen py-8 px-4 flex flex-col items-center justify-start bg-[#f5efe6] text-[#3e2723]">
      {/* 상단 액션바: 카페 오픈 뱃지 & Supabase 연동 상태 */}
      <div className="w-full max-w-[520px] flex items-center justify-between mb-4 gap-2">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#eaddcf] text-[#6b4226] shadow-xs border border-[#ebdccc]">
          <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse"></span>
          오픈 중 • 주문 환영
        </span>

        {/* Supabase 연동 버튼 */}
        <button
          type="button"
          onClick={() => setIsSupabaseModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-xs border ${
            isSupabaseConnected
              ? 'bg-[#ecfdf5] text-[#15803d] border-[#a7f3d0] hover:bg-[#d1fae5]'
              : 'bg-[#fffbeb] text-[#b45309] border-[#fde68a] hover:bg-[#fef3c7] animate-pulse'
          }`}
          title="Supabase 데이터베이스 연동 설정"
        >
          <Database className="w-3.5 h-3.5" />
          {isSupabaseConnected ? 'Supabase 연동됨' : 'Supabase 연결하기'}
        </button>
      </div>

      {/* 메인 주문 카드 (최대 너비 520px, 가운데 정렬, 베이지 배경 #faf6f0, 브라운 테두리 및 부드러운 그림자) */}
      <section 
        aria-labelledby="cafe-title"
        className="w-full max-w-[520px] bg-[#faf6f0] border border-[#ebdccc] rounded-2xl shadow-lg p-6 sm:p-8"
      >
        {/* ==========================================
            [페이지 상단]
            - 카페 로고: ☕ 이모지 크게
            - 카페 이름: "바이브 카페"
            - 부제: "당신의 하루에 바이브를 더하다"
           ========================================== */}
        <header className="text-center pb-6 border-b border-[#ebdccc] mb-6">
          <div className="text-5xl mb-2 select-none" role="img" aria-label="따뜻한 커피">
            ☕
          </div>
          <h1 id="cafe-title" className="text-2xl font-bold tracking-tight text-[#6b4226]">
            바이브 카페
          </h1>
          <p className="text-sm text-[#8c674b] mt-1 font-medium">
            당신의 하루에 바이브를 더하다
          </p>
        </header>

        {/* ==========================================
            [주문서 폼 영역]
           ========================================== */}
        <form onSubmit={handleOrderSubmit} className="space-y-5">
          {/* 1. 이름 (필수, text) */}
          <div>
            <label htmlFor={nameId} className="block text-sm font-semibold text-[#6b4226] mb-1.5">
              1. 이름 <span className="text-red-600 font-bold" aria-label="필수 입력">*</span>
            </label>
            <input
              id={nameId}
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="주문하시는 분의 성함을 입력하세요"
              className="cafe-input"
            />
          </div>

          {/* 2. 전화번호 (tel) */}
          <div>
            <label htmlFor={phoneId} className="block text-sm font-semibold text-[#6b4226] mb-1.5">
              2. 전화번호
            </label>
            <input
              id={phoneId}
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="010-1234-5678 (주문 알림용)"
              className="cafe-input"
            />
          </div>

          {/* 3. 음료 선택 (드롭다운) */}
          <div>
            <label htmlFor={beverageId} className="block text-sm font-semibold text-[#6b4226] mb-1.5">
              3. 음료 선택 <span className="text-red-600 font-bold" aria-label="필수 선택">*</span>
            </label>
            <div className="relative">
              <select
                id={beverageId}
                value={selectedBeverageId}
                onChange={(e) => setSelectedBeverageId(e.target.value)}
                className="cafe-input appearance-none pr-9 cursor-pointer"
              >
                <option value="">음료를 선택해주세요</option>
                {BEVERAGE_LIST.map((drink) => (
                  <option key={drink.id} value={drink.id}>
                    {drink.name} ({drink.price.toLocaleString()}원)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#8c674b]">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 4. 사이즈 (라디오 버튼, 가로 배치) */}
          <fieldset>
            <legend className="block text-sm font-semibold text-[#6b4226] mb-2">
              4. 사이즈
            </legend>
            <div className="flex flex-wrap items-center gap-4 py-1">
              {SIZE_OPTIONS.map((size) => (
                <label
                  key={size.id}
                  htmlFor={`size-${size.id}`}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                    selectedSize === size.id
                      ? 'bg-[#ebdccc] border-[#6b4226] font-semibold text-[#6b4226]'
                      : 'bg-white border-[#d4c4b5] text-[#4a3525] hover:bg-[#f9f5f0]'
                  }`}
                >
                  <input
                    type="radio"
                    id={`size-${size.id}`}
                    name="coffee-size"
                    value={size.id}
                    checked={selectedSize === size.id}
                    onChange={() => setSelectedSize(size.id)}
                    className="cafe-radio w-4 h-4"
                  />
                  <span>
                    {size.name}{' '}
                    <span className="text-xs text-[#8c674b]">
                      ({size.extraPrice === 0 ? '+0원' : `+${size.extraPrice.toLocaleString()}원`})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 5. 추가 옵션 (체크박스, 가로 배치) */}
          <fieldset>
            <legend className="block text-sm font-semibold text-[#6b4226] mb-2">
              5. 추가 옵션 (중복 선택 가능)
            </legend>
            <div className="flex flex-wrap items-center gap-3 py-1">
              {EXTRA_OPTIONS.map((opt) => {
                const isChecked = selectedOptions.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    htmlFor={`opt-${opt.id}`}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs sm:text-sm cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-[#ebdccc] border-[#6b4226] font-medium text-[#6b4226]'
                        : 'bg-white border-[#d4c4b5] text-[#4a3525] hover:bg-[#f9f5f0]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`opt-${opt.id}`}
                      checked={isChecked}
                      onChange={() => handleOptionToggle(opt.id)}
                      className="cafe-checkbox w-4 h-4 rounded"
                    />
                    <span>
                      {opt.name}{' '}
                      <span className="text-xs text-[#8c674b]">
                        ({opt.price === 0 ? '+0원' : `+${opt.price.toLocaleString()}원`})
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 6. 수량 (number 타입, 최소 1, 최대 10, 기본값 1) */}
          <div>
            <label htmlFor={quantityId} className="block text-sm font-semibold text-[#6b4226] mb-1.5">
              6. 수량 <span className="text-xs font-normal text-[#8c674b]">(최소 1잔 ~ 최대 10잔)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                id={quantityId}
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={handleQuantityChange}
                className="cafe-input max-w-[120px] font-semibold text-center text-lg"
              />
              <div className="flex items-center gap-1.5 text-xs text-[#8c674b]">
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-md bg-white border border-[#d4c4b5] flex items-center justify-center font-bold text-base hover:bg-[#f4ebe1] cursor-pointer"
                  aria-label="수량 감소"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.min(10, prev + 1))}
                  className="w-8 h-8 rounded-md bg-white border border-[#d4c4b5] flex items-center justify-center font-bold text-base hover:bg-[#f4ebe1] cursor-pointer"
                  aria-label="수량 증가"
                >
                  +
                </button>
                <span className="ml-1 text-sm font-medium">잔</span>
              </div>
            </div>
          </div>

          {/* 7. 요청사항 (textarea) */}
          <div>
            <label htmlFor={requestsId} className="block text-sm font-semibold text-[#6b4226] mb-1.5">
              7. 요청사항
            </label>
            <textarea
              id={requestsId}
              rows={3}
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
              placeholder="예: 얼음 적게 넣어주세요, 텀블러에 담아주세요."
              className="cafe-input resize-none"
            />
          </div>

          {/* ==========================================
              [예상 금액 표시 영역]
              - 주문하기 버튼 바로 위에 큰 글씨(24px), 갈색, 굵게, 가운데 정렬
             ========================================== */}
          <div className="pt-3 pb-1 border-t border-dashed border-[#ebdccc]">
            <p className="text-xs text-center text-[#8c674b] mb-1">
              음료 및 옵션 선택 시 실시간 반영
            </p>
            <div 
              aria-live="polite"
              className="text-center text-[24px] leading-tight font-bold text-[#6b4226] bg-[#f3e9dd] py-3.5 px-4 rounded-xl border border-[#e5d4c2] shadow-xs"
            >
              예상 금액: {estimatedPrice.toLocaleString()}원
            </div>
          </div>

          {/* 유효성 검사 에러 알림 */}
          {validationError && (
            <div 
              role="alert" 
              className="flex items-center gap-2 p-3 text-sm text-[#b91c1c] bg-[#fee2e2] border border-[#fca5a5] rounded-lg animate-in fade-in"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 버튼 영역: 8. 주문하기 버튼 & 9. 다시 작성 버튼 */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="cafe-btn-primary flex-1 py-3 px-4 rounded-lg font-bold text-base flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
            >
              <Coffee className="w-5 h-5" />
              {isSubmitting ? '주문 전송 중...' : '주문하기'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="py-3 px-4 rounded-lg font-medium text-sm text-[#6b4226] bg-white border border-[#d4c4b5] hover:bg-[#f4ebe1] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              다시 작성
            </button>
          </div>
        </form>

        {/* ==========================================
            [주문 확인 메시지]
            - 연두색 배경(#ecfdf5), 초록 글씨(#15803d), 둥근 모서리
           ========================================== */}
        {confirmationMessage && (
          <div 
            role="status"
            className="mt-6 p-4 bg-[#ecfdf5] border border-[#a7f3d0] text-[#15803d] rounded-xl shadow-xs animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#10b981]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#047857] mb-0.5">
                  주문 접수 완료
                </p>
                <p className="text-sm font-semibold leading-relaxed">
                  {confirmationMessage}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ==========================================
          [주문 접수 현황 (게시판 보드)]
         ========================================== */}
      <section 
        aria-labelledby="recent-orders-heading"
        className="w-full max-w-[520px] mt-6 bg-[#faf6f0] border border-[#ebdccc] rounded-2xl shadow-md p-6"
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ebdccc]">
          <h2 id="recent-orders-heading" className="text-base font-bold text-[#6b4226] flex items-center gap-2">
            <ReceiptText className="w-4 h-4" />
            실시간 주문 접수 현황 ({orders.length}건)
          </h2>
          <div className="flex items-center gap-2">
            {isSupabaseConnected && (
              <button
                type="button"
                onClick={loadOrdersFromSupabase}
                disabled={isLoadingOrders}
                title="새로고침"
                className="p-1.5 text-[#8c674b] hover:bg-[#ebdccc] rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
              </button>
            )}
            <span className="text-xs text-[#8c674b]">최신순</span>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#8c674b]">
            아직 접수된 주문이 없습니다. 첫 주문을 넣어보세요!
          </div>
        ) : (
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {orders.map((item) => {
              // 상태별 배지 색상
              const statusColors: Record<string, string> = {
                접수완료: 'bg-amber-100 text-amber-800 border-amber-300',
                제조중: 'bg-blue-100 text-blue-800 border-blue-300',
                준비완료: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                수령완료: 'bg-gray-100 text-gray-700 border-gray-300',
              };

              return (
                <article 
                  key={item.id}
                  className="p-3.5 bg-white rounded-xl border border-[#ebdccc] shadow-xs text-xs flex flex-col gap-1.5 hover:border-[#d4c4b5] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#6b4226]">
                        {item.customerName} 고객님
                      </span>
                      {item.isSupabase ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title="Supabase DB에 저장됨">
                          <CloudCheck className="w-3 h-3" /> DB
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="브라우저 로컬 저장">
                          <HardDrive className="w-3 h-3" /> 로컬
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      {/* 상태 변경 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item.id, item.orderStatus, item.isSupabase)}
                        title="클릭하여 상태 변경"
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${
                          statusColors[item.orderStatus] || 'bg-gray-100 text-gray-700 border-gray-300'
                        }`}
                      >
                        {item.orderStatus}
                      </button>

                      {/* 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(item.id, item.isSupabase)}
                        title="주문 삭제"
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-[#4a3525] font-medium flex items-center justify-between">
                    <span>{item.beverageName} [{item.sizeName}사이즈] × {item.quantity}잔</span>
                    <span className="text-[11px] text-[#8c674b]">{item.orderedAt}</span>
                  </div>

                  {item.customerPhone !== '미입력' && (
                    <div className="text-[#8c674b] text-[11px]">
                      연락처: {item.customerPhone}
                    </div>
                  )}

                  {item.selectedOptionsText !== '없음' && (
                    <div className="text-[#8c674b]">
                      옵션: {item.selectedOptionsText}
                    </div>
                  )}

                  {item.requests !== '없음' && (
                    <div className="text-gray-500 italic bg-[#faf6f0] p-1.5 rounded text-[11px]">
                      요청: "{item.requests}"
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[#f2e7db] mt-0.5">
                    <span className="text-gray-500">결제 금액</span>
                    <span className="font-bold text-sm text-[#6b4226]">
                      {item.totalPrice.toLocaleString()}원
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 하단 푸터 */}
      <footer className="w-full max-w-[520px] text-center text-xs text-[#8c674b] mt-8 pb-4">
        <p className="flex items-center justify-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#6b4226]" />
          바이브 카페 • 따뜻하고 여유로운 한 잔을 선사합니다
        </p>
      </footer>

      {/* Supabase 설정 모달 */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConnectedChange={(connected) => {
          setIsSupabaseConnected(connected);
          if (connected) {
            loadOrdersFromSupabase();
          }
        }}
      />
    </main>
  );
}
