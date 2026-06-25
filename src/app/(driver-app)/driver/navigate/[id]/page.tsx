"use client";

import { useParams } from "next/navigation";
import { DriverNavigationScreen } from "@/features/driver/driver-navigation-screen";

export default function DriverNavigatePage() {
  const { id } = useParams<{ id: string }>();
  return <DriverNavigationScreen missionId={id} />;
}
