import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';

export function useVendors(filters?: any) {
  return useQuery({
    queryKey: ['vendors', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/wedding/vendors?${params}`);
      if (!response.ok) throw new Error('Failed to fetch vendors');
      return response.json();
    }
  });
}

export function useRequestQuote() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/wedding/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to request quote');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Quote Requested!",
        description: "The vendor will respond within 24 hours."
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  });
}

export function useSaveVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendorId: string) => {
      const response = await fetch(`/api/wedding/saved-vendors/${vendorId}`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to save vendor');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-vendors'] });
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
        throw new Error("Direct vendor messaging is a Premium feature. Please upgrade to contact vendors directly.");
      }

      // API call to send the message (assumed endpoint)
      const response = await fetch('/api/wedding/vendor-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Sent!",
        description: "Your message has been securely sent to the vendor.",
      });
    },
    onError: (error) => {
      // Show the error message, which will contain the premium lock notice for free users
      toast({
        title: "Action Blocked",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}
