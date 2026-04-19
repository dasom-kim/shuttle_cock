const REVERSE_GEOCODE_ENDPOINT = '/api/naver-reverse';
const GEOCODE_ENDPOINT = '/api/naver-geocode';

const normalizeText = (value: unknown) => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

const pushIfValid = (bucket: string[], value: unknown) => {
    const text = normalizeText(value);
    if (!text) return;
    if (!bucket.includes(text)) {
        bucket.push(text);
    }
};

const collectBuildingCandidates = (value: any, bucket: string[] = []): string[] => {
    if (!value || typeof value !== 'object') return bucket;

    if (Array.isArray(value)) {
        value.forEach((item) => collectBuildingCandidates(item, bucket));
        return bucket;
    }

    pushIfValid(bucket, value?.land?.addition0?.value);
    pushIfValid(bucket, value?.building);
    pushIfValid(bucket, value?.buildingName);

    Object.entries(value).forEach(([key, child]) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('building') || lowerKey.includes('addition')) {
            if (typeof child === 'string') {
                pushIfValid(bucket, child);
            } else if (child && typeof child === 'object') {
                pushIfValid(bucket, (child as any).name);
                pushIfValid(bucket, (child as any).value);
                collectBuildingCandidates(child, bucket);
            }
            return;
        }
        if (child && typeof child === 'object') {
            collectBuildingCandidates(child, bucket);
        }
    });

    return bucket;
};

const pickBuildingName = (data: any) => {
    const candidates = collectBuildingCandidates(data);
    return candidates.find((item) => item.length > 0) || '';
};

const buildRoadAddressFromResult = (result: any) => {
    const region = result?.region;
    const land = result?.land;

    const areaParts = [
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

const extractStationNameFromResponse = (data: any) => {
    const roadResult = data?.results?.find((item: any) => item?.name === 'roadaddr');
    const addrResult = data?.results?.find((item: any) => item?.name === 'addr');
    const buildingName =
        pickBuildingName(roadResult) ||
        pickBuildingName(addrResult) ||
        pickBuildingName(data);
    const roadAddress =
        normalizeText(data?.v2?.address?.roadAddress)?.replace(/\s*\([^)]*\)\s*$/g, '').trim() ||
        buildRoadAddressFromResult(roadResult) ||
        '';

    return (
        buildingName ||
        roadAddress ||
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
