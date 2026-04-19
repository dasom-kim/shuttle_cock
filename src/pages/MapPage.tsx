import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import Toggle from '../components/Toggle';
import FloatingMenu from '../components/FloatingMenu';
import LoginModal from '../components/LoginModal';
import AddShuttleModal from '../components/AddShuttleModal'; // 모달 임포트
import NicknameSetupModal from '../components/NicknameSetupModal';
import { getShuttlecockNickname, saveShuttleInfo, setShuttlecockNickname, fetchAllStations } from '../services/shuttleService';
import StationDetailSheet from "../components/StationDetailSheet"; // 저장 서비스 임포트
import { useFeedback } from '../components/feedback/FeedbackProvider';
import { reverseGeocodeNcloud } from '../services/geocodeService';
import { getDistance } from '../utils/mapUtils';

const STATION_MATCH_RADIUS_METERS = 200;
const ACTIVE_MARKER_COLOR = '#EF4444';
const MARKER_FOCUS_ZOOM = 15;
const INVALID_STATION_NAME_PATTERNS = [
    /^정류장\s*정보$/i,
    /^정류장정보$/i,
    /^정류장\s*명칭\s*불러오는\s*중/i,
    /^정보\s*없음$/i
];

const NICKNAME_ADJECTIVES = ['빠른', '산뜻한', '든든한', '반짝이는', '기분좋은', '재치있는', '믿음직한', '귀여운'];
const NICKNAME_NOUNS = ['셔틀러', '탑승객', '출근러', '퇴근러', '버스메이트', '셔틀메이트', '셔틀요정', '라이더'];


// 커스텀 마커 아이콘 생성 함수
const getMarkerIcon = (isActive: boolean, isSelected: boolean) => {
    let color = '#C4B5FD';
    let opacity = 0.8;

    if (isSelected) {
        color = ACTIVE_MARKER_COLOR;
        opacity = 1;
    } else if (isActive) {
        color = '#8B5CF6';
        opacity = 1;
    }

    const svgIcon = `
    <svg width="36" height="36" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.2));">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `;

    return {
        content: `<div style="cursor:pointer; opacity:${opacity}; transition: all 0.3s ease;">${svgIcon}</div>`,
        anchor: new window.naver.maps.Point(18, 36),
    };
};

