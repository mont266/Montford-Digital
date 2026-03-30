import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

export const CheckoutForm = ({ 
  returnUrl, 
  onSuccess,
  billingDetails
}: { 
  returnUrl: string, 
  onSuccess?: () => void,
  billingDetails?: { name?: string, email?: string }
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        payment_method_data: billingDetails ? {
          billing_details: {
            name: billingDetails.name,
            email: billingDetails.email,
          }
        } : undefined,
      },
      redirect: 'if_required',
    });

    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") {
        setMessage(error.message || "An error occurred.");
      } else {
        setMessage("An unexpected error occurred.");
      }
    } else {
      if (onSuccess) onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      <button 
        disabled={isLoading || !stripe || !elements} 
        id="submit"
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span id="button-text">
          {isLoading ? <div className="spinner" id="spinner">Processing...</div> : "Pay now"}
        </span>
      </button>
      {message && <div id="payment-message" className="text-red-400 text-sm mt-2">{message}</div>}
    </form>
  );
};
