export interface PublicCateringProvider {
  id: string;
  displayName: string;
  avatar: string | null;
  specialty: string | null;
  cateringBio: string | null;
  cateringLocation: string | null;
  cateringRadius: number | null;
  cateringAvailable: boolean;
  cateringEnabled: boolean;
  distance?: number;
}

