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

const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
};

module.exports = {
  distanceMeters,
  isInsideGeofence,
  formatDistance,
};
