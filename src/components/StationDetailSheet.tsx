import React, {useEffect, useRef, useState} from 'react';
import EditRequestModal from "../components/EditRequestModal";
import ShuttleReviewsModal from '../components/ShuttleReviewsModal';
import ShuttleHistoryModal from '../components/ShuttleHistoryModal';
import { useAuth } from '../hooks/useAuth';
import { useFeedback } from './feedback/FeedbackProvider';
import {
    buildFavoriteShuttleKey,
    fetchFavoriteShuttleKeys,
    fetchShuttleReviewCount,
    isUserEditRestricted,
    toggleFavoriteShuttle
} from '../services/shuttleService';

interface Shuttle {
    id: string;
    stationId?: string;
    name: string;
    company: string;
    boardingTime?: string;
    alightingTime?: string;
    destinationAddress?: string;
    destinationX?: number;
    destinationY?: number;
    time?: string;
    type: 'work' | 'leave';
    congestion: string;
    updatedAt?: any;
    updatedByNickname?: string;
    enable: boolean;
}

interface StationDetailSheetProps {
    isOpen: boolean;
    stationId?: string;
    resetKey?: number;
    stationName: string;
    shuttles: Shuttle[];
    onClose: () => void;
    onAddShuttle: () => void;
    onSelectShuttleRoute: (shuttle: Shuttle) => void;
    onDataChanged?: () => void | Promise<void>;
    currentUserNickname?: string;
}

