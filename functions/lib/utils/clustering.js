"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMatchingCluster = findMatchingCluster;
const admin = require("firebase-admin");
const haversine_1 = require("./haversine");
async function findMatchingCluster(category, lat, lng, submittedAt) {
    const sevenDaysAgo = new Date(submittedAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    const snapshot = await admin.firestore()
        .collection('clusters')
        .where('category', '==', category)
        .where('status', '==', 'active')
        .where('created_at', '>=', sevenDaysAgo)
        .get();
    if (snapshot.empty)
        return null;
    let closest = null;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const distance = (0, haversine_1.haversineMeters)(lat, lng, data.centroid_lat, data.centroid_lng);
        if (distance <= 50) {
            if (!closest || distance < closest.distance) {
                closest = { clusterId: doc.id, centroid_lat: data.centroid_lat, centroid_lng: data.centroid_lng, distance };
            }
        }
    }
    return closest ? { clusterId: closest.clusterId, centroid_lat: closest.centroid_lat, centroid_lng: closest.centroid_lng } : null;
}
//# sourceMappingURL=clustering.js.map