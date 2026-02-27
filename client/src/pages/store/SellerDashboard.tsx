/**
 * SellerDashboard.tsx — Redirect shim
 *
 * This page has been consolidated into StoreDashboard.
 * Any old links to /store/seller will redirect automatically.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SellerDashboard() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/store/dashboard", { replace: true });
  }, []);
  return null;
}
