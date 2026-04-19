import React, { useState, useEffect, useRef } from 'react';
import { applyShuttleUpdate, isUserEditRestricted } from '../services/shuttleService';
import { useFeedback } from './feedback/FeedbackProvider';

interface EditRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplied?: () => void | Promise<void>;
    stationId?: string;
    currentUserNickname?: string;
    shuttle: any; // 현재 선택된 셔틀 정보
    user: any;
}

const EditRequestModal: React.FC<EditRequestModalProps> = ({ isOpen, onClose, onApplied, stationId, currentUserNickname, shuttle, user }) => {
    const { showToast } = useFeedback();
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    const [boardingTime, setBoardingTime] = useState('');
    const [alightingTime, setAlightingTime] = useState('');
    const [congestion, setCongestion] = useState('보통');
    const [isDelete, setIsDelete] = useState(false);
    const [isCongestionDropdownOpen, setIsCongestionDropdownOpen] = useState(false);
    const congestionDropdownRef = useRef<HTMLDivElement | null>(null);

    // 모달이 열릴 때 현재 값을 초기값으로 세팅
    useEffect(() => {
        if (isOpen && shuttle) {
            setBoardingTime(shuttle.boardingTime || shuttle.time || '');
            setAlightingTime(shuttle.alightingTime || shuttle.time || '');
            setCongestion(shuttle.congestion || '보통');
            setIsDelete(shuttle.enable === false);
            return;
        }

        // 모달이 닫히면 입력 상태 초기화
        if (!isOpen) {
            setBoardingTime('');
            setAlightingTime('');
            setCongestion('보통');
            setIsDelete(false);
            setIsCongestionDropdownOpen(false);
        }
    }, [shuttle, isOpen]);

    useEffect(() => {
        if (!isCongestionDropdownOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const targetNode = event.target as Node;
            if (!congestionDropdownRef.current?.contains(targetNode)) {
                setIsCongestionDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isCongestionDropdownOpen]);

    if (!isOpen || !shuttle) return null;

    const boardingTimeLabel = shuttle.type === 'leave' ? '회사 승차 시간' : '정류장 승차 시간';
    const alightingTimeLabel = shuttle.type === 'leave' ? '정류장 하차 시간' : '회사 하차 시간';
    const toMinutes = (value: string) => {
        const [hour, minute] = value.split(':').map(Number);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
        return hour * 60 + minute;
    };

    const handleSubmit = async () => {
        if (!user) {
            showToast("로그인 후에 수정 요청을 보낼 수 있어요", 'info');
            return;
        }
        if (!stationId) {
            showToast("정류장 정보를 확인할 수 없어 요청을 보낼 수 없어요.", 'error');
            return;
        }
        if (!isDelete && toMinutes(boardingTime) >= toMinutes(alightingTime)) {
            showToast('승차 시간과 하차 시간을 확인해 주세요.', 'error');
            return;
        }

        const currentBoardingTime = shuttle.boardingTime || shuttle.time || '';
        const currentAlightingTime = shuttle.alightingTime || shuttle.time || '';
        const currentCongestion = shuttle.congestion || '보통';
        const currentEnable = shuttle.enable !== false;
        const nextEnable = !isDelete;
        const isSameAsCurrent =
            currentBoardingTime === boardingTime &&
            currentAlightingTime === alightingTime &&
            currentCongestion === congestion &&
            currentEnable === nextEnable;

        if (isSameAsCurrent) {
            showToast('변경된 내용이 없어서 반영할 수 없어요.', 'info');
            return;
        }

        try {
            const restricted = await isUserEditRestricted(user.uid);
            if (restricted) {
                showToast("신고 누적으로 수정 기능이 제한되었어요.", 'error');
                return;
            }

            await applyShuttleUpdate(stationId, shuttle.id, {
                boardingTime,
                alightingTime,
                congestion,
                isDelete,
                changedByUid: user.uid,
                changedByNickname: (currentUserNickname || '').trim() || '익명',
                beforeData: {
                    boardingTime: shuttle.boardingTime || shuttle.time || '',
                    alightingTime: shuttle.alightingTime || shuttle.time || '',
                    congestion: shuttle.congestion || '보통',
                    enable: shuttle.enable !== false
                }
            });
            await onApplied?.();
            showToast(isDelete ? '운행 중단으로 바로 반영했어요.' : '수정 내용이 바로 반영됐어요.', 'success');
            onClose();
        } catch (error) {
            showToast("수정 반영 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", 'error');
        }
    };

    return (
        <div style={modalOverlayStyle(isMobile)}>
            <div style={modalContentStyle(isMobile)}>
                <h3 style={{ color: '#8B5CF6', marginTop: 0 }}>✏️ 정보 수정</h3>
                <p style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: '20px' }}>
                    잘못된 정보가 있다면 바로잡아 주세요.
                </p>

                <div style={infoSummaryStyle}>
                    <div style={infoRowStyle}>
                        <span style={infoLabelStyle}>회사 이름</span>
                        <span style={infoValueStyle}>{shuttle.company || '정보 없음'}</span>
                    </div>
                    <div style={infoRowStyle}>
                        <span style={infoLabelStyle}>정류장 명칭</span>
                        <span style={infoValueStyle}>{shuttle.name || '정보 없음'}</span>
                    </div>
                    <div style={infoRowStyle}>
                        <span style={infoLabelStyle}>운행 종류</span>
                        <span style={typeBadgeStyle(shuttle.type)}>
                            {shuttle.type === 'work' ? '출근' : '퇴근'}
                        </span>
                    </div>
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>{boardingTimeLabel}</label>
                    <input
                        type="time"
                        value={boardingTime}
                        onChange={(e) => setBoardingTime(e.target.value)}
                        disabled={isDelete}
                        style={isDelete ? disabledInputStyle : inputStyle}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>{alightingTimeLabel}</label>
                    <input
                        type="time"
                        value={alightingTime}
                        onChange={(e) => setAlightingTime(e.target.value)}
                        disabled={isDelete}
                        style={isDelete ? disabledInputStyle : inputStyle}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>평균 혼잡도</label>
                    <div ref={congestionDropdownRef} style={dropdownWrapStyle}>
                        <button
                            type="button"
                            onClick={() => {
                                if (isDelete) return;
                                setIsCongestionDropdownOpen((prev) => !prev);
                            }}
                            style={dropdownButtonStyle(isDelete)}
                        >
                            <span style={dropdownValueStyle}>{congestion}</span>
                            <span style={dropdownArrowStyle(isCongestionDropdownOpen)}>▾</span>
                        </button>

                        {isCongestionDropdownOpen && !isDelete && (
                            <div style={dropdownMenuStyle}>
                                {['여유', '보통', '부족'].map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => {
                                            setCongestion(option);
                                            setIsCongestionDropdownOpen(false);
                                        }}
                                        style={dropdownOptionStyle(option === congestion)}
                                    >
                                        <span style={dropdownOptionTextStyle}>{option}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>운행 상태</label>
                    <div style={serviceToggleWrapStyle}>
                        <button
                            type="button"
                            onClick={() => setIsDelete(false)}
                            style={serviceToggleButtonStyle(!isDelete)}
                        >
                            운행
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsDelete(true)}
                            style={serviceToggleButtonStyle(isDelete)}
                        >
                            미운행
                        </button>
                    </div>
                </div>

                <div style={buttonGroupStyle}>
                    <button onClick={onClose} style={cancelButtonStyle}>취소</button>
                    <button onClick={handleSubmit} style={submitButtonStyle}>적용</button>
                </div>
            </div>
        </div>
    );
};

// --- 스타일 정의 ---
const modalOverlayStyle = (isMobile: boolean): React.CSSProperties => ({
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: isMobile ? 'flex-end' : 'center',
    alignItems: isMobile ? 'stretch' : 'center',
    padding: isMobile ? '0' : '16px',
    boxSizing: 'border-box',
    zIndex: 4000
});
const modalContentStyle = (isMobile: boolean): React.CSSProperties => ({
    backgroundColor: 'white',
    padding: isMobile ? '20px 16px' : '25px',
    borderRadius: isMobile ? '0' : '16px',
    width: isMobile ? '100%' : 'min(380px, 100%)',
    height: isMobile ? '100%' : 'auto',
    minHeight: isMobile ? '100%' : undefined,
    maxHeight: isMobile ? '100vh' : 'calc(100vh - 32px)',
    overflowY: 'auto',
    boxSizing: 'border-box',
    boxShadow: isMobile ? 'none' : '0 10px 25px rgba(0,0,0,0.2)'
});
const inputGroupStyle: React.CSSProperties = { marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' };
const labelStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 'bold', color: '#4B5563' };
const inputStyle: React.CSSProperties = { padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '1rem' };
const disabledInputStyle: React.CSSProperties = { ...inputStyle, backgroundColor: '#F3F4F6', color: '#9CA3AF' };
const dropdownWrapStyle: React.CSSProperties = { position: 'relative' };
const dropdownButtonStyle = (disabled: boolean): React.CSSProperties => ({
    ...inputStyle,
    width: '100%',
    backgroundColor: disabled ? '#F3F4F6' : '#FFFFFF',
    color: disabled ? '#9CA3AF' : '#111827',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    textAlign: 'left',
    gap: '10px',
    cursor: disabled ? 'not-allowed' : 'pointer'
});
const dropdownValueStyle: React.CSSProperties = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
};
const dropdownArrowStyle = (open: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    width: '14px',
    justifyContent: 'center',
    color: '#6B7280',
    transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.18s ease',
    marginRight: '2px'
});
const dropdownMenuStyle: React.CSSProperties = {
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
const dropdownOptionStyle = (selected: boolean): React.CSSProperties => ({
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
const dropdownOptionTextStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
};
const infoSummaryStyle: React.CSSProperties = {
    marginBottom: '15px',
    padding: '12px',
    borderRadius: '10px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #F3F4F6',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
};
const infoRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' };
const infoLabelStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#6B7280', fontWeight: 700 };
const infoValueStyle: React.CSSProperties = { fontSize: '0.9rem', color: '#111827', fontWeight: 600 };
const typeBadgeStyle = (type: 'work' | 'leave'): React.CSSProperties => ({
    fontSize: '0.75rem',
    padding: '2px 8px',
    borderRadius: '999px',
    backgroundColor: type === 'work' ? '#DBEAFE' : '#FEF3C7',
    color: type === 'work' ? '#1E40AF' : '#92400E',
    whiteSpace: 'nowrap',
    fontWeight: 700
});
const serviceToggleWrapStyle: React.CSSProperties = {
    display: 'flex',
    gap: '10px'
};
const serviceToggleButtonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    border: 'none',
    borderRadius: '8px',
    padding: '10px',
    backgroundColor: active ? '#8B5CF6' : '#F3F4F6',
    color: active ? '#FFFFFF' : '#4B5563',
    fontWeight: 700,
    cursor: 'pointer'
});
const buttonGroupStyle: React.CSSProperties = { display: 'flex', gap: '10px', marginTop: '25px' };
const cancelButtonStyle: React.CSSProperties = { flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#F3F4F6', color: '#4B5563', fontWeight: 'bold', cursor: 'pointer' };
const submitButtonStyle: React.CSSProperties = { flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#8B5CF6', color: 'white', fontWeight: 'bold', cursor: 'pointer' };

export default EditRequestModal;
