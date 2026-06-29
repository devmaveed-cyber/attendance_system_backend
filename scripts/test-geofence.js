const {
  pointInPolygonLngLat,
  isInsideBranchGeofence,
  isInsideGeofence,
} = require('../src/utils/geofence');

const square = [
  [25.0, 55.0],
  [25.0, 55.01],
  [25.01, 55.01],
  [25.01, 55.0],
];

const inside = pointInPolygonLngLat(25.005, 55.005, square);
const outside = pointInPolygonLngLat(25.02, 55.02, square);

if (!inside || outside) {
  console.error('pointInPolygonLngLat failed');
  process.exit(1);
}

const polygonBranch = {
  geofenceType: 'polygon',
  latitude: 25.005,
  longitude: 55.005,
  radiusMeters: 50,
  boundaryPoints: square.map(([lat, lng]) => ({ lat, lng })),
};

if (
  !isInsideBranchGeofence({
    userLat: 25.005,
    userLng: 55.005,
    branch: polygonBranch,
  })
) {
  console.error('isInsideBranchGeofence polygon inside failed');
  process.exit(1);
}

if (
  isInsideBranchGeofence({
    userLat: 25.02,
    userLng: 55.02,
    branch: polygonBranch,
  })
) {
  console.error('isInsideBranchGeofence polygon outside failed');
  process.exit(1);
}

const circleBranch = {
  geofenceType: 'circle',
  latitude: 25.0,
  longitude: 55.0,
  radiusMeters: 200,
  boundaryPoints: [],
};

if (
  !isInsideBranchGeofence({
    userLat: 25.001,
    userLng: 55.001,
    branch: circleBranch,
  })
) {
  console.error('isInsideBranchGeofence circle inside failed');
  process.exit(1);
}

if (
  !isInsideGeofence({
    userLat: 25.001,
    userLng: 55.001,
    branchLat: 25.0,
    branchLng: 55.0,
    radiusMeters: 200,
  })
) {
  console.error('isInsideGeofence circle failed');
  process.exit(1);
}

console.log('Geofence tests passed.');
