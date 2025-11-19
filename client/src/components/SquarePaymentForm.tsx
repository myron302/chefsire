import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SquarePaymentFormProps {
  amount: number;
  orderId: string;
  onPaymentSuccess: () => void;
  onPaymentError?: (error: string) => void;
}

export default function SquarePaymentForm({
  amount,
  orderId,
  onPaymentSuccess,
  onPaymentError,
}: SquarePaymentFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [squarePayments, setSquarePayments] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const { toast } = useToast();

  const cardContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeSquare();
  }, []);

  const initializeSquare = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get Square configuration from backend
      const configResponse = await fetch("/api/payments/square-config", {
        credentials: "include",
      });

      if (!configResponse.ok) {
        throw new Error("Failed to load payment configuration");
      }

      const config = await configResponse.json();

      // Dynamically import Square Web SDK
      const { payments } = await import("@square/web-sdk");

      // Initialize Square Payments
      const paymentsInstance = payments(
        config.config.applicationId,
        config.config.locationId
      );

      setSquarePayments(paymentsInstance);

      // Initialize card payment method
      const cardInstance = await paymentsInstance.card();
      await cardInstance.attach(cardContainerRef.current!);

      setCard(cardInstance);
      setIsLoading(false);
    } catch (err: any) {
      console.error("Square initialization error:", err);
      setError("Failed to load payment form. Please refresh the page.");
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!card) {
      setError("Payment form not ready. Please try again.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Tokenize card details
      const tokenResult = await card.tokenize();

      if (tokenResult.status === "OK") {
        // Send token to backend to process payment
        const paymentResponse = await fetch("/api/payments/create-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            orderId,
            sourceId: tokenResult.token,
            verificationToken: tokenResult.details?.verificationToken,
          }),
        });

        const paymentData = await paymentResponse.json();

        if (paymentResponse.ok && paymentData.ok) {
          toast({
            title: "✓ Payment successful!",
            description: `Your order has been confirmed. Order #${orderId}`,
          });
          onPaymentSuccess();
        } else {
          throw new Error(paymentData.error || "Payment failed");
        }
      } else {
        // Handle tokenization errors
        let errorMessage = "Payment failed. Please check your card details.";

        if (tokenResult.errors && tokenResult.errors.length > 0) {
          errorMessage = tokenResult.errors[0].message || errorMessage;
        }

        throw new Error(errorMessage);
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      const errorMsg = err.message || "Payment failed. Please try again.";
      setError(errorMsg);
      toast({
        title: "Payment failed",
        description: errorMsg,
        variant: "destructive",
      });
      if (onPaymentError) {
        onPaymentError(errorMsg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount Display */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Amount:</span>
            <span className="text-2xl font-bold text-gray-900">
              ${amount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Square Card Form */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div
              ref={cardContainerRef}
              id="card-container"
              className="min-h-[100px]"
            />

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Button
              onClick={handlePayment}
              disabled={isProcessing || !card}
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay $${amount.toFixed(2)}`
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Secure payment powered by Square
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
