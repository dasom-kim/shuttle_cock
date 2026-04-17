import React from 'react';

interface Shuttle {
    name: string;      // 기업별 정류장 이름
    company: string;   // 기업명
    time: string;      // 시간
    type: 'work' | 'leave';
    congestion: string;
}

interface StationDetailSheetProps {
    isOpen: boolean;
    stationName: string; // 대표 명칭 (보통 첫 번째 셔틀의 이름 사용)
    shuttles: Shuttle[];
    onClose: () => void;
}

const StationDetailSheet: React.FC<StationDetailSheetProps> = ({ isOpen, stationName, shuttles, onClose }) => {
    if (!isOpen) return null;

    return (
        <div style={sheetOverlayStyle}>
            <div style={sheetContentStyle}>
                {/* 상단 바 (드래그 핸들 느낌) */}
                <div onClick={onClose} style={handleStyle}></div>

                <div style={headerStyle}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>📍 {stationName || '정류장 정보'}</h2>
                    <button onClick={onClose} style={closeButtonStyle}>✕</button>
                </div>

                <div style={listContainerStyle}>
                    {shuttles.map((shuttle, index) => (
                        <div key={index} style={shuttleItemStyle}>
                            <div style={itemTopStyle}>
                                <span style={companyBadgeStyle}>{shuttle.company}</span>
                                <span style={typeBadgeStyle(shuttle.type)}>
                  {shuttle.type === 'work' ? '출근' : '퇴근'}
                </span>
                                <span style={timeStyle}>{shuttle.time}</span>
                            </div>
                            <div style={itemBottomStyle}>
                                <span style={stationNameStyle}>{shuttle.name}</span>
                                <span style={congestionStyle(shuttle.congestion)}>{shuttle.congestion}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- 스타일 정의 ---
const sheetOverlayStyle: React.CSSProperties = { position: 'fixed', bottom: 0, left: 0, width: '100%', height: 'auto', zIndex: 3000, display: 'flex', flexDirection: 'column' };
const sheetContentStyle: React.CSSProperties = { backgroundColor: 'white', borderRadius: '20px 20px 0 0', padding: '15px 20px 30px', boxShadow: '0 -5px 20px rgba(0,0,0,0.1)', maxHeight: '60vh', overflowY: 'auto' };
const handleStyle: React.CSSProperties = { width: '40px', height: '5px', backgroundColor: '#E5E7EB', borderRadius: '10px', margin: '0 auto 15px', cursor: 'pointer' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const closeButtonStyle: React.CSSProperties = { background: 'none', border: 'none', fontSize: '1.5rem', color: '#9CA3AF', cursor: 'pointer' };
const listContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px' };
const shuttleItemStyle: React.CSSProperties = { padding: '15px', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' };
const itemTopStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' };
const itemBottomStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const companyBadgeStyle: React.CSSProperties = { fontWeight: 'bold', color: '#1F2937' };
const typeBadgeStyle = (type: string): React.CSSProperties => ({ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: type === 'work' ? '#DBEAFE' : '#FEF3C7', color: type === 'work' ? '#1E40AF' : '#92400E' });
const timeStyle: React.CSSProperties = { fontSize: '0.9rem', color: '#6B7280', marginLeft: 'auto' };
const stationNameStyle: React.CSSProperties = { fontSize: '0.95rem', color: '#4B5563' };
const congestionStyle = (c: string): React.CSSProperties => ({ fontSize: '0.85rem', fontWeight: 'bold', color: c === '여유' ? '#10B981' : c === '적당' ? '#F59E0B' : '#EF4444' });

export default StationDetailSheet;