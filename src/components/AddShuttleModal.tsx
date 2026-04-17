import React, { useState } from 'react';

interface AddShuttleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    lat: number;
    lng: number;
}

const AddShuttleModal: React.FC<AddShuttleModalProps> = ({ isOpen, onClose, onSave, lat, lng }) => {
    const [stationName, setStationName] = useState('');
    const [company, setCompany] = useState('');
    const [type, setType] = useState<'work' | 'leave'>('work');
    const [time, setTime] = useState('08:30');
    const [congestion, setCongestion] = useState('적당');

    if (!isOpen) return null;

    return (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <h3 style={{ color: '#8B5CF6', marginBottom: '20px' }}>🚌 셔틀 정보 등록</h3>

                <div style={inputGroupStyle}>
                    <label>정류장 이름</label>
                    <input
                        type="text"
                        placeholder="예: 강남역 1번 출구"
                        value={stationName}
                        onChange={(e) => setStationName(e.target.value)}
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
                    <label>도착 시간</label>
                    <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
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
                        onClick={() => onSave({ stationName, company, type, time, congestion, lat, lng })}
                        style={saveButtonStyle}
                    >정보 저장하기</button>
                </div>
            </div>
        </div>
    );
};

// --- 스타일 정의 (생략 가능하나 가이드용으로 포함) ---
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '400px' };
const inputGroupStyle: React.CSSProperties = { marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' };
const inputStyle: React.CSSProperties = { padding: '10px', borderRadius: '8px', border: '1px solid #D1D5DB' };
const buttonGroupStyle: React.CSSProperties = { display: 'flex', gap: '10px' };
const activeButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', backgroundColor: '#8B5CF6', color: 'white', borderRadius: '8px', border: 'none' };
const inactiveButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', backgroundColor: '#F3F4F6', color: '#4B5563', borderRadius: '8px', border: 'none' };
const saveButtonStyle: React.CSSProperties = { flex: 2, padding: '12px', backgroundColor: '#8B5CF6', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold' };
const cancelButtonStyle: React.CSSProperties = { flex: 1, padding: '12px', backgroundColor: '#F3F4F6', color: '#4B5563', borderRadius: '8px', border: 'none' };

export default AddShuttleModal;