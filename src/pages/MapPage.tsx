import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import Toggle from '../components/Toggle';
import FloatingMenu from '../components/FloatingMenu';
import LoginModal from '../components/LoginModal';
import AddShuttleModal from '../components/AddShuttleModal'; // 모달 임포트
import { saveShuttleInfo, fetchAllStations } from '../services/shuttleService';
import StationDetailSheet from "../components/StationDetailSheet"; // 저장 서비스 임포트
import { useFeedback } from '../components/feedback/FeedbackProvider';
import { reverseGeocodeNcloud } from '../services/geocodeService';
import { getDistance } from '../utils/mapUtils';

const STATION_MATCH_RADIUS_METERS = 200;


// 커스텀 마커 아이콘 생성 함수 (활성화 여부에 따라 색상 반환)
const getMarkerIcon = (isActive: boolean) => {
    // 활성화: 비비드 퍼플 / 비활성화: 페일 라벤더
    const color = isActive ? '#8B5CF6' : '#C4B5FD';
    const opacity = isActive ? 1 : 0.8;

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
    const [stations, setStations] = useState<any[]>([]);
    const [selectedStation, setSelectedStation] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const mapRef = useRef<naver.maps.Map | null>(null);
    const markersRef = useRef<naver.maps.Marker[]>([]);
    const ignoreNextMapClickRef = useRef(false);

    const getOfficialStationName = useCallback(async (lat: number, lng: number) => {
        try {
            return await reverseGeocodeNcloud(lat, lng);
        } catch (error) {
            console.error('역지오코딩 실패:', error);
            return '정류장 정보';
        }
    }, []);

    const findNearbyStationName = useCallback((lat: number, lng: number) => {
        let nearestStationName = '';
        let nearestDistance = Infinity;

        stations.forEach((station) => {
            const stationName = (station.stationName || '').trim();
            if (!stationName) return;

            const distance = getDistance(lat, lng, station.lat, station.lng);
            if (distance <= STATION_MATCH_RADIUS_METERS && distance < nearestDistance) {
                nearestStationName = stationName;
                nearestDistance = distance;
            }
        });

        return nearestStationName;
    }, [stations]);

    /**
     * ✨ Firestore에서 최신 데이터를 가져와 상태를 업데이트하는 함수
     */
    const loadData = async () => {
        try {
            const data = await fetchAllStations(); // 서비스에서 전체 데이터 호출
            setStations(data);

            // 현재 상세창이 열려있다면(selectedStation이 있다면),
            // 전체 데이터 중 해당 정류장만 찾아 상세 정보도 최신화해줍니다.
            if (selectedStation) {
                const updated = data.find((s: any) => s.id === selectedStation.id);
                if (updated) {
                    setSelectedStation(updated);
                }
            }
        } catch (error) {
            console.error("데이터 로드 실패:", error);
        }
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
        loadData();
    }, []);

    // 2. stations 데이터가 업데이트되거나, filter가 바뀔 때 마커 다시 그리기
    useEffect(() => {
        if (!mapRef.current) return;

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

            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(station.lat, station.lng),
                map: mapRef.current!,
                icon: getMarkerIcon(isActive),
                zIndex: isActive ? 100 : 10,
            });

            // ✨ 마커 클릭 이벤트 추가
            window.naver.maps.Event.addListener(marker, 'click', async () => {
                ignoreNextMapClickRef.current = true;
                const stationName = station.stationName || await getOfficialStationName(station.lat, station.lng);
                const sameNamedStations = stations.filter((s: any) => (s.stationName || '') === stationName);
                const mergedShuttles = sameNamedStations.flatMap((s: any) => s.shuttles || []);

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
    }, [stations, filter, getOfficialStationName]); // stations나 filter가 바뀔 때마다 실행

    // 일반 지도 영역 클릭 시(마커 제외) 상세 바텀시트 닫기
    useEffect(() => {
        if (!mapRef.current || isAddMode) return;

        const listener = window.naver.maps.Event.addListener(mapRef.current, 'click', () => {
            if (ignoreNextMapClickRef.current) {
                ignoreNextMapClickRef.current = false;
                return;
            }
            setIsDetailOpen(false);
            setSelectedStation(null);
        });

        return () => {
            window.naver.maps.Event.removeListener(listener);
        };
    }, [isAddMode]);

    // 지도 클릭 이벤트 리스너
    useEffect(() => {
        if (!mapRef.current) return;

        let clickListener: naver.maps.MapEventListener | null = null;

        if (isAddMode) {
            clickListener = window.naver.maps.Event.addListener(mapRef.current, 'click', (e: naver.maps.PointerEvent) => {
                if (!user) {
                    showToast("정류장 추가는 로그인 후 이용할 수 있어요", 'info');
                    setIsLoginModalOpen(true);
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

                const nearbyStationName = findNearbyStationName(lat, lng);
                if (nearbyStationName) {
                    setSelectedStationName(nearbyStationName);
                    return;
                }

                setSelectedStationName('정류장 명칭 불러오는 중...');
                void getOfficialStationName(lat, lng).then((stationName) => {
                    setSelectedStationName(stationName);
                });
            });
        }

        return () => {
            if (clickListener) {
                window.naver.maps.Event.removeListener(clickListener);
            }
        };
    }, [isAddMode, user, showToast, getOfficialStationName, findNearbyStationName]);

    const handleAddShuttleFromSheet = async () => {
        if (!selectedStation) return;
        if (!user) {
            showToast("정류장 추가는 로그인 후 이용할 수 있어요", 'info');
            setIsLoginModalOpen(true);
            return;
        }

        const stationName = selectedStation.stationName || await getOfficialStationName(selectedStation.lat, selectedStation.lng);
        setSelectedCoord({ lat: selectedStation.lat, lng: selectedStation.lng });
        setSelectedStationName(stationName);
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
                    congestion: formData.congestion,
                    congestionUpdatedAt: formData.congestionUpdatedAt,
                    addedBy: user?.uid || 'anonymous',
                    days: ['월', '화', '수', '목', '금']
                },
                selectedStationName
            );

            showToast(result.message || '정류장 정보가 저장됐어요. 바로 지도에 반영할게요.', 'success');
            setIsAddModalOpen(false);
            setIsAddMode(false); // 저장 후 추가 모드 해제

            // 저장 성공 후 데이터를 다시 불러와서 지도를 최신화
            const updatedData = await fetchAllStations();
            setStations(updatedData);
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

            <FloatingMenu
                user={user}
                onOpenLogin={() => setIsLoginModalOpen(true)}
                isRankingOpen={false}
                isFavOpen={false}
                onToggleRanking={() => {}}
                onToggleFav={() => {}}
            />

            <button
                onClick={() => {
                    if (!user) {
                        showToast("로그인 후 이용해 주세요.", 'info');
                        setIsLoginModalOpen(true);
                        return;
                    }
                    setIsAddMode((prev) => !prev);
                }}
                style={addStationTopButtonStyle(isAddMode)}
            >
                <span style={{ marginRight: '6px' }}>{user ? '➕' : '🔒'}</span>
                {isAddMode ? '추가 모드 종료' : '정류장 추가'}
            </button>

            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

            <AddShuttleModal
                isOpen={isAddModalOpen}
                lat={selectedCoord?.lat || 0}
                lng={selectedCoord?.lng || 0}
                stationName={selectedStationName}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveShuttle}
            />

            <StationDetailSheet
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                stationId={selectedStation?.id} // ⭐️ 이 stationId가 정확히 넘어가고 있는지 확인!
                stationName={selectedStation?.stationName || '정류장 정보'}
                shuttles={selectedStation?.shuttles || []}
                onAddShuttle={handleAddShuttleFromSheet}
            />
        </div>
    );
};

export default MapPage;

const addStationTopButtonStyle = (isActive: boolean): React.CSSProperties => ({
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 20px)',
    right: '20px',
    zIndex: 1200,
    border: 'none',
    borderRadius: '999px',
    padding: '10px 14px',
    fontSize: '0.88rem',
    fontWeight: 700,
    cursor: 'pointer',
    backgroundColor: isActive ? '#8B5CF6' : '#FFFFFF',
    color: isActive ? '#FFFFFF' : '#4F46E5',
    boxShadow: '0 6px 16px rgba(79, 70, 229, 0.2)'
});
