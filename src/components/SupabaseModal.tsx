import React, { useState, useEffect } from 'react';
import { 
  Database, 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Trash2,
  KeyRound,
  Globe
} from 'lucide-react';
import { 
  getSupabaseCredentials, 
  saveSupabaseCredentials, 
  clearSupabaseCredentials, 
  testSupabaseConnection 
} from '../lib/supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectedChange?: (connected: boolean) => void;
}

const SCHEMA_SQL = `-- 1. cafe_menu 테이블 생성
CREATE TABLE IF NOT EXISTS cafe_menu (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  drink_name VARCHAR(100) NOT NULL,
  size VARCHAR(10) NOT NULL DEFAULT 'M',
  options TEXT[] DEFAULT '{}',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 10),
  requests TEXT,
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  order_status VARCHAR(20) NOT NULL DEFAULT '접수완료',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Seoul', NOW())
);

-- 2. RLS 활성화 및 권한 설정
ALTER TABLE cafe_menu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
ON cafe_menu FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert access"
ON cafe_menu FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update access"
ON cafe_menu FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. 실시간 변경사항 알림 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE cafe_menu;`;

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose, onConnectedChange }) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'sql'>('config');

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setUrl(creds.url);
      setAnonKey(creds.anonKey);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const trimmedUrl = url.trim();
    const trimmedKey = anonKey.trim();

    if (!trimmedUrl || !trimmedKey) {
      setTestResult({ success: false, message: 'URL과 Anon Key를 모두 입력해주세요.' });
      setTesting(false);
      return;
    }

    const res = await testSupabaseConnection(trimmedUrl, trimmedKey);
    setTestResult(res);
    setTesting(false);

    if (res.success) {
      saveSupabaseCredentials(trimmedUrl, trimmedKey);
      if (onConnectedChange) onConnectedChange(true);
    }
  };

  const handleClear = () => {
    if (confirm('저장된 Supabase 연결 정보를 초기화하시겠습니까?')) {
      clearSupabaseCredentials();
      setUrl('');
      setAnonKey('');
      setTestResult(null);
      if (onConnectedChange) onConnectedChange(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-[540px] bg-[#faf6f0] border border-[#ebdccc] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebdccc] bg-[#f4ebe1]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#6b4226] text-white">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#6b4226]">Supabase 데이터베이스 연동</h2>
              <p className="text-xs text-[#8c674b]">바이브 카페 주문 데이터를 클라우드에 영구 저장</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c674b] hover:bg-[#ebdccc] transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-[#ebdccc] bg-[#faf6f0]">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer border-b-2 ${
              activeTab === 'config'
                ? 'border-[#6b4226] text-[#6b4226] bg-[#f4ebe1]/50'
                : 'border-transparent text-[#8c674b] hover:text-[#6b4226]'
            }`}
          >
            1. API 키 설정
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer border-b-2 ${
              activeTab === 'sql'
                ? 'border-[#6b4226] text-[#6b4226] bg-[#f4ebe1]/50'
                : 'border-transparent text-[#8c674b] hover:text-[#6b4226]'
            }`}
          >
            2. 테이블 생성 SQL 복사
          </button>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="p-6 overflow-y-auto space-y-5 text-[#3e2723]">
          {activeTab === 'config' && (
            <form onSubmit={handleTestAndSave} className="space-y-4">
              <div className="p-3 bg-[#f5efe6] rounded-xl border border-[#ebdccc] text-xs text-[#6b4226] leading-relaxed">
                💡 <strong>연결 정보 확인 방법:</strong><br />
                1. <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-semibold inline-flex items-center gap-0.5 text-[#3e2723] hover:text-black">
                  Supabase 대시보드 <ExternalLink className="w-3 h-3" />
                </a> 접속<br />
                2. 프로젝트 선택 ➔ <strong>Project Settings</strong> (톱니바퀴) ➔ <strong>API</strong> 메뉴<br />
                3. <strong>Project URL</strong>과 <strong>Project API Keys (anon public)</strong>를 복사하여 아래에 입력하세요.
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b4226] mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Project URL
                </label>
                <input
                  type="url"
                  placeholder="https://your-project.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#d4c4b5] rounded-lg focus:outline-hidden focus:border-[#6b4226] focus:ring-1 focus:ring-[#6b4226]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b4226] mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Anon Public API Key
                </label>
                <input
                  type="text"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#d4c4b5] rounded-lg font-mono text-xs focus:outline-hidden focus:border-[#6b4226] focus:ring-1 focus:ring-[#6b4226]"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#15803d]'
                      : 'bg-[#fee2e2] border-[#fca5a5] text-[#b91c1c]'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-snug">
                    <p className="font-bold">{testResult.success ? '연결 성공' : '연결 실패'}</p>
                    <p className="mt-0.5">{testResult.message}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={testing}
                  className="flex-1 py-2.5 px-4 bg-[#6b4226] hover:bg-[#53331d] text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      연결 테스트 중...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      연결 테스트 & 저장
                    </>
                  )}
                </button>

                {(url || anonKey) && (
                  <button
                    type="button"
                    onClick={handleClear}
                    title="설정 초기화"
                    className="p-2.5 bg-white border border-[#d4c4b5] text-[#b91c1c] hover:bg-[#fee2e2] rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="text-[11px] text-[#8c674b] text-center">
                ※ 프로젝트 루트의 <code>.env</code> 파일에 <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>로 설정하셔도 동일하게 작동합니다.
              </div>
            </form>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#f5efe6] rounded-xl border border-[#ebdccc] text-xs text-[#6b4226] leading-relaxed">
                Supabase에 아직 <code>cafe_menu</code> 테이블을 만들지 않으셨다면, 아래 SQL을 복사하여 Supabase의 <strong>SQL Editor</strong>에서 [Run] 버튼을 눌러 실행해주세요.
              </div>

              <div className="relative">
                <pre className="p-3.5 bg-[#2c1d11] text-[#ebdccc] rounded-xl text-[11px] leading-relaxed overflow-x-auto max-h-[220px] font-mono select-all">
                  {SCHEMA_SQL}
                </pre>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="absolute top-2.5 right-2.5 px-2.5 py-1.5 bg-[#faf6f0] text-[#6b4226] hover:bg-white text-xs font-bold rounded-md shadow-xs border border-[#ebdccc] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      복사 완료!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      SQL 전체 복사
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-[#8c674b]">
                ✓ 프로젝트 폴더에 <code>supabase_schema.sql</code> 파일로도 저장되어 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3.5 bg-[#f4ebe1] border-t border-[#ebdccc] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#d4c4b5] hover:bg-[#faf6f0] text-xs font-bold text-[#6b4226] rounded-lg transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
