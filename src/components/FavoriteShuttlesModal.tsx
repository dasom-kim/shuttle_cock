import React, { useCallback, useEffect, useRef, useState } from 'react';
import EditRequestModal from './EditRequestModal';
import ShuttleReviewsModal from './ShuttleReviewsModal';
import ShuttleHistoryModal from './ShuttleHistoryModal';
import { useFeedback } from './feedback/FeedbackProvider';
import {
    buildFavoriteShuttleKey,
    fetchAllStations,
    fetchFavoriteShuttleKeys,
    fetchLatestShuttleReview,
    isUserEditRestricted
} from '../services/shuttleService';

interface FavoriteShuttlesModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    currentUserNickname?: string;
    onDataChanged?: () => void | Promise<void>;
}

interface FavoriteShuttleViewItem {
    id: string;
    stationId: string;
    name: string;
    company: string;
    type: 'work' | 'leave';
    boardingTime?: string;
    alightingTime?: string;
    congestion?: string;
    enable: boolean;
    updatedAt?: any;
    updatedByNickname?: string;
    stationName: string;
}

const FavoriteShuttlesModal: React.FC<FavoriteShuttlesModalProps> = ({
    isOpen,
    onClose,
    user,
    currentUserNickname,
    onDataChanged
}) => {
    const { showToast } = useFeedback();
    const [items, setItems] = useState<FavoriteShuttleViewItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [latestReviewByKey, setLatestReviewByKey] = useState<Record<string, { content: string; userNickname: string } | null>>({});
    const [isEditRestricted, setIsEditRestricted] = useState(false);
    const [openedSwipeKey, setOpenedSwipeKey] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [targetShuttle, setTargetShuttle] = useState<FavoriteShuttleViewItem | null>(null);
    const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
    const [reviewTargetShuttle, setReviewTargetShuttle] = useState<FavoriteShuttleViewItem | null>(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyTargetShuttle, setHistoryTargetShuttle] = useState<FavoriteShuttleViewItem | null>(null);
    const swipeStateRef = useRef<{
        key: string | null;
        startX: number;
        startY: number;
        lastDx: number;
        tracking: boolean;
    }>({
        key: null,
        startX: 0,
        startY: 0,
        lastDx: 0,
        tracking: false
    });

    const buildReviewCountKey = (stationId?: string, shuttleId?: string) => {
        if (!stationId || !shuttleId) return '';
        return `${stationId}_${shuttleId}`;
    };

    const getDisplayTime = (shuttle: FavoriteShuttleViewItem) => {
        if (shuttle.type === 'work') {
            return shuttle.boardingTime || '';
        }
        return shuttle.alightingTime || '';
    };

    const reloadFavoriteItems = useCallback(async () => {
        if (!user?.uid) {
            setItems([]);
            return;
        }

        setIsLoading(true);
        try {
            const [favoriteKeys, stations] = await Promise.all([
                fetchFavoriteShuttleKeys(user.uid),
                fetchAllStations()
            ]);

            const flattened = stations.flatMap((station: any) =>
                (station.shuttles || []).map((shuttle: any) => ({
                    id: shuttle.id,
                    stationId: shuttle.stationId || station.id,
                    name: shuttle.name || '',
                    company: shuttle.company || '',
                    type: shuttle.type === 'leave' ? 'leave' : 'work',
                    boardingTime: shuttle.boardingTime || shuttle.time || '',
                    alightingTime: shuttle.alightingTime || shuttle.time || '',
                    congestion: shuttle.congestion || '보통',
                    enable: shuttle.enable !== false,
                    updatedAt: shuttle.updatedAt,
                    updatedByNickname: shuttle.updatedByNickname,
                    stationName: station.stationName || '정류장 정보'
                }))
            ) as FavoriteShuttleViewItem[];

            const filtered = flattened.filter((item) => {
                const key = buildFavoriteShuttleKey(item.stationId, item.id);
                return favoriteKeys.has(key);
            });

            filtered.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            setItems(filtered);
        } catch (error) {
            console.error('즐겨찾기 목록 조회 실패:', error);
            showToast('즐겨찾기 목록을 불러오는 중 문제가 생겼어요.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast, user?.uid]);

    useEffect(() => {
        if (!isOpen) return;
        void reloadFavoriteItems();
    }, [isOpen, reloadFavoriteItems]);

    useEffect(() => {
        if (!isOpen || !user?.uid) {
            setIsEditRestricted(false);
            return;
        }

        let isCancelled = false;
        void isUserEditRestricted(user.uid)
            .then((restricted) => {
                if (!isCancelled) {
                    setIsEditRestricted(restricted);
                }
            })
            .catch((error) => {
                console.error('수정 제한 여부 조회 실패:', error);
            });

        return () => {
            isCancelled = true;
        };
    }, [isOpen, user?.uid]);

    useEffect(() => {
        if (!isOpen) {
            setLatestReviewByKey({});
            return;
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setLatestReviewByKey({});
            return;
        }

        const candidates = items
            .filter((item) => item.stationId && item.id)
            .map((item) => ({
                stationId: item.stationId,
                shuttleId: item.id
            }));

        if (!candidates.length) {
            setLatestReviewByKey({});
            return;
        }

        let isCancelled = false;
        void Promise.all(
            candidates.map(async ({ stationId, shuttleId }) => {
                const latest = await fetchLatestShuttleReview(stationId, shuttleId);
                return { key: buildReviewCountKey(stationId, shuttleId), latest };
            })
        )
            .then((result) => {
                if (isCancelled) return;
                const nextMap: Record<string, { content: string; userNickname: string } | null> = {};
                result.forEach((item) => {
                    nextMap[item.key] = item.latest;
                });
                setLatestReviewByKey(nextMap);
            })
            .catch((error) => {
                if (!isCancelled) {
                    console.error('최근 후기 조회 실패:', error);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [isOpen, items]);

    const beginSwipe = (itemKey: string, event: React.PointerEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('button, input, select, textarea, a')) {
            return;
        }
        swipeStateRef.current = {
            key: itemKey,
            startX: event.clientX,
            startY: event.clientY,
            lastDx: 0,
            tracking: true
        };
    };

    const moveSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
        const state = swipeStateRef.current;
        if (!state.tracking) return;

        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        state.lastDx = dx;

        if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
            event.preventDefault();
        }
    };

    const endSwipe = () => {
        const state = swipeStateRef.current;
        if (!state.tracking || !state.key) return;

        if (state.lastDx <= -36) {
            setOpenedSwipeKey(state.key);
        } else if (state.lastDx >= 24) {
            setOpenedSwipeKey(null);
        }

        swipeStateRef.current = {
            key: null,
            startX: 0,
            startY: 0,
            lastDx: 0,
            tracking: false
        };
    };

    const handleOpenEdit = (shuttle: FavoriteShuttleViewItem) => {
        if (!user) {
            showToast('로그인 후 이용해 주세요.', 'info');
            return;
        }
        if (isEditRestricted) {
            showToast('신고 누적으로 수정 기능이 제한되었어요.', 'error');
            return;
        }
        setTargetShuttle(shuttle);
        setIsEditModalOpen(true);
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle}>
            <div style={contentStyle}>
                <div style={headerStyle}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111827' }}>즐겨찾기</h2>
                    <button type="button" onClick={onClose} style={closeButtonStyle}>✕</button>
                </div>

                <div style={listStyle}>
                    {isLoading && <div style={emptyStyle}>즐겨 찾는 셔틀을 불러오는 중이에요...</div>}
                    {!isLoading && items.length === 0 && (
                        <div style={emptyStyle}>즐겨찾기한 셔틀이 아직 없어요.</div>
                    )}
                    {!isLoading && items.map((item) => {
                        const itemKey = `${item.stationId}_${item.id}`;
                        const isSwipeOpened = openedSwipeKey === itemKey;
                        const canEditAction = !!user;
                        const reviewCountKey = buildReviewCountKey(item.stationId, item.id);
                        const latestReview = latestReviewByKey[reviewCountKey] || null;

                        return (
                            <div
                                key={itemKey}
                                style={swipeWrapperStyle}
                                onPointerDown={(event) => beginSwipe(itemKey, event)}
                                onPointerMove={moveSwipe}
                                onPointerUp={endSwipe}
                                onPointerCancel={endSwipe}
                            >
                                <div style={swipeActionRailStyle}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!canEditAction) {
                                                showToast('로그인 후 이용해 주세요.', 'info');
                                                return;
                                            }
                                            handleOpenEdit(item);
                                        }}
                                        style={swipeEditButtonStyle(!canEditAction)}
                                    >
                                        {canEditAction ? '수정' : '🔒 수정'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHistoryTargetShuttle(item);
                                            setIsHistoryModalOpen(true);
                                        }}
                                        style={swipeHistoryButtonStyle}
                                    >
                                        히스토리
                                    </button>
                                </div>

                                <div style={cardStyle(item.enable, isSwipeOpened)}>
                                    <div style={titleRowStyle}>
                                        <strong style={shuttleTitleStyle}>{item.name || '셔틀 정보'}</strong>
                                        <span style={badgeStyle(item.type)}>
                                            {item.type === 'work' ? '출근' : '퇴근'}
                                        </span>
                                        <span style={stationInlineStyle}>📍 {item.stationName || '정류장 정보'}</span>
                                        <div style={rightAlignContainerStyle}>
                                            {item.enable && (
                                                <span style={congestionBadgeStyle(item.congestion || '보통')}>
                                                    좌석 {item.congestion || '보통'}
                                                </span>
                                            )}
                                            <span style={timeStyle}>
                                                {item.enable
                                                    ? `${item.type === 'work' ? '승차' : '하차'} ${getDisplayTime(item) || '정보 없음'}`
                                                    : '운행 중단'}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={infoRowStyle}>
                                        <span style={companyTextStyle}>🏢 {item.company || '회사 정보 없음'}</span>
                                    </div>
                                    <div style={latestReviewRowStyle}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOpenedSwipeKey(null);
                                                setReviewTargetShuttle(item);
                                                setIsReviewsModalOpen(true);
                                            }}
                                            style={reviewEmojiButtonStyle}
                                            aria-label="탑승 후기 보기"
                                        >
                                            💬
                                        </button>
                                        {latestReview ? (
                                            <span style={latestReviewTextStyle}>
                                                <span style={latestReviewAuthorStyle}>{latestReview.userNickname}</span>
                                                <span>: {latestReview.content}</span>
                                            </span>
                                        ) : (
                                            <span style={latestReviewEmptyTextStyle}>첫 번째 탑승 후기를 남겨 보세요.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <EditRequestModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setTargetShuttle(null);
                }}
                onApplied={async () => {
                    await onDataChanged?.();
                    await reloadFavoriteItems();
                }}
                stationId={targetShuttle?.stationId}
                shuttle={targetShuttle}
                user={user}
                currentUserNickname={currentUserNickname}
            />
            <ShuttleReviewsModal
                isOpen={isReviewsModalOpen}
                onClose={() => setIsReviewsModalOpen(false)}
                stationName={reviewTargetShuttle?.stationName || '정류장 정보'}
                shuttle={reviewTargetShuttle}
                user={user}
                currentUserNickname={currentUserNickname}
                onReviewCountChanged={(stationId, shuttleId, nextCount) => {
                    const key = buildReviewCountKey(stationId, shuttleId);
                    if (!key) return;
                    if (nextCount <= 0) {
                        setLatestReviewByKey((prev) => ({ ...prev, [key]: null }));
                        return;
                    }
                    void fetchLatestShuttleReview(stationId, shuttleId)
                        .then((latest) => {
                            setLatestReviewByKey((prev) => ({
                                ...prev,
                                [key]: latest
                            }));
                        })
                        .catch((error) => {
                            console.error('최근 후기 동기화 실패:', error);
                        });
                }}
            />
            <ShuttleHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                shuttle={historyTargetShuttle}
                user={user}
            />
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
    justifyContent: 'space-between',
    alignItems: 'center',
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

const listStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingBottom: '8px'
};

const emptyStyle: React.CSSProperties = {
    padding: '28px 0',
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: '0.9rem'
};

const swipeWrapperStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '12px',
    touchAction: 'pan-y'
};

const swipeActionRailStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '148px',
    height: '100%',
    backgroundColor: '#EF4444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const swipeEditButtonStyle = (disabled: boolean): React.CSSProperties => ({
    width: '74px',
    height: '100%',
    border: 'none',
    background: disabled ? '#9CA3AF' : '#EF4444',
    color: '#FFFFFF',
    fontSize: '0.92rem',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.9 : 1,
    padding: 0
});

