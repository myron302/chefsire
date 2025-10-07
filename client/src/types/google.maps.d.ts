// client/src/types/google.maps.d.ts
export {};

declare global {
  // Preferred: use official Google Maps types if installed
  const google: typeof import("@types/google.maps");

  // 👇 If you DON’T have @types/google.maps installed,
  // you can comment out the line above and uncomment this fallback:
  // const google: any;
}
