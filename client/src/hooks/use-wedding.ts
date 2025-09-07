import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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
