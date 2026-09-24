const RE = 6371.00877;
const GRID = 5.0;
const SLAT1 = 30.0;
const SLAT2 = 60.0;
const OLON = 126.0;
const OLAT = 38.0;
const XO = 43;
const YO = 136;

export function toKmaGrid(lat: number, lng: number) {
  const degrad = Math.PI / 180;
  const re = RE / GRID;
  const slat1 = SLAT1 * degrad;
  const slat2 = SLAT2 * degrad;
  const olon = OLON * degrad;
  const olat = OLAT * degrad;
  let sn = Math.tan(Math.PI * .25 + slat2 * .5) / Math.tan(Math.PI * .25 + slat1 * .5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * .25 + slat1 * .5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * .25 + olat * .5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * .25 + lat * degrad * .5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lng * degrad - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return {nx: Math.floor(ra * Math.sin(theta) + XO + .5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + .5)};
}
