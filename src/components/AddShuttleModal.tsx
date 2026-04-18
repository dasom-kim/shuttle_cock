import React, { useState } from 'react';
import { useFeedback } from './feedback/FeedbackProvider';

interface AddShuttleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    lat: number;
    lng: number;
    stationName: string;
}

const AddShuttleModal: React.FC<AddShuttleModalProps> = ({ isOpen, onClose, onSave, lat, lng, stationName }) => {
    const { showToast } = useFeedback();
    const [shuttleName, setShuttleName] = useState('');
    const [company, setCompany] = useState('');
    const [type, setType] = useState<'work' | 'leave'>('work');
    const [boardingTime, setBoardingTime] = useState('08:30');
    const [alightingTime, setAlightingTime] = useState('09:00');
    const [congestion, setCongestion] = useState('적당');

    if (!isOpen) return null;

    const handleSave = () => {
        if (!shuttleName.trim()) {
            showToast('셔틀 표기명을 입력해 주세요', 'info');
            return;
        }
        if (!company.trim()) {
            showToast('어떤 기업 셔틀인지 기업명도 함께 입력해 주세요', 'info');
            return;
        }
        // type, boardingTime, alightingTime, congestion은 기본값이 설정되어 있으므로 별도 검사 불필요

        onSave({ shuttleName, company, type, boardingTime, alightingTime, congestion, lat, lng });
    };

    return (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <h3 style={{ color: '#8B5CF6', marginBottom: '20px' }}>🚌 셔틀 정보 등록</h3>

                <div style={inputGroupStyle}>
                    <label>정류장 명칭 (기존 정류장 우선, 없으면 네이버 기준)</label>
                    <input
                        type="text"
                        value={stationName}
                        disabled
                        style={{ ...inputStyle, backgroundColor: '#F9FAFB', color: '#6B7280' }}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label>셔틀 표기명</label>
                    <input
                        type="text"
                        placeholder="예: 강남A, 2출 탑승지"
                        value={shuttleName}
                        onChange={(e) => setShuttleName(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <div style={inputGroupStyle}>
                    <label>기업명</label>
                    <input
                        type="text"
                        placeholder="예: 삼성전자, 네이버"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        style={inputStyle}
                    />
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
                    <label>
                        {type === 'work' ? '승차 시간' : '하차 시간'}
                    </label>
                    <input
                        type="time"
                        value={type === 'work' ? boardingTime : alightingTime}
                        onChange={(e) => {
                            if (type === 'work') {
                                setBoardingTime(e.target.value);
                            } else {
                                setAlightingTime(e.target.value);
                            }
                        }}
                        style={inputStyle}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label>
                        {type === 'work' ? '회사 하차 시간' : '회사 승차 시간'}
                    </label>
                    <input
                        type="time"
                        value={type === 'work' ? alightingTime : boardingTime}
                        onChange={(e) => {
                            if (type === 'work') {
                                setAlightingTime(e.target.value);
                            } else {
                                setBoardingTime(e.target.value);
                            }
                        }}
                        style={inputStyle}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label>평균 혼잡도</label>
                    <select
                        value={congestion}
                        onChange={(e) => setCongestion(e.target.value)}
                        style={inputStyle}
                    >
                        <option value="여유">여유</option>
                        <option value="적당">적당</option>
                        <option value="부족">부족</option>
                    </select>
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
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '400px' };
const inputGroupStyle: React.CSSProperties = { marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' };
const inputStyle: React.CSSProperties = { padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB' };
const buttonGroupStyle: React.CSSProperties = { display: 'flex', gap: '10px' };
const activeButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', backgroundColor: '#8B5CF6', color: 'white', borderRadius: '8px', border: 'none' };
const inactiveButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', backgroundColor: '#F3F4F6', color: '#4B5563', borderRadius: '8px', border: 'none' };
const saveButtonStyle: React.CSSProperties = { flex: 2, padding: '12px', backgroundColor: '#8B5CF6', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold' };
const cancelButtonStyle: React.CSSProperties = { flex: 1, padding: '12px', backgroundColor: '#F3F4F6', color: '#4B5563', borderRadius: '8px', border: 'none' };

export default AddShuttleModal;
