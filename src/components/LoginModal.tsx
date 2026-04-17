import React from 'react';
import { signInWithGoogle } from '../services/firebase';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const handleGoogleLogin = async () => {
        try {
            await signInWithGoogle();
            onClose(); // 로그인 성공 시 모달 닫기
        } catch (error) {
            alert('로그인 처리 중 문제가 발생했습니다.');
        }
    };

    return (
        // 모달 배경 (어둡게 처리)
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            {/* 모달 컨텐츠 박스 */}
            <div style={{
                backgroundColor: 'white', padding: '30px', borderRadius: '16px',
                width: '90%', maxWidth: '320px', textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#333' }}>셔틀콕 시작하기</h2>
                <p style={{ margin: '0 0 25px 0', fontSize: '14px', color: '#666' }}>로그인하고 나의 출퇴근 셔틀을<br/>즐겨찾기에 등록해 보세요.</p>

                <button onClick={handleGoogleLogin} style={{
                    width: '100%', padding: '12px', borderRadius: '8px',
                    border: '1px solid #ddd', backgroundColor: 'white',
                    fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    marginBottom: '15px'
                }}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" style={{ width: '20px' }} />
                    Google로 계속하기
                </button>

                <button onClick={onClose} style={{
                    border: 'none', backgroundColor: 'transparent', color: '#999',
                    fontSize: '14px', cursor: 'pointer', textDecoration: 'underline'
                }}>
                    다음에 할게요 (닫기)
                </button>
            </div>
        </div>
    );
};

export default LoginModal;