import { db } from './firebase';
import {
    serverTimestamp,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    setDoc,
    getDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
    getCountFromServer,
    runTransaction
} from 'firebase/firestore';
import { getDistance } from '../utils/mapUtils';

const STATION_POSITION_MERGE_RADIUS_METERS = 1;
const METERS_PER_LAT_DEGREE = 111320;

export interface ShuttleData {
    name: string;
    company: string;
    type: 'work' | 'leave';
    boardingTime: string;
    alightingTime: string;
    destinationAddress: string;
    destinationX: number;
    destinationY: number;
    congestion: string; // '여유' | '적당' | '부족' 등
    congestionUpdatedAt: any;
    days: string[];     // 운행 요일 (예: ['월', '화', '수', '목', '금'])
    addedBy: string;    // 등록한 유저의 UID
}

interface FavoriteShuttlePayload {
    id: string;
    stationId?: string;
    name: string;
    company: string;
    type: 'work' | 'leave';
    boardingTime?: string;
    alightingTime?: string;
}

interface ShuttleReviewPayload {
    content: string;
    userId: string;
}

interface ShuttleUpdatePayload {
    boardingTime: string;
    alightingTime: string;
    congestion: string;
    isDelete: boolean;
    changedByUid: string;
    beforeData: {
        boardingTime: string;
        alightingTime: string;
        congestion: string;
        enable: boolean;
    };
}

export const buildFavoriteShuttleKey = (stationId: string, shuttleId: string) => `${stationId}_${shuttleId}`;

export const getShuttlecockNickname = async (uid: string, fallback = '익명') => {
    if (!uid || uid === 'anonymous') return fallback;

    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return fallback;
        const data = userSnap.data() as any;
        const nickname = (data?.nickname || data?.userNickname || '').trim();
        return nickname || fallback;
    } catch (error) {
        console.error('닉네임 조회 실패:', error);
        return fallback;
    }
};

export const setShuttlecockNickname = async (uid: string, nickname: string) => {
    if (!uid) {
        throw new Error('유효한 uid가 필요합니다.');
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
        throw new Error('닉네임은 비어 있을 수 없습니다.');
    }

    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
        nickname: trimmedNickname,
        updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true, nickname: trimmedNickname };
};

/**
 * 셔틀 정보를 Firestore에 저장
 * - 정류장 명칭은 UI에서 200m 기준으로 기존 명칭을 재사용할 수 있음
 * - 저장 시 마커 좌표는 사용자가 선택한 위치를 유지해야 하므로
 *   "동일 위치(1m 이내)"일 때만 기존 정류장 문서에 합칩니다.
 */
