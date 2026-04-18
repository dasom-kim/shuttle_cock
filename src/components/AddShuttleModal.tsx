import React, { useEffect, useRef, useState } from 'react';
import { useFeedback } from './feedback/FeedbackProvider';
import { geocodeAddressNcloud, type GeocodeAddressResult } from '../services/geocodeService';

interface AddShuttleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    lat: number;
    lng: number;
    stationName: string;
    stationNameOptions?: Array<{
        name: string;
        source: 'nearby' | 'api' | 'fallback';
    }>;
}

const AddShuttleModal: React.FC<AddShuttleModalProps> = ({
    isOpen,
    onClose,
    onSave,
    lat,
    lng,
    stationName,
    stationNameOptions = []
}) => {
    const { showToast } = useFeedback();
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    const [shuttleName, setShuttleName] = useState('');
    const [company, setCompany] = useState('');
    const [type, setType] = useState<'work' | 'leave'>('work');
    const [boardingTime, setBoardingTime] = useState('08:30');
    const [alightingTime, setAlightingTime] = useState('09:00');
    const [congestion, setCongestion] = useState('보통');
    const [destinationQuery, setDestinationQuery] = useState('');
    const [destinationOptions, setDestinationOptions] = useState<GeocodeAddressResult[]>([]);
    const [selectedDestination, setSelectedDestination] = useState<GeocodeAddressResult | null>(null);
    const [isDestinationDropdownOpen, setIsDestinationDropdownOpen] = useState(false);
    const [isDestinationLoading, setIsDestinationLoading] = useState(false);
    const [selectedStationName, setSelectedStationName] = useState(stationName);
    const [isStationDropdownOpen, setIsStationDropdownOpen] = useState(false);
    const [isCongestionDropdownOpen, setIsCongestionDropdownOpen] = useState(false);
    const stationDropdownRef = useRef<HTMLDivElement | null>(null);
    const congestionDropdownRef = useRef<HTMLDivElement | null>(null);
    const destinationDropdownRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        setShuttleName('');
        setCompany('');
        setType('work');
        setBoardingTime('08:30');
        setAlightingTime('09:00');
        setCongestion('보통');
        setDestinationQuery('');
        setDestinationOptions([]);
        setSelectedDestination(null);
        setIsDestinationDropdownOpen(false);
        setIsDestinationLoading(false);
        setSelectedStationName(stationName);
        setIsStationDropdownOpen(false);
        setIsCongestionDropdownOpen(false);
    }, [isOpen]);

    useEffect(() => {
        setSelectedStationName(stationName);
    }, [stationName]);

    useEffect(() => {
        if (!isStationDropdownOpen && !isCongestionDropdownOpen && !isDestinationDropdownOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const targetNode = event.target as Node;
            const clickedInsideStation = stationDropdownRef.current?.contains(targetNode);
            const clickedInsideCongestion = congestionDropdownRef.current?.contains(targetNode);
            const clickedInsideDestination = destinationDropdownRef.current?.contains(targetNode);
            if (!clickedInsideStation) {
                setIsStationDropdownOpen(false);
            }
            if (!clickedInsideCongestion) {
                setIsCongestionDropdownOpen(false);
            }
            if (!clickedInsideDestination) {
                setIsDestinationDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isStationDropdownOpen, isCongestionDropdownOpen, isDestinationDropdownOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!shuttleName.trim()) {
            showToast('셔틀 이름을 입력해 주세요', 'info');
            return;
        }
        if (!company.trim()) {
            showToast('어떤 회사의 셔틀인지 회사 이름도 함께 입력해 주세요', 'info');
            return;
        }
        if (!selectedDestination) {
            showToast(type === 'work' ? '도착지를 검색해서 선택해 주세요' : '출발지를 검색해서 선택해 주세요', 'info');
            return;
        }
        // type, boardingTime, alightingTime, congestion은 기본값이 설정되어 있으므로 별도 검사 불필요

        onSave({
            shuttleName,
            company,
            type,
            boardingTime,
            alightingTime,
            congestion,
            stationName: selectedStationName,
            destinationAddress: selectedDestination.roadAddress || selectedDestination.jibunAddress,
            destinationX: selectedDestination.x,
            destinationY: selectedDestination.y,
            lat,
            lng
        });
    };

    const handleSearchDestination = async () => {
        const keyword = destinationQuery.trim();
        if (!keyword) {
            showToast('도착지 키워드를 입력해 주세요', 'info');
            return;
        }

        try {
            setIsDestinationLoading(true);
            const results = await geocodeAddressNcloud(keyword);
            setDestinationOptions(results);
            setIsDestinationDropdownOpen(true);
            if (!results.length) {
                showToast('검색 결과가 없어요. 다른 키워드로 시도해 주세요.', 'info');
            }
        } catch (error) {
            console.error('도착지 검색 실패:', error);
            showToast('도착지 검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', 'error');
        } finally {
            setIsDestinationLoading(false);
        }
    };

    return (
        <div style={modalOverlayStyle(isMobile)}>
            <div style={modalContentStyle(isMobile)}>
                <h3 style={{ color: '#8B5CF6', marginBottom: '20px' }}>🚌 셔틀 정보 등록</h3>

                <div style={inputGroupStyle}>
                    <label>정류장 이름</label>
                    {stationNameOptions.length > 1 ? (
                        <div ref={stationDropdownRef} style={stationDropdownWrapStyle}>
                            <button
                                type="button"
                                onClick={() => setIsStationDropdownOpen((prev) => !prev)}
                                style={stationDropdownButtonStyle}
                            >
                                <span style={stationDropdownValueStyle}>{selectedStationName}</span>
                                <span style={stationDropdownRightStyle}>
                                    {stationNameOptions.some((opt) => opt.name === selectedStationName && opt.source === 'nearby') && (
                                        <span style={recommendedBadgeStyle}>추천</span>
                                    )}
                                    <span style={stationDropdownArrowStyle(isStationDropdownOpen)}>▾</span>
                                </span>
                            </button>

                            {isStationDropdownOpen && (
                                <div style={stationDropdownMenuStyle}>
                                    {stationNameOptions.map((option) => (
                                        <button
                                            key={`${option.source}-${option.name}`}
                                            type="button"
                                            onClick={() => {
                                                setSelectedStationName(option.name);
                                                setIsStationDropdownOpen(false);
                                            }}
                                            style={stationDropdownOptionStyle(option.name === selectedStationName)}
                                        >
                                            <span style={stationDropdownOptionTextStyle}>{option.name}</span>
                                            {option.source === 'nearby' && <span style={recommendedBadgeStyle}>추천</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={selectedStationName}
                            disabled
                            style={{ ...inputStyle, flex: 1, backgroundColor: '#F9FAFB', color: '#6B7280' }}
                        />
                    )}
                </div>

                <div style={inputGroupStyle}>
                    <label>셔틀 이름</label>
                    <input
                        type="text"
                        placeholder="예: 강남A, 강남역"
                        value={shuttleName}
                        onChange={(e) => setShuttleName(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <div style={inputGroupStyle}>
                    <label>회사 이름</label>
                    <input
                        type="text"
                        placeholder="예: 삼성전자, 네이버"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        style={inputStyle}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label>{type === 'work' ? '도착지 검색' : '출발지 검색'}</label>
                    <div style={destinationSearchRowStyle}>
                        <input
                            type="text"
                            placeholder={type === 'work' ? '예: 네이버 1784' : '예: 판교역 1번 출구'}
                            value={destinationQuery}
                            onChange={(e) => setDestinationQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleSearchDestination();
                                }
                            }}
                            style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                            type="button"
                            onClick={() => void handleSearchDestination()}
                            style={destinationSearchButtonStyle}
                            disabled={isDestinationLoading}
                        >
                            {isDestinationLoading ? '검색 중...' : '검색'}
                        </button>
                    </div>

                    <div ref={destinationDropdownRef} style={stationDropdownWrapStyle}>
                        <button
                            type="button"
                            onClick={() => {
                                if (!destinationOptions.length) return;
                                setIsDestinationDropdownOpen((prev) => !prev);
                            }}
                            style={{
                                ...stationDropdownButtonStyle,
                                cursor: destinationOptions.length ? 'pointer' : 'default',
                                color: selectedDestination ? '#111827' : '#6B7280'
                            }}
                        >
                            <span style={stationDropdownValueStyle}>
                                {selectedDestination
                                    ? (selectedDestination.roadAddress || selectedDestination.jibunAddress)
                                    : (type === 'work'
                                        ? '도로명 검색 후 도착지를 선택해 주세요'
                                        : '도로명 검색 후 출발지를 선택해 주세요')}
                            </span>
                            {destinationOptions.length > 0 && (
                                <span style={stationDropdownArrowStyle(isDestinationDropdownOpen)}>▾</span>
                            )}
                        </button>

                        {isDestinationDropdownOpen && destinationOptions.length > 0 && (
                            <div style={{ ...stationDropdownMenuStyle, maxHeight: '240px', overflowY: 'auto' }}>
                                {destinationOptions.map((option) => {
                                    const label = option.roadAddress || option.jibunAddress;
                                    const detail = option.roadAddress && option.jibunAddress && option.roadAddress !== option.jibunAddress
                                        ? option.jibunAddress
                                        : '';

                                    return (
                                        <button
                                            key={`${option.x}-${option.y}-${label}`}
                                            type="button"
                                            onClick={() => {
                                                setSelectedDestination(option);
                                                setIsDestinationDropdownOpen(false);
                                            }}
                                            style={stationDropdownOptionStyle(
                                                selectedDestination?.x === option.x &&
                                                selectedDestination?.y === option.y
                                            )}
                                        >
                                            <span style={{ ...stationDropdownOptionTextStyle, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ fontWeight: 600 }}>{label}</span>
                                                {detail && <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>{detail}</span>}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div style={inputGroupStyle}>
                    <label>운행 종류</label>
                    <div style={buttonGroupStyle}>
                        <button
                            onClick={() => setType('work')}
                            style={type === 'work' ? activeButtonStyle : inactiveButtonStyle}
                        >출근</button>
                        <button
                            onClick={() => setType('leave')}
                            style={type === 'leave' ? activeButtonStyle : inactiveButtonStyle}
                        >퇴근</button>
                    </div>
                </div>

                <div style={inputGroupStyle}>
                    <div style={timeGridStyle}>
                        <div style={timeCellStyle}>
                            <label style={timeLabelStyle}>
                                {type === 'work' ? '정류장 승차 시간' : '회사 승차 시간'}
                            </label>
                            <input
                                type="time"
                                value={boardingTime}
                                onChange={(e) => setBoardingTime(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div style={timeCellStyle}>
                            <label style={timeLabelStyle}>
                                {type === 'work' ? '회사 하차 시간' : '정류장 하차 시간'}
                            </label>
                            <input
                                type="time"
                                value={alightingTime}
                                onChange={(e) => setAlightingTime(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                    </div>
                </div>

                <div style={inputGroupStyle}>
                    <label>평균 혼잡도</label>
                    <div ref={congestionDropdownRef} style={stationDropdownWrapStyle}>
                        <button
                            type="button"
                            onClick={() => setIsCongestionDropdownOpen((prev) => !prev)}
                            style={stationDropdownButtonStyle}
                        >
                            <span style={stationDropdownValueStyle}>{congestion}</span>
                            <span style={stationDropdownArrowStyle(isCongestionDropdownOpen)}>▾</span>
                        </button>

                        {isCongestionDropdownOpen && (
                            <div style={{ ...stationDropdownMenuStyle, top: 'auto', bottom: 'calc(100% + 6px)' }}>
                                {['여유', '보통', '부족'].map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => {
                                            setCongestion(option);
                                            setIsCongestionDropdownOpen(false);
                                        }}
                                        style={stationDropdownOptionStyle(option === congestion)}
                                    >
                                        <span style={stationDropdownOptionTextStyle}>{option}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button onClick={onClose} style={cancelButtonStyle}>취소</button>
                    <button
                        onClick={handleSave}
                        style={saveButtonStyle}
                    >정보 저장하기</button>
                </div>
            </div>
        </div>
    );
};

// --- 스타일 정의 (생략 가능하나 가이드용으로 포함) ---
const modalOverlayStyle = (isMobile: boolean): React.CSSProperties => ({
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: isMobile ? 'flex-end' : 'center',
    alignItems: isMobile ? 'stretch' : 'center',
    padding: isMobile ? '0' : '16px',
    boxSizing: 'border-box',
    zIndex: 5000
});
const modalContentStyle = (isMobile: boolean): React.CSSProperties => ({
    backgroundColor: 'white',
    padding: isMobile ? '20px 16px' : '20px',
    borderRadius: isMobile ? '0' : '16px',
    width: isMobile ? '100%' : 'min(420px, 100%)',
    height: isMobile ? '100%' : 'auto',
    minHeight: isMobile ? '100%' : 'min(620px, calc(100vh - 32px))',
    maxHeight: isMobile ? '100vh' : 'calc(100vh - 16px)',
    overflowY: 'auto',
    boxSizing: 'border-box'
});
const inputGroupStyle: React.CSSProperties = { marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' };
const inputStyle: React.CSSProperties = { padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB' };
const destinationSearchRowStyle: React.CSSProperties = { display: 'flex', gap: '8px' };
const destinationSearchButtonStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    padding: '0 12px',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
};
const stationDropdownWrapStyle: React.CSSProperties = { position: 'relative' };
const stationDropdownButtonStyle: React.CSSProperties = {
    ...inputStyle,
    width: '100%',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    textAlign: 'left',
    gap: '10px'
};
const stationDropdownValueStyle: React.CSSProperties = {
    color: '#111827',
    fontSize: '0.95rem',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
};
const stationDropdownRightStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0 };
const stationDropdownArrowStyle = (open: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    width: '14px',
    justifyContent: 'center',
    color: '#6B7280',
    transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.18s ease',
    marginRight: '2px'
});
const stationDropdownMenuStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    width: '100%',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
    zIndex: 30,
    overflow: 'hidden'
};
const stationDropdownOptionStyle = (selected: boolean): React.CSSProperties => ({
    width: '100%',
    border: 'none',
    backgroundColor: selected ? '#EEF2FF' : '#FFFFFF',
    color: selected ? '#4338CA' : '#111827',
    padding: '10px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    textAlign: 'left'
});
const stationDropdownOptionTextStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
};
const recommendedBadgeStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: '999px',
    backgroundColor: '#EEF2FF',
    color: '#8B5CF6',
    padding: '4px 8px',
    fontSize: '0.72rem',
    fontWeight: 700,
    lineHeight: 1
};
const buttonGroupStyle: React.CSSProperties = { display: 'flex', gap: '10px' };
const timeGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' };
const timeCellStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '5px' };
const timeLabelStyle: React.CSSProperties = { fontSize: '1rem', color: '#111827', fontWeight: 500 };
const activeButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', backgroundColor: '#8B5CF6', color: 'white', borderRadius: '8px', border: 'none' };
const inactiveButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', backgroundColor: '#F3F4F6', color: '#4B5563', borderRadius: '8px', border: 'none' };
const saveButtonStyle: React.CSSProperties = { flex: 2, padding: '12px', backgroundColor: '#8B5CF6', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold' };
const cancelButtonStyle: React.CSSProperties = { flex: 1, padding: '12px', backgroundColor: '#F3F4F6', color: '#4B5563', borderRadius: '8px', border: 'none' };

export default AddShuttleModal;
