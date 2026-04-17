import { db } from './firebase';
import { doc, updateDoc, serverTimestamp, collection, addDoc, getDocs } from 'firebase/firestore';
import { getDistance } from '../utils/mapUtils';

export interface ShuttleData {
    name: string;
    company: string;
    type: 'work' | 'leave';
    time: string;
    congestion: string; // '여유' | '적당' | '부족' | '만차' 등
    congestionUpdatedAt: any;
    days: string[];     // 운행 요일 (예: ['월', '화', '수', '목', '금'])
    addedBy: string;    // 등록한 유저의 UID
}

/**
 * 셔틀 정보를 Firestore에 저장 (10m 이내 중복 체크 포함)
 */
export const saveShuttleInfo = async (lat: number, lng: number, shuttle: ShuttleData) => {
    try {
        const stationsRef = collection(db, 'stations');
        const querySnapshot = await getDocs(stationsRef);

        let targetStationId = "";

        // 1. 10m 이내 기존 정류장이 있는지 전수 조사
        querySnapshot.forEach((stationDoc) => {
            const data = stationDoc.data();
            const distance = getDistance(lat, lng, data.lat, data.lng);
            if (distance <= 10) {
                targetStationId = stationDoc.id;
            }
        });

        const finalData = {
            ...shuttle,
            createdAt: serverTimestamp(),          // 전체 문서 생성 시간
            congestionUpdatedAt: serverTimestamp(), // ✨ 초기 혼잡도 업데이트 시간 설정
            enable: true                            // 기본 활성화 상태
        };

        if (targetStationId) {
            // 2-A. 기존 정류장이 있다면 'shuttles' 서브 컬렉션에 추가
            const shuttleSubColRef = collection(db, 'stations', targetStationId, 'shuttles');
            await addDoc(shuttleSubColRef, finalData);
            return { success: true, message: "기존 정류장에 새로운 셔틀 정보가 추가되었습니다." };
        } else {
            // 2-B. 새로운 정류장이라면 새 문서 생성 후 'shuttles' 추가
            const newStationDocRef = await addDoc(stationsRef, finalData);

            const shuttleSubColRef = collection(db, 'stations', newStationDocRef.id, 'shuttles');
            await addDoc(shuttleSubColRef, finalData);
            return { success: true, message: "새로운 정류장 위치와 셔틀 정보가 등록되었습니다." };
        }
    } catch (error) {
        console.error("데이터 저장 실패:", error);
        throw error;
    }
};

export const fetchAllStations = async () => {
    try {
        const stationsRef = collection(db, 'stations');
        const stationSnapshot = await getDocs(stationsRef);

        const stationsData = [];

        // for...of 문을 사용하여 각 정류장별 서브 컬렉션(shuttles)도 순차적으로 가져옵니다.
        for (const stationDoc of stationSnapshot.docs) {
            const station = stationDoc.data();
            const stationId = stationDoc.id;

            // 해당 정류장의 하위 'shuttles' 컬렉션 조회
            const shuttlesRef = collection(db, 'stations', stationId, 'shuttles');
            const shuttleSnapshot = await getDocs(shuttlesRef);

            const shuttles = shuttleSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // 정류장의 마커 색상을 결정하기 위해 출/퇴근 타입 판별
            const hasWork = shuttles.some((s: any) => s.type === 'work');
            const hasLeave = shuttles.some((s: any) => s.type === 'leave');

            let markerType = 'none';
            if (hasWork && hasLeave) markerType = 'both';
            else if (hasWork) markerType = 'go';
            else if (hasLeave) markerType = 'leave';

            stationsData.push({
                id: stationId,
                lat: station.lat,
                lng: station.lng,
                type: markerType, // MapPage에서 마커 필터링할 때 사용할 타입
                shuttles: shuttles // 셔틀 상세 정보 배열
            });
        }

        return stationsData;
    } catch (error) {
        console.error("데이터 조회 실패:", error);
        throw error; // 에러를 던져서 UI 단에서 처리할 수 있게 함
    }
};

/**
 * ✨ 혼잡도 간편 업데이트 함수
 */
export const updateShuttleCongestion = async (stationId: string, shuttleId: string, newCongestion: string) => {
    try {
        // stations/{stationId}/shuttles/{shuttleId} 문서 참조
        const shuttleRef = doc(db, 'stations', stationId, 'shuttles', shuttleId);

        await updateDoc(shuttleRef, {
            congestion: newCongestion,
            congestionUpdatedAt: serverTimestamp() // ✨ 현재 서버 시간으로 기록
        });

        return { success: true };
    } catch (error) {
        console.error("혼잡도 업데이트 실패:", error);
        throw error;
    }
};

/**
 * 수정/삭제 요청 제출
 */
export const submitShuttleRequest = async (requestData: any) => {
    try {
        const requestsRef = collection(db, 'requests');
        await addDoc(requestsRef, {
            ...requestData,
            status: 'PENDING',
            createdAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("요청 제출 실패:", error);
        throw error;
    }
};