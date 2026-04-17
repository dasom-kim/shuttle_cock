// 1. 셔틀 상세 정보 (Sub-collection)
export interface Shuttle {
    id?: string;
    company: string;
    type: 'work' | 'leave';
    time: string;
    congestion: '여유' | '적당' | '만차';
    days: string[];
    addedBy: string;
    createdAt: Date;
}

// 2. 정류장 정보 (Main-collection)
export interface Station {
    id?: string; // Firestore Document ID
    lat: number;
    lng: number;
    name: string;
    shuttles?: Shuttle[]; // 조회 시 결합하여 사용
    createdAt: Date;
    updatedAt: Date;
}