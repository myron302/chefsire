import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { CateringCustomerInquiryPage, CateringCustomerInquiryView } from "@shared/catering-inquiries";
import { CATERING_CUSTOMER_REQUESTS_SECTION } from "@shared/catering-inquiries";
import { cateringBookingWorkspacePath } from "@shared/catering-booking-operations";
import { formatCateringCalendarDate } from "@shared/catering-availability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  CATERING_CUSTOMER_INQUIRY_PAGE_SIZE, cateringCustomerInquiriesKey, cateringInquiryWithdrawalInvalidationKeys,
  customerInquiryActions, customerInquiryPageLabel, customerInquiryPresentation, settleWithdrawalDialog,
  type WithdrawalDialogTarget,
} from "@/pages/services/catering-customer-inquiry-state";

async function fetchCustomerInquiries(page: number): Promise<CateringCustomerInquiryPage> {
  const response = await fetch(`/api/catering/inquiries/mine?page=${page}&limit=${CATERING_CUSTOMER_INQUIRY_PAGE_SIZE}`, { credentials: "include" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Your catering requests could not be loaded");
  return body;
}

async function withdrawInquiry(inquiryId: string): Promise<void> {
  const response = await fetch(`/api/catering/inquiries/${encodeURIComponent(inquiryId)}/withdraw`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "The request could not be withdrawn");
}

function RequestCard({ inquiry, onWithdraw }: { inquiry: CateringCustomerInquiryView; onWithdraw: (inquiry: CateringCustomerInquiryView) => void }) {
  const presentation = customerInquiryPresentation(inquiry.stage);
  const actions = customerInquiryActions(inquiry);
  const shared = [inquiry.contactEmail, inquiry.contactPhone].filter(Boolean).join(" · ");
  return (
    <article className="min-w-0 rounded-lg border p-4" aria-labelledby={`request-${inquiry.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`request-${inquiry.id}`} className="break-words font-semibold">{inquiry.eventType || inquiry.packageTitle || "Catering request"} with {inquiry.provider.displayName}</h3>
          <p className="break-words text-sm text-muted-foreground">
            Event date: {formatCateringCalendarDate(inquiry.eventDate)}{inquiry.guestCount ? ` · ${inquiry.guestCount} guests` : ""}
          </p>
          {inquiry.submittedAt && <p className="text-xs text-muted-foreground">Sent {new Date(inquiry.submittedAt).toLocaleDateString()}</p>}
        </div>
        <Badge variant="outline" className="whitespace-normal text-left">{presentation.terminal ? `Closed: ${presentation.label}` : presentation.label}</Badge>
      </div>
      <p className="mt-2 text-sm" role="status">{presentation.description}</p>
      {inquiry.booking?.status === "pending_confirmation" && inquiry.booking.agreedPrice && (
        <p className="mt-1 text-sm">Offered price: {inquiry.booking.currency} {inquiry.booking.agreedPrice}</p>
      )}
      {inquiry.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{inquiry.message}</p>}
      {shared && <p className="mt-1 break-words text-xs text-muted-foreground">Shared with the caterer: {shared}</p>}
      {(actions.withdraw || actions.viewBookingId) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.viewBookingId && (
            <Button className="min-h-11" variant="outline" asChild>
              <Link href={cateringBookingWorkspacePath("customer", actions.viewBookingId)}>{inquiry.stage === "offered" ? "Review offer" : "View booking"}</Link>
            </Button>
          )}
          {actions.withdraw && (
            <Button className="min-h-11" variant="outline" onClick={() => onWithdraw(inquiry)}>Withdraw request</Button>
          )}
        </div>
      )}
    </article>
  );
}

export function CustomerInquiries({ userId }: { userId: string }) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<(WithdrawalDialogTarget & { providerId: string; label: string }) | null>(null);
  useEffect(() => { setPage(1); setTarget(null); }, [userId]);
  const query = useQuery({
    queryKey: [...cateringCustomerInquiriesKey(userId), page, CATERING_CUSTOMER_INQUIRY_PAGE_SIZE],
    queryFn: () => fetchCustomerInquiries(page),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const withdraw = useMutation({
    mutationFn: (variables: WithdrawalDialogTarget & { providerId: string }) => withdrawInquiry(variables.inquiryId),
    onSuccess: async (_data, variables) => {
      await Promise.all(cateringInquiryWithdrawalInvalidationKeys(variables).map((queryKey) => client.invalidateQueries({ queryKey })));
      setTarget((current) => settleWithdrawalDialog(current, variables));
    },
    // A refusal usually means the row changed under the customer (an offer arrived, the caterer answered): show the truth.
    onError: async () => { await client.invalidateQueries({ queryKey: cateringCustomerInquiriesKey(userId) }); },
  });
  const pageData = query.data;
  const submittingThis = withdraw.isPending && withdraw.variables?.inquiryId === target?.inquiryId;
  return (
    <Card id={CATERING_CUSTOMER_REQUESTS_SECTION}>
      <CardHeader>
        <CardTitle>My catering requests</CardTitle>
        <CardDescription>Requests you have sent to caterers, including ones that were declined or withdrawn. A request becomes a booking only after the caterer offers terms and you confirm them.</CardDescription>
      </CardHeader>
      <CardContent aria-busy={query.isFetching}>
        {query.isLoading ? <p role="status">Loading your requests…</p>
          : query.isError ? (
            <div role="alert" className="space-y-3">
              <p>Your requests could not be loaded. No empty list has been assumed.</p>
              <Button className="min-h-11" variant="outline" onClick={() => query.refetch()}>Retry</Button>
            </div>
          ) : pageData?.inquiries.length ? (
            <div className="space-y-3">
              {pageData.inquiries.map((inquiry) => (
                <RequestCard key={inquiry.id} inquiry={inquiry} onWithdraw={(item) => { withdraw.reset(); setTarget({ customerId: userId, inquiryId: item.id, providerId: item.provider.id, label: `${item.eventType || "catering request"} with ${item.provider.displayName}` }); }} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">You have not sent any catering requests yet. Find a caterer below and ask for a quote.</p>
          )}
        {withdraw.isSuccess && target === null && <p className="mt-3 text-sm" role="status">Request withdrawn. The caterer has been told.</p>}
        {pageData && pageData.pagination.totalPages > 1 && (
          <nav aria-label="Request pages" className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Button className="min-h-11" variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
            <span aria-live="polite">{customerInquiryPageLabel(page, pageData.pagination.totalPages)}</span>
            <Button className="min-h-11" variant="outline" disabled={page >= pageData.pagination.totalPages || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </nav>
        )}
      </CardContent>
      <AlertDialog open={target !== null} onOpenChange={(open) => { if (!open && !withdraw.isPending) setTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {target ? `Your ${target.label} will be marked as withdrawn and the caterer will be told. It stays in your history, and you can send a new request later.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {withdraw.isError && <p role="alert" className="text-sm text-destructive">{withdraw.error.message}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={withdraw.isPending}>Keep request</AlertDialogCancel>
            <Button className="min-h-11" variant="destructive" disabled={!target || withdraw.isPending}
              onClick={() => { if (target) withdraw.mutate({ customerId: target.customerId, inquiryId: target.inquiryId, providerId: target.providerId }); }}>
              {submittingThis ? "Withdrawing…" : "Withdraw request"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
