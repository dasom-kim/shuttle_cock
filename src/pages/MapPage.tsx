import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import Toggle from '../components/Toggle';
import FloatingMenu from '../components/FloatingMenu';
import LoginModal from '../components/LoginModal';
import AddShuttleModal from '../components/AddShuttleModal'; // 모달 임포트
import { saveShuttleInfo, fetchAllStations } from '../services/shuttleService';
import StationDetailSheet from "../components/StationDetailSheet"; // 저장 서비스 임포트


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
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isAddMode, setIsAddMode] = useState(false);
    const [filter, setFilter] = useState({ go: true, leave: false });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedCoord, setSelectedCoord] = useState<{ lat: number; lng: number } | null>(null);
    const [stations, setStations] = useState<any[]>([]);
    const [selectedStation, setSelectedStation] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const mapRef = useRef<naver.maps.Map | null>(null);
    const markersRef = useRef<naver.maps.Marker[]>([]);

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
            window.naver.maps.Event.addListener(marker, 'click', () => {
                setSelectedStation(station);
                setIsDetailOpen(true);
            });

            marker.set('stationType', station.type);
            markersRef.current.push(marker);
        });
    }, [stations, filter]); // stations나 filter가 바뀔 때마다 실행

    // 지도 클릭 이벤트 리스너
    useEffect(() => {
        if (!mapRef.current) return;

        let clickListener: naver.maps.MapEventListener | null = null;

        if (isAddMode) {
            clickListener = window.naver.maps.Event.addListener(mapRef.current, 'click', (e: naver.maps.PointerEvent) => {
                if (!user) {
                    alert("정류장 추가는 로그인 후 이용할 수 있습니다.");
                    setIsLoginModalOpen(true);
                    return;
                }

                // 클릭한 좌표 저장 및 모달 열기
                setSelectedCoord({
                    lat: (e.coord as naver.maps.LatLng).lat(),
                    lng: (e.coord as naver.maps.LatLng).lng()
                });
                setIsAddModalOpen(true);
            });
        }

        return () => {
            if (clickListener) {
                window.naver.maps.Event.removeListener(clickListener);
            }
        };
    }, [isAddMode, user]);

    // 셔틀 정보 저장 핸들러
    const handleSaveShuttle = async (formData: any) => {
        if (!selectedCoord) return;

        try {
            const result = await saveShuttleInfo(
                selectedCoord.lat,
                selectedCoord.lng,
                {
                    name: formData.stationName,
                    company: formData.company,
                    type: formData.type,
                    time: formData.time,
                    congestion: formData.congestion,
                    congestionUpdatedAt: formData.congestionUpdatedAt,
                    addedBy: user?.uid || 'anonymous',
                    days: ['월', '화', '수', '목', '금']
                });

            alert(result.message);
            setIsAddModalOpen(false);
            setIsAddMode(false); // 저장 후 추가 모드 해제

            // 저장 성공 후 데이터를 다시 불러와서 지도를 최신화
            const updatedData = await fetchAllStations();
            setStations(updatedData);
        } catch (error) {
            console.error("저장 실패:", error);
            alert("정보 저장 중 오류가 발생했습니다.");
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
                isAddMode={isAddMode}
                onToggleAddMode={() => setIsAddMode(!isAddMode)}
                onOpenLogin={() => setIsLoginModalOpen(true)}
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
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveShuttle}
            />

            <StationDetailSheet
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                stationId={selectedStation?.id} // ⭐️ 이 stationId가 정확히 넘어가고 있는지 확인!
                stationName={selectedStation?.shuttles[0]?.name || '정류장 정보'}
                shuttles={selectedStation?.shuttles || []}
                onRefresh={loadData}
            />
        </div>
    );
};

export default MapPage;