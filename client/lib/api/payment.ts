export interface PaymentTokenPayload {
  userId: string;
  amountIDR: number;
  isBooster: boolean;
  orderType: 'registration' | 'token_topup';
}

export interface PaymentTokenResponse {
  token: string;
  orderId: string;
}

export interface PaymentStatusResponse {
  isRegistered: boolean;
  tokenBalance: number;
  hasInsufficientToken: boolean;
  isBooster: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function createPaymentToken(payload: PaymentTokenPayload): Promise<PaymentTokenResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payment/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getPaymentStatus(userId: string): Promise<PaymentStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payment/status-for-user/${userId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
