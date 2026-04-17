import React, {useState} from 'react';
import { updateShuttleCongestion } from '../services/shuttleService';
import EditRequestModal from "../components/EditRequestModal";
import { useAuth } from '../hooks/useAuth';

interface Shuttle {
    id: string;
    name: string;
    company: string;
    time: string;
    type: 'work' | 'leave';
    congestion: string;
    congestionUpdatedAt?: any;
    enable: boolean;
}

interface StationDetailSheetProps {
    isOpen: boolean;
    stationId: string;
    stationName: string;
    shuttles: Shuttle[];
    onClose: () => void;
    onRefresh: () => void;
}

const StationDetailSheet: React.FC<StationDetailSheetProps> = ({
                                                                   isOpen, stationId, stationName, shuttles, onClose, onRefresh
                                                               }) => {
    if (!isOpen) return null;

    const { user } = useAuth();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [targetShuttle, setTargetShuttle] = useState<any>(null);

    const handleOpenEdit = (shuttle: any) => {
        setTargetShuttle(shuttle);
        setIsEditModalOpen(true);
    };

    // ✨ 혼잡도 즉시 업데이트 핸들러
    const handleUpdate = async (shuttleId: string, newStatus: string) => {
        try {
            await updateShuttleCongestion(stationId, shuttleId, newStatus);
            onRefresh(); // 성공 시 부모(MapPage)의 데이터를 다시 불러옴
        } catch (error) {
            alert("업데이트에 실패했습니다.");
        }
    };

    // ✨ 상대 시간 표시 유틸리티
    const getRelativeTime = (timestamp: any) => {
        if (!timestamp) return "정보 없음";
        const date = timestamp.toDate();
        const diff = (new Date().getTime() - date.getTime()) / 1000;

        if (diff < 60) return "방금 전";
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    return (
        <div style={sheetOverlayStyle}>
            <div style={sheetContentStyle}>
                <div onClick={onClose} style={handleStyle}></div>

                <div style={headerStyle}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>📍 {stationName}</h2>
                    <button onClick={onClose} style={closeButtonStyle}>✕</button>
                </div>

                <div style={listContainerStyle}>
                    {shuttles.map((shuttle) => {
                        const isEnabled = shuttle.enable !== false; // undefined이거나 true면 운행 중

                        return (
                            <div key={shuttle.id} style={{
                                ...shuttleItemStyle,
                                opacity: isEnabled ? 1 : 0.6, // 중단된 경우 흐리게
                                position: 'relative'
                            }}>
                            <div style={itemTopStyle}>
                                <span style={companyBadgeStyle}>{shuttle.company}</span>
                                <span style={typeBadgeStyle(shuttle.type)}>
                                    {shuttle.type === 'work' ? '출근' : '퇴근'}
                                </span>
                                <button
                                    onClick={() => handleOpenEdit(shuttle)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                >✏️</button>
                                <div style={rightAlignContainerStyle}>
                                    {shuttle.enable !== false && (
                                        <div style={badgeWrapperStyle}>
                                            <select
                                                value={shuttle.congestion}
                                                onChange={(e) => handleUpdate(shuttle.id, e.target.value)}
                                                style={congestionSelectStyle(shuttle.congestion)}
                                            >
                                                <option value="여유">여유</option>
                                                <option value="적당">적당</option>
                                                <option value="만차">만차</option>
                                            </select>
                                            <span style={dropdownIconStyle(shuttle.congestion)}>▼</span>
                                        </div>
                                    )}
                                    <span style={timeStyle}>
                                        {shuttle.enable === false ? '운행 중단' : shuttle.time}
                                    </span>
                                </div>
                            </div>

                            {!isEnabled && (
                                <div style={suspendedBadgeStyle}>현재 정보에 의해 운행이 중단된 노선입니다.</div>
                            )}

                            <div style={infoRowStyle}>
                                <span style={stationNameLabelStyle}>
                                    <span style={{ marginRight: '6px', fontSize: '0.9rem' }}>🏢</span>
                                    {shuttle.name}
                                </span>
                                    <span style={timestampStyle}>
                                    마지막 업데이트: {getRelativeTime(shuttle.congestionUpdatedAt)}
                                </span>
                            </div>

                            <EditRequestModal
                                isOpen={isEditModalOpen}
                                onClose={() => setIsEditModalOpen(false)}
                                stationId={stationId}
                                shuttle={targetShuttle}
                                user={user} // useAuth() 등에서 가져온 유저 정보
                            />
                        </div>
                    )})}
                </div>
            </div>
        </div>
    );
};

// ✨ 드롭다운 배지 래퍼 및 아이콘 스타일
const badgeWrapperStyle: React.CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center' };
const dropdownIconStyle = (status: string): React.CSSProperties => {
    // 상태에 따라 화살표 색상도 텍스트에 맞춤
    const color = status === '여유' ? '#065F46' : status === '적당' ? '#92400E' : '#B91C1C';
    return { position: 'absolute', right: '8px', fontSize: '0.6rem', color, pointerEvents: 'none' };
};

// ✨ 상태별 색상이 동적으로 적용되는 select 태그 스타일
const congestionSelectStyle = (status: string): React.CSSProperties => {
    let bgColor = '#E5E7EB';
    let textColor = '#374151';

    if (status === '여유') { bgColor = '#D1FAE5'; textColor = '#065F46'; }
    else if (status === '적당') { bgColor = '#FEF3C7'; textColor = '#92400E'; }
    else if (status === '만차') { bgColor = '#FEE2E2'; textColor = '#B91C1C'; }

    return {
        appearance: 'none',          // 브라우저 기본 화살표 숨김
        WebkitAppearance: 'none',    // iOS 사파리 대응
        backgroundColor: bgColor,
        color: textColor,
        padding: '4px 24px 4px 12px', // 화살표 공간을 위해 우측 패딩 확보
        borderRadius: '12px',
        border: 'none',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        outline: 'none',
    };
};

const itemTopStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' };
const rightAlignContainerStyle: React.CSSProperties = { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' };
const infoRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' };
const stationNameLabelStyle: React.CSSProperties = { fontSize: '0.9rem', color: '#4B5563' };
const timestampStyle: React.CSSProperties = { fontSize: '0.8rem', color: '#9CA3AF' };
const sheetOverlayStyle: React.CSSProperties = { position: 'fixed', bottom: 0, left: 0, width: '100%', height: 'auto', zIndex: 3000 };
const sheetContentStyle: React.CSSProperties = { backgroundColor: 'white', borderRadius: '20px 20px 0 0', padding: '15px 20px 30px', boxShadow: '0 -5px 20px rgba(0,0,0,0.1)', maxHeight: '60vh', overflowY: 'auto' };
const handleStyle: React.CSSProperties = { width: '40px', height: '5px', backgroundColor: '#E5E7EB', borderRadius: '10px', margin: '0 auto 15px', cursor: 'pointer' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const closeButtonStyle: React.CSSProperties = { background: 'none', border: 'none', fontSize: '1.5rem', color: '#9CA3AF', cursor: 'pointer' };
const listContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px' };
const shuttleItemStyle: React.CSSProperties = { padding: '15px', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' };
const companyBadgeStyle: React.CSSProperties = { fontWeight: 'bold', color: '#1F2937' };
const typeBadgeStyle = (type: string): React.CSSProperties => ({ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: type === 'work' ? '#DBEAFE' : '#FEF3C7', color: type === 'work' ? '#1E40AF' : '#92400E' });
const timeStyle: React.CSSProperties = { fontSize: '0.9rem', color: '#6B7280', marginLeft: 'auto' };
const suspendedBadgeStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#EF4444', marginTop: '5px', fontWeight: 'bold' };

export default StationDetailSheet;