const MapPage = () => {
    const { user } = useAuth();
    const { showToast } = useFeedback();
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isAddMode, setIsAddMode] = useState(false);
    const [filter, setFilter] = useState({ go: true, leave: false });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedCoord, setSelectedCoord] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedStationName, setSelectedStationName] = useState('');
    const [selectedStationNameOptions, setSelectedStationNameOptions] = useState<Array<{
        name: string;
        source: 'nearby' | 'api' | 'fallback';
    }>>([]);
    const [stations, setStations] = useState<any[]>([]);
    const [selectedStation, setSelectedStation] = useState<any>(null);
    const [selectedMarkerStationId, setSelectedMarkerStationId] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailSheetResetKey, setDetailSheetResetKey] = useState(0);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
    const [suggestedNickname, setSuggestedNickname] = useState('');
    const [currentUserNickname, setCurrentUserNickname] = useState('');

    const mapRef = useRef<naver.maps.Map | null>(null);
    const markersRef = useRef<naver.maps.Marker[]>([]);
    const groupedAreaCirclesRef = useRef<naver.maps.Circle[]>([]);
    const destinationMarkersRef = useRef<naver.maps.Marker[]>([]);
    const routePolylinesRef = useRef<naver.maps.Polyline[]>([]);
    const routeInfoWindowsRef = useRef<naver.maps.InfoWindow[]>([]);
    const ignoreNextMapClickRef = useRef(false);
    const mapClickIgnoreTimerRef = useRef<number | null>(null);
    const checkedNicknameUidRef = useRef<string | null>(null);

    const createRandomNickname = useCallback(() => {
        const adjective = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)];
        const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)];
        const tail = Math.floor(100 + Math.random() * 900);
        return `${adjective} ${noun}${tail}`;
    }, []);

    const isValidStationName = useCallback((value: string) => {
        const normalized = value.trim();
        if (!normalized) return false;
        return !INVALID_STATION_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
    }, []);

    const getOfficialStationName = useCallback(async (lat: number, lng: number) => {
        return reverseGeocodeNcloud(lat, lng);
    }, []);

    const findNearbyStationName = useCallback((lat: number, lng: number) => {
        let nearestStationName = '';
        let nearestDistance = Infinity;

        stations.forEach((station) => {
            const stationName = (station.stationName || '').trim();
            if (!isValidStationName(stationName)) return;

            const distance = getDistance(lat, lng, station.lat, station.lng);
            if (distance <= STATION_MATCH_RADIUS_METERS && distance < nearestDistance) {
                nearestStationName = stationName;
                nearestDistance = distance;
            }
        });

        return nearestStationName;
    }, [stations, isValidStationName]);

    /**
     * ✨ Firestore에서 전체 정류장 데이터를 가져와 상태를 업데이트하는 함수
     */
    const loadData = useCallback(async () => {
        try {
            const data = await fetchAllStations();
            setStations(data);

            // 현재 상세창이 열려있다면(selectedStation이 있다면),
            // 전체 데이터 중 해당 정류장만 찾아 상세 정보도 최신화해줍니다.
            setSelectedStation((prev: any) => {
                if (!prev) return prev;
                const updated = data.find((s: any) => s.id === prev.id);
                return updated || prev;
            });
        } catch (error) {
            console.error("데이터 로드 실패:", error);
        } finally {
            setIsInitialLoading(false);
        }
    }, []);

    const clearMapClickIgnoreTimer = useCallback(() => {
        if (mapClickIgnoreTimerRef.current) {
            window.clearTimeout(mapClickIgnoreTimerRef.current);
            mapClickIgnoreTimerRef.current = null;
        }
    }, []);

    const clearMapClickIgnore = useCallback(() => {
        clearMapClickIgnoreTimer();
        ignoreNextMapClickRef.current = false;
    }, [clearMapClickIgnoreTimer]);


    useEffect(() => {
        if (!user?.uid) {
            checkedNicknameUidRef.current = null;
            setIsNicknameModalOpen(false);
            setCurrentUserNickname('');
            return;
        }

        if (checkedNicknameUidRef.current === user.uid) return;
        checkedNicknameUidRef.current = user.uid;

        let isCancelled = false;
        const fallbackNickname = createRandomNickname();
        setSuggestedNickname(fallbackNickname);

        void getShuttlecockNickname(user.uid, '')
            .then((nickname) => {
                if (isCancelled) return;
                if (!nickname.trim()) {
                    setIsNicknameModalOpen(true);
                    setCurrentUserNickname('');
                } else {
                    setCurrentUserNickname(nickname.trim());
                }
            })
            .catch((error) => {
                console.error('닉네임 조회 실패:', error);
            });

        return () => {
            isCancelled = true;
        };
    }, [user?.uid, createRandomNickname]);

    const clearRouteOverlays = useCallback(() => {
        destinationMarkersRef.current.forEach((marker) => marker.setMap(null));
        destinationMarkersRef.current = [];
        routePolylinesRef.current.forEach((line) => line.setMap(null));
        routePolylinesRef.current = [];
        routeInfoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
        routeInfoWindowsRef.current = [];
    }, []);

    const getTimeMinutes = (value?: string) => {
        if (!value) return null;
        const [h, m] = value.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h * 60 + m;
    };

    const getDurationText = (boarding?: string, alighting?: string) => {
        const boardingMinutes = getTimeMinutes(boarding);
        const alightingMinutes = getTimeMinutes(alighting);
        if (boardingMinutes === null || alightingMinutes === null) return '소요 시간 정보 없음';

        let diff = alightingMinutes - boardingMinutes;
        if (diff < 0) diff += 24 * 60;
        return `소요 ${diff}분`;
    };

    // 1. 초기 맵 렌더링 및 데이터 Fetch
    useEffect(() => {
        if (!window.naver) return;

        const mapOptions = {
            center: new window.naver.maps.LatLng(37.4979, 127.0276),
            zoom: 15,
            minZoom: 10,
        };
        mapRef.current = new window.naver.maps.Map('map', mapOptions);

        // ✨ 데이터 불러오기 실행
        void loadData();
    }, []);

    // 2. stations 데이터가 업데이트되거나, filter가 바뀔 때 마커 다시 그리기
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // 기존 마커 지도에서 모두 지우기 (초기화)
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        // 새로운 데이터로 마커 생성
        stations.forEach(station => {
            let isActive = false;
            if (station.type === 'both') {
                isActive = filter.go || filter.leave;
            } else if (station.type === 'go') {
                isActive = filter.go;
            } else if (station.type === 'leave') {
                isActive = filter.leave;
            }

            const isSelected = station.id === selectedMarkerStationId;

            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(station.lat, station.lng),
                map: mapRef.current!,
                icon: getMarkerIcon(isActive, isSelected),
                zIndex: isSelected ? 200 : isActive ? 100 : 10,
            });

            // ✨ 마커 클릭 이벤트 추가
            window.naver.maps.Event.addListener(marker, 'click', async () => {
                clearMapClickIgnoreTimer();
                ignoreNextMapClickRef.current = true;
                mapClickIgnoreTimerRef.current = window.setTimeout(() => {
                    ignoreNextMapClickRef.current = false;
                    mapClickIgnoreTimerRef.current = null;
                }, 250);
                clearRouteOverlays();
                map.setCenter(new window.naver.maps.LatLng(station.lat, station.lng));
                map.setZoom(MARKER_FOCUS_ZOOM, true);
                const stationName = station.stationName || await getOfficialStationName(station.lat, station.lng);
                const nearbyStations = stations.filter((s: any) => (
                    getDistance(station.lat, station.lng, s.lat, s.lng) <= STATION_MATCH_RADIUS_METERS
                ));
                const mergedShuttles = nearbyStations.flatMap((s: any) => s.shuttles || []);
                setSelectedMarkerStationId(station.id || null);
                setDetailSheetResetKey((prev) => prev + 1);

                setSelectedStation({
                    ...station,
                    stationName,
                    shuttles: mergedShuttles
                });
                setIsDetailOpen(true);
            });

            marker.set('stationType', station.type);
            markersRef.current.push(marker);
        });
    }, [stations, filter, getOfficialStationName, selectedMarkerStationId, clearMapClickIgnoreTimer]); // stations나 filter가 바뀔 때마다 실행

    useEffect(() => {
        return () => {
            clearMapClickIgnore();
            groupedAreaCirclesRef.current.forEach((circle) => circle.setMap(null));
            groupedAreaCirclesRef.current = [];
            clearRouteOverlays();
        };
    }, [clearMapClickIgnore, clearRouteOverlays]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        groupedAreaCirclesRef.current.forEach((circle) => circle.setMap(null));
        groupedAreaCirclesRef.current = [];

        const groupedByStationName = new Map<string, any[]>();
        stations.forEach((station: any) => {
            const stationName = (station.stationName || '').trim();
            if (!stationName) return;

            if (!groupedByStationName.has(stationName)) {
                groupedByStationName.set(stationName, []);
            }
            groupedByStationName.get(stationName)!.push(station);
        });

        groupedByStationName.forEach((groupStations) => {
            if (!groupStations.length) return;

            const centerLat =
                groupStations.reduce((sum, station) => sum + station.lat, 0) / groupStations.length;
            const centerLng =
                groupStations.reduce((sum, station) => sum + station.lng, 0) / groupStations.length;

            let radius = STATION_MATCH_RADIUS_METERS;
            groupStations.forEach((station) => {
                const distance = getDistance(centerLat, centerLng, station.lat, station.lng);
                radius = Math.max(radius, distance + 20);
            });

            const circle = new window.naver.maps.Circle({
                map,
                center: new window.naver.maps.LatLng(centerLat, centerLng),
                radius,
                strokeColor: '#93C5FD',
                strokeOpacity: 0.85,
                strokeWeight: 2,
                fillColor: '#BFDBFE',
                fillOpacity: 0.28,
                zIndex: 50
            });
            groupedAreaCirclesRef.current.push(circle);
        });
    }, [stations]);

    const handleSelectShuttleRoute = useCallback((shuttle: any) => {
        const map = mapRef.current;
        if (!map) return;

        clearRouteOverlays();

        const destX = Number(shuttle?.destinationX);
        const destY = Number(shuttle?.destinationY);
        if (!Number.isFinite(destX) || !Number.isFinite(destY)) return;

        const originStation =
            (shuttle?.stationId ? stations.find((station: any) => station.id === shuttle.stationId) : null) ||
            stations.find((station: any) => station.id === selectedMarkerStationId) ||
            selectedStation;

        const originLat = Number(originStation?.lat);
        const originLng = Number(originStation?.lng);
        if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) return;

        const stationPoint = new window.naver.maps.LatLng(originLat, originLng);
        const remotePoint = new window.naver.maps.LatLng(destY, destX);
        const linePath =
            shuttle?.type === 'leave'
                ? [remotePoint, stationPoint]
                : [stationPoint, remotePoint];
        const bounds = new window.naver.maps.LatLngBounds(stationPoint, remotePoint);
        map.fitBounds(bounds, {
            top: 80,
            right: 80,
            bottom: 120,
            left: 80
        });

        const destinationMarker = new window.naver.maps.Marker({
            position: remotePoint,
            map,
            icon: {
                content: `<div style="width:16px;height:16px;border-radius:50%;background:${ACTIVE_MARKER_COLOR};border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(239,68,68,0.35);"></div>`,
                anchor: new window.naver.maps.Point(8, 8)
            },
            zIndex: 180
        });
        destinationMarkersRef.current.push(destinationMarker);

        const routeLine = new window.naver.maps.Polyline({
            map,
            path: linePath,
            strokeColor: ACTIVE_MARKER_COLOR,
            strokeOpacity: 0.9,
            strokeWeight: 3,
            zIndex: 120
        });
        routePolylinesRef.current.push(routeLine);

        const pointTimeLabel = shuttle?.type === 'leave' ? '승차' : '하차';
        const pointTimeValue = shuttle?.type === 'leave' ? shuttle?.boardingTime : shuttle?.alightingTime;
        const durationText = getDurationText(shuttle?.boardingTime, shuttle?.alightingTime);
        const infoWindow = new window.naver.maps.InfoWindow({
            content: `
                <div style="
                    background:#FFFFFF;
                    border:1px solid #FCA5A5;
                    border-radius:12px;
                    padding:8px 10px;
                    box-shadow:0 8px 18px rgba(15,23,42,0.14);
                    font-size:12px;
                    color:#991B1B;
                    line-height:1.4;
                    white-space:nowrap;
                    font-weight:700;
                ">
                    ${pointTimeLabel} ${pointTimeValue || '정보 없음'}<br />
                    ${durationText}
                </div>
            `,
            borderWidth: 0,
            backgroundColor: 'transparent',
            disableAnchor: true,
            pixelOffset: new window.naver.maps.Point(24, -10)
        });
        infoWindow.open(map, destinationMarker);
        routeInfoWindowsRef.current.push(infoWindow);
    }, [clearRouteOverlays, selectedMarkerStationId, selectedStation, stations]);

    // 지도 클릭 이벤트 리스너
    useEffect(() => {
        if (!mapRef.current) return;

        let clickListener: naver.maps.MapEventListener | null = null;

        if (isAddMode) {
            clickListener = window.naver.maps.Event.addListener(mapRef.current, 'click', (e: naver.maps.PointerEvent) => {
                if (!user) {
                    showToast("로그인 후 이용해 주세요.", 'info');
                    return;
                }

                // 클릭한 좌표 저장 및 모달 열기
                const lat = (e.coord as naver.maps.LatLng).lat();
                const lng = (e.coord as naver.maps.LatLng).lng();
                setSelectedCoord({
                    lat,
                    lng
                });
                setIsAddModalOpen(true);
                setSelectedStationName('정류장 명칭 불러오는 중...');
                setSelectedStationNameOptions([]);

                const nearbyStationName = findNearbyStationName(lat, lng);
                void getOfficialStationName(lat, lng).then((apiStationName) => {
                    const options: Array<{ name: string; source: 'nearby' | 'api' | 'fallback' }> = [];
                    const nearby = (nearbyStationName || '').trim();
                    const api = (apiStationName || '').trim();

                    if (isValidStationName(nearby)) {
                        options.push({ name: nearby, source: 'nearby' });
                    }
                    if (isValidStationName(api) && !options.some((option) => option.name === api)) {
                        options.push({ name: api, source: 'api' });
                    }

                    if (options.length > 0) {
                        setSelectedStationNameOptions(options);
                        setSelectedStationName(options[0].name);
                        return;
                    }

                    setSelectedStationNameOptions([{ name: '정류장 정보', source: 'fallback' }]);
                    setSelectedStationName('정류장 정보');
                });
            });
        }

        return () => {
            if (clickListener) {
                window.naver.maps.Event.removeListener(clickListener);
            }
        };
    }, [isAddMode, user, showToast, getOfficialStationName, findNearbyStationName, isValidStationName]);

    const handleAddShuttleFromSheet = async () => {
        if (!selectedStation) return;
        if (!user) {
            showToast("로그인 후 이용해 주세요.", 'info');
            return;
        }

        const stationName = selectedStation.stationName || await getOfficialStationName(selectedStation.lat, selectedStation.lng);
        setSelectedCoord({ lat: selectedStation.lat, lng: selectedStation.lng });
        setSelectedStationName(stationName);
        setSelectedStationNameOptions([{ name: stationName, source: 'api' }]);
        setIsAddModalOpen(true);
    };

    // 셔틀 정보 저장 핸들러
    const handleSaveShuttle = async (formData: any) => {
        if (!selectedCoord) return;

        try {
            const result = await saveShuttleInfo(
                selectedCoord.lat,
                    selectedCoord.lng,
                    {
                    name: formData.shuttleName.trim(),
                    company: formData.company,
                    type: formData.type,
                    boardingTime: formData.boardingTime,
                    alightingTime: formData.alightingTime,
                    destinationAddress: formData.destinationAddress,
                    destinationX: formData.destinationX,
                    destinationY: formData.destinationY,
                    congestion: formData.congestion,
                    addedBy: user?.uid || 'anonymous',
                    addedByNickname: currentUserNickname || '익명',
                    days: ['월', '화', '수', '목', '금']
                },
                (formData.stationName || selectedStationName || '정류장 정보').trim()
            );

            showToast(result.message || '정류장 정보가 저장됐어요. 바로 지도에 반영할게요.', 'success');
            setIsAddModalOpen(false);
            setIsAddMode(false); // 저장 후 추가 모드 해제

            // 저장 성공 후 데이터를 다시 불러와서 지도를 최신화
            await loadData();
        } catch (error) {
            console.error("저장 실패:", error);
            showToast("저장 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", 'error');
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
            {/* 안내 문구 */}
            {isAddMode && (
                <div style={{
                    position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 100, backgroundColor: '#8B5CF6', color: 'white', padding: '10px 20px',
                    borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(139,92,246,0.3)', pointerEvents: 'none'
                }}>
                    지도에서 정류장을 추가할 위치를 클릭하세요.
                </div>
            )}

            <Toggle filter={filter} setFilter={setFilter} />

            <div id="map" style={{ width: '100%', height: '100%', cursor: isAddMode ? 'crosshair' : 'default' }}></div>

            {isInitialLoading && (
                <div style={mapLoadingOverlayStyle}>
                    <div style={mapLoadingCardStyle}>
                        <div style={mapLoadingBarStyle}>
                            <div style={mapLoadingBarFillStyle} />
                        </div>
                        <div style={mapLoadingTextStyle}>열심히 셔틀 정보를 찾고 있어요. 잠시만 기다려 주세요!</div>
                    </div>
                </div>
            )}

            <FloatingMenu
                user={user}
                isAddMode={isAddMode}
                onOpenLogin={() => setIsLoginModalOpen(true)}
                onToggleAddStation={() => {
                    if (!user) {
                        showToast("로그인 후 이용해 주세요.", 'info');
                        return;
                    }
                    setIsAddMode((prev) => !prev);
                }}
                isRankingOpen={false}
                isFavOpen={false}
                onToggleRanking={() => {}}
                onToggleFav={() => {}}
            />

            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

            <AddShuttleModal
                isOpen={isAddModalOpen}
                lat={selectedCoord?.lat || 0}
                lng={selectedCoord?.lng || 0}
                stationName={selectedStationName}
                stationNameOptions={selectedStationNameOptions}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveShuttle}
            />

            <StationDetailSheet
                isOpen={isDetailOpen}
                onClose={() => {
                    setIsDetailOpen(false);
                    setSelectedStation(null);
                    setSelectedMarkerStationId(null);
                    clearRouteOverlays();
                }}
                stationId={selectedStation?.id} // ⭐️ 이 stationId가 정확히 넘어가고 있는지 확인!
                resetKey={detailSheetResetKey}
                stationName={selectedStation?.stationName || '정류장 정보'}
                shuttles={selectedStation?.shuttles || []}
                onAddShuttle={handleAddShuttleFromSheet}
                onSelectShuttleRoute={handleSelectShuttleRoute}
                onDataChanged={loadData}
                currentUserNickname={currentUserNickname}
            />

            <NicknameSetupModal
                isOpen={isNicknameModalOpen}
                suggestedNickname={suggestedNickname}
                onSubmit={async (nickname) => {
                    if (!user?.uid) return;
                    const finalNickname = nickname.trim() || suggestedNickname;
                    await setShuttlecockNickname(user.uid, finalNickname);
                    setCurrentUserNickname(finalNickname);
                    setIsNicknameModalOpen(false);
                    showToast(`닉네임이 '${finalNickname}'(으)로 설정됐어요.`, 'success');
                }}
            />
        </div>
    );
};

export default MapPage;

const mapLoadingOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 2500,
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none'
};

const mapLoadingCardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '14px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
    padding: '14px 16px',
    minWidth: '240px',
    maxWidth: '86vw'
};

const mapLoadingBarStyle: React.CSSProperties = {
    position: 'relative',
    height: '7px',
    borderRadius: '999px',
    backgroundColor: '#E5E7EB',
    overflow: 'hidden'
};

const mapLoadingBarFillStyle: React.CSSProperties = {
    width: '45%',
    height: '100%',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, #8B5CF6 0%, #60A5FA 100%)',
    animation: 'map-loading-slide 1.2s ease-in-out infinite'
};

const mapLoadingTextStyle: React.CSSProperties = {
    marginTop: '10px',
    color: '#374151',
    fontSize: '0.88rem',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.4
};
