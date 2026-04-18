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
    const [name, setName] = useState('');
    const [boardingTime, setBoardingTime] = useState('');
    const [alightingTime, setAlightingTime] = useState('');
    const [congestion, setCongestion] = useState('적당');
    const [isDelete, setIsDelete] = useState(false);

    // 모달이 열릴 때 현재 값을 초기값으로 세팅
    useEffect(() => {
        if (shuttle) {
            setName(shuttle.name);
            setBoardingTime(shuttle.boardingTime || shuttle.time || '');
            setAlightingTime(shuttle.alightingTime || shuttle.time || '');
            setCongestion(shuttle.congestion || '적당');
            setIsDelete(false);
        }
    }, [shuttle, isOpen]);

    if (!isOpen || !shuttle) return null;

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
                name: name,
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
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <h3 style={{ color: '#8B5CF6', marginTop: 0 }}>✏️ 정보 수정 요청</h3>
                <p style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: '20px' }}>
                    잘못된 정보를 바로잡아 주세요. 관리자 확인 후 즉시 반영됩니다.
                </p>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>기업명</label>
                    <input type="text" value={shuttle.company} disabled style={disabledInputStyle} />
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>정류장 명칭</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isDelete}
                        style={isDelete ? disabledInputStyle : inputStyle}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>승차 시간</label>
                    <input
                        type="time"
                        value={boardingTime}
                        onChange={(e) => setBoardingTime(e.target.value)}
                        disabled={isDelete}
                        style={isDelete ? disabledInputStyle : inputStyle}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>하차 시간</label>
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
                        <option value="적당">적당</option>
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
                            이 노선은 더 이상 운행하지 않습니다 (삭제 요청)
                        </span>
                    </label>
                </div>

                <div style={buttonGroupStyle}>
                    <button onClick={onClose} style={cancelButtonStyle}>취소</button>
                    <button onClick={handleSubmit} style={submitButtonStyle}>요청 제출</button>
                </div>
            </div>
        </div>
    );
};

// --- 스타일 정의 ---
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '25px', borderRadius: '16px', width: '90%', maxWidth: '380px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
const inputGroupStyle: React.CSSProperties = { marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' };
const labelStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 'bold', color: '#4B5563' };
const inputStyle: React.CSSProperties = { padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '1rem' };
const disabledInputStyle: React.CSSProperties = { ...inputStyle, backgroundColor: '#F3F4F6', color: '#9CA3AF' };
const deleteOptionStyle: React.CSSProperties = { marginTop: '10px', padding: '12px', borderRadius: '8px', backgroundColor: '#FEF2F2' };
const buttonGroupStyle: React.CSSProperties = { display: 'flex', gap: '10px', marginTop: '25px' };
const cancelButtonStyle: React.CSSProperties = { flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#F3F4F6', color: '#4B5563', fontWeight: 'bold', cursor: 'pointer' };
const submitButtonStyle: React.CSSProperties = { flex: 2, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#8B5CF6', color: 'white', fontWeight: 'bold', cursor: 'pointer' };

export default EditRequestModal;
