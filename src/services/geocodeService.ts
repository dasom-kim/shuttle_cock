const REVERSE_GEOCODE_ENDPOINT = '/api/naver-reverse';

const buildLegacyAddress = (result: any) => {
    const region = result?.region;
    const land = result?.land;

    const areaParts = [
        region?.area1?.name,
        region?.area2?.name,
        region?.area3?.name,
        region?.area4?.name
    ].filter(Boolean);

    const road = land?.name || '';
    const number1 = land?.number1 || '';
    const number2 = land?.number2 ? `-${land.number2}` : '';
    const roadNumber = `${number1}${number2}`.trim();

    return [areaParts.join(' '), road, roadNumber].filter(Boolean).join(' ').trim();
};

const extractLandAdditionName = (result: any) => {
    return result?.land?.addition0?.value?.trim?.() || '';
};

export const reverseGeocodeNcloud = async (lat: number, lng: number) => {
    const params = new URLSearchParams({
        coords: `${lng},${lat}`,
        orders: 'roadaddr,addr',
        output: 'json'
    });

    const response = await fetch(`${REVERSE_GEOCODE_ENDPOINT}?${params.toString()}`, {
        method: 'GET'
    });

    if (!response.ok) {
        throw new Error(`Reverse geocode failed: ${response.status}`);
    }

    const data = await response.json();
    const roadResult = data?.results?.find((item: any) => item?.name === 'roadaddr');
    const addrResult = data?.results?.find((item: any) => item?.name === 'addr');
    const additionName = extractLandAdditionName(roadResult) || extractLandAdditionName(addrResult);
    const parsedFromResults = buildLegacyAddress(roadResult) || buildLegacyAddress(addrResult);

    return (
        additionName ||
        parsedFromResults ||
        data?.v2?.address?.roadAddress ||
        data?.v2?.address?.jibunAddress ||
        '정류장 정보'
    );
};
