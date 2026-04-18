const REVERSE_GEOCODE_ENDPOINT = '/api/naver-reverse';
const GEOCODE_ENDPOINT = '/api/naver-geocode';

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

const extractStationNameFromResponse = (data: any) => {
    const roadResult = data?.results?.find((item: any) => item?.name === 'roadaddr');
    const addrResult = data?.results?.find((item: any) => item?.name === 'addr');
    const additionName = extractLandAdditionName(roadResult) || extractLandAdditionName(addrResult);
    const parsedFromResults = buildLegacyAddress(roadResult) || buildLegacyAddress(addrResult);

    return (
        additionName ||
        parsedFromResults ||
        data?.v2?.address?.roadAddress ||
        data?.v2?.address?.jibunAddress ||
        ''
    ).trim();
};

const reverseGeocodeByNaverMapSDK = (lat: number, lng: number) =>
    new Promise<string>((resolve, reject) => {
        const naverAny = (window as any)?.naver;
        const service = naverAny?.maps?.Service;
        if (!service?.reverseGeocode) {
            reject(new Error('Naver Maps geocoder module is unavailable.'));
            return;
        }

        service.reverseGeocode(
            {
                coords: new naverAny.maps.LatLng(lat, lng),
                orders: 'roadaddr,addr',
                output: 'json'
            },
            (_status: any, response: any) => {
                const stationName = extractStationNameFromResponse(response);
                resolve(stationName || '');
            }
        );
    });

export const reverseGeocodeNcloud = async (lat: number, lng: number) => {
    const params = new URLSearchParams({
        coords: `${lng},${lat}`,
        orders: 'roadaddr,addr',
        output: 'json'
    });

    try {
        const response = await fetch(`${REVERSE_GEOCODE_ENDPOINT}?${params.toString()}`, {
            method: 'GET'
        });

        if (!response.ok) {
            throw new Error(`Reverse geocode failed: ${response.status}`);
        }

        const data = await response.json();
        const stationName = extractStationNameFromResponse(data);
        if (stationName) return stationName;
    } catch (error) {
        console.warn('Ncloud reverse geocode failed, fallback to naver maps sdk geocoder.', error);
    }

    try {
        const sdkStationName = await reverseGeocodeByNaverMapSDK(lat, lng);
        if (sdkStationName) return sdkStationName;
    } catch (error) {
        console.warn('Naver Maps SDK reverse geocode fallback failed.', error);
    }

    return '정류장 정보';
};

export interface GeocodeAddressResult {
    roadAddress: string;
    jibunAddress: string;
    x: number;
    y: number;
}

export const geocodeAddressNcloud = async (query: string) => {
    const keyword = query.trim();
    if (!keyword) return [];

    const params = new URLSearchParams({
        query: keyword,
        count: '10'
    });

    const response = await fetch(`${GEOCODE_ENDPOINT}?${params.toString()}`, {
        method: 'GET'
    });

    if (!response.ok) {
        throw new Error(`Geocode failed: ${response.status}`);
    }

    const data = await response.json();
    const addresses = Array.isArray(data?.addresses) ? data.addresses : [];

    return addresses
        .map((item: any) => ({
            roadAddress: (item?.roadAddress || '').trim(),
            jibunAddress: (item?.jibunAddress || '').trim(),
            x: Number(item?.x),
            y: Number(item?.y)
        }))
        .filter((item: GeocodeAddressResult) => Number.isFinite(item.x) && Number.isFinite(item.y));
};