const StationDetailSheet: React.FC<StationDetailSheetProps> = ({
                                                                   isOpen, stationId, resetKey, stationName, shuttles, onClose, onAddShuttle, onSelectShuttleRoute, onDataChanged, currentUserNickname
                                                               }) => {
    const COLLAPSED_PEEK_HEIGHT = 38;
    const getDefaultSheetHeight = () => {
        if (typeof window === 'undefined') return 360;
        const viewportHeight = window.innerHeight;
        const preferred = viewportHeight * 0.42;
        return Math.max(300, Math.min(460, Math.round(preferred)));
    };
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    const { user } = useAuth();
    const { showToast } = useFeedback();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [targetShuttle, setTargetShuttle] = useState<any>(null);
    const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
    const [reviewTargetShuttle, setReviewTargetShuttle] = useState<Shuttle | null>(null);
    const [reviewCountByKey, setReviewCountByKey] = useState<Record<string, number>>({});
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyTargetShuttle, setHistoryTargetShuttle] = useState<Shuttle | null>(null);
    const [isEditRestricted, setIsEditRestricted] = useState(false);
    const [favoriteShuttleKeys, setFavoriteShuttleKeys] = useState<Set<string>>(new Set());
    const [favoritePendingKeys, setFavoritePendingKeys] = useState<Set<string>>(new Set());
    const [companyFilter, setCompanyFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'work' | 'leave'>('all');
    const [congestionFilter, setCongestionFilter] = useState<'all' | '여유' | '보통' | '부족'>('all');
    const [draftCompanyFilter, setDraftCompanyFilter] = useState('all');
    const [draftTypeFilter, setDraftTypeFilter] = useState<'all' | 'work' | 'leave'>('all');
    const [draftCongestionFilter, setDraftCongestionFilter] = useState<'all' | '여유' | '보통' | '부족'>('all');
    const [sortMode, setSortMode] = useState<'time-asc' | 'time-desc' | 'updated-recent' | 'updated-old'>('time-asc');
    const [activePanel, setActivePanel] = useState<'none' | 'filter' | 'sort'>('none');
    const [sheetHeight, setSheetHeight] = useState<number | null>(null);
    const [isDraggingSheet, setIsDraggingSheet] = useState(false);
    const [openedSwipeKey, setOpenedSwipeKey] = useState<string | null>(null);
    const sheetRef = useRef<HTMLDivElement | null>(null);
    const dragStartYRef = useRef(0);
    const dragStartHeightRef = useRef(0);
    const dragCurrentHeightRef = useRef(0);
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

    const handleOpenEdit = (shuttle: any) => {
        if (!user) {
            showToast('수정은 로그인 후 이용할 수 있어요.', 'info');
            return;
        }
        if (isEditRestricted) {
            showToast('신고 누적으로 수정 기능이 제한되었어요.', 'error');
            return;
        }
        setTargetShuttle(shuttle);
        setIsEditModalOpen(true);
    };

    const buildReviewCountKey = (stationValue?: string, shuttleValue?: string) => {
        if (!stationValue || !shuttleValue) return '';
        return `${stationValue}_${shuttleValue}`;
    };

    const getUpdatedLabel = (timestamp: any, nickname?: string) => {
        if (!timestamp?.toDate) return `정보 없음${nickname ? ` · ${nickname}` : ''}`;
        const date = timestamp.toDate() as Date;
        const dateText = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ` +
            `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        return `${dateText} · ${nickname || '익명'}`;
    };

    const getTimeValue = (value: string) => {
        const [h = '0', m = '0'] = value.split(':');
        return Number(h) * 60 + Number(m);
    };

    const getDisplayTime = (shuttle: Shuttle) => {
        if (shuttle.type === 'work') {
            return shuttle.boardingTime || shuttle.time || '';
        }
        return shuttle.alightingTime || shuttle.time || '';
    };

    const getUpdatedTimeValue = (timestamp: any) => {
        if (!timestamp?.toDate) return 0;
        return timestamp.toDate().getTime();
    };

    const companies = Array.from(new Set(shuttles.map((shuttle) => shuttle.company))).sort();

    const applyFilters = (target: Shuttle[]) => target.filter((shuttle) => {
        const matchesCompany = companyFilter === 'all' || shuttle.company === companyFilter;
        const matchesType = typeFilter === 'all' || shuttle.type === typeFilter;
        const matchesCongestion = congestionFilter === 'all' || shuttle.congestion === congestionFilter;
        return matchesCompany && matchesType && matchesCongestion;
    });

    const applySort = (target: Shuttle[]) => [...target].sort((a, b) => {
        const timeDiff = getTimeValue(getDisplayTime(a)) - getTimeValue(getDisplayTime(b));
        const updatedDiff = getUpdatedTimeValue(a.updatedAt) - getUpdatedTimeValue(b.updatedAt);

        if (sortMode === 'time-asc') return timeDiff;
        if (sortMode === 'time-desc') return -timeDiff;
        if (sortMode === 'updated-recent') return updatedDiff !== 0 ? -updatedDiff : timeDiff;
        return updatedDiff !== 0 ? updatedDiff : timeDiff;
    });

    const selectedLocationBaseShuttles = stationId
        ? shuttles.filter((shuttle) => shuttle.stationId === stationId)
        : [];
    const selectedLocationShuttles = applySort(applyFilters(selectedLocationBaseShuttles));
    const nearbyBaseShuttles = stationId
        ? shuttles.filter((shuttle) => shuttle.stationId !== stationId)
        : shuttles;
    const nearbyShuttles = applySort(applyFilters(nearbyBaseShuttles));

    const appliedFilterCount =
        (companyFilter !== 'all' ? 1 : 0) +
        (typeFilter !== 'all' ? 1 : 0) +
        (congestionFilter !== 'all' ? 1 : 0);

    const openFilterPanel = () => {
        setDraftCompanyFilter(companyFilter);
        setDraftTypeFilter(typeFilter);
        setDraftCongestionFilter(congestionFilter);
        setActivePanel((prev) => (prev === 'filter' ? 'none' : 'filter'));
    };

    const handleSaveFilter = () => {
        setCompanyFilter(draftCompanyFilter);
        setTypeFilter(draftTypeFilter);
        setCongestionFilter(draftCongestionFilter);
        setActivePanel('none');
    };

    const sortTextMap = {
        'time-asc': '시간 빠른순',
        'time-desc': '시간 느린순',
        'updated-recent': '업데이트 빠른순',
        'updated-old': '업데이트 느린순'
    } as const;
    const sortText = sortTextMap[sortMode];
    const isCollapsed = sheetHeight !== null && sheetHeight <= COLLAPSED_PEEK_HEIGHT + 6;

    useEffect(() => {
        if (!isOpen) {
            setSheetHeight(null);
            setIsDraggingSheet(false);
            setOpenedSwipeKey(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setSheetHeight(getDefaultSheetHeight());
        setIsDraggingSheet(false);
        setActivePanel('none');
        setOpenedSwipeKey(null);
    }, [isOpen, stationId, resetKey]);

    useEffect(() => {
        if (!isOpen || !user) {
            setFavoriteShuttleKeys(new Set());
            return;
        }

        let isCancelled = false;
        void fetchFavoriteShuttleKeys(user.uid)
            .then((keys) => {
                if (!isCancelled) {
                    setFavoriteShuttleKeys(keys);
                }
            })
            .catch((error) => {
                console.error('즐겨찾기 조회 실패:', error);
            });

        return () => {
            isCancelled = true;
        };
    }, [isOpen, user]);

    useEffect(() => {
        if (!isOpen || !user) {
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
    }, [isOpen, user]);

    useEffect(() => {
        if (!isOpen) {
            setReviewCountByKey({});
            return;
        }

        const candidates = shuttles
            .filter((shuttle) => shuttle.stationId)
            .map((shuttle) => ({
                stationId: shuttle.stationId as string,
                shuttleId: shuttle.id
            }));

        if (!candidates.length) {
            setReviewCountByKey({});
            return;
        }

        let isCancelled = false;
        void Promise.all(
            candidates.map(async ({ stationId, shuttleId }) => {
                const count = await fetchShuttleReviewCount(stationId, shuttleId);
                return { key: buildReviewCountKey(stationId, shuttleId), count };
            })
        )
            .then((result) => {
                if (isCancelled) return;
                const nextMap: Record<string, number> = {};
                result.forEach((item) => {
                    nextMap[item.key] = item.count;
                });
                setReviewCountByKey(nextMap);
            })
            .catch((error) => {
                if (!isCancelled) {
                    console.error('탑승 후기 개수 조회 실패:', error);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [isOpen, shuttles]);

    useEffect(() => {
        if (!isDraggingSheet) return;

        const minHeight = COLLAPSED_PEEK_HEIGHT;
        const maxHeight = window.innerHeight;
        const defaultHeight = getDefaultSheetHeight();

        const handlePointerMove = (event: PointerEvent) => {
            const deltaY = dragStartYRef.current - event.clientY;
            const nextHeight = Math.min(maxHeight, Math.max(minHeight, dragStartHeightRef.current + deltaY));
            dragCurrentHeightRef.current = nextHeight;
            setSheetHeight(nextHeight);
        };

        const stopDragging = () => {
            if (dragCurrentHeightRef.current <= defaultHeight) {
                setSheetHeight(COLLAPSED_PEEK_HEIGHT);
                setActivePanel('none');
                setIsDraggingSheet(false);
                return;
            }
            const threshold = window.innerHeight * 0.7;
            if (dragCurrentHeightRef.current >= threshold) {
                setSheetHeight(window.innerHeight);
            }
            setIsDraggingSheet(false);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopDragging);
        window.addEventListener('pointercancel', stopDragging);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopDragging);
            window.removeEventListener('pointercancel', stopDragging);
        };
    }, [COLLAPSED_PEEK_HEIGHT, isDraggingSheet]);

    const handleStartDragSheet = (event: React.PointerEvent<HTMLElement>) => {
        if (!sheetRef.current) return;

        const target = event.target as HTMLElement | null;
        if (target?.closest('button, input, select, textarea, a, [data-no-sheet-drag="true"]')) {
            return;
        }

        if (isCollapsed) {
            setSheetHeight(getDefaultSheetHeight());
            setActivePanel('none');
            setIsDraggingSheet(false);
            return;
        }

        dragStartYRef.current = event.clientY;
        dragStartHeightRef.current = sheetRef.current.getBoundingClientRect().height;
        dragCurrentHeightRef.current = dragStartHeightRef.current;
        setIsDraggingSheet(true);
    };

    const handleToggleFavorite = async (shuttle: Shuttle) => {
        if (!user || !shuttle.stationId) return;

        const favoriteKey = buildFavoriteShuttleKey(shuttle.stationId, shuttle.id);
        if (favoritePendingKeys.has(favoriteKey)) return;

        setFavoritePendingKeys((prev) => new Set(prev).add(favoriteKey));

        try {
            const { isFavorite } = await toggleFavoriteShuttle(user.uid, shuttle);
            const shuttleName = shuttle.name?.trim() || '해당 셔틀';
            const lastCharCode = shuttleName.charCodeAt(shuttleName.length - 1);
            const hasBatchim =
                lastCharCode >= 0xac00 &&
                lastCharCode <= 0xd7a3 &&
                (lastCharCode - 0xac00) % 28 !== 0;
            const objectParticle = hasBatchim ? '을' : '를';

            setFavoriteShuttleKeys((prev) => {
                const next = new Set(prev);
                if (isFavorite) {
                    next.add(favoriteKey);
                } else {
                    next.delete(favoriteKey);
                }
                return next;
            });
            showToast(
                isFavorite
                    ? `${shuttleName}${objectParticle} 즐겨찾기에 추가했어요.`
                    : `${shuttleName}${objectParticle} 즐겨찾기에서 제거했어요.`,
                'success'
            );
        } catch (error) {
            console.error('즐겨찾기 토글 실패:', error);
            showToast('즐겨찾기 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.', 'error');
        } finally {
            setFavoritePendingKeys((prev) => {
                const next = new Set(prev);
                next.delete(favoriteKey);
                return next;
            });
        }
    };

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

    const renderShuttleItem = (shuttle: Shuttle, keyPrefix: string) => {
        const isEnabled = shuttle.enable !== false;
        const favoriteKey = shuttle.stationId ? buildFavoriteShuttleKey(shuttle.stationId, shuttle.id) : '';
        const isFavorite = favoriteKey ? favoriteShuttleKeys.has(favoriteKey) : false;
        const isFavoritePending = favoriteKey ? favoritePendingKeys.has(favoriteKey) : false;
        const itemKey = `${keyPrefix}-${shuttle.stationId || 'unknown'}-${shuttle.id}`;
        const isSwipeOpened = openedSwipeKey === itemKey;
        const reviewCountKey = buildReviewCountKey(shuttle.stationId, shuttle.id);
        const reviewCount = reviewCountByKey[reviewCountKey] ?? 0;

        return (
            <div
                key={itemKey}
                style={swipeWrapperStyle}
                data-no-sheet-drag="true"
                onPointerDown={(event) => beginSwipe(itemKey, event)}
                onPointerMove={moveSwipe}
                onPointerUp={endSwipe}
                onPointerCancel={endSwipe}
            >
                <div style={swipeActionRailStyle}>
                    <button
                        type="button"
                        onClick={() => {
                            handleOpenEdit(shuttle);
                        }}
                        style={swipeEditButtonStyle}
                    >
                        수정
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setHistoryTargetShuttle(shuttle);
                            setIsHistoryModalOpen(true);
                        }}
                        style={swipeHistoryButtonStyle}
                    >
                        히스토리
                    </button>
                </div>
                <div
                    style={{
                        ...shuttleItemStyle,
                        backgroundColor: isEnabled ? '#F9FAFB' : '#F3F4F6',
                        borderColor: isEnabled ? '#F3F4F6' : '#E5E7EB',
                        transform: isSwipeOpened ? 'translateX(-148px)' : 'translateX(0)',
                        transition: 'transform 0.2s ease'
                    }}
                >
                    {user && (
                        <div style={favoriteRailStyle}>
                        <button
                            type="button"
                            onClick={() => handleToggleFavorite(shuttle)}
                            disabled={isFavoritePending}
                            style={favoriteButtonStyle(isFavorite, isFavoritePending)}
                            aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                        >
                            {isFavorite ? '★' : '☆'}
                        </button>
                        </div>
                    )}
                    <div style={shuttleContentStyle}>
                        <div style={itemTopStyle}>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenedSwipeKey(null);
                                    onSelectShuttleRoute(shuttle);
                                    setActivePanel('none');
                                    setSheetHeight(COLLAPSED_PEEK_HEIGHT);
                                }}
                                style={shuttleTitleButtonStyle}
                            >
                                {shuttle.name}
                            </button>
                            <span style={typeBadgeStyle(shuttle.type)}>
                                {shuttle.type === 'work' ? '출근' : '퇴근'}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenedSwipeKey(null);
                                    setReviewTargetShuttle(shuttle);
                                    setIsReviewsModalOpen(true);
                                }}
                                style={reviewTriggerButtonStyle}
                            >
                                <span>💬</span>
                                <span>{reviewCount}</span>
                            </button>
                            <div style={rightAlignContainerStyle}>
                                {isEnabled && (
                                    <span style={congestionBadgeStyle(shuttle.congestion)}>
                                        좌석 {shuttle.congestion}
                                    </span>
                                )}
                                <span style={timeStyle}>
                                    {isEnabled ? `${shuttle.type === 'work' ? '승차' : '하차'} ${getDisplayTime(shuttle)}` : '운행 중단'}
                                </span>
                            </div>
                        </div>

                        {!isEnabled && (
                            <div style={suspendedBadgeStyle}>현재 운행하지 않는 셔틀입니다.</div>
                        )}

                        <div style={infoRowStyle}>
                            <span style={stationNameLabelStyle}>
                                <span style={{ marginRight: '6px', fontSize: '0.9rem' }}>🏢</span>
                                {shuttle.company}
                            </span>
                            <span style={timestampStyle}>
                                {getUpdatedLabel(shuttle.updatedAt, shuttle.updatedByNickname)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div style={sheetOverlayStyle}>
            <div
                ref={sheetRef}
                onPointerDown={handleStartDragSheet}
                style={sheetContentStyle(sheetHeight, isCollapsed)}
            >
                <div
                    onPointerDown={handleStartDragSheet}
                    style={{ ...handleStyle, marginBottom: isCollapsed ? 0 : 15 }}
                ></div>

                {!isCollapsed && (
                    <>
                        <div style={headerStyle}>
                            <div style={headerTitleWrapStyle}>
                                <h2 style={{ fontSize: isMobile ? '1.05rem' : '1.2rem', margin: 0, whiteSpace: 'nowrap' }}>📍 {stationName}</h2>
                                {user && (
                                    <button onClick={onAddShuttle} style={addShuttleButtonStyle(isMobile)}>+ 셔틀 추가</button>
                                )}
                            </div>
                            <button onClick={onClose} style={closeButtonStyle}>✕</button>
                        </div>

                        <div style={toolbarContainerStyle}>
                            <div style={toolbarStyle}>
                                <button
                                    onClick={openFilterPanel}
                                    style={filterDropdownStyle(activePanel === 'filter', isMobile)}
                                >
                                    <span>필터</span>
                                    {appliedFilterCount > 0 && <span style={filterCountBadgeStyle}>{appliedFilterCount}</span>}
                                </button>
                                <button
                                    onClick={() => setActivePanel((prev) => (prev === 'sort' ? 'none' : 'sort'))}
                                    style={sortDropdownStyle(activePanel === 'sort', isMobile)}
                                >
                                    <span>{sortText}</span>
                                    <span style={dropdownArrowStyle(activePanel === 'sort')}>▾</span>
                                </button>
                            </div>

                            {activePanel === 'filter' && (
                            <div style={filterDropdownPanelStyle}>
                                <div style={controlItemStyle}>
                                    <label style={controlLabelStyle}>회사</label>
                                    <select
                                        value={draftCompanyFilter}
                                        onChange={(e) => setDraftCompanyFilter(e.target.value)}
                                        style={controlSelectStyle}
                                    >
                                        <option value="all">전체</option>
                                        {companies.map((company) => (
                                            <option key={company} value={company}>{company}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={controlItemStyle}>
                                    <label style={controlLabelStyle}>운행 종류</label>
                                    <select
                                        value={draftTypeFilter}
                                        onChange={(e) => setDraftTypeFilter(e.target.value as 'all' | 'work' | 'leave')}
                                        style={controlSelectStyle}
                                    >
                                        <option value="all">전체</option>
                                        <option value="work">출근</option>
                                        <option value="leave">퇴근</option>
                                    </select>
                                </div>
                                <div style={controlItemStyle}>
                                    <label style={controlLabelStyle}>혼잡도</label>
                                    <select
                                        value={draftCongestionFilter}
                                        onChange={(e) => setDraftCongestionFilter(e.target.value as 'all' | '여유' | '보통' | '부족')}
                                        style={controlSelectStyle}
                                    >
                                        <option value="all">전체</option>
                                        <option value="여유">여유</option>
                                        <option value="보통">보통</option>
                                        <option value="부족">부족</option>
                                    </select>
                                </div>
                                <div style={panelActionStyle}>
                                    <button
                                        onClick={() => {
                                            setDraftCompanyFilter('all');
                                            setDraftTypeFilter('all');
                                            setDraftCongestionFilter('all');
                                        }}
                                        style={resetButtonStyle(isMobile)}
                                    >
                                        필터 초기화
                                    </button>
                                    <button onClick={handleSaveFilter} style={saveFilterButtonStyle(isMobile)}>
                                        저장
                                    </button>
                                </div>
                            </div>
                            )}

                            {activePanel === 'sort' && (
                            <div style={sortDropdownPanelStyle}>
                                <button
                                    onClick={() => {
                                        setSortMode('time-asc');
                                        setActivePanel('none');
                                    }}
                                    style={sortChoiceStyle(sortMode === 'time-asc', isMobile)}
                                >
                                    시간 빠른순
                                </button>
                                <button
                                    onClick={() => {
                                        setSortMode('time-desc');
                                        setActivePanel('none');
                                    }}
                                    style={sortChoiceStyle(sortMode === 'time-desc', isMobile)}
                                >
                                    시간 느린순
                                </button>
                                <button
                                    onClick={() => {
                                        setSortMode('updated-recent');
                                        setActivePanel('none');
                                    }}
                                    style={sortChoiceStyle(sortMode === 'updated-recent', isMobile)}
                                >
                                    업데이트 빠른순
                                </button>
                                <button
                                    onClick={() => {
                                        setSortMode('updated-old');
                                        setActivePanel('none');
                                    }}
                                    style={sortChoiceStyle(sortMode === 'updated-old', isMobile)}
                                >
                                    업데이트 느린순
                                </button>
                            </div>
                            )}
                        </div>

                        <div style={listContainerStyle}>
                            <section style={sectionStyle}>
                                <h3 style={sectionTitleStyle}>선택된 위치에서 운행하는 셔틀</h3>
                                <div style={sectionListStyle}>
                                    {selectedLocationShuttles.map((shuttle) => renderShuttleItem(shuttle, 'selected'))}
                                    {selectedLocationShuttles.length === 0 && (
                                        <div style={emptyStateStyle}>현재 조건에 맞는 셔틀 정보가 없습니다.</div>
                                    )}
                                </div>
                            </section>

                            <section style={sectionStyle}>
                                <h3 style={sectionTitleStyle}>반경 200m 이내에서 운행하는 셔틀</h3>
                                <div style={sectionListStyle}>
                                    {nearbyShuttles.map((shuttle) => renderShuttleItem(shuttle, 'nearby'))}
                                    {nearbyShuttles.length === 0 && (
                                        <div style={emptyStateStyle}>현재 조건에 맞는 셔틀 정보가 없습니다.</div>
                                    )}
                                </div>
                            </section>
                        </div>

                        <EditRequestModal
                            isOpen={isEditModalOpen}
                            onClose={() => {
                                setIsEditModalOpen(false);
                                setTargetShuttle(null);
                            }}
                            onApplied={onDataChanged}
                            stationId={targetShuttle?.stationId || stationId}
                            shuttle={targetShuttle}
                            user={user}
                            currentUserNickname={currentUserNickname}
                        />
                        <ShuttleReviewsModal
                            isOpen={isReviewsModalOpen}
                            onClose={() => setIsReviewsModalOpen(false)}
                            stationName={stationName}
                            shuttle={reviewTargetShuttle}
                            user={user}
                            currentUserNickname={currentUserNickname}
                            onReviewCountChanged={(targetStationId, targetShuttleId, nextCount) => {
                                const key = buildReviewCountKey(targetStationId, targetShuttleId);
                                if (!key) return;
                                setReviewCountByKey((prev) => ({
                                    ...prev,
                                    [key]: nextCount
                                }));
                            }}
                        />
                        <ShuttleHistoryModal
                            isOpen={isHistoryModalOpen}
                            onClose={() => setIsHistoryModalOpen(false)}
                            shuttle={historyTargetShuttle}
                            user={user}
                        />
                    </>
                )}
            </div>
        </div>
    );
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
        padding: '4px 10px',
        borderRadius: '12px',
        border: 'none',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        whiteSpace: 'nowrap'
    };
};

const itemTopStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' };
const swipeWrapperStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '12px'
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
const swipeEditButtonStyle: React.CSSProperties = {
    width: '74px',
    height: '100%',
    border: 'none',
    background: '#EF4444',
    color: '#FFFFFF',
    fontSize: '0.92rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0
};
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
const favoriteRailStyle: React.CSSProperties = {
    width: '46px',
    minWidth: '46px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '8px 0'
};
const favoriteButtonStyle = (isFavorite: boolean, disabled: boolean): React.CSSProperties => ({
    width: '36px',
    height: '36px',
    border: 'none',
    background: 'transparent',
    color: isFavorite ? '#8B5CF6' : '#9CA3AF',
    fontSize: '1.5rem',
    lineHeight: 1,
    padding: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1
});
const reviewTriggerButtonStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: '#4B5563',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0 2px'
};
const rightAlignContainerStyle: React.CSSProperties = { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' };
const infoRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' };
const stationNameLabelStyle: React.CSSProperties = { fontSize: '0.9rem', color: '#4B5563' };
const timestampStyle: React.CSSProperties = { fontSize: '0.8rem', color: '#9CA3AF' };
const sheetOverlayStyle: React.CSSProperties = { position: 'fixed', bottom: 0, left: 0, width: '100%', height: 'auto', zIndex: 3000 };
const sheetContentStyle = (height: number | null, isCollapsed: boolean): React.CSSProperties => ({
    backgroundColor: 'white',
    borderRadius: '20px 20px 0 0',
    padding: isCollapsed ? '10px 14px 8px' : '15px 20px 30px',
    boxShadow: '0 -5px 20px rgba(0,0,0,0.1)',
    height: height ? `${height}px` : 'auto',
    maxHeight: '100vh',
    overflowY: isCollapsed ? 'hidden' : 'auto',
    transition: height ? 'none' : 'height 0.2s ease'
});
const handleStyle: React.CSSProperties = {
    width: '48px',
    height: '6px',
    backgroundColor: '#E5E7EB',
    borderRadius: '10px',
    margin: '0 auto',
    cursor: 'ns-resize',
    touchAction: 'none'
};
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const headerTitleWrapStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 };
const toolbarContainerStyle: React.CSSProperties = { position: 'relative', marginBottom: '10px' };
const toolbarStyle: React.CSSProperties = { display: 'flex', gap: '8px' };
const filterDropdownStyle = (active: boolean, isMobile: boolean): React.CSSProperties => ({
    border: '1px solid #D1D5DB',
    borderRadius: '10px',
    backgroundColor: active ? '#EEF2FF' : '#FFFFFF',
    color: active ? '#4338CA' : '#374151',
    padding: isMobile ? '8px 10px' : '9px 12px',
    fontSize: isMobile ? '0.82rem' : '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: isMobile ? '36px' : '40px',
    whiteSpace: 'nowrap'
});
const filterCountBadgeStyle: React.CSSProperties = {
    width: '18px',
    height: '18px',
    borderRadius: '999px',
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    fontSize: '0.72rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
};
const dropdownArrowStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    width: '12px',
    justifyContent: 'center',
    fontSize: '0.78rem',
    color: '#6B7280',
    lineHeight: 1,
    transform: active ? 'rotate(180deg)' : 'rotate(0deg)',
    transformOrigin: '50% 50%',
    transition: 'transform 0.18s ease'
});
const sortDropdownStyle = (active: boolean, isMobile: boolean): React.CSSProperties => ({
    border: 'none',
    borderRadius: '10px',
    backgroundColor: active ? '#EEF2FF' : 'transparent',
    color: active ? '#4338CA' : '#374151',
    padding: isMobile ? '8px 10px' : '9px 12px',
    fontSize: isMobile ? '0.82rem' : '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: isMobile ? '36px' : '40px',
    marginLeft: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap'
});
const filterDropdownPanelStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    position: 'absolute',
    top: '46px',
    left: 0,
    width: 'min(100%, 420px)',
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
    zIndex: 20
};
const controlItemStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '5px' };
const controlLabelStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#6B7280', fontWeight: 700 };
const controlSelectStyle: React.CSSProperties = {
    appearance: 'none',
    WebkitAppearance: 'none',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    color: '#111827',
    padding: '8px 10px',
    fontSize: '0.84rem',
    outline: 'none'
};
const panelActionStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: '8px' };
const resetButtonStyle = (isMobile: boolean): React.CSSProperties => ({
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    color: '#4B5563',
    padding: isMobile ? '7px 9px' : '8px 10px',
    fontSize: isMobile ? '0.76rem' : '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
});
const saveFilterButtonStyle = (isMobile: boolean): React.CSSProperties => ({
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    padding: isMobile ? '7px 10px' : '8px 12px',
    fontSize: isMobile ? '0.78rem' : '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
});
const sortDropdownPanelStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
    position: 'absolute',
    top: '46px',
    right: 0,
    width: 'min(100%, 320px)',
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
    zIndex: 20
};
const sortChoiceStyle = (active: boolean, isMobile: boolean): React.CSSProperties => ({
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    backgroundColor: active ? '#EEF2FF' : '#FFFFFF',
    color: active ? '#4338CA' : '#4B5563',
    padding: isMobile ? '7px 9px' : '8px 12px',
    fontSize: isMobile ? '0.76rem' : '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
});
const addShuttleButtonStyle = (isMobile: boolean): React.CSSProperties => ({
    border: 'none',
    borderRadius: '999px',
    backgroundColor: '#EEF2FF',
    color: '#8B5CF6',
    padding: isMobile ? '5px 8px' : '6px 10px',
    fontSize: isMobile ? '0.72rem' : '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap'
});
const closeButtonStyle: React.CSSProperties = { background: 'none', border: 'none', fontSize: '1.5rem', color: '#9CA3AF', cursor: 'pointer' };
const listContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px' };
const sectionStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px' };
const sectionTitleStyle: React.CSSProperties = {
    margin: '10px 0',
    fontSize: '16px',
    fontWeight: 700,
    color: '#1F2937'
};
const sectionListStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '10px' };
const shuttleItemStyle: React.CSSProperties = {
    padding: '0',
    borderRadius: '12px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #F3F4F6',
    display: 'flex',
    alignItems: 'stretch'
};
const shuttleContentStyle: React.CSSProperties = { flex: 1, padding: '15px' };
const shuttleTitleStyle: React.CSSProperties = { fontWeight: 'bold', color: '#1F2937', fontSize: '1rem' };
const shuttleTitleButtonStyle: React.CSSProperties = {
    ...shuttleTitleStyle,
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    textAlign: 'left'
};
const typeBadgeStyle = (type: string): React.CSSProperties => ({ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: type === 'work' ? '#DBEAFE' : '#FEF3C7', color: type === 'work' ? '#1E40AF' : '#92400E', whiteSpace: 'nowrap' });
const timeStyle: React.CSSProperties = { fontSize: '0.9rem', color: '#6B7280', marginLeft: 'auto', whiteSpace: 'nowrap' };
const suspendedBadgeStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#EF4444', marginTop: '5px', fontWeight: 'bold' };
const emptyStateStyle: React.CSSProperties = { textAlign: 'center', color: '#9CA3AF', fontSize: '0.9rem', padding: '16px 0' };

export default StationDetailSheet;
