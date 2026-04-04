import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';

type WeddingFetchResult = {
  data: any;
  endpoint: string;
};

async function fetchWeddingWithFallback(endpoints: string[], init?: RequestInit): Promise<WeddingFetchResult> {
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        credentials: 'include',
        ...init,
      });

      if (!response.ok) {
        // Allow compatibility probing when an endpoint was renamed.
        if (response.status === 404) {
          continue;
        }

        const errorPayload = await response.json().catch(() => null);
        const message = errorPayload?.error || errorPayload?.message || `Request failed (${response.status})`;
        throw new Error(message);
      }

      const data = await response.json().catch(() => null);
      return { data, endpoint };
    } catch (error: any) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      lastError = normalizedError;

      // Only continue probing on likely route-drift/network cases.
      // For non-404 HTTP errors we fail fast to avoid duplicate writes.
      const message = normalizedError.message || '';
      const is404 = message.includes('(404)');
      const isNetwork = message.toLowerCase().includes('failed to fetch');
      if (!is404 && !isNetwork) {
        throw normalizedError;
      }
    }
  }

  throw lastError || new Error('No compatible wedding endpoint is available');
}

function normalizeQuotesResponse(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.quotes)) return payload.quotes;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function useVendors(filters?: Record<string, string | number | boolean | undefined | null>) {
  return useQuery({
    queryKey: ['vendors', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value === undefined || value === null || value === '') continue;
          params.set(key, String(value));
        }
      }

      const queryString = params.toString();
      const suffix = queryString ? `?${queryString}` : '';

      const { data } = await fetchWeddingWithFallback([
        `/api/wedding/vendors${suffix}`,
        `/api/wedding/vendor-listings${suffix}`,
      ]);

      // Be resilient to legacy and current shapes.
      return data?.vendors || data?.listings || data || [];
    }
  });
}

export function useRequestQuote() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const normalizedPayload = {
        ...data,
        weddingDate: data?.weddingDate || data?.eventDate,
        eventDate: data?.eventDate || data?.weddingDate,
      };

      const { data: responseData } = await fetchWeddingWithFallback(
        ['/api/wedding/vendor-quotes', '/api/wedding/quotes'],
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizedPayload),
        }
      );

      return responseData;
    },
    onSuccess: () => {
      toast({
        title: 'Quote Requested!',
        description: 'The vendor will respond within 24 hours.'
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-quotes'] });
    }
  });
}

export function useVendorQuotes() {
  return useQuery({
    queryKey: ['vendor-quotes'],
    queryFn: async () => {
      const { data } = await fetchWeddingWithFallback([
        '/api/wedding/vendor-quotes',
        '/api/wedding/quotes',
      ]);
      return normalizeQuotesResponse(data);
    },
  });
}

export function useSaveVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendorId: string | number) => {
      const { data } = await fetchWeddingWithFallback(
        [`/api/wedding/saved-vendors/${vendorId}`, '/api/wedding/vendor-quotes'],
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vendorId: Number(vendorId) }),
        }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-quotes'] });
    }
  });
}

// =========================================================
// NEW HOOK: Premium Vendor Messaging Lock
// =========================================================

export function useSendMessageToVendor() {
  const { toast } = useToast();
  // Get user context to check subscription status
  const { user } = useUser();
  const isPremium = user?.subscription === 'premium';

  return useMutation({
    mutationFn: async (data: { vendorId: string; message: string }) => {
      if (!isPremium) {
        // Enforce the premium lock before making the API call
        // This error will be caught by the onError handler below
        throw new Error('Direct vendor messaging is a Premium feature. Please upgrade to contact vendors directly.');
      }

      const { data: responseData } = await fetchWeddingWithFallback([
        '/api/wedding/vendor-message',
      ], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      return responseData;
    },
    onSuccess: () => {
      toast({
        title: 'Message Sent!',
        description: 'Your message has been securely sent to the vendor.',
      });
    },
    onError: (error: any) => {
      // Show the error message, which will contain the premium lock notice for free users
      toast({
        title: 'Action Blocked',
        description: error?.message || 'Failed to send message',
        variant: 'destructive',
      });
    }
  });
}
