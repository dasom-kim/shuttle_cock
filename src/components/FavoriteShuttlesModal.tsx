import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import EditRequestModal from './EditRequestModal';
import ShuttleReviewsModal from './ShuttleReviewsModal';
import ShuttleHistoryModal from './ShuttleHistoryModal';
import { useFeedback } from './feedback/FeedbackProvider';
import {
  buildFavoriteShuttleKey,
  fetchAllStations,
  fetchFavoriteShuttleOrderItems,
  fetchLatestShuttleReview,
  isUserEditRestricted,
  updateFavoriteShuttleOrder
} from '../services/shuttleService';

interface FavoriteShuttlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  currentUserNickname?: string;
  onDataChanged?: () => void | Promise<void>;
}

interface FavoriteShuttleViewItem {
  favoriteKey: string;
  id: string;
  stationId: string;
  name: string;
  company: string;
  type: 'work' | 'leave';
  boardingTime?: string;
  alightingTime?: string;
  congestion?: string;
  enable: boolean;
  stationName: string;
}

type LatestReviewMap = Record<string, { content: string; userNickname: string } | null>;

const FavoriteShuttlesModal: React.FC<FavoriteShuttlesModalProps> = ({
  isOpen,
  onClose,
  user,
  currentUserNickname,
  onDataChanged
}) => {
  const COLLAPSED_PEEK_HEIGHT = 38;
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const { showToast } = useFeedback();

  const getDefaultSheetHeight = () => {
    if (typeof window === 'undefined') return 360;
    const viewportHeight = window.innerHeight;
    const preferred = viewportHeight * 0.42;
    return Math.max(300, Math.min(460, Math.round(preferred)));
  };

  const [items, setItems] = useState<FavoriteShuttleViewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [latestReviewByKey, setLatestReviewByKey] = useState<LatestReviewMap>({});

  const [isEditRestricted, setIsEditRestricted] = useState(false);
  const [openedSwipeKey, setOpenedSwipeKey] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [targetShuttle, setTargetShuttle] = useState<FavoriteShuttleViewItem | null>(null);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [reviewTargetShuttle, setReviewTargetShuttle] = useState<FavoriteShuttleViewItem | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTargetShuttle, setHistoryTargetShuttle] = useState<FavoriteShuttleViewItem | null>(null);

  const [sheetHeight, setSheetHeight] = useState<number | null>(null);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  const [isOrderEditEnabled, setIsOrderEditEnabled] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [activeReorderKey, setActiveReorderKey] = useState<string | null>(null);
  const [reorderDragOffsetY, setReorderDragOffsetY] = useState(0);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const dragCurrentHeightRef = useRef(0);
  const dragMovedRef = useRef(false);

  const longPressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ key: string; x: number; y: number } | null>(null);
  const reorderStartOrderRef = useRef<string[]>([]);
  const reorderStartYRef = useRef(0);
  const itemElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevItemRectsRef = useRef<Map<string, DOMRect>>(new Map());

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
    if (shuttle.type === 'work') return shuttle.boardingTime || '';
    return shuttle.alightingTime || '';
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const captureCurrentItemRects = () => {
    const nextRects = new Map<string, DOMRect>();
    itemElementRefs.current.forEach((el, key) => {
      nextRects.set(key, el.getBoundingClientRect());
    });
    prevItemRectsRef.current = nextRects;
  };

  const reloadFavoriteItems = useCallback(async () => {
    if (!user?.uid) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    try {
      const [favoriteOrderItems, stations] = await Promise.all([
        fetchFavoriteShuttleOrderItems(user.uid),
        fetchAllStations()
      ]);

      const orderMap = new Map<string, number>();
      favoriteOrderItems.forEach((item) => orderMap.set(item.favoriteKey, item.sortOrder));

      const flattened = stations.flatMap((station: any) =>
        (station.shuttles || []).map((shuttle: any) => ({
          favoriteKey: buildFavoriteShuttleKey(shuttle.stationId || station.id, shuttle.id),
          id: shuttle.id,
          stationId: shuttle.stationId || station.id,
          name: shuttle.name || '',
          company: shuttle.company || '',
          type: shuttle.type === 'leave' ? 'leave' : 'work',
          boardingTime: shuttle.boardingTime || shuttle.time || '',
          alightingTime: shuttle.alightingTime || shuttle.time || '',
          congestion: shuttle.congestion || '보통',
          enable: shuttle.enable !== false,
          stationName: station.stationName || '정류장 정보'
        }))
      ) as FavoriteShuttleViewItem[];

      const filtered = flattened
        .filter((item) => orderMap.has(item.favoriteKey))
        .sort((a, b) => (orderMap.get(a.favoriteKey) || 0) - (orderMap.get(b.favoriteKey) || 0));

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
    if (!isOpen) {
      setSheetHeight(null);
      setIsDraggingSheet(false);
      setOpenedSwipeKey(null);
      setIsOrderEditEnabled(false);
      setIsReordering(false);
      setActiveReorderKey(null);
      setReorderDragOffsetY(0);
      return;
    }

    setSheetHeight(getDefaultSheetHeight());
    setIsDraggingSheet(false);
    setOpenedSwipeKey(null);
    setIsOrderEditEnabled(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !user?.uid) {
      setIsEditRestricted(false);
      return;
    }

    let isCancelled = false;
    void isUserEditRestricted(user.uid)
      .then((restricted) => {
        if (!isCancelled) setIsEditRestricted(restricted);
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

    const candidates = items
      .filter((item) => item.stationId && item.id)
      .map((item) => ({ stationId: item.stationId, shuttleId: item.id }));

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
        const nextMap: LatestReviewMap = {};
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

  useEffect(() => () => clearLongPress(), []);

  useLayoutEffect(() => {
    if (!isReordering) return;
    if (!prevItemRectsRef.current.size) return;

    itemElementRefs.current.forEach((el, key) => {
      if (key === activeReorderKey) return;
      const prevRect = prevItemRectsRef.current.get(key);
      if (!prevRect) return;

      const nextRect = el.getBoundingClientRect();
      const deltaY = prevRect.top - nextRect.top;
      if (Math.abs(deltaY) < 0.5) return;

      el.style.transition = 'none';
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = 'translateY(0)';
      });
    });
  }, [items, isReordering, activeReorderKey]);

  const isCollapsed = sheetHeight !== null && sheetHeight <= COLLAPSED_PEEK_HEIGHT + 6;

  useEffect(() => {
    if (!isDraggingSheet) return;

    const minHeight = COLLAPSED_PEEK_HEIGHT;
    const maxHeight = window.innerHeight;
    const defaultHeight = getDefaultSheetHeight();

    const getSnapLevel = (height: number) => {
      const anchors = [
        { level: 'collapsed' as const, value: COLLAPSED_PEEK_HEIGHT },
        { level: 'default' as const, value: defaultHeight },
        { level: 'full' as const, value: maxHeight }
      ];
      return anchors.reduce((closest, current) =>
        Math.abs(current.value - height) < Math.abs(closest.value - height) ? current : closest
      ).level;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const deltaY = dragStartYRef.current - event.clientY;
      if (Math.abs(deltaY) > 4) dragMovedRef.current = true;
      if (!dragMovedRef.current) return;

      const nextHeight = Math.min(maxHeight, Math.max(minHeight, dragStartHeightRef.current + deltaY));
      dragCurrentHeightRef.current = nextHeight;
      setSheetHeight(nextHeight);
    };

    const stopDragging = () => {
      if (!dragMovedRef.current) {
        setIsDraggingSheet(false);
        return;
      }

      const startHeight = dragStartHeightRef.current;
      const endHeight = dragCurrentHeightRef.current;
      const delta = endHeight - startHeight;
      const movementThreshold = 8;
      const startLevel = getSnapLevel(startHeight);

      if (Math.abs(delta) < movementThreshold) {
        if (startLevel === 'full') setSheetHeight(maxHeight);
        else if (startLevel === 'default') setSheetHeight(defaultHeight);
        else setSheetHeight(COLLAPSED_PEEK_HEIGHT);
        setIsDraggingSheet(false);
        return;
      }

      if (delta > 0) {
        if (startLevel === 'collapsed') setSheetHeight(defaultHeight);
        else setSheetHeight(maxHeight);
      } else {
        if (startLevel === 'full') setSheetHeight(defaultHeight);
        else setSheetHeight(COLLAPSED_PEEK_HEIGHT);
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
  }, [isDraggingSheet]);

  useEffect(() => {
    if (!isReordering || !activeReorderKey) return;

    const handlePointerMove = (event: PointerEvent) => {
      setReorderDragOffsetY(event.clientY - reorderStartYRef.current);
      captureCurrentItemRects();
      setItems((prev) => {
        const fromIndex = prev.findIndex((item) => item.favoriteKey === activeReorderKey);
        if (fromIndex < 0) return prev;

        const keyToMidY = new Map<string, number>();
        prev.forEach((item) => {
          const el = document.querySelector(`[data-fav-item-key="${item.favoriteKey}"]`) as HTMLElement | null;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          keyToMidY.set(item.favoriteKey, rect.top + rect.height / 2);
        });

        let nextIndex = 0;
        for (let i = 0; i < prev.length; i += 1) {
          const item = prev[i];
          if (item.favoriteKey === activeReorderKey) continue;
          const midY = keyToMidY.get(item.favoriteKey);
          if (midY === undefined) continue;
          if (event.clientY > midY) {
            nextIndex = i + 1;
          }
        }

        let insertIndex = nextIndex;
        if (insertIndex > fromIndex) {
          insertIndex -= 1;
        }
        if (insertIndex === fromIndex) {
          return prev;
        }

        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(insertIndex, 0, moved);
        return next;
      });
      event.preventDefault();
    };

    const finishReorder = () => {
      setIsReordering(false);
      const before = reorderStartOrderRef.current.join('|');
      const nextOrder = items.map((item) => item.favoriteKey);
      const after = nextOrder.join('|');
      setActiveReorderKey(null);
      setReorderDragOffsetY(0);

      if (before !== after && user?.uid) {
        void updateFavoriteShuttleOrder(user.uid, nextOrder).catch((error) => {
          console.error('즐겨찾기 순서 저장 실패:', error);
          showToast('순서 저장 중 문제가 생겼어요.', 'error');
        });
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishReorder);
    window.addEventListener('pointercancel', finishReorder);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishReorder);
      window.removeEventListener('pointercancel', finishReorder);
    };
  }, [isReordering, activeReorderKey, items, showToast, user?.uid]);

  const handleStartDragSheet = (event: React.PointerEvent<HTMLElement>) => {
    if (!sheetRef.current) return;
    if (isReordering) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, select, textarea, a, [data-swipe-item="true"]')) {
      return;
    }

    if (isCollapsed) {
      setSheetHeight(getDefaultSheetHeight());
      setIsDraggingSheet(false);
      return;
    }

    dragStartYRef.current = event.clientY;
    dragStartHeightRef.current = sheetRef.current.getBoundingClientRect().height;
    dragCurrentHeightRef.current = dragStartHeightRef.current;
    dragMovedRef.current = false;
    setIsDraggingSheet(true);
  };

  const beginSwipe = (itemKey: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (isReordering) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, select, textarea, a')) return;

    swipeStateRef.current = {
      key: itemKey,
      startX: event.clientX,
      startY: event.clientY,
      lastDx: 0,
      tracking: true
    };

    if (isOrderEditEnabled) return;
  };

  const moveSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isReordering) return;

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
    if (isReordering) return;

    const state = swipeStateRef.current;
    if (!state.tracking || !state.key) return;

    if (state.lastDx <= -36) setOpenedSwipeKey(state.key);
    else if (state.lastDx >= 24) setOpenedSwipeKey(null);

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

  const startReorderPress = (favoriteKey: string, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isOrderEditEnabled || isReordering) return;
    event.preventDefault();
    event.stopPropagation();

    pressStartRef.current = { key: favoriteKey, x: event.clientX, y: event.clientY };
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      reorderStartOrderRef.current = items.map((item) => item.favoriteKey);
      reorderStartYRef.current = event.clientY;
      setReorderDragOffsetY(0);
      setOpenedSwipeKey(null);
      setIsReordering(true);
      setActiveReorderKey(favoriteKey);
      swipeStateRef.current = {
        key: null,
        startX: 0,
        startY: 0,
        lastDx: 0,
        tracking: false
      };
      pressStartRef.current = null;
    }, 10);
  };

  const moveReorderPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isOrderEditEnabled || isReordering || !pressStartRef.current) return;
    const movedX = Math.abs(event.clientX - pressStartRef.current.x);
    const movedY = Math.abs(event.clientY - pressStartRef.current.y);
    if (movedX > 8 || movedY > 8) {
      clearLongPress();
      pressStartRef.current = null;
    }
  };

  const endReorderPress = () => {
    if (isReordering) return;
    clearLongPress();
    pressStartRef.current = null;
  };

  if (!isOpen) return null;

  const isActiveReorderItem = (favoriteKey: string) => isReordering && activeReorderKey === favoriteKey;

  return (
    <div style={sheetOverlayStyle}>
      <div
        ref={sheetRef}
        onPointerDown={handleStartDragSheet}
        style={sheetContentStyle(sheetHeight, isCollapsed, isDraggingSheet)}
      >
        <div onPointerDown={handleStartDragSheet} style={{ ...handleStyle, marginBottom: isCollapsed ? 0 : 12 }} />

        {!isCollapsed && (
          <>
            <div style={headerStyle}>
              <h2 style={{ margin: 0, fontSize: isMobile ? '1.05rem' : '1.2rem', whiteSpace: 'nowrap', color: '#111827' }}>⭐️ 즐겨찾기</h2>
              <div style={headerActionsStyle}>
                <button
                  type="button"
                  onClick={() => {
                    setIsOrderEditEnabled((prev) => {
                      const next = !prev;
                      if (!next) {
                        clearLongPress();
                        setIsReordering(false);
                        setActiveReorderKey(null);
                        setReorderDragOffsetY(0);
                      }
                      return next;
                    });
                  }}
                  style={orderEditButtonStyle(isOrderEditEnabled)}
                >
                  {isOrderEditEnabled ? '편집 완료' : '순서 편집'}
                </button>
                <button type="button" onClick={onClose} style={closeButtonStyle}>✕</button>
              </div>
            </div>

            <div style={listStyle}>
              {isLoading && <div style={emptyStyle}>즐겨 찾는 셔틀을 불러오는 중이에요...</div>}
              {!isLoading && items.length === 0 && <div style={emptyStyle}>즐겨찾기한 셔틀이 아직 없어요.</div>}

              {!isLoading && items.map((item) => {
                const itemKey = `${item.stationId}_${item.id}`;
                const isSwipeOpened = openedSwipeKey === itemKey;
                const canEditAction = !!user;
                const reviewCountKey = buildReviewCountKey(item.stationId, item.id);
                const latestReview = latestReviewByKey[reviewCountKey] || null;

                return (
                  <div
                    key={itemKey}
                    ref={(el) => {
                      if (el) itemElementRefs.current.set(item.favoriteKey, el);
                      else itemElementRefs.current.delete(item.favoriteKey);
                    }}
                    style={swipeWrapperStyle(
                      isActiveReorderItem(item.favoriteKey),
                      isActiveReorderItem(item.favoriteKey) ? reorderDragOffsetY : 0
                    )}
                    data-swipe-item="true"
                    data-fav-item-key={item.favoriteKey}
                    onPointerDown={(event) => beginSwipe(itemKey, event)}
                    onPointerMove={moveSwipe}
                    onPointerUp={endSwipe}
                    onPointerCancel={endSwipe}
                  >
                    {!isReordering && (
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
                    )}

                    <div
                      style={cardStyle(
                        item.enable,
                        isSwipeOpened,
                        isActiveReorderItem(item.favoriteKey),
                        isReordering
                      )}
                    >
                      <div style={cardInnerStyle}>
                        {isOrderEditEnabled && (
                          <div style={reorderHandleRailStyle}>
                            <button
                              type="button"
                              onPointerDown={(event) => startReorderPress(item.favoriteKey, event)}
                              onPointerMove={moveReorderPress}
                              onPointerUp={endReorderPress}
                              onPointerCancel={endReorderPress}
                              style={reorderHandleButtonStyle(isActiveReorderItem(item.favoriteKey))}
                              aria-label="순서 변경 핸들"
                            >
                              ☰
                            </button>
                          </div>
                        )}
                        <div style={cardMainStyle}>
                          <div style={titleRowStyle}>
                            <strong style={shuttleTitleStyle}>{item.name || '셔틀 정보'}</strong>
                            <span style={badgeStyle(item.type)}>{item.type === 'work' ? '출근' : '퇴근'}</span>
                            <span style={stationInlineStyle}>📍 {item.stationName || '정류장 정보'}</span>
                            <div style={rightAlignContainerStyle}>
                              {item.enable && (
                                <span style={congestionBadgeStyle(item.congestion || '보통')}>좌석 {item.congestion || '보통'}</span>
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
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
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
              setLatestReviewByKey((prev) => ({ ...prev, [key]: latest }));
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

const sheetOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  width: '100%',
  height: 'auto',
  zIndex: 3000,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end'
};

const sheetContentStyle = (height: number | null, isCollapsed: boolean, isDragging: boolean): React.CSSProperties => ({
  width: '100%',
  backgroundColor: '#FFFFFF',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: '20px 20px 0 0',
  boxShadow: '0 -5px 20px rgba(0,0,0,0.1)',
  padding: isCollapsed ? '10px 14px 8px' : '15px 20px 30px',
  boxSizing: 'border-box',
  height: height ? `${height}px` : 'auto',
  maxHeight: '100vh',
  overflowY: isCollapsed ? 'hidden' : 'auto',
  touchAction: 'pan-y',
  transition: isDragging ? 'none' : 'height 260ms cubic-bezier(0.22, 1, 0.36, 1)'
});

const handleStyle: React.CSSProperties = {
  width: '48px',
  height: '6px',
  backgroundColor: '#E5E7EB',
  borderRadius: '10px',
  margin: '0 auto 12px',
  cursor: 'ns-resize',
  touchAction: 'none'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px'
};

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

const orderEditButtonStyle = (active: boolean): React.CSSProperties => ({
  border: '1px solid #D1D5DB',
  backgroundColor: active ? '#EEF2FF' : '#FFFFFF',
  color: active ? '#4338CA' : '#4B5563',
  borderRadius: '10px',
  padding: '6px 10px',
  fontSize: '0.8rem',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
});

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

const swipeWrapperStyle = (activeReorder: boolean, dragOffsetY: number): React.CSSProperties => ({
  position: 'relative',
  overflow: activeReorder ? 'visible' : 'hidden',
  borderRadius: '12px',
  touchAction: 'pan-y',
  transform: activeReorder ? `translateY(${dragOffsetY}px)` : 'translateY(0)',
  transition: activeReorder ? 'none' : 'transform 180ms ease',
  zIndex: activeReorder ? 60 : 1
});

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

const cardStyle = (
  enabled: boolean,
  swipeOpened: boolean,
  activeReorder: boolean,
  isReordering: boolean
): React.CSSProperties => ({
  border: `1px solid ${activeReorder ? '#8B5CF6' : '#E5E7EB'}`,
  borderRadius: '12px',
  backgroundColor: enabled ? '#F9FAFB' : '#F3F4F6',
  padding: '12px',
  transform: isReordering ? 'translateX(0)' : (swipeOpened ? 'translateX(-148px)' : 'translateX(0)'),
  transition: activeReorder ? 'none' : 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
  boxShadow: activeReorder ? '0 18px 34px rgba(139, 92, 246, 0.34)' : 'none'
});

const cardInnerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: '8px'
};

const reorderHandleRailStyle: React.CSSProperties = {
  width: '24px',
  minWidth: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const reorderHandleButtonStyle = (active: boolean): React.CSSProperties => ({
  border: 'none',
  background: 'transparent',
  color: active ? '#7C3AED' : '#9CA3AF',
  fontSize: '1.05rem',
  lineHeight: 1,
  cursor: 'grab',
  padding: 0,
  touchAction: 'none'
});

const cardMainStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0
};

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
