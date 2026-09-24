export interface TideStation {
  spotId: 'aewol' | 'hyeopjae' | 'hallim';
  stationId: string;
  stationName: string;
  lat: number;
  lng: number;
  distanceKm: number;
  tideSystem: 'south';
}

export const tideStations: TideStation[] = [
  {spotId: 'aewol', stationId: 'DT_0004', stationName: 'Jeju', lat: 33.4621, lng: 126.3092, distanceKm: 18.4, tideSystem: 'south'},
  {spotId: 'hyeopjae', stationId: 'DT_0023', stationName: 'Moseulpo', lat: 33.3945, lng: 126.2397, distanceKm: 24.8, tideSystem: 'south'},
  {spotId: 'hallim', stationId: 'DT_0023', stationName: 'Moseulpo', lat: 33.4107, lng: 126.267, distanceKm: 27.1, tideSystem: 'south'}
];

export function getTideStation(id: string) {
  return tideStations.find(station => station.spotId === id || station.stationId === id) ?? tideStations[0];
}

export function nearestTideStation(lat: number, lng: number) {
  return tideStations.reduce((nearest, station) => {
    const distance = (station.lat - lat) ** 2 + (station.lng - lng) ** 2;
    const best = (nearest.lat - lat) ** 2 + (nearest.lng - lng) ** 2;
    return distance < best ? station : nearest;
  });
}
