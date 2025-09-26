// client/src/components/RequireAgeGate.tsx
import * as React from "react";
import AgeGate from "./AgeGate";
import { isAgeVerified } from "@/lib/ageGate";

type RequireAgeGateProps = {
  children: React.ReactNode;
};

/**
 * Wrap any 21+ page with <RequireAgeGate>…</RequireAgeGate>
 * If not verified, it shows the modal until user confirms 21+.
 */
export default function RequireAgeGate({ children }: RequireAgeGateProps) {
  const [open, setOpen] = React.useState<boolean>(() => !isAgeVerified());
  const handleClose = React.useCallback(() => {
    // Re-check after the dialog closes (user may have verified)
    setOpen(!isAgeVerified());
  }, []);

  return (
    <>
      {open && <AgeGate open={open} onClose={handleClose} />}
      {!open && children}
    </>
  );
}
