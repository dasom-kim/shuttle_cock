export const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return "정보 없음";

    const date = timestamp.toDate(); // Firestore Timestamp를 JS Date로 변환
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000; // 초 단위 차이

    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};