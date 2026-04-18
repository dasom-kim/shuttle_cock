import React, {useEffect, useRef, useState} from 'react';
import EditRequestModal from "../components/EditRequestModal";
import { useAuth } from '../hooks/useAuth';

interface Shuttle {
    id: string;
    stationId?: string;
    name: string;
    company: string;
    boardingTime?: string;
    alightingTime?: string;
    time?: string;
    type: 'work' | 'leave';
    congestion: string;
    congestionUpdatedAt?: any;
    enable: boolean;
}

interface StationDetailSheetProps {
    isOpen: boolean;
    stationId?: string;
    stationName: string;
    shuttles: Shuttle[];
    onClose: () => void;
    onAddShuttle: () => void;
}

const StationDetailSheet: React.FC<StationDetailSheetProps> = ({
                                                                   isOpen, stationId, stationName, shuttles, onClose, onAddShuttle
                                                               }) => {
    const { user } = useAuth();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [targetShuttle, setTargetShuttle] = useState<any>(null);
    const [companyFilter, setCompanyFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'work' | 'leave'>('all');
    const [congestionFilter, setCongestionFilter] = useState<'all' | '여유' | '적당' | '부족'>('all');
    const [draftCompanyFilter, setDraftCompanyFilter] = useState('all');
    const [draftTypeFilter, setDraftTypeFilter] = useState<'all' | 'work' | 'leave'>('all');
    const [draftCongestionFilter, setDraftCongestionFilter] = useState<'all' | '여유' | '적당' | '부족'>('all');
    const [sortMode, setSortMode] = useState<'time-asc' | 'time-desc' | 'updated-recent' | 'updated-old'>('time-asc');
    const [activePanel, setActivePanel] = useState<'none' | 'filter' | 'sort'>('none');
    const [sheetHeight, setSheetHeight] = useState<number | null>(null);
    const [isDraggingSheet, setIsDraggingSheet] = useState(false);
    const sheetRef = useRef<HTMLDivElement | null>(null);
    const dragStartYRef = useRef(0);
    const dragStartHeightRef = useRef(0);
    const dragCurrentHeightRef = useRef(0);

    const handleOpenEdit = (shuttle: any) => {
        setTargetShuttle(shuttle);
        setIsEditModalOpen(true);
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

    const getTimeValue = (value: string) => {
        const [h = '0', m = '0'] = value.split(':');
        return Number(h) * 60 + Number(m);
    };

    const getDisplayTime = (shuttle: Shuttle) => {
        if (shuttle.type === 'work') {
            return shuttle.boardingTime || shuttle.time || '';
        }
        return shuttle.alightingTime || shuttle.time || '';
    };

    const getUpdatedTimeValue = (timestamp: any) => {
        if (!timestamp?.toDate) return 0;
        return timestamp.toDate().getTime();
    };

    const companies = Array.from(new Set(shuttles.map((shuttle) => shuttle.company))).sort();

    const filteredShuttles = shuttles.filter((shuttle) => {
        const matchesCompany = companyFilter === 'all' || shuttle.company === companyFilter;
        const matchesType = typeFilter === 'all' || shuttle.type === typeFilter;
        const matchesCongestion = congestionFilter === 'all' || shuttle.congestion === congestionFilter;
        return matchesCompany && matchesType && matchesCongestion;
    });

    const sortedShuttles = [...filteredShuttles].sort((a, b) => {
        const timeDiff = getTimeValue(getDisplayTime(a)) - getTimeValue(getDisplayTime(b));
        const updatedDiff = getUpdatedTimeValue(a.congestionUpdatedAt) - getUpdatedTimeValue(b.congestionUpdatedAt);

        if (sortMode === 'time-asc') return timeDiff;
        if (sortMode === 'time-desc') return -timeDiff;
        if (sortMode === 'updated-recent') return updatedDiff !== 0 ? -updatedDiff : timeDiff;
        return updatedDiff !== 0 ? updatedDiff : timeDiff;
    });

    const appliedFilterCount =
        (companyFilter !== 'all' ? 1 : 0) +
        (typeFilter !== 'all' ? 1 : 0) +
        (congestionFilter !== 'all' ? 1 : 0);

    const openFilterPanel = () => {
        setDraftCompanyFilter(companyFilter);
        setDraftTypeFilter(typeFilter);
        setDraftCongestionFilter(congestionFilter);
        setActivePanel((prev) => (prev === 'filter' ? 'none' : 'filter'));
    };

    const handleSaveFilter = () => {
        setCompanyFilter(draftCompanyFilter);
        setTypeFilter(draftTypeFilter);
        setCongestionFilter(draftCongestionFilter);
        setActivePanel('none');
    };

    const sortTextMap = {
        'time-asc': '시간 빠른순',
        'time-desc': '시간 느린순',
        'updated-recent': '업데이트 빠른순',
        'updated-old': '업데이트 느린순'
    } as const;
    const sortText = sortTextMap[sortMode];

    useEffect(() => {
        if (!isOpen) {
            setSheetHeight(null);
            setIsDraggingSheet(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isDraggingSheet) return;

        const minHeight = 260;
        const maxHeight = window.innerHeight;

        const handlePointerMove = (event: PointerEvent) => {
            const deltaY = dragStartYRef.current - event.clientY;
            const nextHeight = Math.min(maxHeight, Math.max(minHeight, dragStartHeightRef.current + deltaY));
            dragCurrentHeightRef.current = nextHeight;
            setSheetHeight(nextHeight);
        };

        const stopDragging = () => {
            const threshold = window.innerHeight * 0.7;
            if (dragCurrentHeightRef.current >= threshold) {
                setSheetHeight(window.innerHeight);
            }
            setIsDraggingSheet(false);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopDragging);
        window.addEventListener('pointercancel', stopDragging);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopDragging);
            window.removeEventListener('pointercancel', stopDragging);
        };
    }, [isDraggingSheet]);

    const handleStartDragSheet = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!sheetRef.current) return;
        dragStartYRef.current = event.clientY;
        dragStartHeightRef.current = sheetRef.current.getBoundingClientRect().height;
        dragCurrentHeightRef.current = dragStartHeightRef.current;
        setIsDraggingSheet(true);
    };

    if (!isOpen) return null;

    return (
        <div style={sheetOverlayStyle}>
            <div
                ref={sheetRef}
                style={sheetContentStyle(sheetHeight)}
            >
                <div
                    onPointerDown={handleStartDragSheet}
                    style={handleStyle}
                ></div>

                <div style={headerStyle}>
                    <div style={headerTitleWrapStyle}>
                        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>📍 {stationName}</h2>
                        {user && (
                            <button onClick={onAddShuttle} style={addShuttleButtonStyle}>+ 셔틀 추가</button>
                        )}
                    </div>
                    <button onClick={onClose} style={closeButtonStyle}>✕</button>
                </div>

                <div style={toolbarContainerStyle}>
                    <div style={toolbarStyle}>
                        <button
                            onClick={openFilterPanel}
                            style={filterDropdownStyle(activePanel === 'filter')}
                        >
                            <span>필터</span>
                            {appliedFilterCount > 0 && <span style={filterCountBadgeStyle}>{appliedFilterCount}</span>}
                        </button>
                        <button
                            onClick={() => setActivePanel((prev) => (prev === 'sort' ? 'none' : 'sort'))}
                            style={sortDropdownStyle(activePanel === 'sort')}
                        >
                            <span>{sortText}</span>
                            <span style={dropdownArrowStyle(activePanel === 'sort')}>▾</span>
                        </button>
                    </div>

                    {activePanel === 'filter' && (
                    <div style={filterDropdownPanelStyle}>
                        <div style={controlItemStyle}>
                            <label style={controlLabelStyle}>회사</label>
                            <select
                                value={draftCompanyFilter}
                                onChange={(e) => setDraftCompanyFilter(e.target.value)}
                                style={controlSelectStyle}
                            >
                                <option value="all">전체</option>
                                {companies.map((company) => (
                                    <option key={company} value={company}>{company}</option>
                                ))}
                            </select>
                        </div>
                        <div style={controlItemStyle}>
                            <label style={controlLabelStyle}>운행 종류</label>
                            <select
                                value={draftTypeFilter}
                                onChange={(e) => setDraftTypeFilter(e.target.value as 'all' | 'work' | 'leave')}
                                style={controlSelectStyle}
                            >
                                <option value="all">전체</option>
                                <option value="work">출근</option>
                                <option value="leave">퇴근</option>
                            </select>
                        </div>
                        <div style={controlItemStyle}>
                            <label style={controlLabelStyle}>혼잡도</label>
                            <select
                                value={draftCongestionFilter}
                                onChange={(e) => setDraftCongestionFilter(e.target.value as 'all' | '여유' | '적당' | '부족')}
                                style={controlSelectStyle}
                            >
                                <option value="all">전체</option>
                                <option value="여유">여유</option>
                                <option value="적당">적당</option>
                                <option value="부족">부족</option>
                            </select>
                        </div>
                        <div style={panelActionStyle}>
                            <button
                                onClick={() => {
                                    setDraftCompanyFilter('all');
                                    setDraftTypeFilter('all');
                                    setDraftCongestionFilter('all');
                                }}
                                style={resetButtonStyle}
                            >
                                필터 초기화
                            </button>
                            <button onClick={handleSaveFilter} style={saveFilterButtonStyle}>
                                저장
                            </button>
                        </div>
                    </div>
                    )}

                    {activePanel === 'sort' && (
                    <div style={sortDropdownPanelStyle}>
                        <button
                            onClick={() => {
                                setSortMode('time-asc');
                                setActivePanel('none');
                            }}
                            style={sortChoiceStyle(sortMode === 'time-asc')}
                        >
                            시간 빠른순
                        </button>
                        <button
                            onClick={() => {
                                setSortMode('time-desc');
                                setActivePanel('none');
                            }}
                            style={sortChoiceStyle(sortMode === 'time-desc')}
                        >
                            시간 느린순
                        </button>
                        <button
                            onClick={() => {
                                setSortMode('updated-recent');
                                setActivePanel('none');
                            }}
                            style={sortChoiceStyle(sortMode === 'updated-recent')}
                        >
                            업데이트 빠른순
                        </button>
                        <button
                            onClick={() => {
                                setSortMode('updated-old');
                                setActivePanel('none');
                            }}
                            style={sortChoiceStyle(sortMode === 'updated-old')}
                        >
                            업데이트 느린순
                        </button>
                    </div>
                    )}
                </div>

                <div style={listContainerStyle}>
                    {sortedShuttles.map((shuttle) => {
                        const isEnabled = shuttle.enable !== false; // undefined이거나 true면 운행 중

                        return (
                            <div key={shuttle.id} style={{
                                ...shuttleItemStyle,
                                opacity: isEnabled ? 1 : 0.6, // 중단된 경우 흐리게
                                position: 'relative'
                            }}>
                            <div style={itemTopStyle}>
                                <span style={shuttleTitleStyle}>{shuttle.name}</span>
                                <span style={typeBadgeStyle(shuttle.type)}>
                                    {shuttle.type === 'work' ? '출근' : '퇴근'}
                                </span>
                                <button
                                    onClick={() => handleOpenEdit(shuttle)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                >✏️</button>
                                <div style={rightAlignContainerStyle}>
                                    {shuttle.enable !== false && (
                                        <span style={congestionBadgeStyle(shuttle.congestion)}>
                                            혼잡도 {shuttle.congestion}
                                        </span>
                                    )}
                                    <span style={timeStyle}>
                                        {shuttle.enable === false ? '운행 중단' : `${shuttle.type === 'work' ? '승차' : '하차'} ${getDisplayTime(shuttle)}`}
                                    </span>
                                </div>
                            </div>

                            {!isEnabled && (
                                <div style={suspendedBadgeStyle}>현재 정보에 의해 운행이 중단된 노선입니다.</div>
                            )}

                            <div style={infoRowStyle}>
                                <span style={stationNameLabelStyle}>
                                    <span style={{ marginRight: '6px', fontSize: '0.9rem' }}>🏢</span>
                                    {shuttle.company}
                                </span>
                                    <span style={timestampStyle}>
                                    마지막 업데이트: {getRelativeTime(shuttle.congestionUpdatedAt)}
                                </span>
                            </div>

                            <EditRequestModal
                                isOpen={isEditModalOpen}
                                onClose={() => setIsEditModalOpen(false)}
                                stationId={targetShuttle?.stationId || stationId}
                                shuttle={targetShuttle}
                                user={user} // useAuth() 등에서 가져온 유저 정보
                            />
                        </div>
                    )})}
                    {sortedShuttles.length === 0 && (
                        <div style={emptyStateStyle}>현재 조건에 맞는 셔틀 정보가 없습니다.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

const congestionBadgeStyle = (status: string): React.CSSProperties => {
    let bgColor = '#E5E7EB';
    let textColor = '#374151';

    if (status === '여유') { bgColor = '#D1FAE5'; textColor = '#065F46'; }
    else if (status === '적당') { bgColor = '#FEF3C7'; textColor = '#92400E'; }
    else if (status === '부족') { bgColor = '#FEE2E2'; textColor = '#B91C1C'; }

    return {
        backgroundColor: bgColor,
        color: textColor,
        padding: '4px 10px',
        borderRadius: '12px',
        border: 'none',
        fontSize: '0.85rem',
        fontWeight: 'bold',
    };
};

const itemTopStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' };
const rightAlignContainerStyle: React.CSSProperties = { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' };
const infoRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' };
const stationNameLabelStyle: React.CSSProperties = { fontSize: '0.9rem', color: '#4B5563' };
const timestampStyle: React.CSSProperties = { fontSize: '0.8rem', color: '#9CA3AF' };
const sheetOverlayStyle: React.CSSProperties = { position: 'fixed', bottom: 0, left: 0, width: '100%', height: 'auto', zIndex: 3000 };
const sheetContentStyle = (height: number | null): React.CSSProperties => ({
    backgroundColor: 'white',
    borderRadius: '20px 20px 0 0',
    padding: '15px 20px 30px',
    boxShadow: '0 -5px 20px rgba(0,0,0,0.1)',
    height: height ? `${height}px` : 'auto',
    maxHeight: '100vh',
    overflowY: 'auto',
    transition: height ? 'none' : 'height 0.2s ease'
});
const handleStyle: React.CSSProperties = {
    width: '48px',
    height: '6px',
    backgroundColor: '#E5E7EB',
    borderRadius: '10px',
    margin: '0 auto 15px',
    cursor: 'ns-resize',
    touchAction: 'none'
};
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const headerTitleWrapStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 };
const toolbarContainerStyle: React.CSSProperties = { position: 'relative', marginBottom: '10px' };
const toolbarStyle: React.CSSProperties = { display: 'flex', gap: '8px' };
const filterDropdownStyle = (active: boolean): React.CSSProperties => ({
    border: '1px solid #D1D5DB',
    borderRadius: '10px',
    backgroundColor: active ? '#EEF2FF' : '#FFFFFF',
    color: active ? '#4338CA' : '#374151',
    padding: '9px 12px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '40px'
});
const filterCountBadgeStyle: React.CSSProperties = {
    width: '18px',
    height: '18px',
    borderRadius: '999px',
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    fontSize: '0.72rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
};
const dropdownArrowStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    width: '12px',
    justifyContent: 'center',
    fontSize: '0.78rem',
    color: '#6B7280',
    lineHeight: 1,
    transform: active ? 'rotate(180deg)' : 'rotate(0deg)',
    transformOrigin: '50% 50%',
    transition: 'transform 0.18s ease'
});
const sortDropdownStyle = (active: boolean): React.CSSProperties => ({
    border: 'none',
    borderRadius: '10px',
    backgroundColor: active ? '#EEF2FF' : 'transparent',
    color: active ? '#4338CA' : '#374151',
    padding: '9px 12px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '40px',
    marginLeft: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
});
const filterDropdownPanelStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    position: 'absolute',
    top: '46px',
    left: 0,
    width: 'min(100%, 420px)',
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
    zIndex: 20
};
const controlItemStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '5px' };
const controlLabelStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#6B7280', fontWeight: 700 };
const controlSelectStyle: React.CSSProperties = {
    appearance: 'none',
    WebkitAppearance: 'none',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    color: '#111827',
    padding: '8px 10px',
    fontSize: '0.84rem',
    outline: 'none'
};
const panelActionStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: '8px' };
const resetButtonStyle: React.CSSProperties = {
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    color: '#4B5563',
    padding: '8px 10px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer'
};
const saveFilterButtonStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    padding: '8px 12px',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer'
};
const sortDropdownPanelStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
    position: 'absolute',
    top: '46px',
    right: 0,
    width: 'min(100%, 320px)',
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
    zIndex: 20
};
const sortChoiceStyle = (active: boolean): React.CSSProperties => ({
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    backgroundColor: active ? '#EEF2FF' : '#FFFFFF',
    color: active ? '#4338CA' : '#4B5563',
    padding: '8px 12px',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer'
});
const addShuttleButtonStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: '999px',
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    padding: '6px 10px',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0
};
const closeButtonStyle: React.CSSProperties = { background: 'none', border: 'none', fontSize: '1.5rem', color: '#9CA3AF', cursor: 'pointer' };
const listContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px' };
const shuttleItemStyle: React.CSSProperties = { padding: '15px', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' };
const shuttleTitleStyle: React.CSSProperties = { fontWeight: 'bold', color: '#1F2937' };
const typeBadgeStyle = (type: string): React.CSSProperties => ({ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: type === 'work' ? '#DBEAFE' : '#FEF3C7', color: type === 'work' ? '#1E40AF' : '#92400E' });
const timeStyle: React.CSSProperties = { fontSize: '0.9rem', color: '#6B7280', marginLeft: 'auto' };
const suspendedBadgeStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#EF4444', marginTop: '5px', fontWeight: 'bold' };
const emptyStateStyle: React.CSSProperties = { textAlign: 'center', color: '#9CA3AF', fontSize: '0.9rem', padding: '16px 0' };

export default StationDetailSheet;
