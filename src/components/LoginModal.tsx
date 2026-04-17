import React from 'react';
import { loginWithGoogle } from '../services/firebase';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const LoginModal: React.FC<Props> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const handleLogin = async () => {
        try {
            await loginWithGoogle();
            onClose();
        } catch (error) {
            console.error("로그인 실패:", error);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', textAlign: 'center', width: '300px' }}>
                <h2 style={{ marginBottom: '10px' }}>셔틀콕 로그인</h2>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>로그인하고 나만의 셔틀 정류장을<br/>즐겨찾기 해보세요! ⭐</p>
                <button onClick={handleLogin} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" />
                    Google로 로그인
                </button>
                <button onClick={onClose} style={{ marginTop: '15px', border: 'none', background: 'none', color: '#999', cursor: 'pointer' }}>닫기</button>
            </div>
        </div>
    );
};

export default LoginModal;