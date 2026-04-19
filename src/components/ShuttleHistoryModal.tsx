import React, { useEffect, useState } from 'react';
import { fetchShuttleHistories, getShuttlecockNickname, reportShuttleHistory } from '../services/shuttleService';
import { useFeedback } from './feedback/FeedbackProvider';

interface ShuttleHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    shuttle: {
        id: string;
        stationId?: string;
        name: string;
        company: string;
        type: 'work' | 'leave';
    } | null;
    user: any;
}

const ShuttleHistoryModal: React.FC<ShuttleHistoryModalProps> = ({
    isOpen,
    onClose,
    shuttle,
    user
}) => {
    const { showToast } = useFeedback();
    const [histories, setHistories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isOpen || !shuttle?.stationId) return;

        let isCancelled = false;
        setIsLoading(true);
        void fetchShuttleHistories(shuttle.stationId, shuttle.id)
            .then(async (items) => {
                const unresolvedUids = Array.from(
                    new Set(
                        items
                            .filter((item: any) => item.changedByUid && (!item.changedByNickname || item.changedByNickname === '익명'))
                            .map((item: any) => item.changedByUid)
                    )
                );

                const nicknameMap = new Map<string, string>();
                await Promise.all(
                    unresolvedUids.map(async (uid) => {
                        const nickname = await getShuttlecockNickname(uid, '익명');
                        nicknameMap.set(uid, nickname);
                    })
                );

                const hydratedItems = items.map((item: any) => {
                    if (item.changedByNickname && item.changedByNickname !== '익명') return item;
                    if (!item.changedByUid) return item;
                    return {
                        ...item,
                        changedByNickname: nicknameMap.get(item.changedByUid) || item.changedByNickname || '익명'
                    };
                });

                if (!isCancelled) {
                    setHistories(hydratedItems);
                }
            })
            .catch((error) => {
                console.error('히스토리 조회 실패:', error);
                if (!isCancelled) {
                    showToast('히스토리를 불러오는 중 문제가 생겼어요.', 'error');
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

    const getRelativeTime = (timestamp: any) => {
        if (!timestamp?.toDate) return '방금 전';
        const date = timestamp.toDate();
        const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
        if (diffSec < 60) return '방금 전';
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const isReportableWithin7Days = (timestamp: any) => {
        if (!timestamp?.toDate) return false;
        const createdAt = timestamp.toDate().getTime();
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        return now - createdAt <= sevenDaysMs;
    };

    const handleReport = async (history: any) => {
        if (!user) {
            showToast('신고는 로그인 후 이용할 수 있어요.', 'info');
            return;
        }
        if (!shuttle.stationId) return;

        const reportUserIds: string[] = Array.isArray(history.reportUserIds) ? history.reportUserIds : [];
        if (reportUserIds.includes(user.uid)) {
            showToast('이미 신고한 히스토리예요.', 'info');
            return;
        }

        setPendingIds((prev) => new Set(prev).add(history.id));
        try {
            const result = await reportShuttleHistory(shuttle.stationId, shuttle.id, history.id, user.uid);
            if (result.alreadyReported) {
                showToast('이미 신고한 히스토리예요.', 'info');
                return;
            }

            setHistories((prev) =>
                prev.map((item) =>
                    item.id === history.id
                        ? {
                            ...item,
                            reportUserIds: [...(item.reportUserIds || []), user.uid],
                            reportCount: result.reportCount
                        }
                        : item
                )
            );
            showToast('신고가 접수됐어요.', 'success');
        } catch (error) {
            console.error('히스토리 신고 실패:', error);
            showToast('신고 처리 중 문제가 생겼어요.', 'error');
        } finally {
            setPendingIds((prev) => {
                const next = new Set(prev);
                next.delete(history.id);
                return next;
            });
        }
    };

    return (
        <div style={overlayStyle}>
            <div style={contentStyle}>
                <div style={headerStyle}>
                    <h2 style={{ margin: 0, fontSize: '1.08rem', color: '#111827' }}>수정 히스토리</h2>
                    <button type="button" onClick={onClose} style={closeButtonStyle}>✕</button>
                </div>

                <div style={summaryCardStyle}>
                    <strong style={{ color: '#111827', fontSize: '0.98rem' }}>{shuttle.name}</strong>
                    <div style={summarySubTextStyle}>{shuttle.company} · {shuttle.type === 'work' ? '출근' : '퇴근'}</div>
                </div>

                <div style={listStyle}>
                    {isLoading && <div style={emptyTextStyle}>히스토리를 불러오는 중이에요...</div>}
                    {!isLoading && histories.length === 0 && (
                        <div style={emptyTextStyle}>아직 수정 히스토리가 없어요.</div>
                    )}

                    {!isLoading && histories.map((history) => {
                        const reportUserIds: string[] = Array.isArray(history.reportUserIds) ? history.reportUserIds : [];
                        const hasReported = !!user && reportUserIds.includes(user.uid);
                        const isPending = pendingIds.has(history.id);
                        const before = history.beforeData || {};
                        const after = history.afterData || {};
                        const isCreateHistory = history.historyType === 'CREATE' || history.beforeData == null;
                        const canShowReport = isReportableWithin7Days(history.createdAt);

                        return (
                            <div key={history.id} style={historyCardStyle}>
                                <div style={historyTopStyle}>
                                    <div style={historyActorWrapStyle}>
                                        <span style={historyTypeBadgeStyle(isCreateHistory)}>
                                            {isCreateHistory ? '등록' : '변경'}
                                        </span>
                                        <strong style={{ color: '#111827', fontSize: '0.9rem' }}>
                                            {history.changedByNickname || '익명'}
                                        </strong>
                                    </div>
                                    <div style={historyMetaRightStyle}>
                                        <span style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>{getRelativeTime(history.createdAt)}</span>
                                        {canShowReport && (
                                            <button
                                                type="button"
                                                onClick={() => void handleReport(history)}
                                                disabled={hasReported || isPending}
                                                style={sirenButtonStyle(hasReported || isPending)}
                                                aria-label={hasReported ? '이미 신고됨' : '히스토리 신고'}
                                            >
                                                🚨
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={historyBodyStyle}>
                                    {isCreateHistory ? (
                                        <>
                                            <div style={historyLineStyle}>
                                                승차 시간: {after.boardingTime || '-'}
                                            </div>
                                            <div style={historyLineStyle}>
                                                하차 시간: {after.alightingTime || '-'}
                                            </div>
                                            <div style={historyLineStyle}>
                                                혼잡도: {after.congestion || '-'}
                                            </div>
                                            <div style={historyLineStyle}>
                                                운행 상태: {after.enable === false ? '중단' : '정상'}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={historyLineStyle}>
                                                승차 시간: {before.boardingTime || '-'} → {after.boardingTime || '-'}
                                            </div>
                                            <div style={historyLineStyle}>
                                                하차 시간: {before.alightingTime || '-'} → {after.alightingTime || '-'}
                                            </div>
                                            <div style={historyLineStyle}>
                                                혼잡도: {before.congestion || '-'} → {after.congestion || '-'}
                                            </div>
                                            <div style={historyLineStyle}>
                                                운행 상태: {(before.enable === false ? '중단' : '정상')} → {(after.enable === false ? '중단' : '정상')}
                                            </div>
                                        </>
                                    )}
                                </div>

                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 5300,
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
    marginTop: '4px',
    color: '#6B7280',
    fontSize: '0.85rem'
};

const listStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
};

const historyCardStyle: React.CSSProperties = {
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    padding: '10px'
};

const historyTopStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px'
};
const historyActorWrapStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
};
const historyTypeBadgeStyle = (isCreate: boolean): React.CSSProperties => ({
    borderRadius: '999px',
    padding: '3px 8px',
    fontSize: '0.72rem',
    fontWeight: 700,
    backgroundColor: isCreate ? '#DCFCE7' : '#EDE9FE',
    color: isCreate ? '#166534' : '#5B21B6',
    whiteSpace: 'nowrap'
});
const historyMetaRightStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
};

const historyBodyStyle: React.CSSProperties = {
    marginTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
};

const historyLineStyle: React.CSSProperties = {
    fontSize: '0.84rem',
    color: '#4B5563'
};

const sirenButtonStyle = (disabled: boolean): React.CSSProperties => ({
    border: 'none',
    background: 'transparent',
    fontSize: '1.05rem',
    lineHeight: 1,
    padding: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1
});

const emptyTextStyle: React.CSSProperties = {
    padding: '16px 0',
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: '0.88rem'
};

export default ShuttleHistoryModal;
