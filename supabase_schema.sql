-- ====================================================================
-- 바이브 카페 (Vibe Cafe) - Supabase 테이블 생성 및 테스트용 SQL
-- 대상 테이블: cafe_menu (주문 내역 저장 테이블)
-- ====================================================================

-- 1. cafe_menu 테이블 생성
-- 주문서 항목(고객명, 전화번호, 음료명, 사이즈, 추가옵션, 수량, 요청사항, 금액, 상태)을 반영합니다.
CREATE TABLE IF NOT EXISTS cafe_menu (
  -- 고유 주문 ID (UUID 자동 생성)
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 주문자 이름 (필수)
  customer_name VARCHAR(100) NOT NULL,
  
  -- 전화번호
  phone VARCHAR(30),
  
  -- 음료 이름 (필수: 아메리카노, 카페라떼, 카페모카, 바닐라라떼, 녹차라떼 등)
  drink_name VARCHAR(100) NOT NULL,
  
  -- 사이즈 (S, M, L)
  size VARCHAR(10) NOT NULL DEFAULT 'M',
  
  -- 추가 옵션 배열 (예: {'샷 추가', '크림 추가', '시럽 추가', '디카페인'})
  options TEXT[] DEFAULT '{}',
  
  -- 수량 (1~10)
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 10),
  
  -- 요청사항
  requests TEXT,
  
  -- 총 결제/주문 금액
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  
  -- 주문 상태 ('접수완료', '제조중', '준비완료', '수령완료')
  order_status VARCHAR(20) NOT NULL DEFAULT '접수완료',
  
  -- 주문 접수 일시 (한국 시간 기준 기본값)
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Seoul', NOW())
);

-- ====================================================================
-- 2. Row Level Security (RLS) 및 접근 정책 설정
-- 프론트엔드(Anon 키)에서 자유롭게 주문 등록 및 조회가 가능하도록 허용합니다.
-- ====================================================================
ALTER TABLE cafe_menu ENABLE ROW LEVEL SECURITY;

-- 누구나 주문 내역 조회 허용
CREATE POLICY "Allow public read access"
ON cafe_menu FOR SELECT
TO anon, authenticated
USING (true);

-- 누구나 신규 주문 등록 허용
CREATE POLICY "Allow public insert access"
ON cafe_menu FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- (선택) 주문 상태 변경 허용
CREATE POLICY "Allow public update access"
ON cafe_menu FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ====================================================================
-- 3. 실시간(Realtime) 기능 활성화
-- 주문이 들어오면 대시보드에서 새로고침 없이 즉시 반영되도록 설정합니다.
-- ====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE cafe_menu;

-- ====================================================================
-- 4. 테이블 및 컬럼 설명 (코멘트)
-- ====================================================================
COMMENT ON TABLE cafe_menu IS '바이브 카페 고객 주문 내역 테이블';
COMMENT ON COLUMN cafe_menu.customer_name IS '주문자 고객명';
COMMENT ON COLUMN cafe_menu.phone IS '연락처 (알림용)';
COMMENT ON COLUMN cafe_menu.drink_name IS '선택 음료명';
COMMENT ON COLUMN cafe_menu.size IS '음료 사이즈 (S, M, L)';
COMMENT ON COLUMN cafe_menu.options IS '선택된 추가 옵션 배열';
COMMENT ON COLUMN cafe_menu.quantity IS '주문 수량 (1~10)';
COMMENT ON COLUMN cafe_menu.requests IS '고객 요청사항';
COMMENT ON COLUMN cafe_menu.total_price IS '최종 결제 예상 금액';
COMMENT ON COLUMN cafe_menu.order_status IS '주문 처리 상태';
COMMENT ON COLUMN cafe_menu.created_at IS '주문 생성 시간';

-- ====================================================================
-- 5. 테스트용 가짜 데이터 1건 INSERT
-- ====================================================================
INSERT INTO cafe_menu (
  customer_name,
  phone,
  drink_name,
  size,
  options,
  quantity,
  requests,
  total_price,
  order_status
) VALUES (
  '홍길동',
  '010-1234-5678',
  '카페라떼',
  'M',
  ARRAY['샷 추가'],
  1,
  '얼음 적게 부탁드립니다.',
  5000,
  '접수완료'
);

-- ====================================================================
-- 6. 확인용 조회 쿼리
-- ====================================================================
SELECT * FROM cafe_menu ORDER BY created_at DESC;
