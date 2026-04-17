import React, { useState, useEffect, useRef } from 'react';
import Toggle from '../components/Toggle';
import FloatingMenu from '../components/FloatingMenu';

// 테스트용 임시 정류장 데이터
const MOCK_STATIONS = [
    { id: 1, lat: 37.4979, lng: 127.0276, name: '강남역 1번출구', type: 'go' },
    { id: 2, lat: 37.4990, lng: 127.0250, name: '강남역 9번출구', type: 'leave' },
    { id: 3, lat: 37.4960, lng: 127.0300, name: '강남역 4번출구', type: 'both' },
];

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

const MapPage: React.FC = () => {
    const mapRef = useRef<naver.maps.Map | null>(null);
    const markersRef = useRef<naver.maps.Marker[]>([]);

    // 변경점: 객체 형태로 출근/퇴근 다중 선택 상태 관리 (기본값: 출근만 켜짐)
    const [filter, setFilter] = useState({ go: true, leave: false });
    const [isAddMode, setIsAddMode] = useState<boolean>(false);

    useEffect(() => {
        if (!window.naver) return;

        const mapOptions = {
            center: new window.naver.maps.LatLng(37.4979, 127.0276),
            zoom: 15,
            minZoom: 10,
        };

        mapRef.current = new window.naver.maps.Map('map', mapOptions);

        MOCK_STATIONS.forEach(station => {
            // 초기 렌더링 활성화 조건
            const isActive = (station.type === 'both' && (filter.go || filter.leave)) ||
                (station.type === 'go' && filter.go) ||
                (station.type === 'leave' && filter.leave);

            const marker = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(station.lat, station.lng),
                map: mapRef.current!,
                icon: getMarkerIcon(isActive),
                zIndex: isActive ? 100 : 10,
            });

            marker.set('stationType', station.type);
            markersRef.current.push(marker);
        });
    }, []);

    // [핵심 로직 변경] filter 상태가 변할 때마다 마커 색상 업데이트
    useEffect(() => {
        markersRef.current.forEach(marker => {
            const type = marker.get('stationType');

            // 다중 선택 필터 조건 확인
            let isActive = false;
            if (type === 'both') {
                isActive = filter.go || filter.leave; // 둘 중 하나라도 켜져 있으면 활성화
            } else if (type === 'go') {
                isActive = filter.go;
            } else if (type === 'leave') {
                isActive = filter.leave;
            }

            marker.setIcon(getMarkerIcon(isActive));
            marker.setZIndex(isActive ? 100 : 10);
        });
    }, [filter]);

    // 정류장 추가 모드 로직 (이전과 동일)
    useEffect(() => {
        if (!mapRef.current) return;

        let clickListener: naver.maps.MapEventListener;

        if (isAddMode) {
            clickListener = window.naver.maps.Event.addListener(mapRef.current, 'click', (e: any) => {
                const clickedCoord = e.coord;
                const projection = mapRef.current!.getProjection();
                let isDuplicate = false;

                for (const station of MOCK_STATIONS) {
                    const stationCoord = new window.naver.maps.LatLng(station.lat, station.lng);
                    const distance = projection.getDistance(clickedCoord, stationCoord);

                    if (distance <= 10) {
                        isDuplicate = true;
                        break;
                    }
                }

                if (isDuplicate) {
                    const confirmAdd = window.confirm('반경 10m 이내에 이미 다른 셔틀 정류장 정보가 존재합니다.\n그래도 중복해서 새 정류장을 추가하시겠습니까?');
                    if (!confirmAdd) return;
                }

                alert(`정류장 추가 페이지로 이동!\n위도: ${clickedCoord.lat()}, 경도: ${clickedCoord.lng()}`);
                setIsAddMode(false);
            });
        }

        return () => {
            if (clickListener) {
                window.naver.maps.Event.removeListener(clickListener);
            }
        };
    }, [isAddMode]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>

            {isAddMode && (
                <div style={{
                    position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 100, backgroundColor: '#ff4757', color: 'white', padding: '10px 20px',
                    borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(255,71,87,0.3)', pointerEvents: 'none'
                }}>
                    지도에서 정류장을 추가할 위치를 클릭하세요.
                </div>
            )}

            {/* 변경된 토글 컴포넌트 연결 */}
            <Toggle filter={filter} setFilter={setFilter} />

            <div id="map" style={{ width: '100%', height: '100%', cursor: isAddMode ? 'crosshair' : 'default' }}></div>

            <FloatingMenu isAddMode={isAddMode} onToggleAddMode={() => setIsAddMode(!isAddMode)} />
        </div>
    );
};

export default MapPage;