import React, { useState, useEffect } from 'react';
import { submitShuttleRequest } from '../services/shuttleService';
import { useFeedback } from './feedback/FeedbackProvider';

interface EditRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    stationId?: string;
    shuttle: any; // 현재 선택된 셔틀 정보
    user: any;
}

const EditRequestModal: React.FC<EditRequestModalProps> = ({ isOpen, onClose, stationId, shuttle, user }) => {
    const { showToast } = useFeedback();
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    const [boardingTime, setBoardingTime] = useState('');
    const [alightingTime, setAlightingTime] = useState('');
    const [congestion, setCongestion] = useState('보통');
    const [isDelete, setIsDelete] = useState(false);

    // 모달이 열릴 때 현재 값을 초기값으로 세팅
    useEffect(() => {
        if (shuttle) {
            setBoardingTime(shuttle.boardingTime || shuttle.time || '');
            setAlightingTime(shuttle.alightingTime || shuttle.time || '');
            setCongestion(shuttle.congestion || '보통');
            setIsDelete(false);
        }
    }, [shuttle, isOpen]);

    if (!isOpen || !shuttle) return null;

    const boardingTimeLabel = shuttle.type === 'leave' ? '회사 승차 시간' : '정류장 승차 시간';
    const alightingTimeLabel = shuttle.type === 'leave' ? '정류장 하차 시간' : '회사 하차 시간';

    const handleSubmit = async () => {
        if (!user) {
            showToast("로그인 후에 수정 요청을 보낼 수 있어요", 'info');
            return;
        }
        if (!stationId) {
            showToast("정류장 정보를 확인할 수 없어 요청을 보낼 수 없어요.", 'error');
            return;
        }

        const requestData = {
            type: isDelete ? 'DELETE' : 'EDIT',
            stationId: stationId,
            shuttleId: shuttle.id,
            currentData: {
                name: shuttle.name,
                boardingTime: shuttle.boardingTime || shuttle.time,
                alightingTime: shuttle.alightingTime || shuttle.time,
                congestion: shuttle.congestion
            },
            requestedData: isDelete ? null : {
                name: shuttle.name,
                boardingTime: boardingTime,
                alightingTime: alightingTime,
                congestion: congestion
            },
            requestedBy: user.uid,
            userNickname: user.displayName || '익명'
        };

        try {
            await submitShuttleRequest(requestData);
            showToast("수정 요청이 접수됐어요. 확인 후 빠르게 반영할게요.", 'success');
            onClose();
        } catch (error) {
            showToast("요청을 보내는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", 'error');
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
                    <select
                        value={congestion}
                        onChange={(e) => setCongestion(e.target.value)}
                        disabled={isDelete}
                        style={isDelete ? disabledInputStyle : inputStyle}
                    >
                        <option value="여유">여유</option>
                        <option value="보통">보통</option>
                        <option value="부족">부족</option>
                    </select>
                </div>

                <div style={deleteOptionStyle}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={isDelete}
                            onChange={(e) => setIsDelete(e.target.checked)}
                        />
                        <span style={{ color: '#EF4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            이 노선은 더 이상 운행하지 않습니다
                        </span>
                    </label>
                </div>

                <div style={buttonGroupStyle}>
                    <button onClick={onClose} style={cancelButtonStyle}>취소</button>
                    <button onClick={handleSubmit} style={submitButtonStyle}>요청</button>
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
const deleteOptionStyle: React.CSSProperties = { marginTop: '10px', padding: '12px', borderRadius: '8px', backgroundColor: '#FEF2F2' };
const buttonGroupStyle: React.CSSProperties = { display: 'flex', gap: '10px', marginTop: '25px' };
const cancelButtonStyle: React.CSSProperties = { flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#F3F4F6', color: '#4B5563', fontWeight: 'bold', cursor: 'pointer' };
const submitButtonStyle: React.CSSProperties = { flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#8B5CF6', color: 'white', fontWeight: 'bold', cursor: 'pointer' };

export default EditRequestModal;
