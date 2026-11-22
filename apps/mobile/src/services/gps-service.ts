export interface GpsPosition {
  latitude: number;
  longitude: number;
}

export interface LocationProvider {
  requestPermission(): Promise<'granted' | 'denied'>;
  getCurrentPosition(): Promise<GpsPosition>;
}

// AC7: The report records GPS position (if permission is granted) and the device time it was created.
// Missing GPS does not block submission.
export async function captureGpsPosition(
  provider?: LocationProvider,
): Promise<GpsPosition | null> {
  if (!provider) {
    return null;
  }
  try {
    const status = await provider.requestPermission();
    if (status !== 'granted') {
      return null;
    }
    const pos = await provider.getCurrentPosition();
    if (
      typeof pos?.latitude === 'number' &&
      typeof pos?.longitude === 'number' &&
      pos.latitude >= -90 &&
      pos.latitude <= 90 &&
      pos.longitude >= -180 &&
      pos.longitude <= 180
    ) {
      return {
        latitude: Number(pos.latitude.toFixed(6)),
        longitude: Number(pos.longitude.toFixed(6)),
      };
    }
    return null;
  } catch {
    return null;
  }
}
