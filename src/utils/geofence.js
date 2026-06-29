const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const distanceMeters = ({ lat1, lng1, lat2, lng2 }) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

const isInsideGeofence = ({
  userLat,
  userLng,
  branchLat,
  branchLng,
  radiusMeters,
}) =>
  distanceMeters({
    lat1: userLat,
    lng1: userLng,
    lat2: branchLat,
    lng2: branchLng,
  }) <= radiusMeters;

/** Ray casting with x = longitude, y = latitude. Ring entries are [lat, lng]. */
const pointInPolygonLngLat = (latitude, longitude, ring) => {
  if (!Array.isArray(ring) || ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];
    const intersect =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi + 1e-20) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
};

const normalizeBoundaryPoints = (boundaryPoints) => {
  if (!Array.isArray(boundaryPoints)) return [];

  return boundaryPoints
    .map((point) => ({
      lat: Number(point?.lat),
      lng: Number(point?.lng),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
};

const boundaryPointsToRing = (boundaryPoints) =>
  normalizeBoundaryPoints(boundaryPoints).map((point) => [point.lat, point.lng]);

const isInsideBranchGeofence = ({ userLat, userLng, branch }) => {
  const geofenceType = branch?.geofenceType || 'circle';

  if (geofenceType === 'polygon') {
    const ring = boundaryPointsToRing(branch.boundaryPoints);
    if (ring.length >= 3) {
      return pointInPolygonLngLat(userLat, userLng, ring);
    }
  }

  return isInsideGeofence({
    userLat,
    userLng,
    branchLat: branch.latitude,
    branchLng: branch.longitude,
    radiusMeters: branch.radiusMeters,
  });
};

const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
};

module.exports = {
  distanceMeters,
  isInsideGeofence,
  pointInPolygonLngLat,
  normalizeBoundaryPoints,
  boundaryPointsToRing,
  isInsideBranchGeofence,
  formatDistance,
};
