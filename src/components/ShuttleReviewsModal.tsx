import React, { useEffect, useState } from 'react';
import { addShuttleReview, fetchShuttleReviews } from '../services/shuttleService';
import { useFeedback } from './feedback/FeedbackProvider';

interface ShuttleReviewsModalProps {
    isOpen: boolean;
    onClose: () => void;
    stationName: string;
    shuttle: {
        id: string;
        stationId?: string;
        name: string;
        company: string;
        type: 'work' | 'leave';
        boardingTime?: string;
        alightingTime?: string;
        time?: string;
    } | null;
    user: any;
    currentUserNickname?: string;
    onReviewCountChanged?: (stationId: string, shuttleId: string, nextCount: number) => void;
}

const ShuttleReviewsModal: React.FC<ShuttleReviewsModalProps> = ({
    isOpen,
    onClose,
    stationName,
    shuttle,
    user,
    currentUserNickname,
    onReviewCountChanged
}) => {
    const { showToast } = useFeedback();
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewText, setReviewText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen || !shuttle?.stationId) return;

        let isCancelled = false;
        setIsLoading(true);
        void fetchShuttleReviews(shuttle.stationId, shuttle.id)
            .then((items) => {
                if (!isCancelled) {
                    setReviews(items);
                }
            })
            .catch((error) => {
                console.error('탑승 후기 조회 실패:', error);
                if (!isCancelled) {
                    showToast('탑승 후기를 불러오는 중 문제가 생겼어요.', 'error');
                }
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [isOpen, shuttle?.id, shuttle?.stationId, showToast]);

    if (!isOpen || !shuttle) return null;

    const getDisplayTime = () => {
        if (shuttle.type === 'work') {
            return shuttle.boardingTime || shuttle.time || '';
        }
        return shuttle.alightingTime || shuttle.time || '';
    };

    const getRelativeTime = (timestamp: any) => {
        if (!timestamp?.toDate) return '방금 전';
        const date = timestamp.toDate();
        const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
        if (diffSec < 60) return '방금 전';
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const handleSubmit = async () => {
        if (!user) {
            showToast('탑승 후기는 로그인 후 작성할 수 있어요.', 'info');
            return;
        }
        if (!shuttle.stationId) {
            showToast('정류장 정보를 찾을 수 없어 후기를 등록할 수 없어요.', 'error');
            return;
        }

        const content = reviewText.trim();
        if (!content) {
            showToast('탑승 후기를 입력해 주세요.', 'info');
            return;
        }

        try {
            setIsSubmitting(true);
            const submitResult = await addShuttleReview(shuttle.stationId, shuttle.id, {
                content,
                userId: user.uid,
                userNickname: (currentUserNickname || '').trim() || '익명'
            });

            const newReview = {
                id: `local-${Date.now()}`,
                content,
                userNickname: submitResult.userNickname || '익명',
                createdAt: { toDate: () => new Date() }
            };
            setReviews((prev) => [newReview, ...prev]);
            setReviewText('');
            onReviewCountChanged?.(shuttle.stationId, shuttle.id, reviews.length + 1);
            showToast('탑승 후기가 등록됐어요.', 'success');
        } catch (error) {
            console.error('탑승 후기 등록 실패:', error);
            showToast('탑승 후기 등록 중 문제가 생겼어요.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={overlayStyle}>
            <div style={contentStyle}>
                <div style={headerStyle}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827' }}>탑승 후기</h2>
                    <button type="button" onClick={onClose} style={closeButtonStyle}>✕</button>
                </div>

                <div style={summaryCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '1rem', color: '#111827' }}>{shuttle.name}</strong>
                        <span style={typeBadgeStyle(shuttle.type)}>{shuttle.type === 'work' ? '출근' : '퇴근'}</span>
                    </div>
                    <div style={summarySubTextStyle}>📍 {stationName}</div>
                    <div style={summarySubTextStyle}>🏢 {shuttle.company}</div>
                    <div style={summarySubTextStyle}>
                        {shuttle.type === 'work' ? '승차' : '하차'} {getDisplayTime() || '정보 없음'}
                    </div>
                </div>

                <div style={listAreaStyle}>
                    {isLoading && <div style={emptyTextStyle}>후기를 불러오는 중이에요...</div>}
                    {!isLoading && reviews.length === 0 && (
                        <div style={emptyTextStyle}>첫 번째 탑승 후기를 남겨 보세요.</div>
                    )}
                    {!isLoading && reviews.map((review) => (
                        <div key={review.id} style={reviewCardStyle}>
                            <div style={reviewTopStyle}>
                                <strong style={{ fontSize: '0.9rem', color: '#111827' }}>{review.userNickname || '익명'}</strong>
                                <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>{getRelativeTime(review.createdAt)}</span>
                            </div>
                            <p style={reviewTextStyle}>{review.content}</p>
                        </div>
                    ))}
                </div>

                <div style={composerWrapStyle}>
                    <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder={user ? "셔틀 탑승 경험을 자유롭게 남겨 주세요." : "로그인 후 탑승 후기를 남길 수 있어요."}
                        disabled={!user}
                        style={textareaStyle}
                        rows={3}
                    />
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={isSubmitting || !user}
                        style={submitButtonStyle(isSubmitting || !user)}
                    >
                        {isSubmitting ? '등록 중...' : (user ? '후기 남기기' : '🔒 후기 남기기')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 5200,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch'
};

const contentStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    boxSizing: 'border-box'
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px'
};

const closeButtonStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    fontSize: '1.3rem',
    color: '#9CA3AF',
    cursor: 'pointer',
    padding: 0
};

const summaryCardStyle: React.CSSProperties = {
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    backgroundColor: '#F9FAFB',
    padding: '12px',
    marginBottom: '12px'
};

const summarySubTextStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color: '#4B5563',
    lineHeight: 1.5
};

const typeBadgeStyle = (type: 'work' | 'leave'): React.CSSProperties => ({
    fontSize: '0.75rem',
    padding: '2px 8px',
    borderRadius: '999px',
    fontWeight: 700,
    backgroundColor: type === 'work' ? '#DBEAFE' : '#FEF3C7',
    color: type === 'work' ? '#1E40AF' : '#92400E'
});

const listAreaStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingBottom: '8px'
};

const reviewCardStyle: React.CSSProperties = {
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    backgroundColor: '#FFFFFF',
    padding: '10px'
};

const reviewTopStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px'
};

const reviewTextStyle: React.CSSProperties = {
    margin: '6px 0 0',
    fontSize: '0.9rem',
    color: '#374151',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
};

const emptyTextStyle: React.CSSProperties = {
    padding: '16px 0',
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: '0.88rem'
};

const composerWrapStyle: React.CSSProperties = {
    borderTop: '1px solid #F3F4F6',
    paddingTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
};

const textareaStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #D1D5DB',
    borderRadius: '10px',
    padding: '10px',
    fontFamily: 'inherit',
    fontSize: '0.92rem',
    resize: 'none',
    boxSizing: 'border-box'
};

const submitButtonStyle = (disabled: boolean): React.CSSProperties => ({
    border: 'none',
    borderRadius: '10px',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    padding: '11px 12px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1
});

export default ShuttleReviewsModal;
