/**
 * Regroupe des points déjà projetés en pixels : un point rejoint le premier groupe dont le
 * centre est à moins de `radius` pixels, sinon il ouvre un nouveau groupe. Simple et stable
 * (pas de dépendance), suffisant pour quelques centaines de livraisons.
 */
export type ProjectedPoint<T> = { item: T; x: number; y: number };
export type PointCluster<T> = { items: T[]; x: number; y: number };

export function clusterProjectedPoints<T>(points: ProjectedPoint<T>[], radius = 64): PointCluster<T>[] {
  const clusters: { items: T[]; sumX: number; sumY: number }[] = [];
  for (const point of points) {
    const target = clusters.find((cluster) => {
      const cx = cluster.sumX / cluster.items.length;
      const cy = cluster.sumY / cluster.items.length;
      return Math.hypot(point.x - cx, point.y - cy) < radius;
    });
    if (target) {
      target.items.push(point.item);
      target.sumX += point.x;
      target.sumY += point.y;
    } else {
      clusters.push({ items: [point.item], sumX: point.x, sumY: point.y });
    }
  }
  return clusters.map((cluster) => ({
    items: cluster.items,
    x: cluster.sumX / cluster.items.length,
    y: cluster.sumY / cluster.items.length,
  }));
}
