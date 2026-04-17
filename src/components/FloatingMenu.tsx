import React, { useState } from 'react';

interface FloatingMenuProps {
    isAddMode: boolean;
    onToggleAddMode: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({ isAddMode, onToggleAddMode }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div style={{ position: 'absolute', bottom: '40px', right: '20px', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '15px' }}>

            {/* 확장되는 서브 메뉴들 */}
            {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>

                    {/* 1. 정류장 추가 버튼 */}
                    <button
                        onClick={() => {
                            onToggleAddMode();
                            setIsOpen(false); // 메뉴 닫기
                        }}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '25px',
                            backgroundColor: isAddMode ? '#ff4757' : 'white',
                            color: isAddMode ? 'white' : '#333',
                            border: 'none',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>📍</span> {isAddMode ? '추가 모드 취소' : '정류장 추가'}
                    </button>

                    {/* 2. 추후 추가될 기능 예시: 내 위치로 이동 */}
                    <button
                        onClick={() => {
                            alert('내 위치로 지도를 이동합니다! (기능 구현 예정)');
                            setIsOpen(false);
                        }}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '25px',
                            backgroundColor: 'white',
                            color: '#333',
                            border: 'none',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>🎯</span> 내 위치로
                    </button>

                </div>
            )}

            {/* 메인 플로팅 메뉴 버튼 (아이콘 적용) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: isOpen ? '#333' : '#8B5CF6', // 열렸을 땐 어두운 색으로 변경
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.3s ease',
                }}
            >
                {isOpen ? (
                    // 메뉴가 열렸을 때: 닫기(X) 아이콘
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                ) : (
                    // 메뉴가 닫혔을 때: 햄버거 메뉴 아이콘
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