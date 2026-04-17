import React, { useState } from 'react';
import { type User } from 'firebase/auth'; // Vite 8/TS 최신 규칙 준수
import { logout } from '../services/firebase';

interface FloatingMenuProps {
    user: User | null;         // 현재 로그인한 유저 정보
    isAddMode: boolean;        // 정류장 추가 모드 여부
    onToggleAddMode: () => void; // 추가 모드 토글 함수
    onOpenLogin: () => void;   // 로그인 모달 열기 함수
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
                                                       user,
                                                       isAddMode,
                                                       onToggleAddMode,
                                                       onOpenLogin
                                                   }) => {
    const [isOpen, setIsOpen] = useState(false);

    // 공통 버튼 스타일 (시그니처 컬러 #8B5CF6 반영)
    const menuButtonStyle: React.CSSProperties = {
        padding: '12px 20px',
        borderRadius: '25px',
        border: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap'
    };

    return (
        <div style={{
            position: 'absolute', bottom: '40px', right: '20px', zIndex: 100,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px'
        }}>

            {/* 햄버거 메뉴가 열렸을 때 나타나는 서브 버튼들 */}
            {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>

                    {/* 1. 정류장 추가 (로그인 여부와 상관없이 모드 진입 가능) */}
                    <button
                        onClick={() => {
                            onToggleAddMode();
                            setIsOpen(false);
                        }}
                        style={{
                            ...menuButtonStyle,
                            backgroundColor: isAddMode ? '#ff4757' : 'white',
                            color: isAddMode ? 'white' : '#333'
                        }}
                    >
                        <span>📍</span> {isAddMode ? '추가 취소' : '정류장 추가'}
                    </button>

                    {/* 2. 유저 상태에 따른 분기 로직 */}
                    {user ? (
                        /* [로그인 된 상태] */
                        <>
                            <button
                                onClick={() => alert('즐겨찾기 목록을 불러옵니다!')}
                                style={{ ...menuButtonStyle, backgroundColor: '#8B5CF6', color: 'white' }}
                            >
                                <span>⭐</span> 내 즐겨찾기
                            </button>
                            <button
                                onClick={() => {
                                    logout();
                                    setIsOpen(false);
                                }}
                                style={{ ...menuButtonStyle, backgroundColor: 'white', color: '#666' }}
                            >
                                <span>🚪</span> 로그아웃
                            </button>
                        </>
                    ) : (
                        /* [로그인 안 된 상태] */
                        <button
                            onClick={() => {
                                onOpenLogin();
                                setIsOpen(false);
                            }}
                            style={{ ...menuButtonStyle, backgroundColor: 'white', color: '#333' }}
                        >
                            <span>🔑</span> 로그인
                        </button>
                    )}
                </div>
            )}

            {/* 메인 플로팅 메뉴 버튼 (햄버거 <-> X) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '60px', height: '60px', borderRadius: '50%',
                    backgroundColor: isOpen ? '#333' : '#8B5CF6',
                    color: 'white', border: 'none',
                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
            >
                {isOpen ? (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                )}
            </button>
        </div>
    );
};

export default FloatingMenu;