const swipeHistoryButtonStyle: React.CSSProperties = {
    width: '74px',
    height: '100%',
    border: 'none',
    background: '#E5E7EB',
    color: '#374151',
    fontSize: '0.86rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0
};

const cardStyle = (enabled: boolean, swipeOpened: boolean): React.CSSProperties => ({
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    backgroundColor: enabled ? '#F9FAFB' : '#F3F4F6',
    padding: '12px',
    transform: swipeOpened ? 'translateX(-148px)' : 'translateX(0)',
    transition: 'transform 0.2s ease'
});

const titleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
    flexWrap: 'wrap'
};

const shuttleTitleStyle: React.CSSProperties = {
    fontSize: 'clamp(14px, 3.5vw, 16px)',
    color: '#111827'
};

const stationInlineStyle: React.CSSProperties = {
    fontSize: 'clamp(12px, 3vw, 14px)',
    color: '#4B5563'
};

const rightAlignContainerStyle: React.CSSProperties = {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
};

const timeStyle: React.CSSProperties = {
    fontSize: 'clamp(12px, 3vw, 14px)',
    color: '#1F2937',
    fontWeight: 600
};

const congestionBadgeStyle = (status: string): React.CSSProperties => {
    let bgColor = '#E5E7EB';
    let textColor = '#374151';

    if (status === '여유') { bgColor = '#D1FAE5'; textColor = '#065F46'; }
    else if (status === '보통') { bgColor = '#FEF3C7'; textColor = '#92400E'; }
    else if (status === '부족') { bgColor = '#FEE2E2'; textColor = '#B91C1C'; }

    return {
        backgroundColor: bgColor,
        color: textColor,
        padding: '4px 8px',
        borderRadius: '12px',
        border: 'none',
        fontSize: 'clamp(11px, 2.8vw, 13px)',
        fontWeight: 'bold',
        whiteSpace: 'nowrap'
    };
};

const infoRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginTop: '4px'
};

const companyTextStyle: React.CSSProperties = {
    fontSize: 'clamp(12px, 3.1vw, 14px)',
    color: '#4B5563'
};

const badgeStyle = (type: 'work' | 'leave'): React.CSSProperties => ({
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '999px',
    backgroundColor: type === 'work' ? '#DBEAFE' : '#FEF3C7',
    color: type === 'work' ? '#1E40AF' : '#92400E'
});

const latestReviewRowStyle: React.CSSProperties = {
    marginTop: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
};

const reviewEmojiButtonStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    fontSize: '0.95rem',
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0
};

const latestReviewTextStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color: '#4B5563',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0
};

const latestReviewAuthorStyle: React.CSSProperties = {
    fontWeight: 700,
    color: '#374151'
};

const latestReviewEmptyTextStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color: '#9CA3AF',
    lineHeight: 1.4
};

export default FavoriteShuttlesModal;
