import React, { useState } from 'react';
import { type User } from 'firebase/auth'; // Vite 8/TS 최신 규칙 준수
import {auth} from "../firebase.ts";
import { useFeedback } from './feedback/FeedbackProvider';

interface FloatingMenuProps {
    user: User | null;         // 현재 로그인한 유저 정보
    isRankingOpen: boolean;
    isFavOpen: boolean;
    onToggleRanking: () => void;
    onToggleFav: () => void;
    onOpenLogin: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
                                                       user, isRankingOpen, isFavOpen,
                                                       onToggleRanking, onToggleFav, onOpenLogin
                                                   }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { showToast, showConfirm } = useFeedback();

    const handleLogout = async () => {
        const isConfirmed = await showConfirm({
            title: '로그아웃',
            message: '정말 로그아웃하시겠어요?',
            confirmText: '로그아웃',
            cancelText: '계속 이용'
        });

        if (isConfirmed) {
            auth.signOut();
            setIsOpen(false);
        }
    };
    const toggleMenu = () => setIsOpen(!isOpen);
    // ✨ 현재 어떤 모드가 활성화되어 있는지 확인하는 로직
    const getActiveMode = () => {
        if (isRankingOpen) return { icon: '🏆', label: '랭킹 중', color: '#F59E0B', bgColor: '#FEF3C7', toggle: onToggleRanking };
        if (isFavOpen) return { icon: '⭐', label: '관심 중', color: '#0284C7', bgColor: '#E0F2FE', toggle: onToggleFav };
        return null;
    };
    const activeMode = getActiveMode();

    return (
        <div style={containerStyle}>
            {/* 1. 메뉴 리스트 */}
            {isOpen && (
                <div style={menuListStyle}>
                    {/* ✨ 로그인 여부에 따라 버튼 분기 처리 */}
                    {user ? (
                        <button onClick={handleLogout} style={menuItemStyle}>🔓 로그아웃</button>
                    ) : (
                        <button onClick={() => { onOpenLogin(); setIsOpen(false); }} style={{ ...menuItemStyle, color: '#8B5CF6' }}>🔑 로그인</button>
                    )}
                    <button
                        onClick={() => {
                            if (!user) {
                                showToast("로그인 후 이용해 주세요.", 'info');
                            } else {
                                onToggleRanking();
                            }
                        }}
                        style={user ? { ...menuItemStyle, color: isRankingOpen ? '#8B5CF6' : '#4B5563' } : disabledMenuItemStyle}
                    >
                        {user ? '🏆 랭킹' : '🔒 랭킹'}
                    </button>

                    <button
                        onClick={() => {
                            if (!user) {
                                showToast("로그인 후 이용해 주세요.", 'info');
                            } else {
                                onToggleFav();
                            }
                        }}
                        style={user ? { ...menuItemStyle, color: isFavOpen ? '#8B5CF6' : '#4B5563' } : disabledMenuItemStyle}
                    >
                        {user ? '⭐ 즐겨찾기' : '🔒 즐겨찾기'}
                    </button>
                </div>
            )}

            {/* 2. 단일 스티키 인디케이터 (메뉴가 닫혀있고 모드가 활성화된 경우) */}
            {!isOpen && activeMode && (
                <div
                    style={stickyIndicatorStyle(activeMode.bgColor, activeMode.color)}
                    onClick={activeMode.toggle}
                >
                    <span style={{ fontSize: '1.2rem' }}>{activeMode.icon}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: activeMode.color }}>중단</span>
                </div>
            )}

            {/* 3. 메인 플로팅 버튼 */}
            <button onClick={toggleMenu} style={mainButtonStyle(isOpen || !!activeMode)}>
                {isOpen ? '✕' : 'MENU'}
            </button>
        </div>
    );
};

const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '30px',
    right: '20px',
    width: '60px',  // 버튼 너비와 일치시켜 흔들림 방지
    height: '60px', // 버튼 높이와 일치시켜 흔들림 방지
    zIndex: 1000,
};

const menuListStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '75px', // 메인 버튼(60px) + 여백(15px) 위에 배치
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'flex-end',
    width: 'max-content'
};

const menuItemStyle: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: '25px',
    backgroundColor: 'white',
    border: '1px solid #E5E7EB',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#4B5563',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
};
const disabledMenuItemStyle: React.CSSProperties = { ...menuItemStyle, color: '#9CA3AF', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' };

const mainButtonStyle = (isActive: boolean): React.CSSProperties => ({
    width: '60px',
    height: '60px',
    borderRadius: '30px',
    backgroundColor: isActive ? '#8B5CF6' : 'white',
    color: isActive ? 'white' : '#8B5CF6',
    border: 'none',
    boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    transition: 'all 0.2s ease',
    position: 'absolute', // 컨테이너 안에서 절대 위치 고정
    bottom: 0,
    right: 0
});

const stickyIndicatorStyle = (bgColor: string, borderColor: string): React.CSSProperties => ({
    position: 'absolute',
    bottom: '75px', // 메인 버튼 위에 배치
    right: '4px',   // 60px 버튼 중앙에 맞추기 위한 미세 조정 ( (60-52)/2 )
    width: '52px',
    height: '52px',
    borderRadius: '26px',
    backgroundColor: bgColor,
    border: `2px solid ${borderColor}`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    cursor: 'pointer'
});

export default FloatingMenu;