export const saveShuttleInfo = async (lat: number, lng: number, shuttle: ShuttleData, stationName: string) => {
    try {
        const stationsRef = collection(db, 'stations');
        const querySnapshot = await getDocs(stationsRef);
        const addedByNickname = await getShuttlecockNickname(shuttle.addedBy, '익명');

        let targetStationId = "";
        let targetStationName = "";
        let nearestDistance = Infinity;

        // 1. 동일 위치(1m 이내) 기존 정류장이 있는지 전수 조사 (최근접 정류장 우선)
        querySnapshot.forEach((stationDoc) => {
            const data = stationDoc.data();
            const distance = getDistance(lat, lng, data.lat, data.lng);
            if (distance <= STATION_POSITION_MERGE_RADIUS_METERS && distance < nearestDistance) {
                targetStationId = stationDoc.id;
                targetStationName = data.stationName || "";
                nearestDistance = distance;
            }
        });

        const finalData = {
            ...shuttle,
            createdAt: serverTimestamp(),          // 전체 문서 생성 시간
            congestionUpdatedAt: serverTimestamp(), // ✨ 초기 혼잡도 업데이트 시간 설정
            enable: true                            // 기본 활성화 상태
        };

        const createInitialHistory = async (stationId: string, shuttleId: string) => {
            const historyRef = collection(db, 'stations', stationId, 'shuttles', shuttleId, 'histories');
            await addDoc(historyRef, {
                changedByUid: shuttle.addedBy || 'anonymous',
                changedByNickname: addedByNickname,
                beforeData: null,
                afterData: {
                    boardingTime: shuttle.boardingTime || '',
                    alightingTime: shuttle.alightingTime || '',
                    congestion: shuttle.congestion || '보통',
                    enable: true
                },
                reportUserIds: [],
                reportCount: 0,
                historyType: 'CREATE',
                createdAt: serverTimestamp()
            });
        };

        if (targetStationId) {
            if (!targetStationName && stationName) {
                const stationRef = doc(db, 'stations', targetStationId);
                await updateDoc(stationRef, {
                    stationName,
                    updatedAt: serverTimestamp()
                });
            }

            // 2-A. 기존 정류장이 있다면 'shuttles' 서브 컬렉션에 추가
            const shuttleSubColRef = collection(db, 'stations', targetStationId, 'shuttles');
            const newShuttleDocRef = await addDoc(shuttleSubColRef, finalData);
            await createInitialHistory(targetStationId, newShuttleDocRef.id);
            return { success: true, message: "기존 정류장에 새로운 셔틀 정보가 추가되었습니다." };
        } else {
            // 2-B. 새로운 정류장이라면 새 문서 생성 후 'shuttles' 추가
            const newStationDocRef = await addDoc(stationsRef, {
                lat,
                lng,
                stationName,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            const shuttleSubColRef = collection(db, 'stations', newStationDocRef.id, 'shuttles');
            const newShuttleDocRef = await addDoc(shuttleSubColRef, finalData);
            await createInitialHistory(newStationDocRef.id, newShuttleDocRef.id);
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
                stationId,
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
                stationName: station.stationName || '',
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

interface StationBounds {
    south: number;
    west: number;
    north: number;
    east: number;
}

const isLngInBounds = (lng: number, west: number, east: number) => {
    // anti-meridian 케이스도 안전하게 처리
    if (west <= east) {
        return lng >= west && lng <= east;
    }
    return lng >= west || lng <= east;
};

const isInBounds = (lat: number, lng: number, bounds: StationBounds) => {
    return lat >= bounds.south &&
        lat <= bounds.north &&
        isLngInBounds(lng, bounds.west, bounds.east);
};

const expandBounds = (bounds: StationBounds, paddingMeters: number): StationBounds => {
    const centerLat = (bounds.south + bounds.north) / 2;
    const latPadding = paddingMeters / METERS_PER_LAT_DEGREE;
    const safeCos = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.0001);
    const lngPadding = paddingMeters / (METERS_PER_LAT_DEGREE * safeCos);

    return {
        south: bounds.south - latPadding,
        west: bounds.west - lngPadding,
        north: bounds.north + latPadding,
        east: bounds.east + lngPadding
    };
};

export const fetchStationsInBounds = async (bounds: StationBounds, paddingMeters = 400) => {
    try {
        const stationsRef = collection(db, 'stations');
        const stationSnapshot = await getDocs(stationsRef);
        const expandedBounds = expandBounds(bounds, paddingMeters);

        const targetStationDocs = stationSnapshot.docs.filter((stationDoc) => {
            const station = stationDoc.data();
            return isInBounds(station.lat, station.lng, expandedBounds);
        });

        const stationsData = [];

        for (const stationDoc of targetStationDocs) {
            const station = stationDoc.data();
            const stationId = stationDoc.id;

            const shuttlesRef = collection(db, 'stations', stationId, 'shuttles');
            const shuttleSnapshot = await getDocs(shuttlesRef);
            const shuttles = shuttleSnapshot.docs.map(doc => ({
                id: doc.id,
                stationId,
                ...doc.data()
            }));

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
                stationName: station.stationName || '',
                type: markerType,
                shuttles
            });
        }

        return stationsData;
    } catch (error) {
        console.error("영역 기반 데이터 조회 실패:", error);
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

export const applyShuttleUpdate = async (
    stationId: string,
    shuttleId: string,
    payload: ShuttleUpdatePayload
) => {
    const changedByNickname = await getShuttlecockNickname(payload.changedByUid, '익명');
    const shuttleRef = doc(db, 'stations', stationId, 'shuttles', shuttleId);
    await updateDoc(shuttleRef, {
        boardingTime: payload.boardingTime,
        alightingTime: payload.alightingTime,
        congestion: payload.congestion,
        congestionUpdatedAt: serverTimestamp(),
        enable: payload.isDelete ? false : true,
        updatedAt: serverTimestamp()
    });

    const historyRef = collection(db, 'stations', stationId, 'shuttles', shuttleId, 'histories');
    await addDoc(historyRef, {
        changedByUid: payload.changedByUid,
        changedByNickname: changedByNickname,
        beforeData: payload.beforeData,
        afterData: {
            boardingTime: payload.boardingTime,
            alightingTime: payload.alightingTime,
            congestion: payload.congestion,
            enable: payload.isDelete ? false : true
        },
        reportUserIds: [],
        reportCount: 0,
        createdAt: serverTimestamp()
    });
    return { success: true };
};

export const fetchShuttleHistories = async (stationId: string, shuttleId: string) => {
    const historiesRef = collection(db, 'stations', stationId, 'shuttles', shuttleId, 'histories');
    const historiesQuery = query(historiesRef, orderBy('createdAt', 'desc'), limit(200));
    const snapshot = await getDocs(historiesQuery);
    return snapshot.docs.map((historyDoc) => ({
        id: historyDoc.id,
        ...historyDoc.data()
    }));
};

export const reportShuttleHistory = async (
    stationId: string,
    shuttleId: string,
    historyId: string,
    reporterUid: string
) => {
    const historyRef = doc(db, 'stations', stationId, 'shuttles', shuttleId, 'histories', historyId);

    return runTransaction(db, async (transaction) => {
        const historySnap = await transaction.get(historyRef);
        if (!historySnap.exists()) {
            throw new Error('신고할 히스토리를 찾을 수 없습니다.');
        }

        const historyData = historySnap.data() as any;
        const changedByUid = historyData.changedByUid;
        const reportUserIds: string[] = Array.isArray(historyData.reportUserIds)
            ? historyData.reportUserIds
            : [];

        if (reportUserIds.includes(reporterUid)) {
            return { alreadyReported: true, reportCount: reportUserIds.length, restricted: false };
        }

        const nextReportUserIds = [...reportUserIds, reporterUid];
        const nextCount = nextReportUserIds.length;
        transaction.update(historyRef, {
            reportUserIds: nextReportUserIds,
            reportCount: nextCount,
            updatedAt: serverTimestamp()
        });

        let restricted = false;
        if (changedByUid && nextCount >= 5) {
            const userRef = doc(db, 'users', changedByUid);
            transaction.set(userRef, {
                editRestricted: true,
                editRestrictedAt: serverTimestamp()
            }, { merge: true });
            restricted = true;
        }

        return { alreadyReported: false, reportCount: nextCount, restricted };
    });
};

export const isUserEditRestricted = async (uid: string) => {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return false;
    const data = snap.data() as any;
    return data.editRestricted === true;
};

export const fetchFavoriteShuttleKeys = async (uid: string) => {
    const favoritesRef = collection(db, 'users', uid, 'favoriteShuttles');
    const snapshot = await getDocs(favoritesRef);
    const keys = new Set<string>();

    snapshot.forEach((favoriteDoc) => {
        keys.add(favoriteDoc.id);
    });

    return keys;
};

export const toggleFavoriteShuttle = async (uid: string, shuttle: FavoriteShuttlePayload) => {
    if (!shuttle.stationId) {
        throw new Error('stationId가 없는 셔틀은 즐겨찾기할 수 없습니다.');
    }

    const favoriteKey = buildFavoriteShuttleKey(shuttle.stationId, shuttle.id);
    const favoriteRef = doc(db, 'users', uid, 'favoriteShuttles', favoriteKey);
    const favoriteSnap = await getDoc(favoriteRef);

    if (favoriteSnap.exists()) {
        await deleteDoc(favoriteRef);
        return { isFavorite: false };
    }

    await setDoc(favoriteRef, {
        stationId: shuttle.stationId,
        shuttleId: shuttle.id,
        name: shuttle.name,
        company: shuttle.company,
        type: shuttle.type,
        boardingTime: shuttle.boardingTime || '',
        alightingTime: shuttle.alightingTime || '',
        createdAt: serverTimestamp()
    });
    return { isFavorite: true };
};

export const fetchShuttleReviewCount = async (stationId: string, shuttleId: string) => {
    const reviewsRef = collection(db, 'stations', stationId, 'shuttles', shuttleId, 'reviews');
    const snapshot = await getCountFromServer(reviewsRef);
    return snapshot.data().count;
};

export const fetchShuttleReviews = async (stationId: string, shuttleId: string) => {
    const reviewsRef = collection(db, 'stations', stationId, 'shuttles', shuttleId, 'reviews');
    const reviewsQuery = query(reviewsRef, orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(reviewsQuery);
    return snapshot.docs.map((reviewDoc) => ({
        id: reviewDoc.id,
        ...reviewDoc.data()
    }));
};

export const addShuttleReview = async (stationId: string, shuttleId: string, payload: ShuttleReviewPayload) => {
    const userNickname = await getShuttlecockNickname(payload.userId, '익명');
    const reviewsRef = collection(db, 'stations', stationId, 'shuttles', shuttleId, 'reviews');
    await addDoc(reviewsRef, {
        content: payload.content,
        userId: payload.userId,
        userNickname,
        createdAt: serverTimestamp()
    });
    return { success: true, userNickname };
};
