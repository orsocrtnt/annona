# Modules futurs — Phase 2

Architecture anticipée pour les modules métier à développer.

## Modules planifiés

### 1. Gestion des commandes (`features/orders/`)

```
domains/order/
├── order.service.ts
├── order.types.ts
└── order.repository.ts

features/orders/
├── components/
│   ├── order-list.tsx
│   ├── order-detail.tsx
│   └── order-form.tsx
├── hooks/
│   └── use-orders.ts
└── mock-data.ts (à supprimer)

app/(back-office)/dashboard/orders/
app/(client-portal)/portal/orders/  ← existe (structure)
app/api/orders/
```

**Tables** : `Order`, `OrderItem`
**Permissions** : `orders:read`, `orders:create`, `orders:update`

---

### 2. Gestion des livraisons (`features/deliveries/`)

```
domains/delivery/
features/deliveries/
app/(back-office)/dashboard/deliveries/
app/(back-office)/dispatch/deliveries/
app/api/deliveries/
```

**Tables** : `Delivery`, `DeliveryStatus`, `DeliveryItem`
**Permissions** : `deliveries:*`, `deliveries:dispatch`

---

### 3. Dispatch automatique (`features/dispatch/`)

```
domains/dispatch/
├── dispatch.service.ts
├── dispatch.algorithm.ts
└── dispatch.types.ts

features/dispatch/
├── components/
│   ├── dispatch-board.tsx
│   ├── dispatch-map.tsx
│   └── driver-assignment.tsx
```

**Dépendances** : Deliveries, Drivers, Vehicles, GPS

---

### 4. Tracking GPS (`features/tracking/`)

```
domains/tracking/
services/tracking/
├── gps-provider.ts
└── realtime.ts

features/tracking/
├── components/
│   ├── live-map.tsx
│   └── tracking-timeline.tsx
```

**Tables** : `TrackingEvent`
**Services** : WebSocket, Mapbox/Google Maps

---

### 5. Cartographie (`features/maps/`)

```
features/maps/
├── components/
│   ├── fleet-map.tsx
│   ├── route-map.tsx
│   └── zone-map.tsx
services/maps/
└── mapbox.ts
```

---

### 6. Optimisation de tournées (`features/routing/`)

```
domains/routing/
├── routing.service.ts
└── routing.algorithm.ts
```

**Dépendances** : Deliveries, Vehicles, Maps

---

### 7. Gestion de flotte (`features/fleet/`)

```
domains/vehicle/
features/fleet/
app/(back-office)/dashboard/fleet/
app/api/vehicles/
```

**Tables** : `Vehicle`, `VehicleMaintenance`

---

### 8. Facturation (`features/billing/`)

```
domains/invoice/
features/billing/
app/(back-office)/dashboard/billing/
app/(client-portal)/portal/invoices/  ← existe (structure)
app/api/invoices/
```

**Tables** : `Invoice`, `InvoiceItem`, `Payment`

---

### 9. Analytics (`features/analytics/`)

```
domains/analytics/
features/analytics/
├── components/
│   ├── kpi-dashboard.tsx
│   ├── delivery-metrics.tsx
│   └── revenue-chart.tsx
app/(back-office)/dashboard/analytics/
app/(back-office)/admin/analytics/
```

**Permissions** : `analytics:read`

---

### 10. Notifications (`features/notifications/`)

```
domains/notification/
services/notifications/
├── email.ts
├── push.ts
└── in-app.ts

features/notifications/
├── components/
│   ├── notification-bell.tsx
│   └── notification-list.tsx
```

**Tables** : `Notification`, `NotificationPreference`

---

## Pattern d'ajout d'un module

1. **Schéma Prisma** : Ajouter les modèles dans `schema.prisma`
2. **Migration** : `npm run db:migrate`
3. **Domain** : Créer le service dans `domains/{entity}/`
4. **Permissions** : Ajouter dans seed + RBAC
5. **Validation** : Schémas Zod dans `lib/validations/`
6. **API** : Routes dans `app/api/{resource}/`
7. **Feature** : Composants dans `features/{module}/`
8. **Pages** : Routes dans le layout approprié
9. **Navigation** : Ajouter dans `nav-config.ts`
10. **Tests** : Couvrir le domain service

## Dépendances inter-modules

```
Orders ──► Deliveries ──► Tracking
                │
                ├──► Dispatch ──► Routing
                │
                └──► Drivers ──► Fleet (Vehicles)

Deliveries ──► Billing (Invoices)
All ──► Notifications
All ──► Analytics
```

## Capacité

L'architecture actuelle supporte :
- **Multi-tenant** : milliers d'entreprises via `companyId`
- **RBAC extensible** : permissions granulaires
- **Modularité** : ajout de modules sans refactoring
- **Scalabilité** : Server Components + API Routes + cache React Query
