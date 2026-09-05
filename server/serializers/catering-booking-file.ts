import { mayDeleteCateringFile, type CateringBookingFileView, type CateringFileVisibility } from "@shared/catering-booking-files";
import type { CateringBookingStatus } from "@shared/catering-bookings";

export type SerializableBookingFile = {
  id: string; visibility: string; originalFilename: string; contentType: string; byteSize: number;
  uploadedBy: string; createdAt: Date; deletedAt: Date | null;
};
export type BookingFileContext = { providerId: string; customerId: string; actorId: string; status: CateringBookingStatus; names: ReadonlyMap<string, string | null> };

/**
 * Serializes one booking file for one actor.
 *
 * `storageKey` and `storageProvider` are deliberately absent, and so is any URL: the only route to the bytes is the
 * authorized download endpoint, which re-derives the booking, the participant and the visibility on every request.
 * There is therefore no reusable, permanent or public address for a booking document anywhere in a list response.
 * `mayDelete` is the same uploader-ownership and lifecycle rule the DELETE route enforces, computed here only so the
 * UI can hide a control it would refuse anyway -- the server never trusts it.
 */
export function serializeBookingFile(row: SerializableBookingFile, context: BookingFileContext): CateringBookingFileView {
  const uploadedByRole = row.uploadedBy === context.providerId ? "provider" as const : "customer" as const;
  return {
    id: row.id,
    visibility: row.visibility as CateringFileVisibility,
    filename: row.originalFilename,
    contentType: row.contentType,
    byteSize: Number(row.byteSize),
    uploadedBy: row.uploadedBy,
    uploadedByRole,
    uploaderName: context.names.get(row.uploadedBy) ?? null,
    createdAt: row.createdAt.toISOString(),
    mine: row.uploadedBy === context.actorId,
    mayDelete: mayDeleteCateringFile(context.actorId, { uploadedBy: row.uploadedBy, deletedAt: row.deletedAt === null ? null : row.deletedAt.toISOString() }, context.status),
  };
}
